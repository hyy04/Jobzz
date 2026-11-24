import { DomainError } from '../../shared/errors/domain.error';

export interface CreateWorkerWalletProps {
  id?: string;
  workerId: string;
  balance?: number;
  now?: Date;
}

export interface ReconstituteWorkerWalletProps {
  id: string;
  workerId: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export class NegativeAmountError extends DomainError {
  readonly errorCode = 'NEGATIVE_OR_ZERO_CREDIT_AMOUNT';
  readonly statusCode = 400;
  constructor(message = 'Số Xu thưởng cộng vào ví phải là số nguyên dương lớn hơn 0.') {
    super(message);
  }
}

/**
 * Thực thể Ví tiền Người làm (Worker Wallet)
 * @ears .sdd/features/review-task-submission/SPEC.md#53-thuc-the-vi-tien-workerwallet--bang-worker_wallets
 */
export class WorkerWallet {
  private _id: string;
  private _workerId: string;
  private _balance: number;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: {
    id: string;
    workerId: string;
    balance: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this._id = props.id;
    this._workerId = props.workerId;
    this._balance = props.balance;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(props: CreateWorkerWalletProps): WorkerWallet {
    const now = props.now || new Date();
    const id = props.id || `wallet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const balance = props.balance ?? 0;

    return new WorkerWallet({
      id,
      workerId: props.workerId,
      balance,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: ReconstituteWorkerWalletProps): WorkerWallet {
    return new WorkerWallet({
      id: props.id,
      workerId: props.workerId,
      balance: props.balance,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  public get id(): string { return this._id; }
  public get workerId(): string { return this._workerId; }
  public get balance(): number { return this._balance; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  /**
   * Cộng thêm Xu thưởng vào số dư ví
   * @param amount Số xu cộng vào (phải > 0)
   * @param now Thời điểm giao dịch
   */
  public credit(amount: number, now: Date = new Date()): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new NegativeAmountError();
    }
    this._balance += amount;
    this._updatedAt = now;
  }

  public toJSON() {
    return {
      id: this._id,
      worker_id: this._workerId,
      balance: this._balance,
      created_at: this._createdAt.toISOString(),
      updated_at: this._updatedAt.toISOString(),
    };
  }
}

