import { FastifyInstance } from 'fastify';
import { TaskClaimController } from '../controllers/task-claim.controller';
import { requireWorkerAuth } from '../guards/worker-auth.guard';
import { authenticateUser } from '../guards/admin-auth.guard';

/**
 * Đăng ký các tuyến đường nhận việc giữ slot và hủy claim
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-009..017
 */
export function registerClaimRoutes(fastify: FastifyInstance, controller: TaskClaimController) {
  // 1. Nhận việc giữ slot (Yêu cầu vai trò WORKER - REQ-BCT-013)
  fastify.post('/api/v1/tasks/:id/claim', { preHandler: [requireWorkerAuth] }, controller.claimSlot);

  // 2. Worker chủ động hủy nhận việc (REQ-BCT-015)
  fastify.post('/api/v1/tasks/:id/claims/cancel', { preHandler: [authenticateUser] }, controller.cancelClaim);

  // 3. Lấy thông tin lượt giữ slot hiện tại của Worker
  fastify.get('/api/v1/tasks/:id/my-claim', { preHandler: [authenticateUser] }, controller.getMyClaim);
}

