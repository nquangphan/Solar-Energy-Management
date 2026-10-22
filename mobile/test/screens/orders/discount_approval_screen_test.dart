// Native Flutter widget tests for the Duyệt chiết khấu screen (Story 4.7).
// Mirrors mobile/test/screens/orders/create_quote_screen_test.dart (C-4: web
// is text-guarded only, Flutter has a real widget harness — so the behaviour
// the text-guard cannot see gets asserted here): the list renders from the
// port, the detail shows THE PORT'S numbers (margin "X%" / "—"), approving
// sends exactly one resolveDiscount, rejecting without a reason NEVER calls
// the port, a port failure surfaces the backend's sentence without wiping
// state, and an empty list shows the EmptyState.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/discount_approval_screen.dart';

/// A port that RECORDS every resolveDiscount call — proves each decision sends
/// exactly one call with the right approve/reason, and none when blocked.
class _RecordingResolvePort extends FakeOrdersPort {
  final List<ResolveDiscountInput> resolveCalls = <ResolveDiscountInput>[];

  @override
  Future<Order> resolveDiscount(String orderId, ResolveDiscountInput input) {
    resolveCalls.add(input);
    return super.resolveDiscount(orderId, input);
  }
}

/// A port whose RESOLVE is refused with the AD-5 envelope — proves a failed
/// decision surfaces the backend's sentence, keeps the list AND the selection
/// intact (invariant k).
class _RejectingResolvePort extends FakeOrdersPort {
  _RejectingResolvePort(this.error);

  final OrderPortException error;

  @override
  Future<Order> resolveDiscount(
    String orderId,
    ResolveDiscountInput input,
  ) async =>
      throw error;
}

/// Seed the fake with ONE order awaiting discount approval: a catalogue line
/// (demo margin 20%) + a free line (margin null → "—"), discount 1_000_000.
/// subtotal = 2×2_450_000 + 500_000 = 5_400_000; afterDiscount = 4_400_000 —
/// all numbers the FAKE-BACKEND computes, the screen renders them as-is.
Future<T> _seedPendingDiscount<T extends FakeOrdersPort>(T port) async {
  final Order order =
      await port.create(const CreateOrderInput(customerPhone: '0903176968'));
  await port.addLine(
    order.id,
    const AddOrderLineInput(productId: 'prod-pin-580', qty: 2),
  );
  await port.addLine(
    order.id,
    const AddOrderLineInput(
      name: 'Vệ sinh mái trước lắp',
      unit: 'gói',
      qty: 1,
      unitPrice: 500000,
    ),
  );
  await port.applyDiscount(
    order.id,
    const ApplyDiscountInput(amount: 1000000, note: 'Khách quen'),
  );
  return port;
}

Widget _host(Widget screen) => MaterialApp(home: Scaffold(body: screen));

Future<void> _tap(WidgetTester tester, String label) async {
  final finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Open the detail panel by tapping the (single) pending row.
Future<void> _chonItem(WidgetTester tester) async {
  final finder = find.text('ord-demo-1');
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  group('DiscountApprovalScreen (Story 4.7)', () {
    testWidgets(
        'list render từ fake + chọn item → chi tiết đúng SỐ PORT TRẢ (Giá gốc/Chiết khấu/Sau chiết khấu, margin "20%" và "—")',
        (WidgetTester tester) async {
      final FakeOrdersPort port = await _seedPendingDiscount(FakeOrdersPort());
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      await tester.pumpAndSettle();

      // Danh sách: đơn·khách / mức giảm / người đề xuất / chip "Chờ duyệt"
      // (label canonical của key choduyet — không label ad-hoc).
      expect(find.text('Duyệt chiết khấu'), findsOneWidget);
      expect(find.text('ord-demo-1'), findsOneWidget);
      expect(find.text('1.000.000 đ'), findsOneWidget);
      expect(find.text('Nhân viên demo'), findsOneWidget);
      expect(find.text('Chờ duyệt'), findsOneWidget);

      await _chonItem(tester);

      // Panel chi tiết: 3 con số backend + bảng dòng kèm cột Biên ước tính.
      expect(find.text('Giá gốc'), findsOneWidget);
      expect(find.text('5.400.000 đ'), findsOneWidget);
      expect(find.text('Sau chiết khấu'), findsOneWidget);
      expect(find.text('4.400.000 đ'), findsOneWidget);
      // Header AppTable render label UPPERCASE — label nguồn vẫn byte-identical
      // 'Biên ước tính' (guard quét source), text render là bản hoa.
      expect(find.text('BIÊN ƯỚC TÍNH'), findsOneWidget);
      // Dòng catalog: margin demo tĩnh 20% — render nguyên văn "20%"; dòng tự
      // do: null → "—" (fence FR-37 cùng hợp đồng nullability).
      expect(find.text('20%'), findsOneWidget);
      expect(find.text('—'), findsOneWidget);
      expect(find.text('Ước tính theo giá vốn hiện tại — chưa xuất kho.'),
          findsOneWidget);
      expect(find.text('Lý do đề xuất'), findsOneWidget);
      expect(find.text('Khách quen'), findsOneWidget);
    });

    testWidgets(
        'Đồng ý: dialog hệ quả → xác nhận → fake nhận resolveDiscount(approve true) đúng 1 lần, item rời danh sách',
        (WidgetTester tester) async {
      final _RecordingResolvePort port =
          await _seedPendingDiscount(_RecordingResolvePort());
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _chonItem(tester);

      await _tap(tester, 'Đồng ý chiết khấu');
      // Dialog nêu hệ quả — đúng nguyên văn nhãn chung 2 nền tảng.
      expect(
        find.text(
            'Đồng ý chiết khấu cho phép chốt đơn với giá đã giảm; thao tác được ghi Audit log.'),
        findsOneWidget,
      );
      await _tap(tester, 'Xác nhận');

      expect(port.resolveCalls, hasLength(1));
      expect(port.resolveCalls.single.approve, isTrue);
      // Đơn không còn pending — danh sách reload rỗng, panel chi tiết đóng.
      expect(find.text('ord-demo-1'), findsNothing);
      expect(
          find.text('Không có chiết khấu nào đang chờ duyệt.'), findsOneWidget);
    });

    testWidgets(
        'Từ chối: THIẾU lý do → chặn tại chỗ, KHÔNG gọi port; CÓ lý do → fake nhận approve false + reason',
        (WidgetTester tester) async {
      final _RecordingResolvePort port =
          await _seedPendingDiscount(_RecordingResolvePort());
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _chonItem(tester);

      // Thiếu lý do: fieldError hiển thị, KHÔNG dialog, KHÔNG call nào bay đi.
      await _tap(tester, 'Từ chối');
      expect(find.text('Lý do là bắt buộc khi từ chối chiết khấu.'),
          findsOneWidget);
      expect(port.resolveCalls, isEmpty);

      // Có lý do: dialog hệ quả (tone danger) → xác nhận → đúng 1 call.
      await tester.enterText(find.byType(TextField), 'Biên quá mỏng');
      await _tap(tester, 'Từ chối');
      expect(
        find.text(
            'Từ chối sẽ trả đơn về Báo giá; lý do từ chối được ghi Audit log.'),
        findsOneWidget,
      );
      await _tap(tester, 'Xác nhận');

      expect(port.resolveCalls, hasLength(1));
      expect(port.resolveCalls.single.approve, isFalse);
      expect(port.resolveCalls.single.reason, 'Biên quá mỏng');
      // Đơn về baogia — không còn pending, danh sách rỗng.
      expect(
          find.text('Không có chiết khấu nào đang chờ duyệt.'), findsOneWidget);
    });

    testWidgets(
        'port throw → banner MESSAGE BACKEND nguyên văn, danh sách + panel chi tiết còn NGUYÊN (bất biến k)',
        (WidgetTester tester) async {
      const String backendSentence = 'Đơn không có chiết khấu chờ duyệt.';
      final _RejectingResolvePort port = await _seedPendingDiscount(
        _RejectingResolvePort(const OrderPortException(backendSentence)),
      );
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _chonItem(tester);

      await _tap(tester, 'Đồng ý chiết khấu');
      await _tap(tester, 'Xác nhận');

      // Câu backend nguyên văn; item VẪN trong danh sách; panel VẪN mở.
      expect(find.text(backendSentence), findsOneWidget);
      expect(find.text('ord-demo-1'), findsWidgets);
      expect(find.text('Giá gốc'), findsOneWidget);
      expect(
          find.widgetWithText(AppButton, 'Đồng ý chiết khấu'), findsOneWidget);
    });

    testWidgets('danh sách rỗng → EmptyState', (WidgetTester tester) async {
      await tester.pumpWidget(
          _host(DiscountApprovalScreen(ordersPort: FakeOrdersPort())));
      await tester.pumpAndSettle();

      expect(
          find.text('Không có chiết khấu nào đang chờ duyệt.'), findsOneWidget);
      expect(find.byType(AppEmptyState), findsOneWidget);
    });
  });
}
