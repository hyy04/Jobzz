import { TaskClaim } from '../../domain/entities/task-claim.entity';
import { FreelanceTask } from '../../domain/entities/freelance-task.entity';
import { TaskClaimRepositoryPort } from '../../usecase/ports/task-claim-repository.port';
import {
  TaskQuotaExhaustedError,
  ClaimNotFoundError,
  ForbiddenNotClaimOwnerError,
  ClaimExpiredError,
  ClaimNotInProgressError,
} from '../../shared/errors/claim-errors';
import { SubmittedProofItem } from '../../domain/value-objects/submitted-proof.vo';

/**
 * In-Memory triển khai TaskClaimRepositoryPort cho môi trường Test và Local Dev
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-009..017
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-SUB-006..019
 */
export class InMemoryTaskClaimRepository implements TaskClaimRepositoryPort {
  private claims = new Map<string, TaskClaim>();
  private taskLocks = new Map<string, Promise<void>>();

  public async save(claim: TaskClaim): Promise<void> {
    this.claims.set(claim.id, claim);
  }

  public async findById(id: string): Promise<TaskClaim | null> {
    return this.claims.get(id) || null;
  }

  public async findByTaskAndWorker(taskId: string, workerId: string): Promise<TaskClaim[]> {
    const results: TaskClaim[] = [];
    for (const claim of this.claims.values()) {
      if (claim.taskId === taskId && claim.workerId === workerId) {
        results.push(claim);
      }
    }
    return results;
  }

  public async findActiveClaim(taskId: string, workerId: string, now: Date): Promise<TaskClaim | null> {
    for (const claim of this.claims.values()) {
      if (
        claim.taskId === taskId &&
        claim.workerId === workerId &&
        claim.status.isInProgress() &&
        !claim.isExpired(now)
      ) {
        return claim;
      }
    }
    return null;
  }

  public async countActiveClaims(taskId: string, now: Date): Promise<number> {
    let count = 0;
    for (const claim of this.claims.values()) {
      if (claim.taskId === taskId && claim.status.isInProgress() && !claim.isExpired(now)) {
        count++;
      }
    }
    return count;
  }

  public async countSubmittedClaims(taskId: string): Promise<number> {
    let count = 0;
    for (const claim of this.claims.values()) {
      if (claim.taskId === taskId && claim.status.isSubmitted()) {
        count++;
      }
    }
    return count;
  }

  public async countApprovedClaims(taskId: string): Promise<number> {
    let count = 0;
    for (const claim of this.claims.values()) {
      if (claim.taskId === taskId && claim.status.isApproved()) {
        count++;
      }
    }
    return count;
  }

  /**
   * Khóa mutex đảm bảo tính nguyên tử khi nhiều worker cùng tranh nhận slot
   * Mô phỏng chính xác hành vi Transaction Locking của Database
   */
  public async claimSlotAtomic(
    task: FreelanceTask,
    workerId: string,
    executionTimeMinutes: number,
    now: Date
  ): Promise<TaskClaim> {
    return this.withTaskLock(task.getId(), async () => {
      const activeCount = await this.countActiveClaims(task.getId(), now);
      const submittedCount = await this.countSubmittedClaims(task.getId());
      const approvedCount = await this.countApprovedClaims(task.getId());
      const remaining = task.getQuota().getValue() - (activeCount + submittedCount + approvedCount);

      if (remaining <= 0) {
        throw new TaskQuotaExhaustedError();
      }

      const newClaim = TaskClaim.create({
        taskId: task.getId(),
        workerId,
        executionTimeMinutes,
        now,
      });

      await this.save(newClaim);
      return newClaim;
    });
  }

  /**
   * Thực hiện nộp bài một cách nguyên tử có khóa bảo vệ (Atomic Submit OCC)
   */
  public async submitAtomic(
    claimId: string,
    workerId: string,
    proofs: SubmittedProofItem[],
    now: Date
  ): Promise<TaskClaim> {
    return this.withTaskLock(`claim-${claimId}`, async () => {
      const claim = await this.findById(claimId);
      if (!claim) {
        throw new ClaimNotFoundError();
      }
      if (claim.workerId !== workerId) {
        throw new ForbiddenNotClaimOwnerError();
      }
      if (claim.isExpired(now)) {
        claim.expire(now);
        await this.save(claim);
        throw new ClaimExpiredError();
      }
      if (!claim.status.isInProgress()) {
        throw new ClaimNotInProgressError();
      }

      claim.submit(proofs, now);
      await this.save(claim);
      return claim;
    });
  }

  private async withTaskLock<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
    const prevLock = this.taskLocks.get(taskId) || Promise.resolve();
    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.taskLocks.set(taskId, prevLock.then(() => currentLock));

    try {
      await prevLock;
      return await fn();
    } finally {
      releaseLock!();
      if (this.taskLocks.get(taskId) === currentLock) {
        this.taskLocks.delete(taskId);
      }
    }
  }

  public clear(): void {
    this.claims.clear();
    this.taskLocks.clear();
  }
}
