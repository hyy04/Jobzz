/**
 * Cổng giao tiếp lấy tiến độ nhiệm vụ (Clean Architecture ARCH-01)
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-023
 */
export interface TaskProgress {
  approved_count: number;
  in_progress_count: number;
}

export interface TaskProgressPort {
  /**
   * Lấy số lượng bài đã duyệt và số lượng slot đang làm dang dở
   * @param taskId Mã định danh nhiệm vụ
   */
  getProgress(taskId: string): Promise<TaskProgress>;
}

