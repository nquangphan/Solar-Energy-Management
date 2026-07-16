---
baseline_commit: c0e82ee9688db57738581c68aeb441d0c314bc8a
---

# Story 4.1: Tạo Đơn + dựng giỏ hàng + snapshot Order.sourceId (Order/OrderVersion/OrderLineItem)

Status: done

## Story

As a **người có quyền tạo báo giá** (`quotes.create_edit`),
I want **tạo Đơn mới và thêm/sửa/xoá Dòng báo giá kiểu giỏ hàng**,
so that **dựng báo giá ngay tại hiện trường, chọn khách qua tra SĐT, và mọi dòng dữ liệu nằm đúng mô hình Order/OrderVersion/OrderLineItem chuẩn AD-6**.

## Acceptance Criteria

*(AC-1..AC-5 nguyên văn từ epics.md — Story 4.1, dòng 410-417)*

1. **Mô hình dữ liệu (AD-6, AD-15):** `OrderVersion` sở hữu TẤT CẢ line item, `Order` không sở hữu line trực tiếp; `Order` có `ownerAccountId` + `assigneeAccountId` (nullable); mọi đọc dòng phân giải qua `currentVersionId`.
2. **CRUD Dòng báo giá (FR-1, UX-DR-24):** thêm/sửa/xoá dòng — dòng pick từ Sản phẩm auto-điền đơn giá theo danh mục hiện tại (trước chốt); dòng tự do/gói nhập tay (tên nhiều dòng, đơn vị, số lượng, đơn giá, diễn giải); cờ "linh động/dự kiến" chỉ hiển thị.
3. **Event + chọn khách (AD-18):** tạo Đơn publish domain event `OrderCreated` qua EventBus **And** chọn Khách hàng qua tra SĐT (tái dùng luồng Epic 3).
4. **Snapshot nguồn (§1, FR-35):** tạo Đơn từ Khách hàng có `sourceId` → **snapshot `Order.sourceId` lúc tạo**, copy từ `Customer.sourceId` — khách quay lại qua kênh khác thì `Customer.sourceId` đổi nhưng đơn cũ giữ nguyên kênh (cùng bài học `unitPriceSnapshot`, FR-5).
5. **priceEditable + gói (§2):** dòng từ Product có `priceEditable=true` (phí lắp đặt) → dòng có `priceEditable=true`, giá sửa được; gói vật tư đẻ ra dòng trỏ Product thật — mỗi item tick thành một `OrderLineItem` bình thường.

*Bổ sung chất lượng (theo chuẩn dự án):*

6. **Quality gates:** `cd backend && npm test` xanh (source-guard + drift-guard + unit + e2e); `cd design-system && npm test` xanh (guard màn mới + parity port/component); `cd mobile && flutter analyze && flutter test` xanh; widget test BẮT BUỘC cho màn mobile mới (quyết định C-4). OpenAPI regen, không sửa tay spec (AD-12).

## Tasks / Subtasks

- [x] Task 1: Prisma schema — 3 model mới `Order`/`OrderVersion`/`OrderLineItem` + migration (AC: 1, 4, 5)
  - [x] Thêm 3 model vào `backend/prisma/schema.prisma` theo đặc tả ở Dev Notes §Mô-hình-dữ-liệu (PascalCase model, `@@map` snake_case số nhiều, mọi field `@map` snake_case, tiền `Int` đồng, UUID v4)
  - [x] Quan hệ vòng `Order.currentVersionId ↔ OrderVersion.orderId`: hai named relation (`"OrderCurrentVersion"` + `"OrderVersions"`), `currentVersionId String? @unique`
  - [x] Sinh migration OFFLINE: `prisma migrate diff --from-schema <schema HEAD> --to-schema prisma/schema.prisma --script` → file `backend/prisma/migrations/<timestamp>_add_orders/migration.sql` (dự án dùng diff + `migrate deploy`, KHÔNG `migrate dev`); header ghi cách sinh như các migration trước
  - [x] `npm run prisma:generate`
- [x] Task 2: Domain thuần `backend/src/orders/domain/` (AC: 3)
  - [x] `order-events.ts`: `OrderCreated`, `OrderLineAdded`, `OrderLineUpdated`, `OrderLineRemoved` implements `DomainEvent` (type/occurredAt/actorAccountId/target/before/after) — soi gương `customers/domain/customer-events.ts`
  - [x] `line-amount.ts`: hàm thuần `lineAmount(unitPrice: number, qty: number): number` = `unitPrice * qty` integer đồng — hạt giống cho hàm pricing đầy đủ của Story 4.2 (AD-16: pricing sống ở `orders/domain`)
  - [x] `order-status.ts`: hằng `TRANG_THAI_BAO_GIA = 'baogia'` + type khoá trạng thái — COPY nguyên văn bộ khoá từ `StatusKey` của `web/src/design-system/components/StatusChip.tsx:7-17`, đừng tự chế; 4.1 CHỈ gán lúc INSERT — mọi THAY ĐỔI status thuộc `applyTransition()` Story 5.1 (AD-11)
- [x] Task 3: Module `backend/src/orders/` — controller/service/DTO (AC: 1-5)
  - [x] `orders.module.ts` (`imports: [FeatureFlagsModule]` — Prisma/Events là `@Global` nhưng FeatureFlagsModule KHÔNG global, soi `catalog.module.ts:28`), đăng ký vào `app.module.ts`
  - [x] `POST /orders` (`@RequirePermissions(PERM.quotesCreateEdit)`): body `{ customerSdt }` → tra Customer (404 nếu không có), tạo Order (status `'baogia'`, `ownerAccountId` = actor từ `@CurrentAccount()`, `custType` copy từ `Customer.custType`, **`sourceId` copy từ `Customer.sourceId`**) + OrderVersion `versionNo=1` + repoint `currentVersionId` — MỘT `$transaction` array với id sinh trước bằng `randomUUID()` (order tạo với pointer null → tạo version → update pointer); publish `OrderCreated` SAU khi transaction commit
  - [x] `GET /orders/:id` (`@RequirePermissions(PERM.quotesCreateEdit)` — xem Dev Notes §Quyền): trả Order + dòng phân giải QUA `currentVersionId`; mỗi dòng kèm `amount` backend tính bằng `lineAmount()`; dòng catalog `priceEditable=false` trả đơn giá SỐNG từ danh mục (Dev Notes §Giá-trước-chốt); tổng đơn KHÔNG trả ở story này (4.2)
  - [x] `POST /orders/:id/line-items`: hai dạng — (a) `productId` + `qty` (+ `unitPrice` CHỈ được nhận khi `Product.priceEditable=true`, ngược lại 400): backend auto-điền `unitPrice` qua `resolveUnitPrice()` của Story 3.2, copy `name`/`unit`/`priceEditable`/`warrantyMonths` từ Product; (b) dòng tự do: `name` (nhiều dòng) + `unit` + `qty` + `unitPrice` + `note?`, `priceEditable=true`; cả hai nhận `isFlexible?`, `note?`; `displayOrder` = cuối danh sách
  - [x] `PATCH /orders/:id/line-items/:lineId`: sửa `qty`/`note`/`isFlexible`; `unitPrice` chỉ khi dòng `priceEditable=true` (ngược lại 400 + fieldErrors); `DELETE .../:lineId` → 204
  - [x] Mọi mutation dòng: chỉ khi `status === 'baogia'` (khác → 409 CONFLICT; sửa sau chốt là Story 4.6); ghi vào version đang trỏ bởi `currentVersionId`; publish event dòng tương ứng sau commit (FR-20 audit)
  - [x] DTO: class-validator theo luật `@IsOptionalNotNull()` cho cột NOT NULL (CẤM `PartialType`), `@IsInt() @Min(0)` cho tiền, `@Min(1)` cho qty, `@Transform(trim)` + `@IsNotEmpty()` cho `name` dòng tự do (bịt lỗ TD-21), `@ApiProperty` đủ (field nullable khai `type` tường minh — union sinh `"type":"object"` hỏng codegen)
  - [x] Lỗi qua `AppException` — controller KHÔNG nặn envelope (AD-5)
- [x] Task 4: Xác minh quyền đọc danh mục cho picker (AC: 2, 5)
  - [x] Kiểm `GET /products`, `GET /products/:id`, `GET /product-groups`, `GET /product-groups/:id` đều gate `PERM.catalogView` (commit 5b44e74 đã sửa — XÁC MINH, không sửa lại); nếu route đọc nào còn `catalogManage` → chuyển sang `catalogView` (THO_KS phải dựng được giỏ hàng)
  - [x] KHÔNG thêm key quyền mới — `quotes.create_edit` đã có sẵn trong registry 21 key → không cần regen permissions
- [x] Task 5: OpenAPI: `npm run openapi:gen` → commit `backend/openapi/openapi.json` mới (drift-guard bắt lệch)
- [x] Task 6: Test backend (AC: 1-6)
  - [x] Unit `backend/test/orders.service.spec.ts` (mock Prisma): assert PAYLOAD `data`/`where`, không đếm call — (a) tạo đơn: transaction đúng 3 op, `sourceId` trong `data` = `Customer.sourceId`, `ownerAccountId` = actor, status `'baogia'`, `versionNo: 1`; (b) thêm dòng catalog: `unitPrice` lấy từ `resolveUnitPrice`, bỏ qua giá client khi `priceEditable=false`; (c) sửa `unitPrice` dòng không editable → AppException; (d) mutation khi status ≠ baogia → 409; (e) event publish SAU commit với before/after đúng
  - [x] e2e `backend/test/orders.e2e.spec.ts` (mock Prisma đủ MỌI model request chạm — thiếu model → 500 cả suite): 401 không token; 403 token thiếu `quotes.create_edit`; happy path 4 endpoint; envelope lỗi chuẩn; route tĩnh khai trước `:param`
  - [x] DB lane `backend/test/orders.db.integration.spec.ts` (skip khi vắng `DATABASE_URL`): FK vòng Order↔OrderVersion tạo được trong transaction; đổi `Customer.sourceId` SAU khi tạo đơn → `Order.sourceId` GIỮ NGUYÊN (bản chất snapshot); FK `OrderLineItem.productId` RESTRICT — *spec đã viết; Postgres cục bộ không chạy được trong phiên dev (Docker daemon không lên) → cần chạy `npm run test:db` khi có DB, xem Debug Log*
  - [x] Mutation spot-check (kỷ luật từ 2.10): mutant biên dịch sạch, phục hồi bằng `cp` KHÔNG `git checkout`; tối thiểu: hoán đổi `sourceId` snapshot thành đọc live → test (b DB) phải RED; bỏ guard status baogia → test (d) phải RED — *mutant A (sourceId sai nguồn): unit RED 1; mutant B (guard no-op): unit RED 3; cả hai compile sạch, đã phục hồi*
- [x] Task 7: Mở rộng design-system — Checkbox mới + tách quyền sửa giá trên CartLineRow (AC: 2, 5)
  - [x] `CartLineRow`/`AppCartLineRow` hiện chỉ có MỘT prop `editable` gate CẢ qty lẫn unitPrice (`CartLineRow.tsx:68-96`, `cart_line_row.dart:57-88`) — nhưng AC-2 đòi sửa số lượng cho MỌI loại dòng còn giá chỉ sửa được khi `priceEditable=true`. Mở rộng component: thêm prop `priceEditable?: boolean` (mặc định = `editable`) — input qty theo `editable` (luôn `true` khi đơn còn `baogia`), input đơn giá theo `priceEditable`; sửa CẢ twin Dart, giữ parity test xanh. KHÔNG render input đơn giá "sống nhưng câm" (editable + bỏ onUnitPriceChange) — input đổi được mà giá trị không đổi là UX gãy
  - [x] `web/src/design-system/components/Checkbox.tsx` — control thật (không phải `<span class="tick">` tĩnh của mockup): touch target ≥44px, label đọc được, viền nét không shadow; export vào barrel `components/index.ts`; style vào `components.css`
  - [x] Twin Dart `mobile/lib/design_system/components/checkbox.dart` (`AppCheckbox`) — export vào `components.dart`
  - [x] Thêm cặp file vào map `parityFiles` của `design-system/components/parity.test.mjs`; qua được `a11y-floor.test.mjs`
- [x] Task 8: Port FE mới — orders + catalog (web + mobile + fake + parity) (AC: 2, 3, 5)
  - [x] `web/src/design-system/session/orders-port.ts`: interface `OrdersPort { create(input); get(id); addLine(orderId, input); updateLine(orderId, lineId, input); removeLine(orderId, lineId) }` + DTO + `OrderPortError { message, fieldErrors? }` (soi gương `customers-port.ts`); `fake-orders-port.ts` in-memory; export từ `session/index.ts`
  - [x] `web/src/design-system/session/catalog-port.ts`: `CatalogPort { listProducts(search?); listGroups(); getGroup(id) }` (+ fake, payload item gói kèm `isActive` từng product); export
  - [x] Twin Dart: `mobile/lib/design_system/session/orders_port.dart`, `catalog_port.dart` + fake, export từ `session.dart`; thêm **4 entry** vào `parityFiles` của `design-system/session/parity.test.mjs` (port + fake mỗi cặp, như customers ở dòng 26-27)
  - [x] Port chỉ là hợp đồng + fake (chưa có HTTP client — TODO(app-runtime) như các port hiện hữu); transport CHỈ qua port tiêm (guard cấm `fetch(`/`axios`/`package:http`/`dio`)
- [x] Task 9: Màn web Tạo báo giá (s-quote) (AC: 2-5)
  - [x] `web/src/screens/orders/CreateQuoteScreen.tsx` + `web/src/screens/orders/orders.css`; props `{ ordersPort, catalogPort, customersPort, onDone? }`; shell tự host (`WebShell` + `Sidebar activeKey="orders"` + `filterNav(SIDEBAR_NAV, perms)` + `usePermissions()`)
  - [x] Bước 1 — chọn khách: khi chưa có đơn, render `<CustomerPickScreen port={customersPort} onSelect={...}/>` LÀM TOÀN BỘ view (màn pick TỰ HOST shell riêng — `CustomerPickScreen.tsx:134-136` — KHÔNG bọc nó trong shell của CreateQuoteScreen, tránh shell-lồng-shell; prop tên `port`, không phải `customersPort`); `onSelect(customer)` → `ordersPort.create({ customerSdt })` → sang bước giỏ hàng; shell của CreateQuoteScreen chỉ render từ bước 2. Mobile tương tự với `AppMobileShell`
  - [x] Bước 2 — giỏ hàng: `Table` + `CartLineRow` (name/qty/unitPrice/amount server trả; `editable=true` khi đơn còn `baogia`, prop mới `priceEditable` theo `priceEditable` của dòng — xem Task 7; `flag` khi `isFlexible`, `onDelete`); 3 đường thêm dòng: "Chọn từ danh mục" (tìm/chọn Product qua `catalogPort.listProducts`), "Chọn gói vật tư" (`Sheet` + checklist `Checkbox` từng item — item `isActive=false` hiển thị disabled; MỖI item tick → gọi `addLine({productId})` thành dòng thường; KHÔNG lưu vết gói/groupName lên đơn), "Dòng tự do" (form name nhiều dòng/unit/qty/unitPrice/note)
  - [x] Khu tổng tiền: render nhãn Tổng trước VAT / Tiền VAT / Tổng sau VAT với giá trị "—" (placeholder) — Story 4.2 nối `preview-total`; client CẤM số học tiền (chỉ hiển thị `amount` backend trả)
  - [x] Trạng thái list chuẩn UX-DR-19 + lỗi port: render `message` backend NGUYÊN VĂN, map `fieldErrors` vào field; **lỗi mạng KHÔNG được xoá dòng đã nhập** (giữ state + Banner/ErrorState "Thử lại")
- [x] Task 10: Màn mobile Tạo báo giá + widget test (AC: 2-5, 6)
  - [x] `mobile/lib/screens/orders/create_quote_screen.dart` — StatefulWidget, port tiêm qua constructor, `AppPhoneFrame` + `AppMobileShell` + `AppBottomNav(activeIndex: 2)` (tab Tạo); dùng `AppCartLineRow` (truyền `id` dòng cho Dismissible swipe-xoá), `AppSheet` cho picker (lựa chọn nhanh — đúng UX-DR-20), copy tiếng Việt BYTE-IDENTICAL với web; KHÔNG `Expanded` trong shell (shell đã bọc `SingleChildScrollView`) — dùng `shrinkWrap` + `NeverScrollableScrollPhysics`
  - [x] Widget test `mobile/test/screens/orders/create_quote_screen_test.dart` (BẮT BUỘC — C-4): màn render được; chọn khách → tạo đơn qua fake port; thêm dòng catalog hiển thị đúng; dòng `priceEditable=false` không cho sửa giá; xoá dòng; lỗi port hiển thị message nguyên văn (subclass fake port ném `OrderPortException`); pattern `_host(...)` + `find.widgetWithText` như `customer_screens_test.dart` — 7 case, kèm case gói-vật-tư (tick/disabled) và case lỗi-giữ-dòng
  - [x] `dart format -o none --set-exit-if-changed <file mới>` (CẤM format cả cây — cascade ~20 file cũ)
- [x] Task 11: Guard design-system cho màn orders (AC: 6)
  - [x] `design-system/screens/orders.test.mjs` — soi gương `customers.test.mjs`: tồn tại đủ 2 nền tảng; chỉ compose từ design-system (cấm `<input>`/`<button>` trần); transport chỉ qua port; nhãn tiếng Việt byte-identical web↔mobile; không permission literal; negative assert riêng story: cấm chuỗi số học tiền client (`*`/`+` trên unitPrice×qty trong màn), cấm persist `groupName` — *guard đã mutation-check: mutant `line.unitPrice * line.qty` lọt bản regex đầu (false-PASS) → vá regex nhận operand có tiền tố `line.`, xác nhận RED rồi mới nhận*
- Review Follow-ups (AI)
  - [ ] [AI-Review][Medium] Lane backend FLAKE khi chạy full song song: 1 lần chạy có 2 suite fail (`customer-sources.e2e` "active/isOther trong body PATCH ⇒ bị cắt" assert `not.toHaveProperty('active')`), chạy solo và full lần sau xanh 49/49. Không do file 4.1 — điều tra isolation/worker riêng [backend/test/customer-sources.e2e.spec.ts:395]
  - [ ] [AI-Review][Low] Prop `onDone` khai ở cả hai màn Tạo báo giá nhưng chưa đường nào gọi — quyết định giữ/bỏ khi làm Chốt (4.5) [web/src/screens/orders/CreateQuoteScreen.tsx:56; mobile/lib/screens/orders/create_quote_screen.dart:48]
  - [ ] [AI-Review][Low] Web free-line: xoá trắng ô Số lượng/Đơn giá ⇒ `Number('')=0` âm thầm (backend chặn 400 kèm fieldErrors — chấp nhận được, cân nhắc UX khi có app-runtime) [web/src/screens/orders/CreateQuoteScreen.tsx:433]
  - [ ] [AI-Review][Low] Mobile catalog picker: callback search có thể `setSheetState` sau khi sheet đã đóng (race nhỏ, demo-only) [mobile/lib/screens/orders/create_quote_screen.dart:255-261]
- [x] Task 12: Chạy đủ 4 lane + cập nhật sprint-status (AC: 6)
  - [x] `cd backend && npm test` · `cd design-system && npm test` · `cd mobile && flutter analyze && flutter test` · (DB lane nếu có Postgres: `npm run test:db`) — backend 49 suite/733 test xanh; design-system 265 test xanh; mobile analyze sạch + 153 test xanh; DB lane: spec sẵn, Postgres cục bộ không bật được trong phiên (xem Debug Log)
  - [x] `sprint-status.yaml`: `4-1-... : review` khi dev xong

## Dev Notes

### Bối cảnh & ranh giới story (ĐỌC TRƯỚC KHI CODE)

Story đầu tiên của Epic 4 — dựng nền móng dữ liệu + giỏ hàng. Backend CHƯA có module `orders/` (greenfield hoàn toàn); Prisma hiện có 12 model, chưa có Order nào. **Làm ĐÚNG phạm vi — các thứ sau là của story khác, CẤM làm trước:**

| KHÔNG làm | Thuộc story |
|---|---|
| `POST /orders/preview-total`, mọi tính tổng/VAT hiển thị | 4.2 |
| Preset cờ phạm vi theo Loại khách, toggle cờ (cột thì tạo ngay) | 4.3 |
| Nhập/áp VAT, kWp (hành vi); cột hạn hiệu lực KHÔNG tạo ở 4.1 (ERD không có — 4.4 tự thêm migration) | 4.4 |
| Chốt, freeze `unitPriceSnapshot`/`catalogPriceSnapshot`/`vatRate`/`vatMode`, event `OrderConfirmed` | 4.5 |
| Sửa đơn đã chốt = version mới, re-snapshot | 4.6 |
| Hành vi ô bảo hành, freeze `warrantyStartAt` (cột thì tạo ngay) | 4.9 |
| `applyTransition()`, mọi THAY ĐỔI `Order.status` | 5.1 |
| `StockMovement`/reserve/cảnh báo tồn ("Báo giá nháp → không đụng" kho, §2) | 6.6 |

[Source: _bmad-output/planning-artifacts/epics.md#Story-4.1 (dòng 410-417); docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md §1 §2 §3]

### Mô hình dữ liệu (AD-6 — bất biến cốt lõi)

ERD spine + quy ước schema hiện hành ([Source: ARCHITECTURE-SPINE.md#AD-6 + #Core-entity-ERD; backend/prisma/schema.prisma quy ước dòng 119-291]):

```prisma
model Order {
  id               String    @id @default(uuid())
  status           String    @map("status")            // khoá 'baogia' lúc tạo; đổi = applyTransition (5.1)
  customerSdt      String    @map("customer_sdt")      // FK -> customers.sdt (ERD: CUSTOMER ||--o{ ORDER)
  currentVersionId String?   @unique @map("current_version_id") // POINTER CHÂN LÝ DUY NHẤT (AD-6)
  ownerAccountId   String    @map("owner_account_id")  // AD-15: người tạo/phụ trách
  assigneeAccountId String?  @map("assignee_account_id")
  sourceId         String    @map("source_id")         // SNAPSHOT từ Customer.sourceId lúc tạo (FR-35)
  custType         String    @map("cust_type")         // nhãn báo cáo, copy từ Customer lúc tạo
  scopeThietBi     Boolean   @default(true)  @map("scope_thiet_bi")   // hành vi preset = 4.3
  scopeThiCong     Boolean   @default(false) @map("scope_thi_cong")
  scopeVanChuyen   Boolean   @default(false) @map("scope_van_chuyen")
  kWp              Int?      @map("k_wp")              // hành vi nhập = 4.4
  vatMode          String?   @map("vat_mode")          // hành vi = 4.4
  createdAt/updatedAt chuẩn
  @@index([customerSdt]) @@index([ownerAccountId]) @@index([sourceId])
  @@map("orders")
}
model OrderVersion {
  id        String    @id @default(uuid())
  orderId   String    @map("order_id")
  versionNo Int       @map("version_no")   // 4.1 luôn tạo versionNo=1
  vatRate   Int?      @map("vat_rate")     // null tới 4.4/4.5
  vatMode   String?   @map("vat_mode")
  chotAt    DateTime? @map("chot_at")      // null tới 4.5
  createdAt/updatedAt chuẩn                // updatedAt cần: 4.5/4.6 sẽ ghi chotAt/vatRate lên row
  @@unique([orderId, versionNo]) @@map("order_versions")
}
model OrderLineItem {
  id                   String   @id @default(uuid())
  orderVersionId       String   @map("order_version_id")   // CHỦ SỞ HỮU duy nhất của dòng
  productId            String?  @map("product_id")          // null = dòng tự do; FK RESTRICT (Product soft-delete vì FK này)
  name                 String                              // nhiều dòng; copy từ Product lúc thêm hoặc nhập tay
  unit                 String
  qty                  Int
  unitPrice            Int      @map("unit_price")          // integer đồng (AD-10); xem §Giá-trước-chốt
  priceEditable        Boolean  @default(false) @map("price_editable") // copy từ Product / true với dòng tự do
  isFlexible           Boolean  @default(false) @map("is_flexible")    // cờ "linh động/dự kiến" — CHỈ hiển thị
  note                 String?                              // diễn giải
  warrantyMonths       Int?     @map("warranty_months")     // copy default từ Product; hành vi = 4.9
  unitPriceSnapshot    Int?     @map("unit_price_snapshot")   // null tới Chốt (4.5)
  catalogPriceSnapshot Int?     @map("catalog_price_snapshot")// null tới Chốt (4.5)
  costPriceSnapshot    Int?     @map("cost_price_snapshot")   // null tới xuất kho (6.4, AD-20)
  warrantyStartAt      DateTime? @map("warranty_start_at")    // null tới 4.9
  displayOrder         Int      @map("display_order")
  createdAt/updatedAt chuẩn
  @@index([orderVersionId]) @@index([productId]) @@map("order_line_items")
}
```

- **KHÔNG Prisma enum** — dự án cố ý dùng String + validate tầng app (như `Customer.custType`); `Order.status` giữ String với bộ khoá COPY NGUYÊN VĂN từ `StatusKey` chip design-system (`web/src/design-system/components/StatusChip.tsx:7-17` — lưu ý key là `thicong`, KHÔNG phải `dangthicong`) — 4.1 chỉ dùng `'baogia'`, bảng transition là của 5.1.
- **Relation khai TƯỜNG MINH** (convention hiện hành, như `Customer.source`/`Session.account`): `customer Customer @relation(fields: [customerSdt], references: [sdt])`; `source CustomerSource @relation(fields: [sourceId], references: [id])` (ERD: `ORDER ||--o| CUSTOMER_SOURCE`); owner/assignee → `Account`; thiếu relation = migration ship KHÔNG có FK constraint và DB-lane test không có gì để bám.
- **`OrderLineItem.productId` PHẢI ghi `onDelete: Restrict` tường minh:** `product Product? @relation(fields: [productId], references: [id], onDelete: Restrict)` — default Prisma cho relation OPTIONAL là `SetNull`, nghĩa là xoá Product âm thầm biến dòng catalog thành "dòng tự do"; chỉ DB lane (skippable) mới bắt được nếu quên.
- **FK vòng:** `Order.currentVersionId → order_versions.id` và `OrderVersion.orderId → orders.id` — hai named relation Prisma; tạo đơn = transaction 3 bước id-sinh-trước (xem Task 3). KHÔNG suy ra bản hiệu lực từ timestamp/đếm version — CHỈ pointer (AD-6).
- **KHÔNG cột `groupName`/`groupId` trên OrderLineItem** — gói vật tư không bao giờ persist lên đơn (§2, bàn giao 3.6); chuỗi "· gói Hybrid 8kW" trong mockup là provenance phiên picker — bỏ, không lưu.
- Migration: SQL tay từ `prisma migrate diff` (Prisma 7 chỉ nhận `--from-schema`/`--to-schema`; URL nằm ở `prisma.config.ts`, KHÔNG ở datasource block). Diff từ schema HEAD: `git show HEAD:backend/prisma/schema.prisma`.

[Source: ARCHITECTURE-SPINE.md#AD-6 #AD-10 #AD-15 #AD-20; docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md §1 §2 §3; 3-1-crud-san-pham-gia.md#Prisma-7-warnings]

### Giá trước chốt (quyết định thiết kế — đọc kỹ)

FR-5/FR-14: đơn CHƯA chốt luôn lấy giá danh mục MỚI NHẤT; giá chỉ đóng băng lúc Chốt (4.5). Cách thực hiện trong 4.1:

- Lúc THÊM dòng catalog: backend auto-điền `unitPrice` = `resolveUnitPrice()` (hàm thuần Story 3.2 tại `backend/src/catalog/domain/price-resolution.ts:44`, đã edge-test) — client không gửi giá (trừ `priceEditable=true`). **Hợp đồng hàm:** input `{ basePrice: Product.price, tiers: ProductPrice[{minQty, price}], quantity, tieredPricingEnabled }` — cờ resolve ở CONTROLLER qua `featureFlags.isEnabled(FLAG.catalogTieredPricing)` rồi truyền boolean xuống service (pattern `products.controller.ts:78-79`); CẤM hardcode cờ. `basePrice` là field **`Product.price`** (KHÔNG tồn tại field `Product.unitPrice` — epics 4.5 viết nhầm tên).
- Lúc ĐỌC (`GET /orders/:id`): với dòng catalog `priceEditable=false`, response trả đơn giá SỐNG tính lại từ danh mục hiện hành qua CÙNG `resolveUnitPrice()` + cờ (không cần ghi đè DB — giá trị lưu chỉ là cache lúc nhập); dòng `priceEditable=true` và dòng tự do trả giá đã lưu. `unitPriceSnapshot` để NULL — 4.5 mới freeze.
- `amount` mỗi dòng = `lineAmount(unitPriceHiệuLực, qty)` tính server-side trong response DTO — client CẤM số học tiền (AD-16); tổng đơn (subtotal/VAT/total) KHÔNG trả — 4.2.

### Quyền (AD-17, AD-4)

- **Key gate tạo/sửa báo giá: `quotes.create_edit`** (nhãn "Tạo/sửa báo giá") — ĐÃ TỒN TẠI trong registry, **KHÔNG có key `orders.create`**, không thêm key mới → không đụng registry/role-presets/2 lần regen permissions. Registry 21 key tại `backend/src/accounts/domain/permission-registry.ts` (comment header nói "20" — stale, tin code).
- `GET /orders/:id` trong 4.1 gate `quotes.create_edit` (luồng người dựng đơn); scope xem `orders.view_all`/`orders.view_own` (lọc theo `ownerAccountId`/`assigneeAccountId`) là của Story 5.3 — guard hiện AND-only (`required.every`), không diễn đạt OR được, đừng cố.
- Import: `RequirePermissions` từ `../auth/require-permissions.decorator`, `PERM` từ `../accounts/domain/permission-registry` — guard/decorator sống ở `auth/`, KHÔNG `common/` (variance Epic 2 đã ghi nhận). Source-guard `no-handler-without-require-permissions` fail-closed: MỌI handler không `@Public` phải có decorator.
- Picker cần đọc danh mục bằng `catalog.view` (THO_KS có key này sau commit 5b44e74 — "gỡ mìn THO_KS"; preset THO_KS vốn không có `catalog.manage`): XÁC MINH các GET products/product-groups đã gate `catalogView`; đây là điều kiện để kỹ thuật viên khảo sát dựng được giỏ hàng.

[Source: backend/src/accounts/domain/permission-registry.ts; epic-3-retro-2026-07-14.md §7; commit 5b44e74]

### EventBus + Audit (AD-18, FR-20)

- `EventBus` abstract class (DI token) từ `../events/event-bus`, `@Global` — publish SAU khi `$transaction` resolve (pattern đã chứng minh 6 story Epic 3). `AuditSubscriber` tự bắt mọi event, không cần đăng ký; CẤM inject `AuditService`/`NotificationDispatcher` từ service nghiệp vụ (source-guard `no-direct-side-effect-outside-eventbus` bắt).
- Event mới ở `orders/domain/order-events.ts`, soi gương `customer-events.ts`: class thuần + snapshot interface, `target = { type: 'Order', id }`, `before`/`after` đầy đủ (audit ghi sự thật bất kể quyền người xem). Nullable Json trong audit đã có helper `toJsonInput` (`audit.service.ts`) — `Prisma.JsonNull`, không bare `null`.
- FR-20 đòi audit MỌI mutation → line add/update/remove cũng publish event (không chỉ `OrderCreated`).

### Service & transaction — bẫy đã trả giá (Epic 3)

- Service đúng 2 dependency: `PrismaService` + `EventBus`; flags/quyền resolve ở controller truyền boolean xuống.
- `$transaction` array + `SELECT ... FOR UPDATE` khi có delete-then-insert cạnh tranh (template chuẩn `product-groups.service.ts:338` — READ COMMITTED làm `$transaction` trần KHÔNG đủ); 4.1 line CRUD là create/update/delete đơn lẻ nên chưa cần atomic-replace, NHƯNG tạo-đơn-3-bước phải nằm trong MỘT `$transaction`.
- `createMany({ data: [] })` phá atomic trên Prisma 7 + adapter-pg — nếu code đường nào nhận mảng rỗng, guard skip (chỉ unit test bắt được bug này, DB lane mù).
- FK RESTRICT vi phạm lúc DELETE ném `DriverAdapterError` KHÔNG có code (P2003 chỉ ở INSERT) — assert theo message, không theo code.
- Unique violation → `isUniqueViolation(err)` (`common/errors/prisma-unique-violation`) → 409 + fieldErrors.
- KHÔNG spread union vào query Prisma — truyền `include: undefined` như giá trị.
- Lỗ hổng leak `costPrice`: KHÔNG `include: { product: true }` trong query orders — nếu cần join Product, dùng `select` tường minh không lấy `costPrice` (mỗi service mới là một cánh cửa mới quanh `stripCostPrice`; fixture test leak phải CHỨA `costPrice` thì assert mới không vacuous).

[Source: 3-6-goi-vat-tu-checklist-product-group.md#review-findings; 3-1-crud-san-pham-gia.md#validation-law; epic-3-retro-2026-07-14.md §10]

### DTO — luật validation

- Cột NOT NULL + field optional trong DTO → `@IsOptionalNotNull()` (tái dùng `backend/src/catalog/dto/is-optional-not-null.decorator.ts`); `@IsOptional()` CHỈ cho cột nullable (`note`, `warrantyMonths`). **CẤM `PartialType`** (auto-gắn `@IsOptional` không gỡ được).
- Tiền `@IsInt() @Min(0)`; `qty` `@IsInt() @Min(1)`; `name` dòng tự do `@Transform(({value}) => typeof value === 'string' ? value.trim() : value)` + `@IsNotEmpty()` (TD-21: whitespace-only lọt `@IsNotEmpty` nếu không trim).
- Field nullable trong response DTO: `@ApiProperty({ type: String, nullable: true })` tường minh — union `string | null` sinh `"type":"object"` hỏng codegen (bug đã sửa ở 3.6).

### Frontend — cấu trúc & tái dùng (KHÔNG phát minh lại)

**Đã có sẵn, TÁI DÙNG:**
- `CartLineRow` (`web/src/design-system/components/CartLineRow.tsx`, Story 1.6): props `name/sku?/meta?/qty/unitPrice/amount/editable?/flag?/zebra?/onQtyChange/onUnitPriceChange/onDelete` — render `<tr>` trong `<Table>`; `amount` backend trả, component KHÔNG nhân/cộng. Twin `AppCartLineRow` (`cart_line_row.dart`) thêm prop `id` (bắt buộc khi có `onDelete` — key Dismissible swipe-xoá).
- `CustomerPickScreen` web + mobile (Story 3.4): "`onSelect(customer)` là toàn bộ API màn này để lại cho Story 4.1" (nguyên văn header file) — truyền callback thật, mọi luồng tra SĐT/tạo khách inline/microcopy "SĐT chưa có trong hệ thống." đã xong.
- `EmptyState/ErrorState/Skeleton`, `Dialog/ConfirmDialog/Sheet` (+twin App*); pattern màn list chuẩn `CustomerListScreen.tsx` (LoadState + `latest` ticket chống race + shell tự host).
- Gating: `usePermissions()` + `filterNav(SIDEBAR_NAV, perms)`; `SIDEBAR_NAV` đã có entry `orders` (`Sidebar.tsx:55`); `Gate`/`AppGate` render null khi thiếu quyền (không disable xám).

**Phải TẠO MỚI:** Checkbox primitive (cả 2 nền tảng — mockup chỉ có `<span class="tick">` tĩnh, chưa từng ship; a11y ≥44px + tên đọc được); `OrdersPort`/`CatalogPort` + fake + twin Dart + entry `parityFiles` (session parity test bắt thiếu twin); 2 màn orders + css + guard + widget test.

**Quy tắc màn:**
- Web không có router — màn tự host shell, nhận port qua props. Mobile không BLoC — StatefulWidget + port constructor. FAB "➕Tạo" (`AppBottomNav.onCreateQuote`, hiện chưa nối gì ở màn thật) — màn mới đứng độc lập nhận callback, việc nối FAB thuộc khi có app-runtime host; `activeIndex: 2` cho màn này.
- Overlay: picker/gói = `Sheet`/`AppSheet` (lựa chọn nhanh); hành động hệ quả tiền (Chốt — story 4.5) mới cần Dialog (UX-DR-20). Chồng tối đa 1 cấp.
- Copy tiếng Việt byte-identical web↔mobile (guard so từng byte). Đề xuất bộ nhãn: "Tạo báo giá" (title), "Thêm dòng", "Chọn từ danh mục", "Chọn gói vật tư", "Dòng tự do", "Xoá dòng" (đã có trong CartLineRow), "Số lượng", "Đơn giá", "Diễn giải", "Chưa có dòng nào. Thêm dòng đầu tiên để bắt đầu.", "Thử lại". Tiền/số `.mono` canh phải.
- Lỗi port: render `message` backend nguyên văn + map `fieldErrors`; message tự chế CHỈ cho lỗi transport; **mất mạng không mất dòng đã nhập** (EXPERIENCE Flow 1) — giữ state, hiện Banner + retry.
- Item gói `isActive=false`: hiển thị disabled (payload 3.6 trả `isActive` từng product); tick item → MỖI item một call `addLine({productId, qty})` thành dòng thường.

[Source: 3-4-...md#patterns; 3-6-...md#Bàn-giao-cho-Story-4.1; design-system/components/parity.test.mjs; EXPERIENCE.md#s-quote #Flow-1; DESIGN.md; mockups/all-screens.html s-quote]

### Testing (chuẩn 4 lane + kỷ luật Epic 3)

| Lane | Lệnh | Story này thêm |
|---|---|---|
| Backend hermetic | `cd backend && npm test` | `orders.service.spec.ts`, `orders.e2e.spec.ts` (7 source-guard + 2 drift-guard tự áp lên code mới) |
| Backend DB | `cd backend && npm run test:db` (tự skip khi vắng `DATABASE_URL`) | `orders.db.integration.spec.ts` |
| Design-system | `cd design-system && npm test` | `screens/orders.test.mjs`, parity mới (ports + Checkbox) |
| Mobile | `cd mobile && flutter analyze && flutter test` | `create_quote_screen_test.dart` (widget test BẮT BUỘC) |

- **Assert payload, không đếm call** (bài học 3.2: mutation hoán `minQty`↔`price` mà 37/37 vẫn xanh vì chỉ đếm `toHaveBeenCalledTimes`).
- **Ba lớp test giữ ba sự thật khác nhau** — unit hermetic (logic), DB lane (constraint FK/unique thật), widget test (màn có render nổi không); 3.4 từng có màn mobile KHÔNG render được mà 600+ test backend + text-guard đều xanh.
- Web là text-guard-only (quyết định C-4, chấp nhận xuyên Epic 4) — guard `orders.test.mjs` là tuyến phòng thủ duy nhất của `.tsx`, viết negative assert cẩn thận; comment bị strip trước khi scan (helper `strip-comments.mjs`) nhưng vẫn TRÁNH viết chuỗi cấm (`shadow`, `box-shadow:`…) trong comment code.
- e2e: `process.env.JWT_ACCESS_SECRET` top-level, dynamic `await import('../src/app.module')` trong `beforeAll`, mock `auditLog.create` (AuditSubscriber thật chạy), mock Prisma đủ MỌI model đường request chạm.
- Mutation testing: mutant phải compile sạch; restore bằng `cp` backup (code story chưa commit — `git checkout` xoá sạch).

### Project Structure Notes

- Backend NEW: `backend/src/orders/{orders.module.ts, orders.controller.ts, orders.service.ts, domain/{order-events.ts, order-status.ts, line-amount.ts}, dto/*.dto.ts}`; migration `backend/prisma/migrations/<ts>_add_orders/`; test `backend/test/orders.{service,e2e,db.integration}.spec.ts`. UPDATE: `schema.prisma`, `app.module.ts`, `openapi/openapi.json` (regen).
- FE NEW: `web/src/screens/orders/{CreateQuoteScreen.tsx, orders.css}`; `web/src/design-system/components/Checkbox.tsx`; `web/src/design-system/session/{orders-port.ts, fake-orders-port.ts, catalog-port.ts, fake-catalog-port.ts}`; twin Dart tương ứng (`mobile/lib/screens/orders/`, `mobile/lib/design_system/{components/checkbox.dart, session/*}`); `design-system/screens/orders.test.mjs`; `mobile/test/screens/orders/create_quote_screen_test.dart`. UPDATE: 2 barrel components + 2 barrel session + 2 file `parityFiles` map + `components.css`.
- Naming: route REST `/orders`, `/orders/{id}/line-items` (danh từ số nhiều kebab-case, spine); bảng `orders`/`order_versions`/`order_line_items`; file kebab-case (Dart snake_case).
- KHÔNG nhét plan-ID/nhãn audit vào tên code/migration/test — mô tả bất biến trực tiếp.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4 + #Story-4.1 (dòng 407-417)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-4 #AD-5 #AD-6 #AD-9 #AD-10 #AD-11 #AD-15 #AD-16 #AD-17 #AD-18 #AD-20 #Consistency-Conventions #Core-entity-ERD]
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-1 #FR-2 #FR-4 #FR-5 #FR-14 #FR-29 #FR-35 #§3-Glossary]
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md §1 (snapshot sourceId) §2 (priceEditable/gói/kho) §3 (bảo hành) §5 (quyền)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md#s-quote #s-customer-pick #Flow-1; DESIGN.md; mockups/all-screens.html]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-14.md §6 (bàn giao Epic 4) §7 (mìn THO_KS) §10 (bài học)]
- [Source: _bmad-output/implementation-artifacts/{3-1,3-4,3-6}-*.md — pattern module/màn/port/test]
- [Source: backend/src/accounts/domain/permission-registry.ts; backend/src/events/*; backend/prisma/schema.prisma; backend/CONVENTIONS.md]

### Previous Story Intelligence (Epic 3 → 4.1)

- **Hai mìn chặn 4.1 đã được GỠ sau retro — xác minh, đừng sửa lại:** (1) THO_KS thiếu quyền đọc danh mục → key `catalog.view` đã thêm + gate các GET (commit 5b44e74); (2) race atomic-replace bậc thang giá → `SELECT FOR UPDATE` (commit d5266ba).
- `resolveUnitPrice()` (3.2) viết SẴN cho call-site 4.1 "auto-điền đơn giá theo danh mục" — gọi nó, đừng tự tra `Product.price` trần (giá phân tầng sau cờ nằm trong hàm đó).
- `Customer.sourceId` bắt buộc từ 3.3 → 4.1 LUÔN có giá trị để snapshot. **CẢNH BÁO:** schema comment trên model Customer (~dòng 271-274) viết NHẦM thời điểm — "lúc chốt đơn" — thời điểm đúng là **LÚC TẠO** (epics AC-4, §1); tin story/epics, không tin comment đó; tiện tay sửa comment khi đụng schema.
- Template copy bug theo: `product-groups.replaceItems` từng copy nguyên bug race của `product-prices.replace` — khi tái dùng pattern nào, kiểm tra xem nó đã qua review fix chưa (dùng bản ĐÃ SỬA hiện hành trong cây nguồn).
- 3.4: route tĩnh trước `:param`; lookup theo submit tường minh, không per-keystroke; `ErrorState` web thiếu `onRetry` = nút retry chết lặng lẽ; mobile matched-card từng overflow 168px — giữ layout gọn, widget test bắt overflow.
- Review 3.4 tìm ra 4 bug FE mà MỌI quality gate hiện hữu đều xanh — vì vậy widget test mobile là bắt buộc và guard web phải có negative assert cụ thể theo story.

### Git Intelligence

Sau retro Epic 3, 7 commit action-item đã đổ (C-1→C-12): `d5266ba` FOR UPDATE fix, `5b44e74` `catalog.view`, `146c712` C-5..C-8, `610b02c` CI 4 lane GitHub Actions, `efe829c` stripComments guard, `ffb3ae6` đóng C-4/C-10/C-11/C-12, `c0e82ee` C-9 phân trang. Pattern commit FE chuẩn (`c0e82ee`): guard + màn web + màn mobile + widget test + sprint-status trong cùng commit; conventional commit tiếng Việt, không tham chiếu AI.

### Thư viện & phiên bản (đã pin — KHÔNG tra web, tri thức nội bộ mới hơn docs chung)

Node 24 LTS · NestJS ^11.1.27 (`@nestjs/swagger` ^11.4.5) · **Prisma 7.8.0** + `@prisma/adapter-pg` (driver adapter, URL ở `prisma.config.ts`, `migrate diff --from-schema/--to-schema`, `Prisma.JsonNull`, P2003 chỉ INSERT, empty `createMany` phá atomic) · class-validator ^0.15.1 · jest ^30 · React 19.2.7 (source-only, không tsc) · Flutter 3.44 (`dart format -o none` khi check). Mọi quirk Prisma 7 đã ghi ở trên — đó là lý do không cần web research: các bẫy phiên bản THỰC TẾ của dự án đã được Epic 2-3 trả giá và ghi lại.

### Project Context Reference

Đọc `_bmad-output/project-context.md` trước khi code — file này là luật: client không số học tiền, không đổi status ngoài applyTransition, không gọi FCM/audit trực tiếp, không permission literal, không sửa file generated, scout-before-code, thay đổi surgical đúng scope.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8) — dev-story workflow, một phiên liên tục.

### Debug Log References

- **DB lane không chạy được trong phiên dev:** `.env` có `DATABASE_URL` nhưng Postgres cục bộ TẮT (ECONNREFUSED); Docker Desktop có cài nhưng daemon không khởi động được từ CLI (`open -a Docker` không lên socket sau ~4 phút — cần thao tác GUI). Cả 5 suite `.db.integration` (4 cũ + orders mới) cùng fail vì kết nối ⇒ lỗi MÔI TRƯỜNG, không phải code story. **Việc cần làm khi có Postgres:** `cd backend && npx prisma migrate deploy && npm run test:db` — spec `orders.db.integration.spec.ts` đã viết đủ 3 sự thật DB (FK vòng trong transaction, bản chất snapshot sourceId, FK productId RESTRICT).
- **Lint nợ cũ:** `backend/test/products.e2e.spec.ts` + `product-prices.db.integration.spec.ts` fail prettier TỪ TRƯỚC story này (git sạch, không do 4.1 đụng) — không sửa lan man, để action item riêng.
- **Mutation spot-check backend:** mutant A (`sourceId: customer.custType` — snapshot sai nguồn, compile sạch) → unit RED 1 test; mutant B (guard status baogia thành no-op) → unit RED 3 test; phục hồi bằng `cp` backup.
- **Mutation spot-check guard FE:** mutant `amount={line.unitPrice * line.qty}` ban đầu LỌT guard (regex không nhận operand `line.`-prefixed) → vá regex, xác nhận RED, phục hồi.
- **AppSheet overflow:** khung phone thấp ⇒ sheet nội dung cao cố định tràn 24px trong animation mở — fix ở design-system (`sheet.dart`: bọc body trong `Flexible`) + màn bọc nội dung sheet trong vùng cuộn có trần (`_sheetBody`); widget test bắt được lỗi render này đúng như kỳ vọng C-4.

### Completion Notes List

- **Backend greenfield `orders/`:** 3 model Prisma (`Order`/`OrderVersion`/`OrderLineItem`) + migration offline `20260716000000_add_orders` (diff từ schema HEAD, đủ FK, `product_id` ON DELETE RESTRICT tường minh); domain thuần (`order-events`/`order-status`/`line-amount`); module 5 endpoint gate `quotes.create_edit` — tạo đơn là MỘT `$transaction` 3 op id-sinh-trước, `sourceId`/`custType` snapshot từ Customer lúc tạo (FR-35), mutation dòng chỉ khi `status === 'baogia'` (409), event publish SAU commit (OrderCreated/LineAdded/LineUpdated/LineRemoved — FR-20).
- **Giá trước chốt (FR-5/FR-14):** thêm dòng catalog auto-điền qua `resolveUnitPrice()` (cờ giá phân tầng resolve ở controller); đường ĐỌC trả giá SỐNG tính lại từ danh mục cho dòng `priceEditable=false` (giá lưu chỉ là cache, không ghi đè DB); `amount` server tính bằng `lineAmount()`; truy vấn Product qua `select` tường minh KHÔNG `costPrice` (chống leak giá vốn, test fixture có `costPrice` để assert không vacuous).
- **Client gửi `unitPrice` cho sản phẩm/dòng không cho sửa giá ⇒ 400 fieldErrors** (chặt hơn "bỏ qua" — sửa giá là cửa sau né duyệt chiết khấu); dòng tự do `priceEditable=true`, name trim-trước-IsNotEmpty (TD-21), tiền `@IsInt @Min(0)`, qty `@Min(1)`, CẤM PartialType.
- **Design-system mở rộng:** `Checkbox`/`AppCheckbox` mới (control thật, ≥44px/48dp, viền nét); `CartLineRow`/`AppCartLineRow` thêm prop `priceEditable` (mặc định = `editable` — back-compat); `Field`/`AppField` thêm `multiline`/`maxLines` (tên dòng tự do nhiều dòng); `AppSheet` body bọc `Flexible` (fix overflow animation). Parity map cập nhật (components +1, session +4 cặp).
- **Port FE:** `OrdersPort`/`CatalogPort` + fake in-memory + twin Dart — hợp đồng + fake, chưa HTTP client (TODO app-runtime); fake orders port ĐÓNG VAI backend nên `amount` tính trong fake, KHÔNG trong màn/component.
- **2 màn Tạo báo giá (web + mobile):** bước 1 tái dùng TRỌN `CustomerPickScreen` (tự host shell — không shell-lồng-shell), `onSelect` → `ordersPort.create`; bước 2 giỏ hàng CartLineRow (qty sửa mọi dòng, giá theo `priceEditable` từng dòng, flag "Linh động/dự kiến", xoá dòng), 3 đường thêm dòng (danh mục/gói checklist Checkbox — item ngừng bán disabled, tick = addLine từng productId, KHÔNG lưu vết gói/dòng tự do), khu tổng "—" placeholder chờ 4.2, lỗi port render message backend nguyên văn + fieldErrors map vào field, lỗi KHÔNG xoá dòng đã nhập (ErrorState "Thử lại").
- **Test:** unit 22 (payload-assert, không đếm call) + e2e 19 (401/403 mọi route, happy path, envelope, ValidationPipe thật, audit qua EventBus→AuditSubscriber thật) + DB-lane spec 5 case (chờ Postgres) + widget test mobile 7 case (C-4) + guard `orders.test.mjs` 12 test; 2 mutant backend + 1 mutant guard đều RED đúng.
- **Task 4 xác minh:** 4 route GET catalog đều gate `catalogView` (commit 5b44e74 nguyên vẹn); không key quyền mới, không regen permissions. OpenAPI regen +594 dòng (5 endpoint + DTO orders).
- Tiện tay sửa comment SAI trên `Customer.sourceId` trong schema ("lúc chốt đơn" → "lúc TẠO đơn") — story dặn tường minh.

### File List

**Backend — mới:**
- backend/prisma/migrations/20260716000000_add_orders/migration.sql
- backend/src/orders/orders.module.ts
- backend/src/orders/orders.controller.ts
- backend/src/orders/orders.service.ts
- backend/src/orders/domain/order-events.ts
- backend/src/orders/domain/order-status.ts
- backend/src/orders/domain/line-amount.ts
- backend/src/orders/dto/create-order-request.dto.ts
- backend/src/orders/dto/add-line-item-request.dto.ts
- backend/src/orders/dto/update-line-item-request.dto.ts
- backend/src/orders/dto/order-response.dto.ts
- backend/src/orders/dto/order-line-item-response.dto.ts
- backend/test/orders.service.spec.ts
- backend/test/orders.e2e.spec.ts
- backend/test/orders.db.integration.spec.ts

**Backend — sửa:**
- backend/prisma/schema.prisma
- backend/src/app.module.ts
- backend/openapi/openapi.json (regen)

**Web — mới:**
- web/src/screens/orders/CreateQuoteScreen.tsx
- web/src/screens/orders/orders.css
- web/src/design-system/components/Checkbox.tsx
- web/src/design-system/session/orders-port.ts
- web/src/design-system/session/fake-orders-port.ts
- web/src/design-system/session/catalog-port.ts
- web/src/design-system/session/fake-catalog-port.ts

**Web — sửa:**
- web/src/design-system/components/CartLineRow.tsx (prop priceEditable)
- web/src/design-system/components/Field.tsx (multiline)
- web/src/design-system/components/components.css (.checkbox)
- web/src/design-system/components/index.ts (barrel)
- web/src/design-system/session/index.ts (barrel)

**Mobile — mới:**
- mobile/lib/screens/orders/create_quote_screen.dart
- mobile/lib/design_system/components/checkbox.dart
- mobile/lib/design_system/session/orders_port.dart
- mobile/lib/design_system/session/fake_orders_port.dart
- mobile/lib/design_system/session/catalog_port.dart
- mobile/lib/design_system/session/fake_catalog_port.dart
- mobile/test/screens/orders/create_quote_screen_test.dart

**Mobile — sửa:**
- mobile/lib/design_system/components/cart_line_row.dart (prop priceEditable)
- mobile/lib/design_system/components/field.dart (maxLines)
- mobile/lib/design_system/components/sheet.dart (Flexible body — fix overflow)
- mobile/lib/design_system/components/components.dart (barrel)
- mobile/lib/design_system/session/session.dart (barrel)

**Design-system guard — mới/sửa:**
- design-system/screens/orders.test.mjs (mới)
- design-system/components/parity.test.mjs (+Checkbox)
- design-system/session/parity.test.mjs (+4 cặp port)

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (adversarial review tự động) — 2026-07-17. **Outcome: Approve** (0 Critical còn lại; High/Medium trong scope đã fix, verify xanh).

**Audit claim vs thực tế:** 12/12 task `[x]` đều có bằng chứng thật; 5 AC IMPLEMENTED; File List khớp 100% git (0 lệch). Xác minh chéo: `OrderStatusKey` copy đúng 10 khoá `StatusKey` chip; 4 route GET catalog gate `catalogView` (5b44e74 nguyên vẹn); `PRODUCT_QUOTE_SELECT` không kéo `costPrice` (test chống-vacuous có fixture chứa costPrice); event publish SAU `$transaction` resolve; migration đủ 8 FK + RESTRICT tường minh trên `product_id`; OpenAPI có đủ 4 path orders (regen, không sửa tay).

**Findings & xử lý:**

1. **[High — FIXED] Lỗi tạo đơn ở bước 1 vô hình trên CẢ HAI nền tảng.** `ordersPort.create` fail ⇒ `setError`/`_showError` nhưng khi `order == null` view chỉ là `CustomerPickScreen` — không chỗ render lỗi; comment code claim "message backend nguyên văn" là false, user bấm chọn khách mà màn im lặng tuyệt đối. Fix: Banner/AppBanner render message backend ngay trên màn pick (web `CreateQuoteScreen.tsx` + mobile `create_quote_screen.dart`, layout bước 1 giữ nguyên khi không có lỗi); ghim bằng widget test mới "tạo đơn fail ở bước 1" (subclass fake ném `OrderPortException`) + 2 assert mới trong guard `orders.test.mjs` (k).
2. **[Medium — FIXED] `displayOrder = count()` gãy sau khi xoá dòng** (`orders.service.ts` addLine): thêm A,B,C → xoá A → thêm D ⇒ D trùng `displayOrder` với C, `orderBy` tie ⇒ thứ tự giỏ nondeterministic, dòng mới không đứng cuối (vi phạm Task 3). Fix: `findFirst orderBy displayOrder desc` ⇒ max+1; unit test đổi mock `count`→`findFirst` và assert PAYLOAD truy vấn (where/orderBy/select) + displayOrder=3 từ max=2 — revert về count sẽ RED.
3. **[Medium — ACTION ITEM] Flake lane backend khi chạy full** (customer-sources.e2e, 1/3 lần chạy) — không thuộc file 4.1, ghi Review Follow-ups, không sửa lan man.
4. **[Low ×3 — ACTION ITEM]** `onDone` chưa dùng; `Number('')=0` web free-line; race `setSheetState` sau khi sheet đóng. Ghi Review Follow-ups.
5. **[Low — GHI NHẬN, không sửa]** Không có UI đặt `isFlexible` — AC-2 chỉ đòi "chỉ hiển thị"; port/backend đã nhận input, đủ cho 4.1.

**Verify sau fix:** backend 49 suite/739 test xanh (full) · design-system 265 xanh (guard mới nhận diện fix H1) · mobile analyze sạch + 155 test xanh (9 widget test orders, +1 mới) · `dart format -o none` sạch. DB lane vẫn chờ Postgres (nợ môi trường đã ghi ở Debug Log — không đổi).

## Change Log

- 2026-07-16: Story được tạo bởi create-story workflow (ultimate context engine) — tổng hợp từ epics.md, ARCHITECTURE-SPINE, PRD, quyết định 2026-07-10, retro Epic 3, và scout 4 luồng (kiến trúc/PRD, backend, web+mobile, học liệu). Status: ready-for-dev.
- 2026-07-17: Review (AI, adversarial) — 0 Critical; fix 1 High (lỗi tạo đơn bước 1 vô hình cả 2 nền tảng → Banner trên màn pick + widget test + guard assert) + 1 Medium (`displayOrder` count→max+1, chống trùng thứ tự sau xoá dòng); 1 Medium (flake customer-sources.e2e ngoài scope) + 3 Low ghi Review Follow-ups. Verify: backend 739 xanh · design-system 265 xanh · mobile 155 xanh + analyze/format sạch. Status: done.
- 2026-07-17: Dev hoàn tất 12/12 task — nền móng Order/OrderVersion/OrderLineItem (AD-6) + giỏ hàng báo giá 2 nền tảng + snapshot Order.sourceId (FR-35) + giá-sống-trước-chốt (FR-5). 4 lane: backend 733 xanh · design-system 265 xanh · mobile 153 xanh + analyze sạch · DB-lane spec sẵn (Postgres cục bộ không bật được — chạy `npm run test:db` khi có DB). Mutation spot-check: 2 mutant backend + 1 mutant guard đều RED. Status: review.
