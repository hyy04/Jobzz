import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';

describe('Browse & Claim API Integration Tests (Fastify REST Endpoints)', () => {
  let app: FastifyInstance;
  let taskRepo: InMemoryTaskRepository;
  let claimRepo: InMemoryTaskClaimRepository;

  const createTestTask = (id: string, quota = 5, reward = 3000, creatorId = 'admin-01') => {
    const task = FreelanceTask.createDraft({
      id,
      creatorId,
      title: `Nhiệm vụ kiểm thử API ${id}`,
      description: 'Mô tả chi tiết nhiệm vụ kiểm thử API với độ dài hợp lệ hơn 20 ký tự',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(reward),
      quota: Quota.create(quota),
      steps: [
        StepInstruction.create(1, 'Cài đặt ứng dụng từ cửa hàng chính thức', 'https://jobzz.vn/app', 'https://jobzz.vn/img1.png'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'p1',
          proofType: 'TEXT',
          title: 'Tên tài khoản người dùng',
          description: 'Nhập tên tài khoản vừa đăng ký trên ứng dụng',
        }),
      ],
      executionTimeMinutes: 30,
      autoApprovalDays: 3,
    });
    task.publish();
    return task;
  };

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepository(false);
    claimRepo = new InMemoryTaskClaimRepository();

    app = buildApp({
      taskRepository: taskRepo,
      taskClaimRepository: claimRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/public/tasks (REQ-BCT-001..005)', () => {
    it('trả về 200 với danh sách nhiệm vụ ACTIVE còn suất', async () => {
      const task = createTestTask('task-api-01', 5, 2000);
      await taskRepo.save(task);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/tasks',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.length).toBe(1);
      expect(json.data[0].id).toBe('task-api-01');
      expect(json.data[0].remaining_quota).toBe(5);
      expect(json.pagination.total).toBe(1);
    });

    it('từ chối tham số truy vấn sai định dạng với HTTP 400 (REQ-BCT-004)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/tasks?limit=200', // max 100
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/public/tasks/:id (REQ-BCT-006..008)', () => {
    it('trả về 200 với thông tin chi tiết nhiệm vụ và hình ảnh các bước', async () => {
      const task = createTestTask('task-detail-api', 5, 5000);
      await taskRepo.save(task);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/tasks/task-detail-api',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.id).toBe('task-detail-api');
      expect(json.data.steps[0].image_url).toBe('https://jobzz.vn/img1.png');
      expect(json.data.proof_requirements.length).toBe(1);
    });

    it('trả về 404 khi nhiệm vụ không tồn tại (REQ-BCT-007)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/tasks/not-found-id',
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('TASK_NOT_FOUND');
    });
  });

  describe('POST /api/v1/tasks/:id/claim (REQ-BCT-009..014)', () => {
    it('cho phép Worker nhận việc giữ slot thành công với HTTP 201 Created', async () => {
      const task = createTestTask('task-claim-slot', 2, 2000, 'admin-01');
      await taskRepo.save(task);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-claim-slot/claim',
        headers: {
          'x-user-id': 'worker-user-01',
          'x-user-role': 'WORKER',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.claim_id).toBeDefined();
      expect(json.data.task_id).toBe('task-claim-slot');
      expect(json.data.status).toBe('IN_PROGRESS');
      expect(json.data.remaining_seconds).toBeGreaterThan(0);
    });

    it('từ chối khi vai trò không phải WORKER với HTTP 403 (REQ-BCT-013)', async () => {
      const task = createTestTask('task-claim-slot-2');
      await taskRepo.save(task);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-claim-slot-2/claim',
        headers: {
          'x-user-id': 'admin-01',
          'x-user-role': 'ADMIN',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('UNAUTHORIZED_WORKER');
    });

    it('chống tự gian lận Anti-Self-Dealing với HTTP 403 (REQ-BCT-011)', async () => {
      const task = createTestTask('task-self-api', 5, 2000, 'admin-creator-01');
      await taskRepo.save(task);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-self-api/claim',
        headers: {
          'x-user-id': 'admin-creator-01',
          'x-user-role': 'WORKER',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('EMPLOYER_CANNOT_CLAIM_OWN_TASK');
    });

    it('từ chối nhận việc trùng lặp với HTTP 409 (REQ-BCT-012)', async () => {
      const task = createTestTask('task-dup-api', 5);
      await taskRepo.save(task);

      // Claim 1
      await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-dup-api/claim',
        headers: { 'x-user-id': 'worker-dup', 'x-user-role': 'WORKER' },
      });

      // Claim 2
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-dup-api/claim',
        headers: { 'x-user-id': 'worker-dup', 'x-user-role': 'WORKER' },
      });

      expect(res2.statusCode).toBe(409);
      expect(res2.json().error.code).toBe('WORKER_ALREADY_CLAIMED_TASK');
    });

    it('từ chối khi nhiệm vụ đã hết suất với HTTP 409 (REQ-BCT-010)', async () => {
      const task = createTestTask('task-quota-full', 1);
      await taskRepo.save(task);

      // Worker 1 nhận suất duy nhất
      await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-quota-full/claim',
        headers: { 'x-user-id': 'worker-01', 'x-user-role': 'WORKER' },
      });

      // Worker 2 nhận việc
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-quota-full/claim',
        headers: { 'x-user-id': 'worker-02', 'x-user-role': 'WORKER' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('TASK_QUOTA_EXHAUSTED');
    });
  });

  describe('POST /api/v1/tasks/:id/claims/cancel & GET /my-claim (REQ-BCT-015..016)', () => {
    it('cho phép Worker hủy nhận việc và hoàn trả slot thành công', async () => {
      const task = createTestTask('task-cancel-api', 1);
      await taskRepo.save(task);

      // Nhận việc
      await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-cancel-api/claim',
        headers: { 'x-user-id': 'worker-cancel', 'x-user-role': 'WORKER' },
      });

      // Kiểm tra my-claim
      const myClaimRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks/task-cancel-api/my-claim',
        headers: { 'x-user-id': 'worker-cancel', 'x-user-role': 'WORKER' },
      });
      expect(myClaimRes.statusCode).toBe(200);
      expect(myClaimRes.json().data.status).toBe('IN_PROGRESS');

      // Hủy nhận việc
      const cancelRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-cancel-api/claims/cancel',
        headers: { 'x-user-id': 'worker-cancel' },
      });
      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.json().data.status).toBe('CANCELED');

      // Suất trống được hoàn trả -> Worker khác có thể nhận việc
      const newClaimRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks/task-cancel-api/claim',
        headers: { 'x-user-id': 'worker-next', 'x-user-role': 'WORKER' },
      });
      expect(newClaimRes.statusCode).toBe(201);
    });
  });
});

