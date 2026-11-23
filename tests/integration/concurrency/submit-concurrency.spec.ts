import { describe, it, expect, beforeEach } from 'vitest';
import { SubmitTaskProofUseCase } from '../../../src/usecase/submit-task-proof.usecase';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';
import { ClaimNotInProgressError } from '../../../src/shared/errors/claim-errors';

describe('T004-STP Concurrency & Double Submit Gate (REQ-STP-011, BDD Scenario 4 & 7)', () => {
  let claimRepo: InMemoryTaskClaimRepository;
  let taskRepo: InMemoryTaskRepository;
  let submitUseCase: SubmitTaskProofUseCase;

  const baseTime = new Date('2026-11-23T10:00:00.000Z');
  let testTask: FreelanceTask;

  beforeEach(async () => {
    claimRepo = new InMemoryTaskClaimRepository();
    taskRepo = new InMemoryTaskRepository(false);
    submitUseCase = new SubmitTaskProofUseCase(claimRepo, taskRepo);

    testTask = FreelanceTask.createDraft({
      id: 'race-submit-task',
      creatorId: 'employer-race-01',
      title: 'Nhiệm vụ kiểm thử Double Submit đồng thời',
      description: 'Mô tả chi tiết nhiệm vụ kiểm thử chống Race Condition khi nộp bằng chứng',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(1000),
      quota: Quota.create(5),
      steps: [
        StepInstruction.create(1, 'Thực hiện nhiệm vụ theo hướng dẫn'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-race-screen',
          proofType: 'SCREENSHOT_IMAGE',
          title: 'Ảnh chụp màn hình kết quả',
          description: 'Ảnh kết quả hoàn thành',
          isRequired: true,
        }),
        ProofRequirement.create({
          id: 'req-race-tx',
          proofType: 'TEXT',
          title: 'Mã xác thực giao dịch',
          description: 'Mã số giao dịch',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    testTask.publish();
    await taskRepo.save(testTask);
  });

  it('BDD Scenario 4: Worker click nộp bài 5 lần liên tiếp trong cùng 1 mili-giây -> Đúng 1 thành công (200), 4 request còn lại bị từ chối 409 (ClaimNotInProgressError)', async () => {
    const claim = TaskClaim.create({
      taskId: testTask.getId(),
      workerId: 'worker-fast-clicker',
      executionTimeMinutes: 60,
      now: baseTime,
    });
    await claimRepo.save(claim);

    const submitPayload = {
      claimId: claim.id,
      workerId: 'worker-fast-clicker',
      proofs: [
        { requirementId: 'req-race-screen', value: '/uploads/proofs/proof-001.png' },
        { requirementId: 'req-race-tx', value: 'TX-RACE-12345' },
      ],
      now: new Date('2026-11-23T10:15:00.000Z'),
    };

    // 5 request gửi đồng thời bằng Promise.allSettled
    const requests = Array.from({ length: 5 }, () =>
      submitUseCase.execute(submitPayload)
    );

    const settledResults = await Promise.allSettled(requests);

    const successful = settledResults.filter((r) => r.status === 'fulfilled');
    const rejected = settledResults.filter((r) => r.status === 'rejected');

    // Khẳng định: Đúng 1 request thành công
    expect(successful).toHaveLength(1);
    // Khẳng định: 4 request còn lại bị từ chối
    expect(rejected).toHaveLength(4);

    // Kiểm tra mã lỗi của các request bị từ chối
    for (const r of rejected) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ClaimNotInProgressError);
        expect((r.reason as ClaimNotInProgressError).errorCode).toBe('CLAIM_NOT_IN_PROGRESS');
        expect((r.reason as ClaimNotInProgressError).statusCode).toBe(409);
      }
    }

    // Kiểm tra tính toàn vẹn dữ liệu trong repository
    const finalClaim = await claimRepo.findById(claim.id);
    expect(finalClaim?.status.isSubmitted()).toBe(true);
    expect(finalClaim?.getSubmittedProofs()).toHaveLength(2);

    const submittedCount = await claimRepo.countSubmittedClaims(testTask.getId());
    expect(submittedCount).toBe(1);
  });

  it('Mô phỏng 10 request submit đồng thời từ network jitter/retry -> Đúng 1 request thành công, 9 request nhận 409', async () => {
    const claim = TaskClaim.create({
      taskId: testTask.getId(),
      workerId: 'worker-network-retry',
      executionTimeMinutes: 60,
      now: baseTime,
    });
    await claimRepo.save(claim);

    const submitPayload = {
      claimId: claim.id,
      workerId: 'worker-network-retry',
      proofs: [
        { requirementId: 'req-race-screen', value: '/uploads/proofs/proof-network.png' },
        { requirementId: 'req-race-tx', value: 'TX-RETRY-9999' },
      ],
      now: new Date('2026-11-23T10:20:00.000Z'),
    };

    const requests = Array.from({ length: 10 }, () =>
      submitUseCase.execute(submitPayload)
    );

    const settledResults = await Promise.allSettled(requests);

    const successful = settledResults.filter((r) => r.status === 'fulfilled');
    const rejected = settledResults.filter((r) => r.status === 'rejected');

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    for (const r of rejected) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ClaimNotInProgressError);
      }
    }
  });
});

