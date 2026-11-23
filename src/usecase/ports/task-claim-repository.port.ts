import { TaskClaim } from '../../domain/entities/task-claim.entity';
import { FreelanceTask } from '../../domain/entities/freelance-task.entity';
import { SubmittedProofItem } from '../../domain/value-objects/submitted-proof.vo';

/**
 * Cổng giao tiếp lưu trữ và truy vấn lượt giữ slot (Clean Architecture ARCH-01)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-009..017
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-SUB-006..019
 */
export interface TaskClaimRepositoryPort {
  /**
   * Lưu hoặc cập nhật một thực thể TaskClaim
   */
  save(claim: TaskClaim): Promise<void>;

  /**
   * Tìm kiếm TaskClaim theo ID
   */
  findById(id: string): Promise<TaskClaim | null>;

  /**
   * Lấy toàn bộ các lượt claim của một Worker trên một nhiệm vụ cụ thể
   */
  findByTaskAndWorker(taskId: string, workerId: string): Promise<TaskClaim[]>;

  /**
   * Tìm lượt claim đang IN_PROGRESS và còn hiệu lực (chưa hết hạn) của worker trên task
   */
  findActiveClaim(taskId: string, workerId: string, now: Date): Promise<TaskClaim | null>;

  /**
   * Đếm số lượng slot đang IN_PROGRESS và chưa quá hạn tại thời điểm `now`
   */
  countActiveClaims(taskId: string, now: Date): Promise<number>;

  /**
   * Đếm số lượng slot đang ở trạng thái SUBMITTED (chờ nghiệm thu)
   */
  countSubmittedClaims(taskId: string): Promise<number>;

  /**
   * Đếm số lượng slot đã được APPROVED
   */
  countApprovedClaims(taskId: string): Promise<number>;

  /**
   * Thực hiện nhận việc giữ chỗ một cách nguyên tử (Atomic Check-and-Claim OCC)
   * Ném TaskQuotaExhaustedError nếu số slot khả dụng <= 0
   */
  claimSlotAtomic(
    task: FreelanceTask,
    workerId: string,
    executionTimeMinutes: number,
    now: Date
  ): Promise<TaskClaim>;

  /**
   * Thực hiện nộp bài một cách nguyên tử có khóa bảo vệ (Atomic Submit OCC)
   * Ngăn chặn hoàn toàn tình trạng nộp đúp (Double Submit Race Condition)
   */
  submitAtomic(
    claimId: string,
    workerId: string,
    proofs: SubmittedProofItem[],
    now: Date
  ): Promise<TaskClaim>;
}
