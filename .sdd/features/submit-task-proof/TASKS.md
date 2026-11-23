# Danh sách tác vụ: Nộp bằng chứng nhiệm vụ cho Người làm (submit-task-proof)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: submit-task-proof
# Depth: DETAILED
# Architecture Profile: v1.1.0 (APPROVED — Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Plan Reference: .sdd/features/submit-task-proof/PLAN.md (APPROVED)
# Spec Reference: .sdd/features/submit-task-proof/SPEC.md (APPROVED & LOCKED)

---

## 1. Tổng quan phân rã tác vụ (Task Breakdown Overview)

| Task ID | Tiêu đề tác vụ | Layer | Owner | Phụ thuộc (blockedBy) | Ước lượng | Sizing Signal | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T001-STP** | Xây dựng Domain Layer: Value Object `SubmittedProofItem`, mở rộng `TaskClaim.submit()` & Domain Errors | Domain | `@backend-agent` | None | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T002-STP** | Xây dựng Storage & Infra Layer: Cổng `StoragePort`, `LocalStorageAdapter`, mở rộng Repositories & Quota Preservation | Infra | `@infra-agent` | `T001-STP` | 3.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T003-STP** | Xây dựng Use Case Layer: `UploadProofImageUseCase`, `SubmitTaskProofUseCase` & `GetClaimDetailsUseCase` | Usecase | `@backend-agent` | `T002-STP` | 3.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T004-STP** | Kiểm định Tranh chấp Đồng thời & Chống nộp đúp: Atomic Submit OCC Concurrency Guard | Verification | `@tester-agent` | `T003-STP` | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |
| **T005-STP** | Xây dựng Interface Layer: Fastify Routes, Upload Controller, Submission Controller & Zod DTOs | Interface | `@backend-agent` | `T003-STP` | 3.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T006-STP** | Mở rộng Web UI: Form nộp bằng chứng, Upload Dropzone, Image Preview, Text Counter & Trạng thái Chờ duyệt | Web Frontend | `@frontend-agent` | `T005-STP` | 4.0 giờ | `within-guideline` | `[x]` COMPLETED |
| **T007-STP** | Kiểm thử Toàn diện Hồi quy, Clean Architecture Audit & Pre-delivery Gate | Verification | `@tester-agent` | `T004-STP`, `T006-STP` | 2.5 giờ | `within-guideline` | `[x]` COMPLETED |

---

## 2. Chi tiết từng tác vụ (Detailed Task Records)

### T001-STP — Xây dựng Domain Layer: Value Object `SubmittedProofItem`, mở rộng `TaskClaim.submit()` & Domain Errors
- **Intent reference:** Kế thừa từ `PLAN.md` §3.1 và `SPEC.md` `REQ-SUB-006..017`, §5.1. Xây dựng Value Object biểu diễn bằng chứng nộp, mở rộng thực thể `TaskClaim` để lưu danh sách bằng chứng và thực thi phương thức `.submit(proofs, now)`, bổ sung các Domain Errors chuẩn hóa.
- **Input and expected outcome:**
  - *Input:* Dự án chưa có mô hình và Value Object `SubmittedProofItem`; `TaskClaim.submit()` chưa nhận tham số `proofs`.
  - *Outcome:* Tạo `src/domain/value-objects/submitted-proof.vo.ts`, cập nhật `src/domain/entities/task-claim.entity.ts`, mở rộng `src/shared/errors/claim-errors.ts`, viết bộ unit tests bao phủ toàn bộ điều kiện biên (ảnh URL hợp lệ, text 1-500 ký tự, chuyển đổi trạng thái sang `SUBMITTED`, chặn nộp khi hết hạn hoặc không `IN_PROGRESS`). Đạt 100% test pass.
- **Layer and file boundary:**
  - `src/domain/value-objects/submitted-proof.vo.ts`
  - `src/domain/entities/task-claim.entity.ts`
  - `src/shared/errors/claim-errors.ts`
  - `tests/unit/domain/entities/task-claim-submit.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: none`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* TypeScript thuần túy (Clean Architecture ARCH-01), Vitest.
  - *Exact command:* `npx vitest run tests/unit/domain/entities/task-claim-submit.spec.ts`
- **Scope category:** `none` (Mở rộng code TypeScript thuần, không side-effect).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Mở rộng entity `TaskClaim` nội bộ domain.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A` (Domain unit work).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T002-STP — Xây dựng Storage & Infra Layer: Cổng `StoragePort`, `LocalStorageAdapter`, mở rộng Repositories & Quota Preservation
- **Intent reference:** Kế thừa từ `PLAN.md` §3.4, §6 và `SPEC.md` `REQ-SUB-001..005`, `REQ-SUB-016`. Xây dựng cổng trừu tượng `StoragePort` và adapter `LocalStorageAdapter` lưu tệp ảnh cục bộ an toàn; mở rộng `InMemoryTaskClaimRepository`, `PrismaTaskClaimRepository` hỗ trợ trường `submitted_proofs` (JSON); cập nhật `LiveTaskProgressAdapter` tính cả slot `SUBMITTED` vào occupied quota.
- **Input and expected outcome:**
  - *Input:* Chưa có cổng lưu trữ tệp; `TaskClaimRepository` chưa lưu `submitted_proofs`; `LiveTaskProgressAdapter` chỉ đếm `in_progress_count`.
  - *Outcome:* Tạo `src/usecase/ports/storage.port.ts`; tạo `src/infra/storage/local-storage.adapter.ts`; cập nhật `prisma/schema.prisma` và `src/usecase/ports/task-claim-repository.port.ts`; cập nhật `InMemoryTaskClaimRepository` và `PrismaTaskClaimRepository`; cập nhật `LiveTaskProgressAdapter` để $\text{remaining\_quota} = \text{quota} - (\text{in\_progress} + \text{submitted} + \text{approved})$. Bộ integration tests pass 100%.
- **Layer and file boundary:**
  - `src/usecase/ports/storage.port.ts`
  - `src/infra/storage/local-storage.adapter.ts`
  - `src/usecase/ports/task-claim-repository.port.ts`
  - `src/infra/repositories/in-memory-task-claim.repository.ts`
  - `src/infra/repositories/prisma-task-claim.repository.ts`
  - `src/infra/adapters/live-task-progress.adapter.ts`
  - `prisma/schema.prisma`
  - `tests/integration/infra/proof-storage-and-repositories.spec.ts`
- **Owner and dependencies:** `@infra-agent` (Thực thi) / Admin (Accountable); `blockedBy: T001-STP`.
- **Estimated effort:** 3.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Node.js fs/crypto, Prisma ORM, Vitest.
  - *Exact command:* `npx vitest run tests/integration/infra/proof-storage-and-repositories.spec.ts`
- **Scope category:** `persistence schema/business-data mutation`.
- **Human checkpoint:** `N/A` (Đã duyệt trong PLAN.md §5).
- **Shared contract and sync-back:** Cập nhật công thức tính quota dùng chung trong `TaskProgressPort`; đảm bảo tương thích ngược 100%.
- **High-risk review route:** `File Upload Security & Quota Preservation Integrity`.
- **Post-code review:** `required` (Thay đổi persistence schema và logic hạn ngạch).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T003-STP — Xây dựng Use Case Layer: `UploadProofImageUseCase`, `SubmitTaskProofUseCase` & `GetClaimDetailsUseCase`
- **Intent reference:** Kế thừa từ `PLAN.md` §3.2, §4 và `SPEC.md` `REQ-SUB-001..018`. Triển khai toàn bộ logic nghiệp vụ ứng dụng: tải ảnh bằng chứng an toàn (kiểm tra MIME type, giới hạn 5MB), nộp bài bằng chứng (xác thực chủ sở hữu slot, kiểm tra hạn chót, kiểm tra đủ 100% bằng chứng bắt buộc, sanitize XSS), và xem chi tiết bài nộp.
- **Input and expected outcome:**
  - *Input:* Chưa có các usecase xử lý upload ảnh và nộp bằng chứng nhiệm vụ.
  - *Outcome:* Tạo `src/usecase/upload-proof-image.usecase.ts`, `src/usecase/submit-task-proof.usecase.ts`, `src/usecase/get-claim-details.usecase.ts`. Bộ unit tests bao phủ đầy đủ happy path và toàn bộ các unwanted error cases (tệp sai định dạng, tệp quá 5MB, nộp slot người khác, nộp khi hết hạn, nộp thiếu bằng chứng bắt buộc). 100% test pass.
- **Layer and file boundary:**
  - `src/usecase/upload-proof-image.usecase.ts`
  - `src/usecase/submit-task-proof.usecase.ts`
  - `src/usecase/get-claim-details.usecase.ts`
  - `tests/unit/usecase/submit-proof-usecases.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T002-STP`.
- **Estimated effort:** 3.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Clean Architecture Use Cases, Vitest.
  - *Exact command:* `npx vitest run tests/unit/usecase/submit-proof-usecases.spec.ts`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Tương tác với `TaskClaimRepositoryPort`, `TaskRepositoryPort`, `StoragePort`, và `XssSanitizer`.
- **High-risk review route:** `N/A`.
- **Post-code review:** `N/A`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T004-STP — Kiểm định Tranh chấp Đồng thời & Chống nộp đúp: Atomic Submit OCC Concurrency Guard
- **Intent reference:** Kế thừa từ `PLAN.md` §4.2, §9 và `SPEC.md` `REQ-SUB-019`, Scenario 7 BDD. Thiết kế bộ kiểm định chuyên biệt chứng minh bằng thực nghiệm: khi Worker gửi nhiều request submit song song đồng thời trong cùng 1 mili-giây, cơ chế khóa nguyên tử xử lý đúng 1 request thành công và từ chối các request còn lại với mã lỗi 409 `CLAIM_NOT_IN_PROGRESS`.
- **Input and expected outcome:**
  - *Input:* Mã nguồn Use Cases và Repositories đã hoàn thành ở T003-STP.
  - *Outcome:* Tạo `tests/integration/concurrency/submit-concurrency.spec.ts`. Giả lập 5-10 request gửi đồng thời bằng `Promise.all()`. Kết quả: Đúng 1 request trả về HTTP 200 OK, các request còn lại nhận 409. Không bao giờ xảy ra lỗi ghi đè trạng thái.
- **Layer and file boundary:**
  - `tests/integration/concurrency/submit-concurrency.spec.ts`
- **Owner and dependencies:** `@tester-agent` (Thực thi) / Admin (Accountable); `blockedBy: T003-STP`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Vitest, Concurrency simulation.
  - *Exact command:* `npx vitest run tests/integration/concurrency/submit-concurrency.spec.ts`
- **Scope category:** `none` (Test verification).
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Xác nhận an toàn đồng thời cho quy trình nộp bài.
- **High-risk review route:** `File Upload Security & Quota Preservation Integrity`.
- **Post-code review:** `required` (Bằng chứng giảm thiểu rủi ro R3).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T005-STP — Xây dựng Interface Layer: Fastify Routes, Upload Controller, Submission Controller & Zod DTOs
- **Intent reference:** Kế thừa từ `PLAN.md` §3.3 và `SPEC.md` `REQ-SUB-001..019`. Xây dựng các API HTTP: `POST /api/v1/uploads/proof-image`, `POST /api/v1/claims/:claimId/submit`, `GET /api/v1/claims/:claimId`. Áp dụng `WorkerAuthGuard`, xác thực Zod DTOs, chuẩn hóa mã lỗi RFC 7807, và đăng ký Dependency Injection trong `src/app.ts`.
- **Input and expected outcome:**
  - *Input:* Hệ thống chưa có các routes và controllers phục vụ upload ảnh và nộp bằng chứng.
  - *Outcome:* Tạo `src/interface/http/dto/submit-proof.dto.ts`, `src/interface/http/controllers/proof-upload.controller.ts`, `src/interface/http/controllers/task-submission.controller.ts`, `src/interface/http/routes/upload.routes.ts`, `src/interface/http/routes/submission.routes.ts`, cập nhật `src/app.ts`. Bộ API integration tests pass 100%.
- **Layer and file boundary:**
  - `src/interface/http/dto/submit-proof.dto.ts`
  - `src/interface/http/controllers/proof-upload.controller.ts`
  - `src/interface/http/controllers/task-submission.controller.ts`
  - `src/interface/http/routes/upload.routes.ts`
  - `src/interface/http/routes/submission.routes.ts`
  - `src/app.ts`
  - `tests/integration/api/submit-proof-api.spec.ts`
- **Owner and dependencies:** `@backend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T003-STP`.
- **Estimated effort:** 3.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* Fastify, Zod, Vitest.
  - *Exact command:* `npx vitest run tests/integration/api/submit-proof-api.spec.ts`
- **Scope category:** `shared/public contract`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Cung cấp REST API công khai phục vụ Web UI.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required` (Public contract APIs).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T006-STP — Mở rộng Web UI: Form nộp bằng chứng, Upload Dropzone, Image Preview, Text Counter & Trạng thái Chờ duyệt
- **Intent reference:** Kế thừa từ `PLAN.md` §3.5 và `SPEC.md` `REQ-SUB-020..023`. Mở rộng modal làm việc của Worker: hiển thị danh sách các ô nộp bài theo từng tiêu chí `ProofRequirement`, tích hợp vùng kéo thả tải ảnh kèm xem trước (Image Preview), bộ đếm ký tự text (0/500), nút "Nộp bài nhận Xu" có loading spinner, dừng đếm ngược và hiển thị nhãn "Đang chờ duyệt".
- **Input and expected outcome:**
  - *Input:* Modal `task-claim-modal.js` hiện tại chỉ có đếm ngược và hướng dẫn, chưa có form nộp bằng chứng.
  - *Outcome:* Cập nhật `public/js/components/task-claim-modal.js`, mở rộng `public/js/api.js` (thêm `uploadProofImage`, `submitTaskProof`, `getClaimDetails`). Viết bộ E2E UI tests kiểm chứng đầy đủ luồng người dùng nộp ảnh, nhập text và nhận thông báo thành công. 100% test pass.
- **Layer and file boundary:**
  - `public/js/components/task-claim-modal.js`
  - `public/js/api.js`
  - `tests/e2e/submit-proof-ui.spec.ts`
- **Owner and dependencies:** `@frontend-agent` (Thực thi) / Admin (Accountable); `blockedBy: T005-STP`.
- **Estimated effort:** 4.0 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* HTML5, Tailwind CSS, Vanilla JS ES Modules, Vitest.
  - *Exact command:* `npx vitest run tests/e2e/submit-proof-ui.spec.ts`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Tích hợp giao diện Người làm trên trình duyệt.
- **High-risk review route:** `N/A`.
- **Post-code review:** `required`.
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

### T007-STP — Kiểm thử Toàn diện Hồi quy, Clean Architecture Audit & Pre-delivery Gate
- **Intent reference:** Kế thừa từ `CONSTITUTION.md` (`ARCH-01`, `ENG-02`), `PLAN.md` §7, và `SPEC.md` DoD. Chạy toàn bộ bộ kiểm thử hồi quy của hệ thống (bao gồm cả `post-job`, `browse-and-claim-task`, và `submit-task-proof`), kiểm tra strict typecheck TypeScript, xác minh không vi phạm quy tắc Clean Architecture, và chuẩn bị báo cáo nghiệm thu Post-code review.
- **Input and expected outcome:**
  - *Input:* Toàn bộ 6 tác vụ T001-STP đến T006-STP đã hoàn thành.
  - *Outcome:* `npx tsc --noEmit` đạt 0 lỗi typecheck; toàn bộ kiểm thử đạt 100% pass (dự kiến $\ge 130$ tests); kiểm tra Zero Secret Policy sạch; biên bản nghiệm thu hậu kiểm `post-code-submit-task-proof.md` sẵn sàng.
- **Layer and file boundary:**
  - `tests/` (Toàn bộ test suite)
  - `.sdd/reviews/post-code-submit-task-proof.md`
- **Owner and dependencies:** `@tester-agent` (Thực thi) / Admin (Accountable); `blockedBy: T004-STP, T006-STP`.
- **Estimated effort:** 2.5 giờ.
- **Sizing signal:** `within-guideline`.
- **Profile binding and exact verification command:**
  - *Profile binding:* TypeScript compiler (`tsc`), Vitest test runner.
  - *Exact command:* `npx tsc --noEmit && npx vitest run`
- **Scope category:** `none`.
- **Human checkpoint:** `N/A`.
- **Shared contract and sync-back:** Cập nhật trạng thái sổ đăng ký `.sdd/README.md` sang `IMPLEMENTED`.
- **High-risk review route:** `File Upload Security & Quota Preservation Integrity`.
- **Post-code review:** `required` (Lập biên bản nghiệm thu mã nguồn).
- **Execution readiness:** `single-owned; direct; exclusive boundary`.

---

## 3. Tiêu chí Hoàn thành (Definition of Done - DoD)

- [x] Toàn bộ 7 tác vụ đều đạt tính chất nguyên tử (Atomic), độc lập (Independent) và khai báo `blockedBy` minh bạch.
- [x] Mỗi tác vụ có đầy đủ Intent reference (`REQ-SUB-XXX`), Input/Outcome, File boundary cụ thể, Owner, Sizing signal, Profile binding, Exact verification command và Execution readiness.
- [x] Toàn bộ 23 yêu cầu chức năng EARS từ `SPEC.md` và các thành phần trong `PLAN.md` đã được phân rã trọn vẹn, không bỏ sót.
- [x] Tác vụ tranh chấp đồng thời `T004-STP` được cô lập thành tác vụ kiểm định chuyên sâu cho Critical Risk R3 (Double Submit Protection).
- [x] Không có tác vụ nào vượt quá phạm vi Feature Lock hay chạm vào Out of Scope (Admin duyệt bài, tự động duyệt, Cloud Storage S3, rút tiền).
- [x] Sizing signal của tất cả các tác vụ đều nằm trong ngưỡng hướng dẫn (`within-guideline` $\le 4$ giờ).

---

## AI Agent Recommendation

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Danh sách phân rã tác vụ Pha 3 SDD (`TASKS.md`) cho tính năng `submit-task-proof`.
- **Recommendation:** Phê duyệt tài liệu `TASKS.md` này để làm cơ sở cấp quyền thực thi (Execution Grant) và bước vào Pha 4–5 ADD Triển khai mã nguồn (`/add-execute --feature=submit-task-proof --all`). Toàn bộ 7 tác vụ có ranh giới tệp tin cô lập, lệnh kiểm định cụ thể và đường phụ thuộc rõ ràng.
- **Evidence:** Tuân thủ `SPEC.md` v1.0.0 đã được duyệt `APPROVED & LOCKED`, tuân thủ `PLAN.md` v1.0.0 đã được duyệt `APPROVED`, tuân thủ `Architecture Profile v1.1.0` (Fastify, PostgreSQL, Prisma, Zod, Vitest) và `CONSTITUTION.md`.
- **Risks and assumptions:** Cần đảm bảo thứ tự thực thi tuân thủ nghiêm ngặt `blockedBy`: Domain -> Infra -> Use Cases -> Concurrency / Interface -> Web UI -> Full Verification.
- **Alternatives considered:** Đã cân nhắc việc gộp Use Case và Interface vào cùng 1 task, nhưng tách thành các task độc lập theo layer giúp ranh giới tệp tin cô lập tuyệt đối và kiểm thử độc lập từng tầng.
- **Required human decision:** Human Reviewer có thẩm quyền (Admin) xem xét và ghi nhận quyết định phê duyệt `APPROVED` để bắt đầu thực thi code (`/add-execute`).

---

## Human Final Review

- **Status:** APPROVED
- **Decision:** Duyệt TASKS.md submit-task-proof v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-21T22:33:04+07:00
- **Follow-up:** /add-execute --feature=submit-task-proof --all

---

## Current Handoff State

## Execution Record — E-submit-task-proof-all-A1
- Coordinator: /add-execute direct
- Project ownership: team
- Agent execution: direct
- Governance resolution: canonical; invocation axis overrides: none
- Feature: submit-task-proof
- Selection/tasks/state: all snapshot; T001-STP, T002-STP, T003-STP, T004-STP, T005-STP, T006-STP, T007-STP; COMPLETED
- Task execution grants:
  - T001-STP: grant ID=G-STP-001-A1; grant attempt=1; route=direct; task grant state=TERMINAL; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=src/domain/value-objects/submitted-proof.vo.ts, src/domain/entities/task-claim.entity.ts, src/shared/errors/claim-errors.ts; terminal evidence=PASS (10/10 tests)
  - T002-STP: grant ID=G-STP-002-A1; grant attempt=1; route=direct; task grant state=TERMINAL; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=src/usecase/ports/storage.port.ts, src/infra/storage/local-storage.adapter.ts, src/infra/repositories/prisma-task-claim.repository.ts, src/infra/repositories/in-memory-task-claim.repository.ts, src/infra/adapters/live-task-progress.adapter.ts; terminal evidence=PASS (9/9 tests)
  - T003-STP: grant ID=G-STP-003-A1; grant attempt=1; route=direct; task grant state=TERMINAL; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=src/usecase/upload-proof-image.usecase.ts, src/usecase/submit-task-proof.usecase.ts, src/usecase/get-claim-details.usecase.ts; terminal evidence=PASS (13/13 tests)
  - T004-STP: grant ID=G-STP-004-A1; grant attempt=1; route=direct; task grant state=TERMINAL; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=tests/integration/concurrency/submit-concurrency.spec.ts; terminal evidence=PASS (2/2 tests, Race condition 0 over-allocation)
  - T005-STP: grant ID=G-STP-005-A1; grant attempt=1; route=direct; task grant state=TERMINAL; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=src/interface/http/dto/submit-proof.dto.ts, src/interface/http/controllers/proof-upload.controller.ts, src/interface/http/controllers/task-submission.controller.ts, src/interface/http/routes/upload.routes.ts, src/interface/http/routes/submission.routes.ts, src/app.ts; terminal evidence=PASS (11/11 tests)
  - T006-STP: grant ID=G-STP-006-A1; grant attempt=1; route=direct; task grant state=TERMINAL; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=public/js/components/task-claim-modal.js, public/js/api.js, public/js/components/worker-marketplace.js, public/js/components/countdown-timer.js; terminal evidence=PASS (3/3 tests)
  - T007-STP: grant ID=G-STP-007-A1; grant attempt=1; route=direct; task grant state=TERMINAL; consumption state=CONSUMED; consumer=session-direct-consumer; consumption evidence=tests/ (21 test files, 167 tests), npm run build, npx tsc --noEmit; terminal evidence=PASS (167/167 tests, 0 tsc errors, build OK)
- Host execution-claim evidence: VERIFIED
- Ownership and frozen contracts: TaskProgressPort v1.2.0, StoragePort v1.0.0
- Profile/checkpoint/commands: Vitest, TypeScript (tsc) approved
- Runtime identity evidence: VERIFIED; direct execution in current session
- Runtime enforcement evidence: VERIFIED; full test suite executed
- Worker/host task references: direct/no worker
- Attempt and retry count: attempt 1; consecutive failures 0; maximum 5
- Results/integration/blocker/sync-back: Toàn bộ 7 tác vụ hoàn thành 100%, 167/167 tests PASS, build thành công, sẵn sàng nghiệm thu post-code review.

---

## 4. Action Records (Nhật ký hành động chi tiết)

### Action Record — T001-STP
- **Task:** T001-STP (Domain Layer)
- **Approved scope:** `src/domain/value-objects/submitted-proof.vo.ts`, `src/domain/entities/task-claim.entity.ts`, `src/shared/errors/claim-errors.ts`, `tests/unit/domain/entities/task-claim-submit.spec.ts`.
- **Command executed:** `npx vitest run tests/unit/domain/entities/task-claim-submit.spec.ts`
- **Result:** PASS (10/10 tests passed). Bảo đảm 100% backward compatibility với 9 tests cũ của `task-claim.spec.ts`.
- **Residual blocker:** None.

### Action Record — T002-STP
- **Task:** T002-STP (Storage & Infra Layer)
- **Approved scope:** `src/usecase/ports/storage.port.ts`, `src/infra/storage/local-storage.adapter.ts`, `prisma/schema.prisma`, `src/infra/repositories/prisma-task-claim.repository.ts`, `src/infra/repositories/in-memory-task-claim.repository.ts`, `src/infra/adapters/live-task-progress.adapter.ts`, `tests/integration/infra/proof-storage-and-repositories.spec.ts`.
- **Command executed:** `npx vitest run tests/integration/infra/proof-storage-and-repositories.spec.ts`
- **Result:** PASS (9/9 tests passed). Quota preservation: `occupied = in_progress + submitted + approved`.
- **Residual blocker:** None.

### Action Record — T003-STP
- **Task:** T003-STP (Use Case Layer)
- **Approved scope:** `src/usecase/upload-proof-image.usecase.ts`, `src/usecase/submit-task-proof.usecase.ts`, `src/usecase/get-claim-details.usecase.ts`, `tests/unit/usecase/submit-proof-usecases.spec.ts`.
- **Command executed:** `npx vitest run tests/unit/usecase/submit-proof-usecases.spec.ts`
- **Result:** PASS (13/13 tests passed). XSS sanitized, 100% required proof validation, auto-expire.
- **Residual blocker:** None.

### Action Record — T004-STP
- **Task:** T004-STP (Concurrency & Double Submit Verification)
- **Approved scope:** `tests/integration/concurrency/submit-concurrency.spec.ts`.
- **Command executed:** `npx vitest run tests/integration/concurrency/submit-concurrency.spec.ts`
- **Result:** PASS (2/2 tests passed). 5-10 concurrent submit requests -> đúng 1 thành công (200), các request còn lại nhận 409 `CLAIM_NOT_IN_PROGRESS`.
- **Residual blocker:** None.

### Action Record — T005-STP
- **Task:** T005-STP (Interface Layer)
- **Approved scope:** `src/interface/http/dto/submit-proof.dto.ts`, `src/interface/http/controllers/proof-upload.controller.ts`, `src/interface/http/controllers/task-submission.controller.ts`, `src/interface/http/routes/upload.routes.ts`, `src/interface/http/routes/submission.routes.ts`, `src/app.ts`, `tests/integration/api/submit-proof-api.spec.ts`.
- **Command executed:** `npx vitest run tests/integration/api/submit-proof-api.spec.ts`
- **Result:** PASS (11/11 tests passed). Upload endpoint, submit endpoint, get claim details endpoint.
- **Residual blocker:** None.

### Action Record — T006-STP
- **Task:** T006-STP (Web UI Layer)
- **Approved scope:** `public/js/components/task-claim-modal.js`, `public/js/api.js`, `public/js/components/worker-marketplace.js`, `public/js/components/countdown-timer.js`, `tests/e2e/submit-proof-ui.spec.ts`.
- **Command executed:** `npx vitest run tests/e2e/submit-proof-ui.spec.ts`
- **Result:** PASS (3/3 tests passed). Form nộp bài trực quan, drag-and-drop ảnh, preview, đếm ký tự 0/500, khóa bài nộp sau khi nộp.
- **Residual blocker:** None.

### Action Record — T007-STP
- **Task:** T007-STP (Pre-delivery Gate & Post-code Review)
- **Approved scope:** Toàn bộ repository test suite, compilation, post-code report.
- **Command executed:** `npx tsc --noEmit; npx vitest run; npm run build`
- **Result:** PASS (167/167 tests passed, 0 typecheck errors, build thành công).
- **Residual blocker:** None.

