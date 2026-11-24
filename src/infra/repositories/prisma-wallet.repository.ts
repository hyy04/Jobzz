import { PrismaClient } from '@prisma/client';
import { WalletPort } from '../../usecase/ports/wallet.port';
import { WorkerWallet } from '../../domain/entities/worker-wallet.entity';
import { WalletTransaction, WalletTransactionType } from '../../domain/entities/wallet-transaction.entity';
import { getPrismaClient } from '../database/prisma-client';

/**
 * Repository quản lý ví tiền Worker và giao dịch trên PostgreSQL qua Prisma ORM
 * Hỗ trợ giao dịch cô lập (Interactive Transaction) bảo đảm tính nguyên tử và chống Race Condition
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-007..011, REQ-RTS-018
 */
export class PrismaWalletRepository implements WalletPort {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  public async getOrCreateWallet(workerId: string): Promise<WorkerWallet> {
    const raw = await (this.prisma as any).workerWallet.upsert({
      where: { worker_id: workerId },
      create: {
        worker_id: workerId,
        balance: 0,
      },
      update: {},
    });

    return WorkerWallet.reconstitute({
      id: raw.id,
      workerId: raw.worker_id,
      balance: raw.balance,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    });
  }

  public async findByWorkerId(workerId: string): Promise<WorkerWallet | null> {
    const raw = await (this.prisma as any).workerWallet.findUnique({
      where: { worker_id: workerId },
    });
    if (!raw) return null;

    return WorkerWallet.reconstitute({
      id: raw.id,
      workerId: raw.worker_id,
      balance: raw.balance,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    });
  }

  public async saveWallet(wallet: WorkerWallet): Promise<void> {
    await (this.prisma as any).workerWallet.upsert({
      where: { worker_id: wallet.workerId },
      create: {
        id: wallet.id,
        worker_id: wallet.workerId,
        balance: wallet.balance,
        created_at: wallet.createdAt,
        updated_at: wallet.updatedAt,
      },
      update: {
        balance: wallet.balance,
        updated_at: wallet.updatedAt,
      },
    });
  }

  public async saveTransaction(transaction: WalletTransaction): Promise<void> {
    await (this.prisma as any).walletTransaction.create({
      data: {
        id: transaction.id,
        wallet_id: transaction.walletId,
        worker_id: transaction.workerId,
        type: transaction.type,
        amount: transaction.amount,
        balance_after: transaction.balanceAfter,
        reference_id: transaction.referenceId,
        description: transaction.description,
        created_at: transaction.createdAt,
      },
    });
  }

  public async findTransactionsByWorkerId(workerId: string): Promise<WalletTransaction[]> {
    const list = await (this.prisma as any).walletTransaction.findMany({
      where: { worker_id: workerId },
      orderBy: { created_at: 'desc' },
    });

    return list.map((raw: any) =>
      WalletTransaction.reconstitute({
        id: raw.id,
        walletId: raw.wallet_id,
        workerId: raw.worker_id,
        type: raw.type as WalletTransactionType,
        amount: raw.amount,
        balanceAfter: raw.balance_after,
        referenceId: raw.reference_id,
        description: raw.description,
        createdAt: raw.created_at,
      })
    );
  }

  public async creditAtomic(
    workerId: string,
    amount: number,
    details: { referenceId?: string; description: string; now?: Date }
  ): Promise<{ wallet: WorkerWallet; transaction: WalletTransaction }> {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const now = details.now || new Date();

      // Upsert lấy ví
      const rawWallet = await tx.workerWallet.upsert({
        where: { worker_id: workerId },
        create: {
          worker_id: workerId,
          balance: amount,
          created_at: now,
          updated_at: now,
        },
        update: {
          balance: { increment: amount },
          updated_at: now,
        },
      });

      const wallet = WorkerWallet.reconstitute({
        id: rawWallet.id,
        workerId: rawWallet.worker_id,
        balance: rawWallet.balance,
        createdAt: rawWallet.created_at,
        updatedAt: rawWallet.updated_at,
      });

      const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const rawTx = await tx.walletTransaction.create({
        data: {
          id: txId,
          wallet_id: wallet.id,
          worker_id: workerId,
          type: 'TASK_REWARD',
          amount,
          balance_after: wallet.balance,
          reference_id: details.referenceId || null,
          description: details.description,
          created_at: now,
        },
      });

      const transaction = WalletTransaction.reconstitute({
        id: rawTx.id,
        walletId: rawTx.wallet_id,
        workerId: rawTx.worker_id,
        type: rawTx.type as WalletTransactionType,
        amount: rawTx.amount,
        balanceAfter: rawTx.balance_after,
        referenceId: rawTx.reference_id,
        description: rawTx.description,
        createdAt: rawTx.created_at,
      });

      return { wallet, transaction };
    });
  }
}

