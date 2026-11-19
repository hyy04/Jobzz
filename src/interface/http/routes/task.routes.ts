import { FastifyInstance } from 'fastify';
import { TaskController } from '../controllers/task.controller';
import { requireAdminAuth, authenticateUser } from '../guards/admin-auth.guard';

export function registerTaskRoutes(fastify: FastifyInstance, controller: TaskController) {
  // 0. Lấy danh sách nhiệm vụ (Chỉ ADMIN - REQ-PUI-001)
  fastify.get(
    '/api/v1/tasks',
    { preHandler: [requireAdminAuth] },
    controller.listTasks
  );

  // 1. Tạo nhiệm vụ mới (Chỉ ADMIN)
  fastify.post(
    '/api/v1/tasks',
    { preHandler: [requireAdminAuth] },
    controller.createTask
  );

  // 2. Xem chi tiết nhiệm vụ (Admin hoặc Worker)
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/tasks/:id',
    { preHandler: [authenticateUser] },
    controller.getTaskDetails
  );

  // 3. Cập nhật nội dung / Quota (Chỉ ADMIN)
  fastify.patch<{ Params: { id: string } }>(
    '/api/v1/tasks/:id',
    { preHandler: [requireAdminAuth] },
    controller.updateTask
  );

  // 4. Chuyển đổi trạng thái nhiệm vụ (Chỉ ADMIN)
  fastify.post<{ Params: { id: string } }>(
    '/api/v1/tasks/:id/status',
    { preHandler: [requireAdminAuth] },
    controller.changeTaskStatus
  );
}

