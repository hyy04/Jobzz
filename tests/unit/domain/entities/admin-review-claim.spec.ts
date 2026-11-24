import { describe, it, expect } from 'vitest';
import { TaskClaim } from '../../../../src/domain/entities/task-claim.entity';
import { WorkerWallet, NegativeAmountError } from '../../../../src/domain/entities/worker-wallet.entity';
import { WalletTransaction } from '../../../../src/domain/entities/wallet-transaction.entity';
import { RejectionReason } from '../../../../src/domain/value-objects/rejection-reason.vo';
import {
  ClaimAlreadyReviewedError,
  ClaimNotInSubmittedStatusError,
  SubmissionRejectionReasonInvalidError,
} from '../../../../src/shared/errors/claim-errors';

describe('Admin Review Claim & Worker Wallet Domain Entities (T001-RTS)', () => {
  const createSubmittedClaim = () => {
    const claim = TaskClaim.create({
      taskId: 'task-100',
      workerId: 'worker-200',
      executionTimeMinutes: 60,
    });
    claim.submit([], new Date());
    return claim;
  };

  describe('TaskClaim.approve()', () => {
    it('chuyển trạng thái sang APPROVED và ghi nhận thông tin reviewer', () => {
      const claim = createSubmittedClaim();
      const reviewDate = new Date('2026-11-23T10:00:00Z');

      claim.approve('admin-01', reviewDate);

      expect(claim.status.getValue()).toBe('APPROVED');
      expect(claim.reviewerId).toBe('admin-01');
      expect(claim.reviewedAt).toEqual(reviewDate);
      expect(claim.completedAt).toEqual(reviewDate);
      expect(claim.toJSON().status).toBe('APPROVED');
      expect(claim.toJSON().reviewer_id).toBe('admin-01');
    });

    it('ném lỗi ClaimAlreadyReviewedError khi duyệt lại bài đã APPROVED', () => {
      const claim = createSubmittedClaim();
      claim.approve('admin-01');

      expect(() => claim.approve('admin-02')).toThrow(ClaimAlreadyReviewedError);
    });

    it('ném lỗi ClaimAlreadyReviewedError khi duyệt bài đã REJECTED', () => {
      const claim = createSubmittedClaim();
      claim.reject('admin-01', 'Ảnh không đúng yêu cầu bài viết');

      expect(() => claim.approve('admin-02')).toThrow(ClaimAlreadyReviewedError);
    });

    it('ném lỗi ClaimNotInSubmittedStatusError khi duyệt claim đang IN_PROGRESS', () => {
      const claim = TaskClaim.create({
        taskId: 'task-100',
        workerId: 'worker-200',
        executionTimeMinutes: 60,
      });

      expect(() => claim.approve('admin-01')).toThrow(ClaimNotInSubmittedStatusError);
    });
  });

  describe('TaskClaim.reject()', () => {
    it('chuyển trạng thái sang REJECTED và ghi nhận lý do từ chối', () => {
      const claim = createSubmittedClaim();
      const reviewDate = new Date('2026-11-23T10:00:00Z');
      const reason = 'Ảnh chụp màn hình bị mờ, không thấy mã giao dịch đối soát.';

      claim.reject('admin-01', reason, reviewDate);

      expect(claim.status.getValue()).toBe('REJECTED');
      expect(claim.reviewerId).toBe('admin-01');
      expect(claim.rejectionReason).toBe(reason);
      expect(claim.reviewedAt).toEqual(reviewDate);
      expect(claim.completedAt).toEqual(reviewDate);
      expect(claim.toJSON().status).toBe('REJECTED');
      expect(claim.toJSON().rejection_reason).toBe(reason);
    });

    it('ném lỗi ClaimAlreadyReviewedError khi từ chối lại bài đã REJECTED', () => {
      const claim = createSubmittedClaim();
      claim.reject('admin-01', 'Lý do 1 hợp lệ nhưng bị từ chối');

      expect(() => claim.reject('admin-02', 'Lý do 2')).toThrow(ClaimAlreadyReviewedError);
    });

    it('ném lỗi ClaimNotInSubmittedStatusError khi từ chối claim đang IN_PROGRESS', () => {
      const claim = TaskClaim.create({
        taskId: 'task-100',
        workerId: 'worker-200',
        executionTimeMinutes: 60,
      });

      expect(() => claim.reject('admin-01', 'Lý do từ chối')).toThrow(ClaimNotInSubmittedStatusError);
    });
  });

  describe('WorkerWallet Entity', () => {
    it('tạo mới ví với balance mặc định bằng 0', () => {
      const wallet = WorkerWallet.create({ workerId: 'worker-123' });

      expect(wallet.workerId).toBe('worker-123');
      expect(wallet.balance).toBe(0);
      expect(wallet.toJSON().balance).toBe(0);
    });

    it('cộng thêm Xu thưởng hợp lệ vào ví', () => {
      const wallet = WorkerWallet.create({ workerId: 'worker-123', balance: 50 });
      wallet.credit(100);

      expect(wallet.balance).toBe(150);
    });

    it('ném lỗi NegativeAmountError khi cộng số Xu <= 0 hoặc không phải số nguyên', () => {
      const wallet = WorkerWallet.create({ workerId: 'worker-123' });

      expect(() => wallet.credit(0)).toThrow(NegativeAmountError);
      expect(() => wallet.credit(-50)).toThrow(NegativeAmountError);
      expect(() => wallet.credit(12.5)).toThrow(NegativeAmountError);
    });
  });

  describe('WalletTransaction Entity', () => {
    it('tạo bản ghi giao dịch biến động ví chính xác', () => {
      const tx = WalletTransaction.create({
        walletId: 'wallet-01',
        workerId: 'worker-123',
        type: 'TASK_REWARD',
        amount: 250,
        balanceAfter: 500,
        referenceId: 'claim-999',
        description: 'Thưởng hoàn thành nhiệm vụ task-100',
      });

      expect(tx.walletId).toBe('wallet-01');
      expect(tx.workerId).toBe('worker-123');
      expect(tx.type).toBe('TASK_REWARD');
      expect(tx.amount).toBe(250);
      expect(tx.balanceAfter).toBe(500);
      expect(tx.referenceId).toBe('claim-999');
      expect(tx.description).toContain('Thưởng hoàn thành');
    });
  });

  describe('RejectionReason Value Object', () => {
    it('chấp nhận lý do từ chối hợp lệ từ 10 đến 500 ký tự', () => {
      const reason = RejectionReason.create('Ảnh chụp màn hình không có thông tin xác thực tài khoản.');
      expect(reason.getValue()).toBe('Ảnh chụp màn hình không có thông tin xác thực tài khoản.');
    });

    it('loại bỏ thẻ HTML và Script nguy hiểm để chống XSS', () => {
      const raw = 'Ảnh chụp bị lỗi <script>alert("XSS")</script> <b>vui lòng nộp lại</b>';
      const reason = RejectionReason.create(raw);

      expect(reason.getValue()).toBe('Ảnh chụp bị lỗi  vui lòng nộp lại');
      expect(reason.getValue()).not.toContain('<script>');
      expect(reason.getValue()).not.toContain('<b>');
    });

    it('ném lỗi khi lý do từ chối dưới 10 ký tự sau khi sanitize', () => {
      expect(() => RejectionReason.create('Ngắn quá')).toThrow(SubmissionRejectionReasonInvalidError);
      expect(() => RejectionReason.create('<b>abc</b>')).toThrow(SubmissionRejectionReasonInvalidError);
    });

    it('ném lỗi khi lý do từ chối vượt quá 500 ký tự', () => {
      const tooLong = 'A'.repeat(501);
      expect(() => RejectionReason.create(tooLong)).toThrow(SubmissionRejectionReasonInvalidError);
    });
  });
});

