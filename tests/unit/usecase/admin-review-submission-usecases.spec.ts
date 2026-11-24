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
  SubmissionNotFoundError,
  TaskQuotaExceededError,
  ClaimAlreadyReviewedError,
  SubmissionRejectionReasonInvalidError,
} from '../../../src/shared/errors/claim-errors';

describe('Admin Review Submission Use Cases (T004-RTS)', () => {
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

  const createSampleTask = async (id: string, quotaCount: number = 2, rewardCoins: number = 500) => {
    const task = FreelanceTask.createDraft({
      id,
      creatorId: 'employer-01',
      title: 'Tải ứng dụng và đánh giá 5 sao',
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

  describe('ApproveTaskSubmissionUseCase', () => {
    it('phê duyệt bài nộp thành công: chuyển APPROVED, cộng Xu ví Worker và ghi nhận giao dịch', async () => {
      const task = await createSampleTask('task-01', 5, 200);
      const claim = await createSubmittedClaim(task.getId(), 'worker-A');

      const result = await approveUseCase.execute({
        claimId: claim.id,
        adminId: 'admin-007',
        now: new Date('2026-11-23T11:00:00Z'),
      });

      expect(result.status).toBe('APPROVED');
      expect(result.reward_coins).toBe(200);
      expect(result.worker_new_balance).toBe(200);
      expect(result.task_status).toBe('ACTIVE'); // Chưa đủ quota 5 nên vẫn ACTIVE

      // Kiểm tra trong ví Worker
      const wallet = await walletRepo.findByWorkerId('worker-A');
      expect(wallet?.balance).toBe(200);

      // Kiểm tra lịch sử giao dịch
      const txs = await walletRepo.findTransactionsByWorkerId('worker-A');
      expect(txs.length).toBe(1);
      expect(txs[0].amount).toBe(200);
      expect(txs[0].type).toBe('TASK_REWARD');
    });

    it('tự động chuyển trạng thái nhiệm vụ sang COMPLETED khi bài duyệt đạt đủ Quota', async () => {
      // Quota chỉ là 1
      const task = await createSampleTask('task-single', 1, 300);
      const claim = await createSubmittedClaim(task.getId(), 'worker-B');

      const result = await approveUseCase.execute({
        claimId: claim.id,
        adminId: 'admin-007',
      });

      expect(result.status).toBe('APPROVED');
      expect(result.task_status).toBe('COMPLETED');

      // Task trong DB đã được cập nhật sang COMPLETED
      const updatedTask = await taskRepo.findById('task-single');
      expect(updatedTask?.getStatus().isCompleted()).toBe(true);
    });

    it('chặn duyệt bài và ném lỗi TaskQuotaExceededError khi số lượng đã duyệt đạt Quota', async () => {
      const task = await createSampleTask('task-quota-limit', 1, 100);

      const claim1 = await createSubmittedClaim(task.getId(), 'worker-1');
      const claim2 = await createSubmittedClaim(task.getId(), 'worker-2');

      // Duyệt claim 1 thành công
      await approveUseCase.execute({ claimId: claim1.id, adminId: 'admin-01' });

      // Duyệt tiếp claim 2 sẽ bị chặn vì đã đạt quota 1
      await expect(approveUseCase.execute({ claimId: claim2.id, adminId: 'admin-01' }))
        .rejects.toThrow(TaskQuotaExceededError);
    });

    it('ném lỗi SubmissionNotFoundError khi claimId không tồn tại', async () => {
      await expect(approveUseCase.execute({ claimId: 'invalid-claim', adminId: 'admin-01' }))
        .rejects.toThrow(SubmissionNotFoundError);
    });
  });

  describe('RejectTaskSubmissionUseCase', () => {
    it('từ chối bài nộp thành công: chuyển REJECTED và lưu lý do hợp lệ', async () => {
      const task = await createSampleTask('task-reject-01', 3, 200);
      const claim = await createSubmittedClaim(task.getId(), 'worker-C');

      const reason = 'Ảnh chụp màn hình bị mờ và không đúng thời gian quy định.';
      const result = await rejectUseCase.execute({
        claimId: claim.id,
        adminId: 'admin-007',
        rejectionReason: reason,
      });

      expect(result.status).toBe('REJECTED');
      expect(result.rejection_reason).toBe(reason);

      // Kiểm tra trong repo
      const updatedClaim = await claimRepo.findById(claim.id);
      expect(updatedClaim?.status.getValue()).toBe('REJECTED');
      expect(updatedClaim?.rejectionReason).toBe(reason);
      expect(updatedClaim?.reviewerId).toBe('admin-007');
    });

    it('ném lỗi SubmissionRejectionReasonInvalidError khi lý do dưới 10 ký tự', async () => {
      const task = await createSampleTask('task-reject-02', 3, 200);
      const claim = await createSubmittedClaim(task.getId(), 'worker-D');

      await expect(rejectUseCase.execute({
        claimId: claim.id,
        adminId: 'admin-01',
        rejectionReason: 'Quá ngắn',
      })).rejects.toThrow(SubmissionRejectionReasonInvalidError);
    });

    it('ném lỗi ClaimAlreadyReviewedError khi cố tình từ chối bài đã được phê duyệt', async () => {
      const task = await createSampleTask('task-reject-03', 3, 200);
      const claim = await createSubmittedClaim(task.getId(), 'worker-E');

      await approveUseCase.execute({ claimId: claim.id, adminId: 'admin-01' });

      await expect(rejectUseCase.execute({
        claimId: claim.id,
        adminId: 'admin-01',
        rejectionReason: 'Lý do từ chối sau khi đã được duyệt',
      })).rejects.toThrow(ClaimAlreadyReviewedError);
    });
  });
});
