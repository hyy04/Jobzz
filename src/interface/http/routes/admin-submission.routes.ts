import { FastifyInstance } from 'fastify';
import { AdminSubmissionController } from '../controllers/admin-submission.controller';
import { requireAdminAuth } from '../guards/admin-auth.guard';

/**
 * Đăng ký các tuyến đường API xét duyệt bài nộp cho Quản trị viên (Admin)
 * Toàn bộ các endpoints được bảo vệ chặt chẽ bằng requireAdminAuth (REQ-RTS-006)
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-001..018
 */
export function registerAdminSubmissionRoutes(
  app: FastifyInstance,
  controller: AdminSubmissionController
) {
  // 1. Danh sách bài nộp chờ duyệt (REQ-RTS-001..003)
  app.get(
    '/api/v1/admin/submissions',
    { preHandler: [requireAdminAuth] },
    controller.listSubmissions.bind(controller)
  );

  // 2. Chi tiết bài nộp và danh sách bằng chứng đối soát (REQ-RTS-004..005)
  app.get(
    '/api/v1/admin/submissions/:claimId',
    { preHandler: [requireAdminAuth] },
    controller.getSubmissionDetails.bind(controller)
  );

  // 3. Phê duyệt bài nộp & cộng Xu thưởng (REQ-RTS-007..011)
  app.post(
    '/api/v1/admin/submissions/:claimId/approve',
    { preHandler: [requireAdminAuth] },
    controller.approveSubmission.bind(controller)
  );

  // 4. Từ chối bài nộp & giải phóng slot (REQ-RTS-012..016)
  app.post(
    '/api/v1/admin/submissions/:claimId/reject',
    { preHandler: [requireAdminAuth] },
    controller.rejectSubmission.bind(controller)
  );
}

