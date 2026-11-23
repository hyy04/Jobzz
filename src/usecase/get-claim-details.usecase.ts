import { TaskClaimRepositoryPort } from './ports/task-claim-repository.port';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { ClaimNotFoundError, ForbiddenNotClaimOwnerError } from '../shared/errors/claim-errors';

export interface GetClaimDetailsQuery {
  claimId: string;
  workerId: string;
  now?: Date;
}

export interface ClaimDetailsResult {
  id: string;
  taskId: string;
  workerId: string;
  status: string;
  claimedAt: Date;
  expiresAt: Date;
  remainingSeconds: number;
  submittedAt: Date | null;
  submittedProofs: Array<{
    requirementId: string;
    proofType: string;
    value: string;
  }>;
  task: {
    id: string;
    title: string;
    description: string;
    rewardCoins: number;
    quota: number;
    proofRequirements: Array<{
      id: string;
      proofType: string;
      title: string;
      description: string;
      isRequired: boolean;
    }>;
  } | null;
}

/**
 * UseCase: GetClaimDetailsUseCase
 * Lấy thông tin chi tiết lượt nhận việc và bằng chứng đã nộp
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-015
 */
export class GetClaimDetailsUseCase {
  constructor(
    private readonly claimRepository: TaskClaimRepositoryPort,
    private readonly taskRepository: TaskRepositoryPort
  ) {}

  public async execute(query: GetClaimDetailsQuery): Promise<ClaimDetailsResult> {
    const now = query.now || new Date();
    const claim = await this.claimRepository.findById(query.claimId);
    if (!claim) {
      throw new ClaimNotFoundError();
    }

    if (claim.workerId !== query.workerId) {
      throw new ForbiddenNotClaimOwnerError();
    }

    // Auto-expire nếu slot đã quá hạn và còn in_progress
    if (claim.isExpired(now) && claim.status.isInProgress()) {
      claim.expire(now);
      await this.claimRepository.save(claim);
    }

    const task = await this.taskRepository.findById(claim.taskId);

    return {
      id: claim.id,
      taskId: claim.taskId,
      workerId: claim.workerId,
      status: claim.status.getValue(),
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
      remainingSeconds: claim.getRemainingSeconds(now),
      submittedAt: claim.submittedAt,
      submittedProofs: claim.getSubmittedProofs().map((p) => ({
        requirementId: p.requirementId,
        proofType: p.proofType,
        value: p.value,
      })),
      task: task
        ? {
            id: task.getId(),
            title: task.getTitle(),
            description: task.getDescription(),
            rewardCoins: task.getRewardCoins().getValue(),
            quota: task.getQuota().getValue(),
            proofRequirements: task.getProofRequirements().map((r) => ({
              id: r.getId(),
              proofType: r.getProofType(),
              title: r.getTitle(),
              description: r.getDescription(),
              isRequired: r.isRequiredProof(),
            })),
          }
        : null,
    };
  }
}
