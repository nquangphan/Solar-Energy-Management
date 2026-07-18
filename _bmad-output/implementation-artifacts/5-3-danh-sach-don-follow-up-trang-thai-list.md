---
baseline_commit: c89d91e0d1c764da5721c01bafd0109b5cadb215
---

# Story 5.3: Danh sách đơn + follow-up + trạng thái list

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người có quyền xem đơn**,
I want **danh sách đơn lọc theo trạng thái và xem đơn chưa chốt để follow-up**,
so that **theo dõi và chăm đơn không sót**.

> **⚠️ `GET /orders` CHƯA TỒN TẠI. ĐÂY LÀ STORY DỰNG ENDPOINT LIST ĐẦU TIÊN CHO `orders/`.**
> `orders.controller.ts` hiện có 15 route (create · preview-total · cho-duyet-chiet-khau ·
> `:id` · patch · chốt · mở lại · chiết khấu · line-items · xuất báo giá · ảnh/pdf) nhưng
> **KHÔNG có `@Get()` root**. Cả web lẫn mobile **KHÔNG có màn danh sách đơn**; `OrdersPort` /
> `OrdersPort` (Dart) **KHÔNG có `list()`**.
>
> **⚠️ MÓN NỢ STORY NÀY PHẢI TRẢ (đã ghi sẵn trong code):**
> `backend/src/orders/orders.controller.ts` L55-57 (docblock class) viết nguyên văn:
> *"scope xem theo `orders.view_all`/`orders.view_own` là **Story 5.3** — guard hiện
> AND-only, không diễn đạt OR được."* → Story này **phải** mở được OR ở tầng guard.
> Xem Task 2 — đây là phần dễ làm sai nhất của story.
>
> **⚠️ KHÔNG tạo entity/bảng/migration mới cho follow-up.** Follow-up **KHÔNG phải cột
> DB, KHÔNG phải reminder, KHÔNG phải job**. Toàn dự án (`backend/src`, `web/src`,
> `mobile/lib`) hiện **không có** khái niệm follow-up nào. FR-10 chỉ định nghĩa nó là
> **đơn ở trạng thái `baogia` (chưa chốt)** — một **bộ lọc dẫn xuất**, hết. Thêm cột
> `followUpAt`/`reminderAt`/`nextContactAt` = story THẤT BẠI (vi phạm YAGNI + "mỗi story
> tạo/sửa CHỈ entity/file nó cần" — `project-context.md` L84).
>
> **⚠️ KHÔNG đụng `applyTransition()` / `allowed-transition.ts` / `auto-transition-map.ts`.**
> Story này **chỉ ĐỌC**. Không có transition nào ở đây. Source-guard 5.1
> (`test/no-order-status-write-outside-transition.spec.ts`) phải vẫn xanh **không cần sửa**.
>
> **⚠️ "Xem tất cả đơn" vs "đơn của mình" KHÔNG PHẢI FILTER TRÊN UI.** Đây là **QUYỀN**.
> `EXPERIENCE.md` L82: *"'Xem tất cả đơn' vs 'chỉ đơn của mình' phụ thuộc Quyền, **không
> phải filter** (FR-18)"* và L146 nhắc lại. **CẤM** dựng toggle/segment "Tất cả / Của tôi"
> trên web hay mobile. Phạm vi do backend quyết theo bộ quyền, client không gửi tham số nào
> về phạm vi.

## Acceptance Criteria

1. **Given** quyền "xem tất cả đơn" vs "đơn của mình", **When** mở danh sách, **Then** phạm
   vi lọc theo `ownerAccountId`/`assigneeAccountId` đúng quyền (AD-15, UX-DR-22).
2. **Given** đơn ở trạng thái "Báo giá" chưa chốt, **When** lọc follow-up, **Then** hiển thị
   trong danh sách theo dõi, không tự xoá/ẩn (FR-10).
3. **Given** các trạng thái list, **When** render, **Then** Loading = skeleton; Empty = "Chưa
   có đơn nào. Bấm ➕Tạo để bắt đầu."; Error = thông báo cụ thể + "Thử lại" (UX-DR-19).

[Source: `_bmad-output/planning-artifacts/epics.md#Story 5.3` L497-502 — nguyên văn]

### AC bổ sung (dẫn xuất — bắt buộc để đóng story)

4. **Given** `PermissionsGuard` hiện chỉ diễn đạt AND (`permissions.guard.ts:59`
   `required.every(...)`), **When** khai quyền cho `GET /orders`, **Then** tồn tại cách khai
   **OR** tường minh; account chỉ có `orders.view_all` **HOẶC** chỉ có `orders.view_own` đều
   qua cửa; account **không có key nào** trong hai key ⇒ **403**. Ngữ nghĩa AND của
   `@RequirePermissions` hiện hữu **KHÔNG đổi** — 14 route cũ giữ nguyên hành vi.
   [Lý do bắt buộc: `role-presets.ts` cấp `ordersViewAll` **KHÔNG kèm** `ordersViewOwn`
   (L42, L72, L86), nên khai `@RequirePermissions(PERM.ordersViewOwn)` làm "sàn" sẽ **khoá
   admin ra ngoài**. Xem Task 2.]
5. **Given** account có `orders.view_own` (không có `view_all`), **When** gọi `GET /orders`,
   **Then** chỉ trả đơn mà `ownerAccountId = me` **HOẶC** `assigneeAccountId = me`; đơn của
   người khác **KHÔNG** xuất hiện — kể cả khi khớp mọi filter khác. Account có `view_all`
   (dù có hay không `view_own`) thấy **toàn bộ** đơn.
6. **Given** `total` trong response, **When** phân trang, **Then** `total` đếm **toàn bộ tập
   đã lọc + đã scope theo quyền**, không phải `items.length`; `items` và `total` đọc trên
   **một snapshot** (`$transaction`) để không lệch nhau.
7. **Given** tham số query, **When** ValidationPipe chạy, **Then** `status` ngoài 10 khoá hợp
   lệ ⇒ 400 `VALIDATION_ERROR`; `page < 1` ⇒ 400; `pageSize` ngoài `1..100` ⇒ 400;
   `page`/`pageSize` là chuỗi số ⇒ ép sang `number` trước khi chạm Prisma `skip`/`take`.
8. **Given** cả `followUp=true` và `status` cùng được gửi, **When** validate, **Then** 400
   `VALIDATION_ERROR` (hai bộ lọc trạng thái mâu thuẫn nhau — **KHÔNG** AND thầm lặng thành
   tập rỗng, vì tập rỗng câm khiến người dùng tưởng "không có đơn").
9. **Given** cùng một màn trên hai nền tảng, **When** so nhãn tiếng Việt, **Then** **byte-for-byte
   giống nhau** giữa `web/src/screens/orders/OrdersListScreen.tsx` và
   `mobile/lib/screens/orders/order_list_screen.dart` (UX-DR-27, khuôn `customers.test.mjs`).
10. **Given** account không có **cả hai** quyền xem đơn, **When** dựng nav **WEB**, **Then** mục
    "Đơn hàng" **không xuất hiện** trong `Sidebar` (UX-DR-22 — ẩn hẳn, KHÔNG disable xám).
    Hiện `Sidebar.tsx:55` khai mục `orders` **không gate**.
    ⚠️ **AC này CHỈ áp cho web.** Bottom nav mobile là **hợp đồng KHOÁ 5 tab (UX-DR-15)**:
    `mobile/lib/design_system/shell/app_bottom_nav.dart:6-10` ghi rõ danh sách tab là
    *"INTERNAL constant, never a prop"* — không caller nào thêm/bớt/đổi thứ tự được, và
    `app_permissions.dart:30-32` xác nhận bottom nav **không filter được**. **CẤM** sửa
    `_tabs` để lách. Trên mobile, account thiếu cả hai quyền vẫn thấy tab "Đơn hàng" nhưng
    `GET /orders` trả **403** ⇒ màn render **error state** — đúng AD-4 (backend enforce, UI
    gating chỉ là tiện nghi). Xem Task 6.

[Source: `ARCHITECTURE-SPINE.md#AD-15` (owner/assignee là ĐÚNG HAI trường phân giải phạm vi) ·
`#AD-17` (registry là nơi duy nhất chứa literal quyền) · `#AD-4` (UI gating là UX, backend
enforce mọi request) · `prd.md#FR-10` L179-182 · `epics.md#UX-DR-19` L116 · `#UX-DR-22` L119 ·
`EXPERIENCE.md` L32, L82, L146]

## Tasks / Subtasks

### Task 1 — Bộ khoá trạng thái dạng mảng để validate được (AC: 7)

`order-status.ts` hiện **chỉ có** `type OrderStatusKey` (union type, xoá sạch lúc runtime) và
10 hằng lẻ. **Không có mảng** ⇒ `@IsIn(...)` không có gì để so.

- [x] Thêm vào `backend/src/orders/domain/order-status.ts`:
  ```ts
  /** 10 khoá trạng thái dạng MẢNG runtime — `@IsIn` cần giá trị, union type xoá sạch lúc compile. */
  export const ORDER_STATUS_KEYS = [
    TRANG_THAI_BAO_GIA, TRANG_THAI_CHO_DUYET, TRANG_THAI_DA_CHOT, TRANG_THAI_DA_COC,
    TRANG_THAI_THI_CONG, TRANG_THAI_NGHIEM_THU, TRANG_THAI_DANG_GIAO, TRANG_THAI_DA_GIAO,
    TRANG_THAI_HOAN_THANH, TRANG_THAI_HUY,
  ] as const satisfies readonly OrderStatusKey[];
  ```
  Dựng từ **chính 10 hằng** (không gõ lại literal) ⇒ đổi tên hằng là compile error, không
  trôi âm thầm.
- [x] Test `test/order-status.spec.ts` (mới): `ORDER_STATUS_KEYS` có **đúng 10** phần tử,
      không trùng, và `thicong` có mặt còn `dangthicong` **không** (bẫy đã ghi ở docblock L4,
      và là ngõ cụt đã dính ở 5.1).
- [x] **Kiểm tra đầy đủ (exhaustiveness) — đọc kỹ, đừng tự chế "mẹo typecheck":**
      ⚠️ **KHÔNG có cách rẻ nào bắt lỗi này lúc compile ở file hiện tại.** Lý do: 10 hằng
      đều **được annotate** (`export const TRANG_THAI_BAO_GIA: OrderStatusKey = 'baogia';`,
      L28-55) ⇒ kiểu của chúng **đã nới rộng thành cả union**, nên `as const satisfies
      readonly OrderStatusKey[]` cho ra phần tử kiểu `OrderStatusKey`, **không** phải literal.
      Mọi mẹo kiểu `Record<OrderStatusKey, true>` dựng từ mảng này đều **xanh giả** — nó luôn
      thấy đủ union bất kể mảng thiếu phần tử nào. (Thêm `as Record<...>` càng tệ: `as` dập
      tắt đúng cái lỗi nó định gây ra.) **Bỏ annotation của 10 hằng để lấy literal type là
      ngoài scope story này** (bảng "Phải giữ nguyên" cấm đổi hằng).
      ⇒ Chốt: dùng **test runtime** làm chốt chặn. Trong `test/order-status.spec.ts`,
      `import * as OrderStatus from '../src/orders/domain/order-status'`, lọc mọi export tên
      `TRANG_THAI_*`, và assert **từng hằng đều ∈ `ORDER_STATUS_KEYS`** và ngược lại (hai
      chiều, cùng số lượng). Thêm hằng mới mà quên mảng ⇒ **ĐỎ**.
      ⚠️ **Mutation bắt buộc:** xoá một phần tử khỏi `ORDER_STATUS_KEYS` → test phải **ĐỎ**.

### Task 2 — Guard OR: `@RequireAnyPermissions` (AC: 4) ⚠️ PHẦN DỄ SAI NHẤT

**Bài toán:** `GET /orders` phải cho qua khi account có `orders.view_all` **HOẶC**
`orders.view_own`. Ba đường đều SAI, đừng đi:

| Đường | Vì sao SAI |
|---|---|
| `@RequirePermissions(PERM.ordersViewOwn)` làm sàn | AND ⇒ đòi `view_own`. `role-presets.ts:42,72,86` cấp `ordersViewAll` **không kèm** `view_own` ⇒ **khoá admin ra ngoài**. |
| `@AuthenticatedOnly()` rồi lọc trong service | Mọi phiên đăng nhập đọc được danh sách đơn. `authenticated-only.decorator.ts` L15-16 nói thẳng: **"KHÔNG dùng cho route nghiệp vụ chạm dữ liệu người khác"**. |
| Thêm `view_own` vào preset đang có `view_all` | Sửa **quyết định phân quyền của người dùng** (Story 2.4/2.9) để lách hạn chế kỹ thuật. Ngoài scope, cần user duyệt. |

**Đường đúng — decorator OR mới, song song, không đổi AND cũ:**

- [x] Tạo `backend/src/auth/require-any-permission.decorator.ts` theo **đúng khuôn**
      `require-permissions.decorator.ts` (đọc nó trước):
  ```ts
  export const REQUIRE_ANY_PERMISSION_KEY = 'requireAnyPermission';
  /** `@RequireAnyPermissions(PERM.x, PERM.y)` — đủ **ÍT NHẤT MỘT** key (OR). */
  export const RequireAnyPermissions = (...keys: PermissionKey[]) =>
    SetMetadata(REQUIRE_ANY_PERMISSION_KEY, keys);
  ```
  Tham số kiểu `PermissionKey` (AD-17) ⇒ gọi bằng `PERM.xxx`, **cấm** literal.
- [x] `backend/src/auth/permissions.guard.ts`: đọc **thêm** metadata OR, giữ nguyên khối AND.
      Thứ tự đánh giá: `@Public` → resolve `effective` **một lần** → AND (nếu khai) → OR (nếu
      khai) → pass.
      - Khai **cả hai** ⇒ phải thoả **cả hai** (AND-set đủ **và** OR-set có ≥1). Không khai
        cái nào ⇒ giữ nguyên hành vi cũ (chỉ cần đăng nhập).
      - **CHỈ gọi `listForAccount` một lần** cho cả hai phép — thêm round-trip DB thứ hai mỗi
        request là hồi quy hiệu năng câm.
      - Từ chối ⇒ **cùng** `AppException(ErrorCode.FORBIDDEN, 403, 'Không đủ quyền thực hiện')`
        như nhánh AND. Không thêm mã lỗi mới (AD-5: envelope do filter dựng, controller/guard
        không tự chế).
      - Cập nhật docblock class (L15-25) mô tả cả hai ngữ nghĩa.
- [x] `backend/test/no-handler-without-require-permissions.spec.ts`: thêm
      `'@RequireAnyPermissions('` vào mảng `DECLARATIONS` (L39-43).
      ⚠️ **Đây là nới lỏng một source-guard — phải chứng minh nó không chết:**
      - [x] Thêm case dương: handler khai `@RequireAnyPermissions(...)` ⇒ **không** offender.
      - [x] Giữ nguyên **mọi** case âm hiện có; đặc biệt case "chỉ nằm trong comment vẫn là
            offender" phải có **bản sao cho decorator mới** (chứng minh `stripComments` vẫn
            che được đường mới).
      - [x] **Mutation bắt buộc:** tạm bỏ `@RequireAnyPermissions` khỏi `GET /orders` → suite
            phải **ĐỎ**. Xanh = guard đã chết, sửa guard chứ đừng sửa test.
      - [x] ⚠️ `'@RequirePermissions('` là **tiền tố** của `'@RequireAnyPermissions('`? **Không**
            (`Any` chèn vào giữa) — nhưng `declared()` dùng `includes`, nên kiểm lại: chuỗi
            `@RequireAnyPermissions(` **không** chứa `@RequirePermissions(`. An toàn. Đừng đảo
            thứ tự thành `@RequirePermissionsAny` — cái đó **sẽ** false-PASS qua guard cũ.
- [x] Test `backend/test/permissions-guard.spec.ts` (**file MỚI** — chưa tồn tại): ma trận
      OR — có key A / có key B / có cả hai / **không key nào ⇒ 403** / khai cả AND lẫn OR /
      không khai gì (giữ hành vi cũ: chỉ cần đăng nhập).

### Task 3 — Endpoint `GET /orders` (AC: 1, 2, 5, 6, 7, 8)

**Khuôn để copy nguyên xi:** `GET /customers` (Story 3.4) — controller
`backend/src/customers/customers.controller.ts:83-99`, DTO
`backend/src/customers/dto/list-customers-query.dto.ts:24-65`, response
`backend/src/customers/dto/customer-list-response.dto.ts:11-27`, service
`backend/src/customers/customers.service.ts:298-334`. **Đọc cả bốn file trước khi gõ dòng nào.**

- [x] **DTO query** `backend/src/orders/dto/list-orders-query.dto.ts`:
  ```ts
  @IsOptional() @IsIn(ORDER_STATUS_KEYS) status?: string;
  @IsOptional() @Transform(...) @IsBoolean() followUp?: boolean;   // 'true'/'false' từ query string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  ```
  - `@Type(() => Number)` trên `page`/`pageSize` là **BẮT BUỘC** — query string tới dạng
    chuỗi; thiếu nó thì hoặc `@IsInt()` từ chối giá trị hợp lệ, hoặc **một chuỗi lọt vào
    Prisma `skip`/`take`** (docblock `list-customers-query.dto.ts` nói rõ).
  - `@Max(100)` trên `pageSize` là **BẮT BUỘC** — không trần = một request kéo cả bảng.
  - `followUp` là **boolean từ query string**: `?followUp=true` tới dạng chuỗi `'true'`.
    Dùng `@Transform` ép `'true'→true`, `'false'→false`, **giá trị khác ⇒ để nguyên** cho
    `@IsBoolean()` từ chối (đừng `Boolean(value)` — `'false'` sẽ thành `true`).
  - **KHÔNG** có tham số `q`/search (epic không yêu cầu — YAGNI).
  - **KHÔNG** có tham số phạm vi (`scope`/`mine`/`ownerId`) — phạm vi là QUYỀN, không phải
    input của client. Nhận tham số đó = lỗ hổng IDOR.
- [x] **DTO response** `backend/src/orders/dto/order-list-item.dto.ts` +
      `order-list-response.dto.ts` (`{ items, total, page, pageSize }` — khuôn
      `CustomerListResponseDto`). Trường của item, **đủ để render list, không hơn**:
      `id`, `status`, `customerSdt`, `customerName`, `ownerAccountId`, `assigneeAccountId`,
      `createdAt`, `updatedAt`.
      - **KHÔNG** trả tổng tiền: cần join `OrderVersion` + tính pricing (AD-10/AD-16) cho
        từng dòng — epic không yêu cầu, và một con số tiền tính sai ở list là hồi quy tiền bạc.
      - **KHÔNG** trả `costPrice` hay bất cứ dữ liệu giá vốn nào (`costs.view`, AD-4).
      - `customerName` lấy qua relation `customer` (`Order.customerSdt` → `Customer.sdt`).
        ⚠️ **`Order` KHÔNG có `customerId`** — PK khách là **SĐT E.164** (AD-9).
- [x] **Service** `OrdersService.list(callerAccountId, quyen, query)`:
  ```ts
  const where: Prisma.OrderWhereInput = {};
  const dieuKien: Prisma.OrderWhereInput[] = [];

  // Phạm vi theo QUYỀN (AC-1, AC-5, AD-15) — view_all thắng view_own.
  if (!quyen.has(PERM.ordersViewAll)) {
    dieuKien.push({
      OR: [
        { ownerAccountId: callerAccountId },
        { assigneeAccountId: callerAccountId },
      ],
    });
  }
  if (query.followUp === true) dieuKien.push({ status: TRANG_THAI_BAO_GIA });
  else if (query.status !== undefined) dieuKien.push({ status: query.status });
  if (dieuKien.length > 0) where.AND = dieuKien;
  ```
  ⚠️ **Gom vào `where.AND`, KHÔNG gán thẳng `where.OR`.** `where.OR` chỉ có **một** chỗ:
  bộ lọc thứ hai nào cũng dùng `OR` sẽ **ghi đè** phạm vi quyền và **rò đơn của người khác**.
  (Chính cái bẫy này đang chờ ở `customers.service.ts:315` — `where.OR` đã bị search chiếm.)
- [x] `orderBy: { createdAt: 'desc' }` (mới nhất trước — khuôn `customers.service.ts:326`).
- [x] `items` + `total` trong **một** `this.prisma.$transaction([findMany, count])` (AC-6) —
      hai query rời dưới READ COMMITTED làm `total` lệch khỏi trang.
- [x] **Controller** `orders.controller.ts`:
  - Khai `@Get()` **NGAY TRƯỚC** `@Get(':id')` (L179) và **SAU** `@Get('cho-duyet-chiet-khau')`
    — kỷ luật route tĩnh trước route `:id` (comment L119 của chính file này).
  - `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`.
  - Resolve bộ quyền tươi qua **`this.quyenCuaNguoiGoi(account.id)` đã có sẵn** (L84-92) —
    **đừng viết helper thứ hai**. Truyền `ReadonlySet` xuống service.
  - `@ApiOkResponse` + `@ApiBadRequestResponse` + `@ApiForbiddenResponse` với
    `ErrorEnvelopeDto` (khuôn `customers.controller.ts:85-95`).
  - Controller **KHÔNG** dựng envelope lỗi — service ném `AppException`,
    `AllExceptionsFilter` dựng (AD-5, source-guard `no-controller-error-envelope`).
- [x] AC-8 (`followUp` + `status` cùng gửi ⇒ 400): validate ở DTO bằng custom validator, hoặc
      ném `AppException(ErrorCode.VALIDATION_ERROR, 400, ...)` **trong service** trước khi
      dựng `where`. Chọn một, đừng làm cả hai. Thông điệp tiếng Việt cụ thể.
- [x] **Regen artifact:** `openapi.json` **và** `permissions.json` — drift-guard byte-for-byte
      (`test/openapi-drift.spec.ts`, `test/permissions-drift.spec.ts`) sẽ đỏ nếu quên.
      ⚠️ Registry **không có key mới** ở story này, nhưng vẫn chạy cả hai lệnh regen.

### Task 4 — Index DB cho cột thực sự được lọc (AC: 5)

`schema.prisma` L330-360: `Order` có `@@index([customerSdt])`, `@@index([ownerAccountId])`,
`@@index([sourceId])` — **thiếu `status` và `assigneeAccountId`**, đúng hai cột story này lọc.

- [x] Thêm `@@index([status])` và `@@index([assigneeAccountId])` vào model `Order`.
- [x] Sinh migration **offline**:
      ```
      npx prisma migrate diff --from-schema <schema-cũ> --to-schema prisma/schema.prisma --script
      ```
      ⚠️ **Prisma 7 đã đổi cờ.** Nhiều tài liệu story cũ ghi `--from-schema-datamodel` —
      cờ đó **không còn**; Prisma 7 chỉ nhận `--from-schema` / `--to-schema`. Dùng sai cờ =
      lệnh chết, đừng đoán tiếp, đọc `npx prisma migrate diff --help`.
- [x] Migration **chỉ có `CREATE INDEX`** — không `ALTER COLUMN`, không đổi kiểu. Đọc file SQL
      sinh ra và xác nhận bằng mắt trước khi commit.

### Task 5 — Web: `OrdersListScreen` (AC: 1, 2, 3, 9, 10)

**Khuôn để copy nguyên xi:** `web/src/screens/customers/CustomerListScreen.tsx` — cùng
`LoadState`, cùng ticket chống race, cùng bộ trạng thái. **Đọc trước khi gõ.**

- [x] `web/src/design-system/session/orders-port.ts`: thêm `OrderListItem`, `OrderPage`
      (`{items,total,page,pageSize}`), `OrderListQuery` (`{status?, followUp?, page?, pageSize?}`)
      và method `list(query: OrderListQuery): Promise<OrderPage>` vào interface `OrdersPort`.
      **Mirror đúng DTO backend Task 3** — không bịa thêm field (AD-12: contract từ BE).
      `OrderListQuery` **không có** trường phạm vi.
- [x] `web/src/design-system/session/fake-orders-port.ts`: cài `list()` — có đủ dữ liệu để
      demo cả bốn trạng thái (nhiều đơn / rỗng / lọc rỗng / lỗi).
- [x] `web/src/screens/orders/OrdersListScreen.tsx` (mới) + `orders-list.css` (mới):
  - Ticket chống race **y hệt** `CustomerListScreen.tsx:75-99` (`const ticket = ++latest.current`
    … `if (ticket !== latest.current) return;`) — thiếu nó thì response cũ đè response mới khi
    người dùng bấm filter nhanh.
  - Filter trạng thái: `<Seg>` (khuôn `CustomerListScreen.tsx:123-133`) — option "Tất cả" +
    các trạng thái + "Follow-up". Đổi filter ⇒ **reset `page` về 1** (`:104-111`).
  - Trạng thái đơn render bằng **`StatusChip` đã có** (`design-system/components/StatusChip.tsx`)
    — **KHÔNG** tự viết badge. Chip **read-only**, không onClick (UX-DR-23, source-guard đã có).
    ⚠️ **Lệch kiểu phải xử lý tường minh:** `StatusChip.tsx:33-38` khai `status: StatusKey`
    (union 10 thành viên **chặt**), nhưng `OrderListItem.status` mirror DTO backend nên là
    `string`. Cần **thu hẹp** trước khi truyền — dùng một type-guard nhỏ trong screen
    (`(s): s is StatusKey => ...`) hoặc cast có kiểm tra. **Đừng** nới `StatusChip` thành
    `string` (phá hợp đồng chip cho mọi màn khác), và đừng cast mù — web **không có tsc**
    nên sai ở đây **im lặng**, đúng lớp lỗi như `<Skeleton lines>` ngay dưới.
  - Bốn trạng thái màn, nhãn **chốt cứng, byte-for-byte với mobile** (AC-9):
    | Trạng thái | Nội dung |
    |---|---|
    | Loading | `<Skeleton>` xếp chồng + `Đang tải danh sách đơn…` |
    | Error | `<ErrorState message="Không tải được danh sách đơn." retryLabel="Thử lại" onRetry={load} />` |
    | Empty (chưa lọc) | `<EmptyState title="Chưa có đơn nào" message="Bấm ➕Tạo để bắt đầu." action={<Button variant="primary">+ Tạo đơn</Button>} />` |
    | Empty (đang lọc) | `<EmptyState title="Không có đơn phù hợp" message="Thử đổi bộ lọc." />` |
    ⚠️ **Hai empty là HAI cái khác nhau** — "lọc ra rỗng" ≠ "sổ trống" (comment
    `CustomerListScreen.tsx:150`). Gộp một = mất tín hiệu cho người dùng.
  - ⚠️ **`<Skeleton>` KHÔNG có prop `lines`.** `Skeleton.tsx:3-8` chỉ nhận
    `{width, height, radius, className}`. `DiscountApprovalScreen.tsx:123` gọi
    `<Skeleton lines={5} />` — **sai, và im lặng vì web chưa có tsc**. Xếp chồng nhiều
    `<Skeleton>` như `CustomerListScreen.tsx:135-140`.
  - Pager chỉ render khi `totalPages > 1` (`:200-224`).
  - **Transport CHỈ qua port** — không `fetch`/`axios` trong screen (AD-1/AD-2).
  - **Không số học tiền** trong screen (AD-10, source-guard quét text).
- [x] `web/src/design-system/gating/permissions.ts`: `orderScope` hiện trả
      `'all' | 'mine'` (L32-34) — trả `'mine'` **kể cả khi account không có quyền nào**, nên
      không dùng để ẩn nav được. Đổi thành `'all' | 'mine' | 'none'`:
      ```ts
      export function orderScope(perms: PermissionSet): 'all' | 'mine' | 'none' {
        if (can(perms, PERM.ordersViewAll)) return 'all';
        if (can(perms, PERM.ordersViewOwn)) return 'mine';
        return 'none';
      }
      ```
      ⚠️ **Caller — đã rà sẵn, đây là danh sách đầy đủ, ĐỔI CÁI (a) hoặc kiểu sẽ nói dối:**
      | Caller | Phải làm gì |
      |---|---|
      | (a) `web/.../session/use-permissions.ts:18` — `orderScope: 'all' \| 'mine';` trong interface `UsePermissions` | **PHẢI đổi** thành `'all' \| 'mine' \| 'none'`. Quên = kiểu sai **im lặng** (web không có tsc — đúng lớp lỗi như `<Skeleton lines>`) |
      | (b) `web/.../session/use-permissions.ts:30-33` — thân hàm re-export | Không đổi |
      | (c) `web/.../gating/index.ts:16` — re-export | Không đổi |
      | (d) `mobile/.../session/app_session.dart:55` — `String get orderScope` | Không đổi (đã là `String`) |
      | (e) `mobile/test/design_system/session_test.dart:53-83` — 2 case `flutter test` assert `'all'`/`'mine'` | Không đổi (truyền perm-set khác rỗng ⇒ vẫn qua). **Chạy lại để xác nhận**, đừng suy đoán |
      | (f) `design-system/{components/gating.test.mjs:48-53, session/session.test.mjs:46-52, components/parity.test.mjs:261}` | Không đổi (chỉ assert `'all'`/`'mine'` **có mặt** trong source) |
      **Chưa màn nào** tiêu thụ giá trị này (được chừa sẵn cho Epic 5) — nên việc mở rộng an
      toàn, nhưng (a) là edit **bắt buộc**, không phải tuỳ chọn.
- [x] `web/src/design-system/shell/Sidebar.tsx:55`: mục `orders` hiện **không gate** (AC-10).
      Gate nó theo `orderScope(perms) !== 'none'`. Nếu `filterNav` chỉ nhận **một** `requires`
      key, **đừng** nhét đại `ordersViewAll` (admin-only ⇒ ẩn nhầm với người có `view_own`) —
      lọc mục `orders` bằng `orderScope` trước khi truyền vào `filterNav`.

### Task 6 — Mobile: `order_list_screen.dart` (AC: 1, 2, 3, 9, 10)

**Khuôn để copy nguyên xi:** `mobile/lib/screens/customers/customer_list_screen.dart` —
`enum _LoadState { loading, ready, error }`, ticket `_latest`, `_body()` switch. **Đọc trước.**

- [x] `mobile/lib/design_system/session/orders_port.dart`: thêm `OrderListItem`, `OrderPage`,
      `list({status, followUp, page, pageSize})` — **mirror đúng** port web (parity) và DTO
      backend. Cập nhật fake port tương ứng.
- [x] `mobile/lib/screens/orders/order_list_screen.dart` (mới):
  - `StatefulWidget` + `setState`. **KHÔNG thêm dependency** — `pubspec.yaml` chỉ có
    `flutter_svg`, `image_picker`, `share_plus`; **không Riverpod, không Bloc**
    (`app_session.dart:6-9` nói rõ đây là lựa chọn YAGNI có chủ đích).
  - Ticket chống race + `if (!mounted || ticket != _latest) return;` (khuôn `:80-102`) —
    thiếu `mounted` ⇒ `setState` sau dispose.
  - ⚠️ **KHÔNG dùng `Expanded`** cho body — `AppMobileShell` đã bọc trong
    `SingleChildScrollView` (`customer_list_screen.dart:142-144`). Dùng
    `ListView.separated(shrinkWrap: true, physics: NeverScrollableScrollPhysics())`.
  - Filter trạng thái: hàng `AppButton` primary/outline (mobile **không có** widget segmented
    — `:193-219`).
  - Bốn trạng thái + nhãn **giống byte-for-byte web** (bảng ở Task 5). `AppSkeleton`,
    `AppErrorState`, `AppEmptyState`.
  - `perms`: nhận qua **constructor prop** (khuôn `create_quote_screen.dart:1178`) — chọn một
    kiểu, đừng trộn với `PermissionsScope.of(context)`.
- [x] `mobile/lib/design_system/gating/app_permissions.dart`: `orderScope` đổi **song song với
      web** (thêm `'none'`). **Parity của helper là bắt buộc** — `design-system/components/parity.test.mjs:261`
      so hai bên; lệch là đúng thứ drift-guard tồn tại để bắt.
- [x] ⚠️ **KHÔNG ẩn tab "Đơn hàng" trên mobile — và KHÔNG sửa `app_bottom_nav.dart`.**
      `mobile/lib/design_system/shell/app_bottom_nav.dart:6-10` khai danh sách tab là hợp đồng
      **KHOÁ** (UX-DR-15): *"an INTERNAL constant, never a prop, so no caller can add/remove/
      reorder tabs"*; `app_permissions.dart:30-32` xác nhận bottom nav **không filter được**;
      `filterNav`/`kMenuSections` chỉ phục vụ menu (`permissions`/`audit`/`profile`), **không
      có** mục `orders`. AC-10 vì vậy **chỉ áp cho web** (xem ghi chú ở AC-10).
      Trên mobile, account thiếu cả hai quyền mở tab ⇒ `GET /orders` trả **403** ⇒ màn hiển
      thị **error state** bình thường. Đó là hành vi ĐÚNG theo AD-4 (backend enforce mọi
      request; ẩn UI chỉ là tiện nghi), **không phải** lỗi cần vá bằng cách phá hợp đồng tab.

### Task 7 — Test (AC: tất cả)

**Backend** (`backend/test/`, phẳng, `*.spec.ts`):

- [x] `orders.e2e.spec.ts` (mở rộng) — `describe('GET /orders …')`:
  - [x] Ma trận phạm vi (AC-1, AC-5): actor chỉ `view_own` **không** thấy đơn người khác;
        thấy đơn mình `owner`; thấy đơn mình `assignee`; actor `view_all` thấy tất cả; actor
        **không key nào** ⇒ **403**.
  - [x] `followUp=true` chỉ trả `status='baogia'` (AC-2); đơn đã chốt **không** lọt.
  - [x] `followUp=true` + `status=dachot` ⇒ **400** (AC-8).
  - [x] Trần & KIỂU query (AC-7) — mirror `customers.e2e.spec.ts:498`
        (`'Trần + KIỂU của query — ValidationPipe là thứ DUY NHẤT đứng giữa query string và Prisma'`):
        `status` rác ⇒ 400 · `page=0` ⇒ 400 · `pageSize=101` ⇒ 400 · `pageSize=abc` ⇒ 400 ·
        `page='2'` (chuỗi) ⇒ 200 và **`skip` nhận `number`**.
  - [x] `total` = tổng tập đã lọc **và đã scope**, ≠ `items.length` khi có >1 trang (AC-6).
  - ⚠️ **Bootstrap e2e:** `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc import module ⇒
        `AppModule` phải **import động trong `beforeAll`** sau khi set env ở top-level
        (`customers.e2e.spec.ts:14-16, 128`). **Static import = suite chết.**
- [x] `test/orders-list-scope.spec.ts` (mới, hermetic, mock Prisma): khẳng định **hình dạng
      `where`** service dựng ra:
  - [x] `view_own` ⇒ `where.AND` chứa `{OR:[{ownerAccountId},{assigneeAccountId}]}`.
  - [x] `view_all` ⇒ **không** có mệnh đề phạm vi nào.
  - [x] `view_own` + `status` ⇒ **cả hai** nằm trong `where.AND`, và **`where.OR` là
        `undefined`** — đây là test canh chính cái bẫy ghi đè `OR`.
  - ⚠️ **Mutation bắt buộc:** đổi `where.AND = dieuKien` thành `where.OR = ...` (hoặc bỏ mệnh
    đề phạm vi) → suite phải **ĐỎ**. Xanh = test không tải trọng.
  - ⚠️ Đột biến **phải compile được**, nếu không mọi suite đỏ vì lý do khác và chứng minh
    không gì cả.
- [x] `test/permissions-guard.spec.ts` — ma trận OR (Task 2).
- [x] `test/order-status.spec.ts` — `ORDER_STATUS_KEYS` (Task 1).
- [x] `test/no-handler-without-require-permissions.spec.ts` — case dương + case comment cho
      decorator mới (Task 2).
- [x] `npm test` (hermetic, baseline **62 suite / 1044 test** sau 5.2) phải xanh **toàn bộ**,
      gồm **8** source-guard kiến trúc (`no-manual-prisma-client` · `no-controller-error-envelope` ·
      `no-permission-literal-outside-registry` · `no-direct-side-effect-outside-eventbus` ·
      `no-handler-without-require-permissions` · `no-fabricated-actor-permissions` ·
      `no-hard-delete-customer-source` · `no-order-status-write-outside-transition`) +
      drift-guard `openapi.json`/`permissions.json`.
- [x] `npm run test:db` (lane DB, `*.db.integration.spec.ts`, `--runInBand`): chỉ chạy nếu
      Docker Desktop đang chạy. **Nếu daemon không có: viết test, báo lane CHƯA CHẠY, nhờ
      người dùng bật Docker.** Đừng giả vờ nó xanh, và `open -a Docker` từ shell agent
      **không** tạo được socket.

**Web** (chưa có test runner — text-guard):

- [x] `design-system/screens/orders-list.test.mjs` (mới), khuôn
      `design-system/screens/customers.test.mjs`: đọc **cả hai** file nền tảng, `stripComments`,
      rồi assert:
      cả hai file tồn tại · dựng từ component DS (`Skeleton`/`EmptyState`/`ErrorState`/
      `StatusChip`/`Table`) · transport **chỉ** qua port (không `fetch`/`http`) · nhãn tiếng
      Việt **byte-for-byte** hai bên · không permission literal · không số học tiền · chip
      read-only (không `onClick` trên `StatusChip`) · **không** có toggle phạm vi
      ("Của tôi"/"Tất cả đơn" — cấm theo `EXPERIENCE.md` L82).
  - ⚠️ **Guard quét TOÀN VĂN như text**: đừng viết chuỗi bị cấm (`shadow`, `gradient`,
    `box-shadow:`, `var(--r)`, `.toUpperCase()`) **kể cả trong comment** — false-positive tái
    diễn nhiều lần trong dự án này.
  - ⚠️ Nếu guard cần bắt khối code bằng regex: `\{[^}]*\}` **cắt sớm** ở `}` trong của
    `Array<{...}>`/generic lồng. Dùng `\{[\s\S]*?\n\}` và thao tác **sau** khi đã tính lồng nhau.
  - ⚠️ **Mutation bắt buộc:** đổi một nhãn tiếng Việt trên **một** nền tảng → guard phải **ĐỎ**;
        bỏ `StatusChip` khỏi web → **ĐỎ**. Sanity-test do chính tác giả guard nghĩ ra chỉ bắt
        được cái tác giả tưởng tượng — phải **phá thứ được bảo vệ** và đòi ĐỎ.
- [x] `cd design-system && npm test` xanh.

**Mobile** (có widget test thật — **bắt buộc**, không được viện cớ "web chỉ có text-guard"):

- [x] `mobile/test/screens/orders/order_list_screen_test.dart` (mới), khuôn
      `mobile/test/screens/customers/customer_screens_test.dart`:
      subclass fake port ném lỗi từ `list()` để ép **error state** (`_FailingReadPort` `:41-53`);
      host bằng `MaterialApp(home: Scaffold(body: screen))` (`:53`); tìm nút bằng
      `find.widgetWithText(AppButton, label).first`.
      Ca: loading → ready có đơn · empty chưa lọc · empty đang lọc · error + bấm "Thử lại"
      gọi lại port.
- [x] `cd mobile && flutter test` + `flutter analyze` xanh.
      ⚠️ `dart format --set-exit-if-changed` **vẫn ghi đè file**. Dùng `dart format -o none`
      để kiểm, nếu không nó lan ra ~20 file ngoài scope story.

## Dev Notes

### Hiện trạng file bị SỬA (đọc trước khi đổi)

| File | Hiện làm gì | Story này đổi gì | Phải giữ nguyên |
|---|---|---|---|
| `backend/src/auth/permissions.guard.ts` | Global guard #2. `@Public`→bỏ qua; không metadata→pass; có metadata→AND (`required.every`, L59); thiếu ⇒ 403 | Đọc **thêm** metadata OR | Nhánh AND, fail-closed khi thiếu `request.account` (L53-56), 1 lần `listForAccount` |
| `backend/src/orders/orders.controller.ts` | 15 route, chưa có `@Get()` root. Có sẵn `quyenCuaNguoiGoi()` (L84-92) resolve quyền tươi | Thêm `@Get()` trước `@Get(':id')` (L179) | 15 route cũ + quyền của chúng; không dựng envelope lỗi trong controller |
| `backend/src/orders/domain/order-status.ts` | Union type + 10 hằng | Thêm `ORDER_STATUS_KEYS` | Union, tên hằng, khoá `thicong` (KHÔNG `dangthicong`) |
| `backend/prisma/schema.prisma` (`Order` L330-360) | 3 index: customerSdt, ownerAccountId, sourceId | +2 index: status, assigneeAccountId | Mọi cột/relation/`@map` |
| `backend/test/no-handler-without-require-permissions.spec.ts` | Source-guard AD-4, `DECLARATIONS` L39-43 | +1 mục vào `DECLARATIONS` | **Toàn bộ case âm** — nới lỏng guard thì phải chứng minh nó chưa chết |
| `web/.../gating/permissions.ts` + `mobile/.../gating/app_permissions.dart` | `orderScope` trả `'all'\|'mine'` | +`'none'` | `can`/`filterNav`/`Gate` |
| `web/.../shell/Sidebar.tsx:55` | Mục `orders` **không gate** | Gate theo `orderScope !== 'none'` | Các mục nav khác |

### Bất biến không được vi phạm

- **AD-4:** ẩn UI theo quyền là **UX**, không phải bảo mật. Backend enforce **mọi** request —
  phạm vi list là **server-side**, client không gửi tham số phạm vi.
- **AD-15:** phạm vi "đơn của mình" phân giải off **đúng hai trường** `Order.ownerAccountId` và
  `Order.assigneeAccountId`. Không suy diễn lại, không thêm trường thứ ba.
- **AD-17:** literal quyền **chỉ** ở `permission-registry.ts`. Story này **không thêm key mới** —
  `orders.view_all` (L28) và `orders.view_own` (L30) đã có sẵn, hiện **0 call-site ENFORCE**
  trong `src/` (chỉ xuất hiện ở `role-presets.ts` và một `example` Swagger tại
  `auth/dto/me-response.dto.ts:26`). Story này là nơi đầu tiên chúng thực sự chặn request.
- **AD-11:** story chỉ ĐỌC. Không đổi `Order.status` ở đâu cả.
- **AD-5:** envelope lỗi do `AllExceptionsFilter` dựng, service ném `AppException`.
- **AD-12:** contract từ backend → regen OpenAPI → FE mirror. Không bịa field ở FE.
- **AD-13:** màn mới dựng từ component DS có sẵn; cấm style ad-hoc.

### Học từ story trước (5.1 / 5.2 / 3.4 / 4.x)

- **5.1** dính ngõ cụt vì Dev Notes chép sai khoá trạng thái so với spine gốc (`danggiao`).
  Ở đây: khoá là `thicong`, và `ORDER_STATUS_KEYS` **dựng từ hằng**, không gõ lại literal.
- **5.2** cho thấy source-guard chỉ có giá trị khi bị **đột biến** để đòi ĐỎ. Task 2 và Task 7
  yêu cầu đột biến tường minh cho **cả ba** guard bị chạm/thêm.
- **3.4** đã trả bài học `where.OR` bị một bộ lọc chiếm chỗ. Story này có **hai** nguồn OR
  (phạm vi + tương lai là search) ⇒ gom `where.AND` ngay từ đầu, không chờ va chạm.
- **Đột biến phải compile được** — mutant không compile làm đỏ mọi suite và chứng minh số 0.
- **Đừng `git checkout`** để hoàn tác đột biến: code story chưa commit, checkout xoá sạch.
  Dùng `cp` sao lưu trước, `cp` khôi phục sau.

### Project Structure Notes

- Backend module theo domain: mọi thứ ở `backend/src/orders/` (DTO trong `orders/dto/`, domain
  thuần trong `orders/domain/`). Decorator mới thuộc `backend/src/auth/` (cùng chỗ 2 decorator
  hiện có).
- Test backend **phẳng** trong `backend/test/`, không colocate. Hai lane tách bằng **hậu tố
  tên file**: hermetic `*.spec.ts` (mặc định `npm test`) vs DB `*.db.integration.spec.ts`
  (`npm run test:db`, `--runInBand`). `describe.skip` **không** tách được lane — nếu
  `DATABASE_URL` tồn tại thì file vẫn chạy dưới `npm test`; chỉ `testPathIgnorePatterns` mới tách.
- File/route kebab-case; entity PascalCase; bảng snake_case số nhiều; ngày ISO-8601 UTC.
- ⚠️ `.gitignore` có mục `assets/` từng nuốt file mới trong `backend/assets/`. Nếu story sinh
  file ở thư mục lạ, chạy `git check-ignore -v <file>` trước khi tin là đã commit.
- Web `web/src/` **không có** tsc/bundler/JSDOM (nợ TD-1 chưa trả). **Đừng cố `tsc` web/**.
  `.tsx` chỉ được bảo vệ bằng text-guard `design-system/screens/*.test.mjs` + review.
- Mobile **có** `flutter test` thật ⇒ màn mobile **bắt buộc** widget test. Không mượn cớ TD-1
  của web cho mobile.
- Token/icon design-system là **generated** — sửa SSOT `design-system/tokens|icons` rồi
  `cd design-system && npm run build`. **Cấm sửa tay** `tokens.ts/css`, `app_tokens.dart`,
  `sprite.ts`.

### Câu hỏi đã tự quyết (nêu để người dùng phủ quyết nếu muốn)

1. **Guard OR** → thêm `@RequireAnyPermissions` thay vì (a) đặt `view_own` làm sàn AND —
   sẽ khoá admin ra ngoài vì preset cấp `view_all` không kèm `view_own`, hoặc (b) sửa
   `role-presets.ts` — đó là quyết định phân quyền của người dùng, không phải chỗ để lách
   hạn chế kỹ thuật.
2. **Follow-up** = `status = 'baogia'`, thuần dẫn xuất, **không** ngưỡng "quá N ngày".
   PRD FR-10 không nói tới tuổi đơn; thêm ngưỡng là bịa yêu cầu + đẻ ra một setting phải nuôi.
3. **Không có search `q`** ở list đơn — epic không yêu cầu (YAGNI). Nếu sau này thêm, mệnh đề
   `OR` của search **phải** vào `where.AND`, không gán `where.OR`.
4. **List không trả tổng tiền** — cần join version + pricing (AD-10/16), epic không yêu cầu, và
   số tiền sai ở màn list là hồi quy tiền bạc.
5. **`orderScope` thêm `'none'`** — dạng hiện tại trả `'mine'` cho cả account **không có quyền
   nào**, nên không dùng để ẩn nav được (AC-10 sẽ không đóng được nếu giữ nguyên).
6. **AC-10 (ẩn nav) chỉ áp cho web** — bottom nav mobile là hợp đồng KHOÁ 5 tab (UX-DR-15,
   `app_bottom_nav.dart:6-10`). Hai lựa chọn khác đều tệ hơn: phá hợp đồng tab (đổi UX đã
   chốt, cần người dùng duyệt), hoặc bỏ luôn AC-10 cả hai bên (mất gating web vốn làm được).
   Mobile dựa vào 403 + error state — đúng AD-4. **Nếu Đại Ca muốn tab "Đơn hàng" ẩn theo
   quyền trên mobile, đó là thay đổi UX-DR-15 và nên tách story riêng.**

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.3` L497-502 — AC 1-3 nguyên văn]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-19` L116 — Loading/Empty/Error, microcopy]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-22` L119 — gating theo quyền, phạm vi list đơn]
- [Source: `_bmad-output/planning-artifacts/prds/.../prd.md#FR-10` L179-182 — follow-up = đơn chưa chốt]
- [Source: `_bmad-output/planning-artifacts/prds/.../prd.md#FR-18` L250-252 — quyền config được]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-15` L132-136 — owner/assignee là ĐÚNG HAI trường]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-17` L146-148 — registry duy nhất, view_all/view_own là hai entry]
- [Source: `.../ux-designs/.../EXPERIENCE.md` L32, L82, L146 — phạm vi là QUYỀN, KHÔNG phải filter]
- [Source: `_bmad-output/project-context.md` L38-94 — bất biến AD, testing, gotchas]
- [Source: `backend/src/orders/orders.controller.ts` L55-57 — món nợ "Story 5.3" ghi trong code]
- [Source: `backend/src/auth/permissions.guard.ts` L42-67 — AND-only hiện tại]
- [Source: `backend/src/auth/require-permissions.decorator.ts` — khuôn decorator]
- [Source: `backend/src/auth/authenticated-only.decorator.ts` L15-16 — cấm dùng cho route chạm dữ liệu người khác]
- [Source: `mobile/lib/design_system/shell/app_bottom_nav.dart` L6-10, L27-33 — 5 tab là hợp đồng KHOÁ (UX-DR-15)]
- [Source: `mobile/lib/design_system/gating/app_permissions.dart` L30-32 — bottom nav không filter được]
- [Source: `web/src/design-system/session/use-permissions.ts` L18 — union `'all' | 'mine'` phải mở rộng]
- [Source: `web/src/design-system/components/StatusChip.tsx` L33-38 — `status: StatusKey` union chặt]
- [Source: `backend/src/accounts/domain/permission-registry.ts` L28, L30 — ordersViewAll/ordersViewOwn]
- [Source: `backend/src/accounts/domain/role-presets.ts` L42, L72, L86 — view_all KHÔNG kèm view_own]
- [Source: `backend/src/customers/{customers.controller.ts:83-99, customers.service.ts:298-334, dto/list-customers-query.dto.ts:24-65, dto/customer-list-response.dto.ts:11-27}` — khuôn list endpoint]
- [Source: `backend/prisma/schema.prisma` L330-360 — model Order]
- [Source: `backend/src/orders/domain/order-status.ts` L14-55 — bộ khoá trạng thái]
- [Source: `backend/test/no-handler-without-require-permissions.spec.ts` L39-43 — DECLARATIONS]
- [Source: `backend/test/customers.e2e.spec.ts` L14-16, L128, L310, L498 — khuôn e2e list + bootstrap động]
- [Source: `web/src/screens/customers/CustomerListScreen.tsx` L54, L75-99, L104-111, L123-133, L135-195, L200-224 — khuôn màn list]
- [Source: `web/src/design-system/components/Skeleton.tsx` L3-8 — KHÔNG có prop `lines`]
- [Source: `web/src/design-system/gating/permissions.ts` L23-34 — can/orderScope]
- [Source: `web/src/design-system/shell/Sidebar.tsx` L55 — mục orders chưa gate]
- [Source: `mobile/lib/screens/customers/customer_list_screen.dart` L32, L80-102, L142-144, L193-219, L221-274 — khuôn màn list mobile]
- [Source: `mobile/lib/design_system/session/app_session.dart` L6-9 — InheritedWidget, không Bloc (YAGNI có chủ đích)]
- [Source: `mobile/test/screens/customers/customer_screens_test.dart` L41-53 — fake port ném lỗi để ép error state]
- [Source: `design-system/screens/customers.test.mjs` L3-6 — text-guard là test thật của web]
- [Source: `_bmad-output/implementation-artifacts/5-2-auto-transition-theo-su-kien-nghiep-vu.md` — khuôn story + kỷ luật đột biến]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (BMAD dev-story workflow)

### Debug Log References

Mutation runs (mọi đột biến ĐỀU compile được, khôi phục bằng `cp` — không `git checkout`):

| # | Đột biến | Suite | Kết quả |
|---|---|---|---|
| M1 | Xoá `TRANG_THAI_HUY` khỏi `ORDER_STATUS_KEYS` | `order-status.spec.ts` | **ĐỎ** (3 test) |
| M2 | `where.AND = dieuKien` → `where.OR = dieuKien` | `orders-list-scope.spec.ts` | **ĐỎ** (3 test) |
| M3 | Bỏ mệnh đề phạm vi (`if (false)`) | `orders-list-scope.spec.ts` | **ĐỎ** (2 test) |
| M4 | Bỏ `@RequireAnyPermissions` khỏi `GET /orders` | `no-handler-without-require-permissions.spec.ts` | **ĐỎ** |
| M5 | Đổi 1 nhãn tiếng Việt trên mobile | `orders-list.test.mjs` | **ĐỎ** |
| M6 | Bỏ `StatusChip` khỏi web | `orders-list.test.mjs` | **ĐỎ** |
| M7 | Thêm toggle phạm vi "Của tôi" vào web | `orders-list.test.mjs` | **ĐỎ** |
| M8 | Bỏ ticket chống race khỏi web | `orders-list.test.mjs` | **ĐỎ** |

Hai sai lệch so với chữ trong story, đều ghi rõ lý do:

1. **AC-10 gate nav**: story gợi ý lọc mục `orders` bằng `orderScope` *ngay trong màn*. Đã đặt
   thành helper `filterOrdersNav()` **trong module gating** thay vì chôn trong một screen —
   cùng cách lọc, nhưng mọi màn dựng `Sidebar` đều dùng lại được. Không đổi `filterNav`
   (giữ key-agnostic, AD-17) và không nhét `requires: PERM.ordersViewAll` (sẽ ẩn nhầm với
   người chỉ có `view_own`).
2. **Filter mobile**: story viết "hàng `AppButton`". Đã dùng `Wrap` thay `Row` và phát đủ
   **12 lựa chọn giống hệt web** (Tất cả · Follow-up · 10 trạng thái) — `Row` 12 nút tràn
   màn hình, và cắt bớt lựa chọn trên mobile là phá đúng parity UX-DR-27 mà AC-9 đòi.

Một guard tự viết bị bắt là **sai (quá rộng)** và đã sửa: cấm `Expanded(` toàn file mobile —
nhưng `Expanded` trong một `Row` là hợp lệ và có sẵn ở khuôn `customer_list_screen.dart`.
Thay bằng bất biến thật: `shrinkWrap: true` + `NeverScrollableScrollPhysics`.

Một guard có sẵn bắt được lỗi thật lúc dev: `no-permission-literal-outside-registry` đỏ vì
docstring Swagger viết `` `orders.view_all` `` (backtick bao quanh key) trong một string.
Đã bỏ backtick theo đúng quy ước 14 route cũ ("Thiếu quotes.create_edit (FORBIDDEN)").

### Completion Notes List

- **Task 1** — `ORDER_STATUS_KEYS` dựng từ chính 10 hằng. Không có cách bắt thiếu phần tử lúc
  compile (10 hằng đã annotate ⇒ kiểu nới rộng thành cả union), nên chốt chặn là test runtime
  đối chiếu **hai chiều** giữa mảng và mọi export `TRANG_THAI_*`.
- **Task 2** — `@RequireAnyPermissions` (OR) chạy **song song** với `@RequirePermissions` (AND),
  không đổi ngữ nghĩa AND: 14 route cũ giữ nguyên hành vi. Guard resolve `listForAccount`
  **đúng 1 lần** cho cả hai phép (có test đếm). Khai cả hai ⇒ phải thoả cả hai. Từ chối dùng
  chung `AppException(FORBIDDEN, 403, 'Không đủ quyền thực hiện')`.
- **Task 3** — `GET /orders` khai **NGAY TRƯỚC** `@Get(':id')`. Phạm vi gom vào `where.AND`,
  **không bao giờ** gán `where.OR` (bẫy đã trả giá ở 3.4). `items`+`total` trong một
  `$transaction`. AC-8 xử ở service bằng `AppException(VALIDATION_ERROR, 400)` — chọn MỘT chỗ.
  Đã trả **món nợ docblock** `orders.controller.ts` L55-57 mà story được tạo ra để trả.
- **Task 4** — +2 index (`status`, `assigneeAccountId`). Migration sinh offline bằng
  `--from-schema/--to-schema` (Prisma 7), **chỉ chứa 2 `CREATE INDEX`**, đã đọc bằng mắt và
  đã `migrate deploy` thật lên DB local; DB lane vẫn xanh sau khi áp.
- **Task 5/6** — Hai màn mirror nhau; nhãn byte-for-byte (guard khẳng định). `orderScope` mở
  thêm `'none'` **song song hai nền tảng**, và `UsePermissions.orderScope` đã mở theo (web
  không có tsc nên quên chỗ này là sai kiểu **im lặng**). Thu hẹp `string`→`StatusKey` bằng
  type-guard, không cast mù, không nới hợp đồng `StatusChip`.
- **AC-10 chỉ áp web** — bottom nav mobile là hợp đồng KHOÁ 5 tab (UX-DR-15). Không sửa
  `app_bottom_nav.dart`; guard mới khẳng định nó **không** trở thành permission-filtered.
  Mobile thiếu cả hai quyền ⇒ 403 ⇒ error state, đúng AD-4.
- **Không** tạo entity/cột/migration nào cho follow-up; **không** đụng `applyTransition()` /
  `allowed-transition.ts` / `auto-transition-map.ts` — source-guard 5.1 xanh, không cần sửa.

**Kết quả 4 lane (đã chạy, không suy đoán):**

| Lane | Trước (5.2) | Sau |
|---|---|---|
| Backend hermetic `npm test` | 62 suite / 1044 test | **65 suite / 1096 test** ✅ |
| Backend DB `npm run test:db` | 8 suite / 61 test | **8 suite / 61 test** ✅ (sau `migrate deploy`) |
| `design-system` `npm test` | 292 test | **308 test** ✅ |
| `mobile` `flutter test` | 199 test | **204 test** ✅ · `flutter analyze` sạch |

Lint: `eslint` sạch trên mọi file story này chạm. Còn **2 lỗi prettier có sẵn từ trước** ở
`src/orders/quote-export.service.ts` và `test/vat-mode.spec.ts` — hai file story này **không**
chạm (`git status` xác nhận), nên để nguyên theo kỷ luật "chỉ dọn rác của mình".

### File List

**Backend — mới**

- `backend/src/auth/require-any-permission.decorator.ts`
- `backend/src/orders/dto/list-orders-query.dto.ts`
- `backend/src/orders/dto/order-list-item.dto.ts`
- `backend/src/orders/dto/order-list-response.dto.ts`
- `backend/prisma/migrations/20260718000000_add_order_list_indexes/migration.sql`
- `backend/test/order-status.spec.ts`
- `backend/test/permissions-guard.spec.ts`
- `backend/test/orders-list-scope.spec.ts`
- `backend/test/orders-list.db.integration.spec.ts` (QA — lane DB cho `GET /orders`)

**Backend — sửa**

- `backend/src/auth/permissions.guard.ts`
- `backend/src/orders/orders.controller.ts`
- `backend/src/orders/orders.service.ts`
- `backend/src/orders/domain/order-status.ts`
- `backend/prisma/schema.prisma`
- `backend/test/orders.e2e.spec.ts`
- `backend/test/no-handler-without-require-permissions.spec.ts`
- `backend/openapi/openapi.json` (regen)
- `backend/openapi/permissions.json` (regen)

**Web — mới**

- `web/src/screens/orders/OrdersListScreen.tsx`
- `web/src/screens/orders/orders-list.css`

**Web — sửa**

- `web/src/design-system/session/orders-port.ts`
- `web/src/design-system/session/fake-orders-port.ts`
- `web/src/design-system/session/use-permissions.ts`
- `web/src/design-system/gating/permissions.ts`
- `web/src/design-system/gating/index.ts`
- `web/src/design-system/shell/Sidebar.tsx` (review: gate `requiresAny` trên mục Đơn hàng)

**Design-system — sửa**

- `design-system/permissions/permission-keys.test.mjs` (review: quét cả gate `requiresAny`)

**Mobile — mới**

- `mobile/lib/screens/orders/order_list_screen.dart`
- `mobile/test/screens/orders/order_list_screen_test.dart`

**Mobile — sửa**

- `mobile/lib/design_system/session/orders_port.dart`
- `mobile/lib/design_system/session/fake_orders_port.dart`
- `mobile/lib/design_system/gating/app_permissions.dart`

**Design-system — mới**

- `design-system/screens/orders-list.test.mjs`

## Senior Developer Review (AI)

**Ngày:** 2026-07-18 · **Kết quả:** Approve sau khi tự sửa 2 lỗi (1 HIGH, 1 MEDIUM).

Đã đọc TOÀN BỘ File List + đối chiếu `git status`: File List khớp git, không có file nào
khai khống, không có file lạ (ngoài 2 artifact `_bmad-output/`). 4 lane chạy lại thật:
backend hermetic **65 suite / 1099 test** xanh · design-system **308 test** xanh · mobile
**205 test** xanh. Mọi task `[x]` đều tìm được bằng chứng trong code.

### HIGH-1 — AC-10 chỉ đóng trên ĐÚNG một màn (đã sửa)

`filterOrdersNav()` chỉ được gọi trong `OrdersListScreen.tsx`. Bảy màn web còn lại
(`CustomerListScreen:119`, `CustomerPickScreen:136`, `CustomerDetailScreen:68`,
`CustomerSourceConfigScreen:206`, `CreateQuoteScreen:546`, `DiscountApprovalScreen:117`,
`ProfileScreen:91,108`) dựng sidebar bằng `filterNav(SIDEBAR_NAV, perms)` thuần ⇒ account
**không có cả hai** quyền xem đơn vẫn thấy mục "Đơn hàng" ở **mọi màn nó thực sự đứng**, chỉ
không thấy ở đúng màn nó không vào được. AC-10 đòi mục biến mất khi **dựng nav**, không phải
khi đã ở trong danh sách đơn.

**Sửa:** đưa gate về **dữ liệu của link** thay vì một wrapper mà mỗi màn phải nhớ gọi —
`NavLink.requiresAny?: readonly PermissionKey[]`, mục `orders` khai
`requiresAny: [PERM.ordersViewAll, PERM.ordersViewOwn]`, `filterNav` bỏ link khi **không key
nào** khớp. Cùng hình dạng hai-ngữ-nghĩa với guard backend story này vừa dựng
(`@RequirePermissions` AND ↔ `@RequireAnyPermissions` OR). Bảy màn cũ **không phải sửa** và
màn thứ tám trong tương lai **không thể quên**. `filterOrdersNav()` bị gỡ (đã thừa, DRY).
`orderScope` giữ nguyên `'none'` — vẫn là selector của `usePermissions`.

Đột biến bắt buộc, cả hai đều **ĐỎ** (khôi phục bằng `cp`):

| # | Đột biến | Kết quả |
|---|---|---|
| M9 | Bỏ `requiresAny` khỏi mục `orders` trong `SIDEBAR_NAV` | **ĐỎ** (`orders-list.test.mjs`) |
| M10 | `filterNav` bỏ qua `requiresAny` (điều kiện → `true`) | **ĐỎ** (`orders-list.test.mjs`) |

Guard đã mở rộng: `orders-list.test.mjs` khẳng định link khai `requiresAny`, `filterNav`
**đọc** nó, và **cả 8 màn** đều lọc `SIDEBAR_NAV` qua `filterNav` (không màn nào truyền thô).
`permission-keys.test.mjs` quét thêm gate `requiresAny` để hai key mới vẫn chịu kiểm tra AD-17.

### MEDIUM-1 — docblock mồ côi trong `orders.service.ts` (đã sửa)

`list()` được chèn ngay **dưới** docblock của `listPendingDiscounts` ⇒ `list()` có hai
docblock, còn `listPendingDiscounts` (path có fence `costs.view`) **mất** docblock mô tả
fence đó. Đã trả docblock về đúng hàm.

### LOW — ghi nhận, KHÔNG sửa (nêu lý do)

1. `OrderListScreen` (mobile) nhận `perms` bắt buộc nhưng **không dùng** — gating mobile là
   web-only theo AC-10. Story chỉ định rõ prop này (Task 6), nên không tự gỡ quyết định đã chốt.
2. `GET /orders` resolve quyền **hai lần** mỗi request (guard + `quyenCuaNguoiGoi`). Đúng
   khuôn 14 route cũ và do story chỉ định; gộp lại là thay đổi cross-cutting, tách story riêng.
3. `fake_orders_port.dart` có một hunk **thuần định dạng** (`dart format`) ở `updateLine`
   ngoài phạm vi story — vô hại, không hoàn tác.

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-18 | Review: sửa AC-10 (gate nav "Đơn hàng" chuyển thành `NavLink.requiresAny` đọc bởi `filterNav` ⇒ đóng cho **cả 8 màn web**, không chỉ màn danh sách; gỡ `filterOrdersNav`) + trả docblock mồ côi trong `orders.service.ts`. 2 đột biến mới đều ĐỎ. Lane: hermetic 1099, design-system 308, mobile 205 — xanh. Status → done. |
| 2026-07-18 | QA automate: đóng 4 gap (lane DB chưa chạy `GET /orders`; `followUp=false`+`status` bị chặn oan; `page`/`pageSize` echo; ticket chống race mobile chưa được chứng minh). 4 đột biến mới đều ĐỎ. Lane: hermetic 1096→1099, DB 8 suite/61→9 suite/69, mobile 204→205. Chi tiết: `tests/test-summary-story-5-3.md`. |
| 2026-07-18 | Story 5.3 implement xong: `GET /orders` (phạm vi theo quyền + follow-up + phân trang), decorator OR `@RequireAnyPermissions`, `ORDER_STATUS_KEYS`, +2 index DB, màn danh sách đơn web + mobile, gate nav "Đơn hàng" (web). 4 lane xanh; 8 đột biến bắt buộc đều ĐỎ đúng như yêu cầu. |
