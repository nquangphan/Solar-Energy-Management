# Test Automation Summary — Story 4.5 (Chốt Đơn + snapshot giá)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-17 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic, mock Prisma — không cần Postgres)
**Kết quả:** backend **843/843** xanh (54 suite, 838 → 843, +5 test) · mobile/design-system không đụng file → giữ kết quả dev phase (174 + 273 xanh)

## Phạm vi

Story đã có bộ test dev-phase dày (9 unit + 7 e2e + 4 widget + guards). QA phase rà gap
coverage theo 6 AC, phát hiện **5 gap** — tất cả backend, tập trung vào pricing lúc snapshot
(vùng tiền bạc) — và auto-apply toàn bộ.

## Gap phát hiện & auto-apply (5 test mới)

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | #1/#4 | Chốt qty **chạm bậc thang** (cờ tier BẬT) → snapshot = giá TIER 2_300_000 | `DONG_CATALOG.qty = 8` < minQty 10 — không test nào hit tier path trong `confirm()`; đóng băng sai bậc = sai tiền | ✅ `orders.service.spec.ts` |
| 2 | #1 | Chốt qty chạm bậc thang nhưng **cờ tier TẮT** → snapshot = basePrice | Spec nhấn "CÙNG cờ với đường live" nhưng chưa test — mutant hardcode `true` lọt qua toàn bộ suite cũ | ✅ `orders.service.spec.ts` (**mutation-checked**: bẻ `confirm()` hardcode `tieredPricingEnabled: true` → RED đúng test này → revert `cp` backup) |
| 3 | #2 | `toViews` **trộn dòng frozen + live**: mỗi dòng theo tín hiệu riêng, `liveIds` CHỈ chứa product dòng sống | Chỉ có test all-frozen / all-live; granularity per-line là nền forward-compat 4.6 (version cũ đã chốt + version mới đang sửa) | ✅ `orders.service.spec.ts` |
| 4 | #1 | Product **biến mất** khỏi danh mục (dữ liệu hỏng) → snapshot rơi về giá cache, tx vẫn hoàn tất | Nhánh phòng thủ `product === undefined` (orders.service.ts) chưa có test nào chạm | ✅ `orders.service.spec.ts` |
| 5 | #1/AD-16 | e2e: **vatRate từ CONFIG** — row `vat.rate_percent = '10'` → version snapshot `vatRate: 10` | e2e chỉ phủ default 8 (settings vắng row) — chưa chứng minh controller truyền config resolve thật, không hardcode | ✅ `orders.e2e.spec.ts` |

**Không thêm (đã phủ — tránh padding):** race 2 request đồng thời + sentinel abort (unit d),
retry idempotent không double-audit (e2e), thứ tự write→publish (unit b), 3 loại dòng snapshot
(unit a + e2e happy), mutation dòng/meta sau chốt 409 (unit AC-2 + e2e ×2 — phủ AC #3 warranty
freeze), thiếu quyền 403/`quotes.create_edit` không thay thế (e2e), đơn rỗng 400 / đơn ma 404,
UI 2 nền tảng: 4 widget test mobile (confirm-flow, huỷ dialog, port throw giữ giỏ, gate ẩn nút)
+ guard nhãn byte-identical & negative assert `'dachot'` literal (đã mutation-check ở dev phase).

## Test theo file

### Unit — `backend/test/orders.service.spec.ts` (+4)
- [x] chốt qty chạm bậc thang (cờ tier BẬT) ⇒ snapshot = giá TIER, không phải basePrice
- [x] chốt qty chạm bậc thang nhưng cờ tier TẮT ⇒ snapshot = basePrice (CÙNG cờ với đường live)
- [x] product biến mất khỏi danh mục (dữ liệu hỏng) ⇒ snapshot rơi về giá cache, tx vẫn hoàn tất
- [x] toViews trộn dòng đóng băng + dòng sống ⇒ mỗi dòng theo tín hiệu RIÊNG, product chỉ tra cho dòng sống

### API / E2E — `backend/test/orders.e2e.spec.ts` (+1)
- [x] vatRate đóng băng theo CONFIG: row `vat.rate_percent = '10'` ⇒ version snapshot vatRate 10

## Coverage sau QA

- AC #1 endpoint + snapshot 3 loại dòng: **đủ** (thêm tier ×2, product-mất, config vatRate)
- AC #2 không hồi tố: **đủ** (thêm mixed frozen/live — per-line signal)
- AC #3 warranty freeze: **đủ** (assertMutable unit + e2e sẵn có)
- AC #4 giá catalog song song: **đủ** (dev phase)
- AC #5 idempotent + event: **đủ** (dev phase)
- AC #6 UI 2 nền tảng: **đủ** (4 widget test + guards; web không runtime — text-guard là lớp duy nhất, đã biết)

## Lane

- `cd backend && npm test`: 843/843 (lần đầu đỏ 2 suite flake đã biết `customer-sources.e2e`/`customers.e2e` — rerun cô lập + full đều xanh, không sửa gì)
- Mobile/design-system: không file nào đổi trong QA phase — kết quả dev phase còn hiệu lực
- DB lane: vẫn không khả dụng (Docker down — như Debug Log story)

## Unresolved

- Action item 4.4 còn treo: migration `20260717000000` chưa `migrate deploy` thật (chờ Postgres/Docker).
