# Test Automation Summary — Story 6.6 (Giữ chỗ tồn khi chốt đơn — StockMovement ledger idempotent)

**Workflow:** QA automate · **Ngày:** 2026-10-21 · **Người chạy:** Đại Ca
**Framework:** backend Jest (unit/e2e hermetic, `initAppOnLoopback`) + lane DB Postgres 5433 (`pns-postgres`). Story không có UI (D6) ⇒ không có E2E web/mobile.
**Kết quả:** backend `tsc --noEmit` sạch · prettier + eslint file test đã sửa sạch · `npm run test:db` 20 suite / **202** xanh (cuối dev: 199) · `npm test` không đổi file hermetic ⇒ không chạy lại (cuối dev: 94 suite / 1779 xanh) · `src/` không đổi byte (mutant khôi phục từ cp backup).

## Phạm vi đã có từ dev (đối chiếu AC)

| AC | Lane đã phủ |
|----|-------------|
| AC-1 chốt lần đầu giữ chỗ | DB (gộp dòng cùng SP, bỏ untracked/tự do, `onHand` không đổi, đường đọc thấy) + unit primitive + e2e `orders.e2e` |
| AC-2 thiếu vẫn chốt | DB (Khả dụng −4, `canNhap` 4, không `StockOutBlocked`) |
| AC-3 từ `choduyet` | unit `orders.service.spec` |
| AC-4 gọi lặp | unit + DB + e2e |
| AC-5 đua | DB 2 request thật song song |
| AC-6 re-chốt thay phần giữ | DB 2 chu kỳ (v1→v2→v3, append-only) + unit primitive |
| AC-7 mở lại không nhả | DB + `getStockCheck` |
| AC-8 xuất nhả đúng | DB (sau chốt, sau re-chốt) |
| AC-9 ràng buộc DB | DB SQL thô: unique + 6 ca CHECK |
| AC-10 khoá FOR UPDATE | DB xen kẽ ép buộc + 2 SP mới song song + song song phiếu nhập |
| AC-11 atomic | unit (mock tx chạy thân rồi ném ⇒ 0 publish) |
| AC-12 phạm vi | DB 404 ngoài phạm vi + guard `no-unscoped-order-write` |
| AC-13 không hồi quy | guard `inventory-read-only`, `no-stock-write-in-cancel`, drift openapi/permissions |

## Gap phát hiện & auto-apply (QA)

Tất cả trong `backend/test/stock-reservation.db.integration.spec.ts`.

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC-3 | Chốt từ `choduyet` (chiết khấu `dong_y`) chỉ đo ở unit — chưa đo ghi ledger thật trên Postgres | ✅ DB +1: đơn `choduyet` + approval `dong_y` ⇒ `dachot`, đúng 1 dòng `reserve`, `reserved` = 3 (cleanUp thêm `discountApproval`) |
| 2 | AC-11 | Atomic chỉ đo ở unit (mock) — chưa chứng minh rollback THẬT khi primitive đã ghi rồi mới ném | ✅ DB +1: spy chạy primitive thật rồi ném ⇒ đơn vẫn `baogia`, `chotAt` null, ledger rỗng, `reserved` 0, 0 publish |
| 3 | AC-6 | Re-chốt chỉ nhả phần giữ của CHÍNH đơn — chưa có ca hai đơn cùng SP | ✅ DB +1: đơn X (4) + Y (6) cùng SP; re-chốt X v2 (1) ⇒ Y giữ nguyên `reserve +6`, X `release −4` + `reserve +1`, `reserved` = 7 |

## Mutation kiểm canh (cp backup, KHÔNG git checkout; mutant compile — `tsc` ok)

| Mutant | Kết quả lane DB |
|---|---|
| bỏ `orderId` khỏi `where` của `groupBy` phần giữ cũ (`reserveForOrderInTx`) | ĐỎ 10 (gồm ca #3 và #1) |
| `confirm` gọi primitive bằng `this.prisma` thay `tx` (ghi ngoài tx) | ĐỎ 17 (gồm ca #2) |

Ghi chú trung thực: mutant 1 cũng làm đỏ 8 ca có sẵn (dữ liệu các đơn khác trong cùng file lọt vào phần nhả) ⇒ hành vi đã được canh gián tiếp từ trước; ca #3 canh trực tiếp và đứng một mình.

## Coverage

- Endpoint/đường ghi: `confirm` (từ `baogia` và `choduyet`), `revise` + re-chốt, `issueStock`, `POST /stock-vouchers` nhập song song — đủ mọi đường chạm ledger giữ chỗ của story.
- AC dẫn xuất: 13/13 có ít nhất một lane; AC-3 và AC-11 giờ có cả unit lẫn lane DB.
- UI: không áp dụng (story backend + schema).

## Next Steps

- Chạy `npm run test:db` trong CI (hiện chỉ chạy local, cần Postgres 5433).
- Câu hỏi mở của story giữ nguyên (backfill đơn chốt trước story; SP tắt theo dõi giữa chốt và xuất — xử lý cùng 6.7).
