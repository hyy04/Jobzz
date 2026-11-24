import { WalletPort } from '../../usecase/ports/wallet.port';
import { WorkerWallet } from '../../domain/entities/worker-wallet.entity';
import { WalletTransaction } from '../../domain/entities/wallet-transaction.entity';

/**
 * Triển khai In-Memory cho WalletPort phục vụ Unit / Integration Test
 * @ears .sdd/features/review-task-submission/SPEC.md#53-thuc-the-vi-tien-workerwallet--bang-worker_wallets
 */
export class InMemoryWalletRepository implements WalletPort {
  private wallets = new Map<string, WorkerWallet>();
  private transactions: WalletTransaction[] = [];
  private walletLocks = new Map<string, Promise<void>>();

  public async getOrCreateWallet(workerId: string): Promise<WorkerWallet> {
    let wallet = this.wallets.get(workerId);
    if (!wallet) {
      wallet = WorkerWallet.create({ workerId, balance: 0 });
      this.wallets.set(workerId, wallet);
    }
    return wallet;
  }

  public async findByWorkerId(workerId: string): Promise<WorkerWallet | null> {
    return this.wallets.get(workerId) || null;
  }

  public async saveWallet(wallet: WorkerWallet): Promise<void> {
    this.wallets.set(wallet.workerId, wallet);
  }

  public async saveTransaction(transaction: WalletTransaction): Promise<void> {
    this.transactions.push(transaction);
  }

  public async findTransactionsByWorkerId(workerId: string): Promise<WalletTransaction[]> {
    return this.transactions
      .filter((tx) => tx.workerId === workerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async creditAtomic(
    workerId: string,
    amount: number,
    details: { referenceId?: string; description: string; now?: Date }
  ): Promise<{ wallet: WorkerWallet; transaction: WalletTransaction }> {
    return this.withLock(`wallet-${workerId}`, async () => {
      const wallet = await this.getOrCreateWallet(workerId);
      const now = details.now || new Date();

      wallet.credit(amount, now);
      await this.saveWallet(wallet);

      const transaction = WalletTransaction.create({
        walletId: wallet.id,
        workerId: wallet.workerId,
        type: 'TASK_REWARD',
        amount,
        balanceAfter: wallet.balance,
        referenceId: details.referenceId,
        description: details.description,
        now,
      });

      await this.saveTransaction(transaction);

      return { wallet, transaction };
    });
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prevLock = this.walletLocks.get(key) || Promise.resolve();
    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.walletLocks.set(key, prevLock.then(() => currentLock));

    try {
      await prevLock;
      return await fn();
    } finally {
      releaseLock!();
      if (this.walletLocks.get(key) === currentLock) {
        this.walletLocks.delete(key);
      }
    }
  }

  public clear(): void {
    this.wallets.clear();
    this.transactions = [];
    this.walletLocks.clear();
  }
}

