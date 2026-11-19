import { DomainError } from '../../shared/errors/domain.error';

export type ProofType = 'SCREENSHOT_IMAGE' | 'TEXT';

export class InvalidProofRequirementError extends DomainError {
  readonly errorCode = 'INVALID_PROOF_REQUIREMENT';
  readonly statusCode = 400;
  constructor(message = 'Tiêu đề bằng chứng phải từ 5-150 ký tự và mô tả phải từ 10-1,000 ký tự.') {
    super(message);
  }
}

/**
 * Value Object: ProofRequirement
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-011
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-012
 */
export class ProofRequirement {
  private constructor(
    private readonly id: string,
    private readonly proofType: ProofType,
    private readonly title: string,
    private readonly description: string,
    private readonly isRequired: boolean
  ) {}

  public static create(params: {
    id: string;
    proofType: ProofType;
    title: string;
    description: string;
    isRequired?: boolean;
  }): ProofRequirement {
    if (params.proofType !== 'SCREENSHOT_IMAGE' && params.proofType !== 'TEXT') {
      throw new InvalidProofRequirementError('Kiểu bằng chứng phải là SCREENSHOT_IMAGE hoặc TEXT.');
    }

    const trimmedTitle = (params.title || '').trim();
    if (trimmedTitle.length < 5 || trimmedTitle.length > 150) {
      throw new InvalidProofRequirementError('Tiêu đề bằng chứng phải từ 5 đến 150 ký tự.');
    }

    const trimmedDesc = (params.description || '').trim();
    if (trimmedDesc.length < 10 || trimmedDesc.length > 1000) {
      throw new InvalidProofRequirementError('Mô tả bằng chứng phải từ 10 đến 1,000 ký tự.');
    }

    return new ProofRequirement(
      params.id || crypto.randomUUID(),
      params.proofType,
      trimmedTitle,
      trimmedDesc,
      params.isRequired ?? true
    );
  }

  public getId(): string {
    return this.id;
  }

  public getProofType(): ProofType {
    return this.proofType;
  }

  public getTitle(): string {
    return this.title;
  }

  public getDescription(): string {
    return this.description;
  }

  public isRequiredProof(): boolean {
    return this.isRequired;
  }

  public isScreenshot(): boolean {
    return this.proofType === 'SCREENSHOT_IMAGE';
  }

  public toJSON() {
    return {
      id: this.id,
      proof_type: this.proofType,
      title: this.title,
      description: this.description,
      is_required: this.isRequired,
    };
  }
}

