# Test Automation Summary — Story 6.7 (Phiếu nhập trả khi huỷ đơn đã xuất kho)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-21 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (e2e hermetic qua `initAppOnLoopback`) + lane DB Postgres; web Vitest + Testing Library; mobile flutter_test; design-system node:test
**Kết quả:** backend `tsc` OK · `npm test` **96 suite / 1848 test** xanh (+2 so với 1846 lúc dev) · prettier sạch trên file đụng

## Phạm vi

Rà 19 AC dẫn xuất đối chiếu test dev đã viết: unit `stock-cancel-release.spec.ts` (17), `stock-return-voucher.spec.ts` (19), e2e `stock-vouchers.e2e.spec.ts` / `orders.e2e.spec.ts` / `order-stock-issue.e2e.spec.ts`, lane DB `stock-cancel-return.db.integration.spec.ts` (32), web `stock-vouchers-screen.test.tsx` (+9), mobile `stock_vouchers_screen_test.dart` (+13), design-system parity. Phần lớn AC đã phủ kín, có cả bảng đột biến. Còn 3 lỗ ở tầng HTTP.

## Gap phát hiện & auto-apply (+2 test, +1 assert, 1 tên test)

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | AC-15, D7 | `GET /stock-vouchers/:id` của **phiếu nhập trả** chưa có ca e2e | Shape `returnOf`, vắng `orderId` top-level, vắng `returnVoucher`, `canReturn: false` và che `unitCost` khi thiếu `costs.view` mới chỉ đo trên response `POST …/return`, chưa đo trên đường đọc chi tiết | ✅ `backend/test/stock-vouchers.e2e.spec.ts` (+1 ca) |
| 2 | T4, D7 | `canReturn` trong response `POST /orders/:id/stock-issue` chưa được assert | Task ghi rõ `canReturn` phải đúng ở MỌI đường trả `StockVoucherDetail` (dùng chung `CHI_TIET_INCLUDE`) | ✅ `backend/test/order-stock-issue.e2e.spec.ts` (+1 assert `canReturn === false` cho đơn còn sống) |
| 3 | T3b (nhả giữ chỗ ở `hoanthanh`) | Khi đóng đơn qua HTTP, chưa có ca e2e nào có phần giữ còn lại | Dev Notes yêu cầu "unit/e2e/lane DB"; e2e chỉ mock `groupBy = []` ⇒ chưa đo đường thật qua controller + ValidationPipe + tx | ✅ `backend/test/order-stock-issue.e2e.spec.ts` (+1 ca: SP tắt theo dõi sau chốt ⇒ 200, đúng 1 dòng `release −10`, ghi SAU `updateMany` trạng thái, trong cùng một `$transaction`) |
| 4 | — | Tên test `it.each` "detail of an order-bound stock-out" in ra `canReturn { order: [Object] … }` | `%s` thứ hai ăn nhầm object fixture ⇒ tên test sai nghĩa | ✅ đổi thành `%s (%j) ⇒ canReturn %s` |

**Không thêm (đã phủ, thêm nữa là độn test):** huỷ trước/sau xuất, mở lại/re-chốt rồi huỷ, SP tắt theo dõi, idempotent, xen kẽ khoá ép buộc (orders/products/phiếu trả/2 phiếu trả song song), ràng buộc DB, audit đúng 1 dòng (lane DB + unit); toàn bộ mã lỗi AC-11 + envelope + 403 + `unitCost` client bị bỏ (e2e); UI web/mobile AC-16/17 (tab gọi port `{isReturn:true}` / `{type:'nhap',isReturn:false}`, chip, nút, Sheet, dòng 0 bỏ, ô trống ⇒ lỗi, map chỉ số lỗi, chi tiết phiếu trả, 320/360 px).

## Đột biến kiểm ca mới (cp backup, không git checkout, đã khôi phục — `cmp` khớp)

| Mutant | Kết quả |
|---|---|
| `applyTransition` bỏ gọi `releaseHeldForOrderInTx` khi đích `hoanthanh` | ĐỎ — ca e2e close mới (gap 3) |
| `canReturn` bỏ điều kiện `type === 'xuat'` và `order.status === huy` | ĐỎ — assert stock-issue (gap 2) + ca chi tiết phiếu trả (gap 1) + ca `live order` sẵn có |

## Test theo file (phần mới)

### API / E2E — `backend/test/stock-vouchers.e2e.spec.ts`
- [x] detail of a return voucher without costs.view ⇒ origin link, no top-level orderId, no unitCost, canReturn false

### API / E2E — `backend/test/order-stock-issue.e2e.spec.ts`
- [x] KHO_GIAO … ⇒ 201: thêm assert `voucher.canReturn === false`
- [x] a hold left on a product untracked since confirm ⇒ 200, released in the close tx after the status write

## Coverage theo AC

- Backend AC-1 → AC-15, AC-19: **16/16** có test (lane DB + unit + e2e); T3b có đủ unit + e2e + lane DB.
- UI AC-16 (web), AC-17 (mobile), AC-18 (design-system): **3/3** có test, không thêm.
- Endpoint mới/đổi: `POST /stock-vouchers/:id/return`, `GET /stock-vouchers?isReturn`, `GET /stock-vouchers/:id` (field mới), `POST /orders/:id/stock-issue` (field `canReturn`), `POST /orders/:id/chuyen-trang-thai` (nhả ở `hoanthanh`): **5/5** có e2e.

## Kết quả chạy

- `cd backend && npx tsc --noEmit` → OK
- `npx jest test/stock-vouchers.e2e.spec.ts test/order-stock-issue.e2e.spec.ts` → 2 suite / 91 test xanh
- `cd backend && npx jest` → 96 suite / 1848 test xanh
- `npx prettier --check` hai file đụng → sạch
- Lane DB, web, mobile, design-system: KHÔNG chạy lại lần này (không đụng file nào ở đó; dev đã chạy xanh: DB 237/237, web 85/85, mobile 338/338, design-system 448/448).

## Bước tiếp theo

- Code review story 6.7 (`/ck:code-review`).

## Câu hỏi tồn đọng

- Không có.
