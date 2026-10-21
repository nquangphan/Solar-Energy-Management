# Test Automation Summary — Story 7.2 (Ghi nhận thanh toán → auto chuyển trạng thái)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (e2e hermetic qua `initAppOnLoopback`) + lane DB Postgres; web Vitest + Testing Library; mobile flutter_test; design-system node:test
**Kết quả:** backend `npx jest` **103 suite / 2053 test** xanh (+8 so với 2045 lúc dev) · web vitest **127** xanh (+1) + typecheck sạch · mobile file lịch thanh toán **37** xanh (+1) + analyze sạch · design-system 456/456

## Phạm vi

Rà 16 AC dẫn xuất với test dev đã viết: domain `payment.spec.ts`, unit `payments.service.spec.ts`, e2e `payments.e2e.spec.ts`, lane DB `payments.db.integration.spec.ts` (3 ca interleaving FOR UPDATE + CHECK), web `payment-schedule-screen.test.tsx`, mobile `payment_schedule_screen_test.dart` + `idempotency_key_test.dart`, parity `design-system/screens/payment-schedule.test.mjs`. Domain/unit/lane DB phủ kín. Lỗ nằm ở tầng HTTP (một số nhánh chỉ có ở unit hoặc lane DB, mà lane DB không chạy trong `npm test`) và ở một nhánh hiển thị của dialog xác nhận.

## Gap phát hiện & auto-apply

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC-6 | Tất toán `applied` (`dagiao` + `delivery.confirm` ⇒ `hoanthanh`) chỉ có ở lane DB, qua HTTP chưa có | ✅ e2e: 200, `hoan_thanh applied`, đơn `hoanthanh`, `paidPercent 100`, `PaymentRecorded` 1 + `StatusChanged` 1, 0 `DepositRecorded` |
| 2 | AC-4 (biến thể 403) | Engine ném 403 (thiếu `delivery.confirm`) ⇒ phải thành `skipped` + HTTP **200**; e2e chỉ có biến thể 409 (`thicong`) | ✅ e2e: 200, `skipped` + message quyền, tiền giữ, 0 `updateMany`, 0 `StatusChanged` |
| 3 | Edge `note` (D3) | Note toàn khoảng trắng ⇒ lưu `null` chưa có ở HTTP | ✅ e2e |
| 4 | AC-3 / D3 | Retry với `note` chỉ khác khoảng trắng hai đầu ⇒ phải là replay, không 409 | ✅ e2e: cùng `payment.id`, 1 dòng |
| 5 | AC-9 (chiều dương) | `view_own` mới có ca owner; assignee chưa có (bug "assignee luôn 404" sẽ lọt) | ✅ e2e `it.each` owner / assignee ⇒ 200, 1 dòng |
| 6 | AC-8 | Thiếu hẳn field `idempotencyKey` / `paidOn` / `method` ⇒ 400 chưa có (mới có sai giá trị) | ✅ e2e: 3 dòng vào `it.each` validate |
| 7 | AC-16 / D9 | Câu "Khi đủ đợt cọc, đơn sẽ tự chuyển sang Đã cọc." cố định theo `milestone`, nhưng chưa nền tảng nào kiểm nó VẮNG ở đợt không phải cọc | ✅ web + mobile: dialog đợt 2 có "Ghi nhận 58.107.672 đ cho Đợt 2?", không có câu cọc |

Fixture e2e: thêm `stockMovement.groupBy` (trả `[]`) — đóng đơn gọi `releaseHeldForOrderInTx` trong cùng tx; helper `firstTwoPaid()` cho 2 ca tất toán.

## Đột biến kiểm ca mới (cp backup, không git checkout, đã khôi phục — `cmp` khớp)

| Mutant | Kết quả |
|---|---|
| `payments.service.ts`: chỉ nuốt 409 (bỏ 403) | ĐỎ 1 — gap 2 |
| `payments.service.ts`: bỏ `normalizeNote` (lưu `input.note ?? null`) | ĐỎ 1 — gap 3 |
| DTO: bỏ `@Transform` trim (một mình) | XANH — lớp service vẫn trim (hai lớp phòng thủ, không phải test giả) |
| DTO trim + service `normalizeNote` cùng bỏ | ĐỎ 3 — gap 3, gap 4 và ca dev "full deposit" (`note: 'VCB'`) |
| Web: câu cọc hiện với mọi `milestone` | ĐỎ 1 — gap 7 (web) |
| Mobile: câu cọc hiện với mọi `milestone` | ĐỎ 1 — gap 7 (mobile) |

Không đột biến: gap 1 (ca dương, hỏng engine/fixture là đỏ), gap 5, 6 (ca ghim hợp đồng pipe/scope; nhánh tương ứng dev đã mutate ở b2).

## Test theo file (phần mới)

### API / E2E — `backend/test/payments.e2e.spec.ts` (33 → 41 ca)
- [x] last installment paid on dagiao by a recorder holding delivery.confirm ⇒ hoanthanh applied, PaymentRecorded + StatusChanged once each
- [x] same settlement by a recorder WITHOUT delivery.confirm ⇒ still 200 (the engine 403 never leaks), skipped, money kept
- [x] a whitespace-only note is stored as null
- [x] retry whose note differs only by surrounding spaces ⇒ replay (same id, one row), not a 409
- [x] paidOn missing / method missing / key missing ⇒ 400 on that field, nothing written
- [x] view_own on an order the caller is the owner / assignee of ⇒ 200, recorded (thay ca owner đơn lẻ)

### UI — `web/src/test/payment-schedule-screen.test.tsx` (38 → 39)
- [x] a non-deposit installment: the dialog never promises the Đã cọc move

### UI — `mobile/test/screens/payments/payment_schedule_screen_test.dart` (36 → 37)
- [x] a non-deposit installment: the dialog never promises the Đã cọc move

## Coverage

- Endpoint: `POST /orders/:id/payments` — **1/1** có e2e cho 200 / 200 replay / 400 / 401 / 403 / 404 / 409; `GET`/`PUT /orders/:id/payment-schedule` (7.1, có 409 khi đã có tiền) — 2/2.
- Kết quả transition qua HTTP: `applied` (du_coc, hoan_thanh) · `already` · `skipped` (409 ngoài bảng, 403 thiếu quyền) — **4/4 nhánh**; `skipped` 409 tồn kho chưa xuất chỉ ở lane DB (cần ledger thật).
- Backend AC-1 → AC-15: **15/15** có test (domain + unit + e2e + lane DB + guard).
- UI AC-16: web + mobile + parity guard **3/3**; mọi ca hành vi có ở cả hai nền tảng.

## Kết quả chạy

- `cd backend && npx jest test/payments.e2e.spec.ts` → 41/41 · `npx jest` → 103 suite / 2053 test · `prettier --check` file e2e sạch
- `cd web && npx vitest run` → 8 file / 127 test · `npm run typecheck` sạch
- `cd mobile && flutter test test/screens/payments/payment_schedule_screen_test.dart` → 37/37 · `flutter analyze` + `dart format -o none` file đó sạch
- `cd design-system && npm test` → 456/456
- Lane DB: KHÔNG chạy lại (không đụng file nào ở đó; dev đã chạy xanh 272/272).

## Bước tiếp theo

- Code review story 7.2.

## Câu hỏi tồn đọng

- Không có.
