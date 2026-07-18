---
baseline_commit: a265919
---

# Story 5.4: Chi tiết đơn — stepper gate + tabs + lịch sử bản update

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người có quyền xem đơn**,
I want **màn chi tiết đơn với stepper, tabs và lịch sử bản update**,
so that **nắm nhanh đơn đang ở đâu và đã qua những gì**.

> **⚠️ ĐÂY KHÔNG PHẢI STORY FE THUẦN.** Ba mảnh backend phải dựng trước khi có màn:
> (1) `GET /orders/:id` **đang rò đơn** — không scope theo người xem; (2) **không có hàm nào**
> trả "chuỗi bước hợp lệ" — bảng transition chỉ trả lời được từng sự kiện rời rạc;
> (3) **không có đường nào** đọc lịch sử version — `OrderVersion` còn thiếu cột "ai".
>
> **⚠️ BA NGUỒN MÂU THUẪN NHAU VỀ GATE BƯỚC GIAO HÀNG. ĐỌC KỸ TRƯỚC KHI DỰNG STEPPER —
> ĐÂY LÀ CÁI BẪY LỚN NHẤT CỦA STORY NÀY:**
>
> | Nguồn | Nói gì về bước "Đã giao" |
> |---|---|
> | `prd.md#FR-7` L159-166 | gate theo cờ **Thiết bị**; "bật Thiết bị, KHÔNG bật Vận chuyển → `… → Đã giao`" |
> | `EXPERIENCE.md` L98 | `→ [cờ Vận chuyển] Đang giao hàng → Đã giao` (cả hai bước dưới cờ Vận chuyển) |
> | mockup `all-screens.html` L1865 | "Bước **Đã giao** mở theo cờ **Thiết bị** — không phải cờ Vận chuyển" |
> | **`allowed-transition.ts` L159-167 (CODE, Story 5.1 done)** | `xongGiao` (`danggiao→dagiao`) **KHÔNG gate cờ nào**; và **KHÔNG tồn tại** transition `dacoc→dagiao` |
>
> ⇒ **Đường "bật Thiết bị, tắt Vận chuyển → Đã giao" mà FR-7 mô tả HIỆN KHÔNG ĐI ĐƯỢC** trong
> engine: `dagiao` chỉ tới được qua `danggiao`, mà `danggiao` đòi cờ **Vận chuyển**.
> **KHÔNG "sửa" `ALLOWED_TRANSITIONS` trong story này.** Sai lệch đó **đã có story sở hữu**:
> `epics.md#Story 6.1` — *"nếu KHÔNG cờ Vận chuyển, **Then** thẳng sang Đã giao (khách tự tới lấy)"*.
> Story 5.4 **chỉ VẼ đúng những gì engine cho phép** — xem Task 3 và AC-11. Thêm một dòng vào
> bảng transition ở đây = đổi máy trạng thái ngoài scope và giẫm chân Story 6.1.
>
> **⚠️ MOCKUP DÙNG SAI CLASS `.step.gate` — ĐỪNG CHÉP.** Mockup gắn `gate` (viền đứt, mờ) cho
> `Đang giao`/`Đã giao`/`Hoàn thành` **trong khi đơn ví dụ bật cả Thi công lẫn Vận chuyển** ⇒ nếu
> chép sẽ **vi phạm chính AC-1**: bước bị cờ chặn phải **ẩn hẳn**, không vẽ mờ. Trong hệ thống
> này `gate` và "bước tới chưa đạt" đang **trùng một class** nhưng là hai nghĩa khác nhau.
> Luật áp dụng: bước bị cờ chặn ⇒ **backend không trả về** ⇒ không render; bước chưa tới ⇒
> `state` **bỏ trống** (mặc định upcoming, `Stepper.tsx:12`). **KHÔNG dùng `state: 'gate'`
> ở story này.**
>
> **⚠️ MOCKUP CÓ BƯỚC KHÔNG TỒN TẠI.** `all-screens.html` L1852 vẽ bước đầu là **"Khảo sát"** →
> **không phải trạng thái**, `ORDER_STATUS_KEYS` không có nó (`prd.md` L155 nói rõ Khảo sát chỉ là
> *tên gọi khác của giai đoạn Báo giá*). `EXPERIENCE.md` L98 còn liệt kê **"Lên lịch thi công"** —
> bước này **đã bị bỏ** (Story 5.8, `epics.md` L533). Nhãn bước lấy từ **`STATUS_LABELS`**
> (`StatusChip.tsx:22-33`), **không** gõ lại từ tài liệu. Đây đúng lớp lỗi đã làm 5.1 sa lầy
> (Dev Notes chép khoá `danggiao` sai so với spine).
>
> **⚠️ CHỈ DỰNG 2 TAB.** Mockup vẽ 5 tab (Thông tin · Thanh toán · Ảnh · Lịch sử · HĐ & HĐơn),
> nhưng **Thanh toán + Hợp đồng/Hoá đơn = Epic 7**, **Ảnh = Story 5.6**. Render tab rỗng cho
> tính năng chưa có = hứa suông với người dùng. Story này dựng **Thông tin** và **Lịch sử update**;
> ba tab kia do story sở hữu chúng tự thêm vào (`project-context.md` L84: *"Mỗi story tạo/sửa CHỈ
> entity/file nó cần; không phụ thuộc story sau"*).
>
> **⚠️ KHÔNG tự tính tiền ở client.** Màn này hiện tiền (mockup có "83.010.960 đ"). Tổng đơn
> **chỉ** đến từ `POST /orders/preview-total` (AD-10/AD-16) — **cấm** cộng `amount` các dòng
> trong `.tsx`/`.dart`. Source-guard quét text sẽ bắt.

## Acceptance Criteria

1. **Given** cờ phạm vi của Đơn, **When** dựng stepper, **Then** chỉ hiện các bước hợp lệ; bước
   không áp dụng bị ẩn hẳn (không disable xám); bước hiện tại nổi bật teal, bước đã qua có tick
   (FR-7, UX-DR-11).
2. **Given** đơn có nhiều bản update, **When** xem tab lịch sử, **Then** thấy bản nào/ai/khi nào/
   đổi gì, bản hiệu lực phân giải qua `currentVersionId` (FR-6, AD-6).
3. **Given** status chip trong màn, **When** bấm, **Then** chip chỉ đọc — không đổi trạng thái qua
   chip (UX-DR-23).

[Source: `_bmad-output/planning-artifacts/epics.md#Story 5.4` L504-509 — nguyên văn]

### AC bổ sung (dẫn xuất — bắt buộc để đóng story)

4. **Given** `OrdersService.get(id, tieredPricingEnabled)` hiện **không nhận actor** và dùng
   `findUnique({where:{id}})`, **When** một account chỉ có `orders.view_own` gọi `GET /orders/:id`
   với id đơn của **người khác**, **Then** trả **404** (không phải 403 — 403 xác nhận đơn có tồn
   tại, rò một bit). Account có `orders.view_all` đọc được mọi đơn. Phạm vi phân giải **đúng hai
   trường** `ownerAccountId`/`assigneeAccountId` (AD-15), tái dùng **cùng hình dạng** mệnh đề mà
   `list()` đã dựng.
5. **Given** `GET /orders/:id` hiện gate `@RequirePermissions(PERM.quotesCreateEdit)`, **When**
   một account preset **KE_TOAN / THI_CONG / KHO_GIAO** (đều có `orders.view_*` nhưng **KHÔNG** có
   `quotes.create_edit` — `role-presets.ts:81-107`) mở chi tiết đơn, **Then** vào được.
   ⇒ Gate đổi sang `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`.
   **Không preset nào mất quyền** vì đây là mở rộng: ADMIN/QUAN_LY có `view_all`, THO_KS có
   `view_own` (`role-presets.ts:42,72,86,102,105,107`). **15 route còn lại giữ nguyên gate.**
   [Đây là **đổi public contract** — lý do bắt buộc: 5.3 vừa cho ba preset này thấy đơn trong
   danh sách, nhưng bấm vào thì **403**. Màn danh sách dẫn tới một cánh cửa khoá.]
6. **Given** engine chỉ trả lời "sự kiện X từ trạng thái hiện tại có hợp lệ không", **When** dựng
   stepper, **Then** tồn tại **một hàm domain thuần** suy chuỗi bước **TỪ `ALLOWED_TRANSITIONS`**
   (không bảng thứ hai — AD-11), nhận `(status, scopeFlags)` và trả chuỗi bước đã gate kèm trạng
   thái từng bước (`done` / `current` / `upcoming`).
7. **Given** AD-2 (client KHÔNG chứa business logic), **When** client vẽ stepper, **Then** chuỗi
   bước do **backend trả về**; web/mobile **chỉ map sang component**, **không** chứa bản sao bảng
   transition, **không** tự suy bước từ cờ.
8. **Given** `OrderVersion` hiện lưu đúng `{id, orderId, versionNo, vatRate, vatMode, chotAt,
   discountAmount, createdAt, updatedAt}` — **không có trường nào cho biết AI tạo bản này**,
   **When** hiện lịch sử, **Then** `OrderVersion` có `createdByAccountId` (nullable) được ghi ở
   **cả hai** đường sinh version: `create()` (`orders.service.ts:557`) và `revise()` (`:1068`).
   Bản cũ có sẵn ⇒ `null` ⇒ UI hiện `—` (không bịa tên).
9. **Given** tab lịch sử, **When** gọi API, **Then** `GET /orders/:id/phien-ban` trả **mọi** version
   theo `versionNo` **tăng dần**, mỗi bản: `{id, versionNo, laBanHienLuc, createdAt, chotAt,
   createdByAccountId, createdByDisplayName, soDong, thayDoi}`. `laBanHienLuc` **so với
   `Order.currentVersionId`** — **KHÔNG** suy bằng "versionNo lớn nhất" hay timestamp (AD-6 cấm
   tường minh). Endpoint chịu **cùng** gate + **cùng** scope như AC-4/AC-5.
10. **Given** "đổi gì" (AC-2), **When** dựng `thayDoi` cho bản thứ N, **Then** backend so dòng bản N
    với bản N-1 và trả `{them: string[], xoa: string[], doiSoLuong: {ten, tu, den}[]}`; bản đầu
    tiên ⇒ cả ba mảng rỗng. **Khớp dòng theo quy tắc CỐ ĐỊNH** (deterministic, có test):
    `productId` khi khác null, ngược lại `(ten, donVi)`; trùng khoá trong cùng bản ⇒ ghép cặp theo
    `displayOrder` tăng dần; dư ra ⇒ tính là thêm/xoá.
    ⚠️ **KHÔNG** so tiền/đơn giá trong diff — giá bản trước-chốt là live-resolve (`toViews`), so
    giá sẽ báo "đổi" cho bản chẳng ai đụng vào. Diff **chỉ** về dòng và số lượng.
11. **Given** engine hiện tại, **When** đơn bật **Thiết bị** nhưng **tắt Vận chuyển**, **Then**
    stepper **không** hiện bước "Đang giao"/"Đã giao" (không có đường tới chúng — xem cảnh báo
    đầu story). Story này **KHÔNG** sửa `ALLOWED_TRANSITIONS` để khớp FR-7; sai lệch được ghi lại
    ở Dev Notes để **Epic 6** đóng.
12. **Given** cùng một màn trên hai nền tảng, **When** so nhãn tiếng Việt, **Then** **byte-for-byte
    giống nhau** giữa `web/src/screens/orders/OrderDetailScreen.tsx` và
    `mobile/lib/screens/orders/order_detail_screen.dart` (UX-DR-27, khuôn `orders-list.test.mjs`).
    ⚠️ Áp cho **cả nhãn tab và nhãn frame**. Mockup **cố tình rút gọn trên mobile**
    (`Ảnh đính kèm`→`Ảnh`, `Lịch sử update`→`Lịch sử`, `Vòng đời đơn`→`Vòng đời`) — story này
    **KHÔNG theo**: UX-DR-27 nói hai nền tảng chỉ khác **khung và điều hướng**, và guard byte-parity
    của 5.3 đã chốt kỷ luật đó. Dùng nhãn **dài** trên cả hai.
13. **Given** bốn trạng thái màn, **When** render, **Then** Loading = skeleton; Error = thông báo
    cụ thể + "Thử lại"; đơn không tồn tại/ngoài phạm vi (404) = thông báo riêng, **không** dùng
    chung với lỗi mạng (UX-DR-19).

[Source: `ARCHITECTURE-SPINE.md#AD-6` L78-83 · `#AD-7` L85-89 · `#AD-11` L108-113 ·
`prd.md#FR-6` L131-136 · `#FR-7` L159-166 · `epics.md#UX-DR-11` L108 · `#UX-DR-19` L116 ·
`#UX-DR-23` L120 · `EXPERIENCE.md` L79-80]

## Tasks / Subtasks

### Task 1 — `OrderVersion.createdByAccountId` + migration (AC: 8)

**Khuôn có sẵn để copy nguyên xi:** `QuoteExport` (`schema.prisma:486-487`) đã làm **đúng việc
này** — `createdByAccountId` + relation đặt tên. Theo nó, đừng chế kiểu mới.

- [x] `backend/prisma/schema.prisma` model `OrderVersion` (L372-390): thêm
  ```prisma
  createdByAccountId String?  @map("created_by_account_id")
  createdBy          Account? @relation("OrderVersionCreatedBy", fields: [createdByAccountId], references: [id])
  ```
  **Nullable** — version có sẵn trong DB không có actor, và bịa ra một actor là nói dối trong sổ
  lịch sử. **CÓ relation** (khác `customerName` của 5.3): khuôn `QuoteExport.createdBy` đã có, và
  có relation thì Task 4 lấy tên bằng `include` thay vì tự batch — ít code hơn, không N+1.
- [x] ⚠️ Relation cần **back-reference trên `Account`** (`schema.prisma:31-49`), nếu không Prisma
      **không validate schema được**:
  ```prisma
  orderVersionsCreated OrderVersion[] @relation("OrderVersionCreatedBy")
  ```
  Đặt cạnh `quoteExports` (L46) — cùng nhóm quan hệ "do account này tạo". **Không** đổi field nào
  khác của `Account`.
- [x] **KHÔNG** thêm `note`/`changeSummary` — "đổi gì" tính được từ dòng (Task 4); cột tự-mô-tả là
      cột phải nuôi mà không đường nào ghi.
- [x] Migration **offline**:
  ```
  npx prisma migrate diff --from-schema <schema-cũ> --to-schema prisma/schema.prisma --script
  ```
  ⚠️ Prisma 7 **chỉ** nhận `--from-schema`/`--to-schema`; `--from-schema-datamodel` **không còn**.
  Đặt tên thư mục theo khuôn `20260718000000_add_order_list_indexes`.
- [x] Đọc file SQL bằng mắt: phải **chỉ** có `ALTER TABLE "order_versions" ADD COLUMN` — không
  `NOT NULL`, không backfill, không đụng bảng khác.
- [x] Ghi actor ở **cả hai** đường sinh version (thiếu một ⇒ lịch sử thủng đúng nửa):
  - `create()` `orders.service.ts:557` — `data: { id: versionId, orderId, versionNo: 1 }` →
    `+ createdByAccountId: actorAccountId`.
  - `revise()` `orders.service.ts:1068` — `versionNo: currentVersion.versionNo + 1` →
    `+ createdByAccountId: actorAccountId`.
  Cả hai hàm **đã có** `actorAccountId` trong tham số — không phải luồn thêm gì.

### Task 2 — Vá rò đơn ở `GET /orders/:id` (AC: 4, 5) ⚠️ ĐÂY LÀ LỖI BẢO MẬT CÓ SẴN

`OrdersService.get(id, tieredPricingEnabled)` (`orders.service.ts:614-617`) → `findOrThrow` →
`findUnique({where:{id}})`. **Không actor, không quyền, không phạm vi.** Bất kỳ ai có
`quotes.create_edit` đọc được **mọi** đơn theo id — trái AD-4/AD-15 mà 5.3 vừa dựng cho `list()`.

⚠️ **KHÔNG đổi chữ ký `get()`.** Nó có **một call-site nội bộ** đã rà sẵn:
`backend/src/orders/quote-export.service.ts:54` — `await this.orders.get(orderId, tieredPricingEnabled)`.
`QuoteExportService` **không** inject `AccountPermissionsService` (constructor L40-45: `orders,
prisma, eventBus, storage, renderer`) nên không có bộ quyền để truyền. Đổi chữ ký ép dev chọn một
trong hai đường tệ: thêm dependency cross-cutting vào service xuất báo giá (ngoài scope), hoặc
truyền `new Set()` — **thu hẹp im lặng**: chủ đơn vẫn xuất được, nhưng người có `view_all` xuất hộ
thì **404**, và không test nào của story này bắt được.

**Đường đúng — thêm đường đọc mới, giữ nguyên đường cũ:**

- [x] Thêm **private** `findScopedOrThrow(callerAccountId, quyen, id): Promise<Order>` trong
      `OrdersService` — chứa `findFirst` + `where.AND` + 404. Đây là **đường đọc scoped DÙNG CHUNG
      DUY NHẤT** cho cả 3 endpoint của story (xem Task 3, Task 4):
  ```ts
  const dieuKien: Prisma.OrderWhereInput[] = [{ id }];
  if (!quyen.has(PERM.ordersViewAll)) {
    dieuKien.push({ OR: [
      { ownerAccountId: callerAccountId },
      { assigneeAccountId: callerAccountId },
    ]});
  }
  const order = await this.prisma.order.findFirst({ where: { AND: dieuKien } });
  ```
  **Cùng hình dạng** mệnh đề của `list()` (`orders.service.ts:1412-1432`) — gom `where.AND`,
  **không** gán `where.OR`.
  Trả `Order` **thô** — không dòng, không giá, không discount view.
- [x] Thêm **public** `getScoped(callerAccountId, quyen, id, tieredPricingEnabled)` =
      `findScopedOrThrow(...)` rồi `viewOf(...)`. Đây là cái controller gọi.
- [x] **`get()` và `findOrThrow()` giữ NGUYÊN** ⇒ `quote-export.service.ts:54` **không đổi một chữ**,
      mọi mutator (`PATCH`, `chot`, `mo-lai`, `line-items`) không bị chạm.
- [x] Không tìm thấy ⇒ **404 `NOT_FOUND`** với **cùng thông điệp** như đơn không tồn tại. Ngoài
      phạm vi và không tồn tại **phải không phân biệt được từ ngoài**.
- [x] `orders.controller.ts:218-237`: đổi gate `@RequirePermissions(PERM.quotesCreateEdit)` →
      `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`; gọi `getScoped` với
      `account.id` + `await this.quyenCuaNguoiGoi(account.id)` (helper **đã có**, L92-96 — đừng
      viết helper thứ hai). Thêm `@ApiForbiddenResponse`.
- [x] Cập nhật docblock class L56-61 — hiện viết *"`GET /orders/:id` cũng gate `quotes.create_edit`
      (luồng người dựng đơn)"*, câu đó thành **sai** sau task này.
- [x] **15 route còn lại KHÔNG đổi gate.** `PATCH /:id`, `POST /:id/chot`… vẫn `quotes.create_edit`
      / quyền riêng của chúng. Story này chỉ mở **đường ĐỌC**.
- [x] Regen OpenAPI: `cd backend && npm run openapi:gen` (`package.json:23`). **Không** regen
      `permissions.json` — story này **không thêm key quyền nào**, chạy nó chỉ gây nhiễu diff.

### Task 3 — Hàm domain "các bước hợp lệ" + endpoint vòng đời (AC: 1, 6, 7, 11)

**Vì sao ở backend, không ở client:** AD-2 cấm business logic trên client; AD-11 cấm bảng transition
thứ hai. Nếu web/mobile tự suy bước từ cờ thì có **ba** bản sao luật (backend + 2 client) và chúng
sẽ lệch ngay lần đầu Epic 6 đổi bảng.

- [x] `backend/src/orders/domain/allowed-transition.ts` — thêm hàm **thuần** (không async, không
      Prisma, cùng khuôn `evaluateTransition`), suy **TỪ `ALLOWED_TRANSITIONS`**:
  ```ts
  export interface BuocVongDoi { status: OrderStatusKey; trangThai: 'done' | 'current' | 'upcoming'; }
  export function buocVongDoi(
    status: OrderStatusKey,
    scopeFlags: OrderScopeFlags,
  ): readonly BuocVongDoi[];
  ```
  ⚠️ Dùng **`OrderScopeFlags` đã export sẵn** (cùng file, L34-39) — `TransitionRule.scopeGuard` là
  `keyof OrderScopeFlags`. Gõ lại structural type `{thietBi, thiCong, vanChuyen}` = bản sao thứ hai
  của chính hợp đồng cờ, và sẽ trôi khi hợp đồng đổi.
- [x] ⚠️ **VÒNG ĐỜI RẼ NHÁNH SONG SONG — ĐỪNG DÙNG CHỈ SỐ TUYẾN TÍNH.** `dacoc` có **hai** cạnh ra
      cùng tồn tại: `batDauThiCong → thicong` (L138-144) và `batDauGiao → danggiao` (L152-158); và
      `hoanthanh` có **hai** nguồn (`nghiemthu`, `dagiao`). Đơn `ca_nhan` bật **cả ba cờ**
      (`scope-preset.ts:20-24`) ⇒ **cả hai nhánh sống cùng lúc**.
      `ORDER_STATUS_KEYS` là thứ tự **liệt kê**, KHÔNG phải thứ tự **đi**. Nếu tính `done/upcoming`
      bằng chỉ số trong mảng đó, stepper sẽ **nói dối**:
      - đơn ở `danggiao` ⇒ `thicong`/`nghiemthu` (chỉ số nhỏ hơn) bị đánh `done` — **trong khi đơn
        chưa từng thi công**;
      - đơn ở `nghiemthu` ⇒ `danggiao`/`dagiao` bị đánh `upcoming` — nhưng từ `nghiemthu` cạnh
        **duy nhất** là `hoanThanh`, không có đường tới chúng. Vẽ hai bước không bao giờ tới.
- [x] Thuật toán — **định nghĩa theo KHẢ NĂNG TỚI trên đồ thị đã gate, không theo chỉ số**:
  1. Dựng tập cạnh **đã gate**: mọi `TransitionRule` có `scopeGuard === undefined` **hoặc** cờ
     tương ứng **bật**. (Bỏ cạnh `huy` — xem bước 3.)
  2. Phân loại từng trạng thái:
     - `current` = `=== status`;
     - `done` = có đường (theo cạnh đã gate) **TỪ bước đó TỚI `status`**;
     - `upcoming` = có đường **TỪ `status` TỚI bước đó**;
     - không thuộc cả ba ⇒ **loại khỏi chuỗi** (nhánh đơn này không đi).
  3. `TRANG_THAI_HUY` **không bao giờ** là một nấc (kết thúc bất thường — hiện bằng chip).
     `TRANG_THAI_CHO_DUYET` cũng **không** là nấc (nhánh phụ của chiết khấu).
     ⚠️ **NGOẠI LỆ DUY NHẤT, ưu tiên cao hơn hai luật trên:** nếu `status` **đang bằng** `huy` hoặc
     `choduyet` thì bước đó **vẫn được chèn** vào đúng vị trí canonical với `trangThai: 'current'`.
     Stepper thiếu chính bước đang đứng = màn nói dối. (Cả hai đều là trạng thái **đạt được thật**:
     `apChietKhau: baogia → choduyet`, L100-105.)
  4. Sắp các bước còn lại theo thứ tự canonical trong `ORDER_STATUS_KEYS` — chỉ để **hiển thị**,
     sau khi đã phân loại xong ở bước 2. **Không** dùng thứ tự này để suy `done`/`upcoming`.
- [x] **Endpoint** `GET /orders/:id/vong-doi` trong `orders.controller.ts`:
  - Khai **SAU** `@Get(':id')`, cùng nhóm route con của `:id` (kỷ luật route tĩnh-trước-`:id` chỉ áp
    cho segment đầu — khuôn `GET /:id/bao-gia/pdf` L622).
  - Gate + scope **y hệt** Task 2: đọc qua **`findScopedOrThrow()`** rồi gọi `buocVongDoi` với
    3 cờ của `order`. **Không** đi qua `getScoped()`/`viewOf()` — endpoint này không trả dòng và
    không trả tiền, kéo `toViews` vào là gánh live-resolve giá vô ích (và dính đúng thứ AD-10
    muốn tránh).
  - Response `OrderLifecycleResponseDto`: `{ buoc: [{status, nhan, trangThai}] }` — `nhan` là nhãn
    tiếng Việt canonical.
  ⚠️ **`nhan` lấy từ đâu:** backend **chưa có** bảng nhãn trạng thái (nhãn đang sống ở
  `StatusChip.tsx:22-33` và `status_chip.dart:31-41`). Hai lựa chọn, chọn **(a)**:
  **(a)** backend **không** trả `nhan`, chỉ trả `status`; client map qua `STATUS_LABELS` /
  `kStatusLabels` **đã có sẵn** — nhãn vốn là chuyện hiển thị, và hai bảng nhãn đó đã bị parity-guard
  canh byte-for-byte. **(b)** thêm bảng nhãn thứ ba ở backend ⇒ ba nguồn nhãn phải đồng bộ tay.
  ⇒ **Response chỉ có `{status, trangThai}`.** Bỏ `nhan` khỏi DTO.
- [x] **KHÔNG** nhét `buoc` vào `OrderResponseDto`: DTO đó là response của **10+ route** (create,
      chot, mo-lai, ap-chiet-khau, patch…) — nhét vòng đời vào làm phình payload mọi route và bắt
      chúng churn contract vì một màn.

### Task 4 — Endpoint lịch sử bản update (AC: 2, 9, 10)

- [x] `OrdersService.listVersions(callerAccountId, quyen, orderId)`:
  - Lấy `order` qua **`findScopedOrThrow()`** (Task 2) ⇒ 404 đúng ngữ nghĩa, không viết lại scope,
    và **không** cần `tieredPricingEnabled` (endpoint này không trả giá).
    ⚠️ **Cả ba endpoint của story đi chung đúng một đường đọc scoped** — đó là cách đóng bài học
    HIGH-1 của 5.3 (gate chỉ đóng ở một call-site). Đường đó **có tên**: `findScopedOrThrow`.
  - `prisma.orderVersion.findMany({ where: { orderId }, orderBy: { versionNo: 'asc' }, include: { lineItems: … } })`.
  - `laBanHienLuc = version.id === order.currentVersionId` — **so con trỏ**, AD-6 cấm suy bằng
    `versionNo` lớn nhất hay timestamp.
  - `createdByDisplayName`: lấy qua `include: { createdBy: true }` → `createdBy?.displayName`.
    ⚠️ Trường tên trên `Account` là **`displayName`** (`schema.prisma:35`) — **không có** trường
    `hoTen`/`fullName`/`name`. `createdByAccountId` null ⇒ trả `null`, UI hiện `—` (không bịa tên).
  - `soDong` = số dòng của **chính** version đó.
- [x] `thayDoi` (AC-10) — hàm **thuần** trong `orders/domain/` (file mới
      `version-diff.ts`, testable không cần Prisma):
  ```ts
  export interface ThayDoiBanUpdate {
    them: string[];
    xoa: string[];
    doiSoLuong: { ten: string; tu: number; den: number }[];
  }
  export function diffDong(truoc: DongToiThieu[], sau: DongToiThieu[]): ThayDoiBanUpdate;
  ```
  Khoá ghép: `productId ?? \`${ten}|${donVi}\``; trùng khoá ⇒ ghép cặp theo `displayOrder` tăng dần;
  dư ⇒ thêm/xoá. Bản `versionNo` nhỏ nhất ⇒ ba mảng rỗng.
  ⚠️ **Không so `unitPrice`/`amount`** — trước chốt giá là live-resolve (`toViews`,
  `orders.service.ts:1875`), so giá sẽ báo "đổi" cho bản không ai đụng.
- [x] Endpoint `GET /orders/:id/phien-ban` — gate + scope y hệt Task 2. DTO
      `order-version-item.dto.ts` + `order-versions-response.dto.ts` (khuôn
      `order-list-item.dto.ts` / `order-list-response.dto.ts`).
- [x] **KHÔNG** trả tiền/giá trong response này (AD-10 — tiền chỉ qua `preview-total`; và
      `costs.view` fence).
- [x] Regen `openapi.json`.

### Task 5 — Web: `OrderDetailScreen` (AC: 1, 2, 3, 7, 12, 13)

**Khuôn để copy nguyên xi:** `web/src/screens/customers/CustomerDetailScreen.tsx` (hình dạng props
`{port, id, onX}`) + `web/src/screens/orders/OrdersListScreen.tsx` (LoadState + ticket chống race).
**Đọc cả hai trước khi gõ.**

- [x] `web/src/design-system/session/orders-port.ts`: thêm type + method, **mirror đúng DTO
      backend** (AD-12, không bịa field):
  ```ts
  export interface OrderLifecycleStep { status: string; trangThai: 'done' | 'current' | 'upcoming' }
  export interface OrderVersionItem { id: string; versionNo: number; laBanHienLuc: boolean;
    createdAt: string; chotAt: string | null; createdByAccountId: string | null;
    createdByDisplayName: string | null; soDong: number;
    thayDoi: { them: string[]; xoa: string[]; doiSoLuong: { ten: string; tu: number; den: number }[] } }
  // trong interface OrdersPort:
  getLifecycle(orderId: string): Promise<OrderLifecycleStep[]>;
  listVersions(orderId: string): Promise<OrderVersionItem[]>;
  ```
- [x] `fake-orders-port.ts`: cài cả hai — đủ dữ liệu demo đơn nhiều version + đơn một version.
- [x] `web/src/screens/orders/OrderDetailScreen.tsx` (mới) + `order-detail.css` (mới):
  - Props `{ port: OrdersPort; orderId: string; onBack?: () => void; onChangeStatus?: (id: string) => void }`
    — khuôn `CustomerDetailScreen.tsx:28-33`. **Không router** trong repo (web chưa có entry/bundler).
  - **Stepper**: `<Stepper steps={…} />` **đã có** (`design-system/components/Stepper.tsx:8-26`,
    `StepItem { label; state?: 'done'|'current'|'gate' }`). Map từ `getLifecycle()`:
    `done→'done'`, `current→'current'`, `upcoming→` **bỏ trống `state`** (đó là "upcoming" theo
    comment L12). **KHÔNG dùng `'gate'`** — xem cảnh báo mockup ở đầu story. Bước bị cờ chặn
    thì backend **đã không trả** ⇒ client không lọc gì (UX-DR-11 đóng ở backend, đúng AD-4).
  - Bọc stepper trong `<Frame label="Vòng đời đơn" onBg />` — `Frame.tsx:4-9` khai
    `{ label: string; onBg?: boolean }`. **`onBg` bắt buộc** vì frame nằm trên nền `--bg`; thiếu nó
    nhãn bị mask bằng nền trắng và lộ vệt viền (mockup dùng `class="frame on-bg"`).
    Nhãn **giống hệt** mobile (AC-12).
  - **Nhãn bước**: `STATUS_LABELS[status]` (`StatusChip.tsx:22-33`). Thu hẹp `string → StatusKey`
    bằng type-guard như 5.3 đã làm — **đừng** cast mù (web **không có tsc**, sai sẽ im lặng).
  - **Tabs**: `<Tabs>` **đã có** ở `web/src/design-system/shell/Tabs.tsx:8-18` — 5.4 là call-site
    đầu tiên. **Đúng 2 tab**: `Thông tin` · `Lịch sử update`. `useState` giữ `activeKey`.
  - **Status chip**: `<StatusChip status={…} />` — **không** `onClick`, không `role`, không
    `tabIndex` (UX-DR-23, guard đã canh ở `orders-list.test.mjs:294`).
  - Tab **Thông tin**: `kv` (mã đơn, khách, SĐT, công suất, ngày chốt, owner/assignee) + bảng dòng
    (`<Table>`), cờ phạm vi bằng `.scope-flag`.
    ⚠️ **Tiền**: chỉ hiển thị số backend trả trong `lineItems[].amount`. **Cấm** cộng/nhân/`reduce`
    trong file này (AD-10 + source-guard quét text).
  - Tab **Lịch sử update**: mỗi bản = `versionNo` · `createdAt` · `createdByDisplayName ?? '—'` ·
    badge "Bản hiệu lực" khi `laBanHienLuc` · tóm tắt `thayDoi` (thêm N dòng / xoá N dòng / đổi SL
    N dòng). Bản đầu ⇒ "Bản gốc".
  - Bốn trạng thái màn, nhãn **chốt cứng, byte-for-byte với mobile** (AC-12):
    | Trạng thái | Nội dung |
    |---|---|
    | Loading | `<Skeleton>` xếp chồng + `Đang tải chi tiết đơn…` |
    | Error | `<ErrorState message="Không tải được chi tiết đơn." retryLabel="Thử lại" onRetry={load} />` |
    | Không thấy (404) | `<ErrorState message="Không tìm thấy đơn này." retryLabel="Thử lại" onRetry={load} />` |
    | Lịch sử rỗng | `<EmptyState title="Chưa có bản update nào" message="Đơn vẫn ở bản gốc." />` |
    ⚠️ **404 ≠ lỗi mạng** (AC-13): "không tìm thấy" là câu trả lời, "thử lại" hoài không đổi.
    Phân biệt bằng mã lỗi trong envelope, không bằng chuỗi message.
  - ⚠️ `<Skeleton>` **KHÔNG có prop `lines`** (`Skeleton.tsx:3-8` chỉ `{width,height,radius,className}`).
    Xếp chồng nhiều `<Skeleton>`.
  - Ticket chống race **y hệt** `OrdersListScreen` — màn này bắn **3** request (`get`,
    `getLifecycle`, `listVersions`); tải song song bằng `Promise.all` **một ticket cho cả cụm**,
    không ba ticket rời.
  - **Transport CHỈ qua port** — không `fetch`/`axios` (AD-1/AD-2).
  - Sidebar: `filterNav(SIDEBAR_NAV, perms)` + `activeKey="orders"` — **không** thêm nav link mới
    (chi tiết đơn là màn con của "Đơn hàng", gate `requiresAny` đã có từ 5.3).
  - ⚠️ **KHÔNG render nút hành động.** Mockup có "Chuyển trạng thái" (Story **5.5**), "Huỷ đơn"
    (Story **5.7**), "Share báo giá" (màn share chưa nối). Nút dẫn tới màn chưa tồn tại = nút chết.
    Mỗi story tự thêm nút của nó. Story này chỉ có `onBack` ở topbar.
  - **A11y (UX-DR-26):** nút back là icon-only ⇒ **bắt buộc** `aria-label="Quay lại"`; tab điều
    hướng được bằng bàn phím (Tab theo thứ tự đọc).

### Task 6 — Mobile: `order_detail_screen.dart` + `AppTabs` (AC: 1, 2, 3, 7, 12, 13)

**Khuôn:** `mobile/lib/screens/customers/customer_detail_screen.dart:28-39` +
`mobile/lib/screens/orders/order_list_screen.dart` (LoadState + ticket `_latest` + `mounted`).

- [x] ⚠️ **`AppTabs` CHƯA TỒN TẠI trên mobile** (web có `shell/Tabs.tsx`; `grep TabBar|TabController`
      trong `mobile/lib` = 0 hit). Tạo `mobile/lib/design_system/shell/tabs.dart`, **mirror API web**:
  ```dart
  class AppTabItem { const AppTabItem({required this.key, required this.label}); }
  class AppTabs extends StatelessWidget {
    const AppTabs({super.key, required this.tabs, this.activeKey, this.onSelect});
  }
  ```
  Export qua `shell.dart`. **Không** dùng `TabBar`/`DefaultTabController` của Material — design
  system là SSOT, và "Viền nét" cấm ripple/elevation mặc định của Material (UX-DR-4, AD-13).
  **Không** style ad-hoc trong screen.
- [x] `mobile/lib/design_system/session/orders_port.dart` + `fake_orders_port.dart`: mirror hai
      method + hai type của Task 5 (parity là bắt buộc — guard so hai bên).
- [x] `mobile/lib/screens/orders/order_detail_screen.dart` (mới):
  - `AppStepper` **đã có** (`components/stepper.dart:21-29`, `enum AppStepState {upcoming, done,
    current, gate}`) — map y như web; `upcoming` là giá trị mặc định. **KHÔNG dùng `gate`.**
  - ⚠️ **`AppStepper` SẼ TRÀN MÀN — đây là caller đầu tiên đủ dài để lộ.** `stepper.dart:43-58`
    là `Row` **không wrap**, node cố định **64px** + thanh nối **26px** ⇒ 7 bước = `7×64 + 6×26`
    = **604px**, vượt bề ngang điện thoại. Caller hiện có (`forgot_password_screen.dart:207`) chỉ
    **3 bước** (244px) nên chưa ai gặp. Web **không** dính vì `.stepper` có `flex-wrap:wrap`.
    ⇒ Bọc `AppStepper` trong `SingleChildScrollView(scrollDirection: Axis.horizontal)` **tại màn**.
    **KHÔNG** sửa `stepper.dart` — widget đã ship, có test render riêng
    (`components_render_test.dart:211,226`), và đổi nó là đổi hành vi của caller 3-bước đang chạy tốt.
    ⚠️ Cuộn ngang **lồng trong** cuộn dọc của `AppMobileShell` là hợp lệ (khác trục).
  - `AppStatusChip` read-only, `AppTabs` 2 tab, `AppSkeleton`/`AppErrorState`/`AppEmptyState`.
  - ⚠️ **Thu hẹp `String → StatusKey`** (port trả `String`, chip nhận **enum**): helper duy nhất
    hiện có là **`_statusKeyOf`** ở `order_list_screen.dart:43-49` — **private, không import được**.
    ⇒ Nâng lên design-system: export `statusKeyOf(String) → StatusKey?` từ
    `mobile/lib/design_system/components/status_chip.dart`, rồi sửa `order_list_screen.dart:43`
    dùng lại và **xoá bản private**. Chép bản sao thứ hai = đúng thứ DRY guard tồn tại để chặn.
    (Trả `null` cho giá trị lạ ⇒ render text thường, không crash — giữ nguyên hành vi cũ.)
  - Bọc stepper trong `AppFrame(label: 'Vòng đời đơn', onBg: true, child: …)` — ⚠️ `AppFrame` nằm ở
    **`components/card.dart`** (export qua `components.dart:8`), **không** phải file riêng;
    `label` là **nullable** ở Dart nhưng bắt buộc ở đây. Nhãn **dài**, giống hệt web (AC-12),
    **không** rút gọn thành "Vòng đời" như mockup.
  - Nhãn **byte-for-byte giống web** (bảng ở Task 5), gồm cả 2 nhãn tab.
  - **KHÔNG render nút hành động** (cùng lý do Task 5). Topbar action icon-only ⇒ nếu có thì phải
    có nhãn ngữ nghĩa cho screen reader (UX-DR-26); story này bỏ luôn cho gọn.
  - ⚠️ **KHÔNG dùng `Expanded`** cho body — `AppMobileShell` đã bọc `SingleChildScrollView`. Dùng
    `ListView.separated(shrinkWrap: true, physics: NeverScrollableScrollPhysics())`
    (bài học 5.3, `customer_list_screen.dart:142-144`).
  - Ticket chống race + `if (!mounted || ticket != _latest) return;`.
  - **KHÔNG thêm dependency** — không Riverpod/Bloc (`app_session.dart:6-9`, YAGNI có chủ đích).
  - Bottom nav: hợp đồng **KHOÁ 5 tab** (`app_bottom_nav.dart:26-33`, UX-DR-15) — **CẤM sửa**.
    Dùng `kOrdersTabIndex`.

### Task 7 — Test (AC: tất cả)

**Backend** (`backend/test/`, phẳng, `*.spec.ts`):

- [x] `test/allowed-transition.spec.ts` (mở rộng) — `buocVongDoi()`:
  - Đơn `ca_nhan` (3 cờ bật) ở `dachot` ⇒ chuỗi đủ nhánh thi công; `dachot` là `current`,
    `baogia` là `done`, phần sau `upcoming`.
  - Đơn `thuong_mai` (chỉ Thiết bị) ⇒ **không** có `thicong`/`nghiemthu`/`danggiao`/`dagiao`.
  - Cờ Thi công tắt ⇒ `thicong`/`nghiemthu` **vắng mặt hoàn toàn** (không phải "có mà mờ").
  - **AC-11**: Thiết bị bật + Vận chuyển tắt ⇒ **không** có `danggiao`/`dagiao` (ghi rõ trong tên
    test rằng đây là hệ quả của bảng transition hiện tại, Story 6.1 sẽ đổi).
  - ⚠️ **Hai ca RẼ NHÁNH — đây là ca bắt lỗi "sắp bằng chỉ số"** (đơn `ca_nhan`, cả 3 cờ bật):
    - ở `danggiao` ⇒ `thicong`/`nghiemthu` **KHÔNG** `done` và **vắng mặt** (đơn chưa từng thi công);
    - ở `nghiemthu` ⇒ `danggiao`/`dagiao` **vắng mặt** (từ `nghiemthu` chỉ còn cạnh `hoanThanh`).
  - `huy`/`choduyet` không là nấc — **trừ khi** `status` đang bằng chúng, khi đó có mặt với
    `current` (hai test riêng, đúng ngoại lệ ở Task 3 bước 3).
  - ⚠️ **Mutation bắt buộc:** xoá dòng `batDauThiCong` khỏi `ALLOWED_TRANSITIONS` → suite phải
    **ĐỎ**. Xanh = hàm đang đọc một bảng chép tay ở đâu đó, không đọc bảng thật.
- [x] `test/version-diff.spec.ts` (mới) — `diffDong()`: thêm dòng · xoá dòng · đổi SL · dòng tự do
      trùng tên ghép theo `displayOrder` · đổi **giá** ⇒ `thayDoi` **rỗng** (đây là ca chống
      false-positive quan trọng nhất) · bản đầu ⇒ rỗng.
- [x] `test/orders-detail-scope.spec.ts` (mới, hermetic, mock Prisma) — hình dạng `where` của
      `get()`/`listVersions()`:
  - `view_own` ⇒ `where.AND` chứa `{id}` **và** `{OR:[{ownerAccountId},{assigneeAccountId}]}`.
  - `view_all` ⇒ `where.AND` **chỉ** có `{id}`, không mệnh đề phạm vi.
  - **`where.OR` là `undefined`** ở mọi ca.
  - ⚠️ **Mutation bắt buộc:** bỏ mệnh đề phạm vi (`if (false)`) → **ĐỎ**; đổi `findFirst` về
    `findUnique({where:{id}})` → **ĐỎ**. Đột biến **phải compile được**.
- [x] `test/orders.e2e.spec.ts` (mở rộng) — `describe('GET /orders/:id · /vong-doi · /phien-ban')`:
  - **AC-4:** actor `view_own` gọi id đơn người khác ⇒ **404**, và body **giống hệt** ca id không
    tồn tại (so cả `code` lẫn `message` — nếu khác nhau thì đã rò).
  - **AC-5:** actor có `orders.view_own` **nhưng KHÔNG có** `quotes.create_edit` ⇒ **200**
    (đây là ca preset THI_CONG/KHO_GIAO hiện đang bị 403).
  - Actor **không có cả hai** `orders.view_*` ⇒ **403**.
  - `/vong-doi`: đơn `thuong_mai` ⇒ payload không chứa `thicong`; đơn `ca_nhan` ⇒ có.
  - `/phien-ban`: đơn 2 version ⇒ 2 phần tử, `versionNo` tăng dần, **đúng một** phần tử
    `laBanHienLuc === true`.
    ⚠️ **Fixture tự nhiên làm test này XANH GIẢ**: `currentVersionId` **luôn** trỏ bản `versionNo`
    lớn nhất, nên cài sai theo "max versionNo" hoặc theo timestamp vẫn xanh. Phải có fixture **ép
    `Order.currentVersionId` trỏ bản CŨ hơn** và assert `laBanHienLuc` nằm ở **bản cũ**.
    ⚠️ **Mutation bắt buộc:** `laBanHienLuc = versionNo === max` → phải **ĐỎ** (đây là chốt chặn
    của AD-6; thiếu nó thì AC-9 không có tải trọng).
  - ⚠️ Bootstrap: `AppModule` **import động trong `beforeAll`** sau khi set env
    (`customers.e2e.spec.ts:14-16,128`). **Static import = suite chết.**
- [x] `test/orders.service.spec.ts` (mở rộng): `create()` và `revise()` **đều** ghi
      `createdByAccountId`. ⚠️ **Mutation:** bỏ trường khỏi `revise()` → **ĐỎ**
      (thiếu test này thì lịch sử thủng đúng nửa mà không ai biết).
- [x] `npm test` (baseline sau 5.3: **65 suite / 1099 test**) xanh **toàn bộ**, gồm 8 source-guard
      + drift-guard `openapi.json`/`permissions.json`.
- [x] `npm run test:db` — file **`backend/test/order-version-actor.db.integration.spec.ts`**:
      cột mới tồn tại, nullable, version cũ đọc được với `null`, FK tới `accounts` hợp lệ.
      ⚠️ **Tên file phải kết thúc `.db.integration.spec.ts`** — lane lọc bằng regex đó
      (`package.json:22`); đặt sai tên = test **không bao giờ chạy** và cũng không ai biết.
      Chỉ chạy được nếu Docker Desktop đang chạy — **nếu daemon không có: viết test, báo lane
      CHƯA CHẠY, nhờ Đại Ca bật Docker.** Đừng giả vờ nó xanh; `open -a Docker` từ shell agent
      **không** tạo được socket.

**Web** (text-guard — `design-system/screens/`, chạy bằng `node --test`):

- [x] `design-system/screens/order-detail.test.mjs` (mới), khuôn
      `design-system/screens/orders-list.test.mjs` (303 dòng, 16 test — đọc trước): đọc **cả hai**
      file nền tảng, `stripComments`, rồi assert:
      cả hai tồn tại · dựng từ component DS (`Stepper`/`Tabs`/`StatusChip`/`Skeleton`/`EmptyState`/
      `ErrorState`) · transport **chỉ** qua port · nhãn tiếng Việt **byte-for-byte** hai bên ·
      không permission literal · **không số học tiền** · chip read-only (không `onClick` trên
      `StatusChip`) · **không bảng transition chép tay** (cấm chuỗi `scopeThiCong &&`/`thicong` đi
      kèm logic dựng bước trong file screen — AC-7) · đúng **2** tab, không có tab
      "Thanh toán"/"Ảnh"/"Hợp đồng".
  - ⚠️ Guard quét **TOÀN VĂN như text**: đừng viết chuỗi bị cấm (`shadow`, `gradient`,
    `box-shadow:`, `var(--r)`, `.toUpperCase()`) **kể cả trong comment**.
  - ⚠️ Regex bắt khối code: `\{[^}]*\}` **cắt sớm** ở `}` trong của generic lồng. Dùng
    `\{[\s\S]*?\n\}`.
  - ⚠️ **Mutation bắt buộc:** đổi một nhãn trên **một** nền tảng → **ĐỎ**; bỏ `Stepper` khỏi web →
    **ĐỎ**; thêm `onClick` vào `StatusChip` → **ĐỎ**; thêm logic suy bước từ cờ vào screen → **ĐỎ**.
    Sanity-test do chính tác giả guard nghĩ ra chỉ bắt được cái tác giả tưởng tượng — **phá thứ
    được bảo vệ** và đòi ĐỎ.
- [x] `cd design-system && npm test` xanh.

**Mobile** (widget test THẬT — bắt buộc, không mượn cớ TD-1 của web):

- [x] `mobile/test/screens/orders/order_detail_screen_test.dart` (mới), khuôn
      `mobile/test/screens/orders/order_list_screen_test.dart` (fake port subclass ném lỗi /
      `Completer` kiểm soát thứ tự trả lời):
      loading → ready · error + bấm "Thử lại" gọi lại port · 404 hiện thông báo riêng · đổi tab
      hiện nội dung tab kia · đơn `thuong_mai` **không** render bước "Đang thi công" ·
      lịch sử rỗng ⇒ empty state.
- [x] ⚠️ **Test tràn stepper (bắt buộc):** đơn `ca_nhan` đủ 7 bước, host trong khung hẹp
      (`tester.view.physicalSize` cỡ điện thoại) ⇒ **không có** `RenderFlex overflowed` exception.
      Thiếu test này thì lỗi tràn chỉ lộ trên máy thật. Mutation: bỏ `SingleChildScrollView` ngang
      → test phải **ĐỎ**.
- [x] `mobile/test/design_system/` — test cho `AppTabs` (widget mới): render N tab, tab active có
      style khác, bấm gọi `onSelect` đúng key.
- [x] `cd mobile && flutter test` + `flutter analyze` xanh.
      ⚠️ `dart format --set-exit-if-changed` **vẫn ghi đè file** — dùng `dart format -o none`, nếu
      không nó lan ra ~20 file ngoài scope.

## Dev Notes

### Hiện trạng file bị SỬA (đọc trước khi đổi)

| File | Hiện làm gì | Story này đổi gì | Phải giữ nguyên |
|---|---|---|---|
| `backend/src/orders/orders.service.ts` | `get(id, tiered)` L614-617 → `findUnique`, **không scope**. `create()` L557 + `revise()` L1068 tạo version | `get()` nhận actor+quyền, `findFirst`+`where.AND`; 2 chỗ ghi `createdByAccountId`; thêm `listVersions()` | `applyTransition` L382-437 · `viewOf` · `toViews` · `list()` L1388-1462 · mọi hàm ghi |
| `backend/src/orders/orders.controller.ts` | 16 route; `GET /:id` L218-238 gate `quotesCreateEdit`; helper `quyenCuaNguoiGoi` L92-96 | `GET /:id` đổi gate + truyền actor; +2 route con; sửa docblock L56-61 | **15 route còn lại + gate của chúng**; kỷ luật route tĩnh trước `:id`; không dựng envelope lỗi trong controller |
| `backend/src/orders/domain/allowed-transition.ts` | `ALLOWED_TRANSITIONS` 16 dòng + `evaluateTransition` + `daTaiDich` | **Thêm** `buocVongDoi()` | ⚠️ **BẢNG 16 DÒNG — KHÔNG THÊM/SỬA/XOÁ DÒNG NÀO** (xem AC-11); thứ tự đánh giá table→scope→permission (quyết định bảo mật, L212-218) |
| `backend/prisma/schema.prisma` (`OrderVersion` L372-390) | 8 cột + `@@unique([orderId, versionNo])` | +1 cột nullable | Mọi cột/relation/`@map`; `@@unique` |
| `web/.../session/orders-port.ts` + `mobile/.../orders_port.dart` | 15 method, có `get`/`list` | +2 method, +2 type | 15 method cũ + hằng status |
| `mobile/lib/design_system/shell/shell.dart` | export 4 widget shell | +export `AppTabs` | 4 export cũ |

### Bất biến không được vi phạm

- **AD-2:** client **KHÔNG** chứa business logic ⇒ chuỗi bước stepper do **backend** suy, client chỉ map.
- **AD-11:** `ALLOWED_TRANSITIONS` là **hợp đồng duy nhất**; `buocVongDoi()` **đọc** nó, không chép nó.
  Story này **chỉ ĐỌC** máy trạng thái — không đổi `Order.status` ở đâu cả; source-guard
  `no-order-status-write-outside-transition` phải vẫn xanh **không cần sửa**.
- **AD-6:** "bản hiệu lực" **chỉ** phân giải qua `Order.currentVersionId` — cấm suy bằng
  `versionNo` lớn nhất hoặc timestamp. Version cũ + dòng cũ **bất biến**, không op update/delete nào chạm.
- **AD-4/AD-15:** phạm vi là **server-side**, phân giải đúng hai trường `ownerAccountId`/
  `assigneeAccountId`; client không gửi tham số phạm vi. Ẩn UI chỉ là tiện nghi.
- **AD-17:** literal quyền chỉ ở `permission-registry.ts`. Story này **không thêm key mới** —
  dùng `ordersViewAll`/`ordersViewOwn` đã có.
- **AD-10/AD-16:** tiền chỉ từ backend; **cấm** số học tiền trong `.tsx`/`.dart`.
- **AD-12:** contract từ backend → regen OpenAPI → FE mirror. Không bịa field ở FE.
- **AD-13:** dựng từ component DS có sẵn (`Stepper`, `Tabs`, `StatusChip`…); widget thiếu
  (`AppTabs` mobile) thêm vào **design-system**, không vẽ trong screen.
- **AD-5:** envelope lỗi do `AllExceptionsFilter` dựng; service ném `AppException`.

### Học từ story trước (5.3 / 5.2 / 5.1 / 3.4)

- **5.1** sa lầy vì Dev Notes chép sai khoá trạng thái so với spine gốc. Story này có **ba** tài liệu
  mâu thuẫn nhau về gate bước giao (xem đầu story) — **code `allowed-transition.ts` là chân lý**,
  tài liệu là mô tả ý định chưa được cài. Đừng "sửa code cho khớp tài liệu".
- **5.3** đã trả bài học `where.OR` bị chiếm chỗ ⇒ gom `where.AND` **ngay từ đầu** ở `get()`.
- **5.3** cũng cho thấy nới một guard thì phải **đột biến** để chứng minh nó chưa chết.
- **5.2/5.3:** đột biến **phải compile được** — mutant không compile làm đỏ mọi suite và chứng
  minh số 0.
- **Đừng `git checkout`** để hoàn tác đột biến: code story chưa commit, checkout xoá sạch. Dùng
  `cp` sao lưu/khôi phục.
- **5.3** review bắt HIGH vì gate chỉ đóng ở **một** call-site. Ở đây tương ứng: scope phải nằm
  trong **đường đọc dùng chung** (`get()` scoped), để `/vong-doi` và `/phien-ban` **không thể quên**.

### Nợ kỹ thuật ghi nhận, KHÔNG sửa ở story này

1. **FR-7 vs engine — nhánh giao hàng.** FR-7 đòi "bật Thiết bị, tắt Vận chuyển ⇒ … → Đã giao";
   bảng hiện tại **không có** đường `dacoc → dagiao`, nên ca đó không đi được. Thuộc
   **`epics.md#Story 6.1`** (AC đầu tiên của story đó viết đúng ca này). AC-11 chốt hành vi
   5.4 = **vẽ đúng engine**; khi 6.1 thêm cạnh, `buocVongDoi()` **tự** hiện bước mới vì nó đọc
   thẳng bảng — không phải sửa lại màn.
2. **Đường GHI vẫn CHƯA scope — lỗ có sẵn, cố ý không vá ở đây.** Task 2 chỉ vá đường **đọc**.
   `findOrThrow(id)` (unscoped, `orders.service.ts:305`) vẫn phục vụ `PATCH /:id`, `chot`,
   `mo-lai`, `line-items`… (call-site `:473, 500, 681, 772, 995, 1140`). ⇒ THO_KS
   (`role-presets.ts:95-103`: có `quotesCreateEdit`, chỉ `ordersViewOwn`) **vẫn PATCH được đơn
   người khác theo id**. Vá cả đường ghi = đụng 6+ mutator và đổi ngữ nghĩa 15 route ⇒ **story
   riêng**. Ghi ở đây để review **không mở lại như finding mới**.
3. **`GET /orders/:id` resolve quyền hai lần/request** (guard + `quyenCuaNguoiGoi`) — đúng khuôn
   16 route hiện có; gộp lại là thay đổi cross-cutting, tách story riêng (đã ghi ở review 5.3).
4. **Web không có tsc/bundler/JSDOM (TD-1).** Màn này phức tạp hơn 5.3 (stepper + tabs + 3 request
   song song) mà lane web vẫn chỉ là text-guard ⇒ dồn assert **hành vi** vào lane `flutter test`.
5. **`backend/test/` có cả `permissions-guard.spec.ts` lẫn `permissions.guard.spec.ts`** — hai file
   tên gần trùng, có sẵn từ trước story này. Không dọn (không phải rác của story này).

### Project Structure Notes

- Backend: mọi thứ ở `backend/src/orders/` — DTO trong `orders/dto/`, domain **thuần** trong
  `orders/domain/` (`buocVongDoi` vào `allowed-transition.ts`, `diffDong` vào file mới
  `version-diff.ts`). Test backend **phẳng** trong `backend/test/`.
- Hai lane test tách bằng **hậu tố tên file**: hermetic `*.spec.ts` vs DB `*.db.integration.spec.ts`.
  `describe.skip` **không** tách được lane.
- Web: screen ở `web/src/screens/orders/`, CSS cùng thư mục; component dùng chung ở
  `web/src/design-system/`. Text-guard ở **repo root** `design-system/screens/*.test.mjs`,
  **không** ở `web/`.
- Mobile: screen ở `mobile/lib/screens/orders/`, widget shell ở `mobile/lib/design_system/shell/`,
  test ở `mobile/test/screens/orders/`.
- File/route kebab-case; entity PascalCase; bảng snake_case số nhiều; ngày ISO-8601 UTC.
- Token/icon design-system là **generated** — sửa SSOT `design-system/tokens|icons` rồi
  `cd design-system && npm run build`. **Cấm sửa tay** `tokens.ts/css`, `app_tokens.dart`, `sprite.ts`.
- ⚠️ `.gitignore` có mục `assets/` từng nuốt file mới. Nếu sinh file ở thư mục lạ, chạy
  `git check-ignore -v <file>` trước khi tin là đã commit.

### Câu hỏi đã tự quyết (nêu để Đại Ca phủ quyết nếu muốn)

1. **Stepper suy ở BACKEND, không ở client** — AD-2 cấm business logic trên client và AD-11 cấm
   bảng transition thứ hai. Để client tự suy sẽ có **ba** bản sao luật và chúng lệch ngay lần đầu
   Epic 6 đổi bảng.
2. **Đổi gate `GET /orders/:id` sang `@RequireAnyPermissions(ordersViewAll, ordersViewOwn)`** —
   đây là **đổi public contract**. Lý do bắt buộc: KE_TOAN/THI_CONG/KHO_GIAO có quyền xem đơn
   nhưng **không** có `quotes.create_edit`, nên 5.3 vừa cho họ thấy danh sách mà bấm vào thì 403.
   Không preset nào **mất** quyền. Nếu Đại Ca muốn giữ `quotes.create_edit`, phải chấp nhận ba
   preset đó không mở được chi tiết đơn.
3. **Chỉ 2 tab (Thông tin · Lịch sử update)**, không render Thanh toán/Ảnh/HĐ&HĐơn — chúng thuộc
   Epic 7 và Story 5.6. Tab rỗng là hứa suông.
4. **`OrderVersion.createdByAccountId` nullable, không thêm `note`/`changeSummary`** — "đổi gì"
   tính được từ dòng; cột tự-mô-tả là cột phải nuôi mà không đường nào ghi.
5. **Lịch sử đọc từ `OrderVersion`, KHÔNG từ `AuditLog`** — AuditLog có sẵn `actorAccountId`/
   `before`/`after`, nhưng nó nằm sau fence `audit.read` (Super Admin-only) và endpoint đọc audit
   là **Story 8.5**. Mượn AuditLog cho một tính năng gate bằng quyền xem đơn = lách fence audit.
6. **Diff chỉ về dòng + số lượng, không về tiền** — trước chốt giá là live-resolve, so giá sẽ báo
   "đổi" cho bản không ai đụng vào.
7. **Response vòng đời không trả nhãn tiếng Việt** — nhãn đã sống ở `STATUS_LABELS`/`kStatusLabels`
   và bị parity-guard canh byte-for-byte; thêm bảng nhãn thứ ba ở backend là ba nguồn phải đồng bộ tay.
8. **KHÔNG sửa `ALLOWED_TRANSITIONS` để khớp FR-7** — sai lệch đã có chủ: `epics.md#Story 6.1`
   viết đúng ca đó. Nếu Đại Ca muốn đóng ngay, đó là story riêng chạm máy trạng thái.
9. **Stepper 1 node "Báo giá", KHÔNG 2 node "Khảo sát" + "Báo giá"** — mockup vẽ 2, nhưng
   `prd.md` L155 nói rõ Khảo sát *là* giai đoạn Báo giá, và bộ khoá chỉ có `baogia`. Vẽ một node
   cho một trạng thái không tồn tại là dạy người dùng một bước không có thật.
10. **Nhãn dài trên cả hai nền tảng** (`Lịch sử update`, `Vòng đời đơn`) — mockup rút gọn trên
    mobile, nhưng UX-DR-27 + guard byte-parity của 5.3 thắng. Nếu Đại Ca muốn nhãn ngắn cho hẹp
    màn, phải rút gọn **cả hai bên** để guard vẫn xanh.
11. **Không nút hành động nào trong 5.4** — "Chuyển trạng thái" (5.5), "Huỷ đơn" (5.7),
    "Share báo giá" đều dẫn tới màn chưa tồn tại. Story sở hữu nút tự thêm.
12. **`gate` không được dùng** — trong hệ thống hiện tại `gate` (viền đứt) và "bước tới chưa đạt"
    trùng một class nhưng khác nghĩa; UX-DR-11 bảo bước bị chặn phải **ẩn**, nên `gate` không còn
    ca dùng hợp lệ ở màn này.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.4` L504-509 — AC 1-3 nguyên văn]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-11` L108 — Stepper: bước gated **ẩn hẳn**, không xám]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-19` L116 — Loading/Empty/Error microcopy]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-23` L120 — chip read-only, đổi status qua màn riêng]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-27` L124 — parity web↔mobile]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.1` — *"nếu KHÔNG cờ Vận chuyển, Then thẳng sang Đã giao"*: chủ sở hữu sai lệch FR-7]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-4` L101 · `#UX-DR-6` L103 · `#UX-DR-26` L123 — Viền nét, Frame, a11y]
- [Source: `.../ARCHITECTURE-SPINE.md#Order state machine` — sơ đồ: **không** có cạnh `DaCoc → DaGiao`, **không** có "Lên lịch thi công"]
- [Source: `.../ux-designs/.../DESIGN.md#Elevation & Depth` — ngoại lệ shadow hợp lệ DUY NHẤT gồm ring `0 0 0 3px teal-050` của stepper `current`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.8` L533 — bước "Lên lịch thi công" **đã bỏ**]
- [Source: `.../prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-6` L131-136 — lịch sử bản update: bản nào/ai/khi nào/đổi gì]
- [Source: `.../prd.md#FR-7` L159-166 — gate theo cờ; ⚠️ mô tả nhánh giao **chưa khớp** engine]
- [Source: `.../prd.md#FR-9` L173-177 — chuyển bước theo quyền + audit]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-6` L78-83 — `currentVersionId` là con trỏ chân lý DUY NHẤT]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-7` L85-89 — hybrid state machine gate 3 cờ]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-11` L108-113 — một bảng transition, một hàm ghi status]
- [Source: `.../ux-designs/.../EXPERIENCE.md` L79-80 — Status chip + Stepper: quy tắc hành vi]
- [Source: `.../ux-designs/.../EXPERIENCE.md` L95-101 — chuỗi trạng thái; ⚠️ còn "Lên lịch thi công" đã bỏ]
- [Source: `.../ux-designs/.../mockups/all-screens.html` L1802-1980 — layout màn `s-order-detail`, 5 tab, stepper, kv + bảng dòng]
- [Source: `_bmad-output/project-context.md` L38-94 — bất biến AD, testing, gotchas]
- [Source: `backend/src/orders/orders.service.ts` L614-636 — `get()`/`viewOf` **chưa scope**]
- [Source: `backend/src/orders/orders.service.ts` L1388-1462 — `list()` scoped, khuôn `where.AND`]
- [Source: `backend/src/orders/orders.service.ts` L557, L1068 — hai chỗ sinh `OrderVersion`]
- [Source: `backend/src/orders/orders.service.ts` L989-1090 — `revise()`: version mới, lịch sử bất biến]
- [Source: `backend/src/orders/domain/allowed-transition.ts` L99-207 — bảng 16 dòng, `scopeGuard`]
- [Source: `backend/src/orders/domain/allowed-transition.ts` L160-168 — `xongGiao` **KHÔNG** gate cờ, kèm lý do]
- [Source: `backend/src/orders/domain/allowed-transition.ts` L210-219 — thứ tự đánh giá là quyết định bảo mật]
- [Source: `backend/src/orders/orders.controller.ts` L56-61 — docblock gate, sẽ sai sau Task 2]
- [Source: `backend/src/orders/orders.controller.ts` L92-96 — `quyenCuaNguoiGoi` đã có]
- [Source: `backend/src/orders/orders.controller.ts` L218-238 — `GET /:id` hiện tại]
- [Source: `backend/prisma/schema.prisma` — model `OrderVersion` L372-390, `AuditLog` L72-86]
- [Source: `backend/src/accounts/domain/role-presets.ts` L81-107 — KE_TOAN/THI_CONG/KHO_GIAO **không** có `quotes.create_edit`]
- [Source: `backend/src/accounts/domain/permission-registry.ts` L28, L30 — ordersViewAll/ordersViewOwn]
- [Source: `web/src/design-system/components/Stepper.tsx` L4-26 — `StepItem`/`StepState`, bước ẩn do **caller loại khỏi mảng**]
- [Source: `web/src/design-system/shell/Tabs.tsx` L8-18 — `TabsProps`, chưa screen nào dùng]
- [Source: `web/src/design-system/components/StatusChip.tsx` L22-33, L35-57 — `STATUS_LABELS` + chip không handler]
- [Source: `web/src/design-system/components/Skeleton.tsx` L3-8 — **không** có prop `lines`]
- [Source: `web/src/design-system/components/Frame.tsx` L4-9, L15-23 — `{label, onBg?}`]
- [Source: `mobile/lib/design_system/components/card.dart` L54-66 — `AppFrame` sống trong `card.dart`]
- [Source: `backend/prisma/schema.prisma` L31-49 — `Account.displayName`; **không** có `hoTen`/`fullName`]
- [Source: `backend/prisma/schema.prisma` L486-487 — `QuoteExport.createdByAccountId` + relation: khuôn cột actor]
- [Source: `web/src/screens/orders/OrdersListScreen.tsx` L36, L190 — `onOpen(id)` đã có, chỗ nối màn chi tiết]
- [Source: `web/src/screens/customers/CustomerDetailScreen.tsx` L28-33 — khuôn props màn chi tiết]
- [Source: `mobile/lib/design_system/components/stepper.dart` L21-39 — `AppStepper`/`AppStepState`]
- [Source: `mobile/lib/design_system/components/stepper.dart` L42-59, L61-65 — `Row` không wrap, node 64px + bar 26px ⇒ tràn khi ≥5 bước]
- [Source: `mobile/lib/screens/auth/forgot_password_screen.dart` L207 — caller 3 bước duy nhất hiện có]
- [Source: `web/src/design-system/components/ErrorState.tsx` L6-10 — `{message, onRetry?, retryLabel?}`]
- [Source: `mobile/lib/design_system/shell/` — **không có** `tabs.dart` (phải tạo)]
- [Source: `mobile/lib/design_system/shell/app_bottom_nav.dart` L26-33 — 5 tab là hợp đồng KHOÁ]
- [Source: `mobile/lib/screens/orders/order_list_screen.dart` L67, L341 — `onOpen` đã có]
- [Source: `mobile/lib/screens/customers/customer_detail_screen.dart` L28-39 — khuôn màn chi tiết mobile]
- [Source: `design-system/screens/orders-list.test.mjs` L294 — guard chip read-only đã có]
- [Source: `mobile/test/screens/orders/order_list_screen_test.dart` L21-64 — fake port ép state]
- [Source: `_bmad-output/implementation-artifacts/5-3-danh-sach-don-follow-up-trang-thai-list.md` — khuôn story, `where.AND`, kỷ luật đột biến, review HIGH-1]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

Bốn lane chạy đầy đủ, không lane nào bị bỏ:

| Lane | Lệnh | Kết quả |
|---|---|---|
| Backend hermetic | `cd backend && npx jest` | **69 suite / 1144 test** xanh (baseline 5.3: 65/1099) |
| Backend DB | `cd backend && npm run test:db` | **10 suite / 72 test** xanh (Docker Desktop đang chạy; migration đã `migrate deploy`) |
| Web text-guard | `cd design-system && npm test` | **327 test** xanh |
| Mobile | `cd mobile && flutter test` + `flutter analyze` | **219 test** xanh, analyze **0 issue** (baseline 5.3: 205) |

(Số ở trên là số SAU review — xem "Senior Developer Review (AI)". Bản dev ghi 67/1138 · 325 · 217,
chưa đếm hai file test không có trong File List và các test review thêm vào.)

**Đột biến đã chạy — mọi mutant compile được và đều ĐỎ, khôi phục bằng `cp` (không `git checkout`):**

| # | Đột biến | Suite phải đỏ | Kết quả |
|---|---|---|---|
| 1 | Xoá dòng `batDauThiCong` khỏi `ALLOWED_TRANSITIONS` | `allowed-transition.spec.ts` | ĐỎ 5 test |
| 2 | `if (false && ...)` — bỏ mệnh đề phạm vi trong `findScopedOrThrow` | `orders-detail-scope.spec.ts` | ĐỎ 3 test |
| 3 | `findFirst({AND})` → `findUnique({where:{id}})` | `orders-detail-scope.spec.ts` | ĐỎ 9 test |
| 4 | Bỏ `createdByAccountId` khỏi `revise()` | `orders.service.spec.ts` | ĐỎ 2 test |
| 5 | `laBanHienLuc = versionNo === max` (thay con trỏ) | `orders.e2e.spec.ts` | ĐỎ 1 test |
| 6 | Đổi nhãn `Lịch sử update` → `Lịch sử` chỉ trên web | `order-detail.test.mjs` | ĐỎ |
| 7 | Bỏ `<Stepper>` khỏi web | `order-detail.test.mjs` | ĐỎ |
| 8 | Thêm `onClick` vào `<StatusChip>` | `order-detail.test.mjs` | ĐỎ |
| 9 | Thêm logic dựng bước từ cờ vào screen | `order-detail.test.mjs` | ĐỎ |
| 10 | Bỏ `SingleChildScrollView` ngang quanh `AppStepper` | `order_detail_screen_test.dart` | ĐỎ |

### Completion Notes List

**⚠️ LỆCH KHỎI THUẬT TOÁN STORY MÔ TẢ — Task 3, có chủ đích, cần Đại Ca biết.**

Story (Task 3 bước 1) bảo dựng đồ thị "mọi cạnh đã gate, bỏ cạnh `huy`". Cài đúng như vậy thì
**đơn mới tinh ở `baogia` hiện `Đã chốt` là `done`** — em đã dựng, chạy, và in ra để xác nhận:

```
[{"status":"baogia","trangThai":"current"},{"status":"dachot","trangThai":"done"}, …]
```

Lý do: bảng có **cạnh QUAY LUI** — `moLai` (`dachot → baogia`) và `tuChoiChietKhau`
(`choduyet → baogia`). Chúng biến đồ thị thành **có chu trình**, nên "có đường từ bước X tới
`status`" đúng với gần như mọi X, và luật `done` nuốt hết. Story không lường trước hai cạnh này.

⇒ Em loại **cả ba** sự kiện `huy` / `moLai` / `tuChoiChietKhau` khỏi đồ thị phân loại (hằng
`SU_KIEN_KHONG_PHAI_BUOC_TIEN`, có comment giải thích tại chỗ). Vòng đời **tiến lên** là một DAG;
undo không nằm trong đó. Bảng 16 dòng **không bị đụng một chữ** (AC-11 giữ nguyên). Có test khoá
lại: *"CẠNH QUAY LUI không được tính là tiến: đơn mới ở `baogia` KHÔNG khoe `dachot` là done"*.

**Hai điểm khác lệch khỏi mô tả story, đều nhỏ và đều có lý do kiểm chứng được:**

1. **`OrderPortError.code` / `OrderPortException.code` là field MỚI trên cả hai port.** AC-13 đòi
   phân biệt 404 với lỗi mạng "bằng mã lỗi trong envelope, không bằng chuỗi message" — nhưng
   **cả hai port đều chưa có field `code`**, chỉ có `message`. Envelope AD-5 thì có `code`.
   Em thêm `code` (optional) vào cả hai để đúng AC-13; không có nó thì chỉ còn cách so chuỗi
   tiếng Việt, đúng thứ AC-13 cấm.
2. **`AppTabs` phải tự cuộn ngang.** Widget test bắt được overflow **67px ngay trong chính
   `AppTabs`** (hai nhãn dài + màn ~286dp), không phải ở stepper. Em bọc cuộn ngang **trong
   design-system** (`app_tabs.dart`) chứ không trong màn: nhãn dài là hợp đồng AC-12, nên mọi
   caller tương lai đều gặp; vá ở màn là để bẫy lại cho người sau. Stepper vẫn có cuộn ngang
   riêng ở màn đúng như Task 6 yêu cầu (widget đã ship, có caller 3 bước đang chạy tốt).

**Ba việc nhỏ khác đáng ghi:**

- **File `AppTabs` đặt tên `app_tabs.dart`**, không phải `tabs.dart` như story viết — 4 file shell
  hiện có đều là `app_*.dart` (`app_topbar`, `app_bottom_nav`…); theo convention repo.
- **8 test e2e có sẵn phải cấp thêm `orders.view_own`.** Đây là fallout đúng dự kiến của đổi gate
  (AC-5): chúng gọi `GET /orders/:id` với mỗi `quotes.create_edit`. Không nới guard, chỉ cấp đúng
  quyền mà route mới đòi. Fake `order.findFirst` trong e2e đọc lại qua `findUnique` rồi **áp chính
  mệnh đề phạm vi service gửi xuống** — nếu service quên gửi, ca "đơn người khác ⇒ 404" sẽ đỏ chứ
  không xanh giả.
- **`statusKeyOf` nâng lên `status_chip.dart`** và bản private trong `order_list_screen.dart` đã
  **xoá**, đúng Task 6 (không để tồn tại bản sao thứ hai).

**Nợ kỹ thuật story đã ghi, KHÔNG sửa ở đây** (giữ nguyên, để review không mở lại như finding mới):
đường **GHI** vẫn chưa scope (`findOrThrow` unscoped phục vụ `PATCH`/`chot`/`mo-lai`/`line-items`);
FR-7 vs engine thuộc Story 6.1; resolve quyền hai lần/request; web chưa có tsc (TD-1).

### File List

**Backend — schema/migration**

- `backend/prisma/schema.prisma` (sửa) — `OrderVersion.createdByAccountId` + relation
  `OrderVersionCreatedBy`; back-reference `Account.orderVersionsCreated`
- `backend/prisma/migrations/20260718020000_add_order_version_created_by/migration.sql` (mới)

**Backend — domain**

- `backend/src/orders/domain/allowed-transition.ts` (sửa) — thêm `BuocVongDoi`, `buocVongDoi()`,
  `SU_KIEN_KHONG_PHAI_BUOC_TIEN`; **bảng 16 dòng không đổi**
- `backend/src/orders/domain/version-diff.ts` (mới) — `diffDong()`, `DongToiThieu`,
  `ThayDoiBanUpdate`

**Backend — service/controller/DTO**

- `backend/src/orders/orders.service.ts` (sửa) — `findScopedOrThrow()`, `getScoped()`,
  `lifecycle()`, `listVersions()`, `OrderVersionRow`; ghi `createdByAccountId` ở `create()` +
  `revise()`; `get()`/`findOrThrow()` **giữ nguyên**
- `backend/src/orders/orders.controller.ts` (sửa) — `GET /:id` đổi gate + truyền actor;
  `+GET /:id/vong-doi`, `+GET /:id/phien-ban`; docblock class cập nhật
- `backend/src/orders/dto/order-lifecycle-response.dto.ts` (mới)
- `backend/src/orders/dto/order-version-item.dto.ts` (mới)
- `backend/src/orders/dto/order-versions-response.dto.ts` (mới)
- `backend/openapi/openapi.json` (regen)

**Backend — test**

- `backend/test/allowed-transition.spec.ts` (sửa) — 12 test `buocVongDoi`
- `backend/test/version-diff.spec.ts` (mới) — 8 test
- `backend/test/orders-detail-scope.spec.ts` (mới) — 12 test, 3 đường đọc × 4 ca
- `backend/test/orders.e2e.spec.ts` (sửa) — describe mới cho 3 route + fake `order.findFirst`
- `backend/test/orders.service.spec.ts` (sửa) — actor ở cả hai đường sinh version
- `backend/test/order-version-actor.db.integration.spec.ts` (mới) — 3 test DB lane
- `backend/test/orders-read-gate.spec.ts` (mới) — source-guard: gate `orders.view_*` chỉ mở cho
  đường ĐỌC, không mutator nào mang gate xem
- `backend/test/orders-detail-scope.db.integration.spec.ts` (mới) — phạm vi đọc chi tiết trên
  Postgres thật
- `backend/test/web-source-parses.spec.ts` (**mới — thêm ở bước review**) — mọi file nguồn `web/`
  phải parse được (đóng lỗ TD-1)

**Web**

- `web/src/design-system/session/orders-port.ts` (sửa) — `OrderLifecycleStep`,
  `OrderVersionItem`, `OrderVersionChange`, `getLifecycle`, `listVersions`, `OrderPortError.code`
- `web/src/design-system/session/fake-orders-port.ts` (sửa) — cài hai method
- `web/src/screens/orders/OrderDetailScreen.tsx` (mới)
- `web/src/screens/orders/order-detail.css` (mới)

**Mobile**

- `mobile/lib/design_system/shell/app_tabs.dart` (mới) — `AppTabs`, `AppTabItem`
- `mobile/lib/design_system/shell/shell.dart` (sửa) — export `app_tabs.dart`
- `mobile/lib/design_system/components/status_chip.dart` (sửa) — `statusKeyOf()` public
- `mobile/lib/design_system/components/components.dart` (sửa) — export `statusKeyOf`
- `mobile/lib/design_system/session/orders_port.dart` (sửa) — mirror type + 2 method +
  `OrderPortException.code`
- `mobile/lib/design_system/session/fake_orders_port.dart` (sửa) — cài hai method
- `mobile/lib/screens/orders/order_detail_screen.dart` (mới)
- `mobile/lib/screens/orders/order_list_screen.dart` (sửa) — xoá `_statusKeyOf` private, dùng bản
  design-system

**Test cross-platform**

- `design-system/screens/order-detail.test.mjs` (mới) — 16 test guard/parity
- `mobile/test/screens/orders/order_detail_screen_test.dart` (mới) — 7 widget test
- `mobile/test/design_system/app_tabs_test.dart` (mới) — 5 widget test

## Senior Developer Review (AI)

**Ngày:** 2026-07-18 · **Kết quả:** Approve sau khi tự vá 4 finding.

### 🔴 CRITICAL-1 — `OrderDetailScreen.tsx` KHÔNG PARSE ĐƯỢC; Task 5 đánh [x] nhưng màn web chết

`OrderDetailScreen.tsx:144` đặt comment JSX `{/* … */}` **giữa danh sách attribute** của
`<WebShell>`. Ở vị trí đó JSX chỉ nhận `{...spread}` ⇒ lỗi cú pháp `'...' expected`. Toàn bộ
file không compile: AC-1/2/3/7/12/13 phía **web** không có gì chạy được.

**Vì sao 4 lane vẫn xanh** — và đây mới là phần đáng sợ: web không có tsc/bundler (TD-1), nên
lane duy nhất nhìn file này là text-guard, mà nó đọc file như **chuỗi**. Nó thấy đủ `<Stepper>`,
đủ 18 nhãn, đủ `port.get(` ⇒ 16/16 test XANH cho một màn không tồn tại. `mobile` xanh thật vì
Flutter compile thật. Đây đúng lớp lỗi story tự cảnh báo ("web không có tsc, sai sẽ im lặng") —
chỉ là nó rơi trúng chính story này.

- **Đã vá:** đổi sang comment `//` (hợp lệ trong attribute list). File parse sạch.
- **Đã đóng đường lùi:** thêm `backend/test/web-source-parses.spec.ts` — parse **mọi**
  `web/src/**/*.{ts,tsx}` bằng compiler API và đòi 0 lỗi cú pháp. Guard sống ở lane backend vì
  đó là lane DUY NHẤT đã có TypeScript (`design-system/` cố ý không dependency); khuôn
  đọc-file-ngoài-backend đã có ở `permission-registry-fe-stub-parity.spec.ts`.
- **Đột biến bắt buộc (đã chạy):** trả lại comment `{/* … */}` ⇒ guard **ĐỎ**; khôi phục bằng
  `cp` ⇒ **XANH**. Không `git checkout` (code story chưa commit).

### 🟡 MEDIUM-1 — Hàng "Phạm vi" lệch giữa hai nền tảng, và web bỏ qua component có sẵn

Web tự gõ `<span className="scope-flag">` và **chỉ vẽ cờ đang BẬT**; mobile **không vẽ hàng
Phạm vi**. Repo đã có `ScopeFlag` (web) / `AppScopeFlag` (mobile) — `CreateQuoteScreen.tsx:565`
dùng đúng khuôn: vẽ **cả ba** cờ, cờ tắt gạch ngang. Chỉ vẽ cờ bật thì "Thi công tắt" và "màn
quên vẽ" nhìn giống hệt nhau, và nó vi phạm AD-13 (dựng từ DS, không tự gõ).

Parity-guard không bắt vì danh sách nhãn của nó không có `Phạm vi`/`Thiết bị`/`Thi công`/
`Vận chuyển` — guard chỉ canh được nhãn tác giả nghĩ tới.

- **Đã vá:** cả hai màn dùng component DS, vẽ đủ ba cờ. Thêm 4 nhãn vào danh sách parity và
  thêm `ScopeFlag`/`AppScopeFlag` vào assert "dựng từ DS" của `order-detail.test.mjs`.

### 🟡 MEDIUM-2 — File List thiếu 2 file đã ship

`backend/test/orders-read-gate.spec.ts` và `backend/test/orders-detail-scope.db.integration.spec.ts`
có trong git nhưng **không** có trong File List. Cả hai là test thật, có giá trị (guard
verb↔gate là thứ e2e không với tới) — vấn đề chỉ là sổ sách. **Đã vá:** bổ sung File List.

### 🟡 MEDIUM-3 — Số liệu Debug Log lệch thực tế

Ghi 67 suite/1138 test · 325 · 217; chạy lại ra 68/1142 · 327 · 219 (chênh đúng phần MEDIUM-2).
**Đã vá:** cập nhật, và ghi lại số sau review (69/1144 · 327 · 219).

### Đã kiểm, KHÔNG phải finding

- **`buocVongDoi()` đúng.** Loại `huy`/`moLai`/`tuChoiChietKhau` khỏi đồ thị phân loại là **bắt
  buộc**, không phải lệch tuỳ tiện: đã đọc lại `ALLOWED_TRANSITIONS` — bỏ ba cạnh đó thì đồ thị
  là DAG thật, giữ lại thì `moLai (dachot→baogia)` khiến đơn mới ở `baogia` khoe `dachot: done`.
  Bảng 16 dòng không bị đụng (AC-11 giữ nguyên). BFS không thể lặp vô hạn vì DAG.
- **`diffDong` không dính bẫy Decimal.** `OrderLineItem.qty` là `Int` trong schema ⇒ `!==` so số
  nguyên, không phải object Prisma.Decimal (so object sẽ báo "đổi SL" cho mọi dòng).
- **404 không phân biệt được với ngoài-phạm-vi** — e2e so cả `code` lẫn `message`, và fake
  `order.findFirst` áp chính mệnh đề phạm vi service gửi xuống nên không xanh giả.
- **`laBanHienLuc` theo con trỏ** — fixture cố tình trỏ `currentVersionId` vào bản **cũ**, đúng
  yêu cầu AD-6; cài theo `max(versionNo)` sẽ đỏ.
- **Migration sạch** — chỉ `ADD COLUMN` nullable + FK trên `order_versions`, không backfill,
  không đụng bảng khác. FK là hệ quả của relation mà chính story yêu cầu (khuôn `QuoteExport`).
- **Nợ kỹ thuật đã ghi ở Dev Notes** (đường GHI chưa scope, FR-7 vs engine thuộc 6.1, resolve
  quyền 2 lần, TD-1) — **không** mở lại thành finding mới, đúng thoả thuận trong story.

### Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-18 | Story 5.4 cài đặt: cột actor cho `OrderVersion` + migration; vá rò `GET /orders/:id` bằng đường đọc scoped dùng chung `findScopedOrThrow`; đổi gate 3 route đọc sang `RequireAnyPermissions(ordersViewAll, ordersViewOwn)`; thêm `buocVongDoi()` suy chuỗi bước TỪ `ALLOWED_TRANSITIONS`; thêm `GET /:id/vong-doi` + `GET /:id/phien-ban` với diff dòng tất định; màn chi tiết đơn trên web + mobile với stepper, 2 tab, lịch sử bản update; `AppTabs` mới cho mobile. 4 lane xanh (1138 + 72 + 325 + 217 test), 10 đột biến đều ĐỎ. |
| 2026-07-18 | Review tự vá: sửa comment JSX đặt sai chỗ làm `OrderDetailScreen.tsx` không parse (màn web chết trong khi 4 lane xanh); thêm guard parse toàn bộ nguồn `web/` ở lane backend để lỗi cú pháp không còn im lặng; hàng "Phạm vi" dựng bằng `ScopeFlag`/`AppScopeFlag` và vẽ đủ ba cờ trên cả hai nền tảng, parity-guard canh thêm 4 nhãn; bổ sung File List 2 file test thiếu; cập nhật số liệu 4 lane. |
| 2026-07-18 | Lệch có chủ đích khỏi thuật toán Task 3: loại cạnh quay lui (`moLai`, `tuChoiChietKhau`) khỏi đồ thị phân loại bước — thuật toán story mô tả đánh `dachot` là `done` cho đơn mới ở `baogia`. Bảng transition không đổi. |
