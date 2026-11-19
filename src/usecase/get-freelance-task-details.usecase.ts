import { FreelanceTask } from '../domain/entities/freelance-task.entity';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { TaskProgressPort } from './ports/task-progress.port';
import { TaskNotFoundError } from '../shared/errors/task-errors';

export interface GetFreelanceTaskDetailsQuery {
  taskId: string;
  requesterId?: string;
  requesterRole?: string;
}

export interface TaskDetailsResponse {
  task: FreelanceTask;
  progress: {
    approved_count: number;
    in_progress_count: number;
    remaining_slots: number;
  };
}

/**
 * Use Case: Xem thông tin chi tiết nhiệm vụ
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-021
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-022
 */
export class GetFreelanceTaskDetailsUseCase {
  constructor(
    private readonly taskRepository: TaskRepositoryPort,
    private readonly taskProgressPort: TaskProgressPort
  ) {}

  public async execute(query: GetFreelanceTaskDetailsQuery): Promise<TaskDetailsResponse> {
    const task = await this.taskRepository.findById(query.taskId);
    if (!task) {
      throw new TaskNotFoundError();
    }

    // Nếu không phải ADMIN, chỉ được xem nhiệm vụ khi không phải là DRAFT
    const isAdmin = query.requesterRole === 'ADMIN';
    if (!isAdmin && task.getStatus().isDraft()) {
      throw new TaskNotFoundError('Nhiệm vụ chưa được xuất bản.');
    }

    // Lấy tiến độ từ TaskProgressPort (ARCH-01)
    const progress = await this.taskProgressPort.getProgress(task.getId());
    const totalOccupied = progress.approved_count + progress.in_progress_count;
    const remainingSlots = Math.max(0, task.getQuota().getValue() - totalOccupied);

    return {
      task,
      progress: {
        approved_count: progress.approved_count,
        in_progress_count: progress.in_progress_count,
        remaining_slots: remainingSlots,
      },
    };
  }
}

