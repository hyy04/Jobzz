import { TaskClaimRepositoryPort } from './ports/task-claim-repository.port';
import { TaskRepositoryPort } from './ports/task-repository.port';
import { SubmittedProofItem } from '../domain/value-objects/submitted-proof.vo';
import { XssSanitizer } from '../shared/utils/xss-sanitizer';
import {
  ClaimNotFoundError,
  ForbiddenNotClaimOwnerError,
  ClaimNotInProgressError,
  ClaimExpiredError,
  MissingRequiredProofsError,
  InvalidProofRequirementIdError,
  InvalidProofValueError,
} from '../shared/errors/claim-errors';

export interface SubmitProofItemInput {
  requirementId: string;
  value: string;
}

export interface SubmitTaskProofCommand {
  claimId: string;
  workerId: string;
  proofs: SubmitProofItemInput[];
  now?: Date;
}

export interface SubmitTaskProofResult {
  claimId: string;
  taskId: string;
  status: string;
  submittedAt: Date;
  proofsCount: number;
}

/**
 * UseCase: SubmitTaskProofUseCase
 * Xử lý nộp bằng chứng hoàn thành nhiệm vụ cho Worker
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-006..018
 */
export class SubmitTaskProofUseCase {
  constructor(
    private readonly claimRepository: TaskClaimRepositoryPort,
    private readonly taskRepository: TaskRepositoryPort
  ) {}

  public async execute(command: SubmitTaskProofCommand): Promise<SubmitTaskProofResult> {
    const now = command.now || new Date();

    // 1. Kiểm tra tồn tại của lượt nhận việc
    const claim = await this.claimRepository.findById(command.claimId);
    if (!claim) {
      throw new ClaimNotFoundError();
    }

    // 2. Kiểm tra quyền sở hữu slot
    if (claim.workerId !== command.workerId) {
      throw new ForbiddenNotClaimOwnerError();
    }

    // 3. Kiểm tra hết hạn
    if (claim.isExpired(now)) {
      claim.expire(now);
      await this.claimRepository.save(claim);
      throw new ClaimExpiredError();
    }

    // 4. Kiểm tra trạng thái IN_PROGRESS
    if (!claim.status.isInProgress()) {
      throw new ClaimNotInProgressError();
    }

    // 5. Kiểm tra nhiệm vụ
    const task = await this.taskRepository.findById(claim.taskId);
    if (!task) {
      throw new Error(`Nhiệm vụ liên kết với claim [${claim.taskId}] không tồn tại.`);
    }

    // 6. Đối chiếu yêu cầu bằng chứng của nhiệm vụ
    const requirements = task.getProofRequirements();
    const reqMap = new Map(requirements.map((r) => [r.getId(), r]));

    // 6.1 Kiểm tra xem có requirementId nào không thuộc nhiệm vụ không
    for (const item of command.proofs) {
      if (!reqMap.has(item.requirementId)) {
        throw new InvalidProofRequirementIdError(
          `Mã yêu cầu bằng chứng [${item.requirementId}] không tồn tại trong nhiệm vụ.`
        );
      }
    }

    // Map các proof gửi lên theo requirementId
    const submittedMap = new Map(command.proofs.map((p) => [p.requirementId, p.value]));

    // 6.2 Kiểm tra 100% bằng chứng bắt buộc (is_required === true)
    for (const req of requirements) {
      if (req.isRequiredProof()) {
        const val = submittedMap.get(req.getId());
        if (!val || !val.trim()) {
          throw new MissingRequiredProofsError(
            `Bắt buộc nộp bằng chứng cho yêu cầu: "${req.getTitle()}".`
          );
        }
      }
    }

    // 6.3 Tạo SubmittedProofItem với validation và XSS sanitization
    const submittedProofItems: SubmittedProofItem[] = [];
    for (const item of command.proofs) {
      const req = reqMap.get(item.requirementId);
      if (!req) continue;

      let cleanValue = (item.value || '').trim();
      if (req.getProofType() === 'TEXT') {
        cleanValue = XssSanitizer.sanitize(cleanValue);
        if (cleanValue.length < 1 || cleanValue.length > 500) {
          throw new InvalidProofValueError('Nội dung văn bản bằng chứng phải từ 1 đến 500 ký tự.');
        }
      } else if (req.getProofType() === 'SCREENSHOT_IMAGE') {
        const isUrl = /^(https?:\/\/|\/uploads\/|\/public\/uploads\/).+/i.test(cleanValue);
        if (!isUrl) {
          throw new InvalidProofValueError('Đường dẫn ảnh bằng chứng không hợp lệ.');
        }
      }

      submittedProofItems.push(
        SubmittedProofItem.create({
          requirementId: item.requirementId,
          proofType: req.getProofType(),
          value: cleanValue,
        })
      );
    }

    // 7. Atomic OCC Submit qua repository
    const updatedClaim = await this.claimRepository.submitAtomic(
      command.claimId,
      command.workerId,
      submittedProofItems,
      now
    );

    return {
      claimId: updatedClaim.id,
      taskId: updatedClaim.taskId,
      status: updatedClaim.status.getValue(),
      submittedAt: updatedClaim.submittedAt!,
      proofsCount: submittedProofItems.length,
    };
  }
}

