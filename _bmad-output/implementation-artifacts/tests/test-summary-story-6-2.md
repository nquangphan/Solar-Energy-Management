# Test Automation Summary — Story 6.2 (Tồn kho hiện tại: `onHand` + `reserved` + Khả dụng)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-21 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (hermetic, `initAppOnLoopback`) + lane DB Postgres 5433; web Vitest + Testing Library (jsdom)
**Kết quả:** backend `npm test` 83 suite / **1549 test** xanh (trước QA: 1542) · `npm run test:db` 16 suite / **130** xanh (trước: 129) · web vitest 3 file / **26** xanh (trước: 18) · `tsc --noEmit` backend + web sạch · web build xanh · design-system 407/407 · eslint/prettier sạch trên file đã sửa

## Phạm vi

Dev đã viết sẵn domain (`ton-kho.spec`), service mock (đếm gọi Prisma), e2e (401/403/200/400), DB lane (SUM ledger, LEFT JOIN, unique, FK), source-guard, text-guard, parity, widget test mobile (mọi trạng thái + bề rộng 320/360). QA rà theo AC, chỉ vá lỗ còn hở.

## Gap phát hiện & auto-apply

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC-3 / 🛑5 | `THI_CONG` ⇒ 403 có trong AC nhưng chỉ `KE_TOAN` được test | ✅ `stock-items.e2e.spec.ts` lặp `KE_TOAN`, `THI_CONG` |
| 2 | AC-3 | Gate OR chưa đo bằng key lẻ (preset có thể mang cả hai key ⇒ AND vẫn xanh) | ✅ +2 ca: chỉ `inventory.manage` ⇒ 200; chỉ `quotes.create_edit` ⇒ 200 |
| 3 | 🛑5 | `ADMIN`/`QUAN_LY`/`SUPER_ADMIN` đọc được — chưa đo | ✅ +3 ca 200 |
| 4 | AC-3 (DTO `q` max 100) | `q` 101 ký tự ⇒ 400 qua ValidationPipe chưa đo | ✅ +1 ca 400 `VALIDATION_ERROR`, field `q`, không xuống Prisma |
| 5 | AC-3 | "`danhSachCanMua` tính trên CÙNG tập đã lọc" + thứ tự `canNhap` giảm dần, hoà theo tên — chưa đo trên collation Postgres thật | ✅ `stock-items.db.integration.spec.ts` +1 ca |
| 6 | AC-10 | Web chỉ có 1 ca smoke render; chưa có loading / error + Thử lại / hai câu empty / ô tìm gửi `q` / chống trả lời cũ / ẩn khối cần mua khi không món nào âm | ✅ file mới `web/src/test/inventory-screen.test.tsx` +6 ca (cổng điều khiển tay, fixture `DEMO_STOCK_LIST`) |
| 7 | AC-11 | Sidebar: mục Kho hiện với MỘT trong hai key, ẩn khi thiếu cả hai — chưa có test hành vi | ✅ +2 ca `filterNav(SIDEBAR_NAV, …)` |

**Mutation kiểm canh** (backup `cp`, khôi phục, `cmp` khớp):

| Mutant | Kết quả |
|---|---|
| web bỏ vé `latest` ở nhánh thành công | ca "trả lời cũ" ĐỎ |
| web đảo điều kiện hai câu empty (`dangTim`) | 2 ca empty ĐỎ |
| controller `@RequireAnyPermissions` → `@RequirePermissions` (AND) | e2e 7 ca ĐỎ (gồm 2 ca key lẻ mới) |
| service `orderBy name 'desc'` | DB lane 2 ca ĐỎ (gồm ca thứ tự cần mua mới) |

**Không thêm (đã phủ — tránh padding):** AC-1/2/4/5/6/7 (domain + service mock + DB + source-guard), AC-12/14 mobile (widget test có đủ trạng thái, Thử lại, cần mua hiện/ẩn với fixture có item, 320/360px), AC-13/15 (parity + text-guard có chống-rỗng). Mobile không có ô tìm (AC-12 không đòi) ⇒ không có ca race phía mobile.

## Coverage theo AC (lane chứng minh)

| AC | Lane |
|----|------|
| AC-1, AC-7 | migration + DB lane + source-guard |
| AC-2 | domain |
| AC-3 | service mock + e2e (gate, 400 `productIds`/`q`, body) + DB (lọc, sắp, cần mua cùng tập) |
| AC-4 | DB lane |
| AC-5, AC-6 | service mock + source-guard |
| AC-8 | e2e |
| AC-9 | openapi-drift + guard sẵn có |
| AC-10, AC-11 | web smoke render + web hành vi (mới) |
| AC-12, AC-14 (mobile) | widget test |
| AC-13, AC-15 | design-system parity + text-guard |

Endpoint: `GET /stock-items` — 1/1 phủ (401, 403×2 vai trò, 200×7 vai trò/key, 400×2 field). Màn: Tồn kho web + mobile — 2/2 phủ mọi trạng thái.

## File đã đổi

- `backend/test/stock-items.e2e.spec.ts` (M, +7 ca)
- `backend/test/stock-items.db.integration.spec.ts` (M, +1 ca)
- `web/src/test/inventory-screen.test.tsx` (A, 8 ca)

## Next Steps

- 6.5 tiêu thụ `GET /stock-items?productIds=` — thêm e2e/web cho cảnh báo ở báo giá khi story đó dựng.
