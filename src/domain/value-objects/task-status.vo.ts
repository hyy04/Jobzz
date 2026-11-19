import { InvalidStateTransitionError } from '../../shared/errors/task-errors';

export type TaskStatusType = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CLOSED';

/**
 * Value Object & State Machine: TaskStatus
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-013
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-014
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-015
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-016
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-017
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-018
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-020
 */
export class TaskStatus {
  public static readonly DRAFT = new TaskStatus('DRAFT');
  public static readonly ACTIVE = new TaskStatus('ACTIVE');
  public static readonly PAUSED = new TaskStatus('PAUSED');
  public static readonly COMPLETED = new TaskStatus('COMPLETED');
  public static readonly CLOSED = new TaskStatus('CLOSED');

  private constructor(private readonly status: TaskStatusType) {}

  public static fromString(rawStatus: string): TaskStatus {
    switch (rawStatus.toUpperCase()) {
      case 'DRAFT':
        return TaskStatus.DRAFT;
      case 'ACTIVE':
        return TaskStatus.ACTIVE;
      case 'PAUSED':
        return TaskStatus.PAUSED;
      case 'COMPLETED':
        return TaskStatus.COMPLETED;
      case 'CLOSED':
        return TaskStatus.CLOSED;
      default:
        throw new InvalidStateTransitionError(`Trạng thái "${rawStatus}" không tồn tại trong hệ thống.`);
    }
  }

  public getValue(): TaskStatusType {
    return this.status;
  }

  public isDraft(): boolean {
    return this.status === 'DRAFT';
  }

  public isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  public isPaused(): boolean {
    return this.status === 'PAUSED';
  }

  public isCompleted(): boolean {
    return this.status === 'COMPLETED';
  }

  public isClosed(): boolean {
    return this.status === 'CLOSED';
  }

  /**
   * Kiểm tra tính hợp lệ của chuyển đổi trạng thái theo Ma trận trạng thái
   */
  public canTransitionTo(target: TaskStatus, context?: { isQuotaExpanded?: boolean }): boolean {
    if (this.status === target.status) {
      return true; // No-op
    }

    switch (this.status) {
      case 'DRAFT':
        return target.status === 'ACTIVE';
      case 'ACTIVE':
        return target.status === 'PAUSED' || target.status === 'COMPLETED' || target.status === 'CLOSED';
      case 'PAUSED':
        return target.status === 'ACTIVE' || target.status === 'CLOSED';
      case 'COMPLETED':
        if (target.status === 'CLOSED') {
          return true;
        }
        return target.status === 'ACTIVE' && (context?.isQuotaExpanded === true);
      case 'CLOSED':
        return false; // Terminal state
      default:
        return false;
    }
  }

  public ensureCanTransitionTo(target: TaskStatus, context?: { isQuotaExpanded?: boolean }): void {
    if (!this.canTransitionTo(target, context)) {
      throw new InvalidStateTransitionError(
        `Không thể chuyển đổi trạng thái từ ${this.status} sang ${target.status}.`
      );
    }
  }

  public equals(other: TaskStatus): boolean {
    return this.status === other.status;
  }
}
