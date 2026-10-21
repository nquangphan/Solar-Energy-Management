# Tóm tắt kiểm thử tự động — Story 7.5 (Xem & xuất Hoá đơn PDF)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (e2e hermetic qua `initAppOnLoopback`) + lane DB Postgres; web Vitest + Testing Library; mobile flutter_test; design-system node:test
**Kết quả:** backend `npm test` **116 suite / 2402 test** xanh (+5 so với 2397 lúc dev) · `npm run test:db` **26 suite / 321 test** xanh (+2 so với 319) · prettier + eslint sạch trên 2 file đã sửa

## Phạm vi

Đã rà 13 AC dẫn xuất với các test dev đã viết: template `invoice-template.spec.ts`; unit `invoice-document.service.spec.ts`; e2e `invoice-document.e2e.spec.ts`; lane DB `invoice-document.db.integration.spec.ts`; guard `no-unscoped-order-write.spec.ts` + `orders-module-wiring.spec.ts`; web `invoice-detail-screen.test.tsx` + `invoices-screen.test.tsx` + `screens-render.test.tsx`; mobile `invoice_detail_screen_test.dart` + `invoices_screen_test.dart`; parity `design-system/screens/invoices.test.mjs`.

Unit, template, guard, UI hai nền tảng đã phủ đủ các nhánh của AC-13 (gồm 320/360 px, bấm 2 lần, fallback lỗi JS, fake theo luật từ chối backend). Lỗ nằm ở tầng HTTP/DB:
- AC-5 kể ba trạng thái đơn (`huy`, `hoanthanh`, mở lại `baogia`) nhưng e2e và lane DB chỉ đo `huy`.
- AC-6 có ca "upload ném" ở unit, còn ở e2e mới có ca "render ném". Phần envelope 500 không lộ stack khi R2 lỗi chưa được đo qua filter thật.
- AC-8 đòi "chưa xuất ⇒ không gọi `getObject`". Unit có đo, nhưng ca e2e chỉ kiểm 404.

## Lỗ tìm được và đã vá

| # | AC | Lỗ | Đã vá |
|---|----|-----|-------|
| 1 | AC-5 | Xem + xuất khi đơn đã sang `hoanthanh` / mở lại `baogia` sau khi lập: chưa có ca | ✅ e2e: 2 ca `huy` → `it.each(['huy','hoanthanh','baogia'])` cho GET detail và POST export (+4 ca) · lane DB: ca `huy` → `it.each` cùng 3 trạng thái, ghi `orders.status` thật (+2 ca) |
| 2 | AC-6 | `putObject` ném ⇒ 500 envelope `INTERNAL`, không lộ message/stack, 0 dòng `invoice_pdfs`, 0 audit: chỉ có ở unit | ✅ e2e: `jest.spyOn(storage,'putObject').mockRejectedValueOnce` ⇒ 500, body không chứa message lỗi, render 1 lần, put 1 lần, 0 dòng, 0 audit |
| 3 | AC-8 | GET pdf khi chưa xuất phải không đọc R2: e2e chỉ kiểm 404 + message | ✅ e2e: thêm `spyOn(storage,'getObject')` ⇒ `not.toHaveBeenCalled()` |

## Đột biến kiểm ca mới (sao lưu bằng `cp`, không `git checkout`, đã khôi phục — `cmp` khớp)

| Mutant | Ca mới | Ca cũ |
|---|---|---|
| `invoice-document.service.ts`: nuốt lỗi upload (`putObject(...).catch(() => undefined)`) | ĐỎ (lỗ 2) | e2e xanh — sống (unit "upload throws" bắt) |

Không đột biến lỗ 1: service không có nhánh trạng thái đơn nào, nên không có dòng để đột biến. Ca mới khoá việc ai đó chèn thêm cổng trạng thái sau này (ví dụ chặn `baogia`). Lỗ 3 đã có mutant l (dev) giết ở unit. Ca e2e là lớp thứ hai qua controller thật.

## Test theo file (phần mới / sửa)

### API / E2E — `backend/test/invoice-document.e2e.spec.ts` (30 → 35 ca)
- [x] is viewable whatever the order status is now (huy / hoanthanh / baogia after issue)
- [x] exports whatever the order status is now (huy / hoanthanh / baogia after issue)
- [x] upload failure ⇒ 500 envelope without a stack, no row, no audit
- [x] (sửa ca cũ) not exported yet ⇒ 404 "Hoá đơn này chưa xuất PDF." without reading R2

### Lane DB — `backend/test/invoice-document.db.integration.spec.ts` (+2 ca)
- [x] an order moved to huy / hoanthanh / baogia after its invoice ⇒ still viewable and exportable

## Mức phủ

- Endpoint: `GET /orders/:id/invoices/:invoiceId`, `POST|GET …/pdf`: **3/3** có e2e cho 200 / 400 (cả `:id` lẫn `:invoiceId`) / 401 / 403 (thiếu `invoices.manage`; thiếu cả `view_all` lẫn `view_own`) / 404 (ngoài phạm vi, hoá đơn đơn khác, chưa xuất) / 500 (render, upload).
- Trạng thái đơn sau khi lập qua HTTP + DB: **3/3** (`huy`, `hoanthanh`, `baogia`).
- Backend AC-1 → AC-12: **12/12** có test (template + unit + e2e + lane DB + guard).
- UI AC-13: web + mobile + parity guard **3/3**. Mọi ca hành vi đều có ở cả hai nền tảng nên không thêm ca.

## Kết quả chạy

- `cd backend && npx jest test/invoice-document.e2e.spec.ts` → 35/35 · `npm test` → 116 suite / 2402 test · `npm run test:db` → 26 suite / 321 test (pns-postgres:5433) · `prettier` + `eslint` sạch trên 2 file đã sửa
- Web, mobile, design-system: KHÔNG chạy lại (không đụng file nào; dev đã chạy xanh 194 / 449 / 487).
