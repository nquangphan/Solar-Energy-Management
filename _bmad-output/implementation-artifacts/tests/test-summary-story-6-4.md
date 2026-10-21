# Test Automation Summary — Story 6.4 (Xuất kho gắn Đơn + snapshot giá vốn lúc xuất)

**Workflow:** QA automate (hoàn tất story, phiên trực tiếp) · **Ngày:** 2026-10-21 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (hermetic, `initAppOnLoopback`) + lane DB Postgres 5433; web Vitest + Testing Library (jsdom); mobile flutter_test; design-system `node --test`
**Kết quả:** backend `npm test` 90 suite / **1708** xanh (cuối dev: 1683) · `npm run test:db` 18 suite / **166** xanh (cuối dev: 159) · `tsc --noEmit` sạch · web typecheck + vitest 5 file / **65** (cuối dev: 56) + build xanh · mobile `flutter analyze` sạch, `flutter test` **310** xanh (cuối dev: 302) · design-system **427** xanh (cuối dev: 426)

## Phạm vi

Dev đã phủ D1–D11 (primitive, hai cửa, GET xem trước, đọc xé RR, guard, lane DB khoá ép xen kẽ, UI hai nền tảng). Phiên này thêm quyết định Đại Ca 2026-10-21 (D12 — đơn chỉ-thiết-bị: xuất ở `dachot` + chặn đóng thẳng `dachot → hoanthanh` khi chưa xuất + chặn `mo_lai` đơn đã xuất), rồi rà lỗ hở theo AC và theo review.

## Ca mới cho D12 (AC-17, AC-18)

| Lane | Ca |
|---|---|
| unit `order-stock-issue.spec.ts` | `dachot` issuable; 409 TRƯỚC R2 (0 upload, 0 tx); kiểm lại DƯỚI khoá đơn (pre-check thấy rỗng, tx thấy dòng tồn ⇒ 409, 0 ghi status, 0 event, thứ tự `lockOrderRow → order.findUnique → lockTrackedProducts`); đọc `currentVersionId` của lần đọc lại trong tx; giao đủ product id; đã xuất ⇒ đóng; không dòng tồn ⇒ đóng; lane auto cũng bị chặn; cạnh `nghiemthu → hoanthanh` không chạy kiểm; `revise` đơn đã xuất ⇒ 409 sau khoá, không version mới; `canIssue` ở `dachot` |
| unit `stock-vouchers.service.spec.ts` | `lockTrackedProductsInTx`: khoá `products … ORDER BY id FOR UPDATE` là lệnh đầu, id khử trùng, rồi mới đọc `tracksStock`; không ghi gì; tập rỗng ⇒ 0 query |
| e2e `order-stock-issue.e2e.spec.ts` | POST `dachot` ⇒ 201 + 1 dòng audit; `dagiao` ⇒ 409; đóng thẳng chưa xuất ⇒ 409 `CONFLICT` message nguyên văn; xuất rồi đóng ⇒ 200 `hoanthanh`; không dòng tồn ⇒ 200; `mo-lai` đơn đã xuất ⇒ 409 |
| DB `order-stock-issue.db.integration.spec.ts` | chặn (đơn giữ `dachot`, 0 phiếu, `onHand` nguyên); xuất ở `dachot` (snapshot đúng, trạng thái không đổi) rồi đóng; đóng thẳng không dòng tồn; lane auto 409; **ÉP xen kẽ** (i) tx khác giữ khoá đơn + chèn phiếu chưa commit ⇒ lệnh đóng chờ rồi đóng được; (ii) tx khác giữ khoá `products` + bật `tracks_stock` chưa commit ⇒ lệnh đóng (pre-check đã qua) chờ, đọc dưới khoá ⇒ 409; `mo_lai` đơn đã xuất ⇒ 409, vẫn 1 version, 1 phiếu |
| web `order-stock-issue.test.tsx` | Chi tiết đơn `dachot` có nút "Xuất kho"; đóng thẳng chưa xuất ⇒ `Banner` đúng message, không `onDone`; sau khi xuất ⇒ đóng được |
| mobile `order_stock_issue_test.dart` | ba ca twin của web |

## Gap phát hiện & auto-apply (QA)

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC-11 | Gate preset của `POST /stock-issue` chỉ đo KHO_GIAO/QUAN_LY/THO_KS | ✅ e2e +4: ADMIN, SUPER_ADMIN ⇒ 201 có `unitCost`; KE_TOAN, THI_CONG ⇒ 403 không mở tx |
| 2 | AC-6 | `canIssue` theo trạng thái chưa đo ở HTTP | ✅ e2e +2: `dachot` ⇒ true, `dagiao` ⇒ false |
| 3 | AC-14/15 | Nhánh 409 thiếu tồn trong Sheet "Xuất kho" (Chi tiết đơn) chưa đo trên CẢ HAI nền tảng | ✅ web +1, mobile +1: message backend, lỗi đúng dòng `lines.0`, dòng khác sạch, nút bấm lại được |

## Ca mới từ review (xem "Senior Developer Review (AI)" trong story)

- web +5 / mobile +4: nút "Đã giao" khoá tới khi bảng xem trước tải xong; đọc lỗi ⇒ "Không tải được phiếu xuất kho." + "Thử lại"; câu trả lời muộn của bước đã rời bị bỏ; 409 ⇒ đọc lại bảng xem trước; đổi bước ⇒ xoá banner; Sheet web không đóng được khi đang gửi; Sheet mobile 409 đọc lại bảng.
- design-system +1 (mẫu tự kiểm bộ đọc thân kiểu): parity `OrderStockIssue*` giờ so ĐÚNG tập field + tính optional trong thân `interface`/`class`; text-guard thêm luật cấm trừ trên `qty`/`onHand` (+2 mẫu tự kiểm) và khớp đúng nhãn frame `Phiếu xuất`.

## Mutation kiểm canh (cp backup, khôi phục, `filecmp` khớp; mọi mutant compile — `tsc` sạch)

Xem bảng đầy đủ trong story (Senior Developer Review). Tóm tắt: 19/19 ĐỎ — gate trạng thái (a), kiểm trong engine (b), pre-check R2, kiểm trước khoá đơn, bỏ khoá `products` trong kiểm đóng, nới điều kiện cạnh, bỏ "đã xuất ⇒ cho đóng", chặn `mo_lai`, scope `findScopedOrThrow`, `lockOrderRow` đường xuất, `FOR UPDATE` `products` đường xuất, 4 mutant web, 2 mutant mobile, 2 mutant guard design-system.

## Coverage theo AC (lane chứng minh)

| AC | Lane |
|----|------|
| AC-1 | migration + DB lane (unique, 2 CHECK đứng một mình) |
| AC-2 | domain (`cost-snapshot`, `stock-issue-lines`) |
| AC-3 | unit primitive + DB |
| AC-4, AC-5, AC-6 | unit + e2e + DB |
| AC-7, AC-8 | unit + e2e 6.2/6.3 |
| AC-9 | DB lane (16 ca dev + 7 ca D12) |
| AC-10, AC-11 | unit + e2e |
| AC-12 | source-guard + đột biến |
| AC-13 | openapi-drift |
| AC-14, AC-15 | web + mobile widget |
| AC-16 | parity + text-guard (chống rỗng) |
| AC-17, AC-18 | unit + e2e + DB + web + mobile |

Endpoint: `GET/POST /orders/:id/stock-issue`, `POST /orders/:id/chuyen-trang-thai` (xong_giao, hoan_thanh từ `dachot`), `POST /orders/:id/mo-lai` (đơn đã xuất) — phủ đủ. Màn: Chuyển trạng thái, Chi tiết đơn, Phiếu kho — web + mobile.

## File test đã đổi trong phiên

- `backend/test/order-stock-issue.spec.ts`, `order-stock-issue.e2e.spec.ts`, `order-stock-issue.db.integration.spec.ts`, `stock-vouchers.service.spec.ts`, `orders.service.spec.ts` (stub stock), `order-status-change.spec.ts` (mock đọc lại đơn trong tx)
- `web/src/test/order-stock-issue.test.tsx`
- `mobile/test/screens/orders/order_stock_issue_test.dart`
- `design-system/session/parity.test.mjs`, `design-system/screens/stock-issue.test.mjs`

## Next Steps

- 6.7: phiếu nhập trả khi huỷ đơn đã xuất (giờ có thể huỷ cả đơn `dachot` đã xuất).
- 7.2: lane auto tất toán sẽ nhận 409 trên đơn chỉ-thiết-bị chưa xuất SAU khi Payment đã commit — caller phải xử lý (ghi nhận tiền vẫn thành công, đơn chờ xuất kho).
