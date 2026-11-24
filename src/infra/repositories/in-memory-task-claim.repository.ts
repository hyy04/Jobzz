import { TaskClaim } from '../../domain/entities/task-claim.entity';
import { FreelanceTask } from '../../domain/entities/freelance-task.entity';
import {
  TaskClaimRepositoryPort,
  SubmittedClaimsFilter,
  SubmittedClaimsResult,
} from '../../usecase/ports/task-claim-repository.port';
import {
  TaskQuotaExhaustedError,
  ClaimNotFoundError,
  ForbiddenNotClaimOwnerError,
  ClaimExpiredError,
  ClaimNotInProgressError,
  SubmissionNotFoundError,
  TaskQuotaExceededError,
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

  constructor(withSeedData = false) {
    if (withSeedData) {
      this.seedSampleClaims();
    }
  }

  private seedSampleClaims(): void {
    const now = new Date();

    // 1. Bài nộp mẫu 1: Đầy đủ ảnh chụp màn hình chứng minh
    const claim1 = TaskClaim.create({
      id: 'claim-demo-001',
      taskId: 'task-demo-001',
      workerId: 'worker-nam-nguyen',
      executionTimeMinutes: 120,
      now: new Date(now.getTime() - 20 * 60 * 1000),
    });
    claim1.submit([
      SubmittedProofItem.create({
        requirementId: 'proof-1',
        proofType: 'SCREENSHOT_IMAGE',
        value: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop&q=80',
      }),
    ], new Date(now.getTime() - 10 * 60 * 1000));
    this.claims.set(claim1.id, claim1);

    // 2. Bài nộp mẫu 2: Đang chờ duyệt từ Worker khác
    const claim2 = TaskClaim.create({
      id: 'claim-demo-002',
      taskId: 'task-demo-001',
      workerId: 'worker-thao-le',
      executionTimeMinutes: 120,
      now: new Date(now.getTime() - 15 * 60 * 1000),
    });
    claim2.submit([
      SubmittedProofItem.create({
        requirementId: 'proof-1',
        proofType: 'SCREENSHOT_IMAGE',
        value: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&auto=format&fit=crop&q=80',
      }),
    ], new Date(now.getTime() - 5 * 60 * 1000));
    this.claims.set(claim2.id, claim2);
  }

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
   * Lấy danh sách bài nộp đang ở trạng thái SUBMITTED có phân trang và lọc theo task (FIFO)
   * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-001..003
   */
  public async findSubmittedClaims(filter: SubmittedClaimsFilter): Promise<SubmittedClaimsResult> {
    const list: TaskClaim[] = [];
    for (const claim of this.claims.values()) {
      if (claim.status.isSubmitted()) {
        if (!filter.taskId || claim.taskId === filter.taskId) {
          list.push(claim);
        }
      }
    }

    // Sắp xếp FIFO theo submitted_at ASC (cũ nhất trước)
    list.sort((a, b) => {
      const timeA = a.submittedAt ? a.submittedAt.getTime() : 0;
      const timeB = b.submittedAt ? b.submittedAt.getTime() : 0;
      return timeA - timeB;
    });

    const total = list.length;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, filter.limit || 10);
    const startIndex = (page - 1) * limit;
    const claims = list.slice(startIndex, startIndex + limit);

    return { claims, total };
  }

  /**
   * Xem chi tiết bài nộp theo claimId
   * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-004..005
   */
  public async findSubmissionDetails(claimId: string): Promise<TaskClaim | null> {
    return this.findById(claimId);
  }

  /**
   * Phê duyệt bài nộp một cách nguyên tử có khóa bảo vệ (Atomic Approve OCC)
   * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-007..011, REQ-RTS-018
   */
  public async approveAtomic(
    claimId: string,
    reviewerId: string,
    now: Date,
    taskQuota?: number
  ): Promise<TaskClaim> {
    const claim = await this.findById(claimId);
    if (!claim) {
      throw new SubmissionNotFoundError();
    }

    return this.withTaskLock(`task-review-${claim.taskId}`, async () => {
      // Re-fetch claim để đảm bảo không bị race condition
      const currentClaim = await this.findById(claimId);
      if (!currentClaim) {
        throw new SubmissionNotFoundError();
      }

      // Khóa an toàn hạn ngạch: Nếu có taskQuota thì kiểm tra số lượng đã approved
      if (typeof taskQuota === 'number') {
        const approvedCount = await this.countApprovedClaims(currentClaim.taskId);
        if (approvedCount >= taskQuota) {
          throw new TaskQuotaExceededError();
        }
      }

      currentClaim.approve(reviewerId, now);
      await this.save(currentClaim);
      return currentClaim;
    });
  }

  /**
   * Từ chối bài nộp một cách nguyên tử có khóa bảo vệ (Atomic Reject OCC)
   * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-012..016, REQ-RTS-018
   */
  public async rejectAtomic(
    claimId: string,
    reviewerId: string,
    rejectionReason: string,
    now: Date
  ): Promise<TaskClaim> {
    return this.withTaskLock(`claim-${claimId}`, async () => {
      const claim = await this.findById(claimId);
      if (!claim) {
        throw new SubmissionNotFoundError();
      }

      claim.reject(reviewerId, rejectionReason, now);
      await this.save(claim);
      return claim;
    });
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
