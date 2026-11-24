# Đặc tả Yêu cầu Kỹ thuật: Xem và Duyệt bài nộp bằng chứng cho Admin (review-task-submission)

# Version: 1.0.0
# Status: APPROVED & LOCKED
# Feature Slug: review-task-submission
# Depth: DETAILED
# Methodology Profile: Depth=DETAILED; Risk Posture=balanced; High-risk review route=Financial Coin Crediting & Quota State Mutation; Unresolved-decision owner=Admin
# Architecture Profile: v1.1.0 (Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Context Reference: .sdd/features/review-task-submission/CONTEXT.md (APPROVED)

---

## 1. Ngữ cảnh & Mục tiêu (Context & Goal)

### 1.1 Mục tiêu nghiệp vụ (Business Goal)
Tính năng **Xem và Duyệt bài nộp bằng chứng cho Quản trị viên (`review-task-submission`)** là mắt xích nghiệm thu quyết định giá trị của toàn bộ nền tảng Jobzz. Tính năng cho phép Quản trị viên (Admin) và Người tạo việc (Employer) thẩm định khách quan các bằng chứng (ảnh chụp màn hình phóng to, văn bản đối soát) do Người làm (Worker) gửi lên ở trạng thái `SUBMITTED`, từ đó:
1. **Phê duyệt (`APPROVE`):** Chuyển trạng thái sang `APPROVED`, tự động cộng Xu thưởng (`reward_coins`) vào ví Worker, ghi nhận lịch sử giao dịch và tự động đóng chiến dịch (`Task.status = COMPLETED`) khi đạt đủ chỉ tiêu `quota`.
2. **Từ chối (`REJECT`):** Bắt buộc cung cấp lý do từ chối cụ thể ($\ge 10$ ký tự) giúp Worker hiểu rõ sai sót; đồng thời **giải phóng slot** để các Worker khác có thể nhận làm bù, bảo đảm chiến dịch đạt 100% KPI cam kết.

### 1.2 Phạm vi nghiệp vụ (Scope)
- **Nằm trong phạm vi (In-Scope):**
  - REST API truy vấn danh sách bài nộp `SUBMITTED` có phân trang, lọc theo `task_id`.
  - REST API xem chi tiết bài nộp và danh sách bằng chứng (`submitted_proofs`).
  - REST API phê duyệt bài nộp: chuyển trạng thái `APPROVED`, cộng Xu ví Worker (`WalletPort`), tăng `approved_count`, chuyển Task sang `COMPLETED` khi đủ quota.
  - REST API từ chối bài nộp: chuyển trạng thái `REJECTED`, lưu `rejection_reason`, giải phóng occupied quota để mở lại slot làm bù.
  - Cơ chế kiểm soát đồng thời Atomic OCC Mutex chống Double Review và Double Crediting.
  - Giao diện Web: Tab "Duyệt bài nộp" trên Admin Dashboard (`/admin`), modal xem chi tiết kèm phóng to ảnh (Lightbox), modal nhập lý do từ chối.
- **Nằm ngoài phạm vi (Out-of-Scope):**
  - Hệ thống khiếu nại (Dispute/Appeal) giữa Worker và Admin.
  - Hệ thống AI tự động chấm ảnh/text (AI Auto-review).
  - Rút tiền Xu ra tài khoản ngân hàng thực tế (Bank Withdrawal).

---

## 2. Tác nhân & Phân quyền (Actors & Roles)

| Tác nhân (Actor) | Vai trò hệ thống | Quyền hạn & Trách nhiệm |
| :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `ADMIN` | Xem toàn bộ danh sách bài nộp trên hệ thống, xem ảnh phóng to/text, thực hiện phê duyệt (cộng Xu) hoặc từ chối (nhập lý do). |
| **Người làm việc (Worker)** | `WORKER` | Xem lại trạng thái bài nộp của chính mình; xem lý do từ chối nếu bài nộp bị `REJECTED`; nhận Xu thưởng vào số dư ví khi bài nộp được `APPROVED`. |
| **Khách vãng lai / Ẩn danh** | `ANONYMOUS` | Bị từ chối truy cập toàn bộ các endpoint quản trị duyệt bài (`403 Forbidden` hoặc `401 Unauthorized`). |

---

## 3. Yêu cầu Chức năng (Functional Requirements - EARS)

### 3.1 Nhóm 1: Truy vấn Danh sách bài nộp & Chi tiết bằng chứng (Submissions Inquiry API)

- **`REQ-RTS-001` (Event-driven):**
  - **WHEN** Admin gửi yêu cầu `GET /api/v1/admin/submissions`, the system **SHALL** trả về danh sách các bài nộp đang ở trạng thái `SUBMITTED`, bao gồm mã claim, mã task, mã worker, tiêu đề task, số Xu thưởng, thời gian nộp `submitted_at`, số lượng bằng chứng đã nộp, sắp xếp mặc định theo `submitted_at ASC` (FIFO), có hỗ trợ phân trang (`page`, `limit`).

- **`REQ-RTS-002` (Optional):**
  - **WHERE** tham số truy vấn `task_id` được cung cấp trong yêu cầu `GET /api/v1/admin/submissions?task_id=...`, the system **SHALL** chỉ lọc và trả về danh sách các bài nộp thuộc về nhiệm vụ tương ứng.

- **`REQ-RTS-003` (Unwanted):**
  - **IF** tham số phân trang `page < 1` hoặc `limit < 1` hoặc `limit > 100`, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `INVALID_PAGINATION_PARAMS`.

- **`REQ-RTS-004` (Event-driven):**
  - **WHEN** Admin gửi yêu cầu `GET /api/v1/admin/submissions/:claimId`, the system **SHALL** trả về thông tin chi tiết đầy đủ của bài nộp, bao gồm: thông tin lượt claim, thông tin nhiệm vụ liên kết, và toàn bộ danh mục bằng chứng `submitted_proofs` (loại bằng chứng, tiêu đề yêu cầu, giá trị URL ảnh hoặc văn bản text đối soát).

- **`REQ-RTS-005` (Unwanted):**
  - **IF** mã `claimId` trong đường dẫn không tồn tại trong hệ thống, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 404 `CLAIM_NOT_FOUND`.

- **`REQ-RTS-006` (Unwanted):**
  - **IF** người gửi yêu cầu truy vấn danh sách hoặc chi tiết bài nộp không có vai trò `ADMIN`, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 403 `FORBIDDEN_NOT_ADMIN`.

---

### 3.2 Nhóm 2: Phê duyệt bài nộp & Cộng Xu thưởng (Approve Submission API)

- **`REQ-RTS-007` (Event-driven):**
  - **WHEN** Admin gửi yêu cầu `POST /api/v1/admin/submissions/:claimId/approve` cho một lượt claim đang ở trạng thái `SUBMITTED`, the system **SHALL**:
    1. Cập nhật trạng thái của `TaskClaim` sang `APPROVED`.
    2. Ghi nhận thời điểm duyệt `reviewed_at = now()` và định danh người duyệt `reviewer_id = adminId`.
    3. Tự động cộng số Xu thưởng `reward_coins` của nhiệm vụ vào ví của Worker sở hữu lượt claim đó và tạo một bản ghi biến động số dư `WalletTransaction` với kiểu `TASK_REWARD`.
    4. Tăng số lượng bài đã duyệt `approved_count` của nhiệm vụ lên 1.
    5. Trả về mã HTTP 200 OK kèm dữ liệu chi tiết của lượt claim đã duyệt và số dư ví mới của Worker.

- **`REQ-RTS-008` (State-driven):**
  - **WHILE** số lượng bài duyệt thành công của một nhiệm vụ đạt đủ chỉ tiêu số lượng (`approved_count == quota`), the system **SHALL** tự động chuyển trạng thái của nhiệm vụ `Task.status` từ `ACTIVE` sang `COMPLETED` và ghi nhận mốc thời gian hoàn tất chiến dịch `closed_at = now()`.

- **`REQ-RTS-009` (Unwanted):**
  - **IF** lượt `TaskClaim` có trạng thái khác `SUBMITTED` (ví dụ: đã `APPROVED`, đã `REJECTED`, đang `IN_PROGRESS`, hoặc đã `EXPIRED`/`CANCELED`), **THEN** the system **SHALL** từ chối yêu cầu phê duyệt và trả về mã lỗi HTTP 409 `CLAIM_NOT_IN_SUBMITTED_STATE` kèm thông báo trạng thái hiện tại.

- **`REQ-RTS-010` (Unwanted):**
  - **IF** số lượng bài đã duyệt của nhiệm vụ đã đạt mức tối đa (`approved_count >= quota`), **THEN** the system **SHALL** từ chối phê duyệt thêm và trả về mã lỗi HTTP 409 `TASK_QUOTA_REACHED` để bảo vệ ngân sách chiến dịch.

- **`REQ-RTS-011` (Ubiquitous):**
  - The system **SHALL** thực thi toàn bộ chuỗi hành động cập nhật trạng thái Claim, ghi nhận ví Xu Worker và cập nhật tiến độ Task trong một khối giao dịch nguyên tử (Atomic OCC Transaction) để ngăn ngừa tuyệt đối tình trạng thất thoát hoặc cộng Xu trùng lặp.

---

### 3.3 Nhóm 3: Từ chối bài nộp & Hoàn trả suất làm bù (Reject Submission API)

- **`REQ-RTS-012` (Event-driven):**
  - **WHEN** Admin gửi yêu cầu `POST /api/v1/admin/submissions/:claimId/reject` kèm trường `rejection_reason` hợp lệ (từ 10 đến 500 ký tự) cho một lượt claim đang ở trạng thái `SUBMITTED`, the system **SHALL**:
    1. Cập nhật trạng thái của `TaskClaim` sang `REJECTED`.
    2. Lưu trữ nội dung `rejection_reason`, thời điểm từ chối `reviewed_at = now()`, và định danh người duyệt `reviewer_id = adminId`.
    3. Giải phóng slot khỏi danh sách chiếm dụng (`occupied_slots = active + submitted + approved`), tự động làm tăng số suất khả dụng `remaining_quota` thêm 1 trên thị trường việc làm để người khác có thể nhận làm bù.
    4. Trả về mã HTTP 200 OK kèm thông tin chi tiết lượt claim bị từ chối và lý do.

- **`REQ-RTS-013` (Unwanted):**
  - **IF** trường `rejection_reason` bị bỏ trống hoặc sau khi cắt tỉa khoảng trắng có độ dài dưới 10 ký tự, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `REJECTION_REASON_TOO_SHORT` kèm thông báo yêu cầu tối thiểu 10 ký tự.

- **`REQ-RTS-014` (Unwanted):**
  - **IF** trường `rejection_reason` có độ dài vượt quá 500 ký tự, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `REJECTION_REASON_TOO_LONG` kèm thông báo giới hạn tối đa 500 ký tự.

- **`REQ-RTS-015` (Ubiquitous):**
  - The system **SHALL** tự động khử toàn bộ các thẻ HTML độc hại và script injection (XSS Sanitizer) trên nội dung `rejection_reason` trước khi lưu vào cơ sở dữ liệu.

- **`REQ-RTS-016` (Unwanted):**
  - **IF** lượt `TaskClaim` gửi đến endpoint từ chối có trạng thái khác `SUBMITTED`, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 409 `CLAIM_NOT_IN_SUBMITTED_STATE`.

---

### 3.4 Nhóm 4: Tính Bất biến & Chống Duyệt đúp (Idempotency & Concurrency Guard)

- **`REQ-RTS-017` (State-driven):**
  - **WHILE** một lượt `TaskClaim` đã chuyển sang trạng thái `APPROVED` hoặc `REJECTED`, the system **SHALL** khóa bất biến bài nộp, ngăn chặn hoàn toàn việc duyệt lại, từ chối lại hoặc hoàn tác trạng thái từ bất kỳ tác nhân nào.

- **`REQ-RTS-018` (Event-driven):**
  - **WHEN** có 2 hoặc nhiều yêu cầu thẩm định (`approve` hoặc `reject`) gửi đồng thời cho cùng một `claimId` trong cùng một mili-giây (do mạng chập chờn hoặc 2 Admin thao tác cùng lúc), the system **SHALL** chỉ xử lý thành công đúng 1 yêu cầu đầu tiên và từ chối các yêu cầu còn lại với mã lỗi HTTP 409 `CLAIM_NOT_IN_SUBMITTED_STATE`.

---

### 3.5 Nhóm 5: Giao diện Web Quản trị (Admin Web Interface)

- **`REQ-RTS-019` (Ubiquitous):**
  - The system **SHALL** cung cấp tab "Duyệt bài nộp" trên trang Admin Dashboard (`/admin`), hiển thị danh sách các bài nộp đang chờ duyệt với các cột: Ảnh thu nhỏ (Thumbnail), Tiêu đề nhiệm vụ, Tên Worker, Thời gian nộp bài, Mức thưởng Xu, và các nút thao tác.

- **`REQ-RTS-020` (Event-driven):**
  - **WHEN** Admin nhấn vào ảnh thu nhỏ hoặc nút "Xem bằng chứng", the system **SHALL** mở Modal chi tiết hiển thị toàn bộ ảnh chụp màn hình chất lượng cao và văn bản đối soát; cho phép Admin nhấn vào ảnh để mở chế độ phóng to toàn màn hình (Image Lightbox).

- **`REQ-RTS-021` (Event-driven):**
  - **WHEN** Admin nhấn nút "Duyệt bài" (màu xanh lá), the system **SHALL** hiển thị hộp thoại xác nhận nhanh ("Bạn có chắc chắn muốn duyệt bài nộp này và giải ngân [X] Xu cho Người làm?"); sau khi xác nhận, gửi yêu cầu `approve`, hiển thị thông báo thành công và xóa bài nộp khỏi danh sách chờ.

- **`REQ-RTS-022` (Event-driven):**
  - **WHEN** Admin nhấn nút "Từ chối" (màu đỏ), the system **SHALL** mở Modal bắt buộc nhập lý do từ chối với bộ đếm ký tự thời gian thực (10/500 ký tự); nút "Xác nhận từ chối" chỉ sáng lên khi nội dung đạt từ 10 ký tự trở lên.

- **`REQ-RTS-023` (Event-driven):**
  - **WHEN** Worker mở xem chi tiết lượt nhận việc đã bị từ chối trên giao diện người làm, the system **SHALL** hiển thị nhãn `Đã bị từ chối` kèm hộp thông báo lý do chi tiết từ Quản trị viên (`rejection_reason`).

---

## 4. Yêu cầu Phi Chức năng (Non-functional Requirements - NFR)

- **`NFR-PERF-01` (Thời gian phản hồi API):**
  - 95% các yêu cầu duyệt bài (`approve`), từ chối bài (`reject`) và truy vấn danh sách bài nộp phải hoàn tất trong thời gian $\le 300\text{ms}$ ở điều kiện tải bình thường.

- **`NFR-SECU-01` (Bảo vệ Quyền hạn Nghiêm ngặt - RBAC):**
  - 100% các thao tác duyệt bài nộp, từ chối bài nộp và lấy danh sách chờ duyệt phải được chặn đứng (`403 Forbidden`) nếu token người gọi không mang vai trò `ADMIN`.

- **`NFR-FINA-01` (Độ tin cậy Tài chính & Chống trùng lặp Xu):**
  - Cơ chế cộng Xu ví Worker phải đảm bảo Zero Double Crediting: Trong mọi điều kiện kiểm thử tranh chấp đồng thời (Concurrency stress-test), số tiền cộng vào ví Worker cho một lượt claim không bao giờ được vượt quá đúng 1 lần giá trị `reward_coins`.

- **`NFR-DATA-01` (Toàn vẹn Dữ liệu & XSS Sanitization):**
  - 100% các chuỗi văn bản lý do từ chối (`rejection_reason`) phải được làm sạch qua `XssSanitizer` trước khi lưu trữ xuống cơ sở dữ liệu.

- **`NFR-UX-01` (Trải nghiệm Giao diện Lightbox Phóng to):**
  - Modal phóng to ảnh bằng chứng phải phản hồi mượt mà trong $\le 100\text{ms}$ khi click, hỗ trợ phím ESC hoặc nút đóng tiện lợi trên cả màn hình máy tính và thiết bị di động.

---

## 5. Mô hình Dữ liệu (Data Model & Schema Extensions)

### 5.1 Mở rộng Thực thể TaskClaim & Bảng `task_claims`

```prisma
model TaskClaim {
  id               String    @id @default(uuid())
  task_id          String
  worker_id        String
  status           String    @default("IN_PROGRESS") @db.VarChar(20)
  claimed_at       DateTime  @default(now())
  expires_at       DateTime
  submitted_at     DateTime?
  submitted_proofs Json?
  reviewed_at      DateTime?
  reviewer_id      String?   @db.VarChar(100)
  rejection_reason String?   @db.VarChar(500)
  completed_at     DateTime?
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  task             Task      @relation(fields: [task_id], references: [id], onDelete: Cascade)

  @@index([task_id, status])
  @@index([worker_id, task_id])
  @@index([status, submitted_at])
  @@map("task_claims")
}
```

### 5.2 Mô hình Ví tiền & Giao dịch Xu Worker (`WorkerWallet` & `WalletTransaction`)

```prisma
model WorkerWallet {
  id            String              @id @default(uuid())
  worker_id     String              @unique @db.VarChar(100)
  balance_coins BigInt              @default(0)
  version       Int                 @default(1)
  created_at    DateTime            @default(now())
  updated_at    DateTime            @updatedAt

  transactions  WalletTransaction[]

  @@index([worker_id])
  @@map("worker_walets")
}

model WalletTransaction {
  id           String       @id @default(uuid())
  wallet_id    String
  worker_id    String       @db.VarChar(100)
  amount       BigInt
  type         String       @db.VarChar(30) // 'TASK_REWARD', 'WITHDRAWAL', 'BONUS'
  reference_id String?      @db.VarChar(100) // claim_id
  description  String       @db.VarChar(255)
  created_at   DateTime     @default(now())

  wallet       WorkerWallet @relation(fields: [wallet_id], references: [id], onDelete: Cascade)

  @@index([worker_id])
  @@index([reference_id])
  @@map("wallet_transactions")
}
```

---

## 6. Xử lý Lỗi & Ma trận Lỗi RFC 7807 (Error Handling Matrix)

| Error Code | HTTP Status | Tiêu đề lỗi (Title) | Chi tiết nguyên nhân (Detail) |
| :--- | :---: | :--- | :--- |
| `CLAIM_NOT_FOUND` | `404` | Không tìm thấy bài nộp | Mã lượt nhận việc `claimId` không tồn tại trong hệ thống. |
| `FORBIDDEN_NOT_ADMIN` | `403` | Không có quyền quản trị | Chỉ Quản trị viên (ADMIN) mới có quyền duyệt hoặc từ chối bài nộp. |
| `CLAIM_NOT_IN_SUBMITTED_STATE` | `409` | Trạng thái bài nộp không hợp lệ | Bài nộp không ở trạng thái `SUBMITTED` (đã được duyệt, bị từ chối hoặc đã hết hạn trước đó). |
| `TASK_QUOTA_REACHED` | `409` | Nhiệm vụ đã đủ chỉ tiêu duyệt | Chiến dịch đã đủ số lượng bài duyệt thành công (`approved_count == quota`), không thể duyệt thêm. |
| `REJECTION_REASON_TOO_SHORT` | `400` | Lý do từ chối quá ngắn | Bắt buộc nhập lý do từ chối tối thiểu 10 ký tự để phản hồi cho Worker. |
| `REJECTION_REASON_TOO_LONG` | `400` | Lý do từ chối quá dài | Lý do từ chối không được vượt quá độ dài 500 ký tự. |
| `INVALID_PAGINATION_PARAMS` | `400` | Tham số phân trang không hợp lệ | Giá trị `page` phải $\ge 1$ và `limit` phải từ 1 đến 100. |

---

## 7. Tiêu chí Chấp nhận (Acceptance Criteria - BDD Scenarios)

### Kịch bản 1: Admin duyệt bài nộp thành công và giải ngân Xu cho Worker
```gherkin
Given một lượt TaskClaim có id "claim-01" đang ở trạng thái "SUBMITTED" trên nhiệm vụ "task-01" có reward_coins = 500 và quota = 5
And approved_count hiện tại của task-01 là 2
And Worker sở hữu "worker-01" có số dư ví hiện tại là 1,000 Xu
When Admin gửi yêu cầu POST "/api/v1/admin/submissions/claim-01/approve"
Then hệ thống phản hồi HTTP 200 OK
And trạng thái TaskClaim chuyển sang "APPROVED"
And ghi nhận reviewed_at và reviewer_id của Admin
And số dư ví của worker-01 tăng thêm 500 Xu (tổng 1,500 Xu)
And một bản ghi WalletTransaction loại "TASK_REWARD" được tạo thành công
And approved_count của task-01 tăng lên 3
And trạng thái task-01 vẫn là "ACTIVE" vì 3 < 5
```

### Kịch bản 2: Tự động đóng nhiệm vụ COMPLETED khi duyệt bài thứ N đạt đủ Quota
```gherkin
Given một nhiệm vụ "task-kpi" có quota = 3 và approved_count = 2
And một lượt TaskClaim "claim-final" đang ở trạng thái "SUBMITTED"
When Admin gửi yêu cầu POST "/api/v1/admin/submissions/claim-final/approve"
Then hệ thống phản hồi HTTP 200 OK
And approved_count của task-kpi tăng lên 3 (bằng với quota = 3)
And trạng thái nhiệm vụ task-kpi tự động chuyển sang "COMPLETED"
And ghi nhận closed_at = thời điểm hiện tại
And số suất khả dụng remaining_quota của task-kpi bằng 0
```

### Kịch bản 3: Từ chối bài nộp không đạt yêu cầu và giải phóng slot làm bù
```gherkin
Given một nhiệm vụ "task-02" có quota = 5, occupied_slots hiện tại là 5 (remaining_quota = 0)
And một lượt TaskClaim "claim-bad" đang ở trạng thái "SUBMITTED"
When Admin gửi yêu cầu POST "/api/v1/admin/submissions/claim-bad/reject" với rejection_reason "Ảnh chụp màn hình bị mờ, không thấy rõ mã giao dịch."
Then hệ thống phản hồi HTTP 200 OK
And trạng thái TaskClaim chuyển sang "REJECTED"
And lưu trữ rejection_reason đúng văn bản đã nhập
And ví của worker không được cộng Xu
And slot của claim-bad được giải phóng, occupied_slots giảm từ 5 xuống 4
And remaining_quota của task-02 tăng lên 1, cho phép các Worker khác nhận làm bù
```

### Kịch bản 4: Từ chối bài nộp nhưng lý do quá ngắn (< 10 ký tự)
```gherkin
Given một lượt TaskClaim đang ở trạng thái "SUBMITTED"
When Admin gửi yêu cầu POST "/api/v1/admin/submissions/claim-01/reject" với rejection_reason "Sai ảnh"
Then hệ thống phản hồi HTTP 400 Bad Request
And mã lỗi trả về là "REJECTION_REASON_TOO_SHORT"
And trạng thái TaskClaim vẫn giữ nguyên "SUBMITTED"
```

### Kịch bản 5: Hai Admin duyệt đồng thời cùng một bài nộp (Race Condition / Concurrency)
```gherkin
Given một lượt TaskClaim đang ở trạng thái "SUBMITTED"
When 2 Admin cùng nhấn nút Duyệt trong cùng 1 mili-giây (2 request đồng thời)
Then đúng 1 request được xử lý thành công trả về HTTP 200 OK
And request còn lại nhận mã lỗi HTTP 409 "CLAIM_NOT_IN_SUBMITTED_STATE"
And số Xu thưởng chỉ được cộng đúng 1 lần duy nhất vào ví Worker (Zero Double Crediting)
```

### Kịch bản 6: Admin lọc danh sách bài nộp theo task_id và phân trang
```gherkin
Given hệ thống có 10 bài nộp SUBMITTED của task-A và 5 bài nộp SUBMITTED của task-B
When Admin gửi yêu cầu GET "/api/v1/admin/submissions?task_id=task-A&page=1&limit=5"
Then hệ thống phản hồi HTTP 200 OK
And danh sách trả về đúng 5 bài nộp đều thuộc về task-A
And tổng số bản ghi đếm được là 10
And thứ tự sắp xếp theo submitted_at tăng dần (FIFO)
```

### Kịch bản 7: Worker xem lý do bị từ chối trên giao diện cá nhân
```gherkin
Given một lượt TaskClaim "claim-rejected" của worker-01 đã bị từ chối với lý do "Ảnh mờ không rõ mã"
When Worker gửi yêu cầu GET "/api/v1/claims/claim-rejected"
Then hệ thống phản hồi HTTP 200 OK
And trường status trả về là "REJECTED"
And trường rejection_reason hiển thị đầy đủ "Ảnh mờ không rõ mã"
```

---

## 8. Giới hạn Phạm vi & Khóa Tính năng (Feature Lock)

```markdown
- Locked scope: 
  - Thẩm định bài nộp SUBMITTED: duyệt (APPROVE) và từ chối (REJECT).
  - Tích hợp cổng ví Worker Wallet cộng Xu thưởng và lưu vết giao dịch.
  - Tự động đóng nhiệm vụ COMPLETED khi approved_count == quota.
  - Cơ chế giải phóng slot khi REJECT để bù KPI chiến dịch.
  - Giao diện Admin Dashboard: Tab duyệt bài, Lightbox phóng to ảnh, Modal nhập lý do từ chối.
- Deferred work: 
  - Luồng khiếu nại (Dispute/Appeal) giữa Worker và Admin.
  - Rút tiền Xu ra tài khoản ngân hàng thực tế (Bank Withdrawal).
  - Hệ thống AI tự động chấm bài nộp (AI Auto-review).
- Change path: /sdd-update --feature=review-task-submission --artifact=spec --bump=<patch|minor|major> --reason="..."
- Lock boundary: Áp dụng duy nhất cho phạm vi tính năng review-task-submission; không ảnh hưởng các tính năng khác.
```

---

## 9. Phân tích Thử thách & Phòng ngừa Sự cố (Pre-mortem & Adversarial Quality Pass)

1. **Pre-mortem Scenario: Double Crediting do Network Retry**
   - *Rủi ro:* Mạng lag khiến Admin click đúp 2 lần hoặc proxy gửi lại request duyệt bài, khiến Worker được cộng gấp đôi số Xu.
   - *Biện pháp:* Khóa mức cơ sở dữ liệu `WHERE status = 'SUBMITTED'`. Nếu trạng thái đã là `APPROVED`, câu lệnh cập nhật trả về 0 row affected và transaction tự động rollback, ném `ClaimNotInSubmittedStateError` (409).
2. **Pre-mortem Scenario: Bội chi ngân sách khi Task đạt Quota**
   - *Rủi ro:* Khi quota là 10, có 12 người nộp bài kịp lúc. Admin bấm duyệt liên tiếp cả 12 người khiến Employer bị âm 2 suất tiền thưởng.
   - *Biện pháp:* `ApproveTaskSubmissionUseCase` kiểm tra nghiêm ngặt `approved_count < quota` ngay trong transaction. Khi đã đủ 10 người, bài thứ 11 bấm duyệt sẽ bị chặn ngay lập tức với lỗi `TASK_QUOTA_REACHED` (409).
3. **Pre-mortem Scenario: Script Injection trong Lý do từ chối**
   - *Rủi ro:* Admin vô tình hoặc kẻ tấn công cố tình nhập payload `<script>` vào ô lý do từ chối để tấn công trình duyệt của Worker khi xem lý do.
   - *Biện pháp:* Bắt buộc chạy qua `XssSanitizer.sanitize(rejection_reason)` ở cả Use Case và kiểm tra validation.

---

## AI Agent Recommendation

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Đặc tả kỹ thuật chi tiết Pha 1 SDD (`SPEC.md`) cho tính năng `review-task-submission`.
- **Recommendation:** Kính trình Human Reviewer có thẩm quyền (Admin) xem xét và phê duyệt `APPROVED & LOCKED` tài liệu đặc tả `SPEC.md` này để làm cơ sở bước sang Pha 2 Thiết kế Kiến trúc (`/sdd-plan --feature=review-task-submission`).
- **Evidence:** 
  - Toàn bộ 23 Functional Requirements được viết 100% bằng cú pháp EARS chuẩn hóa.
  - 5 NFRs đo lường được, không dùng từ ngữ mơ hồ.
  - Data Model mở rộng `TaskClaim`, ví tiền `WorkerWallet` và giao dịch `WalletTransaction`.
  - Ma trận mã lỗi chuẩn RFC 7807 (400, 403, 404, 409).
  - 7 kịch bản BDD bao phủ đầy đủ happy path, edge cases và concurrency.
  - Phân tích Pre-mortem phòng ngừa rủi ro tài chính và gian lận.
- **Risks and assumptions:** Tuân thủ các Approved Assumptions đã được Admin phê duyệt tại bước Clarification-First.
- **Alternatives considered:** Đã cân nhắc việc cho phép Admin sửa quyết định sau khi duyệt, nhưng bác bỏ để bảo vệ tính toàn vẹn tài chính.
- **Required human decision:** Admin phê duyệt `APPROVED` để chính thức khóa đặc tả yêu cầu (`APPROVED & LOCKED`).

---

## Human Final Review

- **Status:** APPROVED
- **Decision:** Duyệt và khóa SPEC.md review-task-submission v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-23T15:15:00+07:00
- **Follow-up:** /sdd-plan --feature=review-task-submission
