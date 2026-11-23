import { FastifyRequest, FastifyReply } from 'fastify';
import { SubmitTaskProofUseCase } from '../../../usecase/submit-task-proof.usecase';
import { GetClaimDetailsUseCase } from '../../../usecase/get-claim-details.usecase';
import { SubmitProofBodyDtoSchema, ClaimParamDtoSchema } from '../dto/submit-proof.dto';

/**
 * Controller xử lý nộp bằng chứng và truy vấn chi tiết lượt claim
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-006..018
 */
export class TaskSubmissionController {
  constructor(
    private readonly submitUseCase: SubmitTaskProofUseCase,
    private readonly getClaimDetailsUseCase: GetClaimDetailsUseCase
  ) {}

  public submitProof = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = ClaimParamDtoSchema.parse(request.params);
    const body = SubmitProofBodyDtoSchema.parse(request.body);
    const workerId = request.user?.id || 'anonymous-worker';

    const result = await this.submitUseCase.execute({
      claimId: params.claimId,
      workerId,
      proofs: body.proofs.map((p) => ({
        requirementId: p.requirement_id,
        value: p.value,
      })),
    });

    return reply.status(200).send({
      data: {
        claim_id: result.claimId,
        task_id: result.taskId,
        status: result.status,
        submitted_at: result.submittedAt,
        proofs_count: result.proofsCount,
      },
    });
  };

  public getClaimDetails = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = ClaimParamDtoSchema.parse(request.params);
    const workerId = request.user?.id || 'anonymous-worker';

    const result = await this.getClaimDetailsUseCase.execute({
      claimId: params.claimId,
      workerId,
    });

    return reply.status(200).send({
      data: {
        claim_id: result.id,
        task_id: result.taskId,
        worker_id: result.workerId,
        status: result.status,
        claimed_at: result.claimedAt,
        expires_at: result.expiresAt,
        remaining_seconds: result.remainingSeconds,
        submitted_at: result.submittedAt,
        submitted_proofs: result.submittedProofs.map((p) => ({
          requirement_id: p.requirementId,
          proof_type: p.proofType,
          value: p.value,
        })),
        task: result.task
          ? {
              id: result.task.id,
              title: result.task.title,
              description: result.task.description,
              reward_coins: result.task.rewardCoins,
              quota: result.task.quota,
              proof_requirements: result.task.proofRequirements.map((r) => ({
                id: r.id,
                proof_type: r.proofType,
                title: r.title,
                description: r.description,
                is_required: r.isRequired,
              })),
            }
          : null,
      },
    });
  };
}

