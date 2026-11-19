import { TaskRepositoryPort } from '../../usecase/ports/task-repository.port';
import { FreelanceTask, TaskCategory } from '../../domain/entities/freelance-task.entity';
import { RewardCoins } from '../../domain/value-objects/reward-coins.vo';
import { Quota } from '../../domain/value-objects/quota.vo';
import { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { StepInstruction } from '../../domain/value-objects/step-instruction.vo';
import { ProofRequirement, ProofType } from '../../domain/value-objects/proof-requirement.vo';
import { TaskConcurrencyConflictError } from '../../shared/errors/task-errors';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma-client';

/**
 * Repository lưu trữ nhiệm vụ vào PostgreSQL qua Prisma ORM với cơ chế OCC (REQ-POST-025 & NFR-REL-001)
 */
export class PrismaTaskRepository implements TaskRepositoryPort {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  public async save(task: FreelanceTask): Promise<void> {
    const serializedSteps = task.getSteps().map((s) => s.toJSON());
    const serializedProofs = task.getProofRequirements().map((p) => ({
      id: p.getId(),
      proof_type: p.getProofType(),
      title: p.getTitle(),
      description: p.getDescription(),
      is_required: p.isRequiredProof(),
    }));

    await this.prisma.task.create({
      data: {
        id: task.getId(),
        creator_id: task.getCreatorId(),
        title: task.getTitle(),
        description: task.getDescription(),
        category: task.getCategory(),
        reward_coins: task.getRewardCoins().getValue(),
        quota: task.getQuota().getValue(),
        total_reward_coins: BigInt(task.getTotalRewardCoins()),
        steps: serializedSteps as any,
        proof_requirements: serializedProofs as any,
        execution_time_minutes: task.getExecutionTimeMinutes(),
        auto_approval_days: task.getAutoApprovalDays(),
        status: task.getStatus().getValue(),
        version: task.getVersion(),
        closed_at: task.getClosedAt(),
        grace_period_ends_at: task.getGracePeriodEndsAt(),
        created_at: task.getCreatedAt(),
        updated_at: task.getUpdatedAt(),
      },
    });
  }

  public async findById(id: string): Promise<FreelanceTask | null> {
    const row = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!row) {
      return null;
    }

    const rawSteps = (row.steps as any[]) || [];
    const steps = rawSteps.map((s) =>
      StepInstruction.create(s.step_number, s.instruction, s.target_url)
    );

    const rawProofs = (row.proof_requirements as any[]) || [];
    const proofRequirements = rawProofs.map((p) =>
      ProofRequirement.create({
        id: p.id,
        proofType: p.proof_type as ProofType,
        title: p.title,
        description: p.description,
        isRequired: p.is_required,
      })
    );

    return FreelanceTask.reconstitute({
      id: row.id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      category: row.category as TaskCategory,
      rewardCoins: RewardCoins.create(row.reward_coins),
      quota: Quota.create(row.quota),
      totalRewardCoins: Number(row.total_reward_coins),
      steps,
      proofRequirements,
      executionTimeMinutes: row.execution_time_minutes,
      autoApprovalDays: row.auto_approval_days,
      status: TaskStatus.fromString(row.status),
      version: row.version,
      closedAt: row.closed_at,
      gracePeriodEndsAt: row.grace_period_ends_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  public async update(task: FreelanceTask, expectedVersion: number): Promise<void> {
    const serializedSteps = task.getSteps().map((s) => s.toJSON());
    const serializedProofs = task.getProofRequirements().map((p) => ({
      id: p.getId(),
      proof_type: p.getProofType(),
      title: p.getTitle(),
      description: p.getDescription(),
      is_required: p.isRequiredProof(),
    }));

    // Optimistic Concurrency Control (OCC): Cập nhật có điều kiện theo id và expectedVersion
    const updateResult = await this.prisma.task.updateMany({
      where: {
        id: task.getId(),
        version: expectedVersion,
      },
      data: {
        title: task.getTitle(),
        description: task.getDescription(),
        category: task.getCategory(),
        reward_coins: task.getRewardCoins().getValue(),
        quota: task.getQuota().getValue(),
        total_reward_coins: BigInt(task.getTotalRewardCoins()),
        steps: serializedSteps as any,
        proof_requirements: serializedProofs as any,
        execution_time_minutes: task.getExecutionTimeMinutes(),
        auto_approval_days: task.getAutoApprovalDays(),
        status: task.getStatus().getValue(),
        version: task.getVersion(),
        closed_at: task.getClosedAt(),
        grace_period_ends_at: task.getGracePeriodEndsAt(),
        updated_at: task.getUpdatedAt(),
      },
    });

    if (updateResult.count === 0) {
      throw new TaskConcurrencyConflictError();
    }
  }
}

