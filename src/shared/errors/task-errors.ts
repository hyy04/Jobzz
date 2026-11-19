import { DomainError } from './domain.error';

export class UnauthorizedCreatorError extends DomainError {
  readonly errorCode = 'FORBIDDEN';
  readonly statusCode = 403;
  constructor(message = 'Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền tạo hoặc chỉnh sửa nhiệm vụ.') {
    super(message);
  }
}

export class SelfDealingForbiddenError extends DomainError {
  readonly errorCode = 'SELF_DEALING_FORBIDDEN';
  readonly statusCode = 400;
  constructor(message = 'Người tạo nhiệm vụ không được phép tự nhận slot hoặc tự nộp bằng chứng cho chính nhiệm vụ của mình.') {
    super(message);
  }
}

export class InvalidRewardCoinsError extends DomainError {
  readonly errorCode = 'INVALID_REWARD_COINS';
  readonly statusCode = 400;
  constructor(message = 'Mức thưởng Xu (reward_coins) phải là số nguyên dương trong khoảng từ 1 đến 500,000 Xu.') {
    super(message);
  }
}

export class InvalidQuotaError extends DomainError {
  readonly errorCode = 'INVALID_QUOTA';
  readonly statusCode = 400;
  constructor(message = 'Số lượng người tuyển (quota) phải là số nguyên dương trong khoảng từ 1 đến 10,000 lượt.') {
    super(message);
  }
}

export class TotalRewardCoinsOverflowError extends DomainError {
  readonly errorCode = 'REWARD_OVERFLOW';
  readonly statusCode = 400;
  constructor(message = 'Tổng ngân sách Xu (quota * reward_coins) không được vượt quá 5,000,000,000 Xu.') {
    super(message);
  }
}

export class InsecureUrlError extends DomainError {
  readonly errorCode = 'INSECURE_URL_PROTOCOL';
  readonly statusCode = 400;
  constructor(message = 'Đường dẫn liên kết (target_url) bắt buộc phải sử dụng giao thức bảo mật https://.') {
    super(message);
  }
}

export class ProhibitedContentDetectedError extends DomainError {
  readonly errorCode = 'PROHIBITED_CONTENT';
  readonly statusCode = 400;
  constructor(message = 'Nội dung nhiệm vụ vi phạm Chính sách nội dung cấm (lừa đảo nạp tiền, mã độc, cờ bạc, khiêu dâm).') {
    super(message);
  }
}

export class IncompleteTaskPublicationError extends DomainError {
  readonly errorCode = 'INCOMPLETE_TASK_CONFIG';
  readonly statusCode = 400;
  constructor(message = 'Nhiệm vụ phải có ít nhất 1 bước hướng dẫn và 1 yêu cầu bằng chứng trước khi xuất bản.') {
    super(message);
  }
}

export class ExceededProofRequirementsLimitError extends DomainError {
  readonly errorCode = 'PROOF_LIMIT_EXCEEDED';
  readonly statusCode = 400;
  constructor(message = 'Nhiệm vụ chỉ được phép có tối đa 5 yêu cầu bằng chứng (trong đó tối đa 3 ảnh chụp màn hình).') {
    super(message);
  }
}

export class InvalidStateTransitionError extends DomainError {
  readonly errorCode = 'INVALID_STATE_TRANSITION';
  readonly statusCode = 400;
  constructor(message = 'Chuyển đổi trạng thái không hợp lệ theo Ma trận trạng thái nhiệm vụ.') {
    super(message);
  }
}

export class ImmutableFieldModificationError extends DomainError {
  readonly errorCode = 'IMMUTABLE_FIELD_MODIFICATION';
  readonly statusCode = 400;
  constructor(message = 'Không được phép giảm mức thưởng Xu hoặc thay đổi tiêu chí bằng chứng khi nhiệm vụ đang ACTIVE.') {
    super(message);
  }
}

export class QuotaReductionConflictError extends DomainError {
  readonly errorCode = 'QUOTA_REDUCTION_CONFLICT';
  readonly statusCode = 400;
  constructor(message = 'Không thể giảm quota xuống thấp hơn tổng số lượt đã hoàn thành và số lượt đang thực hiện.') {
    super(message);
  }
}

export class TaskConcurrencyConflictError extends DomainError {
  readonly errorCode = 'CONCURRENCY_CONFLICT';
  readonly statusCode = 409;
  constructor(message = 'Xung đột phiên chỉnh sửa đồng thời (OCC version mismatch). Vui lòng tải lại dữ liệu mới nhất.') {
    super(message);
  }
}

export class TaskNotFoundError extends DomainError {
  readonly errorCode = 'TASK_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy nhiệm vụ theo mã định danh yêu cầu.') {
    super(message);
  }
}

