// Native Flutter widget tests for the Tạo báo giá screen (Story 4.1).
// Mirrors mobile/test/screens/customers/customer_screens_test.dart.
//
// These exist because mobile CAN run them (quyết định C-4): the web half of
// this story is guarded only by text (no tsc/bundler/JSDOM yet), but Flutter
// has a real widget harness — so the behaviour the text-guard cannot see gets
// asserted here: that the screen actually RENDERS, that picking a customer
// creates the order, that a catalogue line lands with the backend's numbers,
// that a non-priceEditable line offers NO price input, that deleting works, and
// that a backend rejection reaches the user in the BACKEND'S words.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_catalog_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/create_quote_screen.dart';

/// A port whose CREATE is refused — proves step 1 (the pick screen) surfaces
/// the backend's sentence instead of failing silently.
class _RejectingCreatePort extends FakeOrdersPort {
  _RejectingCreatePort(this.error);

  final OrderPortException error;

  @override
  Future<Order> create(CreateOrderInput input) async => throw error;
}

/// A port whose PREVIEW is refused — proves a failed preview drops the totals
/// back to "—" (never a stale number) while the cart lines stay intact.
class _RejectingPreviewPort extends FakeOrdersPort {
  _RejectingPreviewPort(this.error);

  final OrderPortException error;

  @override
  Future<OrderTotals> previewTotal(PreviewTotalInput input) async =>
      throw error;
}

/// A port whose PREVIEW never resolves until the test says so — the only way
/// to replay the race the `_latestTotals` ticket exists for: an OLDER preview
/// response landing AFTER a newer one must be thrown away, not rendered.
class _ManualPreviewPort extends FakeOrdersPort {
  final List<Completer<OrderTotals>> pendingPreviews =
      <Completer<OrderTotals>>[];

  @override
  Future<OrderTotals> previewTotal(PreviewTotalInput input) {
    final Completer<OrderTotals> completer = Completer<OrderTotals>();
    pendingPreviews.add(completer);
    return completer.future;
  }
}

/// A port whose line UPDATE is refused the way the real backend refuses it —
/// with the AD-5 envelope. The only way to prove the screen shows the BACKEND'S
/// sentence, not one it invented.
class _RejectingUpdatePort extends FakeOrdersPort {
  _RejectingUpdatePort(this.error);

  final OrderPortException error;

  @override
  Future<OrderLine> updateLine(
    String orderId,
    String lineId,
    UpdateOrderLineInput input,
  ) async =>
      throw error;
}

Widget _host(Widget screen) => MaterialApp(home: Scaffold(body: screen));

Future<void> _tap(WidgetTester tester, String label) async {
  final finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Drive step 1 (chọn khách qua tra SĐT — the reused Story 3.4 flow) through to
/// the cart step, using a demo customer the fake port already knows.
Future<void> _pickDemoCustomer(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField).first, '0903176968');
  await _tap(tester, 'Tra cứu');
  await _tap(tester, 'Dùng khách này');
}

CreateQuoteScreen _screen({FakeOrdersPort? ordersPort}) => CreateQuoteScreen(
      ordersPort: ordersPort ?? FakeOrdersPort(),
      catalogPort: FakeCatalogPort(),
      customersPort: FakeCustomersPort(),
    );

void main() {
  group('CreateQuoteScreen (Story 4.1)', () {
    testWidgets(
        'renders: step 1 is the reused pick screen, chọn khách → giỏ hàng rỗng',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();

      // Step 1 IS the CustomerPickScreen (its own shell — no nested shells).
      expect(find.text('Tra cứu theo số điện thoại'), findsWidgets);

      await _pickDemoCustomer(tester);

      // Step 2: the quote shell + the exact empty copy + placeholder totals.
      expect(find.text('Tạo báo giá'), findsOneWidget);
      expect(
        find.text('Chưa có dòng nào. Thêm dòng đầu tiên để bắt đầu.'),
        findsOneWidget,
      );
      expect(find.text('Nguyễn Văn A'), findsOneWidget);
      expect(find.text('Tổng trước VAT'), findsOneWidget);
      expect(find.text('Tiền VAT'), findsOneWidget);
      expect(find.text('Tổng sau VAT'), findsOneWidget);
      // Giỏ rỗng vẫn preview được: fake-backend trả 0/0/0 và màn hiển thị
      // NGUYÊN VĂN — không còn "—" nào (preview đã chạy ngay sau create).
      expect(find.text('—'), findsNothing);
      expect(find.text('0'), findsNWidgets(3));
    });

    testWidgets(
        'tổng preview: 3 số của FAKE-BACKEND trả, màn không nhân/cộng gì',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm'); // Tấm pin JA Solar 580W — 2_450_000
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // qty 1 → 5: subtotal 12_250_000, VAT 8% = 980_000, total 13_230_000 —
      // ba con số do PORT trả; số kỳ vọng tính tay ghi thẳng, không tautology.
      await tester.enterText(find.widgetWithText(TextField, '1').first, '5');
      await tester.pumpAndSettle();

      expect(find.text('12250000'), findsWidgets);
      expect(find.text('980000'), findsOneWidget);
      expect(find.text('13230000'), findsOneWidget);
      expect(find.text('—'), findsNothing);
    });

    testWidgets(
        'preview lỗi: totals về "—", dòng giỏ VẪN CÒN, message backend nguyên văn',
        (WidgetTester tester) async {
      const String backendSentence = 'Dữ liệu không hợp lệ';
      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingPreviewPort(
          const OrderPortException(backendSentence),
        ),
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // Khu tổng về "—" (không hiển thị số cũ đã sai) — giỏ không mất dòng nào.
      expect(find.text('—'), findsNWidgets(3));
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      expect(find.text(backendSentence), findsOneWidget);
    });

    testWidgets('sửa qty → totals đổi theo response preview mới',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // qty 1: subtotal 2_450_000, VAT 196_000, total 2_646_000.
      expect(find.text('196000'), findsOneWidget);
      expect(find.text('2646000'), findsOneWidget);

      // qty 1 → 2: preview mới 4_900_000 / 392_000 / 5_292_000 — số cũ biến mất.
      await tester.enterText(find.widgetWithText(TextField, '1').first, '2');
      await tester.pumpAndSettle();

      expect(find.text('4900000'), findsWidgets);
      expect(find.text('392000'), findsOneWidget);
      expect(find.text('5292000'), findsOneWidget);
      expect(find.text('196000'), findsNothing);
    });

    testWidgets(
        'race preview: response CŨ về SAU response mới bị vứt — tổng mới không bị đè',
        (WidgetTester tester) async {
      final _ManualPreviewPort port = _ManualPreviewPort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // Sửa qty 1 → 2 khi các preview trước vẫn còn treo trên đường về.
      await tester.enterText(find.widgetWithText(TextField, '1').first, '2');
      await tester.pumpAndSettle();

      // 3 preview đã bắn (sau tạo đơn, sau thêm dòng, sau sửa qty) — chưa cái
      // nào về nên khu tổng vẫn "—".
      expect(port.pendingPreviews, hasLength(3));
      expect(find.text('—'), findsNWidgets(3));

      // Preview MỚI NHẤT (qty 2) về TRƯỚC.
      port.pendingPreviews[2].complete(const OrderTotals(
          subtotal: 4900000, vatAmount: 392000, total: 5292000));
      // Hai preview kia còn treo nhưng không giữ frame nào — settle an toàn.
      await tester.pumpAndSettle();
      expect(find.text('5292000'), findsOneWidget);

      // Hai preview CŨ về TRỄ (1 dòng qty 1, rồi giỏ rỗng) — ticket phải vứt
      // cả hai, số mới giữ nguyên trên màn.
      port.pendingPreviews[1].complete(const OrderTotals(
          subtotal: 2450000, vatAmount: 196000, total: 2646000));
      port.pendingPreviews[0]
          .complete(const OrderTotals(subtotal: 0, vatAmount: 0, total: 0));
      await tester.pumpAndSettle();

      expect(find.text('5292000'), findsOneWidget);
      expect(find.text('392000'), findsOneWidget);
      expect(find.text('2646000'), findsNothing);
      expect(find.text('196000'), findsNothing);
      // Không quay về "—", không về 0 — mọi response trễ đều bị vứt sạch.
      expect(find.text('—'), findsNothing);
    });

    testWidgets(
        'thêm dòng catalog: giá backend auto-điền, amount là số backend trả',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm'); // first product row: Tấm pin JA Solar 580W

      // Close the sheet (tap the barrier above it) and look at the cart.
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      // qty 1 → amount = the FAKE-BACKEND's number, rendered as-is.
      expect(find.text('2450000'), findsWidgets);
    });

    testWidgets(
        'dòng priceEditable=false: sửa được SL nhưng KHÔNG có input đơn giá',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // The qty cell is an editable field ('1'); the price cell is TEXT — no
      // input carries the price value.
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(TextField, '2450000'), findsNothing);
      expect(find.text('2450000'), findsWidgets);
    });

    testWidgets(
        'dòng tự do: form trong Sheet, thêm xong hiện đúng tên nhiều dòng',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Dòng tự do');
      await tester.enterText(
        find.widgetWithText(TextField, '').first,
        'Vệ sinh mái trước lắp',
      );
      // Đơn giá: the form's controllers pre-fill qty=1 / price=0.
      await _tap(tester, 'Thêm dòng');

      expect(find.text('Vệ sinh mái trước lắp'), findsOneWidget);
      // Free line IS price-editable: both qty ('1') and price ('0') are inputs.
      expect(find.widgetWithText(TextField, '0'), findsOneWidget);
    });

    testWidgets(
        'gói vật tư: tick item thành dòng thường; item ngừng bán bị disabled',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn gói vật tư');
      await _tap(tester, 'Mở checklist');

      // Tick one live item → one ordinary line pointing at the real Product.
      await tester.tap(find.text('Tấm pin JA Solar 580W · tấm'));
      await tester.pumpAndSettle();
      // Tap the DISABLED (inactive product) item → nothing is added.
      await tester.tap(find.text('Tấm pin đời cũ (ngừng bán) · tấm'));
      await tester.pumpAndSettle();

      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      expect(find.text('Tấm pin đời cũ (ngừng bán)'), findsNothing);
    });

    testWidgets(
        'sửa số lượng thành công: amount mới là số fake-backend trả, không phải màn tự nhân',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // qty 1 → 5: port trả dòng mới với amount do "backend" (fake port) tính.
      await tester.enterText(find.widgetWithText(TextField, '1').first, '5');
      await tester.pumpAndSettle();

      expect(find.text('12250000'), findsWidgets); // 5 × 2450000 — số của port
      expect(find.text('Thử lại'), findsNothing); // không rơi vào nhánh lỗi
    });

    testWidgets('xoá dòng (swipe) → giỏ quay về trạng thái rỗng',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);

      await tester.drag(
          find.byType(Dismissible).first, const Offset(-500.0, 0.0));
      await tester.pumpAndSettle();

      expect(find.text('Tấm pin JA Solar 580W'), findsNothing);
      expect(
        find.text('Chưa có dòng nào. Thêm dòng đầu tiên để bắt đầu.'),
        findsOneWidget,
      );
    });

    testWidgets(
        'tạo đơn fail ở bước 1: MESSAGE BACKEND hiện ngay trên màn pick, không im lặng',
        (WidgetTester tester) async {
      const String backendSentence = 'Không tìm thấy khách hàng: +84903176968';
      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingCreatePort(
          const OrderPortException(backendSentence),
        ),
      )));
      await tester.pumpAndSettle();

      await _pickDemoCustomer(tester);

      // Vẫn ở bước 1 (màn pick) — và câu của backend hiện nguyên văn.
      expect(find.text('Tra cứu theo số điện thoại'), findsWidgets);
      expect(find.text(backendSentence), findsOneWidget);
    });

    testWidgets(
        'lỗi port hiển thị MESSAGE BACKEND nguyên văn + dòng đã nhập không mất',
        (WidgetTester tester) async {
      const String backendSentence =
          'Chỉ sửa được dòng khi đơn còn ở trạng thái Báo giá.';
      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingUpdatePort(
          const OrderPortException(backendSentence),
        ),
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // Edit qty → the port refuses with the AD-5 envelope.
      await tester.enterText(find.widgetWithText(TextField, '1').first, '5');
      await tester.pumpAndSettle();

      // The BACKEND'S sentence, verbatim — and a retry affordance.
      expect(find.text(backendSentence), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);
      // The entered line is still there — a failure never wipes the cart.
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
    });
  });
}
