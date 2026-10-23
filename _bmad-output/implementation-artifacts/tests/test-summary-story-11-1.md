# Test Automation Summary — Story 11.1 (Nền BLoC: phiên, quyền, Đăng nhập, Quên mật khẩu, Menu)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-23 · **Người chạy:** Đại Ca
**Framework:** `flutter_test` + `bloc_test` (mobile, hermetic — không backend/emulator)
**Kết quả:** lane mobile **827/827** xanh (816 trước QA + 11 ca mới) · `flutter analyze` sạch

## Phạm vi

Refactor thuần mobile (backend/web không đổi) ⇒ không có API test mới. "E2E" ở đây = widget test dựng màn/provider thật + `bloc_test` cho cubit. Lưới an toàn cũ (pns_app 14 ca, auth 27, menu 7, guard D10 19 ca, text-guard design-system) đã có và xanh từ bước dev — không đụng (`git diff --stat 811d3c7 -- mobile/test/screens mobile/test/app mobile/test/design_system/session_test.dart` rỗng).

## Gap phát hiện & auto-apply (+11 ca)

Mọi gap thuộc AC 8 ("phản hồi port về sau `close` ⇒ không ném, không `emit`"). Đây là rủi ro mới mà BLoC đưa vào: trước kia `if (mounted)` che, giờ `emit` sau `close` ném `StateError`. Dev chỉ phủ nhánh **thành công** trả về muộn.

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | 8, 14 | `LoginCubit`: port **lỗi** sau `close` | `login_cubit_test.dart` +1 |
| 2 | 8, 13 | `PermissionsCubit`: `/me` **lỗi** sau `close` | `permissions_cubit_test.dart` +1 |
| 3 | 8, 15 | `ForgotPasswordCubit.requestCode` **lỗi** sau `close` | `forgot_password_cubit_test.dart` +1 |
| 4 | 8, 15 | `ForgotPasswordCubit.reset` về sau `close` (nhận / bị từ chối) ⇒ `false`, không emit. Trước QA, đổi `return !isClosed` thành `return true` vẫn sống | `forgot_password_cubit_test.dart` +2 (port thêm `resetPending`) |
| 5 | 3–5 | Widget: rời màn khi port đang chờ (Đăng nhập nhận/lỗi; Quên mật khẩu đang gửi mã; đang đặt lại) ⇒ không crash, không gọi `onLoggedIn`/`onBackToLogin`, không còn timer đếm ngược | **mới** `test/app/unmount_while_port_pending_test.dart` (4 ca) |
| 6 | 4 | Widget: `PermissionsProvider` bị tháo (đăng xuất / Thử lại) trước khi `/me` trả về hoặc lỗi | cùng file trên (2 ca) |

Ca widget assert số lời gọi port (`codeRequests`, `resets`) = 1 ⇒ chạm thật tới port, không xanh rỗng.

**Không thêm (đã phủ, tránh test thừa):** pha phiên / hết phiên / logout 2 lần (session_cubit_test 15 ca + pns_app_test); đổi account không dính quyền (`signed_in_app_test.dart:338`); validation và map lỗi Login/Quên mật khẩu; đếm ngược chạy về 0 rồi dừng / gửi lại mã; Menu.

## Đột biến chứng minh (cp backup, khôi phục bằng cp, không git checkout)

| Mutant | Kết quả |
|---|---|
| M1 `reset`: `return !isClosed` → `return true` | ĐỎ 1 (cubit) — widget xanh vì màn còn lớp `mounted` |
| M2 bỏ `isClosed` ở catch `LoginCubit` | ĐỎ 2 (cubit + widget "refused") |
| M3 bỏ `isClosed` ở catch `PermissionsCubit` | ĐỎ 2 (cubit + widget "fails") |
| M4 bỏ `isClosed` ở catch `requestCode` | ĐỎ 1 |
| M5 bỏ `isClosed` ở catch `reset` | ĐỎ 1 |
| M6 bỏ `isClosed` sau `requestResetCode` thành công | xanh — **đột biến tương đương**: `emit` ném trong `try`, rơi vào `catch` và bị `isClosed` của nhánh lỗi nuốt (M4 bẻ lớp đó ⇒ đỏ) |
| M7 `LoginScreen` gọi `onLoggedIn` bất kể kết quả | ĐỎ 2 (widget) |

## Test theo file

- [x] `mobile/test/app/unmount_while_port_pending_test.dart` (mới, 6 ca): rời màn hoặc tháo provider khi port đang chờ
- [x] `mobile/test/screens/auth/login_cubit_test.dart` (+1)
- [x] `mobile/test/screens/auth/forgot_password_cubit_test.dart` (+3)
- [x] `mobile/test/design_system/session/permissions_cubit_test.dart` (+1)

## Coverage theo AC

- AC 8 (port về sau `close`): 5/5 cubit × cả nhánh thành công và lỗi (Menu, Session đã có từ dev)
- AC 12–16: đã phủ từ dev, QA bổ sung nhánh lỗi sau `close`
- Màn/provider đã chuyển có ca tháo khi đang chờ: 3/3 (Login, ForgotPassword, PermissionsProvider); Menu không gọi port (`MenuCubit` có ca sau `close`)

## Kết quả chạy

- `cd mobile && ~/fvm/default/bin/flutter test` ⇒ `+827: All tests passed!`
- `~/fvm/default/bin/flutter analyze` ⇒ No issues found
- design-system không đổi ⇒ không chạy lại (dev: 508/508)

## Bước tiếp theo

- Code review story 11.1 (`/ck:code-review`)
- 11.2–11.4: mỗi cubit mới phải có ca "port lỗi sau `close`", không chỉ ca thành công

## Câu hỏi tồn đọng

- Không có.
