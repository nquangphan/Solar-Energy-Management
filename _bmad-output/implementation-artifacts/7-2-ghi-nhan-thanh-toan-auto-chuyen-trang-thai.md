---
baseline_commit: f711499
---

# Story 7.2: Ghi nhận thanh toán → auto chuyển trạng thái

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền ghi nhận thanh toán (`payments.record`),
I want ghi tiền khách trả theo từng đợt của Lịch thanh toán (qua Dialog xác nhận) và để trạng thái đơn tự nhảy khi đủ mốc,
so that công nợ và vòng đời đơn tự cập nhật, retry không ghi trùng, và tiền đã thu không bao giờ bị rollback vì một gate vận hành.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-21, sau commit `f711499` — 7.1 done)

- **7.1 đã có:** `backend/src/payments/` gồm `payments.module.ts`, `payment-schedules.{controller,service}.ts`, `domain/payment-schedule.ts` (`resolveInstallments`, `isSameSchedule`, `EDITABLE_ORDER_STATUSES`, `MAX_INSTALLMENT_AMOUNT = 2_000_000_000`, `SCHEDULE_ERROR`), `domain/payment-schedule-events.ts` (`PaymentScheduleConfigured`, `target = {type:'Order', id}`), 4 DTO. Model `PaymentSchedule` (unique `orderId`) + `Installment` (`seq`, `percent?`, `amount` INT4, `conditionNote`, `milestone` ∈ `coc|tat_toan|null`, unique `(scheduleId, seq)`, FK Restrict) — `backend/prisma/schema.prisma:~650-681`, migration `20261021130000_add_payment_schedules` (4 CHECK tay). **CHƯA có `Payment`.**
- **Mốc do server gán theo vị trí** (7.1 D2): đợt 1 = `coc`; đợt cuối (khi ≥ 2 đợt) = `tat_toan`; giữa = `null`; lịch 1 đợt ⇒ đợt duy nhất mang `coc`.
- **Hợp đồng mốc → sự kiện (5.2):** `backend/src/orders/domain/auto-transition-map.ts` — `MOC_TU_DONG`, `suKienChoMoc(moc)`: `coc → SU_KIEN.duCoc`, `tat_toan → SU_KIEN.hoanThanh`. Docstring: *"7.2 sở hữu **thời điểm gọi**: khi ghi nhận thanh toán làm một đợt vừa đủ, `payments/` dịch mốc sang sự kiện bằng `suKienChoMoc()`…"*. KHÔNG sửa file này.
- **Bảng transition** (`orders/domain/allowed-transition.ts`): `du_coc`: `dachot → dacoc`, requires `payments.record`. `hoan_thanh` có 3 dòng: `nghiemthu → hoanthanh` (requires `construction.transition`), `dagiao → hoanthanh` (requires `delivery.confirm`), `dachot → hoanthanh` (requires `payments.record`, scopeGuard `thietBi: true`). `daTaiDich(status, event)` (dòng 286) = đơn đã ở đích của sự kiện.
- **Engine** `OrdersService.applyTransition(tx, {order, event, actorPermissions, actorAccountId, sentinel, occurredAt})` (`orders.service.ts:584`, **private**): `evaluateTransition` thuần → ném 403/409 **TRƯỚC mọi lệnh ghi** → `lockOrderRow` → nếu `closeRequiresIssuedStock(from,to)` (từ `dachot`/`nghiemthu` vào `hoanthanh`, dòng 396-406) thì `assertNoUnissuedStockInTx` (dòng 1138: đọc + khoá `products` FOR UPDATE, ném 409 `STOCK_NOT_ISSUED_MESSAGE` — **không ghi gì**) → `updateMany` cổng status → `count===0` ném sentinel → vào `hoanthanh` thì `stockVouchers.releaseHeldForOrderInTx` → trả `StatusChanged` CHƯA publish.
- **`chuyenTrangThaiTuDong()`** (`orders.service.ts:682`) **TỰ MỞ tx riêng** và tự publish — docstring "RANH GIỚI TRANSACTION" nói `payments/` không cầm tx của `orders/`. **Điều đó đã bị quyết định 2026-10-21 thay thế** (spine AD-11 dòng 115, epics.md AC4 của 7.2, extra-instructions luật 9): Payment insert + transition chạy trong **MỘT tx** dưới khoá `orders`. ⇒ 7.2 KHÔNG dùng `chuyenTrangThaiTuDong()`; thêm cửa in-tx mới (D4). Method này hiện **không có call-site production** (chỉ test `orders.service.spec.ts`) — giữ nguyên, chỉ sửa docstring cho khớp sự thật (không xoá: ngoài scope).
- **Khuôn in-tx có sẵn:** `StockVouchersService.issueForOrderInTx(tx, …)` (`inventory/stock-vouchers.service.ts:~440`) — chạy trong tx của caller, không mở tx, không publish, trả event để caller publish sau commit. Áp khuôn này cho cửa orders mới (chiều ngược: `payments/` sở hữu tx vì `Payment` là aggregate của nó; `orders/` vẫn là nơi DUY NHẤT ghi `Order.status`).
- **Phạm vi:** `OrdersService.getScopedTotal(callerAccountId, quyen, orderId, vatRatePercent, tieredPricingEnabled) → {order, total}` (`orders.service.ts:1848`) — qua `findScopedOrThrow` (404 cùng thông điệp). Controller resolve quyền/VAT/cờ giá TƯƠI mỗi request (`payment-schedules.controller.ts`).
- **Event bus:** `DomainEvent` (`events/domain-event.ts`) đã nhắc `PaymentRecorded`; `AuditSubscriber` ghi MỌI event. `NotificationDispatcher` hiện là no-op (test `notification-dispatcher.spec.ts:54` dùng `type: 'PaymentRecorded'` làm fixture) — **không** đụng notifications ở story này.
- **Idempotency:** repo CHƯA có khuôn idempotency-key cho lệnh tạo mang body (các đường idempotent hiện có đều là "đã ở đích ⇒ trả view"). `Payment` mang số tiền ⇒ phải dùng khoá idempotency do client sinh (D3).
- **Khoảng trống 7.1 để lại cho 7.2 (Câu hỏi mở 1, 3 của 7.1):** (1) lịch 1 đợt có cần bắn `hoan_thanh`; (3) `replace` lịch hiện `deleteMany` installments ⇒ khi đã có `Payment` sẽ đụng FK Restrict ⇒ **500**. 7.2 PHẢI chặn (D7).
- **Parity guard 7.1 cấm chữ "Ghi nhận"** trên màn lịch: `design-system/screens/payment-schedule.test.mjs:13,106-108`. 7.2 PHẢI đổi ca này (không xoá assert chống-guard-rỗng).
- **UX đã vẽ** (`ux-designs/…/mockups/all-screens.html:2463+`, `#s-payments`): khối "Tiến độ công nợ" (Đã thu 16.602.192đ · Còn lại 66.408.768đ · `20% / 100%` · Tổng đơn 83.010.960đ); bảng đợt cột `Đợt · Số tiền · Trạng thái`, chip `Đã thu`/`Chưa thu`, dòng phụ `Thu 02/07 · Chuyển khoản`; form "Ghi nhận thanh toán · Đợt 2": **Số tiền thu · Ngày thu · Phương thức**, nút "Ghi nhận đợt 2", ghi chú *"Ghi nhận đợt cọc → trạng thái đơn tự nhảy (ví dụ sang Đã cọc). Mọi lần ghi nhận đều vào Audit log."* Mobile tương đương ("Công nợ", "Còn …"). EXPERIENCE.md:85,121 — ghi thanh toán là hành động có hệ quả tiền ⇒ **Dialog xác nhận** (UX-DR-20); :170-176 Flow 2 (Kế toán Lan ghi cọc ⇒ đơn tự sang "Đã cọc", chip đổi ngay).
- **Components:** web `ConfirmDialog`, `Dialog`, `Field` (nhận mọi `InputHTMLAttributes` ⇒ `type="date"` dùng được), `Kpi`, `Banner`, `Table`, `Money`; mobile `AppField` (text, `keyboardType`), `AppChip`, dialog, `MoneyText`, `kpi`. **Không có date picker trong design-system** ⇒ xem D9.
- **Mobile không có package `uuid`** (`mobile/pubspec.yaml`) — KHÔNG thêm dependency (D9).

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Mô hình dữ liệu (migration mới `20261022090000_add_payments`).**

```prisma
/// A payment actually received against one installment (FR-12). Append-only: never updated
/// or deleted in Phase 1. `amount` = integer đồng (AD-10).
model Payment {
  id                    String      @id @default(uuid())
  orderId               String      @map("order_id")
  order                 Order       @relation(fields: [orderId], references: [id])
  installmentId         String      @map("installment_id")
  installment           Installment @relation(fields: [installmentId], references: [id])
  amount                Int
  paidOn                DateTime    @map("paid_on") @db.Date
  method                String
  note                  String?
  idempotencyKey        String      @unique @map("idempotency_key")
  recordedByAccountId   String      @map("recorded_by_account_id")
  recordedBy            Account     @relation("PaymentRecordedBy", fields: [recordedByAccountId], references: [id], onDelete: Restrict)
  createdAt             DateTime    @default(now()) @map("created_at")

  @@index([orderId])
  @@index([installmentId])
  @@map("payments")
}
```
- Thêm back-relation `payments Payment[]` vào `Order`, `Installment`, và `Account` (`@relation("PaymentRecordedBy")`) — khuôn `StockVoucher.createdBy` (`schema.prisma:245-246`). Mọi id trong repo là `String @default(uuid())` (text, 0 chỗ dùng `@db.Uuid`) ⇒ `idempotencyKey` cũng `String` text; định dạng UUID v4 do DTO `@IsUUID('4')` canh.
- **CHECK viết tay**: `payments_amount_positive` (`amount > 0`), `payments_method_known` (`method IN ('bank_transfer','cash')`). Unique `idempotency_key` là lưới cuối của idempotency (D3).
- `orderId` **dư thừa có chủ đích** (suy được qua installment → schedule → order): để mọi truy vấn/guard phạm vi theo đơn là một `where: { orderId }` và để `Σ payments` của đơn không cần join 3 bảng. Domain phải đảm bảo `installment.schedule.orderId === orderId` khi ghi (kiểm trong tx).
- KHÔNG cột "trạng thái thanh toán" trên `orders`/`installments`: trạng thái **suy ra khi đọc** (D6) — cùng triết lý 7.1 (không lưu `basisTotal`), không có nguồn chân lý thứ hai để lệch.

**D2 — API (contract tiếng Anh, luật 8).**
- `POST /orders/:id/payments` — `@RequirePermissions(PERM.paymentsRecord)` + `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`; `:id` `ParseUUIDPipe`; `@HttpCode(200)` (lần đầu và lần retry trả CÙNG mã + CÙNG thân — client không phải phân biệt). Đặt handler trong controller mới `backend/src/payments/payments.controller.ts` (`@Controller('orders')`, khuôn `PaymentSchedulesController` — ghi lý do prefix ở docstring).
- Request `RecordPaymentRequestDto`:
  - `idempotencyKey: string` — `@IsUUID('4')`, mô tả: *"Khoá chống ghi trùng do client sinh MỘT lần cho mỗi lần mở form; retry phải gửi lại đúng khoá."*
  - `installmentId: string` — `@IsUUID()`. Dùng **id**, không `seq`: lịch có thể bị thay (trước khi có tiền) giữa lúc client xem và lúc ghi; `seq 2` của lịch mới là một đợt khác — id cũ không còn ⇒ 409 rõ ràng thay vì ghi nhầm đợt.
  - `amount: number` — `@IsInt @Min(1) @Max(MAX_INSTALLMENT_AMOUNT)`, description chứa **"số nguyên đồng"** (để `money-fields.mjs` thu vào guard), message tiếng Việt.
  - `paidOn: string` — ngày thu `YYYY-MM-DD` (`@IsISO8601({ strict: true })` + `@Matches(/^\d{4}-\d{2}-\d{2}$/)`); service chặn ngày tương lai so với **hôm nay giờ VN (UTC+7)** ⇒ 400 field `paidOn` code `futureDate`.
  - `method: 'bank_transfer' | 'cash'` — `@IsIn(PAYMENT_METHODS)`; hằng `PAYMENT_METHODS` ở domain (D5), KHÔNG literal rải rác. Nhãn hiển thị "Chuyển khoản" / "Tiền mặt" là việc của client.
  - `note?: string` — `@IsOptional @IsString`, trim, ≤ 200.
- Response `RecordPaymentResponseDto { payment: PaymentResponseDto; schedule: PaymentScheduleResponseDto; orderStatus: string; autoTransition: AutoTransitionResultDto | null }`:
  - `PaymentResponseDto { id, installmentId, amount (số nguyên đồng), paidOn: 'YYYY-MM-DD', method, note: string | null, recordedAt (ISO) }`.
  - `AutoTransitionResultDto { event: 'du_coc' | 'hoan_thanh'; outcome: 'applied' | 'already' | 'skipped'; message: string | null }` — `skipped` kèm `message` tiếng Việt = message của AppException bị nuốt (vd *"Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành."*). `null` khi lần ghi này không làm đủ mốc nào.
  - Retry (cùng key, cùng payload) ⇒ trả lại `payment` cũ, `schedule` HIỆN TẠI, `autoTransition: null` (lần retry không đánh giá lại transition).
- **Mở rộng `PaymentScheduleResponseDto` (additive, GET + PUT của 7.1 trả cùng shape):**
  - Trên lịch: `paidTotal` (Σ payments, số nguyên đồng), `remainingTotal` (= `orderTotal − paidTotal`, số nguyên đồng, có thể âm nếu lịch lệch), `paidPercent` (Int, `floor(paidTotal*100/orderTotal)`, 0 khi `orderTotal = 0` — server tính, mockup `20% / 100%`), `paymentStatus: 'unpaid' | 'partial' | 'paid'` (`paid` ⇔ `orderTotal > 0 && paidTotal >= orderTotal`), `recordable: boolean` (= status đơn ∈ `RECORDABLE_ORDER_STATUSES` — D5).
  - Trên từng đợt (`InstallmentResponseDto`): `id` (UUID — cần cho POST), `paidAmount` (số nguyên đồng), `remainingAmount` (số nguyên đồng), `status: 'unpaid' | 'partial' | 'paid'`, `payments: PaymentResponseDto[]` (sắp `paidOn` rồi `createdAt` tăng dần).
  - `editable` của 7.1 giờ = `EDITABLE_ORDER_STATUSES.has(status) && paidTotal === 0` (D7).
  - Mọi field tiền mới có description chứa "số nguyên đồng". `percent`/`paidPercent`/`seq` KHÔNG được chứa chữ đó (guard money sẽ coi là tiền).
- 400 `VALIDATION_ERROR` + fieldErrors (`amount`: `exceedsRemaining`; `paidOn`: `futureDate`; `installmentId`: `notInSchedule`); 403; 404 (đơn ngoài phạm vi/không tồn tại — cùng message); 409 `CONFLICT`: đơn ngoài `RECORDABLE_ORDER_STATUSES`, đơn chưa có lịch, đơn đổi version giữa đọc và khoá, `installmentId` không thuộc lịch hiện tại (*"Lịch thanh toán vừa thay đổi — tải lại rồi ghi nhận lại."*), khoá idempotency đã dùng cho payload KHÁC (*"Khoá ghi nhận đã được dùng cho một khoản khác."*).
- `npm run openapi:gen` — drift-guard byte-for-byte; mô tả 400/409 của POST liệt kê đủ mã như PUT 7.1 đã làm.

**D3 — Idempotent (NFR-1, AC3).**
- Trong tx, NGAY SAU khoá + re-check: `tx.payment.findUnique({ where: { idempotencyKey } })`.
  - Có và **cùng** `(orderId, installmentId, amount, paidOn, method, note đã trim)` ⇒ **replay**: không ghi, không event, không transition; trả view hiện tại.
  - Có nhưng khác bất kỳ field nào (kể cả khác đơn) ⇒ 409 *"Khoá ghi nhận đã được dùng cho một khoản khác."* (không tiết lộ khoản kia).
- Vì sao kiểm DƯỚI khoá: hai request cùng key song song cùng thấy "chưa có" ngoài tx ⇒ cả hai INSERT ⇒ cái sau ăn P2002 ⇒ 500. Dưới `orders FOR UPDATE` chúng xếp hàng, cái sau thấy cái trước ⇒ replay. Unique index vẫn là lưới cuối (nếu dính P2002 ở đây là lỗi lập trình — KHÔNG bắt rồi nuốt).
- **Phạm vi trước idempotency:** replay vẫn đi qua `getScopedTotal` trước (người ngoài phạm vi gửi key của người khác ⇒ 404, không phải replay).

**D4 — Cửa transition trong tx của caller: `OrdersService.autoTransitionInTx` (MỚI, public).**
```ts
async autoTransitionInTx(tx: PrismaTx, input: {
  readonly orderId: string;
  readonly event: TransitionEvent;
  readonly actorAccountId: string;
  readonly actorPermissions: ReadonlySet<string>;
  readonly occurredAt: Date;
}): Promise<StatusChanged | null>
```
- Caller ĐÃ khoá `orders` (op đầu tiên của tx). Method: `findOrThrowIn(tx, orderId)` (đọc trong tx) → `daTaiDich(order.status, event)` ⇒ trả `null` (no-op "already") → `applyTransition(tx, {…, sentinel: <hằng sentinel mới, module-private>})` → trả `StatusChanged` (CHƯA publish). Sentinel không thể xảy ra dưới khoá (status đọc trong tx) — nếu có ⇒ ném tiếp (lỗi lập trình, rollback toàn tx).
- **Không bao giờ publish, không mở tx, không bắt lỗi** — 403/409 của engine ném nguyên vẹn lên caller; caller quyết nuốt (D5). Hợp đồng cần ghi ở docstring + test: **mọi từ chối 403/409 của đường này đều ném TRƯỚC lệnh ghi đầu tiên của engine** (evaluate thuần; `assertNoUnissuedStockInTx` chỉ đọc + khoá) ⇒ caller bắt được mà tx vẫn sạch để commit `Payment`. Nếu sau này ai thêm một lệnh ghi trước điểm ném, test D5 (DB) phải ĐỎ.
- Source-guard `no-order-status-write-outside-transition` xanh nguyên (status vẫn chỉ ghi trong `applyTransition`). Cập nhật docstring `chuyenTrangThaiTuDong` (mục "RANH GIỚI TRANSACTION") trỏ sang `autoTransitionInTx` + quyết định 2026-10-21; KHÔNG đổi hành vi của nó.

**D5 — Domain thuần `backend/src/payments/domain/payment.ts`** (không Nest/Prisma, khuôn `payment-schedule.ts`):
- `PAYMENT_METHODS = ['bank_transfer', 'cash'] as const`; `RECORDABLE_ORDER_STATUSES` = `EDITABLE_ORDER_STATUSES ∪ {TRANG_THAI_HOAN_THANH}` (hằng `TRANG_THAI_*`, không literal). Lý do có `hoanthanh`: đơn bị đóng thủ công (nghiệm thu/đã giao) trước khi khách trả đợt cuối là chuyện thật — tiền về sau vẫn phải ghi được. Không có `baogia`/`choduyet` (đơn mở lại, tổng đang sống) và `huy` (hoàn tiền ngoài phạm vi).
- `installmentStatus(amount, paid) → 'unpaid' | 'partial' | 'paid'`; `orderPaymentStatus(orderTotal, paidTotal)`; `paidPercent(orderTotal, paidTotal)` (floor nguyên, `orderTotal <= 0 ⇒ 0`, KHÔNG nhân số thực).
- `validatePayment({ amount, installmentRemaining, paidOn, todayVn })` ⇒ lỗi có cấu trúc `{ field, code }`: `amount > installmentRemaining` ⇒ `{field:'amount', code:'exceedsRemaining'}` (ghi THIẾU được — trả nhiều lần cho một đợt; ghi VƯỢT phần còn lại của đợt thì không: một số 0 thừa là lỗi gõ phổ biến nhất với tiền); `paidOn > todayVn` ⇒ `{field:'paidOn', code:'futureDate'}`.
- **`milestonesReached(input) → MocTuDong[]`** — mốc mà LẦN GHI NÀY vừa làm đủ (cạnh lên, không phải trạng thái):
  - `coc` ⇔ đợt được ghi có `milestone === 'coc'` VÀ `paidBefore < amount <= paidAfter`.
  - `tat_toan` ⇔ ~~đợt được ghi có `milestone === 'tat_toan'` VÀ~~ (bỏ khi review 2026-10-22 — xem Dev Notes "Mặc định tất toán") lịch có đợt mang `tat_toan` (≥ 2 đợt) VÀ đợt được ghi vừa đủ (cạnh lên) VÀ sau lần ghi **mọi** đợt đều `paid` VÀ `paidTotalAfter >= orderTotal`, BẤT KỂ đợt vừa ghi là đợt nào. Lý do hai điều kiện thêm: lịch có thể lệch tổng (7.1 cho lưu lệch, chỉ cảnh báo) — trả xong đợt cuối của một lịch thiếu 10% KHÔNG phải "đã thu đủ toàn bộ giá trị đơn" (định nghĩa `MOC_TU_DONG.tatToan`).
  - Lịch **1 đợt** (đợt duy nhất mang `coc`) ⇒ chỉ `coc` ⇒ chỉ `du_coc` (trả lời Câu hỏi mở 1 của 7.1): bắn thêm `hoan_thanh` sẽ (a) từ `dacoc` không có dòng nào trong bảng, (b) nếu bắn trước `du_coc` thì `dachot → hoanthanh` nhảy cóc mọi bước thi công/giao. Đóng đơn chỉ-Thiết-bị vẫn đi đường thủ công `dagiao → hoanthanh`.
  - ~~Mỗi lần ghi gắn đúng MỘT đợt ⇒ tối đa một mốc~~ (review 2026-10-22): khi đợt cọc là đợt trả SAU CÙNG, một lần ghi đạt cả `coc` lẫn `tat_toan` ⇒ thử lần lượt `du_coc` rồi `hoan_thanh`, chỉ thử cái sau khi cái trước `applied`.
- Unit test gọi hàm THẬT trên nhiều kịch bản (cọc trả 2 lần: lần 1 thiếu ⇒ `[]`, lần 2 đủ ⇒ `['coc']`, lần 3 không có vì không vượt; tất toán khi lịch lệch tổng ⇒ `[]`; đợt giữa đủ ⇒ `[]`) — không fixture số dẫn xuất gõ tay [memory: handpicked fixture numbers].

**D6 — Service `backend/src/payments/payments.service.ts` — `record(...)`. Thứ tự BẮT BUỘC:**
1. `orders.getScopedTotal(...)` — phạm vi TRƯỚC mọi thứ (404); lấy `order` + `total`.
2. `order.status ∉ RECORDABLE_ORDER_STATUSES` ⇒ 409 *"Chỉ ghi nhận thanh toán khi đơn đã chốt và chưa huỷ."* (trước tx — từ chối không tốn khoá).
3. `paidOn` tương lai ⇒ 400 (thuần, trước tx).
4. `this.prisma.$transaction(async (tx) => …)`:
   a. `await tx.$queryRaw\`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE\`` — op ĐẦU TIÊN.
   b. Đọc LẠI `status, currentVersionId`: rời tập hoặc version khác bước 1 ⇒ 409 *"Đơn vừa thay đổi — tải lại rồi ghi nhận lại."*
   c. Idempotency (D3) ⇒ replay sớm (return `{ replay: true, payment }`) hoặc 409.
   d. Đọc lịch + đợt + Σ payments theo đợt **trong tx** (`paymentSchedule.findUnique({ where:{orderId}, include:{ installments:{ orderBy:{seq:'asc'}, include:{ payments:true } } } })` hoặc `payment.groupBy`). Không có lịch ⇒ 409 *"Đơn chưa có lịch thanh toán."*; `installmentId` không thuộc lịch ⇒ 409 (lịch vừa thay đổi).
   e. `validatePayment` với `installmentRemaining = installment.amount − paidBefore` ⇒ 400 + fieldErrors (ném trong tx ⇒ rollback, không có gì để rollback).
   f. `tx.payment.create({ data })`.
   g. `milestonesReached(...)`; nếu có mốc ⇒ `event = suKienChoMoc(moc)`; `try { statusChanged = await this.orders.autoTransitionInTx(tx, {...}) ; outcome = statusChanged ? 'applied' : 'already' } catch (e) { if (e instanceof AppException && (e.getStatus() === 409 || e.getStatus() === 403)) { outcome = 'skipped'; message = e.message; this.logger.warn(...) } else throw e; }`. (`AppException extends HttpException` ⇒ status qua `getStatus()` — `common/errors/app.exception.ts:12-23`.)
   h. Return `{ payment, statusChanged, autoTransition }`.
5. SAU commit: publish event nghiệp vụ ĐÚNG 1 lần — `DepositRecorded` nếu đợt có `milestone === 'coc'`, ngược lại `PaymentRecorded` (D8) — rồi, nếu có, `StatusChanged` ĐÚNG 1 lần. Replay ⇒ 0 publish. Lỗi ⇒ 0 publish.
6. Trả view: đọc lại lịch (ngoài tx, sau commit) qua cùng hàm dựng view của `PaymentSchedulesService` (D7) + `orderStatus` hiện tại (đọc lại đơn hoặc lấy từ `statusChanged.after`).
- **Quyền của transition là quyền của NGƯỜI GHI** (truyền `permissions` resolve tươi ở controller — không bypass, không hằng toàn quyền, khuôn `chuyenTrangThaiTuDong`). Hệ quả đã biết và CHẤP NHẬN: tất toán trên đơn `nghiemthu` đòi `construction.transition`; Kế toán không có ⇒ 403 ⇒ `skipped` + message, tiền vẫn ghi; đơn đóng thủ công sau. Ghi Câu hỏi mở 1.
- Service KHÔNG ghi `Order.status`, KHÔNG ghi bảng của aggregate đơn; chỉ `payment.create`.

**D7 — Sửa `PaymentSchedulesService` (7.1) cho có tiền.**
- `replace`: trong tx, ngay sau re-check, nếu `tx.payment.count({ where: { orderId } }) > 0` ⇒ 409 *"Đơn đã có thanh toán — không sửa lịch được."* (đặt TRƯỚC so-giống-hệt: lịch y hệt vẫn trả 200 no-op? — KHÔNG: khi đã có tiền thì mọi PUT ⇒ 409, đơn giản và đoán được). Ngoài tx cũng chặn sớm qua `editable` (view) nhưng cổng thật là trong tx (payment có thể vừa commit). Lý do chặn toàn bộ (thay vì cho sửa đợt chưa thu): giữ hai bảng `installments`/`payments` không bao giờ lệch nhau bằng một luật một dòng; sửa một phần là tính năng riêng (Câu hỏi mở 2).
- `viewOf`/`get`: nạp `payments` theo đợt, tính `paidAmount/remainingAmount/status` từng đợt + `paidTotal/remainingTotal/paidPercent/paymentStatus/recordable` (hàm domain D5), `editable` theo D2. Trích phần dựng view thành method dùng chung (vd `viewFor(order, total)` công khai trong service, `PaymentsService` gọi) — KHÔNG chép lần hai.
- `replace` trả view phải có `id` từng đợt: sau `createMany` đọc lại (hoặc `createManyAndReturn`) — `isSameSchedule` vẫn so trên các field cấu hình (không so `id`).
- Test 7.1 hiện có phải xanh; cập nhật assert shape (`toEqual` cứng) cho field mới — KHÔNG nới assert cũ.

**D8 — Event `backend/src/payments/domain/payment-events.ts`** (khuôn `PaymentScheduleConfigured`, `target = { type: 'Order', id: orderId }` để audit của đơn liền một mạch):
- `DepositRecorded` / `PaymentRecorded` — cùng shape: `actorAccountId`, `before = { installmentSeq, installmentPaid: paidBefore, orderPaid: paidTotalBefore }`, `after = { paymentId, installmentSeq, amount, paidOn, method, installmentPaid: paidAfter, orderPaid: paidTotalAfter, autoTransition: { event, outcome, message } | null }`, `occurredAt` (MỘT `Date` cho cả request, dùng chung với `StatusChanged`). Không bí mật trong payload (`note` có thể chứa thông tin khách ⇒ KHÔNG đưa `note` vào event; đủ để truy theo `paymentId`).
- Hai class tách biệt (không một class với `type` tham số): danh sách event của AD-18 nêu tên hai event; subscriber sau này (notifications Epic 9) subscribe theo tên.

**D9 — Client (web + mobile, port + fake, parity) — mở rộng màn 7.1, KHÔNG tạo màn mới.**
- **Port:** thêm `recordPayment(orderId, input): Promise<RecordPaymentResult>` vào `PaymentsPort` (web `payments-port.ts`, mobile `payments_port.dart`); type mirror DTO field-for-field (cả field mới của `PaymentSchedule`/`Installment`). Fake: lưu payment trong bộ nhớ, **replay theo `idempotencyKey`**, trả số đóng hộp — KHÔNG để màn chứa phép tính (logic số chỉ ở fake, khuôn 7.1).
- **Khoá idempotency phía client:** sinh MỘT lần khi mở form ghi nhận cho một đợt; giữ nguyên qua mọi lần bấm "Ghi nhận" lại sau lỗi mạng; sinh khoá MỚI chỉ sau khi ghi thành công hoặc đóng form. Web: `crypto.randomUUID()`. Mobile: helper `newIdempotencyKey()` (UUID v4 từ `Random.secure()`, đặt version/variant bits đúng) ở `mobile/lib/design_system/session/idempotency_key.dart` + unit test format v4 — KHÔNG thêm package.
- **Màn `PaymentScheduleScreen` (web) / `payment_schedule_screen.dart` (mobile)** chế độ XEM thêm:
  - Khối "Tiến độ công nợ" (mobile: "Công nợ"): `Đã thu` `paidTotal`, `Còn lại` `remainingTotal`, `{paidPercent}% / 100%`, `Tổng đơn` `orderTotal` — số qua `<Money>`/`MoneyText`; chỉ render khi `configured`.
  - Cột/ô `Trạng thái` mỗi đợt: chip `Đã thu` / `Thu một phần` / `Chưa thu` theo `status` server trả; dòng phụ mỗi payment `Thu {dd/MM} · {Chuyển khoản|Tiền mặt}` + số tiền (định dạng ngày là trình bày, không phải số học tiền).
  - Nút "Ghi nhận" trên đợt chưa `paid` — chỉ render khi `schedule.recordable && can(paymentsRecord)` (mobile `AppPermissionKeys` — [memory]).
  - Form "Ghi nhận thanh toán · Đợt {seq}": `Số tiền thu` (ô số thô, prefill bằng `remainingAmount` server trả — prefill không phải tính toán), `Ngày thu` (web `<Field type="date">`, mobile `AppField` text `YYYY-MM-DD` — prefill hôm nay), `Phương thức` (`Chuyển khoản` mặc định / `Tiền mặt` — Seg hoặc 2 nút như mẫu nhanh 7.1), `Ghi chú` tuỳ chọn. Bấm "Ghi nhận đợt {seq}" ⇒ **ConfirmDialog** nêu hệ quả: *"Ghi nhận {Money amount} cho Đợt {seq}?"* + nếu đợt mang `coc`: *"Đủ đợt cọc, đơn sẽ tự chuyển sang Đã cọc."* (câu cố định theo `milestone`, không suy tiền). Xác nhận ⇒ `recordPayment`.
  - Ô trống KHÔNG ép 0 [memory: blank-required-number-coerced-to-zero]: ô số tiền trống ⇒ nút disabled hoặc KHÔNG gửi key (backend 400) — chọn một, test.
  - Kết quả: cập nhật màn bằng `schedule` server trả; `autoTransition.outcome === 'applied'` ⇒ Banner thành công *"Đơn đã chuyển sang {STATUS_LABELS[orderStatus]}."*; `skipped` ⇒ Banner cảnh báo *"Đã ghi nhận tiền. Trạng thái đơn chưa đổi: {message}"*; 400 ⇒ map `fieldErrors` (`amount`/`paidOn`/`installmentId`) vào ô; 409 ⇒ message server + nút tải lại. Nút disable khi đang gửi (chống double-submit — idempotency là lưới backend, không thay cho UX).
  - Màn có prop tuỳ chọn `onOrderStatusChanged?(status)` để chi tiết đơn cập nhật chip (Flow 2 "status chip đổi ngay") — chỉ gọi khi `applied`.
- **Parity guard `design-system/screens/payment-schedule.test.mjs`:** đổi ca "no Ghi nhận" thành ca khẳng định nút/tiêu đề "Ghi nhận" chỉ nằm sau cổng `recordable && paymentsRecord`; thêm nhãn mới vào danh sách nhãn chung hai nền tảng; giữ cấm số học tiền ở screen/port/fake và assert chống-guard-rỗng.

### 3. Phạm vi

- **TRONG:** `Payment` + migration/CHECK/unique; domain `payment.ts`; `POST /orders/:id/payments`; idempotency; `OrdersService.autoTransitionInTx`; event `DepositRecorded`/`PaymentRecorded`; mở rộng view lịch (đã thu/còn lại/trạng thái đợt/payments) + chặn sửa lịch khi đã có tiền; guard phạm vi mở rộng; màn web + mobile (khối công nợ, trạng thái đợt, form + ConfirmDialog) + port/fake; test các lane.
- **NGOÀI:** sửa/xoá/huỷ một `Payment` (append-only; sửa sai = story sau — Câu hỏi mở 3); hoàn tiền khi huỷ đơn; sửa một phần lịch khi đã có tiền; báo cáo công nợ (PRD:515, Phase sau); notification cho thanh toán (dispatcher no-op, Epic 9); hợp đồng/hoá đơn (7.3-7.5); router/HTTP adapter thật (TD-38); đụng `chuyenTrangThaiTuDong` ngoài docstring.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:620-626`)

- **Given** một đợt thanh toán, **When** ghi nhận (qua Dialog xác nhận), **Then** tạo `Payment`, cập nhật trạng thái thanh toán của Đơn, ghi Audit (FR-12, UX-DR-20).
- **Given** ghi đủ đợt cọc đầu, **When** xử lý, **Then** gọi `applyTransition()` để Đơn tự sang "Đã cọc" (không ghi status trực tiếp) (FR-8, FR-12, AD-11).
- **Given** thao tác tiền, **When** retry, **Then** idempotent, không ghi trùng; publish event `DepositRecorded`/`PaymentRecorded` qua EventBus (NFR-1, AD-18).
- **Given** `Payment` được ghi và transition tự động bị chặn 409 (vd đóng đơn khi chưa xuất đủ kho), **When** xử lý, **Then** `Payment` insert + `chuyenTrangThaiTuDong()`/`applyTransition()` chạy trong MỘT transaction dưới khoá dòng đơn (`SELECT ... FOR UPDATE` trên `orders` trước); `Payment` VẪN commit, transition bị bỏ qua + log + publish event nghiệp vụ, không rollback tiền (F-3, TD-40; [Source: ARCHITECTURE-SPINE AD-11]). Test khoá theo luật F-5 trong `backend/CONVENTIONS.md`.

### AC dẫn xuất (đo được)

1. **AC-1 (ghi cọc ⇒ Đã cọc):** đơn `dachot` tổng 83.010.960, lịch 20/70/10; `POST` đợt 1 `amount 16602192` ⇒ 200; DB 1 dòng `payments`; đơn `dacoc`; response `autoTransition = {event:'du_coc', outcome:'applied', message:null}`, `orderStatus:'dacoc'`, đợt 1 `status:'paid'`, `paidTotal 16602192`, `remainingTotal 66408768`, `paidPercent 20`, `paymentStatus:'partial'` (khớp mockup). Status đổi CHỈ qua `applyTransition` (guard `no-order-status-write-outside-transition` xanh, không nới).
2. **AC-2 (cọc trả nhiều lần):** đợt 1 ghi `10_000_000` ⇒ `status:'partial'`, đơn vẫn `dachot`, `autoTransition:null`; ghi tiếp `6_602_192` ⇒ `paid` + `du_coc applied`; ghi thêm 1 đồng vào đợt 1 ⇒ 400 `amount`/`exceedsRemaining`.
3. **AC-3 (idempotent):** cùng `idempotencyKey` + cùng payload gửi 2 lần ⇒ cả hai 200, cùng `payment.id`, DB 1 dòng, `eventBus.publish` tổng cộng: lần 1 đúng 2 lần (`DepositRecorded` + `StatusChanged`), lần 2 **0** lần (`toHaveBeenCalledTimes`, không `mock.calls[0]` [memory]). Cùng key, khác `amount` (hoặc khác đơn) ⇒ 409, không ghi. Người ngoài phạm vi gửi key đã dùng ⇒ 404 (không phải replay).
4. **AC-4 (transition bị chặn — tiền vẫn commit, lane DB):** đơn `nghiemthu` (có cờ Thi công, có dòng vật tư theo dõi tồn CHƯA xuất), lịch 20/70/10 đã thu đợt 1-2; người ghi có `payments.record` + `construction.transition`; `POST` đợt 3 đủ ⇒ 200, dòng `payments` TỒN TẠI sau commit, đơn VẪN `nghiemthu`, `autoTransition = {event:'hoan_thanh', outcome:'skipped', message: STOCK_NOT_ISSUED_MESSAGE}`, có log warn, publish `PaymentRecorded` 1 lần (mang `autoTransition` skipped), **0** `StatusChanged`, không dòng audit `StatusChanged`. Biến thể 403: người ghi thiếu `construction.transition` ⇒ cũng `skipped` + tiền commit. Biến thể không-trong-bảng: đơn `thicong` trả xong đợt cuối ⇒ `skipped` (409 ngoài bảng).
5. **AC-5 (cùng MỘT tx):** unit mock-forced: `orders.autoTransitionInTx` nhận ĐÚNG client `tx` của `$transaction` (assert identity), được gọi SAU `payment.create` và trong cùng callback; lỗi KHÔNG phải 403/409 từ `autoTransitionInTx` (vd lỗi DB) ⇒ ném tiếp ⇒ rollback ⇒ 0 payment, 0 publish (lane DB: ép lỗi bằng mock hoặc ca DB nếu dựng được). Mock `$transaction` phải CHẠY callback [memory: mockRejectedValue tx hides publish-order bugs].
6. **AC-6 (tất toán đúng nghĩa):** đơn `dagiao`, người ghi có `delivery.confirm`, trả xong đợt cuối, lịch khớp tổng ⇒ `hoan_thanh applied`, đơn `hoanthanh`. Lịch LỆCH tổng (Σ lịch < tổng đơn) trả xong mọi đợt ⇒ `autoTransition:null`, đơn không đổi. Lịch 1 đợt 100% trả đủ ⇒ chỉ `du_coc` (không `hoan_thanh`).
7. **AC-7 (already):** đơn đã `dacoc` (vd đã chuyển tay/đợt cọc ghi lại sau khi trạng thái đã đi tiếp nhưng đợt cọc mới vừa đủ) ⇒ `du_coc` với đơn ở đích ⇒ `outcome:'already'`, 0 `StatusChanged`. Đơn ở `thicong` khi đợt cọc vừa đủ ⇒ `skipped` (ngoài bảng), tiền commit.
8. **AC-8 (validate + trạng thái):** `amount` 0/âm/thập phân/> 2.000.000.000 ⇒ 400 field `amount`; `paidOn` sai định dạng hoặc ngày mai (giờ VN) ⇒ 400 field `paidOn` (`futureDate`); `method` lạ ⇒ 400; `note` > 200 ⇒ 400; `idempotencyKey` không phải UUID v4 ⇒ 400; đơn `baogia`/`choduyet`/`huy` ⇒ 409; đơn chưa có lịch ⇒ 409; `installmentId` của đơn khác / của lịch cũ đã thay ⇒ 409; mọi từ chối ⇒ 0 dòng, 0 publish. Đơn `hoanthanh` ⇒ ghi được (đợt còn nợ). Mã HTTP đo ở lane e2e qua ValidationPipe thật [memory: dev pins AC deviation].
9. **AC-9 (quyền + phạm vi):** thiếu `payments.record` ⇒ 403; `orders.view_own` không phải owner/assignee ⇒ 404 CÙNG message id không tồn tại; id không UUID ⇒ 400. Source-guard phạm vi mở rộng ĐỎ khi gỡ `this.orders.getScopedTotal(` khỏi `record` (mutation, `cp` backup — KHÔNG `git checkout` [memory]).
10. **AC-10 (khoá — lane DB, luật F-5):** (a) tx A khoá `orders` FOR UPDATE **và đã INSERT một payment** cho đợt 1 (ghi đúng thứ B đọc: Σ payments của đợt) chưa commit; B `record` đợt 1 với số chỉ vừa nếu chưa có payment của A; commit A ⇒ B nhận 400 `exceedsRemaining`, Σ đợt 1 ≤ amount, không vượt. Gỡ `FOR UPDATE` (mutation) ⇒ ca này ĐỎ (B vượt). (b) Hai `record` song song CÙNG `idempotencyKey` ⇒ đúng 1 dòng, cả hai 200 cùng `payment.id`, không 500 P2002. Gỡ `FOR UPDATE` ⇒ ĐỎ. (c) tx A khoá `orders` **và đã INSERT payment** cho đơn; B `PUT` lịch (7.1) song song ⇒ sau commit A, B nhận 409 "đã có thanh toán" (KHÔNG 500 FK). Assert số dòng cuối, không assert thời gian [memory: fk-key-share-masks-missing-row-lock].
11. **AC-11 (re-check trong tx):** đơn bị huỷ / đổi `currentVersionId` giữa đọc phạm vi và khoá ⇒ 409, không ghi (unit mock-forced; DB nếu dựng được interleaving — khuôn ca "cancelled under the lock" của 7.1).
12. **AC-12 (chặn sửa lịch khi có tiền):** đơn có ≥ 1 payment ⇒ `PUT /orders/:id/payment-schedule` ⇒ 409 *"Đơn đã có thanh toán — không sửa lịch được."* (kể cả payload y hệt); `GET` ⇒ `editable:false`. Không còn đường nào dẫn tới 500 FK Restrict trên `installments`.
13. **AC-13 (view + audit):** `GET` lịch trả đủ field mới đúng số (`paidAmount`/`remainingAmount`/`status` từng đợt, `payments[]` sắp đúng thứ tự, `paidTotal`/`remainingTotal`/`paidPercent`/`paymentStatus`/`recordable`); audit có dòng `DepositRecorded`/`PaymentRecorded` target `{type:'Order', id}` (lane DB, khuôn ca "one audit row" của 7.1); event KHÔNG chứa `note`.
14. **AC-14 (integer):** mọi field tiền trong response `Number.isInteger`; `paidPercent` = floor nguyên (vd 16.602.192/83.010.960 ⇒ 20; 1/3 ⇒ 33); `orderTotal 0` ⇒ `paidPercent 0` (không chia 0). CHECK `payments_amount_positive`, `payments_method_known` đứng riêng được (ghi thẳng DB ⇒ vi phạm — lane DB).
15. **AC-15 (contract):** `openapi.json` regen có `POST /orders/{id}/payments` + DTO mới tiếng Anh; `money-fields.mjs` tự thu `amount` (request + `PaymentResponseDto`), `paidTotal`, `remainingTotal`, `paidAmount`, `remainingAmount` — và KHÔNG thu `paidPercent` (kiểm bằng test guard money hiện có, `cd design-system && npm test`). `permissions.json` KHÔNG đổi (không key mới).
16. **AC-16 (client):** web `web/src/test/payment-schedule-screen.test.tsx` thêm ca: khối công nợ hiện 3-4 số qua Money; chip trạng thái theo `status`; nút "Ghi nhận" ẩn khi thiếu quyền / `recordable:false` / đợt `paid` (fixture BẬT mọi điều kiện bao ngoài — [memory: widget test gate unreachable behind outer condition]); bấm Ghi nhận ⇒ ConfirmDialog ⇒ xác nhận mới gọi port; huỷ dialog ⇒ 0 lời gọi; retry sau lỗi mạng gửi CÙNG `idempotencyKey`, ghi thành công xong mở lại form ⇒ khoá MỚI; ô tiền trống không gửi 0; Banner `applied`/`skipped`; map fieldErrors; chống double-submit; `onOrderStatusChanged` chỉ gọi khi `applied`. Mobile `mobile/test/screens/payments/payment_schedule_screen_test.dart` cùng bộ ca + 320/360 px không tràn với nhãn dài nhất ("Ghi nhận thanh toán · Đợt 12", ghi chú 200 ký tự); unit test `newIdempotencyKey()` khớp regex UUID v4 và 1000 lần không trùng. Parity guard cập nhật (D9). `screens-render.test.tsx` vẫn xanh (không thêm file `*Screen.tsx` mới ⇒ guard đếm không đổi; nếu tách component con thì KHÔNG đặt tên `*Screen.tsx`).

---

## Tasks / Subtasks

- [x] **T1 — Schema + migration** (AC 1, 10, 14)
  - [x] T1.1 Model `Payment` + back-relation ở `Order`, `Installment`, `Account` trong `backend/prisma/schema.prisma` (docstring tiếng Anh; đặt model ngay sau `Installment`, KHÔNG chèn giữa khối `///` của model khác — bài học 7.1 review #2).
  - [x] T1.2 Migration `backend/prisma/migrations/20261022090000_add_payments/migration.sql`: sinh SQL bằng `prisma migrate diff --from-config-datasource --to-schema` (cách 7.1 đã chạy được, xem Debug Log 7.1) rồi thêm 2 CHECK tay; diff sau deploy = rỗng.
  - [x] T1.3 `npx prisma migrate deploy` lên `pns-postgres:5433` (CHỈ DB local này).
- [x] **T2 — Domain thuần** (AC 1, 2, 6, 7, 8, 14)
  - [x] T2.1 `backend/src/payments/domain/payment.ts`: `PAYMENT_METHODS`, `RECORDABLE_ORDER_STATUSES`, `installmentStatus`, `orderPaymentStatus`, `paidPercent`, `validatePayment`, `milestonesReached`, `isSamePaymentRequest` (cho D3).
  - [x] T2.2 `backend/src/payments/domain/payment-events.ts`: `DepositRecorded`, `PaymentRecorded`.
  - [x] T2.3 `backend/test/payment.spec.ts`: mọi kịch bản D5 (cạnh lên coc qua nhiều lần trả, tat_toan cần đủ mọi đợt + Σ ≥ tổng, lịch lệch, lịch 1 đợt, exceedsRemaining biên `== remaining` OK / `+1` lỗi, futureDate biên nửa đêm UTC+7, paidPercent floor + chia 0).
- [x] **T3 — Cửa transition in-tx** (AC 4, 5, 7)
  - [x] T3.1 `OrdersService.autoTransitionInTx` (D4) + sentinel module-private; cập nhật docstring `chuyenTrangThaiTuDong`.
  - [x] T3.2 Unit `backend/test/orders.service.spec.ts` (hoặc file mới `order-auto-transition-in-tx.spec.ts`): đã ở đích ⇒ null + 0 `updateMany`; hợp lệ ⇒ `StatusChanged` không publish; 403/409 ném trước mọi `updateMany`/`create` (assert mock ghi không được gọi); không mở `$transaction`.
- [x] **T4 — Service + controller + DTO** (AC 1-13)
  - [x] T4.1 DTO `backend/src/payments/dto/{record-payment-request,record-payment-response,payment-response,auto-transition-result}.dto.ts`; mở rộng `installment-response.dto.ts` + `payment-schedule-response.dto.ts` (description tiền có "số nguyên đồng").
  - [x] T4.2 `backend/src/payments/payments.service.ts` (`record` theo D6) + `Logger` warn khi skipped (log tiếng Anh, không in `note`).
  - [x] T4.3 `backend/src/payments/payments.controller.ts` (D2); đăng ký controller + provider trong `payments.module.ts` (cập nhật docstring module: FR-12).
  - [x] T4.4 Sửa `payment-schedules.service.ts` theo D7 (chặn replace khi có tiền trong tx, view dùng chung có field mới + `id`).
  - [x] T4.5 Unit `backend/test/payments.service.spec.ts`: thứ tự scope → status → paidOn → tx[khoá ĐẦU TIÊN → re-check → idempotency → lịch/đợt → validate → create → transition] → publish sau commit (Deposit/Payment trước, StatusChanged sau, mỗi cái đúng 1 lần); replay 0 publish; skipped 403/409 ⇒ tiền vẫn ra, lỗi khác ném tiếp; `autoTransitionInTx` nhận đúng `tx`.
  - [x] T4.6 Cập nhật `backend/test/payment-schedules.service.spec.ts` (chặn replace khi có payment, field view mới).
  - [x] T4.7 e2e `backend/test/payments.e2e.spec.ts` qua `initAppOnLoopback`: 200 / 200 replay / 400 fieldErrors từng mã / 403 / 404 / 409 từng nhánh / UUID pipe / shape response; route `/orders/...` cũ và `/orders/:id/payment-schedule` vẫn chạy.
  - [x] T4.8 Lane DB `backend/test/payments.db.integration.spec.ts`: AC-1/2/4 (cả 3 biến thể skipped)/6/12/13/14 trên Postgres thật + 3 ca interleaving AC-10 + mutation gỡ `FOR UPDATE` ⇒ ĐỎ (ghi bảng vào Completion Notes).
- [x] **T5 — Guard + contract** (AC 9, 15)
  - [x] T5.1 Mở rộng `backend/test/no-unscoped-order-write.spec.ts`: thêm mục `FILE_CANH` cho `payments/payments.service.ts` với lời gọi phạm vi `/this\.orders\.getScopedTotal\s*\(/`; mẫu "chạm đơn" thêm `\.payment\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|find(?:Unique|First|Many)|count|groupBy|aggregate)\s*\(`; anti-blind trích method `record` (thân > 0, chứa `.payment.create(`). Mutation chứng minh ĐỎ.
  - [x] T5.2 `npm run openapi:gen`; drift-guard xanh; `permissions.json` không đổi.
- [x] **T6 — Web** (AC 16)
  - [x] T6.1 `payments-port.ts` (+ type mới, `recordPayment`) + `fake-payments-port.ts` (replay theo key).
  - [x] T6.2 `PaymentScheduleScreen.tsx` (+ `payment-schedule.css` chỉ class có rule thật — guard css-class-coverage): khối công nợ, chip trạng thái, form + ConfirmDialog, Banner kết quả, prop `onOrderStatusChanged`.
  - [x] T6.3 Test `payment-schedule-screen.test.tsx`; `cd web && npm run typecheck && npm test && npm run build`.
- [x] **T7 — Mobile** (AC 16)
  - [x] T7.1 `payments_port.dart` + `fake_payments_port.dart` + `idempotency_key.dart` (+ export ở `session.dart`).
  - [x] T7.2 `payment_schedule_screen.dart` (widget design-system, `MoneyText`, `AppPermissionKeys`, dialog xác nhận).
  - [x] T7.3 Widget test + unit test khoá; `cd mobile && flutter analyze && flutter test`. `dart format` chỉ với `-o none --set-exit-if-changed` hoặc đúng file mình sửa [memory: dart format writes files].
- [x] **T8 — Parity + 5 lane** (AC 15, 16)
  - [x] T8.1 Cập nhật `design-system/screens/payment-schedule.test.mjs` (D9).
  - [x] T8.2 Chạy đủ 5 lane: `cd backend && npm test` · `npm run test:db` · `cd design-system && npm test` · web (typecheck/test/build) · mobile (analyze/test). Lint backend: so baseline bằng stash [memory: backend lint đỏ sẵn] — file MỚI phải sạch.

---

## Dev Notes

### Quyết định của Đại Ca và luật đã chốt (2026-10-21) — ưu tiên hơn mọi chỗ khác

[Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`; spine AD-11 dòng 115; epics.md:626]
1. Mọi đường ghi đơn mới qua kiểm phạm vi ⇒ D6 bước 1 + guard T5.1.
2. (Tồn kho — story này chỉ ĐỌC qua engine `assertNoUnissuedStockInTx`, không ghi tồn; thứ tự khoá `orders → products` được engine giữ.)
3. Màn web: không có màn mới ⇒ `screens-render.test.tsx` không đổi số; vẫn chạy đủ typecheck/test/build.
4. Mobile widget test bắt buộc.
5. Guard mới/mở rộng có assert chống-guard-rỗng.
6. e2e dùng `initAppOnLoopback`.
7. KHÔNG `git push`; `git add` đường dẫn cụ thể; `package-lock.json` `git add -f` nếu đổi.
8. Code tiếng Anh; chỉ chuỗi hiển thị tiếng Việt; route/DTO/port mới tiếng Anh (`/orders/:id/payments`, `record`, `autoTransitionInTx`, `recordPayment`). Không đổi tên symbol tiếng Việt cũ (`MOC_TU_DONG`, `SU_KIEN`, `TRANG_THAI_*`, `chuyenTrangThaiTuDong`, `daTaiDich` dùng nguyên).
9. **TIỀN:** số nguyên đồng; Payment idempotent dưới khoá `orders` FOR UPDATE (op đầu tiên); ca DB interleaving F-5; Payment + transition cùng MỘT tx; transition 409 ⇒ Payment VẪN ghi, transition bỏ qua + log + event, không rollback tiền. Hiển thị qua `<Money>`/`MoneyText`.

### Mặc định tất toán (Trợ Lý tuyên bố, áp khi review 2026-10-22) — thay D5 gốc

- **Luật:** đơn tự sang hoàn thành (`hoan_thanh`) khi LẦN GHI NÀY làm **mọi** đợt đủ tiền VÀ tổng thu ≥ tổng đơn, **bất kể đợt vừa ghi là đợt nào** (khách trả đợt cuối trước rồi trả nốt đợt giữa ⇒ lần ghi đợt giữa tự hoàn thành). Lịch lệch tổng (Σ lịch < tổng đơn) vẫn KHÔNG tất toán.
- **Cạnh lên:** một khoản chỉ được nhận khi đợt của nó còn nợ (`exceedsRemaining`), nên trước lần ghi "mọi đợt đủ" luôn sai ⇒ điều kiện đúng sau lần ghi chính là cạnh lên; không lần ghi nào sau đó bắn lại.
- **Lịch 1 đợt giữ nguyên AC-6** (chỉ `du_coc`): `tat_toan` cần lịch có đợt tất toán (≥ 2 đợt) — đóng thẳng từ đợt cọc sẽ bỏ qua mọi bước thi công/giao (lý do D5 gốc).
- **Đợt cọc trả sau cùng** ⇒ đạt cả hai mốc trong một lần ghi: thử `du_coc` rồi `hoan_thanh` trong CÙNG tx, mỗi lần từ chối 403/409 nuốt riêng; `hoan_thanh` CHỈ được thử khi `du_coc` `applied` (nếu cọc bị từ chối trên `dachot`, đóng thẳng qua dòng `dachot → hoanthanh` sẽ bỏ qua giao hàng). Thực tế: từ `dacoc` không có dòng `hoan_thanh` ⇒ lần thử này luôn `skipped` (log warn + ghi trong event) — đúng sự thật: tiền đủ nhưng đơn còn phải thi công/giao, đóng tay sau.
- **Contract:** response giữ MỘT `autoTransition` (không đổi client) = lần chuyển đã đổi trạng thái đơn, không có thì lần thử sau cùng. Event `DepositRecorded`/`PaymentRecorded` mang `after.autoTransitions[]` = MỌI lần thử (audit đủ). Câu hỏi mở 5 cũ (trả đợt cuối trước ⇒ không mốc nào bắn) được giải bằng luật này.
- Test: `payment.spec.ts` (đợt giữa trả sau cùng ⇒ `tat_toan`; cọc trả sau cùng ⇒ `[coc, tat_toan]`; lịch lệch tổng tất toán ở đợt giữa ⇒ `[]`), `payments.service.spec.ts` (đợt giữa sau cùng ⇒ `hoan_thanh` applied; cọc sau cùng ⇒ 2 lần gọi cùng `tx`, response báo `du_coc applied`, event 2 lần thử; cọc bị từ chối ⇒ KHÔNG thử `hoan_thanh`), lane DB (`dagiao` trả đợt 3 rồi đợt 2 ⇒ `hoanthanh`; `dachot` trả 3, 2 rồi cọc ⇒ `dacoc`, 3 dòng payments, 1 `StatusChanged`).

### Files sẽ đổi / tạo

| File | Loại | Ghi chú |
|---|---|---|
| `backend/prisma/schema.prisma` | UPDATE | + `Payment`, back-relation `Order`/`Installment`/`Account` |
| `backend/prisma/migrations/20261022090000_add_payments/migration.sql` | NEW | + 2 CHECK tay, unique key |
| `backend/src/payments/payments.{controller,service}.ts` | NEW | `POST /orders/:id/payments` |
| `backend/src/payments/domain/{payment,payment-events}.ts` | NEW | thuần |
| `backend/src/payments/dto/{record-payment-request,record-payment-response,payment-response,auto-transition-result}.dto.ts` | NEW | |
| `backend/src/payments/dto/{installment-response,payment-schedule-response}.dto.ts` | UPDATE | field additive |
| `backend/src/payments/payment-schedules.service.ts` | UPDATE | chặn replace khi có tiền; view dùng chung |
| `backend/src/payments/payment-schedules.controller.ts` | UPDATE | mô tả 409 mới của PUT |
| `backend/src/payments/payments.module.ts` | UPDATE | + controller/provider |
| `backend/src/orders/orders.service.ts` | UPDATE | + `autoTransitionInTx` công khai; docstring `chuyenTrangThaiTuDong`; KHÔNG đổi method khác |
| `backend/test/no-unscoped-order-write.spec.ts` | UPDATE | canh `payments.service.ts` |
| `backend/test/{payment,payments.service,payments.e2e,payments.db.integration}.spec.ts` | NEW | |
| `backend/test/payment-schedules.{service,e2e,db.integration}.spec.ts` | UPDATE | field mới + 409 có tiền |
| `backend/openapi/openapi.json` | REGEN | |
| `web/src/design-system/session/{payments-port,fake-payments-port}.ts` | UPDATE | |
| `web/src/screens/payments/PaymentScheduleScreen.tsx` (+css) | UPDATE | |
| `web/src/test/payment-schedule-screen.test.tsx` | UPDATE | |
| `mobile/lib/design_system/session/{payments_port,fake_payments_port}.dart` | UPDATE | |
| `mobile/lib/design_system/session/idempotency_key.dart` (+ `session.dart` export) | NEW/UPDATE | |
| `mobile/lib/screens/payments/payment_schedule_screen.dart` | UPDATE | |
| `mobile/test/screens/payments/payment_schedule_screen_test.dart`, `mobile/test/design_system/idempotency_key_test.dart` (cạnh `session_test.dart`) | UPDATE/NEW | |
| `design-system/screens/payment-schedule.test.mjs` | UPDATE | bỏ cấm "Ghi nhận", thêm cổng |

### Hiện trạng phải giữ

- `applyTransition`, `evaluateTransition`, `ALLOWED_TRANSITIONS`, `auto-transition-map.ts`, `chuyenTrangThaiTuDong` (hành vi) — KHÔNG đổi. Test 5.x hiện có xanh nguyên.
- 7.1: `GET`/`PUT /orders/:id/payment-schedule` chạy y nguyên khi chưa có tiền (mọi test 7.1 xanh; chỉ thêm assert field mới). `resolveInstallments`/`isSameSchedule` không đổi.
- `OrderDetailScreen`/`order_detail_screen` không đổi (nút "Thanh toán" của 7.1 đã đủ làm lối vào); KHÔNG thêm tab thứ 4 ở story này trừ khi chỉ cần đổi comment — giữ nguyên guard `order-detail.test.mjs` "đúng 3 tab".
- Không route cũ nào đổi; `OrdersController` không thêm handler.

### Tình huống biên đã tính

- Lịch lệch tổng: đã thu `paidTotal` có thể > `orderTotal` nếu Σ lịch > tổng (60/60) ⇒ `remainingTotal` âm, `paymentStatus:'paid'`; tất toán chỉ khi mọi đợt `paid` VÀ Σ ≥ tổng (D5).
- Đơn mở lại sau khi đã thu một phần cọc (`dachot → baogia` qua mo_lai): ghi tiền ⇒ 409 (ngoài `RECORDABLE`); lịch khoá sửa (có tiền) ⇒ sau re-chốt tổng đổi, lịch hiện lệch, KHÔNG sửa được — chấp nhận, ghi Câu hỏi mở 2.
- Đơn huỷ khi đã có tiền: tiền giữ nguyên trong DB (append-only); hoàn tiền ngoài phạm vi.
- `paidOn` là NGÀY (không giờ) — lưu `@db.Date`; so "tương lai" với ngày hiện tại UTC+7 (khách ở VN, server có thể chạy UTC). Test biên 23:30 UTC ngày D (= 06:30 ngày D+1 giờ VN) ⇒ `paidOn = D+1` HỢP LỆ.
- `note` trim; chuỗi rỗng sau trim ⇒ lưu `null`; so replay dùng giá trị đã chuẩn hoá.
- Tràn INT4 (bài học 7.1 review #1, memory int4-money-column): `amount` request có `@Max(MAX_INSTALLMENT_AMOUNT)` + luôn ≤ `remaining` của một đợt (đợt ≤ 2 tỉ) ⇒ không tràn. `paidTotal`/`orderTotal` là SUM tính ở JS (number, < 2^53) — KHÔNG ghi tổng vào cột INT4 nào. Nếu dùng `payment.aggregate _sum` của Prisma trên INT4, kết quả Postgres là BIGINT ⇒ kiểm kiểu trả về (bigint/number) trước khi cộng.
- Ghi nhận khi transition `applied` vào `hoanthanh` ⇒ engine tự `releaseHeldForOrderInTx` trong CÙNG tx — đúng ý (đơn hoàn thành không giữ tồn).

### Kiểm thử — luật dự án áp dụng trực tiếp

- `FOR UPDATE` chỉ đo được ở lane DB; tx giữ khoá phải GHI đúng thứ B đọc (INSERT `payments` của đợt/đơn đó), không khoá trần [CONVENTIONS#Khoá dòng; memory fk-key-share-masks, atomic-replace].
- Mutation: `cp` backup, mutant phải compile, KHÔNG `git checkout`. Mutate từng lớp: (a) gỡ `FOR UPDATE` trong `record` ⇒ AC-10 (a)(b) ĐỎ; (b) gỡ `getScopedTotal` ⇒ guard + e2e 404 ĐỎ; (c) đảo/bỏ cạnh lên trong `milestonesReached` (dùng `>=` trạng thái thay cạnh) ⇒ unit AC-2 ĐỎ (bắn `du_coc` lần 3); (d) nuốt MỌI lỗi thay vì chỉ 403/409 ⇒ unit AC-5 ĐỎ; (e) bỏ check payment-count trong `replace` ⇒ AC-10 (c) + AC-12 ĐỎ (500 FK); (f) bỏ re-check trong tx ⇒ AC-11 ĐỎ; (g) bỏ điều kiện "mọi đợt paid + Σ ≥ tổng" ⇒ AC-6 lịch lệch ĐỎ. Kiểm mutant không tương đương ngữ nghĩa trong fixture trước khi kết luận [memory: mutation semantically equivalent]. Ghi bảng kết quả vào Completion Notes — tự chạy, đừng chép.
- Publish: `toHaveBeenCalledTimes`, không `mock.calls[0]`.
- Reviewer song song mutate cùng file ⇒ kiểm lại finding trên file hiện tại [memory: parallel reviewers collide].
- Lane DB cần Docker: `docker start pns-postgres`; nếu daemon không lên từ shell agent ⇒ viết spec, báo lane CHƯA chạy, nhờ Đại Ca mở Docker Desktop [memory]. KHÔNG ghi DB nào khác.
- Fixture đơn cho AC-4 cần dòng vật tư `tracksStock` CHƯA xuất ở đơn `nghiemthu` — dựng qua service thật hoặc insert thẳng theo khuôn `stock-*.db.integration.spec.ts` của Epic 6 (đọc trước khi viết).

### Previous Story Intelligence (7.1 + Epic 6)

- **7.1 review #1 — INT4:** server-derived money có thể tràn; ở đây mọi tổng ở JS, chỉ `amount` một payment vào cột ⇒ đã có trần.
- **7.1 review #2:** đừng chèn model giữa khối docstring `///` của model khác.
- **7.1 review #3:** mọi message class-validator hiển thị tới client phải tiếng Việt (`@Max`, `@IsIn`, `@IsUUID`, `@Matches` — truyền `message`).
- **7.1 review #4:** parity web↔mobile ở form (trạng thái chọn, đổi kiểu xoá số) — làm form ghi nhận giống nhau ngay từ đầu.
- **7.1 Debug Log:** `migrate diff --from-migrations` đòi shadow DB ⇒ dùng `--from-config-datasource --to-schema`; Money guard bắt `${x.amount}` khi prefill ô nhập ⇒ prefill qua helper chữ số (mobile `_digits(int)`), web truyền số thẳng vào `value`; mobile cấm `Color(0x…)` ad-hoc.
- **7.1 mutation:** ca "2 lần lưu đầu song song" xanh cả dưới mutant (không ép được interleaving) — ở 7.2 ca idempotency song song (b) PHẢI ép interleaving bằng holder giữ khoá + đã INSERT, không chỉ `Promise.all`.
- **6.7:** khuôn op-đầu-tiên khoá `orders` rồi đọc LẠI trong tx; test khoá false-green 2 lần vì holder không ghi.
- **6.4 (quyết định B):** contract tiếng Anh cho code mới.
- **6.3:** ô số trống bị ép 0; mobile dùng `AppPermissionKeys`.
- **Epic 5/6:** widget test mobile nhãn DÀI NHẤT ở 320/360 px.

### Git intelligence (5 commit gần nhất)

- `f711499` feat(story-7.1): lịch nhiều đợt — toàn bộ khung `payments/`, khuôn khoá/re-check/no-op/publish 1 lần, guard phạm vi đọc `FILE_CANH` theo `src/`, parity guard màn lịch. 7.2 mở rộng đúng các file này.
- `13408c1` docs(epic-7): quyết định Payment↔transition (spine AD-11) — nguồn của D4/D6.
- `a66c649`, `98fd6dc`: đóng Epic 6, đồng bộ project-context (luật ngôn ngữ, Money formatter, lane DB).
- `02f9d94` (6.7): khuôn subscriber/khoá + test interleaving — tham chiếu T4.8.
- Commit story này: `feat(story-7.2): ...` tiếng Anh, không nhắc AI, `git add` đúng đường dẫn.

### Latest tech notes

- Không thêm thư viện (backend/web/mobile). Stack ghim trong `project-context.md` (NestJS 11.1.27, Prisma 7.8.0 + adapter-pg, React 19.2.7, Flutter 3.44).
- Prisma 7: `createManyAndReturn` có cho Postgres (dùng nếu cần `id` sau `createMany` ở D7); `aggregate._sum` trên Int trả `number | null` ở Prisma nhưng Postgres SUM(int4) là bigint — kiểm thực tế ở lane DB; `@db.Date` nhận `Date` (giờ bị cắt) — truyền `new Date('YYYY-MM-DDT00:00:00.000Z')`, trả về Date UTC nửa đêm ⇒ format lại `YYYY-MM-DD` bằng `toISOString().slice(0,10)` ở view. P2002/P2003 tag chỉ đáng tin khi INSERT [memory prisma7-p2003].
- class-validator: `@IsUUID('4')`, `@IsISO8601({ strict: true })`, `@IsIn([...])`; message tiếng Việt cho từng decorator.
- Web `crypto.randomUUID()` có trong jsdom/Node ≥ 19 (vitest chạy được); nếu test cần khoá xác định, tiêm qua prop `newKey?: () => string` thay vì mock global.

### Project Structure Notes

- Module `payments/` khớp spine (`PaymentSchedule, Installment, Payment; auto-transition trigger`). Route `orders/:id/payments` là sub-resource của đơn (CONVENTIONS: danh từ, kebab-case); bảng `payments` snake_case số nhiều.
- Biến thể có chủ đích: `payments/` sở hữu tx và gọi `orders.autoTransitionInTx(tx, …)` — ngược chiều khuôn `issueForOrderInTx` (nơi `orders/` sở hữu tx). Lý do: aggregate được ghi là `Payment`; `orders/` vẫn là nơi DUY NHẤT ghi status. Ghi lý do ở docstring cả hai phía.

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Tất toán khi người ghi thiếu quyền của cạnh đóng** (`construction.transition` / `delivery.confirm`): mặc định `skipped` + Banner cảnh báo, đóng đơn bằng tay sau. Nếu Đại Ca muốn tiền đủ tự đóng bất kể người ghi, cần đổi `requires` của các dòng `hoan_thanh` trong bảng (quyết định AD-7, không phải việc của 7.2).
2. **Sửa lịch khi đã có tiền:** mặc định chặn toàn bộ (409). Nếu cần sửa các đợt chưa thu (vd sau re-chốt đổi tổng), làm story riêng: giữ đợt đã có tiền, chỉ thay phần còn lại.
3. **Sửa/huỷ một khoản ghi nhầm:** mặc định không có (append-only). Đề xuất story sau: "khoản điều chỉnh âm" (reversal) thay vì xoá, để audit nguyên vẹn.
4. **Mốc bị `skipped` không tự bắn lại** khi đơn sau đó tới trạng thái hợp lệ (vd tất toán lúc `thicong`, sau đó tới `nghiemthu`). Mặc định: người vận hành đóng tay. Nếu cần tự bắn lại, cần subscriber `StatusChanged` kiểm "đã thu đủ" — story riêng.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:609-626`] — Epic 7, Story 7.2 AC.
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md:151,166-171,186-199,266,298,515,560`] — FR-8, FR-12, ma trận quyền, audit, công nợ Phase sau, NFR độ tin cậy.
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`] — AD-10, AD-11 + quyết 2026-10-21 Payment↔transition (dòng 112-115), AD-18, AD-19, ERD `INSTALLMENT ||--o{ PAYMENT`, module tree `payments/`.
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md:39,63,85,109,121,150,170-176`; `mockups/all-screens.html:2463+` `#s-payments`].
- [Source: `backend/src/orders/domain/auto-transition-map.ts`; `backend/src/orders/domain/allowed-transition.ts` (bảng, `daTaiDich:286`, `SU_KIEN_THU_CONG:312`)].
- [Source: `backend/src/orders/orders.service.ts:359` (sentinel), `:396-406` (`closeRequiresIssuedStock`), `:563` (`lockOrderRow`), `:584` (`applyTransition`), `:682` (`chuyenTrangThaiTuDong`), `:1138` (`assertNoUnissuedStockInTx`), `:1848` (`getScopedTotal`)].
- [Source: `backend/src/inventory/stock-vouchers.service.ts:~423-445`] — khuôn `issueForOrderInTx`.
- [Source: `backend/src/payments/*`] — code 7.1.
- [Source: `backend/test/no-unscoped-order-write.spec.ts:29-68,149-227`] — guard phạm vi.
- [Source: `backend/CONVENTIONS.md:181-186`] — Khoá dòng & test đồng thời (F-5).
- [Source: `_bmad-output/implementation-artifacts/epic-6-retro-2026-10-21.md` TD-40, F-3, F-5].
- [Source: `_bmad-output/implementation-artifacts/7-1-cau-hinh-lich-thanh-toan-nhieu-dot.md`] — D1-D9, Câu hỏi mở, review findings.
- [Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`] — luật 1-10.
- [Source: `_bmad-output/project-context.md`] — luật toàn dự án.
- [Source: `design-system/money/money-fields.mjs`; `design-system/screens/payment-schedule.test.mjs:13,106-108`].

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code, dev-story)

### Debug Log References

- Migration sinh bằng `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (như 7.1) + 2 CHECK tay; `migrate deploy` lên `pns-postgres:5433`; diff sau deploy = "empty migration".
- Lane DB lần đầu đỏ 4 ca: `published` còn event fixture (`OrderConfirmed`/`StatusChanged`/`PaymentScheduleConfigured`) và đếm audit `StatusChanged` gồm cả dòng của lần chốt fixture ⇒ reset `published` cuối fixture, đếm audit theo hiệu (trước/sau).
- e2e lần đầu 400 khắp nơi: id đợt trong fake không phải UUID (`@IsUUID` của `installmentId`) ⇒ fake dùng UUID.
- Mutant (d) "nuốt mọi lỗi" dạng `!(error instanceof Error)` KHÔNG compile (đỏ giả) ⇒ dùng mutant compile được `!(error instanceof AppException)`.
- Mobile: `AppFrame` in nhãn hoa ⇒ test tìm `'…'.toUpperCase()`.
- Prettier web: 4 file web đụng tới đã "dirty" từ baseline (kiểm `git show HEAD:… | prettier --check`) ⇒ KHÔNG format lại (surgical). Backend: file mới + file sửa đều sạch eslint/prettier.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Backend:** `Payment` (append-only, `@db.Date`, unique `idempotency_key`, CHECK `payments_amount_positive`/`payments_method_known`); domain thuần `payment.ts` (`milestonesReached` theo cạnh lên, `validatePayment`, `todayInVietnam` UTC+7, `paidPercent` floor, `RECORDABLE_ORDER_STATUSES` = editable ∪ `hoanthanh`); `PaymentsService.record` đúng thứ tự D6 (scope → status → paidOn → tx[FOR UPDATE đầu tiên → re-check → idempotency → lịch/đợt trong tx → validate → insert → `autoTransitionInTx` cùng `tx`] → publish `DepositRecorded`/`PaymentRecorded` rồi `StatusChanged`, mỗi cái đúng 1 lần; replay 0 publish); 403/409 của engine ⇒ `skipped` + `logger.warn` (không in message/note) + tiền vẫn commit, lỗi khác ⇒ rollback. `OrdersService.autoTransitionInTx` mới (public, không mở tx, không publish, không bắt lỗi; sentinel riêng); `chuyenTrangThaiTuDong` chỉ sửa docstring. `PaymentSchedulesService`: `viewFor` dùng chung (field mới + `id` đợt, `editable` = editable-status && chưa có tiền), `replace` 409 "Đơn đã có thanh toán — không sửa lịch được." dưới khoá (kể cả payload y hệt).
- **Lane (cuối cùng, cùng một working tree):** backend `npm test` 103 suites / 2045 tests xanh · `npm run test:db` 23 suites / 272 tests xanh (payments 21 ca mới) · design-system 456/456 · web typecheck + 126 tests + build xanh · mobile `flutter analyze` 0 issue + `flutter test` toàn bộ xanh (màn lịch 38 ca, khoá UUID 2 ca). `openapi.json` regen; `permissions.json` không đổi; `money-fields` thu `amount/paidTotal/remainingTotal/paidAmount/remainingAmount`, KHÔNG thu `paidPercent`/`seq`.
- **Mutation (cp backup, không git checkout; mỗi mutant compile được):**

| Mutant | Lane | Kết quả |
|---|---|---|
| (a) gỡ `FOR UPDATE` trong `record` | DB | ĐỎ 3: overpay qua holder đã INSERT, cùng key ⇒ P2002, huỷ dưới khoá |
| (b1) giấu lời gọi `getScopedTotal` khỏi máy quét | guard | ĐỎ 2 (vi phạm + anti-blind) |
| (b2) bypass phạm vi bằng quyền tự chế `new Set(['orders.view_all'])` | e2e | ĐỎ 1 (404 view_own) |
| (c) cạnh lên → trạng thái trong `milestonesReached` | unit | ĐỎ 1 (cọc bắn lại lần 3) |
| (d) nuốt mọi `AppException` thay vì chỉ 403/409 | unit | ĐỎ 2 (404, 400 phải ném tiếp) |
| (e) bỏ chặn payment-count trong `replace` | unit+e2e / DB | ĐỎ 4 / ĐỎ 1 (FK 500 thay vì 409) |
| (f) bỏ re-check status/version trong tx | unit | ĐỎ 3 |
| (g) bỏ "mọi đợt paid + Σ ≥ tổng" | unit | ĐỎ 2 (đợt giữa còn nợ; lịch lệch tổng) |
| web: bỏ `schedule.recordable` khỏi cổng nút | web + guard | ĐỎ 1 + guard ĐỎ |
| web: khoá cố định thay `newKey()` | web | ĐỎ 3 |
| mobile: bỏ `recordable` khỏi `_canRecord` | mobile | ĐỎ 1 |
| mobile: giữ khoá cũ khi mở form mới | mobile | ĐỎ 2 |
| mobile: `s.orderTotal - s.paidTotal` trên màn | guard | ĐỎ |

- **Lệch / quyết định khi dev (cần reviewer xem):**
  1. Câu hệ quả trong ConfirmDialog đợt cọc viết "**Khi** đủ đợt cọc, đơn sẽ tự chuyển sang Đã cọc." (story ghi "Đủ đợt cọc, …") — ghi một phần cọc thì câu gốc nói sai sự thật; vẫn là câu cố định theo `milestone`, không suy tiền.
  2. `installmentId` không thuộc lịch hiện tại ⇒ CHỈ 409 (theo AC-8); không có mã 400 `notInSchedule` (D2 liệt kê cả hai — chọn một, theo AC).
  3. Mở rộng guard `no-fabricated-actor-permissions` quét thêm cửa công khai `.autoTransitionInTx(` (cùng lý do với `chuyenTrangThaiTuDong`). Guard phạm vi: allowlist `orders#autoTransitionInTx` (chạy trong tx của caller đã scope) và `payment-schedules#viewFor` (dựng view cho đơn caller đã scope) — kèm lý do; `record` được canh + anti-blind.
  4. Mobile hiện trạng thái từng đợt trong một frame riêng "Trạng thái" (chip + dòng thu + nút) thay vì cột thứ 5 của bảng — giữ 320 px không tràn; web là cột "Trạng thái". Nhãn chung hai nền tảng.
  5. Web `Banner` không có tone `ok` ⇒ banner `applied` dùng `info`.
  6. Ô tiền trống: chọn **disable nút** (và `toRecordInput` vẫn bỏ key nếu trống) — test cả hai nền tảng.
  7. AC-5 ở lane DB (ép lỗi không phải 403/409 trên Postgres thật) KHÔNG dựng — chứng minh ở unit mock-forced (identity `tx`, rethrow, 0 publish) theo đúng "nếu dựng được".
  8. Giới hạn có sẵn của money guard: phép tính giữa HAI LITERAL (`83010960 - 16602192`) trong fake không bị bắt (regex cần tên field tiền); phép tính trên field (`s.orderTotal - s.paidTotal`) bị bắt. Không sửa (ngoài scope).
- **Câu hỏi mở bổ sung:** ~~5. `tat_toan` chỉ bắn khi CHÍNH đợt cuối vừa đủ~~ — đã giải khi review 2026-10-22 bằng "Mặc định tất toán" (Dev Notes).

### File List

- `backend/prisma/schema.prisma` (UPDATE)
- `backend/prisma/migrations/20261022090000_add_payments/migration.sql` (NEW)
- `backend/src/payments/domain/payment.ts` (NEW)
- `backend/src/payments/domain/payment-events.ts` (NEW)
- `backend/src/payments/dto/record-payment-request.dto.ts` (NEW)
- `backend/src/payments/dto/record-payment-response.dto.ts` (NEW)
- `backend/src/payments/dto/payment-response.dto.ts` (NEW)
- `backend/src/payments/dto/auto-transition-result.dto.ts` (NEW)
- `backend/src/payments/dto/installment-response.dto.ts` (UPDATE)
- `backend/src/payments/dto/payment-schedule-response.dto.ts` (UPDATE)
- `backend/src/payments/payments.service.ts` (NEW)
- `backend/src/payments/payments.controller.ts` (NEW)
- `backend/src/payments/payments.module.ts` (UPDATE)
- `backend/src/payments/payment-schedules.service.ts` (UPDATE)
- `backend/src/payments/payment-schedules.controller.ts` (UPDATE)
- `backend/src/orders/orders.service.ts` (UPDATE)
- `backend/openapi/openapi.json` (REGEN)
- `backend/test/payment.spec.ts` (NEW)
- `backend/test/payments.service.spec.ts` (NEW)
- `backend/test/payments.e2e.spec.ts` (NEW)
- `backend/test/payments.db.integration.spec.ts` (NEW)
- `backend/test/orders.service.spec.ts` (UPDATE)
- `backend/test/payment-schedules.service.spec.ts` (UPDATE)
- `backend/test/payment-schedules.e2e.spec.ts` (UPDATE)
- `backend/test/no-unscoped-order-write.spec.ts` (UPDATE)
- `backend/test/no-fabricated-actor-permissions.spec.ts` (UPDATE)
- `web/src/design-system/session/payments-port.ts` (UPDATE)
- `web/src/design-system/session/fake-payments-port.ts` (UPDATE)
- `web/src/design-system/session/index.ts` (UPDATE)
- `web/src/screens/payments/PaymentScheduleScreen.tsx` (UPDATE)
- `web/src/screens/payments/payment-schedule.css` (UPDATE)
- `web/src/test/payment-schedule-screen.test.tsx` (UPDATE)
- `mobile/lib/design_system/session/payments_port.dart` (UPDATE)
- `mobile/lib/design_system/session/fake_payments_port.dart` (UPDATE)
- `mobile/lib/design_system/session/idempotency_key.dart` (NEW)
- `mobile/lib/design_system/session/session.dart` (UPDATE)
- `mobile/lib/screens/payments/payment_schedule_screen.dart` (UPDATE)
- `mobile/test/screens/payments/payment_schedule_screen_test.dart` (UPDATE)
- `mobile/test/design_system/idempotency_key_test.dart` (NEW)
- `design-system/screens/payment-schedule.test.mjs` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (story-automator review, claude-opus-5-5) · **Ngày:** 2026-10-22 · **Kết quả:** Approve sau khi sửa — 0 CRITICAL còn lại.

Lớp review chính `/ck:code-review` (2 reviewer song song: backend, web+mobile; chỉ đọc) + kiểm tay luật dự án. Báo cáo: `plans/reports/code-review-261022-0004-story-7-2-{backend,clients}-report.md`.

**Yêu cầu riêng của Trợ Lý (đã làm):**
- (a) **AC-5 lane DB** — `payments.db.integration.spec.ts` › "any other error inside the tx rolls the payment back": (1) engine THẬT ghi `dachot → dacoc` trong tx rồi một lỗi khác ném ⇒ 0 dòng payments, đơn vẫn `dachot`, 0 publish, 0 audit; (2) lỗi SQL thật (`SELECT 1 / 0`) trong transition ⇒ cả tx huỷ, 0 dòng. Mutant "nuốt mọi lỗi" ⇒ lane DB ĐỎ 2.
- (b) **Mặc định tất toán** — xem Dev Notes "Mặc định tất toán".

**Finding & xử lý:**

| # | Mức | Finding | Xử lý |
|---|---|---|---|
| 1 | MEDIUM | Web+mobile: bấm lại "Ghi nhận" cùng đợt khi form đang mở sau lỗi mạng ⇒ sinh khoá MỚI ⇒ có thể ghi trùng một khoản (vi phạm D9) | Mở lại cùng đợt giữ nguyên form + khoá; test 2 nền tảng (`['key-1','key-1']`) |
| 2 | MEDIUM | Retry thành công sau khi mất response (replay, `autoTransition:null`) không báo `onOrderStatusChanged` ⇒ chip trạng thái ở chi tiết đơn cũ | Sau một lần thử thất bại, thành công thì báo `orderStatus` hiện tại (lần đầu vẫn chỉ khi `applied`); test 2 nền tảng |
| 3 | MEDIUM | Đơn mở lại (`mo_lai`) khi đã có tiền ⇒ lịch khoá ở tổng cũ | KHÔNG sửa: story đã chấp nhận ở "Tình huống biên" + Câu hỏi mở 2 (đổi luật mở lại là quyết định nghiệp vụ, đụng lane 5.x) — chờ Đại Ca |
| 4 | LOW | Retry sau khi đơn bị huỷ/mở lại trả 409 thay vì replay khoản đã ghi | Tra khoá idempotency TRƯỚC cổng trạng thái (dưới khoá); bỏ cổng trạng thái ngoài tx (cổng trong tx giữ đúng 2 thông điệp cũ); unit + DB |
| 5 | LOW | Cùng khoá gửi đồng thời sang ĐƠN KHÁC ⇒ P2002 ⇒ 500 | `isUniqueViolation` ⇒ 409 "Khoá ghi nhận đã được dùng…"; ca DB interleaving (holder giữ INSERT cùng khoá ở đơn A) |
| 6 | LOW | Message `@Max` của `amount` dùng câu của lịch ("chia thành nhiều đợt") | Message riêng "Số tiền thu vượt mức tối đa của một đợt." |
| 7 | LOW | Hợp đồng "từ chối trước mọi lệnh ghi" của `autoTransitionInTx` chỉ canh 2 spy | `expectNoWriteOnTx()` quét MỌI method ghi của mọi repo trên tx (+ anti-blind); mutant ghi trước khi từ chối ⇒ ĐỎ |
| 8 | LOW | Vòng lặp 2 mốc: cọc bị từ chối vẫn thử tất toán (nguy cơ `dachot → hoanthanh`) | Dừng sau lần thử không `applied`; unit test |
| 9 | LOW | Mobile `int.parse` ném khi số tiền > 19 chữ số | `tryParse`; nút disable khi không parse được; widget test |
| 10 | LOW | Fake (web+mobile) replay mọi payload cùng khoá; backend trả 409 | Fake trả 409 CONFLICT khi khác payload; test |
| 11 | LOW | Mobile ghi chú không giới hạn 200 (web có `maxLength`) | Cắt 200 khi gõ; widget test |
| 12 | LOW | Ngày thu mặc định theo đồng hồ máy, backend xét theo giờ VN | Cả 2 nền tảng lấy "hôm nay" theo UTC+7 |
| 13 | LOW | Câu ConfirmDialog "Khi đủ đợt cọc…" lệch D9 | Chấp nhận (đã ghi ở lệch #1 của dev) |
| 14 | LOW | `crypto.randomUUID()` cần HTTPS | Thông tin — prod chạy https, không sửa |
| 15 | LOW | Test double-submit web bấm nút đã disabled ⇒ kiểm `inFlight` trong `submitRecord` không được chứng minh riêng | Không sửa: `inFlight` là lớp phòng thủ thứ hai sau `disabled`; hành vi người dùng đã được test |
| 16 | — | Guard phạm vi mù với `tx.payment\n.create(` sau prettier (phát hiện khi sửa #5) | Viết lại dạng try/catch để lời gọi liền mạch; anti-blind của guard đã ĐỎ đúng lúc |

**Mutation khi review (cp backup, không git checkout, mọi mutant compile được):**

| Mutant | Kết quả |
|---|---|
| gỡ `FOR UPDATE` trong `record` | unit ĐỎ 1, DB ĐỎ 3 |
| giấu `this.orders.getScopedTotal(` khỏi máy quét | guard ĐỎ 2 |
| nuốt mọi lỗi trong transition | DB ĐỎ 2 (AC-5) |
| bỏ map P2002 ⇒ 409 | unit ĐỎ 1, DB ĐỎ 1 |
| cổng trạng thái trước tra khoá | unit ĐỎ 6, DB ĐỎ 2 |
| bỏ `break` sau lần thử không applied | unit ĐỎ 1 (DB không dựng được: cọc trên `dachot` không thể bị từ chối với người có `payments.record`) |
| luật tất toán cũ (chỉ đợt mang `tat_toan`) | unit ĐỎ 5, DB ĐỎ 2 |
| tất toán cả lịch 1 đợt | unit ĐỎ 1 (DB xanh — tương đương ngữ nghĩa: `hoan_thanh` từ `dacoc` luôn bị từ chối) |
| `autoTransitionInTx` ghi trước khi từ chối | unit ĐỎ 4 |
| web: bỏ giữ form cùng đợt / bỏ báo trạng thái sau retry | ĐỎ 1 / ĐỎ 1 |
| mobile: bỏ giữ form cùng đợt / bỏ báo trạng thái sau retry / `isEmpty` thay `tryParse` | ĐỎ 1 / ĐỎ 1 / ĐỎ 1 |

**Lane cuối (cùng working tree):** backend `npm test` 103 suites / 2062 xanh · `npm run test:db` 23 suites / 278 xanh · design-system 456/456 · web typecheck + 130 tests + build xanh · mobile `flutter analyze` 0 issue + `flutter test` 387 xanh. ESLint file backend đụng tới sạch. `openapi.json` regen (mô tả `autoTransition`, message `amount`). Flaky đã thấy, NGOÀI 7.2: `web/src/test/stock-vouchers-screen.test.tsx` › "a row set to 0 is left out…" đỏ 1/12 lần khi máy đang chạy backend song song (file 6.7, không đụng).

## Change Log

- 2026-10-21 — dev-story 7.2: ghi nhận thanh toán theo đợt (`POST /orders/:id/payments`, idempotent theo khoá client dưới khoá `orders` FOR UPDATE), chuyển trạng thái tự động trong CÙNG tx qua `OrdersService.autoTransitionInTx` (403/409 ⇒ skipped, tiền vẫn commit), event `DepositRecorded`/`PaymentRecorded`, view lịch có đã thu/còn lại/trạng thái từng đợt, khoá sửa lịch khi đã có tiền; màn web + mobile (khối công nợ, chip trạng thái, form + ConfirmDialog, banner kết quả); test 5 lane + mutation. Status → review.
- 2026-10-22 — review 7.2: luật tất toán mới (mọi đợt đủ + Σ ≥ tổng, bất kể đợt nào), AC-5 trên Postgres thật, idempotency trước cổng trạng thái, P2002 khác đơn ⇒ 409, giữ khoá khi mở lại cùng đợt + báo trạng thái sau retry (web+mobile), fake 409 khi dùng lại khoá; 15 finding xử lý (1 chờ quyết định). Status → done.
