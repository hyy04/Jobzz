# Jobzz

Dự án áp dụng phương pháp phát triển phần mềm **SDD (Spec-Driven Development)** và **ADD (Agent-Driven Development)** kết hợp kiến trúc **Clean Architecture**.

---

## 1. Tổng quan kiến trúc

Dự án tuân thủ nghiêm ngặt các nguyên tắc Clean Architecture / Hexagonal Architecture:

```text
src/
├── domain/         # Entity, Value Object, Domain Event thuần TypeScript (không phụ thuộc external)
├── usecase/        # Application workflow, business logic và Ports
├── interface/      # HTTP/event adapters, DTOs, Controllers và Presenters
├── infra/          # Repositories, Caches, Database access và External adapters
└── shared/         # Utilities dùng chung, Error classes, Logging và Security helpers
```

---

## 2. Quản trị dự án & SDD/ADD Governance

- **Constitution:** [`CONSTITUTION.md`](./CONSTITUTION.md) — Bộ luật bất biến về chất lượng, bảo mật và kiến trúc.
- **Agent Governance:** [`AGENTS.md`](./AGENTS.md) — Phạm vi, vai trò và ma trận quyền hạn của AI Agent.
- **Architecture Memory:** [`CLAUDE.md`](./CLAUDE.md) — Hướng dẫn kiến trúc, conventions và quy tắc làm việc cho developer & AI.
- **Architecture Profile:** [`.sdd/architecture-profile.md`](./.sdd/architecture-profile.md) — Nguồn sự thật cho tech stack bindings và verification commands.
- **Shared Context:** [`.sdd/shared_context.md`](./.sdd/shared_context.md) — Thiết lập `Project Ownership` và `Agent Execution` độc lập.
- **Feature Registry:** [`.sdd/README.md`](./.sdd/README.md) — Danh mục đăng ký các feature trong vòng đời phát triển.

---

## 3. Bắt đầu nhanh (Quick Start)

1. Tham khảo hướng dẫn chi tiết tại [`docs/sdd-add-quickstart.md`](./docs/sdd-add-quickstart.md).
2. Human Reviewer kiểm tra và phê duyệt khởi tạo tại [`.sdd/reviews/init.md`](./.sdd/reviews/init.md).
3. Bổ sung tech bindings (HTTP framework, DB, ORM, Test runner) vào [`.sdd/architecture-profile.md`](./.sdd/architecture-profile.md) khi triển khai feature đầu tiên.
4. Bắt đầu feature mới bằng lệnh:
   ```bash
   /sdd-context --feature=<feature-slug>
   ```

---

## 4. Tài liệu tham khảo

- [`docs/sdd-add-guide.md`](./docs/sdd-add-guide.md): Hướng dẫn chi tiết vòng đời SDD/ADD.
- [`docs/sdd-add-field-guide.md`](./docs/sdd-add-field-guide.md): Bảng tra cứu tình huống và lệnh tương ứng.
- [`docs/sdd-add-scenario-playbook.md`](./docs/sdd-add-scenario-playbook.md): Kịch bản xử lý handoff, recovery và delivery.
- [`docs/architecture-profile-guide.md`](./docs/architecture-profile-guide.md): Quản lý và phê duyệt Architecture Profile.
- [`docs/multi-agent-orchestration-guide.md`](./docs/multi-agent-orchestration-guide.md): Cơ chế điều phối multi-agent.

