# Ngữ cảnh tính năng: Giao diện web quản trị nhiệm vụ Jobzz (post-job-ui)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: post-job-ui
# Owner: Admin / Platform Owner (@admin)
# Mô hình: Giao diện web Single-Page Application quản trị nhiệm vụ Freelance và mô phỏng giao diện Worker

---

## 1. Intent Packet

- **WHAT:** Xây dựng giao diện web quản trị (Web Frontend UI) phục vụ trực tiếp từ Fastify backend cho tính năng quản lý bài đăng nhiệm vụ `post-job`. Giao diện bao gồm 3 phân hệ trải nghiệm cốt lõi:
  1. *Dashboard & Bảng quản trị nhiệm vụ:* Khối thẻ thống kê tổng quan (Stats Cards: tổng số nhiệm vụ, nhiệm vụ đang `ACTIVE`, tổng ngân sách Xu đã phát hành, số lượt hoàn thành); Bảng quản trị hiển thị danh sách nhiệm vụ chi tiết kèm trạng thái nghiệp vụ, phiên bản kiểm soát đồng thời (OCC version), và các nút thao tác chuyển trạng thái nhanh (Publish nháp sang Active, Pause tạm dừng, Resume mở lại, Close đóng việc).
  2. *Form tạo & chỉnh sửa nhiệm vụ tương tác trực tiếp:* Bộ nhập liệu phản hồi theo thời gian thực (reactive UI), tự động tính toán tổng ngân sách Xu (`total_reward_coins = quota * reward_coins`), cảnh báo trực quan tức thì khi vượt ngưỡng an toàn số học (1 - 500,000 Xu/lượt, 1 - 10,000 lượt quota, trần tối đa 5 tỷ Xu); dynamic inputs cho phép thêm, sửa, xóa linh hoạt các bước hướng dẫn (`steps`) với cơ chế kiểm tra an toàn URL tiền tố `https://` (SEC-01) ngay trên client-side; dynamic inputs cho danh sách yêu cầu nộp bằng chứng (`proof_requirements`).
  3. *Trình giả lập di động xem trước cho Worker (Mobile Preview Simulator):* Khung hiển thị mô phỏng điện thoại thông minh (smartphone frame) phản chiếu thời gian thực nội dung bài đăng dưới góc nhìn của Worker (Tiêu đề, huy hiệu Xu thưởng, hướng dẫn từng bước, liên kết đính kèm an toàn, danh sách bằng chứng cần chụp/nộp, và nút giả lập "Nhận việc").
- **WHY:**
  1. *Trực quan hóa & Loại bỏ rào cản kỹ thuật:* Loại bỏ hoàn toàn sự phụ thuộc vào các công cụ dòng lệnh (cURL), Postman hay Swagger khi quản trị viên phát hành công việc, đem lại giao diện đồ họa hiện đại, dễ thao tác.
  2. *Phòng chống sai sót tài chính & Tràn số ngay tại UI:* Bộ tính toán thời gian thực giúp Admin thấy ngay tổng chi phí chiến dịch trước khi lưu bài, ngăn chặn nhầm lẫn số 0 hoặc nhập số liệu vượt trần ngân sách 5 tỷ Xu.
  3. *Tăng cường an toàn thông tin (SEC-01):* Phát hiện và cảnh báo sớm các đường dẫn không an toàn (`http://`, `javascript:`, script lừa đảo) ngay khi Admin nhập liệu trên form, bảo vệ an toàn cho Worker trước khi bài đăng được gửi về backend.
  4. *Đảm bảo trải nghiệm người dùng (UX) cho Worker:* Giúp Quản trị viên kiểm tra trực quan giao diện hiển thị trên màn hình nhỏ di động (font chữ, độ dài hướng dẫn, các bước thao tác) để tinh chỉnh nội dung hấp dẫn và rõ ràng nhất trước khi phát hành.
- **Definition of Done:**
  1. **Truy cập & Tích hợp Fastify:** Giao diện web được phục vụ trực tiếp từ Fastify server trên cổng `http://localhost:3000` (hoặc đường dẫn `/admin`), tải trang nhanh, không phụ thuộc vào các máy chủ dev server ngoài.
  2. **Thống kê Dashboard chính xác:** Hiển thị đúng 4 chỉ số thống kê từ API `/api/v1/tasks`: Tổng số task, Số task đang hoạt động (`ACTIVE`), Tổng số Xu đã phát hành (`total_reward_coins`), và Số lượt bài đã hoàn thành.
  3. **Bảng quản trị & Chuyển trạng thái an toàn:**
     - Hiển thị danh sách task với đầy đủ thông tin: ID rút gọn, Tiêu đề, Danh mục, Quota, Thù lao Xu, Trạng thái (badge màu tương ứng), và Version kiểm soát đồng thời (OCC).
     - Cung cấp các nút bấm chuyển trạng thái chính xác theo Ma trận chuyển trạng thái của `post-job`: `Publish` (DRAFT -> ACTIVE), `Pause` (ACTIVE -> PAUSED), `Resume` (PAUSED -> ACTIVE), `Close` (ACTIVE/PAUSED -> CLOSED).
  4. **Form tạo nhiệm vụ tương tác thông minh (Reactive Form):**
     - Tự động nhân `quota * reward_coins` và hiển thị kết quả ngay khi người dùng thay đổi giá trị trong các ô nhập liệu.
     - Hiển thị cảnh báo trực quan màu đỏ nếu vi phạm: `reward_coins < 1` hoặc `> 500,000 Xu`; `quota < 1` hoặc `> 10,000 lượt`; hoặc `total_reward_coins > 5,000,000,000 Xu`. Vô hiệu hóa nút Submit khi form không hợp lệ.
     - Thêm/bớt động danh sách các bước (`steps`) và yêu cầu bằng chứng (`proof_requirements`).
     - Tự động kiểm tra định dạng `target_url` của từng bước, bắt buộc phải bắt đầu bằng `https://`.
     - Cho phép lưu nháp (`DRAFT`) hoặc xuất bản ngay (`ACTIVE`).
  5. **Màn hình Mobile Preview đồng bộ thời gian thực:**
     - Mô phỏng giao diện điện thoại (iOS / Android container) đặt cạnh form tạo việc.
     - Dữ liệu trên Mobile Preview tự động cập nhật ngay khi gõ trên form (Tiêu đề, Số Xu thưởng, Danh mục, Thời gian làm bài, Các bước kèm link an toàn, Các bằng chứng cần nộp).
     - Nút "Nhận việc ngay" mô phỏng hiển thị tooltip giải thích: "Màn hình mô phỏng góc nhìn của Worker".
  6. **Xử lý phản hồi lỗi trực quan (Feedback & Error Handling):**
     - Hiển thị Toast / Alert thông báo thành công khi tạo task hoặc đổi trạng thái.
     - Bắt và hiển thị lỗi cụ thể từ API backend: 400 (Dữ liệu không hợp lệ), 403 (Không có quyền Admin), 409 (Xung đột phiên bản OCC - hướng dẫn người dùng nhấn Refresh).
  7. **Bảo toàn kiến trúc Clean Architecture:** Toàn bộ mã nguồn giao diện web nằm tại tầng ngoại vi (`src/interface/web/` hoặc `public/`), giao tiếp với backend thông qua REST API `/api/v1/tasks`, không gây coupling hay thay đổi logic nghiệp vụ trong `src/domain/` và `src/usecase/`.
- **Boundaries (Phạm vi bao gồm):**
  - Giao diện web người dùng (Single Page Application) phục vụ quản trị nhiệm vụ `post-job`.
  - Cơ chế Static File Serving tích hợp trong Fastify server.
  - Tích hợp và gọi các REST API endpoints `/api/v1/tasks` (GET danh sách, POST tạo mới, PATCH đổi trạng thái, PUT cập nhật).
  - Validation client-side kiểm tra an toàn số học và URL HTTPS.
  - Live Mobile Preview Simulator dành cho Admin kiểm tra trước bài đăng.
  - Giả lập Admin Header / Role Selector trên UI phục vụ kiểm thử cục bộ.
- **Exclusions (Phạm vi loại trừ):**
  - Hệ thống Authentication phức tạp / OAuth2 / SSO thực tế (môi trường cục bộ sử dụng Role Selector hoặc header giả lập `x-user-role: ADMIN`).
  - Màn hình dành cho Worker thực tế bấm nhận việc và tải ảnh bằng chứng (thuộc feature `submit-task-proof-ui`).
  - Màn hình dành cho Admin chấm duyệt từng bài nộp của Worker (thuộc feature `review-submission-ui`).
  - Cổng nạp/rút tiền thật VNĐ (nền tảng không có luồng nạp tiền; luồng rút Xu thuộc `wallet-withdrawal-ui`).
- **Decision owner:** Admin (Platform Owner & Tech Lead).

---

## 2. Methodology Profile

- **Depth:** `DETAILED`
- **Rationale:** Giao diện web quản trị tương tác trực tiếp với các API tài chính Xu, thực thi các ràng buộc an ninh URL/XSS phía client, quản lý trạng thái đồng thời (OCC) và ảnh hưởng trực tiếp đến trải nghiệm vận hành của nền tảng.
- **Risk posture:** `elevated`
- **High-risk review route:** N/A (Giao diện quản trị nội bộ dành cho Admin, chưa public ra internet, toàn bộ dữ liệu vẫn được kiểm soát an toàn nghiêm ngặt ở tầng Domain backend).
- **Unresolved-decision owner:** Admin (@admin).

---

## 3. Thuật ngữ nghiệp vụ & Thành phần UI (Domain Glossary & UI Components)

| Thuật ngữ / Thành phần | Định nghĩa & Trách nhiệm trên Giao diện |
| :--- | :--- |
| **Admin Web Dashboard** | Giao diện trang chủ quản trị tập hợp thẻ thống kê (Stats Cards), bảng dữ liệu (Task Table) và lối tắt tạo nhiệm vụ mới. |
| **Stats Cards** | Các khối hiển thị số liệu tổng hợp: Tổng số nhiệm vụ, Số nhiệm vụ `ACTIVE`, Tổng ngân sách Xu (`total_reward_coins`), Số lượt hoàn thành. |
| **Task Management Table** | Bảng hiển thị danh sách nhiệm vụ, hỗ trợ hiển thị Badge trạng thái (`DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CLOSED`), OCC version chip, và các nút hành động theo ngữ cảnh. |
| **State Action Buttons** | Nhóm nút bấm thao tác nhanh trên từng hàng: `Xuất bản` (Publish), `Tạm dừng` (Pause), `Mở lại` (Resume), `Đóng việc` (Close). |
| **Reactive Task Form** | Form tạo/sửa nhiệm vụ có khả năng tự động tính toán tổng Xu thời gian thực, xác thực bounds và cảnh báo trực quan trước khi submit. |
| **Dynamic Steps Input** | Khu vực cho phép Admin bấm nút "Thêm bước", xóa bước, điền hướng dẫn và điền đường link kèm kiểm tra tiền tố `https://`. |
| **Dynamic Proofs Input** | Khu vực cấu hình yêu cầu bằng chứng: chọn loại (Ảnh chụp màn hình, Báo cáo văn bản) và mô tả yêu cầu. |
| **Mobile Preview Simulator** | Khung hiển thị mô phỏng màn hình điện thoại di động thông minh (375px - 414px width), phản chiếu trực quan bài đăng dưới góc nhìn của Worker. |
| **Live Sync Engine** | Đoạn script trên client lắng nghe sự kiện `input`/`change` trên Form và kết xuất ngay lập tức sang Mobile Preview. |
| **OCC Conflict Modal/Toast** | Hộp thoại thông báo khi xảy ra lỗi 409 Conflict (dữ liệu bị chỉnh sửa ở phiên làm việc khác), gợi ý nạp lại dữ liệu mới nhất. |
| **Dev Role Selector** | Thanh công cụ nhỏ trên Header cho phép Admin chọn/chuyển đổi danh tính kiểm thử (`ADMIN` / `WORKER`) để kiểm tra quyền truy cập. |

---

## 4. Thực thể giao diện & Quy tắc tương tác (UI Entities & Interaction Rules)

### 4.1 Khối thẻ thống kê (Stats Cards)
- **Tổng số nhiệm vụ (Total Tasks):** Đếm tổng số bài đăng có trong hệ thống.
- **Nhiệm vụ đang hoạt động (Active Tasks):** Đếm các nhiệm vụ có trạng thái `ACTIVE`.
- **Tổng ngân sách Xu (Total Coins Allocated):** Tổng số Xu đã được phân bổ cho các nhiệm vụ (`sum(total_reward_coins)`).
- **Tổng lượt hoàn thành (Total Completions):** Thống kê số lượt nhiệm vụ đã được Worker hoàn tất.

---

### 4.2 Bảng quản trị nhiệm vụ (Task Table)
- **Cột dữ liệu:**
  1. `Mã`: ID rút gọn (ví dụ: `8 ký tự đầu...`) kèm tooltip ID đầy đủ.
  2. `Tiêu đề`: Tiêu đề nhiệm vụ kèm nhãn danh mục (`category`).
  3. `Chỉ tiêu (Quota)`: Số lượng người cần tuyển.
  4. `Thù lao`: Số Xu thưởng cho mỗi lượt (`reward_coins` Xu).
  5. `Tổng ngân sách`: `total_reward_coins` Xu.
  6. `Trạng thái`: Hiển thị Badge màu tương ứng:
     - `DRAFT`: Màu xám/vàng nhạt (Nháp).
     - `ACTIVE`: Màu xanh lá cây (Đang hoạt động).
     - `PAUSED`: Màu vàng cam (Tạm dừng).
     - `COMPLETED`: Màu xanh dương (Đã hoàn thành chỉ tiêu).
     - `CLOSED`: Màu đỏ/xám đậm (Đã đóng vĩnh viễn).
  7. `Phiên bản`: Chip hiển thị OCC version (`v1`, `v2`, ...).
  8. `Hành động`: Các nút bấm theo Ma trận chuyển trạng thái hợp lệ:
     - Khi `DRAFT`: Nút `Xuất bản` (Publish -> ACTIVE).
     - Khi `ACTIVE`: Nút `Tạm dừng` (Pause -> PAUSED) và Nút `Đóng` (Close -> CLOSED).
     - Khi `PAUSED`: Nút `Mở lại` (Resume -> ACTIVE) và Nút `Đóng` (Close -> CLOSED).
     - Khi `COMPLETED`: Nút `Nâng quota` (Mở form cập nhật quota để kích hoạt lại sang ACTIVE).
     - Khi `CLOSED`: Không có nút thao tác (Trạng thái kết thúc).

---

### 4.3 Form tạo nhiệm vụ tương tác trực tiếp (Reactive Form)
- **Tính toán tổng Xu phản hồi tức thì (Real-time Coin Calculator):**
  - Công thức: `total_reward_coins = quota * reward_coins`.
  - Khi người dùng gõ vào ô `quota` hoặc `reward_coins`, ô `Tổng ngân sách Xu` tự động cập nhật ngay lập tức mà không cần bấm nút tính.
- **Quy tắc kiểm tra bounds & Hiển thị cảnh báo trực quan:**
  - Nếu `reward_coins < 1` hoặc `reward_coins > 500,000`: Hiển thị dòng chữ cảnh báo đỏ bên dưới ô nhập: *"Mức thưởng phải từ 1 đến 500,000 Xu"*.
  - Nếu `quota < 1` hoặc `quota > 10,000`: Hiển thị cảnh báo đỏ: *"Số lượng tuyển phải từ 1 đến 10,000 lượt"*.
  - Nếu `total_reward_coins > 5,000,000,000`: Hiển thị thông báo nguy hiểm: *"Tổng ngân sách vượt quá hạn mức tối đa cho phép (5 tỷ Xu)"*.
  - Nút "Tạo nhiệm vụ" sẽ bị khóa (`disabled`) khi bất kỳ quy tắc nào bị vi phạm.
- **Dynamic Steps Builder:**
  - Cho phép bấm "+ Thêm bước hướng dẫn".
  - Mỗi bước gồm: Số thứ tự tự động, Ô nhập nội dung hướng dẫn (bắt buộc), Ô nhập đường link đích (`target_url`, tùy chọn).
  - Kiểm tra an ninh URL (SEC-01): Nếu ô link có dữ liệu nhưng không bắt đầu bằng `https://`, hiển thị viền đỏ và thông báo: *"Đường dẫn bắt buộc phải sử dụng giao thức bảo mật https://"* (chặn `http://`, `javascript:`, v.v.).
  - Cho phép xóa từng bước bằng nút icon thùng rác (duy trì tối thiểu 1 bước).
- **Dynamic Proof Requirements Builder:**
  - Cho phép bấm "+ Thêm yêu cầu bằng chứng".
  - Mỗi yêu cầu gồm: Loại bằng chứng (`SCREENSHOT` - Ảnh chụp màn hình, `TEXT` - Báo cáo văn bản), và Hướng dẫn chi tiết nội dung cần nộp.
  - Giới hạn tối đa 5 yêu cầu bằng chứng, trong đó tối đa 3 ảnh chụp màn hình.

---

### 4.4 Trình giả lập di động cho Worker (Mobile Preview Simulator)
- Được bố trí song song (cột bên phải) hoặc tab chuyển đổi linh hoạt cạnh form tạo việc.
- Giao diện giả lập thiết kế theo chuẩn khung điện thoại di động (iPhone/Android mock):
  - Thanh trạng thái điện thoại (Giờ, Pin, Sóng Wi-Fi).
  - Thanh tiêu đề trang chi tiết nhiệm vụ Jobzz.
  - Khối thông tin nổi bật: Thù lao Xu thưởng (huy hiệu màu vàng rực rỡ), Tiêu đề nhiệm vụ, Thể loại bài đăng, Thời gian làm bài (`execution_time_minutes` phút).
  - Khối hướng dẫn các bước (`steps`): Hiển thị từng bước kèm nút bấm "Mở liên kết" (nếu có URL) mở ra tab mới an toàn với `rel="noopener noreferrer"`.
  - Khối yêu cầu bằng chứng (`proof_requirements`): Hiển thị danh sách các ô tải ảnh / nhập văn bản mà Worker sẽ phải thực hiện.
  - Nút hành động cố định ở đáy màn hình: "Nhận việc ngay" (kèm badge giải thích đây là màn hình xem trước).

---

## 5. Ràng buộc hệ thống & Kiến trúc (Constraints)

- **Clean Architecture Boundaries (`ARCH-01`):**
  - **Vị trí tệp giao diện:** Mã nguồn giao diện tĩnh được đặt tại `public/` hoặc `src/interface/web/`, hoàn toàn tách biệt với logic nghiệp vụ tại `src/domain/` và `src/usecase/`.
  - **Tích hợp Fastify Server:** Sử dụng `@fastify/static` đăng ký route tĩnh phục vụ trang chủ `/` hoặc `/admin`.
  - **Giao tiếp API:** Toàn bộ dữ liệu được tải và gửi thông qua các REST endpoint tiêu chuẩn `/api/v1/tasks`, sử dụng định dạng JSON thuần túy.
- **Bảo mật & Kiểm soát truy cập (`SEC-01`, `SEC-02`):**
  - Giao diện client-side thực thi kiểm tra tiền tố `https://` cho mọi URL hướng dẫn.
  - Text input được encode/escape an toàn khi render sang DOM để ngăn ngừa tấn công XSS.
  - Giả lập vai trò quản trị qua header `x-user-role: ADMIN` phục vụ xác thực tại tầng HTTP Interface của backend.
- **Kiểm soát đồng thời (OCC Protection):**
  - Mọi thao tác cập nhật (đổi trạng thái hoặc sửa nội dung) gửi kèm trường `version` hiện tại của task.
  - Khi backend trả về mã lỗi `409 Conflict`, giao diện bắt lỗi và thông báo thân thiện cho Admin, không làm mất dữ liệu đang soạn thảo.

---

## 6. Các câu hỏi mở & Phân định (Material Questions & Disposition)

| STT | Vấn đề phân tích & Trải nghiệm | Phân định (Disposition) | Giải pháp kỹ thuật đã chốt |
| :--- | :--- | :--- | :--- |
| 1 | Công nghệ xây dựng Frontend là gì để vừa nhẹ, vừa tích hợp mượt với Fastify? | `resolved` | **Single Page Application với HTML5, Tailwind CSS (via CDN) và Vanilla JavaScript hiện đại (ES Modules).** Không cần cài thêm build step nặng nề (như Webpack, Vite hay React monorepo), server Fastify có thể serve trực tiếp cực nhanh trong 1ms. |
| 2 | Fastify phục vụ các tệp giao diện này bằng cơ chế nào? | `resolved` | Sử dụng plugin chuẩn `@fastify/static`, trỏ đến thư mục tĩnh `public/` (hoặc `src/interface/web/public/`), lắng nghe tại route `/` hoặc `/admin`. |
| 3 | Làm thế nào để gửi danh tính Admin khi gọi API từ trình duyệt localhost? | `resolved` | Thanh điều hướng (Navbar) tích hợp **Dev Role Switcher** (cho phép chọn vai trò `ADMIN` hoặc `WORKER`). Mọi lệnh `fetch()` tự động đính kèm header `x-user-role` và `x-user-id` tương thích với middleware backend hiện tại. |
| 4 | Xử lý lỗi va chạm phiên bản OCC (409 Conflict) trên UI như thế nào? | `resolved` | Hiển thị Toast/Hộp thoại cảnh báo: *"Dữ liệu công việc vừa được cập nhật bởi một phiên làm việc khác. Vui lòng bấm 'Làm mới' để nạp phiên bản mới nhất!"* kèm nút bấm Reload danh sách. |
| 5 | Nút "Nhận việc" trong màn hình Mobile Preview có gửi request tạo submission không? | `resolved` | **Không.** Nút "Nhận việc" trong Mobile Preview chỉ mô phỏng trải nghiệm Worker. Khi bấm vào, hiển thị popup tooltip thân thiện: *"Đây là bản xem trước (Worker Preview). Chức năng nhận việc thực tế sẽ hoạt động trong ứng dụng của Worker."* |

---

## 7. Describe-back Record

- **WHAT understood:** Xây dựng một trang web Single Page Application quản trị nhiệm vụ `post-job` tích hợp trực tiếp vào Fastify backend server. Giao diện cung cấp Dashboard thống kê số liệu, Bảng quản trị nhiệm vụ hỗ trợ chuyển đổi trạng thái an toàn theo ma trận nghiệp vụ, Form tạo nhiệm vụ phản hồi thời gian thực tự động tính ngân sách Xu và kiểm tra chặt chẽ các giới hạn bounds (Xu, Quota, trần 5 tỷ Xu, URL HTTPS), cùng với màn hình Mobile Preview mô phỏng chân thực trải nghiệm của Worker.
- **WHY understood:** Loại bỏ sự bất tiện của thao tác cURL/API dòng lệnh, mang lại công cụ quản trị trực quan, tiện lợi, phòng chống sai sót nhập liệu tài chính Xu và đảm bảo bài đăng chuẩn chỉnh, an toàn trước khi công bố cho cộng đồng Worker.
- **Definition of Done understood:** Giao diện chạy mượt mà trên trình duyệt qua `http://localhost:3000`, hiển thị đúng dữ liệu từ `/api/v1/tasks`, tương tác đầy đủ các trạng thái của vòng đời nhiệm vụ, tính toán tổng Xu tự động, kiểm tra an ninh URL HTTPS, mô phỏng Mobile Preview tức thì và xử lý lỗi OCC 409 rõ ràng.
- **Boundaries and exclusions understood:**
  - *Bao gồm:* Dashboard, Bảng quản trị, Form tạo/sửa reactive, Mobile Preview simulator, static serving trên Fastify, kết nối REST API `/api/v1/tasks`.
  - *Loại trừ:* Màn hình Worker nộp bài thực tế, màn hình Admin chấm duyệt bài nộp, luồng nạp/rút tiền thật VNĐ.
- **Assumptions and unknowns:** 100% các câu hỏi phân định đã có trạng thái `resolved`. Công nghệ UI nhẹ, trực tiếp, không phụ thuộc build tooling phức tạp, sẵn sàng triển khai.
- **Consistency check:** Hoàn toàn tương thích và tôn trọng Clean Architecture (`ARCH-01`), các ràng buộc an ninh (`SEC-01`, `SEC-02`), Architecture Profile và các quy tắc nghiệp vụ đã phê duyệt của backend `post-job`.

---

## 8. Liên kết Architecture Profile (Architecture Profile Alignment)

- **Baseline áp dụng:** Node.js + Fastify + Clean Architecture.
- **Tech bindings:**
  - **Interface Layer (Web Serving):** Plugin `@fastify/static` kết nối phục vụ các tệp HTML/CSS/JS tại thư mục tĩnh của dự án.
  - **Client-side Technology:** HTML5 Semantic + Tailwind CSS (CDN) + Vanilla JS ES6+ Modules. Giao tiếp qua Fetch API tiêu chuẩn gọi REST endpoints `/api/v1/tasks`.
  - **Validation Mapping:** Client-side form validation ánh xạ chính xác các schema Zod và Domain Value Objects đã được duyệt trong Architecture Profile của backend (`reward_coins`: 1 - 500,000; `quota`: 1 - 10,000; `total_reward_coins` <= 5 tỷ Xu; URL bắt đầu bằng `https://`).

---

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: `.sdd/features/post-job-ui/CONTEXT.md` — Khởi tạo ngữ cảnh giao diện web quản trị nhiệm vụ Jobzz và Mobile Preview
- Recommendation: Phê duyệt Intent Packet, Describe-back record, Domain Glossary, UI Components, Interaction Rules, Bound checks, HTTPS URL validation, Mobile Preview Simulator, và công nghệ Fastify Static Serving cho tính năng `post-job-ui`. Tài liệu đã làm rõ trọn vẹn yêu cầu nghiệp vụ, ranh giới và trải nghiệm người dùng mà không phá vỡ Clean Architecture core backend.
- Evidence: Đã khởi tạo tệp `d:/Projetc CN/Jobzz/.sdd/features/post-job-ui/CONTEXT.md` (Version 1.0.0); phân định 100% câu hỏi mở sang trạng thái `resolved`; đảm bảo khớp hoàn hảo với backend `post-job` đã ổn định.
- Risks and assumptions: Lựa chọn Single Page Application với HTML5/Tailwind/Vanilla JS giúp ứng dụng chạy ngay lập tức trên Fastify mà không cần cài đặt thêm bundler phức tạp.
- Alternatives considered: Cân nhắc sử dụng React/Next.js hoặc Vue, nhưng bị bác bỏ vì sẽ đòi hỏi cấu hình monorepo, build tools nặng nề và phức tạp hóa không cần thiết một trang quản trị nội bộ tích hợp.
- Required human decision: Phê duyệt tài liệu CONTEXT.md của tính năng `post-job-ui` để mở khóa cho Pha 1 SDD (`/sdd-spec --feature=post-job-ui`).

## Human Final Review
- Status: APPROVED
- Decision: Duyệt CONTEXT.md post-job-ui v1.0.0
- Reviewer: Admin
- Reviewed at: 2026-11-19T19:22:22+07:00
- Follow-up: /sdd-spec --feature=post-job-ui 

