import { describe, it, expect, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';

describe('T005-STP Integration: Submit Task Proof API Endpoints', () => {
  let app: FastifyInstance;
  let taskRepo: InMemoryTaskRepository;
  let claimRepo: InMemoryTaskClaimRepository;

  const baseTime = new Date('2026-11-23T10:00:00.000Z');
  let testTask: FreelanceTask;

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepository(false);
    claimRepo = new InMemoryTaskClaimRepository();

    app = buildApp({
      taskRepository: taskRepo,
      taskClaimRepository: claimRepo,
    });
    await app.ready();

    testTask = FreelanceTask.createDraft({
      id: 'task-api-test-01',
      creatorId: 'employer-01',
      title: 'Tải ứng dụng và đánh giá trải nghiệm người dùng',
      description: 'Mô tả chi tiết nhiệm vụ tải ứng dụng và gửi bằng chứng đối soát hợp lệ',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(1500),
      quota: Quota.create(10),
      steps: [
        StepInstruction.create(1, 'Mở cửa hàng ứng dụng và tải app Jobzz'),
        StepInstruction.create(2, 'Đăng ký tài khoản và chụp ảnh màn hình'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-screen-api',
          proofType: 'SCREENSHOT_IMAGE',
          title: 'Ảnh chụp màn hình trang chủ tài khoản',
          description: 'Ảnh rõ nét hiển thị username của bạn',
          isRequired: true,
        }),
        ProofRequirement.create({
          id: 'req-tx-api',
          proofType: 'TEXT',
          title: 'Tên người dùng đã đăng ký',
          description: 'Nhập chính xác username',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    testTask.publish();
    await taskRepo.save(testTask);
  });

  describe('POST /api/v1/uploads/proof-image', () => {
    it('trả về 201 Created khi Worker tải lên ảnh thành công qua JSON base64', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/uploads/proof-image',
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
          'content-type': 'application/json',
        },
        payload: {
          file: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          mime_type: 'image/png',
          filename: 'pixel.png',
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.file_url).toMatch(/^\/uploads\/proofs\/proof-[a-f0-9-]+\.png$/);
      expect(json.data.mime_type).toBe('image/png');
    });

    it('trả về 201 Created khi Worker tải lên ảnh thành công qua Raw Binary Body', async () => {
      const rawPngBuffer = Buffer.from('fake-png-binary-stream');
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/uploads/proof-image',
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
          'content-type': 'image/png',
          'x-filename': 'raw.png',
        },
        payload: rawPngBuffer,
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.file_url).toMatch(/\.png$/);
    });

    it('trả về 400 Bad Request khi không có dữ liệu tệp (MissingFileError)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/uploads/proof-image',
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.code).toBe('MISSING_FILE');
    });

    it('trả về 403 Forbidden nếu người gọi không có vai trò WORKER', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/uploads/proof-image',
        headers: {
          'x-user-id': 'employer-01',
          'x-user-role': 'EMPLOYER',
          'content-type': 'application/json',
        },
        payload: {
          file: 'abc',
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('UNAUTHORIZED_WORKER');
    });
  });

  describe('POST /api/v1/claims/:claimId/submit', () => {
    it('trả về 200 OK khi nộp bài thành công và chuyển trạng thái sang SUBMITTED', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claim.id}/submit`,
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
        },
        payload: {
          proofs: [
            { requirement_id: 'req-screen-api', value: '/uploads/proofs/proof-123.png' },
            { requirement_id: 'req-tx-api', value: 'my_app_username' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.status).toBe('SUBMITTED');
      expect(json.data.proofs_count).toBe(2);
      expect(json.data.claim_id).toBe(claim.id);

      const updated = await claimRepo.findById(claim.id);
      expect(updated?.status.isSubmitted()).toBe(true);
    });

    it('trả về 404 Not Found nếu claimId không tồn tại', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/claims/unknown-claim-uuid/submit',
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
        },
        payload: {
          proofs: [
            { requirement_id: 'req-screen-api', value: '/uploads/proofs/proof-123.png' },
          ],
        },
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.error.code).toBe('CLAIM_NOT_FOUND');
    });

    it('trả về 403 Forbidden nếu worker nộp không phải người sở hữu slot', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claim.id}/submit`,
        headers: {
          'x-worker-id': 'worker-hacker',
          'x-user-role': 'WORKER',
        },
        payload: {
          proofs: [
            { requirement_id: 'req-screen-api', value: '/uploads/proofs/proof-123.png' },
          ],
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('FORBIDDEN_NOT_CLAIM_OWNER');
    });

    it('trả về 400 Bad Request nếu thiếu bằng chứng bắt buộc (MISSING_REQUIRED_PROOFS)', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      // Chỉ gửi ảnh, thiếu text bắt buộc req-tx-api
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claim.id}/submit`,
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
        },
        payload: {
          proofs: [
            { requirement_id: 'req-screen-api', value: '/uploads/proofs/proof-123.png' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.code).toBe('MISSING_REQUIRED_PROOFS');
    });

    it('trả về 409 Conflict khi nộp đè lần 2 (CLAIM_NOT_IN_PROGRESS)', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      // Nộp lần 1 thành công
      await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claim.id}/submit`,
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
        },
        payload: {
          proofs: [
            { requirement_id: 'req-screen-api', value: '/uploads/proofs/proof-123.png' },
            { requirement_id: 'req-tx-api', value: 'my_app_username' },
          ],
        },
      });

      // Nộp lần 2
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claim.id}/submit`,
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
        },
        payload: {
          proofs: [
            { requirement_id: 'req-screen-api', value: '/uploads/proofs/proof-123.png' },
            { requirement_id: 'req-tx-api', value: 'my_app_username' },
          ],
        },
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json.error.code).toBe('CLAIM_NOT_IN_PROGRESS');
    });
  });

  describe('GET /api/v1/claims/:claimId', () => {
    it('trả về 200 OK kèm thông tin chi tiết claim và bằng chứng', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/claims/${claim.id}`,
        headers: {
          'x-worker-id': 'worker-01',
          'x-user-role': 'WORKER',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.claim_id).toBe(claim.id);
      expect(json.data.status).toBe('IN_PROGRESS');
      expect(json.data.task.title).toBe(testTask.getTitle());
      expect(json.data.task.proof_requirements).toHaveLength(2);
    });

    it('trả về 403 Forbidden nếu worker khác truy vấn claim', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/claims/${claim.id}`,
        headers: {
          'x-worker-id': 'worker-imposter',
          'x-user-role': 'WORKER',
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('FORBIDDEN_NOT_CLAIM_OWNER');
    });
  });
});
