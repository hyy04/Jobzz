import { TaskRepositoryPort } from './ports/task-repository.port';
import { TaskClaimRepositoryPort } from './ports/task-claim-repository.port';
import { TaskNotFoundError } from '../shared/errors/task-errors';
import {
  UnauthorizedWorkerError,
  TaskNotAvailableForClaimError,
  EmployerCannotClaimOwnTaskError,
  WorkerAlreadyClaimedTaskError,
} from '../shared/errors/claim-errors';

export interface ClaimTaskSlotInput {
  taskId: string;
  workerId: string;
  workerRole: string;
  now?: Date;
}

export interface ClaimTaskSlotOutput {
  claim_id: string;
  task_id: string;
  worker_id: string;
  status: string;
  claimed_at: Date;
  expires_at: Date;
  remaining_seconds: number;
}

/**
 * Usecase nhận việc giữ slot (Claim Slot) cho Người làm (Worker)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-009..014
 */
export class ClaimTaskSlotUseCase {
  constructor(
    private readonly taskRepo: TaskRepositoryPort,
    private readonly claimRepo: TaskClaimRepositoryPort
  ) {}

  public async execute(input: ClaimTaskSlotInput): Promise<ClaimTaskSlotOutput> {
    const now = input.now || new Date();

    // 1. REQ-BCT-013: Kiểm tra phân quyền vai trò WORKER
    if (input.workerRole !== 'WORKER') {
      throw new UnauthorizedWorkerError();
    }

    // 2. REQ-BCT-007 & REQ-BCT-008: Lấy nhiệm vụ và kiểm tra khả dụng
    const task = await this.taskRepo.findById(input.taskId);
    if (!task) {
      throw new TaskNotFoundError('Không tìm thấy nhiệm vụ yêu cầu.');
    }
    if (!task.getStatus().isActive()) {
      throw new TaskNotAvailableForClaimError(
        `Nhiệm vụ đang ở trạng thái [${task.getStatus().getValue()}], không khả dụng để nhận việc.`
      );
    }

    // 3. REQ-BCT-011: Chống tự gian lận (Anti-Self-Dealing)
    if (input.workerId === task.getCreatorId()) {
      throw new EmployerCannotClaimOwnTaskError();
    }

    // 4. REQ-BCT-012: Quy tắc 1 người - 1 việc (One-Per-Worker Rule)
    const existingClaims = await this.claimRepo.findByTaskAndWorker(input.taskId, input.workerId);
    for (const claim of existingClaims) {
      if (
        (claim.status.isInProgress() && !claim.isExpired(now)) ||
        claim.status.isSubmitted() ||
        claim.status.isApproved()
      ) {
        throw new WorkerAlreadyClaimedTaskError();
      }
    }

    // 5. REQ-BCT-009, REQ-BCT-010, REQ-BCT-014: Cấp slot nguyên tử (Atomic OCC Check)
    const newClaim = await this.claimRepo.claimSlotAtomic(
      task,
      input.workerId,
      task.getExecutionTimeMinutes(),
      now
    );

    return {
      claim_id: newClaim.id,
      task_id: newClaim.taskId,
      worker_id: newClaim.workerId,
      status: newClaim.status.getValue(),
      claimed_at: newClaim.claimedAt,
      expires_at: newClaim.expiresAt,
      remaining_seconds: newClaim.getRemainingSeconds(now),
    };
  }
}

