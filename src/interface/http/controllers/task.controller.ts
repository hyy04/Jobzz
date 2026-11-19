import { FastifyRequest, FastifyReply } from 'fastify';
import {
  CreateTaskDtoSchema,
  UpdateTaskDtoSchema,
  ChangeStatusDtoSchema,
} from '../dto/task.dto';
import { CreateFreelanceTaskUseCase } from '../../../usecase/create-freelance-task.usecase';
import { UpdateFreelanceTaskUseCase } from '../../../usecase/update-freelance-task.usecase';
import { ChangeTaskStatusUseCase } from '../../../usecase/change-task-status.usecase';
import { GetFreelanceTaskDetailsUseCase } from '../../../usecase/get-freelance-task-details.usecase';
import { FreelanceTask } from '../../../domain/entities/freelance-task.entity';

export function formatTaskResponse(task: FreelanceTask) {
  return {
    id: task.getId(),
    creator_id: task.getCreatorId(),
    title: task.getTitle(),
    description: task.getDescription(),
    category: task.getCategory(),
    reward_coins: task.getRewardCoins().getValue(),
    quota: task.getQuota().getValue(),
    total_reward_coins: task.getTotalRewardCoins(),
    steps: task.getSteps().map((s) => s.toJSON()),
    proof_requirements: task.getProofRequirements().map((p) => ({
      id: p.getId(),
      proof_type: p.getProofType(),
      title: p.getTitle(),
      description: p.getDescription(),
      is_required: p.isRequiredProof(),
    })),
    execution_time_minutes: task.getExecutionTimeMinutes(),
    auto_approval_days: task.getAutoApprovalDays(),
    status: task.getStatus().getValue(),
    version: task.getVersion(),
    closed_at: task.getClosedAt(),
    grace_period_ends_at: task.getGracePeriodEndsAt(),
    created_at: task.getCreatedAt(),
    updated_at: task.getUpdatedAt(),
  };
}

export class TaskController {
  constructor(
    private readonly createUseCase: CreateFreelanceTaskUseCase,
    private readonly updateUseCase: UpdateFreelanceTaskUseCase,
    private readonly changeStatusUseCase: ChangeTaskStatusUseCase,
    private readonly getDetailsUseCase: GetFreelanceTaskDetailsUseCase
  ) {}

  public createTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const validated = CreateTaskDtoSchema.parse(request.body);

    const task = await this.createUseCase.execute({
      creatorId: request.user?.id || 'adm-001',
      creatorRole: request.user?.role || 'ADMIN',
      title: validated.title,
      description: validated.description,
      category: validated.category,
      rewardCoins: validated.reward_coins,
      quota: validated.quota,
      steps: validated.steps.map((s) => ({
        stepNumber: s.step_number,
        instruction: s.instruction,
        targetUrl: s.target_url,
      })),
      proofRequirements: validated.proof_requirements.map((p) => ({
        id: p.id,
        proofType: p.proof_type,
        title: p.title,
        description: p.description,
        isRequired: p.is_required,
      })),
      executionTimeMinutes: validated.execution_time_minutes,
      autoApprovalDays: validated.auto_approval_days,
      autoPublish: validated.auto_publish,
    });

    return reply.status(201).send({
      success: true,
      data: formatTaskResponse(task),
    });
  };

  public getTaskDetails = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const result = await this.getDetailsUseCase.execute({
      taskId: id,
      requesterId: request.user?.id,
      requesterRole: request.user?.role,
    });

    return reply.status(200).send({
      success: true,
      data: {
        task: formatTaskResponse(result.task),
        progress: result.progress,
      },
    });
  };

  public updateTask = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const validated = UpdateTaskDtoSchema.parse(request.body);

    const task = await this.updateUseCase.execute({
      taskId: id,
      adminId: request.user?.id || 'adm-001',
      adminRole: request.user?.role || 'ADMIN',
      expectedVersion: validated.expected_version,
      title: validated.title,
      description: validated.description,
      category: validated.category,
      rewardCoins: validated.reward_coins,
      quota: validated.quota,
      steps: validated.steps?.map((s) => ({
        stepNumber: s.step_number,
        instruction: s.instruction,
        targetUrl: s.target_url,
      })),
      proofRequirements: validated.proof_requirements?.map((p) => ({
        id: p.id,
        proofType: p.proof_type,
        title: p.title,
        description: p.description,
        isRequired: p.is_required,
      })),
      executionTimeMinutes: validated.execution_time_minutes,
      autoApprovalDays: validated.auto_approval_days,
    });

    return reply.status(200).send({
      success: true,
      data: formatTaskResponse(task),
    });
  };

  public changeTaskStatus = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const validated = ChangeStatusDtoSchema.parse(request.body);

    const task = await this.changeStatusUseCase.execute({
      taskId: id,
      adminId: request.user?.id || 'adm-001',
      adminRole: request.user?.role || 'ADMIN',
      action: validated.action,
      expectedVersion: validated.expected_version,
    });

    return reply.status(200).send({
      success: true,
      data: formatTaskResponse(task),
    });
  };
}

