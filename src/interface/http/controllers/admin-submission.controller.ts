import { FastifyReply, FastifyRequest } from 'fastify';
import { ListSubmittedClaimsUseCase } from '../../../usecase/list-submitted-claims.usecase';
import { GetSubmissionDetailsUseCase } from '../../../usecase/get-submission-details.usecase';
import { ApproveTaskSubmissionUseCase } from '../../../usecase/approve-task-submission.usecase';
import { RejectTaskSubmissionUseCase } from '../../../usecase/reject-task-submission.usecase';
import {
  listSubmissionsQuerySchema,
  submissionParamSchema,
  rejectSubmissionBodySchema,
} from '../dto/admin-submission.dto';

/**
 * Controller xử lý các yêu cầu xét duyệt bài nộp cho Admin (REQ-RTS-001..018)
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-001..018
 */
export class AdminSubmissionController {
  constructor(
    private readonly listSubmittedClaimsUseCase: ListSubmittedClaimsUseCase,
    private readonly getSubmissionDetailsUseCase: GetSubmissionDetailsUseCase,
    private readonly approveTaskSubmissionUseCase: ApproveTaskSubmissionUseCase,
    private readonly rejectTaskSubmissionUseCase: RejectTaskSubmissionUseCase
  ) {}

  /**
   * GET /api/v1/admin/submissions
   * Truy vấn danh sách bài nộp đang ở trạng thái SUBMITTED
   */
  public async listSubmissions(request: FastifyRequest, reply: FastifyReply) {
    const query = listSubmissionsQuerySchema.parse(request.query);

    const result = await this.listSubmittedClaimsUseCase.execute({
      taskId: query.task_id,
      page: query.page,
      limit: query.limit,
    });

    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  }

  /**
   * GET /api/v1/admin/submissions/:claimId
   * Xem chi tiết bài nộp và các bằng chứng đối soát
   */
  public async getSubmissionDetails(request: FastifyRequest, reply: FastifyReply) {
    const params = submissionParamSchema.parse(request.params);

    const result = await this.getSubmissionDetailsUseCase.execute({
      claimId: params.claimId,
    });

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/v1/admin/submissions/:claimId/approve
   * Phê duyệt bài nộp, cộng Xu thưởng và tự động cập nhật trạng thái nhiệm vụ
   */
  public async approveSubmission(request: FastifyRequest, reply: FastifyReply) {
    const params = submissionParamSchema.parse(request.params);
    const adminId = request.user?.id || 'admin-root';

    const result = await this.approveTaskSubmissionUseCase.execute({
      claimId: params.claimId,
      adminId,
    });

    return reply.status(200).send({
      success: true,
      message: 'Phê duyệt bài nộp thành công. Xu thưởng đã được cộng vào ví của Worker.',
      data: result,
    });
  }

  /**
   * POST /api/v1/admin/submissions/:claimId/reject
   * Từ chối bài nộp, lưu lý do và giải phóng slot cho cộng đồng
   */
  public async rejectSubmission(request: FastifyRequest, reply: FastifyReply) {
    const params = submissionParamSchema.parse(request.params);
    const body = rejectSubmissionBodySchema.parse(request.body);
    const adminId = request.user?.id || 'admin-root';

    const result = await this.rejectTaskSubmissionUseCase.execute({
      claimId: params.claimId,
      adminId,
      rejectionReason: body.rejection_reason,
    });

    return reply.status(200).send({
      success: true,
      message: 'Đã từ chối bài nộp thành công. Suất làm việc đã được giải phóng để làm bù.',
      data: result,
    });
  }
}

