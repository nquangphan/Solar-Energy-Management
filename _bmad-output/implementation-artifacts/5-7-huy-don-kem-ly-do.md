---
baseline_commit: bb91139b6c9704d6eadce9c50725bde2150f948d
---

# Story 5.7: Huỷ đơn kèm lý do

Status: done

## Story

As a người có quyền,
I want huỷ đơn kèm lý do,
so that đóng đơn không tiếp tục mà vẫn lưu vết đầy đủ ai huỷ, khi nào, vì sao.

> ⚠️ Tiêu đề và "so that" ở đây **hẹp hơn** `epics.md:525-526` (bản gốc: "Huỷ đơn — giải phóng reserved, phiếu nhập trả khi đã xuất" / "…vẫn lưu vết **tồn kho**"). Thu hẹp là có chủ đích — xem **"Ranh giới với Epic 6"**. Đừng coi bản hẹp này là bản đầy đủ của AC gốc.

## ⚠️ Đọc trước khi gõ dòng code đầu tiên

**1. Cạnh `huy` ĐÃ TỒN TẠI trong bảng transition — đừng thêm lại.**
`backend/src/orders/domain/allowed-transition.ts:190-207` đã khai đúng 3 dòng, `requires: PERM.quotesCreateEdit`, không `scopeGuard`:

```ts
{ event: SU_KIEN.huy, from: TRANG_THAI_BAO_GIA, to: TRANG_THAI_HUY, requires: PERM.quotesCreateEdit },
{ event: SU_KIEN.huy, from: TRANG_THAI_DA_CHOT, to: TRANG_THAI_HUY, requires: PERM.quotesCreateEdit },
{ event: SU_KIEN.huy, from: TRANG_THAI_DA_COC,  to: TRANG_THAI_HUY, requires: PERM.quotesCreateEdit },
```

Bảng hiện có **19 dòng** (`grep -c "from:" allowed-transition.ts` = 19). Story doc 5.5/5.6 ghi "16 dòng" — **số cũ, đừng chép**.

**2. `buocKeTiep` KHÔNG BAO GIỜ trả `huy` — và đó là cố ý.**
`huy` bị loại tường minh khỏi `SU_KIEN_THU_CONG` (`allowed-transition.ts:278-284`, chỉ 5 sự kiện: `batDauThiCong`, `xongThiCong`, `batDauGiao`, `xongGiao`, `hoanThanh`). Comment `:275` nói thẳng: `` `huy` → Story 5.7: bắt buộc lý do ``.

⇒ **Hệ quả bắt buộc:** nút "Huỷ đơn" **không thể** gate bằng `buocKeTiep.length > 0` như nút "Chuyển trạng thái". Và client **không được** tự suy `status ∈ {baogia, dachot, dacoc}` — AD-2 cấm business logic ở client. Vì vậy Task 4 thêm cờ `coTheHuy` do backend tính.

⚠️ Guard status-literal hiện có (`order-detail.test.mjs:154-179`) chỉ cấm `thicong`/`nghiemthu`/`danggiao`/`dagiao`/`dacoc`/`hoanthanh` — **không** cấm `baogia`, `dachot`, `huy`. Nó **không** bịt lỗ này; guard mới ở Task 9 mới bịt.

**2b. Nút "Huỷ đơn" sẽ TÀNG HÌNH ở `baogia` nếu đặt vào `.od-actions` như hiện trạng.**
Cả hai container action đang bọc trong điều kiện `buocKeTiep`: web `OrderDetailScreen.tsx:361` (`{buocKeTiep.length > 0 && onChangeStatus && (<div className="od-actions">…`), mobile `order_detail_screen.dart:293` (`if (_buocKeTiep.isNotEmpty && widget.onChangeStatus != null)`). Ở `baogia` các cạnh khả dụng là `apChietKhau`/`chot`/`huy` — **không cạnh nào** thuộc `SU_KIEN_THU_CONG` ⇒ `buocKeTiep === []` ⇒ **cả khối biến mất**, kéo nút Huỷ đi theo. `baogia` lại chính là trạng thái huỷ nhiều nhất.

⇒ Task 7/8 phải **nâng container lên** trước, rồi mỗi nút giữ điều kiện riêng:
```tsx
{((buocKeTiep.length > 0 && onChangeStatus) || coTheHuy) && (
  <div className="od-actions">
    {buocKeTiep.length > 0 && onChangeStatus && <Button variant="primary" …>Chuyển trạng thái</Button>}
    {coTheHuy && <Button variant="danger" …>Huỷ đơn</Button>}
  </div>
)}
```

**3. `huy` KHÔNG phải một nấc stepper.** Nó nằm trong `SU_KIEN_KHONG_PHAI_BUOC_TIEN` (`allowed-transition.ts:345-349`) — vòng đời tiến lên là DAG, huỷ không nằm trong đó. **Không đụng `buocVongDoi()`**, không thêm nấc nào vào stepper.

**4. Tồn kho `reserved` NẰM NGOÀI story này.** Xem "Ranh giới với Epic 6" bên dưới. Không có model tồn kho nào tồn tại trong repo.

**5. Web không có tsc.** Sau khi sửa `.tsx`, chạy `cd backend && npx jest web-source-parses` — đây là lane DUY NHẤT parse được `.tsx` (bài học 5.4 CRITICAL-1: file `.tsx` lỗi cú pháp mà cả 4 lane vẫn xanh).

---

## Acceptance Criteria

### AC gốc (nguyên văn từ epics)

- **AC-1** — **Given** một Đơn ở trạng thái cho phép huỷ, **When** người có quyền huỷ, **Then** đi qua `applyTransition()` sang "Huỷ", bắt buộc nhập lý do (FR-9, AD-11).
- **AC-2** — **Given** hành động huỷ **TRƯỚC khi xuất kho**, **When** xác nhận, **Then** qua Dialog nêu hậu quả; huỷ `StockMovement` → **giải phóng `reserved`** ngay; ghi Audit + publish `StatusChanged` (UX-DR-20, AD-18).
- **AC-3** — **Given** hành động huỷ **SAU khi xuất kho** (đã giảm `onHand`), **When** xác nhận, **Then** **KHÔNG tự cộng tồn**; phải tạo **phiếu nhập trả** từ lúc xuất để lên tồn lại.
- **AC-4** — **Given** huỷ, **When** xác nhận, **Then** publish `StatusChanged` + ghi Audit.

> **Phân định AC-2 / AC-3 (quyết định phạm vi — xem "Ranh giới với Epic 6"):** phần tồn kho của AC-2 và toàn bộ AC-3 **không thực thi được ở story này** vì không có model tồn kho nào tồn tại. 5.7 đóng phần **Dialog nêu hậu quả + Audit + `StatusChanged`** của AC-2, và đóng AC-3 **theo nghĩa phủ định**: đường huỷ **không được chạm tồn kho bằng bất cứ cách nào** (AC-11 khoá điều này bằng test).

### AC bổ sung (dẫn xuất — bắt buộc để đóng story)

- **AC-5** — `POST /orders/:id/huy` với body `{ lyDo }`. Lý do rỗng / chỉ khoảng trắng / < 3 ký tự sau trim ⇒ **400** `VALIDATION_ERROR` kèm `fieldErrors: [{ field: 'lyDo', ... }]` qua exception filter trung tâm (AD-5). Tối đa 500 ký tự.
- **AC-6** — Actor thiếu `quotes.create_edit` ⇒ **403** `FORBIDDEN`, status **không đổi**. Đơn ở trạng thái không có cạnh huỷ (`choduyet`, `thicong`, `nghiemthu`, `danggiao`, `dagiao`, `hoanthanh`, hoặc đã `huy`) ⇒ **409** `CONFLICT`. Cả hai đi qua `evaluateTransition()`, không tự viết luật.
- **AC-7** — Đơn không thuộc phạm vi xem của actor ⇒ **404** qua `findScopedOrThrow()`, không rò rỉ sự tồn tại của đơn.
- **AC-8** — Lý do lưu vào `Order.cancelReason` + `Order.cancelledAt` (migration mới), ghi **trong cùng `$transaction`** với lệnh đổi status. Publish **`OrderCancelled`** (mang `lyDo`) **và** `StatusChanged`, cả hai **SAU commit**.
- **AC-9** — `GET /orders/:id/vong-doi` trả thêm `coTheHuy: boolean`, tính từ `ALLOWED_TRANSITIONS` × trạng thái hiện tại × quyền thật của actor. `false` ⇒ client ẩn hẳn nút, không vẽ xám (UX-DR-22).
- **AC-10** — Web + mobile: nút "Huỷ đơn" (variant `danger`) trong khối `Vòng đời đơn`; bấm mở **Dialog** (không phải màn) nêu hậu quả + ô lý do bắt buộc; nhãn tiếng Việt **byte-identical** hai nền tảng (UX-DR-27). Đơn đã huỷ hiển thị lý do ở tab Thông tin.
- **AC-11** — Đường huỷ **không chứa** bất kỳ lệnh ghi nào chạm tồn kho (`StockMovement`, `StockItem`, `onHand`, `reserved`) — khoá bằng source-guard, để Epic 6 nối vào seam thay vì gỡ code sai.
- **AC-12** — Mọi source-guard hiện có giữ xanh: không status literal ở client, không permission literal ở client, không ghi `Order.status` ngoài `applyTransition`, Viền nét (0 shadow/gradient), route mới có `@RequirePermissions`, `openapi.json` không drift.

---

## Ranh giới với Epic 6 (quyết định phạm vi — Đại Ca phủ quyết được)

**Sự thật đã verify:** không tồn tại model/cột/module tồn kho nào. `grep -n "StockMovement|StockItem|reserved|onHand" backend/src backend/prisma` chỉ ra 8 hit, **toàn bộ là comment nhắc tới tương lai** + key `inventory.manage` chưa có module tiêu thụ. 19 model Prisma hiện tại không có model tồn kho. Retro Epic 4 ghi TD-29: mô hình tồn kho thuộc **Epic 6.6**.

**Quyết định:** 5.7 **KHÔNG** dựng tồn kho. Lý do:

1. Luật build-order của dự án: *"Mỗi story tạo/sửa CHỈ entity/file nó cần; không phụ thuộc story sau"* — dựng `StockMovement`/`StockItem` ở 5.7 là kéo nguyên Story 6.2 + 6.6 vào một story vòng đời đơn.
2. `epics.md:600-605` **đã có Story 6.7 "Phiếu nhập trả khi huỷ đơn đã xuất kho"** với AC riêng (`tăng lại onHand, ghi Audit, gắn link Đơn huỷ`). Làm ở 5.7 sẽ khiến 6.7 rỗng hoặc trùng.
3. `reserved` theo AD-19 là **tổng của ledger `StockMovement`**, không phải cột cộng-trừ. Không có ledger ⇒ không có gì để "giải phóng"; viết code giải phóng bây giờ là viết code chạy vào hư không.

**Seam để lại cho Epic 6:** event `OrderCancelled` (Task 3) mang `orderId`, `orderVersionId`, `lyDo`, `statusTruocHuy`. Epic 6 subscribe event này để (a) huỷ `StockMovement` giữ chỗ, (b) quyết có cần phiếu nhập trả không — **không phải sửa lại đường huỷ**. Đây đúng khuôn AD-18 (`OrderConfirmed` đã là seam đặt sẵn cho tồn kho).

**AC-11 tồn tại để bảo vệ quyết định này:** nếu ai đó về sau nhét lệnh cộng tồn thẳng vào đường huỷ, guard đỏ — đúng tinh thần AC-3 "KHÔNG tự cộng tồn".

---

## Tasks / Subtasks

### Task 1 — Migration + schema: `cancelReason` / `cancelledAt` (AC: 8)

- [x] Thêm vào `model Order` (`backend/prisma/schema.prisma:332-367`), đặt sau `validityNote` (`:351`). **Bắt buộc `@map` snake_case** — mọi cột trong model này đều có (`kWp @map("k_wp")` `:349`, `validityNote @map("validity_note")` `:351`); thiếu `@map` là cột camelCase lạc loài, phá convention "bảng snake_case" của spine:
  ```prisma
  cancelReason      String?         @map("cancel_reason")
  cancelledAt       DateTime?       @map("cancelled_at")
  ```
- [x] Sinh migration **offline** (không có Postgres cục bộ). ⚠️ **`backend/prisma/migrations_snapshot.prisma` KHÔNG tồn tại** — repo chỉ có `schema.prisma`. Chép bản cũ ra file tạm **trước khi sửa**, rồi diff:
  ```bash
  cd backend && cp prisma/schema.prisma /tmp/schema-truoc.prisma   # LÀM TRƯỚC khi thêm 2 cột
  # … sửa schema.prisma …
  npx prisma migrate diff --from-schema /tmp/schema-truoc.prisma --to-schema prisma/schema.prisma --script
  ```
  ⚠️ Prisma 7 **chỉ nhận** `--from-schema` / `--to-schema`. Cờ `--from-schema-datamodel` trong doc cũ **không còn**.
  Nếu đã lỡ sửa schema trước khi chép: hai cột nullable thì viết tay migration cũng được —
  `ALTER TABLE "orders" ADD COLUMN "cancel_reason" TEXT, ADD COLUMN "cancelled_at" TIMESTAMP(3);`
- [x] Đặt tên thư mục migration theo convention hiện có: `backend/prisma/migrations/2026071807xxxx_add_order_cancel_reason/migration.sql` (migration gần nhất: `20260718060000_add_attachments`).
- [x] `npx prisma generate`.

**Vì sao lưu cột chứ không chỉ Audit:** `AuditLog.after` là JSON append-only dùng để truy vết, không phải chỗ đọc để render. Tab Thông tin cần lý do (AC-10); query `AuditLog` từ màn chi tiết là đường đọc thứ hai cho một dữ kiện thuộc về chính Đơn.

### Task 2 — Domain: hàm `coTheHuy()` đọc bảng (AC: 6, 9)

- [x] Trong `backend/src/orders/domain/allowed-transition.ts`, thêm hàm **thuần** (không async, không Prisma), cạnh `buocKeTiep`:
  ```ts
  export function coTheHuy(
    status: OrderStatusKey,
    quyen: ReadonlySet<string>,
  ): boolean
  ```
- [x] Thân hàm: **ĐỌC** `ALLOWED_TRANSITIONS`, lọc `event === SU_KIEN.huy && from === status && quyen.has(requires)`. **KHÔNG chép bảng**, không hardcode `['baogia','dachot','dacoc']` (AD-11 — thêm cạnh huỷ vào bảng là cờ tự đúng).
- [x] `huy` không có `scopeGuard` ⇒ **không** nhận `scopeFlags`. Đừng thêm tham số thừa.
- [x] **KHÔNG** thêm `SU_KIEN.huy` vào `SU_KIEN_THU_CONG` (`:278-284`) — làm vậy sẽ để `POST /:id/chuyen-trang-thai` huỷ đơn **không cần lý do**, phá thẳng AC-1.
- [x] **KHÔNG** đụng `SU_KIEN_KHONG_PHAI_BUOC_TIEN` (`:345-349`) — `huy` phải ở lại đó, nếu không stepper mọc thêm nấc "Huỷ". Lưu ý hằng này là `const` **module-private** (khác `export const SU_KIEN_THU_CONG` `:278`); **đừng export nó chỉ để test** — Task 10 kiểm bằng hành vi.
- [x] Sửa comment `:275` cho khỏi nói dối: hiện ghi `` `huy` → Story 5.7: bắt buộc lý do + giải phóng tồn `reserved` ``. Phần `reserved` **không** thuộc story này. Viết lại thành: lý do bắt buộc do `huyDon()` (5.7) enforce; việc giải phóng `reserved` thuộc Epic 6.7, nối vào qua event `OrderCancelled`. **Chỉ sửa comment**, không đụng mảng bên dưới.

### Task 3 — Domain event `OrderCancelled` (AC: 4, 8)

- [x] Thêm class vào `backend/src/orders/domain/order-events.ts` (cuối file, sau `AttachmentRemoved` `:320`).
- [x] Theo khuôn `DiscountResolved` (`:203`) — đó là event duy nhất hiện mang `reason`:
  ```ts
  export class OrderCancelled implements DomainEvent {
    readonly type = 'OrderCancelled';
    constructor(
      readonly actorAccountId: string | undefined,
      readonly target: { type: 'Order'; id: string },
      readonly lyDo: string,
      readonly statusTruocHuy: string,
      readonly orderVersionId: string | null,
      readonly occurredAt: Date,
    ) {}
  }
  ```
- [x] **KHÔNG** sửa `StatusChanged` (`:256-269`) hay `OrderSnapshot` (`:16-31`) để nhét lý do vào. Một lần huỷ phát **hai** event — đúng tiền lệ đã ghi nhận ở `order-events.ts:247-251` (chốt đơn phát `StatusChanged` + `OrderConfirmed`, chấp nhận có chủ đích).

### Task 4 — Service: `huyDon()` (AC: 1, 5, 6, 7, 8, 9, 11)

- [x] Thêm method công khai vào `backend/src/orders/orders.service.ts`, đặt **sau** `chuyenTrangThaiThuCong()` (`:585-716`). `applyTransition()` (`:429-484`) giữ nguyên **private** — không nới visibility.
- [x] Sentinel riêng cho lane này (khuôn `THU_CONG_GATE_THUA`): `const HUY_GATE_THUA = new Error('huy: gate thua')`, bắt theo **identity** (`err === HUY_GATE_THUA`), không `instanceof`.
- [x] Thứ tự cố định, y hệt lane thủ công:
  1. `findScopedOrThrow()` (`:1101-1125`) → 404 nếu ngoài phạm vi (AC-7).
  2. Validate `lyDo`: trim, rỗng hoặc < 3 ký tự ⇒ ném `AppException(VALIDATION_ERROR, 400, fieldErrors:[{field:'lyDo'}])`. Khuôn có sẵn: `orders.service.ts:1872-1884` (luật "bắt buộc khi từ chối" của `resolveDiscount`).
  3. Pre-check `evaluateTransition()` để trả 403/409 **có thông điệp**, trước khi mở transaction.
  4. `$transaction`: `applyTransition(tx, {...})` **rồi** `tx.order.update({ data: { cancelReason, cancelledAt } })` — cùng một `occurredAt` cho cả hai.
     ⚠️ Lệnh `update` thứ hai này **hợp lệ theo AD-11 vì nó không ghi field `status`** — guard `no-order-status-write-outside-transition.spec.ts` khoá theo cặp (method, lệnh ghi có `status`). **Đừng** nhét `cancelReason` vào chữ ký `applyTransition()` để "cho gọn": engine đó đang phục vụ 2 lane khác, đổi chữ ký là đổi hợp đồng dùng chung.
  5. Publish **SAU commit**: `await this.eventBus.publish(statusChanged)` rồi `await this.eventBus.publish(orderCancelled)`.
- [x] `occurredAt` tạo **một lần** ở đầu method, dùng chung cho `applyTransition`, cột `cancelledAt`, và cả hai event. (Bài học 5.5: bốn toạ độ phải khớp.)
- [x] Đơn **đã ở `huy`** ⇒ **409**, không no-op. Lane AUTO no-op idempotent (`daTaiDich()`), lane người-bấm thì không — người bấm cần biết việc đã xảy ra rồi (khuôn `:698-706`).
- [x] **AC-11:** không viết bất kỳ lệnh nào chạm `StockMovement`/`StockItem`/`onHand`/`reserved`.
- [x] Mở rộng method dựng lifecycle (`:1149`, `:1162`) trả thêm `coTheHuy: coTheHuy(status, quyen)`.

### Task 5 — DTO (AC: 5, 9)

- [x] Mới: `backend/src/orders/dto/cancel-order-request.dto.ts`
  ```ts
  export class CancelOrderRequestDto {
    @ApiProperty({ maxLength: 500, description: 'Lý do huỷ đơn — bắt buộc.' })
    @IsString()
    @MaxLength(500)
    lyDo!: string;
  }
  ```
  ⚠️ **KHÔNG** dùng `@IsNotEmpty()`/`@MinLength(3)` ở DTO. Bài học 5.5 HIGH-1: validation decorator quá chặt khiến `ValidationPipe` trả **400 trước khi** service chạy, và ranh giới nghiệp vụ ("rỗng sau trim") thuộc **service** để thông điệp lỗi thống nhất. `@MaxLength` giữ lại vì đó là ràng buộc kích thước thuần, không phải luật nghiệp vụ.
- [x] Mới: `backend/src/orders/dto/cancel-order-response.dto.ts` — `{ status, occurredAt }` (khuôn `status-change-response.dto.ts`).
- [x] Sửa `backend/src/orders/dto/order-lifecycle-response.dto.ts`: thêm vào `OrderLifecycleResponseDto`
  ```ts
  @ApiProperty({ description: 'Người gọi này huỷ được đơn này không. `false` ⇒ ẩn hẳn nút "Huỷ đơn" (UX-DR-22).' })
  coTheHuy!: boolean;
  ```
- [x] Sửa `backend/src/orders/dto/order-response.dto.ts` (DTO của `GET /orders/:id` — **không** phải `order-list-item.dto.ts`): thêm `cancelReason?: string | null`, `cancelledAt?: string | null`. `cancelledAt` serialize **ISO-8601 UTC** như mọi field ngày khác (client hiển thị UTC+7). Hai field này **không** rào theo quyền — ai xem được đơn thì xem được lý do huỷ; đừng tự phát minh hàng rào kiểu `costs.view`.

### Task 6 — Controller: `POST /orders/:id/huy` (AC: 5, 6, 12)

- [x] Thêm route vào `backend/src/orders/orders.controller.ts`, đặt **sau** `POST /:id/chuyen-trang-thai` (`:771`):
  ```ts
  @Post(':id/huy')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERM.quotesCreateEdit)
  ```
  ⚠️ `@HttpCode(HttpStatus.OK)` **bắt buộc** — kỷ luật của file (`orders.controller.ts:753`): action nghiệp vụ trên resource CÓ SẴN không trả 201. Mọi POST transition đều có (`:390`, `:438`, `:476`, `:520`, `:772`). Thiếu nó ⇒ route trả 201 ⇒ test e2e "200" ở Task 10 đỏ.
- [x] Route kebab-case tiếng Việt, khớp convention spine (`/orders/{id}/chot`, `/orders/{id}/mo-lai`).
- [x] **KHÔNG** dùng `FilesInterceptor` — story này không nhận ảnh (xem "Câu hỏi đã tự quyết" #4). Không copy cặp trần cứng `TRAN_CUNG_*` (`:93-94`).
- [x] Controller **không** dựng envelope lỗi (guard `no-controller-error-envelope.spec.ts`) — ném `AppException`, filter trung tâm lo (AD-5).
- [x] `cd backend && npm run openapi:gen` — route mới không regen ⇒ `openapi-drift.spec.ts` đỏ.

### Task 7 — Web: nút + Dialog + hiển thị lý do (AC: 10)

- [x] `web/src/design-system/session/orders-port.ts`: thêm `huyDon(orderId: string, lyDo: string): Promise<void>`; thêm `coTheHuy: boolean` vào type lifecycle; thêm `cancelReason`/`cancelledAt` vào type đơn.
- [x] `web/src/design-system/session/fake-orders-port.ts`: cài đặt twin (parity guard `design-system/session/parity.test.mjs:24-45` ép cả 4 file).
- [x] `web/src/screens/orders/OrderDetailScreen.tsx`:
  - Nút trong `.od-actions` (`:359-368`), **sau** nút "Chuyển trạng thái":
    ```tsx
    {coTheHuy && <Button variant="danger" onClick={() => setMoHuy(true)}>Huỷ đơn</Button>}
    ```
  - **Nâng container `.od-actions` lên trước** theo mẫu ở cảnh báo #2b — nếu để nút Huỷ bên trong điều kiện `buocKeTiep` hiện tại, nó tàng hình ở `baogia`.
  - Dùng `Dialog` (`web/src/design-system/components/Dialog.tsx:10-18`) với `tone="danger"`, **không** `ConfirmDialog` — `ConfirmDialog` (`:7-16`) chỉ nhận `consequence` là text, **không có slot input**. Tiền lệ dialog-mang-input: dialog "Áp chiết khấu" (4.7).
  - Ô lý do: `<Field label="Lý do huỷ" multiline rows={3} .../>` (`Field.tsx:7-16`).
  - Nút xác nhận **disabled khi lý do rỗng sau trim** (chặn ở client là UX; backend vẫn enforce — AD-4).
  - Lỗi từ server: đọc `message` verbatim, khuôn `OrderStatusChangeScreen.tsx:154-159`.
  - Tab Thông tin: khi `cancelReason` có giá trị, thêm hàng `Lý do huỷ`.
  - Sửa comment `:15-17` (đang ghi "Huỷ đơn (5.7) … they stay absent" — nay đã có).
- [x] **Bất biến overlay ≤ 1 tầng (UX-DR-20):** màn này đã có `ConfirmDialog` xoá ảnh (`:505-512`) + sheet của picker ảnh. Dialog huỷ là overlay **thứ ba** — phải đảm bảo **không bao giờ mở đồng thời** với hai cái kia.
- [x] `web/src/screens/orders/order-detail.css`: mọi class mới **phải có rule thật** (bài học 5.6 HIGH-1: gallery gọi 8 class không tồn tại, guard `behavior-components.test.mjs` nay bắt).
- [x] CSS: 0 `box-shadow`/`gradient`/`drop-shadow`/`filter:`; `border-radius` chỉ qua `var(--radius…)`; màu chỉ qua `var(--…)`; không `999px` hardcode.
- [x] **Chạy `cd backend && npx jest web-source-parses`** trước khi tick task này.

### Task 8 — Mobile: parity (AC: 10)

- [x] `mobile/lib/design_system/session/orders_port.dart` + `fake_orders_port.dart`: twin của Task 7.
- [x] `mobile/lib/screens/orders/order_detail_screen.dart`:
  - `AppButton(label: 'Huỷ đơn', variant: AppButtonVariant.danger, ...)` sau nút "Chuyển trạng thái" (`:293-303`), bọc `if (_coTheHuy)`. **Nâng khối action lên trước** theo cảnh báo #2b — điều kiện `_buocKeTiep.isNotEmpty` hiện bọc cả khối.
  - `showAppDialog` + `AppDialog` (`mobile/lib/design_system/components/dialog.dart:21-41`, `:45-53`) — **không** `AppConfirmDialog` (`:161-181`, không có slot input).
  - ⚠️ `AppConfirmDialog` tự `Navigator.pop()` rồi mới callback (`_confirm()` `:192-197`, `_cancel()` `:199-204`). `AppDialog` **không** — tự quản pop, đừng pop hai lần.
  - Ô lý do: `AppField(label: 'Lý do huỷ', maxLines: 3, ...)` (`field.dart:13-25`).
  - Lỗi: `error is OrderPortException ? error.message : …` (khuôn `order_status_change_screen.dart:159-170`).
  - Hàng `Lý do huỷ` ở tab Thông tin khi có giá trị.
  - Sửa comment `:14-15`.
- [x] Dùng `Wrap` chứ không `Row` cho cụm nút (tiền lệ `order_status_change_screen.dart:330-347` — tránh `RenderFlex` overflow ở text scale lớn; đây đúng là lỗi còn treo từ 5.4, đừng tạo thêm cái nữa).
- [x] 0 `BoxShadow`, 0 `elevation`.
- [x] Widget test: `mobile/test/screens/orders/order_detail_cancel_test.dart` — nút ẩn khi `coTheHuy=false`, dialog mở, xác nhận bị chặn khi lý do rỗng, gọi port đúng tham số.
- [x] `cd mobile && dart format -o none .` — ⚠️ `--set-exit-if-changed` **vẫn ghi đè file**, dùng `-o none` để chỉ kiểm.

### Task 9 — Design-system guards (AC: 10, 12)

- [x] **Sửa `design-system/screens/order-detail.test.mjs:272-278`** — bỏ `'Huỷ đơn'` khỏi mảng cấm, giữ `'Share báo giá'`:
  ```js
  for (const label of ['Share báo giá']) {
  ```
  Cập nhật comment `:266-271` theo đúng khuôn 5.5 đã làm với "Chuyển trạng thái" ("one destination stopped being nowhere").
- [x] Thêm assert **dương**: cả hai màn phải render `'Huỷ đơn'`, gated bằng `coTheHuy`/`_coTheHuy`. **Và assert phủ định quan trọng nhất:** điều kiện của nút Huỷ **không** nằm lồng trong một điều kiện `buocKeTiep`/`_buocKeTiep` — đây chính là lỗi tàng hình ở `baogia` (cảnh báo #2b), guard phải bắt được nó.
- [x] **Thêm nhãn mới vào mảng parity `order-detail.test.mjs:192-229`**: `'Huỷ đơn'`, `'Lý do huỷ'`, tiêu đề dialog, câu hậu quả, thông báo lỗi — mọi chuỗi người dùng đọc phải byte-identical hai nền tảng.
- [x] Mới: `design-system/screens/order-cancel.test.mjs` (khuôn `order-transition.test.mjs` của 5.5):
  - compose từ design-system (`Dialog`/`Field`/`Button` — `AppDialog`/`AppField`/`AppButton`), **không** `ConfirmDialog`/`AppConfirmDialog`;
  - cấm `fetch(`/`axios`/`XMLHttpRequest`/`HttpClient`/`package:http`;
  - cấm status literal (`'baogia'`, `'dachot'`, `'dacoc'`, `'huy'`) — client không tự suy huỷ được hay không;
  - cấm permission literal (regex `/['"][a-z_]+\.[a-z_]+['"]/`);
  - nút xác nhận dùng variant `danger`;
  - Viền nét: 0 shadow/gradient, radius qua token.
- [x] `design-system/session/parity.test.mjs`: `huyDon` phải có ở cả 4 file port.

### Task 10 — Test (AC: tất cả)

**Backend unit — `backend/test/order-cancel.spec.ts` (mới):**
- [x] Đường thành công từ **cả 3** trạng thái `baogia`/`dachot`/`dacoc`: status → `huy`, `cancelReason`/`cancelledAt` ghi đúng, đúng **2** event publish, thứ tự `StatusChanged` → `OrderCancelled`.
- [x] `lyDo` rỗng / `'   '` / 2 ký tự ⇒ 400 + `fieldErrors[0].field === 'lyDo'`, **status không đổi**, **0 event**.
- [x] Thiếu `quotes.create_edit` ⇒ 403, status không đổi.
- [x] Từ `thicong` / `dagiao` / `hoanthanh` / đã `huy` ⇒ 409.
- [x] Ngoài phạm vi xem ⇒ 404.
- [x] `occurredAt` **đồng nhất** giữa `cancelledAt`, `StatusChanged`, `OrderCancelled`.
- [x] Event publish **SAU** commit (transaction rollback ⇒ 0 event).

**Backend unit — `backend/test/allowed-transition.spec.ts` (sửa):**
- [x] `coTheHuy()` đúng cho 10 trạng thái × có/không quyền.
- [x] Guard hồi quy `SU_KIEN_THU_CONG` **không chứa** `huy` — hằng này `export`, assert thẳng được.
- [x] Guard hồi quy "huỷ không phải nấc stepper" — `SU_KIEN_KHONG_PHAI_BUOC_TIEN` là `const` **module-private**, **đừng export để test**. Kiểm bằng **hành vi**: với cả 10 trạng thái × 7 bộ cờ, `buocVongDoi()` không sinh nấc nào có `status === 'huy'`, và `buocKeTiep()` không bao giờ trả `event === SU_KIEN.huy`.
- [x] ⚠️ Test "không trạng thái nào là ngõ cụt" (loang 7 bộ cờ) đã tồn tại — chạy lại, phải xanh.

**Backend e2e — `backend/test/orders.e2e.spec.ts` (sửa):**
- [x] `POST /orders/:id/huy` qua dây thật: 200/400/403/404/409. ⚠️ **Mã HTTP chỉ đo được ở lane này** — `ValidationPipe` chạy trước service (bài học 5.5 HIGH-1). Test unit khẳng định mã HTTP là khẳng định không kiểm được.
- [x] Thêm route vào ma trận authn/authz.

**Backend DB lane — `backend/test/order-cancel.db.integration.spec.ts` (mới):**
- [x] Cột mới ghi/đọc được; `applyTransition` + `update` cùng transaction (rollback ⇒ không cột nào đổi).
- [x] ⚠️ Cần Docker Desktop chạy. Nếu daemon không lên: **viết spec, báo lane chưa chạy, xin Đại Ca bật Docker** — `open -a Docker` từ shell agent không tạo được socket.

**Source-guard (AC-11) — `backend/test/no-stock-write-in-cancel.spec.ts` (mới):**
- [x] Quét thân `huyDon()` trong `orders.service.ts`, cấm mọi khớp `StockMovement|stockMovement|StockItem|onHand|reserved`.
- [x] ⚠️ **Đừng tự viết regex cắt thân hàm.** `\{[^}]*\}` cắt nhầm ở dấu `}` lồng đầu tiên (generic, object literal, arrow body) — dùng lại helper trích thân hàm mà `no-order-status-write-outside-transition.spec.ts` đã có.
- [x] ⚠️ **Strip comment trước khi match.** `reserved`/`onHand` là từ trần, khớp cả văn xuôi tiếng Việt trong docstring — guard sẽ đỏ vì chính comment giải thích của nó.
- [x] Kèm **meta-test chống xanh giả**: nhét chuỗi cấm vào một bản sao chuỗi nguồn ⇒ guard **phải** đỏ; và một case comment-chứa-`reserved` ⇒ guard **phải** xanh. (Bài học: guard chỉ bắt được cái tác giả nó tưởng tượng ra.)

**Đột biến (mutation) — chứng minh test thật sự bắt lỗi:**
- [x] Gỡ validate `lyDo` ⇒ test 400 phải đỏ.
- [x] Đổi `coTheHuy()` thành hardcode `true` ⇒ test phải đỏ.
- [x] Bỏ `cancelledAt` khỏi `$transaction` ⇒ test đồng nhất `occurredAt` phải đỏ.
- [x] Publish event **trước** commit ⇒ test rollback phải đỏ.
- [x] ⚠️ Đột biến **phải compile được**, nếu không mọi suite đỏ và chẳng chứng minh gì.
- [x] ⚠️ Hoàn tác bằng `cp` backup, **KHÔNG `git checkout`** — code story chưa commit, checkout xoá sạch.
- [x] ⚠️ Nếu một đột biến sống sót, kiểm **lớp phòng thủ thứ hai** trước khi kết luận test giả (pre-check + engine là hai lớp; phải mutate cả hai).

**Lane phải xanh trước khi đóng story:**
```bash
cd backend && npm test                    # unit + e2e + source-guards + drift
cd backend && npx jest web-source-parses  # lane DUY NHẤT parse .tsx
cd backend && npm run test:db             # cần Docker
cd design-system && npm test
cd mobile && flutter test && flutter analyze
```

---

## Dev Notes

### Hiện trạng file bị SỬA (đọc trước khi đổi)

| File | Hiện làm gì | Story này đổi gì | Phải giữ nguyên |
|---|---|---|---|
| `backend/src/orders/domain/allowed-transition.ts` | 19 dòng transition, `:190-207` là 3 cạnh `huy`; `SU_KIEN_THU_CONG` `:278-284`; `SU_KIEN_KHONG_PHAI_BUOC_TIEN` `:345-349` (private) | THÊM hàm `coTheHuy()`; sửa comment `:275` (bỏ vế `reserved`) | Cả 3 mảng hằng, và tính private của `KHONG_PHAI_BUOC_TIEN`. `huy` KHÔNG vào `SU_KIEN_THU_CONG` |
| `backend/src/orders/orders.service.ts` | `applyTransition` private `:429-484`; 2 lane `:514-558`/`:585-716`; `findScopedOrThrow` `:1101-1125`; lifecycle `:1149`,`:1162` | Thêm `huyDon()`; lifecycle trả `coTheHuy` | `applyTransition` vẫn **private**; publish SAU commit; sentinel bắt theo identity |
| `backend/src/orders/orders.controller.ts` | 20+ route, `chuyen-trang-thai` `:771`; trần multer `:93-94` | Thêm `POST /:id/huy` + `@RequirePermissions` | Trần multer (không đụng); controller không dựng envelope lỗi |
| `backend/src/orders/domain/order-events.ts` | 14 event, `StatusChanged` `:256` | Thêm `OrderCancelled` | `StatusChanged` và `OrderSnapshot` **nguyên vẹn** |
| `backend/src/orders/dto/order-lifecycle-response.dto.ts` | `buoc[]` + `buocKeTiep[]` | Thêm `coTheHuy` | `buocKeTiep` vẫn KHÔNG chứa `huy` |
| `backend/src/orders/dto/order-response.dto.ts` | DTO của `GET /orders/:id` | +`cancelReason`, +`cancelledAt` (ISO-8601 UTC) | Mọi field hiện có; không rào quyền field mới |
| `backend/prisma/schema.prisma` | `model Order` `:332-367`, mọi cột có `@map` | +2 cột nullable **có `@map`** | 19 model khác; mọi index hiện có |
| `web/src/screens/orders/OrderDetailScreen.tsx` | 515 dòng, 3 tabs `:80-84`, `.od-actions` `:359-368`, ConfirmDialog xoá ảnh `:505-512` | +nút, +Dialog huỷ, +hàng lý do | Đúng **3** tabs; overlay ≤1 tầng; không tính quyền ở client |
| `mobile/lib/screens/orders/order_detail_screen.dart` | 644 dòng, StatefulWidget (**không** BLoC), actions `:293-303` | Twin của web | Pattern StatefulWidget + injected port |
| `design-system/screens/order-detail.test.mjs` | Guard màn chi tiết; mảng cấm `:272-278`; parity `:192-229` | Bỏ `'Huỷ đơn'` khỏi mảng cấm; +assert dương; +nhãn parity | 12 guard còn lại |

### Bất biến không được vi phạm

- **AD-11** — `applyTransition()` là **con đường DUY NHẤT** ghi `Order.status`. `huyDon()` gọi nó, không tự `update({status})`. Guard `no-order-status-write-outside-transition.spec.ts` khoá theo **cặp (method, lệnh ghi)**.
- **AD-18** — publish qua `EventBus` port; **không** gọi audit/FCM trực tiếp. Audit sinh ra từ subscriber (`audit.subscriber.ts`), không phải từ `huyDon()`.
- **AD-17** — không permission literal ngoài registry. Dùng `PERM.quotesCreateEdit`.
- **AD-5** — envelope lỗi chỉ do exception filter trung tâm tạo.
- **AD-2 / AD-4** — client không chứa business logic; backend enforce mọi request. `coTheHuy` do backend tính; ẩn nút chỉ là UX.
- **AD-13** — dùng lại component design-system; **cấm style ad-hoc**. Không tạo component Dialog mới — đã có đủ hai nền tảng.
- **UX-DR-19 + UX-DR-20** — hành động hệ quả tiền/dữ liệu dùng **Dialog** (cả web lẫn mobile), **nêu rõ hậu quả**; overlay chồng tối đa một cấp.
- **UX-DR-22** — không đủ quyền ⇒ **ẩn hẳn**, không vẽ xám.
- **UX-DR-23** — chip trạng thái **chỉ đọc**; không huỷ đơn bằng cách bấm chip.
- **UX-DR-26** — a11y floor: touch target ≥48dp/44pt, Esc đóng dialog trên cùng, mọi trường form có nhãn rõ. `EXPERIENCE.md:138` nêu **đích danh** "lý do huỷ" trong danh sách trường phải có nhãn + role/state cho screen reader.
- **UX-DR-27** — nhãn tiếng Việt byte-identical hai nền tảng.
- **Viền nét (UX-DR-4)** — 0 shadow/gradient/elevation.

### Học từ story trước (5.6 / 5.5 / 5.4)

| Bài học | Nguồn | Áp vào 5.7 |
|---|---|---|
| `.tsx` lỗi cú pháp mà **cả 4 lane vẫn xanh** | 5.4 CRITICAL-1 | Chạy `npx jest web-source-parses` sau MỌI sửa `.tsx` |
| Class CSS không tồn tại vẫn qua mọi guard | 5.6 HIGH-1 | Mọi class mới trong `order-detail.css` phải có rule thật |
| `@IsIn` quá chặt ⇒ 400 thay vì 409; test cũ **ghim** độ lệch thay vì báo đỏ | 5.5 HIGH-1 | DTO chỉ `@IsString`+`@MaxLength`; luật nghiệp vụ ở service; mã HTTP đo ở **e2e** |
| Đột biến sống sót vì chỉ hàm có test, chỗ **nối** thì không | 5.5 MEDIUM-3 | Test cả `coTheHuy()` **và** chỗ lifecycle gọi nó |
| Gỡ pre-check chỉ đỏ 1 test vì engine là **lớp thứ hai** | 5.5 đột biến #1 | Mutate cả hai lớp trước khi kết luận |
| **File List thiếu file** — lặp 2 story liền | 5.4 MEDIUM-2, 5.5 MEDIUM-4 | Đối chiếu `git status --short` khi viết File List |
| Số liệu Debug Log lệch thực tế | 5.4 MEDIUM-3 | Ghi số lane **sau** QA/review, không ghi lúc dev |
| Guard tự bắt lỗi của chính nó (assert sai tầng; regex false-positive vào tên file Dart import) | 5.6 | Viết meta-test chống xanh giả cho guard mới |
| `dart format --set-exit-if-changed` **vẫn ghi đè** ~20 file | 5.5 | Dùng `-o none` |
| Đột biến: `cp` backup, **không `git checkout`** | 5.5 | Code story chưa commit |

### Nợ kỹ thuật ghi nhận, KHÔNG sửa ở story này

- **TD-29** — mô hình tồn kho chưa tồn tại (Epic 6.6). Là **lý do** phạm vi story này; không sửa.
- **TD-1** — web thiếu tsc/bundler/JSDOM. Giữ text-guard + `web-source-parses`; widget test bắt buộc phía mobile.
- **Lỗi treo từ 5.4** — `RenderFlex` tràn hàng `Trạng thái` tab Thông tin (`order_detail_screen.dart`) khi nhãn dài. **Không sửa ở đây**, nhưng dùng `Wrap` cho cụm nút mới để không tạo thêm cái thứ hai.
- **5.6** — `.micro` / `.muted` không có rule CSS ở bất kỳ đâu. Không dùng hai class này cho markup mới.
- **TD-24** — CI Actions chưa có bằng chứng run xanh trên push.
- **TD-28** — 4 suite backend flake dưới jest song song.

### Project Structure Notes

- Backend: module theo domain, `orders/` sở hữu toàn bộ. Đường huỷ nằm **trong** `orders/`, không tạo module mới.
- Route kebab-case tiếng Việt, action nghiệp vụ = POST sub-resource (spine).
- File mới kebab-case (TS) / snake_case (Dart), theo `naming-convention.spec.ts`.
- Web = function component + hooks. Mobile = StatefulWidget + injected port (**màn Orders không dùng BLoC** — đừng giới thiệu).
- `openapi.json` + `permissions.json` là **generated**, sửa qua generator, không sửa tay.

### Câu hỏi đã tự quyết (nêu để Đại Ca phủ quyết nếu muốn)

1. **Tồn kho ra khỏi phạm vi.** Không có model nào tồn tại; Story 6.7 đã có AC riêng cho phiếu nhập trả. 5.7 để lại seam `OrderCancelled`. → Xem "Ranh giới với Epic 6".
2. **Dùng lại `quotes.create_edit`, không đẻ key thứ 22.** Bảng transition **đã** khai quyền này cho cả 3 cạnh `huy` — đó là quyết định của Story 5.1, không phải mặc định của tôi. Thêm `orders.cancel` sẽ kéo 4 bước regen (registry → `permissions:gen` → parity web+mobile → role presets) và làm `permissions-drift.spec.ts:35` (assert đúng 21 entry) đỏ. Nếu Đại Ca muốn quyền huỷ tách riêng, đó là một story phân quyền, không phải phần phụ của story này.
3. **Lý do lưu thành cột `Order`, không chỉ trong Audit.** Cần cho tab Thông tin (AC-10). ⚠️ **Đính chính (review):** hàng `AuditLog` **KHÔNG** chứa `lyDo`. `AuditService.record` chỉ persist `eventType`/`actor`/`target`/`before`/`after`/`occurredAt`, mà `OrderCancelled` không mang `before`/`after` ⇒ audit ghi được *ai huỷ, đơn nào, lúc nào*, **không** ghi *vì sao*. Đây **đúng tiền lệ** `DiscountResolved` (mang `reason`, cũng không vào audit), nên không sửa ở story này. "Vì sao" truy được ở cột `Order.cancelReason` — bền vững vì `huy` là trạng thái terminal, không có đường ghi đè. Nếu Epic 8.5 (đọc audit) cần lý do nằm ngay trong dòng audit, đó là một thay đổi hợp đồng event dùng chung, làm một lần cho cả `DiscountResolved` lẫn `OrderCancelled`.
4. **Huỷ KHÔNG đính kèm ảnh.** UX-DR-25 nói upload "luôn optional"; không tài liệu nào đòi ảnh cho huỷ. Bỏ ảnh giữ được Dialog (có ảnh ⇒ picker mở sheet ⇒ **2 tầng overlay**, vi phạm UX-DR-20 — đây chính là lý do 5.5 phải làm **màn** chứ không dialog).
5. **Lý do: 3–500 ký tự, text tự do.** Không tài liệu nào quy định độ dài hay danh sách lý do định sẵn. 3 ký tự chặn `"."`/`"x"`; 500 vừa một đoạn.
6. **Đơn đã `huy` ⇒ 409, không no-op.** Lane người-bấm khác lane AUTO.
7. **Dialog, không phải màn — dù UX inventory đặt tên một MÀN.** `EXPERIENCE.md:37` liệt kê `s-order-cancel` là một màn. Tôi chọn Dialog vì UX-DR-19/20 xếp Huỷ đúng vào nhóm "hành động hệ quả tiền/dữ liệu ⇒ Dialog", và lý do khiến 5.5 phải làm **màn** không áp ở đây: 5.5 có picker ảnh (picker mở sheet ⇒ 2 tầng overlay). Story này không nhận ảnh ⇒ Dialog giữ đúng 1 tầng. Nếu Đại Ca muốn đúng chữ `s-order-cancel`, đổi sang màn là việc của Task 7/8, backend không đổi.

### Cảnh báo tài liệu (đã verify — đừng đi tìm)

- **`(§2)` trong AC gốc là tham chiếu treo.** PRD §2 là "Đối tượng người dùng"; vòng đời đơn là **§4.2**, và §4.2 không chứa chữ "reserved". Luật "giải phóng reserved / phiếu nhập trả" **chỉ tồn tại trong `epics.md`**, không truy được về PRD/spine.
- **"Nêu rõ hậu quả" thuộc UX-DR-19, không phải UX-DR-20.** AC gốc cite nhầm. UX-DR-20 là luật bottom-sheet-vs-Dialog. Story này cite **cả hai**.
- **Không tài liệu nào đặt tên quyền huỷ.** Ma trận quyền PRD §4.6 không có dòng "Huỷ đơn".
- **Spine khoá đúng 3 cạnh vào `Huy`** (`baogia`/`dachot`/`dacoc`) và `Huy` là **terminal**. Code khớp spine. AC-3 ("huỷ SAU khi xuất kho") chỉ khả thi nếu xuất kho xảy ra lúc đơn còn ở `dacoc` — thêm cạnh huỷ từ `thicong`/`danggiao` là **sửa kiến trúc**, vượt phạm vi story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#L525-L531 — AC gốc Story 5.7]
- [Source: _bmad-output/planning-artifacts/epics.md#L600-L605 — Story 6.7 "Phiếu nhập trả khi huỷ đơn đã xuất kho"]
- [Source: _bmad-output/planning-artifacts/epics.md#L116 — UX-DR-19 "Confirm = consequence-stating dialog"]
- [Source: _bmad-output/planning-artifacts/epics.md#L117 — UX-DR-20 bottom-sheet vs Dialog, "overlays stack at most one level"]
- [Source: _bmad-output/planning-artifacts/epics.md#L119 — UX-DR-22 gating ẩn hẳn]
- [Source: _bmad-output/planning-artifacts/epics.md#L123 — UX-DR-26 a11y floor (touch target, Esc, nhãn form)]
- [Source: ux-designs/…/EXPERIENCE.md#L138 — danh sách trường phải có nhãn, nêu đích danh "lý do huỷ"]
- [Source: architecture/…/ARCHITECTURE-SPINE.md#L112 — AD-11 applyTransition là đường DUY NHẤT ghi status]
- [Source: architecture/…/ARCHITECTURE-SPINE.md#L154 — AD-18 EventBus port]
- [Source: architecture/…/ARCHITECTURE-SPINE.md#L160 — AD-19 `reserved` = tổng ledger StockMovement]
- [Source: architecture/…/ARCHITECTURE-SPINE.md#L180 — convention route `/orders/{id}/chot`]
- [Source: architecture/…/ARCHITECTURE-SPINE.md#L399-L403 — 3 cạnh vào `Huy`, `Huy --> [*]` terminal]
- [Source: ux-designs/…/EXPERIENCE.md#L37 — màn `s-order-cancel`: "Huỷ có lý do, ghi Audit"]
- [Source: ux-designs/…/EXPERIENCE.md#L101 — "Huỷ (có thể từ nhiều trạng thái, kèm lý do)"]
- [Source: ux-designs/…/DESIGN.md#L183 — chip `.chip--huy` `#FAE6E6`/`#B22C2C`/`#F0C7C7`]
- [Source: ux-designs/…/DESIGN.md#L27 — token `danger: '#E14B4B'`]
- [Source: backend/src/orders/domain/allowed-transition.ts:190-207 — 3 cạnh `huy`, `requires: PERM.quotesCreateEdit`]
- [Source: backend/src/orders/domain/allowed-transition.ts:275 — "`huy` → Story 5.7: bắt buộc lý do"]
- [Source: backend/src/orders/domain/allowed-transition.ts:278-284 — `SU_KIEN_THU_CONG` 5 sự kiện, không có `huy`]
- [Source: backend/src/orders/domain/allowed-transition.ts:345-349 — `SU_KIEN_KHONG_PHAI_BUOC_TIEN` chứa `huy`]
- [Source: backend/src/orders/orders.service.ts:429-484 — `applyTransition` private, 5 bước]
- [Source: backend/src/orders/orders.service.ts:585-716 — `chuyenTrangThaiThuCong`, khuôn gần nhất]
- [Source: backend/src/orders/orders.service.ts:1101-1126 — `findScopedOrThrow` → 404]
- [Source: backend/src/orders/orders.controller.ts:753 — kỷ luật `@HttpCode(OK)` cho action nghiệp vụ]
- [Source: backend/src/orders/dto/order-response.dto.ts — DTO của `GET /orders/:id`]
- [Source: backend/src/orders/orders.service.ts:1872-1884 — khuôn `fieldErrors` cho lý do bắt buộc]
- [Source: backend/src/orders/domain/order-events.ts:203 — `DiscountResolved` mang `reason`]
- [Source: backend/src/orders/domain/order-events.ts:247-251 — tiền lệ một hành động phát 2 event]
- [Source: backend/src/orders/domain/order-status.ts:55 — `TRANG_THAI_HUY = 'huy'`]
- [Source: backend/src/accounts/domain/permission-registry.ts:36 — `quotesCreateEdit: 'quotes.create_edit'`]
- [Source: backend/prisma/schema.prisma:332-367 — `model Order`, mọi cột có `@map` snake_case, không có `cancelReason`]
- [Source: backend/test/permissions-drift.spec.ts:35 — assert đúng 21 entry]
- [Source: design-system/screens/order-detail.test.mjs:272-278 — mảng cấm chứa `'Huỷ đơn'`]
- [Source: design-system/screens/order-detail.test.mjs:192-229 — mảng nhãn parity]
- [Source: design-system/screens/order-detail.test.mjs:154-179 — guard cấm status literal]
- [Source: web/src/design-system/components/Dialog.tsx:10-18 — `DialogProps`, `tone: 'danger'`]
- [Source: web/src/design-system/components/ConfirmDialog.tsx:7-16 — chỉ nhận `consequence`, không có slot input]
- [Source: web/src/design-system/components/Field.tsx:7-16 — `multiline`, `rows`]
- [Source: web/src/screens/orders/OrderDetailScreen.tsx:359-368 — `.od-actions`]
- [Source: mobile/lib/design_system/components/dialog.dart:45-53 — `AppDialog`]
- [Source: mobile/lib/design_system/components/dialog.dart:161-181 — `AppConfirmDialog`, tự pop]
- [Source: mobile/lib/screens/orders/order_detail_screen.dart:293-303 — cụm actions]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-07-17.md — TD-29 tồn kho thuộc Epic 6.6; TD-1 web tooling]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, workflow `bmad-dev-story`)

### Debug Log References

**Lane đã chạy (số liệu ghi lúc dev — QA/review chạy lại và ghi đè nếu lệch):**

| Lane | Lệnh | Kết quả |
|---|---|---|
| Backend unit + e2e + source-guard + drift | `cd backend && npm test` | 74 suite / **1352** test **xanh** (review chạy lại) |
| Web parse (lane DUY NHẤT parse `.tsx`) | `cd backend && npx jest web-source-parses` | 2 test **xanh** |
| Design-system guard + parity | `cd design-system && npm test` | 368 test **xanh** |
| Mobile widget + analyze | `cd mobile && flutter test && flutter analyze` | **254** test **xanh** (+1 test review thêm), analyze **No issues** |
| **DB lane** | `cd backend && npm run test:db` | ⚠️ **CHƯA CHẠY** — xem dưới |

**⚠️ DB lane chưa chạy — cần Đại Ca bật Docker Desktop.** `docker info` báo daemon không lên;
`open -a Docker` từ shell agent không tạo được socket. Spec đã viết đầy đủ
(`backend/test/order-cancel.db.integration.spec.ts`, tự `describe.skip` khi vắng `DATABASE_URL`)
nhưng **hai sự thật sau chưa được chứng minh trên Postgres thật**:
1. Migration `20260718070000_add_order_cancel_reason` sinh **offline** (`migrate diff --script`)
   và chưa từng `migrate deploy` — hai cột `cancel_reason`/`cancelled_at` chưa được kiểm là có thật.
2. `applyTransition` + `update` hai cột lý do **cùng một transaction** — mock `$transaction`
   chỉ gọi callback, nó không rollback được gì.

**Flake TD-28 quan sát được:** `customers.e2e.spec.ts` đỏ một lần dưới jest song song rồi
xanh khi chạy riêng và ở mọi lần chạy full sau đó. Không liên quan story này.

**Đột biến (mutation) — 5 phép, mỗi phép hoàn tác bằng `cp` backup (KHÔNG `git checkout`):**

| # | Đột biến | Kết quả |
|---|---|---|
| 1 | Gỡ validate `lyDo` (`if (false)`) | ✅ **7 test đỏ** (unit + e2e) |
| 2 | `coTheHuy()` hardcode `return true` | ✅ **23 test đỏ** (domain + service + e2e) |
| 3 | `cancelledAt: new Date(0)` (lệch `occurredAt`) | ✅ **2 test đỏ** |
| 4 | Publish event **trong** transaction (trước commit) | ❌ **SỐNG SÓT** → đã sửa test, xem dưới |
| 5 | Lồng nút "Huỷ đơn" vào wrapper `buocKeTiep` (web) | ❌ **SỐNG SÓT** → đã sửa guard, xem dưới |

**Hai đột biến sống sót đã lộ ra hai test/guard rỗng ruột — cả hai đã được sửa và tái kiểm:**

- **#4** — test rollback dùng `transaction.mockRejectedValue(...)`, tức callback **không hề chạy**,
  nên nó xanh y hệt cho cả bản publish-trong-tx lẫn publish-sau-commit. Sửa thành mock **chạy thân
  tx rồi mới ném** (mô phỏng commit hỏng) + assert `updateMany` ĐÃ được gọi. Chạy lại với mutant ⇒ **đỏ**.
- **#5** — assertion chống-lồng chỉ soi 400 ký tự **sát nút**, nên bọc lại **container ngoài** bằng
  `buocKeTiep.length > 0 &&` vẫn qua (inner `coTheHuy &&` còn nguyên). Thêm assertion trên **điều
  kiện của container** (`|| coTheHuy`) + cấm tường minh hình dạng wrapper cũ ở cả hai nền tảng.
  Chạy lại với mutant ⇒ **đỏ**.

**Guard AC-11 tự bắt được lỗi của chính nó:** meta-test chống-xanh-giả trong
`no-stock-write-in-cancel.spec.ts` phát hiện máy trích thân hàm đang đọc nhầm kiểu trả về
`Promise<{ status; occurredAt }>` làm thân `huyDon()` — tức guard đang quét một chuỗi 20 ký tự và
luôn xanh. Đã sửa nhận diện `{` mở thân theo ký tự đứng trước (`:`/`<`/`|`/`&`/`,` ⇒ là kiểu).
Meta-test thứ hai (neo `replace` không duy nhất, rơi vào lane `chuyenTrangThaiTuDong`) cũng bắt
được và đã sửa neo sang `const lyDo = input.lyDo.trim();`.

### Completion Notes List

**Đã làm đúng phạm vi story:**

- **Task 1** — 2 cột nullable `cancelReason`/`cancelledAt` có `@map` snake_case; migration sinh
  offline bằng `--from-schema`/`--to-schema` (Prisma 7), thư mục `20260718070000_add_order_cancel_reason`.
- **Task 2** — `coTheHuy(status, quyen)` **ĐỌC** `ALLOWED_TRANSITIONS`, không chép bảng, không nhận
  `scopeFlags` (cạnh `huy` không có `scopeGuard`). `SU_KIEN_THU_CONG` và `SU_KIEN_KHONG_PHAI_BUOC_TIEN`
  **nguyên vẹn**; hằng private vẫn private — guard "huỷ không phải nấc stepper" kiểm bằng **hành vi**
  (10 trạng thái × 7 bộ cờ) chứ không export để test.
- **Task 3** — `OrderCancelled` mang `lyDo`/`statusTruocHuy`/`orderVersionId`. `StatusChanged` và
  `OrderSnapshot` không đụng tới.
- **Task 4** — `huyDon()` đặt sau `chuyenTrangThaiThuCong()`; `applyTransition` giữ **private**;
  sentinel `HUY_GATE_THUA` bắt theo identity; một `occurredAt` cho cột + 2 event; publish SAU commit.
- **Task 5/6** — DTO chỉ `@IsString` + `@MaxLength(500)` (luật nghiệp vụ ở service — bài học 5.5 HIGH-1);
  route `POST /:id/huy` có `@HttpCode(OK)` + `@RequirePermissions(PERM.quotesCreateEdit)`; `openapi:gen` đã chạy.
- **Task 7/8** — Container action **nâng lên** ở cả hai nền tảng trước khi thêm nút; Dialog (không
  ConfirmDialog) + Field/AppField 3 dòng; mobile dùng `Wrap` (không `Row`); nhãn byte-identical.
- **Task 9/10** — Guard mới `order-cancel.test.mjs` (11 test) + `no-stock-write-in-cancel.spec.ts`
  (5 test, có meta-test); widget test mobile `order_detail_cancel_test.dart` (8 test).

**Lệch so với chữ trong story — nêu để Đại Ca duyệt:**

1. **`OrderCancelled` nhận `orderId` (positional) thay vì `target` object như snippet story.**
   Không event nào trong `order-events.ts` nhận `target` qua constructor — cả 14 event đều dựng
   `this.target` trong thân từ `orderId` (khuôn `QuoteExported`). Theo khuôn file thay vì snippet.
2. **`cancelledAt` trong `OrderResponseDto` khai kiểu `Date | null`, không phải `string | null`.**
   Giá trị chảy thẳng từ entity qua cast (`as OrderResponseDto`), và mọi field ngày khác trong DTO
   này (`createdAt`, `resolvedAt`) đều khai `Date`. Khai `string` sẽ là một hợp đồng nói dối; JSON
   vẫn serialize ra ISO-8601 UTC đúng như AC đòi (e2e khẳng định).
3. **Mobile `AppField` không có `maxLength`** nên trần 500 ký tự chỉ chặn ở web + backend. Backend
   là hàng rào thật (AD-4); mobile nhận 400 có `fieldErrors` và hiện nguyên văn.
4. **6 file test cũ phải sửa fixture** (`cancelReason`/`cancelledAt` là field bắt buộc của type
   `Order` sinh từ Prisma, và `coTheHuy` bắt buộc trong `OrderLifecycle`). Sửa cơ học, không đổi
   ý nghĩa test nào.
5. **Nợ format Dart có sẵn:** `dart format -o none` báo 28/78 file lệch chuẩn **ở HEAD**, gồm 5 file
   story này chạm. Đã kiểm bằng cách format bản HEAD trong thư mục tạm — lệch có TRƯỚC story này.
   Chỉ format file MỚI (`order_detail_cancel_test.dart`); không format lại 5 file cũ để tránh
   ~2000 dòng churn không liên quan. `flutter analyze` sạch.

### File List

**Mới:**

- `backend/prisma/migrations/20260718070000_add_order_cancel_reason/migration.sql`
- `backend/src/orders/dto/cancel-order-request.dto.ts`
- `backend/src/orders/dto/cancel-order-response.dto.ts`
- `backend/test/order-cancel.spec.ts`
- `backend/test/order-cancel.db.integration.spec.ts`
- `backend/test/no-stock-write-in-cancel.spec.ts`
- `design-system/screens/order-cancel.test.mjs`
- `mobile/test/screens/orders/order_detail_cancel_test.dart`

**Sửa:**

- `backend/prisma/schema.prisma`
- `backend/openapi/openapi.json` (generated — qua `npm run openapi:gen`)
- `backend/src/orders/domain/allowed-transition.ts`
- `backend/src/orders/domain/order-events.ts`
- `backend/src/orders/dto/order-lifecycle-response.dto.ts`
- `backend/src/orders/dto/order-response.dto.ts`
- `backend/src/orders/orders.controller.ts`
- `backend/src/orders/orders.service.ts`
- `backend/test/allowed-transition.spec.ts`
- `backend/test/orders.e2e.spec.ts`
- `backend/test/order-attachments.spec.ts` (fixture)
- `backend/test/order-status-change.spec.ts` (fixture)
- `backend/test/orders.service.spec.ts` (fixture)
- `design-system/screens/order-detail.test.mjs`
- `design-system/session/parity.test.mjs`
- `web/src/design-system/session/orders-port.ts`
- `web/src/design-system/session/fake-orders-port.ts`
- `web/src/screens/orders/OrderDetailScreen.tsx`
- `web/src/screens/orders/order-detail.css`
- `mobile/lib/design_system/session/orders_port.dart`
- `mobile/lib/design_system/session/fake_orders_port.dart`
- `mobile/lib/screens/orders/order_detail_screen.dart`
- `mobile/test/screens/orders/order_detail_screen_test.dart` (fixture)
- `mobile/test/screens/orders/order_detail_attachments_test.dart` (fixture)
- `mobile/test/screens/orders/order_status_change_screen_test.dart` (fixture)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-18 · **Kết luận: APPROVE** (0 CRITICAL, 0 HIGH)

### Lane chạy lại lúc review (không tin số ghi lúc dev)

| Lane | Kết quả |
|---|---|
| `cd backend && npm test` | 74 suite / **1352** test xanh |
| `cd backend && npx jest web-source-parses` | 2 test xanh (lane DUY NHẤT parse `.tsx`) |
| `cd design-system && npm test` | **368** test xanh |
| `cd mobile && flutter test && flutter analyze` | **254** test xanh, analyze sạch |
| `cd backend && npm run test:db` | ⚠️ **VẪN CHƯA CHẠY** — Docker daemon không lên |

### Khẳng định của story đã được KIỂM CHỨNG bằng đột biến (không tin chữ)

Review không đọc suông, mà nhét lỗi vào code rồi xem test có đỏ không:

1. **Publish event TRƯỚC commit** (dời cả hai `publish` vào trong `$transaction`) ⇒ **đỏ** `order-cancel.spec.ts:245`. Bản vá của dev cho đột biến #4 (đổi `mockRejectedValue` thành mock *chạy thân tx rồi mới ném*) là **thật**, không phải xanh giả.
2. **Gỡ gate `if (_coTheHuy)` ở mobile** ⇒ **đỏ** guard `order-cancel.test.mjs` ("the mobile cancel button must sit directly under `if (_coTheHuy)`"). Bản vá cho đột biến #5 cũng là thật.
3. **Guard AC-11** (`no-stock-write-in-cancel.spec.ts`): meta-test nhét `stockItem.update` vào bản sao nguồn THẬT với neo duy nhất đã verify (`goc.split(neo)` = 2 phần) — máy trích thân hàm cân bằng ngoặc và phân biệt `{` của kiểu với `{` của thân. Guard này **có ruột**.

### File List đối chiếu `git status` — KHỚP

Bài học lặp ở 5.4/5.5 (File List thiếu file) **không tái diễn**: 27 file `git status` khai báo đủ, trừ `_bmad-output/implementation-artifacts/tests/test-summary-story-5-7.md` (artifact BMAD, ngoài phạm vi review source).

### Phát hiện & xử lý

**MEDIUM-1 — ĐÃ SỬA · Huỷ xong nhưng màn không nạp lại nếu chạm nền lúc đang gửi** (`mobile/lib/screens/orders/order_detail_screen.dart`)
`showAppDialog` mặc định `barrierDismissible: true` và không có gì chặn lúc `_dangGui`. Chuỗi: bấm *Xác nhận huỷ* → `onConfirm` đang bay → chạm nền → route pop `null`, state dispose → `_gui` tỉnh dậy ở `if (!mounted) return` → `daHuy == null` ⇒ **`_load()` bị bỏ qua**. Đơn ĐÃ huỷ trên server, nhưng màn vẫn hiện nút "Huỷ đơn" và không có hàng "Lý do huỷ" — UI nói dối về trạng thái đơn. Web không có lỗi này vì `xacNhanHuy` giữ `await load()` trên scope của màn.
**Sửa:** bọc `AppDialog` trong `PopScope(canPop: !_dangGui)` — dialog từ chối đóng khi request đang bay. Cục bộ trong màn, không đụng component design-system dùng chung.

**MEDIUM-2 — ĐÃ SỬA · Test "ẩn nút khi `coTheHuy=false`" rỗng ruột** (`mobile/test/screens/orders/order_detail_cancel_test.dart`)
`_HuyPort` luôn trả `buocKeTiep: []` và `_host` không truyền `onChangeStatus`, nên điều kiện **container ngoài** đã false sẵn — nút vắng mặt vì cả khối không render, **không phải** vì gate của nó. Gỡ `if (_coTheHuy)` ⇒ cả 8 test **vẫn xanh**. Đây đúng khuôn "đột biến chỉ chạm một lớp phòng thủ": guard design-system bắt được, nhưng test khẳng định sai điều nó không đo.
**Sửa:** thêm cờ `coBuocKeTiep` vào fake + test mới `coTheHuy: false` **có** bước kế **và** `onChangeStatus` — container render thật, gate mất là lộ. Tái kiểm với đột biến ⇒ **+8 -1** (trước đó +9 -0).

**LOW-1 — ĐÃ SỬA (doc) · Story nói "Audit vẫn ghi đủ qua event" — sai**
`AuditService.record` chỉ persist `eventType`/`actor`/`target`/`before`/`after`/`occurredAt`; `OrderCancelled` không mang `before`/`after` ⇒ **`lyDo` không bao giờ vào hàng `AuditLog`**. Đây **đúng tiền lệ** `DiscountResolved` (cũng mang `reason`, cũng không vào audit), nên KHÔNG sửa hợp đồng event — đã đính chính câu văn ở "Câu hỏi đã tự quyết" #3 và ghi rõ đường truy "vì sao" là cột `Order.cancelReason` (bền vì `huy` terminal).

**LOW-2 — KHÔNG SỬA (báo cáo) · Mobile thiếu trần 500 ký tự**
`AppField` không có tham số `maxLength`, web có `maxLength={500}`. Dev đã nêu tường minh ở "Lệch so với chữ trong story" #3 và backend là hàng rào thật (AD-4) — người dùng mobile gõ 600 ký tự sẽ nhận 400 kèm `fieldErrors` hiện nguyên văn. Đóng lỗ này phải **thêm tham số vào component design-system dùng chung**, tức mở rộng phạm vi sang mọi màn đang dùng `AppField`. Để Đại Ca quyết, không tự làm trong story review.

**LOW-3 — Ghi nhận · `order.cancelReason !== null` ở web sẽ render hàng rỗng nếu field là `undefined`**
Hiện **không** phải lỗi: type khai `cancelReason: string | null` (bắt buộc) và literal `Order` duy nhất trong fake port có set `null`. Nhưng web **không có tsc** (TD-1) nên hợp đồng này không được máy nào ép. Khi Story Epic 7 nối HTTP port thật, nếu backend omit field (DTO khai `cancelReason?`), điều kiện này thành true và hàng "Lý do huỷ" hiện rỗng. Người viết port thật: dùng `?? null`.

### Đã kiểm và ĐÚNG (không tìm được lỗi)

- **AC-1…AC-12 đều có cài đặt thật.** AC-11 khoá bằng guard có meta-test; AC-3 đóng theo nghĩa phủ định đúng như phạm vi đã chốt.
- **AD-11 còn nguyên:** `applyTransition` vẫn `private`, lệnh `update` thứ hai không ghi `status`.
- **`occurredAt` một lần, bốn toạ độ khớp** (cột `cancelledAt`, `StatusChanged`, `OrderCancelled`, response).
- **Nhãn tiếng Việt byte-identical** hai nền tảng — đối chiếu từng codepoint, 7 chuỗi, không lệch.
- **e2e đo mã HTTP ở tầng dây** (bài học 5.5): 200/400/403/404/409 + biên **đúng 500 ⇒ 200**, **501 ⇒ 400**, + ca sai KIỂU (`123`/`null`/mảng) chứng minh `@IsString` là hàng rào thật chứ không trang trí.
- **`SU_KIEN_THU_CONG` / `SU_KIEN_KHONG_PHAI_BUOC_TIEN` nguyên vẹn**, hằng private vẫn private, kiểm bằng hành vi.
- **Audit chạy tự động:** `AuditSubscriber` ghi MỌI domain event, `OrderCancelled` không cần đăng ký riêng.

### Việc còn treo (không chặn đóng story)

**DB lane vẫn chưa chạy** — cần Đại Ca bật Docker Desktop rồi `cd backend && npm run test:db`. Hai sự thật chưa được chứng minh trên Postgres thật: (1) migration `20260718070000_add_order_cancel_reason` sinh offline, chưa từng `migrate deploy`; (2) `applyTransition` + `update` hai cột **cùng một transaction** — mock `$transaction` không rollback được gì. Spec đã viết sẵn và tự skip khi vắng `DATABASE_URL`.

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-18 | Tạo story context — phạm vi tồn kho cắt sang Epic 6.7, seam `OrderCancelled` để lại |
| 2026-07-18 | Implement 10 task: cột `cancelReason`/`cancelledAt` + `coTheHuy()` + event `OrderCancelled` + `huyDon()` + `POST /:id/huy` + Dialog huỷ web/mobile + 2 guard mới. 4 lane xanh; DB lane chưa chạy (thiếu Docker). Hai đột biến sống sót đã lộ test/guard rỗng ruột — đã sửa cả hai và tái kiểm đỏ. |
| 2026-07-18 | Review (adversarial + đột biến): APPROVE, 0 CRITICAL / 0 HIGH. Sửa 2 MEDIUM ở mobile (PopScope chặn đóng dialog lúc đang gửi; test gate rỗng ruột → thêm ca có bước kế). Đính chính claim audit ghi lý do. Kiểm chứng lại 2 bản vá đột biến của dev là thật. 4 lane xanh (1352/2/368/254); DB lane vẫn chưa chạy. |
