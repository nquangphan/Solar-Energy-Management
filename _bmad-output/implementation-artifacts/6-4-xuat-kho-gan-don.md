---
baseline_commit: 66bfa2872a3e7f973bfdb09eda306bd9ae6ef156
---

# Story 6.4: Xuất kho gắn Đơn — MỘT Đơn MỘT phiếu xuất + snapshot costPriceSnapshot lúc xuất

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền nhập/xuất kho (`inventory.manage` — preset `KHO_GIAO`, `QUAN_LY`, `ADMIN`, `SUPER_ADMIN`),
I want tạo phiếu xuất từ các Dòng vật tư của Đơn (một đơn một phiếu), xác nhận cùng bước "Đã giao",
so that cấp vật tư/giao hàng khớp đúng đơn, tồn thật trừ đúng một lần, và giá vốn từng dòng đơn được đóng băng lúc hàng rời kho.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-21, sau commit `66bfa28` của 6.3)

- `StockVoucher` (6.3) **chưa có** `orderId`/`orderVersionId`; phiếu có hiệu lực ngay khi lưu, không trạng thái, không sửa/xoá. `stock-vouchers.service.ts` là file DUY NHẤT được ghi tồn (guard `inventory-read-only.spec.ts` (b)), khoá `SELECT id FROM products WHERE id = ANY(…) ORDER BY id FOR UPDATE` làm lệnh đầu của tx, 409 `INSUFFICIENT_STOCK` + CHECK `stock_items_on_hand_non_negative`.
- `OrderLineItem.costPriceSnapshot Int?` **đã có cột** (Story 4.5) nhưng **không ai ghi** — `orders.service.ts:1683` ghi rõ "giá vốn đóng băng lúc XUẤT KHO (AD-20, Story 6.4)", `:1984` (revise) đặt `null`.
- `StockMovement` (ledger `reserved`) có bảng, **chưa có đường ghi** (6.6 sở hữu giữ chỗ lúc chốt). Hôm nay `reserved = 0` mọi sản phẩm.
- Engine: `ALLOWED_TRANSITIONS` có **HAI** cạnh vào `dagiao`, cùng sự kiện `xong_giao`: `danggiao → dagiao` (không gate cờ) và `dacoc → dagiao` (`{ thietBi: true, vanChuyen: false }` — khách tự lấy). `xong_giao` nằm trong `SU_KIEN_THU_CONG` ⇒ đi qua `OrdersService.chuyenTrangThaiThuCong()` (multipart, ảnh optional). Seam 6.1 (`6-1-…md:201-203`): phiếu xuất phải hook theo **đích** `dagiao`, không theo `from`.
- Guard `inventory-read-only.spec.ts` (c): `src/inventory/**` **CẤM** ghi aggregate đơn (đơn/version/dòng/…). Guard `no-unscoped-order-write.spec.ts`: mọi method công khai của `OrdersService` chạm đơn phải gọi `findScopedOrThrow` TRƯỚC. Guard `no-stock-write-in-cancel.spec.ts`: thân `huyDon()` không chứa định danh tồn kho. Guard `no-order-status-write-outside-transition.spec.ts`: chỉ `applyTransition` ghi `status`.
- `OrdersModule` `exports: [OrdersService]`; `InventoryModule` **không export gì**, `imports: [AccountsModule]`.
- Handoff 6.2 (`6-2-…md:329`) giao cho 6.4: **đọc xé** `GET /stock-items` (đọc `onHand` và `reserved` bằng hai câu dưới READ COMMITTED) — 6.4 là story đầu tiên trừ `onHand` VÀ ghi movement trong cùng tx.

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do; lật lại ⇒ xem Câu hỏi mở)

**D1 — `orders/` sở hữu transaction, `inventory/` cung cấp primitive chạy TRONG tx đó.**
Xuất kho gắn đơn ghi ba aggregate một lúc: tồn (`stock_items`, `stock_movements`, `stock_vouchers`), dòng đơn (`costPriceSnapshot`), và — ở bước Đã giao — `Order.status`. Ba thứ PHẢI atomic: snapshot giá vốn phải bằng đúng `unitCost` của dòng phiếu, và không được có trạng thái "đã trừ tồn mà đơn chưa Đã giao" (hay ngược lại).
- `Order.status` chỉ ghi được qua `applyTransition` (private, `orders.service.ts:492`) ⇒ cửa vào phải ở `OrdersService`.
- Ghi dòng đơn trong `src/inventory` bị guard (c) cấm ⇒ snapshot do `orders/` ghi.
- Ghi tồn ngoài `stock-vouchers.service.ts` phá hợp đồng khoá 6.3 ⇒ tồn do `inventory/` ghi.
⇒ `StockVouchersService.xuatKhoChoDonTrongTx(tx, …)` (method MỚI, nhận `tx` của caller, KHÔNG tự mở `$transaction`) ghi tồn + phiếu; `OrdersService` mở tx, khoá đơn, gọi primitive, ghi snapshot, (nếu là bước Đã giao) gọi `applyTransition`, commit, publish.
- `InventoryModule` thêm `exports: [StockVouchersService]`; `OrdersModule` thêm `InventoryModule` vào `imports`. `inventory/` **KHÔNG BAO GIỜ** import `OrdersModule` (vòng phụ thuộc). Sửa docstring hai module.
- Đã cân nhắc và **loại**: inventory commit tồn rồi gọi `chuyenTrangThaiTuDong()` sau commit (khuôn 5.2 cho `payments/`) — để lại khe "tồn đã trừ, đơn chưa Đã giao", và inventory vẫn không ghi được snapshot. Ghi rõ lý do trong docstring method mới (khác `chuyenTrangThaiTuDong` có chủ đích).

**D2 — Thứ tự khoá TOÀN HỆ THỐNG: dòng `orders` TRƯỚC, rồi dòng `products` (`ORDER BY id`).**
Đường xuất gắn đơn: `lockOrderRow` (op đầu của tx) → primitive khoá `products`. Phiếu tự do 6.3 chỉ khoá `products`; transition/mutator đơn chỉ khoá `orders` ⇒ không chu trình. 6.6 (giữ chỗ lúc chốt) sẽ đi cùng thứ tự. Ghi hợp đồng này vào docstring `StockVouchersService` (đoạn "HỢP ĐỒNG KHOÁ") và docstring khối `KHOÁ DÒNG` của `OrdersService` (`orders.service.ts:113-117`).

**D3 — Không có phiếu nháp: phiếu xuất gắn đơn được TẠO = được XÁC NHẬN.**
Khớp 6.3 ("hiệu lực ngay khi lưu") và PRD FR-26 ("người có `inventory.manage` đếm hàng → xác nhận → trừ"). Bước "xem trước" là một GET không ghi (AC-6). ⇒ KHÔNG thêm cột `status` (ERD spine vẽ `status "thêm ở luồng xuất gắn đơn"` — sửa chú thích ERD, Task 10). `createdBy` của phiếu gắn đơn = **người xác nhận**.

**D4 — Hai cửa vào, một helper chung, idempotent.**
- **(a) Bước Đã giao** — lane thủ công `chuyenTrangThaiThuCong()` với `event === xong_giao` (cả hai cạnh vào `dagiao`): trong CÙNG tx, SAU `applyTransition`, gọi helper private `xuatKhoNeuChua(tx, order, actor)`. Đơn chưa xuất ⇒ xuất ngay; đã xuất (qua cửa (b) trước đó) ⇒ bỏ qua. Ảnh optional của bước Đã giao (6.1 AC-3) giữ nguyên — KHÔNG gỡ `xong_giao` khỏi `SU_KIEN_THU_CONG`, KHÔNG tạo endpoint Đã giao thứ hai.
- **(b) Xuất kho riêng** — `POST /orders/:id/xuat-kho`: xuất mà KHÔNG chuyển trạng thái. Cho đơn thi công cấp vật tư (không bao giờ đi qua `dagiao`) và đơn có Vận chuyển muốn trừ kho lúc hàng lên xe (`danggiao`) thay vì lúc tới khách (câu hỏi mở của 6.1 — để người dùng chọn, bước Đã giao vẫn bảo đảm đã xuất). Trạng thái hợp lệ: `dacoc`, `danggiao`, `thicong` — **và `dachot`** (D12, Đại Ca chốt 2026-10-21); khác ⇒ 409 `'Đơn ở trạng thái này không xuất kho được.'`.
- Idempotent (NFR-1, PRD FR-25 "idempotent khi retry"): cửa (b) gọi lại trên đơn đã xuất ⇒ **200** + phiếu đã có, không ghi gì, không event. Cửa (a) trên đơn đã xuất ⇒ chỉ chuyển trạng thái. Kiểm "đã xuất" TRONG tx sau khoá đơn (đọc `stockVoucher` theo `(orderId, orderVersionId)`); unique DB là lưới cuối.

**D5 — Dòng phiếu = dòng vật tư theo dõi tồn của version hiệu lực, GỘP theo sản phẩm, xuất ĐỦ.**
Dòng của `currentVersionId` có `productId` khác null VÀ `product.tracksStock === true` (đọc DƯỚI khoá `products`); gộp theo `productId`, `qty` = tổng. Không cho sửa số lượng, không xuất từng phần (một đơn một phiếu ⇒ xuất đủ một lần — câu hỏi mở 3). Sản phẩm đã `isActive = false` vẫn xuất (khớp 6.3). Thứ tự dòng chuẩn: `ten` tăng dần rồi `productId` — dùng CHUNG cho GET xem trước, dòng phiếu, và chỉ số `fieldErrors`.
- Đơn **không có** dòng theo dõi tồn: cửa (a) ⇒ không tạo phiếu, vẫn chuyển Đã giao + vẫn snapshot (D6); cửa (b) ⇒ 409 `'Đơn không có vật tư theo dõi tồn kho — không cần phiếu xuất.'`.

**D6 — Snapshot `costPriceSnapshot` cho MỌI dòng của version hiệu lực, lúc xuất (AD-20, PRD `prd.md:482-486`).**
Hàm thuần MỚI `orders/domain/gia-von-snapshot.ts` → `giaVonSnapshotDong({ theoDoiTon, giaVonSanPham, unitPriceSnapshot })`:
- dòng theo dõi tồn ⇒ `Product.costPrice` đọc DƯỚI khoá `products` (= `unitCost` dòng phiếu — primitive trả về map `productId → unitCost`; `theoDoiTon = giaVonTheoSanPham.has(line.productId)`; orders KHÔNG tự đọc `costPrice` hay `tracksStock`);
- mọi dòng khác (công lắp, phí, dòng tự do, sản phẩm `tracksStock = false`) ⇒ `unitPriceSnapshot` (lãi dòng = 0, công thức lợi nhuận không nhánh `if`).
- `unitPriceSnapshot` null trên đơn đã chốt là dữ liệu hỏng ⇒ 409, không đoán.
Ghi bằng `tx.orderLineItem.update` theo từng dòng (hoặc `updateMany` gom theo giá trị) — trong `orders.service.ts`. Đơn đã xuất ⇒ không ghi đè (D4 bỏ qua cả bước).

**D7 — Giải phóng `reserved` = ghi movement âm đúng bằng phần ĐANG giữ cho đơn này.**
Trong primitive, sau khoá `products`: với mỗi sản phẩm xuất, `giu = SUM(stock_movements.qty WHERE order_id = đơn AND stock_item_id = …)`; `giu > 0` ⇒ `tx.stockMovement.create({ qty: -giu, type: 'xuat', orderId, orderVersionId, stockItemId })`; `giu <= 0` ⇒ không ghi. KHÔNG trừ theo `qty` xuất (ledger rỗng hôm nay ⇒ trừ theo qty sẽ làm `reserved` âm). Hôm nay ⇒ không movement nào; lane DB tự seed một movement dương bằng SQL thô để chứng minh nhánh này. Ghi chú cho 6.6 vào docstring schema `StockMovement`: thiết kế unique của 6.6 phải chừa dòng `type = 'xuat'`.

**D8 — Event `StockIssued`, publish SAU commit, đúng một lần.**
`backend/src/inventory/domain/stock-issued-event.ts` (khuôn `stock-voucher-events.ts`): `type = 'StockIssued'`, `actorAccountId` = người xác nhận, `target { type: 'StockVoucher', id }`, `after { id, ma, orderId, orderVersionId, lines: [{ productId, qty, unitCost, onHandTruoc, onHandSau, reservedGiaiPhong }] }`, `occurredAt`. Primitive DỰNG event và trả về (không publish — nó không biết khi nào commit); `OrdersService` publish SAU commit. Cửa (a): `StatusChanged` trước, `StockIssued` sau. Không tạo phiếu (đã xuất / không dòng tồn) ⇒ không `StockIssued`. KHÔNG publish thêm `StockVoucherCreated` cho phiếu gắn đơn (một hành động, một dòng audit nghiệp vụ). KHÔNG `StockOutBlocked` (6.5).

**D9 — Quyền.**
- Cửa (b) + GET xem trước: `@RequirePermissions(PERM.inventoryManage)` cho POST; GET dùng `@RequireAnyPermissions(PERM.inventoryManage, PERM.deliveryConfirm)` (màn Chuyển trạng thái của người giao hàng phải thấy được sẽ xuất gì). Phạm vi đơn: `findScopedOrThrow` (luật dự án (1)) — `KHO_GIAO` chỉ có `orders.view_own` ⇒ chỉ đơn mình sở hữu/được giao; ngoài phạm vi ⇒ 404 cùng thông điệp.
- Cửa (a): `xong_giao` đòi `delivery.confirm` (bảng). Đơn CÒN dòng theo dõi tồn CHƯA xuất ⇒ thêm `inventory.manage`; thiếu ⇒ **403** `'Xác nhận Đã giao sẽ xuất kho — cần quyền nhập/xuất kho.'`, kiểm ở pre-check (TRƯỚC upload R2, khuôn bước 3 `chuyenTrangThaiThuCong`) VÀ lặp lại trong tx (đơn có thể bị xuất/thay đổi giữa hai lúc). Preset thật đều có cả hai key; ca tách chỉ xảy ra khi tick tay. `buocKeTiep()` KHÔNG đổi (hàm thuần đọc bảng).

**D10 — Thiếu tồn ⇒ 409 giống hệt 6.3, rollback TOÀN BỘ (kể cả transition và snapshot).**
Tách bộ kiểm tồn của `taoPhieu` thành hàm private dùng chung trong `stock-vouchers.service.ts` (DRY — cùng `message` `'Không đủ tồn — không thể xuất quá số tồn hiện có.'`, cùng `code` `INSUFFICIENT_STOCK`); `field` của phiếu gắn đơn là `dong.{i}.qty` với `i` theo thứ tự chuẩn D5 (client không gửi dòng). Cửa (a) bị chặn ⇒ đơn KHÔNG sang `dagiao`, không hàng `Attachment` nào (rollback cùng tx); ảnh đã lên R2 thành mồ côi — cùng đánh đổi với mọi transition bị từ chối trong tx hiện nay, không xử lý ở đây.

**D11 — Đọc xé (`GET /stock-items`, handoff 6.2): đọc trong MỘT transaction `REPEATABLE READ` dạng mảng.**
`stock-items.service.ts`: `this.prisma.$transaction([findMany…, groupBy…], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })` — hai câu thấy cùng một ảnh chụp. Giữ nguyên hai câu query hiện có (không viết lại SQL). Nới guard (b) CÓ CHỦ ĐÍCH và hẹp: file đọc được phép `$transaction([` chỉ khi có `RepeatableRead` và KHÔNG có lệnh ghi nào (Task 6).

**D12 — Đơn chỉ-thiết-bị đóng thẳng `dachot → hoan_thanh` (QUYẾT ĐỊNH ĐẠI CA 2026-10-21 — thay Câu hỏi mở 1).**
Đơn có cờ Thiết bị đi được cạnh `dachot → hoan_thanh` (`allowed-transition.ts`, `paymentsRecord`) — đường duy nhất ra khỏi vòng đời mà không qua bước xuất kho nào.
- **(a)** Cửa xuất kho riêng nhận THÊM `dachot` ⇒ kho xuất cho đơn này trước khi đóng (`STOCK_ISSUE_STATUSES`; `canIssue` của GET xem trước theo cùng tập).
- **(b)** Cạnh `dachot → hoan_thanh` bị CHẶN 409 `'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.'` khi version hiệu lực có dòng theo dõi tồn mà đơn chưa có phiếu xuất. Đơn không có dòng theo dõi tồn (hoặc đã xuất) vẫn đóng thẳng. Kiểm TRONG tx, ngay SAU `lockOrderRow` trong `applyTransition` (đọc lại đơn trong tx để lấy `currentVersionId` đã commit, rồi `StockVouchersService.lockTrackedProductsInTx` khoá `products … ORDER BY id FOR UPDATE` trước khi đọc `tracksStock` — thứ tự `orders → products` của D2). Đặt ở engine ⇒ phủ MỌI lane: thủ công (`chuyen-trang-thai`) VÀ auto tất toán (`chuyenTrangThaiTuDong`, 7.2). Lane thủ công có thêm pre-check thuần TRƯỚC upload R2 (cùng khuôn D9).
- **Hệ quả phải chặn kèm:** xuất ở `dachot` rồi `mo_lai` sẽ sinh version mới ⇒ phiếu cũ mồ côi theo `(orderId, orderVersionId)` và mở đường xuất lần hai. ⇒ `revise()` từ chối 409 `'Đơn đã xuất kho — không mở lại để sửa được.'` khi đơn đã có phiếu xuất, kiểm trong tx sau khoá đơn của engine. Giữ đúng bất biến "một đơn một phiếu" (D4/AC gốc).
- Huỷ đơn `dachot` đã xuất: như huỷ `dacoc` đã xuất từ trước — trả hàng là 6.7 (`OrderCancelled`).

### 3. Phạm vi — cái gì CỦA 6.4, cái gì KHÔNG

| Việc | Story |
|---|---|
| Cột `orderId`/`orderVersionId` + unique + CHECK; primitive xuất trong tx; snapshot giá vốn; giải phóng `reserved`; `StockIssued`; cửa (a)+(b)+GET xem trước; sửa đọc xé; UI đơn + màn Phiếu kho hiện "gắn đơn" | **6.4** |
| Event `StockOutBlocked` + banner chặn UX-DR-19 + cảnh báo tồn ở báo giá | 6.5 |
| Ghi `StockMovement` giữ chỗ lúc chốt/re-chốt | 6.6 |
| Phiếu nhập trả khi huỷ đơn đã xuất (subscribe `OrderCancelled`) | 6.7 |
| Màn Tồn kho nút "Phiếu xuất · gắn đơn" chọn đơn từ kho (mockup `:3819-3880`) | KHÔNG làm — lối vào duy nhất là từ Đơn (lệch có chủ đích) |
| Xuất từng phần / cột "Đếm thực tế" nhập số đếm (mockup `:2080`) | KHÔNG làm — xuất đủ một lần (câu hỏi mở 3) |

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:577-582`)

- **Given** một Đơn có cờ Vận chuyển/Thi công, **When** tạo phiếu xuất, **Then** **MỘT Đơn chỉ có MỘT phiếu xuất** (unique trên `(orderId, orderVersionId)`), phiếu xuất tạo được từ các Dòng vật tư của Đơn và gắn `orderId` (FR-26, §2).
- **Given** tạo phiếu xuất và xác nhận (gắn transition "Đã giao"), **When** xuất kho, **Then** **snapshot `OrderLineItem.costPriceSnapshot`** = giá vốn lúc XUẤT KHO, không phải lúc chốt — lý do: Đại Ca cho chốt khi thiếu tồn, giá vốn lúc chốt là giá hàng **chưa mua**; giá bán snapshot lúc chốt (lời hứa), giá vốn snapshot lúc xuất (sự thật) (§4).
- **Given** phiếu xuất gắn đơn, **When** lưu + xác nhận, **Then** ghi Audit + liên kết đơn truy được; publish `StockIssued` event (FR-26, AD-18).

> "Đơn có cờ Vận chuyển/Thi công" (FR-26) được hiện thực bằng trạng thái + dữ liệu (D4/D5): bước Đã giao chỉ tồn tại cho đơn có cờ Thiết bị (6.1, quyết định khách 2026-07-10), cấp vật tư thi công qua cửa (b) ở `thicong`/`dacoc`. Không thêm kiểm cờ thứ hai ngoài bảng transition.

### AC dẫn xuất (đo được)

1. **Schema + migration** `backend/prisma/migrations/<ts>_add_stock_voucher_order_link/` (timestamp > `20261021090000`):
   - `stock_vouchers` thêm `order_id` Text NULL FK → `orders` RESTRICT, `order_version_id` Text NULL FK → `order_versions` RESTRICT; `@@unique([orderId, orderVersionId])` (Postgres: nhiều cặp NULL hợp lệ — phiếu tự do không đụng unique); index `order_id` (unique đã phủ — không thêm index thừa).
   - CHECK thêm tay: `stock_vouchers_order_pair CHECK ((order_id IS NULL) = (order_version_id IS NULL))`, `stock_vouchers_order_only_xuat CHECK (order_id IS NULL OR type = 'xuat')`.
   - Quan hệ ngược `Order.stockVouchers`, `OrderVersion.stockVouchers`. Docstring `///` ở model: phiếu gắn đơn = phiếu xuất do cửa xuất kho của Đơn tạo, `createdBy` = người xác nhận; CHECK chỉ có trong SQL; ghi chú D7 cho 6.6 ở `StockMovement`.
   - `prisma validate` + `generate` xanh; `migrate deploy` lên Postgres local 5433 sạch; guard (a) "không cột reserved" vẫn xanh.
2. **Domain thuần:**
   - `orders/domain/gia-von-snapshot.ts` — `giaVonSnapshotDong` (D6). Unit: dòng tồn ⇒ giá vốn sản phẩm; công lắp / dòng tự do / `tracksStock=false` ⇒ `unitPriceSnapshot`; giá vốn 0 hợp lệ (không coi 0 là "vắng").
   - `inventory/domain/stock-issued-event.ts` — `StockIssued` (D8), snapshot kiểu domain thuần, không type Prisma.
   - Gom dòng + thứ tự chuẩn (D5) là MỘT hàm thuần (`inventory/domain/`, vd `dongXuatTuDon(lines, sanPhamTheoDoiTon)`), dùng chung cho GET xem trước và primitive. Unit: gộp hai dòng cùng sản phẩm, loại dòng không `productId`, loại `tracksStock=false`, thứ tự `ten` rồi `productId`.
3. **Primitive** `StockVouchersService.xuatKhoChoDonTrongTx(tx, { orderId, orderVersionId, dongDon: [{ productId, ten, qty }], actorAccountId, occurredAt })` → `{ phieu: StockVoucherDetail | null, giaVonTheoSanPham: Map<string, number>, event: StockIssued | null }`:
   - `dongDon` = MỌI dòng có `productId` của version hiệu lực (orders KHÔNG tự lọc `tracksStock` — cờ đọc dưới khoá ở đây, D5).
   - Lệnh ĐẦU TIÊN trên `tx`: khoá `products … = ANY(ids) ORDER BY id FOR UPDATE` (cùng câu 6.3). Số dòng khoá ≠ số sản phẩm ⇒ 404.
   - Đọc `product` (+`stockItem`) SAU khoá; lọc `tracksStock`, gom + sắp bằng hàm thuần AC-2. Không dòng tồn ⇒ trả `{ phieu: null, giaVonTheoSanPham: rỗng, event: null }`, KHÔNG ghi gì.
   - Kiểm tồn (D10) TRƯỚC mọi lệnh ghi; upsert `onHand` mới; giải phóng `reserved` (D7); `tx.stockVoucher.create({ type: 'xuat', orderId, orderVersionId, createdByAccountId, note: null, lines: { create: … unitCost = product.costPrice } })`. KHÔNG `product.update` (xuất không đổi bình quân). `giaVonTheoSanPham` = `productId → costPrice` của đúng các sản phẩm theo dõi tồn.
   - Primitive GIẢ ĐỊNH chưa xuất: kiểm "đã xuất" là việc của `OrdersService` (qua method đọc `timPhieuXuatCuaDon(client, orderId, orderVersionId)` của cùng service, nhận `tx` hoặc `this.prisma`) SAU khoá đơn, TRƯỚC khi gọi primitive. Unique DB là lưới cuối — P2002 nổ 500 là đúng (khoá đơn đã tuần tự hoá, tới được đó là lỗi lập trình, không phải nhánh nghiệp vụ).
   - KHÔNG mở `$transaction`, KHÔNG publish, KHÔNG ghi bảng đơn, KHÔNG gọi `this.prisma.*` bên trong.
4. **Cửa (b)** `POST /orders/:id/xuat-kho` (`ParseUUIDPipe`, không body) — controller ở `orders.controller.ts`, method `OrdersService.xuatKho(callerAccountId, quyen, orderId)`:
   - `findScopedOrThrow` ĐẦU TIÊN (guard `no-unscoped-order-write`); trạng thái ngoài `{dacoc, danggiao, thicong}` ⇒ 409 (pre-check, trước tx).
   - `$transaction(async (tx) => …)`: `lockOrderRow` → đọc lại đơn trong tx (`findOrThrowIn`) + kiểm lại trạng thái → `timPhieuXuatCuaDon` có ⇒ trả `{ phieu, taoMoi: false }` → đọc dòng version hiệu lực → primitive → `phieu === null` ⇒ 409 không dòng tồn (D5; chưa ghi gì) → snapshot (D6) bằng `giaVonTheoSanPham` → trả `{ phieu, taoMoi: true, event }`.
   - SAU commit: `taoMoi` ⇒ publish `StockIssued` đúng 1 lần ⇒ **201**; không ⇒ **200**, 0 event. Body = `OrderStockIssueResultDto { phieu: StockVoucherDetailDto }` với `unitCost` vắng hẳn khi thiếu `costs.view` (tái dùng `anGiaVonDongPhieu` của 6.3 — `inventory/domain/stock-voucher-visibility.ts`).
   - 401/403 (thiếu `inventory.manage`)/404 (ngoài phạm vi hoặc không tồn tại, cùng thông điệp)/409 (trạng thái, không dòng tồn, thiếu tồn `INSUFFICIENT_STOCK` với `fieldErrors[].field = 'dong.{i}.qty'`).
5. **Cửa (a)** — `chuyenTrangThaiThuCong()` với `event === SU_KIEN.xongGiao`:
   - Pre-check (bước 3 hiện có) mở rộng: đọc đơn đã xuất chưa + có dòng tồn chưa (đọc thuần, ngoài tx) ⇒ cần xuất mà thiếu `inventory.manage` ⇒ 403 (D9) TRƯỚC upload R2.
   - Trong tx, SAU `applyTransition` (đã `lockOrderRow`), TRƯỚC `attachment.createMany`: `xuatKhoNeuChua(tx, order, actor, occurredAt)` — helper private dùng chung với cửa (b) (đã xuất ⇒ null; không dòng tồn ⇒ chỉ snapshot, null; còn lại ⇒ primitive + snapshot, trả event). Lặp kiểm `inventory.manage` trong helper khi thật sự phải xuất.
   - SAU commit: `StatusChanged` rồi `StockIssued` (nếu có) — mỗi loại `toHaveBeenCalledTimes(1)`. Response `StatusChangeResult` giữ nguyên hình dạng (không thêm field — màn đọc lại phiếu qua GET xem trước).
   - Các sự kiện khác của lane thủ công KHÔNG đổi hành vi (không đọc tồn, không gọi inventory) — unit test khẳng định `bat_dau_giao`/`bat_dau_thi_cong`/`xong_thi_cong`/`hoan_thanh` không gọi primitive.
   - `huyDon()` không đổi một chữ (guard `no-stock-write-in-cancel` xanh).
6. **GET xem trước** `GET /orders/:id/xuat-kho` (D9 quyền, `findScopedOrThrow` đầu) ⇒ `200 OrderStockIssueViewDto`:
   - `daXuat: boolean`; `phieu?: StockVoucherDetailDto` (khi đã xuất; `unitCost` lọc theo `costs.view`);
   - `coTheXuat: boolean` — backend tính: chưa xuất ∧ trạng thái ∈ `{dacoc, danggiao, thicong}` ∧ có ≥1 dòng tồn ∧ caller có `inventory.manage` (client KHÔNG suy, AD-2);
   - `dong: [{ productId, ten, sku, donVi, qty, onHand }]` theo thứ tự chuẩn (khi chưa xuất; `onHand` = tồn thật hiện tại, vắng dòng `stock_items` ⇒ 0) — rỗng khi đã xuất;
   - `khongTheoKho: string[]` — tên các dòng không theo kho (mockup: "Công lắp đặt — Không theo kho — không có trong phiếu xuất").
   - Không có `costPrice`, không có tiền nào khác.
7. **Phiếu kho 6.3 hiện liên kết đơn:** `StockVoucherSummaryDto` + `StockVoucherDetailDto` thêm `orderId?: string` (vắng hẳn khi phiếu tự do — khuôn field-vắng của `unitCost`). `POST /stock-vouchers` (phiếu tự do) KHÔNG nhận `orderId` (whitelist bỏ field lạ — e2e khẳng định phiếu tạo ra không có `orderId`). `GET /stock-vouchers` / `:id` không đổi quyền.
8. **Đọc xé (D11):** `stock-items.service.ts` đọc trong tx `RepeatableRead` dạng mảng. Unit: `$transaction` được gọi với mảng 2 phần tử + `isolationLevel: 'RepeatableRead'`. Hành vi `GET /stock-items` không đổi (e2e/test 6.2 xanh nguyên).
9. **Lane DB** `backend/test/order-stock-issue.db.integration.spec.ts` (Postgres 5433, khuôn `stock-vouchers.db.integration.spec.ts`, tự dựng/dọn fixture: account, khách, nguồn, sản phẩm tồn + công lắp, đơn ở `danggiao`/`dacoc`/`thicong` có version + dòng `unitPriceSnapshot`):
   - Cửa (b): `onHand` giảm đúng tổng qty đã gộp; 1 phiếu `type='xuat'` có `order_id`/`order_version_id`; dòng phiếu `unit_cost` = `costPrice` LÚC XUẤT; `costPriceSnapshot` dòng tồn = `unit_cost` đó, dòng công lắp = `unitPriceSnapshot`; trạng thái đơn KHÔNG đổi.
   - **Giá vốn lúc xuất ≠ lúc chốt:** chốt đơn (snapshot giá bán) → phiếu nhập 6.3 làm `costPrice` đổi → xuất ⇒ `costPriceSnapshot` = giá MỚI (số in ra bằng `tinhGiaVonBinhQuan` thật, không nhẩm).
   - Gọi cửa (b) lần hai ⇒ vẫn 1 phiếu, `onHand` trừ một lần, 0 movement thêm.
   - Cửa (a) `danggiao --xong_giao-->` ⇒ đơn `dagiao` + phiếu + snapshot trong cùng commit; đơn `dacoc` tự lấy cũng vậy (cạnh thứ hai vào `dagiao`).
   - Cửa (a) trên đơn đã xuất qua (b) ⇒ chỉ đổi trạng thái, vẫn 1 phiếu.
   - Thiếu tồn (2 sản phẩm: một đủ, một thiếu) qua cửa (a) ⇒ lỗi 409; đơn vẫn `danggiao`, 0 phiếu, `onHand` cả hai nguyên, `costPriceSnapshot` vẫn null, 0 `attachments`.
   - **Unique đứng một mình:** INSERT thô phiếu thứ hai cùng `(order_id, order_version_id)` ⇒ lỗi (assert message chứa tên constraint — memory `prisma7-p2003-only-on-insert`). CHECK `stock_vouchers_order_pair` (chỉ `order_id`) và `stock_vouchers_order_only_xuat` (`type='nhap'` + `order_id`) ⇒ lỗi theo tên.
   - **Giải phóng reserved:** seed thô `stock_movements` +5 cho đơn/sản phẩm ⇒ xuất ⇒ thêm đúng 1 movement `-5`, `type='xuat'`; `SUM` về 0; sản phẩm không có movement ⇒ không dòng nào.
   - **Đồng thời — xen kẽ ÉP BUỘC** (memory `atomic-replace-needs-for-update-lock`): (i) tx thô A giữ `SELECT … FROM orders WHERE id=$1 FOR UPDATE` chưa commit; gọi cửa (b) B (chưa await); commit A; await B ⇒ B xuất bình thường — và hai lời gọi cửa (b) thật chạy song song trên cùng đơn ⇒ đúng 1 phiếu, `onHand` trừ đúng một lần, một bên 201 một bên 200. Đột biến gỡ `lockOrderRow` khỏi đường xuất ⇒ ca này ĐỎ (hoặc nổ P2002 ⇒ 500 — đều là đỏ). (ii) tx thô A giữ khoá `products` + `UPDATE products SET cost_price = X` chưa commit; gọi cửa (b) B; commit A; await B ⇒ `costPriceSnapshot` = X (đọc sau khoá). Đột biến đọc `costPrice` TRƯỚC khoá ⇒ ĐỎ.
   - Phiếu xuất gắn đơn chạy song song phiếu nhập tự do 6.3 cùng sản phẩm ⇒ không deadlock, `onHand` cuối đúng.
   - `GET /stock-items` (service 6.2) phản ánh `onHand` mới và `reserved` đã giải phóng.
10. **Unit (mock Prisma)**:
    - `backend/test/stock-vouchers.service.spec.ts` (mở rộng): primitive — `$queryRaw` khoá là lệnh đầu trên `tx`; không gọi `$transaction`; không gọi `product.update`; thiếu tồn ⇒ không lệnh ghi nào; `reserved` âm/0 ⇒ không movement; trả event đủ field; `taoPhieu` 6.3 vẫn xanh sau khi tách bộ kiểm tồn.
    - `backend/test/order-stock-issue.spec.ts` (mới): cửa (b) thứ tự op — `findScopedOrThrow` trước mọi thứ; `lockOrderRow` là lệnh đầu trong tx, TRƯỚC primitive; snapshot ghi SAU primitive và dùng `giaVonTheoSanPham` của nó; đã xuất ⇒ không gọi primitive, không publish; publish `StockIssued` 1 lần SAU commit; commit lỗi ⇒ 0 event (mock tx CHẠY thân rồi mới ném — memory `mock-rejected-transaction-false-green`). Cửa (a): xong_giao chưa xuất + thiếu `inventory.manage` ⇒ 403 và `storage.putObject` KHÔNG được gọi; thứ tự `applyTransition` → helper → `attachment.createMany`; publish `StatusChanged` rồi `StockIssued`, mỗi cái 1 lần; các sự kiện khác không gọi primitive.
    - `orders/domain/gia-von-snapshot` + hàm gom dòng: spec riêng.
11. **E2E** `backend/test/order-stock-issue.e2e.spec.ts` (`initAppOnLoopback` — luật (6)): `POST /orders/:id/xuat-kho` 201 lần đầu / 200 lần hai (`KHO_GIAO` được giao đơn, body KHÔNG có `unitCost`; `QUAN_LY` có `unitCost`); 403 `THO_KS`; 401; 404 `KHO_GIAO` không sở hữu/không được giao (cùng message với id lạ); 400 id không phải UUID; 409 trạng thái `dachot`; 409 không dòng tồn; 409 thiếu tồn `fieldErrors[0].code === 'INSUFFICIENT_STOCK'` + `field` dạng `dong.N.qty` (mã HTTP chỉ đo ở e2e — memory `dev-pins-ac-deviation-as-green-test`). `GET /orders/:id/xuat-kho`: 200 với `delivery.confirm` không `inventory.manage` (`coTheXuat: false`), 403 khi thiếu cả hai, `daXuat`/`phieu` sau khi xuất. Cập nhật e2e `xong_giao` sẵn có ở `orders.e2e.spec.ts:3816-3990` (mock giờ cần dòng/tồn) — KHÔNG xoá ca nào, thêm ca 403 thiếu `inventory.manage` khi còn dòng tồn chưa xuất và ca 409 thiếu tồn (đơn KHÔNG sang `dagiao`). `POST /stock-vouchers` kèm `orderId` ⇒ 201, phiếu không có `orderId`.
12. **Source-guard:**
    - `inventory-read-only.spec.ts` (b): `stock-items.service.ts` được phép đúng `$transaction([` + `RepeatableRead`, vẫn cấm mọi lệnh ghi và dạng interactive; mẫu tự kiểm cho cả nhánh tha lẫn nhánh bắt; chống rỗng giữ nguyên. (c) xanh nguyên (primitive không ghi bảng đơn).
    - `no-unscoped-order-write.spec.ts`: hai method mới (`xuatKho`, `xemXuatKho`) được máy quét nhận là "chạm đơn" và đi qua phạm vi trước — thêm vào assert "nhận diện ĐỦ các đường" để guard không xanh giả.
    - Guard sẵn có xanh: `no-stock-write-in-cancel`, `no-order-status-write-outside-transition`, `no-handler-without-require-permissions`, `naming-convention`, `no-permission-literal-outside-registry`, `no-direct-side-effect-outside-eventbus`, `audit-log-append-only`, `orders-module-wiring` (sửa nếu nó khẳng định danh sách `imports`).
13. **OpenAPI** sinh lại (`npm run openapi:gen`), `openapi.json` commit, `openapi-drift.spec.ts` xanh. `orderId`/`phieu`/`unitCost` khai `@ApiPropertyOptional` + mô tả điều kiện vắng mặt.
14. **Web:**
    - `OrdersPort` (`web/src/design-system/session/orders-port.ts`) thêm `xemXuatKho(orderId)` + `xuatKho(orderId)`; kiểu `OrderStockIssueView`, `OrderStockIssueResult` mirror DTO từng chữ (đối chiếu `openapi.json`); `StockVoucherDetail`/`Summary` (`stock-vouchers-port.ts`) thêm `orderId?`. Fake: đơn chưa xuất có dòng tên DÀI NHẤT + một dòng thiếu tồn; đơn đã xuất (phiếu không `unitCost`); `xuatKho` fake có nhánh 409 `INSUFFICIENT_STOCK`.
    - `OrderStatusChangeScreen.tsx`: khi bước được chọn là `xong_giao` ⇒ gọi `xemXuatKho` và hiện khối mockup `:2073-2090`: notecard "Đây là **lần duy nhất** đơn này trừ tồn kho. Một Đơn — một phiếu xuất. Đếm hàng thực tế trước khi xác nhận."; `Table` `Sản phẩm | Đơn cần | Tồn thật` (số `num mono`); dòng `khongTheoKho` "Không theo kho — không có trong phiếu xuất"; nút chính đổi chữ thành "Xác nhận xuất kho & chuyển Đã giao". `daXuat` ⇒ thay khối bằng "Đã xuất kho · {ma}" và giữ nút "Xác nhận chuyển". 409/403 ⇒ `Banner` danger với `message` + lỗi dưới đúng dòng (map `dong.{i}.qty` theo thứ tự `dong`). Client KHÔNG so `qty` với `onHand`, không tô đỏ dòng tự suy.
    - `OrderDetailScreen.tsx`: `Frame` "Phiếu xuất" (chỉ khi caller có `inventory.manage` hoặc `delivery.confirm` — theo `PERM` sẵn có): đã xuất ⇒ mã `mono` + ngày (`format-gio.ts` 6.3) + người xác nhận + bảng dòng (giá vốn chỉ khi field có); chưa xuất ∧ `coTheXuat` ⇒ nút "Xuất kho" mở `Sheet` cùng bảng xem trước + notecard + nút "Xác nhận xuất kho" (disabled khi đang gửi — gọi port đúng 1 lần khi bấm 2 lần); thành công ⇒ tải lại khối. Chưa xuất ∧ không `coTheXuat` ⇒ một dòng micro muted "Chưa xuất kho.".
    - `StockVouchersScreen.tsx` (6.3): chi tiết phiếu có `orderId` ⇒ `Loại` "Xuất kho · gắn đơn", thêm dòng `Gắn đơn` (định danh đơn theo cách `OrdersListScreen` đang hiện), nhãn `Người tạo` đổi thành `Người xác nhận`, notecard "**Một Đơn — một phiếu xuất.** Lúc xác nhận, giá vốn được đóng băng vào từng dòng đơn. Audit ghi người xác nhận. Không sửa/xoá sau khi lưu." (mockup `:4000-4011`); phiếu tự do giữ "Xuất kho · không gắn đơn".
    - Không màn mới ⇒ `SCREEN_COUNT` không đổi. Test vitest+jsdom: `web/src/test/order-stock-issue.test.tsx` (mới) — xong_giao hiện bảng xem trước + đổi chữ nút; `daXuat` hiện mã phiếu; 409 hiện thông điệp + lỗi đúng dòng; nút Xuất kho chống double-submit; chi tiết phiếu gắn đơn hiện "Gắn đơn" + "Người xác nhận", phiếu tự do không. Fixture tên DÀI NHẤT. `cd web && npm run typecheck && npm test && npm run build` xanh (luật (3)).
15. **Mobile** (parity, cùng câu chữ/luật lỗi): `orders_port.dart` + `fake_orders_port.dart` thêm hai method + kiểu; `stock_vouchers_port.dart` thêm `orderId`; `order_status_change_screen.dart` khối xuất kho khi `xong_giao`; `order_detail_screen.dart` `AppFrame` "Phiếu xuất" + `AppSheet`; `stock_vouchers_screen.dart` chi tiết gắn đơn. Widget test (luật (4)) ở `mobile/test/screens/orders/order_stock_issue_test.dart`: các nhánh như web + `for width in [320, 360]` tên sản phẩm DÀI NHẤT ⇒ `tester.takeException()` null; fixture bật đủ điều kiện bao ngoài (memory `widget-test-gate-unreachable-outer-condition`); finder `AppFrame` dùng chuỗi HOA. Màn mobile dùng `AppPermissionKeys.*`, không `AppPerm.*` (memory `mobile-screens-use-apppermissionkeys-not-appperm`). `flutter analyze` + `flutter test` xanh.
16. **Parity + text-guard:** `design-system/session/parity.test.mjs` — hai method mới khớp chữ ký hai bên + mọi field kiểu mới có mặt hai bên + đối chiếu `openapi.json`. Text-guard `design-system/screens/stock-issue.test.mjs` (khuôn `stock-vouchers.test.mjs`) trên code đã strip comment của các khối/màn đụng tới: cấm so `qty`/`onHand` (client không tự chặn), cấm nhân/chia trên `qty`/`unitCost`/`onHand`, cấm `costPrice` trong port/màn, cấm hex/`Color(0x`; `assertCodeNotBlind(...)` + mẫu tự kiểm mỗi luật (luật (5)). `design-system/screens/order-transition.test.mjs` vẫn xanh. `cd design-system && npm test` xanh.
17. **Đơn chỉ-thiết-bị — xuất ở `dachot` (D12a):** `POST /orders/:id/stock-issue` trên đơn `dachot` ⇒ 201, phiếu gắn đơn, snapshot giá vốn, trạng thái KHÔNG đổi; `GET` ⇒ `canIssue: true` (có `inventory.manage`). Unit + e2e + lane DB. Web/mobile: màn Chi tiết đơn `dachot` hiện nút "Xuất kho" (theo `canIssue` backend — client không lọc trạng thái).
18. **Chặn đóng thẳng khi chưa xuất (D12b):**
    - `dachot --hoan_thanh-->` với dòng theo dõi tồn chưa xuất ⇒ **409** `CONFLICT` message nguyên văn; `Order.status` không ghi, 0 event. Lane thủ công: pre-check TRƯỚC R2 (0 upload, không mở tx). Engine: kiểm lại SAU `lockOrderRow`, đọc lại `currentVersionId` trong tx, khoá `products` rồi mới đọc `tracksStock`. Lane auto (`chuyenTrangThaiTuDong`) cũng bị chặn.
    - Đã xuất ⇒ đóng được (200 `hoanthanh`); không dòng theo dõi tồn ⇒ đóng thẳng; các cạnh khác vào `hoanthanh` (`nghiemthu`, `dagiao`) không chạy kiểm này.
    - `mo_lai` đơn đã xuất ⇒ 409 `'Đơn đã xuất kho — không mở lại để sửa được.'`, không version mới.
    - Lane DB: chặn + đóng sau khi xuất + đóng thẳng không dòng tồn + auto lane + **xen kẽ ÉP BUỘC** (i) tx khác giữ khoá đơn và chèn phiếu chưa commit ⇒ lệnh đóng chờ, thấy phiếu, đóng được (đột biến kiểm trước khoá đơn ⇒ ĐỎ); (ii) tx khác giữ khoá `products` và bật `tracks_stock` chưa commit ⇒ lệnh đóng (pre-check đã qua) chờ, đọc dưới khoá ⇒ 409 (đột biến bỏ khoá `products`/bỏ kiểm trong tx ⇒ ĐỎ) + `mo_lai` đơn đã xuất.
    - Web/mobile: màn Chuyển trạng thái đơn `dachot` chưa xuất ⇒ `Banner`/`AppBanner` danger hiện đúng message backend, không `onDone`; sau khi xuất ⇒ đóng được. Fake port đóng vai backend (bước `hoan_thanh` ở `dachot`, 409 khi chưa xuất, 409 `mo_lai` khi đã xuất).

---

## Tasks / Subtasks

- [x] **Task 1 — Schema + migration (AC: 1)**
  - [x] `StockVoucher` thêm `orderId`/`orderVersionId` + relation tường minh (khuôn `"StockVoucherCreatedBy"`) + `@@unique([orderId, orderVersionId])`; `Order.stockVouchers`, `OrderVersion.stockVouchers`; docstring D3/D7.
  - [x] SQL offline `npx prisma migrate diff --from-schema <schema cũ> --to-schema prisma/schema.prisma --script` (Prisma 7 — memory `prisma7-migrate-diff-flag-rename`), THÊM TAY 2 CHECK. Đọc lại: FK RESTRICT, unique.
  - [x] `npx prisma validate && npx prisma generate`; `npx prisma migrate deploy` lên `pns-postgres` cổng 5433 (tắt ⇒ `docker start pns-postgres`; daemon không lên ⇒ ghi "lane DB chưa chạy", KHÔNG đánh `[x]` — memory `db-lane-needs-docker-desktop-gui`). KHÔNG ghi lên DB nào khác.
- [x] **Task 2 — Domain (AC: 2)** — `orders/domain/gia-von-snapshot.ts`, `inventory/domain/stock-issued-event.ts`, hàm gom dòng ở `inventory/domain/`; spec thuần.
- [x] **Task 3 — Primitive inventory + module (AC: 3, 7, 8)**
  - [x] Tách bộ kiểm tồn dùng chung; `xuatKhoChoDonTrongTx`; method đọc `timPhieuXuatCuaDon(tx, orderId, orderVersionId)`; mở rộng docstring "HỢP ĐỒNG KHOÁ" (D2).
  - [x] DTO phiếu thêm `orderId?` (summary + detail + mapping `tomTat`/`chiTiet`).
  - [x] `stock-items.service.ts` đọc trong tx `RepeatableRead` (D11).
  - [x] `inventory.module.ts` `exports: [StockVouchersService]` + docstring.
- [x] **Task 4 — Orders: hai cửa + GET (AC: 4, 5, 6)**
  - [x] `orders.module.ts` import `InventoryModule` + docstring (lý do; inventory không được import ngược). Đoạn docstring `exports` hiện nói "`inventory/` (6.x) phải đổi trạng thái đơn" — sửa: xuất kho đi theo chiều ngược (orders gọi inventory trong tx của mình, D1); `exports: [OrdersService]` vẫn giữ cho `payments/` (7.2). `orders-module-wiring.spec.ts` ("CHỈ OrdersService được export") phải xanh nguyên.
  - [x] `OrdersService`: helper private `xuatKhoNeuChua`; `xuatKho`, `xemXuatKho` (công khai, `findScopedOrThrow` đầu); mở rộng `chuyenTrangThaiThuCong` cho `xong_giao` (pre-check quyền + gọi helper trong tx). Docstring cập nhật khối `KHOÁ DÒNG` + `:1683`.
  - [x] DTO `orders/dto/order-stock-issue-*.dto.ts` (view, result, dòng); controller `@Get(':id/xuat-kho')` `@RequireAnyPermissions(...)`, `@Post(':id/xuat-kho')` `@RequirePermissions(PERM.inventoryManage)` + `@HttpCode` động (201/200 — dùng `@Res({ passthrough: true })` set status hoặc tách mã theo `taoMoi`; giữ controller không dựng envelope); `canViewCosts` theo khuôn `products.controller.ts:47-67` (OrdersModule đã import `AccountsModule`). `@ApiOkResponse/@ApiCreatedResponse/@ApiForbiddenResponse/@ApiNotFoundResponse/@ApiConflictResponse` với `ErrorEnvelopeDto`.
  - [x] Unit `order-stock-issue.spec.ts` + mở rộng `stock-vouchers.service.spec.ts` + `stock-items.service.spec.ts`.
- [x] **Task 5 — E2E + lane DB (AC: 9, 11)** — `order-stock-issue.e2e.spec.ts`, cập nhật `orders.e2e.spec.ts` (xong_giao), `order-stock-issue.db.integration.spec.ts` (tên `*.db.integration.spec.ts` — memory `describe-skip-does-not-separate-test-lane`); `order-status-change.db.integration.spec.ts:327` (xong_giao thật) phải xanh — đơn fixture có dòng tồn thì cần tồn đủ. `npm run test:db`.
- [x] **Task 6 — Guard (AC: 12)** — sửa `inventory-read-only.spec.ts` (b) + docstring; `no-unscoped-order-write.spec.ts` thêm hai method vào assert nhận diện. Đột biến bằng `cp` backup (KHÔNG `git checkout` — memory `mutation-test-never-git-checkout`), mutant phải compile (memory `mutation-must-compile-or-false-red`): (i) thêm `this.prisma.stockItem.update(...)` vào `stock-items.service.ts` ⇒ guard ĐỎ; (ii) đổi tx RepeatableRead sang interactive ⇒ ĐỎ; (iii) `xuatKho` đọc `this.findOrThrow` thay vì `findScopedOrThrow` ⇒ `no-unscoped-order-write` ĐỎ; (iv) primitive ghi `tx.orderLineItem.update` ⇒ guard (c) ĐỎ.
- [x] **Task 7 — OpenAPI (AC: 13)** — `npm run openapi:gen`, commit `backend/openapi/openapi.json`.
- [x] **Task 8 — Web (AC: 14)** — port + fake + kiểu; `OrderStatusChangeScreen`, `OrderDetailScreen`, `StockVouchersScreen`; test; ba lệnh web (memory `web-tsx-syntax-error-passes-all-lanes`: typecheck phải chạy thật).
- [x] **Task 9 — Mobile (AC: 15)** — port + fake; ba màn; widget test. Format chỉ file mình viết hoặc `dart format -o none` (memory `dart-format-writes-files-cascade`). `flutter analyze && flutter test`.
- [x] **Task 10 — Parity + text-guard + docs (AC: 16)** — `parity.test.mjs`, `stock-issue.test.mjs`; đột biến: chèn `if (d.qty > d.onHand)` vào màn web ⇒ ĐỎ; mobile `qty * unitCost` ⇒ ĐỎ; stripper trả rỗng ⇒ ĐỎ. ERD `ARCHITECTURE-SPINE.md`: `STOCK_VOUCHER.orderId` + `orderVersionId` "unique cặp — một đơn một phiếu", BỎ `status` (ghi "không có phiếu nháp: tạo = xác nhận"). Không sửa `prd.md`, `epics.md`, mockup.
- [x] **Task 11 — Cổng cuối** — backend `npx tsc --noEmit` + `npm test` + `npm run test:db`; lint chỉ file mình viết (baseline đỏ sẵn — memory `backend-lint-red-at-baseline`); web 3 lệnh; mobile 2 lệnh; design-system `npm test`. Ghi số suite/test từng lane + bảng đột biến → suite đỏ vào Completion Notes. Đột biến bắt buộc (mutate MỌI dòng anh em — memory `mutation-one-row-sibling-guard-untested`): gỡ `lockOrderRow` khỏi đường xuất; đọc `costPrice` trước khoá `products`; snapshot dòng công lắp bằng 0 thay vì `unitPriceSnapshot`; bỏ kiểm "đã xuất"; bỏ pre-check `inventory.manage` ở cửa (a) (riêng) và kiểm lặp trong helper (riêng); giải phóng theo `qty` thay vì theo `SUM`; publish `StockIssued` trước commit; gọi primitive cho `bat_dau_giao`. Mutant tương đương ngữ nghĩa ⇒ gỡ khỏi bảng thay vì đổ cho test (memory `mutation-semantically-equivalent-false-survivor`).

- [x] **Task 12 — Quyết định Đại Ca 2026-10-21: đơn chỉ-thiết-bị (AC: 17, 18)**
  - [x] `STOCK_ISSUE_STATUSES` thêm `dachot` (cửa riêng + `canIssue`).
  - [x] `applyTransition`: cạnh `dachot → hoanthanh` gọi `assertNoUnissuedStockInTx` SAU `lockOrderRow`, TRƯỚC cổng `updateMany`; primitive đọc `StockVouchersService.lockTrackedProductsInTx` (khoá `products` cùng câu lệnh, rồi đọc `tracksStock`).
  - [x] `chuyenTrangThaiThuCong`: pre-check trước R2 cho cùng cạnh.
  - [x] `revise()`: 409 khi đơn đã có phiếu xuất (trong tx, sau khoá của engine).
  - [x] Test: unit (`order-stock-issue.spec.ts` +12, `stock-vouchers.service.spec.ts` +2, stub stock ở `orders.service.spec.ts`), e2e (+8), lane DB (+7, gồm 2 ca xen kẽ ép buộc), web (+3), mobile (+3). OpenAPI mô tả 409 cập nhật + sinh lại. Spine AD-19 ghi quyết định.

---

## Dev Notes

### Files sẽ đổi

| File | Loại |
|---|---|
| `backend/prisma/schema.prisma` | UPDATE — `StockVoucher` + quan hệ ngược `Order`, `OrderVersion` |
| `backend/prisma/migrations/<ts>_add_stock_voucher_order_link/migration.sql` | NEW (diff + 2 CHECK thêm tay) |
| `backend/src/inventory/stock-vouchers.service.ts` | UPDATE — primitive, bộ kiểm tồn chung, `timPhieuXuatCuaDon`, `orderId` trong view |
| `backend/src/inventory/stock-items.service.ts` | UPDATE — tx `RepeatableRead` |
| `backend/src/inventory/inventory.module.ts` | UPDATE — export |
| `backend/src/inventory/domain/{stock-issued-event,<gom-dong>}.ts` | NEW |
| `backend/src/inventory/dto/stock-voucher-response.dto.ts` | UPDATE — `orderId?` |
| `backend/src/orders/orders.service.ts` | UPDATE — helper + 2 method + mở rộng `chuyenTrangThaiThuCong` |
| `backend/src/orders/orders.controller.ts`, `orders.module.ts` | UPDATE |
| `backend/src/orders/domain/gia-von-snapshot.ts` | NEW |
| `backend/src/orders/dto/order-stock-issue-*.dto.ts` | NEW |
| `backend/openapi/openapi.json` | UPDATE (sinh) |
| `backend/test/{order-stock-issue.spec,order-stock-issue.e2e.spec,order-stock-issue.db.integration.spec,gia-von-snapshot.spec}.ts` | NEW |
| `backend/test/{stock-vouchers.service.spec,stock-items.service.spec,orders.e2e.spec,inventory-read-only.spec,no-unscoped-order-write.spec}.ts` | UPDATE |
| `web/src/design-system/session/{orders-port,fake-orders-port,stock-vouchers-port,fake-stock-vouchers-port}.ts` | UPDATE |
| `web/src/screens/orders/{OrderStatusChangeScreen,OrderDetailScreen}.tsx` (+ css nếu cần), `web/src/screens/inventory/StockVouchersScreen.tsx` | UPDATE |
| `web/src/test/order-stock-issue.test.tsx` | NEW |
| `mobile/lib/design_system/session/{orders_port,fake_orders_port,stock_vouchers_port,fake_stock_vouchers_port}.dart` | UPDATE |
| `mobile/lib/screens/orders/{order_status_change_screen,order_detail_screen}.dart`, `mobile/lib/screens/inventory/stock_vouchers_screen.dart` | UPDATE |
| `mobile/test/screens/orders/order_stock_issue_test.dart` | NEW |
| `design-system/session/parity.test.mjs`, `design-system/screens/stock-issue.test.mjs` | UPDATE / NEW |
| `ARCHITECTURE-SPINE.md` (ERD) | UPDATE |

**Không đổi:** `huyDon()` (guard), `allowed-transition.ts` (bảng, `SU_KIEN_THU_CONG`, `buocKeTiep` — nguyên vẹn), `confirm()`/`revise()` (giữ chỗ là 6.6; `revise` vẫn đặt `costPriceSnapshot: null` cho version mới — đúng, version mới chưa xuất), `permission-registry.ts`/`role-presets.ts`/`permissions.json`/`PERM`/`AppPerm` (dùng key sẵn có), `ErrorCode` chung (mã domain chỉ ở `fieldErrors[].code`), `taoPhieu` 6.3 về hành vi, `catalog/**`, `Sidebar`.

### Hiện trạng phải giữ

- `applyTransition` vẫn tự `lockOrderRow` (`:533`); cửa (a) gọi helper SAU nó trong cùng tx ⇒ khoá đơn đã cầm, primitive khoá `products` sau (D2). Cửa (b) tự `lockOrderRow` vì không có transition.
- `chuyenTrangThaiThuCong` giữ đủ 7 bước của docstring (`:630-646`); bước mới chen vào bước 3 (pre-check) và bước 6 (trong tx). Một `occurredAt` cho cả lượt — truyền cùng biến vào `StockIssued`.
- `StockItem` sinh lười: primitive dùng `upsert` như 6.3 (xuất mà chưa có dòng ⇒ kiểm tồn đã chặn vì `onHand = 0`).
- Khả dụng 6.2 = `onHand − SUM(movement)`: xuất gắn đơn trừ `onHand` VÀ giải phóng đúng phần giữ ⇒ khả dụng không đổi cho đơn đã được giữ chỗ (đúng nghĩa: hàng đã hứa nay rời kho).
- `AuditSubscriber` ghi mọi event; lỗi audit bị bus cô lập (không rollback) — đúng AD-18.
- `revise()` chỉ từ `dachot` ⇒ sau `dacoc` version không đổi ⇒ unique `(orderId, orderVersionId)` tương đương "một đơn một phiếu" trong mọi luồng hiện có.

### Lệch mockup / spine có chủ đích (để reviewer không gắn cờ)

- Không cột `status` trên `StockVoucher`, không phiếu nháp (D3) — ERD sửa theo.
- Không cột "Đếm thực tế" để nhập số đếm (mockup `:2080`) — xuất đủ; notecard dặn đếm hàng.
- Không nút "Phiếu xuất · gắn đơn" ở màn Tồn kho (mockup `:3819-3880`) — lối vào từ Đơn; banner CHẶN của modal đó là 6.5.
- Mã đơn `DH-2048` của mockup: hệ thống chưa có mã đơn hiển thị — dùng định danh đơn như `OrdersListScreen` đang dùng.
- `fieldErrors[].field` dạng `dong.N.qty` (khuôn đường ValidationPipe `lines.N.*` của 6.3), không `dong[i].qty`.

### Kiểm thử — luật dự án áp dụng trực tiếp

- Luật (1): hai method mới đi qua `findScopedOrThrow` + guard nhận diện. Luật (2): khoá `orders` rồi `products` FOR UPDATE + lane DB. Luật (3)/(4)/(5)/(6): AC-14, 15, 12/16, 11.
- Đếm publish bằng `toHaveBeenCalledTimes(1)` theo từng loại event (memory `publish-count-unasserted-duplicate-survives`).
- Fixture số dẫn xuất (giá vốn sau nhập, onHand sau xuất) in ra bằng hàm thật (memory `handpicked-fixture-numbers-hide-formula-bugs`).
- Lane DB race: kiểm khả năng chạm khe trước khi đổ lỗi cho test (memory `db-race-test-cannot-reach-short-pretx-window`); ca mock-ép ở unit cho khe ngắn.
- Mutation một lớp: gỡ kiểm tồn ở service ⇒ unit đỏ; lane DB có thể vẫn đỏ nhờ CHECK — đó là lớp hai (memory `mutation-hits-one-layer-only`).
- Song song nhiều reviewer mutate cùng file ⇒ kiểm lại mọi finding trên file hiện tại (memory `parallel-reviewers-mutation-collide`).

### Previous Story Intelligence (6.3)

- Khuôn đã chạy: khoá `products = ANY(ids) ORDER BY id FOR UPDATE` lệnh đầu; lỗi domain ném trong tx; publish sau commit; `unitCost` vắng hẳn khi thiếu `costs.view` (`anGiaVonDongPhieu`); `fieldErrors` dạng `lines.N.*`; DTO `@ApiPropertyOptional` cho field có-thể-vắng.
- Review 6.3 sửa 7 finding — áp ngay: ô số để trống không bị ép 0 (ở 6.4 client không gửi số nào — giữ vậy); guard (b) cấm ghi ngoài tx và (c) cấm ghi đơn từ inventory (lý do D1); mobile phải bắt lỗi chung để nút không kẹt `_sending`; lỗi theo chỉ số dòng phải xoá khi danh sách đổi; không tải danh sách hai lần sau thành công.
- 6.3 Debug: e2e thiếu mock `auditLog` ⇒ subscriber log lỗi nhưng test vẫn xanh — e2e mới phải mock + assert audit đúng 1 dòng `StockIssued`.
- Widget test 320/360 bắt tràn thật ở 6.3 (hàng danh sách + đầu thẻ) — dùng `Flexible`/`Expanded` ngay từ đầu.
- Định dạng tiền: các màn hiện in số nguyên thô (review 6.3 xác nhận) — giá vốn trên phiếu gắn đơn theo cùng cách.

### Git intelligence

`66bfa28` (6.3 phiếu kho), `5076c17` (6.2 tồn đọc), `fecbb6f` (6.1 nhánh giao), `04ed832` (chống flake e2e loopback + guard chống-rỗng), `9bd41ba` (phạm vi đường ghi đơn — nguồn guard `no-unscoped-order-write`). Không dependency mới; stack giữ nguyên (NestJS 11.1, Prisma 7.8, Postgres 18, React 19.2, Flutter 3.44) — không cần tra phiên bản.

### Latest tech notes (Prisma 7.8 / Postgres)

- Interactive tx truyền `tx: Prisma.TransactionClient` qua ranh giới service là hợp lệ (cùng client, cùng connection); method nhận `tx` KHÔNG được gọi `this.prisma.*` bên trong (sẽ chạy trên connection khác, ngoài khoá — guard (b) bắt).
- `$transaction([...], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })` — Postgres RR chụp ảnh ở câu đầu tiên của tx; hai câu đọc thấy cùng ảnh.
- `@@unique` trên hai cột nullable ⇒ Prisma sinh unique index; Postgres coi NULL khác nhau ⇒ phiếu tự do không đụng. Truy vấn `findUnique({ where: { orderId_orderVersionId: {...} } })` chỉ dùng với giá trị non-null.
- Lỗi CHECK/unique thô từ adapter là `DriverAdapterError` — assert message chứa tên constraint.

### Project Structure Notes

- Endpoint ở `/orders/:id/xuat-kho` (sub-resource của Đơn, controller `orders`) vì cửa vào là đơn: phạm vi, khoá đơn, transition. Phiếu vẫn là entity của `inventory/`. Tên route/hàm tiếng Việt không dấu khớp khuôn sẵn có (`/:id/huy`, `huyDon`, `chuyenTrangThaiThuCong`).
- File mới kebab-case (guard `naming-convention`); Dart snake_case.
- Không đặt mã story/AC vào comment code, tên test, migration (`review-audit-self-decision.md#Stable Code Artifacts`).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. ~~**Đơn chỉ-thiết-bị đóng thẳng `dachot → hoan_thanh`**~~ — **ĐÃ CHỐT (Đại Ca 2026-10-21): làm CẢ HAI** — cửa xuất kho riêng nhận `dachot` VÀ chặn 409 đường đóng thẳng khi còn dòng theo dõi tồn chưa xuất. Xem D12, AC-17/18, Task 12.
2. **Trừ kho lúc nào cho đơn có Vận chuyển** (câu hỏi 6.1): mặc định để người dùng chọn — cửa (b) ở `danggiao` (lúc hàng lên xe) hoặc tự động ở bước Đã giao.
3. **Xuất từng phần** (giao nhiều chuyến): mặc định không — một phiếu, xuất đủ. Muốn nhiều chuyến thì phải bỏ "một đơn một phiếu" (đổi PRD FR-25).
4. **Người có `delivery.confirm` mà không `inventory.manage`** (tick tay) bị 403 ở bước Đã giao khi đơn chưa xuất — mặc định chấp nhận; preset thật không tách hai key.
5. **Đơn thi công có Thiết bị + tự lấy ở `dacoc`**: bảng cho cả `bat_dau_thi_cong` và `xong_giao` — không đổi; cấp vật tư qua cửa (b) trước khi bắt đầu thi công.

> Câu hỏi 2–5 **giữ nguyên mặc định** (Đại Ca không đổi khi chốt câu 1, 2026-10-21).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4 (577-582), #6.1 (550-555), #6.5 (584-590), #6.6 (592-598), #6.7 (600-607)]
- [Source: ARCHITECTURE-SPINE.md#AD-7 (84-89), #AD-11 (109-113), #AD-18 (152-156), #AD-19 (158-162), #AD-20 (164-168), ERD (236-252, 276-334, 368-376)]
- [Source: prd.md#FR-25 (350-359), #FR-26 (361-367), #FR-37 (478-491)]
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#2 (55-75), #4 (104-127)]
- [Source: ux mockups/all-screens.html — Chuyển trạng thái "Đã giao" bật xác nhận phiếu xuất (~2055-2095), modal Phiếu xuất gắn đơn (3845-3880), chi tiết phiếu gắn đơn (3990-4011); EXPERIENCE.md:122, :150]
- [Source: backend/src/orders/orders.service.ts:105-117 (AD-11 + khoá dòng), 471-473 (`lockOrderRow`), 492-546 (`applyTransition`), 577-620 (`chuyenTrangThaiTuDong` — khuôn bị loại có lý do D1), 648-776 (`chuyenTrangThaiThuCong`), 808+ (`huyDon`), 1282 (`findScopedOrThrow`), 1683, 1984]
- [Source: backend/src/orders/domain/allowed-transition.ts:160-185 (hai cạnh vào `dagiao`), 286-318 (`daTaiDich`, `SU_KIEN_THU_CONG`), 345-361 (`buocKeTiep`)]
- [Source: backend/src/inventory/stock-vouchers.service.ts (6.3, khoá + kiểm tồn), stock-items.service.ts, inventory.module.ts, domain/{gia-von,stock-voucher-events,stock-voucher-visibility}.ts]
- [Source: backend/src/orders/orders.module.ts (exports + docstring), backend/src/accounts/domain/role-presets.ts:52-118]
- [Source: backend/test/{inventory-read-only,no-unscoped-order-write,no-stock-write-in-cancel,no-order-status-write-outside-transition}.spec.ts; stock-vouchers.db.integration.spec.ts; orders.e2e.spec.ts:3816-3990; order-status-change.db.integration.spec.ts:327]
- [Source: _bmad-output/implementation-artifacts/6-1-…md#Seam cho Story 6.4 (201-203); 6-2-…md:37-38, 189, 329 (đọc xé); 6-3-phieu-nhap-xuat-kho.md (khuôn + review)]
- [Source: _bmad-output/project-context.md; _bmad-output/story-automator/extra-instructions-6-dev.txt (luật dự án 1-7)]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m]) — bmad-dev-story.

### Debug Log References

- `prisma format` định dạng lại toàn bộ `schema.prisma` (193 dòng) ⇒ khôi phục bản gốc, chỉ sửa tay phần của story (diff còn 19+/2−).
- `groupBy` của Prisma trong `$transaction([...])` dạng mảng đòi `orderBy` (lỗi typing) ⇒ thêm `orderBy: { stockItemId: 'asc' }` vô hại.
- `$transaction` dạng mảng ⇒ câu `groupBy` không dùng được id của câu đầu ⇒ lọc ledger qua quan hệ `stockItem.product` với CÙNG điều kiện sản phẩm.
- Fixture `order-status-change.db.integration.spec.ts` tạo đơn KHÔNG có bản hiệu lực (không thể có sau `dachot`) ⇒ ca `xong_giao` thật 409 "Đơn chưa có bản hiệu lực" ⇒ thêm version + dòng tự do có `unitPriceSnapshot` cho đúng ca đó (code giữ chặt, không nới).
- `prettier --write` reflow dòng có sẵn ở 6 file test + controller ⇒ khôi phục từ HEAD (`git show`, không `git checkout`) rồi chèn tay đúng dòng của story.
- Giữa phiên, `project-context.md` được thêm luật "code viết tiếng Anh" (Đại Ca chốt 2026-10-21). Hỏi Đại Ca ⇒ chọn **B: tiếng Anh toàn bộ kể cả contract** ⇒ đổi tên route/DTO/method/domain/file/test/comment (bảng ở Completion Notes), chạy lại TOÀN BỘ cổng + đột biến trên code mới.
- Sửa comment migration sau khi đã `migrate deploy` ⇒ cập nhật `checksum` trong `_prisma_migrations` của DB local 5433 cho khớp file (chỉ DB local).
- Flutter `AppTable` in nhãn cột HOA ⇒ finder dùng `'ĐƠN CẦN'`/`'TỒN THẬT'`.
- Đột biến D5 lần đầu "sống" vì là mutant KHÔNG compile (đổi nửa tên field) — làm lại bằng đổi tên nhất quán ⇒ ĐỎ (memory `mutation-must-compile-or-false-red`).

### Completion Notes List

**Đổi tên theo luật tiếng Anh (quyết định B của Đại Ca, lệch chữ AC có chủ đích):**

| Story/AC ghi | Code thật |
|---|---|
| `POST/GET /orders/:id/xuat-kho` | `POST/GET /orders/:id/stock-issue` |
| `OrderStockIssueViewDto { daXuat, phieu, coTheXuat, dong, khongTheoKho }` | `{ issued, voucher, canIssue, lines, untrackedItems }`; dòng xem trước `{ productId, name, sku, unit, qty, onHand }` |
| `OrderStockIssueResultDto { phieu }` | `{ voucher }` |
| `fieldErrors[].field = dong.{i}.qty` | `lines.{i}.qty` (khớp quy ước `lines.N.*` của 6.3) |
| `OrdersService.xuatKho / xemXuatKho`, helper `xuatKhoNeuChua` | `issueStock / getStockIssue`, `issueStockIfNeeded` |
| `StockVouchersService.xuatKhoChoDonTrongTx / timPhieuXuatCuaDon` (+ xem trước) | `issueForOrderInTx / findOrderIssueVoucher / previewOrderIssue` |
| `orders/domain/gia-von-snapshot.ts#giaVonSnapshotDong` | `orders/domain/cost-snapshot.ts#lineCostSnapshot` |
| hàm gom dòng `inventory/domain/` | `inventory/domain/stock-issue-lines.ts#stockIssueLines` |
| `StockIssued.after { ma, lines[{ onHandTruoc, onHandSau, reservedGiaiPhong }] }` | `{ code, lines[{ onHandBefore, onHandAfter, reservedReleased }] }` |
| port web/mobile `xemXuatKho/xuatKho` | `getStockIssue/issueStock`; hằng `EVENT_DELIVERED`/`kEventDelivered` (= `'xong_giao'`) |
| test `gia-von-snapshot.spec.ts` | `cost-snapshot.spec.ts`, `stock-issue-lines.spec.ts` |

Symbol tiếng Việt CÓ SẴN (`taoPhieu`, `soDong`, `nguoiTao`, `ten`/`donVi` của dòng phiếu 6.3, `chuyenTrangThaiThuCong`, `quyen`…) giữ nguyên — luật cấm đổi tên hàng loạt. Chuỗi hiển thị cho người dùng giữ tiếng Việt.

**Đã làm (D1–D11):**
- Schema + migration `20261021100000_add_stock_voucher_order_link`: `order_id`/`order_version_id` FK RESTRICT, unique cặp, 2 CHECK thêm tay; `migrate deploy` lên pns-postgres 5433 sạch.
- Primitive `issueForOrderInTx` chạy trong tx của `OrdersService`: khoá `products` lệnh đầu, đọc giá vốn SAU khoá, kiểm tồn trước mọi ghi (dùng chung `insufficientStockError` với `taoPhieu`), giải phóng `reserved` theo `SUM` đang giữ, phiếu `xuat` gắn đơn, trả `StockIssued` chưa publish.
- Hai cửa: `issueStock` (201 tạo / 200 đã có, idempotent) và bước `xong_giao` (cả 2 cạnh vào `dagiao`) qua `issueStockIfNeeded` sau `applyTransition`, trước ảnh. Pre-check `inventory.manage` trước R2 + kiểm lại dưới khoá. Publish `StatusChanged` rồi `StockIssued` sau commit. Snapshot `costPriceSnapshot` cho MỌI dòng bản hiệu lực.
- GET xem trước `getStockIssue` (`canIssue` do backend tính). `StockVoucherSummary/Detail.orderId?` (vắng khi phiếu tự do); `POST /stock-vouchers` bỏ `orderId` lạ.
- Đọc xé 6.2: `stock-items.service.ts` đọc trong tx mảng `RepeatableRead`; guard (b) nới hẹp có mẫu tự kiểm 2 nhánh.
- Web: port/fake/kiểu; khối dùng chung `stock-issue-preview.tsx` (+css); `OrderStatusChangeScreen` (xem trước + đổi chữ nút + lỗi đúng dòng), `OrderDetailScreen` (Frame "Phiếu xuất" + Sheet, chống bấm 2 lần), `StockVouchersScreen` (gắn đơn / Người xác nhận). `PERM` web không có `delivery.confirm` ⇒ dùng `PERMISSION_KEYS` sinh từ registry (không đổi `PERM`).
- Mobile: parity đủ (port/fake/3 màn + widget `stock_issue_preview.dart`); `OrderDetailScreen` nhận `perms` qua constructor (mặc định rỗng — khuôn `InventoryScreen`).
- ERD spine: `STOCK_VOUCHER.orderId/orderVersionId` unique cặp, bỏ `status`.

**Lệch có chủ đích / ghi chú cho review:**
- Primitive nhận `orderLines: { productId, qty }[]` (không `ten` như AC-3 ghi): tên lấy từ `Product.name` đọc dưới khoá — một nguồn tên cho phiếu.
- "Định danh đơn" ở chi tiết phiếu = `orderId` (mono): phiếu không mang SĐT khách như `OrdersListScreen`.
- Lỗi chuyển trạng thái ở màn web/mobile giờ là `Banner`/`AppBanner` danger (trước là đoạn text) — gỡ `.sc-err` không còn dùng.
- Câu hỏi mở 1 đã có quyết định Đại Ca (D12, Task 12 — làm sau dev, trong phiên hoàn tất story); 2–5 giữ mặc định.

**Cổng (sau khi đổi tên):**
- Backend: `tsc --noEmit` sạch; `npm test` **90 suite / 1683 test** xanh; `npm run test:db` **18 suite / 159 test** xanh (lane mới 16 ca); eslint các file mới sạch; file sửa chỉ còn lỗi prettier/warning có sẵn ở baseline (đã xác minh không nằm trong hunk của story).
- Web: typecheck sạch, vitest **5 file / 56 test**, `vite build` OK.
- Mobile: `flutter analyze` 0 issue, `flutter test` **302** xanh (file mới 12 ca, gồm 320/360px).
- Design-system: `npm test` **426** xanh.

**Bảng đột biến (cp backup, KHÔNG `git checkout`, mọi mutant compile; chạy lại trên code đã đổi tên) — 24/24 ĐỎ:**

| # | Đột biến | Suite đỏ |
|---|---|---|
| G-i | `stock-items.service.ts` thêm `this.prisma.stockItem.update(...)` | `inventory-read-only` (b) |
| G-ii | tx `RepeatableRead` mảng → interactive | `inventory-read-only` (b) ×2 |
| G-iii | `issueStock` đọc `findOrThrow` thay `findScopedOrThrow` | `no-unscoped-order-write` |
| G-iv | primitive ghi `tx.orderLineItem.updateMany` | `inventory-read-only` (c) |
| M1 | gỡ `lockOrderRow` khỏi `issueStock` | DB lane (xen kẽ ép buộc + song song) ×2; unit ×1 |
| M2 | đọc `costPrice` TRƯỚC khoá `products` | DB lane ×2 (ca giá vốn dưới khoá) |
| M3 | dòng công lắp snapshot = 0 | `cost-snapshot` + `order-stock-issue.spec` |
| M4 | bỏ kiểm "đã xuất" | unit ×2; DB lane ×4 |
| M5a | bỏ pre-check `inventory.manage` ở bước Đã giao | unit (403 trước R2) |
| M5b | bỏ kiểm `inventory.manage` dưới khoá | unit (kiểm lại dưới khoá) |
| M6 | giải phóng theo `qty` thay vì `SUM` đang giữ | unit ×4; DB lane ×1 |
| M7 | publish `StockIssued` trước commit | unit ×2 |
| M8 | xuất kho cả ở `bat_dau_giao` | unit |
| M9 | publish `StockIssued` 2 lần | unit (`toHaveBeenCalledTimes(1)`) |
| M10 | bỏ kiểm tồn trong primitive | `stock-vouchers.service.spec` |
| M11 | bỏ `isolationLevel` | `stock-items.service.spec` + `inventory-read-only` |
| D1 | web preview so `line.qty > line.onHand` | `stock-issue.test.mjs` |
| D2 | mobile preview `qty * onHand` | `stock-issue.test.mjs` |
| D3 | stripper trả rỗng | `stock-issue.test.mjs` ×5 (`assertCodeNotBlind`) |
| D4 | màn web dùng literal `'xong_giao'` | `stock-issue.test.mjs` |
| D5 | port mobile đổi tên `untrackedItems` (nhất quán) | `parity.test.mjs` |

### File List

**Backend — mới:** `backend/prisma/migrations/20261021100000_add_stock_voucher_order_link/migration.sql`, `backend/src/inventory/domain/stock-issue-lines.ts`, `backend/src/inventory/domain/stock-issued-event.ts`, `backend/src/orders/domain/cost-snapshot.ts`, `backend/src/orders/dto/order-stock-issue-response.dto.ts`, `backend/test/cost-snapshot.spec.ts`, `backend/test/stock-issue-lines.spec.ts`, `backend/test/order-stock-issue.spec.ts`, `backend/test/order-stock-issue.e2e.spec.ts`, `backend/test/order-stock-issue.db.integration.spec.ts`

**Backend — sửa:** `backend/prisma/schema.prisma`, `backend/openapi/openapi.json`, `backend/src/inventory/{stock-vouchers.service,stock-items.service,inventory.module}.ts`, `backend/src/inventory/dto/stock-voucher-response.dto.ts`, `backend/src/orders/{orders.service,orders.controller,orders.module}.ts`, `backend/test/{inventory-read-only,no-unscoped-order-write,stock-vouchers.service,stock-items.service,stock-items.e2e,stock-vouchers.e2e,orders.e2e,order-status-change,order-status-change.db.integration}.spec.ts`; thêm tham số `StockVouchersService` vào constructor ở `backend/test/{discount-approvals.db.integration,order-attachments.db.integration,order-attachments,order-cancel.db.integration,order-cancel,orders-detail-scope.db.integration,orders-detail-scope,orders-list-scope,orders-list.db.integration,orders-write-scope.db.integration,orders-write-scope,orders.db.integration,orders.service,quote-exports.db.integration,warranty-lookup}.spec.ts`

**Web — mới:** `web/src/screens/orders/stock-issue-preview.tsx`, `web/src/screens/orders/stock-issue.css`, `web/src/test/order-stock-issue.test.tsx`
**Web — sửa:** `web/src/design-system/session/{orders-port,fake-orders-port,stock-vouchers-port,fake-stock-vouchers-port}.ts`, `web/src/screens/orders/{OrderStatusChangeScreen,OrderDetailScreen}.tsx`, `web/src/screens/orders/order-status-change.css`, `web/src/screens/inventory/StockVouchersScreen.tsx`

**Mobile — mới:** `mobile/lib/screens/orders/stock_issue_preview.dart`, `mobile/test/screens/orders/order_stock_issue_test.dart`
**Mobile — sửa:** `mobile/lib/design_system/session/{orders_port,fake_orders_port,stock_vouchers_port,fake_stock_vouchers_port}.dart`, `mobile/lib/screens/orders/{order_status_change_screen,order_detail_screen}.dart`, `mobile/lib/screens/inventory/stock_vouchers_screen.dart`

**Design-system:** mới `design-system/screens/stock-issue.test.mjs`; sửa `design-system/session/parity.test.mjs`

**Tài liệu/tracking:** `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` (ERD + AD-19 quyết định D12), `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/tests/test-summary-story-6-4.md`, file story này.

**Phiên hoàn tất (D12 + QA + review) sửa thêm:** `backend/src/orders/{orders.service,orders.controller}.ts`, `backend/src/orders/dto/order-stock-issue-response.dto.ts`, `backend/src/inventory/stock-vouchers.service.ts`, `backend/openapi/openapi.json`, `backend/test/{order-stock-issue,order-stock-issue.e2e,order-stock-issue.db.integration,stock-vouchers.service,orders.service,order-status-change}.spec.ts`; `web/src/design-system/session/fake-orders-port.ts`, `web/src/screens/orders/{OrderStatusChangeScreen,OrderDetailScreen}.tsx`, `web/src/test/order-stock-issue.test.tsx`; `mobile/lib/design_system/session/fake_orders_port.dart`, `mobile/lib/screens/orders/{order_status_change_screen,order_detail_screen}.dart`, `mobile/test/screens/orders/order_stock_issue_test.dart`; `design-system/session/parity.test.mjs`, `design-system/screens/stock-issue.test.mjs`; gỡ mã story khỏi comment/tên test của code mới (luật Stable Code Artifacts).

(`_bmad-output/project-context.md` đổi giữa phiên — KHÔNG phải của story này.)

### Senior Developer Review (AI)

**Ngày:** 2026-10-21 · **Reviewer:** `/ck:code-review` (hai code-reviewer chạy song song, read-only: backend + web/mobile) · **Kết quả:** Approve sau khi sửa — mọi finding hợp lệ đã vá; 2 finding cần quyết định nghiệp vụ ghi ở dưới (không đảo quyết định Đại Ca).

**Cổng cuối (sau review):** backend `tsc --noEmit` sạch · `npm test` **90 suite / 1708** xanh · `npm run test:db` **18 suite / 166** xanh · eslint các file chạm: lỗi còn lại đều là prettier có sẵn ở baseline (đã đối chiếu bản HEAD — vd `orders.controller.ts` 2 lỗi ở HEAD, 2 lỗi bây giờ, cùng chỗ) · web typecheck sạch, vitest **5 file / 65**, `vite build` OK · design-system **427** xanh · mobile `flutter analyze` 0 issue, `flutter test` **310** xanh, `dart format -o none` sạch trên file mới; `fake_orders_port.dart` chỉ còn 3 hunk lệch format có sẵn ở HEAD (không đụng).

**Finding & cách sửa:**

| # | Mức | Finding | Xử lý |
|---|---|---|---|
| R1 | Important | Nút "Đã giao" bấm được khi bảng xem trước còn đang tải/đọc lỗi ⇒ trừ kho mà màn không báo (web + mobile) | ✅ nút khoá tới khi xem trước `ready`; đọc lỗi ⇒ "Không tải được phiếu xuất kho." + "Thử lại"; test hai nền tảng |
| R2 | Important | Sheet "Xuất kho" (web) đóng được giữa request ⇒ kết quả 409 rơi vào sheet ẩn (mobile đã chặn bằng `PopScope`) | ✅ `onClose` bỏ qua khi `issuing`; test Escape giữa request |
| R3 | Minor | Sau 409 thiếu tồn, cột "Tồn thật" là số cũ cạnh thông điệp mới | ✅ 409 ⇒ đọc lại bảng xem trước (màn Chuyển trạng thái + Sheet, hai nền tảng; đọc lại lỗi giữ bảng cũ) |
| R4 | Minor | Banner lỗi sống sang bước khác; chọn bước được khi đang gửi | ✅ đổi bước xoá banner; khoá chọn bước khi `dangGui`/`_dangGui` |
| R5 | Minor | Parity `OrderStockIssue*` dò tên field trên TOÀN file port (`qty`, `unit`… xuất hiện nhiều lần) ⇒ xoá field vẫn xanh | ✅ so đúng tập field + optional/nullable trong THÂN `interface`/`class` (regex `\{[\s\S]*?\n\}`) + test tự kiểm bộ đọc |
| R6 | Minor | Text-guard không cấm phép trừ `qty - onHand` | ✅ 2 luật mới + 2 mẫu tự kiểm |
| R7 | Minor | Nhãn `Phiếu xuất` khớp chuỗi con của `Phiếu xuất kho` ⇒ gỡ frame vẫn xanh | ✅ khớp đúng `label="Phiếu xuất"` / `label: 'Phiếu xuất'` |
| R8 | Minor | Fake không ghi phiếu ở "Đã giao"; `canIssue` luôn true bất kể trạng thái | ✅ fake ghi phiếu khi `xong_giao` (sau kiểm ảnh), `canIssue` theo tập trạng thái backend; test chi tiết dùng đơn đã chốt |
| R9 | Minor | Vé chống trả lời cũ của bảng xem trước không có test | ✅ test đổi bước trước khi xem trước về (hai nền tảng) |
| R10 | Minor | Bảng phiếu web lệch cột khi chỉ một số dòng có `unitCost` | ✅ ô trống khi cột hiện |
| R11 | Minor | `xong_giao` gọi helper xuất bằng đơn đọc NGOÀI tx (đúng nhờ cổng status, nhưng lệch với cửa riêng) | ✅ đọc lại đơn trong tx dưới khoá của engine |
| R12 | Minor | Mô tả `canIssue` (DTO/openapi) thiếu `dachot` | ✅ sửa + sinh lại `openapi.json` |
| R13 | Minor | Docstring `listVersions` (web fake) và `_HuyDonDialog` (mobile) bị method/class mới chen vào giữa | ✅ trả docstring về đúng chủ |
| R14 | Minor | Comment engine nói đóng thẳng là "lối ra DUY NHẤT không qua xuất kho" — sai: `nghiemthu → hoanthanh` cũng không | ✅ sửa comment, ghi rõ khe đã chấp nhận (xem Q2) |
| R15 | Minor | Mã story trong comment/tên test code mới (luật Stable Code Artifacts) | ✅ gỡ ở 19 file |

**Cần Đại Ca quyết (không tự đổi — đảo quyết định nghiệp vụ):**
- **Q1 — `dachot` mở cho MỌI đơn, không riêng chỉ-thiết-bị.** Reviewer đề xuất chỉ cho khi cạnh `dachot → hoanthanh` hợp lệ. Bác có lý do: cạnh đó chỉ gate `scopeThietBi`, và đơn không có Thiết bị thì không có dòng theo dõi tồn ⇒ cửa riêng đã trả 409 "không có vật tư theo dõi tồn kho". Hệ quả còn lại: đơn thi công có Thiết bị xuất ở `dachot` (trước cọc) thì không `mo_lai` được nữa — đúng theo "một đơn một phiếu".
- **Q2 — Đơn thi công `nghiemthu → hoanthanh` vẫn đóng được khi chưa xuất** (khe có từ trước — câu hỏi mở 5 mặc định "cấp vật tư qua cửa riêng"). Muốn chặn như D12b thì thêm cạnh này vào cùng kiểm trong engine (một dòng điều kiện + test) — chờ Đại Ca.
- **Ghi nhận cho story sau:** huỷ đơn đã xuất (`dachot`/`dacoc`) chưa trả tồn ⇒ 6.7; lane auto tất toán (7.2) sẽ nhận 409 trên đơn chưa xuất SAU khi Payment commit ⇒ caller 7.2 phải xử lý.

**Bảng đột biến (cp backup → mutant → chạy → khôi phục, `filecmp` khớp; KHÔNG `git checkout/stash`; mọi mutant backend `tsc` sạch) — 19/19 ĐỎ:**

| # | Đột biến | Lane đỏ |
|---|---|---|
| A1 | bỏ `dachot` khỏi `STOCK_ISSUE_STATUSES` (gate (a)) | unit/e2e 6 ca; DB 2 ca |
| B1 | bỏ lời gọi kiểm trong engine (`assertNoUnissuedStockInTx`) | unit/e2e 4; DB 2 (gồm xen kẽ ép (ii), lane auto) |
| B2 | vô hiệu pre-check trước R2 | unit 1 (409 trước R2) |
| B3 | chạy kiểm TRƯỚC `lockOrderRow` | unit 1; DB 1 (xen kẽ ép (i)) |
| B4 | bỏ khoá `products FOR UPDATE` trong `lockTrackedProductsInTx` | unit 1; DB 1 (xen kẽ ép (ii)) |
| B5 | nới điều kiện: kiểm mọi cạnh vào `hoanthanh` | unit 2 |
| B6 | vô hiệu chặn `mo_lai` đơn đã xuất (`!== null && false`) | unit/e2e 2; DB 1 |
| B7 | bỏ "đã có phiếu ⇒ cho đóng" | unit/e2e 2; DB 2 |
| S1 | `issueStock` đọc `findOrThrow` thay `findScopedOrThrow` (scope đường ghi) | 4 (gồm `no-unscoped-order-write` + 404 ngoài phạm vi) |
| L1 | gỡ `lockOrderRow` khỏi cửa xuất riêng | unit 1; DB 2 |
| L2 | bỏ `FOR UPDATE` ở khoá `products` của primitive xuất | unit 1; DB 2 |
| W1 | web màn Chuyển trạng thái hiện câu chung thay message backend | vitest 2 |
| W2 | web Sheet đóng được khi đang gửi | vitest 1 |
| W3 | web bỏ khoá nút khi xem trước chưa `ready` | vitest 2 |
| W4 | web bỏ đọc lại bảng sau 409 | vitest 1 |
| M1 | mobile hiện câu chung thay message backend | flutter 1 |
| M2 | mobile bỏ khoá nút khi xem trước chưa `ready` | flutter 2 |
| P1 | xoá `sku` khỏi `OrderStockIssueLine` (web port) | parity 1 |
| T1 | web preview in `line.qty - line.onHand` | text-guard 1 |

Mutant đầu của B6 (`=== 'never'`) KHÔNG compile ⇒ loại, làm lại bằng mutant compile (memory `mutation-must-compile-or-false-red`). Bảng đột biến D1–D11 của dev (24/24) giữ nguyên ở trên.

### Change Log

- 2026-10-21 — Hoàn tất: quyết định Đại Ca D12 (xuất ở `dachot`; chặn 409 `dachot → hoanthanh` khi còn vật tư chưa xuất, kiểm trong engine dưới khoá `orders → products`; chặn `mo_lai` đơn đã xuất), QA automate (test-summary-story-6-4.md), code review 15 finding đã vá + 2 câu hỏi nghiệp vụ, 19 đột biến ĐỎ. Status → done.
- 2026-10-21 — Story 6.4 dev: xuất kho gắn Đơn (một Đơn một phiếu), snapshot giá vốn lúc xuất, giải phóng chỗ giữ, `StockIssued`, cửa riêng + bước Đã giao, đọc xé `RepeatableRead`, UI web/mobile, guard + lane DB. Áp luật tiếng Anh (quyết định B) cho toàn bộ code mới kể cả contract (`/orders/:id/stock-issue`).
