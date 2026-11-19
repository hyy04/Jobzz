import { FreelanceTask, TaskCategory } from '../domain/entities/freelance-task.entity';
import { RewardCoins } from '../domain/value-objects/reward-coins.vo';
import { Quota } from '../domain/value-objects/quota.vo';
import { StepInstruction } from '../domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../domain/value-objects/proof-requirement.vo';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { TaskProgressPort } from './ports/task-progress.port';
import { TaskAuditLogPort } from './ports/task-audit-log.port';
import {
  UnauthorizedCreatorError,
  TaskNotFoundError,
  QuotaReductionConflictError,
} from '../shared/errors/task-errors';
import { CreateTaskStepInput, CreateTaskProofInput } from './create-freelance-task.usecase';

export interface UpdateFreelanceTaskCommand {
  taskId: string;
  adminId: string;
  adminRole: string;
  expectedVersion: number;
  title?: string;
  description?: string;
  category?: TaskCategory;
  rewardCoins?: number;
  quota?: number;
  steps?: CreateTaskStepInput[];
  proofRequirements?: CreateTaskProofInput[];
  executionTimeMinutes?: number;
  autoApprovalDays?: number;
}

/**
 * Use Case: Cập nhật thông tin nhiệm vụ Freelance
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-023
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-024
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-025
 */
export class UpdateFreelanceTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepositoryPort,
    private readonly taskProgressPort: TaskProgressPort,
    private readonly auditLogPort: TaskAuditLogPort
  ) {}

  public async execute(command: UpdateFreelanceTaskCommand): Promise<FreelanceTask> {
    // 1. Kiểm tra vai trò bắt buộc ADMIN (REQ-POST-002)
    if (command.adminRole !== 'ADMIN') {
      throw new UnauthorizedCreatorError();
    }

    // 2. Tìm nhiệm vụ theo ID
    const task = await this.taskRepository.findById(command.taskId);
    if (!task) {
      throw new TaskNotFoundError();
    }

    // 3. Sao lưu giá trị cũ phục vụ Audit Trail (SEC-01)
    const oldValues: Record<string, unknown> = {
      title: task.getTitle(),
      description: task.getDescription(),
      category: task.getCategory(),
      reward_coins: task.getRewardCoins().getValue(),
      quota: task.getQuota().getValue(),
      version: task.getVersion(),
    };

    // 4. Nếu cập nhật Quota, bắt buộc kiểm tra qua TaskProgressPort (ARCH-01 & REQ-POST-023)
    if (command.quota !== undefined) {
      const progress = await this.taskProgressPort.getProgress(command.taskId);
      const occupiedSlots = progress.approved_count + progress.in_progress_count;

      if (command.quota < occupiedSlots) {
        throw new QuotaReductionConflictError(
          `Không thể giảm quota xuống ${command.quota} vì đã có ${progress.approved_count} lượt hoàn thành và ${progress.in_progress_count} lượt đang thực hiện (tổng: ${occupiedSlots}).`
        );
      }

      task.updateQuota(Quota.create(command.quota));
    }

    // 5. Cập nhật các trường thông tin khác và kiểm tra Mutability khi ACTIVE (REQ-POST-024)
    const updateDetailsParams: Parameters<typeof task.updateDetails>[0] = {};

    if (command.title !== undefined) {
      updateDetailsParams.title = command.title;
    }
    if (command.description !== undefined) {
      updateDetailsParams.description = command.description;
    }
    if (command.category !== undefined) {
      updateDetailsParams.category = command.category;
    }
    if (command.rewardCoins !== undefined) {
      updateDetailsParams.rewardCoins = RewardCoins.create(command.rewardCoins);
    }
    if (command.steps !== undefined) {
      updateDetailsParams.steps = command.steps.map((s) =>
        StepInstruction.create(s.stepNumber, s.instruction, s.targetUrl)
      );
    }
    if (command.proofRequirements !== undefined) {
      updateDetailsParams.proofRequirements = command.proofRequirements.map((p) =>
        ProofRequirement.create({
          id: p.id || crypto.randomUUID(),
          proofType: p.proofType,
          title: p.title,
          description: p.description,
          isRequired: p.isRequired,
        })
      );
    }
    if (command.executionTimeMinutes !== undefined) {
      updateDetailsParams.executionTimeMinutes = command.executionTimeMinutes;
    }
    if (command.autoApprovalDays !== undefined) {
      updateDetailsParams.autoApprovalDays = command.autoApprovalDays;
    }

    if (Object.keys(updateDetailsParams).length > 0) {
      task.updateDetails(updateDetailsParams);
    }

    // 6. Lưu vào kho dữ liệu với kiểm tra OCC
    await this.taskRepository.update(task, command.expectedVersion);

    // 7. Ghi Audit Log với diff cũ và mới (SEC-01 & NFR-AUDIT-001)
    const newValues: Record<string, unknown> = {
      title: task.getTitle(),
      description: task.getDescription(),
      category: task.getCategory(),
      reward_coins: task.getRewardCoins().getValue(),
      quota: task.getQuota().getValue(),
      version: task.getVersion(),
    };

    await this.auditLogPort.log({
      taskId: task.getId(),
      adminId: command.adminId,
      action: 'TASK_UPDATED',
      oldValue: oldValues,
      newValue: newValues,
      timestamp: new Date(),
    });

    return task;
  }
}

