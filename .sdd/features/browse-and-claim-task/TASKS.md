# Danh sách tác vụ: Xem danh sách nhiệm vụ và Nhận việc cho Người làm (browse-and-claim-task)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: browse-and-claim-task
# Depth: DETAILED
# Architecture Profile: v1.1.0 (APPROVED — Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Plan Reference: .sdd/features/browse-and-claim-task/PLAN.md (APPROVED)
# Spec Reference: .sdd/features/browse-and-claim-task/SPEC.md (APPROVED & LOCKED)

---

## 1. Tổng quan phân rã tác vụ (Task Breakdown Overview)

| Task ID | Tiêu đề tác vụ | Layer | Owner | Phụ thuộc (blockedBy) | Ước lượng | Sizing Signal | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T001-BCT** | Xây dựng Domain Layer: Entity `TaskClaim`, Enum `ClaimStatus` & Domain Errors | Domain | `@backend-agent` | None | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T002-BCT** | Xây dựng Infra Layer: Prisma Schema, TaskClaim Repositories & Live TaskProgressAdapter | Infra | `@infra-agent` | `T001-BCT` | 3.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T003-BCT** | Xây dựng Use Case Layer: Browse, Details, Claim & Cancel Use Cases | Usecase | `@backend-agent` | `T002-BCT` | 3.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T004-BCT** | Kiểm định Tranh chấp Đồng thời: Atomic OCC Concurrency Guard Verification | Verification | `@tester-agent` | `T003-BCT` | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T005-BCT** | Xây dựng Interface Layer: Fastify Routes, Controllers, Guard & Zod DTOs | Interface | `@backend-agent` | `T003-BCT` | 3.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T006-BCT** | Xây dựng Web UI: Worker Marketplace, Task Cards, Step Images Modal & Countdown Timer | Web Frontend | `@frontend-agent` | `T005-BCT` | 4.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T007-BCT** | Kiểm thử Toàn diện E2E, Clean Architecture Audit & Pre-delivery Gate | Verification | `@tester-agent` | `T004-BCT`, `T006-BCT` | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |

---

## 2. Chi tiết từng tác vụ (Detailed Task Records)

### T001-BCT — Xây dựng Domain Layer: Entity `TaskClaim`, Enum `ClaimStatus` & Domain Errors
- **Intent reference:** Kế thừa từ `PLAN.md` §3.1 và `SPEC.md` `REQ-BCT-009..017`, §5 (Data Model). Xây dựng thực thể trung tâm quản lý vòng đời giữ slot của Worker, Value Object trạng thái và các lỗi miền nghiệp vụ chuẩn hóa.
- **Input and expected outcome:**
  - *Input:* Dự án chưa có mô hình và thực thể biểu diễn lượt giữ chỗ `TaskClaim`.
  - *Outcome:* Tạo `src/domain/entities/task-claim.entity.ts`, `src/domain/value-objects/claim-status.vo.ts`, `src/shared/errors/claim-errors.ts`, bộ unit test bao phủ toàn bộ chuyển đổi trạng thái (`cancel`, `submit`, `approve`, `reject`, kiểm tra `isExpired`). Đạt 100% test pass.
- **Layer and file boundary:**
  - `src/domain/entities/task-claim.entity.ts`
  - `src/domain/value-objects/claim-status.vo.ts`
  - `src/shared/errors/claim-errors.ts`
  - `tests/unit/domain/entities/task-claim.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: none`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* TypeScript thuần túy (Clean Architecture ARCH-01), Vitest.
  - *Exact command:* `npx vitest run tests/unit/domain/entities/task-claim.spec.ts`
- **Scope category:** `none` (Mở rộng code TypeScript thuần, không side-effect).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Định nghĩa Entity `TaskClaim` nội bộ domain.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A` (Domain unit work).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T002-BCT — Xây dựng Infra Layer: Prisma Schema, TaskClaim Repositories & Live TaskProgressAdapter
- **Intent reference:** Kế thừa từ `PLAN.md` §3.4, §6 và `SPEC.md` `REQ-BCT-009`, `REQ-BCT-014`, `REQ-BCT-017`. Mở rộng cơ sở dữ liệu Prisma với bảng `TaskClaim`, xây dựng repository lưu trữ và thay thế `StubTaskProgressAdapter` bằng `LiveTaskProgressAdapter` với cơ chế Lazy Evaluation.
- **Input and expected outcome:**
  - *Input:* `prisma/schema.prisma` chưa có model `TaskClaim`; `TaskProgressPort` đang dùng stub trả về 0.
  - *Outcome:* Thêm model `TaskClaim` vào `prisma/schema.prisma`; tạo `src/usecase/ports/task-claim-repository.port.ts`; tạo `src/infra/repositories/in-memory-task-claim.repository.ts`; tạo `src/infra/repositories/prisma-task-claim.repository.ts`; tạo `src/infra/adapters/live-task-progress.adapter.ts` đếm slot hợp lệ theo điều kiện `status == 'IN_PROGRESS' && expires_at > now()`. Integration test pass 100%.
- **Layer and file boundary:**
  - `prisma/schema.prisma`
  - `src/usecase/ports/task-claim-repository.port.ts`
  - `src/infra/repositories/in-memory-task-claim.repository.ts`
  - `src/infra/repositories/prisma-task-claim.repository.ts`
  - `src/infra/adapters/live-task-progress.adapter.ts`
  - `tests/integration/infra/claim-repositories.spec.ts`
- **Owner and dependencies:** `@infra-agent` (Thực thi) / Admin (Accountable); `blockedBy: T001-BCT`.
- **Estimated effort:** 3.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Prisma ORM, PostgreSQL, Vitest.
  - *Exact command:* `npx vitest run tests/integration/infra/claim-repositories.spec.ts`
- **Scope category:** `persistence schema/business-data mutation`.
- **Human checkpoint:** `N/A` (Đã được duyệt trong PLAN.md §5).
- **Shared contract and sync-back:** Cung cấp live implementation cho `TaskProgressPort` dùng chung; đảm bảo 100% tương thích ngược với `post-job`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required` (Thay đổi persistence schema).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T003-BCT — Xây dựng Use Case Layer: Browse, Details, Claim & Cancel Use Cases
- **Intent reference:** Kế thừa từ `PLAN.md` §3.2, §4 và `SPEC.md` `REQ-BCT-001..017`. Triển khai toàn bộ logic nghiệp vụ ứng dụng: duyệt việc công khai, xem chi tiết kèm ảnh minh họa, nhận việc giữ slot (Anti-Self-Dealing, One-Per-Worker, Quota Bounds) và hủy claim.
- **Input and expected outcome:**
  - *Input:* Chưa có các usecase duyệt việc và nhận việc cho Worker.
  - *Outcome:* Tạo `src/usecase/browse-public-tasks.usecase.ts`, `src/usecase/get-public-task-details.usecase.ts`, `src/usecase/claim-task-slot.usecase.ts`, `src/usecase/cancel-task-claim.usecase.ts`. Bộ unit test bao phủ đầy đủ các kịch bản happy path và unwanted cases (hết slot, tự nhận việc, trùng lặp claim). 100% test pass.
- **Layer and file boundary:**
  - `src/usecase/browse-public-tasks.usecase.ts`
  - `src/usecase/get-public-task-details.usecase.ts`
  - `src/usecase/claim-task-slot.usecase.ts`
  - `src/usecase/cancel-task-claim.usecase.ts`
  - `tests/unit/usecase/browse-and-claim-usecases.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T002-BCT`.
- **Estimated effort:** 3.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Clean Architecture Use Cases, Vitest.
  - *Exact command:* `npx vitest run tests/unit/usecase/browse-and-claim-usecases.spec.ts`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Tương tác với `TaskRepositoryPort` và `TaskProgressPort`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T004-BCT — Kiểm định Tranh chấp Đồng thời: Atomic OCC Concurrency Guard Verification
- **Intent reference:** Kế thừa từ `PLAN.md` §3.4, §9 (R1) và `SPEC.md` `REQ-BCT-014`, Acceptance Criteria Scenario 7. Kiểm định chuyên biệt khả năng bảo vệ tranh chấp đồng thời khi 2 hoặc nhiều Worker cùng tranh nhận suất cuối cùng của nhiệm vụ ($\text{remaining\_quota} = 1$).
- **Input and expected outcome:**
  - *Input:* Nghiệm thu cơ chế Atomic OCC trong `claimSlotAtomic` của repository.
  - *Outcome:* Tạo `tests/integration/concurrency/claim-concurrency.spec.ts`. Khởi tạo nhiệm vụ có `quota = 1`, mô phỏng 5 Worker gửi request nhận việc song song đồng thời (`Promise.all`). Xác minh chính xác: đúng 1 Worker nhận được slot (`IN_PROGRESS`), 4 Worker còn lại nhận `409 TASK_QUOTA_EXHAUSTED`, tổng `in_progress_count` bằng 1 (Zero Over-allocation).
- **Layer and file boundary:**
  - `tests/integration/concurrency/claim-concurrency.spec.ts`
- **Owner and dependencies:** `@tester-agent` (Thực thi) / Admin (Accountable); `blockedBy: T003-BCT`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Vitest, Concurrency simulation.
  - *Exact command:* `npx vitest run tests/integration/concurrency/claim-concurrency.spec.ts`
- **Scope category:** `none` (Test verification).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Xác nhận độ tin cậy của quy tắc tài chính không vượt quota.
- **High-risk review route:** `Clean Architecture & Concurrency Audit` (Đạt kiểm định).
- **Post-code review:** `required` (Bằng chứng cho critical risk R1).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T005-BCT — Xây dựng Interface Layer: Fastify Routes, Controllers, Guard & Zod DTOs
- **Intent reference:** Kế thừa từ `PLAN.md` §3.3 và `SPEC.md` `REQ-BCT-001..017`, §6 (Error Codes RFC 7807). Mở các cổng API RESTful công khai và phân quyền Worker an toàn, xác thực Zod schemas tại transport boundary và kết nối vào `app.ts`.
- **Input and expected outcome:**
  - *Input:* Chưa có routes cho public tasks và claim slots.
  - *Outcome:* Tạo `WorkerAuthGuard`, `PublicTaskQueryDto`, `ClaimTaskParamDto`, `PublicTaskController`, `TaskClaimController`, `public-task.routes.ts`, `claim.routes.ts`. Đăng ký vào `src/app.ts` với DI `LiveTaskProgressAdapter`. Tích hợp mã lỗi RFC 7807 vào `globalErrorHandler`. Toàn bộ integration test API đạt 100% pass.
- **Layer and file boundary:**
  - `src/interface/http/guards/worker-auth.guard.ts`
  - `src/interface/http/dto/public-task.dto.ts`
  - `src/interface/http/dto/claim.dto.ts`
  - `src/interface/http/controllers/public-task.controller.ts`
  - `src/interface/http/controllers/task-claim.controller.ts`
  - `src/interface/http/routes/public-task.routes.ts`
  - `src/interface/http/routes/claim.routes.ts`
  - `src/interface/http/error-handler.ts`
  - `src/app.ts`
  - `tests/integration/api/browse-and-claim-api.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T003-BCT`.
- **Estimated effort:** 3.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Fastify v4/v5, Zod v3+, Vitest.
  - *Exact command:* `npx vitest run tests/integration/api/browse-and-claim-api.spec.ts`
- **Scope category:** `shared/public contract` (Mở rộng thêm các REST endpoints công khai).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Công bố API `/api/v1/public/tasks` và `/api/v1/tasks/:id/claim`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required` (Public contract endpoints).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T006-BCT — Xây dựng Web UI: Worker Marketplace, Task Cards, Step Images Modal & Countdown Timer
- **Intent reference:** Kế thừa từ `PLAN.md` §3.5, §10 (Q1, Q2) và `SPEC.md` `REQ-BCT-018..021`. Xây dựng trải nghiệm duyệt việc, xem chi tiết nhiệm vụ có ảnh minh họa to rõ, nhận việc và đếm ngược thời gian thực trên SPA client.
- **Input and expected outcome:**
  - *Input:* Giao diện `public/index.html` hiện tại chỉ phục vụ Admin.
  - *Outcome:* Tạo `public/js/components/worker-marketplace.js` (Thẻ việc làm dạng Grid, lọc category, sắp xếp Xu thưởng); tạo `public/js/components/task-claim-modal.js` (Modal chi tiết hiển thị các bước có **ảnh minh họa to rõ**, liên kết an toàn, yêu cầu bằng chứng, nút nhận việc); tạo `public/js/components/countdown-timer.js` (Widget đếm ngược thời gian giữ slot thời gian thực, cảnh báo đỏ khi còn < 5 phút, nút hủy claim); tích hợp Role Switcher trong `public/js/components/navbar.js` và điều hướng URL hash `#worker` / `#admin` trong `public/js/app.js` và `public/index.html`.
- **Layer and file boundary:**
  - `public/index.html`
  - `public/css/style.css`
  - `public/js/app.js`
  - `public/js/api.js`
  - `public/js/components/navbar.js`
  - `public/js/components/worker-marketplace.js`
  - `public/js/components/task-claim-modal.js`
  - `public/js/components/countdown-timer.js`
  - `tests/e2e/browse-and-claim-ui.spec.ts`
- **Owner and dependencies:** `@frontend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T005-BCT`.
- **Estimated effort:** 4.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* HTML5, Tailwind CSS CDN, Vanilla ES Modules, Vitest E2E.
  - *Exact command:* `npx vitest run tests/e2e/browse-and-claim-ui.spec.ts`
- **Scope category:** `none` (Tài nguyên tĩnh frontend client).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Tích hợp gọi API `/api/v1/public/tasks` và `/api/v1/tasks/:id/claim`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required` (Giao diện web người dùng).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T007-BCT — Kiểm thử Toàn diện E2E, Clean Architecture Audit & Pre-delivery Gate
- **Intent reference:** Kế thừa từ `CONSTITUTION.md` (`ARCH-01`, `ENG-02`), `PLAN.md` §7, §8 và `SPEC.md` DoD. Chạy toàn bộ bộ kiểm thử hồi quy của hệ thống, kiểm tra typecheck TypeScript, xác minh không vi phạm quy tắc phụ thuộc Clean Architecture, và chuẩn bị báo cáo nghiệm thu Post-code review.
- **Input and expected outcome:**
  - *Input:* Mã nguồn toàn bộ 6 tác vụ T001-BCT đến T006-BCT đã hoàn thành.
  - *Outcome:* `npx tsc --noEmit` đạt 0 lỗi typecheck; toàn bộ kiểm thử (post-job, post-job-ui, browse-and-claim-task) đạt 100% pass (dự kiến > 105 tests); không có rò rỉ secret (`Zero Secret Policy`); biên bản nghiệm thu hậu kiểm `post-code-browse-and-claim-task.md` sẵn sàng.
- **Layer and file boundary:**
  - `tests/` (Toàn bộ test suite)
  - `.sdd/reviews/post-code-browse-and-claim-task.md`
- **Owner and dependencies:** `@tester-agent` (Thực thi) / Admin (Accountable); `blockedBy: T004-BCT, T006-BCT`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* TypeScript compiler (`tsc`), Vitest test runner.
  - *Exact command:* `npx tsc --noEmit && npx vitest run`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Đồng bộ trạng thái sổ đăng ký `.sdd/README.md` sang `IMPLEMENTED`.
- **High-risk review route:** `Clean Architecture & Concurrency Audit`.
- **Post-code review:** `required` (Tạo biên bản nghiệm thu mã nguồn).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

## 3. Tiêu chí Hoàn thành (Definition of Done - DoD)

- [x] Toàn bộ 7 tác vụ đều đạt tính chất nguyên tử (Atomic), độc lập (Independent) hoặc khai báo `blockedBy` minh bạch.
- [x] Mỗi tác vụ có đầy đủ Intent reference (`REQ-BCT-XXX`), Input/Outcome, File boundary cụ thể, Owner, Sizing signal, Profile binding, Exact verification command và Execution readiness.
- [x] Toàn bộ 21 yêu cầu chức năng EARS từ `SPEC.md` và các thành phần trong `PLAN.md` đã được phân rã trọn vẹn, không bỏ sót.
- [x] Tác vụ tranh chấp đồng thời `T004-BCT` được cô lập thành tác vụ kiểm định chuyên sâu cho Critical Risk R1.
- [x] Không có tác vụ nào vượt quá phạm vi Feature Lock hay chạm vào Out of Scope (nộp bằng chứng, duyệt tiền, rút tiền).
- [x] Sizing signal của tất cả các tác vụ đều nằm trong ngưỡng hướng dẫn (`within-guideline` $\le 4$ giờ).

---

## AI Agent Recommendation

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Danh sách phân rã tác vụ Pha 3 SDD (`TASKS.md`) cho tính năng `browse-and-claim-task`.
- **Recommendation:** Phê duyệt tài liệu `TASKS.md` này để làm cơ sở cấp quyền thực thi (Execution Grant) và bước vào Pha 4–5 ADD Triển khai mã nguồn (`/add-execute --feature=browse-and-claim-task --all`). Toàn bộ 7 tác vụ có ranh giới tệp tin cô lập, lệnh kiểm định cụ thể và đường phụ thuộc rõ ràng.
- **Evidence:** Tuân thủ `SPEC.md` v1.0.0 đã được duyệt `APPROVED & LOCKED`, tuân thủ `PLAN.md` v1.0.0 đã được duyệt `APPROVED`, tuân thủ `Architecture Profile v1.1.0` (Fastify, PostgreSQL, Prisma, Zod, Vitest) và `CONSTITUTION.md`.
- **Risks and assumptions:** Cần đảm bảo thứ tự thực thi tuân thủ nghiêm ngặt `blockedBy`: Domain -> Infra -> Use Cases -> Concurrency / Interface -> Web UI -> Full Verification.
- **Alternatives considered:** Đã cân nhắc gộp T003 và T004, nhưng tách T004 (Concurrency OCC test) thành tác vụ độc lập giúp cô lập và đảm bảo kiểm thử kỹ lưỡng rủi ro tài chính race condition.
- **Required human decision:** Human Reviewer có thẩm quyền (Admin) xem xét và ghi nhận quyết định phê duyệt `APPROVED` để bắt đầu thực thi code (`/add-execute`).

---

## Human Final Review

- **Status:** APPROVED
- **Decision:** Duyệt TASKS.md browse-and-claim-task v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-20T00:45:00+07:00
- **Follow-up:** /add-execute --feature=browse-and-claim-task --all

---

## Current Handoff State

## Execution Record — E-browse-and-claim-task-all-A1
- Coordinator: /add-execute direct
- Project ownership: team
- Agent execution: direct
- Governance resolution: canonical; invocation axis overrides: none
- Feature: browse-and-claim-task
- Selection/tasks/state: all snapshot; T001-BCT, T002-BCT, T003-BCT, T004-BCT, T005-BCT, T006-BCT, T007-BCT; COMPLETED
- Task execution grants:
  - T001-BCT: grant ID=G-BCT-001-A1; grant attempt=1; route=direct; task grant state=RETIRED; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=Action Record T001-BCT; terminal evidence=COMPLETED (9/9 unit tests pass)
  - T002-BCT: grant ID=G-BCT-002-A1; grant attempt=1; route=direct; task grant state=RETIRED; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=Action Record T002-BCT; terminal evidence=COMPLETED (4/4 tests pass)
  - T003-BCT: grant ID=G-BCT-003-A1; grant attempt=1; route=direct; task grant state=RETIRED; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=Action Record T003-BCT; terminal evidence=COMPLETED (13/13 tests pass)
  - T004-BCT: grant ID=G-BCT-004-A1; grant attempt=1; route=direct; task grant state=RETIRED; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=Action Record T004-BCT; terminal evidence=COMPLETED (2/2 concurrency tests pass)
  - T005-BCT: grant ID=G-BCT-005-A1; grant attempt=1; route=direct; task grant state=RETIRED; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=Action Record T005-BCT; terminal evidence=COMPLETED (10/10 tests pass)
  - T006-BCT: grant ID=G-BCT-006-A1; grant attempt=1; route=direct; task grant state=RETIRED; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=Action Record T006-BCT; terminal evidence=COMPLETED (3/3 UI E2E tests pass)
  - T007-BCT: grant ID=G-BCT-007-A1; grant attempt=1; route=direct; task grant state=RETIRED; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=Action Record T007-BCT; terminal evidence=COMPLETED (119/119 tests pass, tsc pass, build clean)
- Host execution-claim evidence: UNVERIFIED
- Ownership and frozen contracts: TaskProgressPort v1.1.0 (Backward compatible implementation)
- Profile/checkpoint/commands: Vitest, TypeScript (tsc) approved
- Runtime identity evidence: VERIFIED; direct execution in current session
- Runtime enforcement evidence: UNVERIFIED
- Worker/host task references: direct/no worker
- Attempt and retry count: attempt 1; consecutive failures 0; maximum 5
- Results/integration/blocker/sync-back: Toàn bộ 7/7 tác vụ đã hoàn thành; 119/119 tests PASS; post-code review generated.

## Action Record — T001-BCT
- Actor: @backend-agent (Direct execution)
- Approved scope and file boundary:
  - `src/domain/entities/task-claim.entity.ts`
  - `src/domain/value-objects/claim-status.vo.ts`
  - `src/shared/errors/claim-errors.ts`
  - `tests/unit/domain/entities/task-claim.spec.ts`
- Profile binding and exact commands: Vitest; `npx vitest run tests/unit/domain/entities/task-claim.spec.ts`
- State-change category: none
- Human checkpoint: N/A
- Task execution grant: G-BCT-001-A1; route=direct; consumer=session-direct-consumer; consumption=CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Khởi tạo Entity `TaskClaim`, Value Object `ClaimStatus`, bộ mã lỗi chuẩn hóa RFC 7807; 9/9 unit tests pass.
- Validation route: npx vitest run tests/unit/domain/entities/task-claim.spec.ts (PASS)
- Post-code review: N/A
- Residual blocker: none
- Sync-back decision: None

## Action Record — T002-BCT
- Actor: @infra-agent (Direct execution)
- Approved scope and file boundary:
  - `prisma/schema.prisma`
  - `src/usecase/ports/task-claim-repository.port.ts`
  - `src/infra/repositories/in-memory-task-claim.repository.ts`
  - `src/infra/repositories/prisma-task-claim.repository.ts`
  - `src/infra/adapters/live-task-progress.adapter.ts`
  - `tests/integration/infra/claim-repositories.spec.ts`
- Profile binding and exact commands: Prisma, PostgreSQL, Vitest; `npx vitest run tests/integration/infra/claim-repositories.spec.ts`
- State-change category: persistence schema/business-data mutation
- Human checkpoint: N/A (Approved in Plan §5)
- Task execution grant: G-BCT-002-A1; route=direct; consumer=session-direct-consumer; consumption=CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Cập nhật Prisma Model `TaskClaim`, tạo `TaskClaimRepositoryPort`, `InMemoryTaskClaimRepository` với Atomic lock, `PrismaTaskClaimRepository`, và `LiveTaskProgressAdapter` với Lazy Evaluation; 4/4 integration tests pass.
- Validation route: npx vitest run tests/integration/infra/claim-repositories.spec.ts (PASS)
- Post-code review: required (Sẽ tổng hợp trong post-code delivery report)
- Residual blocker: none
- Sync-back decision: Fulfills TaskProgressPort contract live implementation.

## Action Record — T003-BCT
- Actor: @backend-agent (Direct execution)
- Approved scope and file boundary:
  - `src/usecase/browse-public-tasks.usecase.ts`
  - `src/usecase/get-public-task-details.usecase.ts`
  - `src/usecase/claim-task-slot.usecase.ts`
  - `src/usecase/cancel-task-claim.usecase.ts`
  - `tests/unit/usecase/browse-and-claim-usecases.spec.ts`
- Profile binding and exact commands: Clean Architecture Use Cases, Vitest; `npx vitest run tests/unit/usecase/browse-and-claim-usecases.spec.ts`
- State-change category: none
- Human checkpoint: N/A
- Task execution grant: G-BCT-003-A1; route=direct; consumer=session-direct-consumer; consumption=CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Triển khai 4 usecases nghiệp vụ duyệt việc, xem chi tiết, nhận việc giữ slot và hủy claim; 13/13 unit tests pass.
- Validation route: npx vitest run tests/unit/usecase/browse-and-claim-usecases.spec.ts (PASS)
- Post-code review: N/A
- Residual blocker: none
- Sync-back decision: None

## Action Record — T004-BCT
- Actor: @tester-agent (Direct execution)
- Approved scope and file boundary:
  - `tests/integration/concurrency/claim-concurrency.spec.ts`
- Profile binding and exact commands: Vitest, Concurrency simulation; `npx vitest run tests/integration/concurrency/claim-concurrency.spec.ts`
- State-change category: none (Test verification)
- Human checkpoint: N/A
- Task execution grant: G-BCT-004-A1; route=direct; consumer=session-direct-consumer; consumption=CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Kiểm định độc lập cơ chế tranh chấp đồng thời (Scenario 7 BDD): 5 worker tranh 1 slot -> đúng 1 thành công, 4 nhận 409; 10 worker tranh 3 slots -> đúng 3 thành công, 7 nhận 409; Zero Over-allocation được chứng minh bằng thực nghiệm.
- Validation route: npx vitest run tests/integration/concurrency/claim-concurrency.spec.ts (PASS)
- Post-code review: required (Bằng chứng cho Critical Risk R1)
- Residual blocker: none
- Sync-back decision: Confirmed Atomic OCC safety.

## Action Record — T005-BCT
- Actor: @backend-agent (Direct execution)
- Approved scope and file boundary:
  - `src/interface/http/guards/worker-auth.guard.ts`
  - `src/interface/http/dto/public-task.dto.ts`
  - `src/interface/http/dto/claim.dto.ts`
  - `src/interface/http/controllers/public-task.controller.ts`
  - `src/interface/http/controllers/task-claim.controller.ts`
  - `src/interface/http/routes/public-task.routes.ts`
  - `src/interface/http/routes/claim.routes.ts`
  - `src/app.ts`
  - `tests/integration/api/browse-and-claim-api.spec.ts`
- Profile binding and exact commands: Fastify, Zod, Vitest; `npx vitest run tests/integration/api/browse-and-claim-api.spec.ts`
- State-change category: shared/public contract
- Human checkpoint: N/A
- Task execution grant: G-BCT-005-A1; route=direct; consumer=session-direct-consumer; consumption=CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Xây dựng WorkerAuthGuard, Zod DTOs, PublicTaskController, TaskClaimController, các tuyến đường `/api/v1/public/tasks` và `/api/v1/tasks/:id/claim`, tích hợp DI vào `src/app.ts`; 10/10 API integration tests pass.
- Validation route: npx vitest run tests/integration/api/browse-and-claim-api.spec.ts (PASS)
- Post-code review: required (Public contract APIs)
- Residual blocker: none
- Sync-back decision: Public REST API available.

## Action Record — T006-BCT
- Actor: @frontend-agent (Direct execution)
- Approved scope and file boundary:
  - `public/index.html`
  - `public/js/app.js`
  - `public/js/api.js`
  - `public/js/components/navbar.js`
  - `public/js/components/worker-marketplace.js`
  - `public/js/components/task-claim-modal.js`
  - `public/js/components/countdown-timer.js`
  - `tests/e2e/browse-and-claim-ui.spec.ts`
- Profile binding and exact commands: HTML5, Tailwind CSS CDN, Vanilla ES Modules, Vitest; `npx vitest run tests/e2e/browse-and-claim-ui.spec.ts`
- State-change category: none
- Human checkpoint: N/A
- Task execution grant: G-BCT-006-A1; route=direct; consumer=session-direct-consumer; consumption=CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Xây dựng giao diện Worker Marketplace: thanh điều hướng chuyển tab Worker/Admin, lưới thẻ công việc, modal chi tiết có ảnh minh họa các bước (Step Images) to rõ, widget đồng hồ đếm ngược từng giây (Countdown Timer); 3/3 UI E2E tests pass.
- Validation route: npx vitest run tests/e2e/browse-and-claim-ui.spec.ts (PASS)
- Post-code review: required
- Residual blocker: none
- Sync-back decision: Worker Web Portal integrated.

## Action Record — T007-BCT
- Actor: @tester-agent (Direct execution)
- Approved scope and file boundary:
  - `tests/` (Toàn bộ 15 test files trong suite)
  - `.sdd/reviews/post-code-browse-and-claim-task.md`
- Profile binding and exact commands: Vitest, TypeScript compiler; `npx tsc --noEmit && npx vitest run`
- State-change category: none
- Human checkpoint: N/A
- Task execution grant: G-BCT-007-A1; route=direct; consumer=session-direct-consumer; consumption=CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Thực hiện kiểm định toàn diện hệ thống: npx tsc --noEmit (0 lỗi), npx vitest run (119/119 tests pass trên 15 files kiểm thử), npm run build (biên dịch production dist/ sạch), kiểm tra Zero Secret Policy (không phát hiện rò rỉ secret/key), khởi tạo biên bản hậu kiểm mã nguồn .sdd/reviews/post-code-browse-and-claim-task.md; toàn bộ tiêu chuẩn Clean Architecture và Quality Gate đạt mức tối đa.
- Validation route: npx tsc --noEmit && npx vitest run (PASS)
- Post-code review: required (Biên bản nghiệm thu mã nguồn .sdd/reviews/post-code-browse-and-claim-task.md)
- Residual blocker: none
- Sync-back decision: Ready for Post-Code Human Review & Git Validation.







 

