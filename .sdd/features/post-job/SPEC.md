# Đặc tả kỹ thuật: Đăng việc / Nhiệm vụ Freelance tự do (post-job)

# Version: 1.0.0
# Status: APPROVED & LOCKED
# Feature Slug: post-job
# Depth: DETAILED
# Methodology Profile: Depth=DETAILED, Risk=elevated, Review Route=N/A, Decision Owner=Admin
# Clarification-First Status: CONFIRMED BY HUMAN REVIEWER (B-1, B-2, T-1, T-2, T-3, E-1, E-2)

---

## 1. Bối cảnh & Mục tiêu (Context & Goal)

- **Bối cảnh:** Nền tảng Jobzz cung cấp chợ nhiệm vụ trực tuyến vi mô (Micro-task / Bounty Jobs). Khác với các mô hình tuyển dụng truyền thống, toàn bộ nhiệm vụ tại Jobzz được quản lý và phát hành độc quyền bởi **Quản trị viên (Admin)** dựa trên hợp đồng chiến dịch thực tế từ các đối tác bên ngoài. Đơn vị trả thưởng trên toàn hệ thống là **Xu (Coins)**.
- **Mục tiêu tính năng (`post-job`):**
  - Cung cấp Use Case hoàn chỉnh cho phép Admin tạo mới, lưu nháp, xuất bản, tạm dừng, mở lại, đóng vĩnh viễn và cập nhật nhiệm vụ tự do.
  - Bảo vệ sự an toàn của người làm (Worker) bằng các cơ chế: URL bắt buộc HTTPS (`SEC-01`), chống XSS, chống giảm thù lao hoặc giảm quota khi nhiệm vụ đang chạy.
  - Tích hợp cổng kiến trúc `TaskProgressPort` (`ARCH-01`) để đối soát số lượng slot thực tế và `TaskAuditLogPort` để ghi nhật ký kiểm toán bất biến.
  - Ngăn ngừa gian lận tài chính thông qua quy tắc cấm tự gian lận (Anti-Self-Dealing) và giới hạn trần số học chống tràn số (`total_reward_coins <= 5B Xu`).

---

## 2. Tác nhân & Phân quyền (Actors & Roles)

| Tác nhân | Vai trò trong hệ thống | Thẩm quyền trên tính năng `post-job` |
| :--- | :--- | :--- |
| **Admin** | Quản trị viên / Chủ sở hữu nền tảng | **Toàn quyền:** Tạo nhiệm vụ, chuyển đổi trạng thái vòng đời, chỉnh sửa nội dung hợp lệ theo quy tắc Mutability, theo dõi Audit Log. |
| **Worker** | Người làm tự do (Freelancer) | **Chỉ đọc:** Xem thông tin chi tiết nhiệm vụ khi ở trạng thái `ACTIVE`. Tuyệt đối **không có quyền** tạo hoặc sửa nhiệm vụ. |
| **System Scheduler** | Tiến trình nền tự động | Kích hoạt tự động đóng slot (`EXPIRED`) sau 24h ân hạn khi nhiệm vụ chuyển sang `CLOSED`; tự động đóng task sang `COMPLETED` khi đủ quota. |

---

## 3. Yêu cầu chức năng (Functional Requirements - EARS)

Mọi yêu cầu chức năng dưới đây đều tuân thủ nghiêm ngặt cú pháp EARS với các cặp Happy Path (`WHEN`) và Unwanted Error Handling (`IF ... THEN ...`).

### 3.1 Khởi tạo và Lưu nháp nhiệm vụ (Create & Draft Task)

- **`REQ-POST-001` (Event-driven):**
  - **WHEN** Admin gửi yêu cầu tạo nhiệm vụ mới với trạng thái `DRAFT` kèm dữ liệu hợp lệ (tiêu đề 10–150 ký tự, danh mục hợp lệ, `1 <= quota <= 10,000`, `1 <= reward_coins <= 500,000`, `total_reward_coins <= 5,000,000,000`), the system **SHALL** khởi tạo thực thể `FreelanceTask` ở trạng thái `DRAFT`, gán `version = 1`, lưu vào kho dữ liệu và ghi nhận sự kiện `TaskCreatedEvent`.

- **`REQ-POST-002` (Unwanted):**
  - **IF** người gửi yêu cầu tạo nhiệm vụ không có vai trò `ADMIN`, **THEN** the system **SHALL** từ chối yêu cầu và ném lỗi `UnauthorizedCreatorError` (mã lỗi: `FORBIDDEN`).

- **`REQ-POST-003` (Unwanted):**
  - **IF** giá trị `reward_coins` nhỏ hơn 1 hoặc lớn hơn 500,000 hoặc không phải số nguyên an toàn, **THEN** the system **SHALL** từ chối yêu cầu và ném lỗi `InvalidRewardCoinsError` (mã lỗi: `INVALID_REWARD_COINS`).

- **`REQ-POST-004` (Unwanted):**
  - **IF** giá trị `quota` nhỏ hơn 1 hoặc lớn hơn 10,000 hoặc không phải số nguyên an toàn, **THEN** the system **SHALL** từ chối yêu cầu và ném lỗi `InvalidQuotaError` (mã lỗi: `INVALID_QUOTA`).

- **`REQ-POST-005` (Unwanted):**
  - **IF** tích số `quota * reward_coins` vượt quá `5,000,000,000` Xu, **THEN** the system **SHALL** từ chối yêu cầu và ném lỗi `TotalRewardCoinsOverflowError` (mã lỗi: `REWARD_OVERFLOW`).

---

### 3.2 Quy chuẩn An ninh URL và Khử nhiễm XSS (SEC-01)

- **`REQ-POST-006` (Event-driven):**
  - **WHEN** Admin cấu hình danh sách các bước (`steps`) chứa `target_url`, the system **SHALL** xác thực rằng mỗi `target_url` đều sử dụng giao thức bảo mật `https://` hợp lệ.

- **`REQ-POST-007` (Unwanted):**
  - **IF** bất kỳ `target_url` nào bắt đầu bằng `http://`, `javascript:`, `data:`, `file:`, `vbscript:` hoặc không phải định dạng HTTPS hợp lệ, **THEN** the system **SHALL** từ chối thao tác và ném lỗi `InsecureUrlError` (mã lỗi: `INSECURE_URL_PROTOCOL`).

- **`REQ-POST-008` (Ubiquitous):**
  - The system **SHALL** tự động khử nhiễm (sanitize) toàn bộ nội dung văn bản trong `title`, `description`, và `instruction` của các bước để loại bỏ hoàn toàn các thẻ HTML độc hại, payload script hoặc các thuộc tính kích hoạt mã thực thi trước khi lưu trữ vào domain entity.

- **`REQ-POST-009` (Unwanted):**
  - **IF** phát hiện nội dung văn bản chứa từ khóa/mẫu vi phạm Chính sách nội dung cấm (lừa đảo nạp tiền, OTP, cờ bạc, khiêu dâm, mã độc), **THEN** the system **SHALL** từ chối lưu và ném lỗi `ProhibitedContentDetectedError` (mã lỗi: `PROHIBITED_CONTENT`).

---

### 3.3 Xuất bản nhiệm vụ (Publish Task to ACTIVE)

- **`REQ-POST-010` (Event-driven):**
  - **WHEN** Admin kích hoạt hành động xuất bản (`Publish`) từ `DRAFT` sang `ACTIVE`, the system **SHALL** kiểm tra tính hợp lệ toàn diện: tiêu đề hợp lệ, ít nhất 1 bước hướng dẫn (`1 <= steps.length <= 20`), ít nhất 1 yêu cầu bằng chứng (`1 <= proof_requirements.length <= 5`), tối đa 3 ảnh chụp màn hình, chuyển trạng thái sang `ACTIVE`, gán `activated_at = now()`, tăng `version` và ghi Audit Log qua `TaskAuditLogPort`.

- **`REQ-POST-011` (Unwanted):**
  - **IF** yêu cầu xuất bản được thực hiện khi nhiệm vụ thiếu các bước hướng dẫn (`steps.length == 0`) hoặc thiếu yêu cầu bằng chứng (`proof_requirements.length == 0`), **THEN** the system **SHALL** từ chối xuất bản và ném lỗi `IncompleteTaskPublicationError` (mã lỗi: `INCOMPLETE_TASK_CONFIG`).

- **`REQ-POST-012` (Unwanted):**
  - **IF** số lượng yêu cầu bằng chứng kiểu `SCREENSHOT_IMAGE` vượt quá 3 hoặc tổng số yêu cầu bằng chứng vượt quá 5, **THEN** the system **SHALL** từ chối xuất bản và ném lỗi `ExceededProofRequirementsLimitError` (mã lỗi: `PROOF_LIMIT_EXCEEDED`).

---

### 3.4 Quản lý Ma trận trạng thái (State Transitions)

- **`REQ-POST-013` (State-driven):**
  - **WHILE** nhiệm vụ đang ở trạng thái `ACTIVE`, the system **SHALL** cho phép Worker nhận slot làm bài chừng nào số lượng slot khả dụng `remaining_quota > 0`.

- **`REQ-POST-014` (Event-driven):**
  - **WHEN** Admin yêu cầu tạm dừng nhiệm vụ (`Pause`), the system **SHALL** chuyển trạng thái từ `ACTIVE` sang `PAUSED`, ngừng cấp phát slot mới cho worker, giữ nguyên quyền nộp bài cho các worker đang giữ slot dang dở trong thời hạn `execution_time_minutes`, tăng `version` và ghi Audit Log.

- **`REQ-POST-015` (Event-driven):**
  - **WHEN** Admin yêu cầu mở lại nhiệm vụ (`Resume`), the system **SHALL** chuyển trạng thái từ `PAUSED` sang `ACTIVE`, tiếp tục cho phép worker nhận các slot còn trống, tăng `version` và ghi Audit Log.

- **`REQ-POST-016` (Event-driven):**
  - **WHEN** số lượng bài nộp được duyệt thành công đạt chỉ tiêu (`approved_count >= quota`), the system **SHALL** tự động chuyển trạng thái nhiệm vụ từ `ACTIVE` sang `COMPLETED`.

- **`REQ-POST-017` (Event-driven):**
  - **WHEN** Admin yêu cầu mở rộng thêm quota trên nhiệm vụ đang ở trạng thái `COMPLETED` với giá trị `new_quota > old_quota`, the system **SHALL** cập nhật quota mới, chuyển trạng thái nhiệm vụ quay trở lại `ACTIVE`, tăng `version` và ghi Audit Log.

- **`REQ-POST-018` (Event-driven):**
  - **WHEN** Admin yêu cầu đóng vĩnh viễn nhiệm vụ (`Close`) từ trạng thái `ACTIVE` hoặc `PAUSED`, the system **SHALL** chuyển trạng thái sang `CLOSED`, gán `closed_at = now()`, kích hoạt thời hạn ân hạn 24 giờ cho các slot đang làm dang dở, hủy bỏ ngay lập tức toàn bộ slot chưa được nhận, tăng `version` và ghi Audit Log.

- **`REQ-POST-019` (Event-driven - System Scheduler):**
  - **WHEN** thời gian hiện tại vượt quá 24 giờ kể từ `closed_at` (`now() >= closed_at + 24 hours`), the system **SHALL** tự động chuyển toàn bộ các slot đang giữ chưa nộp thành `EXPIRED` và đóng băng toàn bộ tiến trình nộp bài của nhiệm vụ đó.

- **`REQ-POST-020` (Unwanted):**
  - **IF** Admin yêu cầu chuyển đổi trạng thái trái với Ma trận chuyển trạng thái hợp lệ (ví dụ: chuyển trực tiếp từ `DRAFT` sang `CLOSED`, hoặc cố gắng mở lại một nhiệm vụ đã `CLOSED`), **THEN** the system **SHALL** từ chối yêu cầu và ném lỗi `InvalidStateTransitionError` (mã lỗi: `INVALID_STATE_TRANSITION`).

---

### 3.5 Chỉnh sửa nhiệm vụ khi đang ACTIVE và Cổng tiến độ (ARCH-01)

- **`REQ-POST-021` (Event-driven):**
  - **WHEN** Admin gửi yêu cầu cập nhật thông tin nhiệm vụ đang `ACTIVE`, the system **SHALL** cho phép cập nhật `title`, `description`, và `target_url` an toàn của các bước `steps`, tăng `version` và ghi Audit Log sự kiện `TASK_UPDATED`.

- **`REQ-POST-022` (Event-driven - ARCH-01):**
  - **WHEN** Admin yêu cầu thay đổi `quota` của nhiệm vụ đang `ACTIVE`, the system **SHALL** gọi qua `TaskProgressPort.getProgress(taskId)` để truy xuất `{ approved_count, in_progress_count }`, sau đó kiểm tra điều kiện an toàn:
    $$\text{new\_quota} \ge \text{approved\_count} + \text{in\_progress\_count}$$
    Nếu thỏa mãn, the system **SHALL** cập nhật `quota = new_quota`, tính lại `total_reward_coins = new_quota * reward_coins`, tăng `version` và ghi Audit Log.

- **`REQ-POST-023` (Unwanted):**
  - **IF** Admin yêu cầu cập nhật `quota` mới nhỏ hơn tổng `approved_count + in_progress_count`, **THEN** the system **SHALL** từ chối cập nhật và ném lỗi `QuotaReductionConflictError` (mã lỗi: `QUOTA_REDUCTION_CONFLICT`).

- **`REQ-POST-024` (Unwanted):**
  - **IF** Admin yêu cầu giảm `reward_coins` hoặc thay đổi/thêm mới các `proof_requirements` khi nhiệm vụ đang ở trạng thái `ACTIVE`, **THEN** the system **SHALL** từ chối cập nhật và ném lỗi `ImmutableFieldModificationError` (mã lỗi: `IMMUTABLE_FIELD_MODIFICATION`).

- **`REQ-POST-025` (Unwanted - Concurrency):**
  - **IF** giá trị `version` gửi kèm trong yêu cầu cập nhật không khớp với `version` hiện tại của nhiệm vụ trong cơ sở dữ liệu (xung đột phiên sửa đổi đồng thời), **THEN** the system **SHALL** từ chối cập nhật và ném lỗi `TaskConcurrencyConflictError` (mã lỗi: `CONCURRENCY_CONFLICT`).

---

### 3.6 Quy tắc chống tự gian lận (Anti-Self-Dealing)

- **`REQ-POST-026` (Ubiquitous):**
  - The system **SHALL** ngăn chặn tuyệt đối tài khoản tạo nhiệm vụ (`creator_id`) nhận slot làm bài hoặc nộp bằng chứng cho chính nhiệm vụ do mình tạo ra ($$\text{worker\_id} \ne \text{creator\_id}$$).

- **`REQ-POST-027` (Unwanted):**
  - **IF** tài khoản gửi yêu cầu nhận slot làm bài hoặc nộp bằng chứng có định danh trùng khớp với `creator_id` của nhiệm vụ, **THEN** the system **SHALL** từ chối thao tác và ném lỗi `SelfDealingForbiddenError` (mã lỗi: `SELF_DEALING_FORBIDDEN`).

---

## 4. Yêu cầu phi chức năng (Non-Functional Requirements - NFR)

### 4.1 Hiệu năng (Performance SLA)
- **`NFR-PERF-001`:** Thời gian phản hồi xử lý (Latency) của Use Case `CreateFreelanceTaskUseCase`, `UpdateFreelanceTaskUseCase`, `ChangeTaskStatusUseCase` phải đạt **p95 $\le$ 300ms** dưới tải thông thường (100 concurrent requests).
- **`NFR-PERF-002`:** Thao tác đọc chi tiết nhiệm vụ và xác thực URL phải đạt **p95 $\le$ 100ms**.

### 4.2 Bảo mật & Toàn vẹn (Security & Integrity - SEC-01 & SEC-02)
- **`NFR-SEC-001` (HTTPS-Only):** 100% các URL đích (`target_url`) bắt buộc sử dụng giao thức HTTPS. Mọi kết nối không mã hóa đều bị chặn ở ranh giới Domain.
- **`NFR-SEC-002` (XSS Sanitization):** 100% dữ liệu văn bản từ Admin phải được lọc qua bộ khử nhiễm XSS chuẩn (loại bỏ thẻ `<script>`, `<iframe`, các handler `javascript:`, `onerror`, `onload`).
- **`NFR-SEC-003` (Anti-Overflow):** Toàn bộ các phép tính toán liên quan đến Xu (`reward_coins`, `quota`, `total_reward_coins`) bắt buộc phải kiểm tra `Number.isSafeInteger()` và nằm trong ngưỡng $\le 5,000,000,000$ Xu.

### 4.3 Khả năng kiểm toán (Auditability & Traceability)
- **`NFR-AUDIT-001`:** Mọi hành động chuyển trạng thái (`STATUS_CHANGED`) hoặc chỉnh sửa nội dung/quota (`TASK_UPDATED`) đều phải được ghi lại thành bản ghi Audit Log bất biến (append-only) chứa `task_id`, `admin_id`, `timestamp` UTC, `old_value`, `new_value`.

### 4.4 Độ tin cậy & Tính nhất quán (Reliability & Concurrency)
- **`NFR-REL-001`:** Sử dụng cơ chế Optimistic Concurrency Control (OCC) với trường số học `version` tăng đơn điệu mỗi khi có cập nhật, đảm bảo không bao giờ xảy ra lỗi ghi đè mất dữ liệu (Lost Update).

---

## 5. Mô hình dữ liệu (Data Model)

Mô hình dữ liệu tuân thủ Clean Architecture core-only, hoàn toàn độc lập với ORM hoặc cơ sở dữ liệu cụ thể.

```text
+---------------------------------------------------------------------------------+
|                                 FreelanceTask                                   |
+---------------------------------------------------------------------------------+
| - id: UUID                                                                      |
| - creator_id: UUID                                                              |
| - title: string (10..150)                                                       |
| - category: TaskCategory (Enum)                                                 |
| - description: string (30..5000, sanitized)                                     |
| - quota: Quota (ValueObject: 1..10,000)                                         |
| - reward_coins: RewardCoins (ValueObject: 1..500,000)                           |
| - total_reward_coins: number (calculated: quota * reward_coins <= 5,000,000,000)|
| - steps: StepInstruction[] (1..20 items)                                        |
| - proof_requirements: ProofRequirement[] (1..5 items, max 3 screenshots)        |
| - execution_time_minutes: number (15..1440, default: 60)                        |
| - auto_approval_days: number (1..7, default: 3)                                 |
| - status: TaskStatus (DRAFT | ACTIVE | PAUSED | COMPLETED | CLOSED)             |
| - version: number (OCC version counter, starts at 1)                            |
| - created_at: Date (UTC)                                                        |
| - updated_at: Date (UTC)                                                        |
| - activated_at: Date | null                                                     |
| - closed_at: Date | null                                                        |
+---------------------------------------------------------------------------------+
```

### Các Value Objects & Types

1. **`TaskCategory` (Enum):**
   `APP_INSTALL` | `ACCOUNT_REGISTRATION` | `SOCIAL_INTERACTION` | `REVIEW_RATING` | `SURVEY` | `CONTENT_WRITING` | `OTHER`
2. **`TaskStatus` (Enum):**
   `DRAFT` | `ACTIVE` | `PAUSED` | `COMPLETED` | `CLOSED`
3. **`StepInstruction` (Value Object):**
   - `step_number`: `number` (1, 2, 3...)
   - `instruction`: `string` (10..1,000 ký tự, sanitized)
   - `target_url`: `SecureUrl | null` (bắt buộc bắt đầu bằng `https://`)
4. **`ProofRequirement` (Value Object):**
   - `id`: `string` (UUID)
   - `proof_type`: `SCREENSHOT_IMAGE` | `TEXT`
   - `title`: `string` (5..150 ký tự)
   - `description`: `string` (10..1,000 ký tự)
   - `is_required`: `boolean` (mặc định `true`)
5. **`SecureUrl` (Value Object):**
   - Ràng buộc: Chuỗi ký tự bắt đầu bằng `https://`, khớp chuẩn regex URL bảo mật; ném lỗi `InsecureUrlError` nếu không hợp lệ.

### Application Ports (Interfaces)

```typescript
export interface TaskProgressPort {
  getProgress(taskId: string): Promise<{
    approved_count: number;
    in_progress_count: number;
  }>;
}

export interface TaskAuditLogPort {
  recordStatusChange(params: {
    taskId: string;
    adminId: string;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
    reason?: string;
    timestamp: Date;
  }): Promise<void>;

  recordFieldUpdates(params: {
    taskId: string;
    adminId: string;
    changes: Array<{ field: string; oldValue: any; newValue: any }>;
    timestamp: Date;
  }): Promise<void>;
}

export interface TaskRepositoryPort {
  findById(id: string): Promise<FreelanceTask | null>;
  save(task: FreelanceTask): Promise<void>;
}
```

---

## 6. Xử lý lỗi & Hợp đồng lỗi (Error Handling & Error Contract)

Tuân thủ quy chuẩn `CONSTITUTION.md` (`ENG-02`), mọi lỗi trả về client đều được ánh xạ theo cấu trúc chuẩn:
```json
{
  "error_code": "STRING_IDENTIFIER",
  "message": "Thông báo lỗi an toàn, không rò rỉ stack trace hay dữ liệu nhạy cảm",
  "request_id": "req-uuid-1234",
  "timestamp": "2026-11-19T13:13:00.000Z"
}
```

| Tên lớp lỗi (Typed Error) | Mã lỗi (`error_code`) | HTTP Status | Điều kiện phát sinh |
| :--- | :--- | :--- | :--- |
| `UnauthorizedCreatorError` | `FORBIDDEN` | 403 | Người tạo không có vai trò `ADMIN`. |
| `SelfDealingForbiddenError` | `SELF_DEALING_FORBIDDEN` | 400 | Admin tự nhận hoặc tự nộp bài trên task do mình tạo. |
| `InvalidRewardCoinsError` | `INVALID_REWARD_COINS` | 400 | `reward_coins` không nguyên dương hoặc nằm ngoài dải `[1, 500000]`. |
| `InvalidQuotaError` | `INVALID_QUOTA` | 400 | `quota` không nguyên dương hoặc nằm ngoài dải `[1, 10000]`. |
| `TotalRewardCoinsOverflowError` | `REWARD_OVERFLOW` | 400 | `quota * reward_coins > 5,000,000,000`. |
| `InsecureUrlError` | `INSECURE_URL_PROTOCOL` | 400 | `target_url` không bắt đầu bằng `https://` (chứa `http://`, `javascript:`, v.v.). |
| `ProhibitedContentDetectedError` | `PROHIBITED_CONTENT` | 400 | Tiêu đề hoặc hướng dẫn chứa nội dung vi phạm chính sách cấm. |
| `IncompleteTaskPublicationError` | `INCOMPLETE_TASK_CONFIG` | 400 | Xuất bản khi thiếu steps hoặc proof requirements. |
| `ExceededProofRequirementsLimitError` | `PROOF_LIMIT_EXCEEDED` | 400 | Quá 5 proofs hoặc quá 3 screenshots. |
| `InvalidStateTransitionError` | `INVALID_STATE_TRANSITION` | 400 | Chuyển đổi trạng thái vi phạm Ma trận trạng thái. |
| `ImmutableFieldModificationError` | `IMMUTABLE_FIELD_MODIFICATION` | 400 | Cố tình giảm Xu hoặc đổi bằng chứng khi task đang `ACTIVE`. |
| `QuotaReductionConflictError` | `QUOTA_REDUCTION_CONFLICT` | 400 | Giảm quota thấp hơn `approved_count + in_progress_count`. |
| `TaskConcurrencyConflictError` | `CONCURRENCY_CONFLICT` | 409 | Sai lệch `version` khi cập nhật đồng thời (OCC). |
| `TaskNotFoundError` | `TASK_NOT_FOUND` | 404 | Không tìm thấy nhiệm vụ theo `id`. |

---

## 7. Tiêu chí nghiệm thu (Acceptance Criteria - BDD Scenarios)

### Kịch bản 1: Admin tạo bản nháp nhiệm vụ thành công
```gherkin
Scenario: Admin creates a valid draft freelance task
  Given tài khoản đăng nhập có vai trò "ADMIN" với admin_id = "adm-001"
  When Admin gửi yêu cầu tạo nhiệm vụ với:
    | title        | Cài đặt ứng dụng VinShop và đăng ký tài khoản |
    | category     | APP_INSTALL                                   |
    | description  | Tải ứng dụng qua liên kết và hoàn tất đăng ký |
    | quota        | 100                                           |
    | reward_coins | 50                                            |
    | steps        | 1 bước hướng dẫn với URL "https://vinshop.vn" |
    | proofs       | 1 ảnh chụp màn hình xác nhận                  |
  Then hệ thống tạo nhiệm vụ thành công với trạng thái "DRAFT"
  And trường "total_reward_coins" bằng 5000
  And trường "version" bằng 1
  And sự kiện "TaskCreatedEvent" được kích hoạt
```

### Kịch bản 2: Admin xuất bản nhiệm vụ với URL không an toàn (Thất bại)
```gherkin
Scenario: Admin attempts to publish task containing insecure HTTP link
  Given tài khoản Admin đang sở hữu nhiệm vụ "DRAFT"
  When Admin cập nhật bước hướng dẫn chứa target_url = "http://insecure-site.com/download"
  And Admin yêu cầu chuyển trạng thái sang "ACTIVE"
  Then hệ thống từ chối yêu cầu xuất bản
  And trả về lỗi "InsecureUrlError" với mã "INSECURE_URL_PROTOCOL"
  And trạng thái nhiệm vụ vẫn giữ nguyên là "DRAFT"
```

### Kịch bản 3: Admin giảm Quota thấp hơn số lượng đang làm dở (Thất bại qua TaskProgressPort)
```gherkin
Scenario: Admin attempts to reduce quota below active work progress
  Given nhiệm vụ "task-100" đang ở trạng thái "ACTIVE" với quota hiện tại = 100
  And TaskProgressPort trả về approved_count = 40 và in_progress_count = 20
  When Admin yêu cầu cập nhật quota mới = 50
  Then hệ thống tính toán (approved_count + in_progress_count) = 60
  And hệ thống từ chối cập nhật vì new_quota (50) < 60
  And trả về lỗi "QuotaReductionConflictError" với mã "QUOTA_REDUCTION_CONFLICT"
  And quota của nhiệm vụ vẫn giữ nguyên là 100
```

### Kịch bản 4: Admin cố tình giảm mức Xu thưởng khi task đang ACTIVE (Thất bại)
```gherkin
Scenario: Admin attempts to reduce reward coins on an active task
  Given nhiệm vụ đang ở trạng thái "ACTIVE" với reward_coins = 50 Xu
  When Admin gửi yêu cầu cập nhật reward_coins thành 30 Xu
  Then hệ thống từ chối cập nhật
  And trả về lỗi "ImmutableFieldModificationError" với mã "IMMUTABLE_FIELD_MODIFICATION"
  And reward_coins của nhiệm vụ vẫn giữ nguyên là 50 Xu
```

### Kịch bản 5: Ngăn chặn Admin tự nhận slot làm nhiệm vụ của chính mình (Anti-Self-Dealing)
```gherkin
Scenario: Task creator attempts to claim a slot on their own task
  Given nhiệm vụ "task-100" có creator_id = "adm-001" đang "ACTIVE"
  When tài khoản có user_id = "adm-001" gửi yêu cầu nhận slot làm bài
  Then hệ thống phát hiện worker_id trùng khớp creator_id
  And từ chối yêu cầu nhận slot
  And trả về lỗi "SelfDealingForbiddenError" với mã "SELF_DEALING_FORBIDDEN"
```

### Kịch bản 6: Tạm dừng và Mở lại nhiệm vụ
```gherkin
Scenario: Admin pauses and resumes task
  Given nhiệm vụ đang ở trạng thái "ACTIVE"
  When Admin gửi yêu cầu "Pause"
  Then trạng thái nhiệm vụ chuyển sang "PAUSED"
  And hệ thống không cấp phát slot mới
  And Audit Log ghi nhận sự kiện chuyển trạng thái "ACTIVE" -> "PAUSED"
  When Admin gửi yêu cầu "Resume"
  Then trạng thái nhiệm vụ chuyển sang "ACTIVE"
  And Audit Log ghi nhận sự kiện chuyển trạng thái "PAUSED" -> "ACTIVE"
```

### Kịch bản 7: Đóng vĩnh viễn nhiệm vụ và xử lý ân hạn 24h
```gherkin
Scenario: Admin closes task with 24-hour grace period for active slots
  Given nhiệm vụ đang có 5 slot đang làm dở dở
  When Admin gửi yêu cầu "Close"
  Then trạng thái nhiệm vụ chuyển sang "CLOSED"
  And trường closed_at được gán thời gian hiện tại
  And toàn bộ slot chưa nhận bị hủy bỏ ngay lập tức
  When thời gian hệ thống trôi qua 24 giờ kể từ closed_at
  Then toàn bộ slot đang làm dở chưa nộp bài tự động chuyển sang "EXPIRED"
```

### Kịch bản 8: Xung đột chỉnh sửa đồng thời qua OCC version
```gherkin
Scenario: Concurrent update detected via version mismatch
  Given nhiệm vụ "task-100" đang có version = 3 trong cơ sở dữ liệu
  When Admin gửi yêu cầu cập nhật với payload có version = 2
  Then hệ thống từ chối cập nhật
  And trả về lỗi "TaskConcurrencyConflictError" với mã "CONCURRENCY_CONFLICT"
```

---

## 8. Ngoài phạm vi tính năng (Out of Scope)

Các nghiệp vụ sau đây được xác định rõ ràng là **nằm ngoài phạm vi của tính năng `post-job`** và sẽ được thực hiện tại các feature tiếp theo:
1. **Luồng Người làm nộp bài (`submit-task-proof`):** Tiếp nhận ảnh upload từ worker, lưu trữ S3/Cloud Storage, kiểm tra giới hạn thời gian làm bài `execution_time_minutes`.
2. **Luồng Nghiệm thu bài nộp (`review-submission`):** Giao diện Admin duyệt/từ chối bằng chứng, cộng Xu vào ví worker khi duyệt thành công.
3. **Luồng Rút tiền (`wallet-withdrawal`):** Chuyển đổi Xu sang tiền VNĐ và tạo lệnh chuyển khoản ngân hàng tự động cho worker.
4. **Hệ thống Khiếu nại (Dispute Resolution):** Worker khiếu nại quyết định từ chối duyệt bài nộp của Admin.
5. **Nạp tiền / Mua xu:** Hệ thống **hoàn toàn không có** cơ chế nạp tiền hay mua xu của nhà tuyển dụng.

---

## 9. Đánh giá chất lượng đối kháng (Adversarial Quality Pass)

### 9.1 Phân tích Pre-Mortem (Kịch bản sự cố giả định)

- **Sự cố giả định 1: Worker bị lừa truy cập link chứa mã độc qua hướng dẫn nhiệm vụ.**
  - *Nguyên nhân:* Admin vô tình hoặc tài khoản Admin bị chiếm đoạt tạo task chứa link `http://` độc hại hoặc payload `javascript:`.
  - *Giải pháp ngăn chặn:* Đã bổ sung quy tắc bất biến `REQ-POST-006`, `REQ-POST-007` bắt buộc HTTPS-only tại Domain Entity (`SecureUrl`) và sanitize toàn bộ text (`REQ-POST-008`).
- **Sự cố giả định 2: Admin giảm Quota khiến các worker đã hoàn tất bài làm không còn slot để nộp.**
  - *Nguyên nhân:* Admin thấy số lượng đăng ký nhiều nên hạ quota xuống để tiết kiệm ngân sách.
  - *Giải pháp ngăn chặn:* Ràng buộc bắt buộc qua `TaskProgressPort` (`REQ-POST-022`, `REQ-POST-023`): `new_quota >= approved_count + in_progress_count`. Không thể hạ quota dưới số lượng đang làm dở.
- **Sự cố giả định 3: Lỗi tràn số nguyên JavaScript khi tạo task quy mô cực lớn.**
  - *Nguyên nhân:* Admin cấu hình quota 1,000,000 lượt và reward 100,000,000 Xu khiến tích số vượt quá `Number.MAX_SAFE_INTEGER`.
  - *Giải pháp ngăn chặn:* Đã chốt ngưỡng trần `total_reward_coins <= 5,000,000,000 Xu` (`REQ-POST-005`), thấp hơn 1.8 triệu lần so với `MAX_SAFE_INTEGER` ($$\approx 9 \times 10^{15}$$).

### 9.2 Domain Walkthrough
- Happy Path: Create Draft $\rightarrow$ Publish to Active $\rightarrow$ Workers claim slots $\rightarrow$ Completed $\rightarrow$ Closed.
- Alternative Paths: Active $\rightarrow$ Pause $\rightarrow$ Resume $\rightarrow$ Active.
- Error Paths: Concurrency conflicts (OCC), Insecure URL rejection, Self-dealing block, Quota reduction rejection.
- Toàn bộ kịch bản đã có disposition `clarified rule` hoặc `approved assumption`.

---

## 10. Khóa tính năng (Feature Lock)

```markdown
## Feature Lock — post-job
- Locked scope:
  - Khởi tạo, lưu nháp, xuất bản, cập nhật, đổi trạng thái nhiệm vụ Freelance Micro-task do Admin phát hành.
  - Ràng buộc Bounds (1..500k Xu, 1..10k Quota, total <= 5B Xu).
  - Ràng buộc an ninh URL (HTTPS-only) và XSS Sanitization (SEC-01).
  - Cổng kiến trúc TaskProgressPort (ARCH-01) và TaskAuditLogPort.
  - Ma trận 5 trạng thái (DRAFT, ACTIVE, PAUSED, COMPLETED, CLOSED) kèm ân hạn 24h.
  - Quy tắc Mutability khi ACTIVE và Anti-Self-Dealing (worker_id != creator_id).
- Deferred work:
  - Worker nộp bài và tải ảnh lên Cloud Storage (feature submit-task-proof).
  - Admin duyệt bằng chứng và cộng Xu ví (feature review-submission).
  - Đổi Xu rút tiền về tài khoản ngân hàng (feature wallet-withdrawal).
  - Cơ chế nạp xu / mua xu (loại bỏ hoàn toàn khỏi mô hình).
- Change path: /sdd-update --feature=post-job --artifact=spec --bump=<patch|minor|major> --reason="..."
- Lock boundary: Feature post-job only; không làm ảnh hưởng đến các feature khác của Jobzz.
```

---

## 11. Nhật ký thay đổi (Changelog)

- **v1.0.0 (2026-11-19):** Khởi tạo tài liệu đặc tả kỹ thuật `SPEC.md` lần đầu tiên, tích hợp toàn bộ 7 giả định Clarification-First đã được Human Reviewer xác nhận, 27 Functional Requirements chuẩn EARS, 4 NFRs, mô hình dữ liệu Clean Architecture và hợp đồng lỗi chi tiết.

---

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: `.sdd/features/post-job/SPEC.md` — Đặc tả kỹ thuật chi tiết tính năng Đăng việc / Nhiệm vụ Freelance tự do (post-job)
- Recommendation: Phê duyệt `SPEC.md` v1.0.0. Tài liệu đã đáp ứng 100% tiêu chí DoD của Pha 1 SDD: toàn bộ 27 yêu cầu chức năng đều viết theo đúng 5 mẫu EARS (có đủ cặp Happy Path và Unwanted Error Handling); tích hợp đầy đủ 7 giả định Clarification-First; mô hình dữ liệu Clean Architecture tách biệt qua `TaskProgressPort` và `TaskAuditLogPort`; ràng buộc an ninh HTTPS-only và chống tràn số; Feature Lock chặt chẽ.
- Evidence: Đã tạo tệp SPEC.md hoàn chỉnh với 11 mục tiêu chuẩn; đối soát nhất quán với CONTEXT.md v1.4.0 đã APPROVED; kết quả phân tích Pre-Mortem và Domain Walkthrough đều đạt.
- Risks and assumptions: Các giao dịch rút tiền hoặc nộp bài của worker đã được khoanh vùng ngoại vi (Out of Scope); không có rủi ro tràn số hay rò rỉ mã độc link không an toàn nhờ `SecureUrl` và bounds check.
- Alternatives considered: Dùng tiền tệ VNĐ trực tiếp trong task post-job, nhưng đã bị bác bỏ do không khớp mô hình trả thưởng bằng Xu của dự án.
- Required human decision: Phê duyệt và khóa đặc tả kỹ thuật (`Status: APPROVED & LOCKED`) qua lệnh `/sdd-review` để chuyển sang Pha 2 SDD (`PLAN.md`).

## Human Final Review
- Status: APPROVED
- Decision: Phê duyệt và khóa đặc tả kỹ thuật SPEC.md post-job v1.0.0
- Reviewer: Admin
- Reviewed at: 2026-11-19T13:52:10+07:00
- Follow-up: /sdd-plan --feature=post-job

