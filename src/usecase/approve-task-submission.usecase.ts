import { TaskClaimRepositoryPort } from './ports/task-claim-repository.port';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { WalletPort } from './ports/wallet.port';
import {
  SubmissionNotFoundError,
  TaskQuotaExceededError,
} from '../shared/errors/claim-errors';

export interface ApproveTaskSubmissionInput {
  claimId: string;
  adminId: string;
  now?: Date;
}

export interface ApproveTaskSubmissionOutput {
  claim_id: string;
  task_id: string;
  worker_id: string;
  reward_coins: number;
  status: 'APPROVED';
  worker_new_balance: number;
  task_status: string;
  reviewed_at: string;
}

/**
 * Use case Quản trị viên phê duyệt bài nộp bằng chứng của Người làm
 * Tự động cộng Xu thưởng vào ví Worker, ghi nhận lịch sử giao dịch và tự động đóng nhiệm vụ khi đạt quota
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-007..011, REQ-RTS-018
 */
export class ApproveTaskSubmissionUseCase {
  constructor(
    private readonly claimRepository: TaskClaimRepositoryPort,
    private readonly taskRepository: TaskRepositoryPort,
    private readonly walletPort: WalletPort
  ) {}

  public async execute(input: ApproveTaskSubmissionInput): Promise<ApproveTaskSubmissionOutput> {
    const now = input.now || new Date();

    // 1. Kiểm tra tồn tại bài nộp
    const claim = await this.claimRepository.findById(input.claimId);
    if (!claim) {
      throw new SubmissionNotFoundError();
    }

    // 2. Kiểm tra tồn tại nhiệm vụ
    const task = await this.taskRepository.findById(claim.taskId);
    if (!task) {
      throw new SubmissionNotFoundError('Không tìm thấy nhiệm vụ tương ứng với bài nộp.');
    }

    // 3. Khóa an toàn hạn ngạch: Chặn duyệt nếu số bài duyệt thành công đã đạt Quota
    const approvedCount = await this.claimRepository.countApprovedClaims(task.getId());
    if (approvedCount >= task.getQuota().getValue()) {
      throw new TaskQuotaExceededError();
    }

    // 4. Phê duyệt bài nộp một cách nguyên tử có khóa OCC chống duyệt đúp và chống tràn Quota
    const approvedClaim = await this.claimRepository.approveAtomic(
      input.claimId,
      input.adminId,
      now,
      task.getQuota().getValue()
    );

    // 5. Cộng Xu thưởng vào số dư ví của Worker và ghi nhận lịch sử giao dịch
    const rewardCoins = task.getRewardCoins().getValue();
    const { wallet } = await this.walletPort.creditAtomic(approvedClaim.workerId, rewardCoins, {
      referenceId: approvedClaim.id,
      description: `Thưởng hoàn thành nhiệm vụ: ${task.getTitle()}`,
      now,
    });

    // 6. Kiểm tra chỉ tiêu Quota sau khi duyệt: nếu đạt quota thì tự động chuyển Task sang COMPLETED
    const newApprovedCount = approvedCount + 1;
    if (newApprovedCount >= task.getQuota().getValue() && task.getStatus().isActive()) {
      const prevVersion = task.getVersion();
      task.markCompleted();
      await this.taskRepository.update(task, prevVersion);
    }

    return {
      claim_id: approvedClaim.id,
      task_id: approvedClaim.taskId,
      worker_id: approvedClaim.workerId,
      reward_coins: rewardCoins,
      status: 'APPROVED',
      worker_new_balance: wallet.balance,
      task_status: task.getStatus().getValue(),
      reviewed_at: approvedClaim.reviewedAt ? approvedClaim.reviewedAt.toISOString() : now.toISOString(),
    };
  }
}
