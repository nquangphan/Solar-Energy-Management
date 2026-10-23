# Test Automation Summary — Story 8.2 (Màn phân quyền — ma trận per-account + áp preset Role)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-23 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend e2e qua `initAppOnLoopback`), Vitest + Testing Library (web), Flutter `flutter_test` + `bloc_test` (mobile), `node --test` (design-system).
**Kết quả:** web typecheck sạch, vitest **480/480** · mobile `flutter analyze` sạch, **1402/1402** · design-system **531/531**. Backend không đổi file nào (lane hẹp e2e + service 40/40 trong lúc sweep). Tất cả xanh.

## Phạm vi

Dev đã phủ AC 1–9 ở cả 5 lane: domain (`permission-dependencies`, `role-presets`, `permission-escalation`), service (mock tx chạy callback, thứ tự kiểm, đọc qua `tx`, publish đúng 1 lần), e2e 17 ca (gate 3 route, contract key, options theo actor, 400/403/404, hai tổ hợp TD-65), DB lane 5 ca (interleaving thật, thu quyền actor đang lưu, 404, 1 dòng audit), màn web/mobile + cubit + text-guard. Dev Agent Record ghi sweep đột biến backend 11/11, web 4/4, mobile 16/17. QA không viết lại phần đó.

QA chạy **sweep đột biến độc lập** (21 mutant: 9 web, 8 mobile, 4 backend) tập trung vào chỗ dev chưa đột biến: phần còn lại của màn web, trạng thái "đang lưu" trên mobile, bottom nav, và dây nối controller/summary phía backend. Lane hẹp: web `permissions-screen` + `screens-render` + `app-routes`; mobile `test/screens/permissions` + `signed_in_app_test`; backend `accounts-permissions.e2e` + `account-permissions.service`.

Vòng 1: **9 ĐỎ, 12 sống**. Không mutant nào tương đương — cả 12 là lỗi người dùng thấy được (M5 và M6 cùng bị một ca mới giết).

## Gap phát hiện & auto-apply

| # | AC | Mutant sống | Vì sao là gap | Ca mới / assert thêm |
|---|----|-------------|---------------|-----------------------|
| 1 | 1 | W1 web lưu xong không thay hàng trong danh sách bằng summary backend trả | Hàng vẫn ghi "Thợ khảo sát" sau khi đã lưu bộ Kế toán ⇒ nhãn preset sai tới khi tải lại | web "a successful save puts the backend summary on the row and the card header" |
| 2 | 1 | W5 nhãn preset ở đầu thẻ luôn "Tuỳ chỉnh" | Chưa ca nào đọc nhãn ở đầu thẻ (chỉ đọc ở hàng) | assert `.perm-card-head .ktype` lúc chọn + sau lưu |
| 3 | 8 | W2 web Lưu vẫn bật khi đang lưu | Double-click ⇒ hai `PUT` (AC 8 nêu đúng ca double-click; backend chịu được nhưng UI không nên gửi hai lần) | web "Lưu is disabled while a save is pending, so a double click sends once" |
| 4 | 9 | M1 mobile `canSave` bỏ `!saving` | Cùng lỗi #3 bên mobile: chạm Lưu hai lần ⇒ hai lời gọi port | mobile "while a save is pending: Lưu, the boxes and Áp preset role are disabled, a second tap sends nothing" |
| 5 | 9 | M5 ô tick vẫn bật khi đang lưu · M6 nút "Áp preset role" vẫn bấm được khi đang lưu | Cubit bỏ qua thao tác nhưng màn trông như sửa được (sheet preset vẫn mở) | cùng ca #4: mọi `AppCheckbox.disabled`, `AppButton.onPressed == null`; xong lưu thì bật lại |
| 6 | 9 | W3 đổi account không xoá lỗi lưu cũ | Câu 403 của account A hiện trên thẻ của account B | web "switching account clears the previous account's save error" |
| 7 | 2 | W6 chọn preset xong sheet không đóng | Sheet che ma trận vừa được nạp | assert nút preset không còn sau khi chọn (ca áp preset có sẵn) |
| 8 | 1 | W4 hàng đang chọn không có `aria-pressed="true"` | Không thấy đang xem account nào (CSS bám `aria-pressed`) | assert `aria-pressed` true/false trong ca chọn account |
| 9 | 9 | W7 sidebar sáng mục khác | Khuôn 8.1: màn phải sáng đúng mục của mình | web "Phân quyền is the active sidebar link" |
| 10 | 9 | M3 / M4 bottom nav của hai màn mobile trỏ tab khác | Phân quyền vào từ Menu (tab thứ 5); chưa ca nào đọc `activeIndex` | assert `AppBottomNav.activeIndex == 4` ở cả hai màn |

**Không thêm (đã phủ, tránh padding):** ca 401 không token — mutant B1 (`@Public()` trên controller) đã ĐỎ 15 ca vì `CurrentAccount` rỗng; PUT trả summary của actor (B2 ĐỎ e2e); preset mất bộ quyền (B3 ĐỎ unit); `isActive` cố định (B4 ĐỎ unit); disable Lưu khi thiếu phụ thuộc (W8/M7 ĐỎ); `grantable` bị bỏ (W9 ĐỎ); nhãn chip mobile (M8 ĐỎ); `account: saved` sau lưu (M2 ĐỎ bloc_test).

## Bảng đột biến (QA)

Cách làm: `cp` backup ra scratchpad, sửa bằng script (neo phải khớp đúng 1 lần, kiểm chuỗi chèn đã có), chạy lane, `cp` trả + `filecmp` bằng nguyên bản. Không `git checkout`, không mutant nào lỗi compile. `git status` sau sweep: file nguồn không đổi.

| Mutant | Vòng 1 | Sau QA |
|---|---|---|
| W8 web Lưu không chặn khi thiếu phụ thuộc | ĐỎ | — |
| W9 web bỏ `!option.grantable` | ĐỎ | — |
| M2 cubit giữ `account` cũ sau lưu | ĐỎ | — |
| M7 mobile `canSave` bỏ `dependencyGaps.isEmpty` | ĐỎ | — |
| M8 chip mobile luôn "Tuỳ chỉnh" | ĐỎ | — |
| B1 `@Public()` trên `AccountsController` | ĐỎ | — |
| B2 PUT trả summary của actor | ĐỎ | — |
| B3 preset gửi `permissions: []` | ĐỎ | — |
| B4 `isActive: true` cố định | ĐỎ | — |
| W1 · W2 · W3 · W4 · W5 · W6 · W7 | XANH ×7 | **ĐỎ ×7** |
| M1 · M3 · M4 · M5 · M6 | XANH ×5 | **ĐỎ ×5** |
| **Tổng** | **9/21 ĐỎ** | **21/21 ĐỎ** |

## Test theo file

- [x] `web/src/test/permissions-screen.test.tsx`: +4 ca (sidebar active, lưu xong cập nhật hàng + đầu thẻ, Lưu disabled khi đang lưu, đổi account xoá lỗi) + assert `aria-pressed`, nhãn đầu thẻ, sheet đóng sau khi chọn preset. Prettier (`--single-quote --print-width 120`, như file) sạch.
- [x] `mobile/test/screens/permissions/account_permissions_screen_test.dart`: +1 ca (đang lưu: Lưu/ô/nút preset disabled, chạm Lưu lần hai không gửi) + assert `AppBottomNav.activeIndex`.
- [x] `mobile/test/screens/permissions/account_list_screen_test.dart`: + assert `AppBottomNav.activeIndex`.
- `dart format -o none --set-exit-if-changed` trên 2 file mobile: 0 thay đổi; `flutter analyze` sạch.

Không sửa mã nguồn sản phẩm.

## Coverage theo AC

| AC | Trạng thái |
|---|---|
| 1 danh sách + ma trận, gate quyền | ✅ dev + gap 1, 2, 8 |
| 2 áp preset chỉ nạp | ✅ dev + gap 7 |
| 3 không lan sang account khác, preset không hồi tố | ✅ dev (e2e + DB lane) |
| 4 key chỉ từ registry, 400 `fieldErrors.permissions` | ✅ dev (e2e + text-guard) |
| 5 không-leo-thang, cờ do backend tính | ✅ dev (unit + e2e, W9) |
| 6 không tự sửa mình | ✅ dev (unit + e2e + màn) |
| 7 TD-65 chặn | ✅ dev (domain + e2e + 2 màn, W8/M7) |
| 8 ghi atomic dưới khoá, audit sau commit | ✅ dev (DB lane) + gap 3 (UI không gửi đôi) |
| 9 parity web ↔ mobile, BLoC | ✅ dev + gap 4, 5, 6, 9, 10 |

API: 3/3 endpoint (`GET /accounts`, `GET /accounts/permission-options`, `PUT /accounts/:id/permissions`) — 200, 400 ×5 dạng, 403 ×4 dạng, 404. UI: 3/3 màn (web 2 cột, mobile danh sách + ma trận), mỗi màn có ca render/quyền/lỗi/chỉ đọc/đang lưu; dây nối app: route web `/permissions` gate, Menu mobile + đọc lại danh sách khi quay về.

## Kết quả chạy

- `cd web && npm run typecheck && npm test` → sạch · **480/480**
- `cd mobile && flutter analyze && flutter test` → sạch · **1402/1402**
- `cd design-system && npm test` → **531/531**
- Backend: không đổi file; lane hẹp 40/40 trong sweep (dev chạy `npm test` 2624/2624, `test:db` 335/335)

## Bước tiếp theo

- Code review 8.2 (`bmad-code-review`).
- Smoke web/emulator: dev đã chạy (Dev Agent Record) — QA không chạy lại.
