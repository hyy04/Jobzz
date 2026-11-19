import { TaskRepositoryPort } from '../../usecase/ports/task-repository.port';
import { FreelanceTask, TaskCategory } from '../../domain/entities/freelance-task.entity';
import { RewardCoins } from '../../domain/value-objects/reward-coins.vo';
import { Quota } from '../../domain/value-objects/quota.vo';
import { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { StepInstruction } from '../../domain/value-objects/step-instruction.vo';
import { ProofRequirement } from '../../domain/value-objects/proof-requirement.vo';
import { TaskConcurrencyConflictError, TaskNotFoundError } from '../../shared/errors/task-errors';

/**
 * In-Memory Task Repository phục vụ chạy cục bộ / dev server khi chưa có DATABASE_URL
 */
export class InMemoryTaskRepository implements TaskRepositoryPort {
  private tasks = new Map<string, FreelanceTask>();
  private versions = new Map<string, number>();

  constructor(withSeedData = true) {
    if (withSeedData) {
      this.seedSampleTasks();
    }
  }

  public async save(task: FreelanceTask): Promise<void> {
    this.tasks.set(task.getId(), task);
    this.versions.set(task.getId(), task.getVersion());
  }

  public async findById(id: string): Promise<FreelanceTask | null> {
    return this.tasks.get(id) || null;
  }

  public async findAll(): Promise<FreelanceTask[]> {
    return Array.from(this.tasks.values()).reverse();
  }

  public async update(task: FreelanceTask, expectedVersion: number): Promise<void> {
    const currentDbVersion = this.versions.get(task.getId());
    if (currentDbVersion === undefined) {
      throw new TaskNotFoundError();
    }

    if (currentDbVersion !== expectedVersion) {
      throw new TaskConcurrencyConflictError();
    }

    this.tasks.set(task.getId(), task);
    this.versions.set(task.getId(), task.getVersion());
  }

  /**
   * Tạo sẵn 3 nhiệm vụ mẫu để người dùng trải nghiệm ngay trên giao diện
   */
  private seedSampleTasks(): void {
    // 1. Task Active
    const task1 = FreelanceTask.reconstitute({
      id: 'task-demo-001',
      creatorId: 'adm-001',
      title: 'Cài đặt ứng dụng Jobzz và đánh giá 5 sao',
      description: 'Tải ứng dụng Jobzz từ Google Play hoặc App Store, đăng nhập và để lại đánh giá 5 sao kèm nhận xét tích cực.',
      category: 'APP_INSTALL',
      rewardCoins: RewardCoins.create(5000),
      quota: Quota.create(100),
      totalRewardCoins: 500000,
      steps: [
        StepInstruction.create(1, 'Truy cập liên kết tải ứng dụng Jobzz', 'https://jobzz.vn/download', 'https://images.unsplash.com/photo-1616469829941-c7200edec809?w=600&auto=format&fit=crop&q=80'),
        StepInstruction.create(2, 'Cài đặt và mở ứng dụng, đăng ký tài khoản bằng số điện thoại'),
        StepInstruction.create(3, 'Đánh giá 5 sao trên App Store / CH Play'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'proof-1',
          proofType: 'SCREENSHOT_IMAGE',
          title: 'Ảnh chụp màn hình đánh giá',
          description: 'Chụp rõ tên tài khoản và đánh giá 5 sao đã hiển thị công khai',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 60,
      autoApprovalDays: 3,
      status: TaskStatus.fromString('ACTIVE'),
      version: 1,
      closedAt: null,
      gracePeriodEndsAt: null,
      createdAt: new Date(Date.now() - 3600000 * 2),
      updatedAt: new Date(Date.now() - 3600000 * 2),
    });

    // 2. Task Draft
    const task2 = FreelanceTask.reconstitute({
      id: 'task-demo-002',
      creatorId: 'adm-001',
      title: 'Tham gia khảo sát trải nghiệm người dùng quý 4',
      description: 'Hoàn thành bảng câu hỏi khảo sát trực tuyến gồm 10 câu hỏi ngắn về trải nghiệm việc làm freelance.',
      category: 'SURVEY',
      rewardCoins: RewardCoins.create(3000),
      quota: Quota.create(50),
      totalRewardCoins: 150000,
      steps: [
        StepInstruction.create(1, 'Truy cập biểu mẫu khảo sát chính thức', 'https://survey.jobzz.vn/q4'),
        StepInstruction.create(2, 'Điền đầy đủ 10 câu hỏi và ghi lại mã số hoàn thành ở trang cuối'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'proof-2',
          proofType: 'TEXT',
          title: 'Mã số hoàn thành khảo sát',
          description: 'Nhập mã gồm 8 ký tự xuất hiện tại màn hình cảm ơn',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 30,
      autoApprovalDays: 2,
      status: TaskStatus.fromString('DRAFT'),
      version: 1,
      closedAt: null,
      gracePeriodEndsAt: null,
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000),
    });

    // 3. Task Paused
    const task3 = FreelanceTask.reconstitute({
      id: 'task-demo-003',
      creatorId: 'adm-001',
      title: 'Đăng ký tài khoản ví điện tử đối tác PayFS',
      description: 'Mở tài khoản ví điện tử PayFS và thực hiện liên kết ngân hàng để nhận quà tặng đầu tiên.',
      category: 'ACCOUNT_REGISTRATION',
      rewardCoins: RewardCoins.create(10000),
      quota: Quota.create(20),
      totalRewardCoins: 200000,
      steps: [
        StepInstruction.create(1, 'Mở trang đăng ký ví PayFS', 'https://payfs.vn/register'),
        StepInstruction.create(2, 'Xác thực eKYC CMND/CCCD hợp lệ'),
      ],
      proofRequirements: [
        ProofRequirement.create({
          id: 'proof-3',
          proofType: 'SCREENSHOT_IMAGE',
          title: 'Ảnh chụp màn hình kích hoạt ví thành công',
          description: 'Chụp màn hình trang chủ PayFS đã hiển thị số dư ví',
          isRequired: true,
        }),
      ],
      executionTimeMinutes: 90,
      autoApprovalDays: 3,
      status: TaskStatus.fromString('PAUSED'),
      version: 2,
      closedAt: null,
      gracePeriodEndsAt: null,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 3600000 * 5),
    });

    this.save(task1);
    this.save(task2);
    this.save(task3);
  }
}
