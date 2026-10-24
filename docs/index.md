# Tổng quan

## Mục đích

App quản lý nội bộ của Phương Nam Solar (công ty lắp đặt điện mặt trời), Phase 1, cho khoảng 20 nhân viên
(kinh doanh, kế toán, kho/giao hàng, thi công, quản lý, admin). App thay quy trình giấy tờ/Excel bằng một hệ
thống chung: danh mục vật tư và bảng giá, khách hàng định danh bằng SĐT, báo giá kiêm đơn hàng (giỏ hàng,
VAT, chiết khấu cần duyệt, chốt và phiên bản), vòng đời đơn tới thi công, nghiệm thu và bảo hành, tồn kho
(giữ hàng khi chốt, xuất kho theo đơn, phiếu nhập/xuất/trả), phân quyền theo từng tài khoản và nhật ký audit.
Giao diện tiếng Việt, chạy online, có web (làm việc ở bàn) và mobile (ngoài hiện trường).

Trạng thái code (21-10-2026): đã xong Epic 1–6 của `_bmad-output/planning-artifacts/epics.md` (design system,
nền tảng backend và đăng nhập/quyền, danh mục và khách hàng, báo giá/chốt/chiết khấu, vòng đời đơn và bảo
hành, giao hàng và tồn kho). Chưa làm: thanh toán, hợp đồng, hoá đơn (Epic 7), dashboard/quản trị quyền/xem
audit (Epic 8), thông báo đẩy (Epic 9). Web và mobile mới có màn + port; chưa có router, HTTP client thật hay
app mobile chạy được (xem `docs/architecture.md`).

Tài liệu nghiệp vụ gốc: PRD, spine kiến trúc, UX (`DESIGN.md`, `EXPERIENCE.md`) và epics trong
`_bmad-output/planning-artifacts/`; luật cho agent trong `_bmad-output/project-context.md`. Tài liệu vận hành:
`docs/van-hanh-go-live.md`; quyết định nghiệp vụ: `docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md`.
Hồ sơ mẫu của khách (hợp đồng, báo giá, khảo sát) nằm trong `docs/1. Khảo sát lắp đặt/` và
`docs/2. Thương mại/`; đây là tài liệu tham khảo, không phải nguồn code.

## Stack

- Backend: Node.js 24, NestJS 11, Prisma 7.8 (driver adapter `@prisma/adapter-pg`), PostgreSQL 18, JWT
  (`@nestjs/jwt`) + argon2, OpenAPI sinh từ code (`@nestjs/swagger`), Puppeteer (render báo giá PDF/ảnh),
  Cloudflare R2 qua `@aws-sdk/client-s3`, `libphonenumber-js` (SĐT E.164). Test: Jest + Supertest.
- Web: React 19, TypeScript, Vite; test Vitest + jsdom + Testing Library.
- Mobile: Flutter (Dart SDK `>=3.4`), `flutter_svg`, `image_picker`, `share_plus`; lint `flutter_lints`.
- Design system: generator Node thuần (không dependency) sinh token, icon, key quyền cho web và mobile;
  guard `node --test`.
- CI: GitHub Actions (`.github/workflows/ci.yml`, chỉ chạy tay) + kiểm chuẩn docs `crew-docs`.

## Bản đồ module

| Thư mục | Vai trò |
|---------|---------|
| `backend/src/main.ts`, `backend/src/app.module.ts` | Bootstrap API, nối mọi module (flow `backend-platform`) |
| `backend/src/common/`, `prisma/`, `health/`, `openapi/`, `storage/` | Hạ tầng: error envelope, ValidationPipe, PrismaService, `/health`, sinh OpenAPI, `StoragePort` R2 |
| `backend/src/auth/` | Đăng nhập, refresh/logout, quên/đặt lại/đổi mật khẩu, guard JWT; cũng chứa guard quyền và `/me` |
| `backend/src/accounts/` | Tài khoản, registry quyền, preset vai trò, luật không leo thang quyền |
| `backend/src/catalog/` | Sản phẩm, nhóm hàng (gói vật tư), bảng giá phân tầng |
| `backend/src/customers/` | Khách hàng (PK = SĐT E.164), nguồn khách |
| `backend/src/orders/` | Báo giá kiêm đơn: giỏ hàng, preview-total, version, chốt, chiết khấu, trạng thái, huỷ, ảnh, xuất báo giá, bảo hành |
| `backend/src/inventory/` | Tồn kho onHand/reserved, ledger `StockMovement`, phiếu kho, xuất kho theo đơn |
| `backend/src/settings/`, `backend/src/feature-flags/` | Cấu hình hệ thống (thuế VAT) và cờ nghiệp vụ |
| `backend/src/events/`, `audit/`, `notifications/` | `EventBus` port, `AuditLog` append-only, `NotificationDispatcher` (bản đầu chỉ log) |
| `backend/prisma/` | `schema.prisma`, migration SQL, seed tài khoản admin |
| `backend/test/` | Test Jest: unit, e2e, lane DB `*.db.integration.spec.ts`, source-guard `no-*.spec.ts` |
| `backend/openapi/` | Artifact sinh tự động: `openapi.json`, `permissions.json` |
| `web/src/design-system/` | Thư viện component, shell, token, icon, gating quyền, port + fake port (`session/`) của web |
| `web/src/screens/` | Màn web theo miền: auth, account, customers, orders, inventory, settings, warranty |
| `web/src/test/` | Vitest: render mọi màn, độ phủ class CSS, màn kho |
| `mobile/lib/design_system/` | Widget, shell, token, icon, gating, port + fake port của Flutter |
| `mobile/lib/screens/` | Màn mobile theo miền (cùng bộ với web, trừ màn Cấu hình) |
| `mobile/test/` | Widget test Flutter |
| `design-system/` | Nguồn token/icon (JSON), generator, guard parity/drift/tiền/màn quét web + mobile |
| `.github/workflows/` | CI năm lane (`ci.yml`) và kiểm docs (`crew-docs.yml`) |
| `_bmad-output/` | Tài liệu kế hoạch BMad (PRD, spine, UX, epics, story); không phải nguồn code |

## Danh sách flow

<!-- crew-docs:flows:start -->
| Flow | Id | Điểm vào |
|------|----|----------|
| [Tài khoản, phân quyền và gating giao diện](flows/accounts-permissions.md) | `accounts-permissions` | `backend/scripts/generate-permissions.ts`, `backend/src/auth/me.controller.ts`, `design-system/permissions/build-permission-keys.mjs` |
| [Đăng nhập, phiên và mật khẩu](flows/auth-session.md) | `auth-session` | `backend/src/auth/auth.controller.ts`, `backend/src/auth/change-password.controller.ts`, `mobile/lib/screens/account/profile_screen.dart`, `mobile/lib/screens/auth/forgot_password_screen.dart`, `mobile/lib/screens/auth/login_screen.dart`, `web/src/main.tsx`, `web/src/screens/account/ProfileScreen.tsx`, `web/src/screens/auth/ForgotPasswordScreen.tsx`, `web/src/screens/auth/LoginScreen.tsx` |
| [Nền tảng backend: bootstrap, lỗi, Prisma, OpenAPI, storage](flows/backend-platform.md) | `backend-platform` | `backend/scripts/generate-openapi.ts`, `backend/src/health/health.controller.ts`, `backend/src/main.ts` |
| [Build, test và CI](flows/build-ci.md) | `build-ci` | `.github/workflows/ci.yml` |
| [Danh mục vật tư, nhóm hàng và bảng giá](flows/catalog.md) | `catalog` | `backend/src/catalog/product-groups.controller.ts`, `backend/src/catalog/product-prices.controller.ts`, `backend/src/catalog/products.controller.ts` |
| [Khách hàng và nguồn khách](flows/customers.md) | `customers` | `backend/src/customers/customer-sources.controller.ts`, `backend/src/customers/customers.controller.ts`, `mobile/lib/screens/customers/customer_detail_screen.dart`, `mobile/lib/screens/customers/customer_list_screen.dart`, `mobile/lib/screens/customers/customer_pick_screen.dart`, `web/src/screens/customers/CustomerDetailScreen.tsx`, `web/src/screens/customers/CustomerListScreen.tsx`, `web/src/screens/customers/CustomerPickScreen.tsx` |
| [Design system: token, icon, component, shell, định dạng tiền](flows/design-system.md) | `design-system` | `design-system/icons/build-icons.mjs`, `design-system/tokens/build-tokens.mjs` |
| [Domain event, nhật ký audit và thông báo](flows/domain-events-audit.md) | `domain-events-audit` | — |
| [Tồn kho, giữ hàng và phiếu kho](flows/inventory.md) | `inventory` | `backend/src/inventory/stock-items.controller.ts`, `backend/src/inventory/stock-vouchers.controller.ts`, `backend/src/orders/orders.controller.ts`, `mobile/lib/screens/inventory/inventory_screen.dart`, `mobile/lib/screens/inventory/stock_vouchers_screen.dart`, `web/src/screens/inventory/InventoryScreen.tsx`, `web/src/screens/inventory/StockVouchersScreen.tsx` |
| [Báo giá và đơn hàng](flows/orders.md) | `orders` | `backend/src/orders/orders.controller.ts`, `mobile/lib/screens/orders/create_quote_screen.dart`, `mobile/lib/screens/orders/discount_approval_screen.dart`, `mobile/lib/screens/orders/order_detail_screen.dart`, `mobile/lib/screens/orders/order_list_screen.dart`, `mobile/lib/screens/orders/order_status_change_screen.dart`, `mobile/lib/screens/warranty/warranty_lookup_screen.dart`, `web/src/screens/orders/CreateQuoteScreen.tsx`, `web/src/screens/orders/DiscountApprovalScreen.tsx`, `web/src/screens/orders/OrderDetailScreen.tsx`, `web/src/screens/orders/OrderStatusChangeScreen.tsx`, `web/src/screens/orders/OrdersListScreen.tsx`, `web/src/screens/warranty/WarrantyLookupScreen.tsx` |
| [Cấu hình hệ thống: thuế VAT và cờ nghiệp vụ](flows/system-settings.md) | `system-settings` | `backend/src/feature-flags/feature-flags.controller.ts`, `backend/src/settings/settings.controller.ts` |
<!-- crew-docs:flows:end -->

## Cách dùng docs

- `docs/architecture.md`: thành phần, nơi lưu dữ liệu, dịch vụ bên ngoài, cách triển khai.
- `docs/flows/<id>.md`: mỗi flow nghiệp vụ hoặc kỹ thuật có một trang.
- `docs/flows.yaml`: nguồn sự thật flow ↔ file, cho máy đọc.
- `docs/files.md`: tra ngược file → flow, sinh tự động bằng `crew-docs generate`.
