import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { InMemoryTaskRepository } from '../../src/infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from '../../src/infra/repositories/in-memory-task-claim.repository';
import { LiveTaskProgressAdapter } from '../../src/infra/adapters/live-task-progress.adapter';
import { FreelanceTask } from '../../src/domain/entities/freelance-task.entity';
import { RewardCoins } from '../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../src/domain/value-objects/proof-requirement.vo';

describe('Worker Web Marketplace & Claim Slot E2E Flow (REQ-BCT-018..021)', () => {
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

  it('phục vụ trang chủ với đầy đủ các thành phần giao diện Worker Marketplace (REQ-BCT-018)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    const html = res.body;

    // Kiểm tra Tab chuyển đổi
    expect(html).toContain('id="nav-tab-worker"');
    expect(html).toContain('id="nav-tab-admin"');
    expect(html).toContain('id="view-worker"');
    expect(html).toContain('id="view-admin"');
    expect(html).toContain('id="worker-marketplace-container"');
    expect(html).toContain('WORKER (Người làm việc)');
  });

  it('phục vụ đúng các tệp JavaScript module của giao diện Người làm', async () => {
    const modules = [
      '/public/js/components/worker-marketplace.js',
      '/public/js/components/task-claim-modal.js',
      '/public/js/components/countdown-timer.js',
    ];

    for (const url of modules) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/javascript');
    }
  });

  it('hoàn thành toàn bộ luồng E2E: Duyệt việc -> Xem chi tiết ảnh minh họa -> Nhận việc giữ slot -> Đếm ngược -> Hủy hoàn trả slot -> Worker khác nhận lại', async () => {
    // 1. Khởi tạo một nhiệm vụ có hình ảnh minh họa các bước và quota = 1
    const task = FreelanceTask.createDraft({
      id: 'task-e2e-bct',
      creatorId: 'admin-corp',
      title: 'Tải và đăng ký ứng dụng ngân hàng số',
      description: 'Cài đặt app từ cửa hàng chính thức và xác thực tài khoản để nhận Xu',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(5000),
      quota: Quota.create(1), // Chỉ 1 suất duy nhất
      steps: [
        StepInstruction.create(
          1,
          'Cài đặt ứng dụng từ cửa hàng chính thức',
          'https://jobzz.vn/app',
          'https://jobzz.vn/images/step1.png'
        ),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'p1',
          proofType: 'SCREENSHOT_IMAGE',
          title: 'Ảnh chụp màn hình trang chủ',
          description: 'Chụp rõ màn hình sau khi hoàn tất đăng nhập',
        }),
      ],
      executionTimeMinutes: 45,
      autoApprovalDays: 3,
    });
    task.publish();
    await taskRepo.save(task);

    // 2. Worker duyệt danh sách việc làm
    const browseRes = await app.inject({
      method: 'GET',
      url: '/api/v1/public/tasks?category=APP_INSTALL',
    });
    expect(browseRes.statusCode).toBe(200);
    const browseJson = browseRes.json();
    expect(browseJson.data.length).toBe(1);
    expect(browseJson.data[0].id).toBe('task-e2e-bct');
    expect(browseJson.data[0].remaining_quota).toBe(1);

    // 3. Worker mở xem chi tiết nhiệm vụ (kiểm tra có ảnh minh họa các bước)
    const detailRes = await app.inject({
      method: 'GET',
      url: '/api/v1/public/tasks/task-e2e-bct',
    });
    expect(detailRes.statusCode).toBe(200);
    const detailJson = detailRes.json();
    expect(detailJson.data.steps[0].image_url).toBe('https://jobzz.vn/images/step1.png');

    // 4. Worker 1 nhận việc giữ slot (Claim Slot)
    const claimRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/task-e2e-bct/claim',
      headers: {
        'x-user-id': 'worker-01',
        'x-user-role': 'WORKER',
      },
    });
    expect(claimRes.statusCode).toBe(201);
    const claimJson = claimRes.json();
    expect(claimJson.data.status).toBe('IN_PROGRESS');
    expect(claimJson.data.remaining_seconds).toBeGreaterThan(0);

    // 5. Kiểm tra danh sách: task-e2e-bct hết suất nên không còn hiển thị
    const browseAfterClaim = await app.inject({
      method: 'GET',
      url: '/api/v1/public/tasks',
    });
    expect(browseAfterClaim.json().data.length).toBe(0);

    // 6. Worker 2 cố tình nhận việc cùng lúc -> Nhận lỗi 409 TASK_QUOTA_EXHAUSTED
    const worker2Claim = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/task-e2e-bct/claim',
      headers: {
        'x-user-id': 'worker-02',
        'x-user-role': 'WORKER',
      },
    });
    expect(worker2Claim.statusCode).toBe(409);
    expect(worker2Claim.json().error.code).toBe('TASK_QUOTA_EXHAUSTED');

    // 7. Worker 1 kiểm tra my-claim
    const myClaimRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks/task-e2e-bct/my-claim',
      headers: {
        'x-user-id': 'worker-01',
        'x-user-role': 'WORKER',
      },
    });
    expect(myClaimRes.statusCode).toBe(200);
    expect(myClaimRes.json().data.status).toBe('IN_PROGRESS');

    // 8. Worker 1 quyết định hủy nhận việc (Cancel Claim)
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/task-e2e-bct/claims/cancel',
      headers: {
        'x-user-id': 'worker-01',
      },
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().data.status).toBe('CANCELED');

    // 9. Suất trống được hoàn trả ngay lập tức -> Worker 2 nhận việc thành công!
    const worker2Retry = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/task-e2e-bct/claim',
      headers: {
        'x-user-id': 'worker-02',
        'x-user-role': 'WORKER',
      },
    });
    expect(worker2Retry.statusCode).toBe(201);
    expect(worker2Retry.json().data.worker_id).toBe('worker-02');
  });
});

