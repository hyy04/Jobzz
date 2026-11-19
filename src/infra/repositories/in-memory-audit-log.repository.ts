import { TaskAuditLogPort, AuditLogEntry } from '../../usecase/ports/task-audit-log.port';

/**
 * In-Memory Audit Log Repository phục vụ dev/test cục bộ khi chưa có DATABASE_URL
 */
export class InMemoryTaskAuditLogRepository implements TaskAuditLogPort {
  private logs: AuditLogEntry[] = [];

  public async log(entry: AuditLogEntry): Promise<void> {
    this.logs.push(entry);
  }

  public getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }
}

