import Fastify, { FastifyInstance } from 'fastify';
import { globalErrorHandler } from './interface/http/error-handler';
import { TaskController } from './interface/http/controllers/task.controller';
import { registerTaskRoutes } from './interface/http/routes/task.routes';
import { registerWebRoutes } from './interface/http/routes/web.routes';
import { CreateFreelanceTaskUseCase } from './usecase/create-freelance-task.usecase';
import { UpdateFreelanceTaskUseCase } from './usecase/update-freelance-task.usecase';
import { ChangeTaskStatusUseCase } from './usecase/change-task-status.usecase';
import { GetFreelanceTaskDetailsUseCase } from './usecase/get-freelance-task-details.usecase';
import { ListFreelanceTasksUseCase } from './usecase/list-freelance-tasks.usecase';
import { TaskRepositoryPort } from './usecase/ports/task-repository.port';
import { TaskProgressPort } from './usecase/ports/task-progress.port';
import { TaskAuditLogPort } from './usecase/ports/task-audit-log.port';
import { PrismaTaskRepository } from './infra/repositories/prisma-task.repository';
import { PrismaTaskAuditLogRepository } from './infra/repositories/prisma-audit-log.repository';
import { InMemoryTaskRepository } from './infra/repositories/in-memory-task.repository';
import { InMemoryTaskAuditLogRepository } from './infra/repositories/in-memory-audit-log.repository';
import { StubTaskProgressAdapter } from './infra/adapters/stub-task-progress.adapter';

export interface BuildAppOptions {
  taskRepository?: TaskRepositoryPort;
  taskProgressPort?: TaskProgressPort;
  taskAuditLogPort?: TaskAuditLogPort;
  publicDir?: string;
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
  // Tự động fallback sang InMemory nếu DATABASE_URL chưa được cấu hình ở máy dev cục bộ
  const usePrisma = Boolean(process.env.DATABASE_URL);
  const taskRepo =
    options.taskRepository ||
    (usePrisma ? new PrismaTaskRepository() : new InMemoryTaskRepository(true));
  const progressPort = options.taskProgressPort || new StubTaskProgressAdapter();
  const auditLogPort =
    options.taskAuditLogPort ||
    (usePrisma ? new PrismaTaskAuditLogRepository() : new InMemoryTaskAuditLogRepository());

  const createUseCase = new CreateFreelanceTaskUseCase(taskRepo, auditLogPort);
  const updateUseCase = new UpdateFreelanceTaskUseCase(taskRepo, progressPort, auditLogPort);
  const changeStatusUseCase = new ChangeTaskStatusUseCase(taskRepo, auditLogPort);
  const getDetailsUseCase = new GetFreelanceTaskDetailsUseCase(taskRepo, progressPort);
  const listTasksUseCase = new ListFreelanceTasksUseCase(taskRepo);

  const controller = new TaskController(
    createUseCase,
    updateUseCase,
    changeStatusUseCase,
    getDetailsUseCase,
    listTasksUseCase
  );

  // 4. Đăng ký các tuyến đường API
  registerTaskRoutes(app, controller);

  // 5. Đăng ký tuyến đường Web phục vụ giao diện tĩnh (REQ-PUI-021)
  registerWebRoutes(app, options.publicDir);

  return app;
}

