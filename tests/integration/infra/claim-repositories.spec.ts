import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { LiveTaskProgressAdapter } from '../../../src/infra/adapters/live-task-progress.adapter';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { SecureUrl } from '../../../src/domain/value-objects/secure-url.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';
import { TaskQuotaExhaustedError } from '../../../src/shared/errors/claim-errors';

describe('Claim Repositories & Live TaskProgressAdapter Integration Tests', () => {
  let claimRepo: InMemoryTaskClaimRepository;
  let sampleTask: FreelanceTask;
  const baseTime = new Date('2026-11-20T10:00:00.000Z');

  beforeEach(() => {
    claimRepo = new InMemoryTaskClaimRepository();
    sampleTask = FreelanceTask.createDraft({
      creatorId: 'admin-01',
      title: 'Tải và đánh giá app Jobzz',
      description: 'Cài đặt từ cửa hàng chính thức và hoàn thành đánh giá',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(2000),
      quota: Quota.create(2), // Quota = 2 slots
      steps: [
        StepInstruction.create(
          1,
          'Cài đặt ứng dụng từ cửa hàng chính thức',
          'https://jobzz.vn/app'
        ),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'p1',
          proofType: 'TEXT',
          title: 'Tên người dùng Telegram',
          description: 'Nhập chính xác tên người dùng tài khoản đã đăng ký',
        }),
      ],
      executionTimeMinutes: 30,
      autoApprovalDays: 3,
    });
    sampleTask.publish();
  });

  describe('InMemoryTaskClaimRepository CRUD & Queries', () => {
    it('lưu trữ và tìm kiếm TaskClaim theo id và worker', async () => {
      const claim = TaskClaim.create({
        taskId: sampleTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 30,
        now: baseTime,
      });

      await claimRepo.save(claim);

      const found = await claimRepo.findById(claim.id);
      expect(found).not.toBeNull();
      expect(found?.taskId).toBe(sampleTask.getId());
      expect(found?.workerId).toBe('worker-01');

      const workerClaims = await claimRepo.findByTaskAndWorker(sampleTask.getId(), 'worker-01');
      expect(workerClaims.length).toBe(1);
    });

    it('findActiveClaim() chỉ trả về claim đang IN_PROGRESS và còn hạn', async () => {
      const claim = TaskClaim.create({
        taskId: sampleTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 30, // Hết hạn lúc 10:30
        now: baseTime,
      });
      await claimRepo.save(claim);

      // 1. Trước hạn
      const active = await claimRepo.findActiveClaim(sampleTask.getId(), 'worker-01', new Date('2026-11-20T10:15:00.000Z'));
      expect(active).not.toBeNull();

      // 2. Sau hạn (10:35)
      const expired = await claimRepo.findActiveClaim(sampleTask.getId(), 'worker-01', new Date('2026-11-20T10:35:00.000Z'));
      expect(expired).toBeNull();
    });

    it('claimSlotAtomic() giữ slot thành công và ném lỗi khi hết quota', async () => {
      // Slot 1
      const claim1 = await claimRepo.claimSlotAtomic(sampleTask, 'worker-01', 30, baseTime);
      expect(claim1.id).toBeDefined();

      // Slot 2
      const claim2 = await claimRepo.claimSlotAtomic(sampleTask, 'worker-02', 30, baseTime);
      expect(claim2.id).toBeDefined();

      // Slot 3 -> Quota = 2 nên phải ném TaskQuotaExhaustedError
      await expect(
        claimRepo.claimSlotAtomic(sampleTask, 'worker-03', 30, baseTime)
      ).rejects.toThrow(TaskQuotaExhaustedError);
    });
  });

  describe('LiveTaskProgressAdapter với Lazy Evaluation (REQ-BCT-017)', () => {
    it('tự động hoàn trả slot khi thời gian vượt quá expires_at', async () => {
      let simulatedTime = new Date('2026-11-20T10:00:00.000Z');
      const progressAdapter = new LiveTaskProgressAdapter(claimRepo, () => simulatedTime);

      // Ban đầu chưa có ai nhận việc
      const initialProgress = await progressAdapter.getProgress(sampleTask.getId());
      expect(initialProgress.in_progress_count).toBe(0);
      expect(initialProgress.approved_count).toBe(0);

      // Worker 1 nhận việc lúc 10:00 với hạn 30 phút (hết hạn lúc 10:30)
      await claimRepo.claimSlotAtomic(sampleTask, 'worker-01', 30, simulatedTime);

      // Kiểm tra lúc 10:15 -> in_progress_count = 1
      simulatedTime = new Date('2026-11-20T10:15:00.000Z');
      const progressMidway = await progressAdapter.getProgress(sampleTask.getId());
      expect(progressMidway.in_progress_count).toBe(1);

      // Thời gian trôi qua 10:31 -> Slot tự động mất hiệu lực (Lazy Reclaim), in_progress_count trở về 0
      simulatedTime = new Date('2026-11-20T10:31:00.000Z');
      const progressExpired = await progressAdapter.getProgress(sampleTask.getId());
      expect(progressExpired.in_progress_count).toBe(0);

      // Lúc này Worker 2 có thể nhận lại slot trống đó mà không bị nghẽn
      const claim2 = await claimRepo.claimSlotAtomic(sampleTask, 'worker-02', 30, simulatedTime);
      expect(claim2).toBeDefined();
    });
  });
});
