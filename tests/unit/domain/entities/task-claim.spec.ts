import { describe, it, expect } from 'vitest';
import { TaskClaim } from '../../../../src/domain/entities/task-claim.entity';
import { ClaimStatus } from '../../../../src/domain/value-objects/claim-status.vo';
import {
  ClaimAlreadyClosedError,
  InvalidClaimStatusTransitionError,
} from '../../../../src/shared/errors/claim-errors';

describe('TaskClaim Entity & ClaimStatus Value Object (Clean Architecture Domain Layer)', () => {
  const baseTime = new Date('2026-11-20T10:00:00.000Z');

  describe('Claim Creation & Reconstitution', () => {
    it('khởi tạo TaskClaim mới với trạng thái IN_PROGRESS và thời gian hết hạn chính xác', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'usr-worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });

      expect(claim.id).toBeDefined();
      expect(claim.taskId).toBe('task-101');
      expect(claim.workerId).toBe('usr-worker-01');
      expect(claim.status.getValue()).toBe('IN_PROGRESS');
      expect(claim.claimedAt.toISOString()).toBe(baseTime.toISOString());
      // 60 minutes = 3600000 ms -> 11:00:00
      expect(claim.expiresAt.toISOString()).toBe('2026-11-20T11:00:00.000Z');
      expect(claim.submittedAt).toBeNull();
      expect(claim.completedAt).toBeNull();
      expect(claim.isExpired(baseTime)).toBe(false);
      expect(claim.getRemainingSeconds(baseTime)).toBe(3600);
    });

    it('tái tạo (reconstitute) chính xác TaskClaim từ cơ sở dữ liệu persistence', () => {
      const reconstituted = TaskClaim.reconstitute({
        id: 'claim-existing-01',
        taskId: 'task-102',
        workerId: 'usr-worker-02',
        status: 'SUBMITTED',
        claimedAt: new Date('2026-11-20T08:00:00.000Z'),
        expiresAt: new Date('2026-11-20T09:00:00.000Z'),
        submittedAt: new Date('2026-11-20T08:45:00.000Z'),
        completedAt: null,
        createdAt: new Date('2026-11-20T08:00:00.000Z'),
        updatedAt: new Date('2026-11-20T08:45:00.000Z'),
      });

      expect(reconstituted.id).toBe('claim-existing-01');
      expect(reconstituted.status.isSubmitted()).toBe(true);
      expect(reconstituted.submittedAt).toBeDefined();
    });
  });

  describe('Expiration & Time Tracking Logic (REQ-BCT-017)', () => {
    it('xác định chính xác thời điểm quá hạn qua isExpired()', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'usr-worker-01',
        executionTimeMinutes: 30, // Hết hạn lúc 10:30:00
        now: baseTime,
      });

      const beforeExpiry = new Date('2026-11-20T10:29:59.000Z');
      const atExpiry = new Date('2026-11-20T10:30:00.000Z');
      const afterExpiry = new Date('2026-11-20T10:30:01.000Z');

      expect(claim.isExpired(beforeExpiry)).toBe(false);
      expect(claim.getRemainingSeconds(beforeExpiry)).toBe(1);

      expect(claim.isExpired(afterExpiry)).toBe(true);
      expect(claim.getRemainingSeconds(afterExpiry)).toBe(0);
    });
  });

  describe('Cancel Claim Flow (REQ-BCT-015, REQ-BCT-016)', () => {
    it('cho phép Worker chủ động hủy claim đang IN_PROGRESS khi chưa hết hạn', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'usr-worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });

      const cancelTime = new Date('2026-11-20T10:15:00.000Z');
      claim.cancel(cancelTime);

      expect(claim.status.getValue()).toBe('CANCELED');
      expect(claim.status.isCanceled()).toBe(true);
      expect(claim.canBeCanceled(cancelTime)).toBe(false);
      expect(claim.getRemainingSeconds(cancelTime)).toBe(0);
    });

    it('từ chối hủy claim nếu lượt nhận việc đã quá hạn hoặc đã đóng', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'usr-worker-01',
        executionTimeMinutes: 30,
        now: baseTime,
      });

      const lateTime = new Date('2026-11-20T10:35:00.000Z');
      expect(() => claim.cancel(lateTime)).toThrow(ClaimAlreadyClosedError);
    });
  });

  describe('Submission & Approval Flow', () => {
    it('cho phép Worker nộp bài khi slot còn hiệu lực', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'usr-worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });

      const submitTime = new Date('2026-11-20T10:45:00.000Z');
      claim.submit(submitTime);

      expect(claim.status.getValue()).toBe('SUBMITTED');
      expect(claim.submittedAt?.toISOString()).toBe(submitTime.toISOString());
    });

    it('từ chối nộp bài nếu slot đã hết hạn', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'usr-worker-01',
        executionTimeMinutes: 30,
        now: baseTime,
      });

      const lateTime = new Date('2026-11-20T10:35:00.000Z');
      expect(() => claim.submit(lateTime)).toThrow(ClaimAlreadyClosedError);
    });

    it('cho phép Admin duyệt bài hoặc từ chối bài nộp', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'usr-worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });

      claim.submit(new Date('2026-11-20T10:30:00.000Z'));
      claim.approve(new Date('2026-11-20T11:00:00.000Z'));
      expect(claim.status.isApproved()).toBe(true);
      expect(claim.completedAt).toBeDefined();
    });
  });

  describe('State Machine & Transition Rules', () => {
    it('chặn các chuyển đổi trạng thái phi pháp', () => {
      const status = ClaimStatus.create('CANCELED');
      expect(() => status.transitionTo('APPROVED')).toThrow(
        InvalidClaimStatusTransitionError
      );
    });
  });
});

