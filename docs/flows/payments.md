# Lịch thanh toán, trả góp và ghi nhận thanh toán

> Flow `payments`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow payments` in ra đúng danh sách đó.

## Mục đích

Hai việc của Epic 7 trên một đơn đã chốt:

1. **Lịch thanh toán** (FR-11): chia tổng đơn thành tối đa 12 đợt, mỗi đợt là một **phần trăm** hoặc một **số tiền**
   nguyên đồng. Đợt đầu luôn là tiền cọc; với từ hai đợt trở lên, đợt cuối là đợt tất toán.
2. **Ghi nhận thanh toán** (FR-12): ghi một khoản thu vào một đợt, idempotent theo khoá do client sinh. Khoản thu
   có thể kích hoạt chuyển trạng thái đơn tự động (đặt cọc ⇒ `du_coc`, thu đủ đợt cuối ⇒ `hoan_thanh`) qua
   `OrdersService.autoTransitionInTx`, trong CÙNG một transaction.

Client không cộng, trừ hay chia tiền: `amount`, `scheduledTotal`, số đã thu và trạng thái thanh toán đều do server
tính. Trạng thái thanh toán (`unpaid` / `partial` / `paid`) được suy ra từ các khoản thu khi đọc; không có cột trạng
thái để lệch với sổ.

## Điểm vào

HTTP (JWT; `PermissionsGuard` toàn cục; mọi route cần `orders.view_all` hoặc `orders.view_own`):

- `GET /orders/:id/payment-schedule` — `PaymentSchedulesController.get`. Chỉ cần quyền xem đơn.
- `PUT /orders/:id/payment-schedule` — `PaymentSchedulesController.replace`, cần thêm `payments.record`. Thay toàn bộ danh sách đợt.
- `POST /orders/:id/payments` — `PaymentsController.record`, cần `payments.record`, `@HttpCode(200)`: cả lần ghi mới và lần gọi lại cùng khoá đều trả 200.

Ngoài phạm vi đơn ⇒ 404, kể cả khi khoá idempotency đã dùng (không lộ khoản thu của người khác).

Màn hình:

- Web: `PaymentScheduleScreen` (`web/src/screens/payments/PaymentScheduleScreen.tsx`) qua `PaymentsPort`.
- Mobile: `PaymentScheduleScreen` + `PaymentScheduleCubit` (`mobile/lib/screens/payments/`) qua `PaymentsPort`.

## Các bước

**A. Lưu lịch thanh toán**

1. `backend/src/payments/payment-schedules.controller.ts` → `replace` gọi `PaymentSchedulesService.replace`.
2. `backend/src/payments/payment-schedules.service.ts` → `replace`, theo thứ tự (đã ghi trong docstring):
   scope (404) → trạng thái đơn phải thuộc `EDITABLE_ORDER_STATUSES` (409) → resolve và validate (400) — TRƯỚC transaction,
   nên từ chối không tốn khoá → transaction: khoá dòng `orders` trước → đọc lại trạng thái và version → đơn đã có khoản thu
   thì 409 (kiểm dưới khoá) → danh sách giống hệt thì không ghi gì → upsert schedule, xoá và chèn `installments`.
3. Sau commit: `PaymentScheduleConfigured` (một lần).
4. `backend/src/payments/domain/payment-schedule.ts` → `resolveInstallments`: `percent` ⇒ `floor(tổng × % / 100)`, số nguyên.
   Phần dư làm tròn chỉ được dồn vào đợt cuối khi TẤT CẢ đợt là phần trăm và tổng đúng 100%. Lẫn loại hoặc Σ% ≠ 100 thì không dồn,
   và lệch được báo như cảnh báo chứ không bị từ chối.
5. Mốc (`milestone`) gán theo VỊ TRÍ, không nhận từ client (`milestoneAt`): đợt 1 là `coc` (đã thu đủ đợt cọc); đợt cuối, khi có từ hai đợt, là `tat_toan` (đã thu đủ giá trị đơn). Đợt giữa không có mốc.
6. Giới hạn: tối đa 12 đợt; mỗi đợt tối đa 2.000.000.000 đồng (`MAX_INSTALLMENT_AMOUNT`, vừa INT4); ghi chú đợt tối đa 200 ký tự.

**B. Ghi nhận thanh toán**

1. `backend/src/payments/payments.controller.ts` → `record` gọi `PaymentsService.record`.
2. `backend/src/payments/payments.service.ts` → `record`, theo thứ tự đã ghi trong docstring:
   scope (404) TRƯỚC, kể cả lần gọi lại → kiểm tra ngày trong tương lai (400, thuần, trước transaction) →
   transaction: khoá `orders` → đọc lại đơn → tra khoá idempotency (replay, hoặc 409 nếu khác nội dung) → kiểm trạng thái
   thuộc `RECORDABLE_ORDER_STATUSES` và version (409) → đọc lịch và tổng đã thu dưới khoá → số tiền ≤ còn lại (400) → insert `payments`
   → mốc → chuyển trạng thái.
3. Chuyển trạng thái: `payments/payments.service.ts` chỉ ghi `payments`; `Order.status` do `OrdersService.autoTransitionInTx` đổi qua engine của `orders`.
   Lỗi từ chối của engine (403/409) bị nuốt có chủ đích: khoản thu vẫn được lưu, kết quả ghi `skipped` trong `autoTransition` và log.
   Lỗi khác thì rollback cả transaction.
4. `backend/src/payments/domain/payment.ts` → `milestonesReached`: đợt cọc đủ tiền ⇒ `DepositRecorded` và chuyển `du_coc`; đợt cuối
   đủ tiền ⇒ chuyển `hoan_thanh`. Cọc chưa đủ thì không chuyển.
5. Sau commit: publish `PaymentRecorded` (hoặc `DepositRecorded`) một lần, rồi mỗi `StatusChanged` một lần. Replay không publish gì.

## Bất biến

| Bất biến | Nơi enforce | Test / guard canh |
|----------|-------------|-------------------|
| Khoá `orders` là khoá đầu tiên của cả hai luồng; mọi ghi lịch hoặc khoản thu xếp hàng sau khoá đó | `replace`, `record` (`FOR UPDATE`) | `payments.service.spec.ts`, `payment-schedules.service.spec.ts`, lane DB `payments.db.integration.spec.ts`, `payment-schedules.db.integration.spec.ts` |
| Idempotency tra DƯỚI khoá; cùng khoá cùng nội dung ⇒ replay 200, khác nội dung ⇒ 409 | `record` | `payments.e2e.spec.ts` ("retry with the same key", "same key with another amount") |
| Replay được kiểm TRƯỚC trạng thái: khoản thu đã ghi vẫn trả về kể cả đơn vừa bị huỷ | thứ tự trong `record` | `payments.service.spec.ts`, `payments.e2e.spec.ts` |
| Lịch đóng băng sau khoản thu đầu tiên (409 khi thay); không thể có `installments` và `payments` lệch nhau | `replace` (kiểm dưới khoá) | `payment-schedules.e2e.spec.ts`, `payment-schedules.db.integration.spec.ts` |
| Mốc gán theo vị trí; client gửi mốc bị bỏ qua | `milestoneAt`, `resolveInstallments` | `payment-schedule.spec.ts`, `payment-schedules.e2e.spec.ts` ("a client-sent milestone is ignored") |
| Đợt đầu không được ra 0 đồng | `resolveInstallments` | `payment-schedules.e2e.spec.ts` ("firstInstallmentZero") |
| Không đảo cọc→tất toán qua cạnh trực tiếp: đợt cọc bị từ chối thì đợt tất toán không được thử | vòng lặp chuyển trạng thái trong `record` | `payments.service.spec.ts` ("the deposit paid last but refused ⇒ the settlement is NOT attempted") |
| Trạng thái thanh toán không lưu; luôn suy ra từ khoản thu | `installmentStatus`, `orderPaymentStatus` | `payment.spec.ts` |
| Ghi `Order.status` chỉ qua engine của `orders` | `autoTransitionInTx` | `backend/test/no-order-status-write-outside-transition.spec.ts` (flow `orders`) |
| Event sau commit, một lần mỗi loại | `record`, `replace` | `payments.service.spec.ts`, `payment-schedules.service.spec.ts` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/payments/payment-schedules.controller.ts` | `GET` và `PUT` lịch | `PaymentSchedulesController` (`get`, `replace`) |
| `backend/src/payments/payment-schedules.service.ts` | Đọc và thay lịch | `PaymentSchedulesService` (`get`, `replace`, `viewFor`) |
| `backend/src/payments/payments.controller.ts` | `POST` ghi nhận | `PaymentsController.record` |
| `backend/src/payments/payments.service.ts` | Ghi khoản thu, idempotency, chuyển trạng thái | `PaymentsService.record`; kết quả chuyển trạng thái trả về trong `autoTransition` |
| `backend/src/payments/payments.module.ts` | Module; import `OrdersModule` (scope, tổng sau VAT, `autoTransitionInTx`) | `PaymentsModule` |
| `backend/src/payments/domain/payment-schedule.ts` | Luật lịch: resolve %/số tiền, mốc, giới hạn | `resolveInstallments`, `isSameSchedule`, `EDITABLE_ORDER_STATUSES`, `MAX_INSTALLMENTS`, `MAX_INSTALLMENT_AMOUNT`, `SCHEDULE_ERROR` |
| `backend/src/payments/domain/payment.ts` | Luật ghi nhận và trạng thái suy ra | `validatePayment`, `milestonesReached`, `installmentStatus`, `orderPaymentStatus`, `paidPercent`, `isSamePaymentRequest`, `PAYMENT_METHODS`, `PAYMENT_STATUS` |
| `backend/src/payments/domain/payment-events.ts` | Event khoản thu | `DepositRecorded`, `PaymentRecorded` |
| `backend/src/payments/domain/payment-schedule-events.ts` | Event đổi lịch | `PaymentScheduleConfigured` |
| `backend/src/payments/dto/installment-input.dto.ts`, `installment-response.dto.ts`, `payment-schedule-response.dto.ts`, `replace-payment-schedule-request.dto.ts` | Lịch vào và ra | `InstallmentInputDto`, `InstallmentResponseDto`, `PaymentScheduleResponseDto`, `ReplacePaymentScheduleRequestDto` |
| `backend/src/payments/dto/record-payment-request.dto.ts`, `payment-response.dto.ts`, `record-payment-response.dto.ts`, `auto-transition-result.dto.ts` | Khoản thu vào và ra; kết quả chuyển trạng thái | `RecordPaymentRequestDto`, `PaymentResponseDto`, `RecordPaymentResponseDto`, `AutoTransitionResultDto` |
| `backend/prisma/migrations/20261021130000_add_payment_schedules/migration.sql` | `payment_schedules` (một dòng mỗi đơn, unique `order_id`) và `installments` (unique `(schedule_id, seq)`) | — |
| `backend/prisma/migrations/20261022090000_add_payments/migration.sql` | `payments`: `installment_id`, `amount`, `paid_on` (DATE), `method`, `note`, unique `idempotency_key`, người ghi | — |
| `mobile/lib/screens/payments/payment_schedule_screen.dart`, `payment_schedule_cubit.dart`, `payment_schedule_state.dart` | Màn và trạng thái mobile | `PaymentScheduleScreen`, `PaymentScheduleCubit` |
| `mobile/lib/design_system/session/payments_port.dart`, `fake_payments_port.dart` | Port và fake mobile | `PaymentsPort`, `FakePaymentsPort`, `RecordPaymentInput`, `ReplacePaymentScheduleInput` |
| `mobile/lib/api/http_payments_port.dart` | Port thật qua client sinh tự động | `HttpPaymentsPort` |
| `web/src/screens/payments/PaymentScheduleScreen.tsx`, `web/src/screens/payments/payment-schedule.css` | Màn và style web | `PaymentScheduleScreen` |
| `web/src/design-system/session/payments-port.ts`, `fake-payments-port.ts` | Port và fake web | `PaymentsPort`, `PaymentsPortError`, `FakePaymentsPort` |
| `web/src/api/http-payments-port.ts` | Port thật web | `HttpPaymentsPort` |

## Dữ liệu

- `payment_schedules`: một dòng mỗi đơn (`order_id` unique, FK `orders`, RESTRICT).
- `installments`: `schedule_id`, `seq`, `percent` hoặc `amount`, `condition_note`, `milestone`.
- `payments`: `order_id`, `installment_id`, `amount`, `paid_on` (DATE: ngày theo giờ Việt Nam), `method` (`bank_transfer` / `cash`),
  `note`, `idempotency_key` (unique), `recorded_by_account_id`.
- Đọc từ flow khác: `orders` (scope, tổng sau VAT, trạng thái và chuyển trạng thái), `accounts-permissions` (quyền tươi).
- Sự kiện: `PaymentScheduleConfigured`, `DepositRecorded`, `PaymentRecorded`, cộng `StatusChanged` từ engine của `orders`.
- Gọi ngoài: không có.

## Flow liên quan

- orders: scope, tổng, engine chuyển trạng thái (`autoTransitionInTx`); cùng khoá `orders` với mọi ghi đơn.
- contracts và invoices: hợp đồng cần lịch khớp tổng; hoá đơn không cần lịch hay số đã thu.
- dashboard-reports: số đã thu của kỳ (`dashboard`) đọc bảng `payments`.
- accounts-permissions: `payments.record`, `orders.view_*`.
- domain-events-audit: `AuditSubscriber` ghi các event trên.

## Tests

Backend, hermetic (`npm test`):

- `backend/test/payment.spec.ts`: luật ghi nhận và trạng thái suy ra từ khoản thu.
- `backend/test/payment-schedule.spec.ts`: `resolveInstallments`, dồn phần dư, giới hạn, `isSameSchedule`.
- `backend/test/payments.service.spec.ts`: thứ tự bước; cọc đủ ⇒ chuyển `du_coc` rồi publish một lần; đợt cọc bị từ chối không kéo đợt tất toán.
- `backend/test/payment-schedules.service.spec.ts`: lưu lần đầu và thay lịch; lịch giống hệt không ghi gì; lịch lệch tổng vẫn lưu kèm cảnh báo; lỗi commit thì không publish.
- `backend/test/payments.e2e.spec.ts`: HTTP; 401 khi thiếu token; cọc trên `dachot` ⇒ `dacoc`; replay theo khoá; khoá cũ nhưng số khác ⇒ 409; đợt cuối trên `thicong` được bỏ qua có thông báo.
- `backend/test/payment-schedules.e2e.spec.ts`: HTTP; GET trước khi cấu hình; PUT 20/70/10 khớp đúng; PUT lặp lại không ghi audit; mốc gửi từ client bị bỏ qua.

Backend, lane DB (`*.db.integration.spec.ts`, `npm run test:db`):

- `backend/test/payments.db.integration.spec.ts`, `backend/test/payment-schedules.db.integration.spec.ts`: ghi và ràng buộc của hai bảng trên Postgres thật.

Web, mobile và guard giao diện:

- `design-system/screens/payment-schedule.test.mjs`: text-guard màn web/mobile (không tự tính tiền).
- `web/src/test/payment-schedule-screen.test.tsx`, `web/src/test/http-payments-port.test.ts`.
- `mobile/test/screens/payments/payment_schedule_cubit_test.dart`, `mobile/test/screens/payments/payment_schedule_screen_test.dart`, `mobile/test/api/http_payments_port_test.dart`.
