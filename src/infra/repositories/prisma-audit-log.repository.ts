import { TaskAuditLogPort, AuditLogEntry } from '../../usecase/ports/task-audit-log.port';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma-client';

/**
 * Repository lưu nhật ký kiểm toán vào PostgreSQL qua Prisma ORM (SEC-01 & NFR-AUDIT-001)
 */
export class PrismaTaskAuditLogRepository implements TaskAuditLogPort {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  public async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.taskAuditLog.create({
      data: {
        task_id: entry.taskId,
        admin_id: entry.adminId,
        action: entry.action,
        old_value: (entry.oldValue ?? undefined) as any,
        new_value: (entry.newValue ?? undefined) as any,
        created_at: entry.timestamp || new Date(),
      },
    });
  }

  public async findByTaskId(taskId: string) {
    return this.prisma.taskAuditLog.findMany({
      where: { task_id: taskId },
      orderBy: { created_at: 'desc' },
    });
  }
}

