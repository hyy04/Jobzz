import { DomainError } from './domain.error';

/**
 * Các lỗi miền nghiệp vụ cho tính năng browse-and-claim-task & submit-task-proof
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#6-ma-tran-xu-ly-loi-rfc-7807
 * @ears .sdd/features/submit-task-proof/SPEC.md#6-xu-ly-loi--ma-tran-loi-rfc-7807-error-matrix
 */

export class TaskNotAvailableForClaimError extends DomainError {
  readonly errorCode = 'TASK_NOT_AVAILABLE_FOR_CLAIM';
  readonly statusCode = 400;
  constructor(message = 'Nhiệm vụ hiện tại không khả dụng để nhận việc (trạng thái khác ACTIVE).') {
    super(message);
  }
}

export class TaskQuotaExhaustedError extends DomainError {
  readonly errorCode = 'TASK_QUOTA_EXHAUSTED';
  readonly statusCode = 409;
  constructor(message = 'Nhiệm vụ đã hết số lượng suất nhận việc khả dụng.') {
    super(message);
  }
}

export class EmployerCannotClaimOwnTaskError extends DomainError {
  readonly errorCode = 'EMPLOYER_CANNOT_CLAIM_OWN_TASK';
  readonly statusCode = 403;
  constructor(message = 'Người tạo nhiệm vụ không được phép tự nhận việc của chính mình.') {
    super(message);
  }
}

export class WorkerAlreadyClaimedTaskError extends DomainError {
  readonly errorCode = 'WORKER_ALREADY_CLAIMED_TASK';
  readonly statusCode = 409;
  constructor(message = 'Bạn đã có một lượt nhận việc đang thực hiện hoặc đã hoàn thành trên nhiệm vụ này.') {
    super(message);
  }
}

export class UnauthorizedWorkerError extends DomainError {
  readonly errorCode = 'UNAUTHORIZED_WORKER';
  readonly statusCode = 403;
  constructor(message = 'Chỉ tài khoản Người làm (WORKER) mới có quyền nhận việc giữ slot.') {
    super(message);
  }
}

export class ClaimNotFoundError extends DomainError {
  readonly errorCode = 'CLAIM_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy thông tin lượt nhận việc yêu cầu.') {
    super(message);
  }
}

export class ClaimAlreadyClosedError extends DomainError {
  readonly errorCode = 'CLAIM_ALREADY_CLOSED';
  readonly statusCode = 400;
  constructor(message = 'Lượt nhận việc đã đóng hoặc không ở trạng thái IN_PROGRESS để thực hiện thao tác này.') {
    super(message);
  }
}

export class InvalidClaimStatusTransitionError extends DomainError {
  readonly errorCode = 'INVALID_CLAIM_STATUS_TRANSITION';
  readonly statusCode = 400;
  constructor(fromStatus: string, toStatus: string) {
    super(`Không thể chuyển đổi trạng thái lượt nhận việc từ [${fromStatus}] sang [${toStatus}].`);
  }
}

// Các lỗi cho tính năng submit-task-proof
export class InvalidFileTypeError extends DomainError {
  readonly errorCode = 'INVALID_FILE_TYPE';
  readonly statusCode = 400;
  constructor(message = 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PNG, JPEG, WebP.') {
    super(message);
  }
}

export class FileTooLargeError extends DomainError {
  readonly errorCode = 'FILE_TOO_LARGE';
  readonly statusCode = 413;
  constructor(message = 'Dung lượng tệp vượt quá giới hạn tối đa 5MB.') {
    super(message);
  }
}

export class MissingFileError extends DomainError {
  readonly errorCode = 'MISSING_FILE';
  readonly statusCode = 400;
  constructor(message = 'Không tìm thấy tệp ảnh tải lên trong yêu cầu.') {
    super(message);
  }
}

export class ForbiddenNotClaimOwnerError extends DomainError {
  readonly errorCode = 'FORBIDDEN_NOT_CLAIM_OWNER';
  readonly statusCode = 403;
  constructor(message = 'Bạn không có quyền nộp bằng chứng cho lượt nhận việc của người khác.') {
    super(message);
  }
}

export class ClaimExpiredError extends DomainError {
  readonly errorCode = 'CLAIM_EXPIRED';
  readonly statusCode = 400;
  constructor(message = 'Thời gian giữ slot đã hết hạn. Bạn không thể nộp bài.') {
    super(message);
  }
}

export class ClaimNotInProgressError extends DomainError {
  readonly errorCode = 'CLAIM_NOT_IN_PROGRESS';
  readonly statusCode = 409;
  constructor(message = 'Lượt nhận việc không ở trạng thái IN_PROGRESS để nộp bài.') {
    super(message);
  }
}

export class MissingRequiredProofsError extends DomainError {
  readonly errorCode = 'MISSING_REQUIRED_PROOFS';
  readonly statusCode = 400;
  constructor(message = 'Vui lòng nộp đầy đủ 100% các bằng chứng bắt buộc.') {
    super(message);
  }
}

export class InvalidProofRequirementIdError extends DomainError {
  readonly errorCode = 'INVALID_PROOF_REQUIREMENT_ID';
  readonly statusCode = 400;
  constructor(message = 'Mã yêu cầu bằng chứng không tồn tại trong nhiệm vụ.') {
    super(message);
  }
}

export class InvalidProofValueError extends DomainError {
  readonly errorCode = 'INVALID_PROOF_VALUE';
  readonly statusCode = 400;
  constructor(message = 'Nội dung bằng chứng không hợp lệ (URL ảnh không đúng hoặc văn bản ngoài 1-500 ký tự).') {
    super(message);
  }
}
