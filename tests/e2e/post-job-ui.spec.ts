import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { FreelanceTask } from '../../src/domain/entities/freelance-task.entity';
import { TaskRepositoryPort } from '../../src/usecase/ports/task-repository.port';
import { TaskProgressPort, TaskProgress } from '../../src/usecase/ports/task-progress.port';
import { TaskAuditLogPort, AuditLogEntry } from '../../src/usecase/ports/task-audit-log.port';
import { TaskConcurrencyConflictError, TaskNotFoundError } from '../../src/shared/errors/task-errors';
import path from 'path';

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
  public async getProgress(_taskId: string): Promise<TaskProgress> {
    return { approved_count: 0, in_progress_count: 0 };
  }
}

class E2EInMemoryAuditLogRepository implements TaskAuditLogPort {
  public logs: AuditLogEntry[] = [];
  public async log(entry: AuditLogEntry): Promise<void> {
    this.logs.push(entry);
  }
}

describe('E2E Web Frontend & API Integration (T007-PUI & post-job-ui)', () => {
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
      publicDir: path.resolve(process.cwd(), 'public'),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('1. Phục vụ giao diện tĩnh SPA tại / và /admin với đầy đủ các phân hệ UI', async () => {
    const rootRes = await app.inject({ method: 'GET', url: '/' });
    expect(rootRes.statusCode).toBe(200);
    expect(rootRes.headers['content-type']).toContain('text/html');
    expect(rootRes.payload).toContain('Jobzz');
    expect(rootRes.payload).toContain('dashboard-stats-grid');
    expect(rootRes.payload).toContain('create-task-form');
    expect(rootRes.payload).toContain('steps-container');
    expect(rootRes.payload).toContain('task-table-body');
    expect(rootRes.payload).toContain('dev-role-select');

    const adminRes = await app.inject({ method: 'GET', url: '/admin' });
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.payload).toContain('Jobzz');
  });

  it('2. Phục vụ các tài nguyên tĩnh CSS và JS module trực tiếp qua /public/*', async () => {
    const cssRes = await app.inject({ method: 'GET', url: '/public/css/style.css' });
    expect(cssRes.statusCode).toBe(200);
    expect(cssRes.headers['content-type']).toContain('text/css');
    expect(cssRes.payload).toContain('phone-mockup');

    const appJsRes = await app.inject({ method: 'GET', url: '/public/js/app.js' });
    expect(appJsRes.statusCode).toBe(200);
    expect(appJsRes.headers['content-type']).toContain('application/javascript');
    expect(appJsRes.payload).toContain('DOMContentLoaded');

    const escaperRes = await app.inject({ method: 'GET', url: '/public/js/utils/html-escaper.js' });
    expect(escaperRes.statusCode).toBe(200);
    expect(escaperRes.payload).toContain('escapeHtml');
  });

  it('3. Luồng nghiệp vụ toàn trình: Tạo task qua API, lấy danh sách hiển thị bảng, đổi trạng thái OCC', async () => {
    // 3.1 Tạo nhiệm vụ mới (Draft)
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
      payload: {
        title: 'Cài đặt ứng dụng Jobzz và đánh giá 5 sao',
        description: 'Mô tả chi tiết nhiệm vụ đáp ứng tối thiểu độ dài yêu cầu',
        category: 'APP_INSTALL',
        reward_coins: 5000,
        quota: 100,
        steps: [
          { step_number: 1, instruction: 'Bước 1: Tải ứng dụng từ cửa hàng', target_url: 'https://jobzz.vn/download' },
          { step_number: 2, instruction: 'Bước 2: Đăng ký tài khoản và đánh giá 5 sao' },
        ],
        proof_requirements: [
          { proof_type: 'SCREENSHOT_IMAGE', title: 'Ảnh đánh giá', description: 'Chụp ảnh màn hình đánh giá' },
        ],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdTask = JSON.parse(createRes.payload).data;
    expect(createdTask.status).toBe('DRAFT');
    expect(createdTask.version).toBe(1);
    expect(createdTask.total_reward_coins).toBe(500000);

    // 3.2 Lấy danh sách nhiệm vụ cho Dashboard & Table (GET /api/v1/tasks)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks',
      headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
    });

    expect(listRes.statusCode).toBe(200);
    const listJson = JSON.parse(listRes.payload);
    expect(listJson.success).toBe(true);
    expect(listJson.data.length).toBe(1);
    expect(listJson.data[0].id).toBe(createdTask.id);

    // 3.3 Chuyển trạng thái sang ACTIVE (Publish với expected_version: 1)
    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${createdTask.id}/status`,
      headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
      payload: {
        action: 'PUBLISH',
        expected_version: 1,
      },
    });

    expect(publishRes.statusCode).toBe(200);
    const publishedTask = JSON.parse(publishRes.payload).data;
    expect(publishedTask.status).toBe('ACTIVE');
    expect(publishedTask.version).toBe(2);

    // 3.4 Thử lại với version cũ (version: 1) -> Kỳ vọng 409 Conflict (OCC bảo vệ dữ liệu)
    const conflictRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${createdTask.id}/status`,
      headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
      payload: {
        action: 'PAUSE',
        expected_version: 1, // Phiên bản cũ
      },
    });

    expect(conflictRes.statusCode).toBe(409);
    const conflictJson = JSON.parse(conflictRes.payload);
    expect(conflictJson.error.code).toBe('CONCURRENCY_CONFLICT');
  });

  it('4. Phân quyền bảo mật: Worker không thể truy cập danh sách nhiệm vụ quản trị', async () => {
    const workerRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks',
      headers: { 'x-user-id': 'worker-1', 'x-user-role': 'WORKER' },
    });

    expect(workerRes.statusCode).toBe(403);
  });
});
