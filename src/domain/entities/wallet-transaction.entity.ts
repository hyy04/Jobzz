export type WalletTransactionType = 'TASK_REWARD' | 'REFUND' | 'WITHDRAWAL';

export interface CreateWalletTransactionProps {
  id?: string;
  walletId: string;
  workerId: string;
  type?: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  referenceId?: string | null;
  description: string;
  now?: Date;
}

export interface ReconstituteWalletTransactionProps {
  id: string;
  walletId: string;
  workerId: string;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  referenceId?: string | null;
  description: string;
  createdAt: Date;
}

/**
 * Thực thể Giao dịch Ví (Wallet Transaction Log)
 * @ears .sdd/features/review-task-submission/SPEC.md#54-thuc-the-giao-dich-vi-wallettransaction--bang-wallet_transactions
 */
export class WalletTransaction {
  private _id: string;
  private _walletId: string;
  private _workerId: string;
  private _type: WalletTransactionType;
  private _amount: number;
  private _balanceAfter: number;
  private _referenceId: string | null;
  private _description: string;
  private _createdAt: Date;

  private constructor(props: {
    id: string;
    walletId: string;
    workerId: string;
    type: WalletTransactionType;
    amount: number;
    balanceAfter: number;
    referenceId?: string | null;
    description: string;
    createdAt: Date;
  }) {
    this._id = props.id;
    this._walletId = props.walletId;
    this._workerId = props.workerId;
    this._type = props.type;
    this._amount = props.amount;
    this._balanceAfter = props.balanceAfter;
    this._referenceId = props.referenceId || null;
    this._description = props.description;
    this._createdAt = props.createdAt;
  }

  public static create(props: CreateWalletTransactionProps): WalletTransaction {
    const now = props.now || new Date();
    const id = props.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return new WalletTransaction({
      id,
      walletId: props.walletId,
      workerId: props.workerId,
      type: props.type || 'TASK_REWARD',
      amount: props.amount,
      balanceAfter: props.balanceAfter,
      referenceId: props.referenceId || null,
      description: props.description,
      createdAt: now,
    });
  }

  public static reconstitute(props: ReconstituteWalletTransactionProps): WalletTransaction {
    return new WalletTransaction({
      id: props.id,
      walletId: props.walletId,
      workerId: props.workerId,
      type: props.type,
      amount: props.amount,
      balanceAfter: props.balanceAfter,
      referenceId: props.referenceId || null,
      description: props.description,
      createdAt: props.createdAt,
    });
  }

  public get id(): string { return this._id; }
  public get walletId(): string { return this._walletId; }
  public get workerId(): string { return this._workerId; }
  public get type(): WalletTransactionType { return this._type; }
  public get amount(): number { return this._amount; }
  public get balanceAfter(): number { return this._balanceAfter; }
  public get referenceId(): string | null { return this._referenceId; }
  public get description(): string { return this._description; }
  public get createdAt(): Date { return this._createdAt; }

  public toJSON() {
    return {
      id: this._id,
      wallet_id: this._walletId,
      worker_id: this._workerId,
      type: this._type,
      amount: this._amount,
      balance_after: this._balanceAfter,
      reference_id: this._referenceId,
      description: this._description,
      created_at: this._createdAt.toISOString(),
    };
  }
}

