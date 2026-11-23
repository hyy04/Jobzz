# Ngữ cảnh tính năng: Xem danh sách nhiệm vụ và Nhận việc cho Người làm (browse-and-claim-task)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: browse-and-claim-task
# Owner: Worker Experience Team & Architecture Team (@architecture-team)
# Mô hình: Người làm (Worker) khám phá nhiệm vụ khả dụng, xem hướng dẫn chi tiết và giữ chỗ nhận việc (Claim Slot) có thời hạn

---

## 1. Intent Packet

- **WHAT:** Cung cấp hệ thống API và Giao diện Web công khai dành cho Người làm (Worker) trên nền tảng Jobzz, bao gồm:
  1. **Khám phá & Tìm kiếm nhiệm vụ (Browse & Filter):** Xem danh sách các nhiệm vụ freelance vi mô đang hoạt động (`status = ACTIVE`) và còn suất (`remaining_quota > 0`), hỗ trợ lọc linh hoạt theo danh mục công việc (`category`), sắp xếp theo mức Xu thưởng cao nhất (`REWARD_DESC`) hoặc nhiệm vụ mới đăng nhất (`LATEST`).
  2. **Chi tiết nhiệm vụ trực quan (Task Details):** Xem đầy đủ bối cảnh, mô tả, mức thù lao Xu, các bước thực hiện (`steps`) kèm URL và ảnh minh họa, các yêu cầu nộp bằng chứng đối soát (`proof_requirements`), và thời gian tối đa được giữ chỗ làm bài (`execution_time_minutes`).
  3. **Quy trình Nhận việc giữ chỗ (Claim Slot):** Worker bấm "Nhận việc ngay" để tạo một bản ghi giữ chỗ (`TaskClaim`) có trạng thái `IN_PROGRESS` với thời điểm hết hạn đếm ngược `expires_at = now + execution_time_minutes`. Hệ thống bảo đảm tính toàn vẹn:
     - Kiểm tra nghiêm ngặt còn suất trống (`remaining_quota > 0`), ngăn chặn hoàn toàn tranh chấp race condition vượt quota.
     - Quy tắc 1 người - 1 việc: Mỗi Worker chỉ được nhận và giữ chỗ tối đa 1 lượt duy nhất trên 1 nhiệm vụ.
     - Quy tắc chống tự gian lận (Anti-Self-Dealing): Cấm người tạo nhiệm vụ tự nhận việc của chính mình (`worker_id != creator_id`).
     - Tăng số lượng đang giữ chỗ (`in_progress_count`) đồng bộ qua `TaskProgressPort`.

- **WHY:**
  1. *Trải nghiệm người làm minh bạch & công bằng:* Worker thấy rõ công việc, các bước làm, yêu cầu nộp bằng chứng và mức thù lao Xu trước khi nhận việc. Loại bỏ hoàn toàn tình trạng Worker cặm cụi làm xong mới phát hiện nhiệm vụ đã hết suất hoặc bị đóng.
  2. *Cơ chế giữ chỗ an toàn (Slot Reservation):* Khi bấm nhận việc, Worker được cam kết giữ chỗ trong khoảng thời gian nhất định (`execution_time_minutes`) để yên tâm làm theo hướng dẫn mà không lo bị người khác nộp trước chiếm mất quyền lợi.
  3. *Phòng chống gian lận & Trục lợi tài chính:* Ngăn chặn 1 Worker dùng bot nhận nhiều slot ảo trên cùng một nhiệm vụ làm cạn kiệt ngân sách đối tác; cấm Admin tự cày Xu từ nhiệm vụ do chính mình phát hành.
  4. *Kiến trúc Clean Architecture & Quản lý đồng thời (Concurrency Safety):* Kết nối thông suốt qua `TaskProgressPort` với tính năng `post-job`, đảm bảo dữ liệu tiến độ thực tế (`in_progress_count`, `approved_count`) luôn chính xác và không bao giờ vượt trần ngân sách chiến dịch.

- **Definition of Done:**
  1. **API Duyệt danh sách công khai (`GET /api/v1/public/tasks`):**
     - Chỉ trả về các nhiệm vụ `ACTIVE` và có `remaining_quota > 0`.
     - Hỗ trợ lọc theo `category` (`APP_INSTALL`, `SURVEY`, `ACCOUNT_REGISTRATION`, ...).
     - Hỗ trợ sắp xếp theo `sort_by`: `REWARD_DESC` (Xu giảm dần) và `LATEST` (mới nhất).
     - Hỗ trợ phân trang: `page`, `limit` (mặc định 20, tối đa 100).
  2. **API Xem chi tiết nhiệm vụ (`GET /api/v1/public/tasks/:id`):**
     - Trả về thông tin đầy đủ: Tiêu đề, danh mục, thù lao Xu, `remaining_quota`, `execution_time_minutes`, các bước hướng dẫn (kèm URL https:// và hình ảnh minh họa), danh sách bằng chứng cần nộp.
  3. **API Nhận việc giữ chỗ (`POST /api/v1/tasks/:id/claim`):**
     - Yêu cầu xác thực Worker (`x-user-id`, role `WORKER`).
     - Kiểm tra điều kiện:
       - Nhiệm vụ tồn tại và đang ở trạng thái `ACTIVE`.
       - Số suất còn trống `remaining_quota = quota - (approved_count + in_progress_count) > 0`.
       - `worker_id != creator_id` (chống tự gian lận).
       - Worker chưa từng có claim `IN_PROGRESS` hoặc `APPROVED` trên nhiệm vụ này.
     - Tạo bản ghi `TaskClaim` với trạng thái `IN_PROGRESS`, `claimed_at = now`, `expires_at = now + execution_time_minutes`.
     - Tăng `in_progress_count` qua `TaskProgressPort`.
     - Xử lý xung đột đồng thời (Concurrency / Race Condition): nếu 2 Worker cùng tranh 1 suất cuối, chỉ 1 Worker thành công, Worker còn lại nhận lỗi `409 QUOTA_EXHAUSTED`.
  4. **Giao diện Web Người làm (Worker Web Portal):**
     - Tab hoặc trang "Khám Phá Việc Làm": hiển thị lưới/danh sách thẻ việc làm trực quan, badge danh mục, thù lao Xu nổi bật, số suất còn lại, nút lọc danh mục và bộ chọn sắp xếp.
     - Modal hoặc Trang chi tiết nhiệm vụ: hiển thị các bước làm kèm ảnh minh họa to rõ, nút "Nhận việc ngay".
     - Màn hình làm nhiệm vụ sau khi nhận việc: hiển thị đồng hồ đếm ngược thời gian giữ slot (Countdown Timer), cảnh báo thời hạn và khung hướng dẫn thực hiện.
  5. **Bảo mật & Clean Architecture:**
     - Tách biệt rõ ràng Domain Entity (`TaskClaim`), Use Cases (`BrowsePublicTasksUseCase`, `GetPublicTaskDetailsUseCase`, `ClaimTaskSlotUseCase`), Application Ports (`TaskClaimRepositoryPort`, `TaskProgressPort`), và Web/HTTP Adapters.
     - Đạt 100% kiểm thử tự động (Unit, Integration, E2E), không có type error.

- **Boundaries (Phạm vi bao gồm):**
  - Xem danh sách và xem chi tiết nhiệm vụ công khai cho Người làm.
  - Xử lý logic và lưu vết lượt nhận việc giữ chỗ (Claim Slot) của Worker.
  - Quản lý thời gian hết hạn của lượt giữ slot (`expires_at`).
  - Đồng bộ số lượng `in_progress_count` qua `TaskProgressPort`.
  - Giao diện web phía Worker phục vụ duyệt việc và nhận việc trên trình duyệt.

- **Exclusions (Phạm vi loại trừ / Tính năng sau):**
  - Luồng Worker tải ảnh hoặc điền văn bản nộp bằng chứng đối soát (thuộc tính năng `submit-task-proof`).
  - Luồng Admin duyệt bằng chứng, đối soát và trả lời khiếu nại (thuộc tính năng `review-submission`).
  - Daemon nền tự động quét dọn slot hết hạn theo chu kỳ (Cron Cleaner Service - có thể xử lý lazy check khi tính toán quota hoặc tách thành service nền riêng).
  - Luồng cộng Xu vào ví và đổi Xu rút tiền về tài khoản ngân hàng (thuộc tính năng `wallet-withdrawal`).

- **Decision owner:** Architecture Team & Product Owner (@architecture-team).

---

## 2. Vấn đề nghiệp vụ & Người dùng (Problem Statement & User Pains)

### 2.1 Khó khăn thực tế của Người làm (Worker Pains)
1. **Thiếu cơ chế giữ chỗ:** Trong nhiều nền tảng vi mô truyền thống, Worker bỏ ra 30 - 60 phút cài app hoặc làm khảo sát, nhưng khi quay lại nộp bài thì nhiệm vụ đã hết lượt duyệt từ trước, dẫn đến mất trắng công sức và thời gian.
2. **Khó tìm việc phù hợp:** Nhiệm vụ không được phân loại hoặc không thể sắp xếp theo mức thù lao Xu cao hay độ mới, khiến Worker mất nhiều thời gian lướt tìm.
3. **Mô tả khó hiểu, thiếu trực quan:** Các bước làm việc chỉ có chữ thuần túy, không có hình ảnh hướng dẫn khiến Worker thao tác sai, dẫn đến bài nộp bị từ chối.

### 2.2 Mục tiêu nghiệp vụ của Nền tảng (Platform Goals)
1. **Phân phối nhiệm vụ công bằng và hiệu quả:** Tối ưu hóa tỷ lệ lấp đầy (`fill rate`) của các chiến dịch do Admin phát hành.
2. **Khóa slot thời gian thực (Atomic Reservation):** Khi một Worker nhận việc, số suất còn lại phải giảm tức thì để tránh tình trạng nhận quá quota (`over-claim`).
3. **Chống lãng phí slot (Slot Reclaim):** Nếu một Worker nhận việc nhưng sau thời hạn quy định (`execution_time_minutes`) không nộp bài, suất đó phải được giải phóng tự động để nhường cơ hội cho Worker khác.
4. **Bảo vệ tính toàn vẹn hệ thống:** Ngăn chặn tuyệt đối tình trạng tự làm nhiệm vụ của chính mình và hành vi nhận nhiều lần cùng một nhiệm vụ.

---

## 3. Thuật ngữ nghiệp vụ (Domain Glossary)

| Thuật ngữ | Định nghĩa nghiệp vụ |
| :--- | :--- |
| **Worker** | Người dùng lao động tự do, thực hiện nhiệm vụ theo hướng dẫn và nhận Xu thưởng. |
| **Task Claim / Reservation (Lượt nhận việc)** | Bản ghi cam kết giữ chỗ một suất làm việc cho một Worker cụ thể trên một nhiệm vụ cụ thể. |
| **Claim Status** | Trạng thái của lượt nhận việc: `IN_PROGRESS` (đang giữ chỗ), `SUBMITTED` (đã nộp bài), `EXPIRED` (hết hạn giữ chỗ), `CANCELED` (tự hủy), `APPROVED` (được duyệt), `REJECTED` (bị từ chối). |
| **Holding Period / execution_time_minutes** | Khoảng thời gian tối đa (tính bằng phút) mà Worker được độc quyền giữ slot để hoàn thành nhiệm vụ (15 - 1440 phút). |
| **expires_at** | Mốc thời gian tuyệt đối (timestamp có timezone) mà slot giữ chỗ sẽ hết hạn nếu Worker chưa nộp bài: `claimed_at + execution_time_minutes`. |
| **remaining_quota** | Số suất còn trống thực tế mà Worker có thể nhận: $\text{quota} - (\text{approved\_count} + \text{in\_progress\_count})$. |
| **in_progress_count** | Tổng số slot đang được giữ chỗ có trạng thái `IN_PROGRESS` và chưa hết hạn (`expires_at > now`). |
| **approved_count** | Tổng số lượt bài nộp đã được duyệt thành công và chi trả Xu. |
| **One-Per-Worker Rule** | Quy tắc đảm bảo mỗi Worker chỉ được nhận và làm 1 nhiệm vụ tối đa 1 lần duy nhất trong toàn hệ thống. |
| **Anti-Self-Dealing** | Quy tắc cấm Admin / Employer tự nhận và hoàn thành nhiệm vụ do chính tài khoản của mình tạo ra (`worker_id != creator_id`). |
| **Race Condition Guard** | Cơ chế đảm bảo tính nhất quán khi nhiều Worker cùng nhận suất cuối cùng tại cùng một thời điểm mà không bị vượt quá `quota`. |

---

## 4. Thực thể nghiệp vụ & Quy tắc cốt lõi (Entities & Core Business Rules)

### 4.1 Thực thể cốt lõi mới: `TaskClaim` (Lượt giữ chỗ nhận việc)
- **Định danh:** `id` (UUID).
- **Liên kết:**
  - `task_id` (UUID): Mã nhiệm vụ được nhận.
  - `worker_id` (UUID): Mã định danh của Worker.
- **Trạng thái vòng đời (`status`):**
  - `IN_PROGRESS`: Vừa nhận việc, đang trong thời gian giữ slot làm bài.
  - `SUBMITTED`: Đã nộp bằng chứng thành công (chuyển tiếp ở feature sau).
  - `EXPIRED`: Hết thời gian giữ slot mà chưa nộp bài (suất được hoàn trả).
  - `CANCELED`: Worker chủ động hủy nhận việc trước khi hết hạn.
  - `APPROVED` / `REJECTED`: Kết quả nghiệm thu từ Admin.
- **Mốc thời gian:**
  - `claimed_at`: Thời điểm bắt đầu nhận việc.
  - `expires_at`: Mốc thời gian hết hạn giữ chỗ.
  - `submitted_at`: Thời điểm nộp bài (null khi mới nhận việc).
  - `created_at`, `updated_at`: Dấu thời gian hệ thống.
  - `version`: Số phiên bản kiểm soát đồng thời OCC.

### 4.2 Các quy tắc nghiệp vụ bắt buộc (Core Business Rules)

- **BR-CLAIM-01 (Nhiệm vụ phải ở trạng thái ACTIVE):**
  Worker chỉ có thể nhận việc khi `task.status === ACTIVE`. Mọi trạng thái khác (`DRAFT`, `PAUSED`, `COMPLETED`, `CLOSED`) đều từ chối yêu cầu nhận việc với mã lỗi `TASK_NOT_AVAILABLE_FOR_CLAIM` (HTTP 400).

- **BR-CLAIM-02 (Còn suất trống - Remaining Quota > 0):**
  Chỉ cho phép nhận việc khi:
  $$\text{remaining\_quota} = \text{quota} - (\text{approved\_count} + \text{in\_progress\_count}) > 0$$
  Nếu $\text{remaining\_quota} \le 0$, hệ thống từ chối yêu cầu với mã lỗi `TASK_QUOTA_EXHAUSTED` (HTTP 409).

- **BR-CLAIM-03 (Quy tắc 1 người - 1 lần duy nhất):**
  Hệ thống kiểm tra lịch sử nhận việc của `worker_id` đối với `task_id`. Nếu Worker đang có claim ở trạng thái `IN_PROGRESS`, `SUBMITTED`, hoặc đã được `APPROVED`, hệ thống từ chối với mã lỗi `WORKER_ALREADY_CLAIMED_TASK` (HTTP 409).

- **BR-CLAIM-04 (Quy tắc chống tự gian lận - Anti-Self-Dealing):**
  Cấm tuyệt đối tài khoản tạo nhiệm vụ (Admin/Employer) tự nhận slot của chính mình:
  $$\text{worker\_id} \neq \text{task.creator\_id}$$
  Nếu trùng lặp, từ chối với mã lỗi `EMPLOYER_CANNOT_CLAIM_OWN_TASK` (HTTP 403).

- **BR-CLAIM-05 (Tính toán hạn chót giữ chỗ - Slot Expiration):**
  Mỗi lượt nhận việc thành công được ấn định thời điểm hết hạn:
  $$\text{expires\_at} = \text{claimed\_at} + (\text{task.execution\_time\_minutes} \times 60 \times 1000)$$
  Giao diện hiển thị đồng hồ đếm ngược (Countdown Timer). Khi quá thời hạn này mà chưa nộp bài, slot được coi là hết hạn (`EXPIRED`) và suất được hoàn trả lại cho cộng đồng.

- **BR-CLAIM-06 (An toàn tranh chấp đồng thời - Concurrency & Race Condition Guard):**
  Khi nhiều Worker đồng thời bấm nhận slot cuối cùng ($\text{remaining\_quota} = 1$), giao dịch nhận việc phải được bảo vệ bằng cơ chế kiểm soát đồng thời (OCC hoặc Database Transaction) đảm bảo tính nguyên tử (Atomicity), chỉ cấp cho đúng 1 Worker và từ chối các yêu cầu còn lại, tuyệt đối không gây tràn quota (`No Over-allocation`).

- **BR-BROWSE-01 (Bộ lọc và sắp xếp danh sách công khai):**
  - Mặc định chỉ trả về các nhiệm vụ `ACTIVE` và còn suất ($\text{remaining\_quota} > 0$).
  - Cho phép lọc theo danh mục: `category = APP_INSTALL | SURVEY | ...`.
  - Cho phép sắp xếp: `sort_by = REWARD_DESC` (Xu cao nhất trước) hoặc `sort_by = LATEST` (việc mới nhất trước).

---

## 5. Ràng buộc hệ thống & Kiến trúc (Constraints & Architecture Preflight)

- **Tuân thủ Architecture Profile v1.1.0 (APPROVED):**
  - Ngôn ngữ & Runtime: TypeScript, Node.js (v20+).
  - Kiến trúc: Clean Architecture / Hexagonal (Domain thuần không phụ thuộc framework, Use Case điều phối qua Ports, Interface chuyển đổi HTTP, Infra kết nối DB).
  - Web & Transport: Fastify v4/v5 với Zod schema validation.
  - Cơ sở dữ liệu: PostgreSQL với Prisma ORM, kèm In-Memory repository fallback phục vụ chạy thử nghiệm cục bộ khi chưa có DB.
  - Kiểm thử: Vitest cho Unit, Integration và E2E tests; `npx tsc --noEmit` đạt 0 lỗi.
- **Ràng buộc an ninh (SEC-01):**
  - Mọi URL trong các bước hướng dẫn bắt buộc giao thức `https://`.
  - Dữ liệu trả về cho Worker phải được lọc và sanitize, không lộ thông tin nhạy cảm của Admin.
  - Xác thực vai trò: API nhận việc bắt buộc vai trò `WORKER` (kiểm tra qua header `x-user-role = WORKER` hoặc auth token).
- **Ràng buộc hiệu năng:**
  - Thời gian xử lý nhận việc (Claim Slot latency) $\le 50\text{ms}$ trong điều kiện bình thường.
  - API danh sách duyệt việc đáp ứng tải nhanh, hỗ trợ phân trang chuẩn (`page`, `limit`).

---

## 6. Câu hỏi mở & Quyết định (Open Questions & Dispositions)

1. **Q1: Cơ chế giải phóng slot hết hạn (Slot Expiration Handling) nên thực hiện như thế nào?**
   - *Phương án A (Khuyến nghị):* Xử lý động (Lazy Evaluation). Khi tính toán `in_progress_count` và kiểm tra quota, hệ thống chỉ đếm các claim có `status = IN_PROGRESS` và `expires_at > now()`. Các claim quá hạn tự động xem như hết hiệu lực mà không cần chờ cron job.
   - *Phương án B:* Background Cron Job quét cơ sở dữ liệu mỗi phút để cập nhật `status = EXPIRED`.
   - *Quyết định đề xuất (Disposition - Approved Assumption):* Áp dụng **Phương án A (Lazy Evaluation)** làm cơ chế cốt lõi để đảm bảo độ tin cậy tức thì và đơn giản hóa kiến trúc; phương án Cron Job định kỳ có thể bổ sung sau như giải pháp dọn rác dữ liệu.

2. **Q2: Worker có thể tự hủy slot đã nhận (Cancel Claim) không?**
   - *Phương án:* Có, cung cấp API `POST /api/v1/tasks/:id/claims/cancel` cho phép Worker chủ động hủy slot nếu thấy không thể hoàn thành, giúp giải phóng ngay suất đó cho người khác.
   - *Quyết định đề xuất (Disposition - Approved Assumption):* Hỗ trợ trạng thái `CANCELED`, cho phép Worker hủy việc trước hạn chót.

3. **Q3: Nhiệm vụ hết suất (`remaining_quota == 0`) có hiển thị trên danh sách duyệt việc không?**
   - *Phương án:* Mặc định API công khai ẩn các nhiệm vụ đã hết suất. Tuy nhiên, hỗ trợ tham số tùy chọn `include_exhausted=true` để hiển thị thẻ kèm nhãn "Đã đủ người" để Worker tham khảo.
   - *Quyết định đề xuất (Disposition - Approved Assumption):* Mặc định lọc bỏ các nhiệm vụ hết suất để Worker tập trung vào việc có thể làm ngay; hiển thị nhãn "Hết chỗ" nếu Worker truy cập trực tiếp bằng đường dẫn ID.

---

## 7. Methodology Profile

- **Depth:** `DETAILED`
- **Rationale:** Tính năng `browse-and-claim-task` liên quan trực tiếp đến luồng giao dịch giữ chỗ tài nguyên (concurrency-sensitive slot reservation), kiểm soát số lượng quota và quy tắc chống gian lận (1 worker / task, cấm tự claim). Cần đặc tả chi tiết về trạng thái, điều kiện biên và xử lý đồng thời để tránh race condition.
- **Risk Posture:** Trung bình - Cao (Rủi ro cấp phát vượt quota nếu xảy ra tranh chấp đồng thời; rủi ro Worker bị giữ slot ảo).
- **High-Risk Review Route:** Kiểm tra chặt chẽ cơ chế kiểm soát đồng thời tại Use Case và Repository, kiểm thử tải/tranh chấp đồng thời trong E2E test suite.
- **Unresolved-Decision Owner:** Admin (@admin) / Tech Lead.

---

## 8. Describe-back Record

- **WHAT & WHY:**
  - *WHAT:* Tính năng cung cấp cho Người làm (Worker) khả năng tìm kiếm, duyệt danh sách nhiệm vụ công khai, lọc theo danh mục, sắp xếp theo Xu thưởng hoặc độ mới, xem chi tiết các bước hướng dẫn kèm hình ảnh minh họa, và bấm "Nhận việc" để giữ slot có hạn giờ (`execution_time_minutes`).
  - *WHY:* Đảm bảo tính minh bạch, giữ chỗ công bằng cho người làm, ngăn ngừa tranh chấp mất công làm bài, cấm nhận việc trùng lặp, cấm người tạo việc tự nhận việc của mình, và đảm bảo không bao giờ cấp phát vượt quá chỉ tiêu ngân sách.
- **DoD:** 
  - Đầy đủ 3 API công khai: Duyệt danh sách có lọc/sắp xếp, Xem chi tiết kèm ảnh minh họa, và Nhận việc giữ chỗ (Claim Slot).
  - Đầy đủ giao diện Web Worker trực quan với đồng hồ đếm ngược khi giữ slot.
  - Bảo vệ toàn vẹn: 1 worker / task, worker != creator, còn quota mới được nhận, an toàn race condition.
  - 100% tests tự động vượt qua (Unit, Integration, E2E), TypeScript 0 lỗi.
- **Boundaries & Exclusions:**
  - Bao gồm: Duyệt việc, xem chi tiết, giữ chỗ nhận việc (Claim Slot), tính toán hạn giờ, đồng bộ `TaskProgressPort`.
  - Loại trừ: Nộp bằng chứng (tải ảnh/văn bản), Admin chấm duyệt bằng chứng, ví tiền và rút tiền.
- **Assumptions & Dispositions:**
  - Cơ chế hết hạn slot áp dụng Lazy Evaluation (`expires_at > now`) kết hợp cập nhật trạng thái khi Worker truy cập.
  - Cho phép Worker tự hủy slot nếu không muốn tiếp tục làm.

---

## AI Agent Recommendation

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Khởi tạo tài liệu Ngữ cảnh nghiệp vụ Pha 0 SDD (`CONTEXT.md`) cho tính năng `browse-and-claim-task`.
- **Recommendation:** Phê duyệt tài liệu `CONTEXT.md` này để làm cơ sở chuyển sang Pha 1 Đặc tả yêu cầu kỹ thuật (`SPEC.md`). Ý đồ nghiệp vụ rõ ràng, tuân thủ nguyên tắc độc lập công nghệ của Clean Architecture, đã xác lập các quy tắc nghiệp vụ cốt lõi (BR-CLAIM-01 đến BR-CLAIM-06) và giải quyết các câu hỏi mở.
- **Evidence:** Phân tích từ yêu cầu bài toán của người dùng, tích hợp với `TaskProgressPort` và `FreelanceTask` entity đã xây dựng ở các pha trước, đối chiếu với `CONSTITUTION.md` và `Architecture Profile v1.1.0`.
- **Risks and assumptions:** Cần xử lý cẩn trọng race condition khi nhiều Worker cùng nhận suất cuối cùng; đã định nghĩa cơ chế Atomic/OCC để giải quyết rủi ro này.
- **Alternatives considered:** Đã so sánh giữa cơ chế giữ chỗ có thời hạn (Claim Slot with Timeout) và cơ chế nộp tự do không giữ slot (Free-for-all submission). Cơ chế Claim Slot vượt trội hoàn toàn về bảo vệ quyền lợi người làm và ngăn ngừa lãng phí công sức.
- **Required human decision:** Human Reviewer có thẩm quyền (Admin) xem xét và ghi nhận quyết định phê duyệt `APPROVED` trong mục `Human Final Review` dưới đây.

---

## Human Final Review

- **Status:** APPROVED
- **Decision:** Duyệt CONTEXT.md browse-and-claim-task v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-19T23:57:26+07:00
- **Follow-up:** /sdd-spec --feature=browse-and-claim-task 

