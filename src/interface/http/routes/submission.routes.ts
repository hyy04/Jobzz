import { FastifyInstance } from 'fastify';
import { TaskSubmissionController } from '../controllers/task-submission.controller';
import { requireWorkerAuth } from '../guards/worker-auth.guard';

/**
 * Tuyến đường nộp bằng chứng và truy vấn chi tiết bài nộp
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-006..018
 */
export function registerSubmissionRoutes(
  fastify: FastifyInstance,
  controller: TaskSubmissionController
) {
  // 1. Nộp bằng chứng nhiệm vụ (REQ-STP-006..014)
  fastify.post(
    '/api/v1/claims/:claimId/submit',
    { preHandler: [requireWorkerAuth] },
    controller.submitProof
  );

  // 2. Truy vấn chi tiết lượt claim và bằng chứng (REQ-STP-015)
  fastify.get(
    '/api/v1/claims/:claimId',
    { preHandler: [requireWorkerAuth] },
    controller.getClaimDetails
  );
}

