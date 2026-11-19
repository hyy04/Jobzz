import Fastify, { FastifyInstance } from 'fastify';
import { globalErrorHandler } from './interface/http/error-handler';
import { TaskController } from './interface/http/controllers/task.controller';
import { registerTaskRoutes } from './interface/http/routes/task.routes';
import { CreateFreelanceTaskUseCase } from './usecase/create-freelance-task.usecase';
import { UpdateFreelanceTaskUseCase } from './usecase/update-freelance-task.usecase';
import { ChangeTaskStatusUseCase } from './usecase/change-task-status.usecase';
import { GetFreelanceTaskDetailsUseCase } from './usecase/get-freelance-task-details.usecase';
import { TaskRepositoryPort } from './usecase/ports/task-repository.port';
import { TaskProgressPort } from './usecase/ports/task-progress.port';
import { TaskAuditLogPort } from './usecase/ports/task-audit-log.port';
import { PrismaTaskRepository } from './infra/repositories/prisma-task.repository';
import { PrismaTaskAuditLogRepository } from './infra/repositories/prisma-audit-log.repository';
import { StubTaskProgressAdapter } from './infra/adapters/stub-task-progress.adapter';

export interface BuildAppOptions {
  taskRepository?: TaskRepositoryPort;
  taskProgressPort?: TaskProgressPort;
  taskAuditLogPort?: TaskAuditLogPort;
}

/**
 * Khởi tạo Fastify Application Server với Clean Architecture DI
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: false,
  });

  // 1. Gắn bộ xử lý lỗi tập trung
  app.setErrorHandler(globalErrorHandler);

  // 2. Health Check
  app.get('/health', async () => ({
    status: 'UP',
    service: 'Jobzz Bounty Task Platform',
    timestamp: new Date().toISOString(),
  }));

  // 3. Khởi tạo Dependencies
  const taskRepo = options.taskRepository || new PrismaTaskRepository();
  const progressPort = options.taskProgressPort || new StubTaskProgressAdapter();
  const auditLogPort = options.taskAuditLogPort || new PrismaTaskAuditLogRepository();

  const createUseCase = new CreateFreelanceTaskUseCase(taskRepo, auditLogPort);
  const updateUseCase = new UpdateFreelanceTaskUseCase(taskRepo, progressPort, auditLogPort);
  const changeStatusUseCase = new ChangeTaskStatusUseCase(taskRepo, auditLogPort);
  const getDetailsUseCase = new GetFreelanceTaskDetailsUseCase(taskRepo, progressPort);

  const controller = new TaskController(
    createUseCase,
    updateUseCase,
    changeStatusUseCase,
    getDetailsUseCase
  );

  // 4. Đăng ký các tuyến đường API
  registerTaskRoutes(app, controller);

  return app;
}

