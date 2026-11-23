import { FastifyInstance } from 'fastify';
import { PublicTaskController } from '../controllers/public-task.controller';

/**
 * Đăng ký các tuyến đường xem và duyệt nhiệm vụ công khai
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-001..008
 */
export function registerPublicTaskRoutes(fastify: FastifyInstance, controller: PublicTaskController) {
  fastify.get('/api/v1/public/tasks', controller.browse);
  fastify.get('/api/v1/public/tasks/:id', controller.getDetails);
}

