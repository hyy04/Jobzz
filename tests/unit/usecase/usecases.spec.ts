import { describe, it, expect, beforeEach } from 'vitest';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { TaskRepositoryPort } from '../../../src/usecase/ports/task-repository.port';
import { TaskProgressPort, TaskProgress } from '../../../src/usecase/ports/task-progress.port';
import { TaskAuditLogPort, AuditLogEntry } from '../../../src/usecase/ports/task-audit-log.port';
import { CreateFreelanceTaskUseCase } from '../../../src/usecase/create-freelance-task.usecase';
import { UpdateFreelanceTaskUseCase } from '../../../src/usecase/update-freelance-task.usecase';
import { ChangeTaskStatusUseCase } from '../../../src/usecase/change-task-status.usecase';
import { GetFreelanceTaskDetailsUseCase } from '../../../src/usecase/get-freelance-task-details.usecase';
import {
  UnauthorizedCreatorError,
  TaskNotFoundError,
  QuotaReductionConflictError,
  ImmutableFieldModificationError,
  TaskConcurrencyConflictError,
  InvalidStateTransitionError,
} from '../../../src/shared/errors/task-errors';

class InMemoryTaskRepository implements TaskRepositoryPort {
  private tasks = new Map<string, FreelanceTask>();
  private versions = new Map<string, number>();

  public async save(task: FreelanceTask): Promise<void> {
    this.tasks.set(task.getId(), task);
    this.versions.set(task.getId(), task.getVersion());
  }

  public async findById(id: string): Promise<FreelanceTask | null> {
    return this.tasks.get(id) || null;
  }

  public async update(task: FreelanceTask, expectedVersion: number): Promise<void> {
    const currentDbVersion = this.versions.get(task.getId());
    if (currentDbVersion === undefined) {
      throw new TaskNotFoundError();
    }

    // Kiểm tra Optimistic Concurrency Control (OCC)
    if (currentDbVersion !== expectedVersion) {
      throw new TaskConcurrencyConflictError();
    }

    this.tasks.set(task.getId(), task);
    this.versions.set(task.getId(), task.getVersion());
  }
}

class StubTaskProgressPort implements TaskProgressPort {
  public approvedCount = 0;
  public inProgressCount = 0;

  public async getProgress(_taskId: string): Promise<TaskProgress> {
    return {
      approved_count: this.approvedCount,
      in_progress_count: this.inProgressCount,
    };
  }
}

class InMemoryTaskAuditLogPort implements TaskAuditLogPort {
  public entries: AuditLogEntry[] = [];

  public async log(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}

describe('Application Layer Use Cases & Clean Architecture Ports', () => {
  let taskRepo: InMemoryTaskRepository;
  let progressPort: StubTaskProgressPort;
  let auditLogPort: InMemoryTaskAuditLogPort;

  let createUseCase: CreateFreelanceTaskUseCase;
  let updateUseCase: UpdateFreelanceTaskUseCase;
  let changeStatusUseCase: ChangeTaskStatusUseCase;
  let getDetailsUseCase: GetFreelanceTaskDetailsUseCase;

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepository();
    progressPort = new StubTaskProgressPort();
    auditLogPort = new InMemoryTaskAuditLogPort();

    createUseCase = new CreateFreelanceTaskUseCase(taskRepo, auditLogPort);
    updateUseCase = new UpdateFreelanceTaskUseCase(taskRepo, progressPort, auditLogPort);
    changeStatusUseCase = new ChangeTaskStatusUseCase(taskRepo, auditLogPort);
    getDetailsUseCase = new GetFreelanceTaskDetailsUseCase(taskRepo, progressPort);
  });

  describe('CreateFreelanceTaskUseCase', () => {
    it('từ chối người dùng không có vai trò ADMIN', async () => {
      await expect(
        createUseCase.execute({
          creatorId: 'worker-001',
          creatorRole: 'WORKER',
          title: 'Cài đặt ứng dụng ngân hàng',
          description: 'Tải ứng dụng và đăng ký tài khoản mới để nhận thưởng Xu',
          category: 'APP_INSTALL',
          rewardCoins: 2000,
          quota: 50,
        })
      ).rejects.toThrow(UnauthorizedCreatorError);
    });

    it('tạo thành công bản thảo DRAFT bởi ADMIN và ghi Audit Log', async () => {
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Cài đặt ứng dụng ngân hàng ABC',
        description: 'Tải ứng dụng từ store và hoàn thành đăng ký tài khoản trong 5 phút',
        category: 'APP_INSTALL',
        rewardCoins: 2000,
        quota: 50,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Truy cập vào liên kết và cài đặt app',
            targetUrl: 'https://example.com/app',
          },
        ],
        proofRequirements: [
          {
            proofType: 'SCREENSHOT_IMAGE',
            title: 'Ảnh xác nhận',
            description: 'Ảnh chụp màn hình trang chủ tài khoản',
          },
        ],
      });

      expect(task.getStatus().isDraft()).toBe(true);
      expect(task.getVersion()).toBe(1);

      // Kiểm tra trong repo
      const stored = await taskRepo.findById(task.getId());
      expect(stored).not.toBeNull();

      // Kiểm tra Audit Log
      expect(auditLogPort.entries.length).toBe(1);
      expect(auditLogPort.entries[0].action).toBe('TASK_DRAFT_CREATED');
      expect(auditLogPort.entries[0].adminId).toBe('admin-001');
    });

    it('tạo và tự động xuất bản (autoPublish) chuyển sang ACTIVE', async () => {
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Cài đặt ứng dụng ngân hàng ABC',
        description: 'Tải ứng dụng từ store và hoàn thành đăng ký tài khoản trong 5 phút',
        category: 'APP_INSTALL',
        rewardCoins: 2000,
        quota: 50,
        autoPublish: true,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Truy cập vào liên kết và cài đặt app',
            targetUrl: 'https://example.com/app',
          },
        ],
        proofRequirements: [
          {
            proofType: 'SCREENSHOT_IMAGE',
            title: 'Ảnh xác nhận',
            description: 'Ảnh chụp màn hình trang chủ tài khoản',
          },
        ],
      });

      expect(task.getStatus().isActive()).toBe(true);
      expect(task.getVersion()).toBe(2);
      expect(auditLogPort.entries[0].action).toBe('TASK_CREATED_AND_PUBLISHED');
    });
  });

  describe('UpdateFreelanceTaskUseCase (ARCH-01 & SEC-01)', () => {
    it('kiểm tra an toàn quota qua TaskProgressPort: chặn giảm quota < (approved + in_progress)', async () => {
      // 1. Tạo task có quota = 100
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Cài đặt ứng dụng ngân hàng ABC',
        description: 'Tải ứng dụng từ store và hoàn thành đăng ký tài khoản trong 5 phút',
        category: 'APP_INSTALL',
        rewardCoins: 1000,
        quota: 100,
      });

      // 2. Giả lập tiến độ qua TaskProgressPort: 30 approved + 25 in_progress = 55 slot
      progressPort.approvedCount = 30;
      progressPort.inProgressCount = 25;

      // 3. Admin cố giảm quota xuống 50 (< 55) -> ném QuotaReductionConflictError
      await expect(
        updateUseCase.execute({
          taskId: task.getId(),
          adminId: 'admin-001',
          adminRole: 'ADMIN',
          expectedVersion: 1,
          quota: 50,
        })
      ).rejects.toThrow(QuotaReductionConflictError);

      // 4. Admin cập nhật quota lên 70 (>= 55) -> Hợp lệ
      const updated = await updateUseCase.execute({
        taskId: task.getId(),
        adminId: 'admin-001',
        adminRole: 'ADMIN',
        expectedVersion: 1,
        quota: 70,
      });

      expect(updated.getQuota().getValue()).toBe(70);
    });

    it('bảo vệ Mutability khi task đang ACTIVE: chặn giảm reward_coins', async () => {
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Cài đặt ứng dụng ngân hàng ABC',
        description: 'Tải ứng dụng từ store và hoàn thành đăng ký tài khoản trong 5 phút',
        category: 'APP_INSTALL',
        rewardCoins: 5000,
        quota: 100,
        autoPublish: true,
        steps: [{ stepNumber: 1, instruction: 'Hướng dẫn cụ thể 1234567890' }],
        proofRequirements: [{ proofType: 'TEXT', title: 'Tên tài khoản', description: 'Nhập tên tài khoản' }],
      });

      // Cố tình giảm reward_coins từ 5000 xuống 3000 khi ACTIVE
      await expect(
        updateUseCase.execute({
          taskId: task.getId(),
          adminId: 'admin-001',
          adminRole: 'ADMIN',
          expectedVersion: task.getVersion(),
          rewardCoins: 3000,
        })
      ).rejects.toThrow(ImmutableFieldModificationError);
    });

    it('kiểm soát xung đột phiên cập nhật đồng thời qua OCC version', async () => {
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Cài đặt ứng dụng ngân hàng ABC',
        description: 'Tải ứng dụng từ store và hoàn thành đăng ký tài khoản trong 5 phút',
        category: 'APP_INSTALL',
        rewardCoins: 5000,
        quota: 100,
      });

      // expectedVersion sai lệch (truyền 99 thay vì 1)
      await expect(
        updateUseCase.execute({
          taskId: task.getId(),
          adminId: 'admin-001',
          adminRole: 'ADMIN',
          expectedVersion: 99,
          title: 'Cập nhật tiêu đề mới hợp lệ 123',
        })
      ).rejects.toThrow(TaskConcurrencyConflictError);
    });
  });

  describe('ChangeTaskStatusUseCase', () => {
    it('thực hiện các bước chuyển đổi trạng thái vòng đời hợp lệ', async () => {
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Cài đặt ứng dụng ngân hàng ABC',
        description: 'Tải ứng dụng từ store và hoàn thành đăng ký tài khoản trong 5 phút',
        category: 'APP_INSTALL',
        rewardCoins: 1000,
        quota: 50,
        steps: [{ stepNumber: 1, instruction: 'Cài đặt từ store chính thức' }],
        proofRequirements: [{ proofType: 'TEXT', title: 'Mã giới thiệu', description: 'Nhập mã giới thiệu' }],
      });

      // 1. DRAFT -> ACTIVE
      const published = await changeStatusUseCase.execute({
        taskId: task.getId(),
        adminId: 'admin-001',
        adminRole: 'ADMIN',
        action: 'PUBLISH',
        expectedVersion: 1,
      });
      expect(published.getStatus().isActive()).toBe(true);

      // 2. ACTIVE -> PAUSED
      const paused = await changeStatusUseCase.execute({
        taskId: task.getId(),
        adminId: 'admin-001',
        adminRole: 'ADMIN',
        action: 'PAUSE',
        expectedVersion: 2,
      });
      expect(paused.getStatus().isPaused()).toBe(true);

      // 3. PAUSED -> ACTIVE
      const resumed = await changeStatusUseCase.execute({
        taskId: task.getId(),
        adminId: 'admin-001',
        adminRole: 'ADMIN',
        action: 'RESUME',
        expectedVersion: 3,
      });
      expect(resumed.getStatus().isActive()).toBe(true);

      // 4. ACTIVE -> CLOSE
      const closed = await changeStatusUseCase.execute({
        taskId: task.getId(),
        adminId: 'admin-001',
        adminRole: 'ADMIN',
        action: 'CLOSE',
        expectedVersion: 4,
      });
      expect(closed.getStatus().isClosed()).toBe(true);
      expect(closed.getClosedAt()).not.toBeNull();
      expect(closed.getGracePeriodEndsAt()).not.toBeNull();

      // 5. Cố mở lại khi đã CLOSED -> lỗi InvalidStateTransitionError
      await expect(
        changeStatusUseCase.execute({
          taskId: task.getId(),
          adminId: 'admin-001',
          adminRole: 'ADMIN',
          action: 'RESUME',
          expectedVersion: 5,
        })
      ).rejects.toThrow(InvalidStateTransitionError);
    });
  });

  describe('GetFreelanceTaskDetailsUseCase', () => {
    it('cho phép ADMIN xem task ở trạng thái DRAFT', async () => {
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Nhiệm vụ bản thảo bí mật',
        description: 'Chỉ dành cho quản trị viên xem trước khi công khai',
        category: 'SURVEY',
        rewardCoins: 500,
        quota: 10,
      });

      const res = await getDetailsUseCase.execute({
        taskId: task.getId(),
        requesterId: 'admin-001',
        requesterRole: 'ADMIN',
      });

      expect(res.task.getId()).toBe(task.getId());
      expect(res.progress.remaining_slots).toBe(10);
    });

    it('chặn Worker xem nhiệm vụ khi còn ở trạng thái DRAFT', async () => {
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Nhiệm vụ bản thảo bí mật',
        description: 'Chỉ dành cho quản trị viên xem trước khi công khai',
        category: 'SURVEY',
        rewardCoins: 500,
        quota: 10,
      });

      await expect(
        getDetailsUseCase.execute({
          taskId: task.getId(),
          requesterId: 'worker-999',
          requesterRole: 'WORKER',
        })
      ).rejects.toThrow(TaskNotFoundError);
    });

    it('cho phép Worker xem nhiệm vụ khi ACTIVE và tính toán chính xác remaining_slots', async () => {
      const task = await createUseCase.execute({
        creatorId: 'admin-001',
        creatorRole: 'ADMIN',
        title: 'Nhiệm vụ công khai cho worker',
        description: 'Mọi freelancer đều có thể xem và thực hiện nhiệm vụ này',
        category: 'SURVEY',
        rewardCoins: 500,
        quota: 100,
        autoPublish: true,
        steps: [{ stepNumber: 1, instruction: 'Thực hiện khảo sát tại liên kết' }],
        proofRequirements: [{ proofType: 'TEXT', title: 'Mã số', description: 'Nhập mã số' }],
      });

      // 40 approved + 15 in_progress -> remaining_slots = 100 - 55 = 45
      progressPort.approvedCount = 40;
      progressPort.inProgressCount = 15;

      const res = await getDetailsUseCase.execute({
        taskId: task.getId(),
        requesterId: 'worker-999',
        requesterRole: 'WORKER',
      });

      expect(res.task.getId()).toBe(task.getId());
      expect(res.progress.approved_count).toBe(40);
      expect(res.progress.in_progress_count).toBe(15);
      expect(res.progress.remaining_slots).toBe(45);
    });
  });
});
