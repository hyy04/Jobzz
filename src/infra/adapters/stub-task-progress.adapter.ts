import { TaskProgressPort, TaskProgress } from '../../usecase/ports/task-progress.port';

/**
 * Stub Adapter cho TaskProgressPort (Q2 trong PLAN.md)
 * Cho phép kiểm thử usecase và integration mà không cần phụ thuộc vào module nộp bài
 * @ears .sdd/features/post-job/PLAN.md#2.1
 */
export class StubTaskProgressAdapter implements TaskProgressPort {
  private progressMap = new Map<string, TaskProgress>();

  public setProgress(taskId: string, progress: TaskProgress): void {
    this.progressMap.set(taskId, progress);
  }

  public async getProgress(taskId: string): Promise<TaskProgress> {
    const existing = this.progressMap.get(taskId);
    if (existing) {
      return { ...existing };
    }
    return {
      approved_count: 0,
      in_progress_count: 0,
    };
  }

  public clear(): void {
    this.progressMap.clear();
  }
}

