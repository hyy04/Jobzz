import { FastifyRequest, FastifyReply } from 'fastify';
import { ClaimTaskSlotUseCase } from '../../../usecase/claim-task-slot.usecase';
import { CancelTaskClaimUseCase } from '../../../usecase/cancel-task-claim.usecase';
import { TaskClaimRepositoryPort } from '../../../usecase/ports/task-claim-repository.port';
import { ClaimParamSchema } from '../dto/claim.dto';

/**
 * Controller điều phối các thao tác nhận việc và hủy slot của Worker
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-009..017
 */
export class TaskClaimController {
  constructor(
    private readonly claimUseCase: ClaimTaskSlotUseCase,
    private readonly cancelUseCase: CancelTaskClaimUseCase,
    private readonly claimRepo: TaskClaimRepositoryPort
  ) {}

  public claimSlot = async (request: FastifyRequest, reply: FastifyReply) => {
    const validatedParam = ClaimParamSchema.parse(request.params);
    const workerId = request.user?.id || 'anonymous-worker';
    const workerRole = request.user?.role || 'WORKER';

    const result = await this.claimUseCase.execute({
      taskId: validatedParam.id,
      workerId,
      workerRole,
    });

    return reply.status(201).send({ data: result });
  };

  public cancelClaim = async (request: FastifyRequest, reply: FastifyReply) => {
    const validatedParam = ClaimParamSchema.parse(request.params);
    const workerId = request.user?.id || 'anonymous-worker';

    const result = await this.cancelUseCase.execute({
      taskId: validatedParam.id,
      workerId,
    });

    return reply.status(200).send({ data: result });
  };

  public getMyClaim = async (request: FastifyRequest, reply: FastifyReply) => {
    const validatedParam = ClaimParamSchema.parse(request.params);
    const workerId = request.user?.id || 'anonymous-worker';
    const now = new Date();

    const activeClaim = await this.claimRepo.findActiveClaim(validatedParam.id, workerId, now);
    if (!activeClaim) {
      return reply.status(200).send({ data: null });
    }

    return reply.status(200).send({
      data: {
        claim_id: activeClaim.id,
        task_id: activeClaim.taskId,
        worker_id: activeClaim.workerId,
        status: activeClaim.status.getValue(),
        claimed_at: activeClaim.claimedAt,
        expires_at: activeClaim.expiresAt,
        remaining_seconds: activeClaim.getRemainingSeconds(now),
      },
    });
  };
}

