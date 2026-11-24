import {
  TaskClaimRepositoryPort,
  SubmittedClaimsFilter,
  SubmittedClaimsResult,
} from '../../usecase/ports/task-claim-repository.port';
import { TaskClaim } from '../../domain/entities/task-claim.entity';
import { FreelanceTask } from '../../domain/entities/freelance-task.entity';
import { SubmittedProofItem } from '../../domain/value-objects/submitted-proof.vo';
import {
  TaskQuotaExhaustedError,
  ClaimNotFoundError,
  ForbiddenNotClaimOwnerError,
  ClaimNotInProgressError,
  ClaimExpiredError,
  SubmissionNotFoundError,
  TaskQuotaExceededError,
} from '../../shared/errors/claim-errors';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma-client';

/**
 * Repository lưu trữ lượt nhận việc TaskClaim vào PostgreSQL qua Prisma ORM
 * Hỗ trợ Atomic Transaction OCC chống Race Condition khi tranh suất cuối cùng và nộp bài
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-014
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-011
 */
export class PrismaTaskClaimRepository implements TaskClaimRepositoryPort {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  public async save(claim: TaskClaim): Promise<void> {
    const data = {
      id: claim.id,
      task_id: claim.taskId,
      worker_id: claim.workerId,
      status: claim.status.getValue(),
      claimed_at: claim.claimedAt,
      expires_at: claim.expiresAt,
      submitted_at: claim.submittedAt,
      submitted_proofs: claim.getSubmittedProofs().map((p) => p.toJSON()),
      completed_at: claim.completedAt,
      created_at: claim.createdAt,
      updated_at: claim.updatedAt,
    };

    await (this.prisma as any).taskClaim.upsert({
      where: { id: claim.id },
      create: data,
      update: data,
    });
  }

  public async findById(id: string): Promise<TaskClaim | null> {
    const raw = await (this.prisma as any).taskClaim.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return this.mapToDomain(raw);
  }

  public async findByTaskAndWorker(taskId: string, workerId: string): Promise<TaskClaim[]> {
    const list = await (this.prisma as any).taskClaim.findMany({
      where: {
        task_id: taskId,
        worker_id: workerId,
      },
      orderBy: { created_at: 'desc' },
    });
    return list.map((item: any) => this.mapToDomain(item));
  }

  public async findActiveClaim(taskId: string, workerId: string, now: Date): Promise<TaskClaim | null> {
    const raw = await (this.prisma as any).taskClaim.findFirst({
      where: {
        task_id: taskId,
        worker_id: workerId,
        status: 'IN_PROGRESS',
        expires_at: { gt: now },
      },
    });
    if (!raw) return null;
    return this.mapToDomain(raw);
  }

  public async countActiveClaims(taskId: string, now: Date): Promise<number> {
    return (this.prisma as any).taskClaim.count({
      where: {
        task_id: taskId,
        status: 'IN_PROGRESS',
        expires_at: { gt: now },
      },
    });
  }

  public async countSubmittedClaims(taskId: string): Promise<number> {
    return (this.prisma as any).taskClaim.count({
      where: {
        task_id: taskId,
        status: 'SUBMITTED',
      },
    });
  }

  public async countApprovedClaims(taskId: string): Promise<number> {
    return (this.prisma as any).taskClaim.count({
      where: {
        task_id: taskId,
        status: 'APPROVED',
      },
    });
  }

  public async claimSlotAtomic(
    task: FreelanceTask,
    workerId: string,
    executionTimeMinutes: number,
    now: Date
  ): Promise<TaskClaim> {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const activeCount = await tx.taskClaim.count({
        where: {
          task_id: task.getId(),
          status: 'IN_PROGRESS',
          expires_at: { gt: now },
        },
      });

      const submittedCount = await tx.taskClaim.count({
        where: {
          task_id: task.getId(),
          status: 'SUBMITTED',
        },
      });

      const approvedCount = await tx.taskClaim.count({
        where: {
          task_id: task.getId(),
          status: 'APPROVED',
        },
      });

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

      await tx.taskClaim.create({
        data: {
          id: newClaim.id,
          task_id: newClaim.taskId,
          worker_id: newClaim.workerId,
          status: newClaim.status.getValue(),
          claimed_at: newClaim.claimedAt,
          expires_at: newClaim.expiresAt,
          submitted_at: newClaim.submittedAt,
          submitted_proofs: newClaim.getSubmittedProofs().map((p) => p.toJSON()),
          completed_at: newClaim.completedAt,
          created_at: newClaim.createdAt,
          updated_at: newClaim.updatedAt,
        },
      });

      return newClaim;
    });
  }

  public async submitAtomic(
    claimId: string,
    workerId: string,
    proofs: SubmittedProofItem[],
    now: Date
  ): Promise<TaskClaim> {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const raw = await tx.taskClaim.findUnique({
        where: { id: claimId },
      });

      if (!raw) {
        throw new ClaimNotFoundError();
      }

      const claim = this.mapToDomain(raw);

      if (claim.workerId !== workerId) {
        throw new ForbiddenNotClaimOwnerError();
      }

      if (claim.isExpired(now)) {
        claim.expire(now);
        await tx.taskClaim.update({
          where: { id: claimId },
          data: {
            status: claim.status.getValue(),
            updated_at: claim.updatedAt,
          },
        });
        throw new ClaimExpiredError();
      }

      if (!claim.status.isInProgress()) {
        throw new ClaimNotInProgressError();
      }

      claim.submit(proofs, now);

      const updatedRaw = await tx.taskClaim.update({
        where: { id: claimId },
        data: {
          status: claim.status.getValue(),
          submitted_at: claim.submittedAt,
          submitted_proofs: claim.getSubmittedProofs().map((p) => p.toJSON()),
          updated_at: claim.updatedAt,
        },
      });

      return this.mapToDomain(updatedRaw);
    });
  }

  /**
   * Lấy danh sách bài nộp đang ở trạng thái SUBMITTED có phân trang và lọc theo task (FIFO)
   * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-001..003
   */
  public async findSubmittedClaims(filter: SubmittedClaimsFilter): Promise<SubmittedClaimsResult> {
    const where: any = { status: 'SUBMITTED' };
    if (filter.taskId) {
      where.task_id = filter.taskId;
    }

    const total = await (this.prisma as any).taskClaim.count({ where });
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, filter.limit || 10);
    const skip = (page - 1) * limit;

    const list = await (this.prisma as any).taskClaim.findMany({
      where,
      orderBy: { submitted_at: 'asc' }, // FIFO
      skip,
      take: limit,
    });

    return {
      claims: list.map((item: any) => this.mapToDomain(item)),
      total,
    };
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
    return (this.prisma as any).$transaction(async (tx: any) => {
      const raw = await tx.taskClaim.findUnique({
        where: { id: claimId },
      });
      if (!raw) {
        throw new SubmissionNotFoundError();
      }

      if (typeof taskQuota === 'number') {
        const approvedCount = await tx.taskClaim.count({
          where: {
            task_id: raw.task_id,
            status: 'APPROVED',
          },
        });
        if (approvedCount >= taskQuota) {
          throw new TaskQuotaExceededError();
        }
      }

      const claim = this.mapToDomain(raw);
      claim.approve(reviewerId, now);

      const updatedRaw = await tx.taskClaim.update({
        where: { id: claimId },
        data: {
          status: claim.status.getValue(),
          reviewer_id: claim.reviewerId,
          reviewed_at: claim.reviewedAt,
          completed_at: claim.completedAt,
          updated_at: claim.updatedAt,
        },
      });

      return this.mapToDomain(updatedRaw);
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
    return (this.prisma as any).$transaction(async (tx: any) => {
      const raw = await tx.taskClaim.findUnique({
        where: { id: claimId },
      });
      if (!raw) {
        throw new SubmissionNotFoundError();
      }

      const claim = this.mapToDomain(raw);
      claim.reject(reviewerId, rejectionReason, now);

      const updatedRaw = await tx.taskClaim.update({
        where: { id: claimId },
        data: {
          status: claim.status.getValue(),
          reviewer_id: claim.reviewerId,
          reviewed_at: claim.reviewedAt,
          completed_at: claim.completedAt,
          rejection_reason: claim.rejectionReason,
          updated_at: claim.updatedAt,
        },
      });

      return this.mapToDomain(updatedRaw);
    });
  }

  private mapToDomain(raw: any): TaskClaim {
    const rawProofs = raw.submitted_proofs || [];
    const submittedProofs = Array.isArray(rawProofs)
      ? rawProofs.map((p: any) =>
          SubmittedProofItem.reconstitute({
            requirementId: p.requirement_id || p.requirementId,
            proofType: p.proof_type || p.proofType,
            value: p.value,
          })
        )
      : [];

    return TaskClaim.reconstitute({
      id: raw.id,
      taskId: raw.task_id,
      workerId: raw.worker_id,
      status: raw.status,
      claimedAt: raw.claimed_at,
      expiresAt: raw.expires_at,
      submittedAt: raw.submitted_at,
      completedAt: raw.completed_at,
      reviewerId: raw.reviewer_id,
      reviewedAt: raw.reviewed_at,
      rejectionReason: raw.rejection_reason,
      submittedProofs,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    });
  }
}

