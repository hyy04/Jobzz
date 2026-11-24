import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { InMemoryWalletRepository } from '../../../src/infra/repositories/in-memory-wallet.repository';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { SubmittedProofItem } from '../../../src/domain/value-objects/submitted-proof.vo';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';

describe('Admin Submissions Review REST API Integration (T006-RTS)', () => {
  let app: FastifyInstance;
  let taskRepo: InMemoryTaskRepository;
  let claimRepo: InMemoryTaskClaimRepository;
  let walletRepo: InMemoryWalletRepository;

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepository(false);
    claimRepo = new InMemoryTaskClaimRepository();
    walletRepo = new InMemoryWalletRepository();

    app = buildApp({
      taskRepository: taskRepo,
      taskClaimRepository: claimRepo,
      walletPort: walletRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const setupSampleTaskAndSubmission = async () => {
    const task = FreelanceTask.createDraft({
      id: 'task-api-01',
      creatorId: 'employer-01',
      title: 'Tải app và đánh giá 5 sao ứng dụng',
      description: 'Mô tả chi tiết việc cần làm để nhận thưởng',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(500),
      quota: Quota.create(5),
      steps: [StepInstruction.create(1, 'Làm theo hướng dẫn')],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-screen',
          title: 'Ảnh bằng chứng',
          description: 'Chụp ảnh màn hình hoàn thành',
          proofType: 'SCREENSHOT_IMAGE',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    task.publish();
    await taskRepo.save(task);

    const claim = TaskClaim.create({
      id: 'claim-api-01',
      taskId: task.getId(),
      workerId: 'worker-pro',
      executionTimeMinutes: 60,
    });
    claim.submit([
      SubmittedProofItem.create({
        requirementId: 'req-screen',
        proofType: 'SCREENSHOT_IMAGE',
        value: 'https://example.com/uploads/proofs/proof-123.png',
      }),
    ], new Date());
    await claimRepo.save(claim);

    return { task, claim };
  };

  describe('GET /api/v1/admin/submissions (REQ-RTS-001..003, REQ-RTS-006)', () => {
    it('trả về 200 OK và danh sách bài nộp SUBMITTED khi gọi với quyền ADMIN', async () => {
      await setupSampleTaskAndSubmission();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/submissions?page=1&limit=10',
        headers: {
          'x-admin-id': 'admin-001',
          'x-user-role': 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0].claim_id).toBe('claim-api-01');
      expect(body.data[0].task_title).toBe('Tải app và đánh giá 5 sao ứng dụng');
      expect(body.data[0].reward_coins).toBe(500);
      expect(body.pagination.total).toBe(1);
    });

    it('trả về 403 Forbidden khi người dùng không phải là ADMIN', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/submissions',
        headers: {
          'x-worker-id': 'worker-pro',
          'x-user-role': 'WORKER',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/v1/admin/submissions/:claimId (REQ-RTS-004..005)', () => {
    it('trả về 200 OK và chi tiết bài nộp kèm danh sách bằng chứng', async () => {
      await setupSampleTaskAndSubmission();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/submissions/claim-api-01',
        headers: {
          'x-admin-id': 'admin-001',
          'x-user-role': 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.claim_id).toBe('claim-api-01');
      expect(body.data.submitted_proofs.length).toBe(1);
      expect(body.data.submitted_proofs[0].description).toBe('Chụp ảnh màn hình hoàn thành');
      expect(body.data.submitted_proofs[0].value).toContain('proof-123.png');
    });

    it('trả về 404 Not Found khi claimId không tồn tại', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/submissions/non-existent-claim',
        headers: {
          'x-admin-id': 'admin-001',
          'x-user-role': 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('SUBMISSION_NOT_FOUND');
    });
  });

  describe('POST /api/v1/admin/submissions/:claimId/approve (REQ-RTS-007..011, REQ-RTS-018)', () => {
    it('phê duyệt bài nộp thành công: cộng Xu ví Worker và trả về 200 OK', async () => {
      await setupSampleTaskAndSubmission();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/submissions/claim-api-01/approve',
        headers: {
          'x-admin-id': 'admin-lead',
          'x-user-role': 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('APPROVED');
      expect(body.data.reward_coins).toBe(500);
      expect(body.data.worker_new_balance).toBe(500);

      // Kiểm tra ví Worker
      const wallet = await walletRepo.findByWorkerId('worker-pro');
      expect(wallet?.balance).toBe(500);
    });

    it('trả về 409 Conflict khi cố tình duyệt lại bài nộp đã duyệt', async () => {
      await setupSampleTaskAndSubmission();

      // Duyệt lần 1
      await app.inject({
        method: 'POST',
        url: '/api/v1/admin/submissions/claim-api-01/approve',
        headers: {
          'x-admin-id': 'admin-lead',
          'x-user-role': 'ADMIN',
        },
      });

      // Duyệt lần 2
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/submissions/claim-api-01/approve',
        headers: {
          'x-admin-id': 'admin-lead',
          'x-user-role': 'ADMIN',
        },
      });

      expect(response2.statusCode).toBe(409);
      expect(response2.json().error.code).toBe('CLAIM_ALREADY_REVIEWED');
    });
  });

  describe('POST /api/v1/admin/submissions/:claimId/reject (REQ-RTS-012..016, REQ-RTS-018)', () => {
    it('từ chối bài nộp thành công với lý do hợp lệ và trả về 200 OK', async () => {
      await setupSampleTaskAndSubmission();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/submissions/claim-api-01/reject',
        headers: {
          'x-admin-id': 'admin-lead',
          'x-user-role': 'ADMIN',
        },
        payload: {
          rejection_reason: 'Ảnh chụp màn hình mờ, không thấy tài khoản đánh giá.',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('REJECTED');
      expect(body.data.rejection_reason).toContain('Ảnh chụp màn hình mờ');
    });

    it('trả về 400 Bad Request khi lý do từ chối dưới 10 ký tự', async () => {
      await setupSampleTaskAndSubmission();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/submissions/claim-api-01/reject',
        headers: {
          'x-admin-id': 'admin-lead',
          'x-user-role': 'ADMIN',
        },
        payload: {
          rejection_reason: 'Sai ảnh',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
