import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedCreatorError } from '../../../shared/errors/task-errors';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      role: string;
    };
  }
}

/**
 * Trích xuất định danh và vai trò người dùng từ HTTP Headers
 */
export async function authenticateUser(request: FastifyRequest, _reply: FastifyReply) {
  const userId =
    (request.headers['x-user-id'] as string) ||
    (request.headers['x-admin-id'] as string) ||
    'anonymous-user';

  const userRole =
    (request.headers['x-user-role'] as string)?.toUpperCase() || 'WORKER';

  request.user = {
    id: userId,
    role: userRole,
  };
}

/**
 * Guard bảo vệ endpoint dành riêng cho Quản trị viên (ADMIN)
 */
export async function requireAdminAuth(request: FastifyRequest, _reply: FastifyReply) {
  await authenticateUser(request, _reply);

  if (request.user?.role !== 'ADMIN') {
    throw new UnauthorizedCreatorError();
  }
}

