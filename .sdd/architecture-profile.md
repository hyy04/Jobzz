# Architecture Profile
# Version: 1.1.0
# Status: APPROVED
# Mục đích: Nguồn sự thật tech stack và kiến trúc canonical cho artifact do SDD/ADD sinh ra.

---

## 1. Thứ tự chọn binding

Skill resolve quyết định công nghệ theo thứ tự:

1. Profile này khi `Status: APPROVED`.
2. Repository evidence rõ ràng: manifest, lockfile, runtime config, source layout.
3. Input explicit của command, ví dụ `/sdd-init --stack="..."`.
4. Core-only starter baseline bên dưới.

Mâu thuẫn giữa các nguồn là **blocking configuration gap**. Skill phải lưu AI recommendation và yêu cầu Human reviewer có thẩm quyền quyết định; không được chọn một bên hoặc sinh artifact adapter-specific.

---

## 2. Baseline đã approved

| Mối quan tâm | Giá trị đã chọn | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Ngôn ngữ | TypeScript | APPROVED | `CLAUDE.md` §2.1, `src/` layout |
| Runtime | Node.js (v20+ LTS) | APPROVED | Core-only baseline |
| Kiến trúc | Clean Architecture / Hexagonal | APPROVED | `CLAUDE.md` §2.1, `CONSTITUTION.md` ARCH-01 |
| Domain layer | `src/domain/` — TypeScript thuần, không third-party dependency | APPROVED | `CLAUDE.md` §2.1 |
| Use-case layer | `src/usecase/` — application workflow và port | APPROVED | `CLAUDE.md` §2.1 |
| Interface layer | `src/interface/` — HTTP/event adapter, DTO, presenter | APPROVED | `CLAUDE.md` §2.1 |
| Infrastructure layer | `src/infra/` — repository, cache, external adapter | APPROVED | `CLAUDE.md` §2.1 |
| Shared layer | `src/shared/` — logging, security, common utility | APPROVED | `CLAUDE.md` §2.1 |
| Vị trí test | `tests/` | APPROVED | Repository layout |

---

## 3. Technology binding

| Mối quan tâm | Giá trị đã chọn | Status | Evidence / Human Decision |
| :--- | :--- | :--- | :--- |
| HTTP framework / transport | Fastify (v4/v5) | APPROVED | Quyết định của Human Reviewer (Admin) ngày 2026-11-19 |
| Database engine | PostgreSQL (v15+) | APPROVED | Quyết định của Human Reviewer (Admin) ngày 2026-11-19 |
| ORM / query layer | Prisma ORM (v5/v6) | APPROVED | Quyết định của Human Reviewer (Admin) ngày 2026-11-19 |
| Cache | Không dùng (In-memory/None) | OPTIONAL | Chưa có yêu cầu caching ở feature ban đầu |
| Message broker | Không dùng (Direct Ports) | OPTIONAL | Xử lý event đồng bộ nội bộ domain |
| Validation library | Zod (v3+) | APPROVED | Quyết định của Human Reviewer (Admin) ngày 2026-11-19 |
| Test framework / command | Vitest | APPROVED | Quyết định của Human Reviewer (Admin) ngày 2026-11-19 |
| Build / lint command | TypeScript (`tsc`) | APPROVED | Quyết định của Human Reviewer (Admin) ngày 2026-11-19 |
| Deployment environment | Docker / Node.js | OPTIONAL | Môi trường container hóa chuẩn |

### Approved verification commands
- **Command:** `npx vitest run`
  - **Status:** APPROVED
  - **Evidence:** Quyết định phê duyệt tech stack của Human Reviewer (Admin)
- **Command:** `npx tsc --noEmit`
  - **Status:** APPROVED
  - **Evidence:** Quyết định phê duyệt tech stack của Human Reviewer (Admin)

---

## 4. Artifact generation gate

| Artifact / skill | Có thể dùng core-only baseline? | Điều kiện |
| :--- | :--- | :--- |
| `CONTEXT.md` / `/sdd-context` | Có | Reference profile, chỉ ghi unknown liên quan feature. |
| `SPEC.md` / `/sdd-spec` | Có | Requirement technology-neutral; không dùng ORM decorator hoặc framework schema. |
| `PLAN.md` / `/sdd-plan` | Có | **ĐÃ MỞ KHÓA:** Đã chọn Fastify + PostgreSQL + Prisma + Zod + Vitest. |
| `TASKS.md` / `/sdd-tasks` | Có | **ĐÃ MỞ KHÓA:** Test framework Vitest và tsc build đã được duyệt. |
| `/add-execute`, `/sdd-layer-edit` | Có | **ĐÃ MỞ KHÓA:** Exact verification command đã được phê duyệt. |
| Technical skill adapter guidance | Có | Fastify routes, Prisma repository adapters, Zod DTO schemas. |

---

## 5. Governance liên quan

- `CONSTITUTION.md` là thẩm quyền cho hard security và architecture constraint.
- `CLAUDE.md` là bộ nhớ kiến trúc dành cho con người; phản ánh profile đã approved.
- `.sdd/constraints/` quản lý global, business và safety constraint.
- `.sdd/mcp-config.yaml` kiểm soát quyền tool, không chọn công nghệ.

---

## AI Agent Recommendation
- Status: PENDING HUMAN REVIEW
- Scope: `.sdd/architecture-profile.md` — Phê duyệt Tech Stack cho Jobzz
- Recommendation: Phê duyệt lựa chọn Tech Stack: Fastify + PostgreSQL + Prisma ORM + Zod + Vitest. Các bindings đã giải quyết toàn bộ các điểm nghẽn (blocking gaps) cho pha lập kế hoạch (PLAN) và phân rã nhiệm vụ (TASKS).
- Evidence: Quyết định lựa chọn trực tiếp của Human Reviewer (Admin) qua câu hỏi tương tác ngày 2026-11-19.
- Risks and assumptions: Cần khởi tạo `package.json`, `tsconfig.json`, `prisma/schema.prisma` khi bước vào pha triển khai mã nguồn; các verification commands `npx vitest run` và `npx tsc --noEmit` sẽ sẵn sàng sau khi cài đặt dependencies.
- Alternatives considered: Đã so sánh với Express, NestJS và In-Memory prototype; Fastify + Prisma mang lại hiệu năng cao nhất và type-safety chặt chẽ nhất.
- Required human decision: Phê duyệt chính thức profile này.

## Human Final Review
- Status: APPROVED
- Decision: Duyệt tech stack: Fastify + PostgreSQL + Prisma + Zod + Vitest cho dự án Jobzz
- Reviewer: Admin
- Reviewed at: 2026-11-19T15:14:21+07:00
- Follow-up: /sdd-plan --feature=post-job
