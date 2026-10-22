# Tóm tắt kiểm thử tự động — Story 10.8 (Mobile: adapter đơn, kho, tiền, chứng từ và nút chi tiết đơn theo quyền)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** mobile flutter_test (test adapter dùng `Transport` thật + `FakeAdapter`; widget test toàn app qua `TestApp` với backend giả có trạng thái). Story không thêm API backend nên không có test API backend mới.
**Kết quả:** mobile `flutter analyze` sạch · `flutter test` **735/735** xanh (+2 so với 733 lúc dev). Các lane khác không bị đụng vì chỉ sửa 2 file test mobile.

## Phạm vi

Đã đối chiếu AC-7 → AC-13 với test dev đã viết:
- 6 file test adapter `test/api/http_{orders,inventory,stock_vouchers,payments,contracts,invoices}_port_test.dart`, cộng `http_port_errors_test.dart` (phủ 42 method), `sparse_bodies_test.dart`, `build_mobile_spec_test.dart`.
- Router: `test/app/order_routes_test.dart` và `app_routes_test.dart`.
- Ca `$unknown` ở màn danh sách đơn, tồn kho và lịch thanh toán.

Phần lớn đã phủ kỹ: body thưa có 6+ ca so JSON chính xác; multipart có ca phát lại 401; tên file lấy từ metadata và có fallback; khoá idempotency; 3 nút theo quyền với cùng fixture; gate route con; tab và FAB; tải lại sau màn con; đăng xuất do hết phiên ở màn con (đã có ở `signed_in_app_test.dart`). Dev cũng đã chạy mutation AC-10/11g. Còn 2 lỗ sau.

## Lỗ tìm được và đã vá

| # | AC | Lỗ | Đã vá |
|---|----|-----|-------|
| 1 | AC-11 (D9 `InvoicesScreen.onOpenInvoice ⇒ orderInvoicePath`) | Route `/orders/:id/invoices/:invoiceId` chỉ có ca **bị chặn** (thiếu `invoices.manage`). Chưa ca nào bấm "Xem" để mở chi tiết hoá đơn, nên nếu nối sai `orderId`/`invoiceId` hoặc back không về danh sách hoá đơn thì không test nào thấy | ✅ widget: account đủ quyền mở đơn → Hoá đơn → Xem. Location là `/orders/o1/invoices/inv-1`, `InvoiceDetailScreen` nhận `orderId=o1` và `invoiceId=inv-1`. Back thì về `InvoicesScreen` ở `/orders/o1/invoices` |
| 2 | AC-8 (enum `$unknown` ⇒ nhãn trung tính, không crash) | Bước vòng đời `OrderLifecycleStepDto.status` là enum sinh và màn có nhánh `?? '—'`, nhưng chưa có test. Ba ca `$unknown` hiện có chỉ phủ danh sách đơn, tồn kho và lịch thanh toán | ✅ widget: lifecycle `['baogia', 'trang_thai_moi']` hiện "Báo giá" và đúng một "—" trong `AppStepper`, không có exception |

## Đột biến kiểm ca mới (sao lưu bằng `cp` vào scratchpad, không dùng `git checkout`; khôi phục xong `cmp` khớp)

| Mutant | Kết quả |
|---|---|
| `signed_in_app.dart`: `onOpenInvoice` đẩy `orderInvoicePath(id, 'inv-x')` (sai invoiceId) | ĐỎ (+12 −1, lỗ 1) |
| `order_detail_screen.dart`: nhãn bước `$unknown` từ `'—'` đổi thành `''` | ĐỎ (+19 −1, lỗ 2) |

## Test theo file (phần mới / sửa)

### E2E (widget toàn app) — `mobile/test/app/order_routes_test.dart` (12 → 13 ca)
- [x] Hoá đơn → Xem opens that invoice of this order; back returns to the invoice list
- Backend giả thêm route `GET /orders/o1/invoices/inv-1` → `invoiceDetailJson()`

### Widget màn — `mobile/test/screens/orders/order_detail_screen_test.dart` (+1 ca)
- [x] a lifecycle step this build does not know renders a neutral "—", no crash

## Coverage (AC dẫn xuất của story)

- Adapter: 6/6 port, 42/42 method có ca lỗi; mỗi method có ít nhất 1 ca thành công (AC-9 a–f)
- Router và 3 nút: AC-11 a–f đã phủ đủ, kể cả mở chi tiết hoá đơn qua route (mới)
- Enum `$unknown`: 4/4 nơi hiển thị (trạng thái đơn ở danh sách, bước vòng đời (mới), `stockStatus`, trạng thái đợt/lịch thanh toán)
- Composition root, guard design-system, spec dẫn xuất: đã phủ lúc dev, không đổi

## Không làm trong workflow này

- Không có E2E trên trình duyệt hay thiết bị tự động. Smoke emulator (AC-14) đã chạy tay lúc dev và ghi trong Dev Agent Record. Repo chưa có harness `integration_test` cho mobile.
- `design-system`, web và backend không bị đụng nên không chạy lại.

## Next Steps

- Chạy trong CI cùng lane mobile.
- Khi có harness `integration_test`, có thể tự động hoá các bước smoke AC-14.
