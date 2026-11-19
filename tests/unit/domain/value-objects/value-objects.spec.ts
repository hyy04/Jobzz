import { describe, it, expect } from 'vitest';
import { RewardCoins } from '../../../../src/domain/value-objects/reward-coins.vo';
import { Quota } from '../../../../src/domain/value-objects/quota.vo';
import { SecureUrl } from '../../../../src/domain/value-objects/secure-url.vo';
import { TaskStatus } from '../../../../src/domain/value-objects/task-status.vo';
import { StepInstruction, InvalidStepInstructionError } from '../../../../src/domain/value-objects/step-instruction.vo';
import { ProofRequirement, InvalidProofRequirementError } from '../../../../src/domain/value-objects/proof-requirement.vo';
import { AntiSelfDealingValidator } from '../../../../src/domain/services/anti-self-dealing.validator';
import {
  InvalidRewardCoinsError,
  InvalidQuotaError,
  InsecureUrlError,
  InvalidStateTransitionError,
  SelfDealingForbiddenError,
} from '../../../../src/shared/errors/task-errors';

describe('Domain Value Objects & Domain Services', () => {
  describe('RewardCoins VO', () => {
    it('cho phép tạo với giá trị trong dải [1, 500000]', () => {
      const min = RewardCoins.create(1);
      const normal = RewardCoins.create(1500);
      const max = RewardCoins.create(500000);

      expect(min.getValue()).toBe(1);
      expect(normal.getValue()).toBe(1500);
      expect(max.getValue()).toBe(500000);
    });

    it('từ chối giá trị <= 0, > 500000 hoặc không nguyên', () => {
      expect(() => RewardCoins.create(0)).toThrow(InvalidRewardCoinsError);
      expect(() => RewardCoins.create(-50)).toThrow(InvalidRewardCoinsError);
      expect(() => RewardCoins.create(500001)).toThrow(InvalidRewardCoinsError);
      expect(() => RewardCoins.create(10.5)).toThrow(InvalidRewardCoinsError);
      expect(() => RewardCoins.create(NaN)).toThrow(InvalidRewardCoinsError);
    });

    it('so sánh bằng giữa hai RewardCoins', () => {
      const rc1 = RewardCoins.create(2000);
      const rc2 = RewardCoins.create(2000);
      const rc3 = RewardCoins.create(3000);

      expect(rc1.equals(rc2)).toBe(true);
      expect(rc1.equals(rc3)).toBe(false);
    });
  });

  describe('Quota VO', () => {
    it('cho phép tạo với giá trị trong dải [1, 10000]', () => {
      const min = Quota.create(1);
      const normal = Quota.create(500);
      const max = Quota.create(10000);

      expect(min.getValue()).toBe(1);
      expect(normal.getValue()).toBe(500);
      expect(max.getValue()).toBe(10000);
    });

    it('từ chối giá trị <= 0, > 10000 hoặc số thập phân', () => {
      expect(() => Quota.create(0)).toThrow(InvalidQuotaError);
      expect(() => Quota.create(-1)).toThrow(InvalidQuotaError);
      expect(() => Quota.create(10001)).toThrow(InvalidQuotaError);
      expect(() => Quota.create(4.2)).toThrow(InvalidQuotaError);
    });
  });

  describe('SecureUrl VO (SEC-01)', () => {
    it('chấp nhận URL bắt đầu bằng https://', () => {
      const url = SecureUrl.create('https://example.com/job/123');
      expect(url.getValue()).toBe('https://example.com/job/123');
    });

    it('chặn hoàn toàn URL giao thức http://, javascript:, data: hoặc không an toàn', () => {
      expect(() => SecureUrl.create('http://insecure.site.com')).toThrow(InsecureUrlError);
      expect(() => SecureUrl.create('javascript:alert(1)')).toThrow(InsecureUrlError);
      expect(() => SecureUrl.create('data:text/html,hack')).toThrow(InsecureUrlError);
      expect(() => SecureUrl.create('ftp://files.org')).toThrow(InsecureUrlError);
      expect(() => SecureUrl.create('')).toThrow(InsecureUrlError);
      expect(() => SecureUrl.create('invalid-url-string')).toThrow(InsecureUrlError);
    });
  });

  describe('TaskStatus VO & State Machine', () => {
    it('cho phép các chuyển đổi trạng thái hợp lệ', () => {
      const draft = TaskStatus.DRAFT;
      expect(draft.canTransitionTo(TaskStatus.ACTIVE)).toBe(true);

      const active = TaskStatus.ACTIVE;
      expect(active.canTransitionTo(TaskStatus.PAUSED)).toBe(true);
      expect(active.canTransitionTo(TaskStatus.COMPLETED)).toBe(true);
      expect(active.canTransitionTo(TaskStatus.CLOSED)).toBe(true);

      const paused = TaskStatus.PAUSED;
      expect(paused.canTransitionTo(TaskStatus.ACTIVE)).toBe(true);
      expect(paused.canTransitionTo(TaskStatus.CLOSED)).toBe(true);

      const completed = TaskStatus.COMPLETED;
      expect(completed.canTransitionTo(TaskStatus.CLOSED)).toBe(true);
    });

    it('chặn các chuyển đổi trạng thái bất hợp lệ', () => {
      const draft = TaskStatus.DRAFT;
      expect(draft.canTransitionTo(TaskStatus.PAUSED)).toBe(false);
      expect(draft.canTransitionTo(TaskStatus.COMPLETED)).toBe(false);

      const closed = TaskStatus.CLOSED;
      expect(closed.canTransitionTo(TaskStatus.ACTIVE)).toBe(false);
      expect(closed.canTransitionTo(TaskStatus.DRAFT)).toBe(false);

      expect(() => closed.ensureCanTransitionTo(TaskStatus.ACTIVE)).toThrow(InvalidStateTransitionError);
    });

    it('hỗ trợ chuyển đổi từ chuỗi string hợp lệ', () => {
      expect(TaskStatus.fromString('active')).toBe(TaskStatus.ACTIVE);
      expect(TaskStatus.fromString('DRAFT')).toBe(TaskStatus.DRAFT);
      expect(() => TaskStatus.fromString('UNKNOWN')).toThrow(InvalidStateTransitionError);
    });
  });

  describe('StepInstruction VO', () => {
    it('tạo thành công bước hướng dẫn hợp lệ có https:// URL', () => {
      const step = StepInstruction.create(1, 'Truy cập vào liên kết và đăng ký tài khoản', 'https://example.com/signup');
      expect(step.getStepNumber()).toBe(1);
      expect(step.getInstruction()).toBe('Truy cập vào liên kết và đăng ký tài khoản');
      expect(step.getTargetUrl()).toBe('https://example.com/signup');
      expect(step.toJSON().target_url).toBe('https://example.com/signup');
    });

    it('tạo thành công bước hướng dẫn không kèm URL', () => {
      const step = StepInstruction.create(2, 'Chụp ảnh màn hình trang xác nhận');
      expect(step.getTargetUrl()).toBeNull();
    });

    it('từ chối bước có URL không an toàn hoặc độ dài không hợp lệ', () => {
      expect(() => StepInstruction.create(1, 'Quá ngắn', 'https://test.com')).toThrow(InvalidStepInstructionError);
      expect(() => StepInstruction.create(0, 'Nội dung hướng dẫn đủ dài nhưng step = 0')).toThrow(InvalidStepInstructionError);
      expect(() => StepInstruction.create(1, 'Nội dung hướng dẫn hợp lệ', 'http://unsafe.org')).toThrow(InsecureUrlError);
    });
  });

  describe('ProofRequirement VO', () => {
    it('tạo yêu cầu bằng chứng ảnh chụp màn hình hợp lệ', () => {
      const proof = ProofRequirement.create({
        id: 'proof-1',
        proofType: 'SCREENSHOT_IMAGE',
        title: 'Ảnh chụp màn hình trang cá nhân',
        description: 'Chụp rõ tên người dùng và ảnh đại diện sau khi hoàn thành đăng ký',
        isRequired: true,
      });

      expect(proof.isScreenshot()).toBe(true);
      expect(proof.isRequiredProof()).toBe(true);
      expect(proof.getTitle()).toBe('Ảnh chụp màn hình trang cá nhân');
    });

    it('tạo yêu cầu bằng chứng văn bản hợp lệ', () => {
      const proof = ProofRequirement.create({
        id: 'proof-2',
        proofType: 'TEXT',
        title: 'Mã số giao dịch',
        description: 'Nhập chính xác mã giao dịch được cấp trên hệ thống',
        isRequired: false,
      });

      expect(proof.isScreenshot()).toBe(false);
      expect(proof.isRequiredProof()).toBe(false);
    });

    it('từ chối kiểu bằng chứng không hợp lệ hoặc nội dung sai kích thước', () => {
      expect(() =>
        ProofRequirement.create({
          id: 'p3',
          // @ts-expect-error invalid type
          proofType: 'VIDEO',
          title: 'Tiêu đề hợp lệ',
          description: 'Mô tả hợp lệ cho bằng chứng',
        })
      ).toThrow(InvalidProofRequirementError);

      expect(() =>
        ProofRequirement.create({
          id: 'p4',
          proofType: 'TEXT',
          title: 'Ngắn',
          description: 'Mô tả hợp lệ',
        })
      ).toThrow(InvalidProofRequirementError);
    });
  });

  describe('AntiSelfDealingValidator (REQ-POST-026, REQ-POST-027)', () => {
    it('ném lỗi SelfDealingForbiddenError nếu worker_id trùng creator_id', () => {
      const creatorId = 'admin-user-001';
      const workerId = 'admin-user-001';

      expect(() => AntiSelfDealingValidator.validate(creatorId, workerId)).toThrow(SelfDealingForbiddenError);
      expect(AntiSelfDealingValidator.isSelfDealing(creatorId, workerId)).toBe(true);
    });

    it('cho phép nếu worker_id khác creator_id', () => {
      const creatorId = 'admin-user-001';
      const workerId = 'worker-user-999';

      expect(() => AntiSelfDealingValidator.validate(creatorId, workerId)).not.toThrow();
      expect(AntiSelfDealingValidator.isSelfDealing(creatorId, workerId)).toBe(false);
    });

    it('bỏ qua an toàn khi thiếu tham số', () => {
      expect(() => AntiSelfDealingValidator.validate('', 'worker-1')).not.toThrow();
      expect(AntiSelfDealingValidator.isSelfDealing('', 'worker-1')).toBe(false);
    });
  });
});

