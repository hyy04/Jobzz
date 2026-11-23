import { describe, it, expect, beforeEach } from 'vitest';
import { ClaimTaskSlotUseCase } from '../../../src/usecase/claim-task-slot.usecase';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';
import { TaskQuotaExhaustedError } from '../../../src/shared/errors/claim-errors';

describe('Concurrency & Race Condition Verification Gate (REQ-BCT-014 & Scenario 7 BDD)', () => {
  let taskRepo: InMemoryTaskRepository;
  let claimRepo: InMemoryTaskClaimRepository;
  let claimUseCase: ClaimTaskSlotUseCase;
  const baseTime = new Date('2026-11-20T10:00:00.000Z');

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepository(false);
    claimRepo = new InMemoryTaskClaimRepository();
    claimUseCase = new ClaimTaskSlotUseCase(taskRepo, claimRepo);
  });

  const createRaceTask = (taskId: string, quotaValue: number) => {
    const task = FreelanceTask.createDraft({
      id: taskId,
      creatorId: 'employer-admin-01',
      title: `Nhiệm vụ tranh chấp suất ${taskId}`,
      description: 'Mô tả chi tiết nhiệm vụ với độ dài hợp lệ đảm bảo vượt hai mươi ký tự',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(5000),
      quota: Quota.create(quotaValue),
      steps: [
        StepInstruction.create(1, 'Cài đặt ứng dụng từ cửa hàng chính thức', 'https://jobzz.vn/race'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'p1',
          proofType: 'TEXT',
          title: 'Mã xác thực giao dịch',
          description: 'Nhập chính xác mã giao dịch xuất hiện trên màn hình ứng dụng',
        }),
      ],
      executionTimeMinutes: 45,
      autoApprovalDays: 3,
    });
    task.publish();
    return task;
  };

  it('Scenario 7 BDD: Khi nhiệm vụ chỉ còn đúng 1 suất cuối cùng, 5 Worker tranh chấp đồng thời -> Đúng 1 thành công, 4 nhận 409 (Zero Over-allocation)', async () => {
    const task = createRaceTask('race-task-single-slot', 1);
    await taskRepo.save(task);

    const workerIds = ['worker-A', 'worker-B', 'worker-C', 'worker-D', 'worker-E'];

    // Mô phỏng 5 request đồng thời gửi lên trong cùng một mili-giây
    const results = await Promise.allSettled(
      workerIds.map((wId) =>
        claimUseCase.execute({
          taskId: 'race-task-single-slot',
          workerId: wId,
          workerRole: 'WORKER',
          now: baseTime,
        })
      )
    );

    // Đếm số lượng thành công và thất bại
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Xác minh nghiêm ngặt:
    // 1. Chỉ duy nhất 1 Worker nhận được slot (201 Created)
    expect(fulfilled.length).toBe(1);
    // 2. Toàn bộ 4 Worker còn lại nhận lỗi TaskQuotaExhaustedError (409 Conflict)
    expect(rejected.length).toBe(4);
    rejected.forEach((r) => {
      const reason = (r as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(TaskQuotaExhaustedError);
      expect((reason as TaskQuotaExhaustedError).statusCode).toBe(409);
      expect((reason as TaskQuotaExhaustedError).errorCode).toBe('TASK_QUOTA_EXHAUSTED');
    });

    // 3. Toàn vẹn ngân sách: Tổng số slot IN_PROGRESS trong DB đúng bằng 1
    const activeCount = await claimRepo.countActiveClaims('race-task-single-slot', baseTime);
    expect(activeCount).toBe(1);
  });

  it('Khi nhiệm vụ có 3 suất còn lại, 10 Worker tranh chấp đồng thời -> Đúng 3 thành công, 7 nhận 409', async () => {
    const task = createRaceTask('race-task-multi-slot', 3);
    await taskRepo.save(task);

    const workerIds = Array.from({ length: 10 }, (_, i) => `worker-race-${i + 1}`);

    const results = await Promise.allSettled(
      workerIds.map((wId) =>
        claimUseCase.execute({
          taskId: 'race-task-multi-slot',
          workerId: wId,
          workerRole: 'WORKER',
          now: baseTime,
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(3);
    expect(rejected.length).toBe(7);

    const activeCount = await claimRepo.countActiveClaims('race-task-multi-slot', baseTime);
    expect(activeCount).toBe(3);
  });
});

