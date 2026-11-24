# Kế hoạch Kiến trúc Kỹ thuật: Xem và Duyệt bài nộp bằng chứng cho Admin (review-task-submission)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: review-task-submission
# Depth: DETAILED
# Methodology Profile: Depth=DETAILED; Risk Posture=balanced; High-risk review route=Financial Coin Crediting & Quota State Mutation; Unresolved-decision owner=Admin
# Architecture Profile: v1.1.0 (Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Spec Reference: .sdd/features/review-task-submission/SPEC.md (APPROVED & LOCKED)

---

## 1. Kiến trúc Tổng thể & Phương pháp Tiếp cận (Architectural Approach)

### 1.1 Nguyên tắc Thiết kế Cốt lõi
Tuân thủ nghiêm ngặt **Clean Architecture 4 lớp (Hexagonal Architecture)** theo `CONSTITUTION.md` ARCH-01 và `architecture-profile.md` v1.1.0:
1. **Domain Layer (`src/domain/`) — Độc lập và Thuần túy:**
   - Không chứa bất kỳ thư viện bên ngoài hay framework nào (Zero Third-party Dependencies).
   - Chứa thực thể `TaskClaim` (bổ sung reviewer, reviewedAt, rejectionReason và state transitions `approve`, `reject`), thực thể mới `WorkerWallet`, thực thể mới `WalletTransaction`, Value Object `RejectionReason`, và các Domain Errors.
2. **Use Case Layer (`src/usecase/`) — Điều phối Nghiệp vụ Ứng dụng:**
   - Đảm nhận toàn bộ nghiệp vụ: truy vấn danh sách nộp bài, xem chi tiết bằng chứng, phê duyệt bài nộp (cộng Xu ví và cập nhật trạng thái nhiệm vụ), từ chối bài nộp (lưu lý do và nhả slot).
   - Xác định rõ Ports (Interfaces): `TaskClaimRepositoryPort`, `WalletPort` (hoặc `WorkerWalletRepositoryPort`), `TaskRepositoryPort`.
3. **Interface Layer (`src/interface/`) — Giao tiếp Ngoại vi & Trình diễn:**
   - `AdminSubmissionController`: Tiếp nhận và xử lý HTTP requests từ Quản trị viên qua Fastify.
   - `AdminAuthGuard`: Bảo vệ toàn bộ endpoint, chặn tuyệt đối Worker hoặc Khách vãng lai (`403 Forbidden`).
   - `Zod DTOs`: Xác thực dữ liệu đầu vào nghiêm ngặt (query filter, pagination, rejection reason).
   - Web UI: Tab quản trị bài nộp trên Admin Dashboard, Modal xem chi tiết và duyệt bài, Modal Lightbox phóng to ảnh, Modal nhập lý do từ chối.
4. **Infrastructure Layer (`src/infra/`) — Hiện thực Hóa Cổng Giao tiếp:**
   - `PrismaTaskClaimRepository` & `PrismaWalletRepository`: Hiện thực hóa lưu trữ PostgreSQL qua Prisma ORM với Database Transaction (`$transaction`) có Row Lock hoặc Condition Check bảo đảm an toàn đồng thời (OCC Mutex).
   - `InMemoryTaskClaimRepository` & `InMemoryWalletRepository`: Hiện thực hóa lưu trữ bộ nhớ cho Unit/Integration Test chạy nhanh, cô lập và độc lập.

---

## 2. Ánh xạ Yêu cầu sang Thành phần (REQ-to-Component Mapping)

| Mã Yêu cầu (EARS) | Thành phần phụ trách (Component) | Lớp (Layer) | Đường dẫn tệp (File Path) | Trách nhiệm chính |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-RTS-001..003** | `ListSubmittedClaimsUseCase` | Use Case | `src/usecase/list-submitted-claims.usecase.ts` | Lấy danh sách claims `SUBMITTED`, lọc `taskId`, phân trang, sắp xếp FIFO `submitted_at ASC`. |
| **REQ-RTS-004..005** | `GetSubmissionDetailsUseCase` | Use Case | `src/usecase/get-submission-details.usecase.ts` | Truy vấn chi tiết bài nộp của `claimId`, lấy proofs (ảnh/text), task info, workerId. |
| **REQ-RTS-006** | `AdminAuthGuard` | Interface | `src/interface/http/guards/admin-auth.guard.ts` | Chặn truy cập trái phép từ Worker hoặc Anonymous (`403 Forbidden`). |
| **REQ-RTS-007..011** | `ApproveTaskSubmissionUseCase` | Use Case | `src/usecase/approve-task-submission.usecase.ts` | Phê duyệt bài nộp: chuyển Claim `APPROVED`, cộng Xu ví Worker, ghi lịch sử giao dịch, tăng `approved_count`, chuyển Task sang `COMPLETED` nếu đủ quota. |
| **REQ-RTS-012..016** | `RejectTaskSubmissionUseCase` | Use Case | `src/usecase/reject-task-submission.usecase.ts` | Từ chối bài nộp: kiểm tra `rejectionReason` (10-500 ký tự, khử XSS), chuyển Claim `REJECTED`, lưu lý do, nhả slot cho cộng đồng. |
| **REQ-RTS-017** | `TaskClaim` | Domain | `src/domain/entities/task-claim.entity.ts` | Tính bất biến của trạng thái kết thúc (`APPROVED`, `REJECTED`), cấm hoàn tác hoặc duyệt lại. |
| **REQ-RTS-018** | `PrismaTaskClaimRepository` / `InMemoryTaskClaimRepository` | Infra | `src/infra/repositories/*-task-claim.repository.ts` | Khóa OCC Atomic Transaction ngăn ngừa Double Review / Double Crediting giữa các Admin. |
| **REQ-RTS-019..023** | Admin Dashboard Submissions Web UI | Web | `public/js/components/admin-submissions-tab.js`, `public/js/components/submission-review-modal.js`, `public/js/components/image-lightbox-modal.js` | Tab "Duyệt bài nộp", danh sách bài nộp, Modal xem chi tiết proofs, Modal Lightbox phóng to ảnh, Modal nhập lý do từ chối (10/500 ký tự). |

---

## 3. Luồng Dữ liệu Chi tiết (Data Flow & State Mutation)

### 3.1 Luồng 1: Truy vấn Danh sách bài nộp & Chi tiết (REQ-RTS-001..005)
```
[Client Admin]
     │
     ▼ (GET /api/v1/admin/submissions?page=1&limit=10&task_id=...)
[AdminAuthGuard] (Xác thực role == ADMIN)
     │
     ▼
[AdminSubmissionController.list]
     │
     ▼
[ListSubmittedClaimsUseCase.execute(query)]
     │
     ▼
[TaskClaimRepositoryPort.findSubmittedClaims(filter)]
     │
     ├──► [Prisma / InMemory Database]
     │         └── Query `WHERE status = 'SUBMITTED' ORDER BY submitted_at ASC`
     │
     ▼
[Trả về DTO danh sách bài nộp + metadata phân trang] ──► [HTTP 200 OK]
```
- **Phân loại thay đổi trạng thái (State-change Category):** `none` (Truy vấn thuần túy, chỉ đọc).
- **Checkpoint:** Không yêu cầu.

---

### 3.2 Luồng 2: Phê duyệt bài nộp & Cộng Xu thưởng (REQ-RTS-007..011, REQ-RTS-017, REQ-RTS-018)
```
[Client Admin]
     │
     ▼ (POST /api/v1/admin/submissions/:claimId/approve)
[AdminAuthGuard] (Xác thực role == ADMIN)
     │
     ▼
[AdminSubmissionController.approve]
     │
     ▼
[ApproveTaskSubmissionUseCase.execute({ claimId, adminId })]
     │
     ▼
[TaskClaimRepositoryPort.approveAtomic(claimId, adminId, now)]
     │
     ▼ [Bắt đầu Database Transaction Cô Lập]
     ├── 1. Khóa bản ghi TaskClaim với điều kiện `status = 'SUBMITTED'`
     │      └── Nếu không tìm thấy hoặc status != 'SUBMITTED' ──► Ném ClaimAlreadyReviewedError (409)
     ├── 2. Lấy thông tin Task liên kết:
     │      └── Kiểm tra: Nếu approved_count >= task.quota ──► Ném TaskQuotaExceededError (409)
     ├── 3. Chuyển Claim sang APPROVED, gán reviewer_id = adminId, reviewed_at = now, completed_at = now
     ├── 4. Gọi WalletPort.credit(workerId, task.rewardCoins, { referenceId: claimId, type: 'TASK_REWARD' }):
     │      ├── Lấy hoặc tạo ví WorkerWallet (nếu chưa có thì balance = 0)
     │      ├── Cộng dồn balance += task.rewardCoins
     │      └── Ghi 1 bản ghi WalletTransaction (type: 'TASK_REWARD', amount: rewardCoins, balance_after: newBalance)
     ├── 5. Tăng Task.approved_count += 1
     │      └── Nếu approved_count == task.quota ──► Chuyển Task.status = 'COMPLETED', closed_at = now
     └── [Commit Transaction]
     │
     ▼
[Trả về DTO kết quả duyệt thành công: claim, wallet, task_status] ──► [HTTP 200 OK]
```
- **Phân loại thay đổi trạng thái (State-change Category):** `persistence schema/business-data mutation` & `external/irreversible side effect`.
- **Checkpoint:** Bắt buộc! Kiểm tra chặt chẽ tính nguyên tử, không bao giờ xảy ra cộng Xu lặp hoặc duyệt vượt Quota.

---

### 3.3 Luồng 3: Từ chối bài nộp & Giải phóng Slot (REQ-RTS-012..016, REQ-RTS-018)
```
[Client Admin]
     │
     ▼ (POST /api/v1/admin/submissions/:claimId/reject - Body: { rejection_reason })
[AdminAuthGuard] (Xác thực role == ADMIN)
     │
     ▼
[AdminSubmissionController.reject]
     │ (Zod DTO kiểm tra 10 <= rejection_reason.length <= 500)
     ▼
[RejectTaskSubmissionUseCase.execute({ claimId, adminId, rejectionReason })]
     │
     ▼
[Domain Value Object: RejectionReason.create(rejectionReason)]
     │ (Khử sạch thẻ HTML / script injection)
     ▼
[TaskClaimRepositoryPort.rejectAtomic(claimId, adminId, sanitizedReason, now)]
     │
     ▼ [Bắt đầu Database Transaction]
     ├── 1. Khóa bản ghi TaskClaim với điều kiện `status = 'SUBMITTED'`
     │      └── Nếu status != 'SUBMITTED' ──► Ném ClaimAlreadyReviewedError (409)
     ├── 2. Chuyển Claim sang REJECTED, gán reviewer_id = adminId, reviewed_at = now,
     │      completed_at = now, rejection_reason = sanitizedReason
     └── [Commit Transaction]
     │
     ▼ (Slot claim không còn chiếm giữ occupied_slots, tự động nhả 1 suất làm bù)
[Trả về DTO kết quả từ chối thành công: claim_id, status: 'REJECTED'] ──► [HTTP 200 OK]
```
- **Phân loại thay đổi trạng thái (State-change Category):** `persistence schema/business-data mutation`.
- **Checkpoint:** Bắt buộc! Kiểm tra slot giải phóng chính xác và lý do từ chối được bảo vệ chống XSS.

---

## 4. Tác động Hợp đồng Dùng chung (Shared-Contract Impact)

### 4.1 Mở rộng Bảng `task_claims` (Prisma Model)
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
  completed_at     DateTime?
  // Các trường bổ sung mới cho review-task-submission:
  reviewer_id      String?   @db.VarChar(100)
  reviewed_at      DateTime?
  rejection_reason String?   @db.Text
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  task             Task      @relation(fields: [task_id], references: [id], onDelete: Cascade)

  @@index([task_id, status])
  @@index([worker_id, task_id])
  @@index([expires_at])
  @@index([status, submitted_at])
  @@map("task_claims")
}
```

### 4.2 Bổ sung Bảng `worker_wallets` & `wallet_transactions` (Prisma Models)
```prisma
model WorkerWallet {
  id         String   @id @default(uuid())
  worker_id  String   @unique @db.VarChar(100)
  balance    Int      @default(0)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  transactions WalletTransaction[]

  @@map("worker_wallets")
}

model WalletTransaction {
  id            String   @id @default(uuid())
  wallet_id     String
  worker_id     String   @db.VarChar(100)
  type          String   @db.VarChar(30) // 'TASK_REWARD'
  amount        Int
  balance_after Int
  reference_id  String?  @db.VarChar(100) // claim_id
  description   String   @db.VarChar(255)
  created_at    DateTime @default(now())

  wallet        WorkerWallet @relation(fields: [wallet_id], references: [id], onDelete: Cascade)

  @@index([worker_id])
  @@index([wallet_id])
  @@index([reference_id])
  @@map("wallet_transactions")
}
```

- **Tính tương thích (Compatibility):** 100% Backward Compatible. Các trường mới trên `TaskClaim` đều có giá trị mặc định là `null`, không làm ảnh hưởng đến các bản ghi claim trước đó.

---

## 5. Bản đồ Nhất quán (Consistency Map)

| Yêu cầu (EARS) | Thành phần trong Plan | Nhiệm vụ kỳ vọng (Task Candidate) | Lệnh kiểm thử chuẩn (Exact Command) | Bằng chứng Kiểm thử (Evidence) | Sync / Review Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-RTS-001..006** | `ListSubmittedClaimsUseCase`, `GetSubmissionDetailsUseCase`, `AdminSubmissionController` | `T001-RTS` & `T002-RTS` | `npx vitest run tests/unit/usecase/list-submitted-claims.test.ts; npx vitest run tests/integration/admin-submissions-api.test.ts` | Test pass danh sách bài nộp, phân trang, lọc task_id, chi tiết proofs, chặn 403 cho Worker. | Pre-code sync |
| **REQ-RTS-007..011** | `ApproveTaskSubmissionUseCase`, `WorkerWallet`, `WalletPort` | `T003-RTS` & `T004-RTS` | `npx vitest run tests/unit/usecase/approve-task-submission.test.ts; npx vitest run tests/integration/approve-submission-flow.test.ts` | Test pass chuyển APPROVED, cộng Xu ví Worker, ghi transaction, tăng approved_count, chuyển Task COMPLETED khi đủ quota, chặn duyệt vượt quota (409). | Material state change checkpoint |
| **REQ-RTS-012..016** | `RejectTaskSubmissionUseCase`, `RejectionReason` VO | `T005-RTS` | `npx vitest run tests/unit/usecase/reject-task-submission.test.ts; npx vitest run tests/unit/domain/rejection-reason.test.ts` | Test pass bắt buộc lý do (10-500 ký tự), khử XSS, chuyển REJECTED, nhả slot cho cộng đồng nhận làm bù. | Material state change checkpoint |
| **REQ-RTS-017..018** | Concurrency OCC Mutex trong `TaskClaimRepositoryPort` | `T006-RTS` | `npx vitest run tests/concurrency/admin-double-review.test.ts` | Test pass 2 Admin duyệt cùng lúc một bài nộp: đúng 1 request 200 OK, 1 request trả về 409 Conflict. | Material state change checkpoint |
| **REQ-RTS-019..023** | Admin Dashboard Submissions Web UI | `T007-RTS` | `npx tsc --noEmit; npm run build; npx vitest run tests/web/admin-submissions-ui.test.ts` | Giao diện Tab "Duyệt bài nộp", Modal chi tiết kèm Lightbox phóng to ảnh, Modal lý do từ chối với bộ đếm ký tự (10/500). | Post-code final review |

---

## 6. Phân tích Rủi ro Kỹ thuật & Biện pháp Giảm thiểu (Risks & Mitigations)

### 6.1 Rủi ro 1: Phê duyệt đồng thời (Race Condition & Double Crediting)
- **Nguy cơ:** Khi có nhiều Admin hoặc Admin vô tình nhấn nút "Duyệt" 2 lần liên tiếp, hệ thống có thể cộng Xu thưởng 2 lần vào ví Worker và tính sai số lượng duyệt của Task.
- **Biện pháp giảm thiểu:** Sử dụng Atomic Transaction ở tầng Database với điều kiện tiên quyết `WHERE id = :claimId AND status = 'SUBMITTED'`. Nếu trạng thái đã bị thay đổi, transaction lập tức rollback và ném `ClaimAlreadyReviewedError` (HTTP 409 Conflict). Đồng thời vô hiệu hóa nút bấm trên Web UI ngay sau cú click đầu tiên.

### 6.2 Rủi ro 2: Bội chi ngân sách khi duyệt vượt quá Quota chiến dịch
- **Nguy cơ:** Khi nhiều Worker nộp bài đồng thời vượt quá số quota còn lại của chiến dịch, Admin nếu duyệt thiếu kiểm soát có thể khiến số bài duyệt vượt quá `quota`, gây thâm hụt ngân sách chiến dịch.
- **Biện pháp giảm thiểu:** Trong quá trình xử lý `approveAtomic`, thực hiện đếm số lượng claim đã `APPROVED`. Nếu `approved_count >= task.quota`, hệ thống từ chối phê duyệt và trả về `TaskQuotaExceededError` (HTTP 409 Conflict), bảo vệ an toàn 100% ngân sách chiến dịch.

### 6.3 Rủi ro 3: Tấn công Cross-Site Scripting (XSS) qua Lý do từ chối
- **Nguy cơ:** Kẻ xấu lợi dụng tài khoản Admin hoặc giả mạo request nhập mã JavaScript độc hại (`<script>alert(1)</script>`) vào trường `rejection_reason` nhằm tấn công trình duyệt của Worker khi họ xem lý do từ chối.
- **Biện pháp giảm thiểu:** Khử khuẩn đầu vào bằng Value Object `RejectionReason` (loại bỏ toàn bộ thẻ HTML nguy hiểm) và đồng thời áp dụng hàm tiện ích `escapeHtml` khi render text trên giao diện người dùng.

### 6.4 Rủi ro 4: Tính độc lập của môi trường kiểm thử (Test Isolation)
- **Nguy cơ:** Các bài kiểm thử phụ thuộc vào PostgreSQL thực tế có thể bị gián đoạn hoặc thất bại do môi trường Docker / database chưa sẵn sàng.
- **Biện pháp giảm thiểu:** Toàn bộ Ports (`TaskClaimRepositoryPort`, `WalletPort`, `TaskRepositoryPort`) đều có triển khai tương ứng `InMemoryTaskClaimRepository`, `InMemoryWalletRepository` và `InMemoryTaskRepository`. Nhờ đó, 100% các bộ kiểm thử Unit, Integration và Concurrency có thể chạy độc lập, siêu tốc và ổn định.

---

## 7. Các Câu hỏi Dành cho Người Thẩm định (Questions for Human Reviewer)

Sau khi nghiên cứu kỹ lưỡng `SPEC.md` và kiến trúc hệ thống hiện tại, AI Agent ghi nhận toàn bộ các quyết định nghiệp vụ cốt lõi đã được Admin phê duyệt thống nhất tại bước Clarification-First:
1. **Ví tiền Worker:** Tự động tạo ví với `balance = 0` nếu Worker nhận thưởng lần đầu; ghi nhận giao dịch `TASK_REWARD` minh bạch.
2. **Khóa ngân sách Quota:** Chặn duyệt tuyệt đối khi `approved_count >= task.quota` để bảo vệ ngân sách chiến dịch.
3. **Giải phóng Slot khi Từ chối:** Trạng thái `REJECTED` tự động trừ khỏi `occupied_slots`, mở lại đúng 1 suất khả dụng cho cộng đồng làm bù mà không cần cronjob.
4. **Độ dài Lý do Từ chối:** Bắt buộc từ 10 đến 500 ký tự và khử khuẩn XSS.

> **Xác nhận:** Không còn câu hỏi kỹ thuật tồn đọng. Kế hoạch kiến trúc đã sẵn sàng 100% để bước sang Pha 3 Phân rã Tác vụ (`/sdd-tasks`).

---

## 8. Khuyến nghị của AI Agent (AI Agent Recommendation)

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Bản kế hoạch kiến trúc kỹ thuật Pha 2 SDD (`PLAN.md`) cho tính năng `review-task-submission`.
- **Recommendation:** Kính trình Human Reviewer có thẩm quyền (Admin) xem xét và phê duyệt `APPROVED` bản kế hoạch kiến trúc kỹ thuật này để làm cơ sở triển khai Pha 3 Phân rã Tác vụ (`/sdd-tasks --feature=review-task-submission`).
- **Evidence:** 
  - Đảm bảo 100% nguyên tắc Clean Architecture 4 lớp.
  - Ánh xạ đầy đủ 23 Functional Requirements EARS vào từng thành phần và file path cụ thể.
  - Luồng dữ liệu và cơ chế OCC Mutex chống Double Review, Double Crediting và Bội chi ngân sách được thiết kế tường minh.
  - Bản đồ nhất quán (Consistency Map) liên kết chặt chẽ với các lệnh kiểm thử canonical đã được phê duyệt.
- **Risks and assumptions:** Kế thừa toàn bộ các giả định đã được Admin phê chuẩn.
- **Alternatives considered:** Đã xem xét phương án chỉ dùng cờ boolean cho việc cộng Xu nhưng bác bỏ vì không đảm bảo tính toàn vẹn kiểm toán tài chính; đã chọn kiến trúc Ví tiền + Lịch sử giao dịch chuyên biệt (`WorkerWallet` + `WalletTransaction`).
- **Required human decision:** Admin phê duyệt `APPROVED` để tiến hành phân rã tác vụ thực thi (`TASKS.md`).

---

## 9. Phê duyệt Cuối cùng của Con người (Human Final Review)

- **Status:** APPROVED
- **Decision:** Duyệt PLAN.md review-task-submission v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-23T15:27:00+07:00
- **Follow-up:** /sdd-tasks --feature=review-task-submission

