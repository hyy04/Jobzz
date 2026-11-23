import { FastifyInstance } from 'fastify';
import { ProofUploadController } from '../controllers/proof-upload.controller';
import { requireWorkerAuth } from '../guards/worker-auth.guard';

/**
 * Tuyến đường tải lên tệp ảnh bằng chứng nhiệm vụ
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-001..005
 */
export function registerUploadRoutes(fastify: FastifyInstance, controller: ProofUploadController) {
  fastify.post(
    '/api/v1/uploads/proof-image',
    { preHandler: [requireWorkerAuth] },
    controller.uploadProofImage
  );
}

