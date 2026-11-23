import { TaskProgressPort, TaskProgress } from '../../usecase/ports/task-progress.port';
import { TaskClaimRepositoryPort } from '../../usecase/ports/task-claim-repository.port';

/**
 * Adapter thời gian thực kết nối TaskProgressPort với TaskClaimRepositoryPort
 * Áp dụng Lazy Evaluation và Quota Preservation:
 * Đếm các slot IN_PROGRESS còn hạn và các slot SUBMITTED đang chờ duyệt
 * @ears .sdd/features/browse-and-claim-task/SPEC.md#REQ-BCT-017
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-SUB-016
 */
export class LiveTaskProgressAdapter implements TaskProgressPort {
  constructor(
    private readonly claimRepository: TaskClaimRepositoryPort,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  public async getProgress(taskId: string): Promise<TaskProgress> {
    const now = this.nowProvider();
    const active_count = await this.claimRepository.countActiveClaims(taskId, now);
    const submitted_count = await this.claimRepository.countSubmittedClaims(taskId);
    const approved_count = await this.claimRepository.countApprovedClaims(taskId);

    return {
      approved_count,
      // in_progress_count phản ánh toàn bộ các slot đang chiếm dụng (chưa hoàn tất duyệt) để bảo toàn quota
      in_progress_count: active_count + submitted_count,
      submitted_count,
    };
  }
}
