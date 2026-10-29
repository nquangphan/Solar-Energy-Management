# Test Automation Summary — Story 8.5 (Màn xem Audit log, gate theo quyền `audit.read`)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-30 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (hermetic, `initAppOnLoopback`) · web Vitest + Testing Library · mobile `flutter_test` + `bloc_test`
**Kết quả:** 4 lane xanh sau khi vá (backend 2772, design-system 546, web 534 + typecheck, mobile 1491 + analyze sạch). Lane DB không chạy lại: không sửa test DB (6 ca của dev giữ nguyên).

## Phạm vi

Dev đã phủ dày (unit/e2e/DB/web/mobile/guard). QA chỉ thêm ca còn trống — không lặp lại ca đã có. Mỗi ca mới có đột biến chứng minh ĐỎ (cp backup → khôi phục + `cmp`).

## Gap phát hiện & auto-apply (8 ca)

| # | AC | Gap | Đã vá | Đột biến ⇒ ĐỎ |
|---|----|-----|-------|---------------|
| 1 | 1 | `page`/`pageSize` gửi qua query string chưa từng được test qua HTTP (chỉ unit truyền number) ⇒ gỡ `@Type(() => Number)` không bị test nào bắt | `backend/test/audit-logs.e2e.spec.ts` — `?page=3&pageSize=100` ⇒ 200, `skip 200 take 100` (đồng thời là biên trần 100) | gỡ `@Type` ở `page` ⇒ ĐỎ |
| 2 | 1 | Biên dưới phân trang | cùng file, thêm vào `it.each` 400: `page=0`, `pageSize=0`, `page=abc` | — (bảng 400 có sẵn) |
| 3 | 3 | Không có Bearer ⇒ 401, không đọc DB | cùng file | — |
| 4 | 3 | "Quyền đọc FRESH mỗi request" chưa đo: cùng token, thu quyền ⇒ 403 | cùng file — 200 rồi 403, `listForAccount` gọi 2 lần | — |
| 5 | 6 | Web pager: nút "Trước" chưa bao giờ được bấm; khoá hai đầu; 1 trang ⇒ không pager | `web/src/test/audit-log-screen.test.tsx` | `disabled={false}` cho "Trước" ⇒ ĐỎ |
| 6 | 6 | Web: yêu cầu cũ **LỖI** về muộn (vé ở nhánh `catch`) — test cũ chỉ phủ trả lời thành công về muộn | cùng file | bỏ kiểm vé ở `catch` ⇒ ĐỎ (trước đó sống) |
| 7 | 6 | Mobile cubit: yêu cầu cũ LỖI về muộn sau trang mới | `mobile/test/screens/audit/audit_log_cubit_test.dart` | `if (isClosed) return;` (bỏ vé ở `catch`) ⇒ ĐỎ (trước đó sống) |
| 8 | 6 | Mobile màn: pager "Trước" + khoá hai đầu | `mobile/test/screens/audit/audit_log_screen_test.dart` | "Trước" luôn bấm được ⇒ ĐỎ |

**Không thêm (đã phủ — tránh padding):** 403 với preset `ADMIN` / mọi quyền trừ `audit.read` / chỉ `settings.manage`; 404 cho PATCH/PUT/DELETE/POST; ranh giới ngày VN + tiebreak `id desc` + `total` nhiều trang (lane DB); actor null/account mất; luật `auditChanges`; quét nhãn 47 event + 9 target; cấp quyền đầu-cuối (`accounts-permissions.e2e`); route gate web/mobile; guard "Super Admin"/parity nhãn/tiền.

## Coverage theo AC

| AC | Phủ |
|----|-----|
| 1 Đọc 5 chiều + sắp + phân trang | unit service, e2e (+ coercion query), DB |
| 2 Bất biến | append-only guard, e2e 404 ×4 method, web/mobile không nút sửa/xoá |
| 3 Gate theo quyền | e2e 401/403 ×3/fresh, route + nav web/mobile, guard design-system |
| 4 Cấp quyền | e2e `accounts-permissions` (ADMIN cấp ⇒ 403; SUPER_ADMIN cấp ⇒ thợ đọc 200) |
| 5 Bộ lọc | unit where, e2e 400 ×8, DB ranh giới + lọc targetType |
| 6 Màn web + mobile | render, filter về trang 1, pager hai chiều, rỗng/lỗi/thử lại, vé chống trả lời muộn cả hai nhánh, tháo màn |

API endpoint: 1/1. Màn: 2/2 (web + mobile).

## Kết quả chạy

- backend `npm test`: 136 suite / 2772 test xanh (e2e audit 13 → 19)
- design-system `npm test`: 546/546
- web `npm run typecheck` sạch; `npm test` 45 file / 534 (screen 9 → 11)
- mobile `flutter analyze` sạch; `flutter test` 1491 (cubit +1, screen +1)
- lane DB: không chạy lại (không đổi)

## Bước tiếp theo

- Code review story 8.5 (`bmad-code-review`).
