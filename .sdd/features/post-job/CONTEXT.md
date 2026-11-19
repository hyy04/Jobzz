# Ngữ cảnh tính năng: Đăng việc / Nhiệm vụ Freelance tự do (post-job)

# Version: 1.4.0
# Status: APPROVED
# Feature Slug: post-job
# Owner: Admin / Platform Owner (@admin)
# Mô hình: Nhiệm vụ tự do phát hành bởi Admin trả thưởng bằng Xu (Coins)

---

## 1. Intent Packet

- **WHAT:** Quản trị viên (Admin - Chủ sở hữu nền tảng Jobzz) tạo, cấu hình, xuất bản và quản lý các nhiệm vụ tự do trực tuyến (Freelance Micro-tasks / Bounty Jobs). Mỗi nhiệm vụ bao gồm: tiêu đề, thể loại, số lượng người cần tuyển (`quota`), mức thưởng bằng Xu cho mỗi lượt hoàn thành hợp lệ (`reward_coins`), tổng ngân sách Xu (`total_reward_coins`), hướng dẫn chi tiết từng bước thực hiện (`steps`), danh sách yêu cầu nộp bằng chứng đối soát (`proof_requirements` gồm ảnh chụp màn hình hoặc văn bản/báo cáo), thời hạn làm bài và cơ chế nghiệm thu.
- **WHY:** 
  1. *Kiểm soát tài chính & Chống gian lận:* Toàn bộ Xu trong hệ thống do Admin phát hành dựa trên ngân sách chiến dịch thực tế từ các đối tác ngoài. Hệ thống **tuyệt đối không cho phép người dùng tự do tạo việc** nhằm ngăn chặn rủi ro rửa tiền, gian lận tài chính hoặc tạo task lừa đảo.
  2. *Bảo vệ an toàn thông tin & Chống Phishing (SEC-01):* Kiểm soát chặt chẽ các liên kết đính kèm trong nhiệm vụ, đảm bảo 100% đường dẫn an toàn qua giao thức HTTPS, ngăn chặn mã độc, liên kết lừa đảo và tấn công XSS; lưu vết toàn bộ hoạt động của Admin qua Audit Log.
  3. *Bảo vệ quyền lợi Worker & Ranh giới kiến trúc Clean Architecture (ARCH-01):* Ngăn ngừa giảm quota dưới số lượng đang làm dở bằng cách kết nối qua `TaskProgressPort`; bảo vệ thù lao và công sức của người làm.
- **Definition of Done:**
  1. **Phân quyền tuyệt đối:** Chỉ tài khoản có vai trò `ADMIN` mới có quyền tạo và chỉnh sửa nhiệm vụ. Người dùng thông thường chỉ có vai trò `WORKER` (chỉ làm nhiệm vụ, không thể tạo việc).
  2. **Quy tắc chống tự gian lận (Anti-Self-Dealing):** Hệ thống cấm tuyệt đối tài khoản tạo việc (Admin) tự nhận slot hoặc tự nộp bằng chứng cho chính nhiệm vụ mình tạo ra (`worker_id != admin_id / creator_id`).
  3. **Ràng buộc giới hạn trần (Bounds & Anti-overflow):**
     - `reward_coins`: Tối thiểu `1 Xu`, tối đa `500,000 Xu` / lượt (số nguyên dương).
     - `quota`: Tối thiểu `1 lượt`, tối đa `10,000 lượt` (số nguyên dương).
     - `total_reward_coins` = `quota * reward_coins`: Bắt buộc `<= 5,000,000,000 Xu` (5 tỷ Xu), đảm bảo an toàn tuyệt đối, không gây tràn số (`Number.MAX_SAFE_INTEGER`).
  4. **Ràng buộc an ninh URL & Chống Phishing / XSS (`SEC-01`):**
     - Mọi `target_url` trong `steps` bắt buộc phải sử dụng giao thức bảo mật `https://`. Tuyệt đối chặn `http://`, `javascript:`, `data:` hoặc các URI scheme nguy hiểm.
     - Toàn bộ nội dung văn bản trong `steps` và `description` phải được sanitize để chống XSS.
  5. **Nhật ký kiểm toán bất biến (Audit Trail):**
     - Bắt buộc ghi Audit Log cho mọi hành động: Chuyển đổi trạng thái (`STATUS_CHANGED`: từ trạng thái nào sang trạng thái nào) và Chỉnh sửa nội dung/URL (`TASK_UPDATED`: lưu lại giá trị cũ và giá trị mới, kèm timestamp và `admin_id`).
  6. **Cổng kiến trúc Application Port (`ARCH-01`):**
     - Use Case cập nhật quota bắt buộc gọi qua `TaskProgressPort` với phương thức `getProgress(taskId): Promise<{ approved_count: number, in_progress_count: number }>` để kiểm tra điều kiện an toàn:
       $$\text{new\_quota} \ge \text{approved\_count} + \text{in\_progress\_count}$$
  7. **Ma trận trạng thái chuẩn (State Transition Matrix):**
     - Thực thi đúng các chuyển trạng thái: `DRAFT -> ACTIVE`, `ACTIVE <-> PAUSED`, `ACTIVE/PAUSED -> CLOSED`, `ACTIVE -> COMPLETED`, và `COMPLETED -> ACTIVE` (chỉ khi tăng `quota`).
  8. **Quy tắc chỉnh sửa khi `ACTIVE`:** Cho phép sửa `title`, `description`, URL an toàn của `steps`. Cấm tuyệt đối: giảm `reward_coins`, thêm/sửa đổi làm tăng độ khó của `proof_requirements`, hoặc giảm `quota` thấp hơn tổng số lượt đã duyệt + đang giữ slot.
  9. **Chính sách nội dung cấm:** Chặn và cấm mọi nhiệm vụ vi phạm pháp luật (mã độc, lừa đảo, cờ bạc, nội dung khiêu dâm, vi phạm bản quyền, vi phạm điều khoản nền tảng bên thứ ba).
  10. **Kiến trúc:** Tuân thủ Clean Architecture core-only, hoàn toàn độc lập công nghệ (technology-neutral).
- **Boundaries (Phạm vi bao gồm):**
  - Quản lý vòng đời bài đăng nhiệm vụ từ phía Admin: tạo mới, lưu nháp, xuất bản, tạm dừng, mở lại, đóng vĩnh viễn và mở rộng quota khi hoàn thành.
  - Kiểm tra an ninh URL (HTTPS-only) và sanitize nội dung.
  - Kiểm tra tính hợp lệ của mọi trường dữ liệu và ràng buộc giới hạn trần.
  - Ghi Audit Log cho các thay đổi quan trọng của nhiệm vụ.
  - Tích hợp `TaskProgressPort` để xác thực tiến độ thực tế khi thay đổi quota.
  - Phân quyền nghiêm ngặt theo vai trò hệ thống (`ADMIN` role check).
- **Exclusions (Phạm vi loại trừ / Hoãn lại sang feature khác):**
  - Luồng Worker nhận slot và tải ảnh/văn bản nộp bằng chứng (thuộc feature `submit-task-proof`).
  - Luồng chấm duyệt bằng chứng và cộng Xu vào ví Worker (thuộc feature `review-submission`).
  - Luồng đổi Xu sang tiền VNĐ và rút về tài khoản ngân hàng (thuộc feature `wallet-withdrawal`).
  - Quản lý hợp đồng / giải ngân ngân sách thực tế với các đối tác ngoài (xử lý ở kênh quản trị tài chính ngoại vi).
- **Decision owner:** Admin (Platform Owner & Tech Lead).

---

## 2. Mô hình kinh tế & Phân quyền tạo việc

- **Mô hình vận hành tập trung (Admin-Curated Task Marketplace):**
  - Nền tảng Jobzz hoạt động theo cơ chế quản trị tập trung: **Chỉ Admin mới có thẩm quyền tạo và phát hành nhiệm vụ**.
  - **Nguồn Xu:** Nền tảng hợp tác với các đối tác ngoài (nhãn hàng, nhà phát triển app, agency quảng cáo...) để nhận chiến dịch quảng bá. Admin cấu hình nhiệm vụ và phát hành lượng Xu thưởng tương ứng với ngân sách đối tác chi trả.
  - **Bảo mật & Phòng chống rửa tiền:** Người dùng tự do (Worker) không được phép tạo việc, không thể tự ý chuyển tiền hay nạp tiền vào hệ thống để mua/bán Xu. Điều này loại bỏ hoàn toàn các rủi ro gian lận tài chính, rửa tiền hay tạo nhiệm vụ ảo để trục lợi.
- **Nguyên tắc phân định vai trò (Role Separation):**
  - `ADMIN`: Tạo task, cấu hình quota, reward_coins, duyệt bằng chứng, quản lý vòng đời task.
  - `WORKER`: Xem danh sách task, nhận task, làm theo hướng dẫn, nộp bằng chứng, nhận Xu và đổi Xu rút tiền.
  - **Chống tự gian lận (Anti-Self-Dealing):** Admin tạo nhiệm vụ tuyệt đối không thể đóng vai trò Worker trên chính nhiệm vụ đó (`worker_id != creator_id`).

---

## 3. Thuật ngữ nghiệp vụ (Domain Glossary)

| Thuật ngữ | Định nghĩa |
| :--- | :--- |
| **Freelance Task / Bounty Job** | Nhiệm vụ tự do do Admin tạo với ngân sách Xu và chỉ tiêu xác định. |
| **Admin / Creator** | Tài khoản quản trị viên duy nhất có quyền tạo và chỉnh sửa nhiệm vụ. |
| **Worker** | Người dùng làm nhiệm vụ, nộp bằng chứng để nhận Xu. |
| **reward_coins** | Số Xu thưởng cho mỗi lượt hoàn thành hợp lệ (1 - 500,000 Xu). |
| **quota** | Tổng số lượt duyệt thành công tối đa của nhiệm vụ (1 - 10,000 lượt). |
| **total_reward_coins** | Tổng ngân sách Xu của nhiệm vụ (`quota * reward_coins` <= 5,000,000,000 Xu). |
| **TaskProgressPort** | Application Port cung cấp tiến độ thực tế (`approved_count`, `in_progress_count`) của nhiệm vụ từ hệ thống submission. |
| **Audit Log** | Bản ghi nhật ký kiểm toán bất biến theo dõi các thay đổi trạng thái và nội dung nhiệm vụ do Admin thực hiện. |
| **Secure URL** | Đường dẫn web bắt buộc sử dụng giao thức HTTPS được mã hóa an toàn, loại trừ mọi URI nguy hiểm (`http://`, `javascript:`, `data:`). |
| **Approved Count** | Số lượt bài nộp đã được duyệt thành công và chi trả Xu. |
| **In-Progress Count** | Số slot đang được Worker giữ chỗ để làm bài trong thời hạn cho phép. |
| **Remaining Quota** | Số suất còn trống: `quota - (Approved Count + In-Progress Count)`. |
| **Prohibited Content** | Nội dung vi phạm chính sách pháp luật và điều khoản nền tảng. |

---

## 4. Thực thể nghiệp vụ & Quy tắc chi tiết (Entities & Business Rules)

### 4.1 Thực thể cốt lõi: `FreelanceTask` (Job)
- **Định danh:** `id` (UUID).
- **Người tạo:** `creator_id` (UUID - bắt buộc thuộc tài khoản có vai trò `ADMIN`).
- **Thông tin mô tả:**
  - `title`: Tiêu đề nhiệm vụ (10 - 150 ký tự).
  - `category`: Danh mục nhiệm vụ (`APP_INSTALL`, `ACCOUNT_REGISTRATION`, `SOCIAL_INTERACTION`, `REVIEW_RATING`, `SURVEY`, `CONTENT_WRITING`, `OTHER`).
  - `description`: Mô tả chi tiết và yêu cầu đặc thù (tối thiểu 30 ký tự, đã sanitize).
- **Thông số ngân sách & chỉ tiêu (Bounds & Anti-overflow):**
  - `quota`: Số lượt cần tuyển (số nguyên dương: `1 <= quota <= 10,000`).
  - `reward_coins`: Mức thưởng Xu cho 1 lượt (số nguyên dương: `1 <= reward_coins <= 500,000`).
  - `total_reward_coins`: `quota * reward_coins` (bắt buộc `<= 5,000,000,000`).
- **Quy trình thực hiện (`steps`):**
  - Danh sách các bước `StepInstruction` (`step_number`, `instruction` đã sanitize, `target_url` nếu có - bắt buộc HTTPS).
- **Quy chuẩn bằng chứng (`proof_requirements`):**
  - Danh sách `ProofRequirement` (1 đến 5 yêu cầu, tối đa 3 ảnh chụp màn hình).
- **Cấu hình thời gian & Nghiệm thu:**
  - `execution_time_minutes`: Thời gian tối đa giữ slot (15 - 1440 phút, mặc định 60 phút).
  - `auto_approval_days`: Thời gian tự động duyệt bài nếu quá hạn (1 - 7 ngày, mặc định 3 ngày).
- **Trạng thái:**
  - `status`: `DRAFT` | `ACTIVE` | `PAUSED` | `COMPLETED` | `CLOSED`.

---

### 4.2 Ràng buộc giới hạn trần (Bounds & Anti-overflow Rules)

Hệ thống đặt các ngưỡng an toàn số học nghiêm ngặt để đảm bảo an toàn bộ nhớ và ngăn ngừa tấn công tràn số:

| Trường dữ liệu | Giá trị tối thiểu | Giá trị tối đa | Kiểu dữ liệu | Ý nghĩa kiểm soát |
| :--- | :--- | :--- | :--- | :--- |
| `reward_coins` | `1 Xu` | `500,000 Xu` | Số nguyên dương (`Integer`) | Tránh phát hành vượt mức ngân sách quy định của 1 task. |
| `quota` | `1 lượt` | `10,000 lượt` | Số nguyên dương (`Integer`) | Giới hạn dung lượng quản lý slot của 1 chiến dịch. |
| `total_reward_coins` | `1 Xu` | `5,000,000,000 Xu` (5 tỷ Xu) | Số nguyên dương (`Integer`) | Đảm bảo nằm an toàn trong giới hạn an toàn `Number.MAX_SAFE_INTEGER` (9.007e15), không bao giờ tràn số. |

---

### 4.3 Bảng ma trận chuyển trạng thái (State Transition Matrix)

| Trạng thái hiện tại | Thao tác kích hoạt | Trạng thái đích | Điều kiện & Hành vi hệ thống |
| :--- | :--- | :--- | :--- |
| `DRAFT` | Admin xuất bản (`Publish`) | `ACTIVE` | Toàn bộ trường bắt buộc (title, quota, reward, steps, proofs) hợp lệ; `total_reward_coins <= 5B Xu`. Ghi Audit Log. |
| `ACTIVE` | Admin tạm dừng (`Pause`) | `PAUSED` | Tạm dừng hiển thị nhận mới. Các slot đang giữ trước đó vẫn được phép nộp bài trong thời hạn `execution_time_minutes`. Ghi Audit Log. |
| `PAUSED` | Admin mở lại (`Resume`) | `ACTIVE` | Mở lại danh sách cho worker nhận slot tiếp tục (nếu còn quota). Ghi Audit Log. |
| `ACTIVE` | Hết quota hợp lệ | `COMPLETED` | Khi `Approved Count >= quota`. Nhiệm vụ tự động chuyển sang `COMPLETED`, không nhận thêm worker. Ghi Audit Log. |
| `COMPLETED` | Admin tăng quota (`Expand`) | `ACTIVE` | **Chỉ cho phép khi Admin nâng `quota` mới > `quota` cũ.** Task tự động kích hoạt lại sang `ACTIVE`. Ghi Audit Log. |
| `ACTIVE` / `PAUSED` | Admin đóng việc (`Close`) | `CLOSED` | Đóng vĩnh viễn nhiệm vụ. Các slot đang làm dang dở có tối đa **24 giờ** để hoàn tất nộp bài; mọi slot chưa nhận bị hủy bỏ ngay lập tức. Sau 24h, toàn bộ bài nộp chưa gửi bị hủy. Ghi Audit Log. |
| `CLOSED` | Bất kỳ | *Không cho phép* | `CLOSED` là trạng thái kết thúc (Terminal State), không thể tái kích hoạt. |

---

### 4.4 Quy tắc chỉnh sửa khi nhiệm vụ đang `ACTIVE` (Mutability Rules)

Để bảo vệ quyền lợi và niềm tin của Worker khi tham gia làm nhiệm vụ:

1. **Các trường ĐƯỢC PHÉP chỉnh sửa khi `ACTIVE`:**
   - `title`: Sửa đổi để diễn đạt rõ ràng hơn.
   - `description`: Bổ sung chú thích, lưu ý cách làm (phải được sanitize chống XSS).
   - `target_url` trong `steps`: Cập nhật đường link đích nếu link cũ bị đổi tên miền (bắt buộc bắt đầu bằng `https://`).
   - `quota`: **Chỉ được phép TĂNG** (`quota_new > quota_current`), tuyệt đối không được giảm dưới ngưỡng an toàn lấy từ `TaskProgressPort`:
     $$\text{quota\_new} \ge \text{approved\_count} + \text{in\_progress\_count}$$
2. **Các trường TUYỆT ĐỐI CẤM chỉnh sửa khi `ACTIVE`:**
   - **Cấm giảm `reward_coins`:** Mức Xu thưởng đã công bố là cam kết danh dự với worker; không được giảm khi đang chạy.
   - **Cấm thêm hoặc tăng độ khó của `proof_requirements`:** Không được bổ sung thêm yêu cầu bằng chứng mới hoặc đổi bằng chứng dễ thành khó, tránh tình trạng worker làm xong nhưng không có bằng chứng để nộp.

---

### 4.5 Ràng buộc an ninh URL & Chống Phishing / XSS (SEC-01)

1. **Giao thức an toàn bắt buộc (HTTPS-Only):**
   - Mọi `target_url` được cấu hình trong các bước hướng dẫn (`steps`) bắt buộc phải có URL Scheme là `https://`.
   - Hệ thống từ chối và báo lỗi xác thực nếu URL chứa:
     - `http://` (không mã hóa, rủi ro tấn công Man-in-the-Middle).
     - `javascript:` (nguy cơ tấn công XSS trực tiếp).
     - `data:` (nguy cơ nhúng payload lừa đảo hoặc script ẩn).
     - `file:`, `vbscript:`, hoặc URL không hợp lệ.
2. **Khử nhiễm nội dung (XSS Sanitization):**
   - Toàn bộ nội dung văn bản trong `title`, `description`, và `instruction` của các bước phải được sanitize tự động tại ranh giới domain/interface trước khi lưu trữ hoặc hiển thị, loại bỏ toàn bộ thẻ script và thuộc tính thực thi sự kiện độc hại (`onload`, `onerror`, v.v.).

---

### 4.6 Nhật ký kiểm toán bất biến (Audit Trail)

Mọi thay đổi nhạy cảm trên nhiệm vụ đều phải lưu vết bền vững:

1. **Sự kiện thay đổi trạng thái (`STATUS_CHANGED`):**
   - Thuộc tính ghi vết: `task_id`, `admin_id`, `timestamp` (UTC), `previous_status`, `new_status`, `reason` (nếu có).
2. **Sự kiện cập nhật nội dung (`TASK_UPDATED`):**
   - Thuộc tính ghi vết: `task_id`, `admin_id`, `timestamp` (UTC), `field_name`, `old_value`, `new_value`.
   - Áp dụng bắt buộc khi Admin sửa `title`, `description`, `target_url`, hoặc `quota`.
3. **Tính bất biến (Append-Only):**
   - Nhật ký kiểm toán là dữ liệu chỉ ghi thêm (append-only), không cho phép chỉnh sửa hoặc xóa.

---

### 4.7 Chính sách nội dung cấm (Prohibited Content Policy)

Nhiệm vụ bị nghiêm cấm hoàn toàn nếu chứa bất kỳ yếu tố nào sau đây:
1. **Lừa đảo & Tài chính bất hợp pháp:** Yêu cầu worker nạp tiền, tham gia sàn giao dịch tiền ảo không phép, huy động vốn đa cấp, cho vay nặng lãi, gửi mã OTP ngân hàng.
2. **Mã độc & Bảo mật:** Hướng dẫn tải tệp thực thi độc hại (.exe, .apk không rõ nguồn gốc), cài đặt phần mềm gián điệp, đào trộm dữ liệu cá nhân.
3. **Cờ bạc & Cá cược:** Nhiệm vụ liên quan đến nhà cái, game bài đổi thưởng, cá độ thể thao.
4. **Khiêu dâm & Trụy trụy:** Nhiệm vụ liên quan đến văn hóa phẩm đồi trụy, vi phạm thuần phong mỹ tục.
5. **Vi phạm điều khoản bên thứ ba:** Xúc phạm danh dự người khác, tấn công mạng xã hội (DDoS, spam report hàng loạt vô căn cứ).

---

### 4.8 Quy tắc chống tự gian lận (Anti-Self-Dealing)

- Hệ thống kiểm tra ràng buộc logic: Khi Worker bấm nhận slot hoặc nộp bằng chứng:
  $$\text{worker\_id} \ne \text{creator\_id}$$
- Admin không thể tự nộp bài và tự duyệt thưởng cho nhiệm vụ do chính mình tạo ra nhằm bảo toàn tính toàn vẹn và minh bạch của dòng Xu.

---

## 5. Ràng buộc hệ thống & Kiến trúc (Constraints)

- **Clean Architecture Boundaries (`ARCH-01`):**
  - **Domain Layer (`src/domain/`):**
    - Thực thể `FreelanceTask`, các Value Objects `Quota`, `RewardCoins`, `StepInstruction`, `ProofRequirement`, `TaskStatus`, `SecureUrl`.
    - `SecureUrl` đảm bảo URL hợp lệ và bắt buộc bắt đầu bằng `https://`.
    - Logic tính toán bounds (`Number.MAX_SAFE_INTEGER`), anti-self-dealing rule thuộc Domain thuần túy.
  - **Use Case Layer (`src/usecase/`):**
    - Các Application Ports:
      - `TaskRepositoryPort`: Lưu trữ và truy xuất `FreelanceTask`.
      - `TaskProgressPort`: Lấy tiến độ làm việc thực tế:
        ```typescript
        export interface TaskProgressPort {
          getProgress(taskId: string): Promise<{ approved_count: number; in_progress_count: number }>;
        }
        ```
      - `TaskAuditLogPort`: Ghi nhật ký kiểm toán bất biến:
        ```typescript
        export interface TaskAuditLogPort {
          recordStatusChange(taskId: string, adminId: string, from: TaskStatus, to: TaskStatus): Promise<void>;
          recordUpdate(taskId: string, adminId: string, changes: Array<{ field: string; oldValue: any; newValue: any }>): Promise<void>;
        }
        ```
    - Các Use Cases:
      - `CreateFreelanceTaskUseCase`: Kiểm tra quyền `ADMIN`, kiểm tra bounds, HTTPS URL, tạo nhiệm vụ và ghi Audit Log.
      - `UpdateFreelanceTaskUseCase`: Kiểm tra mutability; khi cập nhật quota, bắt buộc gọi `TaskProgressPort.getProgress(taskId)` để kiểm tra điều kiện:
        $$\text{new\_quota} \ge \text{approved\_count} + \text{in\_progress\_count}$$
        Ghi lại Audit Log thay đổi.
      - `ChangeTaskStatusUseCase`: Thực thi Ma trận chuyển trạng thái và ghi Audit Log.
  - **Interface Layer (`src/interface/`):**
    - Controller xác thực vai trò Admin qua Token/Session context trước khi gọi Use Case (`SEC-02`).
  - **Infrastructure Layer (`src/infra/`):**
    - Adapter triển khai `TaskRepositoryPort`, `TaskProgressPort`, và `TaskAuditLogPort`.
- **Bảo mật (`SEC-01` & `SEC-02`):**
  - URL HTTPS-only, sanitization XSS, phân quyền vai trò `ADMIN`.
- **Bảo vệ dữ liệu (`DATA-01`):**
  - Không xóa cứng nhiệm vụ khi đã có dữ liệu làm bài; chỉ chuyển sang `CLOSED`.

---

## 6. Methodology Profile

- **Depth:** `DETAILED`
- **Rationale:** Mô hình kinh tế quản trị tập trung với các quy tắc ma trận trạng thái chặt chẽ, ràng buộc số học chống tràn số, yêu cầu an ninh URL HTTPS-only, cổng tiến độ nhiệm vụ và nhật ký kiểm toán bất biến.
- **Risk posture:** `elevated`
- **High-risk review route:** N/A (Admin toàn quyền quản trị, không có giao dịch tài chính nạp tiền trực tiếp).
- **Unresolved-decision owner:** Admin (Platform Owner & Tech Lead).

---

## 7. Các câu hỏi mở & Phân định (Material Questions & Disposition)

| STT | Vấn đề phản biện & Kiến trúc | Phân định (Disposition) | Giải pháp kỹ thuật đã chốt |
| :--- | :--- | :--- | :--- |
| 1 | Ai có quyền tạo nhiệm vụ và nguồn Xu từ đâu? | `resolved` | **Chỉ Admin mới có quyền tạo nhiệm vụ.** Xu do Admin phát hành từ ngân sách chiến dịch đối tác ngoài; cấm người dùng tự do tạo việc để chặn rửa tiền/lừa đảo. |
| 2 | Ràng buộc chống tràn số và ngưỡng tối đa là bao nhiêu? | `resolved` | `1 <= reward_coins <= 500,000`, `1 <= quota <= 10,000`, tổng `total_reward_coins <= 5,000,000,000 Xu` (an toàn dưới `Number.MAX_SAFE_INTEGER`). |
| 3 | Ma trận trạng thái khi task hết hạn hoặc dừng? | `resolved` | Chốt ma trận 5 trạng thái: `DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CLOSED`. Đóng việc cho phép 24h vét các slot đang làm dở. |
| 4 | Có được sửa nhiệm vụ khi đang ACTIVE không? | `resolved` | Chỉ cho sửa text mô tả, tiêu đề, link HTTPS hướng dẫn và tăng quota. Tuyệt đối cấm giảm Xu, tăng độ khó bằng chứng hoặc giảm quota dưới mức đã làm. |
| 5 | Xử lý nội dung độc hại và gian lận Admin như thế nào? | `resolved` | Áp dụng Chính sách nội dung cấm nghiêm ngặt; kiểm tra `worker_id != creator_id` để ngăn Admin tự nhận slot làm bài của chính mình. |
| 6 | Kiểm soát URL độc hại / Phishing và XSS như thế nào? | `resolved` | **Bắt buộc HTTPS-only:** Mọi `target_url` phải bắt đầu bằng `https://`, chặn `http://`, `javascript:`, `data:`. Sanitize toàn bộ text mô tả và hướng dẫn. |
| 7 | Làm thế nào để theo dõi sự can thiệp của Admin? | `resolved` | Bắt buộc ghi Audit Log bất biến (append-only) cho mọi hành động đổi trạng thái và cập nhật trường dữ liệu kèm `admin_id` và timestamp. |
| 8 | Làm thế nào Use Case xác thực quota an toàn theo Clean Architecture? | `resolved` | Định nghĩa Application Port `TaskProgressPort.getProgress(taskId)`; Use Case gọi qua Port này để kiểm tra `new_quota >= approved_count + in_progress_count`. |

---

## 8. Describe-back Record

- **WHAT understood:** Hệ thống cung cấp Use Case đăng nhiệm vụ Freelance Micro-task do **duy nhất tài khoản ADMIN** khởi tạo và quản lý. Đơn vị trả thưởng là Xu (`reward_coins` từ 1 đến 500,000 Xu), quota từ 1 đến 10,000 lượt, tổng ngân sách không vượt quá 5 tỷ Xu. Mọi URL đính kèm bắt buộc sử dụng giao thức HTTPS, nội dung được sanitize chống XSS; mọi thao tác của Admin đều được ghi nhận qua Audit Log bất biến; việc kiểm tra quota an toàn được phân tách qua Application Port `TaskProgressPort` theo đúng nguyên tắc Clean Architecture.
- **WHY understood:** Bảo vệ tối đa an toàn cho người làm (tránh Phishing qua link không an toàn, tránh bị bùng công sức qua việc giảm quota/xu giữa chừng); đồng thời cung cấp công cụ kiểm soát minh bạch, truy vết trách nhiệm quản trị viên.
- **Definition of Done understood:** Entity `FreelanceTask` kiểm tra đầy đủ các ràng buộc trần số học và URL HTTPS; Value Object `SecureUrl` ngăn chặn URI scheme độc hại; Use Case tích hợp `TaskProgressPort` để đối soát quota và `TaskAuditLogPort` để ghi nhật ký kiểm toán; kiểm thử đơn vị bao phủ 100% các kịch bản an ninh và biên nghiệp vụ.
- **Boundaries and exclusions understood:**
  - *Bao gồm:* Tạo, cập nhật, đổi trạng thái task của Admin; xác thực bounds; kiểm tra an ninh URL HTTPS; ghi Audit Log; gọi `TaskProgressPort` kiểm tra quota.
  - *Loại trừ:* Luồng worker nộp bài (`submit-task-proof`), luồng duyệt bài nộp (`review-submission`), và luồng đổi Xu rút tiền (`wallet-withdrawal`).
- **Assumptions and unknowns:** 100% các câu hỏi phản biện, an ninh và kiến trúc đã được giải quyết (`resolved`), không còn bất kỳ điểm mơ hồ hay giả định chưa được kiểm chứng.
- **Consistency check:** Hoàn toàn nhất quán với `CONSTITUTION.md` (Clean Architecture ARCH-01, SEC-01, SEC-02, DATA-01), `CLAUDE.md`, `.sdd/architecture-profile.md` và tuân thủ nguyên tắc technology-neutral.

---

## 9. Liên kết Architecture Profile (Architecture Profile Alignment)

- **Baseline áp dụng:** TypeScript + Node.js + Clean Architecture core-only baseline.
- **Tech bindings:**
  - Domain Layer: Entity `FreelanceTask`, Value Objects `RewardCoins`, `Quota`, `TaskBounds`, `SecureUrl` sử dụng kiểu dữ liệu số nguyên thuần TypeScript (`number`), kiểm tra chặt chẽ `Number.isSafeInteger()`.
  - Use Case Layer: Giao tiếp qua các Application Ports trừu tượng:
    - `TaskRepositoryPort`
    - `TaskProgressPort`
    - `TaskAuditLogPort`
  - Hoàn toàn độc lập với HTTP framework, ORM hay Database cụ thể cho đến khi được duyệt trong `architecture-profile.md` tại pha `PLAN.md`.

---

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: `.sdd/features/post-job/CONTEXT.md` — Bổ sung yêu cầu bảo mật HTTPS-only, Audit Trail và Application Port `TaskProgressPort`
- Recommendation: Phê duyệt Intent Packet, Describe-back record, Domain Glossary, Business Rules, State Transition Matrix, Anti-overflow bounds, Anti-self-dealing rules, HTTPS-only validation, XSS sanitization, Audit Trail và `TaskProgressPort` cho tính năng `post-job`. Context đã hoàn thiện vững chắc cả về mặt nghiệp vụ, bảo mật (`SEC-01`) và kiến trúc sạch (`ARCH-01`).
- Evidence: Đã cập nhật tệp CONTEXT.md (Version 1.4.0); bổ sung các mục an ninh URL HTTPS, Audit Trail bất biến và định nghĩa Application Port `TaskProgressPort`; 100% câu hỏi mở có disposition `resolved`.
- Risks and assumptions: `TaskProgressPort` là abstract interface ở tầng Usecase; implementation thực tế sẽ kết nối với module quản lý submissions mà không gây coupling trực tiếp giữa hai domain.
- Alternatives considered: Tự truy vấn trực tiếp DB submission từ use case post-job, nhưng bị bác bỏ vì vi phạm nghiêm trọng Clean Architecture ranh giới module.
- Required human decision: Phê duyệt tài liệu CONTEXT.md của tính năng `post-job` để mở khóa cho Pha 1 SDD (`/sdd-spec --feature=post-job`).

## Human Final Review
- Status: APPROVED
- Decision: Duyệt CONTEXT.md post-job v1.4.0 hoàn chỉnh với SEC-01 và TaskProgressPort
- Reviewer: Admin
- Reviewed at: 2026-11-19T13:04:42+07:00
- Follow-up: /sdd-spec --feature=post-job
