import Fastify, { FastifyInstance } from 'fastify';
import { globalErrorHandler } from './interface/http/error-handler';
import { TaskController } from './interface/http/controllers/task.controller';
import { PublicTaskController } from './interface/http/controllers/public-task.controller';
import { TaskClaimController } from './interface/http/controllers/task-claim.controller';
import { ProofUploadController } from './interface/http/controllers/proof-upload.controller';
import { TaskSubmissionController } from './interface/http/controllers/task-submission.controller';
import { registerTaskRoutes } from './interface/http/routes/task.routes';
import { registerPublicTaskRoutes } from './interface/http/routes/public-task.routes';
import { registerClaimRoutes } from './interface/http/routes/claim.routes';
import { registerUploadRoutes } from './interface/http/routes/upload.routes';
import { registerSubmissionRoutes } from './interface/http/routes/submission.routes';
import { registerWebRoutes } from './interface/http/routes/web.routes';
import { CreateFreelanceTaskUseCase } from './usecase/create-freelance-task.usecase';
import { UpdateFreelanceTaskUseCase } from './usecase/update-freelance-task.usecase';
import { ChangeTaskStatusUseCase } from './usecase/change-task-status.usecase';
import { GetFreelanceTaskDetailsUseCase } from './usecase/get-freelance-task-details.usecase';
import { ListFreelanceTasksUseCase } from './usecase/list-freelance-tasks.usecase';
import { BrowsePublicTasksUseCase } from './usecase/browse-public-tasks.usecase';
import { GetPublicTaskDetailsUseCase } from './usecase/get-public-task-details.usecase';
import { ClaimTaskSlotUseCase } from './usecase/claim-task-slot.usecase';
import { CancelTaskClaimUseCase } from './usecase/cancel-task-claim.usecase';
import { UploadProofImageUseCase } from './usecase/upload-proof-image.usecase';
import { SubmitTaskProofUseCase } from './usecase/submit-task-proof.usecase';
import { GetClaimDetailsUseCase } from './usecase/get-claim-details.usecase';
import { TaskRepositoryPort } from './usecase/ports/task-repository.port';
import { TaskProgressPort } from './usecase/ports/task-progress.port';
import { TaskClaimRepositoryPort } from './usecase/ports/task-claim-repository.port';
import { TaskAuditLogPort } from './usecase/ports/task-audit-log.port';
import { StoragePort } from './usecase/ports/storage.port';
import { PrismaTaskRepository } from './infra/repositories/prisma-task.repository';
import { PrismaTaskClaimRepository } from './infra/repositories/prisma-task-claim.repository';
import { PrismaTaskAuditLogRepository } from './infra/repositories/prisma-audit-log.repository';
import { InMemoryTaskRepository } from './infra/repositories/in-memory-task.repository';
import { InMemoryTaskClaimRepository } from './infra/repositories/in-memory-task-claim.repository';
import { InMemoryTaskAuditLogRepository } from './infra/repositories/in-memory-audit-log.repository';
import { LocalStorageAdapter } from './infra/storage/local-storage.adapter';
import { LiveTaskProgressAdapter } from './infra/adapters/live-task-progress.adapter';

export interface BuildAppOptions {
  taskRepository?: TaskRepositoryPort;
  taskClaimRepository?: TaskClaimRepositoryPort;
  taskProgressPort?: TaskProgressPort;
  taskAuditLogPort?: TaskAuditLogPort;
  storagePort?: StoragePort;
  publicDir?: string;
}

/**
 * Khởi tạo Fastify Application Server với Clean Architecture DI
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: false,
  });

  // Hỗ trợ nhận body nhị phân cho các định dạng tệp ảnh tải lên
  app.addContentTypeParser(
    ['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

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
  const claimRepo =
    options.taskClaimRepository ||
    (usePrisma ? new PrismaTaskClaimRepository() : new InMemoryTaskClaimRepository());
  const progressPort =
    options.taskProgressPort || new LiveTaskProgressAdapter(claimRepo);
  const auditLogPort =
    options.taskAuditLogPort ||
    (usePrisma ? new PrismaTaskAuditLogRepository() : new InMemoryTaskAuditLogRepository());
  const storagePort =
    options.storagePort || new LocalStorageAdapter();

  const createUseCase = new CreateFreelanceTaskUseCase(taskRepo, auditLogPort);
  const updateUseCase = new UpdateFreelanceTaskUseCase(taskRepo, progressPort, auditLogPort);
  const changeStatusUseCase = new ChangeTaskStatusUseCase(taskRepo, auditLogPort);
  const getDetailsUseCase = new GetFreelanceTaskDetailsUseCase(taskRepo, progressPort);
  const listTasksUseCase = new ListFreelanceTasksUseCase(taskRepo);

  // Use cases cho browse-and-claim-task
  const browseUseCase = new BrowsePublicTasksUseCase(taskRepo, progressPort);
  const getPublicDetailsUseCase = new GetPublicTaskDetailsUseCase(taskRepo, progressPort);
  const claimUseCase = new ClaimTaskSlotUseCase(taskRepo, claimRepo);
  const cancelClaimUseCase = new CancelTaskClaimUseCase(claimRepo);

  // Use cases cho submit-task-proof
  const uploadUseCase = new UploadProofImageUseCase(storagePort);
  const submitUseCase = new SubmitTaskProofUseCase(claimRepo, taskRepo);
  const getClaimDetailsUseCase = new GetClaimDetailsUseCase(claimRepo, taskRepo);

  const controller = new TaskController(
    createUseCase,
    updateUseCase,
    changeStatusUseCase,
    getDetailsUseCase,
    listTasksUseCase
  );

  const publicController = new PublicTaskController(browseUseCase, getPublicDetailsUseCase);
  const claimController = new TaskClaimController(claimUseCase, cancelClaimUseCase, claimRepo);
  const uploadController = new ProofUploadController(uploadUseCase);
  const submissionController = new TaskSubmissionController(submitUseCase, getClaimDetailsUseCase);

  // 4. Đăng ký các tuyến đường API
  registerTaskRoutes(app, controller);
  registerPublicTaskRoutes(app, publicController);
  registerClaimRoutes(app, claimController);
  registerUploadRoutes(app, uploadController);
  registerSubmissionRoutes(app, submissionController);

  // 5. Đăng ký tuyến đường Web phục vụ giao diện tĩnh (REQ-PUI-021)
  registerWebRoutes(app, options.publicDir);

  return app;
}

