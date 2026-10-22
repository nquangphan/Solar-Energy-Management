# Tóm tắt kiểm thử tự động — Story 10.6 (Mobile: app shell, client Dart sinh từ OpenAPI, phiên đăng nhập)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** mobile flutter_test (`test()` + `testWidgets`), Dio `HttpClientAdapter` giả + `dart:io` `HttpServer` loopback
**Kết quả:** mobile `flutter analyze` **No issues found** · `flutter test` **521** xanh (+11 so với 510 lúc dev, không xoá/nới ca cũ). Không đổi `lib/`, backend, web, design-system.

## Phạm vi

Em đã rà AC 1–21 với các test dev viết: `transport_test` (16 ca (a)–(o)), `session_store_test`, `http_auth_port_test`, `api_error_test`, `build_mobile_spec_test`, `generated_client_drift_test`, `no_network_outside_transport_test`, `pns_app_test`, `login_screen_test`, `shell_render_test`. Dev đã phủ đủ transport, guard, drift và parity, và đã bẻ thử (mutation) từng phần. Phần còn thiếu nằm ở hai chỗ:
- **Tầng app (`PnsApp`).** Mục "Tình huống biên đã tính" của story có liệt kê các ca sau nhưng chưa có widget test: backend tắt lúc mở app, keystore hỏng, đăng xuất khi mất mạng. Ca "hết phiên ⇒ về Đăng nhập" chỉ tự tăng `ValueNotifier` bằng tay. Vì vậy chưa ca nào chứng minh chuỗi transport → `onSessionExpired` → app.
- **Socket thật.** Mọi test đều thay adapter của Dio, nên adapter IO dùng trong production (header Bearer thật, JSON body, base path `/api`) chưa được đo.

## Lỗ tìm được và đã vá

| # | AC / biên | Lỗ | Đã vá |
|---|---|---|---|
| 1 | AC-4/16, biên "mở app khi backend tắt" | Chưa có ca app | ✅ `pns_app_test`: token lưu sẵn + refresh lỗi kết nối ⇒ Đăng nhập, store rỗng |
| 2 | D9, biên "secure storage hỏng" | Chưa có ca app | ✅ keystore ném ⇒ Đăng nhập, 0 request, không exception |
| 3 | AC-16, biên "đăng xuất khi mạng hỏng" | Chỉ có ở port | ✅ app: Đăng xuất khi mạng tắt ⇒ về Đăng nhập, store + access rỗng |
| 4 | AC-4 "refresh hỏng ⇒ về Đăng nhập" | Ca app tự tăng notifier bằng tay | ✅ app đã đăng nhập, `GET /me` 401, refresh bị từ chối ⇒ transport tự đưa app về Đăng nhập; expired = 1; lỗi mang message của envelope refresh |
| 5 | D11 | `_restore` ném lỗi chưa có ca riêng (xem mục đột biến) | ✅ port có `restoreSession` ném lỗi ⇒ Đăng nhập, không kẹt skeleton |
| 6 | AC-15 | Login mất mạng chỉ thử bằng `FakeAuthPort` | ✅ `login_screen_test`: stack HTTP thật, lỗi kết nối ⇒ Banner `kNetworkErrorMessage`, không lưu gì, nút bật lại |
| 7 | AC-15 (Completion Notes: "mật khẩu không trim") | Chưa có test | ✅ mật khẩu `' pass word '` gửi nguyên văn, chỉ email bị trim |
| 8 | AC-3/4/5 trên dây | Không có test qua socket | ✅ `http_stack_loopback_test.dart` (4 ca, xem dưới) |

## Đột biến kiểm ca mới (sao lưu bằng `cp`, không `git checkout`, đã khôi phục — `cmp` khớp; chạy bằng mảng zsh)

| Mutant | Ca ĐỎ |
|---|---|
| `transport.dart` bỏ `_onSessionExpired?.call()` | lỗ 4, loopback restore |
| `login_screen.dart` luôn hiện `kGenericErrorMessage` | lỗ 6, ca 401 cũ |
| `login_screen.dart` gửi mật khẩu đã trim | lỗ 7 |
| `http_auth_port.dart` bỏ `finally clear()` của logout | lỗ 3, ca đăng xuất cũ, loopback |
| `transport.dart` không bỏ base path | loopback (2 ca) |
| `transport.dart` refresh hỏng không `clear()` | lỗ 1, lỗ 4, ca refresh bị từ chối cũ, loopback |
| `transport.dart` gắn sai Bearer | loopback (luồng chính) |
| `pns_app.dart` bỏ `catch` của `_restore` | lúc đầu **sống**, vì guard của `SessionStore` đỡ lỗi keystore trước (hai lớp phòng thủ). Thêm lỗ 5 ⇒ ĐỎ |
| `session_store.dart` bỏ try/catch của `readRefreshToken` | sống ở 3 file mới vì `catch` của `PnsApp` đỡ; `session_store_test` cũ ĐỎ ⇒ đã có test canh |

Lần chạy đầu ra ĐỎ giả: zsh không tách từ `$T` (memory `zsh-command-var-no-word-split`). Em đã chạy lại bằng mảng và in tên từng ca ĐỎ.

## Test theo file (mới / sửa)

### API (socket thật) — `mobile/test/api/http_stack_loopback_test.dart` (MỚI, 4 ca)
- [x] sign in, an expired access token renewed + replayed, sign out — over a real socket (thứ tự 6 request + Bearer trên dây, refresh rotate)
- [x] wrong password ⇒ ApiError with the backend message, no refresh, nothing stored
- [x] restore at start-up trades the stored token; a revoked one signs out once
- [x] backend down ⇒ the network message, no status

### E2E app — `mobile/test/app/pns_app_test.dart` (7 → 12 ca)
- [x] backend unreachable at start-up ⇒ Đăng nhập, the stored token is dropped
- [x] unreadable secure storage at start-up ⇒ Đăng nhập, zero requests, no crash
- [x] Đăng xuất with the network down still returns to Đăng nhập and empties the store
- [x] signed in, a private call whose renewal is refused ⇒ the transport sends the app back to Đăng nhập
- [x] a restore that throws ⇒ Đăng nhập instead of a stuck skeleton

### Widget Đăng nhập — `mobile/test/screens/auth/login_screen_test.dart` (12 → 14 ca)
- [x] backend unreachable ⇒ banner shows the network message, nothing stored, button enabled again
- [x] the password is sent exactly as typed (only the email is trimmed)

## Độ phủ

- AC tự động hoá được (1–19, 21): đều có ca. AC-20 (smoke emulator) đã chạy tay lúc dev, không tự động hoá.
- Luồng auth của app: khởi động (không token / token hợp lệ / token bị từ chối / backend tắt / keystore hỏng / restore ném) 6/6 · đăng nhập (đúng / sai / mất mạng / busy / lỗi lạ) 5/5 · đăng xuất (thường / mất mạng) 2/2 · hết phiên (notifier / qua transport thật) 2/2.
- Route auth trên socket thật: `login`, `refresh`, `logout`, `me` 4/4. `forgot-password`, `reset-password`, `change-password` chưa nối ở mobile 10.6, nên chỉ đo ở `transport_test`.

## Checklist

- [x] Đã sinh test API (socket loopback) và E2E (widget app/màn), dùng API chuẩn của flutter_test
- [x] Có happy path và ca lỗi quan trọng (mất mạng, refresh bị từ chối, keystore hỏng)
- [x] Locator ngữ nghĩa (`find.text`, `find.widgetWithText(AppButton, …)`, `find.byType`)
- [x] Không chờ cứng: `_settle` là các nhịp `pump` trong fake-async (cùng helper dev đang dùng), không `sleep`
- [x] Các ca độc lập: mỗi ca dựng `_App`/server riêng, server loopback đóng ở `tearDown`
- [x] Toàn bộ lane mobile xanh

## Việc tiếp theo

- 10.7: khi `go_router` và màn đã đăng nhập có request riêng thật, lỗ 4 nên chuyển sang dùng request của màn thay cho `meControllerMe` gọi tay.
- Tự động hoá AC-20 bằng `integration_test` trên emulator cần lane CI có AVD. Hiện chưa có lane này, nên chưa làm.
