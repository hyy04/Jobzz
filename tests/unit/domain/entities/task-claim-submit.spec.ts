import { describe, it, expect } from 'vitest';
import { TaskClaim } from '../../../../src/domain/entities/task-claim.entity';
import {
  SubmittedProofItem,
  InvalidSubmittedProofError,
} from '../../../../src/domain/value-objects/submitted-proof.vo';
import { ClaimAlreadyClosedError } from '../../../../src/shared/errors/claim-errors';

describe('T001-STP Domain: SubmittedProofItem VO & TaskClaim.submit()', () => {
  const baseTime = new Date('2026-11-23T10:00:00.000Z');

  describe('SubmittedProofItem Value Object', () => {
    it('khởi tạo thành công bằng chứng hình ảnh SCREENSHOT_IMAGE với URL an toàn', () => {
      const item = SubmittedProofItem.create({
        requirementId: 'req-img-01',
        proofType: 'SCREENSHOT_IMAGE',
        value: '/uploads/proofs/proof-12345.png',
      });

      expect(item.requirementId).toBe('req-img-01');
      expect(item.proofType).toBe('SCREENSHOT_IMAGE');
      expect(item.value).toBe('/uploads/proofs/proof-12345.png');
      expect(item.toJSON()).toEqual({
        requirement_id: 'req-img-01',
        proof_type: 'SCREENSHOT_IMAGE',
        value: '/uploads/proofs/proof-12345.png',
      });
    });

    it('khởi tạo thành công bằng chứng văn bản TEXT từ 1-500 ký tự', () => {
      const item = SubmittedProofItem.create({
        requirementId: 'req-txt-01',
        proofType: 'TEXT',
        value: 'Mã giao dịch MoMo: MM-987654321',
      });

      expect(item.requirementId).toBe('req-txt-01');
      expect(item.proofType).toBe('TEXT');
      expect(item.value).toBe('Mã giao dịch MoMo: MM-987654321');
    });

    it('từ chối nếu requirementId rỗng', () => {
      expect(() =>
        SubmittedProofItem.create({
          requirementId: '   ',
          proofType: 'TEXT',
          value: 'Hợp lệ',
        })
      ).toThrowError(InvalidSubmittedProofError);
    });

    it('từ chối nếu loại bằng chứng không hợp lệ', () => {
      expect(() =>
        SubmittedProofItem.create({
          requirementId: 'req-01',
          proofType: 'VIDEO' as any,
          value: 'https://example.com/video.mp4',
        })
      ).toThrowError(InvalidSubmittedProofError);
    });

    it('từ chối nếu bằng chứng TEXT rỗng hoặc vượt quá 500 ký tự', () => {
      expect(() =>
        SubmittedProofItem.create({
          requirementId: 'req-txt-01',
          proofType: 'TEXT',
          value: '   ',
        })
      ).toThrowError(InvalidSubmittedProofError);

      const longText = 'a'.repeat(501);
      expect(() =>
        SubmittedProofItem.create({
          requirementId: 'req-txt-01',
          proofType: 'TEXT',
          value: longText,
        })
      ).toThrowError(InvalidSubmittedProofError);
    });

    it('từ chối nếu bằng chứng SCREENSHOT_IMAGE không phải là đường dẫn URL hợp lệ', () => {
      expect(() =>
        SubmittedProofItem.create({
          requirementId: 'req-img-01',
          proofType: 'SCREENSHOT_IMAGE',
          value: 'invalid-image-path',
        })
      ).toThrowError(InvalidSubmittedProofError);
    });
  });

  describe('TaskClaim.submit() Entity Method', () => {
    it('Worker nộp bài thành công khi slot đang IN_PROGRESS và còn hạn', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });

      const proof1 = SubmittedProofItem.create({
        requirementId: 'req-01',
        proofType: 'SCREENSHOT_IMAGE',
        value: '/uploads/proofs/proof-screenshot.png',
      });

      const proof2 = SubmittedProofItem.create({
        requirementId: 'req-02',
        proofType: 'TEXT',
        value: 'Username: worker_pro',
      });

      const submitTime = new Date('2026-11-23T10:30:00.000Z');
      claim.submit([proof1, proof2], submitTime);

      expect(claim.status.getValue()).toBe('SUBMITTED');
      expect(claim.status.isSubmitted()).toBe(true);
      expect(claim.submittedAt).toEqual(submitTime);
      expect(claim.submittedProofs.length).toBe(2);
      expect(claim.submittedProofs[0].requirementId).toBe('req-01');
      expect(claim.submittedProofs[1].requirementId).toBe('req-02');
      expect(claim.canBeCanceled(submitTime)).toBe(false);
      expect(claim.toJSON().submitted_proofs.length).toBe(2);
    });

    it('từ chối nộp bài nếu slot đã hết hạn tại thời điểm nộp', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'worker-01',
        executionTimeMinutes: 30, // Hết hạn lúc 10:30:00
        now: baseTime,
      });

      const lateTime = new Date('2026-11-23T10:30:01.000Z');
      expect(() => claim.submit([], lateTime)).toThrowError(ClaimAlreadyClosedError);
    });

    it('từ chối nộp bài nếu slot đã bị hủy CANCELED', () => {
      const claim = TaskClaim.create({
        taskId: 'task-101',
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });

      claim.cancel(new Date('2026-11-23T10:10:00.000Z'));
      expect(() => claim.submit([], new Date('2026-11-23T10:15:00.000Z'))).toThrowError(
        ClaimAlreadyClosedError
      );
    });

    it('tái tạo (reconstitute) chính xác TaskClaim có chứa danh sách submittedProofs', () => {
      const reconstituted = TaskClaim.reconstitute({
        id: 'claim-rec-01',
        taskId: 'task-101',
        workerId: 'worker-01',
        status: 'SUBMITTED',
        claimedAt: baseTime,
        expiresAt: new Date('2026-11-23T11:00:00.000Z'),
        submittedAt: new Date('2026-11-23T10:20:00.000Z'),
        submittedProofs: [
          {
            requirement_id: 'req-01',
            proof_type: 'TEXT',
            value: 'Txn: 123456',
          },
        ],
        completedAt: null,
        createdAt: baseTime,
        updatedAt: new Date('2026-11-23T10:20:00.000Z'),
      });

      expect(reconstituted.submittedProofs.length).toBe(1);
      expect(reconstituted.submittedProofs[0].requirementId).toBe('req-01');
      expect(reconstituted.submittedProofs[0].value).toBe('Txn: 123456');
    });
  });
});

