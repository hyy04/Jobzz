import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedWorkerError } from '../../../shared/errors/claim-errors';
import { authenticateUser } from './admin-auth.guard';

/**
 * Guard bảo vệ endpoint dành riêng cho Người làm (WORKER)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-013
 */
export async function requireWorkerAuth(request: FastifyRequest, reply: FastifyReply) {
  await authenticateUser(request, reply);

  if (request.user?.role !== 'WORKER') {
    throw new UnauthorizedWorkerError();
  }
}

