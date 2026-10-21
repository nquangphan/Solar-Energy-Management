# Test Automation Summary — Story 6.5 (Chặn khi thiếu tồn — ở khâu XUẤT, không chặn chốt)

**Workflow:** QA automate · **Ngày:** 2026-10-21 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (hermetic, `initAppOnLoopback`) + lane DB Postgres 5433; web Vitest + Testing Library (jsdom); mobile flutter_test; design-system `node --test`
**Kết quả:** backend `tsc --noEmit` sạch · `npm test` 93 suite / **1768** xanh (cuối dev: 1763) · eslint file test đã sửa sạch · web typecheck + vitest 7 file / **76** (cuối dev: 75) + build xanh · mobile `flutter analyze` sạch, `flutter test` **326** xanh (cuối dev: 325) · design-system không đổi (447, cuối dev) · lane DB không đổi file ⇒ không chạy lại (cuối dev: 19 suite / 176 xanh)

## Phạm vi đã có từ dev (đối chiếu AC)

| AC | Lane đã phủ |
|----|-------------|
| AC-1 chốt không chặn | DB `stock-out-blocked.db` + e2e `orders.e2e` (200 `dachot`, onHand 0) + đột biến B9 |
| AC-2 exception có kiểu, envelope không đổi | unit `stock-vouchers.service` + e2e 6.3/6.4/`orders.e2e` `xong_giao` |
| AC-3 domain thuần | `stock-shortfall.spec.ts` (biên, thiếu, onHand 0, reserved > onHand, không âm, event) |
| AC-4 publish `StockOutBlocked` | unit ba đường (`toHaveBeenCalledTimes(1)`, mock tx chạy thân rồi ném) + mọi nhánh KHÔNG publish (đủ tồn, PRODUCT_NOT_STOCKABLE, 403, 409 trạng thái, không vật tư, đóng chưa xuất, thua cổng, lỗi DB) + e2e 1 dòng audit mỗi đường |
| AC-5 lane DB | 5 ca gồm xen kẽ ÉP BUỘC + `reserved` loại phần giữ của chính đơn |
| AC-6 xem trước `shortfall`/`blocked` | unit + e2e |
| AC-7 `GET /orders/:id/stock-check` | unit thứ tự op + e2e 401/200 THO_KS/200 KHO_GIAO/403 KE_TOAN/404/400/không tiền/không ghi |
| AC-8, AC-9 | guard + openapi-drift |
| AC-10, AC-11 | web + mobile (banner CHẶN, nút khoá, nhãn tồn, Chốt bấm được, lỗi đọc ẩn gợi ý, chống trả lời cũ, 320/360px) |
| AC-12 | parity + text-guard (chống rỗng) |

## Gap phát hiện & auto-apply (QA)

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC-7 | Cổng OR theo preset của `GET /stock-check` chỉ đo THO_KS / KHO_GIAO / KE_TOAN; nhánh `orders.view_all` (đơn người khác) và THI_CONG (không key nào) chưa đo ở HTTP | ✅ e2e +4: QUAN_LY, ADMIN, SUPER_ADMIN trên đơn người khác ⇒ 200 cùng số; THI_CONG được giao đơn ⇒ 403, không đọc gì |
| 2 | AC-7 | Đơn chỉ có dòng tự do — shape HTTP `{ lines: [] }` chưa đo | ✅ e2e +1: 200 `{ lines: [] }`, không đọc `products`/ledger |
| 3 | AC-10/11 (D6 "sau mỗi lần thêm-sửa-**xoá** dòng") | Chỉ đo làm mới cảnh báo khi sửa SL; xoá dòng thiếu ⇒ banner warn biến mất chưa đo trên cả hai nền tảng | ✅ web +1, mobile +1 (swipe `Dismissible`): đọc lại tồn, nhãn "Cần nhập" + câu "Vẫn chốt đơn được" biến mất, "Kho còn 42" giữ |

## Mutation kiểm canh (cp backup, khôi phục, `cmp` khớp; mutant compile)

| Mutant | Kết quả |
|---|---|
| web `handleDelete` gọi `get` + `setOrder` thay `refresh()` (bỏ đọc lại tồn sau xoá) | ĐỎ (ca #3 web) |
| mobile `_removeLine` gọi `get` + `setState` thay `_refresh()` | ĐỎ (ca #3 mobile) |

## Coverage

- Endpoint: `GET /orders/:id/stock-check`, `GET/POST /orders/:id/stock-issue`, `POST /orders/:id/chuyen-trang-thai` (`xong_giao`), `POST /stock-vouchers` (xuất), `POST /orders/:id/confirm` — 5/5 phủ.
- Màn: Báo giá, Chi tiết đơn (Sheet Xuất kho), Chuyển trạng thái (Đã giao) — 3/3 × web + mobile.
- Preset trên `GET /stock-check`: 7/7 (SUPER_ADMIN, ADMIN, QUAN_LY, KE_TOAN, THO_KS, THI_CONG, KHO_GIAO).

## File test đã đổi trong phiên

- `backend/test/order-stock-check.e2e.spec.ts`
- `web/src/test/quote-stock-check.test.tsx`
- `mobile/test/screens/orders/quote_stock_check_test.dart`

## Next Steps

- 6.6: khi ghi movement giữ chỗ lúc chốt, `reserved`/`available` hết là 0 — DB lane ca "reserved loại phần giữ của chính đơn" là lưới.
- Epic 9: noti #10 từ `StockOutBlocked` (chỉ phát khi server thực sự chặn — Câu hỏi mở 1).
