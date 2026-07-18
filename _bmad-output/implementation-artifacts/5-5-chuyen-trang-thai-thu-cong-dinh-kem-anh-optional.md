---
baseline_commit: 71c7c3cc61a46a3da54ae9eae92e1b7e184f8c09
---

# Story 5.5: Chuyển trạng thái thủ công + đính kèm ảnh optional

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người có quyền chuyển trạng thái**,
I want **chọn bước kế và đính kèm ảnh bằng chứng**,
so that **ghi nhận tiến trình có bằng chứng khi cần**.

---

## ⚠️ Đọc trước khi gõ dòng code đầu tiên

Ba sự thật quyết định story này. Bỏ qua một cái là làm lại từ đầu.

1. **Hạ tầng R2 ĐÃ CÓ ĐỦ.** `StoragePort` + `R2StorageAdapter` + `StorageModule` đã sống,
   `OrdersModule` **đã import** `StorageModule`, 4 biến env R2 đã có trong `.env.example`,
   `@aws-sdk/client-s3` đã trong `package.json`. **Không viết adapter mới. Không thêm env mới.**
   Khuôn "binary ở R2 + metadata ở DB" đã chạy thật ở `QuoteExport` — chép khuôn đó.
2. **Component upload ĐÃ CÓ ĐỦ trên CẢ HAI nền tảng.** `ImageUpload.tsx` (1.6) và
   `AppImageUpload` (1.7) đã ship, đã có nhãn `Thêm ảnh`/`Xoá ảnh`/`Chụp ảnh`/`Chọn từ thư viện`,
   đã bị guard cấm chạm mạng. **Không vẽ picker mới.** Màn chỉ nhận `File[]`/`XFile[]` từ `onAdd`
   rồi đưa cho port.
3. **`design-system/screens/order-detail.test.mjs:260-266` đang CẤM chuỗi `Chuyển trạng thái`
   xuất hiện trong hai màn chi tiết đơn.** Story 5.4 cố tình khoá như vậy vì nút dẫn tới màn chưa
   tồn tại. Story này là chủ sở hữu nút đó ⇒ **phải sửa guard**: bỏ `'Chuyển trạng thái'` khỏi
   danh sách cấm, để lại `'Huỷ đơn'` (5.7) và `'Share báo giá'`. Không sửa guard = lane
   `design-system` đỏ và không có cách nào ship.

---

## Acceptance Criteria

### AC gốc (nguyên văn từ epics)

1. **Given** màn Chuyển trạng thái, **When** người có quyền chọn bước kế, **Then** đi qua
   `applyTransition()` (guard + audit + event `StatusChanged`) (FR-9, AD-11).
2. **Given** một lần chuyển, **When** đính kèm, **Then** gắn ≥0 ảnh cho đúng bước
   (đơn, from→to, thời điểm), ảnh ghi vào Audit của bước; upload **luôn optional**
   (FR-23, UX-DR-25).
3. **Given** file ảnh, **When** lưu, **Then** binary ở R2, DB lưu metadata + object key (AD-3).

### AC bổ sung (dẫn xuất — bắt buộc để đóng story)

4. **Given** một đơn ở trạng thái bất kỳ, **When** gọi endpoint "bước kế tiếp", **Then** danh sách
   trả về **suy từ `ALLOWED_TRANSITIONS`** đã lọc theo trạng thái hiện tại **+ cờ phạm vi + quyền
   thực tế của actor**; không có bảng transition thứ hai ở bất kỳ đâu (AD-11, AD-2).
5. **Given** actor thiếu quyền cho bước đã chọn, **When** POST chuyển, **Then** 403 `FORBIDDEN`
   `'Bạn không có quyền thực hiện chuyển trạng thái này.'` và `Order.status` **không đổi**.
6. **Given** bước không thuộc phạm vi đơn, **When** POST chuyển, **Then** 409 `CONFLICT`
   `'Bước này không thuộc phạm vi của đơn.'`; **Given** event không có trong bảng từ trạng thái
   hiện tại (kể cả ca **bấm hai lần**, đơn đã ở đích), **Then** 409 `CONFLICT`
   `'Không chuyển được trạng thái đơn từ trạng thái hiện tại.'` — **KHÔNG** no-op im lặng.
7. **Given** một lần chuyển kèm N ảnh, **When** transition bị từ chối (403/409), **Then**
   **không** hàng `Attachment` nào được tạo và `Order.status` giữ nguyên.
8. **Given** ảnh đã lưu, **When** đọc lại qua endpoint proxy, **Then** bytes trả về sau JWT +
   permission guard + **phạm vi đơn**; bucket không public. **Chọn PROXY, không signed URL** —
   AD-3 (`ARCHITECTURE-SPINE.md:64`) cho phép **cả hai** ("signed URL hoặc proxy"); tiền lệ
   `@Get(':id/bao-gia/anh')` + `StoragePort` (chỉ `putObject`/`getObject`, không sinh signed URL)
   đã chốt proxy cho repo này.
9. **Given** file không phải ảnh hoặc quá lớn, **When** upload, **Then** 400 `VALIDATION_ERROR`
   với envelope chuẩn; transition **không** chạy.
10. **Given** hai nền tảng, **When** render màn Chuyển trạng thái, **Then** nhãn tiếng Việt
    **byte-for-byte giống nhau** và pass parity guard (UX-DR-27).
11. **Given** actor không còn bước nào hợp lệ, **When** mở chi tiết đơn, **Then** nút
    `Chuyển trạng thái` **ẩn hẳn** (không xám) (UX-DR-22).
12. **Given** `ALLOWED_TRANSITIONS` 16 dòng, **When** story này xong, **Then** bảng vẫn **đúng 16
    dòng, không thêm/sửa/xoá dòng nào**, và `no-order-status-write-outside-transition.spec.ts`
    vẫn xanh **không cần nới allow-list**.
13. **Given** endpoint chuyển trạng thái thủ công, **When** nhận event `chot` / `mo_lai` / `huy` /
    `du_coc` / `ap_chiet_khau`, **Then** 409 `CONFLICT` và `Order.status` **không đổi** — năm sự
    kiện đó có cửa riêng với logic riêng (snapshot giá, lý do huỷ, lane auto); đi tắt qua đây là
    bỏ qua toàn bộ phần đó.

---

## Tasks / Subtasks

### Task 1 — Model `Attachment` + migration (AC: 2, 3, 7)

- [x] Thêm model vào `backend/prisma/schema.prisma`, bảng `attachments` (snake_case số nhiều),
      chép khuôn `QuoteExport` (`schema.prisma:482-500`) về `@map`/`@@index`:
  - `id` **`String @id @default(uuid())`** — toàn schema dùng `uuid()`, **không có `cuid()`** ở đâu cả
  - `orderId` → relation `Order`, `uploadedByAccountId` → relation `Account`
  - `objectKey` (unique), `fileName`, `contentType`, `size` (Int, bytes)
  - **Toạ độ bước — đúng bốn toạ độ FR-23:** `statusFrom String?`, `statusTo String?`,
    `occurredAt DateTime?` (nullable **có chủ đích**: 5.6 sẽ thêm ảnh bổ sung *ngoài* luồng
    chuyển trạng thái, ba cột này để `null`)
  - `createdAt DateTime @default(now())`
  - `@@index([orderId])`, `@@index([orderId, occurredAt])`
- [x] Migration: `npx prisma migrate diff --from-schema <cũ> --to-schema <mới>` →
      ⚠️ Prisma 7 **chỉ nhận `--from-schema`/`--to-schema`**, cờ `--from-schema-datamodel` trong
      tài liệu cũ đã bỏ.
- [x] `npx prisma generate`.

**Không thêm** cột `deletedAt`, `note`, `thumbnailKey` — 5.6 mới quyết chuyện xoá/gallery.

### Task 2 — Hàm domain "bước kế tiếp" (AC: 4, 11)

- [x] Thêm vào `backend/src/orders/domain/allowed-transition.ts` một hàm **thuần**:
      `buocKeTiep(status, scopeFlags, actorPermissions) → ReadonlyArray<{event, to, requires}>`
      — lọc `ALLOWED_TRANSITIONS` theo `from === status`, scope guard thoả, và
      `actorPermissions.has(rule.requires)`.
- [x] 🚨 **Whitelist sự kiện của lane THỦ CÔNG — bắt buộc, lọc TRƯỚC mọi thứ khác:**
      `[bat_dau_thi_cong, xong_thi_cong, bat_dau_giao, xong_giao, hoan_thanh]`.
      Lọc `from === status` **trần** sẽ lòi ra `chot`, `mo_lai`, `huy`, `ap_chiet_khau`, `du_coc`
      — **năm sự kiện đó có cửa riêng và logic riêng**, đi qua endpoint 5.5 là **bỏ qua** toàn bộ
      phần logic đó:
  - `chot` → `/:id/chot` snapshot giá + đóng băng VAT + đẻ version (`orders.service.ts:1017-1060`).
    Chuyển bằng `applyTransition` trần ⇒ đơn `dachot` mà **giá vẫn trôi theo danh mục**. Hỏng dữ liệu.
  - `mo_lai` → `/:id/mo-lai`; `ap_chiet_khau` → `/:id/ap-chiet-khau`
  - `huy` → **Story 5.7** (bắt buộc lý do + giải phóng `reserved`)
  - `du_coc` → lane **AUTO** (5.2, sự kiện thanh toán), không phải nút người bấm
- [x] Đặt whitelist thành hằng có tên trong cùng file, cạnh bảng — để người đọc bảng thấy ngay.
- [x] ⚠️ **ĐỌC bảng, KHÔNG chép bảng.** Đây là điều kiện AD-11. `buocVongDoi()` (5.4) là tiền lệ
      đúng — đặt hàm mới ngay cạnh nó, cùng file.
- [x] **Không** dùng `daTaiDich()`: file này có comment cảnh báo tại `:249-250` rằng lane thủ công
      phải báo lỗi khi đã ở đích, không no-op như lane auto.

### Task 3 — Đường ghi: service + endpoint chuyển trạng thái thủ công (AC: 1, 2, 3, 5, 6, 7, 9)

- [x] `OrdersService`: thêm method **công khai** cho lane thủ công (engine `applyTransition` là
      `private`, giữ nguyên như vậy). **KHÔNG** tái dùng `chuyenTrangThaiTuDong()` — lane đó
      idempotent no-op khi đã ở đích, trái AC-6.
- [x] **Thứ tự bắt buộc** (khác `quote-export.service.ts`, đọc kỹ):
  1. Load đơn qua **`findScopedOrThrow(callerAccountId, quyen, id)`** (`orders.service.ts:659`)
     + resolve quyền tươi qua `quyenCuaNguoiGoi()`.
     ⚠️ **KHÔNG dùng `get()`** — docstring của nó (`orders.service.ts:641`) ghi rõ:
     *"KHÔNG scope — đường đọc NỘI BỘ, chỉ còn `QuoteExportService` dùng. Mọi đường HTTP đọc đơn
     theo id phải đi qua `getScoped()`."*
  2. **Chặn event ngoài whitelist** (Task 2) → 409 `CONFLICT`
     `'Bước này không chuyển được ở màn Chuyển trạng thái.'` — kiểm **trước** `evaluateTransition()`.
  3. **Pre-check thuần** bằng `evaluateTransition()` — reject 403/409 **trước khi** chạm R2.
     Đây **không** phải lớp bảo mật thứ hai; engine trong transaction vẫn là quyền lực cuối.
     Mục đích duy nhất: không trả tiền bytes cho request sẽ bị từ chối.
  4. Validate file (Task 4).
  5. `putObject()` lên R2 cho từng ảnh.
  6. `$transaction`: `applyTransition(...)` → `tx.attachment.createMany(...)` với
     `occurredAt` = **đúng biến `Date` đã truyền vào `applyTransition`** (một `new Date()` cho
     cả lượt, theo khuôn `confirm()` `orders.service.ts:1017-1030`).
  7. Publish `StatusChanged` **sau commit** (AD-18) — `AuditSubscriber` ghi audit.
- [x] Sentinel: bắt bằng **so sánh identity** `if (error !== SENTINEL) throw error`, y như `confirm()`.
- [x] Controller `backend/src/orders/orders.controller.ts`:
      `@Post(':id/chuyen-trang-thai')` + `@HttpCode(HttpStatus.OK)` (kỷ luật của file: transition
      trên resource có sẵn **không** trả 201). Khai báo **sau** mọi route tĩnh.
- [x] Gate cửa: `@RequireAnyPermissions(PERM.constructionTransition, PERM.deliveryConfirm,
      PERM.paymentsRecord)` — **đúng ba key** mà whitelist Task 2 cần (`paymentsRecord` cho dòng
      `dachot → hoanthanh` gate cờ `thietBi`). ⚠️ **KHÔNG** liệt `quotesCreateEdit`/`ordersConfirm`:
      đó là key của `chot`/`mo_lai`/`huy` — những sự kiện endpoint này **từ chối**; mở cửa cho chúng
      là mời đúng cái ca hỏng dữ liệu mà whitelist vừa chặn.
      Gate thật vẫn là engine (hai lớp, đúng docstring `orders.controller.ts:93-96`).
- [x] Actor permissions lấy qua helper có sẵn `quyenCuaNguoiGoi(accountId)` —
      ⚠️ guard `no-fabricated-actor-permissions.spec.ts` bắt đỏ nếu call-site tự dựng
      `new Set([PERM.x])`.
- [x] Mở rộng response của `GET /orders/:id/vong-doi` (5.4) thêm mảng `buocKeTiep` — **không** đẻ
      route mới cho việc này; FE đã gọi endpoint đó ở màn chi tiết.
- [x] Endpoint đọc bytes: `@Get(':id/anh/:attachmentId')` → `StreamableFile`, gate
      `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`.
      Chép **shape** của `@Get(':id/bao-gia/anh')` (`orders.controller.ts:670`) — decorator
      `@ApiProduces`/`@ApiOkResponse` binary, `new StreamableFile(...)`.
      ⚠️ **KHÔNG chép call-site của nó**: route đó **không** scope (`getExportFile(id, …)` không
      nhận caller). Route mới phải `findScopedOrThrow` **trước khi** chạm R2.
- [x] Cả 2 route mới phải mang decorator quyền — `no-handler-without-require-permissions.spec.ts`
      quét `src/` và bắt đỏ handler trần.
- [x] `npm run openapi:gen` + commit `backend/openapi/openapi.json` — `openapi-drift.spec.ts` so
      **byte-for-byte**, quên là đỏ.

### Task 4 — Transport upload + giới hạn (AC: 3, 9)

- [x] Nhận `multipart/form-data` bằng `FilesInterceptor` (`@nestjs/platform-express`, multer có sẵn
      transitively). Nếu typecheck kêu thiếu type: thêm `@types/multer` devDependency.
- [x] `memoryStorage` + limits ở interceptor. **Giới hạn chốt ở story này** (tài liệu bỏ ngỏ, xem
      "Câu hỏi đã tự quyết" #4):
  - tối đa **10 ảnh** / lượt chuyển
  - tối đa **10 MB** / ảnh
  - mime allow-list: `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- [x] Vi phạm → `AppException(VALIDATION_ERROR, 400, …)` với `fieldErrors`; service ném,
      `AllExceptionsFilter` dựng envelope (AD-5) — **controller không tự nặn envelope**
      (`no-controller-error-envelope.spec.ts`).
- [x] Object key: `attachments/${orderId}/${attachmentId}.${ext}` — soi khuôn
      `quotes/${orderId}/bao-gia.png`. `ext` suy từ **allow-list mime**, không tin đuôi file client gửi.

### Task 5 — Web: màn `s-status-change` (AC: 1, 2, 10, 11)

- [x] File mới `web/src/screens/orders/OrderStatusChangeScreen.tsx` +
      `web/src/screens/orders/order-status-change.css` (screen PascalCase, css kebab-case —
      khuôn `OrderDetailScreen.tsx`/`order-detail.css`).
      **Màn riêng, KHÔNG Dialog** — xem "Câu hỏi đã tự quyết" #6.
- [x] Dựng từ DS có sẵn: `Frame`, `Button`, `ImageUpload`, `ErrorState`, `Skeleton`, `StatusChip`.
      **Không** vẽ component mới trong screen (AD-13).
- [x] `ImageUpload` chỉ trả `File[]` qua `onAdd`; màn giữ **hai** state: `File[]` để gửi, và
      `ImageUploadItem[]` (`{id, url?, name?}`, id tạm + `url` preview) để component vẽ thumbnail.
      **Màn không** gọi R2.
      ⚠️ Guard `behavior-components.test.mjs:140-156` chỉ canh **component** `ImageUpload.tsx`,
      **không** canh screen ⇒ lệnh cấm `fetch(`/`R2` cho màn mới phải do `order-transition.test.mjs`
      (Task 7) tự dựng.
- [x] `OrderDetailScreen.tsx`: thêm nút `Chuyển trạng thái` + prop `onChangeStatus?`.
      Nút **hiện khi `buocKeTiep` từ backend không rỗng**, ẩn hẳn khi rỗng — **không** tự tính quyền
      ở client (AD-2/AD-4; backend đã lọc theo quyền thật).
- [x] Port: thêm method vào `web/src/design-system/session/orders-port.ts` +
      `fake-orders-port.ts` (mirror contract backend, AD-12 — không bịa field).

### Task 6 — Mobile: màn tương đương (AC: 1, 2, 10, 11)

- [x] File mới `mobile/lib/screens/orders/order_status_change_screen.dart`.
- [x] Dùng `AppFrame`, `AppButton`, `AppImageUpload` (`onAdd: ValueChanged<List<XFile>>`,
      `pick` injectable để widget test chạy không cần platform channel), `AppErrorState`,
      `AppSkeleton`, `AppStatusChip`.
- [x] Cùng luật hai state như web: `List<XFile>` để gửi + `List<AppUploadItem>`
      (`{id, path?, name}`) để vẽ thumbnail.
- [x] `order_detail_screen.dart`: nút + callback `onChangeStatus`, cùng luật ẩn/hiện như web.
- [x] Port Dart: `orders_port.dart` + `fake_orders_port.dart` mirror y hệt web.
- [x] ⚠️ `AppImageUpload` tự mở `AppSheet` ⇒ nếu màn này là Dialog thì chồng **2 tầng overlay**,
      vi phạm UX-DR-20. Đây chính là lý do chọn màn riêng.
- [x] `dart format -o none` — cờ `--set-exit-if-changed` **vẫn ghi đè file**, lan ra ~20 file.

### Task 7 — Nhãn + guard parity (AC: 10, 11)

Bộ nhãn chốt, **byte-for-byte hai nền tảng**:

| Vị trí | Nhãn |
|---|---|
| Nút trong chi tiết đơn + tiêu đề màn | `Chuyển trạng thái` |
| Khối chọn bước | `Bước kế tiếp` |
| Khối ảnh | `Ảnh bằng chứng (không bắt buộc)` |
| Nút xác nhận | `Xác nhận chuyển` |
| Nút quay lại | `Huỷ` |
| Không còn bước hợp lệ | `Không có bước nào để chuyển.` |
| Lỗi | `Không chuyển được trạng thái.` + `Thử lại` |

Tái dùng nguyên trạng (đã sống trong DS): `Thêm ảnh`, `Xoá ảnh`, `Chụp ảnh`, `Chọn từ thư viện`.
Nhãn trạng thái lấy từ `STATUS_LABELS`/`kStatusLabels` — **không** đẻ bảng nhãn thứ ba.

- [x] **Sửa** `design-system/screens/order-detail.test.mjs:260-266`: bỏ **phần tử**
      `'Chuyển trạng thái'` khỏi mảng ở `:262`; giữ `'Huỷ đơn'`, `'Share báo giá'`.
      ⚠️ **KHÔNG xoá test** — file có 19 test, chỉ sửa một phần tử mảng.
- [x] **Thêm** `design-system/screens/order-transition.test.mjs`, dựng theo khuôn
      `order-detail.test.mjs`: byte-parity nhãn, cấm literal quyền
      (`/['"][a-z_]+\.[a-z_]+['"]/`), cấm literal khoá trạng thái
      (`['thicong','nghiemthu','danggiao','dagiao','dacoc','hoanthanh']`), cấm `fetch(`/`R2` trong screen.
- [x] **Thêm** test "Story 5.5 surface trên CẢ HAI nền tảng" vào `design-system/session/parity.test.mjs`.
- [x] **KHÔNG thêm permission key mới.** 21 key hiện có đã đủ. Thêm key ⇒ phải regen **hai** nơi
      (`npm run permissions:gen` ở backend **và** `npm run build:permissions` ở design-system) và
      guard `deepEqual` PERM↔AppPerm đỏ nếu lệch thứ tự.

### Task 8 — Test (AC: tất cả)

**Backend hermetic** — `backend/test/*.spec.ts`, chạy `cd backend && npm test`:
- [x] `buocKeTiep()`: lọc đúng theo status × scope flag × quyền; đơn không cờ Thi công **không**
      thấy `bat_dau_thi_cong`; actor thiếu `construction.transition` **không** thấy bước đó.
- [x] Từ chối 403 (thiếu quyền) / 409 scope / 409 not_in_table — **và** ca bấm hai lần (đã ở đích)
      phải 409, không 200 (AC-6).
- [x] **Whitelist:** POST event `chot` / `mo_lai` / `huy` / `du_coc` / `ap_chiet_khau` qua endpoint
      5.5 → **409**, `Order.status` **không đổi**. Đây là test chặn ca hỏng dữ liệu nặng nhất của story.
- [x] `buocKeTiep()` **không bao giờ** trả năm event đó, ở bất kỳ trạng thái nào.
- [x] AC-7: transition bị từ chối ⇒ `attachment.createMany` **không** được gọi.
- [x] Validate file: quá 10 ảnh, quá 10 MB, mime ngoài allow-list → 400 + `fieldErrors`.
- [x] `occurredAt` của `Attachment` **bằng đúng** `occurredAt` của `StatusChanged` (khoá join sang
      audit row — xem "Câu hỏi đã tự quyết" #2).

**Backend DB lane** — `backend/test/*.db.integration.spec.ts`, chạy `cd backend && npm run test:db`:
- [ ] Round-trip thật trên Postgres: transition + 2 ảnh → 1 hàng `audit_logs`, 2 hàng `attachments`
      cùng `occurred_at`, `Order.status` đúng đích.
- [ ] **Join thật** (đây là thứ chứng minh FR-23 "ảnh ghi vào Audit của bước", không phải một cột
      trùng số): `attachment.occurredAt` + `orderId` khớp **đúng một** hàng `audit_logs` có
      `targetId = orderId` và `eventType = 'StatusChanged'`.
- [ ] Endpoint đọc bytes: actor ngoài phạm vi đơn → 404/403, **không** rò bytes.
- [ ] ⚠️ Lane này cần Docker Desktop chạy sẵn. `open -a Docker` từ shell agent **không** tạo được
      socket — nếu daemon chưa lên, **viết test rồi báo lane chưa chạy**, đừng giả xanh.

**Mobile** — `cd mobile && flutter test` (+ `flutter analyze`):
- [x] Đây là lane **hành vi** thật của story (web chỉ có text-guard, TD-1). Bắt buộc widget test:
      render danh sách bước kế, chọn bước, thêm/xoá ảnh qua `pick` inject, submit gọi port đúng
      tham số, state lỗi hiện `Thử lại`, danh sách rỗng hiện `Không có bước nào để chuyển.`
- [x] Thu `tester.view.physicalSize` về bề ngang điện thoại để bắt `RenderFlex overflowed`.
- [x] Guard `mounted` trước mọi `setState` sau await (bài học 5.4).

**Design-system** — `cd design-system && npm test`.
**Web syntax** — `cd backend && npx jest web-source-parses`: ⚠️ lane DUY NHẤT chứng minh file
`.tsx` parse được. 5.4 từng ship một màn web chết vì comment JSX đặt sai mà **cả bốn lane vẫn xanh**.

**Đột biến (bắt buộc, không phải tuỳ chọn):**
- [x] Đảo pre-check thành luôn-pass → test AC-5/AC-6 phải **đỏ**.
- [x] Bỏ `occurredAt` khỏi `createMany` → test khoá join phải **đỏ**.
- [x] Đổi allow-list mime thành nhận tất → test AC-9 phải **đỏ**.
- [x] Đột biến **phải compile được**, nếu không nó làm đỏ mọi suite và chứng minh số 0.
- [x] Hoàn tác bằng `cp` sao lưu — **tuyệt đối không `git checkout`**, code story chưa commit.

---

## Dev Notes

### Hiện trạng file bị SỬA (đọc trước khi đổi)

| File | Hiện làm gì | Story này đổi gì | Phải giữ nguyên |
|---|---|---|---|
| `backend/src/orders/domain/allowed-transition.ts` | `ALLOWED_TRANSITIONS` 16 dòng + `evaluateTransition` + `daTaiDich` + `buocVongDoi` (5.4) | **Thêm** `buocKeTiep()` | ⚠️ **BẢNG 16 DÒNG — KHÔNG THÊM/SỬA/XOÁ DÒNG NÀO** (AC-12); thứ tự eval `not_in_table → scope → permission` là **quyết định bảo mật**, không đảo |
| `backend/src/orders/orders.service.ts` | `applyTransition` **private** `:402-456`; `chuyenTrangThaiTuDong` `:487`; `get()` `:644` **KHÔNG scope** (nội bộ, chỉ `QuoteExportService` dùng); đường scoped là `findScopedOrThrow` `:659` / `getScoped` `:687` | +1 method công khai lane thủ công | `applyTransition` (chữ ký + thứ tự lock→updateMany→sentinel); `chuyenTrangThaiTuDong`; mọi hàm ghi có sẵn |
| `backend/src/orders/orders.controller.ts` | 19 route; helper `quyenCuaNguoiGoi` `:97-101` | +2 route (`chuyen-trang-thai`, `anh/:attachmentId`); mở rộng response `vong-doi` | **19 route cũ + gate của chúng**; kỷ luật route tĩnh trước `:id`; không dựng envelope trong controller |
| `backend/prisma/schema.prisma` | 18 model, chưa có `Attachment` | **+1 model** `Attachment` | Mọi model/`@map`/`@@unique` có sẵn |
| `web/.../OrderDetailScreen.tsx` · `mobile/.../order_detail_screen.dart` | 5.4: stepper + 2 tab, **0 nút hành động** | +1 nút + prop callback | Stepper đọc từ backend; chip read-only; 2 tab; 4 state loading/error/404/empty |
| `design-system/screens/order-detail.test.mjs` | 19 test; test `:260-266` cấm 3 chuỗi nút | Bỏ **phần tử** `'Chuyển trạng thái'` khỏi mảng `:262` — không xoá test | 19 test; `'Huỷ đơn'`, `'Share báo giá'` vẫn cấm |
| `web/.../orders-port.ts` · `mobile/.../orders_port.dart` | 17 method (5.4) | +2 method, +2 type | 17 method cũ + hằng status |

### Bất biến không được vi phạm

- **AD-11:** `ALLOWED_TRANSITIONS` là hợp đồng **duy nhất**; `buocKeTiep()` **đọc** nó, không chép.
  `applyTransition()` là **con đường duy nhất** ghi `Order.status` —
  `no-order-status-write-outside-transition.spec.ts` (allow-list `applyTransition|*`, `create|create`)
  phải xanh **không cần nới**.
- **AD-3:** bucket **không public**. Luật gốc (`ARCHITECTURE-SPINE.md:64`) cho phép
  "signed URL **hoặc** proxy" — repo này đã chọn **proxy** (`StoragePort` không có API sinh signed
  URL; `@Get(':id/bao-gia/anh')` là tiền lệ đang chạy). Đi theo proxy; đừng "sửa cho khớp" sơ đồ
  deployment trong spine, chỗ đó vẽ `signed URL PUT` nhưng code mới hơn.
- **AD-18:** producer **không** gọi audit/FCM trực tiếp. Publish `StatusChanged` sau commit;
  `AuditSubscriber` ghi. `audit_logs` **append-only** (`audit-log-append-only.spec.ts`).
- **AD-5:** envelope lỗi chỉ do `AllExceptionsFilter` dựng; service ném `AppException`.
- **AD-4/AD-15:** phạm vi server-side, phân giải off đúng hai trường `ownerAccountId`/
  `assigneeAccountId`. Ẩn nút ở client chỉ là UX.
- **AD-17:** literal quyền chỉ ở `permission-registry.ts` — story này **không thêm key mới**.
- **AD-2:** client **không** chứa business logic ⇒ danh sách bước kế do **backend** suy.
- **AD-13:** dựng từ component DS có sẵn; thiếu widget thì thêm vào design-system, không vẽ trong screen.
- **AD-12:** contract từ backend → regen OpenAPI → FE mirror. Không bịa field ở FE.

### Học từ story trước (5.4 / 5.3 / 5.2 / 5.1)

- **5.4** ship một màn web **không parse được** mà cả bốn lane vẫn xanh — review mới bắt.
  ⇒ chạy `npx jest web-source-parses` trước khi đánh `[x]` bất kỳ task web nào.
- **5.4** cũng bị bắt vì bỏ qua component DS có sẵn (`ScopeFlag`) rồi tự vẽ lại.
  ⇒ ở story này rủi ro tương đương nằm ở `ImageUpload`/`AppImageUpload`. **Đừng vẽ lại.**
- **5.1** sa lầy vì Dev Notes chép sai khoá trạng thái so với spine gốc. **Code
  `allowed-transition.ts` là chân lý**; tài liệu là mô tả ý định.
- **5.3** review bắt HIGH vì gate chỉ đóng ở **một** call-site. Ở đây tương ứng: phạm vi đơn phải
  nằm trong **đường đọc dùng chung** đã scope, để endpoint đọc ảnh **không thể quên**.
- **5.2/5.3:** đột biến **phải compile được**; mutant không compile chứng minh số 0.
- Mobile screen **phải có widget test** — text-guard không "nhìn" thấy màn không render được.
- `dart format -o none`; **không `git checkout`** để hoàn tác đột biến.

### Nợ kỹ thuật ghi nhận, KHÔNG sửa ở story này

1. **Đường GHI vẫn chưa scope.** `findOrThrow(id)` unscoped vẫn phục vụ `PATCH /:id`, `chot`,
   `mo-lai`, `line-items`… (nợ ghi từ 5.4). Endpoint mới của story này **đi đường đọc đã scope**,
   nhưng không vá 6+ mutator cũ. Ghi ở đây để review **không mở lại như finding mới**.
2. **Object mồ côi trên R2.** Ảnh upload ở bước 4 rồi transition bị từ chối ở bước 5 (đua giữa
   pre-check và re-eval dưới row lock) ⇒ bytes nằm lại R2 **không có hàng DB nào trỏ tới** ⇒
   vô hình với mọi endpoint. Chấp nhận: `StoragePort` **chưa có** `deleteObject`, và 5.6 (xoá ảnh)
   mới là chỗ đúng để thêm. Cửa sổ đua rất hẹp vì pre-check đã chặn hầu hết ca.
3. **Không sniff magic-byte / không quét virus.** Chỉ validate mime khai báo + size. Bucket không
   public, mọi byte ra vào đều sau JWT + permission + phạm vi đơn ⇒ bán kính nổ nhỏ.
   Tài liệu bỏ ngỏ hoàn toàn chuyện này (spine `#Deferred`).
4. **`dacoc → dagiao` không có trong bảng** (ca "cờ Vận chuyển TẮT, khách tự tới lấy" của FR-7).
   Chủ sở hữu là `epics.md#Story 6.1`. Màn này **vẽ đúng engine**; khi 6.1 thêm cạnh,
   `buocKeTiep()` tự hiện bước mới vì nó đọc thẳng bảng.
5. **Web không có tsc/bundler/JSDOM (TD-1).** Assert hành vi dồn vào lane `flutter test`.
6. **`GET /orders/:id` resolve quyền hai lần/request** — đúng khuôn 18 route hiện có, gộp lại là
   thay đổi cross-cutting, story riêng.

### Project Structure Notes

- Backend: mọi thứ ở `backend/src/orders/` — DTO trong `orders/dto/`, domain **thuần** trong
  `orders/domain/` (`buocKeTiep` vào `allowed-transition.ts`). Test backend **phẳng** trong `backend/test/`.
- ⚠️ **Lệch spine CÓ CHỦ ĐÍCH:** `ARCHITECTURE-SPINE.md:444,469` map FR-23/FR-24 vào module
  `attachments/`. Story này để trong `orders/` vì transition + attachment là **MỘT `$transaction`**
  và `applyTransition` là `private` của `OrdersService` — tách module buộc phải nới nó thành public,
  phá AD-11. Story 5.6 (gallery/xoá, **không** đụng transition) là chỗ đúng để tách `attachments/`
  nếu Đại Ca muốn. Ghi ở đây để review không mở lại như finding mới.
- Hai lane test tách bằng **hậu tố tên file**: hermetic `*.spec.ts` vs DB `*.db.integration.spec.ts`
  (`testPathIgnorePatterns`). `describe.skip` **không** tách được lane.
- Web: screen ở `web/src/screens/orders/`, CSS cùng thư mục. Text-guard ở **repo root**
  `design-system/screens/*.test.mjs`, **không** ở `web/`.
- Mobile: screen ở `mobile/lib/screens/orders/`, test ở `mobile/test/screens/orders/`.
- File/route kebab-case; entity PascalCase; bảng snake_case số nhiều; ngày ISO-8601 UTC.
  `naming-convention.spec.ts` canh tên file `src/` kebab-case theo từng đoạn dấu chấm.
- Token/icon design-system là **generated** — sửa SSOT rồi `cd design-system && npm run build`.
- ⚠️ `.gitignore` có mục `assets/` từng nuốt file mới. Sinh file ở thư mục lạ thì chạy
  `git check-ignore -v <file>` trước khi tin là đã commit.
- Guard text đọc file **dạng chuỗi** ⇒ tránh viết chuỗi bị cấm (`shadow`, `gradient`, `box-shadow:`,
  `.toUpperCase()`) **kể cả trong comment**.

### Câu hỏi đã tự quyết (nêu để Đại Ca phủ quyết nếu muốn)

1. **`Attachment` tạo ở 5.5, không đợi 5.6.** `epics.md#Story 5.6` gắn entity `Attachment` cho 5.6,
   nhưng AC-3 của 5.5 đòi lưu metadata + object key ⇒ phải có bảng ngay. Chốt: 5.5 tạo bảng **tối
   thiểu** với ba cột toạ độ bước **nullable**; 5.6 thêm bề mặt gallery/xoá. Không phải scope creep,
   là thứ tự bắt buộc.
2. **Ảnh nối vào Audit bằng khoá `(orderId, occurredAt)`, không bằng FK tới `audit_logs`.**
   Lý do: `AuditService.record()` trả `void` và audit row do **subscriber** ghi **sau commit**
   (AD-18) ⇒ call-site không có id audit để làm FK. Mà FR-23 định nghĩa ràng buộc đúng bằng bốn
   toạ độ *(đơn, từ→đến, thời điểm)* — nên lưu đúng bốn toạ độ đó là khớp spec, không phải mẹo.
   `applyTransition` dùng **một** biến `Date` cho cả lượt nên hai bên trùng khít.
   Phương án đã loại: nhét mảng ảnh vào `OrderSnapshot` (bẩn mọi order event); đổi `record()` trả id
   (phá hợp đồng append-only đang được guard).
3. **Pre-check `evaluateTransition()` trước khi upload.** Không có nó thì người thiếu quyền vẫn ghi
   được bytes lên bucket của mình rồi mới ăn 403. Engine dưới row lock vẫn là quyền lực cuối —
   pre-check thuần, không ghi gì.
4. **Giới hạn upload: 10 ảnh × 10 MB, mime `jpeg|png|webp|heic`.** Spine `#Deferred` và PRD
   open-question đều **bỏ ngỏ** và đẩy về implementation. Chọn số cụ thể còn hơn để dev đoán.
   `heic` có mặt vì iPhone chụp mặc định ra định dạng đó.
5. **Bấm hai lần → 409, không no-op.** `allowed-transition.ts:249-250` đã viết sẵn cảnh báo rằng
   lane thủ công cần báo lỗi. Nuốt im lặng thì người dùng không biết lần bấm nào ăn.
6. **Màn riêng `s-status-change`, KHÔNG Dialog.** UX-DR-20 muốn Dialog cho hành động hệ trọng,
   nhưng `AppImageUpload` tự mở `AppSheet` ⇒ Dialog + Sheet = **hai tầng overlay**, mà UX-DR-20
   cũng nói overlay chồng **tối đa một tầng**. `EXPERIENCE.md` vốn đã liệt màn này là một screen
   (`s-status-change`) trong bảng inventory. Màn riêng gỡ luôn mâu thuẫn.
7. **Nút hiện/ẩn theo `buocKeTiep` rỗng hay không, không theo phép tính quyền ở client.**
   Bước kế đòi các key **khác nhau** tuỳ nhánh (`construction.transition` / `delivery.confirm` /
   `payments.record`); dựng biểu thức any-of ở client là bản sao luật thứ ba và nó sẽ lệch.
8. **Không thêm permission key `attachments.*`.** Ảnh là hệ quả của bước chuyển ⇒ ai chuyển được
   bước thì đính kèm được ảnh của bước đó. Bộ 21 key giữ nguyên (tiền lệ 5.1).
9. **`buocKeTiep` gắn vào response `/vong-doi` sẵn có, không đẻ route mới.** Màn chi tiết đã gọi
   endpoint đó; thêm route thứ hai là thêm một request cho cùng một câu hỏi.
10. **Endpoint thủ công chỉ nhận 5 event, không phải "mọi transition hợp lệ".** Đọc AC gốc dễ
    tưởng màn này mở mọi bước mà bảng cho phép. Không được: `chot` đi kèm snapshot giá + đóng băng
    VAT + đẻ version; `huy` đi kèm lý do + giải phóng `reserved` (5.7); `du_coc` là lane auto.
    Cho chúng đi qua `applyTransition` trần là **đổi status mà bỏ hết phần còn lại** — đơn `dachot`
    có giá vẫn trôi theo danh mục. Nếu Đại Ca muốn gộp, đó là story tái cấu trúc bốn endpoint kia,
    không phải story này.
11. **5.5 ship endpoint đọc bytes theo id, nhưng KHÔNG ship gallery.** Không có đường đọc thì ảnh
    vừa lưu là tính năng chết. Gallery/danh sách/xoá + "ai tải, lúc nào" là **FR-24 → Story 5.6**.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.5` L511-516 — AC 1-3 nguyên văn]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.6` L518-523 — ranh giới FR-24, phần KHÔNG thuộc 5.5]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#4.10` — FR-23 nguyên văn: "≥0 ảnh", "đúng bước (đơn, từ→đến, thời điểm)", "luôn tuỳ chọn"; FR-24 thuộc 5.6]
- [Source: `.../prd.md#FR-9` — "Chỉ Account có Quyền tương ứng mới chuyển được bước đó"; "Mọi chuyển trạng thái ghi Audit log (ai, khi nào, từ→đến)"]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-3` L64 — "binary lưu R2… DB chỉ lưu metadata + object key. Upload/đọc qua backend (**signed URL hoặc proxy**); không public bucket" ⇒ AD-3 cho phép cả hai, repo chọn proxy]
- [Source: `.../ARCHITECTURE-SPINE.md:444,469` — spine map FR-23/FR-24 → module `attachments/`; story này lệch có chủ đích, xem Project Structure Notes]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-11` — "MỘT hàm transition DUY NHẤT… con đường code DUY NHẤT ghi `Order.status`"]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-7` — vòng đời gate theo 3 cờ Thiết bị/Thi công/Vận chuyển]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-5` — envelope `{code, message, fieldErrors?, traceId}`, filter trung tâm là nơi DUY NHẤT dựng]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-18` — publish qua EventBus; producer KHÔNG gọi audit trực tiếp]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-15` — phạm vi phân giải off `ownerAccountId`/`assigneeAccountId`]
- [Source: `.../ARCHITECTURE-SPINE.md#Consistency Conventions` — "action nghiệp vụ là sub-resource POST (`/orders/{id}/chot`)"]
- [Source: `.../ARCHITECTURE-SPINE.md#Deferred` — "Giới hạn định dạng/dung lượng ảnh… để lại cho implementation" ⇒ story này chốt số]
- [Source: `.../ARCHITECTURE-SPINE.md#Stack` — Node 24 LTS · NestJS 11.1.27 · PostgreSQL 18.4 · Prisma 7.8.0 · React 19.2.7 · Flutter 3.44 · Cloudflare R2]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-25` L122 — "mobile chụp trực tiếp/chọn thư viện, web chọn file; upload luôn optional"]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-20` L117 — Dialog cho hành động hệ trọng; overlay chồng **tối đa một tầng**]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-23` L120 — chip read-only, đổi status qua **màn riêng**]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-19` L116 · `#UX-DR-22` · `#UX-DR-27` — microcopy state; control không đủ quyền **ẩn hẳn**; parity web↔mobile]
- [Source: `.../ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md` — screen inventory: `s-status-change` "Chọn bước kế, đính kèm ảnh optional (FR-9, FR-23)"; **không** đặc tả microcopy ⇒ Task 7 chốt nhãn]
- [Source: `backend/src/orders/domain/allowed-transition.ts` — `ALLOWED_TRANSITIONS` 16 dòng, `SU_KIEN` 11 event, `evaluateTransition()`, `buocVongDoi()`; `:249-250` cảnh báo **không** dùng `daTaiDich()` cho 5.5]
- [Source: `backend/src/orders/domain/order-status.ts:15-25` — 10 khoá: `baogia choduyet dachot dacoc thicong nghiemthu danggiao dagiao hoanthanh huy` — ⚠️ là `thicong`, KHÔNG phải `dangthicong`]
- [Source: `backend/src/orders/orders.service.ts:402-456` — `applyTransition` private; `:1017-1030` `confirm()` là khuôn call-site chuẩn]
- [Source: `backend/src/storage/storage.port.ts` + `r2-storage.adapter.ts` + `storage.module.ts` — hạ tầng R2 ĐÃ CÓ; docstring module đã nêu attachments 5.5/5.6 là consumer kế tiếp]
- [Source: `backend/src/orders/quote-export.service.ts:124-176` + `schema.prisma:482-501` — tiền lệ "binary R2 + metadata DB" + proxy đọc bằng `StreamableFile`]
- [Source: `backend/src/accounts/domain/permission-registry.ts` — 21 key; `constructionTransition` `deliveryConfirm` `paymentsRecord` `quotesCreateEdit` `ordersConfirm` đã đủ dùng]
- [Source: `web/src/design-system/components/ImageUpload.tsx` — `{images, onAdd, onRemove?, max?, accept?, multiple?, hint?}`; nhãn `Thêm ảnh`/`Xoá ảnh`; **cấm chạm mạng**]
- [Source: `mobile/lib/design_system/components/image_upload.dart` — `AppImageUpload{images, onAdd, onRemove?, max?, hint?, pick?}`; sheet `Thêm ảnh` + `Chụp ảnh` + `Chọn từ thư viện`]
- [Source: `design-system/screens/order-detail.test.mjs:260-266` — danh sách nút bị cấm; **story này phải sửa**]
- [Source: `design-system/permissions/permission-keys.test.mjs:58` — `deepEqual` PERM ↔ AppPerm theo **thứ tự**]
- [Source: `backend/package.json` — `test` (hermetic, ignore `\.db\.integration\.spec\.ts$`) · `test:db` · `openapi:gen` · `permissions:gen`]
- [Source: `_bmad-output/implementation-artifacts/5-4-*.md#Senior Developer Review` — CRITICAL-1 màn web không parse; MEDIUM-1 bỏ qua component DS có sẵn]
- [Source: `docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#2` — bỏ bước "Lên lịch thi công"; 10 chip trạng thái]

---

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

**Lane đã chạy (2026-07-18):**

| Lane | Lệnh | Kết quả |
|---|---|---|
| Backend hermetic | `cd backend && npx jest` | **71 suite / 1197 test xanh** |
| Backend typecheck | `npx tsc --noEmit` | sạch |
| Web parse (TD-1) | `cd backend && npx jest web-source-parses` | 2 test xanh |
| Design-system | `cd design-system && npm test` | **346 test xanh** |
| Mobile | `cd mobile && flutter test` | **232 test xanh** |
| Mobile analyze | `cd mobile && flutter analyze` | No issues |
| **Backend DB lane** | `cd backend && npm run test:db` | **CHƯA CHẠY — không có database** |

**Lane DB chưa chạy.** Docker Desktop không lên (`docker info` → down). Cả **12** suite
`*.db.integration.spec.ts` (11 suite có sẵn + 1 suite mới của story này) đều fail ở query đầu
tiên trong `beforeAll` — `PrismaClientKnownRequestError` tại `customerSource.findUnique()`,
tức lỗi kết nối, không phải lỗi assertion. Spec mới compile sạch và được testRegex của lane
nhận đúng. **Không đánh dấu xanh cho lane không chạy** — 4 checkbox lane DB để trống có chủ đích.

**Đột biến đã chạy** (backup bằng `cp`, KHÔNG `git checkout` — code story chưa commit; mọi
mutant đều compile được trước khi tin kết quả):

| # | Đột biến | Kỳ vọng | Thực tế |
|---|---|---|---|
| 1 | Gỡ HẲN pre-check `evaluateTransition()` khỏi lane thủ công | AC-5/AC-6 đỏ | **1 test đỏ** — chỉ test "pre-check chặn TRƯỚC R2" |
| 1b | Gỡ kiểm tra quyền trong `evaluateTransition()` (lớp engine) | AC-5 đỏ | **4 test đỏ** gồm 403 + AC-7 |
| 2 | `occurredAt` của `createMany` lệch 1ms | khoá join đỏ | **1 test đỏ** — đúng test khoá join |
| 3 | Allow-list mime nhận tất cả | AC-9 đỏ | **4 test đỏ** (domain + service) |
| 4 | Chèn lỗi cú pháp vào `OrderStatusChangeScreen.tsx` | parse-guard đỏ | **1 test đỏ** |
| 5 | Chèn literal quyền vào màn web | guard AD-17 đỏ | **1 test đỏ** |
| 6 | Đổi nhãn `Xác nhận chuyển` → `Xác nhận` ở mobile | byte-parity đỏ | **1 test đỏ** |

⚠️ **Phát hiện của đột biến #1 — đáng đọc kỹ:** gỡ pre-check chỉ làm ĐỎ **một** test. Các test
403/409 vẫn xanh vì **engine dưới row lock là lớp thứ hai** và nó vẫn từ chối. Đây không phải
test giả: nó cho thấy pre-check chỉ sở hữu đúng một điều — *không trả tiền bytes cho request
sẽ bị từ chối*. Quyền sở hữu AC-5/AC-6 nằm ở engine, và đột biến #1b chứng minh lớp đó được
canh thật (4 test đỏ). Mỗi lớp có test riêng chết cùng nó.

### Completion Notes List

**Bất biến giữ nguyên:**
- `ALLOWED_TRANSITIONS` vẫn **đúng 16 dòng**, không thêm/sửa/xoá (AC-12).
  `no-order-status-write-outside-transition.spec.ts` xanh **không nới allow-list**.
- **Không thêm permission key** — bộ 21 key nguyên vẹn, không phải regen hai nơi.
- `applyTransition()` vẫn `private`; lane thủ công là method công khai MỚI trong cùng service.

**Quyết định phát sinh khi implement (chưa có trong story, nêu để Đại Ca phủ quyết):**

1. **`OrdersService` nhận dependency THỨ BA (`StoragePort`).** Docstring cũ ghi "đúng HAI
   dependency". Buộc phải vậy: transition + ghi metadata ảnh là MỘT `$transaction`, mà engine
   là `private` của service này — tách service riêng phải nới engine thành public, phá AD-11.
   Kéo theo cập nhật 9 call-site `new OrdersService(...)` trong test; thêm helper dùng chung
   `backend/test/util/fake-storage.ts`.

2. **Giới hạn ở interceptor đặt CAO HƠN giới hạn hợp đồng** (20 ảnh × 20 MB vs 10 × 10 MB).
   Nếu đặt bằng nhau, multer ném `MulterError` **trước khi handler chạy** ⇒ lọt tới
   `AllExceptionsFilter` như lỗi không lường trước ⇒ **500 generic**, mất envelope
   `VALIDATION_ERROR` + `fieldErrors` mà AC-9 đòi. Đặt cao hơn ⇒ mọi vi phạm của người dùng
   thật đi tới domain và nhận đúng 400; chỉ request lạm dụng mới chạm trần cứng.

3. **KHÔNG thêm `@types/multer`.** Story cho phép nếu typecheck kêu. Không cần: khai
   `interface FileDaTaiLen` bốn trường trong controller, structural typing khớp cả multer
   runtime lẫn `AnhTaiLen` của domain. Ít một dependency.

4. **`getLifecycle()` đổi kiểu trả về trên CẢ hai nền tảng** — từ `OrderLifecycleStep[]` thành
   `OrderLifecycle {buoc, buocKeTiep}`. Đây là hệ quả trực tiếp của "gắn `buocKeTiep` vào
   `/vong-doi` sẵn có, không đẻ route mới" (Câu hỏi đã tự quyết #9): một lần đọc đơn trả cả
   hai câu trả lời. Kéo theo cập nhật guard parity `order-detail.test.mjs` (chữ ký cũ được
   khoá ở đó) và 4 stub trong test mobile.

5. **`orders-read-gate.spec.ts` nới allow-list thêm ĐÚNG một route đọc**
   (`Get :id/anh/:attachmentId`). Ảnh của đơn là dữ liệu của đơn ⇒ chịu đúng gate và đúng
   phạm vi của đơn; service `findScopedOrThrow` chạy TRƯỚC khi chạm R2.

6. **Không preselect khi có HAI nhánh mở** (thi công / giao hàng). Một mặc định ở đây là quyết
   định hệ trọng thay người dùng, và cả hai nhánh chỉ cách một cú bấm. Preselect chỉ khi
   danh sách có đúng một bước.

**Nợ kỹ thuật của story này (đã ghi trong Dev Notes, KHÔNG mở lại như finding mới):** object
mồ côi trên R2 khi thua cuộc đua sau upload (`StoragePort` chưa có `deleteObject`, 5.6 mới là
chỗ đúng để thêm); không sniff magic-byte / không quét virus; đường GHI cũ vẫn chưa scope.

### File List

**Backend — mới:**
- `backend/src/orders/domain/attachment-limits.ts`
- `backend/src/orders/dto/status-change-request.dto.ts`
- `backend/src/orders/dto/status-change-response.dto.ts`
- `backend/prisma/migrations/20260718060000_add_attachments/migration.sql`
- `backend/test/attachment-limits.spec.ts`
- `backend/test/order-status-change.spec.ts`
- `backend/test/order-status-change.db.integration.spec.ts`
- `backend/test/util/fake-storage.ts`

**Backend — sửa:**
- `backend/prisma/schema.prisma` (model `Attachment` + 2 quan hệ ngược)
- `backend/src/orders/domain/allowed-transition.ts` (`SU_KIEN_THU_CONG`, `BuocKeTiep`, `buocKeTiep()`)
- `backend/src/orders/orders.service.ts` (`StoragePort`, `chuyenTrangThaiThuCong()`, `anhDinhKem()`, `lifecycle()` mở rộng, sentinel `THU_CONG_GATE_THUA`)
- `backend/src/orders/orders.controller.ts` (2 route mới, `vong-doi` mở rộng, `FileDaTaiLen`, trần cứng)
- `backend/src/orders/dto/order-lifecycle-response.dto.ts` (`OrderNextStepDto`, field `buocKeTiep`)
- `backend/openapi/openapi.json` (regen)
- `backend/test/allowed-transition.spec.ts` (9 test `buocKeTiep`)
- `backend/test/orders-read-gate.spec.ts` (allow-list +1 route đọc)
- `backend/test/orders.e2e.spec.ts` (bộ e2e lane 5.5 qua dây — 424 dòng; **thiếu trong File
  List bản đầu, review bổ sung**)
- `backend/test/orders.service.spec.ts` · `orders-detail-scope.spec.ts` · `orders-list-scope.spec.ts` · `orders.db.integration.spec.ts` · `orders-detail-scope.db.integration.spec.ts` · `orders-list.db.integration.spec.ts` · `quote-exports.db.integration.spec.ts` · `discount-approvals.db.integration.spec.ts` (call-site `new OrdersService`)

**Web — mới:**
- `web/src/screens/orders/OrderStatusChangeScreen.tsx`
- `web/src/screens/orders/order-status-change.css`

**Web — sửa:**
- `web/src/design-system/session/orders-port.ts` (`OrderNextStep`, `OrderLifecycle`, `StatusChangeResult`, `chuyenTrangThai`, `getLifecycle` mở rộng)
- `web/src/design-system/session/fake-orders-port.ts` (`buocKeTiepDemo`, `chuyenTrangThai`, envelope helper)
- `web/src/screens/orders/OrderDetailScreen.tsx` (nút + prop `onChangeStatus`)
- `web/src/screens/orders/order-detail.css` (`.od-actions`)

**Mobile — mới:**
- `mobile/lib/screens/orders/order_status_change_screen.dart`
- `mobile/test/screens/orders/order_status_change_screen_test.dart`

**Mobile — sửa:**
- `mobile/lib/design_system/session/orders_port.dart` (`OrderNextStep`, `OrderLifecycle`, `StatusChangeResult`, `chuyenTrangThai`, `getLifecycle` mở rộng)
- `mobile/lib/design_system/session/fake_orders_port.dart` (`_buocKeTiepDemo`, `chuyenTrangThai`)
- `mobile/lib/screens/orders/order_detail_screen.dart` (nút + callback `onChangeStatus`)
- `mobile/test/screens/orders/order_detail_screen_test.dart` (stub chữ ký mới + 3 test AC-11)

**Design-system — mới:**
- `design-system/screens/order-transition.test.mjs` (18 test)

**Design-system — sửa:**
- `design-system/screens/order-detail.test.mjs` (bỏ `'Chuyển trạng thái'` khỏi mảng cấm; chữ ký `getLifecycle`)
- `design-system/session/parity.test.mjs` (surface Story 5.5)

## Senior Developer Review (AI)

**Reviewer:** Phan Nhat Quang · **Ngày:** 2026-07-18 · **Kết quả:** Approve sau sửa

Bốn phát hiện, đã sửa hết trong review. Mọi sửa đều được kiểm bằng đột biến: hoàn tác chỗ sửa
làm ĐỎ đúng test canh nó, không phải "xanh vì không ai hỏi".

### 🔴 HIGH-1 — AC-13 không đúng qua dây: 400 thay vì 409

`StatusChangeRequestDto` khai `@IsIn(SU_KIEN_THU_CONG)` ⇒ `ValidationPipe` chặn
`chot`/`mo_lai`/`huy`/`du_coc`/`ap_chiet_khau` thành **400 VALIDATION_ERROR**, và whitelist
409 trong service **không bao giờ tới lượt**. AC-13 lẫn `@ApiConflictResponse` của route đều
ghi 409 CONFLICT ⇒ hợp đồng OpenAPI nói dối, client bắt lỗi theo mã sẽ vào nhánh sai.

Task 8 đã đánh `[x]` cho *"POST event `chot`… → 409"*. Ô đó **không đúng ở tầng dây**: unit
test gọi thẳng service nên bỏ qua pipe, còn e2e thì **ghim luôn hành vi lệch** thay vì báo đỏ.
Ghim một độ lệch với AC là hoãn nó vô thời hạn, không phải ghi nhận nó.

**Sửa:** `@IsIn` nhận **mọi sự kiện có thật** (`Object.values(SU_KIEN)`), để hai loại sai trả
hai mã đúng: tên sự kiện không tồn tại ⇒ 400 (sai cú pháp), sự kiện có cửa riêng ⇒ 409
(xung đột nghiệp vụ, service sở hữu). Test ghim được thay bằng test đòi 409 + đúng thông điệp
cho **cả năm** sự kiện, cộng một test giữ 400 cho tên không có thật.
Đột biến: siết `@IsIn` về whitelist ⇒ **5 test đỏ**.

### 🔴 HIGH-2 — Allow-list mime bị vượt qua chuỗi prototype (AC-9)

`MIME_CHO_PHEP[file.mimetype] === undefined` là câu hỏi sai: object literal kế thừa
`Object.prototype`, nên `Content-Type: constructor` (hoặc `toString`, `valueOf`, `__proto__`,
`hasOwnProperty`) tra về một **hàm** — khác `undefined` ⇒ **allow-list gật đầu cho thứ không
phải ảnh**. Client đặt được `Content-Type` cho từng phần multipart nên đây là đường đi thật.
Kéo theo `duoiTuMime()` trả **mã nguồn của hàm** làm đuôi object key trên R2.

**Sửa:** hỏi bằng `Object.prototype.hasOwnProperty.call()` ở **cả hai** chỗ (`kiemTraAnh` và
`duoiTuMime`). Đột biến: trả lại phép tra trần ⇒ **1 test đỏ** (test mới, canh đúng 5 tên kế
thừa).

### 🟡 MEDIUM-3 — Tên file của client đi thẳng vào `Content-Disposition`

`fileName: item.file.originalname` lưu nguyên tên client đặt, rồi đường đọc dựng
`attachment; filename="${file.fileName}"`. Nháy kép **cắt được** chuỗi filename của header;
CR/LF/NUL làm Node **ném lúc set header** ⇒ một file đặt tên hiểm lúc upload giết luôn lần tải
về sau. Tiền lệ `QuoteExport` mà story chép khuôn **không gặp** chuyện này vì tên của nó do
server sinh (`fileBase`) — chỗ lệch với tiền lệ nằm đúng ở đây.

**Sửa:** `tenFileAnToan()` trong domain, dọn ký tự điều khiển + `"` + `\` + `/`, giữ nguyên
tiếng Việt có dấu, cắt 200 ký tự, rỗng thì thành `anh`. Dọn **lúc GHI** chứ không lúc đọc: cột
này còn phục vụ gallery của 5.6, một chỗ dọn thì mọi consumer an toàn.
⚠️ Đột biến lần đầu **sống sót** — hàm có test riêng nhưng **chỗ nối** thì không, đúng bài học
"đột biến chỉ chạm một lớp". Đã thêm test canh call-site; đột biến lại ⇒ **1 test đỏ**.

### 🟡 MEDIUM-4 — File List thiếu `backend/test/orders.e2e.spec.ts`

424 dòng e2e của story không có tên trong File List. Đã bổ sung.

### 🟢 LOW-5 — `max={10}` rời rạc trong màn web

Mobile đặt tên hằng `_kSoAnhToiDa`, web để số trần. Đã đặt tên cho khớp cặp song sinh.

### Kiểm chứng lại sau sửa

| Lane | Lệnh | Kết quả |
|---|---|---|
| Backend hermetic | `cd backend && npx jest` | **71 suite / 1232 test xanh** (+8 test review) |
| Backend typecheck | `npx tsc --noEmit` | sạch |
| Web parse (TD-1) | `npx jest web-source-parses` | 2 test xanh |
| Design-system | `cd design-system && npm test` | **346 test xanh** |
| Mobile | `cd mobile && flutter test` | **235 test xanh** |
| Mobile analyze | `cd mobile && flutter analyze` | No issues |
| **Backend DB lane** | `cd backend && npm run test:db` | **VẪN CHƯA CHẠY — `docker info` down** |

`npm run openapi:gen` đã chạy lại sau khi sửa DTO; `openapi-drift.spec.ts` xanh.

### Đã KHÔNG mở lại (đúng như Dev Notes ghi nhận)

Object mồ côi trên R2 khi thua cuộc đua; không sniff magic-byte / không quét virus; đường GHI
cũ chưa scope; lệch spine về module `attachments/`. Tất cả là nợ có chủ đích, đã ghi rõ lý do.

### Còn treo

**Lane DB chưa chạy** — Docker Desktop không lên từ shell agent. 4 checkbox lane DB trong Task
8 vẫn để trống có chủ đích. Cần Đại Ca bật Docker Desktop rồi chạy `cd backend && npm run
test:db` để đóng nốt AC-2/AC-3/AC-8 ở tầng Postgres thật.

---

### Change Log

- **2026-07-18** — Story 5.5: chuyển trạng thái thủ công + đính kèm ảnh optional.
  Model `Attachment` (bốn toạ độ bước, nullable cho 5.6) + migration; hàm domain thuần
  `buocKeTiep()` đọc thẳng `ALLOWED_TRANSITIONS` với whitelist 5 sự kiện của lane thủ công;
  `OrdersService.chuyenTrangThaiThuCong()` theo thứ tự scope → whitelist → pre-check →
  validate → R2 → `$transaction(applyTransition + createMany)` → publish sau commit; proxy
  đọc bytes có scope; màn `Chuyển trạng thái` trên cả hai nền tảng dựng từ component DS sẵn
  có, nhãn byte-for-byte; guard mới `order-transition.test.mjs`. Lane DB chưa chạy (không có
  database).
- **2026-07-18** — Review: sửa 5 phát hiện. AC-13 trả đúng 409 qua dây (ranh giới whitelist về
  service, `@IsIn` chỉ còn canh cú pháp); allow-list mime không còn bị vượt qua chuỗi
  prototype; tên file client gửi được dọn trước khi vào cột `fileName` và header
  `Content-Disposition`; File List bổ sung `orders.e2e.spec.ts`; hằng số ảnh tối đa ở màn web
  được đặt tên. Regen OpenAPI. Lane DB vẫn chưa chạy.
