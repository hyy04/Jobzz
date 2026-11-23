import { describe, it, expect, beforeEach } from 'vitest';
import { UploadProofImageUseCase } from '../../../src/usecase/upload-proof-image.usecase';
import { SubmitTaskProofUseCase } from '../../../src/usecase/submit-task-proof.usecase';
import { GetClaimDetailsUseCase } from '../../../src/usecase/get-claim-details.usecase';
import { LocalStorageAdapter } from '../../../src/infra/storage/local-storage.adapter';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';
import {
  MissingFileError,
  ClaimNotFoundError,
  ForbiddenNotClaimOwnerError,
  ClaimExpiredError,
  ClaimNotInProgressError,
  MissingRequiredProofsError,
  InvalidProofRequirementIdError,
  InvalidProofValueError,
} from '../../../src/shared/errors/claim-errors';

describe('T003-STP Unit: Submit Task Proof UseCases', () => {
  let claimRepo: InMemoryTaskClaimRepository;
  let taskRepo: InMemoryTaskRepository;
  let storage: LocalStorageAdapter;

  let uploadUseCase: UploadProofImageUseCase;
  let submitUseCase: SubmitTaskProofUseCase;
  let getClaimDetailsUseCase: GetClaimDetailsUseCase;

  const baseTime = new Date('2026-11-23T10:00:00.000Z');
  let testTask: FreelanceTask;

  beforeEach(async () => {
    claimRepo = new InMemoryTaskClaimRepository();
    taskRepo = new InMemoryTaskRepository(false);
    storage = new LocalStorageAdapter();

    uploadUseCase = new UploadProofImageUseCase(storage);
    submitUseCase = new SubmitTaskProofUseCase(claimRepo, taskRepo);
    getClaimDetailsUseCase = new GetClaimDetailsUseCase(claimRepo, taskRepo);

    // Tạo nhiệm vụ mẫu với 2 yêu cầu bằng chứng: 1 ảnh (bắt buộc) và 1 text (không bắt buộc)
    testTask = FreelanceTask.createDraft({
      id: 'task-test-01',
      creatorId: 'employer-01',
      title: 'Tải app và đánh giá 5 sao trên App Store',
      description: 'Cần tải app Jobzz, chụp màn hình đánh giá và gửi mã giao dịch',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(500),
      quota: Quota.create(10),
      steps: [
        StepInstruction.create(1, 'Tải ứng dụng từ store'),
        StepInstruction.create(2, 'Đánh giá 5 sao kèm nhận xét'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-screen-01',
          proofType: 'SCREENSHOT_IMAGE',
          title: 'Ảnh chụp màn hình đánh giá',
          description: 'Ảnh rõ nét hiển thị tài khoản của bạn',
          isRequired: true,
        }),
        ProofRequirement.create({
          id: 'req-tx-02',
          proofType: 'TEXT',
          title: 'Mã giới thiệu hoặc username',
          description: 'Nhập username của bạn trên ứng dụng',
          isRequired: false,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    testTask.publish();
    await taskRepo.save(testTask);
  });

  describe('UploadProofImageUseCase', () => {
    it('tải lên ảnh thành công và trả về URL tệp', async () => {
      const buffer = Buffer.from('test-image-binary-data');
      const result = await uploadUseCase.execute({
        fileBuffer: buffer,
        mimeType: 'image/png',
        originalFilename: 'proof.png',
      });

      expect(result.fileUrl).toMatch(/^\/uploads\/proofs\/proof-[a-f0-9-]+\.png$/);
      expect(result.fileSize).toBe(buffer.length);
      expect(result.mimeType).toBe('image/png');
    });

    it('ném lỗi MissingFileError nếu buffer tệp rỗng', async () => {
      await expect(
        uploadUseCase.execute({
          fileBuffer: Buffer.alloc(0),
          mimeType: 'image/png',
        })
      ).rejects.toThrowError(MissingFileError);
    });
  });

  describe('SubmitTaskProofUseCase', () => {
    it('nộp bằng chứng thành công khi nộp đủ 100% bằng chứng bắt buộc và chuyển status SUBMITTED', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      const submitTime = new Date('2026-11-23T10:25:00.000Z');
      const result = await submitUseCase.execute({
        claimId: claim.id,
        workerId: 'worker-01',
        proofs: [
          {
            requirementId: 'req-screen-01',
            value: '/uploads/proofs/screenshot.png',
          },
          {
            requirementId: 'req-tx-02',
            value: 'nguyen_van_a_user',
          },
        ],
        now: submitTime,
      });

      expect(result.status).toBe('SUBMITTED');
      expect(result.submittedAt).toEqual(submitTime);
      expect(result.proofsCount).toBe(2);

      const savedClaim = await claimRepo.findById(claim.id);
      expect(savedClaim?.status.isSubmitted()).toBe(true);
      expect(savedClaim?.getSubmittedProofs()).toHaveLength(2);
    });

    it('tự động làm sạch mã độc XSS trong bằng chứng văn bản TEXT', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      await submitUseCase.execute({
        claimId: claim.id,
        workerId: 'worker-01',
        proofs: [
          {
            requirementId: 'req-screen-01',
            value: '/uploads/proofs/screenshot.png',
          },
          {
            requirementId: 'req-tx-02',
            value: '<script>alert("hacked")</script>username_clean',
          },
        ],
        now: new Date('2026-11-23T10:15:00.000Z'),
      });

      const savedClaim = await claimRepo.findById(claim.id);
      const textProof = savedClaim?.getSubmittedProofs().find((p) => p.requirementId === 'req-tx-02');
      expect(textProof?.value).toContain('username_clean');
      expect(textProof?.value).not.toContain('<script>');
    });

    it('ném lỗi ClaimNotFoundError nếu không tìm thấy claimId', async () => {
      await expect(
        submitUseCase.execute({
          claimId: 'non-existent-claim',
          workerId: 'worker-01',
          proofs: [],
        })
      ).rejects.toThrowError(ClaimNotFoundError);
    });

    it('ném lỗi ForbiddenNotClaimOwnerError nếu người gọi không phải chủ sở hữu slot', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      await expect(
        submitUseCase.execute({
          claimId: claim.id,
          workerId: 'worker-other',
          proofs: [],
        })
      ).rejects.toThrowError(ForbiddenNotClaimOwnerError);
    });

    it('ném lỗi ClaimExpiredError nếu slot đã quá thời gian thực hiện', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      const afterExpired = new Date('2026-11-23T11:00:01.000Z');
      await expect(
        submitUseCase.execute({
          claimId: claim.id,
          workerId: 'worker-01',
          proofs: [
            { requirementId: 'req-screen-01', value: '/uploads/proofs/img.png' },
          ],
          now: afterExpired,
        })
      ).rejects.toThrowError(ClaimExpiredError);

      const updated = await claimRepo.findById(claim.id);
      expect(updated?.status.isExpired()).toBe(true);
    });

    it('ném lỗi ClaimNotInProgressError nếu slot không ở trạng thái IN_PROGRESS', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      // Submit lần 1
      await submitUseCase.execute({
        claimId: claim.id,
        workerId: 'worker-01',
        proofs: [{ requirementId: 'req-screen-01', value: '/uploads/proofs/img.png' }],
        now: new Date('2026-11-23T10:10:00.000Z'),
      });

      // Submit lần 2
      await expect(
        submitUseCase.execute({
          claimId: claim.id,
          workerId: 'worker-01',
          proofs: [{ requirementId: 'req-screen-01', value: '/uploads/proofs/img.png' }],
          now: new Date('2026-11-23T10:15:00.000Z'),
        })
      ).rejects.toThrowError(ClaimNotInProgressError);
    });

    it('ném lỗi InvalidProofRequirementIdError nếu requirementId không thuộc nhiệm vụ', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      await expect(
        submitUseCase.execute({
          claimId: claim.id,
          workerId: 'worker-01',
          proofs: [
            { requirementId: 'req-invalid-id', value: '/uploads/proofs/img.png' },
          ],
          now: new Date('2026-11-23T10:10:00.000Z'),
        })
      ).rejects.toThrowError(InvalidProofRequirementIdError);
    });

    it('ném lỗi MissingRequiredProofsError nếu thiếu bằng chứng bắt buộc is_required === true', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      // Chỉ gửi req-tx-02 (không bắt buộc), thiếu req-screen-01 (bắt buộc)
      await expect(
        submitUseCase.execute({
          claimId: claim.id,
          workerId: 'worker-01',
          proofs: [{ requirementId: 'req-tx-02', value: 'user123' }],
          now: new Date('2026-11-23T10:10:00.000Z'),
        })
      ).rejects.toThrowError(MissingRequiredProofsError);
    });

    it('ném lỗi InvalidProofValueError nếu giá trị ảnh không phải là URL', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      await expect(
        submitUseCase.execute({
          claimId: claim.id,
          workerId: 'worker-01',
          proofs: [{ requirementId: 'req-screen-01', value: 'not-a-valid-url' }],
          now: new Date('2026-11-23T10:10:00.000Z'),
        })
      ).rejects.toThrowError(InvalidProofValueError);
    });
  });

  describe('GetClaimDetailsUseCase', () => {
    it('lấy chi tiết claim thành công kèm thông tin nhiệm vụ và danh sách bằng chứng', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      const details = await getClaimDetailsUseCase.execute({
        claimId: claim.id,
        workerId: 'worker-01',
        now: new Date('2026-11-23T10:10:00.000Z'),
      });

      expect(details.id).toBe(claim.id);
      expect(details.status).toBe('IN_PROGRESS');
      expect(details.remainingSeconds).toBe(50 * 60);
      expect(details.task?.title).toBe(testTask.getTitle());
      expect(details.task?.proofRequirements).toHaveLength(2);
    });

    it('từ chối xem nếu worker không phải người giữ slot', async () => {
      const claim = TaskClaim.create({
        taskId: testTask.getId(),
        workerId: 'worker-01',
        executionTimeMinutes: 60,
        now: baseTime,
      });
      await claimRepo.save(claim);

      await expect(
        getClaimDetailsUseCase.execute({
          claimId: claim.id,
          workerId: 'worker-other',
        })
      ).rejects.toThrowError(ForbiddenNotClaimOwnerError);
    });
  });
});
