import { DomainError } from '../../shared/errors/domain.error';
import { ProofType } from './proof-requirement.vo';

export class InvalidSubmittedProofError extends DomainError {
  readonly errorCode = 'INVALID_PROOF_VALUE';
  readonly statusCode = 400;
  constructor(message = 'Giá trị bằng chứng không hợp lệ.') {
    super(message);
  }
}

export interface SubmittedProofProps {
  requirementId: string;
  proofType: ProofType;
  value: string;
}

/**
 * Value Object: SubmittedProofItem
 * Biểu diễn một mục bằng chứng đối soát do Worker gửi lên
 * @ears .sdd/features/submit-task-proof/SPEC.md#51-cau-truc-du-lieu-bang-chung-nop-submittedproofitem
 */
export class SubmittedProofItem {
  private constructor(
    private readonly _requirementId: string,
    private readonly _proofType: ProofType,
    private readonly _value: string
  ) {}

  public static create(props: SubmittedProofProps): SubmittedProofItem {
    if (!props.requirementId || !props.requirementId.trim()) {
      throw new InvalidSubmittedProofError('Mã yêu cầu bằng chứng (requirement_id) không được để trống.');
    }

    if (props.proofType !== 'SCREENSHOT_IMAGE' && props.proofType !== 'TEXT') {
      throw new InvalidSubmittedProofError('Loại bằng chứng phải là SCREENSHOT_IMAGE hoặc TEXT.');
    }

    const trimmedValue = (props.value || '').trim();
    if (!trimmedValue) {
      throw new InvalidSubmittedProofError('Nội dung bằng chứng không được để trống.');
    }

    if (props.proofType === 'TEXT') {
      if (trimmedValue.length < 1 || trimmedValue.length > 500) {
        throw new InvalidSubmittedProofError('Bằng chứng văn bản phải có độ dài từ 1 đến 500 ký tự.');
      }
    } else if (props.proofType === 'SCREENSHOT_IMAGE') {
      const isUrl = /^(https?:\/\/|\/uploads\/|\/public\/uploads\/).+/i.test(trimmedValue);
      if (!isUrl) {
        throw new InvalidSubmittedProofError('Đường dẫn ảnh bằng chứng không hợp lệ.');
      }
    }

    return new SubmittedProofItem(props.requirementId.trim(), props.proofType, trimmedValue);
  }

  public static reconstitute(props: SubmittedProofProps): SubmittedProofItem {
    return new SubmittedProofItem(props.requirementId, props.proofType, props.value);
  }

  public get requirementId(): string {
    return this._requirementId;
  }

  public get proofType(): ProofType {
    return this._proofType;
  }

  public get value(): string {
    return this._value;
  }

  public toJSON() {
    return {
      requirement_id: this._requirementId,
      proof_type: this._proofType,
      value: this._value,
    };
  }
}
