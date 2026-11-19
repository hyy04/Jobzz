import { FreelanceTask, TaskCategory } from '../domain/entities/freelance-task.entity';
import { RewardCoins } from '../domain/value-objects/reward-coins.vo';
import { Quota } from '../domain/value-objects/quota.vo';
import { StepInstruction } from '../domain/value-objects/step-instruction.vo';
import { ProofRequirement, ProofType } from '../domain/value-objects/proof-requirement.vo';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { TaskAuditLogPort } from './ports/task-audit-log.port';
import { UnauthorizedCreatorError } from '../shared/errors/task-errors';

export interface CreateTaskStepInput {
  stepNumber: number;
  instruction: string;
  targetUrl?: string | null;
  imageUrl?: string | null;
}

export interface CreateTaskProofInput {
  id?: string;
  proofType: ProofType;
  title: string;
  description: string;
  isRequired?: boolean;
}

export interface CreateFreelanceTaskCommand {
  creatorId: string;
  creatorRole: string;
  title: string;
  description: string;
  category: TaskCategory;
  rewardCoins: number;
  quota: number;
  steps?: CreateTaskStepInput[];
  proofRequirements?: CreateTaskProofInput[];
  executionTimeMinutes?: number;
  autoApprovalDays?: number;
  autoPublish?: boolean;
}

/**
 * Use Case: Tạo nhiệm vụ Freelance vi mô mới
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-001
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-002
 */
export class CreateFreelanceTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepositoryPort,
    private readonly auditLogPort: TaskAuditLogPort
  ) {}

  public async execute(command: CreateFreelanceTaskCommand): Promise<FreelanceTask> {
    // 1. Kiểm tra vai trò bắt buộc phải là ADMIN (REQ-POST-002)
    if (command.creatorRole !== 'ADMIN') {
      throw new UnauthorizedCreatorError();
    }

    // 2. Chuyển đổi dữ liệu sang Value Objects
    const rewardCoins = RewardCoins.create(command.rewardCoins);
    const quota = Quota.create(command.quota);

    const steps = (command.steps || []).map((s) =>
      StepInstruction.create(s.stepNumber, s.instruction, s.targetUrl, s.imageUrl)
    );

    const proofRequirements = (command.proofRequirements || []).map((p) =>
      ProofRequirement.create({
        id: p.id || crypto.randomUUID(),
        proofType: p.proofType,
        title: p.title,
        description: p.description,
        isRequired: p.isRequired,
      })
    );

    // 3. Khởi tạo Entity Draft
    const task = FreelanceTask.createDraft({
      creatorId: command.creatorId,
      title: command.title,
      description: command.description,
      category: command.category,
      rewardCoins,
      quota,
      steps,
      proofRequirements,
      executionTimeMinutes: command.executionTimeMinutes,
      autoApprovalDays: command.autoApprovalDays,
    });

    // 4. Nếu yêu cầu xuất bản ngay lập tức
    if (command.autoPublish) {
      task.publish();
    }

    // 5. Lưu vào kho dữ liệu
    await this.taskRepository.save(task);

    // 6. Ghi Audit Log (SEC-01 & NFR-AUDIT-001)
    await this.auditLogPort.log({
      taskId: task.getId(),
      adminId: command.creatorId,
      action: command.autoPublish ? 'TASK_CREATED_AND_PUBLISHED' : 'TASK_DRAFT_CREATED',
      newValue: {
        title: task.getTitle(),
        reward_coins: task.getRewardCoins().getValue(),
        quota: task.getQuota().getValue(),
        status: task.getStatus().getValue(),
        version: task.getVersion(),
      },
      timestamp: new Date(),
    });

    return task;
  }
}

