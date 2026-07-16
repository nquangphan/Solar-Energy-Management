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

/// A port whose SCOPE PATCH is refused with the AD-5 envelope — proves a failed
/// toggle surfaces the backend's sentence and never wipes the cart (Story 4.3).
class _RejectingScopePort extends FakeOrdersPort {
  _RejectingScopePort(this.error);

  final OrderPortException error;

  @override
  Future<Order> updateScopeFlags(
    String orderId,
    UpdateScopeFlagsInput input,
  ) async =>
      throw error;
}

/// A port that RECORDS every scope PATCH — proves the toggle sends exactly the
/// one flag the user touched (partial input, Story 4.3).
class _RecordingScopePort extends FakeOrdersPort {
  final List<UpdateScopeFlagsInput> scopeCalls = <UpdateScopeFlagsInput>[];

  @override
  Future<Order> updateScopeFlags(
    String orderId,
    UpdateScopeFlagsInput input,
  ) {
    scopeCalls.add(input);
    return super.updateScopeFlags(orderId, input);
  }
}

/// A port that RECORDS every metadata PATCH (Story 4.4) — proves the VAT tick /
/// kWp / validity-note commits send exactly the field the user touched.
class _RecordingMetaPort extends FakeOrdersPort {
  final List<UpdateOrderMetaInput> metaCalls = <UpdateOrderMetaInput>[];

  @override
  Future<Order> updateOrderMeta(String orderId, UpdateOrderMetaInput input) {
    metaCalls.add(input);
    return super.updateOrderMeta(orderId, input);
  }
}

/// A port whose META PATCH is refused with the AD-5 envelope — proves a failed
/// VAT tick surfaces the backend's sentence, keeps the cart AND the old tick
/// state intact (Story 4.4, invariant k).
class _RejectingMetaPort extends FakeOrdersPort {
  _RejectingMetaPort(this.error);

  final OrderPortException error;

  @override
  Future<Order> updateOrderMeta(
    String orderId,
    UpdateOrderMetaInput input,
  ) async =>
      throw error;
}

Widget _host(Widget screen) => MaterialApp(home: Scaffold(body: screen));

/// The rendered on/off state of the scope chip with [label].
bool _flagOn(WidgetTester tester, String label) => tester
    .widgetList<AppScopeFlag>(find.byType(AppScopeFlag))
    .firstWhere((AppScopeFlag f) => f.label == label)
    .on;

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
      // 4 dấu: 3 hàng tổng + ô thuế suất % cạnh tick "Tính VAT" (4.4).
      expect(find.text('—'), findsNWidgets(4));
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
      // nào về nên khu tổng vẫn "—" (3 hàng tổng + ô thuế suất %, 4.4).
      expect(port.pendingPreviews, hasLength(3));
      expect(find.text('—'), findsNWidgets(4));

      // Preview MỚI NHẤT (qty 2) về TRƯỚC.
      port.pendingPreviews[2].complete(const OrderTotals(
          subtotal: 4900000,
          vatAmount: 392000,
          total: 5292000,
          vatRate: 8,
          applyVat: true));
      // Hai preview kia còn treo nhưng không giữ frame nào — settle an toàn.
      await tester.pumpAndSettle();
      expect(find.text('5292000'), findsOneWidget);

      // Hai preview CŨ về TRỄ (1 dòng qty 1, rồi giỏ rỗng) — ticket phải vứt
      // cả hai, số mới giữ nguyên trên màn.
      port.pendingPreviews[1].complete(const OrderTotals(
          subtotal: 2450000,
          vatAmount: 196000,
          total: 2646000,
          vatRate: 8,
          applyVat: true));
      port.pendingPreviews[0].complete(const OrderTotals(
          subtotal: 0, vatAmount: 0, total: 0, vatRate: 8, applyVat: true));
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
      // Scope vào Sheet: card khách giờ cũng có 2 TextField rỗng (kWp/hiệu lực,
      // 4.4) nằm TRƯỚC trong cây — finder trần sẽ gõ nhầm vào chúng.
      await tester.enterText(
        find
            .descendant(
                of: find.byType(AppSheet), matching: find.byType(TextField))
            .first,
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

      // Card khách cao hơn từ 4.4 (2 input metadata) — kéo dòng vào tầm nhìn
      // trước khi swipe, kẻo drag trượt ngoài viewport (bài học tap-miss 4.3).
      await tester.ensureVisible(find.byType(Dismissible).first);
      await tester.pump();
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
        'cờ phạm vi (4.3): khách CA_NHAN → preset cả 3 chip on (Thiết bị/Thi công/Vận chuyển)',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester); // 0903176968 — demo CA_NHAN

      expect(find.text('Phạm vi'), findsOneWidget);
      expect(_flagOn(tester, 'Thiết bị'), isTrue);
      expect(_flagOn(tester, 'Thi công'), isTrue);
      expect(_flagOn(tester, 'Vận chuyển'), isTrue);
    });

    testWidgets('cờ phạm vi (4.3): khách THUONG_MAI → preset chỉ Thiết bị on',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      // 0912345678 — demo THUONG_MAI (Công ty TNHH Hoà Phát).
      await tester.enterText(find.byType(TextField).first, '0912345678');
      await _tap(tester, 'Tra cứu');
      await _tap(tester, 'Dùng khách này');

      expect(_flagOn(tester, 'Thiết bị'), isTrue);
      expect(_flagOn(tester, 'Thi công'), isFalse);
      expect(_flagOn(tester, 'Vận chuyển'), isFalse);
    });

    testWidgets(
        'cờ phạm vi (4.3): tap Checkbox Thi công → chip đổi on, fake nhận ĐÚNG một cờ partial',
        (WidgetTester tester) async {
      final _RecordingScopePort port = _RecordingScopePort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      // THUONG_MAI để Thi công khởi đầu OFF — tap bật lên mới nhìn thấy đổi chiều.
      await tester.enterText(find.byType(TextField).first, '0912345678');
      await _tap(tester, 'Tra cứu');
      await _tap(tester, 'Dùng khách này');
      expect(_flagOn(tester, 'Thi công'), isFalse);

      await tester.tap(find.widgetWithText(AppCheckbox, 'Thi công'));
      await tester.pumpAndSettle();

      expect(_flagOn(tester, 'Thi công'), isTrue);
      // Partial đúng nghĩa: CHỈ cờ user chạm đi ra port, cờ kia để null.
      expect(port.scopeCalls, hasLength(1));
      expect(port.scopeCalls.single.scopeThiCong, isTrue);
      expect(port.scopeCalls.single.scopeVanChuyen, isNull);
      // Cờ Thiết bị không suy suyển — và không có Checkbox nào để tắt nó.
      expect(_flagOn(tester, 'Thiết bị'), isTrue);
      expect(find.widgetWithText(AppCheckbox, 'Thiết bị'), findsNothing);
    });

    testWidgets(
        'cờ phạm vi (4.3): port throw → banner message backend, chip giữ state cũ, giỏ còn nguyên',
        (WidgetTester tester) async {
      const String backendSentence =
          'Chỉ sửa được dòng khi đơn còn ở trạng thái Báo giá.';
      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingScopePort(
          const OrderPortException(backendSentence),
        ),
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // CA_NHAN: Thi công đang ON — tap tắt nhưng port từ chối. (Viewport có
      // thể đã cuộn tới nút picker — kéo checkbox vào tầm nhìn trước khi tap.)
      expect(_flagOn(tester, 'Thi công'), isTrue);
      final Finder thiCongToggle = find.widgetWithText(AppCheckbox, 'Thi công');
      await tester.ensureVisible(thiCongToggle);
      await tester.pump();
      await tester.tap(thiCongToggle);
      await tester.pumpAndSettle();

      // Câu của backend nguyên văn; chip KHÔNG đổi; dòng giỏ KHÔNG mất.
      expect(find.text(backendSentence), findsOneWidget);
      expect(_flagOn(tester, 'Thi công'), isTrue);
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
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

    testWidgets(
        'tick VAT (4.4): untick "Tính VAT" → fake nhận vatMode khong_vat, totals hiện VAT 0',
        (WidgetTester tester) async {
      final _RecordingMetaPort port = _RecordingMetaPort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm'); // 2_450_000 × 1
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      // Trước khi untick: VAT 8% của fake-backend + nhãn % là GIÁ TRỊ backend.
      expect(find.text('196000'), findsOneWidget);
      expect(find.text('8%'), findsOneWidget);

      final Finder vatToggle = find.widgetWithText(AppCheckbox, 'Tính VAT');
      await tester.ensureVisible(vatToggle);
      await tester.pump();
      await tester.tap(vatToggle);
      await tester.pumpAndSettle();

      // Fake nhận ĐÚNG một field: vatMode 'khong_vat', kWp/validityNote vắng.
      expect(port.metaCalls, hasLength(1));
      expect(port.metaCalls.single.vatMode, 'khong_vat');
      expect(port.metaCalls.single.hasKWp, isFalse);
      expect(port.metaCalls.single.hasValidityNote, isFalse);
      // Preview mới echo vatMode mới: VAT 0, total = subtotal — tức thì.
      expect(find.text('196000'), findsNothing);
      expect(find.text('0'), findsOneWidget);
      expect(find.text('2450000'), findsWidgets);
    });

    testWidgets(
        'kWp (4.4): nhập "8,82" rồi rời focus → fake nhận 8.82 (chuyển đổi input, không số học tiền)',
        (WidgetTester tester) async {
      final _RecordingMetaPort port = _RecordingMetaPort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      // 2 TextField của card khách: kWp trước, hiệu lực sau (giỏ đang rỗng).
      final Finder kwpField = find.byType(TextField).at(0);
      await tester.ensureVisible(kwpField);
      await tester.pump();
      await tester.enterText(kwpField, '8,82');
      // Rời focus = commit (pattern commit-on-blur).
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      expect(port.metaCalls, hasLength(1));
      expect(port.metaCalls.single.hasKWp, isTrue);
      expect(port.metaCalls.single.kWp, 8.82);
      expect(port.metaCalls.single.vatMode, isNull);
    });

    testWidgets(
        'hiệu lực báo giá (4.4): nhập chuỗi rồi rời focus → fake nhận đúng chuỗi',
        (WidgetTester tester) async {
      final _RecordingMetaPort port = _RecordingMetaPort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      final Finder validityField = find.byType(TextField).at(1);
      await tester.ensureVisible(validityField);
      await tester.pump();
      await tester.enterText(validityField, '48h kể từ ngày lên PO');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      expect(port.metaCalls, hasLength(1));
      expect(port.metaCalls.single.hasValidityNote, isTrue);
      expect(port.metaCalls.single.validityNote, '48h kể từ ngày lên PO');
      expect(port.metaCalls.single.hasKWp, isFalse);
    });

    testWidgets(
        'tick VAT (4.4): tick LẠI sau khi untick → fake nhận co_vat, VAT quay về số fake-backend',
        (WidgetTester tester) async {
      final _RecordingMetaPort port = _RecordingMetaPort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm'); // 2_450_000 × 1
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      final Finder vatToggle = find.widgetWithText(AppCheckbox, 'Tính VAT');
      await tester.ensureVisible(vatToggle);
      await tester.pump();
      await tester.tap(vatToggle); // untick → khong_vat
      await tester.pumpAndSettle();
      expect(find.text('196000'), findsNothing);

      await tester.tap(vatToggle); // tick lại → co_vat
      await tester.pumpAndSettle();

      // Nhánh checked=true của handler: giá trị gửi đi là 'co_vat' đúng registry.
      expect(port.metaCalls, hasLength(2));
      expect(port.metaCalls.last.vatMode, 'co_vat');
      // Preview echo vatMode mới: VAT 8% của fake-backend hiện trở lại.
      expect(find.text('196000'), findsOneWidget);
      final AppCheckbox tick = tester.widget<AppCheckbox>(vatToggle);
      expect(tick.checked, isTrue);
    });

    testWidgets(
        'kWp (4.4): nhập rác "abc" rồi rời focus → báo lỗi field, KHÔNG gọi port',
        (WidgetTester tester) async {
      final _RecordingMetaPort port = _RecordingMetaPort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      final Finder kwpField = find.byType(TextField).at(0);
      await tester.ensureVisible(kwpField);
      await tester.pump();
      await tester.enterText(kwpField, 'abc');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      // Parse hỏng: giữ nguyên, báo lỗi tại field — KHÔNG có PATCH nào bay đi.
      expect(port.metaCalls, isEmpty);
      expect(find.text('Công suất phải là số (vd 8,82).'), findsOneWidget);
    });

    testWidgets(
        'kWp (4.4): xoá rỗng khi đã có giá trị → fake nhận kWp null (xoá, tri-state sentinel)',
        (WidgetTester tester) async {
      final _RecordingMetaPort port = _RecordingMetaPort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      final Finder kwpField = find.byType(TextField).at(0);
      await tester.ensureVisible(kwpField);
      await tester.pump();
      await tester.enterText(kwpField, '8,82');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      expect(port.metaCalls, hasLength(1));

      // Xoá sạch input rồi rời focus — PATCH kWp: null (xoá), không phải "bỏ qua".
      await tester.enterText(kwpField, '');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      expect(port.metaCalls, hasLength(2));
      expect(port.metaCalls.last.hasKWp, isTrue);
      expect(port.metaCalls.last.kWp, isNull);
    });

    testWidgets(
        'meta lỗi (4.4): port throw → banner message backend, giỏ còn nguyên, tick giữ state cũ',
        (WidgetTester tester) async {
      const String backendSentence =
          'Chỉ sửa được dòng khi đơn còn ở trạng thái Báo giá.';
      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingMetaPort(
          const OrderPortException(backendSentence),
        ),
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      final Finder vatToggle = find.widgetWithText(AppCheckbox, 'Tính VAT');
      await tester.ensureVisible(vatToggle);
      await tester.pump();
      await tester.tap(vatToggle);
      await tester.pumpAndSettle();

      // Câu backend nguyên văn; giỏ KHÔNG mất dòng; tick VẪN bật (state cũ).
      expect(find.text(backendSentence), findsOneWidget);
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      final AppCheckbox tick = tester.widget<AppCheckbox>(vatToggle);
      expect(tick.checked, isTrue);
    });
  });
}
