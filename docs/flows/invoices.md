# Hoá đơn nội bộ và PDF

> Flow `invoices`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow invoices` in ra đúng danh sách đó.

## Mục đích

Hoá đơn bán hàng NỘI BỘ (FR-27, FR-28): một **bản chụp bất biến** của một version đơn đã chốt — khách hàng,
bên bán (pháp nhân công ty), dòng, VAT và tổng — kèm số hoá đơn nội bộ và file PDF. Hoá đơn không phải hoá đơn
điện tử và không gửi đi đâu; đây là chứng từ để công ty đối chiếu và in.

Phạm vi flow:

- **Xem trước** (`GET /orders/:id/invoices`): danh sách hoá đơn đã lập của đơn và cờ `creatable` / `blockedReason`.
- **Lập** (`POST /orders/:id/invoices`): chụp version hiện tại thành hoá đơn. Gọi lại cho cùng version trả đúng hoá đơn cũ.
- **Xem chi tiết** (`GET /orders/:id/invoices/:invoiceId`).
- **Xuất PDF** (`POST /orders/:id/invoices/:invoiceId/pdf`) và **tải PDF** (`GET …/pdf`): render MỘT lần từ snapshot, rồi tải lại cùng file.

Không tính tiền mới: tổng là đầu ra của resolver duy nhất (`orders`, AD-16), mỗi dòng lấy đúng `amount` server đã tính.
Trước khi lưu, snapshot kiểm tra tổng dòng khớp tiền hàng; lệch là lỗi định giá nên không lưu.

## Điểm vào

HTTP (JWT; `PermissionsGuard` toàn cục). Mọi route cần `invoices.manage` và `orders.view_all` hoặc `orders.view_own`:

- `GET /orders/:id/invoices` — `InvoicesController.overview` ⇒ `InvoicesOverviewResponseDto`.
- `POST /orders/:id/invoices` — `InvoicesController.create`, `@HttpCode(200)`: tạo mới và lần gọi lại đều trả 200.
- `GET /orders/:id/invoices/:invoiceId` — `InvoicesController.detail` ⇒ `InvoiceDetailResponseDto`.
- `POST /orders/:id/invoices/:invoiceId/pdf` — `InvoicesController.exportPdf`, `@HttpCode(200)`.
- `GET /orders/:id/invoices/:invoiceId/pdf` — `InvoicesController.downloadPdf`.

Ngoài phạm vi đơn ⇒ 404 cho mọi route, kể cả lần lập lại (người ngoài phạm vi không bao giờ nhận được hoá đơn đã có).

Màn hình:

- Web: `InvoicesScreen` (lập và liệt kê), `InvoiceDetailScreen` (chi tiết, "Xuất PDF"); qua `InvoicesPort`.
- Mobile: `InvoicesScreen` + `InvoicesCubit`, `InvoiceDetailScreen` + `InvoiceDetailCubit`; qua `InvoicesPort`.

## Các bước

**A. Lập hoá đơn**

1. `backend/src/invoices/invoices.controller.ts` → `InvoicesController.create` gọi `InvoicesService.create`.
2. `backend/src/invoices/invoices.service.ts` → `create`: scope (404) → transaction: khoá dòng `orders` (`FOR UPDATE`) →
   đọc lại trạng thái và version → **replay**: nếu version này đã có hoá đơn thì trả đúng hoá đơn đó (trước cả kiểm tra
   điều kiện, nên đơn đã hoàn thành hay huỷ vẫn trả được hoá đơn đã có) → kiểm tra `invoiceBlocker` → cấp số → tạo dòng.
   Chỉ hoá đơn MỚI mới publish event, sau commit.
3. `backend/src/invoices/domain/invoice-eligibility.ts` → `invoiceBlocker`, thứ tự cố định: trạng thái không thuộc
   `INVOICE_ORDER_STATUSES` (đã chốt, cọc, thi công, nghiệm thu, đang giao, đã giao, hoàn thành) ⇒ 409; không có dòng ⇒ 400.
   Overview và POST gọi cùng hàm, nên màn không hứa điều server từ chối.
4. `backend/src/invoices/domain/invoice-snapshot.ts` → `buildInvoiceSnapshot`: khách hàng, bên bán (bản sao, không tham chiếu),
   dòng (đánh lại `displayOrder` 0..n-1), VAT, chiết khấu đã duyệt đã chốt trên version, tổng. Không có MST khách thì để trống (cá nhân không có MST).
5. `backend/src/invoices/domain/invoice-number.ts` → `formatInvoiceNo`: `HD-{yyyy}-{seq 4 chữ số}`; `seq` lấy từ sequence
   `invoices.seq`, không reset theo năm; năm là năm phát hành theo UTC+7. `nextval` đã dùng thì số bị nhảy, không hoàn lại.
6. Sau commit: `InvoiceCreated` qua `EventBus`; `AuditSubscriber` ghi nhật ký.

**B. Render và tải PDF**

1. `backend/src/invoices/invoice-document.service.ts` → `exportPdf`: khoá hoá đơn, render `buildInvoiceHtml`
   (`invoice-template.ts`) qua `QuoteRendererPort` dùng chung, upload R2 bằng `StoragePort`, ghi `invoice_pdfs`.
   Transaction dài hơn mặc định của Prisma vì có khởi động Chromium và upload.
2. Khoá R2 cố định (`domain/invoice-file.ts` → `invoicePdfKey` = `invoices/{orderId}/{invoiceId}.pdf`; tên tải về
   `hoa-don-{invoiceNo}`). Thử lại sau lỗi ghi DB ghi đè đúng một object, không để lại file mồ côi.
3. Sau commit: `InvoicePdfExported`. `getPdf` đọc lại đúng khoá đó qua R2 và trả byte.
4. Số tiền bằng chữ dùng `common/money/amount-in-words.ts` (flow `backend-platform`); mẫu HTML là `invoice-template.ts`.

## Bất biến

| Bất biến | Nơi enforce | Test / guard canh |
|----------|-------------|-------------------|
| Một version có tối đa một hoá đơn (unique `order_version_id`); lập lại trả đúng hoá đơn cũ, không ghi, không event | `invoices_order_version_id_key`, replay trong `create` | `invoices.e2e.spec.ts` ("twice for the same version … ONE row, ONE audit row"), `invoices.db.integration.spec.ts` |
| Replay chạy TRƯỚC kiểm tra điều kiện: đơn đã huỷ/hoàn thành vẫn trả hoá đơn đã có | thứ tự trong `create` | `invoices.service.spec.ts` |
| Trạng thái và version được đọc lại dưới khoá đơn; version đổi sau lần đọc ⇒ 409 | `create` (re-read sau `FOR UPDATE`) | `invoices.service.spec.ts` ("revised between the scoped read and the lock") |
| Snapshot không tính tiền mới; tổng dòng lệch tiền hàng ⇒ ném lỗi, không lưu | `buildInvoiceSnapshot` | `invoice-domain.spec.ts` ("lines that do not add up … throws") |
| Bên bán và khách là bản sao; đổi nguồn sau này không đổi hoá đơn | `buildInvoiceSnapshot` | `invoice-domain.spec.ts` ("the seller is a copy") |
| Tiền trong DB là `BigInt`, chỉ đổi thành `number` ở `toView`; số lớn hơn INT4 vẫn đúng JSON | `invoices.service.ts` (`toView`) | `invoices.e2e.spec.ts` ("above INT4") |
| Một hoá đơn có đúng một file PDF (unique `invoice_id`); khoá R2 xác định | `invoice_pdfs_invoice_id_key`, `domain/invoice-file.ts` | `invoice-document.service.spec.ts`, `invoice-document.db.integration.spec.ts` |
| Số hoá đơn là `nextval`, không `count()+1` | `invoices.seq`, `invoices_seq_key` | `invoices.db.integration.spec.ts` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/invoices/invoices.controller.ts` | Năm route `/orders/:id/invoices` | `InvoicesController` |
| `backend/src/invoices/invoices.service.ts` | Lập, xem trước, replay, chi tiết | `InvoicesService` (`overview`, `create`), `ORDER_CHANGED_MESSAGE`, `toView` |
| `backend/src/invoices/invoice-document.service.ts` | Render, upload, tải PDF | `InvoiceDocumentService` (`detail`, `exportPdf`, `getPdf`), `INVOICE_PDF_NOT_EXPORTED_MESSAGE` |
| `backend/src/invoices/invoice-template.ts` | HTML hoá đơn | `buildInvoiceHtml`, `NOT_CONFIGURED_LABEL`, `NO_TAX_CODE_LABEL` |
| `backend/src/invoices/invoices.module.ts` | Module; import `OrdersModule` (scope và tổng), `StorageModule`, `SettingsModule` | `InvoicesModule` |
| `backend/src/invoices/domain/invoice-eligibility.ts` | Điều kiện lập; dùng chung overview và POST | `invoiceBlocker`, `INVOICE_ORDER_STATUSES`, `INVOICE_BLOCKED_MESSAGE` |
| `backend/src/invoices/domain/invoice-snapshot.ts` | Bản chụp bất biến | `buildInvoiceSnapshot` |
| `backend/src/invoices/domain/invoice-number.ts` | Số hoá đơn | `formatInvoiceNo` |
| `backend/src/invoices/domain/invoice-file.ts` | Tên file và khoá R2 | `invoiceFileName`, `invoicePdfKey` |
| `backend/src/invoices/domain/invoice-events.ts` | Event lập và xuất PDF | `InvoiceCreated`, `InvoicePdfExported` |
| `backend/src/invoices/dto/invoice-response.dto.ts`, `invoice-detail-response.dto.ts`, `invoices-overview-response.dto.ts` | Response | `InvoiceResponseDto`, `InvoiceDetailResponseDto`, `InvoicesOverviewResponseDto` |
| `backend/src/invoices/dto/invoice-line.dto.ts`, `invoice-seller.dto.ts`, `invoice-pdf-response.dto.ts` | Dòng, bên bán, response PDF | `InvoiceLineDto`, `InvoiceSellerDto`, `InvoicePdfResponseDto` |
| `backend/prisma/migrations/20261022150000_add_invoices/migration.sql` | Bảng `invoices` (snapshot đầy đủ bên bán, khách, VAT, tổng; unique `seq`, `invoice_no`, `order_version_id`), `invoice_lines` | — |
| `backend/prisma/migrations/20261022200000_add_invoice_pdfs/migration.sql` | Bảng `invoice_pdfs` (một dòng mỗi hoá đơn; CHECK `invoice_pdfs_size_positive`) | — |
| `mobile/lib/screens/invoices/invoices_screen.dart`, `invoices_cubit.dart`, `invoices_state.dart` | Màn lập và liệt kê | `InvoicesScreen`, `InvoicesCubit` |
| `mobile/lib/screens/invoices/invoice_detail_screen.dart`, `invoice_detail_cubit.dart`, `invoice_detail_state.dart` | Màn chi tiết | `InvoiceDetailScreen`, `InvoiceDetailCubit` |
| `mobile/lib/design_system/session/invoices_port.dart`, `fake_invoices_port.dart` | Port và fake mobile | `InvoicesPort`, `FakeInvoicesPort`, `InvoicePdfFile` |
| `mobile/lib/api/http_invoices_port.dart` | Port thật qua client sinh tự động | `HttpInvoicesPort` |
| `web/src/screens/invoices/InvoicesScreen.tsx`, `web/src/screens/invoices/InvoiceDetailScreen.tsx`, `web/src/screens/invoices/invoices.css` | Màn và style web | `InvoicesScreen`, `InvoiceDetailScreen` |
| `web/src/design-system/session/invoices-port.ts`, `fake-invoices-port.ts` | Port và fake web | `InvoicesPort`, `FakeInvoicesPort` |
| `web/src/api/http-invoices-port.ts` | Port thật web | `HttpInvoicesPort` |

## Dữ liệu

- `invoices`: snapshot một dòng — số (`seq`, `invoice_no`), đơn và version, khách (SĐT, tên, MST, địa chỉ), bên bán
  (pháp nhân công ty đã chụp), VAT (suất, có áp hay không), chiết khấu, `subtotal`, `vat_amount`, `total`, `issued_at`,
  người tạo. Không có cột sửa; bản ghi không được cập nhật sau khi tạo.
- `invoice_lines`: dòng theo `display_order` (tên, đơn vị, số lượng, đơn giá, thành tiền).
- `invoice_pdfs`: khoá R2 và kích thước của file đã render, người xuất.
- Đọc từ flow khác: `orders` (scope, version, tổng), `system-settings` (pháp nhân công ty), `customers` (qua snapshot khách).
- Sự kiện: `InvoiceCreated`, `InvoicePdfExported` (`target` là đơn).
- Gọi ngoài: Chromium qua `QuoteRendererPort`; Cloudflare R2 qua `StoragePort`.

## Flow liên quan

- orders: scope, version đã chốt, tổng (resolver duy nhất); `orders/` không import ngược lại.
- contracts: cùng khung snapshot và số + PDF, nhưng hợp đồng đọc trạng thái đơn hiện tại; hoá đơn đóng băng theo version.
- payments: lịch thanh toán và số đã thu KHÔNG là điều kiện lập hoá đơn (xem phần Kiểm tra điều kiện).
- system-settings: pháp nhân công ty chụp vào hoá đơn.
- backend-platform: `amount-in-words.ts`, `uuid-param.ts`, `StoragePort`, error envelope.
- domain-events-audit: `EventBus`, `AuditSubscriber` ghi `InvoiceCreated` và `InvoicePdfExported`.

## Tests

Backend, hermetic (`npm test`):

- `backend/test/invoice-domain.spec.ts`: `invoiceBlocker`, `buildInvoiceSnapshot` (tổng, VAT 0, chiết khấu đã duyệt, bản sao bên bán, lỗi khi dòng lệch tổng).
- `backend/test/invoice-template.spec.ts`: HTML hoá đơn.
- `backend/test/invoices.service.spec.ts`: luồng lập, 409 khi version đổi giữa đọc và khoá, khách không có MST.
- `backend/test/invoices.e2e.spec.ts`: HTTP; 401 khi thiếu token; lập hai lần cho một version ⇒ hai 200 cùng nội dung; số lớn hơn INT4 giữ đúng JSON; đơn hoàn thành vẫn lập được.
- `backend/test/invoice-document.service.spec.ts`, `backend/test/invoice-document.e2e.spec.ts`: render, khoá R2 cố định, tải PDF.

Backend, lane DB (`*.db.integration.spec.ts`, `npm run test:db`):

- `backend/test/invoices.db.integration.spec.ts`, `backend/test/invoice-document.db.integration.spec.ts`: ràng buộc unique, CHECK và số lớn hơn INT4 trên Postgres thật.

Web, mobile và guard giao diện:

- `design-system/screens/invoices.test.mjs`: text-guard màn web/mobile (không tự tính tiền).
- `web/src/test/invoices-screen.test.tsx`, `web/src/test/invoice-detail-screen.test.tsx`, `web/src/test/http-invoices-port.test.ts`.
- `mobile/test/screens/invoices/invoices_cubit_test.dart`, `mobile/test/screens/invoices/invoices_screen_test.dart`, `mobile/test/screens/invoices/invoice_detail_cubit_test.dart`, `mobile/test/screens/invoices/invoice_detail_screen_test.dart`, `mobile/test/api/http_invoices_port_test.dart`.
