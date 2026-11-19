import { FreelanceTask } from '../domain/entities/freelance-task.entity';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { UnauthorizedCreatorError } from '../shared/errors/task-errors';

export interface ListFreelanceTasksQuery {
  requesterRole?: string;
}

/**
 * Use Case: Lấy danh sách toàn bộ nhiệm vụ phục vụ Dashboard và Task Table
 * @ears .sdd/features/post-job-ui/SPEC.md#REQ-PUI-001
 * @ears .sdd/features/post-job-ui/SPEC.md#REQ-PUI-004
 */
export class ListFreelanceTasksUseCase {
  constructor(private readonly taskRepository: TaskRepositoryPort) {}

  public async execute(query: ListFreelanceTasksQuery = {}): Promise<FreelanceTask[]> {
    if (query.requesterRole && query.requesterRole !== 'ADMIN') {
      throw new UnauthorizedCreatorError('Chỉ tài khoản ADMIN mới có quyền xem danh sách quản trị nhiệm vụ');
    }
    return this.taskRepository.findAll();
  }
}

