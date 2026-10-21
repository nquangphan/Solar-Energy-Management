---
baseline_commit: 66afdfe
---

# Story 7.5: Xem & xuất Hoá đơn PDF

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền hoá đơn (`invoices.manage` — nhãn registry "Tạo/xuất hoá đơn"),
I want mở lại một Hoá đơn đã tạo để xem đủ nội dung (số, ngày, người bán, khách, dòng, VAT, tổng, gắn đúng Đơn) và xuất ra PDF để tải/chia sẻ,
so that in hoặc gửi hoá đơn cho khách khi cần, với nội dung đúng y bản đã lập ở Story 7.4.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-22, sau commit `66afdfe` — 7.4 done)

- **Hoá đơn đã có trong DB (7.4):** `Invoice` + `InvoiceLine` (`backend/prisma/schema.prisma:744-803`). Snapshot bất biến: khách (`customerSdt/Name/TaxCode/Address`), **người bán** (`sellerLegalName/TaxCode/Address/Representative/RepresentativeTitle/Phone/BankAccount` — `''` = chưa cấu hình lúc lập), `vatRate`, `applyVat`, tiền `BigInt` (`subtotal/discountAmount/vatAmount/total`, dòng `amount`), `unitPrice`/`qty` `Int`, `issuedAt`, `invoiceNo` (`HD-yyyy-NNNN`), `orderVersionId @unique`. **7.5 KHÔNG đọc lại đơn/khách/settings để dựng hoá đơn** — mọi thứ hiển thị và in ra đọc từ snapshot này (D1 của 7.4).
- **Module `invoices/`:** `invoices.service.ts` (`overview`, `create`, `toView` = điểm DUY NHẤT đổi `bigint → number`), `invoices.controller.ts` (`GET/POST /orders/:id/invoices`, `@Controller('orders')`), `invoices.module.ts` (`imports: [OrdersModule, SettingsModule, FeatureFlagsModule, AccountsModule]`; **chưa có** `StorageModule`, chưa dùng renderer). DTO `invoice-response.dto.ts`, `invoices-overview-response.dto.ts`. Comment module ghi rõ "No PDF and no R2 here — viewing and exporting is Story 7.5".
- **Quyền:** `PERM.invoicesManage = 'invoices.manage'` ("Tạo/xuất hoá đơn"). **KHÔNG thêm key** ⇒ `permissions.json` không đổi. Mobile dùng `AppPermissionKeys` [memory: mobile-screens-use-apppermissionkeys-not-appperm].
- **Hạ tầng PDF có sẵn — TÁI DÙNG, không viết mới:**
  - `QuoteRendererPort.renderPdf(html) → Buffer` (`backend/src/orders/quote/quote-renderer.port.ts`) — `OrdersModule` **export** binding này (`orders.module.ts:59`, MỘT Chromium cho cả app; `ContractsModule` không bind renderer riêng). Puppeteer 25 ESM-only đã lazy import [memory: puppeteer25-esm-lazy-import-jest].
  - `StoragePort.putObject/getObject` (`backend/src/storage/storage.port.ts`) qua `StorageModule` (AD-3).
  - Helper template `escapeHtml`, `formatMoney`, `formatDateVn` (UTC+7), `loadAssets` (font + **logo**), `buildFontFaces` ở `backend/src/orders/quote/quote-template.ts` — `contracts/contract-template.ts` đã import từ đây. Tài sản bundled ở `backend/assets/` (đã có exception `.gitignore` [memory: dot-gitignore-assets-swallows-backend-assets]).
- **Khuôn gần nhất = `contracts/` (7.3):** `contract-template.ts` (template thuần, mọi chuỗi qua `escapeHtml`, ZERO số học tiền, `@page { size: A4 }`, bảng dòng + hàng tổng + khối ký); `ContractsService.getPdf` (scope `assertScoped` TRƯỚC lookup, row của đơn khác ⇒ 404 "Không tìm thấy…", rồi `storage.getObject`); `ContractsController.downloadPdf` (`StreamableFile`, `Content-Disposition: attachment; filename="…"`, `@ApiProduces('application/pdf')`). Tên file ASCII (header không mang được `Đ`) — `contract-number.ts:18-38`.
- **"Chia sẻ/tải tương tự báo giá" (AC epic) — đã có trên client:** web `shareFiles({ files: [pdf], title: pdf.name, fallbackDownload: true })` (`web/src/design-system/components/share` export ở `components/index.ts:95`; `ContractsScreen.tsx:114-117`); mobile `AppShareFn` + `platformShareXFiles` (`mobile/lib/design_system/components/share_button.dart:15-24`), seam `shareImpl` để test không chạm platform channel (`contracts_screen.dart:68-76,114-130`). Báo giá (4.8) là khuôn POST xuất → GET bytes proxy (`orders.controller.ts:723-830`, `quote-export.service.ts`).
- **Client 7.4:** web `web/src/screens/invoices/InvoicesScreen.tsx` + `invoices.css`; mobile `mobile/lib/screens/invoices/invoices_screen.dart`; port `invoices-port.ts`/`invoices_port.dart` (`getOverview`, `createInvoice`) + fake. Danh sách "Hoá đơn đã tạo" hiện `số · Bản n · dd/MM/yyyy` + `<Money>` — **chưa có lối mở xem**.
- **Guard 7.4 phải cập nhật:** `design-system/screens/invoices.test.mjs:209-215` CẤM `'Xuất PDF'`/`'Xem lại'` trong code màn hoá đơn ("Story 7.5 owns it") — story này thay ca đó bằng ca dương (D8). `SHARED_LABELS` (dòng 70-93) và `BANNED` (dòng 95-103) là khuôn cho màn mới.
- **UX đã vẽ** (`mockups/all-screens.html:2745-2860` `#s-invoice`): khối văn bản hoá đơn — đầu trang người bán (tên + MST), pill "Số HĐ", tiêu đề **"HOÁ ĐƠN BÁN HÀNG"**, "Ngày lập: 06/07/2026 · Gắn đơn: …", dòng khách (tên — MST — địa chỉ), bảng `Hạng mục | SL | Đơn giá | Thành tiền`, "Tổng trước VAT … · VAT 8% …", "Tổng thanh toán …", khối ký **"NGƯỜI LẬP PHIẾU" / "GIÁM ĐỐC"** (cũng là FR-21: bản xuất có khối chữ ký + logo & thông tin công ty); nút primary **"Xuất PDF"** (`ic-download`); banner "không tích hợp HĐĐT". Mobile: bảng 2 cột `Tên ×SL | Thành tiền`, nút "Xuất PDF" ở đáy.
- **PRD FR-28:** "Xem Hoá đơn gắn với Đơn (số, ngày, tổng tiền); xuất/chia sẻ PDF." FR-21 (báo giá): "nút Share dùng native share bottom sheet… Web hành xử tương tự (share/download)".

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — PDF dựng CHỈ từ snapshot hoá đơn; render MỘT lần, lưu R2, các lần xuất sau trả lại đúng file đó.**
- Hoá đơn bất biến ⇒ nội dung PDF bất biến. Render lại mỗi lần là phí Chromium và sinh nhiều bản byte khác nhau (metadata ngày tạo PDF) cho cùng một chứng từ. Nên: lần "Xuất PDF" đầu render → `putObject` → ghi metadata; lần sau **không render, không upload, không event** — trả metadata đã lưu (idempotent, khuôn 200 của 7.2/7.4).
- KHÔNG render sẵn lúc tạo (7.4 đã done, không đổi `create`; render trong tx khoá đơn chỉ làm dài khoá).
- Key R2 **deterministic**: `invoices/{orderId}/{invoiceId}.pdf` (một chứng từ ⇒ một file; nếu ghi DB hỏng sau upload, lần xuất sau ghi đè cùng key — không rác R2).

**D2 — Bảng mới `invoice_pdfs`, KHÔNG thêm cột vào `invoices`.** Migration `backend/prisma/migrations/20261022200000_add_invoice_pdfs/migration.sql`.

```prisma
/// The exported PDF of one invoice (FR-28, AD-3). Rendered once from the invoice snapshot and
/// stored in R2; the invoice row itself is never updated. At most one per invoice.
model InvoicePdf {
  id                 String   @id @default(uuid())
  invoiceId          String   @unique @map("invoice_id")
  invoice            Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  pdfKey             String   @map("pdf_key")
  pdfSize            Int      @map("pdf_size")
  fileName           String   @map("file_name")
  createdByAccountId String   @map("created_by_account_id")
  createdBy          Account  @relation("InvoicePdfCreatedBy", fields: [createdByAccountId], references: [id], onDelete: Restrict)
  createdAt          DateTime @default(now()) @map("created_at")

  @@map("invoice_pdfs")
}
```
- Back-relation: `pdf InvoicePdf?` ở `Invoice`; `invoicePdfsCreated InvoicePdf[] @relation("InvoicePdfCreatedBy")` ở `Account`. Đặt model **sau `InvoiceLine`**, KHÔNG chèn giữa khối `///` của model khác (bài học 7.1 review #2). Nếu `prisma format` định dạng lại model không liên quan ⇒ hoàn tác, chèn tay (bài học 7.4 Debug Log).
- Lý do bảng riêng: `invoices` là snapshot append-only — giữ bất biến "hàng hoá đơn không bao giờ UPDATE" (guard D7 khoá điều đó); `invoiceId @unique` là lưới cuối cho "một file mỗi hoá đơn".
- CHECK tay: `invoice_pdfs_size_positive`: `pdf_size > 0`.
- Sinh SQL: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` [memory: prisma7-migrate-diff-flag-rename] + CHECK; `npx prisma migrate deploy` CHỈ lên `pns-postgres:5433`; diff sau deploy rỗng.

**D3 — Domain thuần `backend/src/invoices/domain/invoice-file.ts` + template `backend/src/invoices/invoice-template.ts`.**
- `invoice-file.ts`: `invoiceFileName(invoiceNo) = \`hoa-don-${invoiceNo}\`` (ASCII — `invoiceNo` là `HD-\d{4}-\d{4,}`, không dấu; KHÔNG đuôi, route tải gắn `.pdf`); `invoicePdfKey(orderId, invoiceId) = \`invoices/${orderId}/${invoiceId}.pdf\``.
- `invoice-template.ts` — `buildInvoiceHtml(data: InvoiceTemplateData): string`, THUẦN (test không browser/Nest/Prisma), khuôn `contract-template.ts`:
  - Input: `invoiceNo`, `issuedAt` (in UTC+7 qua `formatDateVn`), `quoteNo` (`quoteNumberOf(orderId)` — "Gắn đơn", CÙNG số với báo giá/hợp đồng khách cầm), `versionNo`, `seller` (7 trường), `customer` (`name`, `sdt`, `taxCode|null`, `address|null`), `lines[]` (`name, unit, qty, unitPrice, amount` theo `displayOrder`), `vatRate`, `applyVat`, `subtotal`, `discountAmount`, `vatAmount`, `total` — **tất cả là `number` đã qua `Number()` ở service**.
  - Bố cục theo mockup: đầu trang logo + người bán (tên, MST, địa chỉ, điện thoại, tài khoản ngân hàng) bên trái, `Số HĐ {invoiceNo}` bên phải; tiêu đề `HOÁ ĐƠN BÁN HÀNG`; `Ngày lập: dd/MM/yyyy · Gắn đơn: {quoteNo} (bản {versionNo})`; khối khách: Khách hàng, MST (null ⇒ `Không có MST`), Địa chỉ (null ⇒ bỏ dòng), Điện thoại; bảng `STT | Tên hàng | ĐVT | Số lượng | Đơn giá | Thành tiền`; hàng tổng `Tổng trước VAT` · `Chiết khấu` (CHỈ khi `discountAmount > 0`, in `-{số}`) · `VAT ({vatRate}%)` khi `applyVat`, `VAT (không áp)` khi không · `Tổng thanh toán`; khối ký `NGƯỜI LẬP PHIẾU` / `GIÁM ĐỐC` (tên người đại diện + chức danh dưới cột Giám đốc nếu có); chân trang `Hoá đơn nội bộ — không phải hoá đơn điện tử.`
  - Trường người bán `''` (sau trim) ⇒ in `Chưa cấu hình` — hằng **khai riêng** trong `invoices/` (KHÔNG import `contracts/domain/contract-type` — hai module độc lập, như 7.4 D3). Không bao giờ chặn xuất.
  - **ZERO số học tiền:** chỉ `formatMoney` các số đã lưu. Không cột giá vốn/bảo hành (hoá đơn không lưu `warrantyMonths` — đúng, KHÔNG đọc lại đơn để lấy).
  - Mọi chuỗi (tĩnh lẫn động) qua `escapeHtml` (tên hàng/khách có thể chứa `<`, `&`).
  - CSS khuôn `buildContractHtml` (A4, font Be Vietnam Pro qua `buildFontFaces(loadAssets())`, viền 1px, không shadow/gradient — guard text design-system không quét backend nhưng giữ cùng phong cách).
  - **KHÔNG in số tiền bằng chữ**: hàm `amountInWords` nằm ở `contracts/domain` (cấm import chéo) và mockup không có — Câu hỏi mở 1.
- `invoice-events.ts` thêm `InvoicePdfExported implements DomainEvent` (khuôn `InvoiceCreated`): `type = 'InvoicePdfExported'`, `target = { type: 'Order', id: orderId }`, `after = { invoiceId, invoiceNo, fileName }`, `occurredAt = createdAt` của `invoice_pdfs`. `AuditSubscriber` tự ghi (AD-18). Kiểm `AuditSubscriber` nhận mọi `DomainEvent` (không có allowlist type) — nếu có allowlist thì thêm vào đó.

**D4 — API (contract tiếng Anh, luật 8). Thêm 3 handler vào `InvoicesController` (`@Controller('orders')` sẵn có).** Cả 3: `@RequirePermissions(PERM.invoicesManage)` + `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`; `:id` và `:invoiceId` qua `ParseUUIDPipe`; quyền resolve TƯƠI (`accountPermissions.listForAccount`). Không cần VAT/cờ giá phân tầng (snapshot không tính lại) ⇒ dùng `assertScoped`, không `getScoped`.
- `GET /orders/:id/invoices/:invoiceId` ⇒ 200 `InvoiceDetailResponseDto` = mọi field của `InvoiceResponseDto` + :
  - `orderId: string`, `quoteNo: string` ("Gắn đơn"), `customerSdt: string`, `customerAddress: string | null`
  - `seller: InvoiceSellerDto` — 7 `string` (`legalName, taxCode, address, representative, representativeTitle, phone, bankAccount`), `''` = chưa cấu hình lúc lập (client hiện "Chưa cấu hình"). **Không** chứa chữ "đồng" trong description.
  - `lines: InvoiceLineDto[]` theo `displayOrder` tăng — `{ displayOrder, name, unit, qty, unitPrice, amount }`; `unitPrice` description "Đơn giá — số nguyên đồng.", `amount` "Thành tiền — số nguyên đồng."; `qty`/`displayOrder` KHÔNG có "đồng" [memory: money-fields-dong-matches-hop-dong].
  - `pdf: InvoicePdfResponseDto | null` — `null` khi chưa xuất.
- `POST /orders/:id/invoices/:invoiceId/pdf` ⇒ **`@HttpCode(200)`** `InvoicePdfResponseDto { fileName, pdfSize, exportedAt }` — lần đầu (render + lưu) và các lần sau (trả file đã lưu) cùng mã, cùng shape; body rỗng; description nói rõ. `fileName` có đuôi `.pdf`; `pdfSize` "Kích thước file — byte."
- `GET /orders/:id/invoices/:invoiceId/pdf` ⇒ bytes, `StreamableFile(type: 'application/pdf', disposition: attachment; filename="hoa-don-HD-2026-0731.pdf")`, `@ApiProduces('application/pdf')` (khuôn `ContractsController.downloadPdf`). Chưa xuất ⇒ 404 `'Hoá đơn này chưa xuất PDF.'`.
- Lỗi: 400 (id/invoiceId không UUID), 403, 404 — **ba nhánh 404 phân biệt thứ tự**: (1) đơn không tồn tại/ngoài phạm vi ⇒ message của `assertScoped` (CÙNG message đơn không tồn tại); (2) hoá đơn không thuộc đơn này/không tồn tại ⇒ `'Không tìm thấy hoá đơn.'` (hoá đơn của đơn KHÁC KHÔNG được lộ — `findFirst({ where: { id: invoiceId, orderId } })`); (3) GET pdf khi chưa xuất ⇒ `'Hoá đơn này chưa xuất PDF.'`. Xuất/xem KHÔNG phụ thuộc trạng thái đơn (đơn đã `huy`/`hoanthanh`/mở lại sau khi lập vẫn xem + xuất được — hoá đơn tồn tại thật). Mô tả OpenAPI liệt kê đủ nhánh.

**D5 — Service MỚI `backend/src/invoices/invoice-document.service.ts` (`InvoiceDocumentService`). `InvoicesService` (7.4) KHÔNG đổi byte nào.**
- Lý do tách: `create` của 7.4 có bất biến "không Storage/Renderer"; tách giữ nguyên 7.4 + test của nó (khuôn `QuoteExportService` tách khỏi `OrdersService`).
- Dependency: `OrdersService` (chỉ `assertScoped`), `PrismaService`, `EventBus`, `StoragePort`, `QuoteRendererPort`. KHÔNG `SettingsService` (người bán đã snapshot), KHÔNG `AuditService`/`NotificationDispatcher` (guard `no-direct-side-effect-outside-eventbus`).
- `detail(actor, perms, orderId, invoiceId)`: `assertScoped` TRƯỚC ⇒ `invoice.findFirst({ where: { id: invoiceId, orderId }, include: { orderVersion: { select: { versionNo } }, lines: { orderBy: { displayOrder: 'asc' } }, pdf: true } })` ⇒ null ⇒ 404 ⇒ map DTO. **`bigint → number` qua MỘT hàm** `toDetail(row)` trong file này (amount từng dòng + 4 tổng) — `bigint` lọt ra ⇒ `JSON.stringify` ném ⇒ 500.
- `exportPdf(actor, perms, orderId, invoiceId)` — thứ tự BẮT BUỘC:
  1. `this.orders.assertScoped(...)` — phạm vi TRƯỚC mọi thứ (kể cả lần xuất lại).
  2. `this.prisma.$transaction(async (tx) => {…}, { timeout: 30_000 })` (render cold Chromium + upload trong tx — khuôn `GENERATE_TX_TIMEOUT_MS` của contracts):
     1. **Op đầu:** `` tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} AND order_id = ${orderId} FOR UPDATE` `` — rỗng ⇒ 404 `'Không tìm thấy hoá đơn.'`. Khoá **dòng hoá đơn** (không khoá `orders`): thao tác không đụng tiền/đơn, snapshot bất biến; khoá đơn sẽ chặn mọi ghi đơn suốt lúc render vô ích. Không đường nào khoá `invoices` rồi mới khoá `orders` ⇒ không lệch thứ tự khoá toàn hệ thống (ghi lý do trong docstring).
     2. `tx.invoicePdf.findUnique({ where: { invoiceId } })` — có ⇒ `{ replay: true, row }` NGAY (0 render, 0 put, 0 event).
     3. `tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: { orderBy: { displayOrder: 'asc' } }, orderVersion: { select: { versionNo: true } } } })` ⇒ `buildInvoiceHtml(...)` (mọi tiền `Number()`).
     4. `const pdf = await this.renderer.renderPdf(html)`; `await this.storage.putObject(invoicePdfKey(orderId, invoiceId), pdf, 'application/pdf')`.
     5. `tx.invoicePdf.create({ data: { invoiceId, pdfKey, pdfSize: pdf.length, fileName: invoiceFileName(invoiceNo), createdByAccountId: actor } })` ⇒ `{ replay: false, row }`.
  3. **SAU commit, chỉ khi `replay === false`:** `eventBus.publish(new InvoicePdfExported(...))` ĐÚNG 1 lần.
  4. Trả `{ fileName: \`${row.fileName}.pdf\`, pdfSize: row.pdfSize, exportedAt: row.createdAt }`.
  - Render/upload ném ⇒ tx rollback ⇒ 0 dòng, 0 event. `create` ném sau upload ⇒ bytes ở key deterministic, lần sau ghi đè (chấp nhận, docstring).
- `getPdf(actor, perms, orderId, invoiceId)`: `assertScoped` ⇒ `invoice.findFirst({ where: { id: invoiceId, orderId }, include: { pdf: true } })` null ⇒ 404 hoá đơn; `pdf === null` ⇒ 404 `'Hoá đơn này chưa xuất PDF.'` ⇒ `storage.getObject(pdf.pdfKey)` ⇒ `{ body, fileName: \`${pdf.fileName}.pdf\` }`.
- Docstring class ghi đủ thứ tự + lý do khoá dòng hoá đơn + vì sao render một lần (khuôn `ContractsService`/`InvoicesService`).

**D6 — Module.** `invoices.module.ts`: `imports` thêm `StorageModule` (renderer đến từ `OrdersModule` đã import — KHÔNG bind renderer thứ hai); `providers: [InvoicesService, InvoiceDocumentService]`; cập nhật docstring (bỏ câu "No PDF and no R2 here", thêm lý do `StorageModule` + renderer dùng chung). `backend/test/orders-module-wiring.spec.ts` ca `InvoicesModule` hiện assert providers đúng `[InvoicesService]` ⇒ đổi thành đúng `[InvoicesService, InvoiceDocumentService]` và assert **KHÔNG** bind `QuoteRendererPort`/`StoragePort` (renderer dùng chung từ `OrdersModule`, storage từ `StorageModule`) — khuôn ca `ContractsModule`.

**D7 — Guard backend.**
- `backend/test/no-unscoped-order-write.spec.ts`: `FILE_CANH` thêm `{ file: 'invoices/invoice-document.service.ts', goiPhamVi: /this\.orders\.(?:getScoped|assertScoped)\s*\(/ }`; `CHAM_DON` thêm `.invoicePdf.*` (+ đảm bảo mẫu `.invoice.*` của 7.4 có `findFirst`) và `this.storage.getObject` / `this.renderer.renderPdf` nếu chưa có — chạm R2 trước scope cũng là rò. Anti-blind theo method (khuôn ca contracts dòng 284-292): trích thân `detail` (chứa `.invoice.findFirst(`), `exportPdf` (chứa `.invoicePdf.create(`), `getPdf` (chứa `this.storage.getObject(`), mỗi thân phải có `this.orders.assertScoped(`. Lời gọi viết liền một dòng, không chain `.create(...).catch()` [memory: prettier-chain-blinds-scope-guard].
- **Guard bất biến snapshot (mới, nhỏ):** trong cùng spec (hoặc `backend/test/invoice-immutable.spec.ts`): toàn `backend/src/**` KHÔNG có `.invoice.update(`/`.invoice.updateMany(`/`.invoice.upsert(`/`.invoice.delete`/`.invoiceLine.update…`/`.invoiceLine.delete…` — kèm assert chống-guard-rỗng (số file quét > 0, và sample `this.prisma.invoice.update(` BỊ bắt).

**D8 — Client (web + mobile parity; port + fake; MỘT màn mới mỗi nền tảng).**
- **Port** (method tiếng Anh, type mirror DTO field-for-field) — mở rộng `invoices-port.ts` / `invoices_port.dart` + 2 fake:
  - `getInvoice(orderId, invoiceId) → InvoiceDetail`
  - `exportInvoicePdf(orderId, invoiceId) → InvoicePdfInfo` (`{ fileName, pdfSize, exportedAt }`)
  - `downloadInvoicePdf(orderId, invoiceId)` → web `File` (tên `fileName`), mobile `InvoicePdfFile` (khuôn `ContractPdfFile` `contracts_port.dart:78`).
  - Lỗi reject theo envelope AD-5 (`InvoicesPortError` có sẵn).
  - Fake: hoá đơn mockup — người bán `CÔNG TY NLMT PHƯƠNG NAM`, MST `0312998771`, các trường người bán còn lại `''` (để màn hiện "Chưa cấu hình"); khách "VP Công Chứng Lê Đình Thao", MST `0316552018`, địa chỉ "122 Trần Não, TP. Thủ Đức"; 4 dòng (Tấm pin AE 630W 14 × 2.583.000 = 36.162.000; Inverter Solplanet ASW8000-S 1 × 18.500.000; Vật tư (gói) 1 × 12.400.000; Công lắp đặt 1 × 9.800.000), tổng trước VAT 76.862.000, VAT 8% 6.148.960, tổng 83.010.960 — **số đóng hộp, fake KHÔNG tính** (guard BANNED). `exportInvoicePdf` lần đầu đặt `pdf` cho hoá đơn đó, lần sau trả CÙNG `pdf` (mirror idempotent backend); `invoiceId` lạ ⇒ reject `{ status: 404, message: 'Không tìm thấy hoá đơn.' }`; `downloadInvoicePdf` khi chưa xuất ⇒ 404 `'Hoá đơn này chưa xuất PDF.'` (fake theo ĐÚNG luật backend — bài học 7.3 review #8 / 7.4 review #7). Fake hoá đơn do `createInvoice` tạo phải `getInvoice` được (không lệch hai kho dữ liệu trong fake).
- **Màn mới** web `web/src/screens/invoices/InvoiceDetailScreen.tsx` (class mới vào `invoices.css`, chỉ class có rule thật — guard css-class-coverage); mobile `mobile/lib/screens/invoices/invoice_detail_screen.dart` (seam `shareImpl` như `contracts_screen.dart`). Props `{ port, orderId, invoiceId, onBack?, (mobile) shareImpl? }`.
  - Topbar eyebrow `HOÁ ĐƠN`, title `Hoá đơn bán hàng`, back qua `onBack`.
  - Banner info cố định (CÙNG chuỗi 7.4): *"Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau)."*
  - Frame **văn bản hoá đơn** (component `Frame`/`AppFrame` + bảng design-system có sẵn — scout web/mobile cho table/list component trước khi dựng; cấm style ad-hoc AD-13): người bán (Tên công ty, MST, Địa chỉ, Điện thoại, Tài khoản ngân hàng — `''` ⇒ `Chưa cấu hình`); `HOÁ ĐƠN BÁN HÀNG`; `Số HĐ` = `invoiceNo`; `Ngày lập` = `dd/MM/yyyy` UTC+7; `Gắn đơn` = `{quoteNo} · Bản {versionNo}`; `Khách hàng`, `MST khách` (null ⇒ `Không có MST`), `Địa chỉ` (null ⇒ ẩn dòng); bảng dòng — web `Hạng mục | SL | Đơn giá | Thành tiền` (đơn giá + thành tiền qua `<Money>`), mobile theo mockup `{name} ×{qty}` + `MoneyText(amount)` (đơn giá có thể ẩn trên mobile như mockup); tổng: `Tổng trước VAT` (`subtotal`), `Chiết khấu` (CHỈ khi `discountAmount > 0` — phép so sánh, không phải số học; guard BANNED không chặn `>`), `VAT {vatRate}%` khi `applyVat` / `Không áp VAT` khi không (`vatAmount`), `Tổng thanh toán` (`total`) — mọi số tiền qua `<Money>`/`MoneyText`.
  - Dòng trạng thái file: `pdf === null` ⇒ `Chưa xuất PDF`; có ⇒ `Đã xuất PDF · {dd/MM/yyyy}`.
  - Nút primary **"Xuất PDF"** (icon download): `exportInvoicePdf` → `downloadInvoicePdf` → web `shareFiles({ files: [pdf], title: pdf.name, fallbackDownload: true })` / mobile `share(...)` → tải lại chi tiết. Disable in-flight + ref (bấm 2 lần ⇒ 1 lời gọi export). **KHÔNG ConfirmDialog** (xuất không phải hành động dữ liệu không đảo ngược — khác "Tạo hoá đơn"; và lặp lại là vô hại vì idempotent). Lỗi envelope ⇒ banner message server nguyên văn (AD-5); lỗi JS/DOM (share bị từ chối, `AbortError`) ⇒ fallback `Không xuất được PDF hoá đơn. Vui lòng thử lại.` (byte-identical hai nền tảng; `messageOf` chỉ nhận envelope — khuôn 7.3/7.4). Vì xuất idempotent, lỗi tải/chia sẻ sau khi xuất thành công chỉ cần cùng fallback — bấm lại không tạo bản thứ hai (khác hợp đồng 7.3).
  - Loading = Skeleton; lỗi tải = ErrorState `Không tải được hoá đơn.` + `Thử lại`.
- **Lối vào:** `InvoicesScreen` (web + mobile) thêm prop `onOpenInvoice?: (invoiceId: string) => void`; mỗi mục danh sách "Hoá đơn đã tạo" có nút **"Xem"** CHỈ khi có callback (caller truyền khi có route — chưa có composition root, TD-38, như 7.3/7.4). Không đổi phần tạo của 7.4.
- **Mobile 320/360 px:** không tràn với nhãn dài nhất (`HD-2026-123456`, tên hàng 120 ký tự, tên công ty 80 ký tự, `Đã xuất PDF · 31/12/2026`); bảng dòng mobile phải xuống dòng tên hàng, không cắt số tiền [memory: mobile-screens-need-widget-tests].

**D9 — Guard design-system.**
- `design-system/screens/invoices.test.mjs`:
  - `FILES` thêm 2 màn chi tiết; "every file exists" + "not blind" phủ file mới.
  - Thay ca dòng 209 ("no Xuất PDF / Xem lại") bằng: (a) `'Xuất PDF'` CHỈ xuất hiện ở 2 màn chi tiết (KHÔNG ở `InvoicesScreen`/`invoices_screen.dart`); (b) nút "Xuất PDF" gọi `exportInvoicePdf(` rồi `downloadInvoicePdf(` và share (web `shareFiles(`, mobile `shareImpl ?? platformShareXFiles` hoặc tương đương); (c) `exportInvoicePdf(` xuất hiện đúng 1 chỗ mỗi nền tảng; (d) KHÔNG ConfirmDialog trong màn chi tiết; (e) vẫn KHÔNG `'Xem lại'` (nhãn mockup không dùng — lối vào là "Xem").
  - Nhãn chung màn chi tiết byte-identical (bảng ở Dev Notes), so trên code đã bỏ comment (string literal giữ — bài học 7.4 review #5) + assert chống-guard-rỗng RAW.
  - Tiền: màn chi tiết render `subtotal`, `vatAmount`, `total`, `unitPrice`, `amount`, `discountAmount` CHỈ qua `<Money value={…}>` / `MoneyText(…)`; không `${…amount…}`/`${…total…}` nội suy; `MONEY` regex thêm `unitPrice`. `BANNED` áp cho file mới (port/fake/màn).
  - Ca money-fields (AC-10 của 7.4) mở rộng: `money-fields.mjs` thu `unitPrice`, `amount`; KHÔNG thu `qty`, `displayOrder`, `pdfSize`, `vatRate`, `versionNo`, `lineCount`.
  - Không literal quyền; mobile dùng `AppPermissionKeys`.
- Màn web mới ⇒ ca render `InvoiceDetailScreen` trong `web/src/test/screens-render.test.tsx` (guard đếm số file màn sẽ ĐỎ nếu quên).

### 3. Phạm vi

- **TRONG:** `InvoicePdf` + migration/CHECK; `invoice-file.ts`, `invoice-template.ts`, event `InvoicePdfExported`; `InvoiceDocumentService` + 3 route (xem chi tiết, xuất PDF idempotent dưới khoá dòng hoá đơn, tải bytes); module/wiring; guard phạm vi + guard bất biến snapshot; OpenAPI regen; web + mobile: port/fake mở rộng, màn "Xem hoá đơn" mới + nút "Xuất PDF" (share/download), nút "Xem" ở danh sách 7.4; parity guard; test 5 lane.
- **NGOÀI:** hoá đơn điện tử (VNPT/Viettel/MISA — Phase sau, PRD:499); số tiền bằng chữ (Câu hỏi mở 1); ảnh PNG chia sẻ (báo giá có ảnh, hoá đơn chỉ PDF — Câu hỏi mở 2); huỷ/điều chỉnh/thay thế hoá đơn; render lại PDF khi đổi template (Câu hỏi mở 3); gửi email/Zalo; router/HTTP adapter thật (TD-38); notification (Epic 9); sửa khe hở race `contracts.service.ts` (follow-up 7.4 review — KHÔNG đụng `contracts/*`).

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:643-646`)

- **Given** một Hoá đơn đã tạo, **When** xem, **Then** hiển thị số, ngày, tổng tiền, gắn đúng Đơn (FR-28).
- **Given** hoá đơn, **When** xuất, **Then** tạo PDF, binary ở R2, chia sẻ/download tương tự báo giá (FR-28, AD-3).

### AC dẫn xuất (đo được)

1. **AC-1 (xem = snapshot):** đơn fixture mockup (4 dòng, 76.862.000 / VAT 8% 6.148.960 / 83.010.960) đã lập hoá đơn ⇒ `GET /orders/:id/invoices/:invoiceId` 200: `invoiceNo`, `issuedAt`, `orderId` = đơn, `quoteNo = quoteNumberOf(orderId)`, `versionNo`, khách + người bán + 4 dòng theo `displayOrder` + VAT + 4 tổng **bằng đúng giá trị đọc từ dòng `invoices`/`invoice_lines` trong DB** (không số gõ tay [memory: handpicked-fixture-numbers-hide-formula-bugs]), `pdf: null`. Lane DB: sau khi lập, đổi tên/MST khách, đổi `company.*` settings, đổi VAT cấu hình, sửa giá danh mục ⇒ chi tiết VẪN trả giá trị cũ (đọc snapshot, không đọc lại đơn/khách/settings).
2. **AC-2 (gắn đúng đơn — không rò):** `invoiceId` của đơn B gọi qua đường của đơn A (cả hai trong phạm vi) ⇒ 404 `'Không tìm thấy hoá đơn.'` ở cả 3 route; đơn ngoài phạm vi (`orders.view_own`, không owner/assignee) ⇒ 404 CÙNG message đơn không tồn tại ở cả 3 route — kể cả khi hoá đơn ĐÃ có PDF (không rò bytes); `assertScoped` chạy TRƯỚC mọi đọc `invoice*`/R2 (unit thứ tự + guard D7).
3. **AC-3 (tiền integer, BigInt an toàn):** mọi field tiền trong chi tiết (4 tổng + `lines[].unitPrice`/`amount`) là `number` nguyên (`Number.isInteger`); lane DB: hoá đơn đơn tổng **> 2.147.483.647** ⇒ `GET` chi tiết 200 (không 500), `total` đúng; e2e đi qua serialize JSON thật — mutant trả thẳng `row.total`/`line.amount` (bigint) ⇒ ĐỎ.
4. **AC-4 (xuất PDF lần đầu):** `POST …/pdf` ⇒ 200 `{ fileName: 'hoa-don-HD-yyyy-NNNN.pdf', pdfSize > 0, exportedAt }`; `renderer.renderPdf` gọi đúng 1 lần với HTML dựng từ snapshot; `storage.putObject` đúng 1 lần, key `invoices/{orderId}/{invoiceId}.pdf`, content-type `application/pdf`; lane DB 1 dòng `invoice_pdfs`; `InvoicePdfExported` publish **đúng 1 lần** SAU commit (`toHaveBeenCalledTimes(1)` [memory: publish-count-unasserted-duplicate-survives]), `after = { invoiceId, invoiceNo, fileName }`, `occurredAt === exportedAt`; lane DB 1 dòng audit `InvoicePdfExported` target Order. Test KHÔNG upload R2 thật — adapter giả (luật 10).
5. **AC-5 (xuất lại idempotent):** `POST …/pdf` lần 2 ⇒ 200 cùng `fileName/pdfSize/exportedAt`; 0 render, 0 put, 0 event; vẫn 1 dòng. Xuất được bất kể trạng thái đơn hiện tại (`huy`, `hoanthanh`, mở lại `baogia` sau khi lập) — chỉ cần hoá đơn tồn tại. Chi tiết sau khi xuất có `pdf` ≠ null.
6. **AC-6 (lỗi giữa chừng):** renderer ném ⇒ 0 put, 0 dòng, 0 event, envelope 500 qua filter trung tâm (không lộ stack); `putObject` ném ⇒ 0 dòng, 0 event; `invoicePdf.create` ném ⇒ 0 event. Mock `$transaction` PHẢI chạy callback rồi mới ném [memory: mock-rejected-transaction-false-green].
7. **AC-7 (khoá dòng hoá đơn — CONVENTIONS mục Khoá dòng / F-5):** unit: `SELECT id FROM invoices … FOR UPDATE` là op ĐẦU TIÊN trong tx (trước `invoicePdf.findUnique`, `invoice.findUnique`, render, put, create). Lane DB: (a) 2 `POST …/pdf` song song cùng hoá đơn (`Promise.all`) ⇒ renderer gọi **1** lần, 1 dòng, cả hai cùng `exportedAt`, 0 lỗi 500/P2002, đúng 1 event; (b) **FORCED interleaving**: tx holder giữ khoá dòng `invoices` VÀ **GHI** dòng `invoice_pdfs` (đúng thứ `exportPdf` đọc dưới khoá — holder chỉ giữ khoá trần có thể bị chặn hộ ⇒ xanh giả [memory: fk-key-share-masks-missing-row-lock]) ⇒ `exportPdf` CHỜ, holder commit ⇒ replay (0 render). Gỡ `FOR UPDATE` (mutation, `cp` backup) ⇒ (a) hoặc (b) ĐỎ. Không barrier "cả hai cùng tới" trên CÙNG hàng khi có khoá [memory: barrier-race-test-deadlocks-under-row-lock].
8. **AC-8 (tải bytes — AD-3):** `GET …/pdf` sau khi xuất ⇒ 200, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="hoa-don-HD-….pdf"`, body = đúng bytes adapter giả đã nhận; chưa xuất ⇒ 404 `'Hoá đơn này chưa xuất PDF.'` (không gọi `getObject`); không presigned URL, không bucket public.
9. **AC-9 (nội dung PDF — template thuần):** unit `buildInvoiceHtml`: chứa `HOÁ ĐƠN BÁN HÀNG`, `invoiceNo`, ngày UTC+7 (`issuedAt` `2026-07-05T18:30:00Z` ⇒ `06/07/2026`), `quoteNo`, người bán (trường `''` ⇒ `Chưa cấu hình`, không ném), khách (MST null ⇒ `Không có MST`; địa chỉ null ⇒ không in dòng địa chỉ), đủ dòng theo thứ tự, `formatMoney` của đúng số truyền vào; hàng `Chiết khấu` CÓ khi `discountAmount > 0` và VẮNG khi 0; `VAT (8%)` khi `applyVat`, `VAT (không áp)` khi không; khối ký `NGƯỜI LẬP PHIẾU`/`GIÁM ĐỐC`; mọi chuỗi động escape (`<script>` trong tên hàng/khách ⇒ `&lt;script&gt;`); KHÔNG chứa `costPrice`/giá vốn/bảo hành. Smoke render thật một lần bằng system Chrome (ngoài lane bắt buộc) [memory: puppeteer-smoke-render-system-chrome] — ghi kết quả vào Completion Notes.
10. **AC-10 (quyền):** thiếu `invoices.manage` ⇒ 403 cả 3 route; thiếu cả `orders.view_all` lẫn `orders.view_own` ⇒ 403; `:id`/`:invoiceId` không UUID ⇒ 400. Mã HTTP đo ở lane e2e qua guard/`ParseUUIDPipe`/filter thật [memory: dev-pins-ac-deviation-as-green-test].
11. **AC-11 (contract OpenAPI):** `npm run openapi:gen` có `GET /orders/{id}/invoices/{invoiceId}`, `POST|GET /orders/{id}/invoices/{invoiceId}/pdf`, DTO tiếng Anh; drift-guard byte-for-byte xanh; `permissions.json` KHÔNG đổi; `money-fields.mjs` thu `unitPrice`, `amount`, 4 tổng — KHÔNG thu `qty`, `displayOrder`, `pdfSize`, `vatRate`, `versionNo`, `lineCount` (ca khoá trong `invoices.test.mjs`).
12. **AC-12 (bất biến snapshot):** guard D7 xanh trên code thật, ĐỎ khi chèn `this.prisma.invoice.update(` vào bất kỳ file `src/` (mutation); `InvoicesService` (7.4) không đổi (diff rỗng), test 7.4 xanh không sửa.
13. **AC-13 (client):** web `web/src/test/invoice-detail-screen.test.tsx` + mobile `mobile/test/screens/invoices/invoice_detail_screen_test.dart` cùng bộ ca: hiện số, ngày (fixture `18:30Z` ⇒ ngày hôm sau UTC+7), `Gắn đơn {quoteNo} · Bản n`, người bán (trường trống ⇒ `Chưa cấu hình`), khách (2 ca MST có/`Không có MST`), 4 dòng, tổng qua Money/MoneyText; ca chiết khấu > 0 có hàng `Chiết khấu`, = 0 không có; `applyVat:false` ⇒ `Không áp VAT`; `Chưa xuất PDF` / `Đã xuất PDF · dd/MM/yyyy`; bấm "Xuất PDF" ⇒ `exportInvoicePdf` đúng 1 lần ⇒ `downloadInvoicePdf` ⇒ share được gọi với file tên `hoa-don-….pdf` ⇒ chi tiết tải lại hiện `Đã xuất PDF`; bấm 2 lần nhanh ⇒ 1 lời gọi export (nút `disabled`/`onPressed == null` khi đang chạy); 404 ⇒ banner message server nguyên văn; share ném lỗi JS (`AbortError`/`Exception`) ⇒ fallback tiếng Việt; loading/error + "Thử lại". Mobile thêm 320/360 px không tràn với nhãn dài nhất (D8). `InvoicesScreen` (cả hai): nút "Xem" chỉ khi có `onOpenInvoice`, bấm ⇒ callback nhận đúng `invoiceId`; không có callback ⇒ không có nút (fixture có ≥1 hoá đơn — điều kiện bao ngoài BẬT [memory: widget-test-gate-unreachable-outer-condition]). `screens-render.test.tsx` có ca `InvoiceDetailScreen`. Parity guard D9 xanh, có assert chống-guard-rỗng.

---

## Tasks / Subtasks

- [x] **T1 — Schema + migration** (AC 4, 5, 7)
  - [x] T1.1 `InvoicePdf` + back-relation `Invoice.pdf` / `Account.invoicePdfsCreated` trong `backend/prisma/schema.prisma` (docstring tiếng Anh, sau `InvoiceLine`).
  - [x] T1.2 `backend/prisma/migrations/20261022200000_add_invoice_pdfs/migration.sql` bằng `migrate diff --from-config-datasource --to-schema` + CHECK `invoice_pdfs_size_positive`.
  - [x] T1.3 `npx prisma migrate deploy` lên `pns-postgres:5433` (CHỈ DB này); `npx prisma generate`; diff sau deploy rỗng.
- [x] **T2 — Domain + template** (AC 9)
  - [x] T2.1 `backend/src/invoices/domain/invoice-file.ts`; `InvoicePdfExported` trong `invoice-events.ts`.
  - [x] T2.2 `backend/src/invoices/invoice-template.ts` (`buildInvoiceHtml`, import helper từ `orders/quote/quote-template`, KHÔNG import `contracts/`).
  - [x] T2.3 Unit `backend/test/invoice-template.spec.ts` (AC-9 đủ nhánh) + ca `invoice-file` (tên ASCII, key).
- [x] **T3 — Service + controller + module** (AC 1-8, 10)
  - [x] T3.1 DTO `backend/src/invoices/dto/{invoice-detail-response,invoice-line,invoice-seller,invoice-pdf-response}.dto.ts` (tiền "số nguyên đồng"; field số không phải tiền KHÔNG chứa "đồng").
  - [x] T3.2 `backend/src/invoices/invoice-document.service.ts` (D5; `toDetail` là điểm đổi bigint duy nhất của file).
  - [x] T3.3 3 handler trong `invoices.controller.ts` (D4; POST `@HttpCode(200)`; GET pdf `StreamableFile`); `invoices.module.ts` (D6).
  - [x] T3.4 Unit `backend/test/invoice-document.service.spec.ts`: thứ tự scope → FOR UPDATE (op đầu) → replay → đọc → render → put → create → publish; replay ⇒ 0 render/0 put/0 publish; render/put/create ném ⇒ 0 publish (và 0 put khi render ném); `toHaveBeenCalledTimes`; mọi tiền là `number`; scope ném ⇒ 0 truy vấn `invoice*`/0 `getObject`.
  - [x] T3.5 e2e `backend/test/invoice-document.e2e.spec.ts` qua `initAppOnLoopback` (override `StoragePort` + `QuoteRendererPort` như `contracts.e2e.spec.ts:251-255`): 200/400/403/404 (3 nhánh)/header PDF/shape JSON không bigint; route 7.4 `GET/POST /orders/:id/invoices` và `/contracts/:contractId/pdf` vẫn chạy.
  - [x] T3.6 Lane DB `backend/test/invoice-document.db.integration.spec.ts`: CHECK đứng riêng; chi tiết = dòng DB + bất biến sau đổi khách/settings/VAT/giá; tổng > INT4; xuất ⇒ dòng + audit; xuất lại idempotent; đơn `huy` sau khi lập vẫn xuất; AC-7 (a)(b).
- [x] **T4 — Guard + contract** (AC 2, 11, 12)
  - [x] T4.1 `no-unscoped-order-write.spec.ts` (D7) + anti-blind theo method; guard bất biến snapshot; mutation chứng minh ĐỎ.
  - [x] T4.2 `orders-module-wiring.spec.ts` ca `InvoicesModule` (D6).
  - [x] T4.3 Kiểm `no-direct-side-effect-outside-eventbus`, `no-handler-without-require-permissions`, `no-permission-literal-outside-registry`, `naming-convention`, `audit-log-append-only` xanh không nới.
  - [x] T4.4 `npm run openapi:gen`; drift-guard xanh; `permissions.json` không đổi.
- [x] **T5 — Web** (AC 13)
  - [x] T5.1 `invoices-port.ts` + `fake-invoices-port.ts` (3 method mới, type mirror DTO).
  - [x] T5.2 `web/src/screens/invoices/InvoiceDetailScreen.tsx` + class trong `invoices.css`.
  - [x] T5.3 `InvoicesScreen.tsx` prop `onOpenInvoice` + nút "Xem".
  - [x] T5.4 `web/src/test/invoice-detail-screen.test.tsx` (+ ca nút "Xem" trong `invoices-screen.test.tsx`), ca render ở `screens-render.test.tsx`; `cd web && npm run typecheck && npm test && npm run build`.
- [x] **T6 — Mobile** (AC 13)
  - [x] T6.1 `invoices_port.dart` + `fake_invoices_port.dart` (3 method mới, `InvoicePdfFile`).
  - [x] T6.2 `mobile/lib/screens/invoices/invoice_detail_screen.dart` (widget design-system, `MoneyText`, seam `shareImpl`).
  - [x] T6.3 `invoices_screen.dart` prop `onOpenInvoice` + nút "Xem".
  - [x] T6.4 Widget test `mobile/test/screens/invoices/invoice_detail_screen_test.dart` (+ ca nút "Xem" ở `invoices_screen_test.dart`); `cd mobile && flutter analyze && flutter test`. `dart format` chỉ `-o none --set-exit-if-changed` hoặc đúng file mình sửa [memory: dart-format-writes-files-cascade].
- [x] **T7 — Parity + 5 lane** (AC 11, 13)
  - [x] T7.1 `design-system/screens/invoices.test.mjs` (D9).
  - [x] T7.2 Đủ 5 lane cùng working tree: `cd backend && npm test` · `npm run test:db` · `cd design-system && npm test` · web typecheck/test/build · mobile analyze/test. Lint backend so baseline bằng stash [memory: backend-lint-red-at-baseline] — file MỚI phải sạch eslint/prettier.
  - [x] T7.3 Smoke render PDF thật bằng system Chrome (AC-9) + bảng mutation TỰ CHẠY vào Completion Notes.

---

## Dev Notes

### Quyết định Trợ Lý tuyên bố (2026-10-22) — ưu tiên hơn Câu hỏi mở 1

- **In "Số tiền viết bằng chữ"** dưới dòng Tổng cộng trên PDF hoá đơn (thông lệ hoá đơn bán hàng VN). Dùng lại `backend/src/contracts/domain/amount-in-words.ts` của 7.3, không viết hàm mới; có test với tổng thật từ fixture (chạy hàm thật, không gõ tay chuỗi dẫn xuất).
- Câu mở 2, 3, 4 giữ mặc định của story.

### Quyết định của Đại Ca và luật đã chốt (2026-10-21) — ưu tiên hơn mọi chỗ khác

[Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`]
1. Mọi đường đọc/ghi gắn đơn mới qua kiểm phạm vi ⇒ D5 (`assertScoped` trước) + guard D7.
2. Story này KHÔNG chạm tồn kho.
3. Màn web mới ⇒ ca ở `screens-render.test.tsx`; chạy typecheck/test/build.
4. Màn mobile mới ⇒ widget test bắt buộc.
5. Guard mới/mở rộng có assert chống-guard-rỗng.
6. e2e dùng `initAppOnLoopback` (`backend/test/util/listen-loopback.ts`).
7. KHÔNG `git push`; `git add` đường dẫn cụ thể, không `-A`; story này KHÔNG thêm thư viện (không đổi `package-lock.json`/`pubspec.lock`).
8. Code tiếng Anh (biến/hàm/file/comment/test/log/commit); chỉ chuỗi hiển thị tiếng Việt; route/DTO/port mới tiếng Anh. Không đổi tên symbol tiếng Việt cũ.
9. Tiền số nguyên đồng; hiển thị qua `<Money>`/`MoneyText` (`83.010.960 đ`). Story này KHÔNG ghi tiền ⇒ khoá dòng hoá đơn (D5), không cần khoá đơn; vẫn có ca DB interleaving cho khoá đó.
10. **PDF dùng pipeline Puppeteer có sẵn (lazy import) + StoragePort; test KHÔNG upload R2 thật, dùng adapter giả.** Route mới tiếng Anh dưới `/invoices`.

### Files sẽ đổi / tạo

| File | Loại | Ghi chú |
|---|---|---|
| `backend/prisma/schema.prisma` | UPDATE | + `InvoicePdf`, back-relation `Invoice.pdf`, `Account.invoicePdfsCreated` |
| `backend/prisma/migrations/20261022200000_add_invoice_pdfs/migration.sql` | NEW | + CHECK tay |
| `backend/src/invoices/invoice-document.service.ts` | NEW | detail / exportPdf / getPdf |
| `backend/src/invoices/invoice-template.ts` | NEW | `buildInvoiceHtml` thuần |
| `backend/src/invoices/domain/invoice-file.ts` | NEW | tên file + key R2 |
| `backend/src/invoices/domain/invoice-events.ts` | UPDATE | + `InvoicePdfExported` |
| `backend/src/invoices/dto/{invoice-detail-response,invoice-line,invoice-seller,invoice-pdf-response}.dto.ts` | NEW | |
| `backend/src/invoices/invoices.controller.ts` | UPDATE | + 3 handler, inject `InvoiceDocumentService` |
| `backend/src/invoices/invoices.module.ts` | UPDATE | + `StorageModule`, provider mới, docstring |
| `backend/test/no-unscoped-order-write.spec.ts` | UPDATE | canh `invoice-document.service.ts` + guard bất biến snapshot |
| `backend/test/orders-module-wiring.spec.ts` | UPDATE | providers `InvoicesModule` |
| `backend/test/{invoice-template,invoice-document.service,invoice-document.e2e,invoice-document.db.integration}.spec.ts` | NEW | |
| `backend/openapi/openapi.json` | REGEN | |
| `web/src/design-system/session/{invoices-port,fake-invoices-port}.ts` | UPDATE | (+ `index.ts` nếu export type mới) |
| `web/src/screens/invoices/{InvoiceDetailScreen.tsx}` | NEW | |
| `web/src/screens/invoices/{InvoicesScreen.tsx,invoices.css}` | UPDATE | nút "Xem", class mới |
| `web/src/test/{invoice-detail-screen.test.tsx,invoices-screen.test.tsx,screens-render.test.tsx}` | NEW/UPDATE | |
| `mobile/lib/design_system/session/{invoices_port,fake_invoices_port}.dart` | UPDATE | |
| `mobile/lib/screens/invoices/invoice_detail_screen.dart` | NEW | |
| `mobile/lib/screens/invoices/invoices_screen.dart` | UPDATE | nút "Xem" |
| `mobile/test/screens/invoices/{invoice_detail_screen_test,invoices_screen_test}.dart` | NEW/UPDATE | |
| `design-system/screens/invoices.test.mjs` | UPDATE | D9 |

KHÔNG đụng: `invoices/invoices.service.ts` (7.4), `contracts/*`, `orders/quote/*` (chỉ import), `orders/quote-export.service.ts`, `settings/*`, `payments/*`, `storage/*` (chỉ dùng port), `OrderDetailScreen`/`order_detail_screen.dart` (lối vào hoá đơn đã có từ 7.4).

### Nhãn hiển thị chung màn chi tiết (byte-identical web ↔ mobile)

`Hoá đơn bán hàng` · `HOÁ ĐƠN` (eyebrow) · `Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).` · `HOÁ ĐƠN BÁN HÀNG` · `Số HĐ` · `Ngày lập` · `Gắn đơn` · ` · Bản ` · `Người bán` · `Tên công ty` · `MST` · `Địa chỉ` · `Điện thoại` · `Tài khoản ngân hàng` · `Chưa cấu hình` · `Khách hàng` · `MST khách` · `Không có MST` · `Hạng mục` · `SL` · `Đơn giá` · `Thành tiền` · `Tổng trước VAT` · `Chiết khấu` · `VAT ` · `Không áp VAT` · `Tổng thanh toán` · `Chưa xuất PDF` · `Đã xuất PDF · ` · `Xuất PDF` · `Không xuất được PDF hoá đơn. Vui lòng thử lại.` · `Không tải được hoá đơn.` · `Thử lại`. Nút danh sách 7.4: `Xem`. Chính tả "Hoá" (oá), không "Hóa". Mobile `AppFrame` in nhãn HOA ⇒ widget test tìm `'…'.toUpperCase()` (bài học 7.2). Mobile có thể bỏ cột `Hạng mục | SL | Đơn giá` header nếu dùng bố cục 2 cột theo mockup — khi đó các nhãn header đó KHÔNG thuộc bảng byte-identical; ghi rõ lựa chọn trong guard.

### Hiện trạng phải giữ

- `InvoicesService`, `ContractsService`, `QuoteExportService`, `PaymentsService` không đổi byte nào. Route cũ không đổi; `OrdersController` không thêm handler.
- Phần TẠO hoá đơn trên `InvoicesScreen`/`invoices_screen.dart` (frame, banner, ConfirmDialog, danh sách) giữ nguyên hành vi + test 7.4 xanh không sửa (trừ ca mới cho nút "Xem").
- Guard `invoices.test.mjs` không YẾU đi: ca "no Xuất PDF" được thay bằng ca dương CHẶT hơn (Xuất PDF chỉ ở màn chi tiết, đi qua đúng port) — "The rule did not weaken — the set of shipped surfaces grew".
- `resolveOrderTotals`/`computeOrderTotals` KHÔNG được gọi trong 7.5 (snapshot đã có tổng).

### Tình huống biên đã tính

- **Đơn bị huỷ / mở lại / sửa bản sau khi lập hoá đơn** ⇒ vẫn xem + xuất hoá đơn cũ (nó là chứng từ đã lập); nội dung theo snapshot.
- **Người bán chưa cấu hình lúc lập** ⇒ PDF + màn in `Chưa cấu hình`; cấu hình settings SAU đó KHÔNG làm đổi hoá đơn/PDF (snapshot) — đó là ý định, không phải lỗi.
- **Khách không MST / không địa chỉ** ⇒ `Không có MST`, bỏ dòng địa chỉ.
- **Không áp VAT** ⇒ `VAT (không áp)` (PDF) / `Không áp VAT` (màn), `vatAmount = 0`.
- **Tổng > INT4** ⇒ đọc `bigint` ⇒ `Number()` ở `toDetail` + trong service trước khi dựng template; DB lane chứng minh.
- **Hai người bấm "Xuất PDF" cùng lúc** ⇒ khoá dòng hoá đơn tuần tự hoá; người sau replay; 1 render, 1 file, 1 event.
- **Upload xong nhưng ghi DB hỏng** ⇒ lần sau ghi đè cùng key (deterministic) — không rác.
- **Tên hàng/khách chứa HTML** ⇒ `escapeHtml` trong template; client React/Flutter tự escape.
- **Chromium khởi động lạnh chậm** ⇒ tx timeout 30 s (khuôn contracts); khoá chỉ trên MỘT dòng hoá đơn nên không chặn ghi đơn.
- **Lỗi share (người dùng huỷ bottom sheet)** ⇒ fallback banner; file đã xuất, bấm lại an toàn.

### Kiểm thử — luật dự án áp dụng trực tiếp

- Publish/render/put/create: `toHaveBeenCalledTimes(n)`, không `mock.calls[0]` [memory: publish-count-unasserted-duplicate-survives].
- **Mutation (`cp` backup, KHÔNG `git checkout` [memory: mutation-test-never-git-checkout], mutant PHẢI compile [memory: mutation-must-compile-or-false-red]) — kết quả mong đợi:** (a) gỡ `FOR UPDATE` ⇒ DB AC-7 ĐỎ; (b) chèn `invoice.findFirst` trước `assertScoped` trong `detail`/`getPdf` ⇒ guard ĐỎ; (c) bỏ nhánh replay (luôn render) ⇒ unit + DB (P2002/500) ĐỎ; (d) publish cả khi replay ⇒ unit ĐỎ; (e) publish trong tx ⇒ unit "create ném ⇒ 0 publish" ĐỎ; (f) trả `row.total`/`line.amount` (bigint) ⇒ e2e/DB ĐỎ; (g) bỏ `orderId` khỏi `where` của `findFirst` (hoá đơn đơn khác lộ) ⇒ e2e/DB AC-2 ĐỎ; (h) template bỏ `escapeHtml` cho tên hàng ⇒ unit ĐỎ; (i) template luôn in hàng Chiết khấu ⇒ unit ĐỎ; (j) template đọc `warrantyMonths`/giá vốn — không có nguồn ⇒ ghi "không áp dụng"; (k) key R2 không deterministic (`randomUUID`) ⇒ unit key ĐỎ; (l) `GET pdf` khi chưa xuất vẫn gọi `getObject` ⇒ unit ĐỎ; (m) web/mobile bỏ cổng `onOpenInvoice` (nút "Xem" luôn hiện) ⇒ vitest/widget ĐỎ; (n) bỏ `disabled`/`_busy` nút "Xuất PDF" ⇒ test bấm 2 lần ĐỎ; (o) parity: "Xuất PDF" thêm vào `InvoicesScreen` ⇒ design-system ĐỎ; (p) chèn `this.prisma.invoice.update(` ⇒ guard bất biến ĐỎ. Mutant sống có thể vì lớp phòng thủ thứ hai — mutate cả lớp đó [memory: mutation-hits-one-layer-only]; mutant tương đương trong fixture ⇒ ghi lại [memory: mutation-semantically-equivalent-false-survivor]. Ghi bảng TỰ CHẠY.
- Text-guard soi chuỗi đọc RAW (assert chống-rỗng) nhưng so nhãn trên code đã bỏ comment [memory: striptocode-deletes-string-literals]; regex trích thân method theo khuôn prettier, không `\{[^}]*\}` [memory: text-guard-brace-regex-nested-generics].
- Web `.tsx` lỗi cú pháp có thể qua text-guard ⇒ luôn `npm run typecheck` + `npm test` [memory: web-tsx-syntax-error-passes-all-lanes].
- Lane DB cần Docker: `docker start pns-postgres`; daemon không lên từ shell agent ⇒ viết spec, báo lane CHƯA chạy, nhờ Đại Ca mở Docker Desktop [memory: db-lane-needs-docker-desktop-gui]. KHÔNG ghi DB nào khác. Lane DB tách bằng `testPathIgnorePatterns`, không `describe.skip` [memory: describe-skip-does-not-separate-test-lane].
- Lane DB override `StoragePort` (adapter giả trong bộ nhớ) + `QuoteRendererPort` (stub trả `Buffer` PDF nhỏ, đếm lần gọi) — khuôn `contracts.db.integration.spec.ts`. Stub render có thể `await` một promise do test điều khiển để làm holder trong ca (b) nếu cần — nhưng holder chuẩn là tx riêng giữ `FOR UPDATE` trên `invoices` + INSERT `invoice_pdfs`.
- P2002 tag chỉ đáng tin khi INSERT [memory: prisma7-p2003-only-on-insert] — idempotency KHÔNG dựa vào bắt P2002; dựa vào đọc dưới khoá (unique là lưới cuối).
- Reviewer song song mutate cùng file ⇒ kiểm lại finding trên file hiện tại [memory: parallel-reviewers-mutation-collide].
- Mobile: `AppConfirmDialog` footer đã là `Wrap` (7.4) — màn chi tiết không dùng dialog.

### Previous Story Intelligence (7.4, 7.3, 7.2)

- **7.4 (sau review):** `toView` là điểm đổi `bigint` duy nhất — 7.5 làm `toDetail` riêng trong service mới, cùng luật, e2e qua serialize thật. Fake phải theo đúng luật từ chối của backend (review #7). Guard nhãn so trên code bỏ comment (review #5). Banner fallback phải tự xoá khi reload chứng minh thao tác thật ra đã thành công (review #6) — với xuất PDF: nếu `exportInvoicePdf` báo lỗi không phải envelope mà reload thấy `pdf !== null`, vẫn giữ fallback vì bytes chưa tới tay người dùng (khác 7.4) — bấm lại là đường đúng. Race "báo giá → chốt" chỉ liên quan `create`, không liên quan 7.5. `prisma format` định dạng lại model không liên quan ⇒ chèn tay.
- **7.3:** khuôn PDF đầy đủ (template thuần + `renderPdf` + R2 + proxy tải + `shareFiles`/`platformShareXFiles` + seam `shareImpl`); tên file ASCII; "Chưa cấu hình" cho pháp nhân trống; mô tả OpenAPI chứa "hợp đồng"/"đồng" ⇒ `money-fields` coi là tiền; fixture ngày 18:30Z; `messageOf` chỉ nhận envelope; ca "nút vắng" phải bật mọi điều kiện bao ngoài.
- **7.2:** idempotent 200 cả hai lần, replay không publish; e2e id fake phải là UUID thật; web `Banner` không có tone `ok` (dùng `info`); mobile `AppFrame` in nhãn HOA.
- **4.8 (báo giá):** POST xuất → GET bytes proxy, key R2 deterministic, render → upload → ghi → publish; route proxy kiểm phạm vi TRƯỚC khi đọc hồ sơ xuất.

### Git intelligence (5 commit gần nhất)

- `66afdfe` feat(story-7.4): invoices + seller snapshot — schema/service/guard mà 7.5 đọc.
- `6a1373a` feat(story-7.3): contracts PDF — khuôn template/renderer/R2/proxy/share mà 7.5 mirror.
- `7d4fcc7` feat(story-7.2): khuôn idempotent 200 + publish sau commit.
- `f711499` feat(story-7.1): bài học INT4.
- `13408c1` docs(epic-7): luật 9/10.
- Commit story này: `feat(story-7.5): ...` tiếng Anh, không nhắc AI, `git add` đúng đường dẫn.

### Latest tech notes

- KHÔNG thêm thư viện. Stack ghim trong `project-context.md` (NestJS 11.1.27, Prisma 7.8.0 + adapter-pg, React 19.2.7, Flutter 3.44); Puppeteer đã có (lazy import), `share_plus` đã có sau `platformShareXFiles`.
- Prisma 7 `BigInt` đọc ra `bigint` (cả nested `include: { lines }`) ⇒ `Number()` mọi field; `JSON.stringify(1n)` ném.
- `StreamableFile` (`@nestjs/common`) với `disposition` — khuôn `ContractsController.downloadPdf`; `@ApiProduces('application/pdf')` + `schema: { type: 'string', format: 'binary' }`.
- Nest `@HttpCode(200)` cho POST idempotent.

### Project Structure Notes

- Route `orders/:id/invoices/:invoiceId[/pdf]` là sub-resource lồng (CONVENTIONS: danh từ số nhiều, kebab-case); bảng `invoice_pdfs` snake_case số nhiều; file kebab-case.
- Biến thể có chủ đích: (1) khoá dòng `invoices` thay vì `orders` (không ghi tiền/đơn, snapshot bất biến); (2) service thứ hai trong `invoices/` thay vì mở rộng `InvoicesService` (giữ bất biến 7.4); (3) hằng `Chưa cấu hình` khai lại trong `invoices/` thay vì import `contracts/` (hai module độc lập).
- 7.3 ghi chú "tách helper template khi có consumer thứ ba" — 7.5 là consumer thứ ba của `escapeHtml/formatMoney/formatDateVn/loadAssets/buildFontFaces`, nhưng các helper đó ĐÃ export từ `orders/quote/quote-template.ts` và dùng được nguyên trạng ⇒ KHÔNG di chuyển (YAGNI, không đụng `orders/quote/*`).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Số tiền bằng chữ trên hoá đơn** ("Bằng chữ: Tám mươi ba triệu…")? Mặc định: KHÔNG (mockup không có; hàm `amountInWords` ở `contracts/domain`). Nếu Đại Ca muốn ⇒ chuyển `amount-in-words.ts` sang chỗ dùng chung (vd `common/`) trong một thay đổi riêng rồi gọi từ template.
2. **Chia sẻ ẢNH hoá đơn** như báo giá (FR-21 ưu tiên ảnh)? Mặc định: chỉ PDF (FR-28 chỉ nói PDF). Thêm ảnh = `render()` thay `renderPdf()` + cột `imageKey`.
3. **Đổi mẫu hoá đơn về sau:** PDF đã lưu giữ mẫu cũ (render một lần). Mặc định chấp nhận (chứng từ đã phát hành không nên đổi giao diện). Nếu cần in lại theo mẫu mới ⇒ thêm "Xuất lại" (xoá/ghi đè `invoice_pdfs`) — story riêng.
4. **Quyền xem tách khỏi quyền tạo/xuất?** Hiện dùng chung `invoices.manage` ("Tạo/xuất hoá đơn"). Nếu cần vai trò chỉ xem (kế toán) ⇒ thêm key `invoices.view` vào registry (đổi `permissions.json`, 2 lần regen [memory: permissions-registry-cross-package-regen]).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:609-646`] — Epic 7, Story 7.4/7.5 AC.
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md:310-316,369-383`] — FR-21 (share/download, khối chữ ký + logo), FR-27/FR-28.
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`] — AD-3 (dòng 60), AD-4, AD-5, AD-10, AD-12, AD-17, AD-18; module tree `invoices/` (dòng 452, 486).
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md:41`; `mockups/all-screens.html:2745-2860` `#s-invoice`].
- [Source: `backend/prisma/schema.prisma:722-803`] — `Contract`, `Invoice`, `InvoiceLine`.
- [Source: `backend/src/invoices/{invoices.service,invoices.controller,invoices.module}.ts`, `invoices/domain/*`, `invoices/dto/*`] — 7.4.
- [Source: `backend/src/contracts/{contracts.service,contracts.controller,contracts.module,contract-template}.ts`, `contracts/domain/contract-number.ts`] — khuôn PDF/R2/proxy.
- [Source: `backend/src/orders/quote-export.service.ts`, `orders/orders.controller.ts:723-830`, `orders/quote/{quote-template,quote-renderer.port}.ts`, `orders/domain/quote-number.ts`, `orders/orders.module.ts:34-59`] — pipeline báo giá, renderer dùng chung.
- [Source: `backend/src/storage/storage.port.ts`] — AD-3.
- [Source: `backend/src/settings/domain/company-legal-entity.ts`] — 7 trường người bán + nhãn.
- [Source: `backend/test/no-unscoped-order-write.spec.ts:29-80,284-292`; `backend/test/orders-module-wiring.spec.ts`; `backend/test/contracts.e2e.spec.ts:251-255`] — guard + override port.
- [Source: `backend/CONVENTIONS.md` mục Đặt tên, Prisma `@@map`, OpenAPI, Error envelope, Domain Event, Khoá dòng].
- [Source: `web/src/screens/invoices/InvoicesScreen.tsx`, `web/src/screens/contracts/ContractsScreen.tsx:100-160`, `web/src/design-system/session/{invoices-port,contracts-port}.ts`, `web/src/design-system/components/index.ts:95`] — client web.
- [Source: `mobile/lib/screens/invoices/invoices_screen.dart`, `mobile/lib/screens/contracts/contracts_screen.dart:68-165`, `mobile/lib/design_system/session/{invoices_port,contracts_port}.dart`, `mobile/lib/design_system/components/share_button.dart:15-24`] — client mobile.
- [Source: `design-system/screens/invoices.test.mjs:60-230`, `design-system/money/money-fields.mjs`] — guard parity + tiền.
- [Source: `_bmad-output/implementation-artifacts/7-4-tao-hoa-don-tu-don-luu-db.md`, `7-3-sinh-hop-dong-thi-cong-mua-ban-pdf.md`] — learnings.
- [Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`] — luật 1-10.
- [Source: `_bmad-output/project-context.md`] — luật toàn dự án.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (`claude-opus-5-5`)

### Debug Log References

- `npx prisma format` định dạng lại toàn bộ model `Account`/`AuditLog`… (đúng như cảnh báo 7.4) ⇒ hoàn tác, chèn `InvoicePdf` + 2 back-relation bằng tay (diff schema = +19 dòng).
- `migrate diff --from-config-datasource --to-schema` ⇒ SQL + CHECK tay `invoice_pdfs_size_positive`; `migrate deploy` lên `localhost:5433/phuong_nam_solar` (pns-postgres); diff sau deploy = "empty migration".
- Mobile: `XFile.fromData(name:)` trả `name == ''` trên test VM ⇒ widget test đo tên file qua `title` truyền cho share (khuôn `contracts_screen_test.dart`).
- Mobile: pump lại cùng `InvoiceDetailScreen` không chạy lại `initState` ⇒ test pump `SizedBox` xen giữa.
- `dart format` tách `await widget.port\n.downloadInvoicePdf(` ⇒ regex guard D9 nới `\s*` trước `.downloadInvoicePdf`.
- `dart format` chỉ chạy đúng 3 file mình sửa (`-o none` trước để xem); diff file 7.4 `invoices_screen_test.dart` chỉ gồm group mới.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Backend:** bảng `invoice_pdfs` (+CHECK, unique `invoice_id`); `InvoiceDocumentService` (`detail`/`exportPdf`/`getPdf`) — `assertScoped` trước mọi đọc; `exportPdf` khoá DÒNG `invoices` (`SELECT id FROM invoices WHERE id AND order_id FOR UPDATE` là op đầu tx, timeout 30 s), replay trả file đã lưu (0 render/put/event), render một lần → `putObject` key deterministic `invoices/{orderId}/{invoiceId}.pdf` → ghi dòng → publish `InvoicePdfExported` SAU commit. `toDetail` là điểm đổi `bigint → number` duy nhất của file. 3 route `GET /orders/:id/invoices/:invoiceId`, `POST|GET …/pdf` (POST `@HttpCode(200)`, GET `StreamableFile` attachment). `InvoicesService` (7.4) không đổi byte nào; `permissions.json` không đổi; không thêm thư viện.
- **Template:** `buildInvoiceHtml` thuần, mọi chuỗi qua `escapeHtml`, ZERO số học tiền, "Chưa cấu hình" khai riêng trong `invoices/`. Theo **quyết định Trợ Lý 2026-10-22** (ưu tiên hơn Câu hỏi mở 1 và D3): in "Số tiền viết bằng chữ" bằng `contracts/domain/amount-in-words.ts` (import trực tiếp, không viết hàm mới); test so với `amountInWords(data.total)` chạy hàm thật.
- **Smoke render thật (AC-9)** bằng system Chrome (`PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/…`, `ts-node -O commonjs`, `PuppeteerQuoteRenderer.renderPdf`): 47.278 byte, header `%PDF-`; ảnh trang 1 kiểm bằng mắt — font Be Vietnam Pro hiển thị đủ dấu, người bán + 3 ô "Chưa cấu hình", "Số HĐ HD-2026-0731", "Ngày lập: 06/07/2026 · Gắn đơn: BG-3F2A9B1C (bản 2)", bảng 4 dòng, Tổng trước VAT 76.862.000 / VAT (8%) 6.148.960 / Tổng thanh toán 83.010.960, dòng bằng chữ, khối ký NGƯỜI LẬP PHIẾU / GIÁM ĐỐC (tên + chức danh), chân trang nội bộ. Script để ngoài repo (scratchpad), không commit.
- **Client:** web `InvoiceDetailScreen.tsx` + mobile `invoice_detail_screen.dart` (Frame/AppFrame, `<Money>`/`MoneyText`, "Xuất PDF" = export → download → share, in-flight guard, không ConfirmDialog, lỗi envelope nguyên văn / lỗi JS ⇒ fallback). Nút "Xem" trên danh sách 7.4 chỉ khi có `onOpenInvoice`. Port/fake mở rộng 3 method; fake theo đúng luật từ chối backend (404 hoá đơn lạ, 404 tải trước khi xuất), xuất idempotent, hoá đơn tạo qua `createInvoice` mở được (một kho).
- **Biến thể có chủ đích:** (1) mobile hiển thị dòng theo mockup 2 cột `{tên} ×{SL}` | `MoneyText(amount)`, không header bảng ⇒ `Hạng mục/SL/Đơn giá/Thành tiền` là nhãn CHỈ web (ghi rõ trong guard `WEB_DETAIL_ONLY_LABELS`); (2) PDF in "Gắn đơn: {quoteNo} (bản n)"; (3) lane DB "đổi VAT cấu hình" đo bằng đổi `vatRate` của bản đơn + "sửa giá" bằng đổi `unitPrice` dòng đơn (dòng fixture không gắn `productId`) — mạnh hơn: chính đơn đổi mà hoá đơn vẫn y nguyên; `detail` không nhận tham số VAT nên VAT cấu hình không có đường vào; (4) e2e mới gọi lại route overview 7.4; route `/contracts/:contractId/pdf` được chứng minh bởi `contracts.e2e.spec.ts` chạy xanh cùng lượt (không nhân bản).
- **5 lane cùng working tree (2026-10-22):** backend `npm test` 116 suite / 2397 test ✅ · `npm run test:db` 26 suite / 319 test ✅ (13 ca mới) · design-system 487 ✅ · web typecheck ✅ / vitest 194 ✅ / build ✅ · mobile analyze sạch / flutter test 449 ✅. Lint: mọi file backend mới/sửa sạch eslint + prettier (lint toàn repo đỏ sẵn ở baseline — không đo lại).
- **Bảng mutation TỰ CHẠY** (`cp` backup, mutant compile được, khôi phục sau mỗi ca):

| # | Mutant | Kết quả |
|---|---|---|
| a | gỡ `FOR UPDATE` khỏi khoá `invoices` | DB ĐỎ 2 (song song + holder GHI `invoice_pdfs`) (+ unit SQL ĐỎ) |
| b | `invoice.findFirst` trước `assertScoped` trong `getPdf`; `invoicePdf.findUnique` trước scope trong `detail` | guard phạm vi ĐỎ (cả 2) |
| c | bỏ nhánh replay (luôn render) | unit+e2e ĐỎ 2, DB ĐỎ 3 |
| d | publish cả khi replay | unit+e2e ĐỎ 2 |
| e | publish trong tx (sau upload) | unit+e2e ĐỎ 4 ("create ném ⇒ 0 publish", thứ tự, count) |
| f | trả `row.total` bigint | unit+e2e ĐỎ 16 |
| g | bỏ `orderId` khỏi `where` của `detail` | unit+e2e ĐỎ 5, DB ĐỎ 1 |
| h | template bỏ `escapeHtml` tên hàng | unit ĐỎ |
| i | template luôn in hàng Chiết khấu | unit ĐỎ |
| j | template đọc bảo hành/giá vốn | không áp dụng — snapshot không có nguồn; ca "no cost price/warranty" giữ |
| k | key R2 ngẫu nhiên | unit+e2e ĐỎ 3 |
| l | `getPdf` gọi `getObject` trước khi kiểm chưa xuất | unit+e2e ĐỎ 5 |
| m | web/mobile nút "Xem" luôn hiện | vitest ĐỎ 1 / widget ĐỎ 1 |
| n | web/mobile bỏ `disabled`/`_busy` nút "Xuất PDF" | vitest ĐỎ 1 / widget ĐỎ |
| o | thêm "Xuất PDF" vào `InvoicesScreen` | design-system ĐỎ |
| p | chèn `prisma.invoice.update(` vào `payments.service.ts` | guard bất biến snapshot ĐỎ |

### File List

- `backend/prisma/schema.prisma` (UPDATE)
- `backend/prisma/migrations/20261022200000_add_invoice_pdfs/migration.sql` (NEW)
- `backend/src/invoices/domain/invoice-file.ts` (NEW)
- `backend/src/invoices/domain/invoice-events.ts` (UPDATE)
- `backend/src/invoices/invoice-template.ts` (NEW)
- `backend/src/invoices/invoice-document.service.ts` (NEW)
- `backend/src/invoices/dto/invoice-detail-response.dto.ts` (NEW)
- `backend/src/invoices/dto/invoice-line.dto.ts` (NEW)
- `backend/src/invoices/dto/invoice-seller.dto.ts` (NEW)
- `backend/src/invoices/dto/invoice-pdf-response.dto.ts` (NEW)
- `backend/src/invoices/invoices.controller.ts` (UPDATE)
- `backend/src/invoices/invoices.module.ts` (UPDATE)
- `backend/openapi/openapi.json` (REGEN)
- `backend/test/invoice-template.spec.ts` (NEW)
- `backend/test/invoice-document.service.spec.ts` (NEW)
- `backend/test/invoice-document.e2e.spec.ts` (NEW)
- `backend/test/invoice-document.db.integration.spec.ts` (NEW)
- `backend/test/no-unscoped-order-write.spec.ts` (UPDATE)
- `backend/test/orders-module-wiring.spec.ts` (UPDATE)
- `web/src/design-system/session/invoices-port.ts` (UPDATE)
- `web/src/design-system/session/fake-invoices-port.ts` (UPDATE)
- `web/src/design-system/session/index.ts` (UPDATE)
- `web/src/screens/invoices/InvoiceDetailScreen.tsx` (NEW)
- `web/src/screens/invoices/InvoicesScreen.tsx` (UPDATE)
- `web/src/screens/invoices/invoices.css` (UPDATE)
- `web/src/test/invoice-detail-screen.test.tsx` (NEW)
- `web/src/test/invoices-screen.test.tsx` (UPDATE)
- `web/src/test/screens-render.test.tsx` (UPDATE)
- `mobile/lib/design_system/session/invoices_port.dart` (UPDATE)
- `mobile/lib/design_system/session/fake_invoices_port.dart` (UPDATE)
- `mobile/lib/screens/invoices/invoice_detail_screen.dart` (NEW)
- `mobile/lib/screens/invoices/invoices_screen.dart` (UPDATE)
- `mobile/test/screens/invoices/invoice_detail_screen_test.dart` (NEW)
- `mobile/test/screens/invoices/invoices_screen_test.dart` (UPDATE)
- `design-system/screens/invoices.test.mjs` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)
- `backend/src/common/money/amount-in-words.ts` (MOVED from `backend/src/contracts/domain/amount-in-words.ts` — review)
- `backend/src/contracts/contract-template.ts` (UPDATE — import path only, review)
- `backend/test/amount-in-words.spec.ts` (UPDATE — import path + docstring, review)
- `backend/test/contract-template.spec.ts` (UPDATE — import path only, review)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 5.5 · 2026-10-22 · lớp chính `/ck:code-review` (2 reviewer song song chỉ đọc: client, test backend) + rà lõi backend trực tiếp. **Kết quả: Approve sau khi sửa — 0 CRITICAL, 0 HIGH; 6 MEDIUM + 10 LOW đã sửa hết.**

Đối chiếu AC 1-13 + task [x]: đều có bằng chứng trong code/test. Git vs File List: khớp (ngoài `.githooks/`, `backend/.claude/`, 2 file `docs/*.xlsx` — không thuộc story, KHÔNG stage).

**Luật dự án kiểm cụ thể (mutation `cp` backup, không `git checkout`, khôi phục + `cmp` sau mỗi ca):**
- Luật 1 (phạm vi): bỏ `assertScoped` khỏi `exportPdf` ⇒ guard + unit/e2e ĐỎ 7; chèn `invoicePdf.findFirstOrThrow` trước scope trong `getPdf` ⇒ guard ĐỎ (trước review guard MÙ với dạng `*OrThrow`).
- Khoá: gỡ `FOR UPDATE` ⇒ lane DB ĐỎ 2 (song song + holder GHI `invoice_pdfs`).
- Luật 10: không test nào upload R2 thật (DB `fakeStorage`, e2e override `StoragePort`, spec adapter mock `S3Client`).
- Riêng 7.5: `amount-in-words.ts` chuyển sang `src/common/money/` (formatter trình bày thuần, dùng chung bởi `contracts/` và `invoices/`; không phải logic giá của `orders/domain`) — cập nhật import cả hai template + 3 spec. Hết import chéo `invoices → contracts`.

**Finding đã sửa:**

| # | Mức | Finding | Sửa | Bằng chứng ĐỎ khi bẻ |
|---|---|---|---|---|
| 1 | MEDIUM | Guard bất biến snapshot mù với `updateManyAndReturn`, SQL thô (`$executeRaw UPDATE invoices`, `DELETE FROM invoice_lines` — `stripToCode` xoá template literal), và `.invoice\n.update(` do prettier tách | Regex cho phép khoảng trắng quanh dấu chấm + `update\w*`/`delete\w*`; thêm `RAW_MUTATION` quét nguồn RAW; 5 mẫu mới bị bắt, 2 mẫu SQL hợp lệ (`SELECT … FOR UPDATE`, `invoice_pdfs`) lọt | chèn `UPDATE invoices` thô vào `exportPdf` ⇒ guard ĐỎ |
| 2 | MEDIUM | Guard phạm vi bỏ sót `find*OrThrow`/`*AndReturn` trên `invoice`/`invoiceLine`/`invoicePdf` | Mở rộng cả 3 mẫu; ca mẫu "catches…" chạy 4 dạng | `findFirstOrThrow` trước scope ⇒ ĐỎ |
| 3 | MEDIUM | Trường người bán chưa từng được đo với giá trị phân biệt (5/7 là `''`) ⇒ đảo `phone`/`bankAccount` sống sót mọi lane (AC-1 chỉ tuyên bố) | Fixture unit/e2e 7 giá trị khác nhau; lane DB cấu hình pháp nhân trước khi lập + so `seller` với dòng DB VÀ với giá trị đã cấu hình; template có ca "mỗi trường dưới đúng nhãn" | đảo `phone` trong `toDetail` ⇒ unit ĐỎ; đảo trong template ⇒ ĐỎ 2 |
| 4 | MEDIUM | Timeout tx 30 s không được test (bỏ ⇒ prod P2028 với Chromium lạnh) | Unit assert `$transaction(…, { timeout: 30_000 })` | bỏ `timeout` ⇒ ĐỎ |
| 5 | MEDIUM | Guard nhãn parity mù với `HOÁ ĐƠN` (eyebrow) và `MST` người bán — tìm thấy bên trong nhãn dài hơn | Nhãn lồng (tự tính, có assert chống-rỗng = `['HOÁ ĐƠN','MST']`) phải đứng riêng thành literal/JSX text; thêm assert ở web + widget test | xoá `MST`/eyebrow mobile ⇒ design-system ĐỎ |
| 6 | MEDIUM | Nút "Xem" mới trên danh sách mobile chưa từng render ở 320/360 px (ca hẹp không truyền `onOpenInvoice`) | Thêm ca 320/360 với `onOpenInvoice` + `longInvoice` | — (xanh: không tràn) |
| 7 | LOW | Fake mobile dựng chi tiết từ demo, bỏ khách/tổng của danh sách (lệch web, vi phạm "một kho") | `_find` truyền khách, MST, VAT, 4 tổng từ summary | ca "listed invoice opens with the list's own figures" |
| 8 | LOW | Test web tên "another order" nhưng chỉ thử id lạ; cả hai fake bỏ qua `orderId` | Fake gắn một đơn (đơn đầu tiên được hỏi), 3 method mới từ chối đơn khác 404 như backend; test web + mobile thử cả 3 method | gỡ kiểm đơn trong fake ⇒ vitest ĐỎ / widget ĐỎ |
| 9 | LOW | Style `_title` tự chế trên mobile (AD-13) | Dùng `_strong` có sẵn | — |
| 10 | LOW | Web: response chậm của hoá đơn cũ đè hoá đơn mới; mobile: đổi `invoiceId` không tải lại | Web ticket ref (như mobile); mobile `didUpdateWidget` | bỏ ticket web ⇒ ĐỎ; bỏ reload mobile ⇒ ĐỎ |
| 11 | LOW | Fake lock e2e che mất `AND order_id` (404 giả) | Fake ném nếu SQL thiếu `AND order_id = ?` | — |
| 12 | LOW | Ca escape thiếu `representative`/`representativeTitle`/địa chỉ/điện thoại/TK người bán, `customer.sdt`, `quoteNo` | Thêm vào ca escape | bỏ `t()` ở `representative` ⇒ ĐỎ |
| 13 | LOW | Tên test mới `'BẮT …'` tiếng Việt (luật 8) | `'catches …'` | — |
| 14 | LOW | Renderer trả buffer rỗng ⇒ upload rồi CHECK ném ⇒ 500 + rác R2 | Chặn trước `putObject`; unit "empty render ⇒ no upload, no row, no event" | bỏ chặn ⇒ ĐỎ |
| 15 | LOW | Template import `contracts/domain` trái comment "two modules stay independent" | Giải quyết bởi việc chuyển helper sang `common/money` | — |
| 16 | LOW | Docstring `amount-in-words` chỉ nói hợp đồng | Cập nhật: dùng chung hợp đồng + hoá đơn | — |

**Ghi nhận, không đổi (lệch câu chữ AC-13, giữ hành vi):** web `shareFiles` coi `AbortError` (người dùng huỷ bảng chia sẻ) là huỷ bình thường, không hiện banner — giống hợp đồng 7.3; test dùng `Error` thường cho nhánh fallback. Huỷ chủ động không phải lỗi; đổi sẽ đụng component share dùng chung.

**5 lane cùng working tree sau sửa (2026-10-22):** backend `npm test` 116 suite / 2405 ✅ · `npm run test:db` 26 suite / 321 ✅ · design-system 487 ✅ · web typecheck ✅ / vitest 195 ✅ / build ✅ · mobile analyze sạch / flutter test 454 ✅. eslint + prettier sạch trên mọi file backend đã sửa; `tsc --noEmit` sạch.

### Change Log

- 2026-10-22 — Story 7.5 implemented: invoice detail view from the stored snapshot, PDF export rendered once under the invoice row lock and stored in R2 (`invoice_pdfs`), download proxy, web + mobile "Xem hoá đơn" screens with "Xuất PDF", "Xem" entry on the invoice list, scope + snapshot-immutability guards, parity guard. Status → review.
- 2026-10-22 — Code review: 16 findings fixed (guard blind spots for `*OrThrow`/`*AndReturn`/raw SQL/nested labels, distinct seller values across unit/e2e/DB/template, tx timeout + empty-PDF guard, fakes refuse other orders, stale-response handling, 320/360 "Xem" row); `amount-in-words.ts` moved to `src/common/money/`. Status → done.
