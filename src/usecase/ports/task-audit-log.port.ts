/**
 * Cổng giao tiếp ghi nhật ký kiểm toán (Clean Architecture & SEC-01 Audit Trail)
 * @ears .sdd/features/post-job/SPEC.md#NFR-AUDIT-001
 */
export interface AuditLogEntry {
  taskId: string;
  adminId: string;
  action: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  timestamp?: Date;
}

export interface TaskAuditLogPort {
  /**
   * Lưu nhật ký kiểm toán cho hành động quản trị trên nhiệm vụ
   */
  log(entry: AuditLogEntry): Promise<void>;
}

