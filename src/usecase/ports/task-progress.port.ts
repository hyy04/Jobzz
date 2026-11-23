/**
 * Cổng giao tiếp lấy tiến độ nhiệm vụ (Clean Architecture ARCH-01)
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-023
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-SUB-016
 */
export interface TaskProgress {
  approved_count: number;
  in_progress_count: number;
  submitted_count?: number;
}

export interface TaskProgressPort {
  /**
   * Lấy số lượng bài đã duyệt và số lượng slot đang làm dang dở hoặc chờ duyệt
   * @param taskId Mã định danh nhiệm vụ
   */
  getProgress(taskId: string): Promise<TaskProgress>;
}
