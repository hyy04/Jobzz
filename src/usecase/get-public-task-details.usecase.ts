import { TaskRepositoryPort } from './ports/task-repository.port';
import { TaskProgressPort } from './ports/task-progress.port';
import { TaskCategory } from '../domain/entities/freelance-task.entity';
import { TaskNotFoundError } from '../shared/errors/task-errors';
import { TaskNotAvailableForClaimError } from '../shared/errors/claim-errors';

export interface GetPublicTaskDetailsInput {
  taskId: string;
}

export interface PublicTaskDetail {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: TaskCategory;
  reward_coins: number;
  quota: number;
  remaining_quota: number;
  execution_time_minutes: number;
  steps: Array<{
    step_number: number;
    instruction: string;
    target_url?: string | null;
    image_url?: string | null;
  }>;
  proof_requirements: Array<{
    id: string;
    proof_type: string;
    title: string;
    description?: string;
    is_required: boolean;
  }>;
  created_at: Date;
}

/**
 * Usecase xem chi tiết nhiệm vụ công khai cho Người làm (Worker)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-006..008
 */
export class GetPublicTaskDetailsUseCase {
  constructor(
    private readonly taskRepo: TaskRepositoryPort,
    private readonly progressPort: TaskProgressPort
  ) {}

  public async execute(input: GetPublicTaskDetailsInput): Promise<PublicTaskDetail> {
    const task = await this.taskRepo.findById(input.taskId);

    // REQ-BCT-007: Kiểm tra tồn tại
    if (!task) {
      throw new TaskNotFoundError('Không tìm thấy nhiệm vụ yêu cầu.');
    }

    // REQ-BCT-008: Chặn nếu trạng thái khác ACTIVE
    if (!task.getStatus().isActive()) {
      throw new TaskNotAvailableForClaimError(
        `Nhiệm vụ đang ở trạng thái [${task.getStatus().getValue()}], không khả dụng để nhận việc.`
      );
    }

    // Tính remaining_quota động
    const progress = await this.progressPort.getProgress(task.getId());
    const remainingQuota = Math.max(
      0,
      task.getQuota().getValue() - (progress.approved_count + progress.in_progress_count)
    );

    // Format steps và proofs
    const steps = task.getSteps().map((s) => s.toJSON());
    const proofRequirements = task.getProofRequirements().map((p) => ({
      id: p.getId(),
      proof_type: p.getProofType(),
      title: p.getTitle(),
      description: p.getDescription(),
      is_required: p.isRequiredProof(),
    }));

    return {
      id: task.getId(),
      creator_id: task.getCreatorId(),
      title: task.getTitle(),
      description: task.getDescription(),
      category: task.getCategory(),
      reward_coins: task.getRewardCoins().getValue(),
      quota: task.getQuota().getValue(),
      remaining_quota: remainingQuota,
      execution_time_minutes: task.getExecutionTimeMinutes(),
      steps,
      proof_requirements: proofRequirements,
      created_at: task.getCreatedAt(),
    };
  }
}

