import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { LocalStorageAdapter } from '../../../src/infra/storage/local-storage.adapter';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { LiveTaskProgressAdapter } from '../../../src/infra/adapters/live-task-progress.adapter';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { SubmittedProofItem } from '../../../src/domain/value-objects/submitted-proof.vo';
import {
  InvalidFileTypeError,
  FileTooLargeError,
  ForbiddenNotClaimOwnerError,
  ClaimExpiredError,
  ClaimNotInProgressError,
} from '../../../src/shared/errors/claim-errors';

describe('T002-STP Integration: Storage & Infra Layer', () => {
  const testUploadDir = path.resolve(process.cwd(), 'public/uploads/proofs');

  describe('LocalStorageAdapter', () => {
    let storage: LocalStorageAdapter;
    const createdFiles: string[] = [];

    beforeEach(() => {
      storage = new LocalStorageAdapter();
    });

    afterEach(() => {
      // Dọn dẹp các file sinh ra trong lúc test
      for (const file of createdFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }
    });

    it('lưu thành công ảnh PNG hợp lệ dưới 5MB và trả về đường dẫn URL an toàn', async () => {
      const buffer = Buffer.from('fake-png-content');
      const result = await storage.saveFile(buffer, 'image/png', 'screenshot.png');

      expect(result.fileUrl).toMatch(/^\/uploads\/proofs\/proof-[a-f0-9-]+\.png$/);
      expect(result.fileName).toMatch(/^proof-[a-f0-9-]+\.png$/);
      expect(result.fileSize).toBe(buffer.length);
      expect(result.mimeType).toBe('image/png');

      const fullPath = path.join(testUploadDir, result.fileName);
      createdFiles.push(fullPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fs.readFileSync(fullPath).toString()).toBe('fake-png-content');
    });

    it('lưu thành công ảnh JPEG và WebP hợp lệ', async () => {
      const jpegBuf = Buffer.from('fake-jpeg');
      const webpBuf = Buffer.from('fake-webp');

      const resJpeg = await storage.saveFile(jpegBuf, 'image/jpeg', 'photo.jpg');
      const resWebp = await storage.saveFile(webpBuf, 'image/webp', 'image.webp');

      expect(resJpeg.fileUrl).toMatch(/\.jpg$/);
      expect(resWebp.fileUrl).toMatch(/\.webp$/);

      createdFiles.push(path.join(testUploadDir, resJpeg.fileName));
      createdFiles.push(path.join(testUploadDir, resWebp.fileName));
    });

    it('ném lỗi InvalidFileTypeError nếu định dạng file không được hỗ trợ (vd: image/gif, pdf)', async () => {
      const gifBuf = Buffer.from('fake-gif');
      await expect(storage.saveFile(gifBuf, 'image/gif', 'test.gif')).rejects.toThrowError(
        InvalidFileTypeError
      );

      const pdfBuf = Buffer.from('fake-pdf');
      await expect(storage.saveFile(pdfBuf, 'application/pdf', 'doc.pdf')).rejects.toThrowError(
        InvalidFileTypeError
      );
    });

    it('ném lỗi FileTooLargeError nếu dung lượng file vượt quá 5MB', async () => {
      // 5MB + 1 byte
      const bigBuf = Buffer.alloc(5 * 1024 * 1024 + 1);
      await expect(storage.saveFile(bigBuf, 'image/png', 'huge.png')).rejects.toThrowError(
        FileTooLargeError
      );
    });
  });

  describe('InMemoryTaskClaimRepository & Submit Atomic', () => {
    let repo: InMemoryTaskClaimRepository;
    const baseTime = new Date('2026-11-23T10:00:00.000Z');

    beforeEach(() => {
      repo = new InMemoryTaskClaimRepository();
    });

    it('submitAtomic nộp bài thành công và chuyển trạng thái sang SUBMITTED', async () => {
      const claim = TaskClaim.create({
        taskId: 'task-100',
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await repo.save(claim);

      const submitTime = new Date('2026-11-23T10:30:00.000Z');
      const proofs = [
        SubmittedProofItem.create({
          requirementId: 'req-01',
          proofType: 'SCREENSHOT_IMAGE',
          value: '/uploads/proofs/test.png',
        }),
      ];

      const submitted = await repo.submitAtomic(claim.id, 'worker-01', proofs, submitTime);

      expect(submitted.status.isSubmitted()).toBe(true);
      expect(submitted.submittedAt).toEqual(submitTime);
      expect(submitted.getSubmittedProofs()).toHaveLength(1);
      expect(submitted.getSubmittedProofs()[0].value).toBe('/uploads/proofs/test.png');

      // Kiểm tra countSubmittedClaims
      const submittedCount = await repo.countSubmittedClaims('task-100');
      expect(submittedCount).toBe(1);
    });

    it('submitAtomic từ chối nếu không phải workerId sở hữu (ForbiddenNotClaimOwnerError)', async () => {
      const claim = TaskClaim.create({
        taskId: 'task-100',
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await repo.save(claim);

      await expect(
        repo.submitAtomic(claim.id, 'worker-imposter', [], new Date('2026-11-23T10:15:00.000Z'))
      ).rejects.toThrowError(ForbiddenNotClaimOwnerError);
    });

    it('submitAtomic từ chối nếu slot đã hết hạn (ClaimExpiredError)', async () => {
      const claim = TaskClaim.create({
        taskId: 'task-100',
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await repo.save(claim);

      const expiredTime = new Date('2026-11-23T11:00:01.000Z');
      await expect(
        repo.submitAtomic(claim.id, 'worker-01', [], expiredTime)
      ).rejects.toThrowError(ClaimExpiredError);

      const updated = await repo.findById(claim.id);
      expect(updated?.status.isExpired()).toBe(true);
    });

    it('submitAtomic từ chối nếu lượt nhận việc không ở trạng thái IN_PROGRESS (ClaimNotInProgressError)', async () => {
      const claim = TaskClaim.create({
        taskId: 'task-100',
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await repo.save(claim);

      // Submit lần 1
      await repo.submitAtomic(claim.id, 'worker-01', [], new Date('2026-11-23T10:10:00.000Z'));

      // Submit lần 2
      await expect(
        repo.submitAtomic(claim.id, 'worker-01', [], new Date('2026-11-23T10:15:00.000Z'))
      ).rejects.toThrowError(ClaimNotInProgressError);
    });
  });

  describe('LiveTaskProgressAdapter & Quota Preservation', () => {
    let repo: InMemoryTaskClaimRepository;
    let adapter: LiveTaskProgressAdapter;
    let currentTime: Date;
    const baseTime = new Date('2026-11-23T10:00:00.000Z');

    beforeEach(() => {
      currentTime = baseTime;
      repo = new InMemoryTaskClaimRepository();
      adapter = new LiveTaskProgressAdapter(repo, () => currentTime);
    });

    it('bảo toàn quota: cả slot IN_PROGRESS và SUBMITTED đều được tính vào in_progress_count', async () => {
      const claim1 = TaskClaim.create({
        taskId: 'task-quota',
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      const claim2 = TaskClaim.create({
        taskId: 'task-quota',
        workerId: 'worker-02',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await repo.save(claim1);
      await repo.save(claim2);

      // Trước khi submit: 2 active
      let progress = await adapter.getProgress('task-quota');
      expect(progress.in_progress_count).toBe(2);
      expect(progress.submitted_count).toBe(0);

      // Worker 1 submit bài
      currentTime = new Date('2026-11-23T10:20:00.000Z');
      await repo.submitAtomic(claim1.id, 'worker-01', [], currentTime);

      // Sau khi submit: active = 1, submitted = 1 => in_progress_count vẫn là 2!
      progress = await adapter.getProgress('task-quota');
      expect(progress.in_progress_count).toBe(2);
      expect(progress.submitted_count).toBe(1);
    });
  });
});
