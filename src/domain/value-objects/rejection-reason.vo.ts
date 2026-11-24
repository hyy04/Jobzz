import { SubmissionRejectionReasonInvalidError } from '../../shared/errors/claim-errors';

/**
 * Value Object quản lý lý do từ chối bài nộp của Admin
 * Đảm bảo độ dài từ 10 đến 500 ký tự và loại bỏ các thẻ HTML / Script nguy hiểm (REQ-RTS-012..016)
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-012..016
 */
export class RejectionReason {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(rawReason: string): RejectionReason {
    if (!rawReason || typeof rawReason !== 'string') {
      throw new SubmissionRejectionReasonInvalidError('Lý do từ chối không được để trống.');
    }

    const trimmed = rawReason.trim();

    // Khử khuẩn thẻ HTML và Script để phòng chống tấn công XSS
    const sanitized = trimmed
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (sanitized.length < 10 || sanitized.length > 500) {
      throw new SubmissionRejectionReasonInvalidError(
        `Lý do từ chối phải có độ dài từ 10 đến 500 ký tự hợp lệ (hiện tại: ${sanitized.length} ký tự).`
      );
    }

    return new RejectionReason(sanitized);
  }

  public getValue(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }
}

