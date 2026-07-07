---
project_name: Phương Nam Solar — Phase 1
type: project-context
updated: 2026-07-07
status: complete
optimized_for_llm: true
sections_completed: [stack, architecture-invariants, api-contract, coding-style, scout, testing, workflow, gotchas]
sources:
  - _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md
  - _bmad-output/planning-artifacts/epics.md
---

# Project Context for AI Agents — Phương Nam Solar (Phase 1)

App quản lý nội bộ công ty NLMT (báo giá, đơn, thi công/giao hàng, tồn kho, phân quyền, thông báo). 3 client tách biệt: **Backend NestJS API** · **Web React** · **Mobile Flutter**. Solo dev.

**Nguồn chân lý (đọc trước khi làm):** PRD (34 FR) · `ARCHITECTURE-SPINE.md` (AD-1..18) · `DESIGN.md`+`EXPERIENCE.md` (UI/hành vi) · `epics.md` (9 epic/60 story). Khi mâu thuẫn: **spine thắng** cho kiến trúc/dữ liệu, **DESIGN/EXPERIENCE thắng** cho UI/hành vi.

## Technology Stack & Versions

| Thành phần | Version |
|---|---|
| Node.js | 24 LTS |
| NestJS | 11.1.27 |
| PostgreSQL | 18.4 |
| Prisma ORM | 7.8.0 |
| React (web) | 19.2.7 |
| Flutter (mobile, Clean Architecture + BLoC) | 3.44 |
| Object storage | Cloudflare R2 (S3-compatible) |
| firebase-admin (backend push) | 14.1.0 |
| Flutter Firebase | core 4.11.0 · messaging 16.1.0 · crashlytics 5.2.4 · analytics 12.1.1 · remote_config 6.5.3 |

Hạ tầng VPS · online-only · ~20 user nội bộ · giao diện tiếng Việt.

## Critical Implementation Rules

### Bất biến kiến trúc (AD — KHÔNG được vi phạm)

- **Backend sở hữu toàn bộ DB + nghiệp vụ; web/mobile chỉ gọi REST, KHÔNG chạm DB, KHÔNG chứa business logic** (AD-1, AD-2).
- **Tiền = integer đồng**, không float. **Một hàm pricing/VAT duy nhất** ở `orders/domain`, làm tròn 1 điểm ở grand-subtotal; giỏ hàng realtime gọi `POST /orders/preview-total`, **client chỉ hiển thị số backend trả** (AD-10, AD-16).
- **Chỉ `applyTransition()` được đổi `Order.status`**; gate theo cờ phạm vi + quyền, phát audit. `payments`/`inventory` gọi nó, không tự set status (AD-11, AD-7).
- **`OrderVersion` sở hữu toàn bộ line item**; `Order.currentVersionId` là con trỏ bản hiệu lực; **snapshot giá lúc Chốt**; sửa sau chốt = version mới (AD-6).
- **Permission registry chính tắc** (một enum do `accounts/domain` sở hữu) dùng chung FE gating + BE guard + noti resolver; **cấm permission literal ngoài registry** (AD-17). RBAC per-account, role = preset (AD-8). UI ẩn/disable theo quyền chỉ là UX — **backend luôn enforce mọi request** (AD-4).
- **Khách hàng định danh SĐT E.164**, chuẩn hoá **chỉ ở backend** `customers/domain` (AD-9).
- **Error envelope thống nhất** `{ code, message, details?, fieldErrors: [{field,code,message}], traceId }` + HTTP status; **một central exception filter** là nơi duy nhất tạo envelope (AD-5).
- **File/ảnh ở Cloudflare R2**; DB chỉ giữ key/metadata; backend trung gian upload/truy cập (AD-3).
- **EventBus port:** mọi hành động nghiệp vụ **publish domain event** (OrderConfirmed, DiscountRequested/Resolved, DepositRecorded, PaymentRecorded, StatusChanged, StockOutBlocked); **KHÔNG gọi FCM/notification/audit trực tiếp** — consumer subscribe (AD-18).
- **OpenAPI sinh TỪ backend** (code là nguồn), cả web+mobile gen client từ đó; **cấm sửa tay spec** (AD-12). Auth JWT access+refresh.
- **Design-system-first:** dựng thư viện component React + widget Flutter theo `DESIGN.md` **trước mọi màn**; mọi màn dùng lại component/token; **cấm style ad-hoc** (AD-13).
- **Firebase mobile** (FCM/Crashlytics/Analytics/Remote Config); **Remote Config chỉ config/feature-flag cấp app** — KHÔNG thay business flag ở backend (AD-14). Đích push **theo QUYỀN** (không theo role) + người phụ trách đơn, lọc theo quyền xem đơn (AD-15).

### API Contract — contract-first, KHÔNG đoán mò

- Với mỗi endpoint: **BE định nghĩa schema request/response (DTO) + error shape TRƯỚC khi code** → publish qua OpenAPI (sinh từ code) → **FE code dựa trên contract đó** (gen client có type). Hai bên **không bao giờ tự bịa field/kiểu**.
- Đổi contract = đổi ở BE → FE regen client. Áp cho `preview-total`, error envelope, và **mọi** payload.

### Coding style & conventions — thống nhất, bắt buộc

- **Lint/format bắt buộc:** ESLint + Prettier (TS backend/web); `dart format` + `analysis_options.yaml` (Flutter). Không mỗi người/file một kiểu.
- **Naming/format:** entity PascalCase · bảng snake_case số nhiều · file/route kebab-case · ID UUID v4 (trừ `Customer` PK = SĐT E.164) · ngày ISO-8601 UTC (client hiển thị UTC+7) · tiền integer đồng.
- **Kiến trúc code:** Backend = NestJS module theo domain (`orders`, `customers`, `products`, `inventory`, `payments`, `accounts`, `notifications`…). Mobile = Clean Architecture + BLoC. Web = React function components + hooks.

### Scout-before-code — kiểm tra tồn tại + ảnh hưởng

- **Trước khi viết mới:** tìm xem đã có sẵn module/service/util/component/endpoint chưa → **tái dùng, không tạo trùng** (DRY).
- **Trước khi sửa:** rà **caller / contract API / entity / story liên quan / component design-system bị ảnh hưởng**; đánh giá tác động rồi mới đổi. Không "code đè" mù.
- Thay đổi **surgical**, đúng scope story; không sửa lan man phần không liên quan.

### Testing

- Bắt buộc test cho phần dễ sai/tiền bạc: **pricing/VAT, `applyTransition` (gate cờ+quyền), permission resolve, snapshot giá, ghi nhận thanh toán, chặn tồn**.
- Backend: unit cho domain + e2e cho endpoint quan trọng (chốt, `preview-total`, chuyển trạng thái). FE: test component design-system + luồng critical (giỏ hàng, chốt).

### Development Workflow

- Theo `epics.md` + `sprint-status.yaml`. **Build-order:** Design System (Epic 1) → Nền tảng + EventBus port (Epic 2) → feature (E3+). Mỗi story tạo/sửa **CHỈ** entity/file nó cần; **không phụ thuộc story sau**.
- Commit **conventional**, không tham chiếu AI. **Không commit secret/.env/khoá**.

### Critical Don't-Miss (gotchas)

- Client **KHÔNG** tự tính tiền/thuế/logic — luôn gọi backend.
- **KHÔNG** đổi `Order.status` ngoài `applyTransition`.
- **KHÔNG** gọi FCM/audit trực tiếp — publish domain event.
- **KHÔNG** hardcode chuỗi quyền — dùng permission registry.
- Sửa giá danh mục **KHÔNG hồi tố** đơn đã chốt (snapshot đã khoá).
- Ẩn/disable UI theo quyền **không phải bảo mật** — backend enforce mọi request.

---

## Usage Guidelines

**Cho AI agent:** đọc file này **trước khi code bất kỳ thứ gì**; tuân thủ mọi rule; khi phân vân chọn phương án **an toàn/chặt hơn**; luôn scout code hiện có trước khi viết/sửa.

**Cho người:** giữ file **gọn**, cập nhật khi stack/pattern đổi; rà lại định kỳ, bỏ rule đã hiển nhiên.

_File này được nạp tự động vào mọi skill BMad qua `persistent_facts` (glob `**/project-context.md`)._

