---
baseline_commit: f8b4a1e
---

# Story 6.7: Phiếu nhập trả khi huỷ đơn đã xuất kho

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người quản lý tồn kho (`inventory.manage`),
I want khi một Đơn bị huỷ thì phần giữ chỗ (`reserved`) của đơn tự được giải phóng, còn hàng ĐÃ xuất thì chỉ về kho khi có người đếm và xác nhận một **phiếu nhập trả** lập từ phiếu xuất gốc (cùng giá vốn lúc xuất),
so that `onHand`, `reserved` và giá vốn luôn khớp thực tế sau khi đơn bị huỷ, và báo cáo lợi nhuận không lệch.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-21, sau commit `f8b4a1e`)

- **Huỷ đơn** — `OrdersService.huyDon` (`backend/src/orders/orders.service.ts:1264-1390`): `findScopedOrThrow` → validate lý do → `evaluateTransition` → `$transaction` [`applyTransition` (khoá `orders` FOR UPDATE + cổng) → `order.update` `cancelReason`/`cancelledAt`] → publish SAU commit `StatusChanged` rồi `OrderCancelled(actorAccountId, orderId, lyDo, statusTruocHuy, orderVersionId = before.currentVersionId, occurredAt)` (`orders/domain/order-events.ts:337-366`). Cạnh `huy` CHỈ từ `baogia`, `dachot`, `dacoc` (`orders/domain/allowed-transition.ts:201-218`); `huy` là trạng thái cuối (không cạnh ra).
- **Source-guard `backend/test/no-stock-write-in-cancel.spec.ts`**: thân `huyDon()` (stripToCode) cấm `StockMovement|stockMovement|StockItem|stockItem|onHand|reserved`. **KHÔNG sửa, KHÔNG nới guard này** — seam duy nhất là subscribe `OrderCancelled`.
- **EventBus** (`backend/src/events/in-process-event-bus.ts`): `publish` await TUẦN TỰ từng subscriber, lỗi của một subscriber bị **cô lập + `Logger.error`**, `publish` không reject. Hệ quả: (a) handler chạy SAU commit huỷ, TRƯỚC khi `huyDon` trả HTTP response (test hermetic/DB thấy kết quả ngay sau `POST /huy`); (b) handler hỏng KHÔNG làm hỏng huỷ — chỉ để lại `reserved` treo (xem D6). Khuôn subscriber: `audit/audit.subscriber.ts`, `notifications/notification-dispatcher.ts` (`implements EventSubscriber, OnModuleInit`, `onModuleInit() { this.eventBus.subscribe(this); }`).
- **Ledger `StockMovement`** (6.6, `backend/prisma/schema.prisma:175-210`): append-only, `reserved = SUM(qty)` theo `stockItemId` (KHÔNG lọc `type`), type `reserve` (+) / `release` (−) / `xuat` (−), `@@unique([orderVersionId, stockItemId, type])`, CHECK `stock_movements_qty_sign`. "Every row of one order is written under that order's `orders` row lock, then `products` FOR UPDATE."
- **Ai đang giữ sau 6.6:** chốt ghi `reserve` cho version được chốt; re-chốt ghi `release` cho version cũ; xuất gắn đơn (`StockVouchersService.issueForOrderInTx`, `stock-vouchers.service.ts:378-500`) ghi `xuat = −max(SUM cấp ĐƠN, 0)` cho mỗi SP **tracked** ⇒ sau khi xuất, đơn net 0 (trừ lỗ R5 bên dưới). **Mở lại (`revise`) KHÔNG nhả** — phần giữ nằm ở version CŨ cho tới khi re-chốt.
- **Phiếu kho** (`StockVoucher`/`StockVoucherLine`, `schema.prisma:212-260`): hiệu lực ngay khi lưu, không sửa/xoá; `seq` SERIAL → mã `maPhieu()` (`inventory/domain/gia-von.ts:44-47`: `PK-N-0119`/`PK-X-0096`); phiếu gắn đơn có `orderId`+`orderVersionId` (unique cặp, CHECK `stock_vouchers_order_pair`, CHECK `stock_vouchers_order_only_xuat` = gắn đơn ⇒ `type='xuat'`). Docstring schema đã hứa: *"The link from a return voucher to its origin comes later."* — chính là story này. `StockVoucherLine.unitCost` của phiếu xuất gắn đơn = `Product.costPrice` lúc xuất = đúng giá trị đã đóng băng vào `OrderLineItem.costPriceSnapshot` (6.4).
- **Đường ghi phiếu tự do** `taoPhieu` (`stock-vouchers.service.ts:206-376`) — khuôn để chép cho phiếu nhập trả: `$transaction(async` → `SELECT id FROM products WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE` → đọc `products` + `stockItem` SAU khoá → nhập: `tinhGiaVonBinhQuan` → `stockItem.upsert` + `product.update costPrice` → `stockVoucher.create` + lines → commit → publish `StockVoucherCreated` (`domain/stock-voucher-events.ts`). Nhập tự do từ chối SP `!(tracksStock && isActive)` (`PRODUCT_NOT_STOCKABLE`).
- **Guard kho `backend/test/inventory-read-only.spec.ts`:** (a) không model nào có trường `*reserved*`; (b) trong `src/inventory/**` lệnh ghi Prisma/`$queryRaw`/`$transaction` CHỈ ở `FILE_DUOC_GHI = ['stock-vouchers.service.ts']`, file đó phải có `FOR UPDATE` + `$transaction(async`, không ghi qua `this.prisma.<model>.<ghi>(`; (c) `src/inventory/**` không ghi bảng đơn (`order|orderVersion|orderLineItem|…`.`create/update/…`) — ĐỌC (`tx.order.findUnique`) được phép.
- **Controller** `stock-vouchers.controller.ts`: `POST /stock-vouchers`, `GET /stock-vouchers?type=`, `GET /stock-vouchers/:id`, đều `@RequirePermissions(PERM.inventoryManage)`; che `unitCost` khi thiếu `costs.view` qua `anGiaVonDongPhieu`. ValidationPipe toàn cục `whitelist: true` (KHÔNG `forbidNonWhitelisted` ⇒ field lạ bị bỏ im lặng).
- **Client:** web `web/src/screens/inventory/StockVouchersScreen.tsx` (517 dòng; header ghi *"Deliberately absent (later stories): the 'Nhập trả' tab and chip"*), port `web/src/design-system/session/stock-vouchers-port.ts` + fake; mobile `mobile/lib/screens/inventory/stock_vouchers_screen.dart`, port `mobile/lib/design_system/session/stock_vouchers_port.dart` + fake; test `web/src/test/stock-vouchers-screen.test.tsx`, `mobile/test/screens/inventory/stock_vouchers_screen_test.dart`; parity guard `design-system/screens/stock-vouchers.test.mjs` — dòng 148 hiện **cấm** chữ "Nhập trả" (`'returns vouchers are a later story'`) ⇒ story này phải LẬT assert đó.
- **UX đã vẽ sẵn** (`_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html:4072-4190`, mục "Phiếu nhập trả", web + mobile): mã `PK-NT-004`; Seg danh sách `Tất cả · Nhập · Xuất · Nhập trả`; chip "Nhập trả" tông info; bảng `Sản phẩm · Đã xuất · Nhận lại`; banner *"Đơn DH-… đã huỷ sau khi xuất kho. Tồn kho không tự cộng lại — hàng chỉ về kho khi có người đếm và xác nhận phiếu này."*; ghi chú *"Nhận lại ít hơn đã xuất là chuyện bình thường (hàng đã cắt, đã lắp, hỏng). Nhập đúng số đếm được — không ép cho khớp."*; KV `Loại: Nhập trả · từ đơn huỷ`, `Gắn đơn`, `Phiếu xuất gốc`, `Người nhận`; nút **"Xác nhận nhập trả"**; footnote *"Xác nhận → cộng tồn thật đúng số đếm được, Audit ghi người nhận. Không sửa/xoá sau khi lưu."* ⇒ **nhập trả MỘT PHẦN là yêu cầu UX**, không phải tuỳ chọn.

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Hai việc tách bạch, hai cơ chế khác nhau.**
- **Giải phóng `reserved` khi huỷ = TỰ ĐỘNG**, qua subscriber `OrderCancelled` (AC epic 4 + 5). Đây là ledger "đã hứa", không phải hàng thật.
- **Hàng đã xuất về kho = THỦ CÔNG**, qua phiếu nhập trả người kho đếm và xác nhận (AC epic 1–3, UX). Handler huỷ **KHÔNG BAO GIỜ chạm `onHand`** ("KHÔNG tự cộng tồn").
- Handler KHÔNG rẽ nhánh theo `statusTruocHuy`: sau khi xuất, ledger của đơn đã net 0 nên "giải phóng phần đang giữ" tự là no-op. Quyết theo SỰ THẬT của ledger, không theo một suy đoán từ status.

**D2 — Primitive giải phóng `StockVouchersService.releaseForCancelledOrder(orderId)` (tự mở tx).**
Đặt trong `stock-vouchers.service.ts` (file DUY NHẤT được ghi theo guard (b); file mới sẽ phải nới guard). Tự mở `this.prisma.$transaction(async (tx) => …)` vì chạy SAU commit huỷ, không có tx của caller. Thứ tự BẮT BUỘC:
1. `SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE` — giữ hợp đồng "mọi dòng ledger của một đơn ghi dưới khoá dòng `orders`" và thứ tự toàn hệ thống `orders → products`. Không có dòng ⇒ return.
2. Đọc `tx.order.findUnique({ select: { status } })`; `status !== TRANG_THAI_HUY` ⇒ return (không ném). Lưới phòng event bị phát lại/nhầm cho đơn còn sống — giải phóng phần giữ của đơn sống là sai `reserved` không tự lành. Import hằng thuần `TRANG_THAI_HUY` từ `../orders/domain/order-status` (file domain thuần, không DI) — `inventory/` vẫn KHÔNG import `OrdersModule`.
3. `tx.stockMovement.groupBy({ by: ['orderVersionId','stockItemId'], where: { orderId }, _sum: { qty: true }, orderBy: […] })` → lọc `_sum.qty > 0`. **CẤP ĐƠN, MỌI version** — KHÔNG lọc theo `event.orderVersionId` (6.6 review R6: đơn mở lại rồi huỷ đang giữ ở version CŨ, event mang version MỚI). Rỗng ⇒ return (không khoá products).
4. `stockItem.findMany({ id in … })` lấy `productId` → `SELECT id FROM products WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE` — CÙNG câu SQL với mọi đường ghi tồn.
5. Với mỗi nhóm: `tx.stockMovement.create({ type: STOCK_MOVEMENT_TYPE.release, qty: −held, orderId, orderVersionId: g.orderVersionId, stockItemId })`. Giải phóng THEO LEDGER, KHÔNG theo qty dòng đơn, KHÔNG lọc `tracksStock` hiện tại (SP bị tắt theo dõi sau chốt vẫn phải trả phần đã hứa — đóng lỗ R5 của 6.6 cho đường huỷ).
6. Không đổi `onHand`, không ghi phiếu, không publish event (khuôn 6.6 D5: ledger tự là vết truy; Audit huỷ đã có qua `StatusChanged` + `OrderCancelled`).
- **Unique `(orderVersionId, stockItemId, 'release')` không va:** một version chỉ nhận `release` khi đang giữ dương; re-chốt và huỷ đều nhả HẾT ⇒ version đó net 0 và không bao giờ được giữ lại (version đã chốt không đổi; version mới là id mới). Retry handler ⇒ bước 3 rỗng ⇒ no-op (idempotent). Đụng unique = lỗi lập trình.

**D3 — Subscriber `OrderCancelledStockSubscriber`** — file mới `backend/src/inventory/order-cancelled-stock.subscriber.ts`, provider của `InventoryModule`.
- `implements EventSubscriber, OnModuleInit`; `onModuleInit() { this.eventBus.subscribe(this); }`; `handle(event)`: `if (event.type !== 'OrderCancelled') return;` rồi `await this.stockVouchers.releaseForCancelledOrder(event.target.id)`.
- Phân biệt bằng `event.type` + `event.target.id` (hợp đồng `DomainEvent`) — KHÔNG import class `OrderCancelled` từ `orders/` (giữ hướng phụ thuộc một chiều; `target = { type: 'Order', id: orderId }` đã có trong event). Có thể assert thêm `event.target.type === 'Order'`.
- File này KHÔNG chứa lệnh ghi Prisma ⇒ guard (b) giữ nguyên `FILE_DUOC_GHI`, KHÔNG nới.
- KHÔNG đụng `huyDon()` — một dòng cũng không (guard `no-stock-write-in-cancel` + AC epic 4).

**D4 — Phiếu nhập trả: `POST /stock-vouchers/:id/return`** (`:id` = phiếu XUẤT GỐC; route/DTO tiếng Anh theo luật 8).
- Body `CreateReturnVoucherRequestDto { note?: string (≤500, như phiếu thường); lines: { productId: UUID; qty: Int 1..1_000_000 }[] (ArrayMinSize 1, ArrayMaxSize như DTO hiện có) }`. **KHÔNG có `unitCost`** — server đặt = `unitCost` của dòng phiếu xuất gốc (= `costPriceSnapshot` lúc xuất). Client gửi `unitCost` ⇒ bị `whitelist` bỏ, không có tác dụng (test khẳng định). SP không có trong `lines` = nhận lại 0 (UX: "nhận lại ít hơn là bình thường").
- **Một phiếu xuất ⇒ tối đa MỘT phiếu nhập trả** (unique DB). Hàng tìm thấy sau đó ⇒ phiếu nhập tự do. Lý do: UX vẽ một lần đếm + xác nhận; nhiều lần trả một phần cần cộng dồn "đã trả" — YAGNI (ghi Câu hỏi mở 2).
- Validate & lỗi (envelope AD-5, tiếng Việt cho người dùng, `fieldErrors[].code` tiếng Anh, hằng đặt cạnh `INSUFFICIENT_STOCK` trong `domain/gia-von.ts` hoặc file domain mới):
  - phiếu gốc không tồn tại ⇒ 404 `Không tìm thấy phiếu kho: {id}` (cùng thông điệp `chiTietPhieu`);
  - phiếu gốc không phải xuất gắn đơn (`type !== 'xuat'` hoặc `orderId == null`, hoặc chính nó là phiếu nhập trả) ⇒ 409 `Chỉ phiếu xuất gắn đơn mới lập được phiếu nhập trả.`;
  - đơn của phiếu gốc chưa `huy` ⇒ 409 `Đơn chưa huỷ — không lập phiếu nhập trả.`;
  - đã có phiếu nhập trả ⇒ 409 `Phiếu xuất này đã có phiếu nhập trả {PK-NT-xxxx}.`;
  - lặp `productId` trong body ⇒ 400 `DUPLICATE_PRODUCT` (`lines.{i}.productId`, tái dùng hằng sẵn có);
  - SP không có trên phiếu gốc ⇒ 400 code `NOT_ON_ORIGIN_VOUCHER` (`lines.{i}.productId`);
  - `qty` > số đã xuất của SP đó ⇒ 400 code `RETURN_EXCEEDS_ISSUED` (`lines.{i}.qty`, message `Đã xuất {n} {đv}, không nhận lại được {qty}.`).
  - Thứ tự: 404/409 trạng thái TRƯỚC 400 từng dòng; tất cả kiểm TRONG tx SAU khoá (xem dưới) — ném ⇒ rollback toàn phiếu.
- **Thuật toán `createReturnVoucher(originId, input, actorAccountId)`** trong `stock-vouchers.service.ts`, `$transaction(async`:
  1. Đọc phiếu gốc (`tx.stockVoucher.findUnique` + `lines` + `order: { select: { status } }`) — 404/409 loại phiếu ngay (dữ liệu bất biến, an toàn đọc trước khoá).
  2. Khoá `SELECT id FROM products WHERE id = ANY(${productIds của phiếu GỐC}) ORDER BY id FOR UPDATE` — lệnh khoá ĐẦU TIÊN trên bảng tồn. Khoá theo tập SP của phiếu gốc (cố định) ⇒ hai request trả cùng phiếu xếp hàng trên cùng khoá.
  3. SAU khoá: kiểm đã có phiếu trả (`findUnique({ where: { returnOfVoucherId } })`) ⇒ 409; kiểm `order.status === TRANG_THAI_HUY` (huy là trạng thái cuối ⇒ không cần khoá `orders`; KHÔNG khoá `orders` ở đây — đường này không ghi ledger) ⇒ 409; validate dòng ⇒ 400.
  4. Đọc `products` + `stockItem` SAU khoá. Mỗi dòng: `unitCost = dòng gốc.unitCost`; `onHandAfter = onHandBefore + qty`; `costAfter = tinhGiaVonBinhQuan({ onHandTruoc, giaVonTruoc, qtyNhap: qty, donGiaNhap: unitCost })` — hàng về kho với đúng giá vốn lúc ra kho, bình quân như mọi lô nhập (giữ định giá tồn đúng). `stockItem.upsert` + `product.update({ costPrice })`. **KHÔNG từ chối SP đã tắt `tracksStock`/`isActive=false`** (khác nhập tự do): đây là hoàn lại một lần trừ đã xảy ra khi SP còn được theo dõi; từ chối sẽ làm hàng thật biến mất khỏi sổ.
  5. `stockVoucher.create({ type: 'nhap', note, returnOfVoucherId: originId, createdByAccountId: actor, orderId: null, orderVersionId: null, lines })`.
  6. **KHÔNG ghi `StockMovement`** — `reserved` đã được nhả lúc xuất (dòng `xuat`) và/hoặc lúc huỷ (D2).
  7. Commit → publish `StockVoucherCreated` với snapshot dòng (như `taoPhieu`) + hai field mới trong `after`: `returnOfVoucherId` và `orderId` (của phiếu gốc) ⇒ Audit "gắn link Đơn huỷ" (AC epic 3). Không event mới.
- **Phạm vi người gọi (luật 1):** đường này KHÔNG ghi bảng đơn nào ⇒ không phải "đường ghi đơn"; `inventory.manage` là quyền toàn kho (đọc/ghi mọi phiếu, kể cả phiếu xuất gắn đơn ở `GET /stock-vouchers/:id` hiện có). Giữ nhất quán với 6.3/6.4. Guard `no-unscoped-order-write` xanh không đổi. Ghi vào Completion Notes.

**D5 — Schema + migration.**
- `StockVoucher`: thêm `returnOfVoucherId String? @unique @map("return_of_voucher_id")`, quan hệ tự tham chiếu `returnOf StockVoucher? @relation("StockVoucherReturn", fields: [returnOfVoucherId], references: [id], onDelete: Restrict)` + `returnVoucher StockVoucher? @relation("StockVoucherReturn")`.
- Migration `backend/prisma/migrations/20261021120000_add_stock_voucher_return_link/migration.sql`: sinh offline `npx prisma migrate diff --from-schema <schema cũ> --to-schema prisma/schema.prisma --script` (Prisma 7 — memory `prisma7-migrate-diff-flag-rename`), THÊM TAY:
  `ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_return_is_stock_in" CHECK ("return_of_voucher_id" IS NULL OR ("type" = 'nhap' AND "order_id" IS NULL AND "order_version_id" IS NULL));`
  (lưới cuối: phiếu trả là phiếu nhập, không mang cặp gắn đơn — không đụng unique `(orderId, orderVersionId)` và CHECK `stock_vouchers_order_only_xuat`). Ràng "gốc phải là xuất gắn đơn" là liên-dòng ⇒ service enforce.
- Docstring `StockVoucher`: thay câu "The link from a return voucher to its origin comes later." bằng mô tả thật (cột, unique, CHECK, giá vốn = dòng gốc, không ghi ledger). Docstring `StockMovement`: thêm `release` cũng được ghi khi đơn bị huỷ (mọi version còn giữ, dưới khoá `orders`). Chỉ sửa tay hunk của mình (`prisma format` reflow cả file).

**D6 — Handler hỏng ⇒ `reserved` treo: chấp nhận + làm lộ ra, không giấu.**
Huỷ đã commit trước khi handler chạy; bus cô lập lỗi. Không đổi kiến trúc bus (ngoài phạm vi). Bù đắp: (a) primitive idempotent — chạy lại an toàn; (b) bus đã `Logger.error` kèm stack; (c) test lane DB khẳng định đường thật (huỷ qua `OrdersService` + bus thật + subscriber thật) nhả đúng. Ghi Câu hỏi mở 1 (công cụ chạy lại cho đơn huỷ còn giữ).

**D7 — Contract đọc (thêm, không phá).**
- `StockVoucherSummaryDto`: `returnOfVoucherId?: string` — chỉ có mặt ở phiếu nhập trả (vắng key, không `null`, khuôn `orderId`).
- `StockVoucherDetailDto`: 
  - `returnOf?: { id: string; ma: string; orderId: string }` — chỉ ở phiếu nhập trả (Gắn đơn + Phiếu xuất gốc trên UI).
  - `returnVoucher?: { id: string; ma: string }` — chỉ ở phiếu xuất gắn đơn ĐÃ có phiếu trả.
  - `canReturn: boolean` — LUÔN có; `true` ⇔ phiếu xuất gắn đơn ∧ đơn `huy` ∧ chưa có phiếu trả. Backend tính (AD-2) — client KHÔNG tự suy từ status.
- **Top-level `orderId` GIỮ NGUYÊN nghĩa** "phiếu xuất gắn đơn" — phiếu nhập trả KHÔNG đặt `orderId` top-level (web/mobile hiện dùng `orderId !== undefined` để hiện "Người xác nhận"/banner một-đơn-một-phiếu; đặt vào sẽ gắn nhãn sai). Đơn của phiếu trả nằm ở `returnOf.orderId`.
- `maPhieu`: phiếu trả ⇒ `PK-NT-0004` (UX). Đổi chữ ký có kiểm soát, ví dụ `maPhieu(type, seq, isReturn = false)`; mọi chỗ gọi (`tomTat`) truyền `returnOfVoucherId != null`. Test domain cho cả ba tiền tố.
- `GET /stock-vouchers`: thêm query `isReturn?: boolean` (Transform `'true'|'false'` → boolean, khuôn query bool sẵn có nếu có; không thì `@Transform`). `type=nhap&isReturn=false` = tab "Nhập", `isReturn=true` = tab "Nhập trả", không tham số = "Tất cả". `chiTietPhieu` include thêm `returnOf`, `returnVoucher`, `order: { select: { status } }`.
- `openapi.json` regen (`cd backend && npm run openapi:gen`), drift-guard xanh. Permission: KHÔNG key mới (`inventory.manage` sẵn có) ⇒ `permissions.json` không đổi byte.

**D8 — UI web + mobile (parity, UX mục "Phiếu nhập trả").**
- Danh sách: Seg thêm `Nhập trả` (4 tab: `Tất cả · Nhập · Xuất · Nhập trả`) gọi `listVouchers({ isReturn: true })`; tab "Nhập" gọi `{ type: 'nhap', isReturn: false }`. Chip "Nhập trả" (tông info, component chip sẵn có — không style ad-hoc) cho dòng có `returnOfVoucherId`.
- Chi tiết phiếu xuất gắn đơn: `canReturn` ⇒ nút **"Tạo phiếu nhập trả"** mở Sheet (web `Sheet`, mobile `AppSheet`); `returnVoucher` có ⇒ KV `Phiếu nhập trả: PK-NT-…` (bấm mở chi tiết phiếu đó).
- Sheet nhập trả: banner info *"Đơn đã huỷ sau khi xuất kho. Tồn kho không tự cộng lại — hàng chỉ về kho khi có người đếm và xác nhận phiếu này."*; bảng `Sản phẩm · Đã xuất · Nhận lại` (Nhận lại = ô số, KHỞI TẠO = số đã xuất như mockup, người dùng sửa); ghi chú *"Nhận lại ít hơn đã xuất là chuyện bình thường (hàng đã cắt, đã lắp, hỏng). Nhập đúng số đếm được — không ép cho khớp."*; ô `Ghi chú` (≤500); nút **"Xác nhận nhập trả"**; footnote *"Xác nhận → cộng tồn thật đúng số đếm được, Audit ghi người nhận. Không sửa/xoá sau khi lưu."* Ô trống ⇒ lỗi tại ô `Nhập số nhận lại (0 nếu không nhận lại).` — KHÔNG ép trống thành 0 (memory `blank-required-number-coerced-to-zero`); `0` ⇒ dòng KHÔNG gửi; mọi dòng 0 ⇒ nút disable. Client KHÔNG so `qty` với "đã xuất" — backend trả `RETURN_EXCEEDS_ISSUED`, hiển thị `fieldErrors` dưới đúng dòng (khuôn form phiếu hiện có `lines.{i}.…` — LƯU Ý: chỉ số `i` là chỉ số trong MẢNG GỬI LÊN, đã bỏ dòng 0 ⇒ map lại về dòng hiển thị).
- Chi tiết phiếu nhập trả: KV `Loại: Nhập trả · từ đơn huỷ`, `Gắn đơn: {returnOf.orderId}`, `Phiếu xuất gốc: {returnOf.ma}`, `Người nhận: {nguoiTao.displayName}`, `Ngày`, `Ghi chú`; bảng dòng + giá vốn (chỉ khi có `unitCost`, qua `<Money>`/`MoneyText` — guard tiền).
- Port: web `createReturnVoucher(originVoucherId: string, input: { note?: string; lines: { productId: string; qty: number }[] }): Promise<StockVoucherDetail>`; types thêm `returnOfVoucherId?`, `returnOf?`, `returnVoucher?`, `canReturn`, query `isReturn?`. Mobile mirror (`createReturnVoucher`, field nullable). Fake ports cập nhật (fake KHÔNG tự tính tồn/giá — chỉ trả fixture).
- Đổi comment header màn web ("Deliberately absent … 'Nhập trả'") cho đúng sự thật.
- **Ngoài phạm vi UI:** màn chi tiết Đơn / Dialog huỷ đơn KHÔNG đổi (lối vào là Phiếu kho, đúng mockup nằm dưới mục Kho). Ghi Câu hỏi mở 3.

### 3. Phạm vi

**Trong:** subscriber + primitive giải phóng khi huỷ; nhả mọi phần giữ còn lại khi đơn vào `hoanthanh` (T3b — vá lỗ R5 của 6.6, cùng tx chuyển trạng thái, sau khoá `orders` rồi `products`); schema/migration link phiếu trả; route + DTO + service phiếu nhập trả; mở rộng DTO đọc/list query; `maPhieu` PK-NT; event payload; openapi regen; web + mobile (port, fake, màn, test); lật assert design-system; test unit/e2e/DB lane + đột biến.
**Ngoài:** sửa `huyDon()`; nhiều phiếu trả cho một phiếu xuất; tình trạng từng dòng (UX "Tình trạng" — gộp vào ghi chú phiếu, xem Câu hỏi mở 2); màn chi tiết Đơn; event mới; permission mới; backfill.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:600-607`)

- **Given** Đơn huỷ **SAU khi xuất kho** (đã giảm `onHand`), **When** xác nhận huỷ, **Then** KHÔNG tự cộng tồn; phải tạo **phiếu nhập trả** từ phiếu xuất lúc đó để lên tồn lại (§2).
- **Given** phiếu nhập trả, **When** tạo, **Then** entity `StockVoucher` loại "nhập", gắn phiếu xuất gốc, cùng giá vốn (`unitCost` = `costPriceSnapshot` lúc xuất) để báo cáo lợi nhuận không lệch (§2, §4).
- **Given** tạo phiếu trả, **When** lưu, **Then** tăng lại `onHand`, ghi Audit, gắn link Đơn huỷ (FR-24, AD-18).
- **Given** đường huỷ đơn đã ship ở Story 5.7 KHÔNG chạm tồn kho (khoá bằng source-guard), **When** nối tồn kho vào, **Then** story này **subscribe event `OrderCancelled`** — đây là seam duy nhất; **không** thêm lệnh ghi tồn vào `huyDon()` (AD-11, AD-18).
- **Given** Đơn huỷ **TRƯỚC khi xuất kho**, **When** xử lý `OrderCancelled`, **Then** huỷ `StockMovement` của version đó → **giải phóng `reserved`** ngay (AD-19).

### AC dẫn xuất (đo được)

1. **Huỷ trước xuất ⇒ nhả ngay.** Đơn chốt (SP-A tracked 5, SP-B tracked 4, SP-C untracked 1, một dòng tự do) ⇒ ledger `reserve` +5/+4 ⇒ `POST /orders/:id/huy` 200 ⇒ ngay sau response: ledger thêm ĐÚNG 2 dòng `(v1, SP-A, release, −5)`, `(v1, SP-B, release, −4)`; dòng cũ KHÔNG bị UPDATE/DELETE; `reserved` SP-A = SP-B = 0; `onHand` KHÔNG đổi; không phiếu kho nào được tạo. Huỷ từ `dachot` và từ `dacoc` đều vậy. (Lane DB, huỷ qua `OrdersService.huyDon` thật + `InProcessEventBus` thật + subscriber thật.)
2. **Huỷ sau xuất ⇒ KHÔNG tự cộng tồn.** Chốt (SP-A 5) → nhập đủ → xuất gắn đơn (`onHand` −5, ledger net 0) → huỷ ⇒ `onHand` KHÔNG đổi, `reserved` = 0, ledger KHÔNG thêm dòng, không phiếu nào mới; `GET /stock-vouchers/:originId` trả `canReturn: true`. (Lane DB.)
3. **Mở lại rồi huỷ ⇒ nhả ở version CŨ** (6.6 R6): chốt v1 (SP-A 5) → mở lại (v2 `baogia`, chưa re-chốt) → huỷ ⇒ dòng `(v1, SP-A, release, −5)`; `reserved` = 0. Event mang `orderVersionId = v2` nhưng handler nhả theo cấp đơn. (Lane DB + unit.)
4. **Re-chốt rồi huỷ:** v1 (A 5, B 4) → mở lại → v2 (A 2) → chốt (v1 net 0, v2 +2) → huỷ ⇒ chỉ thêm `(v2, A, release, −2)`; không đụng v1; không vi phạm unique. (Lane DB.)
5. **SP tắt theo dõi sau chốt vẫn được nhả khi huỷ:** chốt (A 5) → `tracksStock=false` → huỷ ⇒ `(v1, A, release, −5)`. (Lane DB + unit — đột biến lọc `tracksStock` phải ĐỎ.)
6. **Idempotent + vô hại:** gọi `releaseForCancelledOrder` lần 2 ⇒ không dòng mới; đơn không có ledger (huỷ từ `baogia` chưa từng chốt, hoặc đơn chốt trước 6.6) ⇒ không khoá `products`, không ghi; đơn KHÔNG ở `huy` (gọi thẳng primitive) ⇒ không ghi gì. (Unit + DB.)
7. **Khoá — xen kẽ ÉP BUỘC (luật 2):** (a) tx khác giữ `SELECT … FROM products WHERE id = SP-A FOR UPDATE` ⇒ `releaseForCancelledOrder` CHỜ (chưa xong sau ~150 ms) ⇒ nhả khoá ⇒ xong, ledger đúng; (b) tx khác giữ `SELECT … FROM orders WHERE id = X FOR UPDATE` ⇒ primitive CHỜ. Đột biến bỏ `FOR UPDATE` (từng câu một) ⇒ ca tương ứng ĐỎ. (c) tx khác giữ khoá SP-A ⇒ `POST /stock-vouchers/:id/return` CHỜ ⇒ nhả ⇒ xong. (d) hai `return` song song cùng phiếu gốc ⇒ đúng MỘT 201, một 409, `onHand` cộng đúng một lần. (Lane DB, request thật song song; khuôn `order-stock-issue.db.integration.spec.ts` helper `wait`.)
8. **Phiếu nhập trả đầy đủ:** đơn huỷ sau xuất, phiếu gốc SP-A 12 @ `unitCost` 1.000.000, SP-B 2 @ 300.000 ⇒ `POST /stock-vouchers/:originId/return` `{ lines: [{A,12},{B,2}], note }` ⇒ 201; phiếu `type: 'nhap'`, `ma` = `PK-NT-####`, `returnOfVoucherId = originId`, `returnOf = { id, ma: PK-X-…, orderId }`, `orderId` top-level VẮNG; dòng `unitCost` = dòng gốc (khẳng định = `OrderLineItem.costPriceSnapshot` của đơn); `onHand` A +12, B +2; `Product.costPrice` = `tinhGiaVonBinhQuan(onHandTrước, costTrước, qty, unitCost gốc)` (fixture chọn số để giá TRƯỚC ≠ giá gốc — tránh mutant tương đương, memory `mutation-semantically-equivalent-false-survivor`); ledger KHÔNG đổi; `GET` phiếu gốc ⇒ `canReturn: false`, `returnVoucher = { id, ma }`. (Lane DB + e2e.)
9. **Trả một phần:** cùng phiếu gốc, body chỉ `{A, 10}` ⇒ 201, `onHand` A +10, B không đổi; phiếu có đúng 1 dòng. (Lane DB.)
10. **Client gửi `unitCost`** (vd 1) ⇒ bị bỏ; dòng vẫn lấy giá gốc. (e2e qua `ValidationPipe` thật.)
11. **Lỗi đúng mã + envelope + KHÔNG ghi gì** (mỗi ca: `onHand`, `costPrice`, số phiếu không đổi): phiếu gốc không có ⇒ 404; phiếu nhập tự do / phiếu xuất tự do / chính phiếu nhập trả làm gốc ⇒ 409; đơn chưa huỷ (`dachot`/`dacoc` đã xuất) ⇒ 409; đã có phiếu trả ⇒ 409 (thông điệp chứa mã PK-NT); lặp SP ⇒ 400 `DUPLICATE_PRODUCT` `lines.1.productId`; SP không trên phiếu gốc ⇒ 400 `NOT_ON_ORIGIN_VOUCHER`; `qty` > đã xuất ⇒ 400 `RETURN_EXCEEDS_ISSUED` `lines.{i}.qty`; `lines: []` / `qty: 0` / `qty` không nguyên ⇒ 400 `VALIDATION_ERROR` (DTO); thiếu `inventory.manage` ⇒ 403. Mã HTTP đo ở lane e2e qua `ValidationPipe` (memory `dev-pins-ac-deviation-as-green-test` — KHÔNG ghim độ lệch thành test xanh).
12. **SP đã tắt theo dõi / ngừng bán vẫn nhập trả được** (khác nhập tự do 409 `PRODUCT_NOT_STOCKABLE`). (Lane DB hoặc unit.)
13. **Audit:** sau 201, publish ĐÚNG MỘT `StockVoucherCreated` (`toHaveBeenCalledTimes(1)` — memory `publish-count-unasserted-duplicate-survives`), SAU commit, `after.returnOfVoucherId = originId`, `after.orderId = orderId`, `after.lines[*]` có `unitCost` gốc + `onHandTruoc/Sau` + `giaVonTruoc/Sau`; lỗi ⇒ 0 publish. Unit dùng mock tx CHẠY thân callback rồi mới ném (memory `mock-rejected-transaction-false-green`). Lane DB: có đúng 1 dòng `AuditLog` `eventType = 'StockVoucherCreated'` target phiếu trả.
14. **Ràng buộc DB đứng một mình** (SQL thô, assert theo TÊN — Prisma 7 có thể ném `DriverAdapterError` không code, memory `prisma7-p2003-only-on-insert`): (a) phiếu thứ hai cùng `return_of_voucher_id` ⇒ lỗi unique `stock_vouchers_return_of_voucher_id_key`; (b) `type='xuat'` + `return_of_voucher_id` ⇒ `stock_vouchers_return_is_stock_in`; (c) phiếu trả có `order_id`/`order_version_id` ⇒ `stock_vouchers_return_is_stock_in`; (d) FK RESTRICT: xoá phiếu gốc còn phiếu trả ⇒ lỗi. (Lane DB.)
15. **Đọc & lọc:** `GET /stock-vouchers?isReturn=true` chỉ phiếu trả; `?type=nhap&isReturn=false` không có phiếu trả; không tham số ⇒ có cả hai; summary phiếu trả có `returnOfVoucherId`, phiếu khác vắng key; thiếu `costs.view` ⇒ dòng phiếu trả vắng `unitCost` (cả response của lệnh tạo). (e2e/DB.)
16. **UI web** (`web/src/test/stock-vouchers-screen.test.tsx`, fake port): tab "Nhập trả" gọi port với `{ isReturn: true }`; chip "Nhập trả"; chi tiết phiếu xuất `canReturn` ⇒ nút "Tạo phiếu nhập trả"; Sheet khởi tạo Nhận lại = Đã xuất; sửa một dòng về 0 ⇒ dòng đó KHÔNG có trong `createReturnVoucher` input; ô trống ⇒ lỗi tại ô, KHÔNG gọi port; lỗi `RETURN_EXCEEDS_ISSUED` hiện dưới ĐÚNG dòng hiển thị khi có dòng 0 đứng trước (đột biến map chỉ số ⇒ ĐỎ); chi tiết phiếu trả hiện `Phiếu xuất gốc` + `Gắn đơn`; `canReturn=false` ⇒ không nút. `screens-render.test.tsx` vẫn xanh (không màn mới). `cd web && npm run typecheck && npm test && npm run build` xanh.
17. **UI mobile** (`mobile/test/screens/inventory/stock_vouchers_screen_test.dart`, luật 4): cùng các ca của AC-16 (tab, chip, nút, Sheet, dòng 0 bỏ, trống ⇒ lỗi, lỗi đúng dòng, chi tiết phiếu trả) ở 320/360 px không tràn; `flutter analyze` + `flutter test` xanh; `dart format -o none --set-exit-if-changed` cho file đụng (memory `dart-format-writes-files-cascade`).
18. **Design-system parity:** `design-system/screens/stock-vouchers.test.mjs` LẬT assert dòng 148: nay BẮT BUỘC web + mobile cùng chứa các chuỗi UX: `Nhập trả`, `Tạo phiếu nhập trả`, `Xác nhận nhập trả`, `Phiếu xuất gốc`, `Đã xuất`, `Nhận lại`, câu banner + câu "Nhận lại ít hơn…" + footnote. Guard tiền + css-class-coverage xanh. `cd design-system && npm test` xanh.
19. **Không hồi quy:** `huyDon()` không đổi một byte (guard `no-stock-write-in-cancel` xanh, KHÔNG sửa guard); guard `inventory-read-only` (a)(b)(c) xanh KHÔNG nới `FILE_DUOC_GHI`; `no-unscoped-order-write`, `no-direct-side-effect-outside-eventbus`, `naming-convention` xanh; `permissions.json` không đổi byte; `openapi.json` chỉ đổi theo D4/D7; toàn bộ test 6.1–6.6 xanh (gồm `stock-reservation.db.integration.spec.ts`).

## Tasks / Subtasks

- [x] **T1 — Schema + migration** (AC: 14, 19)
  - [x] `schema.prisma` theo D5 (cột + quan hệ tự tham chiếu + docstring `StockVoucher`/`StockMovement`). Chỉ sửa tay hunk của mình.
  - [x] Migration `20261021120000_add_stock_voucher_return_link/migration.sql`: `migrate diff --from-schema/--to-schema --script` + CHECK `stock_vouchers_return_is_stock_in` thêm tay. Kiểm tên index unique Prisma sinh ra (dự kiến `stock_vouchers_return_of_voucher_id_key`) và dùng ĐÚNG tên đó trong test.
  - [x] `npx prisma validate && npx prisma generate`; `npx prisma migrate deploy` lên `pns-postgres` cổng 5433 (tắt ⇒ `docker start pns-postgres`; daemon không lên ⇒ ghi "lane DB chưa chạy", KHÔNG đánh `[x]` — memory `db-lane-needs-docker-desktop-gui`). KHÔNG ghi lên DB nào khác.
- [x] **T2 — Domain** (AC: 8, 11, 15)
  - [x] `maPhieu(type, seq, isReturn)` → `PK-NT-`; test domain ba tiền tố.
  - [x] Hằng `NOT_ON_ORIGIN_VOUCHER`, `RETURN_EXCEEDS_ISSUED` (cạnh hằng field-error sẵn có).
  - [x] `StockVoucherSnapshot` thêm `returnOfVoucherId?`, `orderId?` (optional — phiếu thường không đổi payload).
- [x] **T3 — Primitive giải phóng + subscriber** (AC: 1–7)
  - [x] `StockVouchersService.releaseForCancelledOrder(orderId)` theo D2 (thứ tự 1→6), docstring tiếng Anh (chạy sau commit huỷ, tự mở tx, khoá `orders → products`, theo ledger cấp đơn, không lọc `tracksStock`, không chạm `onHand`, idempotent).
  - [x] `backend/src/inventory/order-cancelled-stock.subscriber.ts` theo D3; thêm vào `providers` của `InventoryModule`; cập nhật docstring `InventoryModule` (subscriber + vì sao không import `orders/` module).
- [x] **T3b — Nhả giữ chỗ khi đơn vào `hoanthanh`** (Dev Notes "Mặc định Trợ Lý tuyên bố")
  - [x] `StockVouchersService.releaseHeldForOrderInTx(tx, orderId)` (dùng chung với đường huỷ); `applyTransition` gọi nó khi `to === hoanthanh`, cùng tx, sau khoá `orders` và sau cổng `updateMany`.
  - [x] Unit (thứ tự trong tx, cổng từ chối ⇒ không nhả, cạnh khác không nhả) + lane DB (SP tắt theo dõi sau chốt rồi đóng ⇒ `reserved` 0; đã xuất rồi đóng ⇒ không ghi) + đột biến bỏ bước nhả ⇒ ĐỎ.
- [x] **T4 — Phiếu nhập trả backend** (AC: 8–15)
  - [x] `dto/create-return-voucher-request.dto.ts` (kebab-case, tên tiếng Anh) — khuôn validator của `create-stock-voucher-request.dto.ts`.
  - [x] `createReturnVoucher` trong `stock-vouchers.service.ts` theo D4 (đọc gốc → khoá products → kiểm sau khoá → ghi → publish sau commit). Không dùng `this.prisma.<model>.<ghi>(` (guard b).
  - [x] `chiTiet`/`tomTat`/`CHI_TIET_INCLUDE` + `lietKePhieu` theo D7 (`canReturn`, `returnOf`, `returnVoucher`, `returnOfVoucherId`, filter `isReturn`). Chú ý `findOrderIssueVoucher` dùng chung `CHI_TIET_INCLUDE` — `canReturn` phải đúng ở mọi đường trả `StockVoucherDetail` (kể cả response của `POST /orders/:id/stock-issue`).
  - [x] Controller: `@Post(':id/return')` `@RequirePermissions(PERM.inventoryManage)`, `ParseUUIDPipe`, `@ApiCreatedResponse/@ApiBadRequestResponse/@ApiForbiddenResponse/@ApiNotFoundResponse/@ApiConflictResponse` mô tả đủ mã; che `unitCost` bằng `anGiaVonDongPhieu`. DTO response + list query cập nhật Swagger decorator.
  - [x] `npm run openapi:gen`; commit `backend/openapi/openapi.json` cùng story.
- [x] **T5 — Test backend hermetic** (AC: 3, 5, 6, 8, 10, 11, 13, 15, 19)
  - [x] Unit primitive (`backend/test/stock-cancel-release.spec.ts` hoặc mở rộng `stock-reservation.spec.ts`): khoá `orders` là op ĐẦU TIÊN, `products … ORDER BY id FOR UPDATE` trước mọi `create`; tập khoá = product của phần đang giữ; nhả theo held cấp đơn mọi version; bỏ held ≤ 0; không lọc `tracksStock`; status ≠ `huy` ⇒ 0 ghi; không ledger ⇒ không khoá products; không chạm `stockItem.update/upsert`, không `stockVoucher.create`.
  - [x] Unit subscriber: `onModuleInit` gọi `subscribe(this)` đúng 1 lần; event khác `OrderCancelled` ⇒ không gọi primitive; `OrderCancelled` ⇒ gọi với `target.id` (`toHaveBeenCalledTimes(1)`).
  - [x] Unit `createReturnVoucher`: thứ tự khoá; mọi nhánh lỗi ⇒ 0 ghi, 0 publish; publish đúng 1 lần sau commit với payload D4.7; `unitCost` = dòng gốc; giá vốn bình quân.
  - [x] e2e (`initAppOnLoopback` — luật 6; mở rộng `backend/test/stock-vouchers.e2e.spec.ts` sẵn có): mã HTTP + envelope AC-11, `unitCost` bị bỏ (AC-10), che giá vốn (AC-15), 403. Unit service mở rộng `backend/test/stock-vouchers.service.spec.ts`.
  - [x] **Rà mọi spec hermetic có `POST /orders/:id/huy` hoặc gọi `huyDon` với app/bus thật** (`orders.e2e.spec.ts`, `order-cancel.spec.ts`…; lane DB `order-cancel.db.integration.spec.ts` dựng tay thì kiểm có cần dọn ledger mới không): giờ subscriber chạy và gọi `$transaction` trên mock Prisma — bổ sung mock cho đủ (`$queryRaw`, `order.findUnique`, `stockMovement.groupBy`) để đường thật chạy KHÔNG lỗi, hoặc khẳng định no-op; KHÔNG để test xanh nhờ bus nuốt lỗi (spy `Logger.error` không được gọi trong các ca huỷ).
- [x] **T6 — Lane DB** (AC: 1–9, 11–14) — file mới `backend/test/stock-cancel-return.db.integration.spec.ts` (khuôn `stock-reservation.db.integration.spec.ts`: dựng `OrdersService` + `StockVouchersService` thật + `InProcessEventBus` thật + `OrderCancelledStockSubscriber` (gọi `onModuleInit`) + `AuditSubscriber` nếu cần AC-13; dọn ledger/phiếu/audit theo thứ tự FK). Chạy `npm run test:db`.
- [x] **T7 — Web** (AC: 16, 18)
  - [x] Port + fake port + `index.ts` export; `StockVouchersScreen.tsx` theo D8 (dùng component design-system sẵn có: `Seg`, `Sheet`, `Table`, `Field`, `Banner`, `Button`, chip loại hiện có; class CSS mới phải có rule thật trong `stock-vouchers.css` — guard css-class-coverage).
  - [x] `web/src/test/stock-vouchers-screen.test.tsx` các ca AC-16. `cd web && npm run typecheck && npm test && npm run build`.
- [x] **T8 — Mobile** (AC: 17, 18)
  - [x] Port + fake + `stock_vouchers_screen.dart` theo D8 (`AppSheet`, `AppChip`, `AppCard`, `MoneyText`; permission key nếu cần dùng `AppPermissionKeys` — memory `mobile-screens-use-apppermissionkeys-not-appperm`).
  - [x] Widget test AC-17 (fixture nhãn DÀI NHẤT, 320/360 px). `cd mobile && flutter analyze && flutter test`.
- [x] **T9 — Design-system** (AC: 18): lật assert + danh sách chuỗi parity; `cd design-system && npm test`.
- [x] **T10 — Đột biến** (cp backup, KHÔNG `git checkout` — memory `mutation-test-never-git-checkout`; mutant phải compile — memory `mutation-must-compile-or-false-red`); bảng vào Completion Notes. Tối thiểu:
  - bỏ `FOR UPDATE` khoá `orders` trong primitive ⇒ ĐỎ lane DB (AC-7b);
  - bỏ `FOR UPDATE` khoá `products` trong primitive ⇒ ĐỎ lane DB (AC-7a);
  - bỏ product của phần đang giữ khỏi tập khoá (mutate TỪNG nguồn — memory `lock-set-each-source-needs-db-interleaving`);
  - lọc theo `event.orderVersionId` thay vì cấp đơn ⇒ ĐỎ (AC-3);
  - lọc `tracksStock` ⇒ ĐỎ (AC-5);
  - bỏ kiểm `status === huy` ⇒ ĐỎ (AC-6);
  - subscriber không `subscribe` ⇒ ĐỎ lane DB AC-1;
  - bỏ `FOR UPDATE` trong `createReturnVoucher` ⇒ ĐỎ (AC-7c);
  - bỏ kiểm "đã có phiếu trả" sau khoá ⇒ ĐỎ unit (unique DB là lớp hai — memory `mutation-hits-one-layer-only`; ghi rõ lớp nào bắt);
  - bỏ kiểm đơn `huy` ⇒ ĐỎ; bỏ kiểm `qty ≤ đã xuất` ⇒ ĐỎ; `unitCost` lấy `Product.costPrice` hiện hành thay vì dòng gốc ⇒ ĐỎ (fixture giá khác nhau);
  - bỏ cập nhật `costPrice` ⇒ ĐỎ; ghi thêm `StockMovement` trong phiếu trả ⇒ ĐỎ (khẳng định ledger không đổi);
  - web: map chỉ số `fieldErrors` sai khi có dòng 0 ⇒ ĐỎ; mobile tương tự;
  - DROP CHECK/unique trên DB local (rồi khôi phục) ⇒ ca AC-14 ĐỎ.
- [x] **T11 — Cổng cuối:** `cd backend && npx tsc --noEmit && npm test && npm run test:db`; eslint/prettier file đụng (baseline lint đỏ sẵn — đo bằng stash, memory `backend-lint-red-at-baseline`; chỉ format hunk của mình); web/mobile/design-system như T7–T9. Không `git push`; `git add` đường dẫn cụ thể (KHÔNG `-A`); `package-lock.json` (nếu đổi) cần `git add -f`.

## Dev Notes

### Quyết định của Đại Ca và luật đã chốt (2026-10-21) — ưu tiên hơn mọi chỗ khác trong story

- **Chốt và chốt lại KHÔNG bao giờ bị chặn khi thiếu tồn**; chặn chỉ ở khâu xuất kho (docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md).
- Cửa xuất kho nhận `dacoc`, `danggiao`, `thicong`, `dachot`, `nghiemthu`. Đóng `dachot → hoanthanh` và `nghiemthu → hoanthanh` bị chặn 409 khi còn vật tư chưa xuất (commit 85e47da, d355ab7). Đơn đã xuất kho không `mo_lai` được.
- **Ngôn ngữ:** mọi thứ thuộc code (tên biến/hàm/file, comment, tên test, log, commit message) và contract API MỚI (route, field DTO) viết tiếng Anh; chỉ chuỗi người dùng thấy là tiếng Việt. Story ghi tên tiếng Việt cho symbol/route/field MỚI ⇒ dùng tên tiếng Anh tương đương, ghi bảng đối chiếu vào Completion Notes.
- **Tiền hiển thị:** luôn qua `<Money>` / `MoneyText` / `formatVnd` (`83.010.960 đ`); guard `design-system/money/money-render-guard.test.mjs` đỏ nếu in số tiền thô.

- **Mặc định Trợ Lý tuyên bố (Đại Ca chưa phủ quyết) — lỗ R5 của 6.6 làm TRONG story này:** khi đơn chuyển sang `hoanthanh` (mọi cạnh vào `hoanthanh`), engine nhả MỌI phần giữ chỗ còn lại của đơn (theo ledger, cấp cả đơn, mọi version, không lọc theo `tracksStock`) bằng movement `release` âm, TRONG cùng transaction chuyển trạng thái, sau khoá orders rồi products (FOR UPDATE). Không đụng `onHand`. Đơn đã xuất ⇒ ledger đã về 0 ⇒ không ghi gì. Thêm AC + task + test unit/e2e/lane DB (gồm ca sản phẩm bị tắt theo dõi tồn sau khi chốt rồi đóng đơn ⇒ reserved về 0) + đột biến bỏ bước nhả phải đỏ.
- Đơn mở lại rồi huỷ: nhả theo cả đơn (mọi version), không chỉ version trong sự kiện huỷ.


### Quyết định của Đại Ca và luật đã chốt — ưu tiên hơn mọi chỗ khác trong story

- **Chốt/re-chốt KHÔNG chặn khi thiếu tồn**; chặn chỉ ở khâu xuất kho (`docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md`). Story này không đụng chốt/xuất.
- **Không đơn nào Hoàn thành khi còn vật tư chưa xuất; đơn đã xuất không mở lại được** (commit `85e47da`, `d355ab7`) — giữ nguyên.
- **Luật dự án (extra-instructions):** (1) đường ghi đơn qua scope — story KHÔNG thêm đường ghi bảng đơn (D4); (2) mọi thao tác tồn/ledger khoá `SELECT … FOR UPDATE` trong tx + test lane DB (Postgres local 5433, `pns-postgres`), KHÔNG ghi DB khác; (3) màn web: test render + `typecheck/test/build`; (4) màn mobile có widget test; (5) source-guard mới (nếu thêm) có assert chống-guard-rỗng; (6) e2e dùng `initAppOnLoopback` (`backend/test/util/listen-loopback.ts`); (7) không push, `git add` cụ thể, `package-lock.json` cần `-f`; (8) code/comment/tên test/log/commit tiếng Anh, chỉ chuỗi người dùng thấy tiếng Việt; contract MỚI (route `/:id/return`, field `returnOfVoucherId`/`returnOf`/`returnVoucher`/`canReturn`/`isReturn`, method port `createReturnVoucher`) tiếng Anh; không đổi tên hàng loạt symbol tiếng Việt cũ (`ma`, `ten`, `nguoiTao`, `taoPhieu`… giữ nguyên).
- **Tiền hiển thị:** luôn qua `<Money>`/`MoneyText`/`formatVnd` (`83.010.960 đ`); guard `design-system/money/money-render-guard.test.mjs`.
- Không mã story/AC trong comment/tên test/commit/migration (`review-audit-self-decision.md#Stable Code Artifacts`).

### Files sẽ đổi

| File | Loại |
|---|---|
| `backend/prisma/schema.prisma` | UPDATE — `returnOfVoucherId` + quan hệ + docstring |
| `backend/prisma/migrations/20261021120000_add_stock_voucher_return_link/migration.sql` | NEW — cột + unique + FK + CHECK thêm tay |
| `backend/src/inventory/domain/gia-von.ts` | UPDATE — `maPhieu` PK-NT, hằng field-error |
| `backend/src/inventory/domain/stock-voucher-events.ts` | UPDATE — snapshot thêm 2 field optional |
| `backend/src/inventory/stock-vouchers.service.ts` | UPDATE — `releaseForCancelledOrder`, `createReturnVoucher`, đọc/list |
| `backend/src/inventory/order-cancelled-stock.subscriber.ts` | NEW |
| `backend/src/inventory/inventory.module.ts` | UPDATE — provider + docstring |
| `backend/src/inventory/stock-vouchers.controller.ts` | UPDATE — route `:id/return` |
| `backend/src/inventory/dto/create-return-voucher-request.dto.ts` | NEW |
| `backend/src/inventory/dto/stock-voucher-response.dto.ts`, `stock-voucher-list-query.dto.ts` | UPDATE |
| `backend/openapi/openapi.json` | REGEN |
| `backend/test/…` (unit, e2e, `stock-cancel-return.db.integration.spec.ts`, spec hermetic có huỷ) | NEW/UPDATE |
| `web/src/design-system/session/{stock-vouchers-port,fake-stock-vouchers-port,index}.ts` | UPDATE |
| `web/src/screens/inventory/StockVouchersScreen.tsx`, `stock-vouchers.css` | UPDATE |
| `web/src/test/stock-vouchers-screen.test.tsx` | UPDATE |
| `mobile/lib/design_system/session/{stock_vouchers_port,fake_stock_vouchers_port}.dart` | UPDATE |
| `mobile/lib/screens/inventory/stock_vouchers_screen.dart` | UPDATE |
| `mobile/test/screens/inventory/stock_vouchers_screen_test.dart` | UPDATE |
| `design-system/screens/stock-vouchers.test.mjs` | UPDATE — lật assert "Nhập trả" |

**KHÔNG đổi:** `OrdersService.huyDon()` và mọi phần `orders/` (trừ khi spec test cần mock), `allowed-transition.ts`, `applyTransition` (TRỪ một nhánh T3b: đích `hoanthanh` ⇒ `releaseHeldForOrderInTx`), `confirm`/`revise`/`issueStock`, `reserveForOrderInTx`, `issueForOrderInTx`, `stock-items.service.ts` (đường đọc đã tính `reserved = SUM`), `domain/ton-kho.ts`, guard `no-stock-write-in-cancel` và `inventory-read-only` (không nới), permission registry/`permissions.json`/`PERM`/`AppPerm`, màn chi tiết Đơn.

### Hiện trạng phải giữ

- `huyDon`: thứ tự scope → lý do → pre-check → tx → publish `StatusChanged` rồi `OrderCancelled`; 409 khi đã `huy`.
- `taoPhieu`: hành vi + envelope nguyên vẹn (nhập tự do vẫn từ chối SP không theo dõi).
- `issueForOrderInTx`: không đổi; `findOrderIssueVoucher` giờ trả thêm `canReturn`/`returnVoucher` (cùng `CHI_TIET_INCLUDE`). `backend/src/orders/dto/order-stock-issue-response.dto.ts` NHÚNG `StockVoucherDetailDto` (`voucher?`/`voucher!`) ⇒ `openapi.json` của `GET/POST /orders/:id/stock-issue` cũng đổi theo — chấp nhận (thêm field). Web/mobile: nếu `orders-port`/`fake-orders-port` (và bản Dart) dùng lại kiểu `StockVoucherDetail` thì fixture phải thêm `canReturn` (vd `false`) để typecheck/analyze xanh — rà `web/src/design-system/session/{orders-port,fake-orders-port}.ts` và `web/src/test/order-stock-issue.test.tsx`.
- Thứ tự khoá toàn hệ thống `orders → products`; phiếu trả chỉ khoá `products` (không ghi ledger, đơn đã `huy` bất biến).
- Top-level `orderId` của voucher DTO = "phiếu xuất gắn đơn" (web/mobile phụ thuộc).

### Tình huống biên đã tính

- Huỷ từ `baogia` chưa từng chốt / đơn chốt trước 6.6 ⇒ không ledger ⇒ no-op.
- Đơn có SP tracked nhưng tất cả dòng tự do/untracked ⇒ không ledger ⇒ no-op.
- Huỷ sau xuất ⇒ ledger net 0 ⇒ no-op; hàng về kho chỉ qua phiếu trả.
- Xuất và huỷ đua: cả hai khoá dòng `orders` trước (engine / `lockOrderRow`), xuất kiểm lại status dưới khoá (`issueStock` → `assertStockIssuable`) ⇒ nối tiếp: xuất trước ⇒ huỷ sau thấy net 0; huỷ trước ⇒ xuất bị 409.
- SP bị soft-delete / tắt theo dõi sau xuất ⇒ phiếu trả vẫn nhận (D4.4).
- Giá vốn khi `onHand` trước = 0 ⇒ `tinhGiaVonBinhQuan` lấy đúng giá gốc.
- Phiếu xuất gắn đơn có dòng SP mà đơn không còn (không thể — phiếu bất biến; lấy dòng từ PHIẾU GỐC, không từ dòng đơn).

### Kiểm thử — luật dự án áp dụng trực tiếp

- Lane DB race: kiểm khả năng chạm khe trước khi đổ lỗi test (memory `db-race-test-cannot-reach-short-pretx-window`); xen kẽ ép buộc bằng tx giữ khoá + `wait(150)` (khuôn `order-stock-issue.db.integration.spec.ts:538-626`, `stock-reservation.db.integration.spec.ts`).
- Publish đếm bằng `toHaveBeenCalledTimes` (memory `publish-count-unasserted-duplicate-survives`).
- Mock tx phải CHẠY thân callback rồi mới ném (memory `mock-rejected-transaction-false-green`).
- Reviewer song song mutate cùng file ⇒ kiểm lại finding trên file hiện tại (memory `parallel-reviewers-mutation-collide`).
- Web `.tsx` lỗi cú pháp có thể lọt text-guard — chạy `npm run typecheck` (memory `web-tsx-syntax-error-passes-all-lanes`).
- Widget test mobile phải bật mọi điều kiện bao ngoài (`canReturn` + phiếu gắn đơn + chi tiết đã tải) khi khẳng định nút ẩn/hiện (memory `widget-test-gate-unreachable-outer-condition`).
- Sửa comment migration SAU `migrate deploy` ⇒ cập nhật checksum `_prisma_migrations` của DB local 5433 (tiền lệ 6.4).

### Previous Story Intelligence (6.6, 6.5, 6.4)

- 6.6 R5 (6.6 hoãn — đóng ở story này): SP tắt `tracksStock` giữa chốt và xuất/đóng ⇒ phần giữ treo. Story này vá cả đường HUỶ (D2.5) lẫn cạnh đóng `→ hoanthanh` (T3b — mọi cạnh vào `hoanthanh`, cùng tx, sau khoá).
- 6.6 R6: handler huỷ phải nhả theo CẤP ĐƠN — AC-3.
- 6.6 D3/D5: primitive inventory không publish, ledger không event; giữ khuôn.
- 6.6 Debug log: 3 spec DB dựng `OrdersService` với stub `{}` cho kho đã đỏ khi thêm phụ thuộc — giờ thêm subscriber vào `InventoryModule`, spec dựng app thật sẽ tự có subscriber; spec dựng tay thì KHÔNG (chỉ lane DB mới của story cần dựng).
- 6.5: thêm tham số constructor `OrdersService` phải sửa 21 chỗ — story này KHÔNG thêm dependency cho `OrdersService`.
- 6.4: tiền lệ migration + CHECK thêm tay + cập nhật checksum; `issueForOrderInTx` đặt `unitCost = costPrice` lúc xuất = `costPriceSnapshot`.
- Prisma 7: `createMany([])` là gotcha — dùng `create` từng dòng / nested `lines.create` như `taoPhieu`; nullable Json không liên quan; tx mảng `RepeatableRead` đòi `orderBy` cho `groupBy`.

### Git intelligence

`f8b4a1e` (6.6 ledger `reserve`/`release`, unique + CHECK, `reserveForOrderInTx`), `33d6d9f` (6.5 chặn thiếu tồn ở khâu xuất, `StockOutBlocked`), `d355ab7` (chặn đóng khi chưa xuất), `85e47da` (6.4 xuất gắn đơn). Không dependency mới.

### Latest tech notes

- Stack giữ nguyên (NestJS 11.1, Prisma 7.8, Postgres 18, React 19.2, Flutter 3.44) — không cần tra phiên bản.
- Prisma quan hệ 1-1 tự tham chiếu: cột FK `@unique` ở phía `returnOf`, phía ngược `returnVoucher StockVoucher?` không cột; cả hai cùng tên relation.
- Prisma 7 `migrate diff` dùng `--from-schema/--to-schema`; CHECK thêm tay.
- Query boolean qua `class-transformer`: `@Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)` + `@IsBoolean()` (đừng dùng `@Type(() => Boolean)` — `'false'` thành `true`).

### Project Structure Notes

- File mới kebab-case (guard `naming-convention`). Subscriber + primitive ở `inventory/`; `inventory/` KHÔNG import `OrdersModule` (chỉ hằng domain thuần `order-status.ts`).
- Lệch có chủ đích: (1) "huỷ `StockMovement` của version đó" (AC epic 5) ⇒ ghi `release` append-only theo CẤP ĐƠN mọi version còn giữ (ledger không DELETE; 6.6 R6). (2) Tình trạng từng dòng của mockup ⇒ gộp vào ghi chú phiếu. (3) Một phiếu xuất ⇒ một phiếu trả. Ghi cả ba vào Completion Notes.

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Handler huỷ lỗi ⇒ `reserved` treo** (bus cô lập lỗi, huỷ đã commit). Mặc định: chấp nhận, primitive idempotent + log; nếu Đại Ca muốn, thêm script/endpoint quản trị "nhả lại cho đơn huỷ còn giữ" ở story sau.
2. **Nhiều lần trả / tình trạng từng dòng.** Mặc định: một phiếu trả mỗi phiếu xuất, tình trạng ghi ở ghi chú phiếu; hàng tìm thấy sau ⇒ phiếu nhập tự do.
3. **Lối vào từ màn Đơn** (nhắc "đơn đã xuất — cần phiếu nhập trả" ở chi tiết đơn/dialog huỷ). Mặc định: không — lối vào là Phiếu kho như mockup.
4. ~~**Lỗ R5 ở cạnh đóng `→ hoanthanh`**~~ — ĐÃ ĐÓNG trong story này (T3b): vào `hoanthanh` ⇒ engine nhả mọi phần giữ còn lại theo ledger, cùng tx, sau khoá `orders` rồi `products`; không đụng `onHand`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.7 (600-607), #Story 5.7 (525-531), #Story 6.4 (577-582), #Story 6.6 (592-598)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#4.11 FR-25/FR-26 (344-368)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-11, AD-18, AD-19]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html:3950-3962 (Seg + chip), 4072-4190 (Phiếu nhập trả web + mobile)]
- [Source: backend/src/orders/orders.service.ts:1264-1390 (`huyDon`), :370-400 (`STOCK_ISSUE_STATUSES`), :925-985 (`issueStock`), :1179-1260 (`issueStockIfNeeded`)]
- [Source: backend/src/orders/domain/order-events.ts:337-366 (`OrderCancelled`); allowed-transition.ts:201-218 (cạnh `huy`); order-status.ts:55 (`TRANG_THAI_HUY`)]
- [Source: backend/src/events/{event-bus,in-process-event-bus}.ts; backend/src/audit/audit.subscriber.ts]
- [Source: backend/prisma/schema.prisma:148-260 (`StockItem`, `StockMovement`, `StockVoucher`, `StockVoucherLine`)]
- [Source: backend/src/inventory/stock-vouchers.service.ts:206-376 (`taoPhieu`), :378-500 (`issueForOrderInTx`), :502-620 (`reserveForOrderInTx`), :640-738 (đọc); domain/{gia-von,stock-voucher-events,stock-movement-type,stock-voucher-visibility}.ts; stock-vouchers.controller.ts; inventory.module.ts]
- [Source: backend/test/no-stock-write-in-cancel.spec.ts; inventory-read-only.spec.ts; stock-reservation.db.integration.spec.ts; order-stock-issue.db.integration.spec.ts:500-650]
- [Source: web/src/screens/inventory/StockVouchersScreen.tsx; web/src/design-system/session/stock-vouchers-port.ts; mobile/lib/screens/inventory/stock_vouchers_screen.dart; design-system/screens/stock-vouchers.test.mjs:148]
- [Source: _bmad-output/implementation-artifacts/6-6-giu-cho-ton-khi-chot-don-stock-movement.md (D2–D5, review R5/R6)]
- [Source: _bmad-output/project-context.md; _bmad-output/story-automator/extra-instructions-6-dev.txt (luật 1-8)]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5) — backend tự làm; web + mobile giao 2 subagent song song, controller rà và sửa lại.

### Debug Log References

- `npx prisma migrate diff --from-schema <HEAD schema> --to-schema prisma/schema.prisma --script` → cột + unique `stock_vouchers_return_of_voucher_id_key` + FK `stock_vouchers_return_of_voucher_id_fkey`; CHECK `stock_vouchers_return_is_stock_in` thêm tay. `migrate deploy` lên `pns-postgres:5433` OK.
- Web subagent báo 4 ca `order-stock-issue.test.tsx` đỏ "có thể sẵn" — kiểm bằng worktree HEAD: baseline XANH 22/22; bisect ⇒ fixture mới `PK-X-0090` gắn `ord-demo-3` (= `FAKE_ORDER_SHORT_STOCK` của fake orders port, map phiếu theo `orderId`) ⇒ đơn đó trông như đã xuất. Đổi sang `ord-demo-cancelled` ⇒ xanh.
- Lane DB AC-14(c): trên dòng `nhap`, Postgres kiểm CHECK theo tên ⇒ `stock_vouchers_order_only_xuat` bắn trước `stock_vouchers_return_is_stock_in`; vế "phiếu trả không mang cặp đơn" vì vậy đã được CHECK cũ phủ. Test khẳng định bị CHECK (23514) từ chối + dòng không đổi, không ghim tên. Vế `type='xuat'` + link chỉ CHECK mới bắt được (ca riêng, assert theo TÊN).
- AC-14(d): xoá phiếu gốc bị FK dòng phiếu chặn trước ⇒ test xoá dòng gốc trước rồi mới khẳng định `stock_vouchers_return_of_voucher_id_fkey`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Giải phóng khi huỷ (T3):** `OrderCancelledStockSubscriber` (inventory) subscribe `OrderCancelled`, lọc theo `event.type` + `event.target` (không import class từ `orders/`); gọi `StockVouchersService.releaseForCancelledOrder(orderId)`: tự mở tx → `orders` FOR UPDATE → re-read status (≠ `huy` ⇒ thôi) → `releaseHeldForOrderInTx`: `groupBy` ledger cấp ĐƠN mọi version, bỏ nhóm ≤ 0, khoá `products` (cùng câu SQL) rồi ghi `release` âm. Không đọc `tracksStock`, không chạm `onHand`, không phiếu, không event. `huyDon()` không đổi một byte; guard `no-stock-write-in-cancel`, `inventory-read-only` giữ nguyên (không nới `FILE_DUOC_GHI`).
- **Nhả khi hoàn thành (T3b — làm theo khối quyết định ưu tiên trong Dev Notes; mục "Ngoài"/Câu hỏi mở 4 đã sửa cho khớp):** `applyTransition` gọi `releaseHeldForOrderInTx` khi đích là `hoanthanh` (mọi cạnh, mọi lane), sau cổng `updateMany`. Đây là thay đổi DUY NHẤT trong `orders/`, không thêm dependency cho `OrdersService`. Đơn đã xuất ⇒ net 0 ⇒ không ghi.
- **Phiếu nhập trả (T4):** `POST /stock-vouchers/:id/return` (`inventory.manage`), body không có `unitCost` (whitelist bỏ). Đọc gốc → 404/409 loại phiếu → khoá `products` của phiếu GỐC → kiểm đã có phiếu trả + đơn `huy` SAU khoá → validate dòng (400 `DUPLICATE_PRODUCT`/`NOT_ON_ORIGIN_VOUCHER`/`RETURN_EXCEEDS_ISSUED`, `VALIDATION_ERROR` envelope) → `unitCost` = dòng gốc, `costPrice` bình quân, `onHand` cộng → phiếu `nhap` + `returnOfVoucherId` → publish đúng một `StockVoucherCreated` (thêm `returnOfVoucherId`, `orderId`) sau commit. Không ghi ledger, không ghi bảng đơn (chỉ đọc status). Nhận cả SP đã tắt theo dõi/ngừng bán.
- **Phạm vi người gọi (luật 1):** đường phiếu trả không ghi bảng đơn ⇒ không phải đường ghi đơn; `inventory.manage` là quyền toàn kho như 6.3/6.4.
- **Contract đọc (D7):** `returnOfVoucherId?` (summary), `returnOf?`, `returnVoucher?`, `canReturn` (luôn có; backend tính) ở detail — gồm cả response `/orders/:id/stock-issue` (dùng chung `CHI_TIET_INCLUDE`). Top-level `orderId` giữ nghĩa "phiếu xuất gắn đơn". `maPhieu(type, seq, isReturn)` ⇒ `PK-NT-`. Query `isReturn` (Transform `'true'|'false'`). `openapi.json` regen; `permissions.json` không đổi.
- **Đối chiếu tên (luật 8):** primitive `releaseForCancelledOrder`, `releaseHeldForOrderInTx`; service `createReturnVoucher`; DTO `CreateReturnVoucherRequestDto`/`ReturnVoucherLineRequestDto`/`StockVoucherReturnOfDto`/`StockVoucherReturnRefDto`; field-error `NOT_ON_ORIGIN_VOUCHER`, `RETURN_EXCEEDS_ISSUED`; port web/mobile `createReturnVoucher`. Tên test mới đều tiếng Anh (đã dịch tên test subagent viết tiếng Việt).
- **Lệch có chủ đích:** (1) "huỷ StockMovement của version đó" ⇒ ghi `release` append-only cấp ĐƠN mọi version còn giữ. (2) Tình trạng từng dòng của mockup ⇒ gộp vào ghi chú phiếu. (3) Một phiếu xuất ⇒ tối đa một phiếu trả (unique). (4) AC-14(c) không assert được tên CHECK mới (xem Debug Log). (5) Mobile kiểm ghi chú ≤500 ở client (AppField không có maxLength) — backend vẫn là hàng rào thật.
- **Đã gỡ:** banner thừa subagent web tự thêm ở chi tiết phiếu trả (không có trong UX/spec).
- **Test:** backend unit `stock-cancel-release.spec.ts` (17), `stock-return-voucher.spec.ts` (19), +3 ca `order-stock-issue.spec.ts`, `gia-von.spec.ts` (+2); e2e `stock-vouchers.e2e.spec.ts` (+25: mã HTTP/envelope AC-11, `unitCost` bị bỏ AC-10, che giá vốn, 403, lọc `isReturn`, `canReturn`), `orders.e2e.spec.ts` (+1: huỷ qua bus thật, subscriber nhả, `Logger.error` không bị gọi). Lane DB mới `stock-cancel-return.db.integration.spec.ts` (32: AC-1..9, 11..14, hoàn thành, xen kẽ ép buộc). Web 85/85 (+9), mobile 338/338 (+13), design-system 448/448 (lật assert "Nhập trả" + parity port 4 method + DTO mới).
- **Cổng cuối:** `backend: tsc OK · npm test 96 suites / 1846 · npm run test:db 237/237` · `web: typecheck · test 85/85 · build OK` · `mobile: analyze 0 issue · test 338/338 · dart format -o none sạch` · `design-system: 448/448`. ESLint file backend đụng: sạch phần của story (2 lỗi prettier ở `orders.service.ts` + nợ `orders.e2e.spec.ts`/`orders.service.spec.ts` có sẵn ở baseline HEAD).
- **Đột biến (cp backup, không git checkout; mọi mutant compile):**

  | Mutant | Unit/e2e | Lane DB |
  |---|---|---|
  | bỏ `FOR UPDATE` khoá `orders` (primitive huỷ) | ĐỎ | ĐỎ (sau khi làm chặt: tx giữ khoá tự nhả trước ⇒ mutant đọc ledger cũ, vỡ unique; bản đầu XANH vì INSERT ledger lấy KEY SHARE qua FK nên vẫn chờ) |
  | bỏ `FOR UPDATE` khoá `products` (primitive) | ĐỎ | ĐỎ |
  | chỉ nhả version hiện hành | ĐỎ | ĐỎ |
  | lọc `tracksStock` khi nhả | ĐỎ | ĐỎ |
  | bỏ kiểm `status === huy` | ĐỎ | ĐỎ |
  | subscriber không `subscribe` | ĐỎ | ĐỎ |
  | bỏ `FOR UPDATE` trong phiếu trả | ĐỎ | ĐỎ — **sau review**: bản đầu XANH giả (holder chỉ giữ khoá, `product.update` vẫn bị chặn nên vẫn "chờ"); nay holder GHI `onHand +3` dưới khoá ⇒ mutant mất cập nhật (4 ≠ 7) ĐỎ; ca song song nay ép xen kẽ + assert `AppException` (mutant ⇒ `PrismaClientKnownRequestError`) |
  | bỏ kiểm "đã có phiếu trả" sau khoá | ĐỎ | ĐỎ (unique DB là lớp hai) |
  | bỏ kiểm đơn `huy` | ĐỎ | ĐỎ |
  | bỏ kiểm `qty ≤ đã xuất` | ĐỎ | ĐỎ |
  | `unitCost` = `costPrice` hiện hành | ĐỎ | ĐỎ |
  | bỏ cập nhật `costPrice` | ĐỎ | ĐỎ |
  | phiếu trả ghi thêm `StockMovement` | ĐỎ | ĐỎ |
  | bỏ nhả ở `hoanthanh` | ĐỎ | ĐỎ |
  | DROP CHECK `stock_vouchers_return_is_stock_in` (DB local, đã khôi phục) | — | ĐỎ |
  | DROP unique `return_of_voucher_id` (đã khôi phục) | — | ĐỎ ca unique; ca song song vẫn xanh nhờ kiểm dưới khoá (đúng thiết kế hai lớp) |
  | web: map `fieldErrors` sai chỉ số khi có dòng 0 | ĐỎ | — |
  | mobile: map `_loiDong[k]` thay vì `daGui[k]` | ĐỎ | — |

  Tập khoá của primitive chỉ có MỘT nguồn (sản phẩm của phần đang giữ) — ca "SP chỉ version CŨ giữ ⇒ CHỜ khoá" phủ nguồn đó.
- **Chưa làm (giữ mặc định Câu hỏi mở 1–3):** công cụ chạy lại nhả cho đơn huỷ còn giữ khi handler lỗi; nhiều phiếu trả/tình trạng từng dòng; lối vào từ màn Đơn. Không có HTTP implementation port stock-vouchers ở web/mobile (chỉ interface + fake, như trước story).

### File List

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261021120000_add_stock_voucher_return_link/migration.sql` (new)
- `backend/src/inventory/domain/gia-von.ts`
- `backend/src/inventory/domain/stock-movement-type.ts`
- `backend/src/inventory/domain/stock-voucher-events.ts`
- `backend/src/inventory/dto/create-return-voucher-request.dto.ts` (new)
- `backend/src/inventory/dto/stock-voucher-list-query.dto.ts`
- `backend/src/inventory/dto/stock-voucher-response.dto.ts`
- `backend/src/inventory/inventory.module.ts`
- `backend/src/inventory/order-cancelled-stock.subscriber.ts` (new)
- `backend/src/inventory/stock-vouchers.controller.ts`
- `backend/src/inventory/stock-vouchers.service.ts`
- `backend/src/orders/orders.service.ts`
- `backend/openapi/openapi.json`
- `backend/test/gia-von.spec.ts`
- `backend/test/order-stock-issue.e2e.spec.ts`
- `backend/test/order-stock-issue.spec.ts`
- `backend/test/orders.e2e.spec.ts`
- `backend/test/orders.service.spec.ts`
- `backend/test/stock-vouchers.e2e.spec.ts`
- `backend/test/stock-cancel-release.spec.ts` (new)
- `backend/test/stock-return-voucher.spec.ts` (new)
- `backend/test/stock-cancel-return.db.integration.spec.ts` (new)
- `web/src/design-system/session/stock-vouchers-port.ts`
- `web/src/design-system/session/fake-stock-vouchers-port.ts`
- `web/src/design-system/session/fake-orders-port.ts`
- `web/src/design-system/session/index.ts`
- `web/src/screens/inventory/StockVouchersScreen.tsx`
- `web/src/screens/inventory/stock-vouchers.css`
- `web/src/test/stock-vouchers-screen.test.tsx`
- `mobile/lib/design_system/session/stock_vouchers_port.dart`
- `mobile/lib/design_system/session/fake_stock_vouchers_port.dart`
- `mobile/lib/screens/inventory/stock_vouchers_screen.dart`
- `mobile/test/screens/inventory/stock_vouchers_screen_test.dart`
- `design-system/screens/stock-vouchers.test.mjs`
- `design-system/session/parity.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

_Reviewer: Đại Ca (AI review qua /ck:code-review + 2 reviewer subagent) — 2026-10-21_

**Kết quả:** Approve sau khi sửa. 0 CRITICAL; AC 1–19 + T3b IMPLEMENTED; mọi task [x] có bằng chứng. Git vs File List: khớp (không thiếu/thừa file nguồn).

**Kiểm riêng theo luật Đại Ca**
- (1) Phạm vi: đường mới duy nhất chạm đơn là nhả ở `hoanthanh` bên trong `applyTransition` (chỉ gọi sau `findScopedOrThrow`); phiếu nhập trả chỉ ĐỌC status đơn. Đột biến bỏ scope ở `chuyenTrangThaiThuCong` ⇒ 3 ĐỎ (e2e 404 đơn người khác, unit `where` kẹp owner/assignee, source-guard quyền thật).
- (2) Khoá: đột biến từng câu `FOR UPDATE` — `orders` (primitive huỷ) ĐỎ; `products` (primitive) ĐỎ; `products` (phiếu trả) **XANH GIẢ ⇒ đã sửa test**, nay ĐỎ.
- (a) Huỷ sau xuất không cộng `onHand` (AC-2 lane DB). (b) Nhả theo cả đơn mọi version, idempotent (AC-3/4/6). (c) T3b: nhả trong tx, sau cổng `updateMany` dưới khoá `orders`, trước commit — nay test cho CẢ BA cạnh vào `hoanthanh`.
- (d) Subscriber sau commit: lỗi ⇒ `reserved` treo. Đánh giá: chấp nhận (bus cô lập lỗi là thiết kế AD-18); primitive idempotent (chạy lại `releaseForCancelledOrder(orderId)` an toàn, lane DB "second run writes nothing"); log bus cũ chỉ có `event.type` ⇒ **thêm** log trong subscriber kèm `orderId` + stack rồi ném lại. Audit huỷ vẫn có qua `StatusChanged`/`OrderCancelled`. Công cụ chạy lại hàng loạt: Câu hỏi mở 1.
- (e) Story đã dọn: "Ngoài phạm vi", Câu hỏi mở 4, Previous Story Intelligence (R5), "KHÔNG đổi `applyTransition`".

**Findings đã sửa (tất cả)**
- [HIGH] Test AC-7c (phiếu trả chờ khoá products) xanh khi bỏ `FOR UPDATE` → holder ghi `onHand` dưới khoá, assert 7. `backend/test/stock-cancel-return.db.integration.spec.ts`
- [HIGH] Nhả ở `hoanthanh` chỉ test cạnh `dachot`; dời nhả vào nhánh gate vẫn xanh → `it.each` 3 cạnh (`dachot`/`nghiemthu`/`dagiao`) + lane DB cạnh `dagiao`. Đột biến ⇒ ĐỎ. `backend/test/order-stock-issue.spec.ts`
- [MEDIUM] "Cùng tx" của nhả khi đóng không được chứng minh (`expect.anything()`) → assert tx client + trước `tx.commit`.
- [MEDIUM] Hai phiếu trả song song không ép xen kẽ; ĐỎ dưới mutant chỉ nhờ TypeError → giữ khoá rồi thả, assert `AppException` 409.
- [MEDIUM] Lỗi subscriber không lộ `orderId` → log có `orderId` + test.
- [MEDIUM] Mobile chip "Nhập"+"Nhập trả" lệch web → chỉ chip info "Nhập trả" + test.
- [MEDIUM] Định danh MỚI tiếng Việt ở web/mobile/test (luật 8) → đổi sang tiếng Anh (symbol cũ giữ nguyên).
- [MEDIUM] Test sau khi lưu không chứng minh chọn phiếu mới/ẩn nút → assert header PK-NT, "Nhập trả · từ đơn huỷ", nút biến mất, phiếu gốc hiện link (fake cập nhật `canReturn`/`returnVoucher`).
- [LOW] Mobile đóng sheet khi đang gửi mất kết quả → chặn đóng khi `_sending` + test; mobile về tab "Tất cả" sau lưu như web; web lỗi không phải port ⇒ câu cố định thay `e.message`; chống bấm đúp (web `useRef`, mobile) + test; test `canReturn=false` chờ đúng header; test câu "Nhận lại ít hơn…".
- [LOW] Ca "a return voucher" trùng y hệt ca nhập tự do → fixture có `returnOfVoucherId`; unit primitive assert `stockItem.findMany` không lọc sản phẩm; spy `Logger.error` cho MỌI ca e2e huỷ (đột biến subscriber ném ⇒ 5 ĐỎ); prettier hunk của story (2 DTO, comment dính `);`).

**Ghi nhận không sửa (có lý do):** nhả theo nhóm (version, item) có thể nhả quá nếu một version cũ còn giữ lúc xuất — không chạm được vì re-chốt luôn nhả hết version cũ trước khi xuất được; đã ghi bất biến vào docstring `releaseHeldForOrderInTx`.

**Cổng sau sửa:** backend `tsc` OK · `npm test` 96 suites / 1852 · `npm run test:db` 21 suites / 238 · web typecheck + 87/87 + build OK · mobile analyze 0 issue + 341/341 + `dart format -o none` 0 đổi · design-system 448/448. Không màn web mới (screens-render không đổi), không source-guard mới.

## Change Log

- 2026-10-21: Story 6.7 implemented — release of held stock on cancel (subscriber on `OrderCancelled`) and on completion (`→ hoanthanh`, same tx), return voucher `POST /stock-vouchers/:id/return` at origin cost with schema link + CHECK, read contract (`canReturn`, `returnOf`, `returnVoucher`, `isReturn` filter, `PK-NT-`), web + mobile return flow, DB lane + mutation table. Status → review.
- 2026-10-21: Code review — fixed false-green return-voucher lock test, completion release tested on every edge into `hoanthanh`, failed cancel release logged with order id, web/mobile parity + English identifiers + post-save tests. Status → done.
