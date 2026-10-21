---
baseline_commit: 6a1373a
---

# Story 7.4: Tạo Hoá đơn từ Đơn (lưu DB)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền tạo hoá đơn (`invoices.manage`),
I want tạo Hoá đơn từ một Đơn đã chốt — chụp lại khách hàng (MST), các Dòng, VAT và tổng tiền của bản đơn hiện hành, cấp số hoá đơn nội bộ + ngày lập, gắn với Đơn,
so that công ty có chứng từ hoá đơn nội bộ lưu trong hệ thống, không đổi theo đơn về sau, sẵn sàng để xem và xuất PDF ở Story 7.5.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-22, sau commit `6a1373a` — 7.3 done)

- **Quyền đã có:** `PERM.invoicesManage = 'invoices.manage'` (`backend/src/accounts/domain/permission-registry.ts:60,118`, nhãn "Tạo/xuất hoá đơn", group `invoices`). **KHÔNG thêm key mới** ⇒ `permissions.json` không đổi. Mobile dùng `AppPermissionKeys` (không `AppPerm`) [memory: mobile-screens-use-apppermissionkeys-not-appperm].
- **Module `invoices/` chưa tồn tại.** Spine đã đặt chỗ: `invoices/  # Invoice (DB + PDF) (FR-27, FR-28)` (ARCHITECTURE-SPINE.md:452), bảng module "Hoá đơn (FR-27, FR-28) → `invoices/`, AD-3, AD-10" (dòng 486); ERD `ORDER ||--o{ INVOICE : generates` (dòng 240 — MỘT đơn NHIỀU hoá đơn).
- **Khuôn gần nhất = `contracts/` (Story 7.3, SAU review)** — `backend/src/contracts/contracts.service.ts`: `getScoped` TRƯỚC mọi thứ → `$transaction` (op đầu `SELECT id FROM orders WHERE id = … FOR UPDATE`) → đọc lại `status`/`currentVersionId` dưới khoá (version đổi ⇒ 409 `ORDER_CHANGED_MESSAGE`) → `loadInputs` (customer, version, totals qua `resolveOrderTotals`) → blocker → `nextval(pg_get_serial_sequence(...))` → ghi → **publish SAU commit**. Controller `@Controller('orders')` (`contracts.controller.ts`), quyền resolve TƯƠI (`accountPermissions.listForAccount`), VAT (`settings.vatRatePercent()`) + cờ giá phân tầng (`featureFlags.isEnabled(FLAG.catalogTieredPricing)`) resolve tươi rồi truyền xuống. Module `contracts.module.ts` import `OrdersModule, StorageModule, SettingsModule, FeatureFlagsModule, AccountsModule`. **Mirror khuôn này; KHÔNG import `ContractsModule`.**
- **Idempotency kiểu 7.2** (`payments.controller.ts:54-61`): `@HttpCode(200)` cho CẢ lần đầu lẫn gửi lại, cùng thân, gửi lại không publish. Hoá đơn dùng cùng khuôn (D4).
- **Tổng tiền:** `resolveOrderTotals({ lines, version, order, fallbackVatRate }) → { totals: { subtotal, discountAmount, vatAmount, total }, vatRate, applyVat }` (`orders/domain/order-totals.ts:94`) — MỘT hàm (AD-16). Dòng: `OrderView.lineItems[]` (`OrderLineView` — `name, unit, qty, unitPrice, amount, warrantyMonths, displayOrder`; `amount` server tính qua `lineAmount`; đơn đã chốt ⇒ `unitPrice` là snapshot — AD-6/AD-20).
- **Khách:** `Customer` (`sdt` PK E.164, `name`, `custType`, `cccd?`, `taxCode?` = **MST**, `address?`, `bankAccount?`). Khách Cá nhân thường KHÔNG có MST.
- **Tiền trong DB hiện ĐỀU là `Int` (INT4, max 2.147.483.647)** — chưa có cột `BigInt` nào. Tổng đơn tính ở JS có thể vượt INT4 (hệ thương mại vài tỷ đồng) ⇒ ghi INT4 ném ở driver ⇒ 500 [memory: int4-money-column-percent-overflow]. Hoá đơn **lưu tổng** ⇒ phải xử lý (D2).
- **Màn chi tiết đơn:** web `OrderDetailScreen.tsx:87-89,172-173,481-500` / mobile `order_detail_screen.dart:89-107,390-425` có nút "Thanh toán" (`onOpenPaymentSchedule`) + "Hợp đồng" (`onOpenContracts`) trong `od-actions`/`Wrap`, khối mở khi có callback. Guard `design-system/screens/order-detail.test.mjs:255-288` khoá **đúng 3 tab** và **cấm chuỗi `'Hoá đơn'` ở MỌI chỗ trong code màn chi tiết đơn** (dòng 279 — `for (const notYet of ['Hoá đơn', 'HĐ & HĐơn'])`). ⇒ Hoá đơn vào bằng **nút** "Hoá đơn", và guard phải được cập nhật đúng cách 7.1/7.3 đã làm (bỏ `'Hoá đơn'` khỏi danh sách RAW-TEXT, thêm assert **tab** list không chứa `'Hoá đơn'`) — xem D9.
- **UX đã vẽ** (`ux-designs/…/mockups/all-screens.html:2745-2860`, `#s-invoice`; EXPERIENCE.md:41 "Hoá đơn (`s-invoice`) · Chi tiết đơn · Tạo từ Đơn, lưu DB + xuất PDF"): topbar "Hoá đơn bán hàng" (eyebrow `DH-xxxx · HOÁ ĐƠN`); frame **"Tạo hoá đơn từ đơn"** kv `Nguồn: Đơn DH-2048 (snapshot) · MST khách · Số HĐ nội bộ: HD-2026-0731 (tự cấp) · Ngày lập · Lưu DB: Đã lưu`; banner info *"Phase 1: không tích hợp nhà cung cấp HĐĐT — chỉ lưu DB & xuất PDF nội bộ."*; khối văn bản hoá đơn (bảng dòng + tổng) + nút "Xem lại"/"Xuất PDF". **Khối văn bản + Xem lại + Xuất PDF là Story 7.5** (FR-28) — story này chỉ dựng phần TẠO + danh sách đã tạo (D8).
- **Không có mẫu hoá đơn thật** trong `docs/` (chỉ 2 mẫu hợp đồng). Story này không cần mẫu (không PDF).

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Hoá đơn là SNAPSHOT bất biến của MỘT bản đơn; một bản đơn ⇒ tối đa MỘT hoá đơn.**
- Hoá đơn là chứng từ: sửa đơn / sửa khách / đổi VAT cấu hình về sau KHÔNG được làm đổi hoá đơn đã lập ⇒ chép (snapshot) khách + dòng + VAT + tổng vào bảng của hoá đơn tại lúc tạo; 7.5 render PDF CHỈ từ snapshot này (không đọc lại đơn).
- `@@unique([orderVersionId])`: mỗi `OrderVersion` tối đa một hoá đơn. POST lần hai cho cùng bản hiện hành = **gửi lại** ⇒ trả hoá đơn đã có (200, không ghi, không event) — retry an toàn (NFR-1) và không thể lập 2 hoá đơn cho cùng một nội dung. Sửa đơn sau chốt (bản update 4.6 ⇒ `currentVersionId` mới) ⇒ được tạo hoá đơn MỚI cho bản mới; hoá đơn cũ giữ nguyên (append-only, không xoá/huỷ — huỷ/điều chỉnh hoá đơn là ngoài phạm vi, Câu hỏi mở 2).
- Vì sao KHÔNG cho nhiều hoá đơn cùng bản như hợp đồng 7.3: hợp đồng là bản in (in lại vô hại); hoá đơn là chứng từ tiền — hai hoá đơn cùng nội dung là ghi trùng doanh thu.

**D2 — Mô hình dữ liệu (migration mới `backend/prisma/migrations/20261022150000_add_invoices/migration.sql`). Tiền tổng = `BigInt`.**

```prisma
/// An internal sales invoice of one order version (FR-27). An immutable snapshot: customer,
/// lines, VAT and totals are copied at creation and never re-read from the order. At most one
/// invoice per order version (a retry returns the stored one). Phase 1 has no e-invoice provider.
model Invoice {
  id                 String        @id @default(uuid())
  /// Global serial reserved under the order row lock (the number is part of the document).
  seq                Int           @unique @default(autoincrement())
  invoiceNo          String        @unique @map("invoice_no")
  orderId            String        @map("order_id")
  order              Order         @relation(fields: [orderId], references: [id], onDelete: Restrict)
  orderVersionId     String        @unique @map("order_version_id")
  orderVersion       OrderVersion  @relation(fields: [orderVersionId], references: [id], onDelete: Restrict)
  customerSdt        String        @map("customer_sdt")
  customerName       String        @map("customer_name")
  customerTaxCode    String?       @map("customer_tax_code")
  customerAddress    String?       @map("customer_address")
  vatRate            Int           @map("vat_rate")
  applyVat           Boolean       @map("apply_vat")
  subtotal           BigInt
  discountAmount     BigInt        @map("discount_amount")
  vatAmount          BigInt        @map("vat_amount")
  total              BigInt
  issuedAt           DateTime      @map("issued_at")
  createdByAccountId String        @map("created_by_account_id")
  createdBy          Account       @relation("InvoiceCreatedBy", fields: [createdByAccountId], references: [id], onDelete: Restrict)
  createdAt          DateTime      @default(now()) @map("created_at")
  lines              InvoiceLine[]

  @@index([orderId])
  @@map("invoices")
}

/// One line of an invoice, copied from the order version's line at creation.
model InvoiceLine {
  id           String  @id @default(uuid())
  invoiceId    String  @map("invoice_id")
  invoice      Invoice @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  displayOrder Int     @map("display_order")
  name         String
  unit         String
  qty          Int
  unitPrice    Int     @map("unit_price")
  amount       BigInt

  @@unique([invoiceId, displayOrder])
  @@map("invoice_lines")
}
```

- Back-relation: `invoices Invoice[]` ở `Order`; `invoice Invoice?` ở `OrderVersion` (unique ⇒ quan hệ 1-1 phía version); `invoicesCreated Invoice[] @relation("InvoiceCreatedBy")` ở `Account`. Đặt 2 model **sau `Contract`**, KHÔNG chèn giữa khối `///` của model khác (bài học 7.1 review #2). KHÔNG FK `customerSdt → customers` (snapshot — giữ được kể cả khi khách đổi; customer không xoá cứng nhưng snapshot không cần ràng buộc).
- **Vì sao `BigInt` cho `subtotal/discountAmount/vatAmount/total/amount`:** đây là tiền server TỰ TÍNH và LƯU; INT4 tràn ở đơn > 2,15 tỷ ⇒ 500, và chặn hoá đơn cho đơn lớn là sai nghiệp vụ (khác 7.1: một ĐỢT > 2 tỷ hiếm, một ĐƠN vài tỷ là bình thường). `unitPrice`/`qty` giữ `Int` (chép từ cột `Int` nguồn, không thể vượt). Đây là cột `BigInt` ĐẦU TIÊN của schema ⇒ quy ước bắt buộc:
  - Ghi: `BigInt(n)` từ số nguyên JS (n luôn là integer — `computeOrderTotals` chỉ cộng/nhân/`Math.floor` integer).
  - Đọc: Prisma 7 + adapter-pg trả **`bigint`** JS ⇒ đổi `Number(x)` NGAY ở tầng service (an toàn: tổng thực tế ≪ 2^53 — comment `order-totals.ts`). **`bigint` lọt vào response ⇒ `JSON.stringify` ném `TypeError: Do not know how to serialize a BigInt` ⇒ 500** — DTO/response/event payload CHỈ chứa `number`. Test e2e + DB phải đi qua đường serialize thật.
- **CHECK viết tay** trong migration (Prisma không model CHECK):
  - `invoices_amounts_nonneg`: `subtotal >= 0 AND discount_amount >= 0 AND vat_amount >= 0 AND total >= 0`
  - `invoices_total_consistent`: `total = subtotal - discount_amount + vat_amount`
  - `invoices_vat_rate_range`: `vat_rate >= 0 AND vat_rate <= 100`
  - `invoice_lines_qty_positive`: `qty > 0` — DTO `add-line-item-request.dto.ts:42-45` và `update-line-item-request.dto.ts:25-29` đều `@Min(1)`; **kiểm thêm** đường thêm dòng khác (gói/nhóm sản phẩm 3.6, sao chép dòng khi tạo version 4.6) không sinh `qty = 0`. Nếu có đường nào cho 0 thì dùng `qty >= 0` và ghi lý do — CHECK không được chặt hơn dữ liệu nguồn hợp lệ.
  - `invoice_lines_amount_nonneg`: `amount >= 0`
- Sinh SQL: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (Prisma 7 KHÔNG có `--from-schema-datamodel` [memory: prisma7-migrate-diff-flag-rename]) rồi thêm CHECK; `npx prisma migrate deploy` CHỈ lên `pns-postgres:5433`; diff sau deploy = rỗng.

**D3 — Domain thuần `backend/src/invoices/domain/`.**
- `invoice-eligibility.ts`:
  - `INVOICE_ORDER_STATUSES` = `dachot, dacoc, thicong, nghiemthu, danggiao, dagiao, hoanthanh` dựng từ hằng `TRANG_THAI_*` (`orders/domain/order-status`) — KHÔNG literal, KHÔNG import từ `contracts/` (hai module độc lập; trùng tập là trùng ngữ nghĩa "giá đã snapshot", ghi một dòng docstring). Lý do: giá đóng băng từ lúc Chốt (AD-6/AD-20); `baogia`/`choduyet` tổng còn sống; `huy` không lập hoá đơn; `hoanthanh` vẫn lập được (hoá đơn hay lập khi tất toán).
  - `INVOICE_BLOCKED_MESSAGE = { status: 'Chỉ tạo hoá đơn khi đơn đã chốt và chưa huỷ.', noLines: 'Đơn chưa có dòng vật tư — không tạo hoá đơn được.' }`.
  - `invoiceBlocker({ status, lineCount }) → { status: 400 | 409; message } | null` — thứ tự cố định: status ∉ tập ⇒ 409; `lineCount === 0` ⇒ 400 (đơn `dachot` 0 dòng có thật — TD-35). **KHÔNG** điều kiện về MST khách (Cá nhân không có MST vẫn lập được — Câu hỏi mở 1), về lịch thanh toán hay số tiền đã thu.
  - Overview và POST dùng CÙNG hàm (khuôn `contractBlocker`).
- `invoice-number.ts`: `formatInvoiceNo(seq, issuedAt)` = `` `HD-${yyyy}-${String(seq).padStart(4, '0')}` `` — khuôn mockup `HD-2026-0731`; `yyyy` theo **UTC+7** (31/12 17:30 UTC = năm sau); `seq` toàn cục, không reset theo năm (padStart chỉ là tối thiểu 4 chữ số, seq 12345 ⇒ `HD-2026-12345`).
- `invoice-events.ts`: `InvoiceCreated implements DomainEvent` (khuôn `ContractGenerated`): `type = 'InvoiceCreated'`, `target = { type: 'Order', id: orderId }` (audit của đơn liền mạch), `actorAccountId`, `after = { invoiceId, invoiceNo, orderVersionId, total }` (`total: number`, KHÔNG bigint), `occurredAt = issuedAt`. Không đưa dữ liệu khách vào payload. `AuditSubscriber` tự ghi (AD-18).
- `invoice-snapshot.ts` (thuần, test được không Prisma): `buildInvoiceSnapshot({ customer, lines, resolved }) → { customer…, vatRate, applyVat, subtotal, discountAmount, vatAmount, total, lines: [{ displayOrder, name, unit, qty, unitPrice, amount }] }` — **ZERO số học tiền mới**: `subtotal/discountAmount/vatAmount/total` = đúng `resolved.totals`, `amount` = đúng `line.amount` server đã tính. Thêm assert lập trình (ném `Error`, không phải lỗi người dùng) nếu `Σ line.amount !== totals.subtotal` — hai nguồn phải khớp; nếu lệch là bug pricing, không được lưu chứng từ sai. `displayOrder` = thứ tự 0..n-1 theo `OrderLineView.displayOrder` đã sắp (đánh lại liền mạch để `@@unique([invoiceId, displayOrder])` không bao giờ trùng dù nguồn có lỗ).

**D4 — API (contract tiếng Anh, luật 8). Controller mới `backend/src/invoices/invoices.controller.ts`, `@Controller('orders')`** (khuôn `ContractsController` — docstring ghi lý do prefix).
- Cả 2 handler: `@RequirePermissions(PERM.invoicesManage)` + `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`; `:id` qua `ParseUUIDPipe`; quyền + VAT + cờ giá phân tầng resolve tươi.
- `GET /orders/:id/invoices` ⇒ 200 `InvoicesOverviewResponseDto`:
  - `creatable: boolean`, `blockedReason: string | null` — `creatable = blocker === null && currentInvoice === null`; `blockedReason` = message blocker, hoặc `null` khi lý do duy nhất là bản hiện hành đã có hoá đơn (màn hiện hoá đơn đó, không phải lỗi).
  - `currentInvoiceId: string | null` — hoá đơn của `currentVersionId` nếu đã lập.
  - `versionNo: number` (0 khi chưa có version), `customerName: string`, `customerTaxCode: string | null`, `lineCount: number`
  - `orderTotal: number` — description chứa **"số nguyên đồng"** (để `design-system/money/money-fields.mjs` thu vào guard)
  - `invoices: InvoiceResponseDto[]` (mới nhất trước — `issuedAt desc, seq desc`)
- `POST /orders/:id/invoices` ⇒ **`@HttpCode(200)`** `InvoiceResponseDto` — lần đầu (tạo) và gửi lại (bản hiện hành đã có hoá đơn) cùng mã 200, cùng shape; description OpenAPI nói rõ (khuôn `payments.controller.ts:55-61`). Body rỗng — khoá idempotent là `orderVersionId` hiện hành (không cần `idempotencyKey` từ client: nội dung hoá đơn được xác định hoàn toàn bởi bản đơn).
- `InvoiceResponseDto { id, invoiceNo, versionNo, issuedAt, customerName, customerTaxCode, vatRate, applyVat, subtotal, discountAmount, vatAmount, total, lineCount }`:
  - `subtotal/discountAmount/vatAmount/total` description chứa "số nguyên đồng".
  - `vatRate` description "Thuế suất VAT (%) chụp lúc lập." — **KHÔNG** chứa "đồng"; `versionNo`/`lineCount` cũng KHÔNG (bài học 7.3: "…hợp **đồng**" làm `money-fields.mjs` coi `versionNo` là tiền ⇒ guard tiền ĐỎ màn cũ [memory: money-fields-dong-matches-hop-dong]). **Cấm viết "hợp đồng"/"đồng" trong description của field số không phải tiền.**
  - KHÔNG trả `lines[]` (xem chi tiết dòng + PDF là 7.5; 7.4 lưu dòng để 7.5 dùng).
- Lỗi: 400 (`:id` không UUID; đơn 0 dòng), 403, 404 (ngoài phạm vi/không tồn tại — CÙNG message `getScoped`), 409 `CONFLICT` (trạng thái; đơn vừa đổi bản dưới khoá — `'Đơn vừa thay đổi — tải lại rồi tạo lại hoá đơn.'`). Mô tả OpenAPI liệt kê đủ nhánh.

**D5 — Service `backend/src/invoices/invoices.service.ts`. Thứ tự `create(...)` BẮT BUỘC:**
1. `this.orders.getScoped(actor, perms, orderId, tieredPricingEnabled)` — phạm vi TRƯỚC mọi thứ (404 cùng message), kể cả gửi lại (người ngoài phạm vi gửi lại không được nhận hoá đơn).
2. `this.prisma.$transaction(async (tx) => { … })`:
   1. **Op đầu:** `` tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE` `` (thứ tự khoá toàn hệ thống: `orders` trước — project-context).
   2. Đọc lại `order.findUnique({ select: { status, currentVersionId } })` dưới khoá; `null` hoặc `currentVersionId !== view.currentVersionId` ⇒ 409 `ORDER_CHANGED_MESSAGE` (dòng `view` đã cũ).
   3. **Gửi lại:** `tx.invoice.findUnique({ where: { orderVersionId: fresh.currentVersionId } })` (chỉ khi `currentVersionId !== null`) — có ⇒ trả `{ replay: true, invoice }` NGAY (trước blocker: retry mà response đầu bị mất phải nhận lại đúng hoá đơn kể cả khi đơn vừa sang `hoanthanh`; trạng thái `huy` thì sao? — đơn huỷ sau khi lập vẫn trả hoá đơn đã lập: nó tồn tại thật; ghi rõ trong test).
   4. `loadInputs({ ...view, status: fresh.status }, vatRatePercent, tx)` — customer (`tx.customer.findUnique` theo `customerSdt`; null ⇒ 404 như contracts), version, `resolveOrderTotals`, `invoiceBlocker` ⇒ ném 400/409.
   5. `issuedAt = new Date()`; `` tx.$queryRaw<{ seq: bigint }[]>`SELECT nextval(pg_get_serial_sequence('invoices', 'seq')) AS seq` `` ⇒ `Number(...)`; `invoiceNo = formatInvoiceNo(seq, issuedAt)`. KHÔNG `count()+1`.
   6. `buildInvoiceSnapshot(...)`; `tx.invoice.create({ data: { seq, invoiceNo, …, subtotal: BigInt(…), …, lines: { create: [...] } } })` — MỘT lệnh, dòng qua nested create (luôn ≥ 1 dòng vì blocker; không có `createMany` rỗng).
3. **SAU commit, chỉ khi `replay === false`:** `eventBus.publish(new InvoiceCreated(...))` ĐÚNG 1 lần.
4. Trả DTO (mọi `bigint` đã `Number()`).
- Mọi lỗi trong tx ⇒ rollback ⇒ 0 dòng, 0 event; `nextval` đã lấy thì thủng số (chấp nhận — số nội bộ, sequence không rollback; ghi docstring).
- `overview(...)`: `getScoped` ⇒ `Promise.all([loadInputs(view, vat, this.prisma), invoice.findMany({ where: { orderId }, include: { orderVersion: { select: { versionNo: true } }, _count: { select: { lines: true } } }, orderBy: [{ issuedAt: 'desc' }, { seq: 'desc' }] })])` — `currentInvoiceId` = hoá đơn có `orderVersionId === view.currentVersionId`.
- `loadInputs` là private method dùng chung overview + create (KHÔNG chép) — khuôn `ContractsService.loadInputs` nhưng KHÔNG đọc lịch thanh toán/settings (hoá đơn không cần).
- Dependency: `OrdersService`, `PrismaService`, `EventBus`. KHÔNG `StoragePort`/`QuoteRendererPort` (7.5), KHÔNG `AuditService`/`NotificationDispatcher` (AD-18; guard `no-direct-side-effect-outside-eventbus`).
- Docstring class ghi đủ thứ tự + lý do khoá (khuôn `ContractsService`).

**D6 — Module `backend/src/invoices/invoices.module.ts`:** `imports: [OrdersModule, SettingsModule, FeatureFlagsModule, AccountsModule]`; `controllers: [InvoicesController]`; `providers: [InvoicesService]`. Đăng ký `InvoicesModule` trong `app.module.ts` sau `ContractsModule` (+ dòng docstring "Story 7.4 — …" như các module khác ở đó). `orders/` KHÔNG BAO GIỜ import `invoices/`. Docstring liệt kê lý do từng import (khuôn `contracts.module.ts`). `backend/test/orders-module-wiring.spec.ts:49-55` có ca `ContractsModule wiring` (providers = đúng `[ContractsService]`) ⇒ thêm ca tương tự cho `InvoicesModule` (providers = đúng `[InvoicesService]`, KHÔNG bind renderer/storage).

**D7 — Guard phạm vi `backend/test/no-unscoped-order-write.spec.ts`.**
- `FILE_CANH` thêm `{ file: 'invoices/invoices.service.ts', goiPhamVi: /this\.orders\.(?:getScoped|assertScoped)\s*\(/ }`.
- `CHAM_DON` thêm `/\.invoice\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|find(?:Unique|First|Many)|count)\s*\(/` (+ `invoiceLine` nếu service chạm trực tiếp). `/this\.loadInputs\s*\(/` ĐÃ có trong `CHAM_DON` (dòng 88, 7.3 thêm) — tên method private của `InvoicesService` PHẢI là `loadInputs` để được canh sẵn; không nhân đôi mẫu.
- Anti-blind theo method: trích thân `create` (> 0, chứa `.invoice.create(`) và `overview` (chứa `.invoice.findMany(`). Viết lời gọi liền một dòng — KHÔNG chain `.create(...).catch()` để prettier không tách `.invoice\n.create(` [memory: prettier-chain-blinds-scope-guard].
- Mutation chứng minh ĐỎ (bảng ở Kiểm thử).

**D8 — Client (web + mobile parity; port + fake; màn MỚI). Chỉ phần TẠO + danh sách — xem/xuất PDF là 7.5.**
- **Port** (method tiếng Anh, type mirror DTO field-for-field):
  - web `web/src/design-system/session/invoices-port.ts` + `fake-invoices-port.ts` (+ export ở `session/index.ts` như contracts dòng 111/158); mobile `mobile/lib/design_system/session/invoices_port.dart` + `fake_invoices_port.dart` (+ export ở `session.dart`).
  - `getOverview(orderId) → InvoicesOverview`; `createInvoice(orderId) → InvoiceSummary`. Lỗi reject theo envelope AD-5 (`message`, `status`, `code`) — khuôn `ContractsPortError`.
  - Fake: số đóng hộp theo mockup (tổng 83.010.960, khách "VP Công Chứng Lê Đình Thao", MST `0316552018`), `createInvoice` lần đầu thêm bản `HD-2026-0001` vào bộ nhớ và đặt `currentInvoiceId`, lần hai trả CÙNG bản (mirror idempotent backend); có cấu hình trả `creatable:false` + `blockedReason`, và khách không MST (`customerTaxCode: null`). Fake theo ĐÚNG shape backend (bài học 7.3 review #8). KHÔNG phép tính tiền trong màn/port/fake (guard).
- **Màn mới** web `web/src/screens/invoices/InvoicesScreen.tsx` + `invoices.css` (chỉ class có rule thật — guard css-class-coverage); mobile `mobile/lib/screens/invoices/invoices_screen.dart`. Props `{ port, orderId, onBack? }` (khuôn `ContractsScreenProps`).
  - Topbar "Hoá đơn bán hàng" (eyebrow `HOÁ ĐƠN`), back qua `onBack`.
  - Frame **"Tạo hoá đơn từ đơn"** (kv): `Nguồn` = `Bản {versionNo} (snapshot)`, `Khách hàng` = `customerName`, `MST khách` = `customerTaxCode` hoặc `Không có MST`, `Tổng tiền` qua `<Money>`/`MoneyText`, `Số HĐ nội bộ` = `Tự cấp khi tạo`.
  - Banner info cố định: *"Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau)."*
  - `creatable:false` + `blockedReason !== null` ⇒ Banner cảnh báo `blockedReason`, **ẩn** nút (không gray-disabled — khuôn 7.3).
  - `currentInvoiceId !== null` ⇒ Banner info *"Bản đơn hiện hành đã có hoá đơn {invoiceNo}."* (tra `invoiceNo` trong `invoices` theo id), ẩn nút.
  - `creatable:true` ⇒ nút primary **"Tạo hoá đơn"** ⇒ **ConfirmDialog** (component có sẵn: web `ConfirmDialog.tsx`, mobile cùng khuôn `payment_schedule_screen.dart`) tiêu đề *"Tạo hoá đơn?"*, nội dung *"Hoá đơn chụp lại bản {versionNo} của đơn và không sửa được sau khi tạo."*, nút xác nhận "Tạo hoá đơn" — vì lập chứng từ tiền là hành động dữ liệu không đảo ngược (UX-DR-20; khác 7.3 sinh văn bản in lại được). Xác nhận ⇒ `createInvoice` (disable in-flight, bấm 2 lần ⇒ 1 lời gọi) ⇒ tải lại overview.
  - Danh sách **"Hoá đơn đã tạo"**: mỗi bản `{invoiceNo} · Bản {versionNo} · {dd/MM/yyyy UTC+7}` + tổng qua `<Money>`/`MoneyText`. Rỗng ⇒ EmptyState *"Chưa tạo hoá đơn nào."*; loading = Skeleton; lỗi tải = ErrorState + "Thử lại".
  - 400/409 từ POST ⇒ Banner message server nguyên văn (AD-5) + tải lại overview, giữ view tốt cuối nếu reload lỗi (bài học 7.3 review #5). Lỗi JS/DOM không phải envelope ⇒ fallback *"Không tạo được hoá đơn. Vui lòng thử lại."* (byte-identical hai nền tảng).
  - Ngày `issuedAt` hiển thị theo UTC+7 (helper `vnDate` khuôn `ContractsScreen.tsx`; mobile cùng luật) — fixture test 18:30Z để đo đổi ngày (7.3 review #6).
- **Lối vào:** `OrderDetailScreen` thêm prop `onOpenInvoices?: () => void` ⇒ Button **"Hoá đơn"** trong `od-actions` sau "Hợp đồng" (điều kiện bao `od-actions` thêm `|| onOpenInvoices`); mobile `onOpenInvoices` ⇒ `AppButton(label: 'Hoá đơn')` trong `Wrap`. Caller chỉ truyền khi `can(invoicesManage)` (chưa có composition root — TD-38; màn + nút sẵn sàng như 7.3). Giữ đúng 3 tab.

**D9 — Guard design-system.**
- Mới `design-system/screens/invoices.test.mjs` (khuôn `contracts.test.mjs`): 2 màn + 2 port + 2 fake tồn tại; màn chỉ nói chuyện qua port; nhãn tiếng Việt byte-identical hai nền tảng (bảng nhãn ở Dev Notes); tiền chỉ qua Money/MoneyText; không literal quyền; không số học tiền ở màn/port/fake; nút "Tạo hoá đơn" đi qua ConfirmDialog cả hai nền tảng; KHÔNG có "Xuất PDF"/"Xem lại" (7.5 sở hữu — chống làm trước scope); assert chống-guard-rỗng. Text-guard soi chuỗi đọc RAW file, không qua `stripToCode` [memory: striptocode-deletes-string-literals].
- `order-detail.test.mjs`: bỏ `'Hoá đơn'` khỏi danh sách RAW-TEXT dòng 279 (giữ `'HĐ & HĐơn'`), thêm assert tab list KHÔNG chứa `'Hoá đơn'` (cạnh dòng 274-275), cập nhật comment khối (e.3) theo khuôn câu 7.1/7.3; thêm ca (e.x) nút "Hoá đơn" chỉ render khi có `onOpenInvoices` (cả hai nền tảng) và khối `od-actions` mở theo callback. Vẫn "đúng 3 tab".
- Màn web mới ⇒ ca render trong `web/src/test/screens-render.test.tsx` (guard đếm số file màn sẽ ĐỎ nếu quên).

### 3. Phạm vi

- **TRONG:** `Invoice` + `InvoiceLine` + migration/CHECK (cột `BigInt` đầu tiên); domain `invoice-eligibility`, `invoice-number`, `invoice-snapshot`, `invoice-events`; `invoices/` module (2 route, idempotent theo bản đơn, khoá dòng đơn); guard phạm vi mở rộng; OpenAPI regen; web + mobile: port/fake, màn "Hoá đơn bán hàng" (tạo + danh sách), nút "Hoá đơn" ở chi tiết đơn; parity guard; test 5 lane.
- **NGOÀI:** PDF hoá đơn, xem văn bản hoá đơn, xuất/chia sẻ, R2 (Story 7.5 — FR-28); thông tin pháp nhân người bán trên hoá đơn (7.5 quyết: đọc settings `company.*` của 7.3 lúc render hay snapshot — Câu hỏi mở 3); huỷ/điều chỉnh/thay thế hoá đơn; hoá đơn điện tử (VNPT/Viettel/MISA — Phase sau, PRD:499); chặn theo MST; lập hoá đơn theo từng đợt thanh toán; reset số theo năm; router/HTTP adapter thật (TD-38); notification (Epic 9).

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:637-641`)

- **Given** một Đơn, **When** tạo Hoá đơn, **Then** entity `Invoice` lấy khách hàng (MST), các Dòng, VAT, tổng tiền từ Đơn; lưu số hoá đơn nội bộ + ngày + link Đơn (FR-27).
- **Given** hoá đơn tạo, **When** lưu, **Then** ghi Audit qua event; tiền là integer đồng (FR-27, AD-10, AD-18).

### AC dẫn xuất (đo được)

1. **AC-1 (snapshot từ đơn):** đơn đã chốt fixture mockup (4 dòng, trước VAT 76.862.000, VAT 8% 6.148.960, tổng 83.010.960) ⇒ `POST` 200; lane DB: 1 dòng `invoices` với `orderId`, `orderVersionId = currentVersionId`, `customerSdt/Name/TaxCode/Address` = khách lúc tạo, `vatRate = 8`, `applyVat = true`, `subtotal/discountAmount/vatAmount/total` = đúng `resolveOrderTotals` (so với `OrderView`/`getScopedTotal` cùng đơn — KHÔNG số gõ tay [memory: handpicked-fixture-numbers-hide-formula-bugs]), 4 dòng `invoice_lines` (`name/unit/qty/unitPrice/amount` = đúng `OrderLineView`, `displayOrder` 0..3). Đơn có chiết khấu đã duyệt ⇒ `discountAmount` = snapshot version, `total = subtotal − discount + vat`. Đơn `applyVat:false` ⇒ `vatAmount = 0`.
2. **AC-2 (bất biến sau tạo):** sau khi tạo, đổi tên/MST khách, đổi thuế suất cấu hình, sửa giá danh mục ⇒ `GET` overview vẫn trả hoá đơn cũ đúng số cũ (đọc snapshot, không đọc lại đơn/khách). Unit `buildInvoiceSnapshot`: `Σ amount ≠ subtotal` ⇒ ném (bug pricing không được lưu).
3. **AC-3 (số + ngày):** `invoiceNo` khớp `/^HD-\d{4}-\d{4,}$/`; `formatInvoiceNo(731, new Date('2026-07-06T03:00:00Z'))` ⇒ `'HD-2026-0731'`; `formatInvoiceNo(7, new Date('2026-12-31T17:30:00Z'))` ⇒ `'HD-2027-0007'`; `(7, 2026-12-31T16:59:59Z)` ⇒ `'HD-2026-0007'`; `(12345, …)` ⇒ `'HD-2026-12345'`. `issuedAt` = thời điểm tạo, `occurredAt` của event === `issuedAt` của response.
4. **AC-4 (idempotent theo bản):** `POST` 2 lần cùng bản hiện hành ⇒ cả hai 200, cùng `id`/`invoiceNo`; lane DB 1 dòng; `eventBus.publish` **đúng 1 lần** (`toHaveBeenCalledTimes(1)` [memory: publish-count-unasserted-duplicate-survives]). Sửa đơn sau chốt (bản update ⇒ `currentVersionId` mới) rồi `POST` ⇒ hoá đơn MỚI (`versionNo` mới, số mới), hoá đơn cũ còn nguyên; overview liệt kê mới nhất trước, `currentInvoiceId` = bản mới. Gửi lại khi đơn đã sang `hoanthanh`/`huy` sau lần tạo ⇒ vẫn trả hoá đơn đã lập (200, 0 event).
5. **AC-5 (audit qua event):** tạo thành công ⇒ 1 `InvoiceCreated` target `{type:'Order', id:orderId}`, `after = { invoiceId, invoiceNo, orderVersionId, total }` với `total` là `number`; lane DB: 1 dòng audit `InvoiceCreated`. Service KHÔNG inject `AuditService` (guard `no-direct-side-effect-outside-eventbus` xanh không nới).
6. **AC-6 (tiền integer + BigInt an toàn):** mọi field tiền trong response/event là `number` nguyên (`Number.isInteger`); lane DB: đơn tổng **> 2.147.483.647** (vd 1 dòng 3.000.000.000 = 2 × 1.500.000.000 đơn giá… chọn đơn giá ≤ INT4 và qty để `amount` > INT4) ⇒ `POST` 200 (không 500), `total` đọc lại đúng; e2e đi qua serialize JSON thật (không `bigint` lọt ra — mutant trả thẳng `row.total` phải ĐỎ ở e2e/DB). CHECK `invoices_total_consistent` đứng riêng: `UPDATE invoices SET total = total + 1` trực tiếp ⇒ vi phạm.
7. **AC-7 (điều kiện tạo):** đơn `baogia`/`choduyet`/`huy` ⇒ 409 *"Chỉ tạo hoá đơn khi đơn đã chốt và chưa huỷ."*; đơn đã chốt 0 dòng ⇒ 400 *"Đơn chưa có dòng vật tư — không tạo hoá đơn được."*; mọi từ chối ⇒ 0 dòng, 0 publish, KHÔNG gọi `nextval`. Khách không MST ⇒ vẫn tạo được (`customerTaxCode: null`). Đơn `hoanthanh` ⇒ tạo được. Overview các đơn đó: `creatable:false` + `blockedReason` = ĐÚNG message tương ứng (cùng hàm); bản hiện hành đã có hoá đơn ⇒ `creatable:false`, `blockedReason:null`, `currentInvoiceId` ≠ null. Mã HTTP đo ở lane e2e qua `ValidationPipe`/filter thật [memory: dev-pins-ac-deviation-as-green-test].
8. **AC-8 (khoá dòng đơn — luật 9, CONVENTIONS mục Khoá dòng / F-5):** unit: `$queryRaw … FOR UPDATE` là op ĐẦU TIÊN trong tx (trước `order.findUnique`, `invoice.findUnique`, `nextval`, `invoice.create`). Lane DB: (a) 2 `POST` song song cùng đơn (`Promise.all`) ⇒ 1 dòng, cả hai trả cùng `id`, 0 lỗi 500/P2002, đúng 1 event; (b) **FORCED interleaving**: tx giữ khoá **GHI** `orders.current_version_id` (đổi sang bản mới — holder phải ghi đúng thứ `create` đọc, không chỉ giữ khoá trần [memory: fk-key-share-masks-missing-row-lock]) ⇒ `create` CHỜ rồi 409 *"Đơn vừa thay đổi — …"*, 0 dòng; (c) holder đổi `orders.status` sang `baogia` (mở lại) dưới khoá ⇒ `create` CHỜ rồi 409 trạng thái. Gỡ `FOR UPDATE` (mutation, `cp` backup) ⇒ ca (b)/(c) ĐỎ. Không barrier "cả hai cùng tới" trên CÙNG đơn khi có khoá dòng [memory: barrier-race-test-deadlocks-under-row-lock].
9. **AC-9 (quyền + phạm vi):** thiếu `invoices.manage` ⇒ 403 cả 2 route; thiếu cả `orders.view_all` lẫn `orders.view_own` ⇒ 403; người chỉ có `orders.view_own` không phải owner/assignee ⇒ 404 CÙNG message đơn không tồn tại (overview + POST, kể cả POST khi đơn ĐÃ có hoá đơn — không rò hoá đơn qua đường gửi lại); id không UUID ⇒ 400. Source-guard phạm vi ĐỎ khi chèn đọc `invoice.*` trước `getScoped` trong `create`/`overview` (mutation).
10. **AC-10 (contract OpenAPI):** `npm run openapi:gen` có `GET/POST /orders/{id}/invoices`, DTO tiếng Anh; drift-guard byte-for-byte xanh; `money-fields.mjs` thu `orderTotal`, `subtotal`, `vatAmount`, `total` (và `discountAmount` — đã có trong EXTRA), KHÔNG thu `vatRate`/`versionNo`/`lineCount`/`seq` (`cd design-system && npm test` + ca khoá trong `invoices.test.mjs`); `permissions.json` KHÔNG đổi.
11. **AC-11 (client):** web `web/src/test/invoices-screen.test.tsx` + mobile `mobile/test/screens/invoices/invoices_screen_test.dart` cùng bộ ca: frame hiện `Bản n (snapshot)`, tên khách, MST (2 ca: có MST / `Không có MST`), tổng qua Money/MoneyText; `creatable:false` + `blockedReason` ⇒ banner + nút ẨN; `currentInvoiceId` ⇒ banner "đã có hoá đơn {số}" + nút ẨN; bấm "Tạo hoá đơn" ⇒ ConfirmDialog hiện, HUỶ ⇒ 0 lời gọi, XÁC NHẬN ⇒ `createInvoice` đúng 1 lần (bấm xác nhận 2 lần nhanh ⇒ 1 lời gọi) rồi overview tải lại và danh sách có bản mới; 409 ⇒ banner message server nguyên văn; lỗi không phải envelope ⇒ fallback tiếng Việt; danh sách `số · Bản n · dd/MM/yyyy` (fixture 18:30Z ⇒ ngày hôm sau UTC+7); empty/loading/error + "Thử lại". Mobile thêm 320/360 px không tràn với nhãn dài nhất (`HD-2026-123456`, tên khách 80 ký tự, `blockedReason` dài nhất). `OrderDetailScreen` (cả hai): nút "Hoá đơn" chỉ khi có `onOpenInvoices` — fixture BẬT mọi điều kiện bao ngoài `od-actions` khác TẮT để chứng minh chính `onOpenInvoices` mở khối, và ca có callback khác (`onOpenContracts`) mà KHÔNG có `onOpenInvoices` ⇒ không có "Hoá đơn" [memory: widget-test-gate-unreachable-outer-condition]. `screens-render.test.tsx` có ca `InvoicesScreen`. Parity guard D9 xanh, có assert chống-guard-rỗng.

---

## Tasks / Subtasks

- [x] **T1 — Schema + migration** (AC 1, 6)
  - [x] T1.1 `Invoice` + `InvoiceLine` + back-relation `Order`/`OrderVersion`/`Account` trong `backend/prisma/schema.prisma` (docstring tiếng Anh, sau `Contract`). Kiểm `qty` nguồn có thể 0 không trước khi chốt CHECK `qty`.
  - [x] T1.2 `backend/prisma/migrations/20261022150000_add_invoices/migration.sql` bằng `migrate diff --from-config-datasource --to-schema` + CHECK tay (D2).
  - [x] T1.3 `npx prisma migrate deploy` lên `pns-postgres:5433` (CHỈ DB này); `npx prisma generate`; diff sau deploy rỗng.
- [x] **T2 — Domain thuần** (AC 2, 3, 7)
  - [x] T2.1 `backend/src/invoices/domain/{invoice-eligibility,invoice-number,invoice-snapshot,invoice-events}.ts`.
  - [x] T2.2 Unit `backend/test/invoice-domain.spec.ts`: blocker đủ nhánh + thứ tự + tập trạng thái dựng từ hằng; số + biên năm UTC+7 + padStart; snapshot = đúng totals/amount, đánh lại `displayOrder`, ném khi Σ lệch, không phép tính tiền mới.
- [x] **T3 — Service + controller + module** (AC 1, 3-9)
  - [x] T3.1 DTO `backend/src/invoices/dto/{invoice-response,invoices-overview-response}.dto.ts` (description tiền "số nguyên đồng"; field số không phải tiền KHÔNG chứa "đồng").
  - [x] T3.2 `backend/src/invoices/invoices.service.ts` (D5, `loadInputs` dùng chung, `Number()` mọi bigint).
  - [x] T3.3 `backend/src/invoices/invoices.controller.ts` (D4, `@HttpCode(200)` cho POST) + `invoices.module.ts` (D6) + đăng ký `app.module.ts`.
  - [x] T3.4 Unit `backend/test/invoices.service.spec.ts`: thứ tự scope → FOR UPDATE (op đầu) → đọc lại → replay → blocker → nextval → create → publish; replay ⇒ 0 nextval/0 create/0 publish; từ chối ⇒ 0 nextval; create ném ⇒ 0 publish; version đổi ⇒ 409; mọi tiền trả ra là `number`; `toHaveBeenCalledTimes`. Mock `$transaction` PHẢI chạy callback (không `mockRejectedValue` thẳng [memory: mock-rejected-transaction-false-green]).
  - [x] T3.5 e2e `backend/test/invoices.e2e.spec.ts` qua `initAppOnLoopback`: 200 (tạo + gửi lại cùng thân)/400/403/404/409 từng nhánh, shape JSON (không bigint), route cũ `/contracts`, `/payments`, `/payment-schedule`, `/xuat-bao-gia` vẫn chạy.
  - [x] T3.6 Lane DB `backend/test/invoices.db.integration.spec.ts`: CHECK đứng riêng (ghi thẳng ⇒ vi phạm, mỗi CHECK một ca); tạo thật ⇒ dòng + dòng con + audit `InvoiceCreated`; tổng > INT4 ⇒ 200; bất biến sau đổi khách/VAT; idempotent + bản mới sau update; AC-8 (a)(b)(c).
- [x] **T4 — Guard + contract** (AC 9, 10)
  - [x] T4.1 `backend/test/no-unscoped-order-write.spec.ts` (D7) + anti-blind theo method; mutation chứng minh ĐỎ.
  - [x] T4.2 Kiểm `no-direct-side-effect-outside-eventbus`, `no-handler-without-require-permissions`, `no-permission-literal-outside-registry`, `naming-convention`, `audit-log-append-only`, `orders-module-wiring` xanh với file mới (không nới guard).
  - [x] T4.3 `npm run openapi:gen`; drift-guard xanh; `permissions.json` không đổi.
- [x] **T5 — Web** (AC 11)
  - [x] T5.1 `invoices-port.ts` + `fake-invoices-port.ts` (+ `session/index.ts`).
  - [x] T5.2 `web/src/screens/invoices/InvoicesScreen.tsx` + `invoices.css`.
  - [x] T5.3 `OrderDetailScreen.tsx` prop `onOpenInvoices` + nút "Hoá đơn".
  - [x] T5.4 `web/src/test/invoices-screen.test.tsx`, ca render ở `screens-render.test.tsx`, ca nút ở test chi tiết đơn; `cd web && npm run typecheck && npm test && npm run build`.
- [x] **T6 — Mobile** (AC 11)
  - [x] T6.1 `invoices_port.dart` + `fake_invoices_port.dart` (+ `session.dart`).
  - [x] T6.2 `mobile/lib/screens/invoices/invoices_screen.dart` (widget design-system, `MoneyText`, ConfirmDialog cùng khuôn `payment_schedule_screen.dart`).
  - [x] T6.3 `order_detail_screen.dart` prop `onOpenInvoices` + nút.
  - [x] T6.4 Widget test `mobile/test/screens/invoices/invoices_screen_test.dart` + ca nút ở `mobile/test/screens/orders/order_detail_screen_test.dart`; `cd mobile && flutter analyze && flutter test`. `dart format` chỉ `-o none --set-exit-if-changed` hoặc đúng file mình sửa [memory: dart-format-writes-files-cascade].
- [x] **T7 — Parity + 5 lane** (AC 10, 11)
  - [x] T7.1 `design-system/screens/invoices.test.mjs` (mới), cập nhật `order-detail.test.mjs` (D9).
  - [x] T7.2 Đủ 5 lane cùng working tree: `cd backend && npm test` · `npm run test:db` · `cd design-system && npm test` · web typecheck/test/build · mobile analyze/test. Lint backend so baseline bằng stash [memory: backend-lint-red-at-baseline] — file MỚI phải sạch eslint/prettier.
  - [x] T7.3 Bảng mutation TỰ CHẠY vào Completion Notes.

---

## Dev Notes

### Quyết định Trợ Lý tuyên bố (2026-10-22) — ưu tiên hơn Câu hỏi mở 3 và mục NGOÀI

- **Snapshot người bán NGAY ở 7.4:** lúc tạo hoá đơn, chép các trường pháp nhân `company.*` (settings 7.3: tên, MST, địa chỉ, người đại diện, chức vụ, điện thoại, tài khoản ngân hàng) vào cột của hoá đơn, trong cùng transaction dưới khoá dòng đơn. Hoá đơn là chứng từ append-only: sửa settings sau đó KHÔNG đổi hoá đơn đã lập. Trường trống chép trống (7.5 render "Chưa cấu hình"), không chặn tạo. Có test: đổi settings sau khi lập ⇒ hoá đơn cũ giữ giá trị cũ.
- Các câu mở 1, 2, 4, 5 giữ mặc định của story.

### Quyết định của Đại Ca và luật đã chốt (2026-10-21) — ưu tiên hơn mọi chỗ khác

[Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`, `extra-instructions-7-review.txt`]
1. Mọi đường ghi/đọc đơn mới qua kiểm phạm vi ⇒ D5 bước 1 + guard D7.
2. Tồn kho: story này KHÔNG chạm tồn kho.
3. Màn web mới ⇒ ca ở `screens-render.test.tsx`; chạy typecheck/test/build.
4. Màn mobile mới ⇒ widget test bắt buộc [memory: mobile-screens-need-widget-tests].
5. Guard mới/mở rộng có assert chống-guard-rỗng.
6. e2e dùng `initAppOnLoopback` (`backend/test/util/listen-loopback.ts`).
7. KHÔNG `git push`; `git add` đường dẫn cụ thể, không `-A`; `package-lock.json` `git add -f` nếu đổi (story này KHÔNG thêm thư viện).
8. Code tiếng Anh (biến/hàm/file/comment/test/log/commit); chỉ chuỗi hiển thị tiếng Việt; route/DTO/port mới tiếng Anh (`/invoices`, `createInvoice`, `invoiceNo`). Không đổi tên symbol tiếng Việt cũ (`TRANG_THAI_*`, `getScoped`…).
9. Tiền số nguyên đồng; thao tác tiền dưới khoá dòng đơn (`SELECT id FROM orders … FOR UPDATE` op đầu) + ca DB interleaving theo `backend/CONVENTIONS.md` mục Khoá dòng; hiển thị qua `<Money>`/`MoneyText` (`83.010.960 đ`).
10. Route mới tiếng Anh `/invoices`. Review: `/ck:code-review` + bẻ thử guard phạm vi và `FOR UPDATE` (mutation, `cp` backup, KHÔNG `git checkout` [memory: mutation-test-never-git-checkout]).

### Files sẽ đổi / tạo

| File | Loại | Ghi chú |
|---|---|---|
| `backend/prisma/schema.prisma` | UPDATE | + `Invoice`, `InvoiceLine`, back-relation `Order`/`OrderVersion`/`Account` |
| `backend/prisma/migrations/20261022150000_add_invoices/migration.sql` | NEW | + CHECK tay |
| `backend/src/invoices/invoices.{module,controller,service}.ts` | NEW | 2 route |
| `backend/src/invoices/domain/{invoice-eligibility,invoice-number,invoice-snapshot,invoice-events}.ts` | NEW | thuần |
| `backend/src/invoices/dto/{invoice-response,invoices-overview-response}.dto.ts` | NEW | |
| `backend/src/app.module.ts` | UPDATE | + `InvoicesModule` + docstring |
| `backend/test/no-unscoped-order-write.spec.ts` | UPDATE | canh `invoices.service.ts` |
| `backend/test/orders-module-wiring.spec.ts` | UPDATE (nếu có ca consumer) | `InvoicesModule` |
| `backend/test/{invoice-domain,invoices.service,invoices.e2e,invoices.db.integration}.spec.ts` | NEW | |
| `backend/openapi/openapi.json` | REGEN | |
| `web/src/design-system/session/{invoices-port,fake-invoices-port}.ts`, `index.ts` | NEW/UPDATE | |
| `web/src/screens/invoices/{InvoicesScreen.tsx,invoices.css}` | NEW | |
| `web/src/screens/orders/OrderDetailScreen.tsx` | UPDATE | nút "Hoá đơn" |
| `web/src/test/{invoices-screen.test.tsx,screens-render.test.tsx}` + test chi tiết đơn | NEW/UPDATE | |
| `mobile/lib/design_system/session/{invoices_port,fake_invoices_port}.dart`, `session.dart` | NEW/UPDATE | |
| `mobile/lib/screens/invoices/invoices_screen.dart` | NEW | |
| `mobile/lib/screens/orders/order_detail_screen.dart` | UPDATE | nút "Hoá đơn" |
| `mobile/test/screens/invoices/invoices_screen_test.dart`, `mobile/test/screens/orders/order_detail_screen_test.dart` | NEW/UPDATE | |
| `design-system/screens/{invoices,order-detail}.test.mjs` | NEW/UPDATE | |

KHÔNG đụng: `contracts/*`, `orders/quote/*`, `settings/*`, `payments/*`, `storage/*` (7.4 không có PDF/R2).

### Nhãn hiển thị chung (byte-identical web ↔ mobile)

`Hoá đơn bán hàng` · `HOÁ ĐƠN` (eyebrow) · `Tạo hoá đơn từ đơn` · `Nguồn` · `Bản ` · ` (snapshot)` · `Khách hàng` · `MST khách` · `Không có MST` · `Tổng tiền` · `Số HĐ nội bộ` · `Tự cấp khi tạo` · `Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).` · `Bản đơn hiện hành đã có hoá đơn ` · `Tạo hoá đơn` · `Tạo hoá đơn?` · `Hoá đơn chụp lại bản ` · ` của đơn và không sửa được sau khi tạo.` · `Huỷ` · `Hoá đơn đã tạo` · `Chưa tạo hoá đơn nào.` · `Không tạo được hoá đơn. Vui lòng thử lại.` · `Thử lại` · `Hoá đơn` (nút ở chi tiết đơn). Dùng đúng chữ "Hoá" (oá — chính tả dự án, như "Huỷ"), không "Hóa".

### Hiện trạng phải giữ

- `ContractsService`/`PaymentsService`/`QuoteExportService` không đổi byte nào. Route cũ không đổi; `OrdersController` không thêm handler.
- `OrderDetailScreen`/`order_detail_screen`: đúng 3 tab; nút "Thanh toán", "Hợp đồng" giữ nguyên thứ tự; thêm nút không làm tràn 320 px (mobile đã `Wrap`).
- Guard `order-detail.test.mjs` không YẾU đi: bỏ RAW-TEXT `'Hoá đơn'` đi kèm assert tab mới (đúng câu chữ "The rule did not weaken — the set of shipped surfaces grew").
- `resolveOrderTotals`/`computeOrderTotals` không đổi (hoá đơn chỉ gọi).

### Tình huống biên đã tính

- **Đơn mở lại (`mo_lai`) sau khi đã lập hoá đơn:** hoá đơn cũ giữ nguyên; overview ⇒ `creatable:false` (status `baogia`) cho tới khi chốt lại; chốt lại tạo version mới ⇒ được lập hoá đơn mới. Không tự huỷ hoá đơn cũ (Câu hỏi mở 2).
- **Khách Cá nhân không MST** ⇒ `customerTaxCode: null`, màn hiện "Không có MST", không chặn.
- **Không áp VAT** ⇒ `applyVat:false`, `vatAmount:0`, `vatRate` vẫn lưu giá trị resolver trả (để 7.5 in đúng nhãn).
- **Tổng > INT4** ⇒ `BigInt` (D2); DB lane chứng minh.
- **`nextval` trả `bigint`** ⇒ `Number(row.seq)`; thủng số khi tx rollback (chấp nhận, ghi docstring).
- **Gửi lại khi đơn đã huỷ sau khi lập** ⇒ trả hoá đơn đã lập (nó tồn tại thật), không 409.
- **Hai người bấm cùng lúc** ⇒ khoá dòng đơn tuần tự hoá; người sau thấy bản đã có ⇒ replay, 1 hoá đơn, 1 event.
- **Dòng tên/khách chứa HTML** ⇒ không render HTML ở 7.4 (client render text thuần — React/Flutter tự escape); 7.5 escape khi dựng PDF.

### Kiểm thử — luật dự án áp dụng trực tiếp

- Publish/create/nextval: `toHaveBeenCalledTimes(n)`, không `mock.calls[0]` [memory: publish-count-unasserted-duplicate-survives].
- **Mutation (`cp` backup, mutant PHẢI compile [memory: mutation-must-compile-or-false-red]) — kết quả mong đợi:** (a) gỡ `FOR UPDATE` ⇒ DB (b)/(c) ĐỎ; (b) chèn `invoice.count` trước `getScoped` trong `create` ⇒ guard ĐỎ; (c) bỏ nhánh replay (luôn tạo) ⇒ unit + DB (P2002/500) ĐỎ; (d) publish cả khi replay ⇒ unit `toHaveBeenCalledTimes(1)` ĐỎ; (e) publish TRƯỚC commit (trong tx) ⇒ unit "create ném ⇒ 0 publish" ĐỎ; (f) trả `row.total` (bigint) thẳng ra DTO ⇒ e2e/DB ĐỎ; (g) `seq = count()+1` ⇒ unit nextval ĐỎ (DB song song trên 2 đơn KHÁC nhau nếu muốn chứng minh ở lane DB — cùng đơn đã bị khoá tuần tự hoá); (h) bỏ re-check `currentVersionId` dưới khoá ⇒ DB (b) ĐỎ; (i) đổi tập trạng thái (thêm `baogia`) ⇒ domain + e2e ĐỎ; (j) `buildInvoiceSnapshot` tự cộng lại `subtotal` thay vì lấy `totals` ⇒ kiểm có ca nào ĐỎ (ca chiết khấu/không VAT) — nếu sống thì mutant tương đương trong fixture, ghi lại [memory: mutation-semantically-equivalent-false-survivor]; (k) gỡ cổng `onOpenInvoices` khỏi `od-actions` (web / mobile) ⇒ vitest / widget ĐỎ; (l) gỡ ConfirmDialog (gọi thẳng) ⇒ test "Huỷ ⇒ 0 lời gọi" + guard ĐỎ. Mutant sống sót có thể vì lớp phòng thủ thứ hai — mutate cả lớp đó [memory: mutation-hits-one-layer-only]. Ghi bảng kết quả TỰ CHẠY.
- Text-guard soi chuỗi đọc RAW file [memory: striptocode-deletes-string-literals]; regex trích thân method theo khuôn prettier, không `\{[^}]*\}` [memory: text-guard-brace-regex-nested-generics].
- Web `.tsx` lỗi cú pháp có thể qua text-guard ⇒ luôn chạy `npm run typecheck` + `npm test` [memory: web-tsx-syntax-error-passes-all-lanes].
- Lane DB cần Docker: `docker start pns-postgres`; daemon không lên từ shell agent ⇒ viết spec, báo lane CHƯA chạy, nhờ Đại Ca mở Docker Desktop [memory: db-lane-needs-docker-desktop-gui]. KHÔNG ghi DB nào khác. Lane DB tách bằng `testPathIgnorePatterns` (`*.db.integration.spec.ts`), không `describe.skip` [memory: describe-skip-does-not-separate-test-lane].
- Prisma 7 nullable: `customerTaxCode`/`customerAddress` là `String?` (không Json) ⇒ `null` thẳng được; KHÔNG áp `Prisma.JsonNull` [memory: prisma7-nullable-json-jsonnull — chỉ cho Json].
- P2002 tag chỉ đáng tin khi INSERT [memory: prisma7-p2003-only-on-insert] — idempotency KHÔNG dựa vào bắt P2002; dựa vào đọc dưới khoá (unique là lưới cuối).
- Reviewer song song mutate cùng file ⇒ kiểm lại finding trên file hiện tại [memory: parallel-reviewers-mutation-collide].

### Previous Story Intelligence (7.3, 7.2, 7.1)

- **7.3 (sau review):** sinh tài liệu trong MỘT tx khoá dòng đơn (op đầu FOR UPDATE, đọc lại status/version, số cấp dưới khoá, publish SAU commit) — review #1 HIGH đã bắt bản đầu không khoá; 7.4 làm đúng từ đầu. Ca DB barrier cùng đơn deadlock dưới khoá ⇒ dùng holder FORCED interleaving (review #2). Client: reload sau hành động giữ view tốt cuối; `messageOf` chỉ nhận envelope; fake theo shape backend; fixture ngày 18:30Z; ca "nút vắng khi không có callback" phải mở `od-actions` bằng callback khác (review #5-8). Mô tả OpenAPI chứa "hợp đồng" ⇒ `money-fields` coi là tiền.
- **7.2:** idempotent 200 cả hai lần; khuôn controller `@Controller('orders')` ngoài `orders/`; guard phạm vi `FILE_CANH`/`CHAM_DON` + anti-blind; message class-validator tiếng Việt; e2e id fake phải là UUID thật; web `Banner` không có tone `ok` (dùng `info`); mobile `AppFrame` in nhãn HOA ⇒ widget test tìm `'…'.toUpperCase()`.
- **7.1:** đừng chèn model giữa khối `///`; `migrate diff --from-config-datasource --to-schema`; tiền server tự tính phải xử lý INT4 [memory: int4-money-column-percent-overflow] ⇒ 7.4 chọn `BigInt`; Money guard bắt `${x.amount}`; mobile cấm `Color(0x…)` ad-hoc.
- **Epic 5/6:** widget test mobile với nhãn DÀI NHẤT ở 320/360 px; flaky đã biết ngoài phạm vi: `web/src/test/stock-vouchers-screen.test.tsx` khi máy bận.

### Git intelligence (5 commit gần nhất)

- `6a1373a` feat(story-7.3): contracts PDF — khuôn module/controller/service/guard/e2e/DB mà `invoices/` mirror (trừ renderer/R2).
- `7d4fcc7` feat(story-7.2): Payment idempotent dưới khoá dòng đơn — khuôn idempotent 200 + publish sau commit.
- `f711499` feat(story-7.1): lịch nhiều đợt — bài học INT4.
- `13408c1` docs(epic-7): luật 9/10 (khoá, route `/invoices`).
- Commit story này: `feat(story-7.4): ...` tiếng Anh, không nhắc AI, `git add` đúng đường dẫn.

### Latest tech notes

- KHÔNG thêm thư viện. Stack ghim trong `project-context.md` (NestJS 11.1.27, Prisma 7.8.0 + adapter-pg, React 19.2.7, Flutter 3.44).
- Prisma `BigInt`: input nhận `bigint` (hoặc `number` — dùng `BigInt(n)` tường minh cho rõ), output luôn `bigint`. Postgres `BIGINT` (INT8). Raw `$queryRaw` cũng trả `bigint`. `JSON.stringify(1n)` ném ⇒ không để `bigint` chạm response/event/log.
- Nested create: `invoice.create({ data: { …, lines: { create: [...] } } })` chạy trong cùng lệnh/tx — không cần `createMany` riêng.
- class-validator: không có body ở POST (không DTO request).

### Project Structure Notes

- Module `invoices/` khớp spine (`invoices/ # Invoice (DB + PDF)`). Route `orders/:id/invoices` là sub-resource của đơn (CONVENTIONS: danh từ số nhiều, kebab-case); bảng `invoices`, `invoice_lines` snake_case số nhiều; file kebab-case.
- Biến thể có chủ đích: tập trạng thái lập hoá đơn trùng `CONTRACT_ORDER_STATUSES` nhưng khai riêng ở `invoices/domain` (không phụ thuộc chéo `contracts/`).
- 7.5 sẽ thêm PDF: cân nhắc tách helper template (`escapeHtml`, `formatMoney`…) khỏi `orders/quote/quote-template.ts` khi có consumer thứ ba (ghi chú 7.3) — KHÔNG làm ở 7.4.

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **MST bắt buộc?** FR-27 ghi "khách hàng (MST)". Mặc định: lấy MST nếu có, KHÔNG chặn khách không MST (Cá nhân). Nếu Đại Ca muốn chỉ khách Thương mại có MST mới lập được ⇒ thêm nhánh vào `invoiceBlocker` (một chỗ).
2. **Đơn mở lại / sửa sau khi đã lập hoá đơn:** mặc định hoá đơn cũ giữ nguyên, bản mới lập hoá đơn mới — hai hoá đơn cùng tồn tại. Huỷ/thay thế hoá đơn cũ (đánh dấu "đã thay thế") là story riêng nếu cần.
3. **Thông tin người bán trên hoá đơn (7.5):** chưa snapshot ở 7.4. Mặc định đề xuất cho 7.5: snapshot `company.*` (settings 7.3) vào hoá đơn lúc lập là đúng nhất cho chứng từ — nếu chọn vậy, 7.5 sẽ cần migration thêm cột (hoặc Đại Ca muốn làm ngay ở 7.4 thì thêm 7 cột snapshot + đọc `SettingsService.companyLegalEntity()` trong tx).
4. **Định dạng số `HD-yyyy-NNNN`, không reset theo năm:** theo mockup; `NNNN` là seq toàn cục. Nếu muốn reset về 0001 mỗi năm ⇒ cần bảng đếm theo năm dưới khoá (story riêng).
5. **Một bản đơn – một hoá đơn:** mặc định. Nếu nghiệp vụ cần hoá đơn theo từng đợt thanh toán (hoá đơn từng phần) ⇒ đổi unique + mô hình (story riêng, đụng FR-27).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:609-647`] — Epic 7, Story 7.4/7.5 AC.
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md:83,273,369-383,398,498-514`] — FR-27/FR-28, ma trận quyền "Tạo/xuất hoá đơn", không tích hợp HĐĐT.
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`] — AD-3, AD-4, AD-5, AD-6, AD-10, AD-12, AD-16, AD-17, AD-18, AD-20; ERD `ORDER ||--o{ INVOICE` (dòng 240); module tree `invoices/` (dòng 452, 486).
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md:41`; `mockups/all-screens.html:2745-2860` `#s-invoice`].
- [Source: `backend/src/contracts/{contracts.service,contracts.controller,contracts.module}.ts`, `contracts/domain/{contract-eligibility,contract-number,contract-events}.ts`] — khuôn trực tiếp.
- [Source: `backend/src/payments/payments.controller.ts:54-61`, `payments/payments.service.ts:120-200`] — idempotent 200, replay không publish, thứ tự dưới khoá.
- [Source: `backend/src/payments/domain/payment-schedule.ts:25-28`] — bài học INT4.
- [Source: `backend/src/orders/orders.service.ts:178-211,1874-1910`] — `OrderLineView`, `OrderView`, `assertScoped`/`getScoped`/`getScopedTotal`.
- [Source: `backend/src/orders/domain/order-totals.ts:40-131`] — `computeOrderTotals`, `resolveOrderTotals`.
- [Source: `backend/test/no-unscoped-order-write.spec.ts:29-80`] — guard phạm vi.
- [Source: `backend/CONVENTIONS.md` mục Đặt tên, Prisma `@@map`, OpenAPI, Permission registry, Error envelope, Domain Event, Khoá dòng].
- [Source: `web/src/screens/orders/OrderDetailScreen.tsx:87-89,481-500`; `mobile/lib/screens/orders/order_detail_screen.dart:89-107,390-425`; `design-system/screens/order-detail.test.mjs:255-288`] — lối vào bằng nút + guard tab.
- [Source: `web/src/screens/contracts/ContractsScreen.tsx`, `web/src/design-system/session/contracts-port.ts`, `mobile/lib/screens/contracts/contracts_screen.dart`, `design-system/screens/contracts.test.mjs`] — khuôn màn/port/parity.
- [Source: `design-system/money/money-fields.mjs`] — guard tiền thu field theo description "đồng".
- [Source: `_bmad-output/implementation-artifacts/7-3-sinh-hop-dong-thi-cong-mua-ban-pdf.md`, `7-2-ghi-nhan-thanh-toan-auto-chuyen-trang-thai.md`, `7-1-cau-hinh-lich-thanh-toan-nhieu-dot.md`] — learnings.
- [Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`] — luật 1-10.
- [Source: `_bmad-output/project-context.md`] — luật toàn dự án.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m]) — controller; web + mobile clients by two parallel sub-agents under the controller's contract

### Debug Log References

- `prisma format` reformatted unrelated models (90 lines) ⇒ reverted, inserted the two models by hand (only +64 lines in `schema.prisma`).
- `migrate diff --from-config-datasource --to-schema` ⇒ SQL + 5 hand CHECKs; `migrate deploy` on `pns-postgres:5433` only; diff after deploy = empty migration.
- design-system parity first run RED twice: web JSX wrapped the info banner across lines (renders the same, source not byte-identical) ⇒ single literal; mobile relied on the dialog's default `'Huỷ'` ⇒ explicit `cancelLabel: 'Huỷ'`.
- Mobile agent found the shared `AppConfirmDialog` footer `Row` overflowing 15 px at 320 px with "Tạo hoá đơn" (AC-11 asks 320 px with the longest labels) ⇒ footer is now a `Wrap` (spacing 8, run spacing 8); the 320 px case opens the dialog again. Proof: footer reverted to `Row` ⇒ "A RenderFlex overflowed by 15 pixels" RED; with `Wrap` green.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Seller snapshot (Trợ Lý decision, Dev Notes):** 7 columns `seller_*` (`String`, `''` = not configured) copied from `SettingsService.companyLegalEntity()` inside the creation tx under the order lock; never blocks. DB lane proves a later settings change leaves the stored seller untouched. Not in the response DTO (7.5 renders it). Hence `InvoicesService` also depends on `SettingsService` (D5 listed only Orders/Prisma/EventBus — the decision supersedes it); still no Storage/Renderer/Audit.
- **Pipeline `create`:** `getScoped` → tx[`SELECT id FROM orders … FOR UPDATE` → re-read status/version (version changed ⇒ 409 `Đơn vừa thay đổi — tải lại rồi tạo lại hoá đơn.`) → replay lookup by `orderVersionId` (found ⇒ return it, 0 write, 0 event — before the blocker, so a completed/cancelled order still replays) → `loadInputs` (customer, version, `resolveOrderTotals`, `invoiceBlocker`) → seller → `nextval` → ONE `invoice.create` with nested lines] → publish `InvoiceCreated` after commit, only when new. `toView` is the one `bigint → number` conversion point (create and replay both go through it).
- **Money as BigInt** (first BigInt columns in the schema): totals + line amount; `unitPrice`/`qty` stay Int. CHECKs: `invoices_amounts_nonneg`, `invoices_total_consistent`, `invoices_vat_rate_range`, `invoice_lines_qty_positive` (every line write path is `@Min(1)`; revise copies existing lines), `invoice_lines_amount_nonneg`.
- **API:** `GET/POST /orders/{id}/invoices`, POST `@HttpCode(200)` for create and replay; `permissions.json` unchanged (`invoices.manage` existed). `money-fields.mjs` collects `orderTotal/subtotal/discountAmount/vatAmount/total`, not `vatRate/versionNo/lineCount/seq` (asserted in `invoices.test.mjs`).
- **Clients:** web `InvoicesScreen` + mobile `invoices_screen.dart` (create frame, info banner, blocked/already-invoiced banners hiding the button, ConfirmDialog → create → reload keeping the last good view, list newest first with UTC+7 dates, empty/loading/error). "Hoá đơn" button after "Hợp đồng" on both order-detail screens, gated on `onOpenInvoices` (container opens on it too). No "Xuất PDF"/"Xem lại" (7.5). Mobile keeps `_busy` until the post-create reload finishes (same as web).
- **Guards:** scope guard watches `invoices/invoices.service.ts` (+ `.invoice.*`/`.invoiceLine.*` in `CHAM_DON`, anti-blind per method, a "BẮT" sample); `orders-module-wiring` asserts `InvoicesModule` provides only `InvoicesService`; `order-detail.test.mjs`: `'Hoá đơn'` left the RAW-TEXT list together with a new tab-list assert + new (e.8) button-gate test; new `design-system/screens/invoices.test.mjs` (files exist, not blind incl. raw, labels byte-identical on RAW text, "Hoá" spelling, port-only, Money only, no money arithmetic, confirm dialog, server-flag gate, no 7.5 buttons, no permission literals, money-field set).
- **5 lanes, same working tree:** backend `npm test` 113 suites / 2317 tests ✅ · `npm run test:db` 25 suites / 305 tests ✅ (invoices 17/17) · `design-system npm test` 483/483 ✅ · web typecheck ✅ + vitest 10 files / 173 tests ✅ + build ✅ · mobile `flutter analyze` no issues ✅ + `flutter test` 430 ✅ (re-run of touched suites after the last edit: 36/36). ESLint/Prettier clean on every new/changed backend file (repo-wide lint baseline debt untouched).
- **Mutation table (self-run, `cp` backups, every mutant compiles):**

| # | Mutant | Lane(s) | Result |
|---|---|---|---|
| a | drop `FOR UPDATE` | DB | RED 3 (holder b/c + same-order concurrency) |
| b | `invoice.count` before `getScoped` in `create` | scope guard | RED 1 |
| c | no replay branch (always create) | unit / DB | RED 3 / RED 3 |
| d | publish also on replay | unit | RED 3 |
| e | publish inside the tx (before commit) | unit | RED 1 (order log) |
| f | `row.total` (bigint) straight into the DTO | e2e / DB | RED 8 / RED 4 |
| g | `seq = count()+1` | unit | RED 9 |
| h | no `currentVersionId` re-check under the lock | DB | RED 1 (holder b) |
| i | `baogia` added to the status set | domain / e2e | RED 3 / RED 1 |
| j | snapshot recomputes `total` from lines | domain / DB | RED 1 / GREEN — equivalent in the DB fixtures (no discount); the discount case lives in the domain lane |
| k | seller not copied (`legalName: ''`) | DB | RED 1 |
| l | Σ-lines assert disabled | domain / unit | RED 1 / RED 1 |
| m | web `od-actions` gate without `onOpenInvoices` (web agent) | vitest | RED 1 |
| n | web create without ConfirmDialog (web agent) | vitest | RED 6 |
| o | mobile button gate / block condition / confirm dialog removed (mobile agent) | widget | RED each (7 for the dialog) |
| p | dialog footer back to `Row` | widget 320 px | RED (overflow 15 px) |
| q | parity guard: web `<ConfirmDialog` renamed / mobile "Xuất PDF" added / web total as `String(...)` | design-system | RED 1 each |

- Open questions 1, 2, 4, 5 kept the story defaults (no MST block; old invoices kept on revise; global seq `HD-yyyy-NNNN`; one invoice per version). Not done (out of scope): composition root wiring (TD-38) — callers pass `onOpenInvoices` only with `invoices.manage` once routing exists.

### File List

- `backend/prisma/schema.prisma` (UPDATE)
- `backend/prisma/migrations/20261022150000_add_invoices/migration.sql` (NEW)
- `backend/src/invoices/invoices.module.ts` (NEW)
- `backend/src/invoices/invoices.controller.ts` (NEW)
- `backend/src/invoices/invoices.service.ts` (NEW)
- `backend/src/invoices/domain/invoice-eligibility.ts` (NEW)
- `backend/src/invoices/domain/invoice-number.ts` (NEW)
- `backend/src/invoices/domain/invoice-snapshot.ts` (NEW)
- `backend/src/invoices/domain/invoice-events.ts` (NEW)
- `backend/src/invoices/dto/invoice-response.dto.ts` (NEW)
- `backend/src/invoices/dto/invoices-overview-response.dto.ts` (NEW)
- `backend/src/app.module.ts` (UPDATE)
- `backend/openapi/openapi.json` (REGEN)
- `backend/test/invoice-domain.spec.ts` (NEW)
- `backend/test/invoices.service.spec.ts` (NEW)
- `backend/test/invoices.e2e.spec.ts` (NEW)
- `backend/test/invoices.db.integration.spec.ts` (NEW)
- `backend/test/no-unscoped-order-write.spec.ts` (UPDATE)
- `backend/test/orders-module-wiring.spec.ts` (UPDATE)
- `web/src/design-system/session/invoices-port.ts` (NEW)
- `web/src/design-system/session/fake-invoices-port.ts` (NEW)
- `web/src/design-system/session/index.ts` (UPDATE)
- `web/src/screens/invoices/InvoicesScreen.tsx` (NEW)
- `web/src/screens/invoices/invoices.css` (NEW)
- `web/src/screens/orders/OrderDetailScreen.tsx` (UPDATE)
- `web/src/test/invoices-screen.test.tsx` (NEW — includes the order-detail "Hoá đơn" button cases, like `contracts-screen.test.tsx`)
- `web/src/test/screens-render.test.tsx` (UPDATE)
- `mobile/lib/design_system/session/invoices_port.dart` (NEW)
- `mobile/lib/design_system/session/fake_invoices_port.dart` (NEW)
- `mobile/lib/design_system/session/session.dart` (UPDATE)
- `mobile/lib/design_system/components/dialog.dart` (UPDATE — footer `Wrap`)
- `mobile/lib/screens/invoices/invoices_screen.dart` (NEW)
- `mobile/lib/screens/orders/order_detail_screen.dart` (UPDATE)
- `mobile/test/screens/invoices/invoices_screen_test.dart` (NEW)
- `mobile/test/screens/orders/order_detail_screen_test.dart` (UPDATE)
- `design-system/screens/invoices.test.mjs` (NEW)
- `design-system/screens/order-detail.test.mjs` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)
- `_bmad-output/implementation-artifacts/7-4-tao-hoa-don-tu-don-luu-db.md` (this file)

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (story-automator review, `/ck:code-review` làm lớp chính + 1 reviewer phụ cho client) — 2026-10-22
**Outcome:** Approve sau khi sửa. 0 CRITICAL, 1 MEDIUM, 5 LOW (+ 3 nit fake) — đã sửa HẾT.

**Kiểm luật dự án bằng mutation (`cp` backup, không `git checkout`, mutant đều compile):**

| Mutant | Lane | Kết quả |
|---|---|---|
| Gỡ `FOR UPDATE` khỏi `create` | DB | ĐỎ 3 (cùng đơn song song, holder đổi version, holder mở lại) |
| `invoice.count` trước `getScoped` trong `create` | guard phạm vi | ĐỎ 1 |
| `invoice.findMany` trước `getScoped` trong `overview` | guard phạm vi | ĐỎ 1 |
| Gỡ kiểm "đọc lúc còn báo giá" (fix #1) | unit / DB | ĐỎ 1 / ĐỎ 1 |
| Web: nút trang gọi `create()` thẳng | design-system | ĐỎ 1 |
| Mobile: bỏ nhãn "Hoá đơn bán hàng" khỏi code (còn trong comment) | design-system | ĐỎ 1 (trước fix #4 thì XANH) |
| Web/mobile: bỏ xoá banner fallback sau lần tạo mất response (fix #5) | vitest / widget | ĐỎ 1 / ĐỎ 1 |
| Web: bỏ `disabled={busy}` trên nút trang | vitest | ĐỎ 1 |

**Findings & fix:**

1. **[MEDIUM] Race báo giá → chốt giữa đọc phạm vi và khoá** (`invoices.service.ts`). `confirm` GIỮ nguyên `currentVersionId` ⇒ kiểm con trỏ version dưới khoá không thấy. `getScoped` đọc lúc đơn còn `baogia` (dòng/giá sống), rồi người khác sửa dòng + chốt; dưới khoá `status=dachot`, cùng version ⇒ hoá đơn chụp DÒNG CŨ (chứng từ tiền sai). Đã chứng minh trên Postgres thật: holder sửa qty 18→20 + chốt dưới khoá ⇒ không có fix thì hoá đơn được lập từ qty 18. Fix: dưới khoá, nếu `fresh.status !== view.status` và `view.status` chưa thuộc tập đã đóng băng ⇒ 409 `ORDER_CHANGED_MESSAGE` (sau replay, trước blocker). Test: unit + DB forced-interleaving mới. Ghi chú: `contracts.service.ts` (7.3) có cùng khe hở — KHÔNG sửa ở đây (story cấm đụng `contracts/*`), đề xuất follow-up.
2. **[LOW] Web test "bấm xác nhận 2 lần ⇒ 1 lời gọi" không chạm guard màn** (dialog đã đóng, click thứ hai rơi vào node rời). Thêm assert nút trang `disabled` khi đang gửi + bấm vào không mở lại dialog (mutant bỏ `disabled={busy}` ⇒ ĐỎ).
3. **[LOW] Mobile cùng điểm mù** — test đã assert `onPressed == null` của nút trang (đủ chứng minh `_busy` khoá UI); không đổi thêm.
4. **[LOW] Guard parity "confirm dialog" yếu hơn comment** (`design-system/screens/invoices.test.mjs`): nay assert nút trang CHỈ mở dialog (web `setConfirming(true)`, mobile `_confirmCreate(o)`), dialog confirm gọi create, và `createInvoice(` xuất hiện đúng 1 chỗ mỗi nền tảng.
5. **[LOW] Guard nhãn dùng chung đọc RAW kể cả comment** ⇒ nhãn chỉ còn trong comment vẫn qua. Nay so trên code đã bỏ comment (string literal giữ nguyên); assert chống-guard-rỗng RAW giữ.
6. **[LOW] Banner "Không tạo được hoá đơn" vẫn hiện sau lần tạo thật sự thành công nhưng mất response** (cả hai nền tảng): reload thấy hoá đơn của bản hiện hành ⇒ xoá banner fallback (lỗi server 400/409 vẫn giữ). Test mới hai nền tảng.
7. **[LOW nit] Fake lệch backend:** web fake bịa câu chặn không có ở backend (mobile trả null) ⇒ cả hai mặc định đúng message trạng thái của backend, và giữ `blockedReason` cạnh hoá đơn hiện có như backend; `createInvoice` khi `creatable:false` ⇒ 409 như backend; id hoá đơn tạo không trùng id đã seed.
8. **[LOW nit] Luật 8:** tên test mới trong `screens-render.test.tsx` đổi sang tiếng Anh.

**Đã kiểm, không phải lỗi:** footer `AppDialog` Row→Wrap an toàn cho cả 9 dialog mobile (mọi child là `AppButton`, không `Expanded`; căn trái như cũ; mỗi dialog đều có widget test mở nó và xanh). Seller đọc qua connection riêng trong tx — cùng khuôn `ContractsService.loadInputs`, settings không dùng khoá đơn nên không mất gì. `qty > 0` CHECK đúng với mọi đường ghi dòng (`@Min(1)`).

**5 lane sau fix (cùng working tree):** backend `npm test` 113 suites / 2329 ✅ · `npm run test:db` 306 ✅ · design-system 483 ✅ · web typecheck ✅ + vitest 175 ✅ + build ✅ · mobile analyze sạch ✅ + `flutter test` 431 ✅. ESLint/Prettier sạch trên file backend chạm; `web/src/test/screens-render.test.tsx` lệch prettier là nợ có sẵn ở HEAD.

### Change Log

- 2026-10-22 — Story 7.4 implemented: `Invoice`/`InvoiceLine` (BigInt money, CHECKs, seller snapshot), `invoices/` module with `GET/POST /orders/{id}/invoices` (idempotent per order version, under the order row lock, `InvoiceCreated` after commit), scope guard + wiring extended, OpenAPI regenerated; web + mobile "Hoá đơn bán hàng" screens and the "Hoá đơn" button on order detail; shared mobile confirm-dialog footer wraps at 320 px; parity guards. Status → review.
- 2026-10-22 — Code review: fixed quote→confirm race under the order lock (unit + DB interleaving test), tightened parity guard (button only opens the dialog; labels on comment-stripped code), cleared the fallback banner after a lost-but-successful create, aligned both fakes with backend refusals. Status → done.
