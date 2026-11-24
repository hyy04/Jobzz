import { WorkerWallet } from '../../domain/entities/worker-wallet.entity';
import { WalletTransaction } from '../../domain/entities/wallet-transaction.entity';

/**
 * Cổng giao tiếp quản lý số dư Ví tiền Worker và lịch sử giao dịch (Clean Architecture ARCH-01)
 * @ears .sdd/features/review-task-submission/SPEC.md#53-thuc-the-vi-tien-workerwallet--bang-worker_wallets
 */
export interface WalletPort {
  /**
   * Lấy ví tiền của Worker, tự động khởi tạo với balance = 0 nếu chưa tồn tại
   */
  getOrCreateWallet(workerId: string): Promise<WorkerWallet>;

  /**
   * Tìm kiếm ví tiền theo workerId
   */
  findByWorkerId(workerId: string): Promise<WorkerWallet | null>;

  /**
   * Lưu hoặc cập nhật số dư ví
   */
  saveWallet(wallet: WorkerWallet): Promise<void>;

  /**
   * Lưu bản ghi lịch sử giao dịch ví
   */
  saveTransaction(transaction: WalletTransaction): Promise<void>;

  /**
   * Lấy danh sách lịch sử giao dịch của Worker
   */
  findTransactionsByWorkerId(workerId: string): Promise<WalletTransaction[]>;

  /**
   * Cộng tiền Xu vào ví và tạo bản ghi lịch sử giao dịch một cách nguyên tử
   */
  creditAtomic(
    workerId: string,
    amount: number,
    details: { referenceId?: string; description: string; now?: Date }
  ): Promise<{ wallet: WorkerWallet; transaction: WalletTransaction }>;
}

