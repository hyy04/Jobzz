import { RewardCoins } from '../value-objects/reward-coins.vo';
import { Quota } from '../value-objects/quota.vo';
import { TaskStatus } from '../value-objects/task-status.vo';
import { StepInstruction } from '../value-objects/step-instruction.vo';
import { ProofRequirement } from '../value-objects/proof-requirement.vo';
import { XssSanitizer } from '../../shared/utils/xss-sanitizer';
import {
  TotalRewardCoinsOverflowError,
  IncompleteTaskPublicationError,
  ExceededProofRequirementsLimitError,
  ImmutableFieldModificationError,
  ProhibitedContentDetectedError,
} from '../../shared/errors/task-errors';
import { DomainError } from '../../shared/errors/domain.error';

export type TaskCategory =
  | 'APP_INSTALL'
  | 'ACCOUNT_REGISTRATION'
  | 'SOCIAL_INTERACTION'
  | 'REVIEW_RATING'
  | 'SURVEY'
  | 'CONTENT_WRITING'
  | 'OTHER';

export class InvalidTaskDataError extends DomainError {
  readonly errorCode = 'INVALID_TASK_DATA';
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
  }
}

export interface CreateTaskProps {
  id?: string;
  creatorId: string;
  title: string;
  description: string;
  category: TaskCategory;
  rewardCoins: RewardCoins;
  quota: Quota;
  steps?: StepInstruction[];
  proofRequirements?: ProofRequirement[];
  executionTimeMinutes?: number;
  autoApprovalDays?: number;
}

export interface ReconstituteTaskProps {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  category: TaskCategory;
  rewardCoins: RewardCoins;
  quota: Quota;
  totalRewardCoins: number;
  steps: StepInstruction[];
  proofRequirements: ProofRequirement[];
  executionTimeMinutes: number;
  autoApprovalDays: number;
  status: TaskStatus;
  version: number;
  closedAt: Date | null;
  gracePeriodEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PROHIBITED_KEYWORDS = [
  'nạp tiền',
  'cờ bạc',
  'lừa đảo',
  'hack',
  'mã độc',
  'gửi mã otp',
  'khiêu dâm',
  'tài xỉu',
  'đặt cược',
  'lô đề',
];

/**
 * Aggregate Root: FreelanceTask
 * Quản lý vòng đời và toàn bộ bất biến nghiệp vụ của nhiệm vụ Freelance vi mô
 * @ears .sdd/features/post-job/SPEC.md
 */
export class FreelanceTask {
  public static readonly MAX_TOTAL_REWARD_COINS = 5_000_000_000;
  public static readonly GRACE_PERIOD_HOURS = 24;

  private constructor(
    private readonly id: string,
    private readonly creatorId: string,
    private title: string,
    private description: string,
    private category: TaskCategory,
    private rewardCoins: RewardCoins,
    private quota: Quota,
    private totalRewardCoins: number,
    private steps: StepInstruction[],
    private proofRequirements: ProofRequirement[],
    private executionTimeMinutes: number,
    private autoApprovalDays: number,
    private status: TaskStatus,
    private version: number,
    private closedAt: Date | null,
    private gracePeriodEndsAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  /**
   * Tạo bản thảo nhiệm vụ mới (DRAFT)
   */
  public static createDraft(props: CreateTaskProps): FreelanceTask {
    const id = props.id || crypto.randomUUID();
    const creatorId = props.creatorId;

    if (!creatorId || creatorId.trim().length === 0) {
      throw new InvalidTaskDataError('creator_id không được để trống.');
    }

    const title = XssSanitizer.sanitize(props.title || '');
    if (title.length < 10 || title.length > 150) {
      throw new InvalidTaskDataError('Tiêu đề nhiệm vụ phải từ 10 đến 150 ký tự.');
    }

    const description = XssSanitizer.sanitize(props.description || '');
    if (description.length < 20 || description.length > 5000) {
      throw new InvalidTaskDataError('Mô tả nhiệm vụ phải từ 20 đến 5,000 ký tự.');
    }

    FreelanceTask.checkProhibitedContent(`${title} ${description}`);

    const executionTimeMinutes = props.executionTimeMinutes ?? 60;
    if (executionTimeMinutes < 15 || executionTimeMinutes > 1440) {
      throw new InvalidTaskDataError('Thời gian thực hiện phải từ 15 đến 1,440 phút (24 giờ).');
    }

    const autoApprovalDays = props.autoApprovalDays ?? 3;
    if (autoApprovalDays < 1 || autoApprovalDays > 7) {
      throw new InvalidTaskDataError('Thời hạn tự động duyệt phải từ 1 đến 7 ngày.');
    }

    const totalCoins = props.rewardCoins.getValue() * props.quota.getValue();
    if (totalCoins > FreelanceTask.MAX_TOTAL_REWARD_COINS) {
      throw new TotalRewardCoinsOverflowError();
    }

    const steps = props.steps ?? [];
    const proofRequirements = props.proofRequirements ?? [];

    // Kiểm tra nội dung các bước nếu có
    for (const step of steps) {
      FreelanceTask.checkProhibitedContent(step.getInstruction());
    }

    const now = new Date();

    return new FreelanceTask(
      id,
      creatorId,
      title,
      description,
      props.category,
      props.rewardCoins,
      props.quota,
      totalCoins,
      steps,
      proofRequirements,
      executionTimeMinutes,
      autoApprovalDays,
      TaskStatus.DRAFT,
      1,
      null,
      null,
      now,
      now
    );
  }

  /**
   * Tái cấu trúc Entity từ database (Reconstitute)
   */
  public static reconstitute(props: ReconstituteTaskProps): FreelanceTask {
    return new FreelanceTask(
      props.id,
      props.creatorId,
      props.title,
      props.description,
      props.category,
      props.rewardCoins,
      props.quota,
      props.totalRewardCoins,
      props.steps,
      props.proofRequirements,
      props.executionTimeMinutes,
      props.autoApprovalDays,
      props.status,
      props.version,
      props.closedAt,
      props.gracePeriodEndsAt,
      props.createdAt,
      props.updatedAt
    );
  }

  /**
   * Xuất bản nhiệm vụ sang trạng thái ACTIVE (REQ-POST-010..012)
   */
  public publish(): void {
    this.status.ensureCanTransitionTo(TaskStatus.ACTIVE);

    if (this.steps.length === 0 || this.proofRequirements.length === 0) {
      throw new IncompleteTaskPublicationError();
    }

    if (this.proofRequirements.length > 5) {
      throw new ExceededProofRequirementsLimitError('Nhiệm vụ chỉ được phép có tối đa 5 yêu cầu bằng chứng.');
    }

    const screenshotCount = this.proofRequirements.filter((p) => p.isScreenshot()).length;
    if (screenshotCount > 3) {
      throw new ExceededProofRequirementsLimitError('Nhiệm vụ chỉ được phép có tối đa 3 yêu cầu bằng chứng ảnh chụp màn hình.');
    }

    this.status = TaskStatus.ACTIVE;
    this.version += 1;
    this.updatedAt = new Date();
  }

  /**
   * Tạm dừng nhiệm vụ (REQ-POST-014)
   */
  public pause(): void {
    this.status.ensureCanTransitionTo(TaskStatus.PAUSED);
    this.status = TaskStatus.PAUSED;
    this.version += 1;
    this.updatedAt = new Date();
  }

  /**
   * Mở lại nhiệm vụ từ tạm dừng (REQ-POST-015)
   */
  public resume(): void {
    this.status.ensureCanTransitionTo(TaskStatus.ACTIVE);
    this.status = TaskStatus.ACTIVE;
    this.version += 1;
    this.updatedAt = new Date();
  }

  /**
   * Đánh dấu hoàn thành khi đủ quota (REQ-POST-016)
   */
  public markCompleted(): void {
    this.status.ensureCanTransitionTo(TaskStatus.COMPLETED);
    this.status = TaskStatus.COMPLETED;
    this.version += 1;
    this.updatedAt = new Date();
  }

  /**
   * Đóng vĩnh viễn nhiệm vụ với thời hạn ân hạn 24 giờ (REQ-POST-018, REQ-POST-019)
   */
  public close(): void {
    this.status.ensureCanTransitionTo(TaskStatus.CLOSED);
    const now = new Date();
    this.status = TaskStatus.CLOSED;
    this.closedAt = now;
    this.gracePeriodEndsAt = new Date(now.getTime() + FreelanceTask.GRACE_PERIOD_HOURS * 60 * 60 * 1000);
    this.version += 1;
    this.updatedAt = now;
  }

  /**
   * Cập nhật Quota (REQ-POST-017)
   */
  public updateQuota(newQuota: Quota): void {
    const totalCoins = this.rewardCoins.getValue() * newQuota.getValue();
    if (totalCoins > FreelanceTask.MAX_TOTAL_REWARD_COINS) {
      throw new TotalRewardCoinsOverflowError();
    }

    if (this.status.isCompleted()) {
      if (newQuota.getValue() > this.quota.getValue()) {
        this.status.ensureCanTransitionTo(TaskStatus.ACTIVE, { isQuotaExpanded: true });
        this.status = TaskStatus.ACTIVE;
      }
    }

    this.quota = newQuota;
    this.totalRewardCoins = totalCoins;
    this.version += 1;
    this.updatedAt = new Date();
  }

  /**
   * Cập nhật chi tiết nhiệm vụ (REQ-POST-024: Mutability Rules khi ACTIVE)
   */
  public updateDetails(params: {
    title?: string;
    description?: string;
    category?: TaskCategory;
    rewardCoins?: RewardCoins;
    steps?: StepInstruction[];
    proofRequirements?: ProofRequirement[];
    executionTimeMinutes?: number;
    autoApprovalDays?: number;
  }): void {
    // Kiểm tra quy tắc khi ACTIVE
    if (this.status.isActive()) {
      if (params.rewardCoins && params.rewardCoins.getValue() < this.rewardCoins.getValue()) {
        throw new ImmutableFieldModificationError('Không được phép giảm mức thưởng Xu khi nhiệm vụ đang ACTIVE.');
      }

      if (params.proofRequirements !== undefined) {
        throw new ImmutableFieldModificationError('Không được phép chỉnh sửa hoặc bổ sung tiêu chí bằng chứng khi nhiệm vụ đang ACTIVE.');
      }
    }

    if (params.title) {
      const sanitized = XssSanitizer.sanitize(params.title);
      if (sanitized.length < 10 || sanitized.length > 150) {
        throw new InvalidTaskDataError('Tiêu đề nhiệm vụ phải từ 10 đến 150 ký tự.');
      }
      FreelanceTask.checkProhibitedContent(sanitized);
      this.title = sanitized;
    }

    if (params.description) {
      const sanitized = XssSanitizer.sanitize(params.description);
      if (sanitized.length < 20 || sanitized.length > 5000) {
        throw new InvalidTaskDataError('Mô tả nhiệm vụ phải từ 20 đến 5,000 ký tự.');
      }
      FreelanceTask.checkProhibitedContent(sanitized);
      this.description = sanitized;
    }

    if (params.category) {
      this.category = params.category;
    }

    if (params.rewardCoins) {
      const newTotal = params.rewardCoins.getValue() * this.quota.getValue();
      if (newTotal > FreelanceTask.MAX_TOTAL_REWARD_COINS) {
        throw new TotalRewardCoinsOverflowError();
      }
      this.rewardCoins = params.rewardCoins;
      this.totalRewardCoins = newTotal;
    }

    if (params.steps) {
      if (this.status.isActive() && params.steps.length === 0) {
        throw new IncompleteTaskPublicationError('Nhiệm vụ đang ACTIVE phải có ít nhất 1 bước hướng dẫn.');
      }
      for (const step of params.steps) {
        FreelanceTask.checkProhibitedContent(step.getInstruction());
      }
      this.steps = params.steps;
    }

    if (params.proofRequirements !== undefined && !this.status.isActive()) {
      this.proofRequirements = params.proofRequirements;
    }

    if (params.executionTimeMinutes) {
      if (params.executionTimeMinutes < 15 || params.executionTimeMinutes > 1440) {
        throw new InvalidTaskDataError('Thời gian thực hiện phải từ 15 đến 1,440 phút.');
      }
      this.executionTimeMinutes = params.executionTimeMinutes;
    }

    if (params.autoApprovalDays) {
      if (params.autoApprovalDays < 1 || params.autoApprovalDays > 7) {
        throw new InvalidTaskDataError('Thời hạn tự động duyệt phải từ 1 đến 7 ngày.');
      }
      this.autoApprovalDays = params.autoApprovalDays;
    }

    this.version += 1;
    this.updatedAt = new Date();
  }

  private static checkProhibitedContent(text: string): void {
    const lower = text.toLowerCase();
    for (const keyword of PROHIBITED_KEYWORDS) {
      if (lower.includes(keyword)) {
        throw new ProhibitedContentDetectedError(
          `Phát hiện nội dung vi phạm chính sách cấm: chứa từ khóa "${keyword}".`
        );
      }
    }
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getCreatorId(): string {
    return this.creatorId;
  }

  public getTitle(): string {
    return this.title;
  }

  public getDescription(): string {
    return this.description;
  }

  public getCategory(): TaskCategory {
    return this.category;
  }

  public getRewardCoins(): RewardCoins {
    return this.rewardCoins;
  }

  public getQuota(): Quota {
    return this.quota;
  }

  public getTotalRewardCoins(): number {
    return this.totalRewardCoins;
  }

  public getSteps(): ReadonlyArray<StepInstruction> {
    return this.steps;
  }

  public getProofRequirements(): ReadonlyArray<ProofRequirement> {
    return this.proofRequirements;
  }

  public getExecutionTimeMinutes(): number {
    return this.executionTimeMinutes;
  }

  public getAutoApprovalDays(): number {
    return this.autoApprovalDays;
  }

  public getStatus(): TaskStatus {
    return this.status;
  }

  public getVersion(): number {
    return this.version;
  }

  public getClosedAt(): Date | null {
    return this.closedAt;
  }

  public getGracePeriodEndsAt(): Date | null {
    return this.gracePeriodEndsAt;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

