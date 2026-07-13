---
baseline_commit: 5135ffa
---

# Story 3.6: Gói vật tư — `ProductGroup` / `ProductGroupItem` (nền cho checklist Epic 4)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người có quyền sửa danh mục** (`catalog.manage`),
I want **tạo gói vật tư = một danh sách sản phẩm con có thứ tự, sửa/tắt được, có ghi vết Audit**,
so that **Epic 4 dựng được checklist "chọn gói → tick món → mỗi món thành một dòng báo giá trỏ Product thật".**

**Phạm vi story này = BACKEND ONLY: 2 entity + 1 migration + 7 route + 5 domain event + test.**

🔴 **KHÔNG dựng màn nào. KHÔNG thêm component design-system. KHÔNG đụng `Order`.** Lý do ở [Quyết định #1](#1-story-này-backend-only--không-dựng-ui-không-đẻ-checkbox) — đọc trước khi viết dòng code đầu tiên.

## Bối cảnh: story này là NỀN, không phải MẶT TIỀN

`epics.md#Story-3.6` có 5 AC. **Chỉ AC-1 là code story này viết được.** Đọc bảng này trước, nếu không bạn sẽ đi dựng thứ không tồn tại:

| AC gốc (epics.md:401-405) | Thuộc về ai | Vì sao |
|---|---|---|
| AC-1 — Gói là checklist, KHÔNG phải sản phẩm/dòng tự do; entity `ProductGroup` + `ProductGroupItem { productId }` | ✅ **STORY NÀY** | Đây là **mô hình dữ liệu** + khái niệm. Buildable ngay. |
| AC-2 — user tick → **mỗi item thành một `OrderLineItem`** | ❌ **Story 4.1** | `OrderLineItem` **CHƯA TỒN TẠI**. Bảng `Order`/`OrderVersion`/`OrderLineItem` do Story 4.1 đẻ. Story 4.1 AC (epics.md:417) **nhắc lại nguyên luật này**, cùng trích dẫn `(§2)`. |
| AC-3 — user nhập SL, giá = giá item × SL, không có giá trọn gói | ❌ **Story 4.1** | Là luật của **giỏ hàng**. Tiền do backend tính qua `/orders/preview-total` (Story 4.2, AD-16). Story này không làm số học tiền. |
| AC-4 — gói KHÔNG hiện ở chi tiết đơn / PDF | ❌ **Story 4.1 + 4.8** | Là **ràng buộc phủ định** lên Epic 4. Story này thi hành nó bằng cách **không tạo đường nào** để gói dính vào Đơn (xem AC-7). |
| AC-5 — "màn Danh sách khách + Chi tiết khách… parity web+mobile (FR-29)" | ❌ **KHÔNG AI — đây là lỗi copy-paste** | Nguyên văn AC của **Story 3.4**, đã ship ở commit `e4efc77` (3 màn web + 3 màn mobile). **Không liên quan gói vật tư.** ⇒ **Verify-only**, xem AC-8. **CẤM dựng lại.** |

⇒ Việc thật của story này: **2 entity + migration + CRUD + endpoint đọc mà picker Epic 4 sẽ gọi + audit + test.**

## Nguồn chân lý: `(§2)` là file NÀO

Mọi `(§2)` trong AC gốc trỏ về **`docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md` §2 → "Gói vật tư"** (KHÔNG phải §2 của PRD). Nguyên văn — đây là hợp đồng:

> - Gói là **checklist trên UI**, KHÔNG phải sản phẩm, KHÔNG phải dòng tự do.
> - Chọn gói → hiện danh sách sản phẩm con → user tick → **mỗi item tick thành một `OrderLineItem` bình thường** trỏ vào Product thật.
> - User tự nhập số lượng. Giá = giá item × số lượng. Không có giá trọn gói.
> - Bảng `ProductGroup` + `ProductGroupItem { productId }`. **Không cần `defaultQty`.**
> - Gói **không lưu lên Đơn**, không snapshot, không in PDF. Phase 1 KHÔNG có BOM và không cần.

🔴 **"Không cần `defaultQty`"** là một câu lệnh, không phải một nhận xét. **CẤM** thêm `defaultQty`/`qty`/`quantity` vào `ProductGroupItem`. Số lượng do user gõ lúc dựng báo giá (Epic 4). Thêm cột đó = mở cửa cho BOM, thứ PRD §6.2 nói **ngoài phạm vi MVP**.

## Acceptance Criteria

**AC-1 — Schema: `ProductGroup` + `ProductGroupItem` (§2, ERD spine).**
Given ERD `ARCHITECTURE-SPINE.md#Structural-Seed` đã vẽ sẵn hai entity,
When thêm vào `schema.prisma`,
Then đúng hình dưới — **không thừa cột, không thiếu cột**:

```prisma
model ProductGroup {
  id          String             @id @default(uuid())
  name        String             @unique
  description String?
  isActive    Boolean            @default(true) @map("is_active")
  createdAt   DateTime           @default(now()) @map("created_at")
  updatedAt   DateTime           @updatedAt @map("updated_at")
  items       ProductGroupItem[]

  @@map("product_groups")
}

model ProductGroupItem {
  id             String       @id @default(uuid())
  productGroupId String       @map("product_group_id")
  group          ProductGroup @relation(fields: [productGroupId], references: [id], onDelete: Cascade)
  productId      String       @map("product_id")
  product        Product      @relation(fields: [productId], references: [id], onDelete: Restrict)
  displayOrder   Int          @map("display_order")
  createdAt      DateTime     @default(now()) @map("created_at")

  @@unique([productGroupId, productId])
  @@index([productGroupId])
  @@map("product_group_items")
}
```

- `Product` (**UPDATE**): + back-relation `groupItems ProductGroupItem[]`. ⚠️ Back-relation **không sinh SQL** cho bảng `products` (đã chứng minh ở migration `20260713010000` khi thêm `prices`).
- 🔴 **`isActive`, KHÔNG phải `active`.** ERD spine viết `active`, nhưng `ProductGroup` sống trong **cùng module `catalog/`** với `Product` (`isActive`, `@map("is_active")`). Xem [Quyết định #3](#3-isactive-không-phải-active--theo-module-không-theo-ban-vẽ).
- 🔴 **CẤM** cột `defaultQty`/`qty`/`price`/`bundlePrice` trên `ProductGroupItem` (§2: "Không cần `defaultQty`", "Không có giá trọn gói").
- `@@unique([productGroupId, productId])` — **một sản phẩm không nằm hai lần trong cùng một gói**. Tick hai lần cùng một món là vô nghĩa.
- `onDelete: Restrict` trên `productId` — xoá cứng một `Product` đang nằm trong gói phải **bị chặn** (khuôn `Customer.sourceId`). `onDelete: Cascade` trên `productGroupId` — xoá gói thì item con đi theo (item không có đời sống riêng, khuôn `ProductPrice`).
- **KHÔNG** Postgres enum (schema này **không có enum nào** — cố ý, `schema.prisma:46-50`).

**AC-2 — Migration offline (AD-12, CONVENTIONS).**
Given repo **không có Postgres cục bộ** khi sinh migration,
When sinh,
Then `prisma/migrations/20260713030000_add_product_groups/migration.sql`:
- Sinh bằng `npx prisma migrate diff --from-schema <bản-copy-schema-cũ> --to-schema prisma/schema.prisma --script`.
- 🔴 **Prisma 7 KHÔNG có `--from-schema-datamodel`** (cờ cũ, story doc đời trước ghi sai). Chỉ `--from-schema` / `--to-schema`.
- Timestamp **gán tay** theo bước `010000` trong ngày (`…020000` là mới nhất ⇒ ta là `…030000`).
- Header SQL có comment giải thích **bất biến mà DDL này mã hoá** (khuôn `20260713010000/migration.sql:1-18`).
- **KHÔNG** chạy `prisma migrate dev` (cần DB thật). `npm run prisma:generate` để sinh client.

**AC-3 — CRUD gói: 6 route, gate `catalog.manage` (AD-4, AD-17, FR-14).**
Given người dùng có `catalog.manage` ("Sửa danh mục & giá"),
When gọi,
Then:

| Route | Trả về | Ghi chú |
|---|---|---|
| `GET /product-groups?includeInactive=` | `200 ProductGroupResponseDto[]` | **KHÔNG** kèm items (danh sách gọn). `includeInactive` vắng ⇒ chỉ `isActive: true`. |
| `GET /product-groups/:id` | `200 ProductGroupDetailResponseDto` | **CÓ** items, sắp theo `displayOrder` tăng dần. Đây là endpoint **picker Epic 4 sẽ gọi**. |
| `POST /product-groups` | `201 ProductGroupResponseDto` | `{ name, description? }`. `isActive: true` cứng. |
| `PATCH /product-groups/:id` | `200 ProductGroupResponseDto` | `{ name?, description? }`. **CẤM** `isActive` trong body. |
| `DELETE /product-groups/:id` | `204` | soft-delete ⇒ `isActive = false`. `@HttpCode(HttpStatus.NO_CONTENT)`. |
| `POST /product-groups/:id/reactivate` | `200 ProductGroupResponseDto` | `@HttpCode(HttpStatus.OK)` — bật lại **không TẠO** tài nguyên nào (bài học 3.5: mặc định `@Post` trả 201). |

- Cả 6 ⇒ `@RequirePermissions(PERM.catalogManage)` (khuôn `products.controller.ts:81,109,140,166,201`). Xem [Quyết định #2](#2-gate-catalogmanage-cho-cả-đọc-lẫn-ghi--và-quả-mìn-để-lại-cho-story-41) — **có một quả mìn cho Epic 4, đọc kỹ.**
- `name` trùng ⇒ **409 `CONFLICT`** + `fieldErrors: [{ field: 'name', … }]` qua `isUniqueViolation()` + khuôn `translateWriteError()` (`products.service.ts:244-259`).
- `id` không tồn tại ⇒ **404** (khuôn `findOrThrow`).
- Gói đã tắt mà `DELETE` lần nữa ⇒ **204, KHÔNG publish event**. Gói đang bật mà `reactivate` ⇒ **200, KHÔNG publish event**. (Khuôn `customer-sources.service.ts:189,213`.)
- `PATCH` mà **không cột nào đổi giá trị** ⇒ **KHÔNG ghi DB, KHÔNG publish event** (khuôn `effective()` + early-return, `customer-sources.service.ts:50-53,137-143`). 🔴 `ProductsService.update` **KHÔNG** có check này — **đừng copy `products`, copy `customer-sources`** (3.5 mới hơn, đã sửa ở review).
- **KHÔNG** thêm `ErrorCode` mới.

**AC-4 — `PUT /product-groups/:id/items` — thay TOÀN BỘ danh sách item, nguyên tử (§2).**
Given một gói,
When `PUT { productIds: string[] }` (mảng **có thứ tự** — thứ tự mảng LÀ `displayOrder`),
Then thay sạch item cũ bằng item mới trong **một `$transaction`** ⇒ `200 ProductGroupDetailResponseDto`
- Khuôn **chính xác**: `ProductPricesService.replace()` (`product-prices.service.ts:90-102`) — `deleteMany` + `createMany` trong `$transaction`.
- 🔴 **`createMany` RỖNG làm hỏng atomic-replace trên Prisma 7 + adapter-pg** (no-op cả transaction). ⇒ **BẮT BUỘC** giữ `if (productIds.length > 0)` trước khi push `createMany` vào mảng ops. Gói rỗng (`[]`) là **hợp lệ** — gói mới tạo chưa có món nào.
- `displayOrder = index` trong mảng. **Server gán**, client không gửi. ⇒ **không có cột nào client ghi được số** ⇒ **không cần `@Max`** ở đây (khác `ProductPrice`, nơi client gửi `minQty`).
- **`productId` trùng trong payload** ⇒ **400 `VALIDATION_ERROR`** + `fieldErrors`, **chặn ở tầng app TRƯỚC khi vào transaction** (khuôn `assertNoDuplicateMinQty`, `product-prices.service.ts:142-163`). Để P2002 nổ **sau** khi `deleteMany` đã chạy trong tx là một cách thua khó chịu.
- **`productId` không tồn tại** ⇒ **400** + `fieldErrors` chỉ đúng phần tử (khuôn `assertProductExists`, `product-prices.service.ts:128-139`; ở đây là **nhiều id** ⇒ một `findMany({ where: { id: { in: ids } } })` rồi so tập, **KHÔNG** N+1 query).
- ⚠️ **Sản phẩm đã tắt (`isActive: false`) VẪN được đưa vào gói** — **cố ý**, không phải sót. Chặn lúc ghi là **an toàn giả**: sản phẩm có thể bị tắt **sau** khi đã nằm trong gói, nên picker Epic 4 **buộc phải** xử lý item trỏ sản phẩm đã tắt dù ta có chặn hay không. ⇒ Payload đọc **trả kèm `isActive` của từng sản phẩm** để picker tự làm mờ / bỏ tick. Ghi ở đây để reviewer không gắn cờ "quên validate".
- DTO nested: **BẮT BUỘC đủ bộ** `@IsArray()` + `@IsString({ each: true })` + `@IsUUID('4', { each: true })`. (Nếu đổi sang mảng object thì phải thêm `@IsObject({ each: true })` + `@ValidateNested({ each: true })` + `@Type(() => Dto)` — thiếu `@IsObject({each:true})` cho `[[{...}]]` lọt qua ⇒ 500. Xem `replace-product-prices-request.dto.ts:29-33`.)
**And** publish `ProductGroupItemsReplaced` (before → after) ⇒ Audit.

**AC-5 — 🔴 Payload đọc KHÔNG ĐƯỢC rò `costPrice` (AD-4, `costs.view`).**
Given `GET /product-groups/:id` nhúng thông tin sản phẩm con,
When serialize,
Then mỗi item chỉ mang **projection hẹp** của `Product`: `{ productId, name, sku, unit, price, isActive, displayOrder }`.
- 🔴 **CẤM tuyệt đối** `costPrice` trong bất kỳ DTO đọc nào của story này. `costPrice` là **giá vốn** — bị gác sau quyền `costs.view` và bị `stripCostPrice()` (`catalog/domain/product-visibility.ts:15-22`) lọc ở `ProductsService`. Một `include: { product: true }` hồn nhiên trong `product-groups.service.ts` sẽ **trả nguyên bản ghi `Product` kèm `costPrice`** cho mọi ai có `catalog.manage` — **thủng đúng ranh giới mà Story 3.1 dựng lên**, qua một cửa mới.
- ⇒ **CẤM** `include: { product: true }` trần. Dùng `select` liệt kê **tường minh** từng cột.
- Test bắt buộc: assert **chuỗi `costPrice` KHÔNG xuất hiện** trong response body của cả `GET /product-groups` lẫn `GET /product-groups/:id` (AC-9).
- ⚠️ Không đi đường `stripCostPrice` + `costs.view` ở đây: gói **không cần** giá vốn cho việc gì cả. Không lấy về thì không phải lọc. (Nếu Epic 8 cần lãi gộp theo gói ⇒ story riêng, đi qua `costs.view` tử tế.)

**AC-6 — Audit MỌI mutation, qua EventBus (FR-14, FR-20, AD-18).**
Given AD-18,
When mutation,
Then publish **sau khi write commit**, snapshot **trước → sau**:
- `src/catalog/domain/product-group-events.ts` (**NEW**, kebab-case): `ProductGroupSnapshot` + `ProductGroupCreated` · `ProductGroupUpdated` · `ProductGroupDeactivated` · `ProductGroupReactivated` · `ProductGroupItemsReplaced`.
- Mỗi class: `readonly type = '<TênClass>'`, `target = { type: 'ProductGroup', id }`.
- 🔴 `ProductGroupItemsReplaced` ⇒ `target` trỏ về **GÓI (cha)**, không phải item (khuôn `ProductPricesReplaced`, `catalog/domain/product-price-events.ts:14-29`) — để vết audit của một gói gom cả "sửa gói" lẫn "đổi danh sách món".
- **Thuần domain**: **KHÔNG** `import` Nest/Prisma.
- 🔴 **CẤM** `import AuditService` trong service (guard `no-direct-side-effect-outside-eventbus` sẽ đỏ). Chỉ `EventBus.publish`.

**AC-7 — Ràng buộc PHỦ ĐỊNH: gói KHÔNG được dính vào Đơn (§2, AC-4 gốc).**
Given §2 nói "Gói **không lưu lên Đơn**, không snapshot, không in PDF",
When story này kết thúc,
Then **không tồn tại đường nào** để gói bám vào Đơn:
- **KHÔNG** cột `productGroupId` / `groupId` / `groupName` trên bất kỳ bảng nào ngoài `product_group_items`.
- **KHÔNG** đụng `Order`/`OrderVersion`/`OrderLineItem` — chúng **chưa tồn tại**, và story này **không được** đẻ chúng (CONVENTIONS: "mỗi story sở hữu entity của nó · `Order` = E4").
- **KHÔNG** thêm `ProductGroup` vào bất cứ payload nào của `products`.
- ⇒ Story này thi hành AC-4 gốc bằng cách **không xây cửa**, chứ không bằng cách canh cửa. Bất biến này **không có test nào canh được ở đây** (không có bảng Đơn để assert vắng mặt) ⇒ nó là **hợp đồng bàn giao cho Story 4.1**, ghi ở [Bàn giao cho Story 4.1](#bàn-giao-cho-story-41-đọc-trước-khi-code-giỏ-hàng).

**AC-8 — AC-5 gốc (màn Khách hàng) = VERIFY-ONLY, KHÔNG code (lỗi copy-paste).**
Given `epics.md:405` gắn nhầm AC của Story 3.4 vào Story 3.6,
When bắt đầu,
Then **xác nhận** 6 màn khách đã tồn tại (`web/src/screens/customers/{CustomerListScreen,CustomerDetailScreen,CustomerPickScreen}.tsx` + 3 màn Dart tương ứng, commit `e4efc77`) và **DỪNG**.
- 🔴 **CẤM** dựng lại, "cải thiện", hay refactor màn khách. Chúng đã qua review và đã `done`.
- Ghi một dòng vào Completion Notes xác nhận đã verify, để retro Epic 3 sửa `epics.md`.

**AC-9 — Test (hermetic + lane DB).**
- `test/product-groups.service.spec.ts` (**NEW**, mock Prisma + EventBus): 🔴 **assert PAYLOAD `data`/`where`/`select` truyền vào Prisma**, **KHÔNG** `toHaveBeenCalledTimes` (CRITICAL review 3.2 ⇒ xanh-giả). Ca: create ⇒ `isActive: true` cứng · update chỉ ghi field có mặt · **`PATCH` không đổi gì ⇒ KHÔNG ghi DB, KHÔNG publish** · deactivate gói đã tắt ⇒ **không publish** · reactivate gói đang bật ⇒ **không publish** · 404 id lạ · `name` trùng ⇒ 409 + `fieldErrors` · **items replace: `deleteMany` + `createMany` trong CÙNG một `$transaction`, `displayOrder` = index mảng** · **`productIds: []` ⇒ CHỈ `deleteMany`, KHÔNG `createMany` rỗng** · productId trùng trong payload ⇒ 400 **trước** khi chạm `$transaction` · productId lạ ⇒ 400.
- **Assert event**: mỗi mutation publish **đúng một** event, đúng class, snapshot trước→sau đúng.
- `test/product-groups.e2e.spec.ts` (**NEW**, khuôn `products.e2e.spec.ts`): **403 khi thiếu `catalog.manage`** cho **cả 6 route + route items** · 400 khi `name` rỗng · 409 khi trùng tên · route `:id/reactivate` và `:id/items` **không bị `:id` nuốt** (thứ tự khai route) · 🔴 **`costPrice` KHÔNG có trong body** của `GET /product-groups` và `GET /product-groups/:id` (AC-5).
  - ⚠️ Mock `PrismaService` trong e2e **phải có đủ mọi model đường request chạm qua** (`productGroup`, `productGroupItem`, `product`, `auditLog`) — thiếu một cái ⇒ 500 cả suite (bài học `featureFlag` ở 3.1).
  - ⚠️ `process.env.JWT_ACCESS_SECRET` set ở **top-level**, `await import('../src/app.module')` **động** trong `beforeAll` (import tĩnh bị hoist trước khi env kịp set).
- `test/product-groups.db.integration.spec.ts` (**NEW**, Postgres thật, hậu tố `.db.integration.spec.ts`): `@@unique([productGroupId, productId])` **chặn thật ở tầng DB** · `onDelete: Cascade` — xoá cứng gói ⇒ item con biến mất · `onDelete: Restrict` — xoá cứng một `Product` đang nằm trong gói ⇒ **bị chặn** · atomic-replace: thay list 3 món → 0 món → 2 món, đếm đúng sau mỗi bước.
  - 🔴 **Prisma 7:** vi phạm `ON DELETE RESTRICT` lúc **DELETE** nổi lên là `DriverAdapterError` **KHÔNG mang `code` P2003** (P2003 chỉ đến lúc INSERT). ⇒ assert **HÀNH VI** (lệnh xoá bị từ chối + dòng còn sống), **KHÔNG** bám mã lỗi. (Máu đã đổ ở 3.5.)
  - Lane này tách bằng `testPathIgnorePatterns` — **đừng gỡ**. Script `test:db` đã dùng `--testRegex "\.db\.integration\.spec\.ts$"` ⇒ **file mới tự động được nhặt, KHÔNG cần sửa `package.json`** (3.5 đã sửa hardcode thành regex).
- `test/openapi-drift.spec.ts` (**UPDATE**): assert **tường minh** 7 operation mới + 4 DTO mới có trong `components.schemas`, và **mọi operation mới đòi bearer**. (Drift-guard byte-for-byte xanh **không** chứng minh hợp đồng đúng — nó xanh y hệt nếu code quên hẳn một route. Bài học 3.2/3.3/3.4/3.5.)

**AC-10 — Cổng chất lượng.**
- `cd backend && npm run openapi:gen` → commit `openapi.json` → **verify tường minh** 7 route + 4 DTO có trong spec, và **không DTO đọc nào phơi `costPrice`**.
- `npm test` (hermetic, **616 test hiện có, 0 regression**) · `npm run lint` · `npm run format:check` · `npm run build` (⚠️ **không có script `typecheck`** — `nest build` là cổng type).
- `npm run test:db` (Postgres thật, 25 test hiện có).
- `npm run prisma:generate` sau khi sửa schema.
- `cd design-system && npm test` (**250 test hiện có**) — story này **không đụng** FE, phải vẫn xanh **y nguyên**.
- `cd mobile && flutter analyze && flutter test` (145) — **không đụng**, phải xanh.
- **Mutation test** (luật 2.10): xem Task 7.

## Tasks / Subtasks

- [x] **Task 0 — Verify AC-5 gốc là copy-paste, KHÔNG code (AC-8)**
  - [x] `ls web/src/screens/customers/` + `ls mobile/lib/screens/customers/` ⇒ xác nhận 6 màn đã có (commit `e4efc77`). Ghi một dòng Completion Note. **Dừng, không sửa gì.**

- [x] **Task 1 — Schema + migration (AC-1, AC-2)**
  - [x] `cp backend/prisma/schema.prisma /tmp/schema-before.prisma` (cần cho `migrate diff`).
  - [x] `schema.prisma` (**UPDATE**): + `model ProductGroup` + `model ProductGroupItem` (đặt **sau** `ProductPrice`, **trước** `FeatureFlag`); + back-relation `groupItems ProductGroupItem[]` trên `Product`.
  - [x] `npx prisma migrate diff --from-schema /tmp/schema-before.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20260713030000_add_product_groups/migration.sql` (tạo thư mục trước). **Prisma 7: KHÔNG có `--from-schema-datamodel`.**
  - [x] Thêm comment header vào `migration.sql` giải thích bất biến (unique cặp, Cascade vs Restrict).
  - [x] `npm run prisma:generate`.
  - [x] 🔴 **KHÔNG** seed. Danh mục gói bắt đầu **rỗng** — khác `CustomerSource` (bảng đó bắt buộc phải có dòng vì `Customer.sourceId` là FK NOT NULL). **Không có gì FK bắt buộc vào `ProductGroup`** ⇒ không cần seed, **CẤM** viết seed.

- [x] **Task 2 — Domain event (AC-6)**
  - [x] `src/catalog/domain/product-group-events.ts` (**NEW**): `ProductGroupSnapshot` + 5 class event. Khuôn: `catalog/domain/product-events.ts` + `product-price-events.ts`.
  - [x] `ProductGroupItemsReplaced(actor, groupId, before: readonly Item[], after: readonly Item[], occurredAt)` ⇒ `target = { type: 'ProductGroup', id: groupId }`.
  - [x] **Thuần domain** — không import Nest/Prisma.

- [x] **Task 3 — DTO (AC-3, AC-4, AC-5)**
  - [x] `dto/create-product-group-request.dto.ts` (**NEW**): `name` (`@IsString @IsNotEmpty @MaxLength(…)`) · `description?` (`@IsOptional @IsString @MaxLength(…)`).
  - [x] `dto/update-product-group-request.dto.ts` (**NEW**): `name?` **`@IsOptionalNotNull`** (cột NOT NULL) · `description?` **`@IsOptional`** (cột nullable ⇒ cho `null` để xoá mô tả).
  - [x] 🔴 **CẤM `PartialType`** (bài học HIGH review 3.1). **CẤM** field `isActive` trong DTO ghi.
  - [x] `dto/replace-product-group-items-request.dto.ts` (**NEW**): `productIds: string[]` — `@IsArray() @IsUUID('4', { each: true })`. Mảng rỗng **hợp lệ** (không `@ArrayNotEmpty`).
  - [x] `dto/product-group-response.dto.ts` + `dto/product-group-detail-response.dto.ts` (**NEW**): 🔴 **KHÔNG có `costPrice`** (AC-5). Item projection: `{ productId, name, sku, unit, price, isActive, displayOrder }`.
  - [x] **CẤM** permission literal trong `@ApiProperty({ example })` (guard quét cả `example:` — đã cắn ở 3.1).

- [x] **Task 4 — Service (AC-3..AC-6)**
  - [x] `src/catalog/product-groups.service.ts` (**NEW**): `constructor(prisma: PrismaService, eventBus: EventBus)`.
  - [x] `findAll(includeInactive)` · `findOne(id)` (**`select` tường minh, CẤM `include: { product: true }`** — AC-5) · `create` · `update` (**`effective()` + early-return khi không đổi gì**) · `deactivate` · `reactivate` · `replaceItems`.
  - [x] `replaceItems`: validate trùng + validate tồn tại (**một `findMany` cho cả mảng**, không N+1) ⇒ `$transaction([deleteMany, ...(ids.length > 0 ? [createMany] : [])])` ⇒ publish.
  - [x] `findOrThrow` ⇒ 404 · `translateWriteError` ⇒ 409 + `fieldErrors` (khuôn `products.service.ts:244-259`).
  - [x] **KHÔNG** `ErrorCode` mới. **CẤM** `import AuditService`.

- [x] **Task 5 — Controller + module (AC-3, AC-4)**
  - [x] `src/catalog/product-groups.controller.ts` (**NEW**): `@ApiTags('catalog')` + `@ApiBearerAuth()` + `@Controller('product-groups')`; 7 handler; cả 7 ⇒ `@RequirePermissions(PERM.catalogManage)` + Swagger response decorator đầy đủ (`ErrorEnvelopeDto` cho mọi lỗi). Actor qua `@CurrentAccount()`.
  - [x] 🔴 Khai `@Post(':id/reactivate')` và `@Put(':id/items')` **TRƯỚC** các route `:id` trần, kẻo bị nuốt.
  - [x] ⚠️ Guard `no-handler-without-require-permissions` **fail-closed**: viết **method thường, thụt 2 space** (arrow-function property bị tính là offender).
  - [x] `catalog.module.ts` (**UPDATE**): + `ProductGroupsController` + `ProductGroupsService`. **KHÔNG** module mới (`catalog.module.ts:14` đã dành sẵn chỗ). **KHÔNG** import `PrismaModule`/`EventsModule` (cả hai `@Global`).

- [x] **Task 6 — Test (AC-9)**
  - [x] `test/product-groups.service.spec.ts` · `test/product-groups.e2e.spec.ts` · `test/product-groups.db.integration.spec.ts` (**NEW**).
  - [x] `test/openapi-drift.spec.ts` (**UPDATE**): 7 operation + 6 DTO + bearer (6 chứ không phải 4 — `ProductGroupItemResponseDto` là schema nested tách riêng, và cả `ProductGroupDetailResponseDto`).
  - [x] `npm run openapi:gen` ⇒ commit `openapi/openapi.json`.

- [x] **Task 7 — Cổng chất lượng + mutation test (AC-10)**
  - [x] Chạy đủ cổng ở AC-10.
  - [x] **Mutation test** — bốn đột biến, mỗi cái **biên dịch sạch** trước khi chạy, xanh lại sau khôi phục. Kết quả **lệch dự đoán ở hai chỗ, ghi rõ ở Completion Notes**:
    (a) bỏ `if (productIds.length > 0)` ⇒ unit "`[]` chỉ gọi `deleteMany`" **ĐỎ** ✅. **Nhưng lane DB VẪN XANH** — xem Completion Note #2.
    (b) đổi `select` tường minh ở `findOne` thành `include: { product: true }` ⇒ unit "select không xin costPrice" **ĐỎ** ✅. **Nhưng e2e/lane DB vẫn xanh** vì `toItemRow()` là lớp projection THỨ HAI — xem Completion Note #3, và đột biến bổ sung **(b2)** chứng minh e2e/DB **ĐỎ** khi rò thật.
    (c) bỏ early-return ở `update()` ⇒ 2 ca no-op **ĐỎ** ✅.
    (d) đổi gate `PUT :id/items` sang `PERM.settingsManage` ⇒ 5 ca e2e **ĐỎ** ✅.
  - [x] ⚠️ Đột biến **phải biên dịch sạch** (`npm run build` xanh trước khi chạy) — mutant lỗi TS làm **cả suite** đỏ và **không chứng minh gì** (bài học 3.3).
  - [x] ⚠️ Khôi phục bằng **`cp` từ backup**, **KHÔNG `git checkout`** — code story chưa commit, checkout **xoá sạch** (bài học 3.4).

## Dev Notes

### Quyết định lớn của story này (đã cân nhắc — đừng lật ở review mà không có bằng chứng mới)

#### 1. Story này BACKEND-ONLY — không dựng UI, không đẻ Checkbox

Tên story có chữ "Checklist trên UI", nên phản xạ đầu tiên là đi dựng màn. **Đừng.** Bốn bằng chứng hội tụ:

| Bằng chứng | Nói gì |
|---|---|
| Mockup `all-screens.html:1466-1486` | Checklist gói **nằm TRONG màn `s-quote`** (Báo giá / giỏ hàng) — màn của **Story 4.1**, **chưa tồn tại**. Không có màn để gắn checklist vào. |
| Danh sách 30 màn mockup | **KHÔNG có** `s-product-group`. `s-catalog` (`:3361`) là **bảng sản phẩm thuần**, không có tab gói. ⇒ **không có UX spec** cho màn quản lý gói. |
| Story 3.1 + 3.2 (đã ship) | CRUD sản phẩm + giá phân tầng ship **BACKEND-ONLY**, dù `s-catalog` **có** mockup. ⇒ khuôn của Epic 3: **catalog = backend, UI để sau.** `web/src/screens/` hôm nay: `auth` · `account` · `customers` · `settings` — **không có `catalog`**. |
| Epic 1 spine | *"Ship kèm 1 màn, không phải **thư viện treo kệ**"* |

Và một sự thật kỹ thuật: **KHÔNG có primitive Checkbox nào tồn tại** — không ở `web/src/design-system/`, không ở `mobile/lib/design_system/` (21 component web / 20 widget Dart, **không cái nào là toggle/tick**). Mockup vẽ tick bằng `<span class="tick">` — một **hình vẽ tĩnh**, không phải control (`.tick`/`.cross` cũng **chưa từng được ship** vào `components.css`).

⇒ Dựng Checkbox trong story này = đẻ một primitive **không có người dùng** (consumer của nó là màn báo giá, Epic 4), **cộng** 2 file parity Dart, **cộng** sửa `design-system/components/parity.test.mjs`. Đó là **thư viện treo kệ**, đúng thứ Epic 1 cấm. Khi Story 4.1 dựng `s-quote`, nó sẽ dựng Checkbox **cùng với người dùng đầu tiên của nó** — và lúc đó mới biết checkbox cần API gì.

**Hệ quả có ý thức:** hết story này, **chưa ai tạo được gói qua giao diện** — chỉ qua API. Đúng như sản phẩm đang có: chưa ai tạo được **sản phẩm** qua giao diện (3.1/3.2 cũng backend-only). Màn quản lý catalog (sản phẩm + gói) là **một story riêng**, cần **mockup mới** — xem [câu hỏi #1](#câu-hỏi-cho-đại-ca-không-chặn-dev--trả-lời-được-lúc-review).

#### 2. Gate `catalog.manage` cho CẢ đọc lẫn ghi — và quả mìn để lại cho Story 4.1

`catalog.manage` = *"Sửa danh mục & giá"* (`permission-registry.ts:102`), khớp nguyên văn "As a **người có quyền sửa danh mục**" của AC gốc. `settings.manage` là **sai** — nó dành cho *cấu hình doanh nghiệp đặt-một-lần* (nguồn khách, VAT), còn gói vật tư là *dữ liệu vận hành sửa hằng tuần* (`docs/quyet-dinh…md#5`).

🔴 **Nhưng có một quả mìn, và nó KHÔNG nổ trong story này — nó nổ ở Story 4.1:**

```
THO_KS (Thợ khảo sát — NGƯỜI DỰNG BÁO GIÁ) =
  { quotes.create_edit, orders.confirm, discounts.apply,
    contracts.generate, customers.manage, orders.view_own }
                    ↑ KHÔNG CÓ catalog.manage
```

Thợ KS **không có** `catalog.manage` (`role-presets.ts:90-97`). Mà `@RequirePermissions` là **AND thuần** (`permissions.guard.ts:59` — `required.every(...)`), **không có OR**. ⇒ Khi Story 4.1 dựng picker gọi `GET /product-groups/:id`, **thợ KS sẽ ăn 403** và checklist chết ngay trên màn nó sinh ra để phục vụ.

**Vì sao vẫn gate `catalog.manage` ở story này, không nới sẵn:**
1. **Lỗ này ĐÃ tồn tại và rộng hơn gói:** `GET /products` cũng gate `catalog.manage` (`products.controller.ts:81`) từ Story 3.1. Thợ KS hôm nay **đã không đọc được sản phẩm**. Nới riêng cho `/product-groups` = vá **một nửa** cái lỗ, và giỏ hàng vẫn chết vì không đọc nổi `/products`.
2. **Vá tử tế cần một quyết định thật:** hoặc thêm key `catalog.view` (⇒ **hai lần regen**: backend `permissions:gen` **và** `cd design-system && npm run build:permissions` — quên một cái là FE stale mà CI **không** bắt), hoặc cho guard hiểu OR. Cả hai đều **vượt phạm vi** story này và **chạm cả `/products`**.
3. Picker là **Epic 4**. Nới quyền cho một endpoint chưa có ai gọi = đoán mò.

⇒ **Ghi rõ vào [Bàn giao cho Story 4.1](#bàn-giao-cho-story-41-đọc-trước-khi-code-giỏ-hàng)** và [câu hỏi #2](#câu-hỏi-cho-đại-ca-không-chặn-dev--trả-lời-được-lúc-review). **Đây là bug thật, chỉ là chưa tới giờ nổ.** Đừng "tiện tay" nới ở đây rồi tưởng đã xong.

#### 3. `isActive`, không phải `active` — theo module, không theo bản vẽ

ERD spine (`ARCHITECTURE-SPINE.md:348-360`) vẽ `PRODUCT_GROUP { … bool active … }`. Nhưng code đã ship có **hai** quy ước:
- `catalog/`: `Product.isActive` `@map("is_active")`
- `customers/`: `CustomerSource.active`

`ProductGroup` sống trong **`catalog/`**, ngồi cạnh `Product` trong cùng `schema.prisma`, và service của nó sẽ copy `ProductsService.deactivate()`. ⇒ chọn **`isActive`** để **một module một quy ước**. ERD là bản vẽ khái niệm (nó cũng viết `createdAt` mà bỏ `updatedAt`, viết `string description` mà thực tế nullable) — nó không phải hợp đồng cột-theo-cột.

Ghi ở đây để reviewer không gắn cờ "lệch ERD", và để dev không "sửa cho khớp bản vẽ" giữa chừng.

#### 4. Soft-delete, nhưng KHÔNG cần source-guard chống hard-delete

Story 3.5 phải dựng source-guard `no-hard-delete-customer-source.spec.ts` vì `Customer.sourceId` là **FK NOT NULL ON DELETE RESTRICT** — xoá cứng một nguồn là **mất lịch sử "khách này từ đâu tới"**.

`ProductGroup` **không có áp lực đó**: theo §2, gói **không bao giờ được lưu lên Đơn**, nên **không bảng nào FK bắt buộc vào nó**. Xoá cứng một gói **thật sự an toàn** — không mất dữ liệu lịch sử nào.

⇒ Story này: **chỉ ship soft-delete** (`DELETE` = `isActive: false`), vì nó **rẻ hơn và hoàn tác được**, và ERD có sẵn cột. Nhưng **KHÔNG** dựng source-guard cấm hard-delete — cấm một thứ vốn vô hại là **nghi lễ**, không phải kỹ thuật. (Ghi ở đây để reviewer không đòi guard "cho giống 3.5". Hai ca **khác nhau về bản chất**.)

#### 5. Sản phẩm đã tắt VẪN vào gói được — chặn lúc ghi là an toàn giả

Xem AC-4. Tóm tắt lý lẽ: một `Product` có thể bị tắt **sau** khi đã nằm trong gói. Nên picker Epic 4 **buộc phải** biết cách hiển thị item trỏ sản phẩm đã tắt — **dù ta có chặn lúc ghi hay không**. Chặn lúc ghi chỉ tạo cảm giác an toàn rồi vẫn phải viết đúng logic đó ở FE. ⇒ Không chặn; **trả `isActive` của từng sản phẩm trong payload đọc** để picker tự xử.

### 🔴 Bẫy chí mạng của story này: rò `costPrice` qua cửa mới

Đọc AC-5 hai lần. Đây là chỗ story này dễ thủng nhất, và nó **không** thủng ở nơi bạn đang nhìn:

`ProductsService` bảo vệ `costPrice` rất cẩn thận — `stripCostPrice()` (`domain/product-visibility.ts`) lọc theo `costs.view` cho **mọi** payload sản phẩm. Nhưng `ProductGroupsService` là một **service mới**, một **cửa mới**. Một dòng hồn nhiên:

```ts
// ❌ TRẢ NGUYÊN BẢN GHI Product — KÈM costPrice — cho mọi ai có catalog.manage
items: { include: { product: true } }
```

…sẽ đi **vòng qua** toàn bộ hàng rào của Story 3.1. Người có `catalog.manage` nhưng **không** có `costs.view` (ví dụ preset `THO_KS`… mà khoan, thợ KS còn không có `catalog.manage` — nhưng `QUAN_LY`/`KE_TOAN` **có cả hai**, còn một account tuỳ biến thì hoàn toàn có thể có `catalog.manage` mà không `costs.view`) sẽ đọc được **giá vốn** qua endpoint gói.

⇒ **`select` tường minh. Luôn luôn.** Và mutation (b) ở Task 7 tồn tại **chính xác** để chứng minh test bắt được chuyện này.

### Ràng buộc kiến trúc bắt buộc (vi phạm = fail guard hoặc fail review)

| Ràng buộc | Nguồn | Hệ quả cụ thể |
|---|---|---|
| Backend sở hữu nghiệp vụ; client chỉ REST | AD-1, AD-2 | `displayOrder` do **server** gán (index mảng). Client không đánh số. |
| Backend enforce **mọi** request | AD-4 | 7 route đều `@RequirePermissions`. Guard `no-handler-without-require-permissions` fail-closed. |
| Tiền là **integer đồng**, client CẤM làm số học tiền | AD-10, AD-16 | Story này **không tính tiền gì cả**. "giá = giá item × SL" là việc của `/orders/preview-total` (Story 4.2). **Đừng** thêm field `total`/`subtotal` vào payload gói. |
| Error envelope **một chỗ** | AD-5 | `throw new AppException(...)`. Controller **không** dựng envelope (guard `no-controller-error-envelope`). Không thêm `ErrorCode` mới. |
| Permission registry là SSOT | AD-17 | `PERM.catalogManage` — **đã có**, **KHÔNG** thêm key, **KHÔNG** chạy `permissions:gen`. **CẤM literal** — kể cả trong `example:`. |
| EventBus là đường duy nhất cho side-effect | AD-18 | Publish event **sau** commit; **CẤM** `import AuditService` (guard `no-direct-side-effect-outside-eventbus`). |
| OpenAPI sinh từ code | AD-12 | `npm run openapi:gen`, **cấm sửa tay** `openapi.json`. Drift-guard byte-for-byte. |
| Chỉ `PrismaService` chạm DB | AD-1 | Guard `no-manual-prisma-client` quét `src/`. |
| File kebab-case | CONVENTIONS | Guard `naming-convention` quét `src/`. |
| Audit append-only | CONVENTIONS | Guard `audit-log-append-only` — chỉ `create` trên `auditLog`. |
| Mỗi story sở hữu entity của nó | CONVENTIONS | `Order`/`OrderVersion`/`OrderLineItem` = **E4**. Story này **CẤM** đụng. |

### Bàn giao cho Story 4.1 (đọc trước khi code giỏ hàng)

Story này cố tình **không** làm ba việc dưới. Ghi lại để 4.1 không phải đoán:

1. 🔴 **Quyền đọc gói/sản phẩm cho thợ KS.** `THO_KS` không có `catalog.manage`, mà `GET /product-groups/*` **và** `GET /products` đều gate bằng nó. `@RequirePermissions` là **AND thuần, không OR**. ⇒ **Picker sẽ 403 cho đúng người dùng nó phục vụ.** Phải giải quyết ở 4.1 (thêm key `catalog.view` ⇒ nhớ **hai** lần regen: backend `permissions:gen` + `cd design-system && npm run build:permissions`; hoặc cho guard hiểu OR). **Không phải bug của 3.6 — là hợp đồng 3.6 bàn giao.**
2. **Primitive Checkbox chưa tồn tại** (cả web lẫn mobile). Mockup vẽ tick bằng `<span class="tick">` — hình tĩnh, không có focus/`aria-checked`, và `.tick`/`.cross` **chưa vào `components.css`**. Sàn a11y đòi target ≥44px + tên đọc được (UX-DR-26, guard `a11y-floor.test.mjs`) ⇒ **control thật buộc phải khác bản vẽ**. Dựng nó **cùng** màn báo giá, và nhớ file Dart song sinh + `design-system/components/parity.test.mjs` (`parityFiles` map).
3. **Gói KHÔNG được lưu lên Đơn** (§2, AC-7). Mockup có in chuỗi provenance trên dòng giỏ hàng (`"… · gói Hybrid 8kW"`, `"từ gói Hybrid 8kW"`, `all-screens.html:1418,1426,1434,1561`). Chuỗi đó **KHÔNG được persist** — hoặc dựng lúc render từ phiên picker, hoặc bỏ. **Đừng thêm cột `groupName` vào `OrderLineItem`.**

### Previous Story Intelligence (3.1 → 3.5 — máu đã đổ, đừng chảy lại)

1. **🔴 Đếm số lần gọi ⇒ xanh-giả (CRITICAL review 3.2).** ⇒ assert **payload** `data`/`where`/`select`, không `toHaveBeenCalledTimes`.
2. **🔴 `createMany` RỖNG làm hỏng atomic-replace trên Prisma 7** ⇒ giữ `if (length > 0)` (`product-prices.service.ts:90-102`). Đây là khuôn story này copy — **đừng copy thiếu cái guard đó**.
3. **`@IsOptional()` cho `null` lọt qua (HIGH review 3.1).** Cột NOT NULL (`name`) ⇒ `@IsOptionalNotNull()`; cột nullable (`description`) ⇒ `@IsOptional()`. **Cấm `PartialType`.**
4. **Thiếu trần trên ⇒ tràn (HIGH review 3.2/3.5).** Mọi cột `Int` **client ghi được** cần `@Max(INT4_MAX)`. Story này: `displayOrder` do **server** gán ⇒ **không có cột Int nào client ghi** ⇒ không cần `@Max`. Nếu bạn đổi thiết kế cho client gửi `displayOrder` ⇒ **phải** thêm `@Max`.
5. **`update()` publish vô điều kiện ⇒ audit nói dối (review 3.5).** Early-return khi không cột nào đổi. ⚠️ `ProductsService.update` **chưa** có — **copy `customer-sources.service.ts`, đừng copy `products.service.ts`**.
6. **`@Post(':id/reactivate')` mặc định trả 201** ⇒ thêm `@HttpCode(HttpStatus.OK)` (sai lệch duy nhất của 3.5 so với AC).
7. **Guard `no-permission-literal-outside-registry` quét cả `@ApiProperty({ example })`** (cắn ở 3.1).
8. **Guard text quét toàn văn** ⇒ **đừng viết chuỗi bị cấm trong comment** (false-positive tái diễn ~7 story).
9. **Mutation phải biên dịch sạch** (3.3) — mutant lỗi TS làm cả suite đỏ, chứng minh **0**.
10. **Khôi phục sau mutation bằng `cp`, KHÔNG `git checkout`** (3.4) — code story chưa commit.
11. **Prisma 7: `ON DELETE RESTRICT` lúc DELETE KHÔNG mang code P2003** (phát hiện 3.5) — chỉ `DriverAdapterError` + message. ⇒ lane DB assert **hành vi**, không bám mã.
12. **Prisma 7: đừng spread union vào query** — `include: undefined` truyền như **giá trị** (khuôn `tieredPriceInclude()`, `products.service.ts:50-56`), không spread.
13. **e2e: mock Prisma phải đủ MỌI model đường request chạm** — thiếu một cái ⇒ 500 cả suite (cắn ở 3.1 với `featureFlag`).
14. **Drift-guard xanh ≠ hợp đồng đúng** — nó xanh y hệt nếu code **quên hẳn** một route (3.2/3.3/3.4/3.5 đều cắn). ⇒ assert **tường minh** từng route + DTO.

### Git Intelligence (5 commit gần nhất)

`5135ffa` 3.5 (**`customer-sources` CRUD + early-return no-op + source-guard** — khuôn service mới nhất, dùng cái này) · `e4efc77` 3.4 (6 màn khách — **AC-5 gốc của story này chỉ về đây, đã xong**) · `b35e036` 3.3 · `4de6362` 3.2 (**`ProductPricesService.replace()` — khuôn atomic-replace của AC-4**) · `0fba7c2` 3.1 (**`ProductsService` + `stripCostPrice` — hàng rào giá vốn mà AC-5 phải không được đi vòng qua**).

⇒ Khuôn backend Epic 3 **đã ổn định**: controller mỏng → service (Prisma + EventBus) → domain thuần. Story này **chỉ mở rộng** `catalog/`, **không** đẻ module mới. Commit **conventional**, không tham chiếu AI.

### Project Structure Notes

```
backend/
  prisma/
    schema.prisma                                   # UPDATE: + ProductGroup, ProductGroupItem, back-relation trên Product
    migrations/20260713030000_add_product_groups/
      migration.sql                                 # NEW (sinh offline bằng migrate diff)
  src/catalog/
    catalog.module.ts                               # UPDATE: + controller + service (KHÔNG module mới)
    domain/product-group-events.ts                  # NEW (thuần domain, 5 event)
    product-groups.controller.ts                    # NEW (7 route, gate catalog.manage)
    product-groups.service.ts                       # NEW
    dto/create-product-group-request.dto.ts         # NEW
    dto/update-product-group-request.dto.ts         # NEW
    dto/replace-product-group-items-request.dto.ts  # NEW
    dto/product-group-response.dto.ts               # NEW  (KHÔNG costPrice)
    dto/product-group-detail-response.dto.ts        # NEW  (KHÔNG costPrice)
  openapi/openapi.json                              # UPDATE: openapi:gen
  test/
    product-groups.service.spec.ts                  # NEW
    product-groups.e2e.spec.ts                      # NEW
    product-groups.db.integration.spec.ts           # NEW
    openapi-drift.spec.ts                           # UPDATE
```

**KHÔNG tạo/sửa:** `permission-registry.ts` · `role-presets.ts` · `openapi/permissions.json` · `prisma/seed.ts` · **bất kỳ file nào trong `web/`, `mobile/`, `design-system/`** · bất kỳ entity nào của Epic 4.

**Tái dùng, KHÔNG viết lại** (đã scout — đây là kết quả):

- `ProductPricesService.replace()` (`catalog/product-prices.service.ts:90-102`) — **khuôn atomic-replace**, gồm cả guard `createMany` rỗng và `assertNoDuplicate*` chặn-trước-transaction.
- `ProductPricesReplaced` (`catalog/domain/product-price-events.ts:14-29`) — **khuôn event thay-cả-tập**, `target` trỏ về **cha**.
- `CustomerSourcesService.update/deactivate/reactivate` (`customers/customer-sources.service.ts:50-53,137-143,189,213`) — **khuôn early-return no-op** (mới nhất, đã qua review).
- `ProductsService.deactivate()` + `findOrThrow` + `translateWriteError()` (`catalog/products.service.ts:193-209,244-259`).
- `isUniqueViolation()` (`common/errors/prisma-unique-violation.ts`) — **đã có**.
- `@IsOptionalNotNull()` (`catalog/dto/is-optional-not-null.decorator.ts`) — **đã có, đừng viết lại**.
- `AppException` + `ErrorCode` (`VALIDATION_ERROR`/`NOT_FOUND`/`CONFLICT`) — **không thêm mã mới**.
- `PERM.catalogManage` (`accounts/domain/permission-registry.ts:49`) — **đã có, đã vào preset ADMIN/QUAN_LY/KE_TOAN**.
- Khuôn e2e: `backend/test/products.e2e.spec.ts`. Khuôn lane DB: `backend/test/customer-sources.db.integration.spec.ts`.

**Naming:** mọi file backend **kebab-case** (guard `naming-convention`). Entity PascalCase, bảng snake_case số nhiều. Route số nhiều kebab-case (`/product-groups`), hành động nghiệp vụ = **POST sub-resource** (`:id/reactivate`).

### Library / Framework

Node 24 LTS · NestJS 11.1.27 · **Prisma 7.8.0** · PostgreSQL 18.4 · class-validator + `@nestjs/swagger`.
**KHÔNG dependency mới.** **KHÔNG đụng React/Flutter.**

⚠️ **Prisma 7 — ba thứ khác đời trước:**
- `migrate diff` chỉ nhận `--from-schema` / `--to-schema` (**không** `--from-schema-datamodel`).
- `datasource` trong `schema.prisma` **chỉ khai `provider`** — URL nằm ở `prisma.config.ts`.
- `ON DELETE RESTRICT` vi phạm lúc **DELETE** ⇒ `DriverAdapterError` **không có** `code` (P2003 chỉ đến lúc INSERT).

### References

- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#2-Gói-vật-tư:77-83] — **SPEC CHÍNH**, là cái mà mọi `(§2)` trong epics trỏ về: gói = checklist · `ProductGroup` + `ProductGroupItem { productId }` · **"Không cần `defaultQty`"** · không giá trọn gói · **gói không lưu lên Đơn, không snapshot, không in PDF, Phase 1 KHÔNG BOM**.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6:398-405] — 5 AC gốc. **AC-2/3/4 = Epic 4** (`OrderLineItem` chưa tồn tại). **AC-5 = lỗi copy-paste của Story 3.4.**
- [Source: epics.md#Story-4.1:417] — 4.1 **nhắc lại** luật gói ("gói vật tư đẻ ra dòng trỏ Product thật"), **cùng trích dẫn `(§2)`** ⇒ bằng chứng consumption thuộc Epic 4.
- [Source: prds/prd-Solar-Energy-Management-2026-07-06/prd.md#3-Glossary:68 · #FR-1:104] — định nghĩa Gói vật tư; **KHÔNG FR nào sở hữu ProductGroup** (FR-14/15 không hề nhắc gói) ⇒ cha thật của nó là **FR-1**, không phải FR-29 (dòng FR-29 ở epics:141 là bookkeeping).
- [Source: prd.md#6.2-Ngoài-phạm-vi-MVP:519] — **BOM / định mức vật tư = Phase sau** ⇒ cơ sở cấm `defaultQty`.
- [Source: prd.md#4.6-Ma-trận-quyền × role-presets.ts:90-97] — **`THO_KS` KHÔNG có `catalog.manage`** ⇒ quả mìn của Quyết định #2.
- [Source: architecture/…/ARCHITECTURE-SPINE.md#Structural-Seed:348-360] — ERD `PRODUCT_GROUP { id, name, description, active, createdAt }` · `PRODUCT_GROUP_ITEM { id, productGroupId, productId, displayOrder }` · `PRODUCT ||--o{ PRODUCT_GROUP_ITEM` · **không có quan hệ nào từ ORDER tới PRODUCT_GROUP**.
- [Source: ARCHITECTURE-SPINE.md#AD-4 · AD-5 · AD-10 · AD-12 · AD-16 · AD-17 · AD-18] — enforce mọi request · một envelope lỗi · tiền integer · OpenAPI sinh từ code · client cấm số học tiền · registry quyền SSOT · side-effect chỉ qua EventBus.
- [Source: backend/CONVENTIONS.md] — kebab-case file · `@@map` snake_case số nhiều · route số nhiều, action = POST sub-resource · **"mỗi story sở hữu entity của nó · `Order` = E4"**.
- [Source: backend/src/accounts/domain/permission-registry.ts:49,102] — `catalogManage: 'catalog.manage'`, label **"Sửa danh mục & giá"** ⇒ khớp "As a người có quyền sửa danh mục".
- [Source: backend/src/auth/permissions.guard.ts:59] — `required.every(...)` ⇒ **AND thuần, KHÔNG có OR**.
- [Source: backend/src/catalog/product-prices.service.ts:90-102,128-163] — khuôn atomic-replace + **guard `createMany` rỗng** + chặn trùng trước transaction.
- [Source: backend/src/catalog/domain/product-visibility.ts:15-22 · products.service.ts] — `stripCostPrice()` + `costs.view` ⇒ **hàng rào giá vốn mà AC-5 không được đi vòng qua**.
- [Source: backend/src/customers/customer-sources.service.ts:50-53,137-143] — khuôn `effective()` + early-return no-op (*"Một `Updated` với `before === after` là một dòng audit nói dối"*).
- [Source: backend/src/catalog/catalog.module.ts:14] — *"`ProductGroup` (Story 3.6) sẽ về CÙNG module này"* ⇒ **không đẻ module mới**.
- [Source: backend/prisma/schema.prisma:119-135,150-162] — `Product` (`isActive`) + `ProductPrice` (khuôn bảng con: `@@unique`, `@@index`, `onDelete: Cascade`).
- [Source: ux-designs/…/mockups/all-screens.html:1466-1486] — khung *"Biến thể · Chọn gói vật tư"*, **nằm TRONG `s-quote`** (màn Epic 4). Tick vẽ bằng `<span class="tick">` — **hình tĩnh**, `.tick`/`.cross` **chưa ship** vào `components.css`.
- [Source: ux-designs/…/mockups/all-screens.html — danh sách 30 `id="s-*"`] — **KHÔNG có `s-product-group`**; `s-catalog:3361` là bảng sản phẩm thuần ⇒ **không có UX spec cho màn quản lý gói** ⇒ cơ sở Quyết định #1.
- [Source: epics.md#UX-DR-27 · DESIGN.md:148] — parity web+mobile là luật chung; ngoại lệ **có tên** duy nhất là *"Cấu hình nguồn khách chỉ có Web"*. Gói vật tư **không** nằm trong ngoại lệ — nhưng story này **không dựng màn nào**, nên câu hỏi parity **chưa phát sinh** (nó phát sinh ở Epic 4).
- [Source: _bmad-output/implementation-artifacts/3-5-…md#Senior-Developer-Review] — seed khoá theo tên ⇒ đẻ dòng trùng; `@Max` thiếu ở update DTO; `update()` publish vô điều kiện; **Prisma 7 `RESTRICT` lúc DELETE không mang P2003**.
- [Source: _bmad-output/implementation-artifacts/3-4-…md] — 6 màn khách (**AC-5 gốc của story này**) đã ship, commit `e4efc77`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia — Dev agent, BMAD dev-story workflow)

### Debug Log References

- `npx prisma migrate diff --from-schema <copy> --to-schema prisma/schema.prisma --script` — sinh migration offline. Xác nhận: **không có ALTER nào cho `products`** (back-relation không sinh SQL, đúng như AC-1 dự đoán).
- `npx prisma migrate deploy` — áp migration `20260713030000_add_product_groups` lên Postgres thật (cần cho lane DB).
- **Nhiễu test một lần:** ngay sau khi `cp` khôi phục file bị đột biến, `npm test` báo 2 suite đỏ. Chạy lại 3 lần liên tiếp: **674/674 xanh cả 3 lần**. Nguyên nhân là cache transform của ts-jest còn giữ bản đột biến. Không phải lỗi code — nhưng ghi lại để lần sau không hoảng.

### Completion Notes List

**1. ✅ AC-8 (verify-only) — đã xác nhận, KHÔNG code gì.** `web/src/screens/customers/` có `CustomerListScreen.tsx` · `CustomerDetailScreen.tsx` · `CustomerPickScreen.tsx`; `mobile/lib/screens/customers/` có 3 file Dart tương ứng. AC-5 gốc ở `epics.md:405` đúng là **AC của Story 3.4 bị copy nhầm** sang Story 3.6 — 6 màn đã ship ở commit `e4efc77`. **Cần sửa `epics.md` ở retro Epic 3** (xem câu hỏi #5).

**2. 🔴 LỆCH DỰ ĐOÁN — `createMany` RỖNG *không* làm no-op transaction trên Prisma 7.8.0 + adapter-pg (ở đường này).** Story (và bài học từ `account-permissions.service.ts`) khẳng định đột biến (a) sẽ làm **lane DB atomic-replace đỏ**. Kiểm chứng thật trên Postgres: bỏ guard `if (productIds.length > 0)` ⇒ unit test đỏ đúng như mong đợi, **nhưng lane DB `3 món → 0 món → 2 món` VẪN XANH** — `deleteMany` vẫn chạy, `count` vẫn về 0. ⇒ Hoặc hành vi này đã đổi ở 7.8.0, hoặc nó phụ thuộc ngữ cảnh (`account-permissions` dùng khuôn khác). **Guard vẫn được GIỮ NGUYÊN** (rẻ, vô hại, và unit test canh nó), nhưng **đừng tin rằng lane DB sẽ bắt được nếu ai đó gỡ nó** — chỉ unit test bắt. Đây là bằng chứng thực nghiệm, không phải suy đoán.

**3. 🔴 LỆCH DỰ ĐOÁN — có HAI lớp chặn rò `costPrice`, không phải một; mutation (b) chỉ đụng lớp thứ nhất.** Story dự đoán đột biến (b) (`select` → `include: { product: true }`) sẽ làm **e2e "costPrice không có trong body" đỏ**. Thực tế: **e2e và lane DB vẫn XANH**, vì `toItemRow()` projection tường minh từng field là **lớp phòng thủ thứ hai** — giá vốn được *fetch* về app nhưng *không* rời server. Để chứng minh assertion e2e **không phải test giả**, tôi chạy thêm **đột biến (b2)**: đổi `toItemRow` thành `{ ...row.product, … }` (rò thật) ⇒ **e2e ĐỎ + lane DB ĐỎ** ✅. ⇒ Kết luận: hai lớp, hai guard riêng — `select` canh bởi unit test, projection canh bởi e2e + lane DB. Cả hai đều thật.

**4. Gate `catalog.manage` cho cả 7 route — quả mìn Epic 4 vẫn nguyên, CỐ Ý.** `THO_KS` (người dựng báo giá) **không có** `catalog.manage`, và `@RequirePermissions` là AND thuần. Picker gói ở Story 4.1 sẽ **403 cho đúng người dùng nó phục vụ**. Không vá ở đây vì lỗ này bao cả `GET /products` (từ 3.1) — vá nửa vời còn tệ hơn. Đã ghi vào TSDoc của controller + [Bàn giao cho Story 4.1](#bàn-giao-cho-story-41-đọc-trước-khi-code-giỏ-hàng). **Xem câu hỏi #2.**

**5. Không seed, không source-guard chống hard-delete.** Danh mục gói bắt đầu **rỗng** (không bảng nào FK bắt buộc vào `ProductGroup`) ⇒ không cần seed. Và **không** dựng source-guard cấm hard-delete như 3.5: xoá cứng một gói **thật sự an toàn** (không mất lịch sử nào), nên cấm nó là nghi lễ chứ không phải kỹ thuật. Soft-delete vẫn ship vì rẻ và hoàn tác được.

**6. Bảng đếm test.** *(Cập nhật sau review 2026-07-14: hermetic **684/47 suite**, lane DB **35** — chênh so với số dưới là do các ca thêm ở review.)* Backend hermetic **674 pass / 47 suite** (baseline 616/45 ⇒ **+58 test, 0 regression**). Lane DB **34 pass** (baseline 25 ⇒ **+9**). design-system **250/250** và mobile **145/145 + `flutter analyze` sạch** — cả hai **không bị đụng**, xanh y nguyên. `lint` · `format:check` · `build` (`nest build` = cổng type) đều sạch.

**7. Số DTO trong OpenAPI là 6, không phải 4.** AC-9/AC-10 nói "4 DTO mới". Thực tế spec sinh ra **6 schema**: `CreateProductGroupRequestDto` · `UpdateProductGroupRequestDto` · `ReplaceProductGroupItemsRequestDto` · `ProductGroupResponseDto` · `ProductGroupDetailResponseDto` · `ProductGroupItemResponseDto` (schema nested của item được `@nestjs/swagger` tách riêng). Drift-guard assert đủ **cả 6**, và assert **không schema nào chứa `costPrice`**.

### File List

**NEW**
- `backend/prisma/migrations/20260713030000_add_product_groups/migration.sql`
- `backend/src/catalog/domain/product-group-events.ts`
- `backend/src/catalog/product-groups.service.ts`
- `backend/src/catalog/product-groups.controller.ts`
- `backend/src/catalog/dto/create-product-group-request.dto.ts`
- `backend/src/catalog/dto/update-product-group-request.dto.ts`
- `backend/src/catalog/dto/replace-product-group-items-request.dto.ts`
- `backend/src/catalog/dto/product-group-response.dto.ts`
- `backend/src/catalog/dto/product-group-detail-response.dto.ts`
- `backend/test/product-groups.service.spec.ts`
- `backend/test/product-groups.e2e.spec.ts`
- `backend/test/product-groups.db.integration.spec.ts`

**UPDATE**
- `backend/prisma/schema.prisma` (+ `ProductGroup`, `ProductGroupItem`, back-relation `groupItems` trên `Product`)
- `backend/src/catalog/catalog.module.ts` (+ controller + service)
- `backend/test/openapi-drift.spec.ts` (+ 3 ca: 7 operation, không DTO nào phơi `costPrice`, mọi operation đòi bearer)
- `backend/openapi/openapi.json` (sinh lại bằng `openapi:gen`)
- `_bmad-output/implementation-artifacts/3-6-goi-vat-tu-checklist-product-group.md` (story này)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`ready-for-dev` → `in-progress` → `review`)

## Senior Developer Review (AI) — 2026-07-14

**Kết quả: Approve.** 0 CRITICAL còn lại. Cổng chất lượng chạy lại từ đầu sau khi sửa: `npm test` **684/684 xanh (47 suite)** · `npm run test:db` **35/35** · `lint` · `format:check` · `build` — sạch cả năm.

Hai bất biến được soát riêng theo yêu cầu, và **cả hai đứng vững**:

- **Gói KHÔNG rò lên Đơn (AC-7).** `ProductGroup` chỉ xuất hiện ở đúng 9 file, tất cả trong `src/catalog/`. Không có model `Order`/`OrderVersion`/`OrderLineItem` nào trong schema; không có cột `groupId`/`groupName` ở bất kỳ bảng nào khác; payload `/products` không mang field gói nào. Story thi hành ràng buộc này bằng cách **không xây cửa**, đúng như thiết kế.
- **`@@unique(productGroupId, productId)`.** Kiểm trên Postgres đang chạy: `CREATE UNIQUE INDEX product_group_items_product_group_id_product_id_key ON product_group_items (product_group_id, product_id)` — có thật, kèm `ON DELETE CASCADE` (gói) và `ON DELETE RESTRICT` (sản phẩm). Tầng app chặn trùng **trước** khi mở transaction, nên `deleteMany` không bao giờ chạy rồi mới vỡ constraint.

### 🔴 Đã sửa — HIGH: `PUT :id/items` không có khoá, hai lệnh chồng nhau làm HỎNG checklist

`$transaction` **không tự làm nên** atomic-replace. Postgres chạy READ COMMITTED: `deleteMany` của lệnh thứ hai lấy ảnh chụp lúc câu lệnh bắt đầu, nên **không thấy** những dòng lệnh thứ nhất vừa commit ⇒ nó xoá hụt rồi chèn tiếp danh sách của mình.

**Đã tái hiện trên Postgres thật** (không phải suy đoán): hai lệnh "thay sạch" 2 món chồng nhau ⇒ gói giữ **4 món, `displayOrder` 0,0,1,1**. Payload có món chung thì thay vào đó vỡ `@@unique` **ngay trong tx** ⇒ **500** cho một cú double-click Lưu (`replaceItems` không có `try/catch`).

**Sửa:** khoá dòng gói (`SELECT … FOR UPDATE`) làm op **đầu tiên** trong `$transaction` ⇒ hai lệnh thay cùng một gói nối đuôi nhau; lệnh sau xoá trên ảnh chụp mới, thấy đủ, thay sạch thật. Guard `if (productIds.length > 0)` giữ nguyên.

⚠️ **Ghi lại vì đã tốn máu:** hai bản test đầu tiên cho cái khoá này đều **XANH GIẢ**, chứng minh bằng đột biến gỡ khoá:
1. `Promise.all` hai `replaceItems` — hai batch-transaction của Prisma tình cờ nối đuôi theo thời gian, cuộc đua **không bao giờ xảy ra**.
2. "Giữ khoá rồi assert lệnh thay chưa xong" — nó **có** chặn, nhưng vì lý do KHÁC: INSERT dòng con lấy `FOR KEY SHARE` trên dòng cha để kiểm FK, vốn đã đụng `FOR UPDATE`. Ca đó đo cái chặn của **FK**, không đo khoá của service.

Bản cuối viết theo **KẾT QUẢ** (đếm món sau khi ép đúng cuộc đua), và đã kiểm: **gỡ khoá ⇒ ĐỎ** (dòng của lệnh dở dang sống sót ⇒ 3 món), **có khoá ⇒ XANH**. Đây là guard thật.

### Đã sửa — MEDIUM

| # | Vấn đề | Sửa |
|---|---|---|
| 1 | e2e "người có `costs.view` cũng không thấy giá vốn" là **test giả**: fixture không hề có `costPrice` ⇒ assert xanh kể cả khi service trả nguyên bản ghi `Product` | Fixture nay mang `costPrice: 1_950_000` ⇒ rò là thấy |
| 2 | `UpdateProductGroupRequestDto.description` sinh ra `"type": "object"` trong OpenAPI (metadata phản chiếu của union `string \| null` rơi về `Object`), trong khi `example` là chuỗi ⇒ client sinh từ spec gõ field này thành Object/Map, **không gửi nổi mô tả** | `type: String` tường minh; spec nay là `"type": "string"` |
| 3 | Comment lane DB khẳng định nó canh bug `createMany` rỗng — **sai, đột biến đã chứng minh ngược lại**: gỡ guard, lane DB vẫn xanh, chỉ unit test đỏ. Comment đó dụ người sau xoá đúng cái test duy nhất canh bug | Comment nói đúng sự thật: unit test là guard DUY NHẤT |
| 4 | Comment openapi-drift khẳng định spec bắt được rò `costPrice` từ service — **sai**: dự án không có `ClassSerializerInterceptor`, controller ép kiểu, nên đổi `select` thành `include` mà không đụng file DTO thì spec vẫn sạch | Comment phân biệt rõ ba lớp: DTO (drift-guard) · dây (e2e) · DB thật (lane DB) |
| 5 | `productIds` không có trần ⇒ kích cỡ payload tối đa do body-parser quyết định một cách tình cờ | `@ArrayMaxSize(200)` + `maxItems` vào spec |

### ⚠️ CHƯA sửa — cần Đại Ca quyết (không chặn 3.6)

1. **🔴 `ProductPricesService.replace()` (Story 3.2, ĐÃ SHIP) dính ĐÚNG lỗi đua ở trên.** Nó là khuôn mà story này copy, và nó **chưa có khoá**. Hai lệnh sửa bậc thang giá cùng một sản phẩm chồng nhau ⇒ bậc thang gộp/500 y hệt. Tôi **không tự sửa** vì nó nằm ngoài phạm vi 3.6 và chạm code đã review xong. **Đây là bug thật trong code đang chạy — nên xếp lịch.**
2. **`replaceItems` publish `ProductGroupItemsReplaced` vô điều kiện**, kể cả khi danh sách món **không đổi gì** (mở gói ra, bấm Lưu). Lệch với chính triết lý audit của story (PATCH/deactivate/reactivate đều early-return khi no-op). Sửa được, nhưng là **quyết định sản phẩm**: "ghi nhật ký mọi lần Lưu" hay "chỉ ghi khi có đổi"?
3. **`UpdateCustomerSourceRequestDto.description` (Story 3.5) dính đúng lỗi `type: "object"`** ở mục MEDIUM-2. Cùng một cách sửa. Ngoài phạm vi 3.6.
4. **Không có CI nào chạy `npm run test:db`** — repo **không có thư mục `.github/`**. Mọi bằng chứng tầng DB (unique, Cascade, Restrict, và cái khoá vừa thêm) chỉ chạy khi có người nhớ gõ tay.
5. **Không có index trên `product_group_items.product_id`.** Hôm nay vô hại (sản phẩm chỉ soft-delete nên `RESTRICT` không bao giờ nổ). Sẽ thành seq-scan khi có ai hỏi "sản phẩm X nằm trong những gói nào" — nhiều khả năng là picker Epic 4.

### Không phải lỗi (đã soi, kết luận sạch)

`select` tường minh chặn giá vốn ở cả 3 lớp · 7/7 route gate `catalog.manage` · thứ tự khai route đúng (`:id/reactivate`, `:id/items` trước `:id` trần) · guard `createMany` rỗng còn nguyên và **có** unit test canh · trùng/không tồn tại `productId` đều chặn trước transaction, một `findMany`, không N+1 · event publish sau commit, không import `AuditService` · `PartialType` không dùng, `name` chặn `null`, `description` nhận `null` để xoá mô tả · không cột `defaultQty`/`qty`/`price` nào trên `ProductGroupItem` · `displayOrder` client không ghi được ở bất kỳ đường nào ⇒ không cần `@Max`.

**Quả mìn `THO_KS` không có `catalog.manage`** (Completion Note #4) — **giữ nguyên, không đụng**. Đây là quyết định có lý lẽ của story, lỗ này bao cả `GET /products` từ 3.1, và vá nửa vời còn tệ hơn. Vẫn là hợp đồng bàn giao cho Story 4.1.

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-14 | **Review 3.6 → done.** Sửa HIGH: `PUT :id/items` thiếu khoá ⇒ hai lệnh thay chồng nhau GỘP checklist (4 món, `displayOrder` 0,0,1,1) hoặc vỡ `@@unique` trong tx ⇒ 500; đã tái hiện trên Postgres thật, vá bằng `SELECT … FOR UPDATE` trên dòng gói làm op đầu của transaction, và canh bằng một ca lane DB **đã kiểm đột biến** (gỡ khoá ⇒ ĐỎ). Sửa 5 MEDIUM: e2e `costs.view` là test giả (fixture không có `costPrice` để rò) · `description` sinh `type: "object"` trong OpenAPI làm hỏng client codegen · hai comment khẳng định sai về lớp nào canh cái gì · `productIds` thiếu trần. Cổng: 684/684 hermetic · 35/35 lane DB · lint · format · build. |
| 2026-07-13 | Ship Story 3.6 — gói vật tư backend: 2 entity + migration offline + 7 route gate `catalog.manage` + 5 domain event qua EventBus + atomic-replace checklist. Payload đọc dùng `select` tường minh + projection `toItemRow` ⇒ **`costPrice` không có đường nào rời server qua cửa gói**. 58 test backend mới (unit + e2e + lane DB Postgres thật), 4+1 đột biến kiểm chứng guard. **KHÔNG** dựng màn nào, **KHÔNG** đụng `Order`, **KHÔNG** seed. |

## Câu hỏi cho Đại Ca (không chặn dev — trả lời được lúc review)

1. **🔴 Màn quản lý gói — dựng khi nào, và ai vẽ?** Story này **backend-only** (Quyết định #1): mockup **không có** màn quản lý gói (`s-catalog` chỉ có bảng sản phẩm), và checklist duy nhất được vẽ **nằm trong màn báo giá của Epic 4**. Hết story này, gói **chỉ tạo được qua API** — y như **sản phẩm** hôm nay (3.1/3.2 cũng backend-only). ⇒ Cần **một story riêng cho màn Danh mục** (sản phẩm + gói chung một màn), và nó cần **mockup mới**. Xếp vào cuối Epic 3 hay đầu Epic 4?

2. **🔴 Thợ khảo sát không đọc được danh mục — vá ở đâu?** `THO_KS` (người dựng báo giá) **không có** `catalog.manage`, mà `GET /products` (từ 3.1) **và** `GET /product-groups` (story này) đều gate bằng nó; `@RequirePermissions` là **AND thuần, không OR**. ⇒ Đến Story 4.1, picker gói **và** danh sách sản phẩm sẽ **403 cho đúng người dùng nó phục vụ**. Hai lối vá: (a) thêm quyền `catalog.view` (rẻ về khái niệm, nhưng tốn **hai** lần regen và **không** CI nào chạy cả hai) hoặc (b) cho guard hiểu OR. **Tôi không tự vá trong 3.6** vì lỗ này rộng hơn gói (nó bao cả `/products`) và vá nửa vời còn tệ hơn. Đại Ca chọn lối nào — và làm ở story nào?

3. **Gói có cần `active` không, hay xoá cứng là đủ?** Tôi ship **soft-delete** (`isActive`) theo ERD. Nhưng khác `CustomerSource`, **không gì FK bắt buộc vào `ProductGroup`** (gói không lưu lên Đơn) ⇒ xoá cứng **thật sự an toàn**. Soft-delete = giữ được gói cũ để bật lại theo mùa. Nếu Đại Ca thấy gói là thứ "tạo rồi bỏ", nói để tôi bỏ luôn `isActive` + `reactivate` (giảm 2 route).

4. **Một sản phẩm nằm được nhiều gói chứ?** Tôi cho **được** (`@@unique` chỉ chặn trùng **trong cùng một gói**). Ví dụ "Dây DC 4mm²" nằm cả gói Hybrid lẫn gói Bám tải — hợp lý. Nếu nghiệp vụ đòi một sản phẩm chỉ thuộc một gói, báo sớm (đổi thành `@@unique([productId])` — nhưng tôi nghĩ **không**).

5. **`epics.md:405` (AC-5 của Story 3.6) là AC của Story 3.4 bị copy nhầm.** Tôi để **verify-only** và không code lại (AC-8). Cần sửa `epics.md` cho sạch — để retro Epic 3 gom, hay Đại Ca muốn tôi sửa luôn bây giờ?
