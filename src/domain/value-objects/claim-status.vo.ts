import { InvalidClaimStatusTransitionError } from '../../shared/errors/claim-errors';

export type ClaimStatusType =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EXPIRED'
  | 'CANCELED'
  | 'APPROVED'
  | 'REJECTED';

/**
 * Value Object quản lý trạng thái của lượt nhận việc (Task Claim)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#5-mo-hinh-du-lieu-data-model--schema
 */
export class ClaimStatus {
  private static readonly VALID_TRANSITIONS: Record<ClaimStatusType, ClaimStatusType[]> = {
    IN_PROGRESS: ['SUBMITTED', 'EXPIRED', 'CANCELED'],
    SUBMITTED: ['APPROVED', 'REJECTED'],
    EXPIRED: [],
    CANCELED: [],
    APPROVED: [],
    REJECTED: [],
  };

  private constructor(private readonly value: ClaimStatusType) {}

  public static create(value: ClaimStatusType = 'IN_PROGRESS'): ClaimStatus {
    return new ClaimStatus(value);
  }

  public getValue(): ClaimStatusType {
    return this.value;
  }

  public canTransitionTo(nextStatus: ClaimStatusType): boolean {
    const allowed = ClaimStatus.VALID_TRANSITIONS[this.value] || [];
    return allowed.includes(nextStatus);
  }

  public transitionTo(nextStatus: ClaimStatusType): ClaimStatus {
    if (!this.canTransitionTo(nextStatus)) {
      throw new InvalidClaimStatusTransitionError(this.value, nextStatus);
    }
    return new ClaimStatus(nextStatus);
  }

  public isInProgress(): boolean {
    return this.value === 'IN_PROGRESS';
  }

  public isSubmitted(): boolean {
    return this.value === 'SUBMITTED';
  }

  public isApproved(): boolean {
    return this.value === 'APPROVED';
  }

  public isCanceled(): boolean {
    return this.value === 'CANCELED';
  }

  public isExpired(): boolean {
    return this.value === 'EXPIRED';
  }

  public isTerminal(): boolean {
    return ['CANCELED', 'EXPIRED', 'APPROVED', 'REJECTED'].includes(this.value);
  }
}

