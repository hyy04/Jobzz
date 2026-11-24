# Danh sách tác vụ: Xem và Duyệt bài nộp bằng chứng cho Admin (review-task-submission)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: review-task-submission
# Depth: DETAILED
# Architecture Profile: v1.1.0 (APPROVED — Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Plan Reference: .sdd/features/review-task-submission/PLAN.md (APPROVED)
# Spec Reference: .sdd/features/review-task-submission/SPEC.md (APPROVED & LOCKED)

---

## 1. Tổng quan phân rã tác vụ (Task Breakdown Overview)

| Task ID | Tiêu đề tác vụ | Layer | Owner | Phụ thuộc (blockedBy) | Ước lượng | Sizing Signal | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T001-RTS** | Xây dựng Domain Layer: Mở rộng `TaskClaim` (`reviewer_id`, `reviewed_at`, `rejection_reason`), thực thể `WorkerWallet`, `WalletTransaction`, VO `RejectionReason` & Domain Errors | Domain | `@backend-agent` | None | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T002-RTS** | Xây dựng Infra Layer: Cổng `WalletPort`, mở rộng `TaskClaimRepositoryPort`, Prisma schema (`WorkerWallet`, `WalletTransaction`), triển khai `InMemoryWalletRepository` & `InMemoryTaskClaimRepository` | Infra | `@infra-agent` | `T001-RTS` | 3.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T003-RTS** | Xây dựng Use Case Layer: `ListSubmittedClaimsUseCase` (phân trang, lọc task_id, FIFO) & `GetSubmissionDetailsUseCase` (chi tiết proofs ảnh/text) | Usecase | `@backend-agent` | `T002-RTS` | 3.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T004-RTS** | Xây dựng Use Case Layer: `ApproveTaskSubmissionUseCase` (cộng Xu ví Worker, tăng approved_count, tự động hoàn thành Task) & `RejectTaskSubmissionUseCase` (nhập lý do từ chối, giải phóng slot) | Usecase | `@backend-agent` | `T002-RTS` | 3.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T005-RTS** | Triển khai Concurrency OCC Mutex & Atomic Transactions trong Repositories: Chống Double Review, Double Crediting & Bội chi ngân sách vượt Quota | Infra / Concurrency | `@tester-agent` | `T004-RTS` | 3.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T006-RTS** | Xây dựng Interface Layer: Fastify Controller `AdminSubmissionController`, DTO Zod, Guard `adminAuthGuard` & Routes `admin-submission.routes.ts` | Interface | `@backend-agent` | `T003-RTS`, `T004-RTS` | 3.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T007-RTS** | Xây dựng Admin Dashboard Web UI: Tab "Duyệt bài nộp", danh sách bài nộp, Modal xem chi tiết proofs, Modal Lightbox phóng to ảnh, Modal nhập lý do từ chối (10/500 ký tự) | Web Frontend | `@frontend-agent` | `T006-RTS` | 4.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T008-RTS** | Kiểm thử Toàn diện Hồi quy, Clean Architecture Audit & Pre-delivery Gate (`npx vitest run; npx tsc --noEmit; npm run build`) | Verification | `@tester-agent` | `T005-RTS`, `T007-RTS` | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |

---

## 2. Chi tiết từng tác vụ (Detailed Task Records)

### T001-RTS — Xây dựng Domain Layer: Mở rộng `TaskClaim`, thực thể `WorkerWallet`, `WalletTransaction`, VO `RejectionReason` & Domain Errors
- **Intent reference:** Kế thừa từ `PLAN.md` §1.1, §2 và `SPEC.md` `REQ-RTS-007..018`, §5.1. Xây dựng các thực thể và Value Objects thuần túy trong Domain layer làm nền tảng cho việc duyệt bài và quản lý số dư Xu thưởng của Worker.
- **Input and expected outcome:**
  - *Input:* Thực thể `TaskClaim` chưa có các thuộc tính `reviewerId`, `reviewedAt`, `rejectionReason`; chưa có thực thể `WorkerWallet`, `WalletTransaction` và VO `RejectionReason`.
  - *Outcome:*
    - Cập nhật `src/domain/entities/task-claim.entity.ts`: bổ sung thuộc tính `reviewerId`, `reviewedAt`, `rejectionReason`; method `approve(reviewerId: string, now?: Date)` và `reject(reviewerId: string, reason: string, now?: Date)`; bảo đảm tính bất biến khi đã ở trạng thái kết thúc (`APPROVED` hoặc `REJECTED`).
    - Tạo `src/domain/entities/worker-wallet.entity.ts`: quản lý `workerId`, `balance`, method `credit(amount: number)`.
    - Tạo `src/domain/entities/wallet-transaction.entity.ts`: lưu vết biến động `type = 'TASK_REWARD'`, `amount`, `balanceAfter`, `referenceId`.
    - Tạo `src/domain/value-objects/rejection-reason.vo.ts`: kiểm tra độ dài 10 - 500 ký tự, loại bỏ thẻ HTML / script injection.
    - Cập nhật `src/shared/errors/claim-errors.ts`: bổ sung `ClaimAlreadyReviewedError`, `SubmissionRejectionReasonInvalidError`, `TaskQuotaExceededError`, `ClaimNotInSubmittedStatusError`, `SubmissionNotFoundError`.
    - Viết unit tests kiểm tra 100% logic domain: `tests/unit/domain/entities/admin-review-claim.spec.ts`.
- **Layer and file boundary:**
  - `src/domain/entities/task-claim.entity.ts`
  - `src/domain/entities/worker-wallet.entity.ts`
  - `src/domain/entities/wallet-transaction.entity.ts`
  - `src/domain/value-objects/rejection-reason.vo.ts`
  - `src/shared/errors/claim-errors.ts`
  - `tests/unit/domain/entities/admin-review-claim.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: none`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* TypeScript thuần túy (Clean Architecture ARCH-01), Vitest.
  - *Exact command:* `npx vitest run tests/unit/domain/entities/admin-review-claim.spec.ts`
- **Scope category:** `none` (Mở rộng code TypeScript thuần, không side-effect).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Mở rộng entity `TaskClaim` và các thực thể ví tiền nội bộ domain.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A` (Domain unit work).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T002-RTS — Xây dựng Infra Layer: Cổng `WalletPort`, mở rộng `TaskClaimRepositoryPort`, Prisma schema, triển khai `InMemoryWalletRepository` & `InMemoryTaskClaimRepository`
- **Intent reference:** Kế thừa từ `PLAN.md` §1.1, §4 và `SPEC.md` §5.2. Định nghĩa các Port trong Use Case layer và triển khai In-Memory Repositories cho ví tiền và quản lý bài nộp.
- **Input and expected outcome:**
  - *Input:* Chưa có `WalletPort`; `TaskClaimRepositoryPort` chưa có các phương thức truy vấn bài nộp `SUBMITTED` và atomic review; schema Prisma chưa có `WorkerWallet` và `WalletTransaction`.
  - *Outcome:*
    - Tạo `src/usecase/ports/wallet.port.ts`: định nghĩa các phương thức `getOrCreateWallet(workerId)`, `credit(workerId, amount, details)`.
    - Cập nhật `src/usecase/ports/task-claim-repository.port.ts`: bổ sung `findSubmittedClaims(filter)`, `findSubmissionDetails(claimId)`, `approveAtomic(...)`, `rejectAtomic(...)`.
    - Cập nhật `prisma/schema.prisma`: bổ sung `WorkerWallet`, `WalletTransaction`, mở rộng `TaskClaim`.
    - Tạo `src/infra/repositories/in-memory-wallet.repository.ts`: triển khai quản lý ví và transaction trong bộ nhớ.
    - Cập nhật `src/infra/repositories/in-memory-task-claim.repository.ts`: hỗ trợ tìm kiếm bài nộp, lọc theo task, và thực thi duyệt/từ chối nguyên tử trong memory.
    - Viết integration test: `tests/integration/infra/wallet-and-submission-repositories.spec.ts`.
- **Layer and file boundary:**
  - `src/usecase/ports/wallet.port.ts`
  - `src/usecase/ports/task-claim-repository.port.ts`
  - `prisma/schema.prisma`
  - `src/infra/repositories/in-memory-wallet.repository.ts`
  - `src/infra/repositories/in-memory-task-claim.repository.ts`
  - `tests/integration/infra/wallet-and-submission-repositories.spec.ts`
- **Owner and dependencies:** `@infra-agent` (Thực thi) / Admin (Accountable); `blockedBy: T001-RTS`.
- **Estimated effort:** 3.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* TypeScript, Prisma ORM, Vitest.
  - *Exact command:* `npx vitest run tests/integration/infra/wallet-and-submission-repositories.spec.ts`
- **Scope category:** `persistence schema/business-data mutation`.
- **Human checkpoint:** `N/A` (Đã duyệt trong PLAN.md §4).
- **Shared contract and sync-back:** Bổ sung schema models trong Prisma và mở rộng repository ports dùng chung.
- **High-risk review route:** `Financial Coin Crediting & Quota State Mutation`.
- **Post-code review:** `required` (Thay đổi persistence schema và cổng quản lý tiền).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T003-RTS — Xây dựng Use Case Layer: `ListSubmittedClaimsUseCase` & `GetSubmissionDetailsUseCase`
- **Intent reference:** Kế thừa từ `PLAN.md` §2, §3.1 và `SPEC.md` `REQ-RTS-001..005`. Triển khai các use case truy vấn danh sách bài nộp chờ duyệt và xem chi tiết bằng chứng.
- **Input and expected outcome:**
  - *Input:* Chưa có usecase cho Admin truy vấn bài nộp.
  - *Outcome:*
    - Tạo `src/usecase/list-submitted-claims.usecase.ts`: nhận filter (`taskId`, `page`, `limit`), truy vấn danh sách claim `SUBMITTED`, tính toán phân trang, đính kèm thông tin task (tiêu đề, xu thưởng), sắp xếp FIFO theo `submitted_at ASC`.
    - Tạo `src/usecase/get-submission-details.usecase.ts`: nhận `claimId`, kiểm tra tồn tại, trả về toàn bộ chi tiết bài nộp (danh sách proofs, URL ảnh, văn bản, thông tin worker, task description).
    - Viết unit tests: `tests/unit/usecase/admin-submission-inquiry-usecases.spec.ts`.
- **Layer and file boundary:**
  - `src/usecase/list-submitted-claims.usecase.ts`
  - `src/usecase/get-submission-details.usecase.ts`
  - `tests/unit/usecase/admin-submission-inquiry-usecases.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T002-RTS`.
- **Estimated effort:** 3.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Clean Architecture Use Cases, Vitest.
  - *Exact command:* `npx vitest run tests/unit/usecase/admin-submission-inquiry-usecases.spec.ts`
- **Scope category:** `none` (Read-only use cases).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Tương tác với `TaskClaimRepositoryPort` và `TaskRepositoryPort`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T004-RTS — Xây dựng Use Case Layer: `ApproveTaskSubmissionUseCase` & `RejectTaskSubmissionUseCase`
- **Intent reference:** Kế thừa từ `PLAN.md` §2, §3.2, §3.3 và `SPEC.md` `REQ-RTS-007..016`. Triển khai hai use case cốt lõi để duyệt và từ chối bài nộp, kích hoạt thay đổi số dư ví và trạng thái nhiệm vụ.
- **Input and expected outcome:**
  - *Input:* Chưa có use case thực hiện duyệt hoặc từ chối bài nộp.
  - *Outcome:*
    - Tạo `src/usecase/approve-task-submission.usecase.ts`:
      - Xác thực tồn tại claim và trạng thái `SUBMITTED`.
      - Chặn duyệt nếu `approved_count >= task.quota` (`TaskQuotaExceededError`).
      - Chuyển trạng thái sang `APPROVED`, gán `reviewer_id` và `reviewed_at`.
      - Cộng Xu thưởng vào ví Worker qua `WalletPort` và ghi bản ghi `WalletTransaction`.
      - Tăng `approved_count` của Task; tự động chuyển Task sang `COMPLETED` nếu `approved_count == quota`.
    - Tạo `src/usecase/reject-task-submission.usecase.ts`:
      - Xác thực độ dài lý do từ chối (10-500 ký tự qua `RejectionReason` VO).
      - Chuyển trạng thái sang `REJECTED`, gán `reviewer_id`, `reviewed_at`, `rejection_reason`.
      - Tự động nhả slot khả dụng cho cộng đồng nhận làm bù.
    - Viết unit tests: `tests/unit/usecase/admin-review-submission-usecases.spec.ts`.
- **Layer and file boundary:**
  - `src/usecase/approve-task-submission.usecase.ts`
  - `src/usecase/reject-task-submission.usecase.ts`
  - `tests/unit/usecase/admin-review-submission-usecases.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T002-RTS`.
- **Estimated effort:** 3.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Clean Architecture Use Cases, Vitest.
  - *Exact command:* `npx vitest run tests/unit/usecase/admin-review-submission-usecases.spec.ts`
- **Scope category:** `persistence schema/business-data mutation` & `external/irreversible side effect`.
- **Human checkpoint:** `required; Financial Coin Crediting & Quota State Mutation`.
- **Shared contract and sync-back:** Tương tác với `WalletPort`, `TaskClaimRepositoryPort`, `TaskRepositoryPort`.
- **High-risk review route:** `Financial Coin Crediting & Quota State Mutation`.
- **Post-code review:** `required`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T005-RTS — Triển khai Concurrency OCC Mutex & Atomic Transactions trong Repositories
- **Intent reference:** Kế thừa từ `PLAN.md` §3.2, §6.1, §6.2 và `SPEC.md` `REQ-RTS-017..018`, Scenario 7 BDD. Đảm bảo an toàn tuyệt đối khi nhiều Admin hoặc nhiều request duyệt/từ chối xảy ra đồng thời.
- **Input and expected outcome:**
  - *Input:* Cần triển khai các phương thức atomic trong `PrismaTaskClaimRepository` và `PrismaWalletRepository`, đồng thời kiểm chứng bằng bộ test đồng thời.
  - *Outcome:*
    - Cập nhật `src/infra/repositories/prisma-task-claim.repository.ts`: triển khai `approveAtomic` và `rejectAtomic` sử dụng interactive transaction `$transaction` với điều kiện `status = 'SUBMITTED'`.
    - Tạo `src/infra/repositories/prisma-wallet.repository.ts`: triển khai quản lý ví Worker trong PostgreSQL qua Prisma.
    - Tạo bộ test tranh chấp đồng thời: `tests/integration/concurrency/admin-double-review.spec.ts`.
    - Giả lập 2 Admin duyệt cùng 1 claim song song: đúng 1 request thành công (200 OK), request còn lại nhận 409 Conflict; không bao giờ cộng Xu 2 lần hoặc duyệt vượt quota.
- **Layer and file boundary:**
  - `src/infra/repositories/prisma-task-claim.repository.ts`
  - `src/infra/repositories/prisma-wallet.repository.ts`
  - `tests/integration/concurrency/admin-double-review.spec.ts`
- **Owner and dependencies:** `@tester-agent` (Thực thi) / Admin (Accountable); `blockedBy: T004-RTS`.
- **Estimated effort:** 3.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Prisma transactions, Vitest Concurrency.
  - *Exact command:* `npx vitest run tests/integration/concurrency/admin-double-review.spec.ts`
- **Scope category:** `persistence schema/business-data mutation`.
- **Human checkpoint:** `required; Concurrency OCC Mutex Checkpoint`.
- **Shared contract and sync-back:** Bảo đảm tính nhất quán giao dịch cơ sở dữ liệu.
- **High-risk review route:** `Financial Coin Crediting & Quota State Mutation`.
- **Post-code review:** `required`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T006-RTS — Xây dựng Interface Layer: Fastify Controller, DTO Zod, Guard & Routes
- **Intent reference:** Kế thừa từ `PLAN.md` §2, §3 và `SPEC.md` `REQ-RTS-001..016`, §6. Đóng gói các API endpoints cho Admin theo chuẩn RESTful và bảo vệ phân quyền chặt chẽ.
- **Input and expected outcome:**
  - *Input:* Chưa có controller và routes cho các API duyệt bài nộp.
  - *Outcome:*
    - Tạo `src/interface/http/dto/admin-submission.dto.ts`: validate query params (`page`, `limit`, `task_id`) và body cho reject (`rejection_reason` 10-500 chars).
    - Tạo `src/interface/http/controllers/admin-submission.controller.ts`: tiếp nhận request, gọi use cases tương ứng, trả về response chuẩn RFC 7807 khi có lỗi.
    - Tạo `src/interface/http/routes/admin-submission.routes.ts`: đăng ký 4 routes:
      - `GET /api/v1/admin/submissions` (AdminAuthGuard)
      - `GET /api/v1/admin/submissions/:claimId` (AdminAuthGuard)
      - `POST /api/v1/admin/submissions/:claimId/approve` (AdminAuthGuard)
      - `POST /api/v1/admin/submissions/:claimId/reject` (AdminAuthGuard)
    - Đăng ký routes vào app Fastify trong `src/app.ts`.
    - Viết integration test: `tests/integration/api/admin-submissions-api.spec.ts`.
- **Layer and file boundary:**
  - `src/interface/http/dto/admin-submission.dto.ts`
  - `src/interface/http/controllers/admin-submission.controller.ts`
  - `src/interface/http/routes/admin-submission.routes.ts`
  - `src/app.ts`
  - `tests/integration/api/admin-submissions-api.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T003-RTS, T004-RTS`.
- **Estimated effort:** 3.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Fastify, Zod, Vitest.
  - *Exact command:* `npx vitest run tests/integration/api/admin-submissions-api.spec.ts`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Công bố public API endpoints cho Admin Dashboard.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T007-RTS — Xây dựng Admin Dashboard Web UI: Tab "Duyệt bài nộp", Modal chi tiết proofs, Lightbox & Modal từ chối
- **Intent reference:** Kế thừa từ `PLAN.md` §2, §3 và `SPEC.md` `REQ-RTS-019..023`, Scenario 1..5 BDD. Bổ sung giao diện trực quan ngay trên Admin Dashboard cho phép Quản trị viên duyệt bài thuận tiện và nhanh chóng.
- **Input and expected outcome:**
  - *Input:* Admin Dashboard (`public/index.html`) chỉ có tab danh sách nhiệm vụ và form tạo việc, chưa có tab duyệt bài nộp.
  - *Outcome:*
    - Bổ sung tab điều hướng "Duyệt bài nộp" trên thanh menu Admin Dashboard và container nội dung tương ứng.
    - Tạo `public/js/components/admin-submissions-tab.js`: render bảng danh sách bài nộp `SUBMITTED`, badge thời gian, tiêu đề task, nút "Xem & Duyệt", phân trang.
    - Tạo `public/js/components/submission-review-modal.js`: modal hiển thị toàn bộ bằng chứng đối soát, nút "Duyệt" (màu xanh) và nút "Từ chối" (màu đỏ).
    - Tạo `public/js/components/image-lightbox-modal.js`: modal phóng to ảnh chụp màn hình khi Admin click vào ảnh thu nhỏ.
    - Tạo modal nhập lý do từ chối: có bộ đếm ký tự trực quan `0/500`, cảnh báo khi dưới 10 ký tự, vô hiệu hóa nút gửi khi chưa đủ điều kiện.
    - Cập nhật `public/js/api.js`: bổ sung các hàm gọi API `/api/v1/admin/submissions/*`.
    - Viết UI E2E test: `tests/e2e/admin-submissions-ui.spec.ts`.
- **Layer and file boundary:**
  - `public/index.html`
  - `public/css/style.css`
  - `public/js/api.js`
  - `public/js/app.js`
  - `public/js/components/admin-submissions-tab.js`
  - `public/js/components/submission-review-modal.js`
  - `public/js/components/image-lightbox-modal.js`
  - `tests/e2e/admin-submissions-ui.spec.ts`
- **Owner and dependencies:** `@frontend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T006-RTS`.
- **Estimated effort:** 4.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* HTML5, CSS3, Vanilla JS, Vitest E2E.
  - *Exact command:* `npx vitest run tests/e2e/admin-submissions-ui.spec.ts`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Tích hợp giao diện Frontend với REST API của backend.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T008-RTS — Kiểm thử Toàn diện Hồi quy, Clean Architecture Audit & Pre-delivery Gate
- **Intent reference:** Kế thừa từ `PLAN.md` §5, `CONSTITUTION.md` và `AGENTS.md` §3. Thực hiện kiểm tra chất lượng tổng thể trước khi bàn giao, đảm bảo không có bất kỳ regression bug nào và tuân thủ 100% các cổng chất lượng.
- **Input and expected outcome:**
  - *Input:* Toàn bộ mã nguồn từ T001-RTS đến T007-RTS đã hoàn thành.
  - *Outcome:*
    - Chạy toàn bộ test suite: $\ge 185$ tests pass 100%.
    - Chạy TypeScript type-checking: `npx tsc --noEmit` đạt 0 lỗi.
    - Chạy build sản phẩm: `npm run build` thành công.
    - Kiểm tra Clean Architecture boundary: Domain thuần túy không import framework hay external libs.
    - Lập biên bản hậu kiểm `.sdd/reviews/post-code-review-task-submission.md`.
- **Layer and file boundary:**
  - Toàn bộ codebase
  - `.sdd/reviews/post-code-review-task-submission.md`
- **Owner and dependencies:** `@tester-agent` (Thực thi) / Admin (Accountable); `blockedBy: T005-RTS, T007-RTS`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* TypeScript build (`tsc`), Vitest toàn bộ.
  - *Exact command:* `npx tsc --noEmit; npx vitest run; npm run build`
- **Scope category:** `none`.
- **Human checkpoint:** `required; Pre-delivery Human Acceptance`.
- **Shared contract and sync-back:** Cập nhật trạng thái feature sang `IMPLEMENTED` trên registry.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

## 3. Khuyến nghị của AI Agent (AI Agent Recommendation)

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Danh sách tác vụ kỹ thuật Pha 3 SDD (`TASKS.md`) cho tính năng `review-task-submission`.
- **Recommendation:** Kính trình Human Reviewer có thẩm quyền (Admin) xem xét và phê duyệt `APPROVED` danh sách tác vụ `TASKS.md` gồm 8 atomic tasks tuần tự để chính thức mở khóa lệnh thực thi mã nguồn (`/add-execute --feature=review-task-submission --all`).
- **Evidence:**
  - 8 tác vụ được phân rã độc lập, nguyên tử, bao phủ 100% 23 Functional Requirements EARS và 5 NFRs.
  - Sizing hợp lý: mỗi task dao động từ 2.5h đến 4.0h, toàn bộ đạt tín hiệu `within-guideline`.
  - Mọi task đều có ranh giới tệp rõ ràng, chủ sở hữu, phụ thuộc `blockedBy` minh bạch, và lệnh kiểm thử canonical chính xác.
  - Đã chỉ định rõ checkpoint bắt buộc đối với các thay đổi tài chính và khóa tranh chấp đồng thời (`T004-RTS`, `T005-RTS`, `T008-RTS`).
- **Risks and assumptions:** Phù hợp với mọi giả định đã được Admin phê duyệt tại Pha 1 và Pha 2.
- **Alternatives considered:** Đã xem xét việc gộp T003 và T004 nhưng đã tách riêng để cô lập hoàn toàn giữa tác vụ đọc (Inquiry) và tác vụ ghi thay đổi trạng thái tài chính (Approve/Reject).
- **Required human decision:** Admin phê duyệt `APPROVED` để bắt đầu thực thi lập trình (`/add-execute`).

---

## 4. Phê duyệt Cuối cùng của Con người (Human Final Review)

- **Status:** APPROVED
- **Decision:** Duyệt TASKS.md review-task-submission v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-23T15:28:50+07:00
- **Follow-up:** /add-execute --feature=review-task-submission --all

