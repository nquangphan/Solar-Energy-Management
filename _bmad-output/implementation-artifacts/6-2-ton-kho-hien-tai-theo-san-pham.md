---
baseline_commit: fecbb6f0a726fca3d954f91a7ff495c2793cdaf1
---
# Story 6.2: Tồn kho hiện tại — hai con số `onHand` + `reserved` + khả dụng

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền nhập/xuất kho (và sale cần biết còn bao nhiêu để hứa),
I want xem tồn hiện tại theo Sản phẩm (Tồn thật `onHand` + Đã hứa `reserved` + Khả dụng) và danh sách cần mua,
so that biết còn bao nhiêu để cấp mà không xuất quá, và biết phải nhập gì.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Greenfield hoàn toàn — không có gì để "tái dùng" ở tầng tồn kho

Đã scout (2026-10-21): **không** có `backend/src/inventory/`, **không** có model `StockItem`/`StockMovement` trong `backend/prisma/schema.prisma` (chỉ có comment hứa ở `:120` và `Product.tracksStock` `:133`), **không** có port/màn tồn kho web hay mobile. Mục "Kho" ở sidebar web (`web/src/design-system/shell/Sidebar.tsx:72`) và tab "Kho" mobile (`mobile/lib/design_system/shell/app_bottom_nav.dart:31`, index 3) là **placeholder** — không màn nào dùng `activeKey="inventory"` / `activeIndex: 3`.

Story này là story đầu tiên chạm schema tồn kho ⇒ tạo module `inventory/`, migration, endpoint ĐỌC, port + màn hai nền tảng.

### 2. `reserved` KHÔNG phải cột — ERD của spine tự mâu thuẫn, AD-19 thắng

- ERD `ARCHITECTURE-SPINE.md:316-321` vẽ `STOCK_ITEM { int onHand; int reserved }`.
- Rule AD-19 (`:162`) + PRD FR-25 (`prd.md:358`): "`reserved` là **tổng của `StockMovement.qty`**, KHÔNG phải một cột `int` cộng-trừ".
- **Quyết định:** `stock_items` CHỈ có `on_hand`. `reserved` = `SUM(stock_movements.qty)` của stockItem đó, tính lúc đọc. **Cấm** thêm cột `reserved` (thêm source-guard, xem Task 6).

### 3. Ledger `stock_movements` tạo Ở ĐÂY, nhưng KHÔNG có đường ghi nào

AC đòi `reserved` là tổng ledger. Không có bảng ⇒ phải hardcode `0` = dữ liệu giả (cấm theo `development-rules.md`). Nên:

- Story này tạo bảng `stock_movements` theo đúng cột ERD (`:366-374`): `id, stock_item_id FK, order_id FK, order_version_id FK, qty Int (CÓ DẤU), type String, created_at`. Append-only.
- **KHÔNG** viết đường ghi nào (6.6 giữ chỗ lúc chốt, 6.4 xuất, 6.7 giải phóng khi huỷ).
- **KHÔNG** đặt unique idempotency ở đây — 6.6 sở hữu thiết kế đó. Lưu ý cho 6.6: spine nói "unique `(orderId, orderVersionId)`" nhưng một version có NHIỀU sản phẩm ⇒ unique đó không thể đặt trên movement-per-product; PRD `:359` cho thấy unique `(orderId, orderVersionId)` thực ra là của **phiếu xuất** (`StockVoucher`). Ghi vào Câu hỏi mở, không quyết hộ 6.6.
- **Hợp đồng chéo story do 6.2 đặt (bắt buộc ghi vào docstring schema):** `reserved = SUM(qty)` trên TOÀN BỘ dòng ledger của stockItem; `qty` có dấu (giữ chỗ dương, giải phóng/xuất âm). Cột `type` chỉ để truy vết, phép tính KHÔNG lọc theo `type`. Ai viết movement sau này phải giữ bất biến này.
- Hệ quả thật ở production sau khi merge 6.2: mọi sản phẩm `onHand = 0` (chưa có phiếu nhập — 6.3), `reserved = 0` (chưa có giữ chỗ — 6.6). Màn hiện toàn số 0 / "Hết khả dụng" là ĐÚNG sự thật, không phải bug. Lane DB chứng minh phép SUM bằng cách INSERT thẳng dòng ledger.

### 4. `StockItem` sinh LƯỜI — đọc bằng LEFT JOIN, không seed, không backfill

Không tạo `stock_items` cho mọi sản phẩm trong migration, không hook vào tạo sản phẩm. Đường đọc lấy `products` LEFT JOIN `stock_items` — vắng dòng ⇒ `onHand = 0`, `reserved = 0`. Dòng `stock_items` do phiếu nhập/xuất (6.3) upsert dưới `FOR UPDATE`. Story 6.2 **không ghi tồn** ⇒ luật dự án (2) "khoá FOR UPDATE" không áp cho story này (đọc thuần); nhưng vẫn BẮT BUỘC có test lane DB cho phép SUM + LEFT JOIN (luật (2) nửa sau — đây là truy vấn tồn kho đầu tiên chạm Postgres thật).

### 5. Quyền: KHÔNG thêm key mới — `@RequireAnyPermissions(inventory.manage, quotes.create_edit)`

- Registry chỉ có `inventory.manage` (`permission-registry.ts:58`). AC-1 nói "Khả dụng — **con số sale nhìn thấy**" ⇒ sale (`THO_KS`: có `quotes.create_edit`, không có `inventory.manage`) phải đọc được.
- **Quyết định:** `GET /stock-items` gate `@RequireAnyPermissions(PERM.inventoryManage, PERM.quotesCreateEdit)` — khuôn OR đã dùng ở `orders.controller.ts:238`. Payload KHÔNG có giá vốn ⇒ không dính `costs.view`. Không đẻ `inventory.view` (thêm key = 2 lần regen + parity web/mobile — memory `permissions-registry-cross-package-regen`, `perm-web-mobile-key-parity`; không cần thiết).
- `KHO_GIAO`, `ADMIN`, `QUAN_LY`, `SUPER_ADMIN`, `THO_KS` đọc được; `KE_TOAN`, `THI_CONG` ⇒ 403.
- Web: `PERM` viết tay (`web/src/design-system/gating/permissions.ts:104-119`) CHƯA có `inventoryManage` lẫn `quotesCreateEdit` — thêm CẢ HAI. **Cùng commit** thêm đúng hai key đó vào `AppPerm` mobile (`mobile/lib/design_system/gating/app_permissions.dart`): `design-system/permissions/permission-keys.test.mjs` `deepEqual` hai bộ key — thêm một phía là đỏ phía kia (memory `perm-web-mobile-key-parity`). Key đã có trong registry ⇒ KHÔNG cần regen `permissions.json`.

### 6. Nửa sau AC-2 ("cảnh báo ngay khi thêm dòng vào báo giá") CHUYỂN sang Story 6.5

**Đây là quyết định phạm vi có ý thức — Đại Ca lật được.** Lý do:
1. Story 6.5 AC-1 nói lại đúng việc này, kèm câu chữ ("Kho còn 5") và nửa còn lại ("chốt không chặn") — cảnh báo và không-chặn phải test cùng nhau.
2. Giữa 6.2 và 6.3 mọi sản phẩm `onHand = 0` ⇒ nếu bật cảnh báo bây giờ, MỌI dòng báo giá đều cảnh báo — nhiễu thuần trên production.
3. `CatalogProduct` client hai nền tảng còn thiếu `tracksStock` (`catalog-port.ts:12-22`, `catalog_port.dart:12-34`) + phải quyết so sánh `qty` vs `khaDung` ở đâu (AD-2) — việc của màn báo giá, không phải màn tồn kho.

6.2 giao read model (`GET /stock-items?productIds=…`) mà 6.5 sẽ tiêu thụ. **Không** sửa `CreateQuoteScreen` web/mobile ở story này. Ghi dòng này vào Completion Notes để 6.5 nhận.

### 7. Client KHÔNG tính gì (AD-2)

Backend trả sẵn `onHand`, `reserved`, `khaDung`, `canNhap`, `tinhTrang` và `danhSachCanMua`. Client chỉ GHÉP CHUỖI hiển thị từ số backend trả ("Còn 0 · Đã hứa 2 · Cần nhập 2"), rẽ nhánh theo `tinhTrang` — **không** trừ `onHand - reserved`, không so `< 0`, không `Math.max`, không filter âm để dựng danh sách cần mua. Text-guard sẽ bắt (Task 7).

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:557-567`)

- **Given** mỗi Sản phẩm, **When** xem Tồn kho, **Then** hiển thị: `onHand` — hàng thật trong kho (từ entity `StockItem`, chỉ phiếu nhập/xuất kho được đụng); `reserved` — hàng đã hứa cho đơn đã chốt (tổng của `StockMovement`, không phải biến cộng-trừ); **Khả dụng = `onHand` − `reserved`** — con số sale nhìn thấy, có thể âm; (một kho duy nhất ở Phase 1) (FR-25, §2).
- **Given** khả dụng âm, **When** hiển thị, **Then** hiện dạng `"Còn 5 · Đã hứa 20 · Cần nhập 15"` thay vì hiện số âm trần trụi; cảnh báo ngay khi thêm dòng vào báo giá (§2). ← *nửa sau chuyển 6.5, xem 🛑6*
- **Given** gộp sản phẩm khả dụng âm, **When** tính danh sách cần mua, **Then** mỗi sản phẩm với khả dụng âm = cần nhập số lượng tương ứng (§2).
- **Given** màn Tồn kho, **When** dựng, **Then** dùng Table + trạng thái empty/loading/error, số canh phải `.mono`, parity web+mobile (FR-25, UX-DR-10).

### AC dẫn xuất (đo được)

1. **Schema.** Migration mới `backend/prisma/migrations/<ts>_add_stock_items_and_movements/` tạo `stock_items` (`id` uuid PK, `product_id` UNIQUE FK → `products` `ON DELETE RESTRICT`, `on_hand` Int NOT NULL default 0, `created_at`, `updated_at`) và `stock_movements` (`id`, `stock_item_id` FK RESTRICT, `order_id` FK → `orders`, `order_version_id` FK → `order_versions`, `qty` Int NOT NULL, `type` Text NOT NULL, `created_at`; index `stock_item_id`). **Không** có cột `reserved` ở đâu cả. `npx prisma migrate deploy` trên Postgres local (cổng 5433) áp sạch; `prisma validate` + `prisma generate` xanh.
2. **Domain thuần** `backend/src/inventory/domain/ton-kho.ts`: `tinhTonKho({ onHand, reserved })` → `{ onHand, reserved, khaDung, canNhap, tinhTrang }` với `khaDung = onHand − reserved`, `canNhap = khaDung < 0 ? −khaDung : 0`, `tinhTrang = 'du' | 'het' | 'am'` (`> 0` / `= 0` / `< 0`). Là NƠI DUY NHẤT tính khả dụng. Unit test phủ ba nhánh + biên `0`, `reserved > onHand`, `onHand = 0 & reserved = 0`.
3. **Endpoint** `GET /stock-items` (module `inventory`, controller `stock-items.controller.ts`) trả `200 { items: StockItemView[], danhSachCanMua: CanMuaView[] }`:
   - `StockItemView = { productId, ten, sku, donVi, onHand, reserved, khaDung, canNhap, tinhTrang }` (tên trường khớp DTO; không `costPrice`).
   - Tập sản phẩm: `(tracksStock AND isActive)` **HOẶC** `onHand ≠ 0` **HOẶC** `reserved ≠ 0` (hàng thật còn trong kho / còn bị hứa không được biến mất chỉ vì sản phẩm bị ẩn/đổi cờ). Sản phẩm `tracksStock=false` không có số nào ⇒ KHÔNG xuất hiện (dịch vụ không có tồn — lệch mockup có chủ đích, xem Dev Notes).
   - Sắp xếp `items`: theo `ten` (collation mặc định), ổn định.
   - `danhSachCanMua` = các item có `canNhap > 0`, sắp `canNhap` giảm dần rồi `ten`; mỗi phần tử `{ productId, ten, donVi, canNhap }`. Backend dựng, client không lọc.
   - Query tuỳ chọn `?q=` (tìm theo tên/SKU, `contains` không phân biệt hoa thường — ô "Tìm sản phẩm trong kho…" mockup) và `?productIds=uuid,uuid` (read model cho 6.5; validate từng phần tử là UUID ⇒ 400 `VALIDATION_ERROR` + `fieldErrors`). `danhSachCanMua` tính trên CÙNG tập đã lọc.
   - Gate `@RequireAnyPermissions(PERM.inventoryManage, PERM.quotesCreateEdit)`; thiếu cả hai ⇒ 403 `FORBIDDEN` (envelope chuẩn AD-5). Không token ⇒ 401.
4. **`reserved` là SUM ledger, đo trên Postgres thật** (lane DB): INSERT trực tiếp `stock_items(on_hand=5)` + 2 dòng movement `qty = +12` và `qty = +8` ⇒ endpoint/service trả `onHand 5, reserved 20, khaDung −15, canNhap 15, tinhTrang 'am'`, và sản phẩm đó có mặt trong `danhSachCanMua` với `canNhap 15`. Thêm một dòng `qty = −8` ⇒ `reserved 12`. Sản phẩm không có dòng `stock_items` ⇒ `0/0/0/'het'`. Hai sản phẩm có movement không lẫn sang nhau (GROUP BY đúng khoá).
5. **Không N+1, không SUM ở JS trên toàn ledger:** service dùng MỘT truy vấn tổng hợp (Prisma `groupBy` trên `stockMovement` theo `stockItemId` với `_sum.qty`, hoặc `$queryRaw` có tham số) + một truy vấn sản phẩm. Unit test (mock Prisma) khẳng định số lần gọi.
6. **Đọc thuần:** service không gọi `create/update/upsert/delete`, không mở `$transaction`, không publish event (không có hành động nghiệp vụ). Source-guard nhỏ (hoặc mở rộng guard sẵn có) khẳng định `inventory/` chưa có lệnh ghi Prisma nào lên `stockItem`/`stockMovement` ngoài nơi được phép — **có assert chống-guard-rỗng** (luật (5)): tập file quét > 0 và bộ trích bắt được một mẫu ghi giả trong chuỗi test.
7. **Cấm cột `reserved`:** source-guard quét `schema.prisma` khối `model StockItem { … }` (dùng máy quét cân bằng ngoặc/`\{[\s\S]*?\n\}` — memory `text-guard-brace-regex-nested-generics`) ⇒ không có trường `reserved`; assert chống-rỗng: khối trích được chứa `onHand`.
8. **E2E** (`backend/test/stock-items.e2e.spec.ts`, bind bằng `initAppOnLoopback` — luật (6)): 200 cho `KHO_GIAO` và `THO_KS`; 403 cho `KE_TOAN`; 401 không token; 400 `productIds=khong-phai-uuid` qua ValidationPipe (mã HTTP chỉ đo được ở lane e2e — memory `dev-pins-ac-deviation-as-green-test`); body có `items` + `danhSachCanMua`, KHÔNG có key `costPrice`.
9. **OpenAPI** sinh lại (`npm run openapi:gen`), `openapi.json` commit, `openapi-drift.spec.ts` xanh. Source-guard `no-handler-without-require-permissions`, `naming-convention`, `no-permission-literal-outside-registry` xanh với file mới.
10. **Web màn Tồn kho** `web/src/screens/inventory/InventoryScreen.tsx` (+ `inventory.css` nếu cần): `WebShell` + `Sidebar activeKey="inventory"` + `Topbar eyebrow="KHO · 1 KHO" title="Tồn kho"`; ô tìm (`q`); `Frame` "Tồn kho · Tồn thật / Đã hứa / Khả dụng" chứa `Table` cột `Sản phẩm | Tồn thật | Đã hứa | Khả dụng | Tình trạng` — ba cột số `className="num mono"`; ô Khả dụng: `tinhTrang==='am'` ⇒ hiện `Cần nhập {canNhap}` màu `var(--danger)`, KHÔNG hiện số âm; cột Tình trạng chip `Đủ` / `Hết khả dụng` / `Âm` (khuôn chip tay của warranty: `chip` + màu `--ok/--warn/--danger`); `Frame` thứ hai "Danh sách cần mua · gộp mọi khả dụng âm" (chỉ render khi `danhSachCanMua` không rỗng) cột `Sản phẩm | Cần nhập`. Loading = `Skeleton` rows; Error = `ErrorState` + "Thử lại"; Empty = `EmptyState` "Chưa có sản phẩm nào theo dõi tồn kho." (và empty riêng khi tìm không ra: "Không có sản phẩm khớp tìm kiếm."). Dòng tóm tắt dưới tên (micro muted) dạng `Còn {onHand} · Đã hứa {reserved} · Cần nhập {canNhap} {donVi}` khi âm, `Còn {onHand} · Đã hứa {reserved} · Khả dụng {khaDung} {donVi}` khi không âm. Nút "Phiếu nhập"/"Phiếu xuất"/"Phiếu kho" của mockup **KHÔNG** dựng (6.3/6.4).
11. **Sidebar** mục `inventory` thêm `requiresAny: [PERM.inventoryManage, PERM.quotesCreateEdit]` (giữ thứ tự `key, icon, label` — guard `shell-behavior.test.mjs:23-41`; giữ vị trí trước settings — `settings-customer-sources.test.mjs:139`).
12. **Mobile màn Tồn kho** `mobile/lib/screens/inventory/inventory_screen.dart` (StatefulWidget + port qua constructor, khuôn `warranty_lookup_screen.dart`): `AppPhoneFrame > AppMobileShell(topbar: AppTopbar(eyebrow: 'KHO · 1 KHO', title: 'Tồn kho'), bottomNav: AppBottomNav(activeIndex: kInventoryTabIndex /* = 3, hằng mới */))`; danh sách `AppCard` mỗi sản phẩm: tên + số khả dụng (`Cần nhập N` màu danger khi âm) + `AppChip` tình trạng + dòng micro cùng câu với web; viền card `warn` khi `het`, `danger` khi `am` (token, không hex); khối "Danh sách cần mua" (AppTable 2 cột numeric phải) khi không rỗng. Loading/Error/Empty = `AppSkeleton`/`AppErrorState(onRetry)`/`AppEmptyState` cùng câu chữ web.
13. **Port + fake hai nền tảng:** `web/src/design-system/session/inventory-port.ts` + `fake-inventory-port.ts` (export ở `index.ts`); `mobile/lib/design_system/session/inventory_port.dart` + `fake_inventory_port.dart` (export ở `session.dart`). Port ĐỌC duy nhất `listStock({ q? }) → StockList` (mirror DTO, không tự tính). Fake trả fixture CÓ ĐỦ ba tình trạng + một sản phẩm tên DÀI NHẤT (vd "Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha") — số khả dụng/cần nhập trong fixture gõ khớp `tinhTonKho` (memory `handpicked-fixture-numbers-hide-formula-bugs`: viết fixture bằng cách chạy hàm backend thật in ra số, không nhẩm). Thêm cặp file vào map twin của `design-system/session/parity.test.mjs:23-46` + assert chữ ký `listStock` hai bên khớp + mọi field có mặt hai bên.
14. **Test FE:** web — ca `InventoryScreen` trong `web/src/test/screens-render.test.tsx` (bump `SCREEN_COUNT` 13 → 14, `:194`), `css-class-coverage` xanh; `cd web && npm run typecheck && npm test && npm run build` xanh (luật (3)). Mobile — `mobile/test/screens/inventory/inventory_screen_test.dart`: một `testWidgets` cho mỗi trạng thái (loading với port treo, error + bấm Thử lại gọi lại port, empty, có dữ liệu ba tình trạng — khẳng định chữ `Cần nhập 15` có, `-15` KHÔNG có), danh sách cần mua hiện/ẩn, và vòng `for width in [320, 360]` với nhãn dài nhất ⇒ `tester.takeException()` null (khuôn `order_detail_long_status_test.dart:82-115`) (luật (4)). `flutter analyze` + `flutter test` xanh.
15. **Text-guard** `design-system/screens/inventory.test.mjs` (khuôn `warranty-lookup.test.mjs`): trên code đã strip comment của màn web+mobile+port: cấm phép trừ giữa `onHand`/`reserved`, cấm so `khaDung` với số (`< 0`, `<= 0`, `> 0`), cấm `Math.max`/`.abs()`, cấm `.filter(` dựng danh sách cần mua, cấm hex/`Color(0x`, cấm động từ ghi trên port (`create|update|save|delete|post`); bắt buộc rẽ nhánh theo `tinhTrang`; bắt buộc dùng `Table|Frame|EmptyState|ErrorState|Skeleton` (web) và `AppCard|AppTable|AppChip|AppEmptyState|AppErrorState|AppSkeleton` (mobile); `assertCodeNotBlind(...)` chống rỗng (luật (5)). `cd design-system && npm test` xanh.

---

## Tasks / Subtasks

- [x] **Task 1 — Schema + migration (AC: 1, 7)**
  - [x] Thêm `model StockItem` và `model StockMovement` vào `backend/prisma/schema.prisma` (cạnh `Product`), quan hệ ngược `Product.stockItem StockItem?`, `Order.stockMovements`, `OrderVersion.stockMovements`. Docstring Việt theo khuôn file: giải thích vì sao không có `reserved`, hợp đồng `SUM(qty)` có dấu, append-only, `onDelete: Restrict` (Product soft-delete), không unique idempotency (6.6).
  - [x] Sinh SQL offline: `npx prisma migrate diff --from-schema <schema cũ> --to-schema prisma/schema.prisma --script` (Prisma 7: KHÔNG có `--from-schema-datamodel` — memory `prisma7-migrate-diff-flag-rename`). Tên thư mục timestamp > `20260718070000`. Đọc lại SQL: FK `RESTRICT`, unique `product_id`.
  - [x] `npx prisma validate && npx prisma generate`; `npx prisma migrate deploy` lên Postgres local (container `pns-postgres`, cổng 5433; tắt thì `docker start pns-postgres` — nếu daemon không lên từ shell, memory `db-lane-needs-docker-desktop-gui`: ghi "lane DB chưa chạy", KHÔNG đánh `[x]`). KHÔNG ghi lên DB nào khác.
- [x] **Task 2 — Domain `tinhTonKho` (AC: 2)** — `backend/src/inventory/domain/ton-kho.ts` + `backend/test/ton-kho.spec.ts`. Kiểu `TinhTrangTon = 'du' | 'het' | 'am'` export cho DTO.
- [x] **Task 3 — Service + controller + module (AC: 3, 5, 6)**
  - [x] `backend/src/inventory/stock-items.service.ts`: method `lietKeTonKho({ q, productIds })` (tên tiếng Việt không dấu theo khuôn `orders.service.ts`). (1) `prisma.product.findMany` lọc `OR: [{ tracksStock: true, isActive: true }, { stockItem: { isNot: null } }]` + `include: { stockItem: true }` + `q`/`productIds`; (2) MỘT `prisma.stockMovement.groupBy({ by: ['stockItemId'], _sum: { qty: true }, where: { stockItemId: { in: ids } } })`; (3) ghép, gọi `tinhTonKho`, lọc bỏ sản phẩm KHÔNG thoả `(tracksStock && isActive) || onHand≠0 || reserved≠0`; (4) dựng `danhSachCanMua`. Prisma conditional — không spread union vào query (memory `prisma-conditional-include-no-spread`).
  - [x] DTO `backend/src/inventory/dto/stock-list-query.dto.ts` (`q?` string trim max 100; `productIds?` CSV → `@Transform` tách + `@IsUUID('4', { each: true })`), `stock-list-response.dto.ts` (`StockItemViewDto`, `CanMuaViewDto`, `StockListResponseDto`, `tinhTrang` `@ApiProperty({ enum })`).
  - [x] `stock-items.controller.ts` `@ApiTags('inventory') @ApiBearerAuth() @Controller('stock-items')`, `@Get()` + `@RequireAnyPermissions(PERM.inventoryManage, PERM.quotesCreateEdit)` + `@ApiOkResponse/@ApiBadRequestResponse/@ApiForbiddenResponse` (khuôn `orders.controller.ts:237-262`). Controller không dựng envelope.
  - [x] `inventory.module.ts` (không import Prisma/Events — `@Global`), đăng ký vào `app.module.ts` + một dòng docstring "Story 6.2 — InventoryModule" theo khuôn file.
  - [x] `backend/test/stock-items.service.spec.ts`: mock Prisma — đếm `groupBy` gọi đúng 1 lần, `findMany` 1 lần, không lệnh ghi nào được gọi; lọc tập sản phẩm (inactive có tồn vẫn hiện, inactive 0/0 ẩn, tracksStock=false 0/0 ẩn); sắp xếp `danhSachCanMua`.
- [x] **Task 4 — E2E + DB lane (AC: 4, 8)**
  - [x] `backend/test/stock-items.e2e.spec.ts` (khuôn file e2e có sẵn, `initAppOnLoopback`).
  - [x] `backend/test/stock-items.db.integration.spec.ts` (khuôn `settings.db.integration.spec.ts`: tự skip khi vắng `DATABASE_URL`; tự dựng product/order/version fixture rồi dọn): AC-4 đầy đủ + FK RESTRICT (xoá product có stock_item ⇒ lỗi — Prisma 7 delete-restrict ném DriverAdapterError không tag, assert message chứ không assert `P2003`, memory `prisma7-p2003-only-on-insert`) + unique `product_id`. Chạy `npm run test:db`.
- [x] **Task 5 — OpenAPI (AC: 9)** — `npm run openapi:gen`, commit `backend/openapi/openapi.json`.
- [x] **Task 6 — Source-guard (AC: 6, 7)** — `backend/test/inventory-read-only.spec.ts` (hoặc tên kebab mô tả hành vi): (a) `schema.prisma` khối `StockItem` không có `reserved`; (b) `src/inventory/**` không có `.create(`/`.update(`/`.upsert(`/`.delete(`/`createMany`/`updateMany`/`deleteMany`/`$executeRaw` — ghi chú trong guard: 6.3 sẽ nới guard (b) cho đường phiếu kho có `FOR UPDATE`, (a) giữ vĩnh viễn. Assert chống rỗng cho cả hai. Đột biến: thêm `reserved Int` vào model ⇒ đỏ; thêm `this.prisma.stockItem.create(` vào service ⇒ đỏ (mutant phải compile — memory `mutation-must-compile-or-false-red`). Dùng `cp` backup, KHÔNG `git checkout`.
- [x] **Task 7 — Web (AC: 10, 11, 13, 14, 15)**
  - [x] `inventory-port.ts` + `fake-inventory-port.ts` + export `index.ts`.
  - [x] `web/src/design-system/gating/permissions.ts`: thêm `inventoryManage` + `quotesCreateEdit` vào `PERM`; cùng lúc thêm hai key đó vào `AppPerm` (`mobile/lib/design_system/gating/app_permissions.dart`) — parity `permission-keys.test.mjs`. `Sidebar.tsx:72` thêm `requiresAny`.
  - [x] `web/src/screens/inventory/InventoryScreen.tsx` (+ css chỉ khi cần; mọi className phải có rule thật). Khuôn state `LoadState` + vé `latest` chống trả lời cũ (`OrdersListScreen.tsx:83-104`) — ô tìm gõ liên tục.
  - [x] Ca render + bump `SCREEN_COUNT`; `npm run typecheck && npm test && npm run build`. Memory `web-tsx-syntax-error-passes-all-lanes`: typecheck phải chạy thật, đừng tin text-guard.
- [x] **Task 8 — Mobile (AC: 12, 13, 14)**
  - [x] `inventory_port.dart` + `fake_inventory_port.dart` + export `session.dart`; hằng `kInventoryTabIndex = 3` (khuôn `kMenuTabIndex` ở `customer_pick_screen.dart:31`).
  - [x] `inventory_screen.dart` + widget test. `dart format -o none` hoặc chỉ format file mình viết (memory `dart-format-writes-files-cascade`). `flutter analyze && flutter test`.
- [x] **Task 9 — Parity + text-guard (AC: 13, 15)** — `design-system/session/parity.test.mjs` (twin map + chữ ký + field), `design-system/screens/inventory.test.mjs`. `cd design-system && npm test`. Đột biến: chèn `onHand - reserved` vào màn web ⇒ guard đỏ; xoá `assertCodeNotBlind` input ⇒ guard đỏ.
- [x] **Task 10 — Docs** — `ARCHITECTURE-SPINE.md` ERD `STOCK_ITEM` bỏ dòng `int reserved` (thêm chú thích "reserved = SUM(STOCK_MOVEMENT.qty)"); `STOCK_MOVEMENT.qty` ghi "có dấu". `_bmad-output/project-context.md` mục Testing: thêm dòng lane tồn kho (nếu có lệnh mới). Không sửa mockup `.html`, `prd.md`, `epics.md`.
- [x] **Task 11 — Cổng cuối** — `cd backend && npm test` (toàn bộ, hermetic) + `npm run test:db` + `npx tsc --noEmit`; lint: baseline đỏ sẵn ~162 lỗi prettier (memory `backend-lint-red-at-baseline`) — đo bằng stash, chỉ `prettier --write` file mình viết; web 3 lệnh; mobile 2 lệnh; design-system `npm test`. Ghi số suite/test từng lane vào Completion Notes.

---

## Dev Notes

### Files sẽ đổi

| File | Loại |
|---|---|
| `backend/prisma/schema.prisma` | UPDATE — 2 model mới + quan hệ ngược trên `Product`/`Order`/`OrderVersion` |
| `backend/prisma/migrations/<ts>_add_stock_items_and_movements/migration.sql` | NEW |
| `backend/src/inventory/{inventory.module,stock-items.controller,stock-items.service}.ts` | NEW |
| `backend/src/inventory/domain/ton-kho.ts` | NEW |
| `backend/src/inventory/dto/{stock-list-query,stock-list-response}.dto.ts` | NEW |
| `backend/src/app.module.ts` | UPDATE — import `InventoryModule` |
| `backend/openapi/openapi.json` | UPDATE (sinh) |
| `backend/test/{ton-kho,stock-items.service,stock-items.e2e,stock-items.db.integration,inventory-read-only}.spec.ts` | NEW |
| `web/src/design-system/session/{inventory-port,fake-inventory-port}.ts`, `index.ts` | NEW / UPDATE |
| `web/src/design-system/gating/permissions.ts`, `web/src/design-system/shell/Sidebar.tsx`, `mobile/lib/design_system/gating/app_permissions.dart` | UPDATE |
| `web/src/screens/inventory/InventoryScreen.tsx` (+ `inventory.css`) | NEW |
| `web/src/test/screens-render.test.tsx` | UPDATE |
| `mobile/lib/design_system/session/{inventory_port,fake_inventory_port}.dart`, `session.dart` | NEW / UPDATE |
| `mobile/lib/screens/inventory/inventory_screen.dart`, `mobile/test/screens/inventory/inventory_screen_test.dart` | NEW |
| `design-system/session/parity.test.mjs`, `design-system/screens/inventory.test.mjs` | UPDATE / NEW |
| `ARCHITECTURE-SPINE.md` | UPDATE (ERD) |

**Không đổi:** `orders/**` (đặc biệt `huyDon()` — guard `no-stock-write-in-cancel.spec.ts` vẫn phải xanh; story này không thêm định danh tồn kho nào vào `orders.service.ts`), `permission-registry.ts`, `role-presets.ts`, `permissions.json`, `catalog/**` (không thêm `tracksStock` vào `CatalogProduct` client — việc của 6.5), `CreateQuoteScreen` hai nền tảng.

### Hiện trạng phải giữ

- `Product` soft-delete (`isActive`) — FK mới RESTRICT, không cascade. Hard-delete `Product` không có đường nào ở app; FK chỉ thêm lưới an toàn.
- `ProductsService` (`catalog/products.service.ts`) KHÔNG đụng: tạo sản phẩm không tạo `stock_items` (🛑4).
- Guard `no-unscoped-order-write` chỉ áp đường ghi đơn — story này không ghi đơn.
- Permission guard semantics: `@RequirePermissions` = AND, `@RequireAnyPermissions` = OR (`permissions.guard.ts:77-78`).
- Bottom-nav mobile khoá cứng 5 tab (`shell-parity.test.mjs:74`) — chỉ truyền `activeIndex`, không sửa danh sách tab.

### Lệch mockup có chủ đích (ghi lại để reviewer không gắn cờ)

- Hàng "Công lắp đặt — Không theo kho" (mockup `all-screens.html` `s-inventory`): KHÔNG hiện — endpoint không trả sản phẩm `tracksStock=false` (không có số nào để hiện; danh mục đã có màn riêng).
- Cột "Đơn đang chờ" (DH-2051 · DH-2053) của danh sách cần mua: HOÃN tới 6.6 — cần ledger có đường ghi thật, và cần quyết phạm vi xem đơn (`KHO_GIAO` chỉ `orders.view_own` ⇒ hiện mã đơn người khác là rò dữ liệu). 
- Nút Phiếu nhập/Phiếu xuất, modal "Phiếu xuất · gắn đơn", banner CHẶN xuất: 6.3/6.4/6.5.
- Mockup mobile có nút "Danh sách cần mua (2 món)" mở chỗ khác; ở đây hiện khối inline (một cấp, không điều hướng — chưa có router).

### Kiểm thử — luật dự án áp dụng trực tiếp

- Luật (2) nửa "test lane DB": AC-4 chỉ có nghĩa trên Postgres thật (`groupBy` + LEFT JOIN + FK). Lane DB KHÔNG thay `npm test` — AC phải xanh ở cả hai.
- Luật (3)/(4)/(5)/(6) áp như ghi ở AC-8, 14, 15.
- Đếm gọi Prisma bằng `toHaveBeenCalledTimes(1)` (memory `publish-count-unasserted-duplicate-survives`).
- Fixture số dẫn xuất (fake port, unit test màn) KHÔNG nhẩm tay — chạy `tinhTonKho` in ra (memory `handpicked-fixture-numbers-hide-formula-bugs`).
- Widget test: fixture phải bật mọi điều kiện bao ngoài (vd khối "Danh sách cần mua" chỉ hiện khi không rỗng — test "ẩn" phải dùng fixture có item nhưng không âm, không phải fixture rỗng toàn bộ; memory `widget-test-gate-unreachable-outer-condition`).
- Source-guard dùng `stripToCode` sẽ xoá string literal (memory `striptocode-deletes-string-literals`) — guard schema đọc file RAW; guard service có thể strip.
- `describe.skip` không tách lane — DB spec đặt tên `*.db.integration.spec.ts` để `testPathIgnorePatterns` loại khỏi `npm test` (memory `describe-skip-does-not-separate-test-lane`).

### Previous Story Intelligence (6.1)

- 6.1 là story "đóng lane" thuần backend + fake port; 6.2 ngược lại — rộng (schema + 3 nền tảng). Khuôn kiểm thử 6.1 vẫn áp: mutation bằng `cp` backup, mutate MỌI dòng anh em cùng guard, mỗi mutant phải compile, bảng mutant → suite đỏ ghi vào Completion Notes.
- 6.1 review sửa 6 lỗi, một trong đó: fake port web/mobile lệch backend ⇒ test FE xanh trên hình dạng sai. Ở đây fixture fake PHẢI lấy số từ `tinhTonKho`, và tên field port khớp DTO từng chữ (`parity.test.mjs` sẽ kiểm field hai bên, nhưng KHÔNG kiểm khớp DTO backend — tự đối chiếu `openapi.json`).
- 6.1 Dev Notes ghi seam cho 6.4: phiếu xuất hook theo đích `dagiao`. Không liên quan trực tiếp 6.2, nhưng `stock_movements.order_version_id` là chỗ 6.4/6.6 nối vào — đừng đổi tên cột tuỳ hứng.

### Git intelligence

`fecbb6f` (6.1), `04ed832` (chống flake e2e + guard chống-rỗng), `9bd41ba` (phạm vi đường ghi đơn), `15f3532`, `dc35b74` (tooling web tsc/vite/vitest). Hệ quả cho story này: mọi e2e mới bind loopback; mọi guard mới chống-rỗng; màn web mới qua typecheck thật + ca render. Không thêm dependency mới ⇒ không cần tra phiên bản thư viện (NestJS 11, Prisma 7.8, React 19, Flutter 3.44 — giữ nguyên).

### Latest tech notes (Prisma 7.8)

- `groupBy` + `_sum` trên `Int` trả `number | null` (null khi không có dòng) ⇒ map `?? 0`.
- Lọc relation optional 1-1: `stockItem: { isNot: null }`.
- Migrate diff Prisma 7: `--from-schema` / `--to-schema` (không còn `--from-schema-datamodel`).

### Project Structure Notes

- Module `inventory/` đúng cây spine (`ARCHITECTURE-SPINE.md:449`). Route `/stock-items` theo CONVENTIONS (`backend/CONVENTIONS.md:12` — danh từ số nhiều kebab-case, theo entity `StockItem`).
- Tên hàm/biến domain tiếng Việt không dấu (`tinhTonKho`, `khaDung`, `canNhap`, `tinhTrang`) theo khuôn `orders/domain`.
- Không đặt mã story/AC vào comment code, tên test, migration (`review-audit-self-decision.md#Stable Code Artifacts`) — tên test mô tả hành vi.
- File mới kebab-case (guard `naming-convention`); Dart snake_case; React component PascalCase `*Screen.tsx` (guard đếm màn glob `**/*Screen.tsx`).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Nửa sau AC-2 (cảnh báo ở báo giá) chuyển 6.5** — mặc định như 🛑6. Đại Ca muốn làm luôn ở 6.2 thì thêm task sửa `CreateQuoteScreen` + `tracksStock` vào `CatalogProduct` hai nền tảng.
2. **Gate đọc tồn kho = `inventory.manage` OR `quotes.create_edit`** — mặc định như 🛑5. Muốn tách `inventory.view` riêng thì là thay đổi registry.
3. **Unique idempotency của `stock_movements`** — để 6.6 quyết; spine ghi `(orderId, orderVersionId)` không khả thi trên movement-per-product.
4. **Cột "Đơn đang chờ"** của danh sách cần mua — hoãn 6.6 (cần quyết phạm vi xem đơn).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2 (557-567), #Story 6.5 (584-590), #Story 6.6 (592-598)]
- [Source: ARCHITECTURE-SPINE.md#AD-19 (158-162), #AD-2 (57-58), ERD (242-252, 316-374), module tree (449)]
- [Source: prd.md#FR-25 (350-359), #FR-26 (361-367)]
- [Source: ux EXPERIENCE.md:47 (`s-inventory`), :84, :117-118; mockups/all-screens.html#s-inventory (3777+); epics.md UX-DR-10 (107), UX-DR-19 (116)]
- [Source: backend/src/accounts/domain/permission-registry.ts:58, role-presets.ts:107; backend/src/auth/permissions.guard.ts:30-78]
- [Source: backend/src/orders/orders.controller.ts:229-262 (khuôn endpoint đọc + OR gate)]
- [Source: web/src/screens/warranty/WarrantyLookupScreen.tsx, web/src/screens/orders/OrdersListScreen.tsx:83-165; mobile/lib/screens/warranty/warranty_lookup_screen.dart; mobile/test/screens/orders/order_detail_long_status_test.dart:82-115]
- [Source: design-system/screens/warranty-lookup.test.mjs; design-system/lib/assert-scanned.mjs; design-system/session/parity.test.mjs:23-46]
- [Source: _bmad-output/project-context.md; _bmad-output/story-automator/extra-instructions-6-dev.txt (luật dự án 1-7)]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- `npx prisma migrate diff --from-schema <bản schema trước> --to-schema prisma/schema.prisma --script` → `20261021080000_add_stock_items_and_movements/migration.sql`; `prisma validate` + `generate` xanh; `migrate deploy` lên `localhost:5433/phuong_nam_solar` (container `pns-postgres`) áp sạch.
- Ca DB lane đầu đỏ do kiểu trả của helper test (`Promise<Promise<…>>`) — sửa kiểu, không đổi logic.
- Widget test mobile "danh sách cần mua hiện" đỏ lần đầu: `AppFrame` in HOA nhãn ⇒ finder dùng chuỗi hoa.

### Completion Notes List

- **Schema:** `StockItem` (chỉ `onHand`, `productId` UNIQUE, FK RESTRICT) + `StockMovement` (ledger append-only, `qty` có dấu, FK RESTRICT tới `stock_items`/`orders`/`order_versions`, index `stock_item_id`). KHÔNG cột `reserved`; KHÔNG unique idempotency (để 6.6). Docstring schema ghi hợp đồng `reserved = SUM(qty)` trên toàn bộ dòng, không lọc `type`.
- **Domain:** `tinhTonKho` là nơi duy nhất tính `khaDung`/`canNhap`/`tinhTrang`.
- **Service:** 1 `product.findMany` (+`include: stockItem` = LEFT JOIN) + 1 `stockMovement.groupBy` — không N+1, không transaction, không ghi. Lọc tập `(tracksStock && isActive) || onHand≠0 || reserved≠0`. `danhSachCanMua` sắp `canNhap` giảm dần; hoà thì giữ thứ tự tên của DB (sort ổn định) — đã gỡ tie-break `localeCompare` vì đột biến cho thấy nó tương đương ngữ nghĩa (thừa) và có thể lệch collation DB.
- **Endpoint:** `GET /stock-items?q=&productIds=` gate `@RequireAnyPermissions(inventory.manage, quotes.create_edit)`; `productIds` CSV → mảng, `@IsUUID('4', {each})` ⇒ 400 `VALIDATION_ERROR` field `productIds` (đo ở e2e). OpenAPI sinh lại.
- **Nửa sau AC-2 (cảnh báo khi thêm dòng báo giá) CHUYỂN Story 6.5** — đúng quyết định 🛑6; `GET /stock-items?productIds=` là read model 6.5 tiêu thụ. Không đụng `CreateQuoteScreen`.
- **Ngoài bảng file dự kiến (1 chỗ):** `mobile/lib/design_system/components/card.dart` thêm `AppCardVariant.warn/danger` (token `AppTokens.warn/danger`) — `AppCard` chưa có viền nào cho AC-12 "viền warn khi het, danger khi am"; không hex, không đổi variant cũ.
- **Mobile không có ô tìm** (AC-12 không đòi; port vẫn nhận `q`).
- **Docs:** ERD spine bỏ `int reserved`, ghi chú `reserved = SUM(STOCK_MOVEMENT.qty)` + `qty` có dấu. `project-context.md` KHÔNG sửa — không có lệnh mới (lane DB dùng `npm run test:db` sẵn có).
- **Fixture fake web/mobile:** số dẫn xuất in ra bằng cách chạy `tinhTonKho` thật trên cặp (onHand, reserved), không nhẩm tay.
- **Đột biến (cp backup, mutant đều compile):**

  | Mutant | Kết quả |
  |---|---|
  | thêm `reserved Int` vào `model StockItem` | `inventory-read-only` ĐỎ |
  | thêm `this.prisma.stockItem.create(...)` vào service | `inventory-read-only` ĐỎ |
  | thêm `this.prisma.$transaction([])` | `inventory-read-only` + `stock-items.service` ĐỎ |
  | bỏ lọc ẩn-hết-sạch (`continue`) | service spec ĐỎ + DB lane ĐỎ |
  | map reserved theo `p.id` thay `stockItem.id` | service spec ĐỎ (3) + DB lane ĐỎ |
  | `canNhap > 0` → `>= 0` khi dựng danh sách cần mua | service spec ĐỎ |
  | bỏ tie-break theo tên | SỐNG — tương đương ngữ nghĩa ⇒ gỡ khỏi code |
  | web `{item.onHand - item.reserved}` | `inventory.test.mjs` ĐỎ |
  | mobile `am = item.khaDung < 0` | `inventory.test.mjs` ĐỎ |
  | web `items.filter(...)` dựng cần mua | `inventory.test.mjs` ĐỎ |
  | guard đọc web code rỗng (blind) | `inventory.test.mjs` ĐỎ (5) |

- **Cổng cuối (2026-10-21):** backend `npm test` 83 suite / 1542 test xanh (hermetic; DB spec không chạy trong lane này); `npm run test:db` 16 suite / 129 test xanh (Postgres 5433); `npx tsc --noEmit` sạch; eslint + prettier trên mọi file backend mình viết: 0 lỗi (toàn repo `npm run lint` 164 problems — nợ có sẵn, không file nào của story). Web: typecheck sạch, vitest 18/18, build xanh. Mobile: `flutter analyze` 0 issue, `flutter test` 273 xanh. Design-system `npm test` 407/407.

### File List

- `backend/prisma/schema.prisma` (M)
- `backend/prisma/migrations/20261021080000_add_stock_items_and_movements/migration.sql` (A)
- `backend/src/app.module.ts` (M)
- `backend/src/inventory/inventory.module.ts` (A)
- `backend/src/inventory/stock-items.controller.ts` (A)
- `backend/src/inventory/stock-items.service.ts` (A)
- `backend/src/inventory/domain/ton-kho.ts` (A)
- `backend/src/inventory/dto/stock-list-query.dto.ts` (A)
- `backend/src/inventory/dto/stock-list-response.dto.ts` (A)
- `backend/openapi/openapi.json` (M, sinh)
- `backend/test/ton-kho.spec.ts` (A)
- `backend/test/stock-items.service.spec.ts` (A)
- `backend/test/stock-items.e2e.spec.ts` (A)
- `backend/test/stock-items.db.integration.spec.ts` (A)
- `backend/test/inventory-read-only.spec.ts` (A)
- `web/src/design-system/session/inventory-port.ts` (A)
- `web/src/design-system/session/fake-inventory-port.ts` (A)
- `web/src/design-system/session/index.ts` (M)
- `web/src/design-system/gating/permissions.ts` (M)
- `web/src/design-system/shell/Sidebar.tsx` (M)
- `web/src/screens/inventory/InventoryScreen.tsx` (A)
- `web/src/screens/inventory/inventory.css` (A)
- `web/src/test/screens-render.test.tsx` (M)
- `mobile/lib/design_system/gating/app_permissions.dart` (M)
- `mobile/lib/design_system/components/card.dart` (M)
- `mobile/lib/design_system/session/inventory_port.dart` (A)
- `mobile/lib/design_system/session/fake_inventory_port.dart` (A)
- `mobile/lib/design_system/session/session.dart` (M)
- `mobile/lib/screens/inventory/inventory_screen.dart` (A)
- `mobile/test/screens/inventory/inventory_screen_test.dart` (A)
- `design-system/session/parity.test.mjs` (M)
- `design-system/screens/inventory.test.mjs` (A)
- `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` (M)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (M)
- `web/src/test/inventory-screen.test.tsx` (A — bước QA automation, bổ sung khi review)
- `_bmad-output/implementation-artifacts/tests/test-summary-story-6-2.md` (A — bước QA automation)

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI review, `/ck:code-review`) · **Ngày:** 2026-10-21 · **Kết quả:** Approve sau khi sửa — 0 CRITICAL, 0 HIGH; 3 MEDIUM + 4 LOW đã sửa hết.

### AC / Task

AC 1–15 đều có bằng chứng trong code + test (nửa sau AC-2 chuyển 6.5 đúng 🛑6). Mọi task `[x]` có thật. Luật dự án: (1) story không thêm đường ghi đơn — đột biến `this.prisma.order.update(...)` trong `src/inventory` ⇒ `inventory-read-only` ĐỎ; `no-unscoped-order-write` + `no-stock-write-in-cancel` vẫn xanh. (2) story đọc thuần, không có thao tác ghi tồn nào để khoá `FOR UPDATE` — guard (b) canh điều đó (đột biến ghi bên dưới); lane DB có và xanh. (3)(4)(5)(6) đạt.

### Finding đã sửa

| # | Mức | Finding | Sửa | Chứng minh |
|---|---|---|---|---|
| 1 | MEDIUM | Guard (b) mù với ghi bằng SQL thô: `$queryRaw\`UPDATE stock_items…\`` / `$queryRawUnsafe('UPDATE…')` trong service ⇒ guard VẪN XANH (đo bằng đột biến); unit test chỉ đỏ tình cờ vì mock thiếu `$queryRaw`. | `LENH_GHI` thêm `$queryRaw` (phủ cả `Unsafe`) + mẫu tự kiểm. | Đột biến `$queryRaw` UPDATE ⇒ guard ĐỎ. |
| 2 | MEDIUM | `q` không escape ký tự đại diện LIKE: Prisma `contains` đổ thẳng vào `ILIKE '%…%'` — đo trên Postgres 5433: `a_c` khớp "abc", `%` khớp mọi dòng ⇒ tìm SKU `INV_8K` kéo theo `INVX8K`. | `thoatLike()` escape `\ % _` trong service. Unit test + ca lane DB (`_`, `%`, chỉ `%`). | Gỡ escape ⇒ service spec ĐỎ + lane DB ĐỎ. |
| 3 | MEDIUM | Text-guard chỉ cấm so `khaDung` với số; `item.canNhap > 0` thay cho `tinhTrang === 'am'` (dẫn xuất tình trạng ở client, tương đương ngữ nghĩa nên test hành vi không thấy) SỐNG ở cả web lẫn mobile. | Cấm so MỌI số tồn (`khaDung/canNhap/onHand/reserved`) với hằng hoặc với nhau; thêm mẫu tự kiểm. | Đột biến web `canNhap > 0` và mobile `am = item.canNhap > 0` ⇒ `inventory.test.mjs` ĐỎ. |
| 4 | LOW | Guard (a) chỉ quét `model StockItem` — AC-1 "không cột `reserved` ở đâu cả"; thêm `reservedQty` vào `Product` lọt guard. | Quét MỌI khối `model`, chống rỗng: >10 khối, có `Product/StockItem/StockMovement`. | Đột biến `Product.reservedQty Int` ⇒ guard ĐỎ. |
| 5 | LOW | `?productIds=a&productIds=b,c` (lặp tham số ⇒ Express trả mảng) không được tách CSV ⇒ 400 với UUID hợp lệ. | `@Transform` gộp mảng rồi tách CSV từng phần tử. Ca e2e mới. | Gỡ nhánh mảng ⇒ e2e ĐỎ. |
| 6 | LOW | Lane DB "unique product_id" dùng `rejects.toThrow()` — lỗi bất kỳ cũng xanh. | Assert message `Unique constraint\|stock_items_product_id_key`. | Lane DB xanh. |
| 7 | LOW | File List thiếu `web/src/test/inventory-screen.test.tsx` + test summary (thêm ở bước QA). | Bổ sung File List. | — |

### Ghi nhận, KHÔNG sửa ở 6.2 (bàn giao)

- **Đọc xé (torn read) khi 6.4 tới:** service đọc `onHand` (findMany) và `reserved` (groupBy) bằng HAI câu lệnh dưới READ COMMITTED. Hôm nay không có đường ghi nào nên không thể xé. Khi phiếu xuất 6.4 trừ `onHand` VÀ ghi movement âm trong một transaction, một lần đọc rơi giữa hai câu có thể thấy `onHand` cũ + `reserved` mới (khả dụng phồng tạm thời). 6.4 phải chọn: gộp thành MỘT câu SQL (LEFT JOIN + SUM con) hoặc đọc trong transaction `REPEATABLE READ` (khi đó nới AC-6/guard (b) có chủ đích).
- `customers.service.ts:316` cũng dùng `contains` không escape — nợ có sẵn, ngoài phạm vi story.

### Cổng sau sửa (2026-10-21)

backend `npm test` 83 suite / 1552 test xanh · `npm run test:db` 16 suite / 131 test xanh (Postgres 5433) · `tsc --noEmit` sạch · eslint + prettier sạch trên file story · web typecheck sạch, vitest 26/26, build xanh · mobile `flutter analyze` 0 issue, `flutter test` 273 xanh · design-system 407/407.

## Change Log

- 2026-10-21 — Story 6.2 dev: schema `stock_items` + ledger `stock_movements` (không cột `reserved`), domain `tinhTonKho`, `GET /stock-items` (đọc thuần, gate OR), lane unit/e2e/DB + source-guard; màn Tồn kho web + mobile qua port đọc, parity + text-guard; ERD spine cập nhật. Cảnh báo ở báo giá chuyển 6.5.
- 2026-10-21 — Review (AI): sửa 7 finding (guard ghi SQL thô, escape LIKE cho `q`, text-guard cấm dẫn xuất tình trạng từ số, guard `reserved` quét mọi model, `productIds` lặp tham số, assert unique chặt, File List). Status → done.
