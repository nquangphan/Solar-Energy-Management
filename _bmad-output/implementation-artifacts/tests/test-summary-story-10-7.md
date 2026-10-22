# Tóm tắt kiểm thử tự động — Story 10.7 (Mobile: điều hướng và adapter danh mục, khách, tài khoản)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** mobile flutter_test (widget test toàn app qua `TestApp` = adapter HTTP thật + `Transport` thật + `FakeAdapter` thay socket); không có API backend mới (backend không đổi trong story)
**Kết quả:** mobile `flutter analyze` sạch · `flutter test` **604/604** xanh (+4 so với 600 lúc dev). Các lane khác không bị đụng (chỉ sửa 2 file test mobile).

## Phạm vi

Đã rà 17 AC với test dev đã viết: 5 adapter (`test/api/http_{me,password,customers,catalog,warranty}_port_test.dart`), `transport_test.dart` (thế hệ phiên), `app_routes_test.dart`, `signed_in_app_test.dart`, `composition_root_test.dart`, `pns_app_test.dart`, `menu_screen_test.dart`, `app_bottom_nav_scope_test.dart`, `filter_nav_test.dart`, guard design-system (`menu-nav-parity`, `mobile-contract-types`, parity warranty, customers).

Tầng adapter, guard, Menu, bottom-nav scope và phần lớn router đã phủ kỹ (dev đã chạy mutation). Lỗ nằm ở các **luồng người dùng đầu-cuối qua router**. Smoke emulator (AC-15 ii, iv) đã đi qua các luồng này bằng tay, nhưng chưa có test tự động nào giữ chúng:
- Tạo khách qua router (`+ Thêm khách` ⇒ `/customers/lookup` ⇒ tạo ⇒ chi tiết khách mới): route `/customers/lookup` phải khai **trước** `/customers/:phone`. Nếu ai đó đảo thứ tự, "lookup" sẽ bị hiểu là một SĐT. Không test nào bắt lỗi này.
- Trùng SĐT khi tạo qua adapter thật: có test ở mức màn (port giả) và mức adapter, nhưng chưa có test nối hai đầu: 409 ⇒ `CustomerPortException` ⇒ câu backend hiện dưới ô SĐT.
- Hồ sơ qua router: chưa có test cho việc hiện danh tính `/me` mà không gọi `/me` lần hai, và việc đổi mật khẩu đi qua `HttpPasswordPort` với Bearer.
- `isOpenable` thuần chưa có ca cho path bảo hành (chỉ có ca khách hàng).

## Lỗ tìm được và đã vá

| # | AC | Lỗ | Đã vá |
|---|----|-----|-------|
| 1 | AC-8, AC-15(ii) | Luồng tạo khách qua router + thứ tự route `lookup` / `:phone` | ✅ widget: Khách hàng → `+ Thêm khách` (location `/customers/lookup`, màn pick, 0 request lookup) → tra `0903 555 777` (query thô) → Tạo khách → `POST /customers` đúng phone/name/sourceId → chi tiết ở `/customers/%2B84903555777`, `GET` đúng 1 lần |
| 2 | AC-7, AC-15(ii) | 409 trùng SĐT nối đầu-cuối qua adapter thật | ✅ widget: câu `fieldErrors.phone` nguyên văn nằm dưới ô SĐT (trên nút Tra cứu), banner `message` nguyên văn, vẫn ở `/customers/lookup`, không mở chi tiết, đúng 1 POST |
| 3 | AC-2, AC-15(iv) | Hồ sơ qua router: danh tính + đổi mật khẩu | ✅ widget: Menu → Hồ sơ hiện `Người A` / `a@pns.solar`, số lần gọi `/me` không tăng; Cập nhật mật khẩu ⇒ `POST /auth/change-password` có `Bearer access-a`, body `{currentPassword,newPassword}`, banner thành công |
| 4 | AC-8 | `isOpenable('/warranty')` chưa có ca thuần | ✅ unit: mở được với `orders.view_own` hoặc `orders.view_all`; không mở với `customers.manage` hay khi không có quyền |

## Đột biến kiểm ca mới (sao lưu bằng `cp` ở scratchpad, không `git checkout`, đã khôi phục — `diff` khớp)

| Mutant | Kết quả |
|---|---|
| `signed_in_app.dart`: đặt route `/customers/lookup` **sau** `/customers/:phone` | ĐỎ (lỗ 1 + ca trùng SĐT; 2 ca hỏng) |
| `http_customers_port.dart`: `_call` ném nguyên `ApiError` | ĐỎ (lỗ 2) |
| `app_menu_nav.dart`: `requiresAny` của warranty thêm `customersManage` | ĐỎ (lỗ 4) |

Lỗ 3 không đột biến: route `/profile` chỉ có một cách nối port. Một mutant thay port sẽ không biên dịch được (memory `mutation-must-compile-or-false-red`).

## Test theo file (phần mới / sửa)

### E2E (widget toàn app) — `mobile/test/app/signed_in_app_test.dart` (10 → 13 ca)
- [x] + Thêm khách → an unknown phone → create → the new customer's detail, over the real adapters
- [x] a duplicate phone on create shows the backend sentence under SĐT, and stays on the form
- [x] Hồ sơ shows the /me identity and Cập nhật mật khẩu posts through the password adapter
- helper `_tapButton` (ensureVisible + tap + chờ điều hướng)

### Unit — `mobile/test/app/app_routes_test.dart` (+1 ca)
- [x] isOpenable: the warranty path follows either order read key, never customers.manage

## Coverage (theo AC)

- AC-1…AC-14, AC-16: có test tự động (dev + QA). AC-15 (smoke emulator) chạy tay, đã ghi trong Dev Agent Record. Phần (ii) và (iv) của AC-15 giờ có thêm test tự động.
- Route có màn trong router: 6/6 có test widget (`/menu`, `/customers`, `/customers/lookup`, `/customers/:phone`, `/warranty`, `/profile`).
- Adapter: 5/5 có ca thành công + ca lỗi envelope. 4/5 được dùng qua router; catalog chưa nối, để dành cho 10.8.

## Checklist

- [x] API tests: không áp dụng. Backend không đổi; lớp HTTP mobile đã có test adapter qua `FakeAdapter`.
- [x] E2E tests cho UI: luồng tạo khách, trùng SĐT, Hồ sơ.
- [x] Dùng API chuẩn của `flutter_test`; locator theo chữ hiển thị, kiểu widget và `AppButton` có nhãn.
- [x] Mỗi luồng có ca thành công và ca lỗi quan trọng (409).
- [x] Không dùng sleep cứng: `settle` bước 10ms là cơ chế chuẩn của harness cho timer thật của Dio, cộng thêm `pumpAndSettle`.
- [x] Các test độc lập: mỗi test dựng `TestApp` riêng.
- [x] Đã tạo summary.

## Bước tiếp

- 10.8: thêm ca đầu-cuối cho tab Đơn hàng/Kho/FAB khi nối `HttpCatalogPort` và `CreateQuoteScreen`.
