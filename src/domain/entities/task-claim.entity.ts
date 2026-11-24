import { ClaimStatus, ClaimStatusType } from '../value-objects/claim-status.vo';
import {
  ClaimAlreadyClosedError,
  ClaimAlreadyReviewedError,
  ClaimNotInSubmittedStatusError,
} from '../../shared/errors/claim-errors';
import { SubmittedProofItem } from '../value-objects/submitted-proof.vo';

export interface CreateTaskClaimProps {
  id?: string;
  taskId: string;
  workerId: string;
  executionTimeMinutes: number;
  now?: Date;
}

export interface ReconstituteTaskClaimProps {
  id: string;
  taskId: string;
  workerId: string;
  status: ClaimStatusType;
  claimedAt: Date;
  expiresAt: Date;
  submittedAt?: Date | null;
  submittedProofs?: SubmittedProofItem[] | any[] | null;
  completedAt?: Date | null;
  reviewerId?: string | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Thực thể quản lý lượt nhận việc giữ chỗ (Task Claim)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#5-mo-hinh-du-lieu-data-model--schema
 * @ears .sdd/features/submit-task-proof/SPEC.md#52-mo-rong-thuc-the-taskclaim--prisma-model
 * @ears .sdd/features/review-task-submission/SPEC.md#52-mo-rong-thuc-the-taskclaim-domain-entity
 */
export class TaskClaim {
  private _id: string;
  private _taskId: string;
  private _workerId: string;
  private _status: ClaimStatus;
  private _claimedAt: Date;
  private _expiresAt: Date;
  private _submittedAt: Date | null;
  private _submittedProofs: SubmittedProofItem[];
  private _completedAt: Date | null;
  private _reviewerId: string | null;
  private _reviewedAt: Date | null;
  private _rejectionReason: string | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: {
    id: string;
    taskId: string;
    workerId: string;
    status: ClaimStatus;
    claimedAt: Date;
    expiresAt: Date;
    submittedAt?: Date | null;
    submittedProofs?: SubmittedProofItem[] | any[] | null;
    completedAt?: Date | null;
    reviewerId?: string | null;
    reviewedAt?: Date | null;
    rejectionReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this._id = props.id;
    this._taskId = props.taskId;
    this._workerId = props.workerId;
    this._status = props.status;
    this._claimedAt = props.claimedAt;
    this._expiresAt = props.expiresAt;
    this._submittedAt = props.submittedAt || null;
    this._submittedProofs = props.submittedProofs
      ? props.submittedProofs.map((p) =>
          p instanceof SubmittedProofItem
            ? p
            : SubmittedProofItem.create({
                requirementId: p.requirement_id || p.requirementId,
                proofType: p.proof_type || p.proofType,
                value: p.value,
              })
        )
      : [];
    this._completedAt = props.completedAt || null;
    this._reviewerId = props.reviewerId || null;
    this._reviewedAt = props.reviewedAt || null;
    this._rejectionReason = props.rejectionReason || null;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(props: CreateTaskClaimProps): TaskClaim {
    const now = props.now || new Date();
    const id = props.id || `claim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(now.getTime() + props.executionTimeMinutes * 60 * 1000);

    return new TaskClaim({
      id,
      taskId: props.taskId,
      workerId: props.workerId,
      status: ClaimStatus.create('IN_PROGRESS'),
      claimedAt: now,
      expiresAt,
      submittedAt: null,
      submittedProofs: [],
      completedAt: null,
      reviewerId: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: ReconstituteTaskClaimProps): TaskClaim {
    return new TaskClaim({
      id: props.id,
      taskId: props.taskId,
      workerId: props.workerId,
      status: ClaimStatus.create(props.status),
      claimedAt: props.claimedAt,
      expiresAt: props.expiresAt,
      submittedAt: props.submittedAt || null,
      submittedProofs: props.submittedProofs || [],
      completedAt: props.completedAt || null,
      reviewerId: props.reviewerId || null,
      reviewedAt: props.reviewedAt || null,
      rejectionReason: props.rejectionReason || null,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  // Getters
  public get id(): string { return this._id; }
  public get taskId(): string { return this._taskId; }
  public get workerId(): string { return this._workerId; }
  public get status(): ClaimStatus { return this._status; }
  public get claimedAt(): Date { return this._claimedAt; }
  public get expiresAt(): Date { return this._expiresAt; }
  public get submittedAt(): Date | null { return this._submittedAt; }
  public get submittedProofs(): SubmittedProofItem[] { return [...this._submittedProofs]; }
  public getSubmittedProofs(): SubmittedProofItem[] { return [...this._submittedProofs]; }
  public get completedAt(): Date | null { return this._completedAt; }
  public get reviewerId(): string | null { return this._reviewerId; }
  public get reviewedAt(): Date | null { return this._reviewedAt; }
  public get rejectionReason(): string | null { return this._rejectionReason; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  /**
   * Kiểm tra xem slot có quá hạn tại thời điểm `now` hay không
   */
  public isExpired(now: Date = new Date()): boolean {
    if (this._status.getValue() === 'EXPIRED') return true;
    if (this._status.isInProgress()) {
      return now.getTime() > this._expiresAt.getTime();
    }
    return false;
  }

  /**
   * Tính số giây còn lại để hoàn thành nhiệm vụ
   */
  public getRemainingSeconds(now: Date = new Date()): number {
    if (!this._status.isInProgress() || this.isExpired(now)) {
      return 0;
    }
    return Math.max(0, Math.floor((this._expiresAt.getTime() - now.getTime()) / 1000));
  }

  /**
   * Kiểm tra xem lượt claim có thể bị hủy bởi worker không
   */
  public canBeCanceled(now: Date = new Date()): boolean {
    return this._status.isInProgress() && !this.isExpired(now);
  }

  /**
   * Worker chủ động hủy nhận việc
   * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-015
   */
  public cancel(now: Date = new Date()): void {
    if (!this.canBeCanceled(now)) {
      throw new ClaimAlreadyClosedError(
        'Không thể hủy lượt nhận việc đã kết thúc hoặc quá hạn.'
      );
    }
    this._status = this._status.transitionTo('CANCELED');
    this._updatedAt = now;
  }

  /**
   * Đánh dấu hết hạn slot (Lazy update hoặc Batch)
   * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-017
   */
  public expire(now: Date = new Date()): void {
    if (!this._status.isInProgress()) {
      throw new ClaimAlreadyClosedError('Chỉ có thể đánh dấu hết hạn cho claim đang IN_PROGRESS.');
    }
    this._status = this._status.transitionTo('EXPIRED');
    this._updatedAt = now;
  }

  /**
   * Worker nộp bài hoàn thành nhiệm vụ
   * Hỗ trợ cả 2 chữ ký: submit(now) (backward compatible) và submit(proofs, now)
   * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-SUB-006
   * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-SUB-015
   */
  public submit(proofsOrNow?: SubmittedProofItem[] | Date, maybeNow?: Date): void {
    let proofs: SubmittedProofItem[] = [];
    let now: Date = new Date();

    if (proofsOrNow instanceof Date) {
      now = proofsOrNow;
      proofs = [];
    } else if (Array.isArray(proofsOrNow)) {
      proofs = proofsOrNow;
      now = maybeNow || new Date();
    } else if (maybeNow instanceof Date) {
      now = maybeNow;
    }

    if (this.isExpired(now) || !this._status.isInProgress()) {
      throw new ClaimAlreadyClosedError('Không thể nộp bài vì lượt giữ slot đã hết hạn hoặc đã đóng.');
    }
    this._status = this._status.transitionTo('SUBMITTED');
    this._submittedAt = now;
    this._submittedProofs = [...proofs];
    this._updatedAt = now;
  }

  /**
   * Admin duyệt bài và chi trả thù lao Xu
   * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-007..011
   */
  public approve(reviewerIdOrNow?: string | Date, maybeNow?: Date): void {
    let reviewerId = 'ADMIN';
    let now = new Date();

    if (typeof reviewerIdOrNow === 'string') {
      reviewerId = reviewerIdOrNow;
      now = maybeNow || new Date();
    } else if (reviewerIdOrNow instanceof Date) {
      now = reviewerIdOrNow;
    }

    if (this._status.isApproved() || this._status.getValue() === 'REJECTED') {
      throw new ClaimAlreadyReviewedError();
    }

    if (!this._status.isSubmitted()) {
      throw new ClaimNotInSubmittedStatusError();
    }

    this._status = this._status.transitionTo('APPROVED');
    this._reviewerId = reviewerId;
    this._reviewedAt = now;
    this._completedAt = now;
    this._updatedAt = now;
  }

  /**
   * Admin từ chối bài nộp
   * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-012..016
   */
  public reject(reviewerIdOrNow?: string | Date, reasonOrNow?: string | Date, maybeNow?: Date): void {
    let reviewerId = 'ADMIN';
    let reason = '';
    let now = new Date();

    if (typeof reviewerIdOrNow === 'string') {
      reviewerId = reviewerIdOrNow;
      if (typeof reasonOrNow === 'string') {
        reason = reasonOrNow;
        now = maybeNow || new Date();
      } else if (reasonOrNow instanceof Date) {
        now = reasonOrNow;
      }
    } else if (reviewerIdOrNow instanceof Date) {
      now = reviewerIdOrNow;
    }

    if (this._status.isApproved() || this._status.getValue() === 'REJECTED') {
      throw new ClaimAlreadyReviewedError();
    }

    if (!this._status.isSubmitted()) {
      throw new ClaimNotInSubmittedStatusError();
    }

    this._status = this._status.transitionTo('REJECTED');
    this._reviewerId = reviewerId;
    this._reviewedAt = now;
    this._completedAt = now;
    this._rejectionReason = reason || null;
    this._updatedAt = now;
  }

  public toJSON() {
    return {
      id: this._id,
      task_id: this._taskId,
      worker_id: this._workerId,
      status: this._status.getValue(),
      claimed_at: this._claimedAt.toISOString(),
      expires_at: this._expiresAt.toISOString(),
      submitted_at: this._submittedAt ? this._submittedAt.toISOString() : null,
      submitted_proofs: this._submittedProofs.map((p) => p.toJSON()),
      completed_at: this._completedAt ? this._completedAt.toISOString() : null,
      reviewer_id: this._reviewerId,
      reviewed_at: this._reviewedAt ? this._reviewedAt.toISOString() : null,
      rejection_reason: this._rejectionReason,
      created_at: this._createdAt.toISOString(),
      updated_at: this._updatedAt.toISOString(),
    };
  }
}
