# Test Automation Summary — Story 6.3 (Phiếu nhập/xuất kho + giá vốn bình quân gia quyền)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-21 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (hermetic, `initAppOnLoopback`) + lane DB Postgres 5433; web Vitest + Testing Library (jsdom); mobile flutter_test
**Kết quả:** backend `npm test` 86 suite / **1608** xanh (trước QA: 1597) · `npm run test:db` 17 suite / **143** xanh (trước: 142) · `tsc --noEmit` sạch · web typecheck + vitest 4 file / **40** (trước: 38) + build xanh · mobile `flutter analyze` sạch, `flutter test` **286** xanh (trước: 285) · eslint/prettier/dart format sạch trên file đã sửa

## Phạm vi

Dev đã viết sẵn domain (`gia-von.spec`), service mock (thứ tự khoá, rollback, event sau commit), e2e (401/403/201/400×9/409 tồn/404), DB lane (khoá ép xen kẽ, chéo A,B/B,A, `= ANY`, CHECK on_hand/qty, FK, seq), source-guard nới (b), text-guard + parity, web hành vi, widget test mobile. QA rà theo AC, chỉ vá lỗ còn hở.

## Gap phát hiện & auto-apply

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC-3 | 409 `PRODUCT_NOT_STOCKABLE` chỉ đo ở unit — mã HTTP chưa đo ở e2e | ✅ e2e +2 ca (`tracksStock=false`, `isActive=false`) ⇒ 409, field `lines.0.productId`, không ghi |
| 2 | AC-3 | Biên DTO chưa đo: `qty` > 1_000_000, `unitCost` âm / > Int32, `note` 501 ký tự, > 100 dòng | ✅ e2e +5 ca 400 vào bảng `BODY_SAI` |
| 3 | Story (preset) | Chỉ đo KHO_GIAO/QUAN_LY (201) và THO_KS (403) | ✅ e2e +4 ca: ADMIN, SUPER_ADMIN ⇒ 201/200; KE_TOAN, THI_CONG ⇒ 403 không mở tx |
| 4 | AC-1/AC-7 | CHECK `stock_voucher_lines_unit_cost_non_negative` chưa có ca đứng một mình | ✅ DB lane +1 ca (INSERT thô `unit_cost = -1` ⇒ message chứa tên constraint) |
| 5 | AC-12 | Bộ lọc Tất cả/Nhập/Xuất không đo tham số gửi cổng (ca "lọc ra rỗng" cũ dùng port rỗng ⇒ mutant luôn gửi `{}` sống sót) | ✅ web +1 ca `listVouchers` nhận `{type:'nhap'}`/`{type:'xuat'}`/`{}` |
| 6 | AC-12 | Picker: gửi `q` + vé `latest` chống trả lời cũ chưa có test | ✅ web +1 ca (cổng tay, trả lời cũ về muộn không đè gợi ý mới) |
| 7 | AC-14 | Mobile chống bấm Lưu hai lần ("cùng luật như web") chưa đo | ✅ widget +1 ca: bấm 2 lần ⇒ port gọi 1 lần, `onPressed` null |

**Mutation kiểm canh** (backup `cp`, khôi phục, `cmp` khớp):

| Mutant | Kết quả |
|---|---|
| DTO `@ArrayMaxSize(1000)`, `@MaxLength(5000)`, `@Max(QTY_TOI_DA * 10)` + service bỏ kiểm `isActive` | e2e 4 ca mới ĐỎ |
| web bỏ vé `goiYTicket` ở picker | ca trả lời cũ ĐỎ |
| web `listVouchers({})` bất kể bộ lọc | ca bộ lọc ĐỎ (ca cũ vẫn xanh — lỗ thật) |
| mobile gỡ `_sending` khỏi `onPressed` nút Lưu | widget ca mới ĐỎ |

**Không thêm (đã phủ — tránh padding):** AC-2 (domain), AC-4 (unit + e2e audit đúng 1 dòng), AC-5 (e2e list/detail/400/404 + DB đếm), AC-7 khoá/rollback/`= ANY`/FK/seq (DB lane, đột biến FOR UPDATE đã chứng minh ĐỎ ở dev), AC-8 (unit), AC-10 (guard + đột biến), AC-11 (openapi-drift), AC-13 (web + mobile lối vào), AC-15/17 (parity + text-guard chống rỗng), AC-16 phần còn lại.

## Coverage theo AC (lane chứng minh)

| AC | Lane |
|----|------|
| AC-1 | migration + DB lane (CHECK ×3, FK, seq) |
| AC-2 | domain |
| AC-3 | unit + e2e (gate 7 preset, 400 ×14, 409 ×3, 404) + DB |
| AC-4, AC-8 | unit + e2e audit |
| AC-5 | e2e + DB |
| AC-7 | DB lane |
| AC-9 | e2e |
| AC-10, AC-11 | source-guard + openapi-drift |
| AC-12, AC-13, AC-16 web | screens-render + `stock-vouchers-screen.test.tsx` |
| AC-13, AC-14, AC-16 mobile | widget test |
| AC-15, AC-17 | design-system parity + text-guard |

Endpoint: `POST /stock-vouchers`, `GET /stock-vouchers`, `GET /stock-vouchers/:id` — 3/3 phủ. Màn: Phiếu kho web + mobile, lối vào từ Tồn kho — 4/4 phủ.

## File đã đổi

- `backend/test/stock-vouchers.e2e.spec.ts` (+11 ca)
- `backend/test/stock-vouchers.db.integration.spec.ts` (+1 ca)
- `web/src/test/stock-vouchers-screen.test.tsx` (+2 ca)
- `mobile/test/screens/inventory/stock_vouchers_screen_test.dart` (+1 ca)

## Next Steps

- 6.4 (xuất gắn đơn): thêm e2e/DB cho `orderId` unique + trừ `reserved` dưới cùng khoá `products FOR UPDATE ORDER BY id`.
