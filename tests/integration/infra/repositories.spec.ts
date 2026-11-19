import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaTaskRepository } from '../../../src/infra/repositories/prisma-task.repository';
import { PrismaTaskAuditLogRepository } from '../../../src/infra/repositories/prisma-audit-log.repository';
import { StubTaskProgressAdapter } from '../../../src/infra/adapters/stub-task-progress.adapter';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';
import { TaskConcurrencyConflictError } from '../../../src/shared/errors/task-errors';
import { PrismaClient } from '@prisma/client';

describe('Infrastructure Layer: Repositories & Adapters', () => {
  describe('StubTaskProgressAdapter (Q2)', () => {
    it('trả về 0 mặc định khi chưa có tiến độ', async () => {
      const adapter = new StubTaskProgressAdapter();
      const progress = await adapter.getProgress('task-123');

      expect(progress.approved_count).toBe(0);
      expect(progress.in_progress_count).toBe(0);
    });

    it('lưu và trả về chính xác tiến độ nhiệm vụ được gán', async () => {
      const adapter = new StubTaskProgressAdapter();
      adapter.setProgress('task-123', { approved_count: 45, in_progress_count: 10 });

      const progress = await adapter.getProgress('task-123');
      expect(progress.approved_count).toBe(45);
      expect(progress.in_progress_count).toBe(10);
    });

    it('xóa sạch tiến độ khi gọi clear()', async () => {
      const adapter = new StubTaskProgressAdapter();
      adapter.setProgress('task-123', { approved_count: 45, in_progress_count: 10 });
      adapter.clear();

      const progress = await adapter.getProgress('task-123');
      expect(progress.approved_count).toBe(0);
    });
  });

  describe('PrismaTaskRepository (OCC & Data Mapping)', () => {
    let mockPrisma: any;
    let repo: PrismaTaskRepository;

    beforeEach(() => {
      mockPrisma = {
        task: {
          create: vi.fn(),
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
      };
      repo = new PrismaTaskRepository(mockPrisma as unknown as PrismaClient);
    });

    it('lưu mới nhiệm vụ với các trường JSONB và BigInt', async () => {
      const task = FreelanceTask.createDraft({
        creatorId: 'admin-1',
        title: 'Cài đặt app test ngân hàng',
        description: 'Tải và mở ứng dụng trong 5 phút để nhận thưởng',
        category: 'APP_INSTALL',
        rewardCoins: RewardCoins.create(1000),
        quota: Quota.create(20),
        steps: [StepInstruction.create(1, 'Bước 1: Tải app', 'https://example.com/app')],
        proofRequirements: [
          ProofRequirement.create({
            id: 'p1',
            proofType: 'SCREENSHOT_IMAGE',
            title: 'Ảnh mở app',
            description: 'Chụp rõ màn hình chính',
          }),
        ],
      });

      mockPrisma.task.create.mockResolvedValue({});

      await repo.save(task);

      expect(mockPrisma.task.create).toHaveBeenCalledTimes(1);
      const createArgs = mockPrisma.task.create.mock.calls[0][0].data;
      expect(createArgs.id).toBe(task.getId());
      expect(createArgs.total_reward_coins).toBe(BigInt(20000));
      expect(Array.isArray(createArgs.steps)).toBe(true);
      expect(createArgs.steps[0].target_url).toBe('https://example.com/app');
      expect(createArgs.proof_requirements[0].proof_type).toBe('SCREENSHOT_IMAGE');
    });

    it('tìm nhiệm vụ và tái cấu trúc (reconstitute) Entity đầy đủ', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-uuid-123',
        creator_id: 'admin-uuid-001',
        title: 'Cài đặt app và đánh giá',
        description: 'Mô tả nhiệm vụ hợp lệ có độ dài trên 20 ký tự',
        category: 'APP_INSTALL',
        reward_coins: 1500,
        quota: 50,
        total_reward_coins: BigInt(75000),
        steps: [
          {
            step_number: 1,
            instruction: 'Tải app từ liên kết',
            target_url: 'https://app.com',
          },
        ],
        proof_requirements: [
          {
            id: 'proof-1',
            proof_type: 'TEXT',
            title: 'Tên đăng ký',
            description: 'Nhập tên đăng ký của bạn',
            is_required: true,
          },
        ],
        execution_time_minutes: 60,
        auto_approval_days: 3,
        status: 'ACTIVE',
        version: 2,
        closed_at: null,
        grace_period_ends_at: null,
        created_at: new Date('2026-11-19T10:00:00Z'),
        updated_at: new Date('2026-11-19T11:00:00Z'),
      });

      const task = await repo.findById('task-uuid-123');

      expect(task).not.toBeNull();
      expect(task!.getId()).toBe('task-uuid-123');
      expect(task!.getStatus().isActive()).toBe(true);
      expect(task!.getRewardCoins().getValue()).toBe(1500);
      expect(task!.getSteps().length).toBe(1);
      expect(task!.getSteps()[0].getTargetUrl()).toBe('https://app.com');
      expect(task!.getProofRequirements().length).toBe(1);
      expect(task!.getProofRequirements()[0].getProofType()).toBe('TEXT');
    });

    it('cập nhật thành công khi OCC expectedVersion khớp với DB', async () => {
      const task = FreelanceTask.createDraft({
        creatorId: 'admin-1',
        title: 'Cài đặt app test ngân hàng',
        description: 'Tải và mở ứng dụng trong 5 phút để nhận thưởng',
        category: 'APP_INSTALL',
        rewardCoins: RewardCoins.create(1000),
        quota: Quota.create(20),
      });

      mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });

      await expect(repo.update(task, 1)).resolves.not.toThrow();

      expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          id: task.getId(),
          version: 1,
        },
        data: expect.any(Object),
      });
    });

    it('ném lỗi TaskConcurrencyConflictError khi OCC count = 0 (xung đột version)', async () => {
      const task = FreelanceTask.createDraft({
        creatorId: 'admin-1',
        title: 'Cài đặt app test ngân hàng',
        description: 'Tải và mở ứng dụng trong 5 phút để nhận thưởng',
        category: 'APP_INSTALL',
        rewardCoins: RewardCoins.create(1000),
        quota: Quota.create(20),
      });

      // Giả lập updateMany không tìm thấy bản ghi nào khớp id và expectedVersion
      mockPrisma.task.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.update(task, 1)).rejects.toThrow(TaskConcurrencyConflictError);
    });
  });

  describe('PrismaTaskAuditLogRepository', () => {
    let mockPrisma: any;
    let auditRepo: PrismaTaskAuditLogRepository;

    beforeEach(() => {
      mockPrisma = {
        taskAuditLog: {
          create: vi.fn(),
          findMany: vi.fn(),
        },
      };
      auditRepo = new PrismaTaskAuditLogRepository(mockPrisma as unknown as PrismaClient);
    });

    it('lưu bản ghi nhật ký kiểm toán với old_value và new_value', async () => {
      mockPrisma.taskAuditLog.create.mockResolvedValue({});

      await auditRepo.log({
        taskId: 'task-100',
        adminId: 'admin-001',
        action: 'TASK_UPDATED',
        oldValue: { quota: 50 },
        newValue: { quota: 100 },
      });

      expect(mockPrisma.taskAuditLog.create).toHaveBeenCalledTimes(1);
      const callData = mockPrisma.taskAuditLog.create.mock.calls[0][0].data;
      expect(callData.task_id).toBe('task-100');
      expect(callData.admin_id).toBe('admin-001');
      expect(callData.action).toBe('TASK_UPDATED');
      expect(callData.old_value).toEqual({ quota: 50 });
      expect(callData.new_value).toEqual({ quota: 100 });
    });
  });
});

