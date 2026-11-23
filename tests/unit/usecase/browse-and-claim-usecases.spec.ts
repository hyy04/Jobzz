import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsePublicTasksUseCase } from '../../../src/usecase/browse-public-tasks.usecase';
import { GetPublicTaskDetailsUseCase } from '../../../src/usecase/get-public-task-details.usecase';
import { ClaimTaskSlotUseCase } from '../../../src/usecase/claim-task-slot.usecase';
import { CancelTaskClaimUseCase } from '../../../src/usecase/cancel-task-claim.usecase';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { LiveTaskProgressAdapter } from '../../../src/infra/adapters/live-task-progress.adapter';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';
import {
  UnauthorizedWorkerError,
  EmployerCannotClaimOwnTaskError,
  WorkerAlreadyClaimedTaskError,
  TaskQuotaExhaustedError,
  TaskNotAvailableForClaimError,
  ClaimNotFoundError,
} from '../../../src/shared/errors/claim-errors';
import { TaskNotFoundError } from '../../../src/shared/errors/task-errors';

describe('Browse & Claim Task Use Cases (Clean Architecture Application Layer)', () => {
  let taskRepo: InMemoryTaskRepository;
  let claimRepo: InMemoryTaskClaimRepository;
  let progressPort: LiveTaskProgressAdapter;

  let browseUseCase: BrowsePublicTasksUseCase;
  let getDetailsUseCase: GetPublicTaskDetailsUseCase;
  let claimUseCase: ClaimTaskSlotUseCase;
  let cancelUseCase: CancelTaskClaimUseCase;

  const baseTime = new Date('2026-11-20T10:00:00.000Z');

  const createSampleTask = (id: string, quota = 5, reward = 2000, category: any = 'APP_INSTALL', creatorId = 'admin-01') => {
    const task = FreelanceTask.createDraft({
      id,
      creatorId,
      title: `Nhiệm vụ kiểm thử ${id}`,
      description: 'Mô tả chi tiết nhiệm vụ kiểm thử với độ dài hợp lệ hơn hai mươi ký tự',
      category,
      rewardCoins: RewardCoins.create(reward),
      quota: Quota.create(quota),
      steps: [
        StepInstruction.create(1, 'Cài đặt ứng dụng từ cửa hàng chính thức', 'https://jobzz.vn/app', 'https://jobzz.vn/step1.png'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'p1',
          proofType: 'SCREENSHOT_IMAGE',
          title: 'Ảnh chụp màn hình trang chủ',
          description: 'Chụp rõ màn hình trang chủ sau khi hoàn thành đăng nhập',
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    task.publish();
    return task;
  };

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepository(false); // empty
    claimRepo = new InMemoryTaskClaimRepository();
    progressPort = new LiveTaskProgressAdapter(claimRepo, () => baseTime);

    browseUseCase = new BrowsePublicTasksUseCase(taskRepo, progressPort);
    getDetailsUseCase = new GetPublicTaskDetailsUseCase(taskRepo, progressPort);
    claimUseCase = new ClaimTaskSlotUseCase(taskRepo, claimRepo);
    cancelUseCase = new CancelTaskClaimUseCase(claimRepo);
  });

  describe('BrowsePublicTasksUseCase (REQ-BCT-001..005)', () => {
    it('chỉ trả về các nhiệm vụ ACTIVE và còn suất (remaining_quota > 0)', async () => {
      const task1 = createSampleTask('task-01', 2, 2000);
      const task2 = createSampleTask('task-02', 1, 5000);
      await taskRepo.save(task1);
      await taskRepo.save(task2);

      // Chiếm hết suất của task2 (1 slot)
      await claimRepo.claimSlotAtomic(task2, 'worker-99', 60, baseTime);

      const result = await browseUseCase.execute({ page: 1, limit: 10 });
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe('task-01');
      expect(result.data[0].remaining_quota).toBe(2);
      expect(result.pagination.total).toBe(1);
    });

    it('hỗ trợ lọc theo danh mục category (REQ-BCT-002)', async () => {
      const taskApp = createSampleTask('task-app', 5, 2000, 'APP_INSTALL');
      const taskSurvey = createSampleTask('task-survey', 5, 1000, 'SURVEY');
      await taskRepo.save(taskApp);
      await taskRepo.save(taskSurvey);

      const result = await browseUseCase.execute({ category: 'SURVEY' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe('task-survey');
    });

    it('hỗ trợ sắp xếp theo thù lao Xu giảm dần REWARD_DESC (REQ-BCT-003)', async () => {
      const taskLow = createSampleTask('task-low', 5, 1000);
      const taskHigh = createSampleTask('task-high', 5, 10000);
      await taskRepo.save(taskLow);
      await taskRepo.save(taskHigh);

      const result = await browseUseCase.execute({ sort_by: 'REWARD_DESC' });
      expect(result.data[0].id).toBe('task-high');
      expect(result.data[1].id).toBe('task-low');
    });
  });

  describe('GetPublicTaskDetailsUseCase (REQ-BCT-006..008)', () => {
    it('trả về chi tiết đầy đủ của nhiệm vụ công khai kèm ảnh minh họa các bước', async () => {
      const task = createSampleTask('task-detail-01', 10, 3000);
      await taskRepo.save(task);

      const detail = await getDetailsUseCase.execute({ taskId: 'task-detail-01' });
      expect(detail.id).toBe('task-detail-01');
      expect(detail.remaining_quota).toBe(10);
      expect(detail.steps[0].image_url).toBe('https://jobzz.vn/step1.png');
      expect(detail.proof_requirements.length).toBe(1);
    });

    it('từ chối xem chi tiết khi nhiệm vụ không tồn tại (404 TASK_NOT_FOUND)', async () => {
      await expect(
        getDetailsUseCase.execute({ taskId: 'non-existent' })
      ).rejects.toThrow(TaskNotFoundError);
    });

    it('từ chối xem chi tiết khi nhiệm vụ có trạng thái khác ACTIVE (400)', async () => {
      const task = createSampleTask('task-closed', 10);
      task.close();
      await taskRepo.save(task);

      await expect(
        getDetailsUseCase.execute({ taskId: 'task-closed' })
      ).rejects.toThrow(TaskNotAvailableForClaimError);
    });
  });

  describe('ClaimTaskSlotUseCase (REQ-BCT-009..014)', () => {
    it('cho phép Worker nhận việc giữ slot thành công (Happy Path)', async () => {
      const task = createSampleTask('task-claim-01', 5, 2000, 'APP_INSTALL', 'admin-01');
      await taskRepo.save(task);

      const result = await claimUseCase.execute({
        taskId: 'task-claim-01',
        workerId: 'worker-01',
        workerRole: 'WORKER',
        now: baseTime,
      });

      expect(result.claim_id).toBeDefined();
      expect(result.task_id).toBe('task-claim-01');
      expect(result.worker_id).toBe('worker-01');
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.remaining_seconds).toBe(3600);
    });

    it('từ chối khi vai trò không phải WORKER (403 UNAUTHORIZED_WORKER)', async () => {
      const task = createSampleTask('task-claim-02');
      await taskRepo.save(task);

      await expect(
        claimUseCase.execute({
          taskId: 'task-claim-02',
          workerId: 'admin-01',
          workerRole: 'ADMIN',
          now: baseTime,
        })
      ).rejects.toThrow(UnauthorizedWorkerError);
    });

    it('chống tự gian lận Anti-Self-Dealing: cấm người tạo tự nhận việc (403)', async () => {
      const task = createSampleTask('task-self', 5, 2000, 'APP_INSTALL', 'admin-01');
      await taskRepo.save(task);

      await expect(
        claimUseCase.execute({
          taskId: 'task-self',
          workerId: 'admin-01',
          workerRole: 'WORKER',
          now: baseTime,
        })
      ).rejects.toThrow(EmployerCannotClaimOwnTaskError);
    });

    it('áp dụng quy tắc 1 người - 1 lần duy nhất (409 WORKER_ALREADY_CLAIMED_TASK)', async () => {
      const task = createSampleTask('task-dup', 5);
      await taskRepo.save(task);

      // Claim lần 1 thành công
      await claimUseCase.execute({
        taskId: 'task-dup',
        workerId: 'worker-dup',
        workerRole: 'WORKER',
        now: baseTime,
      });

      // Claim lần 2 bị chặn
      await expect(
        claimUseCase.execute({
          taskId: 'task-dup',
          workerId: 'worker-dup',
          workerRole: 'WORKER',
          now: baseTime,
        })
      ).rejects.toThrow(WorkerAlreadyClaimedTaskError);
    });

    it('từ chối nhận việc khi nhiệm vụ hết suất (409 TASK_QUOTA_EXHAUSTED)', async () => {
      const task = createSampleTask('task-full', 1);
      await taskRepo.save(task);

      // Worker 1 chiếm suất duy nhất
      await claimUseCase.execute({
        taskId: 'task-full',
        workerId: 'worker-01',
        workerRole: 'WORKER',
        now: baseTime,
      });

      // Worker 2 nhận việc -> Thất bại
      await expect(
        claimUseCase.execute({
          taskId: 'task-full',
          workerId: 'worker-02',
          workerRole: 'WORKER',
          now: baseTime,
        })
      ).rejects.toThrow(TaskQuotaExhaustedError);
    });
  });

  describe('CancelTaskClaimUseCase (REQ-BCT-015..016)', () => {
    it('cho phép Worker chủ động hủy lượt claim và hoàn trả slot', async () => {
      const task = createSampleTask('task-cancel', 1);
      await taskRepo.save(task);

      // Worker 1 nhận việc
      await claimUseCase.execute({
        taskId: 'task-cancel',
        workerId: 'worker-01',
        workerRole: 'WORKER',
        now: baseTime,
      });

      // Hủy nhận việc
      const cancelResult = await cancelUseCase.execute({
        taskId: 'task-cancel',
        workerId: 'worker-01',
        now: new Date('2026-11-20T10:15:00.000Z'),
      });
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.status).toBe('CANCELED');

      // Suất trống được hoàn trả ngay lập tức -> Worker 2 có thể nhận việc
      const claim2 = await claimUseCase.execute({
        taskId: 'task-cancel',
        workerId: 'worker-02',
        workerRole: 'WORKER',
        now: new Date('2026-11-20T10:16:00.000Z'),
      });
      expect(claim2.claim_id).toBeDefined();
    });

    it('từ chối hủy claim nếu không tìm thấy bản ghi (404 CLAIM_NOT_FOUND)', async () => {
      await expect(
        cancelUseCase.execute({
          taskId: 'task-not-claimed',
          workerId: 'worker-99',
          now: baseTime,
        })
      ).rejects.toThrow(ClaimNotFoundError);
    });
  });
});

