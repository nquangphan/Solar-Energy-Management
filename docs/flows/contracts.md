# Hợp đồng: HĐ Thi công và HĐ Mua bán (PDF)

> Flow `contracts`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow contracts` in ra đúng danh sách đó.

## Mục đích

Sinh hợp đồng PDF từ một đơn đã chốt (FR-13): **HĐ Thi công** khi đơn có thi công, **HĐ Mua bán** khi chỉ mua
thiết bị. Loại hợp đồng do server suy ra từ cờ phạm vi của đơn; client không chọn. Mỗi lần bấm sinh là một hợp
đồng MỚI (số, khoá R2 và dòng DB riêng); hợp đồng đã in hoặc đã ký không bao giờ bị ghi đè.

Phạm vi flow:

- **Xem trước** (`GET /orders/:id/contracts`): các trường sẽ in, danh sách hợp đồng đã sinh và cờ
  `generatable` / `blockedReason` — cùng một hàm kiểm tra với lệnh POST, nên màn không hứa điều server từ chối.
- **Sinh** (`POST /orders/:id/contracts`): khoá đơn, cấp số, render HTML → PDF, lưu R2, ghi dòng `contracts`.
- **Tải lại** (`GET /orders/:id/contracts/:contractId/pdf`): proxy byte của R2 qua API có token (AD-3), không link public.

Không có tiền nào được tính trong flow này: dòng, tổng, VAT và các đợt trả góp đều lấy từ `orders` (một bộ
resolver duy nhất, AD-16) và từ `payments` (lịch đã lưu). Giá vốn không bao giờ đi vào HTML hợp đồng.

## Điểm vào

HTTP (JWT; `PermissionsGuard` toàn cục):

- `GET /orders/:id/contracts` — `ContractsController.overview`, `@RequirePermissions(contracts.generate)` và
  `@RequireAnyPermissions(orders.view_all, orders.view_own)`. Ngoài phạm vi ⇒ 404.
- `POST /orders/:id/contracts` — `ContractsController.generate`, cùng quyền. Thành công trả **201** với `ContractResponseDto`.
- `GET /orders/:id/contracts/:contractId/pdf` — `ContractsController.downloadPdf`, cùng quyền. Hợp đồng của đơn khác
  trả 404 giống hợp đồng không tồn tại.

Màn hình:

- Web: `ContractsScreen` (`web/src/screens/contracts/ContractsScreen.tsx`), qua `ContractsPort`.
- Mobile: `ContractsScreen` (`mobile/lib/screens/contracts/contracts_screen.dart`), `ContractsCubit` giữ trạng thái.

## Các bước

**A. Sinh hợp đồng**

1. `backend/src/contracts/contracts.controller.ts` → `ContractsController.generate`: đọc `orders.view_*` và `contracts.generate`,
   resolve VAT và cờ bậc thang giá tươi cho request, rồi gọi `ContractsService.generate`.
2. `backend/src/contracts/contracts.service.ts` → `generate`: scope (404) → transaction: khoá dòng `orders`
   (`FOR UPDATE`, khoá hệ thống đứng đầu) → đọc lại trạng thái và version → kiểm tra `contractBlocker`
   → cấp số → render → upload R2 → tạo dòng. Event chỉ publish SAU commit.
3. `backend/src/contracts/domain/contract-eligibility.ts` → `contractBlocker`, thứ tự cố định:
   trạng thái không thuộc `CONTRACT_ORDER_STATUSES` (chỉ đơn đã chốt, chưa huỷ; `hoanthanh` vẫn in lại được)
   ⇒ 409; không có dòng vật tư ⇒ 400; chưa có lịch thanh toán ⇒ 409; lịch không khớp tổng ⇒ chặn.
4. `backend/src/contracts/domain/contract-type.ts` → `contractTypeFor`: `scopeThiCong` ⇒ Thi công, còn lại ⇒ Mua bán.
5. `backend/src/contracts/domain/contract-number.ts` → `formatContractNo`: `HĐTC-{seq}/{yyyy}` hoặc `HĐMB-{seq}/{yyyy}`;
   `seq` lấy từ sequence `contracts.seq` TRƯỚC khi render (số được in trong PDF), không reset theo năm; năm là năm
   phát hành theo UTC+7. Khoá R2: `contractPdfKey` = `contracts/{orderId}/{contractId}.pdf`.
6. `backend/src/contracts/contract-template.ts` → `buildContractHtml`: HTML thuần từ dữ liệu đã tính sẵn; điều khoản
   tĩnh lấy từ `clauses/sale-clauses.ts` và `clauses/construction-clauses.ts`. Mọi phần điền được bọc `<!--d-->…<!--/d-->`.
   Số tiền bằng chữ dùng `common/money/amount-in-words.ts` (flow `backend-platform`).
7. Bên bán lấy từ pháp nhân công ty (`settings` / `domain/company-legal-entity.ts`, flow `system-settings`). Trường chưa
   cấu hình in "Chưa cấu hình" và KHÔNG chặn sinh (F-4).
8. Sau commit: `ContractGenerated` qua `EventBus` (AD-18); `AuditSubscriber` ghi nhật ký. Producer không gọi audit trực tiếp.

**B. Xem trước và tải lại**

1. `ContractsService.overview` dùng `loadInputs` (cùng hàm với `generate`) trên client thường, không khoá, và trả
   `generatable` + `blockedReason`.
2. `ContractsService.getPdf`: scope trước, rồi tra hợp đồng theo `(orderId, contractId)`, rồi đọc R2 qua `StoragePort`.

## Bất biến

| Bất biến | Nơi enforce | Test / guard canh |
|----------|-------------|-------------------|
| Mỗi lần sinh là dòng, số và khoá R2 mới; không ghi đè | `generate` luôn `create`; khoá gắn `contractId` | `contracts.service.spec.ts`, `contracts.db.integration.spec.ts` |
| Số hợp đồng lấy từ `nextval`, không `count()+1` | `contracts.seq`, `contracts_seq_key` unique | `contracts.db.integration.spec.ts` |
| Trạng thái đơn, version và lịch được đọc LẠI dưới khoá đơn; lines đã cũ ⇒ 409 | `generate` (re-read sau `FOR UPDATE`) | `contracts.service.spec.ts`, `contracts.e2e.spec.ts` |
| Overview và POST dùng cùng một verdict | `contractBlocker` gọi từ `loadInputs` | `contract-domain.spec.ts` |
| Loại hợp đồng do server suy ra, không nhận từ client | `contractTypeFor` | `contract-domain.spec.ts` |
| Không có giá vốn trong HTML hợp đồng; không tính tiền trong template | `buildContractHtml` nhận dữ liệu đã tính | `contract-template.spec.ts` |
| Event sau commit; không có `AuditService` trong producer | `generate` publish sau `$transaction` | `contracts.service.spec.ts`, `contracts.e2e.spec.ts` |
| Hợp đồng đơn khác ⇒ 404 như không tồn tại | scope trước, lookup kèm `orderId` | `contracts.e2e.spec.ts` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/contracts/contracts.controller.ts` | Ba route `/orders/:id/contracts` | `ContractsController` (`overview`, `generate`, `downloadPdf`) |
| `backend/src/contracts/contracts.service.ts` | Sinh, xem trước, tải lại | `ContractsService` (`overview`, `generate`, `getPdf`, `loadInputs`), `ORDER_CHANGED_MESSAGE` |
| `backend/src/contracts/contracts.module.ts` | Module; import `OrdersModule` (renderer dùng chung), `StorageModule`, `SettingsModule`, `FeatureFlagsModule`, `AccountsModule` | `ContractsModule` |
| `backend/src/contracts/contract-template.ts` | HTML hợp đồng (thuần, không I/O) | `buildContractHtml` |
| `backend/src/contracts/clauses/sale-clauses.ts` | Điều khoản HĐ Mua bán, chép nguyên văn từ mẫu công ty | `SALE_CLAUSES` |
| `backend/src/contracts/clauses/construction-clauses.ts` | Điều khoản HĐ Thi công | `CONSTRUCTION_CLAUSES` |
| `backend/src/contracts/domain/contract-eligibility.ts` | Điều kiện sinh; dùng chung overview và POST | `contractBlocker`, `CONTRACT_ORDER_STATUSES`, `CONTRACT_BLOCKED_MESSAGE` |
| `backend/src/contracts/domain/contract-type.ts` | Loại hợp đồng từ cờ phạm vi | `contractTypeFor`, `CONTRACT_TYPE`, `CONTRACT_TYPES` |
| `backend/src/contracts/domain/contract-number.ts` | Số, tên file và khoá R2 | `formatContractNo`, `contractFileName`, `contractPdfKey` |
| `backend/src/contracts/domain/contract-events.ts` | Event sinh hợp đồng | `ContractGenerated` |
| `backend/src/contracts/dto/contract-response.dto.ts`, `backend/src/contracts/dto/contracts-overview-response.dto.ts` | Response một hợp đồng và overview | `ContractResponseDto`, `ContractsOverviewResponseDto` |
| `backend/prisma/migrations/20261022120000_add_contracts/migration.sql` | Bảng `contracts`, sequence, unique `seq`/`contract_no`, index theo đơn và version | — |
| `mobile/lib/screens/contracts/contracts_screen.dart`, `contracts_cubit.dart`, `contracts_state.dart` | Màn và trạng thái mobile | `ContractsScreen`, `ContractsCubit` |
| `mobile/lib/design_system/session/contracts_port.dart`, `fake_contracts_port.dart` | Port và fake mobile | `ContractsPort`, `FakeContractsPort` |
| `mobile/lib/api/http_contracts_port.dart` | Port thật qua client sinh tự động | `HttpContractsPort` |
| `web/src/screens/contracts/ContractsScreen.tsx`, `web/src/screens/contracts/contracts.css` | Màn và style web | `ContractsScreen` |
| `web/src/design-system/session/contracts-port.ts`, `fake-contracts-port.ts` | Port và fake web | `ContractsPort`, `FakeContractsPort` |
| `web/src/api/http-contracts-port.ts` | Port thật web | `HttpContractsPort` |

## Dữ liệu

- Bảng `contracts`: `id`, `seq` (unique, từ sequence `contracts.seq`), `order_id` (FK `orders`), `order_version_id`,
  `type` (CHECK `contracts_type_known`), `contract_no` (unique), `pdf_key` (khoá R2), `pdf_size` (CHECK `contracts_pdf_size_positive`),
  `file_name`, `created_by_account_id`, `created_at`. Không có cột trạng thái: hợp đồng là append-only.
- Đọc từ flow khác: `orders` (scope, dòng và tổng qua `OrdersService`), `payments` (lịch trả góp và các đợt), `system-settings` (pháp nhân công ty), `accounts-permissions` (quyền tươi mỗi request).
- Sự kiện: `ContractGenerated` (`target` là đơn, để nhật ký của đơn đầy đủ). Payload không chứa thông tin khách hàng hay công ty.
- Gọi ngoài: Chromium qua `QuoteRendererPort` dùng chung (một renderer cho cả app); Cloudflare R2 qua `StoragePort`.

## Flow liên quan

- orders: scope, dòng và tổng; `orders/` không import ngược lại `contracts/`.
- payments: lịch trả góp là điều kiện sinh; lịch lệch tổng chặn sinh.
- system-settings: pháp nhân công ty in ở bên bán (`company-legal-entity.ts`).
- invoices: cùng mẫu "snapshot + số + PDF", nhưng hoá đơn đóng băng theo version; hợp đồng đọc lại trạng thái đơn hiện tại.
- backend-platform: `amount-in-words.ts`, `StoragePort` / R2, `AllExceptionsFilter`.
- domain-events-audit: `EventBus`, `AuditSubscriber` ghi `ContractGenerated`.

## Tests

Backend, hermetic (`npm test`):

- `backend/test/contract-domain.spec.ts`: thứ tự kiểm tra của `contractBlocker`, `contractTypeFor`, số và tên file theo múi giờ UTC+7.
- `backend/test/contract-template.spec.ts`: HTML hợp đồng.
- `backend/test/contracts.service.spec.ts`: luồng `generate` (khoá → đọc lại → số → render → upload → tạo dòng → publish một lần sau commit).
- `backend/test/contracts.e2e.spec.ts`: HTTP của ba route.

Backend, lane DB (`*.db.integration.spec.ts`, `npm run test:db`):

- `backend/test/contracts.db.integration.spec.ts`: hai lần sinh song song trên hai đơn ⇒ hai số khác nhau, không P2002; hai lần sinh trên cùng đơn được tuần tự hoá bởi khoá dòng; các ca khoá FORCED (người giữ khoá đổi lịch, sửa dòng, mở lại đơn) ⇒ lần sinh chờ rồi từ chối đúng lý do.

Web, mobile và guard giao diện:

- `design-system/screens/contracts.test.mjs`: text-guard màn web/mobile.
- `web/src/test/contracts-screen.test.tsx`, `web/src/test/http-contracts-port.test.ts`.
- `mobile/test/screens/contracts/contracts_cubit_test.dart`, `mobile/test/screens/contracts/contracts_screen_test.dart`, `mobile/test/api/http_contracts_port_test.dart`.
