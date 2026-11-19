# Kế hoạch kiến trúc: Đăng việc / Nhiệm vụ Freelance tự do (post-job)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: post-job
# Depth: DETAILED
# Architecture Profile: v1.1.0 (APPROVED — Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Methodology Profile: Depth=DETAILED, Risk=elevated, Review Route=N/A, Decision Owner=Admin

---

## 1. Phương cận kiến trúc (Architectural Approach)

Kế hoạch kiến trúc tuân thủ nghiêm ngặt **Clean Architecture / Hexagonal Architecture** theo `CONSTITUTION.md` (`ARCH-01`) và các technology bindings đã được Human Reviewer phê duyệt trong `.sdd/architecture-profile.md`:

- **Kiến trúc phân tầng 4 lớp độc lập:**
  1. **Domain Layer (`src/domain/`):** Chứa thực thể cốt lõi `FreelanceTask`, các Value Objects bất biến (`Quota`, `RewardCoins`, `StepInstruction`, `ProofRequirement`, `SecureUrl`, `TaskStatus`) và Domain Events. Tầng này là TypeScript thuần túy, **100% không phụ thuộc** vào Fastify, Prisma, Zod hay bất kỳ thư viện thứ ba nào.
  2. **Use Case Layer (`src/usecase/`):** Chứa các luồng nghiệp vụ ứng dụng: `CreateFreelanceTaskUseCase`, `UpdateFreelanceTaskUseCase`, `ChangeTaskStatusUseCase`, `GetFreelanceTaskDetailsUseCase`. Giao tiếp với thế giới bên ngoài thông qua các Application Ports trừu tượng (`TaskRepositoryPort`, `TaskProgressPort`, `TaskAuditLogPort`).
  3. **Interface Layer (`src/interface/`):** Sử dụng **Fastify** làm HTTP Transport. Xây dựng Fastify Routes, Controllers, Presenters và DTO Schemas sử dụng **Zod** để validate và sanitize dữ liệu đầu vào ngay tại transport boundary.
  4. **Infrastructure Layer (`src/infra/`):** Triển khai các Ports thông qua **Prisma ORM** kết nối **PostgreSQL**. Bảng dữ liệu quản lý các trường số học an toàn, lưu trữ `steps` và `proof_requirements` dưới dạng JSONB có cấu trúc; lưu vết Audit Log bất biến.
  5. **Shared Layer (`src/shared/`):** Quản lý Typed Errors, Error Handler chuẩn hóa (`ENG-02`), Logger và tiện ích bảo mật.

---

## 2. Ánh xạ Yêu cầu sang Thành phần (REQ-to-Component Mapping)

| Mã yêu cầu | Mô tả tóm tắt | Thành phần đảm nhiệm (Component) | Tầng kiến trúc (Layer) | File path dự kiến |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-POST-001` | Tạo bản nháp task | `CreateFreelanceTaskUseCase` | Usecase | `src/usecase/create-freelance-task.usecase.ts` |
| `REQ-POST-002` | Chặn tạo việc nếu không phải Admin | `AdminAuthGuard` / Controller | Interface | `src/interface/http/guards/admin-auth.guard.ts` |
| `REQ-POST-003` | Ràng buộc reward_coins 1..500k Xu | `RewardCoins` (Value Object) | Domain | `src/domain/value-objects/reward-coins.vo.ts` |
| `REQ-POST-004` | Ràng buộc quota 1..10,000 lượt | `Quota` (Value Object) | Domain | `src/domain/value-objects/quota.vo.ts` |
| `REQ-POST-005` | Chống tràn số: total <= 5 tỷ Xu | `TaskBoundsValidator` / Domain Entity | Domain | `src/domain/entities/freelance-task.entity.ts` |
| `REQ-POST-006` | Bắt buộc URL HTTPS-only | `SecureUrl` (Value Object) | Domain | `src/domain/value-objects/secure-url.vo.ts` |
| `REQ-POST-007` | Từ chối URL không an toàn (http/js) | `SecureUrl` (Value Object) | Domain | `src/domain/value-objects/secure-url.vo.ts` |
| `REQ-POST-008` | Khử nhiễm XSS trong text | `XssSanitizer` / Zod DTO | Shared / Interface | `src/shared/utils/xss-sanitizer.ts` |
| `REQ-POST-009` | Chặn nội dung vi phạm chính sách | `ContentPolicyValidator` | Domain | `src/domain/services/content-policy.validator.ts` |
| `REQ-POST-010` | Xuất bản task sang ACTIVE | `ChangeTaskStatusUseCase` | Usecase | `src/usecase/change-task-status.usecase.ts` |
| `REQ-POST-011` | Chặn xuất bản khi thiếu step/proof | `FreelanceTask.publish()` | Domain | `src/domain/entities/freelance-task.entity.ts` |
| `REQ-POST-012` | Giới hạn proofs <= 5, screenshots <= 3 | `ProofRequirement` list validation | Domain | `src/domain/entities/freelance-task.entity.ts` |
| `REQ-POST-013` | Cấp slot khi task ACTIVE | `TaskStatus.isActive()` | Domain | `src/domain/value-objects/task-status.vo.ts` |
| `REQ-POST-014` | Tạm dừng tuyển (ACTIVE -> PAUSED) | `ChangeTaskStatusUseCase` | Usecase | `src/usecase/change-task-status.usecase.ts` |
| `REQ-POST-015` | Mở lại tuyển (PAUSED -> ACTIVE) | `ChangeTaskStatusUseCase` | Usecase | `src/usecase/change-task-status.usecase.ts` |
| `REQ-POST-016` | Tự động chuyển COMPLETED khi đủ quota | `FreelanceTask.checkCompletion()` | Domain | `src/domain/entities/freelance-task.entity.ts` |
| `REQ-POST-017` | Mở rộng quota (COMPLETED -> ACTIVE) | `UpdateFreelanceTaskUseCase` | Usecase | `src/usecase/update-freelance-task.usecase.ts` |
| `REQ-POST-018` | Đóng task với ân hạn 24h | `ChangeTaskStatusUseCase` | Usecase | `src/usecase/change-task-status.usecase.ts` |
| `REQ-POST-019` | Tự động hủy slot quá 24h khi CLOSED | `TaskGracePeriodService` | Usecase / Scheduler | `src/usecase/task-grace-period.service.ts` |
| `REQ-POST-020` | Kiểm tra Ma trận trạng thái | `TaskStateMachine` | Domain | `src/domain/value-objects/task-status.vo.ts` |
| `REQ-POST-021` | Sửa text/URL khi đang ACTIVE | `UpdateFreelanceTaskUseCase` | Usecase | `src/usecase/update-freelance-task.usecase.ts` |
| `REQ-POST-022` | Kiểm tra quota an toàn qua Port | `TaskProgressPort` / Usecase | Usecase / Port | `src/usecase/ports/task-progress.port.ts` |
| `REQ-POST-023` | Chặn giảm quota dưới approved+progress | `UpdateFreelanceTaskUseCase` | Usecase | `src/usecase/update-freelance-task.usecase.ts` |
| `REQ-POST-024` | Chặn giảm Xu / đổi proof khi ACTIVE | `FreelanceTask.updateDetails()` | Domain | `src/domain/entities/freelance-task.entity.ts` |
| `REQ-POST-025` | Khóa lạc quan chống xung đột OCC | `PrismaTaskRepository` (version check)| Infra | `src/infra/database/prisma-task.repository.ts` |
| `REQ-POST-026` | Cấm Admin tự cày Xu (Anti-Self-Dealing)| `AntiSelfDealingValidator` | Domain / Usecase | `src/domain/services/anti-self-dealing.validator.ts` |
| `REQ-POST-027` | Chặn worker_id == creator_id | `AntiSelfDealingValidator` | Domain / Usecase | `src/domain/services/anti-self-dealing.validator.ts` |

---

## 3. Danh mục các Thành phần chi tiết (Components)

### 3.1 Domain Layer (`src/domain/`)
- **`FreelanceTask` (`src/domain/entities/freelance-task.entity.ts`):** Thực thể gốc (Aggregate Root), quản lý toàn bộ vòng đời, trạng thái, tính toán tổng ngân sách Xu, kiểm tra điều kiện xuất bản và quy tắc mutability khi đang ACTIVE.
- **`RewardCoins` (`src/domain/value-objects/reward-coins.vo.ts`):** Value Object đảm bảo mức Xu thưởng là số nguyên an toàn trong đoạn $[1, 500000]$.
- **`Quota` (`src/domain/value-objects/quota.vo.ts`):** Value Object đảm bảo chỉ tiêu số lượt là số nguyên an toàn trong đoạn $[1, 10000]$.
- **`SecureUrl` (`src/domain/value-objects/secure-url.vo.ts`):** Value Object đảm bảo URL hợp lệ và bắt buộc bắt đầu bằng `https://`.
- **`TaskStatus` (`src/domain/value-objects/task-status.vo.ts`):** Enum & State Machine quản lý chuyển đổi trạng thái giữa `DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CLOSED`.
- **`StepInstruction` (`src/domain/value-objects/step-instruction.vo.ts`):** Value Object biểu diễn bước hướng dẫn với thứ tự và URL đích.
- **`ProofRequirement` (`src/domain/value-objects/proof-requirement.vo.ts`):** Value Object định nghĩa tiêu chuẩn bằng chứng (`SCREENSHOT_IMAGE` hoặc `TEXT`).
- **`Domain Errors` (`src/domain/errors/`):** 14 lớp lỗi nghiệp vụ chuẩn hóa theo `SPEC.md` Section 6.

### 3.2 Use Case Layer (`src/usecase/`)
- **`CreateFreelanceTaskUseCase` (`src/usecase/create-freelance-task.usecase.ts`):** Nhận input từ Admin, khởi tạo `FreelanceTask`, lưu qua `TaskRepositoryPort`, ghi log qua `TaskAuditLogPort`.
- **`UpdateFreelanceTaskUseCase` (`src/usecase/update-freelance-task.usecase.ts`):** Xử lý chỉnh sửa thông tin khi task đang DRAFT hoặc ACTIVE; khi đổi quota, gọi `TaskProgressPort.getProgress(taskId)` để kiểm tra an toàn; kiểm tra `version` OCC.
- **`ChangeTaskStatusUseCase` (`src/usecase/change-task-status.usecase.ts`):** Xử lý Publish, Pause, Resume, Close task; ghi Audit Log bất biến.
- **`GetFreelanceTaskDetailsUseCase` (`src/usecase/get-freelance-task-details.usecase.ts`):** Lấy thông tin chi tiết nhiệm vụ cho Admin hoặc Worker (chỉ xem khi ACTIVE).
- **Application Ports (`src/usecase/ports/`):**
  - `TaskRepositoryPort`: Lưu và truy vấn `FreelanceTask`.
  - `TaskProgressPort`: Lấy số lượng `{ approved_count, in_progress_count }`.
  - `TaskAuditLogPort`: Ghi nhật ký kiểm toán.

### 3.3 Interface Layer (`src/interface/`)
- **Fastify Plugin & Routes (`src/interface/http/routes/task.routes.ts`):**
  - `POST /api/v1/tasks`: Tạo nhiệm vụ mới (Draft).
  - `PUT /api/v1/tasks/:id`: Cập nhật thông tin nhiệm vụ.
  - `PATCH /api/v1/tasks/:id/status`: Chuyển đổi trạng thái (`publish`, `pause`, `resume`, `close`).
  - `GET /api/v1/tasks/:id`: Lấy chi tiết nhiệm vụ.
- **Zod DTO Schemas (`src/interface/http/dto/task.dto.ts`):** Kiểm tra schema payload đầu vào trước khi vào controller.
- **Fastify Error Handler (`src/interface/http/error-handler.ts`):** Map Typed Errors sang schema `{ error_code, message, request_id, timestamp }` theo `CONSTITUTION.md` (`ENG-02`).

### 3.4 Infrastructure Layer (`src/infra/`)
- **Prisma Schema (`prisma/schema.prisma`):** Định nghĩa bảng `Task` và `TaskAuditLog`.
- **`PrismaTaskRepository` (`src/infra/database/prisma-task.repository.ts`):** Triển khai `TaskRepositoryPort`, thực thi chuyển đổi giữa Prisma Model và Domain Entity, xử lý version check (OCC).
- **`PrismaTaskAuditLogRepository` (`src/infra/database/prisma-audit-log.repository.ts`):** Triển khai `TaskAuditLogPort` (append-only).
- **`StubTaskProgressAdapter` (`src/infra/adapters/stub-task-progress.adapter.ts`):** Triển khai `TaskProgressPort` phục vụ testing/mocking ban đầu cho đến khi module submissions hoàn thành.

---

## 4. Luồng dữ liệu (Data Flow)

### 4.1 Luồng tạo nhiệm vụ mới (`POST /api/v1/tasks`) — `REQ-POST-001..009`
```text
[Client / Admin]
       │
       ▼ (1) HTTP POST /api/v1/tasks (Payload: title, category, quota, reward_coins, steps, proofs)
[Fastify Route & AdminAuthGuard]
       │  (2) Xác thực vai trò Admin (REQ-POST-002)
       ▼
[Zod TaskInputSchema]
       │  (3) Validate format & sanitize XSS (REQ-POST-008)
       ▼
[TaskController]
       │  (4) Gọi CreateFreelanceTaskUseCase.execute(command)
       ▼
[CreateFreelanceTaskUseCase]
       │  (5) Tạo Value Objects: Quota, RewardCoins, SecureUrl (REQ-POST-003, 004, 006)
       │  (6) Khởi tạo Entity FreelanceTask (Kiểm tra bounds, total_reward_coins <= 5B) (REQ-POST-005)
       │  (7) Gọi TaskRepositoryPort.save(task)
       │  (8) Gọi TaskAuditLogPort.recordStatusChange(...)
       ▼
[PrismaTaskRepository & Database (PostgreSQL)]
       │  (9) Lưu record Task (version = 1, status = DRAFT)
       ▼
[Response JSON] (HTTP 201 Created)
```

### 4.2 Luồng xuất bản nhiệm vụ (`PATCH /api/v1/tasks/:id/status` -> `publish`) — `REQ-POST-010..012`
```text
[Client / Admin]
       │
       ▼ (1) HTTP PATCH /api/v1/tasks/:id/status (Body: { action: "publish" })
[TaskController] -> [ChangeTaskStatusUseCase]
       │  (2) TaskRepositoryPort.findById(id)
       │  (3) FreelanceTask.publish()
       │      ├── Kiểm tra steps.length >= 1 (REQ-POST-011)
       │      ├── Kiểm tra proof_requirements.length >= 1 (REQ-POST-011)
       │      ├── Kiểm tra screenshots <= 3, proofs <= 5 (REQ-POST-012)
       │      └── Chuyển status = ACTIVE, activated_at = now(), version++
       │  (4) TaskRepositoryPort.save(task) (OCC version check)
       │  (5) TaskAuditLogPort.recordStatusChange("DRAFT" -> "ACTIVE")
       ▼
[Response JSON] (HTTP 200 OK)
```

### 4.3 Luồng cập nhật Quota an toàn (`PUT /api/v1/tasks/:id`) — `REQ-POST-021..025`
```text
[Client / Admin]
       │
       ▼ (1) HTTP PUT /api/v1/tasks/:id (Body: { quota: newQuota, version: currentVersion })
[TaskController] -> [UpdateFreelanceTaskUseCase]
       │  (2) TaskRepositoryPort.findById(id)
       │  (3) Kiểm tra task đang ACTIVE -> Bắt buộc kiểm tra an toàn:
       │      ├── Gọi TaskProgressPort.getProgress(taskId) (REQ-POST-022)
       │      ├── Nhận về: { approved_count, in_progress_count }
       │      └── Kiểm tra: newQuota >= approved_count + in_progress_count (REQ-POST-023)
       │          (Nếu sai -> Ném QuotaReductionConflictError)
       │  (4) FreelanceTask.updateQuota(newQuota) -> version++
       │  (5) TaskRepositoryPort.save(task) (nếu DB version != currentVersion -> ném ConcurrencyConflict)
       │  (6) TaskAuditLogPort.recordFieldUpdates(...)
       ▼
[Response JSON] (HTTP 200 OK)
```

---

## 5. Phân loại thay đổi trạng thái (State-Change Classification)

Theo [AI Review Protocol](file:///C:/Users/ADMIN/.gemini/config/plugins/sdd-governance/skills/_shared/ai-review-protocol.md#material-state-change):

| Thành phần / Luồng | State-Change Category | Checkpoint bắt buộc | Lý do phân loại |
| :--- | :--- | :--- | :--- |
| `FreelanceTask` CRUD | `persistence schema hoặc business-data mutation` | Có (Review Plan + Pre-Code Checkpoint) | Tạo, sửa đổi và lưu trữ bản ghi nghiệp vụ cốt lõi trong PostgreSQL. |
| URL Security (`SecureUrl`) | `permission, security, dependency hoặc runtime configuration` | Có (Security Checkpoint) | Ràng buộc HTTPS-only ngăn ngừa mã độc/Phishing (`SEC-01`). |
| Cổng `TaskProgressPort` | `shared/public contract` | Có (Architecture Checkpoint) | Hợp đồng giao tiếp liên domain với module nộp bài (`ARCH-01`). |
| Audit Log (`TaskAuditLogPort`) | `persistence schema hoặc business-data mutation` | Không (Standard Append) | Dữ liệu kiểm toán phụ trợ ghi thêm (append-only). |

---

## 6. Tác động hợp đồng dùng chung (Shared-Contract Impact)

| Tên hợp đồng (Contract ID) | Phiên bản | Vai trò của post-job | Bên tiêu thụ (Consumers) | Quyết định tương thích | Sync-Back Owner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TaskProgressContract` | `v1.0.0` | **Consumer** (yêu cầu dữ liệu tiến độ) | Module `submit-task-proof` / `review-submission` | Tương thích (Contract độc lập qua Interface Port) | Tech Lead / Architecture Team |
| `TaskDetailsContract` | `v1.0.0` | **Producer** (cung cấp metadata nhiệm vụ) | Module `browse-tasks` (Worker xem việc) | Backward-compatible | Tech Lead / Architecture Team |

---

## 7. Bản đồ nhất quán (Consistency Map)

| Mã yêu cầu | Thành phần Plan | Kỳ vọng Task thực thi | Lệnh kiểm tra chính xác | Bằng chứng kiểm thử | Kích hoạt Post-Code Review |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-POST-001..005` | `FreelanceTask`, `Quota`, `RewardCoins` | T001: Xây dựng Domain Entity & Bounds | `npx vitest run tests/unit/domain/` | Unit Test Pass (100% bounds coverage) | Không (Core logic) |
| `REQ-POST-006..009` | `SecureUrl`, `XssSanitizer` | T002: Xây dựng URL & XSS Security | `npx vitest run tests/unit/security/` | Unit Test Pass (HTTPS & Phishing rejection) | Có (`SEC-01` Checkpoint) |
| `REQ-POST-010..020` | `TaskStatus`, `ChangeTaskStatusUseCase` | T003: Xây dựng State Transition Matrix | `npx vitest run tests/unit/usecase/status/` | State machine test pass (5 states, 24h grace) | Có (State mutation) |
| `REQ-POST-021..025` | `UpdateFreelanceTaskUseCase`, `TaskProgressPort` | T004: Xây dựng Quota Update & Progress Check | `npx vitest run tests/unit/usecase/update/` | Port integration test pass (rejection on active work) | Có (`ARCH-01` Checkpoint) |
| `REQ-POST-026..027` | `AntiSelfDealingValidator` | T005: Xây dựng Anti-Self-Dealing Guard | `npx vitest run tests/unit/domain/self-dealing/` | Rejection on worker_id == creator_id | Không |
| Toàn bộ API Endpoints | Fastify Routes, Controllers, Prisma Adapters | T006: Tích hợp API Fastify & Prisma | `npx vitest run tests/integration/` | Integration E2E Tests Pass | Có (Delivery trigger) |

---

## 8. Thứ tự triển khai phụ thuộc (Dependencies)

```text
[Giai đoạn 1: Foundation & Shared]
  ├── Cấu hình TypeScript, package.json, Vitest
  ├── Error Classes & Error Handler (ENG-02)
  └── XssSanitizer Utility (SEC-01)
         │
         ▼
[Giai đoạn 2: Domain Layer (Pure TypeScript)]
  ├── Value Objects: Quota, RewardCoins, SecureUrl, TaskStatus, StepInstruction, ProofRequirement
  └── Entity: FreelanceTask (Bounds check, Mutability rules, State transitions)
         │
         ▼
[Giai đoạn 3: Use Case Layer & Ports]
  ├── Ports: TaskRepositoryPort, TaskProgressPort, TaskAuditLogPort
  └── Use Cases: CreateFreelanceTask, UpdateFreelanceTask, ChangeTaskStatus, GetFreelanceTaskDetails
         │
         ▼
[Giai đoạn 4: Infrastructure Layer]
  ├── Prisma Schema & Database Client
  ├── PrismaTaskRepository & PrismaAuditLogRepository
  └── StubTaskProgressAdapter (cho testing)
         │
         ▼
[Giai đoạn 5: Interface Layer & Fastify Integration]
  ├── Zod DTO Schemas & AdminAuthGuard
  ├── TaskController & Fastify Route Registration
  └── Integration & E2E Testing (Vitest)
```

---

## 9. Đánh giá rủi ro & Phương án giảm thiểu (Risks & Mitigations)

1. **Rủi ro 1: Xung đột cập nhật đồng thời (Lost Updates do Concurrency):**
   - *Nguy cơ:* Hai quản trị viên cùng mở màn hình chỉnh sửa task và lưu đè lên nhau, làm mất thông tin quota hoặc hướng dẫn.
   - *Giảm thiểu:* Bắt buộc triển khai Optimistic Concurrency Control (OCC) với trường `version: number`. Câu lệnh Prisma update luôn kèm điều kiện `WHERE id = :id AND version = :expectedVersion`. Nếu số dòng update = 0, ném lỗi `TaskConcurrencyConflictError` (HTTP 409).
2. **Rủi ro 2: Lỗ hổng Phishing qua URL đổi hướng (Open Redirect / Obfuscated HTTPS):**
   - *Nguy cơ:* URL bắt đầu bằng `https://` nhưng là link rút gọn hoặc domain lừa đảo chuyển hướng người dùng đến trang đánh cắp thông tin.
   - *Giảm thiểu:* `SecureUrl` bắt buộc kiểm tra định dạng URL chuẩn bằng URL parser; chỉ chấp nhận các domain hợp lệ; sanitize toàn bộ chuỗi; khuyến nghị thêm danh sách đen (Blacklist) các dịch vụ rút gọn link không an toàn ở giai đoạn sau.
3. **Rủi ro 3: Sai lệch tiến độ khi kiểm tra Quota qua TaskProgressPort:**
   - *Nguy cơ:* Dữ liệu từ `TaskProgressPort` không phản ánh kịp thời các worker vừa nhận slot dẫn đến Admin giảm quota quá sâu.
   - *Giảm thiểu:* Câu lệnh truy vấn tiến độ phải truy xuất trực tiếp trạng thái tức thời (Real-time count) từ cơ sở dữ liệu với mức Transaction Isolation phù hợp, đảm bảo `in_progress_count` luôn chính xác tại thời điểm kiểm tra.

---

## 10. Câu hỏi dành cho Human Reviewer (Questions for Human Reviewer)

Kế hoạch kiến trúc được xây dựng dựa trên các giả định kỹ thuật sau. Xin vui lòng xem xét và xác nhận:

### Q1: Lưu trữ cấu trúc Steps và Proof Requirements dưới dạng JSONB trong PostgreSQL
- **Điều chưa rõ:** Spec không quy định `steps` và `proof_requirements` phải tách thành các bảng quan hệ riêng biệt (`task_steps`, `task_proofs`) hay lưu trong cùng một bảng `Task`.
- **Assumption hiện tại:** Lưu `steps` và `proof_requirements` dưới dạng cột `JSONB` trong bảng `FreelanceTask` (Prisma schema: `Json`). Lý do: Các mảng này nhỏ (tối đa 20 steps, 5 proofs), luôn được đọc và ghi nguyên khối cùng với Task, giúp giảm số lượng JOIN và tối ưu hóa hiệu năng đọc chi tiết task (p95 $\le$ 100ms).
- **Ảnh hưởng nếu assumption sai:** Nếu muốn tách bảng quan hệ, cần tạo 2 bảng con liên kết khóa ngoại với bảng `Task`.
- **Câu hỏi cụ thể:** Bạn có đồng ý với phương án lưu `steps` và `proof_requirements` dạng cột `JSONB` không?

### Q2: Triển khai Stub Adapter cho `TaskProgressPort` trong giai đoạn này
- **Điều chưa rõ:** Module quản lý bài nộp (`submit-task-proof`) chưa được triển khai ở pha này.
- **Assumption hiện tại:** Tạo `StubTaskProgressAdapter` (trả về dữ liệu mock có thể cấu hình được) trong `src/infra/adapters/` để phục vụ việc kiểm thử Use Case `UpdateFreelanceTaskUseCase` và `ChangeTaskStatusUseCase` đạt 100% độc lập mà không cần chờ module nộp bài.
- **Ảnh hưởng nếu assumption sai:** Không thể chạy tự động test kiểm tra điều kiện an toàn quota nếu thiếu port adapter này.
- **Câu hỏi cụ thể:** Bạn xác nhận đồng ý phương án tạo `StubTaskProgressAdapter` phục vụ kiểm thử cho feature `post-job` chứ?

---

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: `.sdd/features/post-job/PLAN.md` — Kế hoạch kiến trúc kỹ thuật chi tiết cho tính năng post-job
- Recommendation: Phê duyệt tài liệu `PLAN.md` v1.0.0. Bản kế hoạch đã tuân thủ 100% các technology bindings trong Architecture Profile v1.1.0 (Fastify + PostgreSQL + Prisma + Zod + Vitest); ánh xạ đầy đủ 27 yêu cầu EARS sang các thành phần Clean Architecture; phân loại rõ ràng các state-change checkpoints; có phân tích rủi ro kỹ thuật và 2 câu hỏi kỹ thuật cụ thể.
- Evidence: Đã tạo tệp PLAN.md hoàn chỉnh với 10 mục chuẩn hóa; kiến trúc Clean Architecture 4 tầng phân tách nghiêm ngặt; kiểm định trước với profile bindings đã APPROVED.
- Risks and assumptions: Hai giả định kỹ thuật (lưu JSONB và Stub TaskProgressPort) đã được nêu rõ tại Section 10 để Human Reviewer quyết định; không có nguy cơ vi phạm ranh giới module.
- Alternatives considered: Tách `steps` và `proof_requirements` thành bảng quan hệ riêng; bị tạm gác lại do JSONB tối ưu hơn về latency cho micro-tasking.
- Required human decision: Phê duyệt `PLAN.md` và xác nhận 2 giả định tại Section 10 qua lệnh `/sdd-review` để mở khóa cho Pha 3 SDD (`/sdd-tasks --feature=post-job`).

## Human Final Review
- Status: APPROVED
- Decision: Duyệt PLAN.md post-job v1.0.0 và đồng ý 2 phương án kỹ thuật Q1 (JSONB), Q2 (Stub Adapter)
- Reviewer: Admin
- Reviewed at: 2026-11-19T15:18:00+07:00
- Follow-up: /sdd-tasks --feature=post-job

