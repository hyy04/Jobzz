# Danh sách tác vụ: Giao diện web quản trị nhiệm vụ Jobzz (post-job-ui)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: post-job-ui
# Depth: DETAILED
# Architecture Profile: v1.1.0 (APPROVED — Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Plan Reference: .sdd/features/post-job-ui/PLAN.md (APPROVED)
# Spec Reference: .sdd/features/post-job-ui/SPEC.md (APPROVED & LOCKED)

---

## 1. Tổng quan phân rã tác vụ (Task Breakdown Overview)

| Task ID | Tiêu đề tác vụ | Layer | Owner | Phụ thuộc (blockedBy) | Ước lượng | Sizing Signal | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T001-PUI** | Mở rộng Backend Core: `findAll` & `GET /api/v1/tasks` | Usecase / Interface | `@backend-agent` | None | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T002-PUI** | Xây dựng Static Web Serving Route & Server Entry Point | Interface / App | `@infra-agent` | `T001-PUI` | 2.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T003-PUI** | Xây dựng Core HTML Shell, Navbar, XSS Escaper & Modals | Web Frontend | `@frontend-agent` | `T002-PUI` | 3.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T004-PUI** | Xây dựng Dashboard Stats, API Client & Task Table | Web Frontend | `@frontend-agent` | `T003-PUI` | 3.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T005-PUI** | Xây dựng Reactive Task Form, Bounds Checks & Auto-save | Web Frontend | `@frontend-agent` | `T004-PUI` | 3.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T006-PUI** | Xây dựng Live Mobile Preview Simulator cho Worker | Web Frontend | `@frontend-agent` | `T005-PUI` | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T007-PUI** | Kiểm thử Tích hợp Web E2E, Typecheck & Verification Gate | Verification | `@tester-agent` | `T006-PUI` | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |

---

## 2. Chi tiết từng tác vụ (Detailed Task Records)

### T001-PUI — Mở rộng Backend Core: `findAll` & `GET /api/v1/tasks`
- **Intent reference:** Kế thừa từ `PLAN.md` §3.2 và `SPEC.md` `REQ-PUI-001`, `REQ-PUI-004`. Cung cấp khả năng truy xuất danh sách toàn bộ nhiệm vụ cho Quản trị viên phục vụ Dashboard và Task Table.
- **Input and expected outcome:**
  - *Input:* `TaskRepositoryPort` và `PrismaTaskRepository` chưa có phương thức `findAll()`; `task.routes.ts` chưa đăng ký `GET /api/v1/tasks`.
  - *Outcome:* Bổ sung `TaskRepositoryPort.findAll()`, `ListFreelanceTasksUseCase`, `TaskController.listTasks`, và route `GET /api/v1/tasks` (yêu cầu quyền `ADMIN`). Trả về danh sách tasks theo chuẩn `formatTaskResponse`. Unit & integration tests pass 100%.
- **Layer and file boundary:**
  - `src/usecase/ports/task-repository.port.ts`
  - `src/usecase/list-freelance-tasks.usecase.ts`
  - `src/infra/repositories/prisma-task.repository.ts`
  - `src/interface/http/controllers/task.controller.ts`
  - `src/interface/http/routes/task.routes.ts`
  - `tests/unit/usecase/usecases.spec.ts`
  - `tests/integration/api/task-api.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: none`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Fastify, TypeScript, Vitest.
  - *Exact command:* `npx vitest run tests/integration/api/task-api.spec.ts`
- **Scope category:** `shared/public contract` (Mở rộng thêm endpoint GET danh sách, tương thích ngược 100%).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Bổ sung endpoint `GET /api/v1/tasks` vào REST Contract.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required` (Thêm API endpoint mới).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T002-PUI — Xây dựng Static Web Serving Route & Server Entry Point
- **Intent reference:** Kế thừa từ `PLAN.md` §3.2, §10 (Q1, Q2) và `SPEC.md` `REQ-PUI-021`. Thiết lập tệp khởi động `src/server.ts` lắng nghe tại cổng 3000 và route phục vụ tài nguyên tĩnh `public/` bằng Node built-in stream handler.
- **Input and expected outcome:**
  - *Input:* Dự án chưa có `src/server.ts`; `src/app.ts` chưa đăng ký phục vụ giao diện web tĩnh.
  - *Outcome:* Tạo `src/server.ts` khởi chạy Fastify trên cổng 3000 (`http://localhost:3000`); tạo `src/interface/http/routes/web.routes.ts` phục vụ `index.html` tại `/` và `/admin`, cùng phục vụ file tĩnh tại `/public/*` với đúng Content-Type. Tích hợp an toàn vào `src/app.ts`.
- **Layer and file boundary:**
  - `src/server.ts`
  - `src/interface/http/routes/web.routes.ts`
  - `src/app.ts`
  - `package.json` (thêm script `start` và `dev` nếu cần)
  - `tests/integration/api/web-routes.spec.ts`
- **Owner and dependencies:** `@infra-agent` (Thực thi) / Admin (Accountable); `blockedBy: T001-PUI`.
- **Estimated effort:** 2.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Node.js built-in `fs` & `path`, Fastify, Vitest.
  - *Exact command:* `npx vitest run && npx tsc --noEmit`
- **Scope category:** `permission, security, dependency hoặc runtime configuration`.
- **Human checkpoint:** `N/A` (Q1 và Q2 đã được Human Reviewer duyệt trong Plan).
- **Shared contract and sync-back:** Không tác động breaking contract; mở route tĩnh.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T003-PUI — Xây dựng Core HTML Shell, Navbar, XSS Escaper & Modals
- **Intent reference:** Kế thừa từ `PLAN.md` §3.1, §9 (R1) và `SPEC.md` `REQ-PUI-006..009`, `REQ-PUI-022`, `REQ-PUI-023`. Tạo khung giao diện chính SPA, module chống XSS (SEC-01), thanh Navbar với Dev Role Switcher, cùng hệ thống Toast và Hộp thoại xác nhận (Confirm/OCC Conflict Modal).
- **Input and expected outcome:**
  - *Input:* Thư mục `public/` chưa được khởi tạo.
  - *Outcome:* Tạo `public/index.html` tích hợp Tailwind CSS CDN, layout 2 cột linh hoạt; tạo `public/css/style.css`; tạo `public/js/utils/html-escaper.js` đảm bảo mã hóa 100% text chống XSS; tạo `public/js/components/toast-modal.js` hỗ trợ Toast thông báo và Confirm/Conflict Modals; tạo Navbar với bộ chọn vai trò `ADMIN` / `WORKER`.
- **Layer and file boundary:**
  - `public/index.html`
  - `public/css/style.css`
  - `public/js/utils/html-escaper.js`
  - `public/js/components/toast-modal.js`
  - `public/js/components/navbar.js`
- **Owner and dependencies:** `@frontend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T002-PUI`.
- **Estimated effort:** 3.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* HTML5 Semantic, Tailwind CSS CDN, Vanilla ES Modules.
  - *Exact command:* `npx vitest run tests/unit/shared/xss-sanitizer.spec.ts`
- **Scope category:** `none` (Tài nguyên giao diện tĩnh client-side).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Tích hợp `SEC-01` XSS Output Encoding.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T004-PUI — Xây dựng Dashboard Stats, API Client & Task Table
- **Intent reference:** Kế thừa từ `PLAN.md` §3.1, §4.1, §4.2 và `SPEC.md` `REQ-PUI-001..009`. Xây dựng khối thẻ thống kê Dashboard 4 chỉ số, mô-đun API Client có timeout 5s và tự động gắn header vai trò, cùng Bảng quản trị nhiệm vụ có bộ lọc tab trạng thái, tìm kiếm nhanh và các nút thao tác chuyển trạng thái (Publish, Pause, Resume, Close) kèm xử lý va chạm OCC 409.
- **Input and expected outcome:**
  - *Input:* Đã có HTML shell và Modals từ T003-PUI.
  - *Outcome:* `public/js/api.js` gọi `GET /api/v1/tasks` và `POST /api/v1/tasks/:id/status`; `public/js/components/dashboard-stats.js` render đúng 4 số liệu; `public/js/components/task-table.js` render danh sách nhiệm vụ với badge phân màu chuẩn, chip OCC version, lọc theo tab, tìm kiếm, nút chuyển trạng thái kích hoạt Modal xác nhận và xử lý lỗi 409 Conflict mượt mà.
- **Layer and file boundary:**
  - `public/js/api.js`
  - `public/js/components/dashboard-stats.js`
  - `public/js/components/task-table.js`
- **Owner and dependencies:** `@frontend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T003-PUI`.
- **Estimated effort:** 3.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Vanilla JS ES Modules, Fetch API, Tailwind CSS.
  - *Exact command:* `npx vitest run`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Giao tiếp với API `/api/v1/tasks`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T005-PUI — Xây dựng Reactive Task Form, Bounds Checks & Auto-save
- **Intent reference:** Kế thừa từ `PLAN.md` §3.1, §4.3 và `SPEC.md` `REQ-PUI-010..017`, `REQ-PUI-020`. Xây dựng Form tạo nhiệm vụ phản hồi thời gian thực, tính toán `total_reward_coins = quota * reward_coins` (< 5ms), cảnh báo trực quan bounds (1..500k Xu, 1..10k quota, trần 5 tỷ Xu), dynamic steps với xác thực URL HTTPS (SEC-01), dynamic proofs, và tự động lưu/khôi phục nháp từ `localStorage`.
- **Input and expected outcome:**
  - *Input:* Task Form shell trên HTML từ T003-PUI.
  - *Outcome:* `public/js/components/task-form.js` phản hồi tức thời sự kiện `input`, tự tính tổng Xu, hiển thị viền đỏ và text cảnh báo nếu vượt ngưỡng; cho phép thêm/xóa steps và proofs linh hoạt; chặn submit nếu URL không có `https://`; tự lưu vào `localStorage`; gửi `POST /api/v1/tasks` và reset form kèm Toast thành công.
- **Layer and file boundary:**
  - `public/js/components/task-form.js`
- **Owner and dependencies:** `@frontend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T004-PUI`.
- **Estimated effort:** 3.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Client-side reactive input handlers, LocalStorage API, Tailwind CSS.
  - *Exact command:* `npx vitest run`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Giao tiếp với endpoint `POST /api/v1/tasks`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T006-PUI — Xây dựng Live Mobile Preview Simulator cho Worker
- **Intent reference:** Kế thừa từ `PLAN.md` §3.1, §4.3 và `SPEC.md` `REQ-PUI-018..019`. Xây dựng màn hình điện thoại thông minh mô phỏng (iOS/Android frame) phản chiếu thời gian thực nội dung bài đăng dưới góc nhìn của Worker (debounce 100ms), kèm nút "Nhận việc" mô phỏng hiển thị tooltip.
- **Input and expected outcome:**
  - *Input:* Component Task Form từ T005-PUI.
  - *Outcome:* `public/js/components/mobile-preview.js` render khung điện thoại với thanh status, huy hiệu Xu vàng nổi bật, tiêu đề, danh mục, thời gian làm bài, danh sách các bước có nút "Mở liên kết" an toàn (`rel="noopener noreferrer"`), danh sách yêu cầu nộp bằng chứng; lắng nghe sự kiện từ form với debounce 100ms; bấm "Nhận việc" hiện popup mô phỏng. Kết nối mượt mà vào `public/js/app.js`.
- **Layer and file boundary:**
  - `public/js/components/mobile-preview.js`
  - `public/js/app.js`
- **Owner and dependencies:** `@frontend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T005-PUI`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Vanilla JS ES Modules, CSS mockup frame, Tailwind CSS.
  - *Exact command:* `npx vitest run`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Không tác động hợp đồng ngoài.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T007-PUI — Kiểm thử Tích hợp Web E2E, Typecheck & Verification Gate
- **Intent reference:** Kế thừa từ `PLAN.md` §7, §8 và `SPEC.md` Acceptance Criteria. Viết bổ sung các bài test integration cho endpoint `GET /api/v1/tasks` và web static serving; xác thực toàn bộ hệ thống bằng lệnh kiểm định canonical đã được phê duyệt.
- **Input and expected outcome:**
  - *Input:* Toàn bộ mã nguồn từ T001-PUI đến T006-PUI đã hoàn thành.
  - *Outcome:* Toàn bộ test suite chạy qua 100% (cả backend cũ lẫn frontend extensions mới); TypeScript biên dịch không lỗi (`tsc --noEmit`); xác thực giao diện trên localhost:3000 hoạt động trơn tru. Tạo báo cáo post-code review.
- **Layer and file boundary:**
  - `tests/integration/api/task-api.spec.ts`
  - `tests/integration/api/web-routes.spec.ts`
  - `tests/e2e/post-job-ui.spec.ts`
- **Owner and dependencies:** `@tester-agent` (Thực thi) / Admin (Accountable); `blockedBy: T006-PUI`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Vitest, TypeScript (`tsc`).
  - *Exact command:* `npx vitest run && npx tsc --noEmit`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Đối soát toàn vẹn tính năng `post-job-ui`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required` (Báo cáo hoàn thành delivery).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

## 3. Quản lý Rủi ro Thực thi (Execution Risks & Mitigations)

1. **Rủi ro phụ thuộc thứ tự (Sequential Dependency):** Các components UI phụ thuộc vào API endpoint `GET /api/v1/tasks` và cơ chế static file serving.
   - *Biện pháp:* Tác vụ `T001-PUI` (mở rộng backend) và `T002-PUI` (static web serving) được đặt ưu tiên triển khai đầu tiên, tạo nền móng vững chắc cho các tác vụ giao diện client-side.
2. **Rủi ro xung đột phạm vi tệp (File Boundary Isolation):**
   - *Biện pháp:* Toàn bộ mã nguồn frontend được cô lập trong thư mục `public/` (gồm `index.html`, `css/`, `js/`), tuyệt đối không làm thay đổi các tệp nghiệp vụ Domain core trong `src/domain/`.
3. **Rủi ro kiểm định chất lượng (Regression Risk):**
   - *Biện pháp:* 68 test case hiện tại của `post-job` backend được chạy kiểm tra sau mỗi tác vụ, bảo đảm zero regression.

---

## Current Handoff State
- Active Feature: post-job-ui
- Phase: ADD Phase 4-5 Completed (All 7 Tasks Implemented & Verified)
- Execution Mode: direct
- Project Ownership: team
- Total Automated Tests: 78/78 passing
- Next Step: Post-code Review approval via /sdd-review, then /git-validate and commit

## Execution Record — E-post-job-ui-ALL-A1
- Date: 2026-11-19T20:55:00+07:00
- Execution Mode: direct (Antigravity session)
- Project Ownership: team
- Runtime Enforcement: UNVERIFIED
- Task Snapshot: T001-PUI, T002-PUI, T003-PUI, T004-PUI, T005-PUI, T006-PUI, T007-PUI
- Classification: sequential-handoff
- Grant States: All 7 grants DISPATCHED -> CONSUMED
- Sizing signal: within-guideline (All tasks <= 3.5h)
- Results: All 7 tasks completed; 78/78 automated tests passed; tsc 0 errors; build passed.
- Post-code review: .sdd/reviews/post-code-post-job-ui.md (PENDING HUMAN REVIEW)

## Action Record — T001-PUI
- Actor: @backend-agent (direct)
- Approved scope and file boundary: src/usecase/ports/task-repository.port.ts, src/usecase/list-freelance-tasks.usecase.ts, src/infra/repositories/prisma-task.repository.ts, src/interface/http/controllers/task.controller.ts, src/interface/http/routes/task.routes.ts, tests/integration/api/task-api.spec.ts
- Profile binding and exact commands: Fastify, TypeScript, Vitest; exact command: npx vitest run tests/integration/api/task-api.spec.ts
- State-change category: shared/public contract
- Human checkpoint: N/A
- Task execution grant: G-post-job-ui-T001-A1; route=direct; consumer=c-post-job-ui-direct; CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Mở rộng TaskRepositoryPort với findAll(), xây dựng ListFreelanceTasksUseCase, bổ sung listTasks trong TaskController, đăng ký GET /api/v1/tasks. 10/10 tests passed.
- Validation route: PASS
- Post-code review: required
- Residual blocker: none
- Sync-back decision: published GET /api/v1/tasks

## Action Record — T002-PUI
- Actor: @infra-agent (direct)
- Approved scope and file boundary: src/server.ts, src/interface/http/routes/web.routes.ts, src/app.ts, tests/integration/api/web-routes.spec.ts
- Profile binding and exact commands: Node.js stream handler, Fastify, Vitest; exact command: npx vitest run tests/integration/api/web-routes.spec.ts && npx tsc --noEmit
- State-change category: permission, security, dependency hoặc runtime configuration
- Human checkpoint: N/A
- Task execution grant: G-post-job-ui-T002-A1; route=direct; consumer=c-post-job-ui-direct; CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Xây dựng src/server.ts lắng nghe cổng 3000; xây dựng web.routes.ts phục vụ tĩnh / và /admin và /public/* với stream handler chuẩn; bảo vệ chống Path Traversal; tích hợp vào src/app.ts. 5/5 tests passed.
- Validation route: PASS
- Post-code review: required
- Residual blocker: none
- Sync-back decision: published web routes / and /admin

## Action Record — T003-PUI
- Actor: @frontend-agent (direct)
- Approved scope and file boundary: public/index.html, public/css/style.css, public/js/utils/html-escaper.js, public/js/components/toast-modal.js, public/js/components/navbar.js
- Profile binding and exact commands: HTML5, Tailwind CSS CDN, Vanilla ES Modules, Vitest; exact command: npx vitest run tests/unit/shared/xss-sanitizer.spec.ts
- State-change category: none
- Human checkpoint: N/A
- Task execution grant: G-post-job-ui-T003-A1; route=direct; consumer=c-post-job-ui-direct; CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Xây dựng public/index.html layout 2 cột; xây dựng html-escaper.js (SEC-01); toast-modal.js (Toast, Confirm Modal, OCC Conflict Modal); navbar.js (Dev Role Switcher ADMIN/WORKER).
- Validation route: PASS
- Post-code review: N/A
- Residual blocker: none
- Sync-back decision: SEC-01 client-side encoding

## Action Record — T004-PUI
- Actor: @frontend-agent (direct)
- Approved scope and file boundary: public/js/api.js, public/js/components/dashboard-stats.js, public/js/components/task-table.js
- Profile binding and exact commands: Fetch API, Vanilla JS, Vitest; exact command: npx vitest run
- State-change category: none
- Human checkpoint: N/A
- Task execution grant: G-post-job-ui-T004-A1; route=direct; consumer=c-post-job-ui-direct; CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Xây dựng ApiClient (timeout 5s, auto header role, OCC 409 handling); dashboard-stats.js tính 4 số liệu; task-table.js render danh sách, status badges phân màu, version chip, lọc tab, tìm kiếm, nút action Publish/Pause/Resume/Close.
- Validation route: PASS
- Post-code review: N/A
- Residual blocker: none
- Sync-back decision: connects to /api/v1/tasks

## Action Record — T005-PUI
- Actor: @frontend-agent (direct)
- Approved scope and file boundary: public/js/components/task-form.js
- Profile binding and exact commands: Reactive input handlers, LocalStorage, Vitest; exact command: npx vitest run
- State-change category: none
- Human checkpoint: N/A
- Task execution grant: G-post-job-ui-T005-A1; route=direct; consumer=c-post-job-ui-direct; CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Xây dựng task-form.js: tính Xu tức thời (< 5ms), cảnh báo bounds viền đỏ (Xu, quota, trần 5 tỷ Xu); dynamic steps với HTTPS-only URL check (SEC-01); dynamic proofs; auto-save/restore draft localStorage; submit POST /api/v1/tasks.
- Validation route: PASS
- Post-code review: N/A
- Residual blocker: none
- Sync-back decision: connects to POST /api/v1/tasks

## Action Record — T006-PUI
- Actor: @frontend-agent (direct)
- Approved scope and file boundary: public/js/components/mobile-preview.js, public/js/app.js
- Profile binding and exact commands: CSS Mockup, Vanilla JS, Vitest; exact command: npx vitest run
- State-change category: none
- Human checkpoint: N/A
- Task execution grant: G-post-job-ui-T006-A1; route=direct; consumer=c-post-job-ui-direct; CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Xây dựng mobile-preview.js mô phỏng smartphone frame hiển thị bài đăng dưới góc nhìn Worker; đồng bộ real-time 100ms với task form; nút Nhận việc hiển thị tooltip mô phỏng. Kết nối các modules trong app.js.
- Validation route: PASS
- Post-code review: N/A
- Residual blocker: none
- Sync-back decision: integrated into app.js

## Action Record — T007-PUI
- Actor: @tester-agent (direct)
- Approved scope and file boundary: tests/e2e/post-job-ui.spec.ts, .sdd/reviews/post-code-post-job-ui.md
- Profile binding and exact commands: Vitest, TypeScript tsc; exact command: npx vitest run && npx tsc --noEmit
- State-change category: none
- Human checkpoint: required; Pre-Delivery Checkpoint - Addressed via .sdd/reviews/post-code-post-job-ui.md
- Task execution grant: G-post-job-ui-T007-A1; route=direct; consumer=c-post-job-ui-direct; CONSUMED
- Host execution-claim evidence: UNVERIFIED
- Actions and result: Xây dựng E2E tests post-job-ui.spec.ts (SPA serving, static assets, full business flow với OCC conflict, RBAC 403). Chạy toàn bộ 78/78 tests passed; tsc 0 errors; npm run build thành công; lập biên bản hậu kiểm post-code-post-job-ui.md. Dừng trước remote delivery.
- Validation route: PASS (78/78 Tests, Typecheck, Build)
- Post-code review: required; .sdd/reviews/post-code-post-job-ui.md
- Residual blocker: none
- Sync-back decision: completed post-job-ui implementation snapshot

---

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: `.sdd/features/post-job-ui/TASKS.md` — Phân rã 7 tác vụ kỹ thuật chi tiết cho tính năng giao diện web quản trị Jobzz
- Recommendation: Phê duyệt danh sách phân rã 7 tác vụ (T001-PUI đến T007-PUI). Toàn bộ các tác vụ đều tuân thủ chặt chẽ ranh giới Clean Architecture, có chỉ số định lượng `within-guideline` (2.0h - 3.5h/task, tổng cộng 19.5h), có câu lệnh kiểm định chính xác (`npx vitest run`, `npx tsc --noEmit`), và bảo toàn tính toàn vẹn của backend core.
- Evidence: Đã tạo tệp `.sdd/features/post-job-ui/TASKS.md`; phân rã đầy đủ theo 7 giai đoạn đã phê duyệt trong `PLAN.md`; 100% yêu cầu EARS REQ-PUI-001..023 đã có task đảm nhiệm.
- Risks and assumptions: Triển khai theo trình tự tuần tự (sequential handoff) đảm bảo API backend sẵn sàng trước khi nạp giao diện SPA.
- Alternatives considered: Phân rã gom thành 2 task lớn, nhưng bị bác bỏ vì vi phạm giới hạn kích thước task (< 4h) và gây khó khăn cho việc kiểm định độc lập từng tầng.
- Required human decision: Phê duyệt danh sách tác vụ TASKS.md của tính năng `post-job-ui` để mở khóa cho Pha 4-5 ADD (`/add-execute --feature=post-job-ui --all`).

## Human Final Review
- Status: APPROVED
- Decision: Duyệt TASKS.md post-job-ui v1.0.0
- Reviewer: Admin
- Reviewed at: 2026-11-19T20:52:52+07:00
- Follow-up: /add-execute --feature=post-job-ui --all 

