import { FreelanceTask } from '../domain/entities/freelance-task.entity';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { TaskAuditLogPort } from './ports/task-audit-log.port';
import { UnauthorizedCreatorError, TaskNotFoundError } from '../shared/errors/task-errors';

export type TaskStatusAction = 'PUBLISH' | 'PAUSE' | 'RESUME' | 'CLOSE';

export interface ChangeTaskStatusCommand {
  taskId: string;
  adminId: string;
  adminRole: string;
  action: TaskStatusAction;
  expectedVersion: number;
}

/**
 * Use Case: Chuyển đổi trạng thái vòng đời nhiệm vụ
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-010
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-014
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-015
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-018
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-020
 */
export class ChangeTaskStatusUseCase {
  constructor(
    private readonly taskRepository: TaskRepositoryPort,
    private readonly auditLogPort: TaskAuditLogPort
  ) {}

  public async execute(command: ChangeTaskStatusCommand): Promise<FreelanceTask> {
    // 1. Kiểm tra vai trò bắt buộc ADMIN (REQ-POST-002)
    if (command.adminRole !== 'ADMIN') {
      throw new UnauthorizedCreatorError();
    }

    // 2. Tìm nhiệm vụ
    const task = await this.taskRepository.findById(command.taskId);
    if (!task) {
      throw new TaskNotFoundError();
    }

    const oldStatus = task.getStatus().getValue();
    const oldVersion = task.getVersion();

    // 3. Thực hiện chuyển trạng thái theo Action
    switch (command.action) {
      case 'PUBLISH':
        task.publish();
        break;
      case 'PAUSE':
        task.pause();
        break;
      case 'RESUME':
        task.resume();
        break;
      case 'CLOSE':
        task.close();
        break;
      default:
        throw new Error(`Hành động "${command.action}" không hợp lệ.`);
    }

    // 4. Lưu với kiểm tra OCC (REQ-POST-025)
    await this.taskRepository.update(task, command.expectedVersion);

    // 5. Ghi Audit Log (SEC-01 & NFR-AUDIT-001)
    await this.auditLogPort.log({
      taskId: task.getId(),
      adminId: command.adminId,
      action: `STATUS_CHANGED_${command.action}`,
      oldValue: {
        status: oldStatus,
        version: oldVersion,
      },
      newValue: {
        status: task.getStatus().getValue(),
        version: task.getVersion(),
        closed_at: task.getClosedAt(),
        grace_period_ends_at: task.getGracePeriodEndsAt(),
      },
      timestamp: new Date(),
    });

    return task;
  }
}

