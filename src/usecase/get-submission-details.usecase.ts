import { TaskClaimRepositoryPort } from './ports/task-claim-repository.port';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { SubmissionNotFoundError } from '../shared/errors/claim-errors';

export interface GetSubmissionDetailsInput {
  claimId: string;
}

export interface SubmittedProofDetailDTO {
  requirement_id: string;
  proof_type: string;
  value: string;
  description?: string;
}

export interface GetSubmissionDetailsOutput {
  claim_id: string;
  task_id: string;
  worker_id: string;
  task_title: string;
  task_description: string;
  reward_coins: number;
  status: string;
  claimed_at: string;
  expires_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  submitted_proofs: SubmittedProofDetailDTO[];
}

/**
 * Use case xem chi tiết bài nộp và danh sách bằng chứng cho Admin đối soát
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-004..005
 */
export class GetSubmissionDetailsUseCase {
  constructor(
    private readonly claimRepository: TaskClaimRepositoryPort,
    private readonly taskRepository: TaskRepositoryPort
  ) {}

  public async execute(input: GetSubmissionDetailsInput): Promise<GetSubmissionDetailsOutput> {
    const claim = await this.claimRepository.findSubmissionDetails(input.claimId);
    if (!claim) {
      throw new SubmissionNotFoundError();
    }

    const task = await this.taskRepository.findById(claim.taskId);
    const taskTitle = task ? task.getTitle() : 'Nhiệm vụ không xác định';
    const taskDescription = task ? task.getDescription() : '';
    const rewardCoins = task ? task.getRewardCoins().getValue() : 0;

    // Lấy yêu cầu bằng chứng từ task để map mô tả đối soát
    const proofRequirements = task ? task.getProofRequirements() : [];
    const reqMap = new Map<string, string>();
    for (const req of proofRequirements) {
      reqMap.set(req.getId(), req.getDescription());
    }

    const submittedProofs: SubmittedProofDetailDTO[] = claim.getSubmittedProofs().map((p) => ({
      requirement_id: p.requirementId,
      proof_type: p.proofType,
      value: p.value,
      description: reqMap.get(p.requirementId) || '',
    }));

    return {
      claim_id: claim.id,
      task_id: claim.taskId,
      worker_id: claim.workerId,
      task_title: taskTitle,
      task_description: taskDescription,
      reward_coins: rewardCoins,
      status: claim.status.getValue(),
      claimed_at: claim.claimedAt.toISOString(),
      expires_at: claim.expiresAt.toISOString(),
      submitted_at: claim.submittedAt ? claim.submittedAt.toISOString() : null,
      completed_at: claim.completedAt ? claim.completedAt.toISOString() : null,
      reviewer_id: claim.reviewerId,
      reviewed_at: claim.reviewedAt ? claim.reviewedAt.toISOString() : null,
      rejection_reason: claim.rejectionReason,
      submitted_proofs: submittedProofs,
    };
  }
}
