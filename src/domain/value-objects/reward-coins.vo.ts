import { InvalidRewardCoinsError } from '../../shared/errors/task-errors';

/**
 * Value Object: RewardCoins
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-003
 */
export class RewardCoins {
  public static readonly MIN_COINS = 1;
  public static readonly MAX_COINS = 500_000;

  private constructor(private readonly value: number) {}

  public static create(coins: number): RewardCoins {
    if (!Number.isSafeInteger(coins) || coins < this.MIN_COINS || coins > this.MAX_COINS) {
      throw new InvalidRewardCoinsError();
    }
    return new RewardCoins(coins);
  }

  public getValue(): number {
    return this.value;
  }

  public equals(other: RewardCoins): boolean {
    return this.value === other.value;
  }
}

