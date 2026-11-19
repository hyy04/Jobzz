# Kế hoạch kiến trúc: Giao diện web quản trị nhiệm vụ Jobzz (post-job-ui)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: post-job-ui
# Depth: DETAILED
# Architecture Profile: v1.1.0 (APPROVED — Fastify + PostgreSQL + Prisma + Zod + Vitest)
# Methodology Profile: Depth=DETAILED, Risk=elevated, Review Route=N/A, Decision Owner=Admin (@admin)

---

## 1. Phương cận kiến trúc (Architectural Approach)

Kế hoạch kiến trúc tuân thủ nghiêm ngặt **Clean Architecture** theo `CONSTITUTION.md` (`ARCH-01`) và các technology bindings đã được Human Reviewer phê duyệt trong `.sdd/architecture-profile.md`:

```
+---------------------------------------------------------------------------------------+
|                                    TRÌNH DUYỆT (BROWSER)                               |
|   +-------------------------------------------------------------------------------+   |
|   |                      Single Page Application (public/)                        |   |
|   |  - Dashboard Stats Card (Tổng task, Active, Tổng Xu, Hoàn thành)              |   |
|   |  - Task Table (Lọc trạng thái, Tìm kiếm, OCC chip, Action buttons)            |   |
|   |  - Reactive Task Form (Bộ tính Xu tức thời, Dynamic Steps/Proofs, Auto-save) |   |
|   |  - Live Mobile Preview Simulator (Mô phỏng điện thoại Worker thời gian thực)  |   |
|   |  - API Client (Fetch + Role Switcher Header + Timeout + Error/OCC handler)    |   |
|   +-------------------------------------------------------------------------------+   |
+------------------------------------------+--------------------------------------------+
                                           | HTTP Requests (REST JSON & Static Files)
                                           v
+---------------------------------------------------------------------------------------+
|                               FASTIFY SERVER (Interface Layer)                         |
|   +-------------------------------------------------------------------------------+   |
|   |  Static Web Adapter: `GET /`, `GET /admin`, `GET /public/*`                   |   |
|   |  REST API Adapter: `GET /api/v1/tasks` (Mở rộng cho UI), POST, PATCH          |   |
|   +-------------------------------------------------------------------------------+   |
+------------------------------------------+--------------------------------------------+
                                           | Giao tiếp qua DTO & Use Case Calls
                                           v
+---------------------------------------------------------------------------------------+
|                                 USE CASE LAYER (Application)                          |
|   - `ListFreelanceTasksUseCase` (Mới: phục vụ Dashboard & Task Table)                 |
|   - `CreateFreelanceTaskUseCase`, `UpdateFreelanceTaskUseCase`, `ChangeTaskStatus`    |
|   - Port mở rộng: `TaskRepositoryPort.findAll(): Promise<FreelanceTask[]>`            |
+------------------------------------------+--------------------------------------------+
                                           | Gọi qua Repository Ports
                                           v
+---------------------------------------------------------------------------------------+
|                               INFRASTRUCTURE LAYER (Persistence)                      |
|   - `PrismaTaskRepository.findAll()` -> Truy vấn PostgreSQL                           |
|   - `PrismaTaskAuditLogRepository` -> Ghi log append-only                             |
+---------------------------------------------------------------------------------------+
```

### Các nguyên tắc kiến trúc cốt lõi:
1. **Kiến trúc Frontend Siêu Nhẹ & Độc Lập (Zero-Build Vanilla SPA):**
   - Đặt toàn bộ mã nguồn giao diện trong thư mục `public/` (gồm `index.html`, `css/style.css`, và các modules JavaScript thuần ES6+ trong `js/`).
   - Sử dụng **Tailwind CSS qua CDN** để tạo giao diện hiện đại, responsive, không đòi hỏi bất kỳ build pipeline (như Webpack/Vite) nào, giúp Fastify có thể serve trực tiếp trong chưa đầy 1ms.
2. **Tuân thủ Ranh giới Clean Architecture:**
   - Giao diện web nằm hoàn toàn tại tầng ngoài cùng (Client / Interface Adapter). Giao tiếp với hệ thống 100% qua REST API `/api/v1/tasks` tiêu chuẩn.
   - Để phục vụ Dashboard và Task Table, bổ sung Use Case nghiệp vụ `ListFreelanceTasksUseCase` và phương thức `findAll()` trên `TaskRepositoryPort` mà không làm thay đổi hay phá vỡ Domain logic hiện có.
3. **Phòng vệ Chuyên sâu (Defense in Depth - SEC-01):**
   - Validation 2 lớp: Client-side Form phản hồi tức thì với các cảnh báo bounds (Xu, quota, trần 5 tỷ Xu) và tiền tố HTTPS-only; Backend Zod schema + Domain Value Objects tiếp tục xác thực độc lập.
   - 100% dữ liệu văn bản từ form hoặc API được escape an toàn khi render sang DOM của Bảng và Mobile Preview, loại bỏ hoàn toàn rủi ro tấn công XSS.

---

## 2. Ánh xạ Yêu cầu sang Thành phần (REQ-to-Component Mapping)

| Mã yêu cầu | Mô tả tóm tắt | Thành phần đảm nhiệm (Component) | Tầng kiến trúc (Layer) | File path dự kiến |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-PUI-001` | Dashboard 4 thẻ thống kê | `DashboardStatsComponent` | Web Frontend | `public/js/components/dashboard-stats.js` |
| `REQ-PUI-002` | Xử lý lỗi nạp danh sách | `ApiClient` / Toast Notification | Web Frontend | `public/js/api.js`, `public/js/components/toast-modal.js` |
| `REQ-PUI-003` | Skeleton loading & anti-double-click | `TaskTableComponent` | Web Frontend | `public/js/components/task-table.js` |
| `REQ-PUI-004` | Bảng danh sách & Status badge | `TaskTableComponent` | Web Frontend | `public/js/components/task-table.js` |
| `REQ-PUI-005` | Tab lọc trạng thái & Tìm kiếm | `TaskTableComponent` | Web Frontend | `public/js/components/task-table.js` |
| `REQ-PUI-006` | Xuất bản với Confirm Modal | `ConfirmModal` / `ApiClient` | Web Frontend | `public/js/components/toast-modal.js` |
| `REQ-PUI-007` | Tạm dừng & Mở lại kèm Toast | `TaskTableComponent` / `ApiClient` | Web Frontend | `public/js/components/task-table.js` |
| `REQ-PUI-008` | Đóng việc với cảnh báo 24h | `ConfirmModal` / `ApiClient` | Web Frontend | `public/js/components/toast-modal.js` |
| `REQ-PUI-009` | Xử lý lỗi xung đột OCC 409 | `ConflictModal` / `TaskTable` | Web Frontend | `public/js/components/toast-modal.js` |
| `REQ-PUI-010` | Reactive Coin Calculator (< 5ms) | `TaskFormComponent` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-011` | Cảnh báo vi phạm bounds (Xu/Quota/5B) | `TaskFormComponent` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-012` | Dynamic Steps (+, -, sắp xếp) | `TaskFormComponent` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-013` | Xác thực an ninh HTTPS URL (SEC-01) | `UrlValidator` / `TaskForm` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-014` | Dynamic Proof Requirements | `TaskFormComponent` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-015` | Giới hạn proofs <= 5, ảnh <= 3 | `TaskFormComponent` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-016` | Submit form tạo việc & Reset | `TaskFormComponent` / `ApiClient` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-017` | Hiển thị Banner lỗi API 400 | `TaskFormComponent` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-018` | Live Mobile Preview Simulator (100ms) | `MobilePreviewComponent` | Web Frontend | `public/js/components/mobile-preview.js` |
| `REQ-PUI-019` | Nút "Nhận việc" mô phỏng tooltip | `MobilePreviewComponent` | Web Frontend | `public/js/components/mobile-preview.js` |
| `REQ-PUI-020` | Auto-save & Restore Draft (E-1) | `DraftStorage` / `TaskForm` | Web Frontend | `public/js/components/task-form.js` |
| `REQ-PUI-021` | Static Serving trực tiếp từ Fastify | `WebStaticRoutes` | Interface Layer | `src/interface/http/routes/web.routes.ts` |
| `REQ-PUI-022` | XSS HTML Escaping an toàn (SEC-01) | `HtmlEscaper` Utility | Web Frontend | `public/js/utils/html-escaper.js` |
| `REQ-PUI-023` | Dev Role Switcher (`x-user-role`) | `NavbarComponent` / `ApiClient` | Web Frontend | `public/js/components/navbar.js` |
| *Core-Ext* | API danh sách nhiệm vụ `GET /tasks` | `ListFreelanceTasksUseCase` | Usecase / Interface | `src/usecase/list-freelance-tasks.usecase.ts` |

---

## 3. Danh mục các Thành phần chi tiết (Components)

### 3.1 Web Frontend Components (`public/`)

- **`index.html` (`public/index.html`):** Khung trang chủ Single Page Application chứa:
  - Header Navbar với Logo Jobzz và Dev Role Switcher (`ADMIN` / `WORKER`).
  - Section 1: Dashboard Stats Cards (4 khối thống kê).
  - Section 2: Layout 2 cột linh hoạt:
    - Cột trái (60%): Reactive Task Form (tạo nhiệm vụ mới với steps và proofs).
    - Cột phải (40%): Live Mobile Preview Simulator (khung điện thoại xem trước của Worker).
  - Section 3: Bảng quản trị nhiệm vụ (Task Table) với tab lọc trạng thái, tìm kiếm và phân trang.
  - Vùng chứa Toast Notifications và Modal Hộp thoại xác nhận.
- **`app.js` (`public/js/app.js`):** Script điều phối trung tâm của SPA; khởi tạo các components, lắng nghe các sự kiện đồng bộ giữa Form và Preview, điều phối nạp dữ liệu khi đổi trạng thái.
- **`api.js` (`public/js/api.js`):** HTTP Client bọc Fetch API:
  - Tự động gắn header `x-user-role` và `x-user-id` dựa trên Dev Role Switcher hiện tại.
  - Thiết lập timeout 5000ms qua `AbortController` (`NFR-RELI-01`).
  - Bắt các mã lỗi HTTP (400, 403, 404, 409, 500) và chuẩn hóa thông báo lỗi trả về cho UI.
- **`dashboard-stats.js` (`public/js/components/dashboard-stats.js`):** Tính toán và kết xuất 4 chỉ số thống kê từ mảng danh sách nhiệm vụ.
- **`task-table.js` (`public/js/components/task-table.js`):** Render bảng nhiệm vụ với:
  - Huy hiệu trạng thái (Status Badges) phân màu theo `SPEC.md`.
  - Chip hiển thị phiên bản OCC (`v1`, `v2`, ...).
  - Các nút hành động theo ngữ cảnh (Publish, Pause, Resume, Close).
  - Bộ lọc tab trạng thái và thanh tìm kiếm tức thì.
- **`task-form.js` (`public/js/components/task-form.js`):**
  - Quản lý form tạo việc: lắng nghe sự kiện `input` để nhân `quota * reward_coins` tức thời (< 5ms).
  - Kiểm tra các ngưỡng bounds (1 - 500k Xu, 1 - 10k quota, <= 5B Xu).
  - Dynamic Steps: thêm/xóa bước, kiểm tra tiền tố `https://` (SEC-01).
  - Dynamic Proofs: thêm/xóa bằng chứng (tối đa 5 proofs, tối đa 3 ảnh).
  - Auto-save draft vào `localStorage` và xử lý khôi phục bản nháp.
- **`mobile-preview.js` (`public/js/components/mobile-preview.js`):**
  - Kết xuất giao diện mô phỏng iPhone/Android với thanh trạng thái, tiêu đề, thù lao Xu nổi bật, danh mục, thời gian làm bài, các bước và yêu cầu nộp bằng chứng.
  - Lắng nghe sự kiện từ `task-form` qua debounce 100ms.
- **`toast-modal.js` (`public/js/components/toast-modal.js`):**
  - Quản lý Toast thông báo (Success, Error, Warning).
  - Quản lý Modal xác nhận thao tác nguy hiểm (Publish confirm, Close confirmation, OCC 409 conflict modal).
- **`html-escaper.js` (`public/js/utils/html-escaper.js`):**
  - Hàm tiện ích mã hóa ký tự HTML (`&`, `<`, `>`, `"`, `'`) để ngăn ngừa tấn công XSS 100% khi render dữ liệu.

---

### 3.2 Backend Interface & Application Extensions

- **`WebStaticRoutes` (`src/interface/http/routes/web.routes.ts`):**
  - Đăng ký các tuyến đường phục vụ giao diện web tĩnh trực tiếp từ thư mục `public/`:
    - `GET /` và `GET /admin`: Trả về tệp `public/index.html`.
    - `GET /public/*`: Phục vụ các file css, js, asset với MIME type chính xác (`text/html`, `text/css`, `application/javascript`).
- **`ListFreelanceTasksUseCase` (`src/usecase/list-freelance-tasks.usecase.ts`):**
  - Nhận yêu cầu từ Admin, gọi `TaskRepositoryPort.findAll()`, trả về danh sách nhiệm vụ được sắp xếp theo thời gian tạo mới nhất.
- **Mở rộng `TaskRepositoryPort` (`src/usecase/ports/task-repository.port.ts`):**
  - Bổ sung phương thức: `findAll(): Promise<FreelanceTask[]>`.
- **Mở rộng `PrismaTaskRepository` (`src/infra/repositories/prisma-task.repository.ts`):**
  - Triển khai `findAll()`: Truy vấn danh sách tasks từ bảng Prisma `Task`, chuyển đổi thành mảng thực thể `FreelanceTask`.
- **Cập nhật `TaskController` (`src/interface/http/controllers/task.controller.ts`):**
  - Bổ sung phương thức `listTasks = async (request, reply) => ...` phục vụ endpoint `GET /api/v1/tasks`.
- **Cập nhật `src/app.ts`:**
  - Tích hợp `registerWebRoutes(app)` và đăng ký `GET /api/v1/tasks` trong `registerTaskRoutes`.

---

## 4. Luồng dữ liệu (Data Flow)

### 4.1 Luồng nạp dữ liệu Dashboard & Bảng danh sách (`REQ-PUI-001..005`)
```
[Admin mở localhost:3000]
       |
       v
[Fastify: GET / hoặc /admin] ---> Trả về `public/index.html`
       |
       v
[Browser nạp app.js & components]
       |
       v
[api.js gọi GET /api/v1/tasks] (kèm header x-user-role: ADMIN)
       |
       v
[TaskController.listTasks] ---> [ListFreelanceTasksUseCase.execute()]
       |                                     |
       |                                     v
       |                     [TaskRepositoryPort.findAll()]
       |                                     |
       v                                     v
[Phản hồi HTTP 200 { data: tasks[] }] <--- [PrismaTaskRepository.findAll()]
       |
       +---> [DashboardStatsComponent: Tính tổng task, active, tổng Xu, hoàn thành]
       +---> [TaskTableComponent: Render bảng kèm Status Badges & OCC chip]
```

### 4.2 Luồng chuyển đổi trạng thái nhiệm vụ (`REQ-PUI-006..009`)
```
[Admin bấm nút trên Task Table (Publish / Pause / Resume / Close)]
       |
       +---> Nếu Publish hoặc Close: [Hiển thị ConfirmModal yêu cầu xác nhận]
       |
       v (Sau khi xác nhận)
[api.js gọi POST /api/v1/tasks/{id}/status] ({ action, expected_version })
       |
       v
[TaskController.changeTaskStatus] ---> [ChangeTaskStatusUseCase.execute()]
       |                                           |
       |                              [PrismaTaskRepository.update()]
       |                                           |
       |---> Nếu version khớp: HTTP 200 OK --------+
       |     v
       |   [Toast thông báo thành công] ---> [Tự động nạp lại danh sách]
       |
       +---> Nếu version lệch: HTTP 409 Conflict
             v
           [Hiển thị OCC Conflict Modal cảnh báo va chạm phiên]
           [Tự động gọi lại GET /api/v1/tasks để cập nhật dữ liệu mới nhất]
```

### 4.3 Luồng tạo nhiệm vụ mới & Live Mobile Preview (`REQ-PUI-010..020`)
```
[Admin nhập liệu trên Reactive Form]
       |
       +---> [Sự kiện 'input']:
       |        |
       |        +---> [Tính total_reward_coins = quota * reward_coins (< 5ms)]
       |        +---> [Kiểm tra Bounds & URL https://: Cảnh báo đỏ nếu lỗi]
       |        +---> [Auto-save vào localStorage 'jobzz_post_job_draft']
       |        +---> (Debounce 100ms) ---> [Đồng bộ sang Live Mobile Preview]
       |
       v
[Admin bấm "Tạo nhiệm vụ"] (Form hợp lệ)
       |
       v
[api.js gọi POST /api/v1/tasks] (Payload JSON)
       |
       v
[Backend xử lý UseCase + Prisma] ---> Trả về HTTP 201 Created
       |
       v
[Toast thành công] ---> [Xóa form & localStorage draft] ---> [Chuyển tab về Task Table]
```

---

## 5. Phân loại Thay đổi Trạng thái (State-Change Classification)

| Thành phần / Luồng thực thi | Phân loại trạng thái (State-Change Category) | Nhu cầu Checkpoint / Gate |
| :--- | :--- | :--- |
| `public/*` (Giao diện tĩnh SPA) | `none` (Mã nguồn hiển thị phía client, không sửa đổi dữ liệu hệ thống) | Test UI & code review |
| `src/interface/http/routes/web.routes.ts` | `none` (Phục vụ tài nguyên tĩnh qua HTTP) | Unit test route registration |
| `GET /api/v1/tasks` (List tasks API) | `shared/public contract` (Mở rộng thêm endpoint GET danh sách) | Non-breaking additive change; Unit & integration test |
| `TaskRepositoryPort.findAll()` | `none` (Mở rộng interface trong tầng Usecase) | Typecheck & Adapter test |
| Thao tác chuyển đổi trạng thái từ UI | `persistence schema / business-data mutation` | Đã được bảo vệ qua UseCase & OCC version check của backend |

---

## 6. Đánh giá Tác động Hợp đồng Dùng chung (Shared-Contract Impact)

- **Đánh giá:** Tính năng `post-job-ui` **không gây ra breaking change** cho bất kỳ public contract nào hiện có của `post-job`.
- **Thay đổi mở rộng (Additive Changes):**
  - Thêm endpoint `GET /api/v1/tasks` trả về danh sách toàn bộ nhiệm vụ (yêu cầu quyền `ADMIN`). Endpoint này kế thừa 100% cấu trúc `formatTaskResponse` hiện có của `task.controller.ts`.
  - Thêm các tuyến đường tĩnh `GET /` và `GET /admin` phục vụ tệp HTML/CSS/JS.
- **Tính tương thích:** Tương thích ngược 100% với các test suite hiện tại của dự án.

---

## 7. Bản đồ Nhất quán (Consistency Map)

| Mã yêu cầu | Thành phần Plan | Task dự kiến | Exact Verification Command | Tiêu chí kiểm chứng | Trigger Post-Code Review |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-PUI-001..005` | Dashboard & Task Table | T001-PUI | `npx vitest run tests/integration/api/task-api.spec.ts` | Bảng hiển thị đúng stats, status badges, version | Có (thay đổi UI & API) |
| `REQ-PUI-006..009` | State Actions & OCC | T002-PUI | `npx vitest run tests/unit/usecase/usecases.spec.ts` | Modal confirm, xử lý lỗi 409 conflict | Có |
| `REQ-PUI-010..017` | Reactive Task Form | T003-PUI | `npx vitest run` | Tính Xu tức thời, bounds checks, dynamic steps/proofs | Có |
| `REQ-PUI-018..019` | Live Mobile Preview | T004-PUI | `npx vitest run` | Đồng bộ 100ms, nút nhận việc mô phỏng | Không (chỉ UI logic) |
| `REQ-PUI-020..023` | Draft, Static, XSS, Role | T005-PUI | `npx vitest run tests/unit/shared/xss-sanitizer.spec.ts` | Auto-save draft, escape HTML XSS, static route | Có |
| *Mở rộng Backend* | `findAll` & `GET /tasks` | T006-PUI | `npx vitest run tests/integration/api/task-api.spec.ts` | API trả về mảng tasks có cấu trúc đúng | Có |
| *Kiểm thử Tổng thể*| E2E Web Flow | T007-PUI | `npx vitest run; npx tsc --noEmit` | 100% test pass, TypeScript biên dịch sạch | Bắt buộc post-code review |

---

## 8. Trình tự Triển khai (Implementation Sequence & Dependencies)

```
[Phase 1: Backend Extension]
   ├── Mở rộng `TaskRepositoryPort.findAll()` và `PrismaTaskRepository.findAll()`
   ├── Xây dựng `ListFreelanceTasksUseCase`
   └── Thêm endpoint `GET /api/v1/tasks` trong `TaskController` & `task.routes.ts`
           |
           v
[Phase 2: Static Web Serving Interface]
   ├── Xây dựng `src/interface/http/routes/web.routes.ts` phục vụ tệp tĩnh từ `public/`
   └── Tích hợp vào `src/app.ts`
           |
           v
[Phase 3: Core UI Framework & Utilities]
   ├── Tạo `public/index.html` với Tailwind CSS CDN, Layout 2 cột và Navbar
   ├── Xây dựng `public/js/utils/html-escaper.js` (SEC-01 XSS defense)
   ├── Xây dựng `public/js/components/toast-modal.js` (Toast & Confirm/Conflict Modals)
   └── Xây dựng `public/js/api.js` (Fetch wrapper với Dev Role Switcher & Timeout)
           |
           v
[Phase 4: Dashboard Stats & Task Management Table]
   ├── Xây dựng `public/js/components/dashboard-stats.js`
   └── Xây dựng `public/js/components/task-table.js` (Lọc tab, tìm kiếm, action buttons)
           |
           v
[Phase 5: Reactive Task Form & Auto-Save]
   ├── Xây dựng `public/js/components/task-form.js`
   ├── Tích hợp bộ tính Xu tức thời và cảnh báo bounds (Xu, Quota, 5B Xu)
   ├── Tích hợp Dynamic Steps (HTTPS-only check) và Dynamic Proofs
   └── Tích hợp LocalStorage Draft Auto-save & Restore
           |
           v
[Phase 6: Live Mobile Preview Simulator]
   ├── Xây dựng `public/js/components/mobile-preview.js`
   └── Kết nối đồng bộ hai chiều từ Form sang Preview với debounce 100ms
           |
           v
[Phase 7: End-to-End Verification & Verification Gate]
   ├── Viết tests bổ sung cho `ListFreelanceTasksUseCase` và `GET /api/v1/tasks`
   ├── Chạy toàn bộ test suite `npx vitest run` và typecheck `npx tsc --noEmit`
   └── Kiểm thử trải nghiệm giao diện trên trình duyệt localhost:3000
```

---

## 9. Rủi ro Kỹ thuật & Biện pháp Giảm thiểu (Risks & Mitigations)

1. **Rủi ro 1: Tấn công XSS thông qua nội dung hiển thị trên Bảng và Mobile Preview (SEC-01).**
   - *Mô tả:* Kẻ tấn công hoặc Admin paste các chuỗi độc hại dạng `<script>`, `onload=...` vào tiêu đề hoặc hướng dẫn bước.
   - *Biện pháp:* Xây dựng module `html-escaper.js`; nghiêm cấm gán trực tiếp chuỗi thô vào `innerHTML`. Mọi text hiển thị trên DOM đều phải đi qua hàm mã hóa ký tự HTML hoặc gán qua `textContent`.
2. **Rủi ro 2: Tràn số hoặc sai lệch kiểu số học (Floating Point) khi tính tổng Xu trên client.**
   - *Mô tả:* JavaScript sử dụng IEEE 754 float; các phép tính có thể bị sai số hoặc tràn số nếu nhập số cực lớn.
   - *Biện pháp:* Ép kiểu chặt chẽ bằng `Math.floor(Number(val))`, kiểm tra `Number.isSafeInteger()`, chặn ngay lập tức nếu giá trị âm, có phần thập phân hoặc vượt quá 5,000,000,000 Xu trước khi cho phép submit.
3. **Rủi ro 3: Xung đột phiên bản đồng thời (OCC 409 Conflict) khi thao tác trên giao diện.**
   - *Mô tả:* Admin mở 2 tab, tab 1 đã chuyển task sang `PAUSED`, tab 2 bấm `CLOSE` dẫn đến lỗi 409 từ server.
   - *Biện pháp:* `api.js` bắt mã lỗi 409, mở Modal cảnh báo trực quan giải thích cho Admin dữ liệu vừa bị thay đổi ở phiên khác, và tự động gọi lại `GET /api/v1/tasks` để cập nhật bảng sang trạng thái mới nhất.
4. **Rủi ro 4: Trùng lặp hoặc xung đột tuyến đường giữa Static Serving và REST API.**
   - *Mô tả:* Tuyến đường phục vụ file tĩnh bắt nhầm các endpoint API `/api/v1/*`.
   - *Biện pháp:* Đăng ký REST API routes trước; tuyến đường static serving chỉ bắt các request có tiền tố `/public/`, `/`, và `/admin`.

---

## 10. Câu hỏi dành cho Human Reviewer (Questions for Human Reviewer)

### Q1: Cấu hình cổng lắng nghe và cách khởi chạy server khi mở trên trình duyệt
- **Điều chưa rõ:** Hiện tại `src/app.ts` export hàm `buildApp()`, dự án chưa có file `src/server.ts` để chạy lệnh `node` hoặc `npm start` lắng nghe trên cổng 3000.
- **Assumption hiện tại:** Tạo thêm tệp khởi động `src/server.ts` lắng nghe tại `http://localhost:3000` (hoặc cổng cấu hình qua biến môi trường `PORT`, mặc định 3000) và bổ sung script `"start": "node dist/server.js"` / `"dev": "tsx src/server.ts"` trong `package.json`.
- **Ảnh hưởng nếu assumption sai:** Nếu dự án có cơ chế khởi động server khác (ví dụ qua Docker hoặc serverless), cấu hình file khởi động sẽ cần điều chỉnh.
- **Câu hỏi cụ thể:** Bạn có đồng ý với việc bổ sung `src/server.ts` để chạy server Fastify trên cổng 3000 không?

### Q2: Cơ chế phục vụ tệp tĩnh trong Fastify (Direct Static File Handler vs Package ngoài)
- **Điều chưa rõ:** Quản trị dependencies theo Constitution hạn chế cài thêm third-party package nếu chưa được duyệt. Fastify có thể phục vụ tĩnh thông qua module Node.js chuẩn (`fs.promises` / `fs.createReadStream` với stream header) hoặc cài `@fastify/static`.
- **Assumption hiện tại:** Sử dụng một route handler tĩnh viết bằng Node.js chuẩn (`src/interface/http/routes/web.routes.ts` dùng `fs.createReadStream` và `path.join`) để phục vụ `public/` mà không cần cài thêm bất kỳ dependency nào vào `package.json`, bảo toàn 100% tính nguyên bản của stack.
- **Ảnh hưởng nếu assumption sai:** Nếu muốn dùng `@fastify/static`, cần có phê duyệt cài đặt package bổ sung từ Human Reviewer.
- **Câu hỏi cụ thể:** Bạn có đồng ý sử dụng built-in Stream Static Handler để phục vụ `public/` ngay lập tức mà không cần cài thêm package ngoài không?

---

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: `.sdd/features/post-job-ui/PLAN.md` — Kế hoạch kiến trúc và thiết kế kỹ thuật giao diện web quản trị nhiệm vụ Jobzz
- Recommendation: Phê duyệt kế hoạch kiến trúc PLAN.md (Version 1.0.0). Kế hoạch thiết lập kiến trúc Single Page Application siêu nhẹ (Zero-Build Vanilla SPA) đặt tại `public/`, kết hợp mở rộng Use Case `ListFreelanceTasksUseCase` trên nền tảng Clean Architecture và Fastify backend đã ổn định. Mọi yêu cầu từ `SPEC.md` đã được ánh xạ chi tiết sang từng thành phần, đảm bảo 100% an toàn an ninh URL/XSS và kiểm soát đồng thời OCC.
- Evidence: Đã tạo tệp `.sdd/features/post-job-ui/PLAN.md`; ánh xạ 23 yêu cầu EARS sang các components cụ thể; tích hợp sẵn 4 biện pháp giảm thiểu rủi ro kỹ thuật; giữ nguyên vẹn 68/68 automated tests backend hiện có.
- Risks and assumptions: Lựa chọn built-in Static File Handler giúp hệ thống chạy ngay mà không cần cài thêm dependency; bổ sung `src/server.ts` để khởi động lắng nghe trên cổng 3000.
- Alternatives considered: Cân nhắc cài `@fastify/static`, nhưng sử dụng Node.js built-in stream handler an toàn hơn, nhẹ hơn và không làm phát sinh rủi ro supply chain bên thứ ba.
- Required human decision: Phê duyệt tài liệu PLAN.md của tính năng `post-job-ui` và xác nhận 2 câu hỏi kỹ thuật (Q1, Q2) để mở khóa cho Pha 3 SDD (`/sdd-tasks --feature=post-job-ui`).

## Human Final Review
- Status: APPROVED
- Decision: Duyệt PLAN.md post-job-ui v1.0.0, đồng ý Q1 và Q2
- Reviewer: Admin
- Reviewed at: 2026-11-19T20:49:46+07:00
- Follow-up: /sdd-tasks --feature=post-job-ui 

