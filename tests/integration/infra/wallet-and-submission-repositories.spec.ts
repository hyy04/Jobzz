import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryWalletRepository } from '../../../src/infra/repositories/in-memory-wallet.repository';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { ClaimAlreadyReviewedError, ClaimNotInSubmittedStatusError } from '../../../src/shared/errors/claim-errors';

describe('Wallet and TaskClaim Repositories Integration (T002-RTS)', () => {
  let walletRepo: InMemoryWalletRepository;
  let claimRepo: InMemoryTaskClaimRepository;

  beforeEach(() => {
    walletRepo = new InMemoryWalletRepository();
    claimRepo = new InMemoryTaskClaimRepository();
  });

  describe('InMemoryWalletRepository', () => {
    it('getOrCreateWallet() tạo ví mới với balance = 0 nếu chưa tồn tại', async () => {
      const wallet = await walletRepo.getOrCreateWallet('worker-001');

      expect(wallet).toBeDefined();
      expect(wallet.workerId).toBe('worker-001');
      expect(wallet.balance).toBe(0);

      const sameWallet = await walletRepo.getOrCreateWallet('worker-001');
      expect(sameWallet.id).toBe(wallet.id);
    });

    it('creditAtomic() cộng Xu thưởng và lưu transaction log chính xác', async () => {
      const now = new Date('2026-11-23T11:00:00Z');
      const result = await walletRepo.creditAtomic('worker-002', 300, {
        referenceId: 'claim-123',
        description: 'Thưởng nhiệm vụ hoàn thành xuất sắc',
        now,
      });

      expect(result.wallet.balance).toBe(300);
      expect(result.transaction.amount).toBe(300);
      expect(result.transaction.balanceAfter).toBe(300);
      expect(result.transaction.type).toBe('TASK_REWARD');
      expect(result.transaction.referenceId).toBe('claim-123');

      // Cộng tiếp lần 2
      const result2 = await walletRepo.creditAtomic('worker-002', 150, {
        referenceId: 'claim-124',
        description: 'Thưởng nhiệm vụ 2',
        now,
      });
      expect(result2.wallet.balance).toBe(450);

      const history = await walletRepo.findTransactionsByWorkerId('worker-002');
      expect(history.length).toBe(2);
    });
  });

  describe('InMemoryTaskClaimRepository Submissions Query & Review', () => {
    it('findSubmittedClaims() lọc đúng claims SUBMITTED, sắp xếp FIFO và phân trang', async () => {
      // Tạo 3 claims submitted ở các thời điểm khác nhau
      const claim1 = TaskClaim.create({ taskId: 'task-A', workerId: 'w-1', executionTimeMinutes: 60 });
      claim1.submit([], new Date('2026-11-23T08:00:00Z'));
      await claimRepo.save(claim1);

      const claim2 = TaskClaim.create({ taskId: 'task-A', workerId: 'w-2', executionTimeMinutes: 60 });
      claim2.submit([], new Date('2026-11-23T09:00:00Z'));
      await claimRepo.save(claim2);

      const claim3 = TaskClaim.create({ taskId: 'task-B', workerId: 'w-3', executionTimeMinutes: 60 });
      claim3.submit([], new Date('2026-11-23T07:30:00Z'));
      await claimRepo.save(claim3);

      // Claim đang IN_PROGRESS không được lọt vào danh sách
      const inProgressClaim = TaskClaim.create({ taskId: 'task-A', workerId: 'w-4', executionTimeMinutes: 60 });
      await claimRepo.save(inProgressClaim);

      // Query toàn bộ SUBMITTED
      const allSubmitted = await claimRepo.findSubmittedClaims({ page: 1, limit: 10 });
      expect(allSubmitted.total).toBe(3);
      // Kiểm tra FIFO: claim3 (07:30) -> claim1 (08:00) -> claim2 (09:00)
      expect(allSubmitted.claims[0].id).toBe(claim3.id);
      expect(allSubmitted.claims[1].id).toBe(claim1.id);
      expect(allSubmitted.claims[2].id).toBe(claim2.id);

      // Query lọc theo taskId = 'task-A'
      const taskASubmitted = await claimRepo.findSubmittedClaims({ taskId: 'task-A', page: 1, limit: 10 });
      expect(taskASubmitted.total).toBe(2);
      expect(taskASubmitted.claims[0].id).toBe(claim1.id);
      expect(taskASubmitted.claims[1].id).toBe(claim2.id);

      // Query phân trang (page 1, limit 1)
      const paged = await claimRepo.findSubmittedClaims({ taskId: 'task-A', page: 1, limit: 1 });
      expect(paged.claims.length).toBe(1);
      expect(paged.claims[0].id).toBe(claim1.id);
    });

    it('approveAtomic() duyệt bài nộp thành công và cấm duyệt lại', async () => {
      const claim = TaskClaim.create({ taskId: 'task-A', workerId: 'w-1', executionTimeMinutes: 60 });
      claim.submit([], new Date());
      await claimRepo.save(claim);

      const approved = await claimRepo.approveAtomic(claim.id, 'admin-1', new Date());
      expect(approved.status.getValue()).toBe('APPROVED');
      expect(approved.reviewerId).toBe('admin-1');

      // Duyệt lại sẽ ném lỗi ClaimAlreadyReviewedError
      await expect(claimRepo.approveAtomic(claim.id, 'admin-2', new Date()))
        .rejects.toThrow(ClaimAlreadyReviewedError);
    });

    it('rejectAtomic() từ chối bài nộp thành công với lý do và cấm từ chối lại', async () => {
      const claim = TaskClaim.create({ taskId: 'task-A', workerId: 'w-1', executionTimeMinutes: 60 });
      claim.submit([], new Date());
      await claimRepo.save(claim);

      const rejected = await claimRepo.rejectAtomic(
        claim.id,
        'admin-1',
        'Ảnh chụp màn hình mờ, không thấy thông tin.',
        new Date()
      );
      expect(rejected.status.getValue()).toBe('REJECTED');
      expect(rejected.reviewerId).toBe('admin-1');
      expect(rejected.rejectionReason).toContain('Ảnh chụp màn hình mờ');

      // Từ chối lại sẽ ném lỗi ClaimAlreadyReviewedError
      await expect(claimRepo.rejectAtomic(claim.id, 'admin-2', 'Lý do khác', new Date()))
        .rejects.toThrow(ClaimAlreadyReviewedError);
    });
  });
});
