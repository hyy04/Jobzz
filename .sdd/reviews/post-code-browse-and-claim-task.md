# Biên bản hậu kiểm mã nguồn (Post-Code Review Report): Xem danh sách nhiệm vụ và Nhận việc cho Người làm (browse-and-claim-task)

# Version: 1.0.0
# Feature Slug: browse-and-claim-task
# Architecture Profile: v1.1.0 (APPROVED — Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Scope: Toàn bộ mã nguồn triển khai từ T001-BCT đến T007-BCT theo TASKS.md

---

## 1. Tổng quan thực thi (Execution Summary)

Toàn bộ 7 tác vụ trong snapshot phân rã kỹ thuật `TASKS.md` đã được triển khai đầy đủ và hoàn thành theo đúng nguyên tắc Clean Architecture và SDD + ADD Governance:

| Task ID | Tiêu đề tác vụ | Layer | Ranh giới tệp tin (File Boundaries) | Kết quả kiểm định |
| :--- | :--- | :--- | :--- | :--- |
| **T001-BCT** | Entity `TaskClaim`, Enum `ClaimStatus` & Domain Errors | Domain | `src/domain/entities/task-claim.entity.ts`, `src/domain/value-objects/claim-status.vo.ts`, `src/shared/errors/claim-errors.ts` | PASS (9/9 unit tests) |
| **T002-BCT** | Prisma Model `TaskClaim`, Repositories & `LiveTaskProgressAdapter` | Infra | `prisma/schema.prisma`, `src/usecase/ports/task-claim-repository.port.ts`, `src/infra/repositories/`, `src/infra/adapters/live-task-progress.adapter.ts` | PASS (4/4 integration tests) |
| **T003-BCT** | Browse, Details, Claim & Cancel Use Cases | Usecase | `src/usecase/browse-public-tasks.usecase.ts`, `src/usecase/get-public-task-details.usecase.ts`, `src/usecase/claim-task-slot.usecase.ts`, `src/usecase/cancel-task-claim.usecase.ts` | PASS (13/13 unit tests) |
| **T004-BCT** | Kiểm định Tranh chấp Đồng thời: Atomic OCC Concurrency Guard | Verification | `tests/integration/concurrency/claim-concurrency.spec.ts` | PASS (2/2 concurrency tests, Zero Over-allocation) |
| **T005-BCT** | Interface Layer: Fastify Routes, Guard, Controllers & DTOs | Interface | `src/interface/http/guards/worker-auth.guard.ts`, `src/interface/http/dto/`, `src/interface/http/controllers/`, `src/interface/http/routes/`, `src/app.ts` | PASS (10/10 API integration tests) |
| **T006-BCT** | Web UI: Worker Marketplace, Task Cards, Step Images Modal & Countdown Timer | Web Frontend | `public/index.html`, `public/js/app.js`, `public/js/api.js`, `public/js/components/worker-marketplace.js`, `public/js/components/task-claim-modal.js`, `public/js/components/countdown-timer.js` | PASS (3/3 UI E2E tests) |
| **T007-BCT** | Kiểm thử Toàn diện E2E, Clean Architecture Audit & Pre-delivery Gate | Verification | Toàn bộ 15 test files trong `tests/` | PASS (119/119 tests, tsc 0 errors, build sạch) |

---

## 2. Bằng chứng kiểm định kỹ thuật (Verification Evidence)

### 2.1 Kết quả kiểm thử tự động (Vitest Suite)
- **Tổng số bộ kiểm thử:** 15 files:
  1. `tests/unit/shared/xss-sanitizer.spec.ts` (4 tests)
  2. `tests/unit/domain/entities/task-claim.spec.ts` (9 tests)
  3. `tests/integration/infra/claim-repositories.spec.ts` (4 tests)
  4. `tests/unit/domain/entities/freelance-task.spec.ts` (15 tests)
  5. `tests/integration/concurrency/claim-concurrency.spec.ts` (2 tests)
  6. `tests/unit/domain/value-objects/value-objects.spec.ts` (19 tests)
  7. `tests/unit/usecase/browse-and-claim-usecases.spec.ts` (13 tests)
  8. `tests/unit/usecase/usecases.spec.ts` (10 tests)
  9. `tests/integration/infra/repositories.spec.ts` (8 tests)
  10. `tests/e2e/browse-and-claim-ui.spec.ts` (3 tests)
  11. `tests/e2e/post-job-e2e.spec.ts` (3 tests)
  12. `tests/e2e/post-job-ui.spec.ts` (4 tests)
  13. `tests/integration/api/browse-and-claim-api.spec.ts` (10 tests)
  14. `tests/integration/api/web-routes.spec.ts` (5 tests)
  15. `tests/integration/api/task-api.spec.ts` (10 tests)
- **Tổng số ca kiểm thử:** 119/119 passed (100%).
- **Thời gian chạy:** ~1.24s.

### 2.2 Kiểm tra an toàn kiểu dữ liệu (TypeScript Strict Check)
- **Lệnh thực thi:** `npx tsc --noEmit`
- **Kết quả:** Exited with code 0 (0 warnings, 0 type errors).
- **Lệnh build:** `npm run build` -> Biên dịch thành công vào thư mục `dist/`.

### 2.3 Bằng chứng kiểm định An toàn & Nghiệp vụ cốt lõi
1. **Kiểm soát Tranh chấp Đồng thời & Bảo vệ Ngân sách (REQ-BCT-014 & Scenario 7 BDD):**
   - Đã kiểm định bằng thực nghiệm: Khi nhiệm vụ chỉ còn lại 1 suất cuối cùng (`quota = 1`), 5 Worker gửi request nhận việc song song đồng thời trong cùng 1 mili-giây.
   - Kết quả: Đúng 1 Worker nhận mã `201 Created` thành công, 4 Worker còn lại nhận mã `409 TASK_QUOTA_EXHAUSTED`. Tổng số slot ghi nhận trong cơ sở dữ liệu bằng chính xác 1 (Cam kết Zero Over-allocation).
2. **Cơ chế Hoàn trả Slot tự động (Lazy Evaluation - REQ-BCT-017):**
   - Đã kiểm định thực nghiệm: `LiveTaskProgressAdapter` đếm `in_progress_count` bằng điều kiện `status === 'IN_PROGRESS' && expires_at > now()`. Khi thời gian trôi qua `expires_at`, số slot chiếm chỗ tự động giảm về 0, hoàn trả ngay lập tức suất trống cho Worker khác nhận việc mà không cần dịch vụ cron nền.
3. **Quy tắc Chống tự gian lận (Anti-Self-Dealing - REQ-BCT-011):**
   - Người tạo nhiệm vụ (`worker_id == creator_id`) bị chặn lập tức với mã lỗi `403 EMPLOYER_CANNOT_CLAIM_OWN_TASK`.
4. **Quy tắc 1 người - 1 lần duy nhất (One-Per-Worker Rule - REQ-BCT-012):**
   - Worker đã có slot `IN_PROGRESS` (chưa hết hạn) hoặc đã nộp bài (`SUBMITTED`) hoặc đã được duyệt (`APPROVED`) bị chặn với mã lỗi `409 WORKER_ALREADY_CLAIMED_TASK`.
5. **Worker chủ động Hủy nhận việc (Cancel Claim - REQ-BCT-015):**
   - Cho phép Worker chủ động bấm nút "Hủy nhận việc", chuyển trạng thái sang `CANCELED` và giải phóng ngay 1 suất trống cho cộng đồng.

### 2.4 Trải nghiệm người dùng Giao diện Web (UX)
- Giao diện Single Page Application tích hợp thanh chuyển Tab mượt mà giữa **Khám phá Việc làm (Worker)** và **Quản trị Nhiệm vụ (Admin)**, đồng bộ URL hash `#worker` và `#admin`.
- Lưới thẻ việc làm hiển thị trực quan mức Xu thưởng (màu vàng nổi bật), danh mục, số suất còn lại và thời gian làm bài.
- Modal xem chi tiết nhiệm vụ hiển thị **hình ảnh minh họa to rõ (Step Images)** cho từng bước thực hiện, liên kết ngoài an toàn, và danh sách yêu cầu bằng chứng.
- Widget đồng hồ đếm ngược (Countdown Timer) thời gian thực đếm lùi từng giây theo số giây từ server; tự động chuyển sang chế độ cảnh báo màu đỏ kèm hiệu ứng nhấp nháy khi thời gian giữ slot còn dưới 5 phút.

---

## 3. Quản lý trạng thái và Cam kết chuyển giao (Delivery Boundary)

- **Trạng thái mã nguồn:** Toàn bộ mã nguồn tính năng `browse-and-claim-task` đã hoàn thành và sẵn sàng 100% trong workspace local (`d:\Projetc CN\Jobzz`).
- **Ranh giới Agent:** Agent tuân thủ nghiêm ngặt điều 3 và điều 7 trong `AGENTS.md`:
  - Agent **DỪNG TRƯỚC REMOTE DELIVERY**.
  - Tuyệt đối **KHÔNG tự ý `git push`** hoặc triển khai lên remote.
  - Quyền delivery và push thuộc về Human Reviewer / Project Owner có thẩm quyền.

---

## 4. Khuyến nghị và Đánh giá (AI Recommendation)

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: Tính năng Xem danh sách nhiệm vụ và Nhận việc cho Người làm (`browse-and-claim-task`) — Toàn bộ mã nguồn backend, frontend, test suite và biên bản hậu kiểm `.sdd/reviews/post-code-browse-and-claim-task.md`.
- Recommendation: Phê duyệt nghiệm thu toàn diện mã nguồn tính năng `browse-and-claim-task`. 100% các yêu cầu chức năng (21 EARS requirements) và phi chức năng (Atomic OCC Concurrency, Lazy Evaluation Reclaim, Step Images Modal, Countdown Timer) đã được triển khai hoàn chỉnh, đạt 119/119 automated tests (không phát sinh bất kỳ lỗi hồi quy nào).
- Evidence: Kết quả chạy `npx vitest run` (119/119 passed) và `npx tsc --noEmit` (0 errors); build production `npm run build` thành công vào `dist/`.
- Risks and assumptions: Không còn rủi ro tồn đọng.
- Alternatives considered: Không có.
- Required human decision: Human Reviewer có thẩm quyền thực hiện phê duyệt nghiệm thu mã nguồn bằng cách ghi `APPROVED` vào mục `Human Final Review` dưới đây, sau đó chạy `/git-validate` để chuẩn bị commit.

## Human Final Review
- Status: APPROVED
- Decision: Nghiệm thu toàn diện mã nguồn browse-and-claim-task đạt 119/119 tests, Zero Over-allocation OCC và Lazy Evaluation
- Reviewer: Admin
- Reviewed at: 2026-11-21T13:32:21+07:00
- Follow-up: /git-validate

