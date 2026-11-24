import { TaskClaimRepositoryPort } from './ports/task-claim-repository.port';
import { RejectionReason } from '../domain/value-objects/rejection-reason.vo';
import { SubmissionNotFoundError } from '../shared/errors/claim-errors';

export interface RejectTaskSubmissionInput {
  claimId: string;
  adminId: string;
  rejectionReason: string;
  now?: Date;
}

export interface RejectTaskSubmissionOutput {
  claim_id: string;
  task_id: string;
  worker_id: string;
  status: 'REJECTED';
  rejection_reason: string;
  reviewed_at: string;
}

/**
 * Use case Quản trị viên từ chối bài nộp bằng chứng của Người làm
 * Yêu cầu lý do từ chối cụ thể (10-500 ký tự) và tự động giải phóng slot cho cộng đồng nhận làm bù
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-012..016, REQ-RTS-018
 */
export class RejectTaskSubmissionUseCase {
  constructor(private readonly claimRepository: TaskClaimRepositoryPort) {}

  public async execute(input: RejectTaskSubmissionInput): Promise<RejectTaskSubmissionOutput> {
    const now = input.now || new Date();

    // 1. Kiểm tra tính hợp lệ của lý do từ chối (10-500 ký tự, khử XSS)
    const reasonVO = RejectionReason.create(input.rejectionReason);

    // 2. Kiểm tra tồn tại bài nộp
    const claim = await this.claimRepository.findById(input.claimId);
    if (!claim) {
      throw new SubmissionNotFoundError();
    }

    // 3. Thực hiện từ chối bài nộp một cách nguyên tử có khóa OCC chống xung đột
    const rejectedClaim = await this.claimRepository.rejectAtomic(
      input.claimId,
      input.adminId,
      reasonVO.getValue(),
      now
    );

    return {
      claim_id: rejectedClaim.id,
      task_id: rejectedClaim.taskId,
      worker_id: rejectedClaim.workerId,
      status: 'REJECTED',
      rejection_reason: reasonVO.getValue(),
      reviewed_at: rejectedClaim.reviewedAt ? rejectedClaim.reviewedAt.toISOString() : now.toISOString(),
    };
  }
}

