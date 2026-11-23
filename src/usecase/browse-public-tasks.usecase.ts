import { TaskRepositoryPort } from './ports/task-repository.port';
import { TaskProgressPort } from './ports/task-progress.port';
import { TaskCategory } from '../domain/entities/freelance-task.entity';

export interface BrowsePublicTasksInput {
  page?: number;
  limit?: number;
  category?: TaskCategory;
  sort_by?: 'LATEST' | 'REWARD_DESC';
}

export interface PublicTaskSummary {
  id: string;
  title: string;
  category: TaskCategory;
  reward_coins: number;
  quota: number;
  remaining_quota: number;
  execution_time_minutes: number;
  created_at: Date;
}

export interface BrowsePublicTasksOutput {
  data: PublicTaskSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * Usecase duyệt danh sách nhiệm vụ công khai cho Người làm (Worker)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-001..005
 */
export class BrowsePublicTasksUseCase {
  constructor(
    private readonly taskRepo: TaskRepositoryPort,
    private readonly progressPort: TaskProgressPort
  ) {}

  public async execute(input: BrowsePublicTasksInput = {}): Promise<BrowsePublicTasksOutput> {
    const page = Math.max(1, input.page || 1);
    const limit = Math.min(100, Math.max(1, input.limit || 20));

    // 1. Lấy toàn bộ tasks từ repository
    const allTasks = await this.taskRepo.findAll();

    // 2. Lọc các nhiệm vụ ACTIVE
    const activeTasks = allTasks.filter((t) => t.getStatus().isActive());

    // 3. Lọc theo danh mục nếu có
    const categoryFiltered = input.category
      ? activeTasks.filter((t) => t.getCategory() === input.category)
      : activeTasks;

    // 4. Tính toán remaining_quota theo cơ chế Lazy Evaluation
    const availableSummaries: PublicTaskSummary[] = [];

    for (const task of categoryFiltered) {
      const progress = await this.progressPort.getProgress(task.getId());
      const remainingQuota =
        task.getQuota().getValue() - (progress.approved_count + progress.in_progress_count);

      // REQ-BCT-001: Chỉ hiển thị các nhiệm vụ còn suất (remaining_quota > 0)
      if (remainingQuota > 0) {
        availableSummaries.push({
          id: task.getId(),
          title: task.getTitle(),
          category: task.getCategory(),
          reward_coins: task.getRewardCoins().getValue(),
          quota: task.getQuota().getValue(),
          remaining_quota: remainingQuota,
          execution_time_minutes: task.getExecutionTimeMinutes(),
          created_at: task.getCreatedAt(),
        });
      }
    }

    // 5. Sắp xếp theo tiêu chí (REQ-BCT-003)
    if (input.sort_by === 'REWARD_DESC') {
      availableSummaries.sort((a, b) => {
        if (b.reward_coins !== a.reward_coins) {
          return b.reward_coins - a.reward_coins;
        }
        return b.created_at.getTime() - a.created_at.getTime();
      });
    } else {
      // Mặc định: LATEST (mới nhất trước)
      availableSummaries.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }

    // 6. Phân trang
    const total = availableSummaries.length;
    const startIndex = (page - 1) * limit;
    const paginatedData = availableSummaries.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: paginatedData,
      pagination: {
        total,
        page,
        limit,
        total_pages: totalPages,
      },
    };
  }
}

