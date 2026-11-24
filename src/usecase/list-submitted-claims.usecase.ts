import { TaskClaimRepositoryPort } from './ports/task-claim-repository.port';
import { TaskRepositoryPort } from './ports/task-repository.port';

export interface ListSubmittedClaimsInput {
  taskId?: string;
  page?: number;
  limit?: number;
}

export interface SubmissionListItemDTO {
  claim_id: string;
  task_id: string;
  worker_id: string;
  task_title: string;
  reward_coins: number;
  submitted_at: string;
  proofs_count: number;
  status: string;
}

export interface ListSubmittedClaimsOutput {
  items: SubmissionListItemDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Use case truy vấn danh sách bài nộp đang chờ duyệt (SUBMITTED) cho Admin
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-001..003
 */
export class ListSubmittedClaimsUseCase {
  constructor(
    private readonly claimRepository: TaskClaimRepositoryPort,
    private readonly taskRepository: TaskRepositoryPort
  ) {}

  public async execute(input: ListSubmittedClaimsInput): Promise<ListSubmittedClaimsOutput> {
    const page = Math.max(1, input.page || 1);
    const limit = Math.max(1, Math.min(100, input.limit || 10));

    const { claims, total } = await this.claimRepository.findSubmittedClaims({
      taskId: input.taskId,
      page,
      limit,
    });

    const items: SubmissionListItemDTO[] = [];

    // Cache thông tin task theo taskId để tránh query trùng lặp
    const taskCache = new Map<string, { title: string; rewardCoins: number }>();

    for (const claim of claims) {
      let taskInfo = taskCache.get(claim.taskId);
      if (!taskInfo) {
        const task = await this.taskRepository.findById(claim.taskId);
        if (task) {
          taskInfo = {
            title: task.getTitle(),
            rewardCoins: task.getRewardCoins().getValue(),
          };
          taskCache.set(claim.taskId, taskInfo);
        } else {
          taskInfo = {
            title: 'Nhiệm vụ không xác định',
            rewardCoins: 0,
          };
        }
      }

      items.push({
        claim_id: claim.id,
        task_id: claim.taskId,
        worker_id: claim.workerId,
        task_title: taskInfo.title,
        reward_coins: taskInfo.rewardCoins,
        submitted_at: claim.submittedAt ? claim.submittedAt.toISOString() : claim.createdAt.toISOString(),
        proofs_count: claim.submittedProofs.length,
        status: claim.status.getValue(),
      });
    }

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  }
}
