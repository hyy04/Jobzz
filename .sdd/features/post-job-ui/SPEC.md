# Đặc tả kỹ thuật: Giao diện web quản trị nhiệm vụ Jobzz (post-job-ui)

# Version: 1.0.0
# Status: APPROVED & LOCKED
# Feature Slug: post-job-ui
# Depth: DETAILED
# Methodology Profile: Depth=DETAILED, Risk=elevated, Review Route=N/A, Decision Owner=Admin (@admin)
# Clarification-First Status: CONFIRMED BY HUMAN REVIEWER (B-1, B-2, B-3, T-1, T-2, T-3, E-1, E-2, E-3)

---

## 1. Bối cảnh & Mục tiêu (Context & Goal)

- **Bối cảnh:** Nền tảng Jobzz vận hành mô hình chợ việc làm tự do vi mô (Micro-task / Bounty Jobs) với đơn vị tiền tệ thù lao là **Xu (Coins)**. Toàn bộ nhiệm vụ được phát hành độc quyền bởi Quản trị viên (Admin) và được bảo vệ nghiêm ngặt ở tầng backend qua feature `post-job` (với các quy chuẩn an ninh URL HTTPS `SEC-01`, kiểm soát đồng thời OCC, và Application Port `TaskProgressPort` `ARCH-01`).
- **Mục tiêu tính năng (`post-job-ui`):**
  - Xây dựng giao diện web quản trị Single Page Application (SPA) trực quan, hiện đại, phục vụ trực tiếp từ Fastify backend tại `http://localhost:3000` (hoặc route `/admin`), loại bỏ hoàn toàn sự phụ thuộc vào cURL hay Postman.
  - Cung cấp **Bảng điều khiển (Dashboard)** thống kê 4 chỉ số then chốt và **Bảng quản trị nhiệm vụ** hỗ trợ lọc, tìm kiếm và chuyển đổi trạng thái an toàn theo đúng Ma trận vòng đời nhiệm vụ.
  - Cung cấp **Form tạo nhiệm vụ tương tác trực tiếp (Reactive Form)** với bộ tính toán ngân sách Xu thời gian thực, cảnh báo tức thì các ngưỡng bounds (1 - 500,000 Xu, 1 - 10,000 quota, trần 5 tỷ Xu), dynamic steps với xác thực URL HTTPS-only, và dynamic proof requirements.
  - Tích hợp **Trình giả lập di động xem trước (Mobile Preview Simulator)** phản chiếu thời gian thực nội dung bài đăng dưới góc nhìn của Worker để tối ưu hóa trải nghiệm người dùng trước khi xuất bản.
  - Bảo đảm an toàn tuyệt đối về mặt hiển thị: chống XSS qua cơ chế escape dữ liệu nghiêm ngặt, xử lý xung đột phiên bản OCC 409 thân thiện, và tự động lưu/khôi phục bản nháp qua `localStorage`.

---

## 2. Tác nhân & Phân quyền (Actors & Roles)

| Tác nhân | Vai trò trong hệ thống | Thẩm quyền trên giao diện `post-job-ui` |
| :--- | :--- | :--- |
| **Admin** | Quản trị viên nền tảng Jobzz | **Toàn quyền:** Xem dashboard stats, xem danh sách nhiệm vụ, thực hiện chuyển đổi trạng thái (`Publish`, `Pause`, `Resume`, `Close`), tạo nhiệm vụ mới, xem trước Mobile Preview. |
| **Worker (Mô phỏng)** | Góc nhìn Worker trong Mobile Preview | **Mô phỏng xem trước:** Xem các thông tin nhiệm vụ như thù lao Xu, các bước hướng dẫn, liên kết an toàn, yêu cầu bằng chứng. Nút "Nhận việc" chỉ hiển thị thông báo mô phỏng. |
| **Guest / Anonymous** | Khách truy cập không có quyền | **Bị chặn / Giới hạn:** Nếu vai trò gửi lên không phải `ADMIN` (qua header hoặc Dev Role Switcher), các thao tác tạo việc hoặc đổi trạng thái sẽ bị từ chối với lỗi 403 Forbidden. |

---

## 3. Yêu cầu chức năng (Functional Requirements - EARS)

### 3.1 Dashboard Thống kê & Bảng quản trị nhiệm vụ

- **`REQ-PUI-001` (Event-driven):**
  - **WHEN** Admin mở trang web quản trị hoặc nhấn nút "Làm mới" (Refresh), the system **SHALL** gửi yêu cầu `GET /api/v1/tasks` đến backend, tính toán tổng hợp và kết xuất 4 thẻ thống kê:
    1. *Tổng số nhiệm vụ (Total Tasks)*: Tổng số bản ghi nhận được.
    2. *Nhiệm vụ đang hoạt động (Active Tasks)*: Số nhiệm vụ có `status === "ACTIVE"`.
    3. *Tổng ngân sách Xu (Total Coins Allocated)*: Tổng tích số $\sum \text{total\_reward\_coins}$.
    4. *Số lượt hoàn thành (Total Completions)*: Thống kê tổng số lượt bài đã hoàn thành.

- **`REQ-PUI-002` (Unwanted):**
  - **IF** yêu cầu nạp dữ liệu từ `GET /api/v1/tasks` thất bại do lỗi mạng hoặc backend trả mã lỗi 5xx, **THEN** the system **SHALL** hiển thị Toast thông báo lỗi màu đỏ: *"Không thể tải danh sách nhiệm vụ. Vui lòng kiểm tra kết nối server!"* kèm nút bấm "Thử lại" (Retry).

- **`REQ-PUI-003` (State-driven):**
  - **WHILE** dữ liệu danh sách nhiệm vụ đang được tải từ server, the system **SHALL** hiển thị khung xương chờ (Skeleton Loading) hoặc biểu tượng xoay (Loading Spinner) trên Bảng quản trị và vô hiệu hóa các nút bấm thao tác để chống click đúp.

- **`REQ-PUI-004` (Event-driven):**
  - **WHEN** dữ liệu danh sách nhiệm vụ được nạp thành công, the system **SHALL** hiển thị bảng dữ liệu với các cột: Mã nhiệm vụ (8 ký tự đầu kèm tooltip đầy đủ), Tiêu đề, Danh mục, Chỉ tiêu (`quota`), Thù lao (`reward_coins`), Tổng Xu (`total_reward_coins`), Phiên bản OCC (`version`), và Huy hiệu trạng thái (`DRAFT`: vàng, `ACTIVE`: xanh lá, `PAUSED`: cam, `COMPLETED`: xanh dương, `CLOSED`: đỏ).

- **`REQ-PUI-005` (Event-driven):**
  - **WHEN** Admin bấm chọn một Tab trạng thái (`Tất cả`, `Đang chạy`, `Tạm dừng`, `Bản nháp`, `Hoàn thành`, `Đã đóng`) hoặc gõ từ khóa vào ô tìm kiếm, the system **SHALL** lọc danh sách hiển thị tức thời (< 10ms) theo đúng tiêu chí đã chọn.

---

### 3.2 Thao tác Chuyển đổi trạng thái nhiệm vụ (State Actions & OCC)

- **`REQ-PUI-006` (Event-driven):**
  - **WHEN** Admin bấm nút "Xuất bản" (Publish) trên một nhiệm vụ đang ở trạng thái `DRAFT`, the system **SHALL** hiển thị Hộp thoại xác nhận (Confirm Modal) với nội dung: *"Bạn có chắc chắn muốn xuất bản nhiệm vụ này sang trạng thái Đang hoạt động (ACTIVE) không?"*.
  - **WHEN** Admin xác nhận "Đồng ý", the system **SHALL** gửi yêu cầu `PATCH /api/v1/tasks/{id}/status` với `{ "status": "ACTIVE", "version": current_version }`.

- **`REQ-PUI-007` (Event-driven):**
  - **WHEN** Admin bấm nút "Tạm dừng" (Pause) trên nhiệm vụ `ACTIVE`, the system **SHALL** gửi yêu cầu `PATCH /api/v1/tasks/{id}/status` với `{ "status": "PAUSED", "version": current_version }` và hiển thị Toast thông báo: *"Đã tạm dừng nhận lượt làm mới"*.
  - **WHEN** Admin bấm nút "Mở lại" (Resume) trên nhiệm vụ `PAUSED`, the system **SHALL** gửi yêu cầu `PATCH /api/v1/tasks/{id}/status` với `{ "status": "ACTIVE", "version": current_version }` và hiển thị Toast thông báo: *"Đã mở lại nhiệm vụ cho Worker nhận việc"*.

- **`REQ-PUI-008` (Event-driven):**
  - **WHEN** Admin bấm nút "Đóng việc" (Close) trên nhiệm vụ `ACTIVE` hoặc `PAUSED`, the system **SHALL** hiển thị Hộp thoại cảnh báo nguy hiểm: *"CẢNH BÁO: Hành động đóng vĩnh viễn nhiệm vụ không thể hoàn tác. Các slot đang làm dở sẽ có tối đa 24h để nộp bài. Bạn có chắc chắn muốn đóng?"*.
  - **WHEN** Admin xác nhận "Xác nhận đóng", the system **SHALL** gửi yêu cầu `PATCH /api/v1/tasks/{id}/status` với `{ "status": "CLOSED", "version": current_version }`.

- **`REQ-PUI-009` (Unwanted - OCC Conflict Protection):**
  - **IF** backend trả về mã phản hồi `409 Conflict` khi thực hiện đổi trạng thái hoặc sửa nội dung, **THEN** the system **SHALL** hiển thị Modal cảnh báo lỗi đồng thời: *"Dữ liệu nhiệm vụ đã bị chỉnh sửa ở một phiên khác (Version mismatch). Hệ thống sẽ tự động làm mới danh sách để đảm bảo tính nhất quán!"* và kích hoạt nạp lại dữ liệu từ server.

---

### 3.3 Form Tạo nhiệm vụ phản hồi thời gian thực (Reactive Task Form)

- **`REQ-PUI-010` (Event-driven):**
  - **WHEN** Admin nhập hoặc thay đổi giá trị trong ô `Số lượng tuyển (quota)` hoặc `Thù lao mỗi lượt (reward_coins)`, the system **SHALL** tính toán tức thời ($\le 5\text{ms}$) giá trị `total_reward_coins = quota * reward_coins` và cập nhật kết quả lên ô hiển thị "Tổng ngân sách Xu".

- **`REQ-PUI-011` (Unwanted - Bounds Validation):**
  - **IF** `reward_coins` nhỏ hơn 1 hoặc lớn hơn 500,000, **THEN** the system **SHALL** hiển thị thông báo lỗi màu đỏ ngay dưới trường nhập liệu: *"Thù lao phải từ 1 đến 500,000 Xu"* và chuyển nút Submit sang trạng thái `disabled`.
  - **IF** `quota` nhỏ hơn 1 hoặc lớn hơn 10,000, **THEN** the system **SHALL** hiển thị thông báo lỗi màu đỏ: *"Số lượng tuyển phải từ 1 đến 10,000 lượt"* và chuyển nút Submit sang trạng thái `disabled`.
  - **IF** tích số `total_reward_coins` vượt quá 5,000,000,000 Xu (5 tỷ Xu), **THEN** the system **SHALL** hiển thị cảnh báo nguy hiểm: *"Tổng ngân sách vượt quá hạn mức tối đa cho phép (5 tỷ Xu)"* và khóa nút Submit.

- **`REQ-PUI-012` (Event-driven):**
  - **WHEN** Admin bấm nút "+ Thêm bước hướng dẫn", the system **SHALL** thêm một hàng nhập liệu mới gồm: Số thứ tự tự động, Ô nhập nội dung hướng dẫn (`instruction`, bắt buộc), Ô nhập liên kết đích (`target_url`, tùy chọn), và nút xóa bước (duy trì tối thiểu 1 bước).

- **`REQ-PUI-013` (Unwanted - Insecure URL Scheme Check SEC-01):**
  - **IF** người dùng nhập `target_url` có nội dung nhưng không bắt đầu bằng tiền tố `https://` (ví dụ nhập `http://`, `javascript:`, `data:`), **THEN** the system **SHALL** hiển thị viền đỏ cảnh báo và thông báo lỗi: *"Đường dẫn bắt buộc phải sử dụng giao thức bảo mật https://"* và ngăn không cho submit form.

- **`REQ-PUI-014` (Event-driven):**
  - **WHEN** Admin bấm "+ Thêm yêu cầu bằng chứng", the system **SHALL** thêm một mục mới gồm: Hộp chọn loại bằng chứng (`SCREENSHOT` - Ảnh chụp màn hình, `TEXT` - Báo cáo văn bản), Ô nhập hướng dẫn nộp, và nút xóa yêu cầu.

- **`REQ-PUI-015` (Unwanted - Proof Bounds):**
  - **IF** tổng số yêu cầu bằng chứng vượt quá 5 hoặc số yêu cầu loại `SCREENSHOT` vượt quá 3, **THEN** the system **SHALL** vô hiệu hóa nút "+ Thêm yêu cầu bằng chứng" và hiển thị cảnh báo: *"Tối đa 5 yêu cầu bằng chứng và tối đa 3 ảnh chụp màn hình"*.

- **`REQ-PUI-016` (Event-driven):**
  - **WHEN** Admin bấm nút "Lưu nháp" (Draft) hoặc "Xuất bản ngay" (Publish) với dữ liệu form hợp lệ, the system **SHALL** gửi yêu cầu `POST /api/v1/tasks` với payload JSON tương ứng.
  - **WHEN** nhận phản hồi HTTP 201 Created từ backend, the system **SHALL** hiển thị Toast thông báo thành công, xóa sạch form (reset form), xóa bản nháp trong `localStorage`, và tự động cuộn/chuyển màn hình về Bảng quản trị nhiệm vụ với task mới được thêm vào đầu bảng.

- **`REQ-PUI-017` (Unwanted - API Validation Error):**
  - **IF** backend trả về mã lỗi 400 Bad Request kèm danh sách lỗi chi tiết từ Zod Schema, **THEN** the system **SHALL** trích xuất thông điệp lỗi và hiển thị Banner cảnh báo lỗi chi tiết trên đầu Form tạo việc.

---

### 3.4 Trình giả lập di động cho Worker (Live Mobile Preview Simulator)

- **`REQ-PUI-018` (State-driven):**
  - **WHILE** Admin đang gõ văn bản hoặc thay đổi các trường trên Form tạo việc (Tiêu đề, Danh mục, Thù lao Xu, Thời gian làm bài, Các bước, Các bằng chứng), the system **SHALL** tự động đồng bộ (với debounce 100ms) và kết xuất trực tiếp lên khung mô phỏng điện thoại di động:
    - Huy hiệu Xu vàng hiển thị số thù lao `reward_coins` Xu.
    - Tiêu đề và nhãn danh mục bài đăng.
    - Thời gian giữ slot làm bài (`execution_time_minutes` phút).
    - Danh sách các bước làm việc; các bước có link `https://` được hiển thị dưới dạng nút bấm "Mở liên kết" màu xanh dương thân thiện.
    - Danh sách các khung nộp bằng chứng tương ứng.

- **`REQ-PUI-019` (Event-driven):**
  - **WHEN** người dùng bấm vào nút "Nhận việc ngay" ở đáy màn hình Mobile Preview, the system **SHALL** hiển thị một Tooltip hoặc Popup thân thiện: *"Đây là màn hình xem trước (Worker Preview). Tính năng nhận việc thực tế sẽ được thực hiện trên ứng dụng Worker."* mà không gửi bất kỳ request nào lên server.

---

### 3.5 Tự động Lưu nháp, Phục vụ Tĩnh & An toàn Hiển thị

- **`REQ-PUI-020` (Event-driven - Auto-save E-1):**
  - **WHEN** Admin thay đổi bất kỳ trường dữ liệu nào trên Form tạo việc, the system **SHALL** lưu trạng thái form hiện tại vào `localStorage` với khóa `jobzz_post_job_draft`.
  - **WHEN** Admin tải lại trang và tồn tại bản nháp chưa submit trong `localStorage`, the system **SHALL** hiển thị Banner thông báo: *"Phát hiện bản nháp nhiệm vụ chưa lưu. Bạn có muốn khôi phục không?"* kèm nút "Khôi phục" và "Hủy bỏ".

- **`REQ-PUI-021` (Ubiquitous - Static Serving):**
  - The system **SHALL** phục vụ toàn bộ các tài nguyên tĩnh của giao diện (HTML, CSS, JS) trực tiếp từ ứng dụng Fastify thông qua plugin `@fastify/static` trên đường dẫn `/` và `/admin`.

- **`REQ-PUI-022` (Ubiquitous - SEC-01 Output Encoding):**
  - The system **SHALL** áp dụng cơ chế escape mã hóa ký tự HTML (hoặc gán an toàn qua thuộc tính `textContent`) cho 100% dữ liệu văn bản từ form hoặc từ API trước khi chèn vào DOM của Bảng quản trị và Mobile Preview, loại bỏ hoàn toàn nguy cơ tấn công Cross-Site Scripting (XSS).

- **`REQ-PUI-023` (Optional - Dev Role Switcher):**
  - **WHERE** giao diện chạy trong môi trường phát triển cục bộ, the system **SHALL** hiển thị bộ chọn vai trò (Dev Role Switcher) trên thanh điều hướng (Navbar) cho phép chuyển đổi giữa `ADMIN` và `WORKER` (tự động gắn header `x-user-role: ADMIN` hoặc `x-user-role: WORKER` khi gọi API).

---

## 4. Yêu cầu phi chức năng (Non-functional Requirements - NFR)

| Nhóm NFR | Tiêu chí đo lường | Ngưỡng bắt buộc | Phương pháp kiểm chứng |
| :--- | :--- | :--- | :--- |
| **NFR-PERF-01** | First Contentful Paint (FCP) | $\le 300\text{ms}$ trên môi trường localhost. | Lighthouse / Performance tab của DevTools. |
| **NFR-PERF-02** | Phản hồi tính tổng Xu thời gian thực | $\le 5\text{ms}$ kể từ khi phát sinh sự kiện `input`. | Benchmark sự kiện JavaScript `performance.now()`. |
| **NFR-PERF-03** | Dung lượng tải ban đầu (Initial Bundle Size) | Tổng dung lượng tải từ server $< 500\text{KB}$. | Kiểm tra Network payload trong Network DevTools. |
| **NFR-PERF-04** | Tần suất đồng bộ Live Mobile Preview | Debounce 100ms, đảm bảo khung hình render đạt 60fps. | Kiểm tra framerate và event listener profiler. |
| **NFR-SEC-01** | An ninh URL Scheme (SEC-01) | 100% `target_url` được kiểm tra tiền tố `https://` hợp lệ trước khi gửi đi. | Unit test client validator. |
| **NFR-SEC-02** | Khử nhiễm XSS (SEC-01) | Không sử dụng `innerHTML` với chuỗi chưa sanitize; 100% text binding qua `textContent` hoặc hàm escape. | Code review audit & XSS payload injection test. |
| **NFR-RELI-01** | Thời gian timeout kết nối API | Tối đa 5000ms (5 giây) cho mỗi request `fetch`. | AbortController timeout test. |
| **NFR-COMP-01** | Khả năng tương thích trình duyệt | Hoạt động chính xác trên 100% trình duyệt hiện đại (Chrome, Edge, Firefox, Safari) hỗ trợ ES6+. | Kiểm thử giao diện trên Chrome/Edge. |

---

## 5. Mô hình Dữ liệu Giao diện (UI Data & State Model)

### 5.1 Cấu trúc State Form tạo việc (`CreateTaskFormState`)
```typescript
interface CreateTaskFormState {
  title: string;                         // 10 - 150 ký tự
  category: TaskCategory;                // APP_INSTALL | ACCOUNT_REGISTRATION | SOCIAL_INTERACTION | REVIEW_RATING | SURVEY | CONTENT_WRITING | OTHER
  description: string;                  // >= 30 ký tự
  quota: number;                        // 1 - 10,000
  reward_coins: number;                 // 1 - 500,000
  total_reward_coins: number;           // Tự động tính = quota * reward_coins (<= 5,000,000,000)
  execution_time_minutes: number;       // 15 - 1440 phút (mặc định 60)
  auto_approval_days: number;           // 1 - 7 ngày (mặc định 3)
  steps: Array<{
    step_number: number;
    instruction: string;
    target_url?: string;                // Bắt buộc https:// nếu có
  }>;
  proof_requirements: Array<{
    type: "SCREENSHOT" | "TEXT";
    description: string;
  }>;
  status: "DRAFT" | "ACTIVE";           // Lưu nháp hoặc xuất bản ngay
}
```

### 5.2 Cấu trúc Bản ghi Bảng quản trị (`TaskTableRow`)
```typescript
interface TaskTableRow {
  id: string;                           // UUID
  title: string;
  category: string;
  quota: number;
  reward_coins: number;
  total_reward_coins: number;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CLOSED";
  version: number;                      // OCC Version (1, 2, ...)
  created_at: string;
}
```

### 5.3 Cấu trúc Lưu trữ Bản nháp (`jobzz_post_job_draft` trong `localStorage`)
```typescript
interface LocalDraftStorage {
  saved_at: string;                     // ISO timestamp
  data: CreateTaskFormState;
}
```

---

## 6. Xử lý Lỗi & Phản hồi Người dùng (Error Handling Contract)

| Mã lỗi / Tình huống | Nguồn phát sinh | Hành vi & Thông điệp trên Giao diện |
| :--- | :--- | :--- |
| **HTTP 400 Bad Request** | Backend validation (Zod schema fail) | Hiển thị Banner đỏ đầu Form: *"Dữ liệu không hợp lệ: [chi tiết lỗi từ API]"*. |
| **HTTP 403 Forbidden** | Thiếu quyền `ADMIN` (`x-user-role`) | Hiển thị Toast lỗi: *"Bạn không có quyền quản trị viên để thực hiện thao tác này!"*. |
| **HTTP 404 Not Found** | Nhiệm vụ không tồn tại | Hiển thị Toast cảnh báo: *"Không tìm thấy nhiệm vụ tương ứng!"* và tải lại danh sách. |
| **HTTP 409 Conflict** | OCC Version mismatch | Hiển thị Modal thông báo va chạm phiên bản và kích hoạt tự động làm mới danh sách. |
| **Network Failure / Timeout** | Mất kết nối internet hoặc quá 5s | Hiển thị Toast lỗi kết nối kèm nút bấm "Thử lại". |
| **Client-side Bounds Error** | Người dùng nhập số liệu vượt trần | Hiển thị thông báo đỏ trực tiếp dưới ô nhập liệu và khóa nút Submit. |
| **Insecure URL Error** | Nhập URL không bắt đầu bằng `https://` | Viền đỏ ô nhập URL và hiển thị thông báo lỗi giao thức an toàn (SEC-01). |

---

## 7. Tiêu chí Chấp nhận (Acceptance Criteria - BDD Scenarios)

### Kịch bản 1: Tự động tính tổng Xu và kiểm tra an toàn số học
```gherkin
Scenario: Admin nhập số lượng quota và thù lao Xu
  Given Admin đang mở form tạo nhiệm vụ mới
  When Admin nhập quota = 100 và reward_coins = 5000
  Then ô "Tổng ngân sách Xu" tự động hiển thị 500,000 Xu
  And nút "Tạo nhiệm vụ" không bị vô hiệu hóa

Scenario: Admin nhập số liệu vượt trần ngân sách 5 tỷ Xu
  Given Admin đang mở form tạo nhiệm vụ mới
  When Admin nhập quota = 10000 và reward_coins = 600000
  Then thông báo lỗi màu đỏ xuất hiện dưới ô thù lao: "Thù lao phải từ 1 đến 500,000 Xu"
  And cảnh báo nguy hiểm xuất hiện: "Tổng ngân sách vượt quá hạn mức tối đa cho phép (5 tỷ Xu)"
  And nút "Tạo nhiệm vụ" bị vô hiệu hóa (disabled)
```

### Kịch bản 2: Kiểm tra an ninh URL HTTPS-only (SEC-01)
```gherkin
Scenario: Admin nhập đường link không an toàn vào bước hướng dẫn
  Given Admin thêm một bước hướng dẫn mới
  When Admin nhập đường link "http://example.com/download"
  Then ô nhập link hiển thị viền đỏ cảnh báo
  And dòng chữ lỗi xuất hiện: "Đường dẫn bắt buộc phải sử dụng giao thức bảo mật https://"
  And nút "Tạo nhiệm vụ" bị khóa

Scenario: Admin sửa đường link thành HTTPS an toàn
  Given ô nhập link đang báo lỗi viền đỏ
  When Admin sửa link thành "https://example.com/download"
  Then thông báo lỗi biến mất và viền ô nhập trở lại bình thường
```

### Kịch bản 3: Đồng bộ thời gian thực sang màn hình Mobile Preview
```gherkin
Scenario: Admin gõ tiêu đề và cấu hình các bước trên form
  Given Admin đang nhập tiêu đề "Cài đặt ứng dụng Jobzz và đánh giá 5 sao"
  When Admin nhập xong tiêu đề và thù lao 20000 Xu
  Then màn hình Mobile Preview bên cạnh tự động cập nhật tiêu đề tương ứng
  And huy hiệu Xu thưởng trên Mobile Preview hiển thị nổi bật "20,000 Xu"
  And khung hiển thị mô phỏng điện thoại giữ tốc độ khung hình mượt mà không bị giật lag
```

### Kịch bản 4: Xử lý xung đột phiên bản OCC 409
```gherkin
Scenario: Admin thực hiện chuyển trạng thái trên task có version cũ
  Given nhiệm vụ #123 trên giao diện đang hiển thị version 1
  And một phiên làm việc khác đã chuyển task sang version 2
  When Admin bấm nút "Xuất bản" và xác nhận
  Then API trả về phản hồi mã HTTP 409 Conflict
  And giao diện hiển thị Modal cảnh báo: "Dữ liệu nhiệm vụ đã bị chỉnh sửa ở một phiên khác"
  And hệ thống tự động tải lại danh sách để nạp phiên bản mới nhất
```

---

## 8. Phạm vi Loại trừ (Out of Scope)

1. **Hệ thống Đăng nhập / OAuth2 / JWT hoàn chỉnh:** Môi trường cục bộ sử dụng Dev Role Switcher để giả lập quyền `ADMIN` qua HTTP Headers (`x-user-role: ADMIN`).
2. **Giao diện Worker nộp bài làm thực tế:** Các màn hình chụp ảnh, tải ảnh lên server, theo dõi tiến độ của Worker thuộc phạm vi tính năng `submit-task-proof-ui`.
3. **Giao diện Admin chấm duyệt chi tiết từng bài nộp:** Chức năng duyệt/từ chối ảnh bằng chứng và giải ngân Xu thuộc phạm vi tính năng `review-submission-ui`.
4. **Cổng nạp/rút tiền thật VNĐ:** Nền tảng không có luồng nạp tiền; luồng quy đổi Xu sang VNĐ và rút về tài khoản ngân hàng thuộc phạm vi tính năng `wallet-withdrawal-ui`.
5. **Cơ chế WebSocket đẩy thời gian thực:** Giao diện sử dụng cơ chế kéo dữ liệu (Polling / Fetch on action / Refresh button), chưa triển khai kết nối WebSocket hai chiều.

---

## 9. Phân tích Chất lượng Đối kháng (Adversarial Quality Pass)

### 9.1 Phân tích sự cố giả định (Pre-mortem Analysis)
- **Sự cố giả định 1: Admin gõ nhầm 10 bước hướng dẫn rồi lỡ tay bấm F5 làm mất sạch dữ liệu.**
  - *Tác động:* Trải nghiệm tồi tệ, mất nhiều thời gian nhập lại từ đầu.
  - *Đối sách đã bổ sung (`E-1` & `REQ-PUI-020`):* Lưu tự động trạng thái form vào `localStorage` sau mỗi ký tự gõ; khi F5 hoặc mở lại trình duyệt, hiển thị Banner hỏi người dùng có muốn khôi phục lại bản nháp không.
- **Sự cố giả định 2: Tấn công XSS qua trường mô tả hoặc tiêu đề nhiệm vụ.**
  - *Tác động:* Kẻ tấn công hoặc Admin thiếu cẩn trọng paste chuỗi script `<script>alert(1)</script>` hoặc `<img src=x onerror=...>` làm thực thi mã độc trên trình duyệt.
  - *Đối sách đã bổ sung (`E-3` & `REQ-PUI-022`):* Nghiêm cấm gán chuỗi thô bằng `innerHTML`; toàn bộ việc kết xuất ra DOM của Bảng và Mobile Preview bắt buộc thông qua hàm mã hóa ký tự HTML hoặc thuộc tính an toàn `textContent`.
- **Sự cố giả định 3: Giao diện gửi request cập nhật đè lên trạng thái task đã bị đóng ở tab khác.**
  - *Tác động:* Bất nhất dữ liệu, vi phạm nguyên tắc vòng đời nhiệm vụ.
  - *Đối sách đã bổ sung (`E-2`, `REQ-PUI-009`):* Mọi thao tác cập nhật đều bắt buộc đính kèm trường `version` hiện tại của task; bắt lỗi HTTP 409 Conflict và nạp lại dữ liệu ngay lập tức.

### 9.2 Danh sách kiểm tra luồng nghiệp vụ (Domain Walkthrough)
- [x] Luồng nạp dữ liệu Dashboard và phân trang/lọc tìm kiếm hoạt động độc lập, không block UI.
- [x] Toàn bộ các chuyển đổi trạng thái trên UI tuân thủ 100% Ma trận chuyển trạng thái của backend (`DRAFT -> ACTIVE`, `ACTIVE <-> PAUSED`, `ACTIVE/PAUSED -> CLOSED`).
- [x] Bộ tính toán Xu xử lý an toàn kiểu số học JavaScript, ngăn ngừa triệt để giá trị âm, số thập phân lẻ, hoặc tràn số an toàn (`Number.MAX_SAFE_INTEGER`).
- [x] Khung Mobile Preview mô phỏng trung thực giao diện điện thoại, các liên kết ngoài đều có thuộc tính bảo mật `rel="noopener noreferrer" target="_blank"`.

---

## 10. Khóa Tính năng (Feature Lock)

- **Locked Scope:** Giao diện web quản trị nhiệm vụ Jobzz (Single Page Application) phục vụ tĩnh trực tiếp từ Fastify backend (`http://localhost:3000` / `/admin`), bao gồm:
  - Dashboard 4 chỉ số thống kê tổng hợp.
  - Bảng quản trị nhiệm vụ với bộ lọc trạng thái, tìm kiếm nhanh và các nút chuyển trạng thái an toàn.
  - Form tạo nhiệm vụ phản hồi thời gian thực với bộ tính tổng Xu, kiểm tra an ninh URL HTTPS, dynamic steps & proofs.
  - Khung giả lập màn hình di động xem trước cho Worker (Live Mobile Preview Simulator).
  - Tự động lưu/khôi phục nháp qua `localStorage` và xử lý lỗi OCC 409 Conflict.
- **Deferred Work:**
  - Hệ thống Authentication/OAuth2 thực tế (thay thế bằng Dev Role Switcher).
  - Giao diện Worker nộp bài làm thực tế (`submit-task-proof-ui`).
  - Giao diện duyệt bài nộp (`review-submission-ui`).
  - Kết nối WebSocket đẩy dữ liệu thời gian thực.
- **Change Path:** `/sdd-update --feature=post-job-ui --artifact=spec --bump=<patch|minor|major> --reason="..."`
- **Lock Boundary:** Chỉ khóa phạm vi đặc tả kỹ thuật của tính năng `post-job-ui`; không làm ảnh hưởng đến các tính năng khác trong hệ thống.

---

## 11. Nhật ký thay đổi (Changelog)

### v1.0.0 (2026-11-19)
- Khởi tạo tài liệu đặc tả kỹ thuật hoàn chỉnh cho tính năng `post-job-ui`.
- Bổ sung 23 yêu cầu chức năng theo chuẩn EARS (REQ-PUI-001 đến REQ-PUI-023) với các cặp Unwanted Error Handling tương ứng.
- Bổ sung 8 tiêu chí phi chức năng NFR đo lường được về hiệu năng, an ninh SEC-01 và tính tin cậy.
- Xác lập mô hình dữ liệu UI State Model, Error Handling Contract, và các kịch bản BDD Acceptance Criteria.
- Hoàn tất phân tích đối kháng Pre-mortem và thiết lập Feature Lock.

---

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: `.sdd/features/post-job-ui/SPEC.md` — Đặc tả kỹ thuật chi tiết giao diện web quản trị nhiệm vụ Jobzz và Mobile Preview
- Recommendation: Phê duyệt tài liệu đặc tả kỹ thuật SPEC.md (Version 1.0.0) với trạng thái `APPROVED & LOCKED`. Tài liệu đã hoàn thành đầy đủ 8 thành phần bắt buộc, 23 yêu cầu EARS, 8 tiêu chí NFR định lượng, phân tích đối kháng Pre-mortem, và kế thừa 100% các giả định Clarification-First đã được Human Reviewer xác nhận.
- Evidence: Đã tạo tệp `.sdd/features/post-job-ui/SPEC.md`; bao phủ trọn vẹn các yêu cầu nghiệp vụ từ `CONTEXT.md`; 100% các cặp Happy Path đều có Unwanted Error Handling; tuân thủ nghiêm ngặt nguyên tắc `SEC-01` và `ARCH-01`.
- Risks and assumptions: Lựa chọn SPA với Vanilla JS/Tailwind CDN giúp triển khai cực nhanh, không cần thêm build pipeline phức tạp; toàn bộ các ràng buộc nghiệp vụ phía client đều có backend tương ứng bảo vệ hai lớp.
- Alternatives considered: Cân nhắc sử dụng template engine phía server (như EJS/Pug), nhưng bị loại bỏ vì không đáp ứng được yêu cầu phản hồi tức thời của Reactive Calculator và Live Mobile Preview.
- Required human decision: Phê duyệt và Khóa đặc tả kỹ thuật (Lock Spec) cho tính năng `post-job-ui` để mở khóa cho Pha 2 SDD (`/sdd-plan --feature=post-job-ui`).

## Human Final Review
- Status: APPROVED
- Decision: Duyệt và khóa SPEC.md post-job-ui v1.0.0
- Reviewer: Admin
- Reviewed at: 2026-11-19T19:59:40+07:00
- Follow-up: /sdd-plan --feature=post-job-ui 

