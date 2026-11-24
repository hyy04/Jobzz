import { describe, it, expect, beforeEach } from 'vitest';
import { ListSubmittedClaimsUseCase } from '../../../src/usecase/list-submitted-claims.usecase';
import { GetSubmissionDetailsUseCase } from '../../../src/usecase/get-submission-details.usecase';
import { InMemoryTaskClaimRepository } from '../../../src/infra/repositories/in-memory-task-claim.repository';
import { InMemoryTaskRepository } from '../../../src/infra/repositories/in-memory-task.repository';
import { FreelanceTask } from '../../../src/domain/entities/freelance-task.entity';
import { TaskClaim } from '../../../src/domain/entities/task-claim.entity';
import { SubmittedProofItem } from '../../../src/domain/value-objects/submitted-proof.vo';
import { RewardCoins } from '../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../src/domain/value-objects/proof-requirement.vo';
import { SubmissionNotFoundError } from '../../../src/shared/errors/claim-errors';

describe('Admin Submission Inquiry Use Cases (T003-RTS)', () => {
  let claimRepo: InMemoryTaskClaimRepository;
  let taskRepo: InMemoryTaskRepository;
  let listUseCase: ListSubmittedClaimsUseCase;
  let getDetailsUseCase: GetSubmissionDetailsUseCase;

  beforeEach(() => {
    claimRepo = new InMemoryTaskClaimRepository();
    taskRepo = new InMemoryTaskRepository(false);
    listUseCase = new ListSubmittedClaimsUseCase(claimRepo, taskRepo);
    getDetailsUseCase = new GetSubmissionDetailsUseCase(claimRepo, taskRepo);
  });

  const createSampleTask = async (id: string, title: string, rewardCoins: number) => {
    const task = FreelanceTask.createDraft({
      id,
      creatorId: 'employer-01',
      title,
      description: 'Mô tả công việc chi tiết',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(rewardCoins),
      quota: Quota.create(10),
      steps: [StepInstruction.create(1, 'Làm theo hướng dẫn')],
      proofRequirements: [
        ProofRequirement.create({
          id: 'req-1',
          title: 'Ảnh bằng chứng',
          description: 'Chụp ảnh màn hình hoàn thành',
          proofType: 'SCREENSHOT_IMAGE',
          isRequired: true,
        }),
        ProofRequirement.create({
          id: 'req-2',
          title: 'Mã GD',
          description: 'Nhập mã giao dịch',
          proofType: 'TEXT',
          isRequired: false,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
    });
    task.publish();
    await taskRepo.save(task);
    return task;
  };

  describe('ListSubmittedClaimsUseCase', () => {
    it('trả về danh sách bài nộp có phân trang, lọc taskId và đầy đủ metadata task', async () => {
      await createSampleTask('task-1', 'Thả tim Facebook', 250);
      await createSampleTask('task-2', 'Theo dõi Tiktok', 500);

      const claim1 = TaskClaim.create({ taskId: 'task-1', workerId: 'worker-A', executionTimeMinutes: 60 });
      claim1.submit([
        SubmittedProofItem.create({ requirementId: 'req-1', proofType: 'SCREENSHOT_IMAGE', value: 'https://example.com/p1.png' }),
      ], new Date('2026-11-23T08:00:00Z'));
      await claimRepo.save(claim1);

      const claim2 = TaskClaim.create({ taskId: 'task-2', workerId: 'worker-B', executionTimeMinutes: 60 });
      claim2.submit([
        SubmittedProofItem.create({ requirementId: 'req-1', proofType: 'SCREENSHOT_IMAGE', value: 'https://example.com/p2.png' }),
      ], new Date('2026-11-23T09:00:00Z'));
      await claimRepo.save(claim2);

      // Lấy toàn bộ
      const result = await listUseCase.execute({ page: 1, limit: 10 });
      expect(result.pagination.total).toBe(2);
      expect(result.items.length).toBe(2);
      expect(result.items[0].task_title).toBe('Thả tim Facebook');
      expect(result.items[0].reward_coins).toBe(250);
      expect(result.items[0].proofs_count).toBe(1);

      // Lọc theo task-2
      const filtered = await listUseCase.execute({ taskId: 'task-2' });
      expect(filtered.pagination.total).toBe(1);
      expect(filtered.items[0].task_id).toBe('task-2');
      expect(filtered.items[0].task_title).toBe('Theo dõi Tiktok');
    });

    it('trả về rỗng khi không có bài nộp nào ở trạng thái SUBMITTED', async () => {
      const result = await listUseCase.execute({ page: 1, limit: 10 });
      expect(result.items).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.total_pages).toBe(0);
    });
  });

  describe('GetSubmissionDetailsUseCase', () => {
    it('trả về đầy đủ chi tiết bài nộp và map mô tả yêu cầu bằng chứng', async () => {
      await createSampleTask('task-1', 'Thả tim Facebook', 250);

      const claim = TaskClaim.create({ taskId: 'task-1', workerId: 'worker-A', executionTimeMinutes: 60 });
      claim.submit([
        SubmittedProofItem.create({ requirementId: 'req-1', proofType: 'SCREENSHOT_IMAGE', value: 'https://example.com/p1.png' }),
        SubmittedProofItem.create({ requirementId: 'req-2', proofType: 'TEXT', value: 'GD-99887766' }),
      ], new Date('2026-11-23T08:00:00Z'));
      await claimRepo.save(claim);

      const details = await getDetailsUseCase.execute({ claimId: claim.id });
      expect(details.claim_id).toBe(claim.id);
      expect(details.task_title).toBe('Thả tim Facebook');
      expect(details.reward_coins).toBe(250);
      expect(details.submitted_proofs.length).toBe(2);
      expect(details.submitted_proofs[0].description).toBe('Chụp ảnh màn hình hoàn thành');
      expect(details.submitted_proofs[1].description).toBe('Nhập mã giao dịch');
      expect(details.submitted_proofs[1].value).toBe('GD-99887766');
    });

    it('ném lỗi SubmissionNotFoundError khi claimId không tồn tại', async () => {
      await expect(getDetailsUseCase.execute({ claimId: 'non-existing-id' }))
        .rejects.toThrow(SubmissionNotFoundError);
    });
  });
});
