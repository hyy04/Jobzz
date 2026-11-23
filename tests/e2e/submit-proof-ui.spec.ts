import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { InMemoryTaskRepository } from '../../src/infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from '../../src/infra/repositories/in-memory-task-claim.repository';
import { FreelanceTask } from '../../src/domain/entities/freelance-task.entity';
import { RewardCoins } from '../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../src/domain/value-objects/proof-requirement.vo';

describe('Worker Submit Proof Web UI & E2E Flow (REQ-STP-019..023)', () => {
  let app: FastifyInstance;
  let taskRepo: InMemoryTaskRepository;
  let claimRepo: InMemoryTaskClaimRepository;

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

  it('phục vụ đúng các tệp JavaScript module chứa tính năng nộp bằng chứng trực quan', async () => {
    const modules = [
      '/public/js/components/task-claim-modal.js',
      '/public/js/components/worker-marketplace.js',
      '/public/js/components/countdown-timer.js',
      '/public/js/api.js',
    ];

    for (const url of modules) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/javascript');
    }

    // Kiểm tra các thành phần giao diện nộp bài có trong modal script
    const modalRes = await app.inject({
      method: 'GET',
      url: '/public/js/components/task-claim-modal.js',
    });
    const modalScript = modalRes.body;
    expect(modalScript).toContain('btn-submit-proof');
    expect(modalScript).toContain('proof-upload-area');
    expect(modalScript).toContain('Nộp bài nhận Xu');
    expect(modalScript).toContain('Đang chờ duyệt');
    expect(modalScript).toContain('char-counter');
  });

  it('phục vụ tài nguyên tĩnh tệp tải lên qua /uploads/* với bảo mật và mime type đúng', async () => {
    // Thử truy cập một tệp upload không tồn tại -> nhận 404
    const notFoundRes = await app.inject({
      method: 'GET',
      url: '/uploads/proofs/non-existent-proof.png',
    });
    expect(notFoundRes.statusCode).toBe(404);

    // Kiểm tra path traversal bị chặn -> nhận 403 hoặc 404
    const traversalRes = await app.inject({
      method: 'GET',
      url: '/uploads/../../package.json',
    });
    expect([403, 404]).toContain(traversalRes.statusCode);
  });

  it('hoàn thành toàn bộ luồng E2E: Nhận việc giữ slot -> Tải ảnh bằng chứng -> Nộp bài -> Khóa bài nộp SUBMITTED -> Bảo toàn quota', async () => {
    // 1. Khởi tạo một nhiệm vụ có 2 yêu cầu bằng chứng (ảnh + text) với quota = 2
    const task = FreelanceTask.createDraft({
      id: 'task-e2e-submit',
      creatorId: 'employer-top-01',
      title: 'Tải ứng dụng Jobzz và đánh giá 5 sao trên Google Play',
      description: 'Cần tải ứng dụng, đăng ký và gửi ảnh chụp màn hình đánh giá kèm username',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(3000),
      quota: Quota.create(2),
      steps: [
        StepInstruction.create(1, 'Cài đặt app Jobzz', 'https://play.google.com/store/apps/jobzz'),
        StepInstruction.create(2, 'Đánh giá 5 sao'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-screen-e2e',
          proofType: 'SCREENSHOT_IMAGE',
          title: 'Ảnh chụp màn hình đánh giá',
          description: 'Ảnh rõ nét hiển thị tài khoản của bạn',
          isRequired: true,
        }),
        ProofRequirement.create({
          id: 'req-text-e2e',
          proofType: 'TEXT',
          title: 'Tên người dùng trên Play Store',
          description: 'Nhập tên tài khoản của bạn',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    task.publish();
    await taskRepo.save(task);

    // 2. Worker 1 nhận việc giữ slot
    const claimRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/task-e2e-submit/claim',
      headers: {
        'x-worker-id': 'worker-e2e-01',
        'x-user-role': 'WORKER',
      },
    });
    expect(claimRes.statusCode).toBe(201);
    const claimData = claimRes.json().data;
    const claimId = claimData.claim_id;
    expect(claimData.status).toBe('IN_PROGRESS');

    // Quota khả dụng giảm còn 1
    let publicDetailRes = await app.inject({
      method: 'GET',
      url: '/api/v1/public/tasks/task-e2e-submit',
    });
    expect(publicDetailRes.json().data.remaining_quota).toBe(1);

    // 3. Worker tải ảnh chụp màn hình lên máy chủ
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/uploads/proof-image',
      headers: {
        'x-worker-id': 'worker-e2e-01',
        'x-user-role': 'WORKER',
        'content-type': 'application/json',
      },
      payload: {
        file: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        mime_type: 'image/png',
        filename: 'review-screen.png',
      },
    });
    expect(uploadRes.statusCode).toBe(201);
    const uploadedFileUrl = uploadRes.json().data.file_url;
    expect(uploadedFileUrl).toMatch(/^\/uploads\/proofs\//);

    // 4. Worker gửi yêu cầu nộp bằng chứng hoàn thành nhiệm vụ
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/claims/${claimId}/submit`,
      headers: {
        'x-worker-id': 'worker-e2e-01',
        'x-user-role': 'WORKER',
      },
      payload: {
        proofs: [
          { requirement_id: 'req-screen-e2e', value: uploadedFileUrl },
          { requirement_id: 'req-text-e2e', value: 'user_star_rating_5' },
        ],
      },
    });
    expect(submitRes.statusCode).toBe(200);
    const submitJson = submitRes.json();
    expect(submitJson.data.status).toBe('SUBMITTED');
    expect(submitJson.data.proofs_count).toBe(2);

    // 5. Worker truy vấn chi tiết bài nộp qua GET /api/v1/claims/:claimId
    const claimDetailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/claims/${claimId}`,
      headers: {
        'x-worker-id': 'worker-e2e-01',
        'x-user-role': 'WORKER',
      },
    });
    expect(claimDetailRes.statusCode).toBe(200);
    const detailData = claimDetailRes.json().data;
    expect(detailData.status).toBe('SUBMITTED');
    expect(detailData.submitted_proofs).toHaveLength(2);
    expect(detailData.submitted_proofs[0].value).toBe(uploadedFileUrl);

    // 6. Kiểm tra Bảo toàn Quota: Sau khi submit, remaining_quota VẪN LÀ 1 (không giải phóng ra ngoài)
    publicDetailRes = await app.inject({
      method: 'GET',
      url: '/api/v1/public/tasks/task-e2e-submit',
    });
    expect(publicDetailRes.json().data.remaining_quota).toBe(1);

    // 7. Worker 2 nhận suất còn lại thứ 2 -> Quota về 0
    const claim2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/task-e2e-submit/claim',
      headers: {
        'x-worker-id': 'worker-e2e-02',
        'x-user-role': 'WORKER',
      },
    });
    expect(claim2Res.statusCode).toBe(201);

    publicDetailRes = await app.inject({
      method: 'GET',
      url: '/api/v1/public/tasks/task-e2e-submit',
    });
    expect(publicDetailRes.json().data.remaining_quota).toBe(0);

    // 8. Khóa bài nộp: Worker 1 không thể tự hủy bài nộp SUBMITTED (không còn active in_progress claim)
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/task-e2e-submit/claims/cancel',
      headers: {
        'x-worker-id': 'worker-e2e-01',
        'x-user-role': 'WORKER',
      },
    });
    expect(cancelRes.statusCode).toBe(404); // Không tìm thấy active in-progress claim để hủy

    // 9. Khóa bài nộp: Worker 1 không thể nộp lại lần 2 (nhận 409 CLAIM_NOT_IN_PROGRESS)
    const reSubmitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/claims/${claimId}/submit`,
      headers: {
        'x-worker-id': 'worker-e2e-01',
        'x-user-role': 'WORKER',
      },
      payload: {
        proofs: [
          { requirement_id: 'req-screen-e2e', value: uploadedFileUrl },
          { requirement_id: 'req-text-e2e', value: 'user_star_rating_5' },
        ],
      },
    });
    expect(reSubmitRes.statusCode).toBe(409);
    expect(reSubmitRes.json().error.code).toBe('CLAIM_NOT_IN_PROGRESS');
  });
});
