import { describe, it, expect, beforeEach } from 'vitest';
import { ApproveTaskSubmissionUseCase } from '../../../src/usecase/approve-task-submission.usecase';
import { RejectTaskSubmissionUseCase } from '../../../src/usecase/reject-task-submission.usecase';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { InMemoryWalletRepository } from '../../../src/infra/repositories/in-memory-wallet.repository';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';
import {
  ClaimAlreadyReviewedError,
  TaskQuotaExceededError,
} from '../../../src/shared/errors/claim-errors';

describe('Admin Concurrency OCC Mutex: Double Review & Quota Overflow Protection (T005-RTS)', () => {
  let claimRepo: InMemoryTaskClaimRepository;
  let taskRepo: InMemoryTaskRepository;
  let walletRepo: InMemoryWalletRepository;

  let approveUseCase: ApproveTaskSubmissionUseCase;
  let rejectUseCase: RejectTaskSubmissionUseCase;

  beforeEach(() => {
    claimRepo = new InMemoryTaskClaimRepository();
    taskRepo = new InMemoryTaskRepository(false);
    walletRepo = new InMemoryWalletRepository();

    approveUseCase = new ApproveTaskSubmissionUseCase(claimRepo, taskRepo, walletRepo);
    rejectUseCase = new RejectTaskSubmissionUseCase(claimRepo);
  });

  const createSampleTask = async (id: string, quotaCount: number = 5, rewardCoins: number = 300) => {
    const task = FreelanceTask.createDraft({
      id,
      creatorId: 'employer-01',
      title: 'Cài app và đánh giá 5 sao',
      description: 'Mô tả chi tiết việc cần làm để nhận thưởng',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(rewardCoins),
      quota: Quota.create(quotaCount),
      steps: [StepInstruction.create(1, 'Làm theo hướng dẫn')],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-1',
          title: 'Ảnh bằng chứng',
          description: 'Chụp ảnh màn hình hoàn thành',
          proofType: 'SCREENSHOT_IMAGE',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    task.publish();
    await taskRepo.save(task);
    return task;
  };

  const createSubmittedClaim = async (taskId: string, workerId: string) => {
    const claim = TaskClaim.create({ taskId, workerId, executionTimeMinutes: 60 });
    claim.submit([], new Date());
    await claimRepo.save(claim);
    return claim;
  };

  it('Scenario 1: Hai Admin duyệt cùng một bài nộp đồng thời -> Đúng 1 request thành công, không Double Crediting', async () => {
    const task = await createSampleTask('task-concurrent-01', 5, 500);
    const claim = await createSubmittedClaim(task.getId(), 'worker-vip');

    // Giả lập 2 request duyệt đồng thời gửi tới hệ thống
    const results = await Promise.allSettled([
      approveUseCase.execute({ claimId: claim.id, adminId: 'admin-alpha' }),
      approveUseCase.execute({ claimId: claim.id, adminId: 'admin-beta' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Lỗi trả về phải là ClaimAlreadyReviewedError
    const errorReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(errorReason).toBeInstanceOf(ClaimAlreadyReviewedError);

    // Kiểm tra số dư ví Worker: Chỉ được cộng đúng 500 Xu (không phải 1,000 Xu)
    const wallet = await walletRepo.findByWorkerId('worker-vip');
    expect(wallet?.balance).toBe(500);

    // Lịch sử giao dịch ví chỉ có đúng 1 bản ghi
    const txs = await walletRepo.findTransactionsByWorkerId('worker-vip');
    expect(txs.length).toBe(1);
  });

  it('Scenario 2: Một Admin duyệt và một Admin từ chối cùng lúc -> Đúng 1 bên thành công, bên kia bị chặn', async () => {
    const task = await createSampleTask('task-concurrent-02', 5, 200);
    const claim = await createSubmittedClaim(task.getId(), 'worker-middle');

    const results = await Promise.allSettled([
      approveUseCase.execute({ claimId: claim.id, adminId: 'admin-1' }),
      rejectUseCase.execute({
        claimId: claim.id,
        adminId: 'admin-2',
        rejectionReason: 'Bằng chứng không hợp lệ theo quy định.',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const errorReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(errorReason).toBeInstanceOf(ClaimAlreadyReviewedError);
  });

  it('Scenario 3: Nhiệm vụ chỉ còn đúng 1 suất Quota: Hai bài nộp khác nhau được duyệt đồng thời -> Đúng 1 bài được duyệt, 1 bài bị chặn Quota Exceeded', async () => {
    // Quota chỉ là 1
    const task = await createSampleTask('task-quota-1', 1, 400);

    const claimA = await createSubmittedClaim(task.getId(), 'worker-A');
    const claimB = await createSubmittedClaim(task.getId(), 'worker-B');

    // Hai Admin duyệt 2 bài nộp khác nhau cùng lúc
    const results = await Promise.allSettled([
      approveUseCase.execute({ claimId: claimA.id, adminId: 'admin-1' }),
      approveUseCase.execute({ claimId: claimB.id, adminId: 'admin-2' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const errorReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(errorReason).toBeInstanceOf(TaskQuotaExceededError);

    // Task đã chuyển sang COMPLETED
    const updatedTask = await taskRepo.findById('task-quota-1');
    expect(updatedTask?.getStatus().isCompleted()).toBe(true);
  });
});

