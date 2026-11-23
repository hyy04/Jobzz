import { TaskClaimRepositoryPort } from './ports/task-claim-repository.port';
import { ClaimNotFoundError } from '../shared/errors/claim-errors';

export interface CancelTaskClaimInput {
  taskId: string;
  workerId: string;
  now?: Date;
}

export interface CancelTaskClaimOutput {
  success: boolean;
  message: string;
  status: string;
}

/**
 * Usecase hủy lượt nhận việc cho Người làm (Worker)
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-015..016
 */
export class CancelTaskClaimUseCase {
  constructor(private readonly claimRepo: TaskClaimRepositoryPort) {}

  public async execute(input: CancelTaskClaimInput): Promise<CancelTaskClaimOutput> {
    const now = input.now || new Date();

    // 1. REQ-BCT-016: Tìm lượt claim active còn hiệu lực của worker trên task
    const claim = await this.claimRepo.findActiveClaim(input.taskId, input.workerId, now);
    if (!claim) {
      throw new ClaimNotFoundError('Không tìm thấy lượt nhận việc hợp lệ để hủy.');
    }

    // 2. REQ-BCT-015: Hủy claim và lưu cập nhật
    claim.cancel(now);
    await this.claimRepo.save(claim);

    return {
      success: true,
      message: 'Đã hủy giữ slot nhận việc thành công, hoàn trả suất trống cho cộng đồng.',
      status: claim.status.getValue(),
    };
  }
}

