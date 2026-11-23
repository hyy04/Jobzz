# Đặc tả kỹ thuật: Xem danh sách nhiệm vụ và Nhận việc cho Người làm (browse-and-claim-task)

# Version: 1.0.0
# Status: APPROVED & LOCKED
# Feature Slug: browse-and-claim-task
# Depth: DETAILED
# Methodology Profile: Depth=DETAILED, Risk=elevated, Review Route=Clean Architecture & Concurrency Audit, Decision Owner=Admin (@admin)
# Clarification-First Status: CONFIRMED BY HUMAN REVIEWER (G1, G2, G3, C1, C2, E1, E2, E3)

---

## 1. Bối cảnh & Mục tiêu (Context & Goal)

- **Bối cảnh:** Nền tảng Jobzz vận hành mô hình chợ nhiệm vụ freelance vi mô (Micro-tasks / Bounty Jobs) trả thù lao bằng **Xu (Coins)**. Các nhiệm vụ được phát hành độc quyền bởi Quản trị viên (`post-job` & `post-job-ui`). Sau khi nhiệm vụ được xuất bản (`ACTIVE`), Người làm (Worker) cần một phân hệ trực quan để tìm kiếm công việc phù hợp, đọc hướng dẫn chi tiết và quan trọng nhất là **Nhận việc giữ chỗ (Claim Slot)** để an tâm thực hiện nhiệm vụ trong khoảng thời gian xác định (`execution_time_minutes`).
- **Mục tiêu tính năng (`browse-and-claim-task`):**
  1. Cung cấp API và Giao diện Web công khai để Worker duyệt danh sách các nhiệm vụ `ACTIVE` còn suất (`remaining_quota > 0`), có lọc theo danh mục (`category`) và sắp xếp theo thù lao Xu hoặc độ mới.
  2. Cung cấp màn hình chi tiết nhiệm vụ hiển thị toàn bộ các bước thực hiện (`steps`) kèm liên kết an toàn và ảnh minh họa, danh sách yêu cầu nộp bằng chứng (`proof_requirements`), và thời gian giữ slot tối đa.
  3. Cung cấp luồng nhận việc (Claim Slot) bảo đảm tính toàn vẹn:
     - Giữ chỗ một suất có thời hạn `expires_at = now + execution_time_minutes`.
     - Cập nhật số slot đang giữ chỗ (`in_progress_count`) qua `TaskProgressPort`.
     - Thực thi quy tắc 1 người - 1 việc (One-Per-Worker Rule) chống spam/trục lợi.
     - Thực thi quy tắc chống tự gian lận (Anti-Self-Dealing): cấm người tạo nhiệm vụ tự nhận việc của chính mình (`worker_id != creator_id`).
     - Bảo vệ chống tranh chấp đồng thời (Concurrency / Race Condition Guard): đảm bảo khi nhiều Worker cùng tranh nhận suất cuối cùng, hệ thống tuyệt đối không bao giờ cấp phát vượt quá chỉ tiêu ngân sách (`quota`).
  4. Hỗ trợ Worker chủ động hủy nhận việc (Cancel Claim) để hoàn trả ngay suất trống cho cộng đồng nếu không thể hoàn thành.

---

## 2. Tác nhân & Phân quyền (Actors & Roles)

| Tác nhân | Vai trò trong hệ thống | Thẩm quyền trên tính năng `browse-and-claim-task` |
| :--- | :--- | :--- |
| **Worker** | Người dùng lao động tự do (vai trò `WORKER`) | **Toàn quyền phía người làm:** Duyệt danh sách nhiệm vụ công khai, lọc theo danh mục, sắp xếp, xem chi tiết các bước kèm ảnh minh họa, bấm nhận việc giữ slot, xem đồng hồ đếm ngược, và hủy nhận việc khi cần. |
| **Admin / Employer** | Người phát hành nhiệm vụ (vai trò `ADMIN`) | **Quản trị viên:** Xem được danh sách công khai và chi tiết. **BỊ CẤM:** Không được phép bấm nhận việc đối với nhiệm vụ do chính tài khoản của mình tạo ra (`worker_id == creator_id`). |
| **Guest / Anonymous** | Khách truy cập chưa xác thực | **Xem công khai:** Có thể xem danh sách và chi tiết công việc. Khi bấm "Nhận việc", hệ thống yêu cầu chuyển sang vai trò `WORKER` (hoặc đăng nhập) để thực hiện. |

---

## 3. Yêu cầu chức năng (Functional Requirements - EARS)

### 3.1 Nhóm 1: Duyệt danh sách nhiệm vụ công khai (Browse Public Tasks)

- **`REQ-BCT-001` (Event-driven):**
  - **WHEN** Worker gửi yêu cầu `GET /api/v1/public/tasks` (kèm hoặc không kèm tham số truy vấn), the system **SHALL** trả về danh sách các nhiệm vụ đang ở trạng thái `ACTIVE` và có số suất còn trống $\text{remaining\_quota} > 0$, được phân trang theo `page` và `limit`.

- **`REQ-BCT-002` (Optional):**
  - **WHERE** tham số `category` được truyền trong query string, the system **SHALL** chỉ lọc và trả về các nhiệm vụ có trường `category` khớp chính xác với giá trị yêu cầu (`APP_INSTALL`, `SURVEY`, `ACCOUNT_REGISTRATION`, `SOCIAL_INTERACTION`, `REVIEW_RATING`, `CONTENT_WRITING`, `OTHER`).

- **`REQ-BCT-003` (Optional):**
  - **WHERE** tham số `sort_by` được truyền với giá trị `REWARD_DESC`, the system **SHALL** sắp xếp các nhiệm vụ theo mức thù lao Xu giảm dần (`reward_coins` cao nhất lên đầu). Nếu `sort_by` không được truyền hoặc là `LATEST`, the system **SHALL** sắp xếp theo thời gian xuất bản mới nhất (`created_at` giảm dần).

- **`REQ-BCT-004` (Unwanted):**
  - **IF** tham số `page < 1`, hoặc `limit < 1`, hoặc `limit > 100`, hoặc `category` không thuộc danh sách Enum hợp lệ, **THEN** the system **SHALL** từ chối yêu cầu và trả về mã lỗi HTTP 400 `VALIDATION_ERROR` kèm chi tiết trường không hợp lệ.

- **`REQ-BCT-005` (Unwanted):**
  - **IF** không có nhiệm vụ nào thỏa mãn tiêu chí lọc hoặc toàn bộ nhiệm vụ đã hết suất, **THEN** the system **SHALL** trả về mã HTTP 200 với mảng dữ liệu rỗng `data: []`, `total: 0`, `page: 1`.

---

### 3.2 Nhóm 2: Xem chi tiết nhiệm vụ công khai (Task Detail Inspection)

- **`REQ-BCT-006` (Event-driven):**
  - **WHEN** Worker gửi yêu cầu `GET /api/v1/public/tasks/:id`, the system **SHALL** trả về đầy đủ thông tin nhiệm vụ bao gồm: `id`, `title`, `description`, `category`, `reward_coins`, `quota`, `remaining_quota`, `execution_time_minutes`, danh sách các bước (`steps`: `step_number`, `instruction`, `target_url`, `image_url`), và danh sách bằng chứng cần nộp (`proof_requirements`).

- **`REQ-BCT-007` (Unwanted):**
  - **IF** mã `id` nhiệm vụ không tồn tại trong hệ thống, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 404 `TASK_NOT_FOUND`.

- **`REQ-BCT-008` (Unwanted):**
  - **IF** nhiệm vụ có trạng thái khác `ACTIVE` (ví dụ `DRAFT`, `PAUSED`, `COMPLETED`, `CLOSED`), **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `TASK_NOT_AVAILABLE_FOR_CLAIM` kèm thông báo trạng thái hiện tại của nhiệm vụ.

---

### 3.3 Nhóm 3: Nhận việc giữ chỗ (Claim Slot Execution)

- **`REQ-BCT-009` (Event-driven):**
  - **WHEN** Worker gửi yêu cầu nhận việc `POST /api/v1/tasks/:id/claim` với thông tin xác thực vai trò `WORKER`, the system **SHALL** kiểm tra toàn bộ điều kiện hợp lệ và tạo một bản ghi `TaskClaim` mới với trạng thái `IN_PROGRESS`, thời điểm bắt đầu `claimed_at = now()`, thời hạn hết hạn $\text{expires\_at} = \text{now()} + (\text{execution\_time\_minutes} \times 60 \times 1000)$, đồng thời tăng số lượng giữ slot `in_progress_count` qua `TaskProgressPort`.

- **`REQ-BCT-010` (Unwanted):**
  - **IF** số suất còn lại của nhiệm vụ $\text{remaining\_quota} \le 0$ tại thời điểm nhận việc, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 409 `TASK_QUOTA_EXHAUSTED`.

- **`REQ-BCT-011` (Unwanted):**
  - **IF** định danh `worker_id` gửi lên trùng với `creator_id` của nhiệm vụ (Quy tắc chống tự gian lận Anti-Self-Dealing), **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 403 `EMPLOYER_CANNOT_CLAIM_OWN_TASK`.

- **`REQ-BCT-012` (Unwanted):**
  - **IF** Worker đã có một lượt nhận việc đang ở trạng thái `IN_PROGRESS`, `SUBMITTED`, hoặc đã được `APPROVED` trên nhiệm vụ này (Quy tắc 1 người - 1 lần duy nhất), **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 409 `WORKER_ALREADY_CLAIMED_TASK`.

- **`REQ-BCT-013` (Unwanted):**
  - **IF** vai trò của tài khoản gửi yêu cầu không phải là `WORKER` (ví dụ gửi vai trò `ADMIN` hoặc thiếu xác thực), **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 403 `UNAUTHORIZED_WORKER`.

- **`REQ-BCT-014` (State-driven):**
  - **WHILE** nhiều Worker đồng thời gửi yêu cầu nhận việc khi nhiệm vụ chỉ còn lại 1 suất cuối cùng ($\text{remaining\_quota} = 1$), the system **SHALL** áp dụng cơ chế kiểm soát đồng thời (Atomic Conditional Update / OCC) đảm bảo chỉ đúng 1 Worker nhận được slot thành công, toàn bộ các Worker còn lại nhận mã lỗi HTTP 409 `TASK_QUOTA_EXHAUSTED` mà không gây tràn trần `quota` (`No Over-allocation`).

---

### 3.4 Nhóm 4: Hủy giữ chỗ & Quản lý hết hạn (Cancel Claim & Expiration)

- **`REQ-BCT-015` (Event-driven):**
  - **WHEN** Worker gửi yêu cầu hủy nhận việc `POST /api/v1/tasks/:id/claims/cancel` đối với lượt claim đang ở trạng thái `IN_PROGRESS` và chưa hết hạn, the system **SHALL** cập nhật trạng thái lượt claim sang `CANCELED`, giảm `in_progress_count` qua `TaskProgressPort`, hoàn trả ngay lập tức 1 suất trống cho nhiệm vụ.

- **`REQ-BCT-016` (Unwanted):**
  - **IF** lượt claim cần hủy không tồn tại, hoặc không thuộc quyền sở hữu của `worker_id` gửi yêu cầu, hoặc trạng thái của claim không phải là `IN_PROGRESS`, **THEN** the system **SHALL** từ chối với mã lỗi HTTP 404 `CLAIM_NOT_FOUND` hoặc HTTP 400 `CLAIM_ALREADY_CLOSED`.

- **`REQ-BCT-017` (State-driven):**
  - **WHILE** thời gian hiện tại $\text{now()} > \text{claim.expires\_at}$ và lượt claim vẫn đang ở trạng thái `IN_PROGRESS`, the system **SHALL** tự động coi slot đó là hết hạn (`EXPIRED`) thông qua cơ chế Lazy Evaluation, loại bỏ lượt claim này khỏi `in_progress_count` khi tính toán số suất còn trống $\text{remaining\_quota}$.

---

### 3.5 Nhóm 5: Giao diện Web Người làm (Worker Web Experience)

- **`REQ-BCT-018` (Ubiquitous):**
  - The Web Frontend **SHALL** cung cấp thanh điều hướng (Navbar) tích hợp bộ chuyển đổi vai trò kiểm thử (Dev Role Switcher: `ADMIN` / `WORKER`) cho phép chuyển đổi qua lại mượt mà giữa chế độ Quản trị viên và chế độ Người làm.

- **`REQ-BCT-019` (Event-driven):**
  - **WHEN** người dùng chuyển sang vai trò `WORKER` trên Navbar, the Web Frontend **SHALL** hiển thị phân hệ "Khám Phá Việc Làm (Worker Portal)" bao gồm: thanh lọc danh mục (`category`), bộ chọn sắp xếp (`sort_by`), và lưới hiển thị các thẻ nhiệm vụ (`Task Cards`). Mỗi thẻ hiển thị rõ: Tiêu đề, Badge danh mục, Thù lao Xu (nổi bật), Số suất còn trống (`remaining_quota`), Thời gian giữ slot, và nút bấm "Xem chi tiết".

- **`REQ-BCT-020` (Event-driven):**
  - **WHEN** Worker nhấn vào một thẻ nhiệm vụ, the Web Frontend **SHALL** hiển thị Modal chi tiết nhiệm vụ bao gồm: toàn bộ hướng dẫn từng bước kèm hình ảnh minh họa to rõ ràng, danh sách yêu cầu nộp bằng chứng, và nút "Nhận việc ngay" (Claim Task).

- **`REQ-BCT-021` (Event-driven):**
  - **WHEN** Worker bấm "Nhận việc ngay" và nhận được phản hồi thành công từ API, the Web Frontend **SHALL** chuyển giao diện sang màn hình "Nhiệm vụ đang thực hiện", hiển thị **Đồng hồ đếm ngược thời gian thực (Countdown Timer)** theo giây, đổi màu cảnh báo khi thời gian còn dưới 10 phút, hiển thị hướng dẫn làm bài và nút "Hủy nhận việc".

---

## 4. Yêu cầu phi chức năng (Non-functional Requirements - NFR)

- **`NFR-BCT-01` (Hiệu năng nhận việc - Claim Latency):**
  Thời gian xử lý của API `POST /api/v1/tasks/:id/claim` từ lúc nhận request đến khi trả phản hồi cho client phải $\le 50\text{ms}$ (P95) trong điều kiện tải bình thường.

- **`NFR-BCT-02` (Hiệu năng duyệt danh sách - Listing Latency):**
  Thời gian xử lý của API `GET /api/v1/public/tasks` phải $\le 100\text{ms}$ (P95) với cơ sở dữ liệu có sẵn 1,000 nhiệm vụ.

- **`NFR-BCT-03` (Bảo mật an toàn liên kết & XSS - SEC-01):**
  100% các liên kết đích (`target_url`) và liên kết ảnh (`image_url`) trong nhiệm vụ trả về cho Worker phải bắt đầu bằng giao thức an toàn `https://` (hoặc data URL hợp lệ cho ảnh cục bộ). Toàn bộ nội dung văn bản hiển thị trên giao diện Worker phải được escape qua bộ lọc HTML chống XSS.

- **`NFR-BCT-04` (Tính toàn vẹn ngân sách & Giữ chỗ - Concurrency Integrity):**
  Tại mọi thời điểm, hệ thống phải đảm bảo bất biến (Invariant):
  $$\text{approved\_count} + \text{in\_progress\_count} \le \text{quota}$$
  Tuyệt đối không xảy ra hiện tượng cấp phát vượt trần ngân sách kể cả khi có tải đồng thời cao điểm.

- **`NFR-BCT-05` (Tính chính xác của đồng hồ đếm ngược - UX Clock Sync):**
  Đồng hồ đếm ngược phía client được tính toán dựa trên mốc thời gian tuyệt đối `expires_at` từ máy chủ, bảo đảm không bị sai lệch nếu máy người dùng bị chậm đồng hồ nội bộ.

---

## 5. Mô hình dữ liệu & Hợp đồng giao tiếp (Data Model & Schema)

### 5.1 Thực thể Domain: `TaskClaim`

```typescript
export type ClaimStatus = 
  | 'IN_PROGRESS' 
  | 'SUBMITTED' 
  | 'EXPIRED' 
  | 'CANCELED' 
  | 'APPROVED' 
  | 'REJECTED';

export interface TaskClaimProps {
  id?: string;
  taskId: string;
  workerId: string;
  status?: ClaimStatus;
  claimedAt?: Date;
  expiresAt: Date;
  submittedAt?: Date | null;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
```

### 5.2 Schema Xác thực DTO (Zod Contracts)

```typescript
// 1. Query Schema duyệt danh sách công khai
export const BrowseTasksQueryDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  category: TaskCategoryEnum.optional(),
  sort_by: z.enum(['REWARD_DESC', 'LATEST']).optional().default('LATEST'),
});

// 2. Response Schema khi nhận việc thành công
export const ClaimTaskResponseDtoSchema = z.object({
  claim_id: z.string().uuid(),
  task_id: z.string().uuid(),
  worker_id: z.string(),
  status: z.literal('IN_PROGRESS'),
  claimed_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  remaining_seconds: z.number().int().nonnegative(),
});
```

---

## 6. Xử lý lỗi & Bảng mã lỗi (Error Handling - RFC 7807)

Mọi phản hồi lỗi từ API đều tuân thủ cấu trúc chuẩn:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Thông điệp mô tả chi tiết bằng tiếng Việt.",
    "details": []
  }
}
```

| HTTP Status | Mã lỗi (`code`) | Ý nghĩa & Điều kiện kích hoạt |
| :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Tham số query hoặc body không hợp lệ (ví dụ: `page < 1`, `limit > 100`). |
| **400** | `TASK_NOT_AVAILABLE_FOR_CLAIM` | Nhiệm vụ không ở trạng thái `ACTIVE` (đang ở `DRAFT`, `PAUSED` hoặc `CLOSED`). |
| **400** | `CLAIM_ALREADY_CLOSED` | Lượt claim không ở trạng thái `IN_PROGRESS` (đã hủy hoặc hết hạn trước đó). |
| **403** | `EMPLOYER_CANNOT_CLAIM_OWN_TASK` | Người tạo nhiệm vụ cố tình nhận việc của chính mình (`worker_id == creator_id`). |
| **403** | `UNAUTHORIZED_WORKER` | Vai trò gửi lên không phải là `WORKER` (ví dụ gửi vai trò `ADMIN`). |
| **404** | `TASK_NOT_FOUND` | Không tìm thấy nhiệm vụ với mã `id` cung cấp. |
| **404** | `CLAIM_NOT_FOUND` | Không tìm thấy lượt claim tương ứng khi thực hiện hủy nhận việc. |
| **409** | `TASK_QUOTA_EXHAUSTED` | Nhiệm vụ đã hết suất trống ($\text{remaining\_quota} \le 0$). |
| **409** | `WORKER_ALREADY_CLAIMED_TASK` | Worker đã có một lượt giữ slot đang làm hoặc đã hoàn thành trên nhiệm vụ này. |
| **409** | `CONCURRENCY_CONFLICT` | Xảy ra xung đột phiên làm việc hoặc tranh chấp slot đồng thời. |

---

## 7. Tiêu chí nghiệm thu (Acceptance Criteria - BDD Scenarios)

### Kịch bản 1: Duyệt danh sách nhiệm vụ công khai thành công
- **GIVEN** Hệ thống có 3 nhiệm vụ `ACTIVE` còn suất, trong đó 2 nhiệm vụ danh mục `APP_INSTALL` và 1 nhiệm vụ `SURVEY`.
- **WHEN** Worker gửi yêu cầu `GET /api/v1/public/tasks?category=APP_INSTALL&sort_by=REWARD_DESC`.
- **THEN** Hệ thống trả về mã `200 OK` với mảng 2 nhiệm vụ `APP_INSTALL`, được sắp xếp theo `reward_coins` từ cao xuống thấp, mỗi nhiệm vụ có đầy đủ `remaining_quota > 0`.

### Kịch bản 2: Nhận việc thành công (Happy Path)
- **GIVEN** Nhiệm vụ `task-001` đang `ACTIVE`, `quota = 50`, `in_progress_count = 0`, `approved_count = 0`, `execution_time_minutes = 60`.
- **WHEN** Worker `usr-worker-01` gửi yêu cầu `POST /api/v1/tasks/task-001/claim`.
- **THEN** Hệ thống trả về mã `201 Created` kèm `claim_id`, trạng thái `IN_PROGRESS`, `expires_at` cách thời điểm hiện tại đúng 60 phút; `in_progress_count` của nhiệm vụ tăng lên 1, `remaining_quota` giảm xuống còn 49.

### Kịch bản 3: Từ chối khi nhiệm vụ đã hết suất (Quota Exhausted)
- **GIVEN** Nhiệm vụ `task-002` có `quota = 10`, `approved_count = 8`, `in_progress_count = 2` ($\text{remaining\_quota} = 0$).
- **WHEN** Worker `usr-worker-02` gửi yêu cầu `POST /api/v1/tasks/task-002/claim`.
- **THEN** Hệ thống từ chối với mã lỗi `409 Conflict`, mã lỗi `TASK_QUOTA_EXHAUSTED`.

### Kịch bản 4: Cấm người tạo nhiệm vụ tự nhận việc (Anti-Self-Dealing)
- **GIVEN** Nhiệm vụ `task-003` do `adm-001` phát hành.
- **WHEN** Tài khoản `adm-001` gửi yêu cầu `POST /api/v1/tasks/task-003/claim`.
- **THEN** Hệ thống từ chối với mã `403 Forbidden`, mã lỗi `EMPLOYER_CANNOT_CLAIM_OWN_TASK`.

### Kịch bản 5: Cấm nhận việc trùng lặp (One-Per-Worker Rule)
- **GIVEN** Worker `usr-worker-03` đang có một lượt claim `IN_PROGRESS` trên nhiệm vụ `task-001`.
- **WHEN** Worker `usr-worker-03` gửi tiếp một yêu cầu `POST /api/v1/tasks/task-001/claim`.
- **THEN** Hệ thống từ chối với mã `409 Conflict`, mã lỗi `WORKER_ALREADY_CLAIMED_TASK`.

### Kịch bản 6: Worker chủ động hủy lượt nhận việc (Cancel Claim)
- **GIVEN** Worker `usr-worker-04` đang giữ slot trên nhiệm vụ `task-001`.
- **WHEN** Worker gửi yêu cầu `POST /api/v1/tasks/task-001/claims/cancel`.
- **THEN** Hệ thống trả về `200 OK`, trạng thái claim chuyển thành `CANCELED`, `in_progress_count` giảm đi 1, và `remaining_quota` tăng lên 1 suất trống.

### Kịch bản 7: Tranh chấp đồng thời suất cuối cùng (Race Condition Safety)
- **GIVEN** Nhiệm vụ `task-004` chỉ còn đúng 1 suất duy nhất ($\text{remaining\_quota} = 1$).
- **WHEN** Hai Worker `usr-A` và `usr-B` đồng thời gửi yêu cầu nhận việc trong cùng 1 mili-giây.
- **THEN** Chỉ duy nhất 1 Worker nhận mã `201 Created` thành công; Worker còn lại nhận mã `409 TASK_QUOTA_EXHAUSTED`. `in_progress_count` tăng chính xác 1 đơn vị, không xảy ra over-allocation.

---

## 8. Phạm vi loại trừ (Out of Scope)

1. **Nộp bằng chứng hoàn thành nhiệm vụ:** Tải ảnh chụp màn hình hoặc gửi báo cáo văn bản đối soát (thuộc tính năng `submit-task-proof`).
2. **Duyệt bài và đối soát bằng chứng:** Luồng Admin kiểm tra bài nộp, từ chối hoặc duyệt thành công để chi trả Xu (thuộc tính năng `review-submission`).
3. **Quản lý Ví tiền & Rút tiền:** Tích lũy Xu, đổi Xu sang VNĐ và rút về tài khoản ngân hàng (thuộc tính năng `wallet-withdrawal`).
4. **Hệ thống cảnh báo Email / Push Notification khi sắp hết hạn slot:** Hoãn lại sang phiên bản sau.

---

## 9. Đánh giá chất lượng đa chiều (Adversarial Quality Pass)

### 9.1 Pre-mortem (Giả định sự cố)
- **Sự cố 1 (Nghẽn slot ảo do Worker bỏ dở):** Worker nhận việc nhưng sau đó không làm và không hủy, khiến nhiệm vụ bị treo số suất trống.
  - *Giải pháp & Bằng chứng:* Áp dụng cơ chế **Lazy Evaluation** trong `TaskProgressPort`. Khi đếm `in_progress_count`, chỉ tính các bản ghi `expires_at > now()`. Các slot quá hạn tự động bị loại bỏ, hoàn trả suất trống ngay lập tức mà không cần can thiệp thủ công.
- **Sự cố 2 (Cấp phát vượt Quota do Race Condition):** Khi còn 1 suất, 10 Worker cùng bấm nhận việc.
  - *Giải pháp & Bằng chứng:* Bảo vệ tầng Use Case và Repository bằng Atomic Transaction / OCC check điều kiện $\text{remaining\_quota} > 0$ ngay trong câu lệnh cập nhật, loại bỏ rủi ro over-allocation.
- **Sự cố 3 (Lệch giờ giữa Client và Server):** Máy tính của Worker bị chậm hoặc chỉnh sai ngày giờ dẫn đến đồng hồ đếm ngược hiển thị sai.
  - *Giải pháp & Bằng chứng:* API trả về thời điểm tuyệt đối `expires_at` kèm `remaining_seconds` tính từ phía server; client chỉ chạy đồng hồ đếm lùi theo số giây này, không phụ thuộc vào đồng hồ hệ thống của máy client.

### 9.2 Domain Walkthrough
- Đã kiểm tra toàn bộ luồng: Khám phá -> Lọc -> Xem chi tiết kèm ảnh minh họa -> Bấm nhận việc -> Đếm ngược làm bài -> Hủy nhận việc hoặc Hết hạn.
- Toàn bộ các mã lỗi và phản hồi đều có kịch bản Unwanted EARS tương ứng.

---

## 10. Khóa tính năng (Feature Lock)

```markdown
- Locked scope: API duyệt nhiệm vụ công khai (lọc category, sort Xu/mới nhất), API xem chi tiết kèm ảnh minh họa, API nhận việc giữ chỗ (Claim Slot) có thời hạn, API hủy nhận việc, đồng bộ TaskProgressPort, và Giao diện Worker Web Portal có đồng hồ đếm ngược.
- Deferred work: Nộp bằng chứng hoàn thành (submit-task-proof), duyệt bằng chứng chi trả Xu (review-submission), rút tiền về ngân hàng (wallet-withdrawal).
- Change path: /sdd-update --feature=browse-and-claim-task --artifact=spec --bump=<patch|minor|major> --reason="..."
- Lock boundary: Áp dụng phạm vi tính năng browse-and-claim-task; không làm thay đổi các tính năng post-job và post-job-ui đã bàn giao.
```

---

## 11. Nhật ký thay đổi (Changelog)

### v1.0.0 (2026-11-20)
- Khởi tạo tài liệu đặc tả kỹ thuật hoàn chỉnh cho tính năng `browse-and-claim-task`.
- Bổ sung 21 yêu cầu chức năng theo chuẩn EARS (`REQ-BCT-001` đến `REQ-BCT-021`) với các cặp Unwanted Error Handling và Concurrency Guard đầy đủ.
- Tích hợp kết quả tiền kiểm Clarification-First đã được xác nhận (G1 Lazy Slot Reclaim, G2 Cancel Claim, G3 Re-claim Policy, C1 OCC Guard, C2 Pagination, E1 Anti-Self-Dealing).
- Bổ sung 5 tiêu chí phi chức năng NFR đo lường được về hiệu năng, an ninh và trải nghiệm đếm ngược realtime.
- Định nghĩa Data Model Entity `TaskClaim`, Enum `ClaimStatus`, và bảng mã lỗi chuẩn RFC 7807.
- Thiết kế 7 kịch bản kiểm thử hành vi BDD chấp nhận (Acceptance Criteria).

---

## AI Agent Recommendation

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Đặc tả kỹ thuật Pha 1 SDD (`SPEC.md`) cho tính năng `browse-and-claim-task`.
- **Recommendation:** Phê duyệt tài liệu `SPEC.md` này để làm cơ sở khóa tính năng (Feature Lock) và bước vào Pha 2 Lập kế hoạch kiến trúc (`PLAN.md`). Toàn bộ 21 yêu cầu chức năng EARS đã bao phủ đầy đủ luồng duyệt việc, xem chi tiết và giữ slot làm việc, bảo vệ an toàn đồng thời và tính toàn vẹn ngân sách.
- **Evidence:** Tuân thủ `CONTEXT.md` đã được duyệt, phản ánh 100% các câu trả lời Clarification-First đã được Human xác nhận, tuân thủ `Architecture Profile v1.1.0` (Fastify, PostgreSQL, Prisma, Zod, Vitest) và `CONSTITUTION.md`.
- **Risks and assumptions:** Cần đảm bảo `TaskClaimRepository` và `TaskProgressPort` được triển khai cẩn trọng với cơ chế Atomic check để tránh race condition; đã định nghĩa kịch bản BDD kiểm thử đồng thời (Scenario 7).
- **Alternatives considered:** Đã so sánh với mô hình nộp tự do không giữ slot (Free-for-all submission). Mô hình giữ chỗ (Claim Slot with Timeout) là mô hình chuẩn mực tối ưu nhất cho nền tảng vi mô Jobzz.
- **Required human decision:** Human Reviewer có thẩm quyền (Admin) xem xét và ghi nhận quyết định phê duyệt `APPROVED` để chuyển sang Pha 2.

---

## Human Final Review

- **Status:** APPROVED
- **Decision:** Duyệt và khóa SPEC.md browse-and-claim-task v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-20T00:07:21+07:00
- **Follow-up:** /sdd-plan --feature=browse-and-claim-task 
