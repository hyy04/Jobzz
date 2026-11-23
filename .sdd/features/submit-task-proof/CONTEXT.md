# Ngữ cảnh tính năng: Nộp bằng chứng nhiệm vụ cho Người làm (submit-task-proof)

# Version: 1.0.0
# Status: APPROVED
# Feature Slug: submit-task-proof
# Owner: Worker Experience Team & Architecture Team (@architecture-team)
# Mô hình: Người làm (Worker) đang giữ slot (IN_PROGRESS) thực hiện nộp các bằng chứng hoàn thành (ảnh chụp màn hình, văn bản) theo yêu cầu của nhiệm vụ để chuyển sang trạng thái chờ duyệt (SUBMITTED)

---

## 1. Intent Packet

- **WHAT:** Cung cấp hệ thống API và Giao diện Web cho phép Người làm (Worker) đang giữ slot làm bài hợp lệ (`status = IN_PROGRESS` và chưa hết hạn `expires_at`) thực hiện nộp bằng chứng đối soát hoàn thành nhiệm vụ theo đúng danh mục yêu cầu (`proof_requirements`) do Người tạo việc thiết lập:
  1. **Nộp bằng chứng đa định dạng (Multi-type Proof Submission):**
     - Bằng chứng hình ảnh (`SCREENSHOT_IMAGE`): Hỗ trợ tải tệp ảnh chụp màn hình (PNG, JPEG/JPG, WebP, dung lượng tối đa 5MB/ảnh), kiểm định định dạng tệp và MIME type an toàn, lưu trữ cô lập và trả về đường dẫn tệp an toàn.
     - Bằng chứng văn bản (`TEXT`): Nhập mã đơn hàng, ID giao dịch ngân hàng, tên tài khoản hoặc phản hồi nội dung (tối đa 500 ký tự), tự động cắt tỉa khoảng trắng và chống mã độc kịch bản XSS.
  2. **Kiểm định tính hợp lệ toàn diện (Validation & Business Integrity):**
     - Kiểm tra quyền sở hữu: Worker nộp bài phải là chủ sở hữu hợp pháp của lượt nhận việc (`claim.worker_id == current_worker_id`).
     - Kiểm tra thời hạn slot: Lượt giữ chỗ phải còn hiệu lực (`now <= claim.expires_at`). Nếu đã quá hạn, slot bị xem là `EXPIRED` và từ chối nộp bài.
     - Kiểm định đầy đủ yêu cầu: Bắt buộc phải cung cấp đủ 100% các bằng chứng có đánh dấu bắt buộc (`is_required = true`) tương ứng với các `proof_requirements` của nhiệm vụ.
  3. **Chuyển trạng thái & Khóa slot (Claim State Transition & Immutable Lock):**
     - Chuyển trạng thái `TaskClaim` từ `IN_PROGRESS` sang `SUBMITTED` (chờ nghiệm thu).
     - Ghi nhận dấu thời gian nộp bài `submitted_at = now()`.
     - Dừng đồng hồ đếm ngược và khóa bài nộp: Worker không thể chỉnh sửa, nộp đè hoặc chủ động hủy slot một khi đã nộp bài.
     - Cập nhật số liệu tiến độ nhiệm vụ: Suất đã nộp bài tiếp tục được giữ chỗ an toàn, không bị giải phóng lại cho cộng đồng trong thời gian chờ Admin phê duyệt.
  4. **Giao diện Web Người làm trực quan (Worker Submission UI):**
     - Tích hợp khung nộp bằng chứng ngay trong modal/giao diện chi tiết nhiệm vụ đang làm của Worker.
     - Khu vực tải ảnh trực quan với khả năng xem trước (Image Preview), hiển thị dung lượng, nút chọn lại ảnh và cảnh báo lỗi tệp.
     - Ô nhập văn bản kèm bộ đếm ký tự thời gian thực (0/500 ký tự).
     - Nút bấm hành động nổi bật "Nộp bài nhận Xu" kèm hiệu ứng xử lý và phản hồi thành công tức thì.

- **WHY:**
  1. *Ghi nhận nỗ lực & Quyền lợi người làm:* Sau khi đã bỏ công sức thực hiện các bước nhiệm vụ trong thời gian giữ slot, Worker cần một phương thức nộp kết quả minh bạch, đáng tin cậy để xác nhận hoàn thành công việc trước hạn chót.
  2. *Cơ sở đối soát xác thực cho Người tạo việc (Employer/Admin):* Cung cấp bằng chứng cụ thể, rõ ràng (ảnh chụp màn hình xác thực, mã giao dịch) giúp người phát hành nhiệm vụ dễ dàng kiểm tra, đối soát và giải ngân Xu thưởng chính xác.
  3. *Bảo vệ an ninh hệ thống & Chống giả mạo:* Ngăn ngừa rủi ro tải lên các tệp độc hại (shell script, file thực thi), ngăn chặn tình trạng nộp bài hộ người khác, hoặc nộp bài sau khi đã hết thời gian giữ slot.
  4. *Bảo toàn ngân sách chiến dịch (Financial & Quota Integrity):* Khi bài nộp chuyển sang trạng thái `SUBMITTED`, suất làm việc vẫn phải được bảo lưu trong chỉ tiêu ngân sách (`occupied_slots = in_progress + submitted + approved`), không bị hoàn trả nhầm làm bội chi ngân sách của chủ nhiệm vụ.
  5. *Hoàn thiện chuỗi nghiệp vụ cốt lõi:* Khép lại mắt xích quan trọng thứ 3 trong vòng đời nhiệm vụ: Đăng việc (`post-job`) $\to$ Nhận việc giữ chỗ (`browse-and-claim-task`) $\to$ **Nộp bằng chứng (`submit-task-proof`)** $\to$ Nghiệm thu & Chi trả (`review-submission`).

- **Definition of Done:**
  1. **Domain Model & Entities:**
     - Xây dựng Entity / Value Object biểu diễn bằng chứng nộp (`SubmittedProofItem`, `ProofType`) với đầy đủ kiểm tra điều kiện biên (độ dài text 1–500 ký tự, URL ảnh an toàn).
     - Cập nhật thực thể `TaskClaim` hỗ trợ gắn danh sách bằng chứng đã nộp và thực thi phương thức `.submit(proofs, now)`.
     - Định nghĩa bộ mã lỗi nghiệp vụ chuẩn hóa RFC 7807 (`CLAIM_EXPIRED`, `NOT_CLAIM_OWNER`, `MISSING_REQUIRED_PROOFS`, `INVALID_PROOF_PAYLOAD`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`).
  2. **Application Ports & Use Cases:**
     - Tạo `SubmitTaskProofUseCase` điều phối toàn bộ luồng kiểm tra nghiệp vụ và chuyển trạng thái.
     - Tạo `StoragePort` / `FileUploadPort` trừu tượng hóa việc lưu trữ tệp ảnh bằng chứng an toàn.
     - Cập nhật `TaskProgressPort` và `TaskClaimRepositoryPort` để lưu trữ và truy vấn danh sách bằng chứng đã nộp.
  3. **Interface HTTP & Endpoints:**
     - API Upload ảnh bằng chứng: `POST /api/v1/uploads/proof-image` (nhận tệp ảnh multipart, kiểm tra MIME type PNG/JPEG/WebP, dung lượng $\le 5\text{MB}$, lưu trữ an toàn và trả về đường dẫn URL ảnh).
     - API Nộp bằng chứng: `POST /api/v1/claims/:claimId/submit` (nhận danh sách bằng chứng đã điền, kiểm tra quyền sở hữu Worker qua `WorkerAuthGuard`, kiểm tra thời hạn và nộp bài).
     - API Xem chi tiết bài nộp của lượt claim: `GET /api/v1/claims/:claimId`.
  4. **Giao diện Web Người làm (Web UI):**
     - Khung nộp bằng chứng trực quan hiển thị tương ứng với từng `proof_requirement` của nhiệm vụ.
     - Ô tải ảnh hỗ trợ chọn tệp, kéo thả, hiển thị preview ảnh thu nhỏ và cảnh báo dung lượng/định dạng.
     - Ô nhập text có đếm số ký tự (0/500) và sanitize chống XSS.
     - Nút "Nộp bài nhận Xu" hiển thị trạng thái loading khi tải dữ liệu.
     - Khi nộp thành công: hiển thị thông báo trạng thái "Đang chờ duyệt", dừng đồng hồ đếm ngược và khóa form.
  5. **Kiểm thử Tự động & Chất lượng:**
     - 100% tests đạt PASS (Unit tests domain, Use case, Upload security, API integration, UI E2E tests).
     - `npx tsc --noEmit` đạt 0 lỗi typecheck; `npm run build` thành công sạch sẽ.

- **Boundaries (Phạm vi bao gồm):**
  - Tiếp nhận và xác thực tệp ảnh bằng chứng (`SCREENSHOT_IMAGE`) cùng chuỗi văn bản (`TEXT`).
  - Lưu trữ tệp ảnh cục bộ an toàn trong thư mục phục vụ tĩnh (Local Static Storage / Uploads Directory).
  - Xác thực quyền hạn Worker sở hữu slot, hạn chót slot (`expires_at`), và tính đầy đủ của các yêu cầu bắt buộc.
  - Chuyển trạng thái `TaskClaim` sang `SUBMITTED`, lưu mốc thời gian `submitted_at`, và bảo lưu quota nhiệm vụ.
  - Giao diện Web nộp bằng chứng trên trình duyệt của Người làm.

- **Exclusions (Phạm vi loại trừ / Tính năng sau):**
  - Luồng Admin xem xét, chấm điểm duyệt bài hoặc từ chối bài nộp (thuộc tính năng `review-submission`).
  - Cơ chế tự động duyệt bài sau $N$ ngày (`auto_approval_days`) nếu Admin không kịp duyệt (thuộc cron/worker service).
  - Tích hợp dịch vụ lưu trữ đám mây bên thứ ba (AWS S3, Cloudflare R2) — giai đoạn này sử dụng local storage theo Architecture Profile.
  - Luồng cộng tiền vào ví và đổi Xu rút tiền (thuộc tính năng `wallet-withdrawal`).

- **Decision owner:** Architecture Team & Product Owner (@architecture-team).

---

## 2. Vấn đề nghiệp vụ & Người dùng (Problem Statement & User Pains)

### 2.1 Khó khăn thực tế của Người làm (Worker Pains)
1. **Thiếu nơi nộp bằng chứng rõ ràng:** Sau khi đã hoàn thành cài ứng dụng hoặc đăng ký tài khoản, Worker không biết phải gửi ảnh chụp màn hình hoặc mã đơn hàng ở đâu để được ghi nhận.
2. **Nộp bài sát giờ dễ bị mất slot:** Nếu form nộp bài phức tạp hoặc quá trình tải ảnh chậm chạp, Worker có thể bị trễ vài giây so với thời hạn `expires_at`, dẫn đến hệ thống hủy slot và mất trắng công sức.
3. **Mơ hồ về trạng thái sau khi nộp:** Worker không biết bài nộp của mình đã gửi thành công chưa, đã được hệ thống ghi nhận hay chưa, và đồng hồ đếm ngược có còn trừ giờ hay không.

### 2.2 Mục tiêu nghiệp vụ của Nền tảng (Platform Goals)
1. **Thu thập bằng chứng đối soát chuẩn xác:** Đảm bảo mọi bài nộp đều có đủ 100% bằng chứng bắt buộc theo đúng cấu trúc tiêu chí đã đặt ra khi đăng việc.
2. **An toàn tệp tin (File Security):** Tuyệt đối không cho phép tải lên các tệp nguy hiểm (file thực thi .exe, mã nguồn PHP, script HTML/SVG).
3. **Khóa slot chống gian lận:** Không cho phép Worker chỉnh sửa hoặc thay thế bằng chứng sau khi đã nộp để đảm bảo tính khách quan cho bên nghiệm thu.
4. **Bảo toàn hạn ngạch chiến dịch:** Đảm bảo các slot đã nộp bài (`SUBMITTED`) tiếp tục được tính vào số lượng đã chiếm dụng, không bị giải phóng nhầm làm vượt hạn mức chi trả của Người tạo việc.

---

## 3. Thuật ngữ nghiệp vụ (Domain Glossary)

| Thuật ngữ | Định nghĩa nghiệp vụ |
| :--- | :--- |
| **Task Claim** | Lượt nhận việc giữ chỗ của Worker trên một nhiệm vụ cụ thể. |
| **Claim Status** | Trạng thái vòng đời của lượt claim: `IN_PROGRESS` $\to$ `SUBMITTED` $\to$ `APPROVED` / `REJECTED` (hoặc `EXPIRED` / `CANCELED`). |
| **Proof Requirement** | Tiêu chí bằng chứng mà Người tạo việc yêu cầu khi đăng nhiệm vụ (kiểu `SCREENSHOT_IMAGE` hoặc `TEXT`, tiêu đề, mô tả, tính bắt buộc `is_required`). |
| **Submitted Proof Item** | Một mục bằng chứng cụ thể mà Worker gửi lên để đáp ứng một `Proof Requirement`, chứa đường dẫn ảnh (`image_url`) hoặc chuỗi văn bản (`text_value`). |
| **SCREENSHOT_IMAGE** | Định dạng bằng chứng yêu cầu tải ảnh chụp màn hình (PNG, JPEG, WebP, dung lượng $\le 5\text{MB}$). |
| **TEXT** | Định dạng bằng chứng yêu cầu nhập chuỗi văn bản (1 đến 500 ký tự). |
| **submitted_at** | Thời điểm tuyệt đối (timestamp có múi giờ) ghi nhận Worker hoàn tất việc gửi bài nộp. |
| **Holding Deadline Guard** | Ràng buộc nghiệp vụ bắt buộc thời điểm nộp bài phải diễn ra trước hoặc đúng thời điểm `expires_at`. |
| **Occupied Quota** | Tổng số suất đang được giữ chân trong hệ thống: $\text{occupied} = \text{in\_progress\_count} + \text{submitted\_count} + \text{approved\_count}$. |
| **MIME Validation** | Kiểm định định dạng tệp tin thông qua Content-Type và phần mở rộng an toàn, ngăn chặn tấn công tệp độc hại. |

---

## 4. Thực thể nghiệp vụ & Quy tắc cốt lõi (Entities & Core Business Rules)

### 4.1 Cấu trúc dữ liệu bài nộp bằng chứng

#### Mục bằng chứng nộp (`SubmittedProofItem`):
- `requirement_id` (UUID): Khóa ngoại tham chiếu đến `id` của `ProofRequirement` trong `task.proof_requirements`.
- `proof_type` (`SCREENSHOT_IMAGE` | `TEXT`): Kiểu bằng chứng tương ứng.
- `value` (chuỗi văn bản):
  - Đối với `SCREENSHOT_IMAGE`: Đường dẫn URL tương đối an toàn tới tệp ảnh đã lưu trữ (ví dụ: `/uploads/proofs/proof-xxx.png`).
  - Đối với `TEXT`: Nội dung văn bản do Worker nhập (1 - 500 ký tự).

#### Liên kết với `TaskClaim`:
- Thuộc tính `submitted_proofs`: Danh sách các `SubmittedProofItem` nộp kèm theo lượt claim.
- Trạng thái `status`: Chuyển từ `IN_PROGRESS` $\to$ `SUBMITTED`.
- Mốc thời gian `submitted_at`: Thời điểm gửi bài thành công.

### 4.2 Các quy tắc nghiệp vụ bắt buộc (Core Business Rules)

- **BR-PROOF-01 (Xác thực quyền sở hữu slot - Slot Ownership Guard):**
  Chỉ Worker đang sở hữu bản ghi `TaskClaim` (`claim.worker_id == current_worker_id`) mới có quyền nộp bằng chứng cho slot đó. Nếu `worker_id` không khớp, hệ thống từ chối với mã lỗi `NOT_CLAIM_OWNER` (HTTP 403).

- **BR-PROOF-02 (Thời hạn giữ chỗ hợp lệ - Active Holding Period Guard):**
  Worker chỉ có thể nộp bằng chứng khi lượt claim đang ở trạng thái `IN_PROGRESS` và thời điểm nộp bài `now <= claim.expires_at`.
  - Nếu `now > claim.expires_at`: Lượt claim được xem là hết hạn, hệ thống chuyển sang trạng thái `EXPIRED` và từ chối nộp với mã lỗi `CLAIM_EXPIRED` (HTTP 400).
  - Nếu claim đã ở trạng thái khác (`SUBMITTED`, `APPROVED`, `CANCELED`, `REJECTED`): Từ chối với mã lỗi `CLAIM_NOT_IN_PROGRESS` (HTTP 409).

- **BR-PROOF-03 (Nộp đủ 100% bằng chứng bắt buộc - Complete Mandatory Proofs):**
  Hệ thống đối chiếu danh sách bằng chứng gửi lên với `task.proof_requirements`:
  - Mỗi `proof_requirement` có `is_required === true` bắt buộc phải có ít nhất một mục bằng chứng tương ứng trong bài nộp với giá trị hợp lệ (ảnh không rỗng hoặc text không rỗng).
  - Không được chứa `requirement_id` không tồn tại trong nhiệm vụ.
  - Nếu thiếu bất kỳ mục bắt buộc nào, từ chối với mã lỗi `MISSING_REQUIRED_PROOFS` (HTTP 400).

- **BR-PROOF-04 (An toàn tệp ảnh tải lên - Image Upload Security & Limits):**
  - Định dạng hợp lệ: Chỉ chấp nhận các định dạng tệp ảnh thông dụng: `image/png` (.png), `image/jpeg` (.jpg, .jpeg), và `image/webp` (.webp).
  - Giới hạn dung lượng: Dung lượng tệp ảnh không được vượt quá $5\text{MB}$ ($5 \times 1024 \times 1024$ bytes).
  - Lưu trữ an toàn: Tệp ảnh được lưu trữ với tên định danh ngẫu nhiên (UUID v4) trong thư mục lưu trữ tĩnh được bảo vệ, tuyệt đối không sử dụng tên tệp gốc từ phía client nhằm ngăn chặn tấn công Path Traversal.

- **BR-PROOF-05 (Kiểm định tính hợp lệ bằng chứng văn bản - Text Proof Validation):**
  - Độ dài nội dung: Tối thiểu 1 ký tự (sau khi trim khoảng trắng) và tối đa 500 ký tự.
  - Vệ sinh dữ liệu (Sanitization): Tự động khử bỏ các ký tự đặc biệt nguy hiểm và mã HTML/Javascript để ngăn ngừa tấn công XSS khi hiển thị cho Admin đối soát.

- **BR-PROOF-06 (Khóa bất biến sau khi nộp - Immutable Submission & Stop Timer):**
  - Sau khi nộp thành công, `TaskClaim.status` chuyển sang `SUBMITTED`, `submitted_at = now`.
  - Worker không thể nộp lại hoặc sửa đổi bằng chứng đã gửi.
  - Worker không thể chủ động hủy (`cancel`) lượt nhận việc sau khi đã nộp bài.
  - Đồng hồ đếm ngược trên giao diện Worker dừng đếm và chuyển sang hiển thị nhãn "Đang chờ duyệt".

- **BR-PROOF-07 (Bảo toàn hạn ngạch nhiệm vụ - Quota Reservation Protection):**
  Suất làm việc có trạng thái `SUBMITTED` tiếp tục được tính vào số lượng suất đang chiếm dụng của nhiệm vụ:
  $$\text{occupied\_slots} = \text{in\_progress\_count} + \text{submitted\_count} + \text{approved\_count}$$
  $$\text{remaining\_quota} = \text{quota} - \text{occupied\_slots}$$
  Tuyệt đối không giải phóng slot đang chờ duyệt ra cộng đồng để tránh rủi ro bội chi ngân sách của chủ nhiệm vụ.

---

## 5. Ràng buộc hệ thống & Kiến trúc (Constraints & Architecture Preflight)

- **Tuân thủ Architecture Profile v1.1.0 (APPROVED):**
  - Ngôn ngữ & Runtime: TypeScript, Node.js (v20+).
  - Kiến trúc: Clean Architecture / Hexagonal (Domain thuần không phụ thuộc framework, Use Case điều phối qua Ports, Interface chuyển đổi HTTP, Infra kết nối DB & File Storage).
  - Web & Transport: Fastify v4/v5 với Zod schema validation và hỗ trợ upload tệp an toàn (`@fastify/multipart` hoặc storage helper).
  - Cơ sở dữ liệu: PostgreSQL với Prisma ORM, kèm In-Memory repository fallback phục vụ chạy thử nghiệm cục bộ khi chưa có DB.
  - Kiểm thử: Vitest cho Unit, Integration và E2E tests; `npx tsc --noEmit` đạt 0 lỗi.
- **Ràng buộc an ninh (SEC-01):**
  - Xác thực nghiêm ngặt vai trò `WORKER` thông qua `WorkerAuthGuard`.
  - Tách biệt thư mục lưu trữ upload tệp ảnh, chỉ phục vụ các tệp có đuôi ảnh hợp lệ, vô hiệu hóa thực thi mã script trong thư mục upload.
  - Sanitize toàn bộ chuỗi text bằng XSS Sanitizer trước khi lưu trữ và trả về.
- **Ràng buộc hiệu năng:**
  - Thời gian xử lý upload ảnh $\le 500\text{ms}$ đối với tệp ảnh dung lượng dưới 5MB.
  - Thời gian xử lý giao dịch nộp bài $\le 100\text{ms}$.

---

## 6. Câu hỏi mở & Quyết định (Open Questions & Dispositions)

1. **Q1: Cơ chế lưu trữ ảnh bằng chứng nên thiết kế như thế nào để đảm bảo tính độc lập kiến trúc (Clean Architecture)?**
   - *Phương án A (Khuyến nghị):* Xây dựng cổng trừu tượng `StoragePort` trong tầng Application/Use Case với phương thức `saveFile(fileBuffer, mimeType, filename): Promise<string>`. Tầng Infra cung cấp `LocalStorageAdapter` lưu tệp vào thư mục `public/uploads/proofs/` hoặc `storage/proofs/`. Khi triển khai production đám mây, chỉ cần bổ sung `S3StorageAdapter` mà không thay đổi bất kỳ dòng code nghiệp vụ nào.
   - *Quyết định đề xuất (Disposition - Approved Assumption):* Áp dụng **Phương án A (StoragePort + LocalStorageAdapter)** để đảm bảo tính độc lập và mở rộng cao nhất.

2. **Q2: Endpoint tải ảnh và nộp bằng chứng nên tách riêng hay gộp chung trong 1 request?**
   - *Phương án A (Khuyến nghị):* Tách thành 2 bước riêng biệt:
     - Bước 1: Worker chọn ảnh $\to$ Giao diện tự động gọi `POST /api/v1/uploads/proof-image` $\to$ Nhận URL ảnh preview ngay lập tức.
     - Bước 2: Worker điền các thông tin text $\to$ Bấm "Nộp bài nhận Xu" $\to$ Gửi payload JSON chứa đầy đủ danh sách `proofs: [{ requirement_id, proof_type, value }]` qua `POST /api/v1/claims/:claimId/submit`.
   - *Phương án B:* Gộp tất cả dữ liệu text và file binary vào một request multipart duy nhất `POST /api/v1/claims/:claimId/submit`.
   - *Quyết định đề xuất (Disposition - Approved Assumption):* Áp dụng **Phương án A (Tách riêng)**. Cách này mang lại trải nghiệm người dùng vượt trội (Worker thấy ảnh preview ngay khi chọn ảnh, phát hiện lỗi tệp sớm trước khi nộp form), đồng thời giữ API nộp bài thuần JSON sạch sẽ và dễ kiểm thử.

3. **Q3: Worker có thể chỉnh sửa lại bài nộp nếu phát hiện nộp nhầm ảnh không?**
   - *Phương án:* Trong phiên bản v1.0.0 này, một khi đã bấm "Nộp bài nhận Xu" thành công, trạng thái chuyển sang `SUBMITTED` và bị khóa bất biến (Immutable). Nếu bị Admin từ chối, luồng làm lại hoặc khiếu nại sẽ được thiết kế ở tính năng sau.
   - *Quyết định đề xuất (Disposition - Approved Assumption):* Khóa bài nộp ngay sau khi nộp thành công nhằm đảm bảo tính toàn vẹn và đơn giản cho khâu đối soát của Admin.

---

## 7. Methodology Profile

- **Depth:** `DETAILED`
- **Rationale:** Tính năng `submit-task-proof` liên quan trực tiếp đến xử lý tải tệp nhị phân an toàn (Binary File Upload Security), kiểm định toàn vẹn tiêu chí bằng chứng, quản lý trạng thái bảo lưu ngân sách (Quota Preservation khi chuyển sang SUBMITTED) và trải nghiệm nộp bài của Worker. Cần đặc tả chi tiết về an ninh tệp tin và luồng dữ liệu.
- **Risk Posture:** Trung bình (Rủi ro an ninh tệp upload, rủi ro nộp trễ hạn do đồng hồ không đồng bộ, rủi ro giải phóng nhầm quota).
- **High-Risk Review Route:** Kiểm tra chặt chẽ File Upload Validation (MIME type, file size limit, sanitized storage path) và tính nhất quán của quota trong `TaskProgressPort`.
- **Unresolved-Decision Owner:** Admin (@admin) / Tech Lead.

---

## 8. Describe-back Record

- **WHAT & WHY:**
  - *WHAT:* Tính năng cung cấp cho Worker khả năng nộp đầy đủ các bằng chứng đối soát (ảnh chụp màn hình PNG/JPEG/WebP $\le 5\text{MB}$, chuỗi văn bản $\le 500$ ký tự) tương ứng với các `proof_requirements` của nhiệm vụ khi đang giữ slot hợp lệ (`IN_PROGRESS` và chưa hết hạn). Sau khi nộp thành công, slot chuyển sang trạng thái `SUBMITTED`, ghi nhận `submitted_at` và dừng đồng hồ đếm ngược.
  - *WHY:* Ghi nhận công sức của Worker, cung cấp bằng chứng minh bạch cho Admin đối soát giải ngân Xu, bảo vệ an ninh tệp tin cho hệ thống, và bảo toàn ngân sách nhiệm vụ không bị phân phối vượt quota.
- **DoD:**
  - Đầy đủ 2 API: Upload ảnh an toàn (`POST /api/v1/uploads/proof-image`) và Nộp bài bằng chứng (`POST /api/v1/claims/:claimId/submit`).
  - Giao diện Web Worker trực quan với vùng kéo thả/chọn ảnh, preview ảnh, đếm ký tự text, thông báo trạng thái "Đang chờ duyệt".
  - Kiểm định toàn diện: Đúng chủ sở hữu slot, chưa hết hạn, đủ 100% bằng chứng bắt buộc, tệp ảnh an toàn, text an toàn.
  - 100% tests tự động vượt qua (Unit, Integration, E2E), TypeScript 0 lỗi.
- **Boundaries & Exclusions:**
  - Bao gồm: Upload ảnh, lưu trữ tệp cục bộ, xác thực quyền hạn và thời hạn slot, nộp bằng chứng, chuyển trạng thái `SUBMITTED`, giao diện Web phía Worker.
  - Loại trừ: Admin duyệt/từ chối bài nộp, tự động duyệt sau $N$ ngày, tích hợp lưu trữ đám mây S3/R2, ví tiền và rút tiền.
- **Assumptions & Dispositions:**
  - Sử dụng kiến trúc `StoragePort` để trừu tượng hóa việc lưu trữ tệp ảnh.
  - Tách riêng bước upload ảnh để hỗ trợ preview tức thì trên UI trước khi gửi JSON nộp bài.
  - Suất đã chuyển sang `SUBMITTED` tiếp tục chiếm giữ quota của nhiệm vụ để bảo vệ ngân sách.

---

## AI Agent Recommendation

- **Status:** PENDING HUMAN REVIEW
- **Scope:** Khởi tạo tài liệu Ngữ cảnh nghiệp vụ Pha 0 SDD (`CONTEXT.md`) cho tính năng Nộp bằng chứng nhiệm vụ (`submit-task-proof`).
- **Recommendation:** Phê duyệt tài liệu `CONTEXT.md` này để làm cơ sở chuyển sang Pha 1 Đặc tả yêu cầu kỹ thuật (`SPEC.md`). Ý đồ nghiệp vụ rõ ràng, tuân thủ nguyên tắc độc lập công nghệ của Clean Architecture, đã xác lập các quy tắc nghiệp vụ cốt lõi (BR-PROOF-01 đến BR-PROOF-07) và giải quyết các câu hỏi mở.
- **Evidence:** Phân tích từ yêu cầu bài toán của người dùng, tích hợp với `TaskClaim`, `ProofRequirement`, và `TaskProgressPort` đã xây dựng ở các pha trước, đối chiếu với `CONSTITUTION.md` và `Architecture Profile v1.1.0`.
- **Risks and assumptions:** Rủi ro an ninh tệp tin upload (giới hạn 5MB, lọc MIME type, lưu trữ ngẫu nhiên) và rủi ro bảo toàn quota khi slot ở trạng thái `SUBMITTED` đã được giải quyết bằng các quy tắc nghiệp vụ tường minh.
- **Alternatives considered:** Đã so sánh giữa nộp form multipart gộp chung và nộp ảnh tách rời lấy URL trước. Phương án tách rời cho trải nghiệm người dùng vượt trội (preview ảnh ngay, báo lỗi sớm) và giữ API sạch sẽ.
- **Required human decision:** Human Reviewer có thẩm quyền (Admin) xem xét và ghi nhận quyết định phê duyệt `APPROVED` trong mục `Human Final Review` dưới đây.

---

## Human Final Review

- **Status:** APPROVED
- **Decision:** Duyệt CONTEXT.md submit-task-proof v1.0.0
- **Reviewer:** Admin
- **Reviewed at:** 2026-11-21T22:12:51+07:00
- **Follow-up:** /sdd-spec --feature=submit-task-proof

