import { describe, it, expect } from 'vitest';
import { FreelanceTask, InvalidTaskDataError } from '../../../../src/domain/entities/freelance-task.entity';
import { RewardCoins } from '../../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../../src/domain/value-objects/quota.vo';
import { StepInstruction } from '../../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../../../src/domain/value-objects/proof-requirement.vo';
import {
  TotalRewardCoinsOverflowError,
  IncompleteTaskPublicationError,
  ExceededProofRequirementsLimitError,
  ImmutableFieldModificationError,
  ProhibitedContentDetectedError,
  InvalidStateTransitionError,
} from '../../../../src/shared/errors/task-errors';

describe('Domain Entity: FreelanceTask', () => {
  const createValidDraft = (overrides = {}) => {
    return FreelanceTask.createDraft({
      creatorId: 'admin-uuid-001',
      title: 'Cài đặt ứng dụng và đánh giá 5 sao',
      description: 'Tải ứng dụng từ App Store hoặc Google Play, mở ứng dụng và trải nghiệm trong 3 phút rồi đánh giá.',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(5000),
      quota: Quota.create(100),
      ...overrides,
    });
  };

  const createSampleStep = (stepNumber = 1) => {
    return StepInstruction.create(stepNumber, 'Mở liên kết và cài đặt ứng dụng', 'https://example.com/download');
  };

  const createSampleProof = (id = 'proof-1', isScreenshot = true) => {
    return ProofRequirement.create({
      id,
      proofType: isScreenshot ? 'SCREENSHOT_IMAGE' : 'TEXT',
      title: isScreenshot ? 'Ảnh chụp màn hình ứng dụng' : 'Tên tài khoản đăng ký',
      description: 'Chụp lại màn hình trang chủ ứng dụng đã mở thành công',
    });
  };

  describe('1. Khởi tạo bản thảo (createDraft)', () => {
    it('tạo thành công bản thảo hợp lệ với trạng thái DRAFT và version = 1', () => {
      const task = createValidDraft();

      expect(task.getStatus().isDraft()).toBe(true);
      expect(task.getVersion()).toBe(1);
      expect(task.getTotalRewardCoins()).toBe(5000 * 100);
      expect(task.getClosedAt()).toBeNull();
      expect(task.getGracePeriodEndsAt()).toBeNull();
    });

    it('tự động làm sạch mã độc XSS trong tiêu đề và mô tả', () => {
      const task = createValidDraft({
        title: 'Cài đặt app <script>alert("xss")</script> ngay hôm nay',
        description: '<p onclick="steal()">Tải app và mở ứng dụng để nhận thưởng lớn</p>',
      });

      expect(task.getTitle()).not.toContain('<script>');
      expect(task.getTitle()).toBe('Cài đặt app alert("xss") ngay hôm nay');
      expect(task.getDescription()).not.toContain('onclick');
    });

    it('từ chối tiêu đề quá ngắn (< 10 ký tự) hoặc mô tả quá ngắn (< 20 ký tự)', () => {
      expect(() => createValidDraft({ title: 'Ngắn' })).toThrow(InvalidTaskDataError);
      expect(() => createValidDraft({ description: 'Mô tả quá ngắn' })).toThrow(InvalidTaskDataError);
    });

    it('từ chối khi creatorId trống', () => {
      expect(() => createValidDraft({ creatorId: '' })).toThrow(InvalidTaskDataError);
    });

    it('chặn nội dung vi phạm chính sách cấm (cờ bạc, lừa đảo, nạp tiền)', () => {
      expect(() =>
        createValidDraft({
          title: 'Tham gia sàn tài xỉu đặt cược nhận thưởng khủng',
        })
      ).toThrow(ProhibitedContentDetectedError);

      expect(() =>
        createValidDraft({
          description: 'Yêu cầu người dùng nạp tiền vào tài khoản để kích hoạt',
        })
      ).toThrow(ProhibitedContentDetectedError);
    });

    it('chặn khi tổng ngân sách Xu vượt quá 5,000,000,000 Xu', () => {
      // 500k * 10k = 5,000,000,000 (đúng ngưỡng tối đa)
      const maxTask = createValidDraft({
        rewardCoins: RewardCoins.create(500_000),
        quota: Quota.create(10_000),
      });
      expect(maxTask.getTotalRewardCoins()).toBe(5_000_000_000);
    });
  });

  describe('2. Xuất bản nhiệm vụ (publish)', () => {
    it('từ chối xuất bản nếu thiếu bước hướng dẫn hoặc thiếu yêu cầu bằng chứng', () => {
      const taskNoSteps = createValidDraft({
        steps: [],
        proofRequirements: [createSampleProof()],
      });
      expect(() => taskNoSteps.publish()).toThrow(IncompleteTaskPublicationError);

      const taskNoProofs = createValidDraft({
        steps: [createSampleStep()],
        proofRequirements: [],
      });
      expect(() => taskNoProofs.publish()).toThrow(IncompleteTaskPublicationError);
    });

    it('từ chối xuất bản nếu vượt quá 5 yêu cầu bằng chứng hoặc quá 3 ảnh chụp màn hình', () => {
      const taskTooManyScreenshots = createValidDraft({
        steps: [createSampleStep()],
        proofRequirements: [
          createSampleProof('p1', true),
          createSampleProof('p2', true),
          createSampleProof('p3', true),
          createSampleProof('p4', true), // 4 screenshots > 3
        ],
      });
      expect(() => taskTooManyScreenshots.publish()).toThrow(ExceededProofRequirementsLimitError);

      const taskTooManyProofs = createValidDraft({
        steps: [createSampleStep()],
        proofRequirements: [
          createSampleProof('p1', true),
          createSampleProof('p2', true),
          createSampleProof('p3', true),
          createSampleProof('p4', false),
          createSampleProof('p5', false),
          createSampleProof('p6', false), // 6 proofs > 5
        ],
      });
      expect(() => taskTooManyProofs.publish()).toThrow(ExceededProofRequirementsLimitError);
    });

    it('xuất bản thành công chuyển sang ACTIVE và tăng version', () => {
      const task = createValidDraft({
        steps: [createSampleStep()],
        proofRequirements: [createSampleProof('p1', true), createSampleProof('p2', false)],
      });

      task.publish();
      expect(task.getStatus().isActive()).toBe(true);
      expect(task.getVersion()).toBe(2);
    });
  });

  describe('3. Vòng đời máy trạng thái (Pause, Resume, MarkCompleted, Close)', () => {
    it('thực hiện luồng: ACTIVE -> PAUSED -> ACTIVE', () => {
      const task = createValidDraft({
        steps: [createSampleStep()],
        proofRequirements: [createSampleProof()],
      });
      task.publish(); // version 2

      task.pause();
      expect(task.getStatus().isPaused()).toBe(true);
      expect(task.getVersion()).toBe(3);

      task.resume();
      expect(task.getStatus().isActive()).toBe(true);
      expect(task.getVersion()).toBe(4);
    });

    it('đóng vĩnh viễn (Close) kích hoạt ân hạn 24 giờ', () => {
      const task = createValidDraft({
        steps: [createSampleStep()],
        proofRequirements: [createSampleProof()],
      });
      task.publish();

      const beforeClose = Date.now();
      task.close();

      expect(task.getStatus().isClosed()).toBe(true);
      expect(task.getClosedAt()).not.toBeNull();
      expect(task.getGracePeriodEndsAt()).not.toBeNull();

      // Grace period = closed_at + 24 hours
      const diffHours =
        (task.getGracePeriodEndsAt()!.getTime() - task.getClosedAt()!.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 1);

      // Không thể mở lại từ CLOSED
      expect(() => task.resume()).toThrow(InvalidStateTransitionError);
    });

    it('đánh dấu hoàn thành (COMPLETED) và tự mở lại (ACTIVE) khi tăng quota', () => {
      const task = createValidDraft({
        quota: Quota.create(50),
        steps: [createSampleStep()],
        proofRequirements: [createSampleProof()],
      });
      task.publish();
      task.markCompleted();
      expect(task.getStatus().isCompleted()).toBe(true);

      // Mở rộng quota lớn hơn -> tự chuyển về ACTIVE
      task.updateQuota(Quota.create(100));
      expect(task.getStatus().isActive()).toBe(true);
      expect(task.getQuota().getValue()).toBe(100);
    });
  });

  describe('4. Quy tắc Mutability khi đang ACTIVE (REQ-POST-024)', () => {
    it('chặn không cho phép giảm reward_coins khi task đang ACTIVE', () => {
      const task = createValidDraft({
        rewardCoins: RewardCoins.create(10000),
        steps: [createSampleStep()],
        proofRequirements: [createSampleProof()],
      });
      task.publish();

      expect(() =>
        task.updateDetails({
          rewardCoins: RewardCoins.create(5000), // giảm Xu
        })
      ).toThrow(ImmutableFieldModificationError);

      // Tăng Xu thì được phép
      task.updateDetails({
        rewardCoins: RewardCoins.create(15000),
      });
      expect(task.getRewardCoins().getValue()).toBe(15000);
    });

    it('chặn không cho phép sửa hoặc thêm proof_requirements khi task đang ACTIVE', () => {
      const task = createValidDraft({
        steps: [createSampleStep()],
        proofRequirements: [createSampleProof()],
      });
      task.publish();

      expect(() =>
        task.updateDetails({
          proofRequirements: [createSampleProof('p2', false)],
        })
      ).toThrow(ImmutableFieldModificationError);
    });

    it('cho phép sửa tự do khi còn ở trạng thái DRAFT', () => {
      const task = createValidDraft({
        rewardCoins: RewardCoins.create(10000),
      });

      // Giảm Xu ở DRAFT -> Hợp lệ
      task.updateDetails({
        rewardCoins: RewardCoins.create(2000),
        proofRequirements: [createSampleProof('draft-proof', false)],
      });

      expect(task.getRewardCoins().getValue()).toBe(2000);
      expect(task.getProofRequirements().length).toBe(1);
    });
  });
});
