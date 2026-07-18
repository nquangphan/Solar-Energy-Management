---
baseline_commit: f6fd57f95b50d14620cb6b6cee365facf1bbcc8a
---

# Story 5.6: Đính kèm ảnh bổ sung trong chi tiết đơn

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người có quyền**,
I want **thêm/xoá ảnh bổ sung trong chi tiết đơn ngoài luồng chuyển trạng thái**,
so that **lưu bằng chứng linh hoạt bất cứ lúc nào**.

---

## ⚠️ Đọc trước khi gõ dòng code đầu tiên

Bốn sự thật quyết định story này.

1. **Bảng `attachments` ĐÃ CÓ và ĐÃ ĐƯỢC ĐO CHO STORY NÀY.** `statusFrom` / `statusTo` /
   `occurredAt` là `String?`/`String?`/`DateTime?` — comment trong schema
   (`backend/prisma/schema.prisma:515-516`) ghi thẳng: *"Story 5.6 thêm ảnh bổ sung NGOÀI luồng
   chuyển trạng thái — những hàng đó không thuộc bước nào và để null."*
   ⇒ **KHÔNG migration ở story này.** Không thêm cột, không thêm index. Xem "Câu hỏi đã tự quyết" #6.
2. **Chỉ 1 trong 4 route ảnh tồn tại.** `GET /orders/:id/anh/:attachmentId` (đọc bytes, proxy, đã
   scope) đã ship ở 5.5. **Chưa có** list, **chưa có** upload rời, **chưa có** xoá. FE hiện **không có
   cách nào biết `attachmentId`** ⇒ ảnh của 5.5 đang là dữ liệu chết. Story này mở đường đọc đó ra.
3. **`StoragePort` chưa có `deleteObject`.** 5.5 đã ghi nợ này và chỉ đích danh 5.6 là chỗ trả:
   port + `R2StorageAdapter` + `backend/test/util/fake-storage.ts` phải cùng thêm method, nếu không
   **mọi spec dựng `new OrdersService(...)` sẽ đỏ typecheck**.
4. **Guard tab KHÔNG chặn story này — đừng đi tìm một test đỏ không tồn tại.**
   `design-system/screens/order-detail.test.mjs:248-255` giữ chỗ tab thứ ba bằng chuỗi
   `Ảnh đính kèm`, nhưng nhãn story này chốt là **`Ảnh`** ⇒ chuỗi bị cấm không xuất hiện, và vòng
   lặp đọc code **đã strip comment** (`stripTsx`/`stripDart` `:35-39`) nên comment "Ảnh is Story 5.6"
   cũng vô hình. Vẫn **phải sửa guard** vì tên test + phần tử `notYet` đã hết đúng — đó là **vệ sinh,
   không phải blocker**.
   ⚠️ Đọc guard rồi suy ra nhãn là `Ảnh đính kèm` là **sai**: nhãn chốt ở Task 9 là `Ảnh`.

---

## Acceptance Criteria

### AC gốc (nguyên văn từ epics)

1. **Given** chi tiết đơn, **When** xem ảnh, **Then** thấy toàn bộ ảnh (theo bước + bổ sung) kèm
   mốc thời gian + người tải; entity `Attachment` gắn `Order` + `accountId` (FR-24).
2. **Given** một ảnh, **When** xoá, **Then** chỉ người đã tải lên hoặc người có quyền chỉnh sửa đơn
   mới xoá được; thêm/xoá ghi Audit (FR-24).
3. **Given** upload, **When** thêm ảnh, **Then** mobile chụp/chọn thư viện, web chọn file; binary ở
   R2 (FR-24, AD-3, UX-DR-25).

### AC bổ sung (dẫn xuất — bắt buộc để đóng story)

4. **Given** `GET /orders/:id/anh`, **When** gọi, **Then** trả **một danh sách phẳng** mọi ảnh của
   đơn — cả ảnh của 5.5 (`statusTo != null`) lẫn ảnh bổ sung (`statusTo == null`) — sắp
   `createdAt` **giảm dần**, mỗi hàng có `id`, `fileName`, `contentType`, `size`, `createdAt`,
   `nguoiTaiLen` (**`Account.displayName`**), `statusFrom`, `statusTo`, `coTheXoa`.
   ⚠️ DTO **KHÔNG** chứa `objectKey` — key R2 không rời backend (AD-3).
5. **Given** actor ngoài phạm vi đơn, **When** gọi bất kỳ route ảnh nào (list / thêm / xoá),
   **Then** 404 với đúng thông điệp "không tìm thấy đơn" — **không** rò rỉ sự tồn tại của đơn,
   **không** rò bytes. Phạm vi phải đóng bằng `findScopedOrThrow()`, không phải kiểm tra tại chỗ.
6. **Given** `coTheXoa`, **When** backend tính, **Then** `coTheXoa = (uploadedByAccountId === caller)
   || quyen.has(PERM.quotesCreateEdit)` — **tính ở backend**, client **chỉ hiển thị**. Client
   **KHÔNG** được dựng lại biểu thức này (AD-2/AD-4).
7. **Given** actor không thoả luật ở AC-6, **When** `DELETE /orders/:id/anh/:attachmentId`,
   **Then** **403 `FORBIDDEN`** `'Bạn không có quyền xoá ảnh này.'`, hàng `Attachment` **còn nguyên**
   và object R2 **còn nguyên**.
8. **Given** xoá thành công, **When** hoàn tất, **Then** hàng DB bị xoá **hẳn** (hard delete), sự
   kiện `AttachmentRemoved` publish **sau commit**, và object R2 bị xoá **sau** khi DB commit.
   ⚠️ **Thứ tự bắt buộc: DB trước, R2 sau.** Xoá R2 trước rồi DB fail ⇒ còn hàng trỏ vào bytes
   không tồn tại ⇒ gallery vỡ. Ngược lại chỉ để lại bytes mồ côi, vô hình với mọi endpoint.
9. **Given** `POST /orders/:id/anh` với N ảnh, **When** lưu, **Then** N hàng `Attachment` với
   `statusFrom = null`, `statusTo = null`, `occurredAt = null`, `uploadedByAccountId = caller`,
   `fileName` đã qua `tenFileAnToan()`, object key `attachments/{orderId}/{uuid}.{ext}` với `ext`
   suy từ **mime allow-list** (không tin đuôi file client gửi); publish `AttachmentAdded` sau commit.
10. **Given** file sai định dạng / quá lớn / quá số lượng, **When** POST, **Then** 400
    `VALIDATION_ERROR` + `fieldErrors`, và **không** hàng nào được tạo, **không** byte nào lên R2.
11. **Given** thêm/xoá ảnh, **When** hoàn tất, **Then** `Order.status` **KHÔNG đổi** và
    `applyTransition()` **KHÔNG** được gọi — đây là đường ghi metadata, không phải transition.
    `no-order-status-write-outside-transition.spec.ts` phải xanh **không cần nới allow-list** —
    guard đó chỉ quét lệnh ghi Prisma trên model **`order`** có `status` trong `data` (`:21-45`),
    còn `attachment.createMany({ data: { statusFrom, statusTo } })` là model khác + key khác
    ⇒ tự nhiên xanh. **Đừng đụng vào `CHO_PHEP` cho chắc.**
12. **Given** chi tiết đơn, **When** dựng, **Then** có **đúng ba** tab: `Thông tin`,
    `Lịch sử update`, `Ảnh` — ⚠️ **hai nhãn cũ giữ NGUYÊN VĂN**, `Lịch sử update` chứ không phải
    `Lịch sử`; nhãn đó đang bị ghim byte-for-byte ở `order-detail.test.mjs:200`, đổi là guard đỏ.
    Tab `Ảnh` có đủ 4 state: Loading = skeleton, Empty = `Chưa có ảnh nào.`,
    Error = thông báo + `Thử lại`, Ready = lưới thumbnail (UX-DR-19).
13. **Given** người dùng bấm `Xoá ảnh`, **When** xác nhận, **Then** đi qua **Dialog nêu hậu quả**
    (UX-DR-20, tone `danger`) — **không** xoá ngay khi bấm, **không** long-press để xoá.
    Dialog xoá **không bao giờ** mở đồng thời với sheet chọn ảnh (overlay chồng **tối đa một cấp**).
14. **Given** ảnh không có quyền xoá (`coTheXoa = false`), **When** render, **Then** nút `Xoá ảnh`
    **ẩn hẳn**, không xám (UX-DR-22).
15. **Given** hai nền tảng, **When** render tab `Ảnh`, **Then** nhãn tiếng Việt **byte-for-byte
    giống nhau** và pass parity guard (UX-DR-27).
16. **Given** component gallery mới, **When** dựng, **Then** nó **KHÔNG** gọi mạng — screen nạp
    bytes qua port rồi truyền vào. `fetch(` / `http` / `R2` trong component ⇒ guard đỏ.

---

## Tasks / Subtasks

### Task 1 — `StoragePort.deleteObject()` (AC: 8)

- [x] `backend/src/storage/storage.port.ts`: thêm `abstract deleteObject(key: string): Promise<void>;`
      cạnh `putObject`/`getObject`.
- [x] `backend/src/storage/r2-storage.adapter.ts`: implement bằng `DeleteObjectCommand`
      (`@aws-sdk/client-s3` **đã** trong `package.json`, không thêm dependency). Dùng cùng
      `resolveClient()` + cùng cấu hình checksum đang có.
- [x] ⚠️ **`backend/test/util/fake-storage.ts` phải implement luôn** (`objects.delete(key)`), nếu
      không **9+ spec** dựng `new OrdersService(prisma, eventBus, storage)` đỏ typecheck.
- [x] `backend/test/r2-storage.adapter.spec.ts`: thêm test cho `deleteObject` theo khuôn test
      `putObject` có sẵn.
- [x] **KHÔNG** thêm env mới. **KHÔNG** thêm API sinh signed URL — repo đã chốt proxy (5.5).

### Task 2 — Domain event `AttachmentAdded` / `AttachmentRemoved` (AC: 2, 8, 9)

- [x] `backend/src/orders/domain/order-events.ts`: thêm 2 class theo khuôn **`QuoteExported`**
      (`:221-240`) — là event **không** đổi `Order.status` nên **không** mang `before/after` snapshot:
  - `AttachmentAdded(actorAccountId, orderId, attachmentIds: readonly string[], soAnh: number, occurredAt: Date)`
  - `AttachmentRemoved(actorAccountId, orderId, attachmentId: string, fileName: string, occurredAt: Date)`
  - mỗi class: `readonly type = 'AttachmentAdded' | 'AttachmentRemoved'`, `target = { type: 'Order', id: orderId }`.
- [x] 🚨 **Đây là cách DUY NHẤT story này ghi Audit.** Producer **KHÔNG** gọi `AuditService` trực
      tiếp — `no-direct-side-effect-outside-eventbus.spec.ts` bắt đỏ. `AuditSubscriber` đã tự đăng ký
      và ghi mọi `DomainEvent`, **không cần sửa gì** ở `audit/`.
- [x] **Giải toả va chạm AD-11 ↔ FR-24** (ghi ở đây để review không mở lại): AD-11 nói
      `applyTransition` là "nơi duy nhất phát bản ghi Audit" — câu đó nói về **audit của chuyển
      trạng thái**. FR-24 đòi audit cho thêm/xoá ảnh **ngoài** mọi transition, và quy ước
      `#API & Data Conventions` đòi AuditLog cho **"mọi mutation nghiệp vụ"**. Đường hoà giải là
      AD-18: publish event, subscriber ghi. Story này **không** đụng `applyTransition`.

### Task 3 — Nới `kiemTraAnh()` cho lane không-transition (AC: 10)

- [x] `backend/src/orders/domain/attachment-limits.ts`: thông điệp lỗi số lượng hiện ghi
      *"cho một lần chuyển trạng thái"* (`:101`) — sai ngữ cảnh khi gọi từ upload rời.
      Đổi thành trung tính: `'Tối đa 10 ảnh cho một lần tải lên.'`
- [x] Sửa **cả TSDoc `:14`** (`/** Tối đa 10 ảnh cho MỘT lượt chuyển trạng thái. */`) — cùng một
      chỗ sai ngữ cảnh.
- [x] ✅ Đã kiểm: **không test nào assert nguyên văn chuỗi này** — cả ba chỗ đều assert **mã**
      `code === 'maxCount'` (`attachment-limits.spec.ts:43`, `order-status-change.spec.ts:333`,
      `orders.e2e.spec.ts:3142`). Đổi chuỗi **không** làm đỏ gì; **đừng đi sửa test**.
- [x] **KHÔNG** đổi con số: giữ `SO_ANH_TOI_DA = 10` / lượt, `KICH_THUOC_TOI_DA_BYTE = 10 MB` / ảnh,
      allow-list `jpeg|png|webp|heic`. **Không** cap tổng theo đơn (xem "Câu hỏi đã tự quyết" #5).
- [x] **KHÔNG** đụng `duoiTuMime()` / `tenFileAnToan()` / phép tra `hasOwnProperty` — đó là hai bản
      vá bảo mật của review 5.5 (prototype pollution + header injection), có test riêng canh.

### Task 4 — Service: 3 đường mới trong `OrdersService` (AC: 1, 2, 4, 5, 6, 7, 8, 9, 10, 11)

Đặt cạnh `anhDinhKem()` (`orders.service.ts:724`) — cùng file, cùng khuôn.

- [x] `danhSachAnh(callerAccountId, quyen, orderId)`:
  1. `findScopedOrThrow(callerAccountId, quyen, orderId)` **trước tiên** (AC-5).
  2. `prisma.attachment.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' },
     include: { uploadedBy: { select: { displayName: true } } } })`.
  3. map sang DTO, tính `coTheXoa` theo AC-6.
  ⚠️ `include` là giá trị, **không spread union** vào query (bài học Prisma đã ghi nhận).
- [x] `themAnh({ callerAccountId, quyen, orderId, anh })` — **thứ tự bắt buộc**:
  1. `findScopedOrThrow` → 2. `kiemTraAnh()` → 400 nếu lỗi (**trước khi chạm R2**, AC-10) →
  3. mint `randomUUID()` cho từng ảnh + `putObject()` → 4. `prisma.attachment.createMany()` với
  ba cột toạ độ **`null`** → 5. publish `AttachmentAdded` **sau commit**.
  - 🚨 **`id` đã mint phải đi vào CẢ object key LẪN `createMany({ data: [{ id, … }] })`.**
    `createMany` **không trả id** ⇒ đây là cách **duy nhất** `AttachmentAdded` có `attachmentIds`.
    Khuôn đã chạy: `orders.service.ts:642-651` (mint + key) và `:672-676` (`id` vào `createMany`).
  - Chép khuôn dựng key + `fileName: tenFileAnToan(...)` từ `chuyenTrangThaiThuCong()` `:644-690`.
  - **KHÔNG** gọi `applyTransition`, **KHÔNG** đọc/ghi `Order.status` (AC-11).
- [x] `xoaAnh(callerAccountId, quyen, orderId, attachmentId)`:
  1. `findScopedOrThrow` → 2. `attachment.findFirst({ where: { id: attachmentId, orderId } })`;
  `null` ⇒ **404** (khuôn `anhDinhKem` — không phân biệt 403/404 để không xác nhận sự tồn tại) →
  3. luật AC-6; không thoả ⇒ **403** → 4. `attachment.delete({ where: { id } })` →
  5. publish `AttachmentRemoved` **sau commit** → 6. `storage.deleteObject(objectKey)` **sau cùng**,
  bọc `try/catch` **nuốt lỗi** (log): R2 hỏng **không được** biến một lần xoá đã commit thành lỗi
  cho người dùng; hậu quả xấu nhất là bytes mồ côi, vô hình.
- [x] Không cần `$transaction` cho xoá (một lệnh DELETE) — đừng bọc thừa.
- [x] **Không gate theo trạng thái đơn**: đơn `hoanthanh`/`huy` vẫn thêm/xoá được ảnh
      (xem "Câu hỏi đã tự quyết" #8).

### Task 5 — Controller + DTO + OpenAPI (AC: 4, 5, 7, 9, 10)

- [x] `backend/src/orders/dto/attachment-response.dto.ts` (**mới**, kebab-case):
      `AttachmentItemDto { id, fileName, contentType, size, createdAt, nguoiTaiLen, statusFrom,
      statusTo, coTheXoa }` + `AttachmentListResponseDto { items: AttachmentItemDto[] }`.
      Bọc trong object có `items` — đúng khuôn `OrderVersionsResponseDto` (5.4), không trả mảng trần.
- [x] `backend/src/orders/orders.controller.ts` — 3 route, khai **sau** route tĩnh, **trước/cạnh**
      `GET :id/anh/:attachmentId` đang có:
  - `@Get(':id/anh')` + `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`
  - `@Post(':id/anh')` + `@HttpCode(HttpStatus.CREATED)` +
    `@RequireAnyPermissions(PERM.quotesCreateEdit, PERM.constructionTransition, PERM.deliveryConfirm, PERM.paymentsRecord)` +
    `@UseInterceptors(FilesInterceptor('anh', TRAN_CUNG_SO_ANH, { limits: { fileSize: TRAN_CUNG_KICH_THUOC_BYTE } }))` +
    `@ApiConsumes('multipart/form-data')`
  - `@Delete(':id/anh/:attachmentId')` + `@HttpCode(HttpStatus.NO_CONTENT)` + cùng bộ quyền như POST
    (khuôn `@Delete(':id/line-items/:lineId')` `:633-656`).
- [x] ⚠️ **Tái dùng `TRAN_CUNG_SO_ANH` / `TRAN_CUNG_KICH_THUOC_BYTE` đang có (`:89-90`, cả hai = ×2
      ngưỡng hợp đồng) — trần cứng
      multer phải CAO HƠN ngưỡng hợp đồng.** Đặt bằng nhau ⇒ `MulterError` bắn **trước** handler ⇒
      **500 INTERNAL** thay vì 400 + `fieldErrors` mà AC-10 đòi. Đây là lỗi đã xảy ra thật ở 5.5.
- [x] Tái dùng `interface FileDaTaiLen` (`:97-102`) và helper `quyenCuaNguoiGoi()` (`:127-131`).
      ⚠️ **KHÔNG** tự dựng `new Set([PERM.x])` — `no-fabricated-actor-permissions.spec.ts` bắt đỏ.
- [x] Controller **không** nặn envelope lỗi; service ném `AppException`
      (`no-controller-error-envelope.spec.ts`).
- [x] `backend/test/orders-read-gate.spec.ts`: nới allow-list thêm **đúng một** route đọc
      (`Get :id/anh`) — khuôn đã có từ 5.5.
- [x] `npm run openapi:gen` + commit `backend/openapi/openapi.json` — `openapi-drift.spec.ts` so
      **byte-for-byte**, quên là đỏ.
- [x] **KHÔNG thêm permission key** ⇒ **không** phải regen 2 nơi (xem "Câu hỏi đã tự quyết" #2).

### Task 6 — Port + fake port hai nền tảng (AC: 1, 4, 16)

- [x] `web/src/design-system/session/orders-port.ts`: type `AttachmentItem` + 4 method —
      `listAnh(orderId)`, `themAnh(orderId, files: File[])`, `xoaAnh(orderId, attachmentId)`,
      `anhBytes(orderId, attachmentId)` (đường nạp preview qua proxy có JWT).
- [x] `mobile/lib/design_system/session/orders_port.dart`: mirror **y hệt** —
      `anhBytes` trả `Uint8List`.
- [x] Cập nhật `fake-orders-port.ts` + `fake_orders_port.dart` (demo data: ≥1 ảnh theo bước có
      `statusTo`, ≥1 ảnh bổ sung `statusTo == null`, ≥1 ảnh `coTheXoa == false`).
- [x] Mirror **đúng** contract backend, không bịa field (AD-12).

### Task 7 — Component gallery mới trên cả hai nền tảng (AC: 1, 13, 14, 16)

- [x] Web `web/src/design-system/components/AttachmentGallery.tsx` + export ở barrel
      `components/index.ts`.
- [x] Mobile `mobile/lib/design_system/components/attachment_gallery.dart`, class
      **`AppAttachmentGallery`** (bắt buộc `App`-prefix — mọi widget DS đều vậy) + export ở
      `components/components.dart`.
- [x] 🚨 **Đăng ký component mới vào HAI map viết tay của guard parity** — chúng **không tự đỏ**,
      quên là mất luôn guard cho component mới:
  - `design-system/components/parity.test.mjs:199-220`: thêm `AttachmentGallery: 'attachment_gallery.dart'`
  - `design-system/components/parity.test.mjs:228-241`: thêm `'AppAttachmentGallery'` vào danh sách tên barrel
- [x] Props/field **mirror nhau**: `items: {id, fileName, nguoiTaiLen, createdAt, statusTo?,
      previewSrc?, coTheXoa}[]`, `onDelete(id)`, `emptyLabel`.
- [x] 🚨 **Component KHÔNG chạm mạng** (AC-16). Screen nạp bytes qua `port.anhBytes()` rồi truyền
      xuống: web = object URL, mobile = `Uint8List` → `Image.memory`.
      ⚠️ **KHÔNG** bẻ `ImageUpload`/`AppImageUpload` để fetch: chúng là **picker cho file cục bộ**
      (`Image.file` / object URL của `File` vừa chọn), có source-guard cấm mạng, và không mang
      `nguoiTaiLen`/`createdAt`. Picker giữ cho luồng **thêm**; gallery là component **đọc** riêng.
- [x] Nút xoá: `ic-trash` (đã có trong `icons.json`), `aria-label`/`Semantics` = `Xoá ảnh`; **ẩn hẳn**
      khi `coTheXoa == false` (AC-14). Tap target ≥ 48dp. Bo góc thumbnail **10px** (DESIGN.md#Shapes).
- [x] Layout bằng flex/grid, **không** absolute position.

### Task 8 — Tab `Ảnh` trong chi tiết đơn, hai nền tảng (AC: 1, 3, 12, 13, 15)

- [x] `web/src/screens/orders/OrderDetailScreen.tsx` + `mobile/lib/screens/orders/order_detail_screen.dart`:
      thêm tab thứ ba `TAB_ANH = 'anh'` / `_kTabAnh` (nhãn `Ảnh`) vào khối hằng tab
      (web `:67-76`, mobile `:47-55`) và **sửa comment "Ảnh is Story 5.6"** cho khớp thực tế.
      ⚠️ **Hai nhãn cũ (`Thông tin`, `Lịch sử update`) giữ NGUYÊN VĂN** — chỉ thêm phần tử thứ ba
      vào `TABS`/`_kTabs`, không sửa/rút gọn nhãn cũ (bị ghim ở `order-detail.test.mjs:200`).
- [x] Nạp danh sách ảnh **lazy** — chỉ khi tab `Ảnh` được mở lần đầu, **không** nhét vào
      `Promise.all`/`Future.wait` của `load()` (giữ chi tiết đơn nhẹ như 5.4).
- [x] Bắt buộc giữ khuôn chống race của 5.4: ticket `latest`/`_latest` + `if (!mounted || ticket !=
      _latest) return;` **trước mọi `setState` sau await**.
- [x] Thêm ảnh: dùng `ImageUpload` / `AppImageUpload` **có sẵn** (AD-13), giữ khuôn hai state của
      5.5 (`AnhDaChon { id, file, item }` / `_AnhDaChon`) + revoke object URL sau khi gửi xong.
      Mobile: giữ seam `pick: ImagePickFn` inject được để widget test chạy không cần platform channel.
- [x] Xoá: web `ConfirmDialog` (`{open, title, consequence, confirmLabel, cancelLabel, tone:'danger',
      onConfirm, onCancel}`), mobile **`AppConfirmDialog`** — ⚠️ **widget này ĐÃ TỒN TẠI**
      (`mobile/lib/design_system/components/dialog.dart:161`, đã export ở barrel `:37`,
      `confirmTone` mặc định `danger`). **Không vẽ dialog mới.**
- [x] 🚨 **Không mở dialog xoá khi sheet chọn ảnh đang mở** — `AppImageUpload` tự mở `AppSheet`,
      chồng hai tầng overlay là vi phạm UX-DR-20. Hai luồng tách bạch, không lồng nhau.
- [x] **Không** viewer/lightbox toàn màn ở story này (xem "Câu hỏi đã tự quyết" #7).

### Task 9 — Nhãn + guard (AC: 12, 13, 14, 15, 16)

Bộ nhãn chốt, **byte-for-byte hai nền tảng**:

| Vị trí | Nhãn |
|---|---|
| Tab thứ ba | `Ảnh` |
| Khối thêm ảnh | `Thêm ảnh bổ sung` |
| Rỗng | `Chưa có ảnh nào.` |
| Lỗi | `Không tải được ảnh của đơn.` + `Thử lại` |
| Tiêu đề dialog xoá | `Xoá ảnh` |
| Hậu quả trong dialog | `Ảnh sẽ bị xoá vĩnh viễn và không khôi phục được.` |
| Nhãn nhóm ảnh theo bước | `Bước: {từ} → {đến}` |
| Nhãn ảnh bổ sung | `Bổ sung` |

Tái dùng nguyên trạng (đã sống trong DS): `Thêm ảnh`, `Xoá ảnh`, `Chụp ảnh`, `Chọn từ thư viện`,
`Xác nhận`, `Huỷ`, `Thử lại`. Nhãn trạng thái lấy từ `STATUS_LABELS`/`kStatusLabels` —
**không** đẻ bảng nhãn thứ ba.

- [x] **Sửa** `design-system/screens/order-detail.test.mjs:248-256`: bỏ phần tử `'Ảnh đính kèm'`
      khỏi mảng `notYet` (giữ `'Thanh toán'`, `'Hợp đồng'`, `'Hoá đơn'`, `'HĐ & HĐơn'`), đổi tên
      test cho đúng ("exactly the three owned tabs…"), và **thêm assert dương** rằng tab `Ảnh`
      render trên cả hai nền tảng. ⚠️ **KHÔNG xoá test.**
- [x] **Thêm** `design-system/screens/order-attachments.test.mjs` theo khuôn
      `order-transition.test.mjs` — **chỉ assert tầng SCREEN**: byte-parity toàn bộ nhãn ở bảng
      trên; cấm literal quyền (`/['"][a-z_]+\.[a-z_]+['"]/`); cấm client tự dựng lại luật
      `coTheXoa` (cấm chuỗi `quotes.create_edit`, cấm so sánh `uploadedBy`/`nguoiTaiLen` với
      account hiện tại trong screen).
- [x] ⚠️ **Assert "component không chạm mạng" (AC-16) thuộc tầng COMPONENT, không phải screen** —
      đặt cạnh cặp song sinh `ImageUpload` trong `design-system/components/behavior-components.test.mjs:135-140`
      (khuôn: *"ImageUpload does NOT upload — no fetch/R2/signed/upload() (AD-3)"*), cấm
      `fetch(`/`http`/`R2` trong `AttachmentGallery.tsx` **và** `attachment_gallery.dart`.
      `screens/*.test.mjs` canh screen; `components/*.test.mjs` canh component — đừng trộn.
- [x] 🚨 **Đăng ký nút xoá icon-only vào map a11y viết tay** (không tự đỏ):
      thêm `'components/AttachmentGallery.tsx': 'Xoá ảnh'` vào `iconOnly`
      (`design-system/components/a11y-floor.test.mjs:55-60`) + assert
      `Semantics(button: true, label: 'Xoá ảnh')` cho `attachment_gallery.dart` (khuôn `:76-80`).
- [x] **Thêm** test "Story 5.6 surface trên CẢ HAI nền tảng" vào `design-system/session/parity.test.mjs`
      (4 method port + component gallery).
- [x] **KHÔNG thêm permission key mới** ⇒ `permission-keys.test.mjs` (deepEqual PERM ↔ AppPerm theo
      **thứ tự**) không bị đụng và không phải regen hai nơi.

### Task 10 — Test (AC: tất cả)

**Backend hermetic** — `backend/test/*.spec.ts`, `cd backend && npm test`:
- [x] `order-attachments.spec.ts` (mới): list trả đúng thứ tự `createdAt` giảm dần và **trộn** cả
      ảnh theo bước lẫn ảnh bổ sung (AC-4); `nguoiTaiLen` lấy đúng `displayName`.
- [x] `coTheXoa`: đúng `true` cho người tải lên **không** có `quotesCreateEdit`; đúng `true` cho
      người có `quotesCreateEdit` **không** phải người tải; đúng `false` cho người còn lại (AC-6).
- [x] Xoá: actor không thoả ⇒ **403**, `attachment.delete` **không** được gọi, `deleteObject`
      **không** được gọi (AC-7). Ảnh không thuộc đơn ⇒ **404**.
- [x] **Thứ tự DB→R2** (AC-8): DB delete **reject** ⇒ `deleteObject` **không** được gọi.
      `deleteObject` **reject** ⇒ endpoint vẫn **thành công** (204), không ném ra ngoài.
- [x] Thêm ảnh: `createMany` nhận `statusFrom/statusTo/occurredAt` **đều `null`** (AC-9);
      key theo `attachments/{orderId}/{uuid}.{ext}` với ext suy từ mime.
- [x] Validate: quá 10 ảnh / quá 10 MB / mime ngoài allow-list ⇒ 400 + `fieldErrors`, và
      `putObject` **không** được gọi lần nào (AC-10).
- [x] Phạm vi (AC-5): actor ngoài `ownerAccountId`/`assigneeAccountId` và không có `ordersViewAll`
      ⇒ **404** ở **cả ba** route.
- [x] Event (AC-2): `AttachmentAdded`/`AttachmentRemoved` publish **sau** khi DB xong; `AuditService`
      **không** được gọi trực tiếp.
- [x] AC-11: `applyTransition`/`order.updateMany` **không** được gọi ở cả hai đường ghi.

**Backend e2e** — `backend/test/orders.e2e.spec.ts`: bổ sung 3 route vào ma trận auth có sẵn
(`:437-451`) + ca 403 xoá qua dây (mã HTTP chỉ đo được ở lane này, qua `ValidationPipe`).

**Backend DB lane** — `backend/test/order-attachments.db.integration.spec.ts`,
`cd backend && npm run test:db`:
- [ ] Round-trip thật: thêm 2 ảnh bổ sung → list trả đủ cả ảnh 5.5 lẫn ảnh mới, đúng thứ tự,
      `nguoiTaiLen` join đúng.
- [ ] Xoá thật → hàng biến mất, **1 hàng `audit_logs`** `eventType = 'AttachmentRemoved'`,
      `targetId = orderId`.
- [ ] ⚠️ Lane này cần **Docker Desktop bật sẵn từ GUI**. `open -a Docker` từ shell agent **không**
      tạo được socket — nếu daemon chưa lên, **viết test rồi báo lane chưa chạy**, đừng giả xanh.
      (Lane này đã treo từ 5.5, 4 checkbox vẫn để trống có chủ đích.)

**Mobile** — `cd mobile && flutter test` (+ `flutter analyze`): đây là lane **hành vi** thật (web
chỉ có text-guard, TD-1). Bắt buộc widget test:
- [x] tab `Ảnh` render lưới; state rỗng hiện `Chưa có ảnh nào.`; state lỗi hiện `Thử lại`;
- [x] nút `Xoá ảnh` **ẩn** khi `coTheXoa == false`, **hiện** khi `true` (AC-14);
- [x] bấm xoá → `AppConfirmDialog` hiện, bấm `Huỷ` ⇒ port **không** được gọi; bấm `Xác nhận` ⇒
      port gọi đúng `attachmentId` (AC-13);
- [x] thêm ảnh qua `pick` inject ⇒ port nhận đúng số file.
- [x] Thu `tester.view.physicalSize` về bề ngang điện thoại để bắt `RenderFlex overflowed`.

**Design-system** — `cd design-system && npm test`.
**Web syntax** — `cd backend && npx jest web-source-parses`: ⚠️ lane **DUY NHẤT** chứng minh file
`.tsx` parse được. 5.4 từng ship một màn web chết mà cả bốn lane vẫn xanh.

**Đột biến (bắt buộc, không phải tuỳ chọn):**
- [x] Đảo `coTheXoa` thành hằng `true` → test AC-6/AC-7 phải **đỏ**.
- [x] Đảo thứ tự xoá thành R2-trước-DB → test AC-8 phải **đỏ**.
- [x] Bỏ `findScopedOrThrow` khỏi **một** route → test AC-5 của route đó phải **đỏ**.
- [x] Cho `createMany` ghi `statusTo` = trạng thái hiện tại thay vì `null` → test AC-9 phải **đỏ**.
- [x] Đổi nhãn `Chưa có ảnh nào.` ở mobile → byte-parity phải **đỏ**.
- [x] Đột biến **phải compile được**, nếu không nó làm đỏ mọi suite và chứng minh số 0.
- [x] Hoàn tác bằng `cp` sao lưu — **tuyệt đối không `git checkout`**, code story chưa commit.

---

## Dev Notes

### Hiện trạng file bị SỬA (đọc trước khi đổi)

| File | Hiện làm gì | Story này đổi gì | Phải giữ nguyên |
|---|---|---|---|
| `backend/prisma/schema.prisma:517-535` | model `Attachment` 12 cột, 2 index, 3 cột toạ độ nullable | **KHÔNG ĐỔI** — không migration | toàn bộ |
| `backend/src/storage/storage.port.ts` · `r2-storage.adapter.ts` | `putObject`/`getObject` | **+1** method `deleteObject` | 2 method cũ; map `NoSuchKey`→404; cấu hình checksum R2 |
| `backend/src/orders/domain/attachment-limits.ts` | `SO_ANH_TOI_DA=10`, `KICH_THUOC_TOI_DA_BYTE=10MB`, `MIME_CHO_PHEP`, `kiemTraAnh`, `duoiTuMime`, `tenFileAnToan` | **chỉ đổi chuỗi** thông điệp số lượng | mọi con số; `hasOwnProperty` (vá prototype pollution); `tenFileAnToan` (vá header injection) |
| `backend/src/orders/domain/order-events.ts` | 12 event class | **+2** class | 12 class cũ + `OrderSnapshot` |
| `backend/src/orders/orders.service.ts` | `chuyenTrangThaiThuCong()` `:580`; `anhDinhKem()` `:724`; `findScopedOrThrow()` `:875`; `applyTransition` **private** `:424` | **+3** method đọc/ghi ảnh | `applyTransition` private + chữ ký; `chuyenTrangThaiThuCong` toàn bộ thứ tự 7 bước; `findScopedOrThrow` |
| `backend/src/orders/orders.controller.ts` | 21 route; `TRAN_CUNG_*` `:89-90`; `FileDaTaiLen` `:97`; `quyenCuaNguoiGoi` `:127` | **+3** route | 21 route cũ + gate; trần cứng multer **cao hơn** ngưỡng hợp đồng; kỷ luật route tĩnh trước `:id` |
| `web/.../OrderDetailScreen.tsx` · `mobile/.../order_detail_screen.dart` | 5.4/5.5: stepper + **2 tab** + nút Chuyển trạng thái | **+1 tab** `Ảnh` + luồng thêm/xoá | 2 tab cũ; 4 state loading/error/notfound/empty; ticket chống race; chip read-only; nút Chuyển trạng thái |
| `design-system/screens/order-detail.test.mjs:248-256` | test "exactly the two owned tabs", mảng `notYet` 5 chuỗi ở `:252` | bỏ `'Ảnh đính kèm'`, đổi tên test, **+assert dương** | 4 chuỗi cấm còn lại; 19 test khác |
| `web/.../orders-port.ts` · `mobile/.../orders_port.dart` | 18 method (5.5) | **+4** method, **+1** type | 18 method cũ + hằng status |
| `backend/test/util/fake-storage.ts` | ⚠️ **`interface FakeStorage extends StoragePort` + factory `fakeStorage()` trả object literal** — KHÔNG phải class | **+`deleteObject` vào object literal** (bắt buộc: literal phải thoả interface ⇒ thiếu method là đỏ typecheck ở 9+ spec) | `objects` public; chữ ký `fakeStorage()` |

### Bất biến không được vi phạm

- **AD-3:** bucket **không public**; binary ở R2, DB chỉ metadata + object key. Repo đã chốt
  **proxy** (`StoragePort` không có API signed URL) — đừng "sửa cho khớp" sơ đồ deployment trong
  spine, chỗ đó vẽ signed URL nhưng code mới hơn.
- **AD-11:** story này **KHÔNG** đụng `Order.status`, **KHÔNG** gọi `applyTransition`,
  **KHÔNG** thêm/sửa dòng nào trong `ALLOWED_TRANSITIONS` (vẫn đúng 16 dòng).
- **AD-18:** producer **không** gọi audit/FCM trực tiếp — publish event, `AuditSubscriber` ghi.
  `audit_logs` append-only.
- **AD-5:** envelope lỗi chỉ do `AllExceptionsFilter` dựng; service ném `AppException`.
- **AD-4/AD-15:** phạm vi server-side qua `findScopedOrThrow`; ẩn nút ở client chỉ là UX.
- **AD-17:** literal quyền chỉ ở `permission-registry.ts` — story này **không thêm key mới**.
- **AD-2:** luật `coTheXoa` tính ở **backend**; client chỉ hiển thị. Dựng lại biểu thức ở client là
  bản sao luật thứ hai và nó sẽ lệch.
- **AD-13:** dựng từ component DS; component mới thì thêm vào design-system, **không** vẽ trong screen.
- **AD-12:** contract từ backend → regen OpenAPI → FE mirror. Không bịa field ở FE.
- **UX-DR-19/20/22/23:** đủ 4 state; Dialog nêu hậu quả cho xoá; control thiếu quyền **ẩn hẳn**;
  overlay chồng **tối đa một cấp**; chip trạng thái vẫn read-only.

### Học từ story trước (5.5 / 5.4)

- **5.5 review** bắt 2 lỗi bảo mật ở đúng vùng code story này chạm: allow-list mime bị vượt qua
  **chuỗi prototype** (`MIME_CHO_PHEP['constructor']` trả về hàm ≠ `undefined`), và **tên file
  client** đi thẳng vào `Content-Disposition`. Cả hai đã vá bằng `hasOwnProperty` + `tenFileAnToan()`.
  ⇒ **Đường thêm ảnh của 5.6 phải đi qua đúng hai hàm đó**, không tự viết lại.
- **5.5 đột biến #1** cho thấy gỡ pre-check chỉ đỏ **một** test vì engine là lớp thứ hai.
  ⇒ Ở story này **không có lớp thứ hai** cho `coTheXoa` — nó là lớp **duy nhất**. Test phải canh nó
  trực tiếp; đừng cho rằng "chắc có gì đó đỡ".
- **5.5**: đặt limit multer **bằng** ngưỡng hợp đồng ⇒ 500 thay vì 400. Trần cứng đã có, **dùng lại**.
- **5.4** ship một màn web **không parse được** mà cả bốn lane vẫn xanh.
  ⇒ chạy `npx jest web-source-parses` trước khi đánh `[x]` bất kỳ task web nào.
- **5.4** bị bắt vì tự vẽ lại component DS đã có. ⇒ rủi ro tương đương ở đây: `AppConfirmDialog`
  **đã tồn tại**, `ImageUpload`/`AppImageUpload` **đã tồn tại**. Chỉ `AttachmentGallery` là mới.
- Mobile screen **phải có widget test** — text-guard không "nhìn" thấy màn không render được.
- `dart format -o none` (cờ `--set-exit-if-changed` **vẫn ghi đè file**, lan ra ~20 file);
  **không `git checkout`** để hoàn tác đột biến.

### Nợ kỹ thuật ghi nhận, KHÔNG sửa ở story này

1. **Không thumbnail / không nén.** Lưới hiển thị ảnh gốc (tối đa 10 MB/ảnh) qua proxy. Spine
   `#Deferred` bỏ ngỏ chuyện nén. Với ~20 user nội bộ và vài ảnh/đơn, chấp nhận được; thumbnail là
   story riêng nếu Đại Ca thấy tốn data hiện trường.
2. **Không phân trang gallery.** Không có spec, và trần thực tế là vài chục ảnh/đơn.
3. **Không viewer toàn màn.** Xem "Câu hỏi đã tự quyết" #7.
4. **Bytes mồ côi trên R2 vẫn còn hai đường sinh ra:** (a) `deleteObject` fail sau khi DB đã commit
   (chấp nhận có chủ đích, AC-8); (b) nợ cũ của 5.5 — upload xong rồi transition thua cuộc đua.
   Story này **không** dựng job dọn rác.
5. **Không sniff magic-byte / không quét virus** (nợ 5.5, giữ nguyên).
6. **Đường GHI cũ vẫn chưa scope** (`findOrThrow` unscoped phục vụ `PATCH /:id`, `chot`, …). Ba route
   mới của story này **đều** đi `findScopedOrThrow`; không vá 6+ mutator cũ.
7. **Lệch spine về module `attachments/`** — xem Project Structure Notes.
8. **Web không có tsc/bundler/JSDOM (TD-1).** Assert hành vi dồn vào lane `flutter test`.

### Project Structure Notes

- ⚠️ **Lệch spine CÓ CHỦ ĐÍCH (nối tiếp 5.5):** `ARCHITECTURE-SPINE.md#Backend module tree` +
  `#FR → module → AD map` map FR-23/FR-24 vào module `attachments/`. 5.5 đã đặt trong `orders/` vì
  transition + attachment là **một `$transaction`**. Story 5.6 **giữ nguyên chỗ đó**: tách
  `attachments/` bây giờ sẽ chẻ đôi bề mặt ảnh giữa hai module, và đường đọc/ghi mới **bắt buộc**
  dùng `findScopedOrThrow` — một `private` của `OrdersService`. Tách module buộc phải nới nó thành
  public, đúng cái AD-11/AD-15 muốn tránh. Ghi ở đây để review **không mở lại như finding mới**.
- Backend: DTO trong `orders/dto/`, domain **thuần** trong `orders/domain/`. Test backend **phẳng**
  trong `backend/test/`.
- Hai lane test tách bằng **hậu tố tên file**: hermetic `*.spec.ts` vs DB `*.db.integration.spec.ts`
  (`testPathIgnorePatterns`). `describe.skip` **không** tách được lane.
- Web: screen ở `web/src/screens/orders/`, component DS ở `web/src/design-system/components/`,
  CSS kebab-case cùng thư mục. Text-guard ở **repo root** `design-system/screens/*.test.mjs`,
  **không** ở `web/`.
- Mobile: component DS ở `mobile/lib/design_system/components/`, screen ở `mobile/lib/screens/orders/`,
  test ở `mobile/test/screens/orders/`.
- File/route kebab-case; entity PascalCase; bảng snake_case số nhiều; ngày ISO-8601 UTC (client hiện
  UTC+7). `naming-convention.spec.ts` canh tên file `src/` kebab-case theo từng đoạn dấu chấm.
- Token/icon design-system là **generated** — sửa SSOT rồi `cd design-system && npm run build`.
  `ic-trash`/`ic-camera`/`ic-image`/`ic-close` **đã có** trong `design-system/icons/icons.json`
  (đường dẫn đầy đủ — không có `design-system/icons.json`), **không** cần icon mới.
- ⚠️ `.gitignore` có mục `assets/` từng nuốt file mới. Sinh file ở thư mục lạ thì chạy
  `git check-ignore -v <file>` trước khi tin là đã commit.
- Guard text đọc file **dạng chuỗi** ⇒ tránh viết chuỗi bị cấm (`shadow`, `gradient`, `box-shadow:`,
  `.toUpperCase()`) **kể cả trong comment**.
- Mobile **không dùng BLoC** ở hai màn đơn hàng — `StatefulWidget` + `setState`. Đừng thêm bloc.

### Câu hỏi đã tự quyết (nêu để Đại Ca phủ quyết nếu muốn)

1. **"Quyền chỉnh sửa đơn" = `PERM.quotesCreateEdit`.** FR-24 nói bằng lời, registry không có
   `orders.edit`. `quotesCreateEdit` là key đang gate **mọi** đường ghi đơn hiện có
   (`PATCH /:id`, line-items, meta) ⇒ nó **chính là** quyền chỉnh sửa đơn trong repo này.
2. **Không thêm permission key `attachments.*`.** Thêm key ⇒ phải regen **hai** nơi
   (`npm run permissions:gen` ở backend **và** `npm run build:permissions` ở design-system) và
   `permission-keys.test.mjs` deepEqual PERM↔AppPerm **theo thứ tự** sẽ đỏ nếu lệch. Bộ 21 key đủ
   diễn đạt luật FR-24. Tiền lệ 5.1/5.5.
3. **Route thêm/xoá gate bằng `any-of` bốn key làm việc trên đơn**
   (`quotesCreateEdit`, `constructionTransition`, `deliveryConfirm`, `paymentsRecord`), **không**
   gate bằng cặp `ordersView*`. Lý do: xem đơn không phải là được ghi vào đơn. Thợ thi công có
   `construction.transition` (không có `quotes.create_edit`) vẫn phải thêm được ảnh nghiệm thu —
   đó là ca dùng thật của FR-24. Cửa **thật** cho việc xoá vẫn là luật hàng (AC-6).
4. **Hard delete, không `deletedAt`.** Spec im lặng; 5.5 cố tình không thêm cột. Vết đã nằm ở
   `audit_logs` (append-only, bất biến) — đó chính là chỗ FR-24 đòi. Thêm cột soft-delete là thêm
   một trạng thái phải lọc ở mọi truy vấn về sau, đổi lấy một khả năng khôi phục chưa ai yêu cầu.
5. **10 ảnh / lượt tải lên, không cap tổng theo đơn.** Tái dùng nguyên `SO_ANH_TOI_DA` của 5.5, chỉ
   sửa **chuỗi thông điệp** cho hết mùi transition. Cap tổng là số bịa, chưa ai đòi.
6. **Không migration.** Ba cột toạ độ đã nullable đúng cho ca này; bảng đã có **hai** index
   (`@@index([orderId])` và `@@index([orderId, occurredAt])`, `schema.prisma:532-533`) — thừa sức cho
   vài chục hàng/đơn. Thêm `@@index([orderId, createdAt])` là tối ưu cho quy mô không tồn tại — và
   mọi migration ở repo này đều sinh **offline**, chưa từng chạy `migrate deploy`, nên mỗi migration
   là một rủi ro chưa được kiểm.
7. **Danh sách PHẲNG theo `createdAt` giảm dần, không nhóm theo bước; không viewer toàn màn.**
   AC-1 đòi "thấy toàn bộ ảnh (theo bước + bổ sung)" — badge `Bước: {từ} → {đến}` / `Bổ sung` trên
   từng ảnh nói đủ chuyện đó mà không đẻ hai chế độ hiển thị.
   ⚠️ **Không sắp theo `occurredAt`**: cột đó `null` cho **mọi** ảnh bổ sung ⇒ vị trí không xác định.
   Viewer toàn màn bị loại vì viewer + dialog xoá = **hai tầng overlay**, vi phạm UX-DR-20; và không
   có spec nào đòi viewer.
8. **Không gate theo trạng thái đơn.** Thêm ảnh vào đơn đã `hoanthanh` (bổ sung biên bản) hoặc đã
   `huy` (lưu bằng chứng lý do) là ca dùng thật, và FR-24 nói "bất cứ lúc nào". Spec im lặng ⇒ chọn
   không chặn.
9. **Component gallery MỚI, không bẻ `ImageUpload`.** Picker là component **ghi** cho file cục bộ
   (`Image.file`/object URL), có source-guard cấm mạng, không mang `nguoiTaiLen`/`createdAt`, và nút
   xoá của nó là xoá-ngay-không-hỏi. Gallery là component **đọc** cho ảnh trên server, có badge bước,
   có metadata, có xoá qua Dialog, và cũng **không** chạm mạng — screen bơm bytes vào.
10. **`AttachmentAdded` gộp cả lượt (mảng id + số ảnh), `AttachmentRemoved` một hàng một event.**
    Thêm là một hành động của người dùng dù chọn 5 ảnh; xoá là từng ảnh một. Audit đọc lên khớp
    đúng cái người dùng đã làm.
11. **Xoá R2 SAU commit và nuốt lỗi.** Xem AC-8. Một lần xoá đã commit không được biến thành lỗi 500
    chỉ vì R2 chớp; hậu quả xấu nhất là bytes mồ côi — vô hình với mọi endpoint vì không còn hàng
    nào trỏ tới.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.6` L518-523 — AC 1-3 nguyên văn]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.5` L511-516 — ranh giới FR-23, phần KHÔNG thuộc 5.6]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.7` L525-531 — huỷ đơn thuộc story sau; 5.6 không thêm affordance huỷ]
- [Source: `.../prd.md#4.10 Đính kèm hình ảnh (bằng chứng & bổ sung) — FR-24` — "Xem được toàn bộ ảnh của Đơn (cả ảnh theo bước lẫn ảnh bổ sung), kèm mốc thời gian và người tải lên"; "Xoá ảnh: chỉ **người đã tải lên** hoặc người có **quyền chỉnh sửa đơn hàng**. Thêm/xoá ảnh ghi Audit log."]
- [Source: `.../prd.md#4.10 — FR-23` — sở hữu của 5.5: ảnh gắn đúng bước (đơn, từ→đến, thời điểm)]
- [Source: `.../prd.md#Open Questions` + `#Assumptions traceability` — giới hạn định dạng/dung lượng đẩy về Architecture ⇒ đã chốt bằng code ở 5.5]
- [Source: `.../prd.md#NFR` — "~20 user nội bộ", "solo dev — ưu tiên đơn giản, ít phụ thuộc hạ tầng phức tạp"]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-3` — "binary lưu R2… DB chỉ lưu metadata + object key. Upload/đọc qua backend (signed URL hoặc proxy); không public bucket" ⇒ repo chọn proxy]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-4` — backend enforce mọi request; client gating chỉ UX]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-5` — envelope `{code, message, fieldErrors?, traceId}`, filter trung tâm là nơi DUY NHẤT dựng]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-11` — "nơi duy nhất phát bản ghi Audit" nói về audit CỦA TRANSITION; xem Task 2 để hoà giải với FR-24]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-17` — không permission literal ngoài registry]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-18` — publish domain event; producer KHÔNG gọi audit trực tiếp]
- [Source: `.../ARCHITECTURE-SPINE.md#API & Data Conventions` — "AuditLog bất biến … cho **mọi mutation nghiệp vụ**"; route sub-resource; ISO-8601 UTC]
- [Source: `.../ARCHITECTURE-SPINE.md#Core-entity ERD` — chỉ có `ORDER ||--o{ ATTACHMENT` và `ACCOUNT ||--o{ ATTACHMENT`; **KHÔNG** ràng buộc `ORDER_VERSION` ⇒ ảnh sống theo Đơn, không theo bản update]
- [Source: `.../ARCHITECTURE-SPINE.md#Deferred` — "Giới hạn định dạng/dung lượng ảnh … + nén để lại cho implementation"]
- [Source: `.../ARCHITECTURE-SPINE.md#Backend module tree` + `#FR → module → AD map` — spine map FR-24 → `attachments/`; story lệch có chủ đích, xem Project Structure Notes]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-25` — mobile chụp/chọn thư viện, web chọn file; upload luôn optional]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-20` · `.../EXPERIENCE.md#Component Patterns` — Dialog cho hành động có hệ quả; **overlay chồng tối đa một cấp**]
- [Source: `.../EXPERIENCE.md#State cho danh sách & màn` — hàng `Confirm` liệt kê **Xoá**: "Dialog xác nhận có hệ quả; nêu rõ hậu quả"]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-19` — Loading skeleton · Empty câu Việt ngắn · Error + "Thử lại"]
- [Source: `_bmad-output/planning-artifacts/epics.md#UX-DR-22` · `.../EXPERIENCE.md#Phân quyền hiển thị theo quyền` — control thiếu quyền **ẩn hẳn**, không disable xám]
- [Source: `.../EXPERIENCE.md#Information Architecture` — `s-order-detail`: "Trạng thái, lịch sử bản update, **ảnh**, hành động" ⇒ ảnh là surface CỦA màn chi tiết, không phải màn riêng]
- [Source: `.../EXPERIENCE.md#Interaction Primitives` — "Long-press dành cho chọn text hệ thống" ⇒ không long-press-để-xoá]
- [Source: `.../EXPERIENCE.md#Accessibility Floor` — touch target ≥ 48dp; nút icon-only cần `aria-label`; Esc đóng dialog trên cùng]
- [Source: `.../DESIGN.md#Shapes` — thumbnail bo góc **10px**, ảnh bám đúng góc container]
- [Source: `backend/prisma/schema.prisma:504-535` — model `Attachment`; comment `:504-516` ghi rõ 3 cột toạ độ nullable là **dành cho story này**; 2 index `:532-533`]
- [Source: `backend/prisma/schema.prisma#Account` — `displayName String @map("display_name")` ⇒ đây là trường `nguoiTaiLen`]
- [Source: `backend/src/orders/domain/attachment-limits.ts` — `SO_ANH_TOI_DA=10` `:15`, `KICH_THUOC_TOI_DA_BYTE` `:18`, `MIME_CHO_PHEP` `:26`, `duoiTuMime` `:64`, `tenFileAnToan` `:78`, `kiemTraAnh` `:95`, thông điệp cần sửa `:101`]
- [Source: `backend/src/orders/orders.service.ts:580-700` — `chuyenTrangThaiThuCong()` khuôn upload; `:644-651` cách dựng object key; `:724-732` `anhDinhKem()`; `:875-900` `findScopedOrThrow()`]
- [Source: `backend/src/orders/orders.controller.ts:89-90` — `TRAN_CUNG_SO_ANH`/`TRAN_CUNG_KICH_THUOC_BYTE` **cao hơn** ngưỡng hợp đồng có chủ đích; `:97-102` `FileDaTaiLen`; `:127-131` `quyenCuaNguoiGoi`; `:633-656` khuôn `@Delete`; `:831-864` khuôn route ảnh đã có]
- [Source: `backend/src/storage/storage.port.ts` · `r2-storage.adapter.ts` · `storage.module.ts` — chỉ `putObject`/`getObject`; `OrdersModule` đã import `StorageModule`]
- [Source: `backend/src/orders/domain/order-events.ts:221-240` — `QuoteExported` là khuôn event KHÔNG đổi status]
- [Source: `backend/src/accounts/domain/permission-registry.ts` — 21 key; không có `orders.edit`, không có `attachments.*`]
- [Source: `backend/test/util/fake-storage.ts` — `FakeStorage extends StoragePort`; phải theo kịp mọi thay đổi port]
- [Source: `backend/package.json` — `test` (hermetic, ignore `\.db\.integration\.spec\.ts$`) · `test:db` · `openapi:gen` · `permissions:gen`]
- [Source: `web/src/design-system/components/ConfirmDialog.tsx` — `{open, title, consequence, confirmLabel='Xác nhận', cancelLabel='Huỷ', tone, onConfirm, onCancel}`]
- [Source: `mobile/lib/design_system/components/dialog.dart:161-181` — **`AppConfirmDialog` ĐÃ TỒN TẠI**, export ở `components.dart:37`, `confirmTone` mặc định `danger`]
- [Source: `web/src/design-system/components/ImageUpload.tsx` · `mobile/lib/design_system/components/image_upload.dart` — picker cho file CỤC BỘ, có source-guard cấm mạng; `AppImageUpload` tự mở `AppSheet`]
- [Source: `web/src/screens/orders/OrderStatusChangeScreen.tsx:51-64,116-163` — `SO_ANH_TOI_DA`, khuôn hai state `AnhDaChon`, revoke object URL sau khi gửi]
- [Source: `web/src/screens/orders/OrderDetailScreen.tsx:67-76` · `mobile/lib/screens/orders/order_detail_screen.dart:47-55` — khối hằng 2 tab + comment "Ảnh is Story 5.6"]
- [Source: `design-system/screens/order-detail.test.mjs:248-256` — test cấm tab thứ ba; **story này phải sửa**]
- [Source: `design-system/permissions/permission-keys.test.mjs` — `deepEqual` PERM ↔ AppPerm theo **thứ tự**]
- [Source: `_bmad-output/implementation-artifacts/5-5-*.md#Senior Developer Review` — HIGH-2 prototype pollution ở allow-list mime; MEDIUM-3 tên file client vào `Content-Disposition`; nợ `deleteObject` chỉ đích danh 5.6]
- [Source: `_bmad-output/implementation-artifacts/5-5-*.md#Debug Log References` — lane DB chưa chạy vì Docker; đột biến phải compile được]

---

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code, workflow `bmad-dev-story`)

### Debug Log References

**Hai lỗi do lane widget test mobile bắt được — text-guard không thấy nổi:**

1. **`AppConfirmDialog` tự pop route rồi mới gọi `onConfirm`.** Bản đầu của
   `_hoiXoaAnh()` dùng khuôn `showAppDialog<bool>` + `Navigator.pop(true)` trong `onConfirm`;
   route đã bị dialog pop trước đó nên `pop(true)` bắn vào route bên dưới, `showAppDialog`
   resolve `null`, và **xoá không bao giờ chạy**. Test "delete confirmed" đỏ với
   `Expected: ['anh-hai'] / Actual: []`. Sửa theo khuôn thật của repo (`create_quote_screen.dart`):
   hành động treo thẳng vào `onConfirm`, không pop lần hai.

2. **Tab thứ ba làm hàng `Trạng thái` ở tab Thông tin tràn 12px** ở bề ngang điện thoại —
   **KHÔNG phải lỗi story này**: test đầu tiên chưa hề mở tab `Ảnh`, `RenderFlex` tràn nằm
   trong `_facts()` (code 5.4, không đụng tới). Nguyên nhân là fixture dùng status dài
   (`thicong` → chip `Đang thi công`) cộng label cố định 120px. Fixture đã đổi về status ngắn
   + ghi chú tại chỗ; **lỗi layout 5.4 vẫn còn, báo ở Completion Notes**, không sửa lén ngoài scope.

**Guard mới tự bắt lỗi của chính nó (2 vòng):**
- `Bổ sung` được assert nhầm ở tầng screen — nhãn đó sống trong **component** gallery. Đã chuyển
  assert về đúng tầng.
- Regex cấm permission-literal `['"][a-z_]+\.[a-z_]+['"]` ăn false-positive vào import Dart
  `'discount_approval_screen.dart'`. Đã loại trừ theo **đuôi file**, giữ nguyên độ chặt của lệnh cấm.

**Đột biến (5/5 chết đúng chỗ, hoàn tác bằng `cp`, không `git checkout`):**

| # | Đột biến | Kết quả |
|---|---|---|
| 1 | `coTheXoa` → hằng `true` | **4 đỏ** — 3 unit AC-6 + 1 e2e AC-7 |
| 2 | Đảo thứ tự xoá thành R2-trước-DB | **2 đỏ** — cả hai test AC-8 |
| 3 | Bỏ `findScopedOrThrow` khỏi route xoá | **1 đỏ** — AC-5 (ca ba route) |
| 4 | `createMany` ghi `statusFrom/To` = trạng thái hiện tại | **2 đỏ** — unit AC-9 + e2e AC-9 |
| 5 | Đổi nhãn `Chưa có ảnh nào.` ở mobile | **2 đỏ** — byte-parity + four-states |

Mọi đột biến đều compile được (đột biến #1 giữ chữ ký hàm bằng `void` các tham số), nên cái đỏ
là test bắt được hành vi, không phải suite chết vì lỗi cú pháp.

**Lane ĐÃ CHẠY:** `backend npm test` (72 suite / 1264 test) · `backend npx jest web-source-parses`
(2 test — lane duy nhất chứng minh `.tsx` parse) · `design-system npm test` (354 test) ·
`mobile flutter test` (245 test, +10 mới) · `mobile flutter analyze lib test` (sạch) ·
`backend npx tsc --noEmit` (sạch) · `npm run openapi:gen` (drift-guard byte-for-byte xanh).

**Lane CHƯA CHẠY:** `backend npm run test:db` — `docker info` trả về daemon chưa lên, và
`open -a Docker` từ shell agent không tạo được socket. Spec
`backend/test/order-attachments.db.integration.spec.ts` **đã viết và đã typecheck sạch**, tự skip
khi vắng `DATABASE_URL`. **Không đánh dấu hoàn thành 3 checkbox của lane này** — nối tiếp cách 5.5
để lại, không giả xanh.

### Completion Notes List

- **Không migration**: ba cột toạ độ (`statusFrom`/`statusTo`/`occurredAt`) đã nullable sẵn cho
  đúng ca này; ảnh bổ sung ghi cả ba `null`.
- **`coTheXoa` là lớp DUY NHẤT** của luật FR-24 — tính ở backend, client chỉ hiển thị. Test canh
  trực tiếp (3 ca unit + 1 ca e2e qua dây) chứ không dựa vào "chắc có gì đó đỡ".
- **Thứ tự xoá DB→R2** với lỗi R2 bị nuốt có chủ đích: hậu quả xấu nhất là bytes mồ côi, vô hình
  với mọi endpoint. Chiều ngược lại làm vỡ gallery.
- **Không thêm permission key** ⇒ không phải regen hai nơi, `permission-keys.test.mjs` không bị đụng.
- **Trần cứng multer tái dùng nguyên** `TRAN_CUNG_*` (×2 ngưỡng hợp đồng) — e2e chứng minh ảnh sai
  định dạng vẫn ra **400 + `fieldErrors`**, không phải 500.
- **AC-11 tự nhiên xanh**: `no-order-status-write-outside-transition.spec.ts` không phải nới
  allow-list, đúng như story dự đoán — guard chỉ quét model `order` có `status` trong `data`.
- **Guard component vs screen tách đúng tầng**: "gallery không chạm mạng" (AC-16) nằm ở
  `behavior-components.test.mjs` cạnh cặp song sinh `ImageUpload`; nhãn + luật client nằm ở
  `screens/order-attachments.test.mjs`.
- **Ba map viết tay đã đăng ký** (chúng không tự đỏ): parity component ×2, a11y icon-only ×2
  (web + mobile), parity session.

**Phát hiện NGOÀI scope, KHÔNG sửa ở story này:**

> `mobile/lib/screens/orders/order_detail_screen.dart` — hàng `Trạng thái` của tab **Thông tin**
> (code Story 5.4) **tràn `RenderFlex` ở bề ngang điện thoại** khi nhãn trạng thái dài
> (`Đang thi công`, `Hoàn thành`): `SizedBox(width: 120)` + `AppStatusChip` vượt 286px khả dụng.
> Suite 5.4 không bắt được vì fixture của nó dùng `baogia` (`Báo giá` — nhãn ngắn). Đây là lỗi
> hiển thị thật trên đơn đang thi công. Đề xuất: bọc chip trong `Expanded`/`Flexible`, hoặc thu
> cột nhãn — nhưng đó là sửa surface của 5.4, cần Đại Ca quyết định phạm vi.

### File List

**Backend — mới**
- `backend/src/orders/dto/attachment-response.dto.ts`
- `backend/test/order-attachments.spec.ts`
- `backend/test/order-attachments.db.integration.spec.ts` (lane chưa chạy — Docker)

**Backend — sửa**
- `backend/src/storage/storage.port.ts`
- `backend/src/storage/r2-storage.adapter.ts`
- `backend/src/orders/domain/order-events.ts`
- `backend/src/orders/domain/attachment-limits.ts`
- `backend/src/orders/orders.service.ts`
- `backend/src/orders/orders.controller.ts`
- `backend/openapi/openapi.json` (regen)
- `backend/test/util/fake-storage.ts`
- `backend/test/r2-storage.adapter.spec.ts`
- `backend/test/orders-read-gate.spec.ts`
- `backend/test/orders.e2e.spec.ts`

**Web — mới**
- `web/src/design-system/components/AttachmentGallery.tsx`

**Web — sửa**
- `web/src/design-system/components/index.ts`
- `web/src/design-system/session/orders-port.ts`
- `web/src/design-system/session/fake-orders-port.ts`
- `web/src/screens/orders/OrderDetailScreen.tsx`

**Mobile — mới**
- `mobile/lib/design_system/components/attachment_gallery.dart`
- `mobile/test/screens/orders/order_detail_attachments_test.dart`

**Mobile — sửa**
- `mobile/lib/design_system/components/components.dart`
- `mobile/lib/design_system/session/orders_port.dart`
- `mobile/lib/design_system/session/fake_orders_port.dart`
- `mobile/lib/screens/orders/order_detail_screen.dart`

**Design-system guard — mới**
- `design-system/screens/order-attachments.test.mjs`

**Web — sửa (thêm ở vòng review)**
- `web/src/design-system/components/components.css` (style cho gallery — trước đó component gọi 5 class không tồn tại)
- `web/src/screens/orders/order-detail.css` (style cho khối tab `Ảnh`)

**Design-system guard — sửa**
- `design-system/screens/order-detail.test.mjs`
- `design-system/components/parity.test.mjs`
- `design-system/components/behavior-components.test.mjs`
- `design-system/components/a11y-floor.test.mjs`
- `design-system/session/parity.test.mjs`

**Tracking**
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

**Người review:** Đại Ca (AI) · **Ngày:** 2026-07-18 · **Kết quả:** Approve sau khi tự sửa
**0 CRITICAL** — không có task `[x]` nào khai khống, mọi AC đều có code và test thật, ba map viết
tay đều đã đăng ký, 5 đột biến của dev đều tái lập được.

### Đã sửa trong vòng review (4)

**HIGH-1 — Web gallery gọi 8 class CSS KHÔNG TỒN TẠI.**
`AttachmentGallery.tsx` dùng `attachment-gallery/-item/-delete/-badge/-meta`, `OrderDetailScreen.tsx`
dùng `od-anh/-them/-title` — không class nào có rule ở đâu cả. Hậu quả thật, không phải lý thuyết:
`<figure>` giữ nguyên margin mặc định UA `1em 40px` ⇒ mỗi thumbnail cách nhau 40px; ba `<span>` trong
`figcaption` là inline ⇒ badge + tên người + thời gian dính liền một dòng
(`Bổ sungNguyễn Văn A2026-07-18T…`). Không lane nào bắt được: text-guard đọc file dạng chuỗi, web
không có bundler/JSDOM (TD-1). Đã thêm rule vào `components.css` + `order-detail.css`.
⇒ Đây đúng là họ lỗi của bài học 5.4 ("ship màn web chết mà bốn lane vẫn xanh"), chỉ khác tầng: 5.4
là cú pháp, lần này là style.

**HIGH-2 — Object URL của preview KHÔNG BAO GIỜ được revoke (rò bộ nhớ).**
`loadAnh()` tạo `URL.createObjectURL()` cho mỗi ảnh nhưng không giữ tham chiếu để trả lại. Mỗi lần
mở lại tab / thêm ảnh / xoá ảnh / bấm `Thử lại` là một lượt tạo mới, bỏ lại lượt cũ; ảnh vừa xoá vẫn
nằm trong `anhPreviews`. Trình duyệt giữ NGUYÊN blob sống tới khi revoke — 10 MB/ảnh × vài lượt reload
là hàng trăm MB ghim vô ích. Nghịch lý là khuôn 5.5 revoke đúng cho ảnh **đã chọn** (`boAnhDaChon`,
`guiAnh`) nhưng đường **đọc** thì quên. Đã thêm ref `anhUrls` + revoke khi reload, khi ticket cũ bị
vượt, và khi unmount.

**MEDIUM-1 — `POST /orders/:id/anh` không ảnh nào ⇒ 201 + một hàng audit SAI.**
`kiemTraAnh([])` trả hợp lệ có chủ đích (kèm ảnh là optional khi chuyển trạng thái, FR-23) nên lượt
rỗng đi thẳng qua service: 0 hàng tạo, nhưng `AttachmentAdded` vẫn publish ⇒ `AuditSubscriber` ghi
một vết nói "đã thêm ảnh" trong khi không có ảnh nào. FR-24 đòi audit cho thêm/xoá ảnh; một vết audit
sai còn tệ hơn không có vết. Sửa **tại `themAnh()`**, KHÔNG đụng `kiemTraAnh()` — đường 5.5 vẫn phải
chấp nhận mảng rỗng. Nay 400 `VALIDATION_ERROR` + `fieldErrors[0].code = 'minCount'`, có test canh
(`createMany` không gọi, `publish` không gọi).

**MEDIUM-2 — Mobile `_anhBytes` không bao giờ dọn.** Bytes của ảnh đã xoá nằm lại trong map suốt đời
màn hình. Đã `clear()` khi bắt đầu mỗi lượt `_loadAnh()`, cùng lý do với HIGH-2.

### Guard thêm mới (để HIGH-1 không quay lại)

`behavior-components.test.mjs`: mọi `className` của `AttachmentGallery.tsx` phải có rule thật trong
`components.css`. Guard này tự chứng minh ngay lúc viết — nó bắt đỏ **hai** lần trước khi xanh:
`.muted` (nợ cũ, xem dưới) rồi `.attachment-gallery` (rule tôi quên viết ở lượt sửa đầu).

### Phát hiện NGOÀI scope, KHÔNG sửa

1. **`.micro` và `.muted` không được định nghĩa ở BẤT KỲ stylesheet nào trong repo**, nhưng được
   nhiều component web gọi (`ImageUpload.tsx`, `Skeleton`, gallery mới…). Đây là nợ có sẵn, không
   phải của story này ⇒ guard mới loại trừ đúng hai tên này, ghi rõ lý do tại chỗ thay vì làm xanh
   bằng ngoại lệ câm. Nên xử lý ở một story dọn CSS riêng.
2. **`RenderFlex` tràn ở hàng `Trạng thái` tab Thông tin (code 5.4)** — dev đã báo ở Completion Notes;
   review xác nhận là lỗi thật và vẫn thuộc surface 5.4, cần Đại Ca quyết định phạm vi.
3. **File story bị lẫn 2 dòng rác `</content>`/`</invoke>` ở cuối** (vết tool-call rò ra lúc ghi
   file). Đã cắt bỏ — không ảnh hưởng code.

### Đã kiểm và BÁC BỎ (nêu để không mở lại)

- `Stack`+`Positioned` cho nút xoá ở mobile **không** vi phạm "không absolute position" của Task 7:
  `image_upload.dart:123` đã dùng đúng khuôn đó cho nút xoá của picker từ story trước.
- `createdAt` hiển thị nguyên chuỗi ISO **không** phải lỗi story này: `_versionRow` (5.4) và
  `od-mono` của web đã hiển thị y hệt. Đổi ở đây sẽ là bản định dạng thứ ba, lệch với hai chỗ kia.
- Bytes mồ côi khi `createMany` fail sau `putObject` — đã ghi là nợ có chủ đích (#4), không mở lại.

### Lane đã chạy sau khi sửa

`backend npx tsc --noEmit` (sạch) · `backend npm test` **72 suite / 1272 test xanh** ·
`backend npx jest web-source-parses` (2 xanh) · `design-system npm test` **355 xanh** (+1 guard mới) ·
`mobile flutter test` **245 xanh** · `mobile flutter analyze lib test` (sạch).
**Lane DB vẫn CHƯA chạy** — Docker daemon chưa lên; 3 checkbox của lane để trống đúng như dev để lại,
không giả xanh.

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-18 | Story 5.6 — đính kèm ảnh bổ sung trong chi tiết đơn. Backend: `StoragePort.deleteObject()`, 2 domain event (`AttachmentAdded`/`AttachmentRemoved`), 3 route (`GET`/`POST` `/orders/:id/anh`, `DELETE /orders/:id/anh/:attachmentId`) với `coTheXoa` tính ở backend và thứ tự xoá DB→R2. FE: component gallery `AttachmentGallery`/`AppAttachmentGallery` (không chạm mạng), tab thứ ba `Ảnh` nạp lazy trên cả hai nền tảng, xoá qua Dialog nêu hậu quả. Không migration, không thêm permission key. Lane DB chưa chạy (Docker chưa bật) — spec đã viết, 3 checkbox để trống có chủ đích. |
| 2026-07-18 | Review: 0 CRITICAL. Tự sửa 4 lỗi — web gallery gọi 8 class CSS không tồn tại (figure giữ margin UA 40px, caption dính một dòng); object URL preview không bao giờ revoke (rò blob 10 MB/ảnh mỗi lượt reload); POST không ảnh nào ⇒ 201 + hàng audit sai (nay 400 `minCount`); mobile `_anhBytes` không dọn. Thêm guard chặn class CSS không tồn tại. |
