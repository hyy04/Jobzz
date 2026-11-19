import { InvalidQuotaError } from '../../shared/errors/task-errors';

/**
 * Value Object: Quota
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-004
 */
export class Quota {
  public static readonly MIN_QUOTA = 1;
  public static readonly MAX_QUOTA = 10_000;

  private constructor(private readonly value: number) {}

  public static create(slots: number): Quota {
    if (!Number.isSafeInteger(slots) || slots < this.MIN_QUOTA || slots > this.MAX_QUOTA) {
      throw new InvalidQuotaError();
    }
    return new Quota(slots);
  }

  public getValue(): number {
    return this.value;
  }

  public equals(other: Quota): boolean {
    return this.value === other.value;
  }
}

