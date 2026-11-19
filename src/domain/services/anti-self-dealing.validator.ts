import { SelfDealingForbiddenError } from '../../shared/errors/task-errors';

/**
 * Domain Service: AntiSelfDealingValidator
 * Chống tự gian lận: Người tạo nhiệm vụ không được phép tự làm bài hoặc tự nhận slot.
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-026
 * @ears .sdd/features/post-job/SPEC.md#REQ-POST-027
 */
export class AntiSelfDealingValidator {
  /**
   * Kiểm tra và ném lỗi SelfDealingForbiddenError nếu worker trùng creator
   * @param creatorId Định danh người tạo nhiệm vụ
   * @param workerId Định danh người dùng nhận slot/làm bài
   */
  public static validate(creatorId: string, workerId: string): void {
    if (!creatorId || !workerId) {
      return;
    }

    if (creatorId.trim() === workerId.trim()) {
      throw new SelfDealingForbiddenError();
    }
  }

  /**
   * Trả về true nếu worker_id trùng creator_id
   */
  public static isSelfDealing(creatorId: string, workerId: string): boolean {
    if (!creatorId || !workerId) {
      return false;
    }
    return creatorId.trim() === workerId.trim();
  }
}

