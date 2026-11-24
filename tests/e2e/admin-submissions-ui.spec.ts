import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { InMemoryTaskRepository } from '../../src/infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from '../../src/infra/repositories/in-memory-task-claim.repository';
import { InMemoryWalletRepository } from '../../src/infra/repositories/in-memory-wallet.repository';
import { FreelanceTask } from '../../src/domain/entities/freelance-task.entity';
import { TaskClaim } from '../../src/domain/entities/task-claim.entity';
import { SubmittedProofItem } from '../../src/domain/value-objects/submitted-proof.vo';
import { RewardCoins } from '../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../src/domain/value-objects/proof-requirement.vo';

describe('Admin Submissions Review Web UI & Full E2E Flow (REQ-RTS-019..023)', () => {
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

  it('phục vụ đúng các tệp HTML và JavaScript modules cho tính năng duyệt bài nộp của Admin', async () => {
    // 1. Kiểm tra HTML index có tab và containers cho submissions
    const htmlRes = await app.inject({ method: 'GET', url: '/' });
    expect(htmlRes.statusCode).toBe(200);
    const html = htmlRes.body;
    expect(html).toContain('nav-tab-submissions');
    expect(html).toContain('view-submissions');
    expect(html).toContain('admin-submissions-container');
    expect(html).toContain('lightbox-modal-container');

    // 2. Kiểm tra phục vụ các JS modules
    const modules = [
      '/public/js/components/admin-submissions-tab.js',
      '/public/js/components/submission-review-modal.js',
      '/public/js/components/image-lightbox-modal.js',
    ];

    for (const url of modules) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/javascript');
    }

    // 3. Kiểm tra các thành phần giao diện duyệt bài có trong script
    const tabRes = await app.inject({
      method: 'GET',
      url: '/public/js/components/admin-submissions-tab.js',
    });
    expect(tabRes.body).toContain('btn-review-submission');
    expect(tabRes.body).toContain('submissions-badge-count');
    expect(tabRes.body).toContain('submissions-table-body');

    const modalRes = await app.inject({
      method: 'GET',
      url: '/public/js/components/submission-review-modal.js',
    });
    expect(modalRes.body).toContain('btn-confirm-approve');
    expect(modalRes.body).toContain('btn-open-reject-view');
    expect(modalRes.body).toContain('reject-reason-input');
    expect(modalRes.body).toContain('reject-reason-counter');
  });

  it('hoàn thành toàn bộ luồng E2E Phê duyệt: Nộp bài -> Admin xem chi tiết proofs -> Duyệt bài -> Cộng Xu ví -> Tự động đóng task COMPLETED khi đủ quota', async () => {
    // 1. Admin tạo nhiệm vụ với quota = 1 và mức thưởng 1000 Xu
    const task = FreelanceTask.createDraft({
      id: 'task-e2e-review-01',
      creatorId: 'employer-top',
      title: 'Tải ứng dụng và đánh giá 5 sao nhận thưởng ngay',
      description: 'Mô tả chi tiết các bước cần thực hiện để nhận thưởng',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(1000),
      quota: Quota.create(1),
      steps: [StepInstruction.create(1, 'Cài đặt ứng dụng')],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-proof-screen',
          title: 'Ảnh chụp màn hình',
          description: 'Ảnh rõ nét chứng minh hoàn thành',
          proofType: 'SCREENSHOT_IMAGE',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    task.publish();
    await taskRepo.save(task);

    // 2. Worker nộp bằng chứng hoàn thành nhiệm vụ
    const claim = TaskClaim.create({
      id: 'claim-e2e-01',
      taskId: task.getId(),
      workerId: 'worker-hero-01',
      executionTimeMinutes: 60,
    });
    claim.submit([
      SubmittedProofItem.create({
        requirementId: 'req-proof-screen',
        proofType: 'SCREENSHOT_IMAGE',
        value: 'https://example.com/uploads/proofs/proof-hero.png',
      }),
    ], new Date());
    await claimRepo.save(claim);

    // 3. Admin truy vấn danh sách bài nộp chờ duyệt (GET /api/v1/admin/submissions)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/submissions',
      headers: { 'x-admin-id': 'adm-001', 'x-user-role': 'ADMIN' },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.data.length).toBe(1);
    expect(listBody.data[0].claim_id).toBe('claim-e2e-01');
    expect(listBody.data[0].reward_coins).toBe(1000);

    // 4. Admin xem chi tiết bằng chứng (GET /api/v1/admin/submissions/:claimId)
    const detailsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/submissions/claim-e2e-01',
      headers: { 'x-admin-id': 'adm-001', 'x-user-role': 'ADMIN' },
    });
    expect(detailsRes.statusCode).toBe(200);
    const detailsBody = detailsRes.json();
    expect(detailsBody.data.submitted_proofs.length).toBe(1);
    expect(detailsBody.data.submitted_proofs[0].value).toContain('proof-hero.png');

    // 5. Admin thực hiện Phê duyệt bài nộp (POST /api/v1/admin/submissions/:claimId/approve)
    const approveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/submissions/claim-e2e-01/approve',
      headers: { 'x-admin-id': 'adm-001', 'x-user-role': 'ADMIN' },
    });
    expect(approveRes.statusCode).toBe(200);
    const approveBody = approveRes.json();
    expect(approveBody.success).toBe(true);
    expect(approveBody.data.status).toBe('APPROVED');
    expect(approveBody.data.worker_new_balance).toBe(1000);
    expect(approveBody.data.task_status).toBe('COMPLETED'); // Tự động hoàn thành vì quota = 1

    // 6. Kiểm tra lại số dư ví Worker và lịch sử giao dịch
    const wallet = await walletRepo.findByWorkerId('worker-hero-01');
    expect(wallet?.balance).toBe(1000);
    const txs = await walletRepo.findTransactionsByWorkerId('worker-hero-01');
    expect(txs.length).toBe(1);
    expect(txs[0].amount).toBe(1000);
    expect(txs[0].type).toBe('TASK_REWARD');

    // 7. Kiểm tra danh sách bài nộp chờ duyệt giờ đã về 0
    const emptyListRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/submissions',
      headers: { 'x-admin-id': 'adm-001', 'x-user-role': 'ADMIN' },
    });
    expect(emptyListRes.json().data.length).toBe(0);
  });

  it('hoàn thành toàn bộ luồng E2E Từ chối: Nộp bài -> Admin từ chối kèm lý do -> Giải phóng slot cho cộng đồng nhận làm bù', async () => {
    // 1. Tạo nhiệm vụ với quota = 1
    const task = FreelanceTask.createDraft({
      id: 'task-e2e-reject-01',
      creatorId: 'employer-top',
      title: 'Tải ứng dụng và đánh giá',
      description: 'Mô tả chi tiết các bước cần thực hiện',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(500),
      quota: Quota.create(1),
      steps: [StepInstruction.create(1, 'Cài đặt ứng dụng từ cửa hàng')],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-screen',
          title: 'Ảnh chụp màn hình',
          description: 'Ảnh rõ nét',
          proofType: 'SCREENSHOT_IMAGE',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    task.publish();
    await taskRepo.save(task);

    // 2. Worker 1 nộp bài (chiếm slot)
    const claim1 = TaskClaim.create({
      id: 'claim-worker-1',
      taskId: task.getId(),
      workerId: 'worker-lazy',
      executionTimeMinutes: 60,
    });
    claim1.submit([], new Date());
    await claimRepo.save(claim1);

    // Vì occupied_slots = 1 (submitted) và quota = 1 -> hết slot làm bù
    const activeBeforeReject = await claimRepo.countActiveClaims(task.getId(), new Date());
    const submittedBeforeReject = await claimRepo.countSubmittedClaims(task.getId());
    const approvedBeforeReject = await claimRepo.countApprovedClaims(task.getId());
    expect(task.getQuota().getValue() - (activeBeforeReject + submittedBeforeReject + approvedBeforeReject)).toBe(0);

    // 3. Admin kiểm tra và từ chối bài nộp vì ảnh mờ
    const rejectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/submissions/claim-worker-1/reject',
      headers: { 'x-admin-id': 'adm-001', 'x-user-role': 'ADMIN' },
      payload: {
        rejection_reason: 'Ảnh chụp màn hình quá mờ, không thấy tài khoản đánh giá.',
      },
    });
    expect(rejectRes.statusCode).toBe(200);
    const rejectBody = rejectRes.json();
    expect(rejectBody.data.status).toBe('REJECTED');
    expect(rejectBody.data.rejection_reason).toContain('Ảnh chụp màn hình quá mờ');

    // 4. Kiểm tra slot đã được giải phóng: remaining_quota tự động tăng lên 1 suất khả dụng!
    const activeAfterReject = await claimRepo.countActiveClaims(task.getId(), new Date());
    const submittedAfterReject = await claimRepo.countSubmittedClaims(task.getId());
    const approvedAfterReject = await claimRepo.countApprovedClaims(task.getId());
    const remainingQuota = task.getQuota().getValue() - (activeAfterReject + submittedAfterReject + approvedAfterReject);
    expect(remainingQuota).toBe(1);

    // 5. Worker khác có thể nhận làm bù thành công
    const claim2 = TaskClaim.create({
      id: 'claim-worker-2',
      taskId: task.getId(),
      workerId: 'worker-diligent',
      executionTimeMinutes: 60,
    });
    await claimRepo.save(claim2);
    expect(claim2.status.isInProgress()).toBe(true);
  });
});
