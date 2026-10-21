# Test Automation Summary — Story 7.1 (Cấu hình Lịch thanh toán nhiều đợt)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-21 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (e2e hermetic qua `initAppOnLoopback`) + lane DB Postgres; web Vitest + Testing Library; mobile flutter_test; design-system node:test
**Kết quả:** backend `npx jest` **100 suite / 1944 test** xanh (+11 so với 1933 lúc dev) · web vitest **109** xanh (+3) + typecheck sạch · mobile file lịch thanh toán **24** xanh (+1) + analyze sạch · design-system 455/455

## Phạm vi

Rà 15 AC dẫn xuất với test dev đã viết: domain `payment-schedule.spec.ts`, unit `payment-schedules.service.spec.ts`, `order-scoped-total.spec.ts`, e2e `payment-schedules.e2e.spec.ts`, lane DB `payment-schedules.db.integration.spec.ts` (gồm interleaving FOR UPDATE), web `payment-schedule-screen.test.tsx`, mobile `payment_schedule_screen_test.dart`, parity `design-system/screens/payment-schedule.test.mjs`. Domain/unit/lane DB đã phủ kín. Lỗ nằm ở tầng HTTP (nơi duy nhất đo được mã HTTP thật qua ValidationPipe + guard) và ở chỗ web/mobile lệch nhau.

## Gap phát hiện & auto-apply

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC gốc "integer, không float" | Chưa có ca HTTP nào gửi `percent 12.5`, `amount 1000.5`, `percent 101`, `amount` > 2 tỷ | ✅ e2e `it.each` 4 ca ⇒ 400 đúng field, không ghi |
| 2 | AC-7, AC-15 | `fieldErrors` mới chỉ đo ở đợt index 0 | ✅ e2e 2 ca: điều kiện trống ở đợt 2 ⇒ `installments.1.conditionNote`; cả hai kiểu ở đợt 3 ⇒ `installments.2.percent` |
| 3 | D2 (mốc do server gán) | Pipe chỉ `whitelist` (lột âm thầm) ⇒ chưa ca nào chứng minh `milestone` client gửi bị bỏ | ✅ e2e: gửi `tat_toan/coc/coc` ⇒ response + DB vẫn `coc/null/tat_toan` |
| 4 | AC-4 "đúng dấu" | Qua HTTP chưa có `difference` âm | ✅ e2e 60/60 ⇒ 200, lưu, `difference < 0` và = `orderTotal − scheduledTotal` |
| 5 | AC-12 | 409 ⇒ 0 ghi, 0 audit chưa assert | ✅ thêm 2 assert vào ca 409 (4 trạng thái) |
| 6 | AC-9 | GET 404 ngoài phạm vi mới assert status, chưa so message với id lạ | ✅ so message GET ngoài phạm vi = GET id lạ |
| 7 | AC-9 (chiều dương) | `payments.record + orders.view_own` khi là owner/assignee ⇒ chưa có ca 200 (bug "view_own luôn 404" sẽ lọt) | ✅ e2e `it.each` owner / assignee ⇒ PUT 200, 3 dòng, GET 200 |
| 8 | D7 | `payments.record` mà thiếu cả `orders.view_*` ⇒ 403 chưa test | ✅ e2e: PUT 403 + GET 403, không ghi |
| 9 | AC-15 (parity) | Web chưa có ca load lỗi + "Thử lại" (mobile có) | ✅ web |
| 10 | AC-4 (web) | Web chưa có Banner lệch SAU khi lưu (mobile có) | ✅ web |
| 11 | D9 "Tuỳ chỉnh giữ nguyên dòng" | Không nền tảng nào test nút "Tuỳ chỉnh" | ✅ web + mobile |

Fixture e2e: `assigneeAccountId` đổi kiểu thành `string | null` để dựng được ca assignee (giá trị mặc định vẫn `null`).

## Đột biến kiểm ca mới (cp backup, không git checkout, đã khôi phục — `cmp` khớp)

| Mutant | Kết quả |
|---|---|
| Bỏ `@IsInt()` khỏi `percent` + `amount` của `InstallmentInputDto` | ĐỎ 2 ca (12.5, 1000.5) — gap 1 |
| Bỏ `@RequireAnyPermissions(ordersViewAll, ordersViewOwn)` trên PUT | ĐỎ 1 ca — gap 8 |

Không đột biến: gap 3 (ca ghim hợp đồng — chỉ đỏ nếu ai đó thêm `milestone` vào DTO và dùng nó), gap 9–11 (ca hành vi UI đơn giản).

## Test theo file (phần mới)

### API / E2E — `backend/test/payment-schedules.e2e.spec.ts` (27 → 39 ca)
- [x] non-integer or out-of-range percent 12.5 / amount 1000.5 / percent 101 / amount over the cap ⇒ 400 on that field
- [x] blank condition on the 2nd / both kinds on the 3rd ⇒ 400 names that row, not row 0
- [x] a client-sent milestone is ignored: the server assigns by position
- [x] a schedule over the total ⇒ 200, saved, negative difference
- [x] PUT on baogia/choduyet/hoanthanh/huy ⇒ 409: thêm assert không ghi, 0 audit
- [x] view_own ngoài phạm vi: thêm so message GET 404
- [x] payments.record + view_own as owner / assignee ⇒ PUT 200
- [x] payments.record without any orders.view_* ⇒ 403 on both routes

### UI — `web/src/test/payment-schedule-screen.test.tsx` (18 → 21)
- [x] load failure ⇒ error state; "Thử lại" reloads the schedule
- [x] a saved schedule that mismatches comes back with the warning banner
- [x] "Tuỳ chỉnh" keeps the rows being edited

### UI — `mobile/test/screens/payments/payment_schedule_screen_test.dart` (23 → 24)
- [x] "Tuỳ chỉnh" keeps the rows being edited

## Coverage

- Endpoint: `GET` + `PUT /orders/:id/payment-schedule` — **2/2** có e2e cho 200/400/401/403/404/409.
- Backend AC-1 → AC-14: **14/14** có test (domain + unit + e2e + lane DB).
- UI AC-15: web + mobile + parity guard **3/3**; mọi ca hành vi giờ có mặt ở cả hai nền tảng.

## Kết quả chạy

- `cd backend && npx jest test/payment-schedules.e2e.spec.ts` → 39/39 · `npx jest` → 100 suite / 1944 test · `prettier --check` sạch
- `cd web && npx vitest run` → 8 file / 109 test · `npm run typecheck` sạch
- `cd mobile && flutter test test/screens/payments/payment_schedule_screen_test.dart` → 24/24 · `flutter analyze` file đó sạch
- `cd design-system && npm test` → 455/455
- Lane DB: KHÔNG chạy lại (không đụng file nào ở đó; dev đã chạy xanh 250/250).

## Bước tiếp theo

- Code review story 7.1.

## Câu hỏi tồn đọng

- Không có.
