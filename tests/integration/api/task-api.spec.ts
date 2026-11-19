import { describe, it, expect, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { TaskRepositoryPort } from '../../../src/usecase/ports/task-repository.port';
import { TaskProgressPort, TaskProgress } from '../../../src/usecase/ports/task-progress.port';
import { TaskAuditLogPort, AuditLogEntry } from '../../../src/usecase/ports/task-audit-log.port';
import { TaskConcurrencyConflictError, TaskNotFoundError } from '../../../src/shared/errors/task-errors';

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

class StubTaskProgressAdapter implements TaskProgressPort {
  public progressMap = new Map<string, TaskProgress>();

  public async getProgress(taskId: string): Promise<TaskProgress> {
    return this.progressMap.get(taskId) || { approved_count: 0, in_progress_count: 0 };
  }
}

class InMemoryAuditLogRepository implements TaskAuditLogPort {
  public logs: AuditLogEntry[] = [];

  public async log(entry: AuditLogEntry): Promise<void> {
    this.logs.push(entry);
  }
}

describe('Interface Layer: Fastify HTTP API & BDD Scenarios (T006)', () => {
  let app: FastifyInstance;
  let taskRepo: InMemoryTaskRepository;
  let progressPort: StubTaskProgressAdapter;
  let auditRepo: InMemoryAuditLogRepository;

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepository();
    progressPort = new StubTaskProgressAdapter();
    auditRepo = new InMemoryAuditLogRepository();

    app = buildApp({
      taskRepository: taskRepo,
      taskProgressPort: progressPort,
      taskAuditLogPort: auditRepo,
    });
    await app.ready();
  });

  it('Health Check route hoạt động', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('UP');
  });

  describe('Kịch bản BDD 1: Admin tạo và xuất bản nhiệm vụ thành công', () => {
    it('POST /api/v1/tasks trả về 201 Created và dữ liệu chuẩn', async () => {
      const payload = {
        title: 'Cài đặt và trải nghiệm game bắn súng 3D',
        description: 'Tải game từ kho ứng dụng chính thức, hoàn thành màn hướng dẫn tân thủ trong 10 phút.',
        category: 'APP_INSTALL',
        reward_coins: 5000,
        quota: 100,
        auto_publish: true,
        steps: [
          {
            step_number: 1,
            instruction: 'Tải game theo liên kết sau',
            target_url: 'https://games.example.com/download',
          },
        ],
        proof_requirements: [
          {
            proof_type: 'SCREENSHOT_IMAGE',
            title: 'Ảnh hoàn thành màn 1',
            description: 'Chụp lại màn hình kết quả chiến thắng màn 1',
            is_required: true,
          },
        ],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: {
          'x-user-id': 'adm-001',
          'x-user-role': 'ADMIN',
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('ACTIVE');
      expect(json.data.reward_coins).toBe(5000);
      expect(json.data.quota).toBe(100);
      expect(json.data.total_reward_coins).toBe(500000);
      expect(json.data.steps[0].target_url).toBe('https://games.example.com/download');
    });
  });

  describe('Kịch bản BDD 2: Worker cố tình tạo nhiệm vụ (RBAC Check)', () => {
    it('POST /api/v1/tasks từ chối với 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: {
          'x-user-id': 'worker-999',
          'x-user-role': 'WORKER',
        },
        payload: {
          title: 'Nhiệm vụ tự phát từ worker',
          description: 'Mô tả nhiệm vụ này không được phép tạo bởi worker',
          category: 'OTHER',
          reward_coins: 1000,
          quota: 10,
        },
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Kịch bản BDD 3: Xuất bản thất bại vì URL không an toàn (SEC-01)', () => {
    it('từ chối liên kết http:// với 400 Bad Request và mã INSECURE_URL_PROTOCOL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: {
          'x-user-id': 'adm-001',
          'x-user-role': 'ADMIN',
        },
        payload: {
          title: 'Cài đặt app với link nguy hiểm',
          description: 'Mô tả nhiệm vụ với liên kết không sử dụng giao thức bảo mật',
          category: 'APP_INSTALL',
          reward_coins: 2000,
          quota: 50,
          steps: [
            {
              step_number: 1,
              instruction: 'Bấm vào link không an toàn',
              target_url: 'http://insecure-site.com',
            },
          ],
          proof_requirements: [
            {
              proof_type: 'TEXT',
              title: 'Mã số',
              description: 'Nhập mã số xác nhận',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INSECURE_URL_PROTOCOL');
    });
  });

  describe('Kịch bản BDD 4: Admin cố tình giảm Quota dưới mức an toàn (ARCH-01)', () => {
    it('từ chối giảm quota < (approved + in_progress) với mã QUOTA_REDUCTION_CONFLICT', async () => {
      // 1. Tạo task với quota 100
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Nhiệm vụ kiểm tra giới hạn quota',
          description: 'Mô tả nhiệm vụ với quota ban đầu là 100 slot',
          category: 'SURVEY',
          reward_coins: 1000,
          quota: 100,
        },
      });
      const taskId = JSON.parse(createRes.payload).data.id;

      // 2. Giả lập tiến độ qua Port: 40 approved + 20 in_progress = 60 slot
      progressPort.progressMap.set(taskId, { approved_count: 40, in_progress_count: 20 });

      // 3. Admin cố giảm quota xuống 50 (< 60)
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${taskId}`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          expected_version: 1,
          quota: 50,
        },
      });

      expect(patchRes.statusCode).toBe(400);
      const json = JSON.parse(patchRes.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('QUOTA_REDUCTION_CONFLICT');
    });
  });

  describe('Kịch bản BDD 5: Admin cố giảm Xu khi nhiệm vụ đang ACTIVE (Mutability Rules)', () => {
    it('từ chối giảm reward_coins với mã IMMUTABLE_FIELD_MODIFICATION', async () => {
      // Tạo task ACTIVE với 5000 Xu
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Nhiệm vụ kiểm tra giảm mức thưởng',
          description: 'Mô tả nhiệm vụ đang hoạt động công khai cho cộng đồng',
          category: 'SURVEY',
          reward_coins: 5000,
          quota: 100,
          auto_publish: true,
          steps: [{ step_number: 1, instruction: 'Làm theo hướng dẫn cụ thể 12345' }],
          proof_requirements: [{ proof_type: 'TEXT', title: 'Mã số', description: 'Mô tả bằng chứng' }],
        },
      });
      const taskData = JSON.parse(createRes.payload).data;

      // Cố tình giảm xuống 3000 Xu
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${taskData.id}`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          expected_version: taskData.version,
          reward_coins: 3000,
        },
      });

      expect(patchRes.statusCode).toBe(400);
      const json = JSON.parse(patchRes.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('IMMUTABLE_FIELD_MODIFICATION');
    });
  });

  describe('Kịch bản BDD 6: Chuyển đổi trạng thái vòng đời nhiệm vụ', () => {
    it('cho phép chuyển đổi DRAFT -> ACTIVE -> PAUSED -> ACTIVE -> CLOSE', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Nhiệm vụ kiểm tra chuyển trạng thái',
          description: 'Mô tả kiểm tra vòng đời trạng thái nhiệm vụ tự do',
          category: 'SURVEY',
          reward_coins: 1000,
          quota: 50,
          steps: [{ step_number: 1, instruction: 'Làm theo các bước hướng dẫn cụ thể' }],
          proof_requirements: [{ proof_type: 'TEXT', title: 'Mã số', description: 'Mô tả bằng chứng' }],
        },
      });
      let taskData = JSON.parse(createRes.payload).data;

      // 1. PUBLISH (version 1 -> 2)
      const pubRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskData.id}/status`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: { action: 'PUBLISH', expected_version: taskData.version },
      });
      expect(pubRes.statusCode).toBe(200);
      taskData = JSON.parse(pubRes.payload).data;
      expect(taskData.status).toBe('ACTIVE');

      // 2. PAUSE (version 2 -> 3)
      const pauseRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskData.id}/status`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: { action: 'PAUSE', expected_version: taskData.version },
      });
      expect(pauseRes.statusCode).toBe(200);
      taskData = JSON.parse(pauseRes.payload).data;
      expect(taskData.status).toBe('PAUSED');

      // 3. RESUME (version 3 -> 4)
      const resumeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskData.id}/status`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: { action: 'RESUME', expected_version: taskData.version },
      });
      expect(resumeRes.statusCode).toBe(200);
      taskData = JSON.parse(resumeRes.payload).data;
      expect(taskData.status).toBe('ACTIVE');

      // 4. CLOSE (version 4 -> 5)
      const closeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskData.id}/status`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: { action: 'CLOSE', expected_version: taskData.version },
      });
      expect(closeRes.statusCode).toBe(200);
      taskData = JSON.parse(closeRes.payload).data;
      expect(taskData.status).toBe('CLOSED');
      expect(taskData.closed_at).not.toBeNull();
      expect(taskData.grace_period_ends_at).not.toBeNull();
    });
  });

  describe('Kịch bản BDD 7: Xung đột cập nhật đồng thời (OCC)', () => {
    it('từ chối cập nhật khi expected_version sai lệch với mã CONCURRENCY_CONFLICT (409)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Nhiệm vụ kiểm tra xung đột phiên OCC',
          description: 'Mô tả nhiệm vụ kiểm tra xung đột cập nhật đồng thời',
          category: 'SURVEY',
          reward_coins: 1000,
          quota: 50,
        },
      });
      const taskId = JSON.parse(createRes.payload).data.id;

      // Truyền expected_version = 999
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${taskId}`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          expected_version: 999,
          title: 'Tiêu đề cập nhật đồng thời gây lỗi',
        },
      });

      expect(patchRes.statusCode).toBe(409);
      const json = JSON.parse(patchRes.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONCURRENCY_CONFLICT');
    });
  });

  describe('Kịch bản BDD 8: Quyền xem chi tiết nhiệm vụ (Worker vs Admin)', () => {
    it('chặn Worker xem nhiệm vụ khi còn DRAFT nhưng cho phép khi ACTIVE', async () => {
      // 1. Tạo task DRAFT
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Nhiệm vụ chưa công khai trên bảng tin',
          description: 'Bản thảo chỉ có quản trị viên mới được phép xem trước',
          category: 'SURVEY',
          reward_coins: 1000,
          quota: 50,
          steps: [{ step_number: 1, instruction: 'Bước 1 làm khảo sát cụ thể' }],
          proof_requirements: [{ proof_type: 'TEXT', title: 'Mã số', description: 'Mô tả bằng chứng' }],
        },
      });
      const taskId = JSON.parse(createRes.payload).data.id;

      // 2. Worker xem khi DRAFT -> 404
      const workerRes1 = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskId}`,
        headers: { 'x-user-id': 'worker-1', 'x-user-role': 'WORKER' },
      });
      expect(workerRes1.statusCode).toBe(404);

      // 3. Admin xem khi DRAFT -> 200
      const adminRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskId}`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
      });
      expect(adminRes.statusCode).toBe(200);

      // 4. Xuất bản sang ACTIVE
      await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskId}/status`,
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: { action: 'PUBLISH', expected_version: 1 },
      });

      // 5. Worker xem khi ACTIVE -> 200 với thông tin tiến độ
      const workerRes2 = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskId}`,
        headers: { 'x-user-id': 'worker-1', 'x-user-role': 'WORKER' },
      });
      expect(workerRes2.statusCode).toBe(200);
      const json = JSON.parse(workerRes2.payload);
      expect(json.data.task.status).toBe('ACTIVE');
      expect(json.data.progress.remaining_slots).toBe(50);
    });

    it('REQ-PUI-001 & REQ-PUI-004: Admin có thể lấy danh sách toàn bộ nhiệm vụ (GET /api/v1/tasks)', async () => {
      // 1. Tạo 2 tasks với dữ liệu chuẩn Zod
      const createRes1 = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Nhiệm vụ danh sách 1',
          description: 'Mô tả chi tiết nhiệm vụ danh sách 1 đầy đủ độ dài quy định',
          category: 'APP_INSTALL',
          reward_coins: 1000,
          quota: 10,
          steps: [{ step_number: 1, instruction: 'Bước 1: Cài đặt ứng dụng trên thiết bị' }],
          proof_requirements: [{ proof_type: 'TEXT', title: 'Tên tài khoản', description: 'Ghi rõ tên tài khoản đã đăng ký' }],
        },
      });
      expect(createRes1.statusCode).toBe(201);

      const createRes2 = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
        payload: {
          title: 'Nhiệm vụ danh sách 2',
          description: 'Mô tả chi tiết nhiệm vụ danh sách 2 đầy đủ độ dài quy định',
          category: 'SURVEY',
          reward_coins: 2000,
          quota: 20,
          steps: [{ step_number: 1, instruction: 'Bước 1: Trả lời khảo sát trực tuyến' }],
          proof_requirements: [{ proof_type: 'TEXT', title: 'Mã xác nhận', description: 'Nhập mã khảo sát hoàn thành' }],
        },
      });
      expect(createRes2.statusCode).toBe(201);

      // 2. Admin gọi GET /api/v1/tasks -> 200
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'adm-001', 'x-user-role': 'ADMIN' },
      });

      expect(listRes.statusCode).toBe(200);
      const listJson = JSON.parse(listRes.payload);
      expect(listJson.success).toBe(true);
      expect(Array.isArray(listJson.data)).toBe(true);
      expect(listJson.data.length).toBeGreaterThanOrEqual(2);

      // 3. Worker gọi GET /api/v1/tasks -> 403 Forbidden
      const workerListRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks',
        headers: { 'x-user-id': 'worker-1', 'x-user-role': 'WORKER' },
      });
      expect(workerListRes.statusCode).toBe(403);
    });
  });
});

