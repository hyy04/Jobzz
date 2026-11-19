import { FreelanceTask } from '../../domain/entities/freelance-task.entity';

/**
 * Cổng giao tiếp lưu trữ dữ liệu nhiệm vụ (Clean Architecture & OCC REQ-POST-025)
 */
export interface TaskRepositoryPort {
  /**
   * Lưu mới một nhiệm vụ
   */
  save(task: FreelanceTask): Promise<void>;

  /**
   * Tìm nhiệm vụ theo ID
   */
  findById(id: string): Promise<FreelanceTask | null>;

  /**
   * Cập nhật nhiệm vụ với kiểm tra xung đột phiên đồng thời (Optimistic Concurrency Control)
   * @param task Thực thể nhiệm vụ với phiên bản mới
   * @param expectedVersion Phiên bản kỳ vọng trước khi cập nhật
   * @throws TaskConcurrencyConflictError nếu version trong DB khác expectedVersion
   */
  update(task: FreelanceTask, expectedVersion: number): Promise<void>;
}

