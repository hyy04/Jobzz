import { SecureUrl } from './secure-url.vo';
import { DomainError } from '../../shared/errors/domain.error';

export class InvalidStepInstructionError extends DomainError {
  readonly errorCode = 'INVALID_STEP_INSTRUCTION';
  readonly statusCode = 400;
  constructor(message = 'Nội dung bước hướng dẫn phải từ 10 đến 1,000 ký tự và thứ tự bước phải là số nguyên dương.') {
    super(message);
  }
}

/**
 * Value Object: StepInstruction
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-006
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-011
 */
export class StepInstruction {
  private constructor(
    private readonly stepNumber: number,
    private readonly instruction: string,
    private readonly targetUrl: SecureUrl | null,
    private readonly imageUrl: string | null = null
  ) {}

  public static create(
    stepNumber: number,
    instruction: string,
    rawUrl?: string | null,
    rawImageUrl?: string | null
  ): StepInstruction {
    if (!Number.isSafeInteger(stepNumber) || stepNumber < 1) {
      throw new InvalidStepInstructionError('Thứ tự bước phải là số nguyên dương từ 1 trở lên.');
    }

    const trimmedInstruction = (instruction || '').trim();
    if (trimmedInstruction.length < 10 || trimmedInstruction.length > 1000) {
      throw new InvalidStepInstructionError();
    }

    let secureUrl: SecureUrl | null = null;
    if (rawUrl && rawUrl.trim().length > 0) {
      secureUrl = SecureUrl.create(rawUrl);
    }

    let imageUrl: string | null = null;
    if (rawImageUrl && rawImageUrl.trim().length > 0) {
      imageUrl = rawImageUrl.trim();
    }

    return new StepInstruction(stepNumber, trimmedInstruction, secureUrl, imageUrl);
  }

  public getStepNumber(): number {
    return this.stepNumber;
  }

  public getInstruction(): string {
    return this.instruction;
  }

  public getTargetUrl(): string | null {
    return this.targetUrl ? this.targetUrl.getValue() : null;
  }

  public getImageUrl(): string | null {
    return this.imageUrl;
  }

  public toJSON() {
    return {
      step_number: this.stepNumber,
      instruction: this.instruction,
      target_url: this.getTargetUrl(),
      image_url: this.getImageUrl(),
    };
  }
}

