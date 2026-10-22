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
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/gating.dart';
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

/// Orders come back with a `vatMode` this build does not know; every preview
/// request is recorded.
class _UnknownVatPort extends FakeOrdersPort {
  final List<PreviewTotalInput> previews = <PreviewTotalInput>[];

  Order _unknownVat(Order o) => Order.fromJson(<String, Object?>{
        ...jsonDecode(jsonEncode(o.toJson())) as Map<String, Object?>,
        'vatMode': 'loai_moi',
      });

  @override
  Future<Order> create(CreateOrderInput input) async => _unknownVat(await super.create(input));

  @override
  Future<Order> get(String id) async => _unknownVat(await super.get(id));

  @override
  Future<OrderTotals> previewTotal(PreviewTotalInput input) {
    previews.add(input);
    return super.previewTotal(input);
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

/// A port that RECORDS every line UPDATE (Story 4.9) — proves the warranty edit
/// sends exactly the tri-state the user intended (a month value, or `null` to
/// clear), and that install/labour lines never reach it from the UI.
class _RecordingUpdatePort extends FakeOrdersPort {
  final List<UpdateOrderLineInput> updateCalls = <UpdateOrderLineInput>[];

  @override
  Future<OrderLine> updateLine(
    String orderId,
    String lineId,
    UpdateOrderLineInput input,
  ) {
    updateCalls.add(input);
    return super.updateLine(orderId, lineId, input);
  }
}

/// A port that RECORDS every confirm call (Story 4.5) — proves the Chốt dialog
/// sends exactly one confirmOrder with the right order id, and none on cancel.
class _RecordingConfirmPort extends FakeOrdersPort {
  final List<String> confirmCalls = <String>[];

  @override
  Future<Order> confirmOrder(String orderId) {
    confirmCalls.add(orderId);
    return super.confirmOrder(orderId);
  }
}

/// A port whose CONFIRM is refused with the AD-5 envelope — proves a failed
/// Chốt surfaces the backend's sentence, keeps the cart AND the editable state
/// intact (Story 4.5, invariant k).
class _RejectingConfirmPort extends FakeOrdersPort {
  _RejectingConfirmPort(this.error);

  final OrderPortException error;

  @override
  Future<Order> confirmOrder(String orderId) async => throw error;
}

/// A port that RECORDS every revise call (Story 4.6) — proves the Mở lại dialog
/// sends exactly one reviseOrder with the right order id, and none on cancel.
class _RecordingRevisePort extends FakeOrdersPort {
  final List<String> reviseCalls = <String>[];

  @override
  Future<Order> reviseOrder(String orderId) {
    reviseCalls.add(orderId);
    return super.reviseOrder(orderId);
  }
}

/// A port whose REVISE is refused with the AD-5 envelope — proves a failed Mở
/// lại surfaces the backend's sentence, keeps the frozen order state intact
/// (Story 4.6, invariant k).
class _RejectingRevisePort extends FakeOrdersPort {
  _RejectingRevisePort(this.error);

  final OrderPortException error;

  @override
  Future<Order> reviseOrder(String orderId) async => throw error;
}

/// A port that RECORDS every applyDiscount call (Story 4.7) — proves the Áp
/// chiết khấu dialog sends exactly one call with the entered amount/note.
class _RecordingApplyDiscountPort extends FakeOrdersPort {
  final List<ApplyDiscountInput> applyCalls = <ApplyDiscountInput>[];

  @override
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input) {
    applyCalls.add(input);
    return super.applyDiscount(orderId, input);
  }
}

/// A port whose APPLY DISCOUNT is refused with the AD-5 envelope — proves a
/// failed Áp chiết khấu surfaces the backend's sentence, keeps the cart AND
/// the editable state intact (Story 4.7, invariant k).
class _RejectingApplyDiscountPort extends FakeOrdersPort {
  _RejectingApplyDiscountPort(this.error);

  final OrderPortException error;

  @override
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input) async =>
      throw error;
}

/// A port that plays the APPROVER acting instantly (Story 4.7): applying comes
/// back already `dong_y` — the only way this screen (which owns no approve UI)
/// can be driven into the "được Chốt từ choduyet" state.
class _AutoApprovePort extends FakeOrdersPort {
  @override
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input) async {
    await super.applyDiscount(orderId, input);
    return super
        .resolveDiscount(orderId, const ResolveDiscountInput(approve: true));
  }
}

/// A port that plays the APPROVER rejecting instantly (Story 4.7): applying
/// comes back `tu_choi` + the reason — drives the "về baogia + banner lý do"
/// state without an approve UI on this screen.
class _AutoRejectPort extends FakeOrdersPort {
  @override
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input) async {
    await super.applyDiscount(orderId, input);
    return super.resolveDiscount(
      orderId,
      const ResolveDiscountInput(approve: false, reason: 'Biên quá mỏng'),
    );
  }
}

/// A port that RECORDS every exportQuote call (Story 4.8) — proves the share
/// button sends exactly one export for the right order, then hands the fake's
/// static demo files to the injected share fn.
class _RecordingExportPort extends FakeOrdersPort {
  final List<String> exportCalls = <String>[];

  @override
  Future<QuoteExportFiles> exportQuote(String orderId) {
    exportCalls.add(orderId);
    return super.exportQuote(orderId);
  }
}

/// A port whose EXPORT is refused with the AD-5 envelope — proves a failed
/// export surfaces the backend's sentence and keeps the cart/state intact
/// (Story 4.8, invariant k).
class _RejectingExportPort extends FakeOrdersPort {
  _RejectingExportPort(this.error);

  final OrderPortException error;

  @override
  Future<QuoteExportFiles> exportQuote(String orderId) async => throw error;
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

/// Drive the order to `dachot` through the fake's own confirm flow (Story 4.6
/// fixtures): add one catalogue line, then Chốt + xác nhận. Requires perms with
/// `ordersConfirm` so the Chốt button renders.
Future<void> _chotDonQuaFake(WidgetTester tester) async {
  await _tap(tester, 'Chọn từ danh mục');
  await _tap(tester, 'Thêm');
  await tester.tapAt(const Offset(10.0, 10.0));
  await tester.pumpAndSettle();
  await _tap(tester, 'Chốt báo giá');
  await _tap(tester, 'Xác nhận');
}

CreateQuoteScreen _screen({
  FakeOrdersPort? ordersPort,
  Set<PermissionKey> perms = const <PermissionKey>{},
  AppShareFn? shareImpl,
}) =>
    CreateQuoteScreen(
      ordersPort: ordersPort ?? FakeOrdersPort(),
      catalogPort: FakeCatalogPort(),
      customersPort: FakeCustomersPort(),
      perms: perms,
      shareImpl: shareImpl,
    );

void main() {
  group('CreateQuoteScreen (Story 4.1)', () {
    testWidgets('an order vatMode this build does not know is left out of the preview, never echoed',
        (WidgetTester tester) async {
      final _UnknownVatPort port = _UnknownVatPort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      expect(port.previews, isNotEmpty);
      for (final PreviewTotalInput p in port.previews) {
        expect(p.vatMode, isNull);
      }
      expect(tester.takeException(), isNull);
    });

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
      // qua formatVnd — không còn "—" nào (preview đã chạy ngay sau create).
      expect(find.text('—'), findsNothing);
      expect(find.text('0 đ'), findsNWidgets(3));
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

      expect(find.text('12.250.000 đ'), findsWidgets);
      expect(find.text('980.000 đ'), findsOneWidget);
      expect(find.text('13.230.000 đ'), findsOneWidget);
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
      expect(find.text('196.000 đ'), findsOneWidget);
      expect(find.text('2.646.000 đ'), findsOneWidget);

      // qty 1 → 2: preview mới 4_900_000 / 392_000 / 5_292_000 — số cũ biến mất.
      await tester.enterText(find.widgetWithText(TextField, '1').first, '2');
      await tester.pumpAndSettle();

      expect(find.text('4.900.000 đ'), findsWidgets);
      expect(find.text('392.000 đ'), findsOneWidget);
      expect(find.text('5.292.000 đ'), findsOneWidget);
      expect(find.text('196.000 đ'), findsNothing);
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
          discountAmount: 0,
          vatAmount: 392000,
          total: 5292000,
          vatRate: 8,
          applyVat: true));
      // Hai preview kia còn treo nhưng không giữ frame nào — settle an toàn.
      await tester.pumpAndSettle();
      expect(find.text('5.292.000 đ'), findsOneWidget);

      // Hai preview CŨ về TRỄ (1 dòng qty 1, rồi giỏ rỗng) — ticket phải vứt
      // cả hai, số mới giữ nguyên trên màn.
      port.pendingPreviews[1].complete(const OrderTotals(
          subtotal: 2450000,
          discountAmount: 0,
          vatAmount: 196000,
          total: 2646000,
          vatRate: 8,
          applyVat: true));
      port.pendingPreviews[0].complete(const OrderTotals(
          subtotal: 0, discountAmount: 0, vatAmount: 0, total: 0, vatRate: 8, applyVat: true));
      await tester.pumpAndSettle();

      expect(find.text('5.292.000 đ'), findsOneWidget);
      expect(find.text('392.000 đ'), findsOneWidget);
      expect(find.text('2.646.000 đ'), findsNothing);
      expect(find.text('196.000 đ'), findsNothing);
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
      expect(find.text('2.450.000 đ'), findsWidgets);
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
      expect(find.text('2.450.000 đ'), findsWidgets);
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

      expect(
          find.text('12.250.000 đ'), findsWidgets); // 5 × 2450000 — số của port
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
      expect(port.scopeCalls.single.scopeConstruction, isTrue);
      expect(port.scopeCalls.single.scopeDelivery, isNull);
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
      expect(find.text('196.000 đ'), findsOneWidget);
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
      expect(find.text('196.000 đ'), findsNothing);
      expect(find.text('0 đ'), findsOneWidget);
      expect(find.text('2.450.000 đ'), findsWidgets);
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
      expect(find.text('196.000 đ'), findsNothing);

      await tester.tap(vatToggle); // tick lại → co_vat
      await tester.pumpAndSettle();

      // Nhánh checked=true của handler: giá trị gửi đi là 'co_vat' đúng registry.
      expect(port.metaCalls, hasLength(2));
      expect(port.metaCalls.last.vatMode, 'co_vat');
      // Preview echo vatMode mới: VAT 8% của fake-backend hiện trở lại.
      expect(find.text('196.000 đ'), findsOneWidget);
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

    const String kChotConsequence =
        'Chốt sẽ đóng băng giá của mọi dòng theo danh mục hiện tại — sửa giá sau này cần tạo bản mới.';

    testWidgets(
        'Chốt (4.5): bấm nút → dialog nêu hệ quả → xác nhận → fake nhận confirmOrder, màn về read-only, nút Chốt biến mất',
        (WidgetTester tester) async {
      final _RecordingConfirmPort port = _RecordingConfirmPort();
      await tester.pumpWidget(_host(_screen(
        ordersPort: port,
        perms: const <PermissionKey>{AppPermissionKeys.ordersConfirm},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // Nút primary dưới khối Tổng kết (_tap đã ensureVisible trước khi tap).
      await _tap(tester, 'Chốt báo giá');

      // Dialog nêu hệ quả đóng băng giá — đúng nguyên văn nhãn chung 2 nền tảng.
      expect(find.text(kChotConsequence), findsOneWidget);

      await _tap(tester, 'Xác nhận');

      // Fake nhận ĐÚNG một lần với đúng orderId.
      expect(port.confirmCalls, hasLength(1));
      expect(port.confirmCalls.single, 'ord-demo-1');
      // Status 'dachot' → editable tắt: ô SL không còn là input, tick VAT
      // disabled, nút Chốt biến mất — KHÔNG toast hô hào nào.
      expect(find.widgetWithText(TextField, '1'), findsNothing);
      final AppCheckbox tick = tester
          .widget<AppCheckbox>(find.widgetWithText(AppCheckbox, 'Tính VAT'));
      expect(tick.disabled, isTrue);
      expect(find.widgetWithText(AppButton, 'Chốt báo giá'), findsNothing);
      // Giỏ vẫn hiển thị đủ dòng ở chế độ read-only.
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
    });

    testWidgets('Chốt (4.5): huỷ dialog → fake KHÔNG bị gọi, đơn vẫn sửa được',
        (WidgetTester tester) async {
      final _RecordingConfirmPort port = _RecordingConfirmPort();
      await tester.pumpWidget(_host(_screen(
        ordersPort: port,
        perms: const <PermissionKey>{AppPermissionKeys.ordersConfirm},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      await _tap(tester, 'Chốt báo giá');
      expect(find.text(kChotConsequence), findsOneWidget);

      await _tap(tester, 'Huỷ');

      // Không call nào bay đi; đơn ở nguyên baogia — input SL còn, nút Chốt còn.
      expect(port.confirmCalls, isEmpty);
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Chốt báo giá'), findsOneWidget);
    });

    testWidgets(
        'Chốt (4.5): port throw → banner message backend, giỏ còn nguyên, VẪN editable',
        (WidgetTester tester) async {
      const String backendSentence = 'Không thể chốt báo giá chưa có dòng nào.';
      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingConfirmPort(
          const OrderPortException(backendSentence),
        ),
        perms: const <PermissionKey>{AppPermissionKeys.ordersConfirm},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      await _tap(tester, 'Chốt báo giá');
      await _tap(tester, 'Xác nhận');

      // Câu backend nguyên văn; dòng giỏ KHÔNG mất; đơn VẪN sửa được (status
      // không đổi) — nút Chốt còn đó để thử lại.
      expect(find.text(backendSentence), findsOneWidget);
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Chốt báo giá'), findsOneWidget);
    });

    testWidgets(
        'Chốt (4.5): perms KHÔNG có orders.confirm → nút không render (gate biến mất, không disabled xám)',
        (WidgetTester tester) async {
      // Có quyền KHÁC (dựng báo giá) nhưng thiếu orders.confirm — đúng ca sale.
      await tester.pumpWidget(_host(_screen(
        perms: const <PermissionKey>{AppPermissionKeys.quotesCreateEdit},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // Đơn editable nhưng nút Chốt KHÔNG tồn tại trong cây widget.
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Chốt báo giá'), findsNothing);
    });

    const String kMoLaiConsequence =
        'Mở lại sẽ tạo bản cập nhật mới — giá các dòng tính lại theo danh mục hiện tại cho tới khi chốt lại; bản đã chốt vẫn nằm trong lịch sử.';

    testWidgets(
        'Mở lại (4.6): đơn dachot + quotes.create_edit → nút hiện; bấm → dialog nêu hệ quả → xác nhận → fake nhận reviseOrder đúng 1 lần, màn editable lại, nút Chốt hiện lại',
        (WidgetTester tester) async {
      final _RecordingRevisePort port = _RecordingRevisePort();
      await tester.pumpWidget(_host(_screen(
        ordersPort: port,
        perms: const <PermissionKey>{
          AppPermissionKeys.ordersConfirm,
          AppPermissionKeys.quotesCreateEdit,
        },
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);
      await _chotDonQuaFake(tester);

      // Đơn đã chốt: nút Chốt biến mất, nút Mở lại thế chỗ (nghịch đảo).
      expect(find.widgetWithText(AppButton, 'Chốt báo giá'), findsNothing);
      await _tap(tester, 'Mở lại để sửa');

      // Dialog nêu hệ quả — đúng nguyên văn nhãn chung 2 nền tảng.
      expect(find.text(kMoLaiConsequence), findsOneWidget);

      await _tap(tester, 'Xác nhận');

      // Fake nhận ĐÚNG một lần với đúng orderId.
      expect(port.reviseCalls, hasLength(1));
      expect(port.reviseCalls.single, 'ord-demo-1');
      // Status về 'baogia' → editable bật lại: ô SL là input, nút Chốt hiện
      // lại (có ordersConfirm), nút Mở lại biến mất — KHÔNG toast.
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Chốt báo giá'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Mở lại để sửa'), findsNothing);
      // Giỏ vẫn hiển thị đủ dòng.
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
    });

    testWidgets(
        'Mở lại (4.6): huỷ dialog → fake KHÔNG bị gọi, đơn ở nguyên dachot (read-only, nút còn đó)',
        (WidgetTester tester) async {
      final _RecordingRevisePort port = _RecordingRevisePort();
      await tester.pumpWidget(_host(_screen(
        ordersPort: port,
        perms: const <PermissionKey>{
          AppPermissionKeys.ordersConfirm,
          AppPermissionKeys.quotesCreateEdit,
        },
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);
      await _chotDonQuaFake(tester);

      await _tap(tester, 'Mở lại để sửa');
      expect(find.text(kMoLaiConsequence), findsOneWidget);

      await _tap(tester, 'Huỷ');

      // Không call nào bay đi; đơn ở nguyên dachot — vẫn read-only, nút còn đó.
      expect(port.reviseCalls, isEmpty);
      expect(find.widgetWithText(TextField, '1'), findsNothing);
      expect(find.widgetWithText(AppButton, 'Mở lại để sửa'), findsOneWidget);
    });

    testWidgets(
        'Mở lại (4.6): port throw → banner message backend, state nguyên (vẫn dachot, giỏ còn, nút còn đó)',
        (WidgetTester tester) async {
      const String backendSentence =
          'Chỉ mở lại được đơn đang ở trạng thái Đã chốt.';
      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingRevisePort(
          const OrderPortException(backendSentence),
        ),
        perms: const <PermissionKey>{
          AppPermissionKeys.ordersConfirm,
          AppPermissionKeys.quotesCreateEdit,
        },
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);
      await _chotDonQuaFake(tester);

      await _tap(tester, 'Mở lại để sửa');
      await _tap(tester, 'Xác nhận');

      // Câu backend nguyên văn; giỏ KHÔNG mất dòng; đơn VẪN read-only (status
      // không đổi) — nút Mở lại còn đó để thử lại.
      expect(find.text(backendSentence), findsOneWidget);
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      expect(find.widgetWithText(TextField, '1'), findsNothing);
      expect(find.widgetWithText(AppButton, 'Mở lại để sửa'), findsOneWidget);
    });

    testWidgets(
        'Mở lại (4.6): perms KHÔNG có quotes.create_edit → nút không render (gate biến mất, không disabled xám)',
        (WidgetTester tester) async {
      // Có quyền chốt nhưng KHÔNG có quyền sửa — orders.confirm không thay
      // thế được quotes.create_edit (nghịch đảo proof 4.5).
      await tester.pumpWidget(_host(_screen(
        perms: const <PermissionKey>{AppPermissionKeys.ordersConfirm},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);
      await _chotDonQuaFake(tester);

      // Đơn đã chốt nhưng nút Mở lại KHÔNG tồn tại trong cây widget.
      expect(find.widgetWithText(TextField, '1'), findsNothing);
      expect(find.widgetWithText(AppButton, 'Mở lại để sửa'), findsNothing);
    });

    testWidgets(
        'Mở lại (4.6): đơn còn baogia → nút không render (chỉ hiện trên đơn đã chốt)',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen(
        perms: const <PermissionKey>{AppPermissionKeys.quotesCreateEdit},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // Đơn editable — nút Mở lại KHÔNG tồn tại (nghịch đảo điều kiện hiện).
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Mở lại để sửa'), findsNothing);
    });

    /// Drive tới giỏ có 1 dòng catalog rồi mở dialog Áp chiết khấu và gửi.
    Future<void> apChietKhauQuaDialog(
      WidgetTester tester, {
      String amount = '500000',
    }) async {
      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm'); // Tấm pin JA Solar 580W — 2_450_000
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      await _tap(tester, 'Áp chiết khấu');
      // Field đầu trong dialog = "Mức chiết khấu (đ)" (field 2 là lý do).
      await tester.enterText(
        find
            .descendant(
                of: find.byType(AppDialog), matching: find.byType(TextField))
            .first,
        amount,
      );
      await _tap(tester, 'Gửi duyệt');
    }

    testWidgets(
        'Áp chiết khấu (4.7): baogia + discounts.apply → nút hiện, dialog nhập mức → fake nhận applyDiscount đúng 1 lần, màn khoá sửa + banner chờ duyệt + dòng Chiết khấu',
        (WidgetTester tester) async {
      final _RecordingApplyDiscountPort port = _RecordingApplyDiscountPort();
      await tester.pumpWidget(_host(_screen(
        ordersPort: port,
        perms: const <PermissionKey>{AppPermissionKeys.discountsApply},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await apChietKhauQuaDialog(tester);

      // Fake nhận ĐÚNG một lần với đúng amount (số nguyên đồng nhập tay).
      expect(port.applyCalls, hasLength(1));
      expect(port.applyCalls.single.amount, 500000);
      // Status 'choduyet' → editable tắt: ô SL không còn input, nút Áp biến
      // mất, banner chờ duyệt hiện đúng nguyên văn.
      expect(find.widgetWithText(TextField, '1'), findsNothing);
      expect(find.widgetWithText(AppButton, 'Áp chiết khấu'), findsNothing);
      expect(
        find.text(
            'Chờ duyệt chiết khấu — chiết khấu đang chờ người có quyền duyệt.'),
        findsOneWidget,
      );
      // Tổng kết thêm dòng Chiết khấu — SỐ FAKE-BACKEND echo (2_450_000 −
      // 500_000 = vatBase 1_950_000; VAT 8% = 156_000; total 2_106_000).
      expect(find.text('Chiết khấu'), findsOneWidget);
      expect(find.text('500.000 đ'), findsOneWidget);
      expect(find.text('156.000 đ'), findsOneWidget);
      expect(find.text('2.106.000 đ'), findsOneWidget);
      // Giỏ vẫn hiển thị đủ dòng ở chế độ read-only.
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
    });

    testWidgets(
        'Áp chiết khấu (4.7): perms KHÔNG có discounts.apply → nút không render (gate biến mất)',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen(
        perms: const <PermissionKey>{AppPermissionKeys.quotesCreateEdit},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // Đơn editable nhưng nút Áp chiết khấu KHÔNG tồn tại trong cây widget.
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Áp chiết khấu'), findsNothing);
    });

    testWidgets(
        'Áp chiết khấu (4.7): port throw → banner message backend, giỏ còn nguyên, VẪN editable',
        (WidgetTester tester) async {
      const String backendSentence = 'Mức chiết khấu vượt quá tổng tiền hàng.';
      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingApplyDiscountPort(
          const OrderPortException(backendSentence),
        ),
        perms: const <PermissionKey>{AppPermissionKeys.discountsApply},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await apChietKhauQuaDialog(tester);

      // Câu backend nguyên văn; dòng giỏ KHÔNG mất; đơn VẪN sửa được (status
      // không đổi) — nút Áp còn đó để thử lại.
      expect(find.text(backendSentence), findsOneWidget);
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Áp chiết khấu'), findsOneWidget);
    });

    testWidgets(
        'Chốt sau duyệt (4.7): approve dựng qua fake → banner đã duyệt + nút Chốt hiện (ordersConfirm) → chốt được từ choduyet',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen(
        ordersPort: _AutoApprovePort(),
        perms: const <PermissionKey>{
          AppPermissionKeys.discountsApply,
          AppPermissionKeys.ordersConfirm,
        },
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await apChietKhauQuaDialog(tester);

      // Approver (fake) đã đồng ý: đơn Ở NGUYÊN choduyet — banner đã duyệt +
      // nút Chốt hiện LẠI dù màn không editable.
      expect(
        find.text('Chiết khấu đã được duyệt — có thể chốt đơn.'),
        findsOneWidget,
      );
      expect(find.widgetWithText(TextField, '1'), findsNothing);
      expect(find.widgetWithText(AppButton, 'Chốt báo giá'), findsOneWidget);

      await _tap(tester, 'Chốt báo giá');
      await _tap(tester, 'Xác nhận');

      // Chốt từ choduyet thành công: status 'dachot' — nút Chốt biến mất,
      // banner duyệt biến mất (đơn không còn choduyet).
      expect(find.widgetWithText(AppButton, 'Chốt báo giá'), findsNothing);
      expect(
        find.text('Chiết khấu đã được duyệt — có thể chốt đơn.'),
        findsNothing,
      );
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
    });

    testWidgets(
        'Từ chối (4.7): reject dựng qua fake → đơn editable lại + banner lý do từ backend',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen(
        ordersPort: _AutoRejectPort(),
        perms: const <PermissionKey>{AppPermissionKeys.discountsApply},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await apChietKhauQuaDialog(tester);

      // Approver (fake) đã từ chối: đơn VỀ baogia — sửa lại được, banner mang
      // lý do backend, KHÔNG còn dòng Chiết khấu trong Tổng kết (bản đang sửa
      // không mang chiết khấu).
      expect(
          find.text('Chiết khấu bị từ chối — Biên quá mỏng'), findsOneWidget);
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Áp chiết khấu'), findsOneWidget);
      expect(find.text('Chiết khấu'), findsNothing);
    });

    // ------------------------------------------------------------------
    // Story 4.8 — Chia sẻ báo giá (FR-21): export qua port → share [ảnh, pdf].
    // ------------------------------------------------------------------

    /// Thêm 1 dòng catalog vào giỏ (điều kiện ≥1 dòng cho nút share).
    Future<void> themMotDong(WidgetTester tester) async {
      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
    }

    testWidgets(
        'Chia sẻ báo giá (4.8): quotes.create_edit + ≥1 dòng → nút hiện, tap → exportQuote đúng 1 lần + shareImpl nhận đúng 2 file [ảnh, pdf]',
        (WidgetTester tester) async {
      final _RecordingExportPort port = _RecordingExportPort();
      final List<List<XFile>> shared = <List<XFile>>[];
      final List<List<String>?> names = <List<String>?>[];
      Future<AppShareResult> recordingShare(
        List<XFile> files, {
        String? title,
        String? text,
        List<String>? fileNames,
      }) async {
        shared.add(files);
        names.add(fileNames);
        return AppShareResult.shared;
      }

      await tester.pumpWidget(_host(_screen(
        ordersPort: port,
        perms: const <PermissionKey>{AppPermissionKeys.quotesCreateEdit},
        shareImpl: recordingShare,
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);
      await themMotDong(tester);

      await _tap(tester, 'Chia sẻ báo giá');

      // Fake nhận ĐÚNG một lần cho đúng đơn.
      expect(port.exportCalls, hasLength(1));
      // shareImpl nhận đúng 2 file, ẢNH đứng TRƯỚC pdf (UX-DR-21). XFile.fromData
      // không giữ `name` trên IO (getter lấy từ path rỗng), nên tên đi qua
      // `fileNames` (share_plus fileNameOverrides) — đúng tên backend đặt.
      expect(shared, hasLength(1));
      final List<XFile> files = shared.single;
      expect(files, hasLength(2));
      expect(files[0].mimeType, 'image/png');
      expect(files[1].mimeType, 'application/pdf');
      expect(names.single, hasLength(2));
      expect(names.single![0], endsWith('.png'));
      expect(names.single![1], endsWith('.pdf'));
    });

    testWidgets(
        'Chia sẻ báo giá (4.8): perms KHÔNG có quotes.create_edit → nút không render (gate biến mất)',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen(
        perms: const <PermissionKey>{AppPermissionKeys.discountsApply},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);
      await themMotDong(tester);

      // Hàng nút vẫn render (Áp chiết khấu có quyền) nhưng nút share KHÔNG
      // tồn tại trong cây widget — Gate fail-closed, backend vẫn enforce AD-4.
      expect(find.widgetWithText(AppButton, 'Áp chiết khấu'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Chia sẻ báo giá'), findsNothing);
    });

    testWidgets(
        'Chia sẻ báo giá (4.8): giỏ 0 dòng → nút không render (0 dòng vô nghĩa; backend 400 là hàng rào thật)',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen(
        perms: const <PermissionKey>{AppPermissionKeys.quotesCreateEdit},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      expect(
        find.text('Chưa có dòng nào. Thêm dòng đầu tiên để bắt đầu.'),
        findsOneWidget,
      );
      expect(find.widgetWithText(AppButton, 'Chia sẻ báo giá'), findsNothing);
    });

    testWidgets(
        'Chia sẻ báo giá (4.8): port throw → banner câu backend, giỏ + editable NGUYÊN VẸN, shareImpl KHÔNG được gọi',
        (WidgetTester tester) async {
      const String backendSentence = 'Không thể xuất báo giá chưa có dòng nào.';
      final List<List<XFile>> shared = <List<XFile>>[];
      Future<AppShareResult> recordingShare(
        List<XFile> files, {
        String? title,
        String? text,
        List<String>? fileNames,
      }) async {
        shared.add(files);
        return AppShareResult.shared;
      }

      await tester.pumpWidget(_host(_screen(
        ordersPort: _RejectingExportPort(
          const OrderPortException(backendSentence),
        ),
        perms: const <PermissionKey>{AppPermissionKeys.quotesCreateEdit},
        shareImpl: recordingShare,
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);
      await themMotDong(tester);

      await _tap(tester, 'Chia sẻ báo giá');

      // Câu backend nguyên văn; KHÔNG file nào tới share; dòng giỏ KHÔNG mất;
      // đơn VẪN editable; nút share còn đó để thử lại (bất biến k).
      expect(find.text(backendSentence), findsOneWidget);
      expect(shared, isEmpty);
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      expect(find.widgetWithText(TextField, '1'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Chia sẻ báo giá'), findsOneWidget);
    });
  });

  group('CreateQuoteScreen (Story 4.9 — bảo hành theo dòng)', () {
    testWidgets(
        'dòng catalog thường: có input bảo hành, nhập 24 rồi rời focus → port nhận warrantyMonths 24',
        (WidgetTester tester) async {
      final _RecordingUpdatePort port = _RecordingUpdatePort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm'); // Tấm pin JA Solar 580W — warrantyMonths 144
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      // Ô bảo hành hiển thị sẵn 144 (12 năm ở read-only, số thô khi sửa được).
      final Finder warrantyField = find.widgetWithText(TextField, '144');
      await tester.ensureVisible(warrantyField);
      await tester.pump();
      await tester.enterText(warrantyField, '24');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      // Port nhận đúng tri-state: có gửi warrantyMonths, giá trị 24.
      final UpdateOrderLineInput last = port.updateCalls.last;
      expect(last.hasWarrantyMonths, isTrue);
      expect(last.warrantyMonths, 24);
    });

    testWidgets(
        'xoá bảo hành: ô đang 144, nhập rỗng rồi rời focus → port nhận CLEAR (hasWarrantyMonths true, warrantyMonths null)',
        (WidgetTester tester) async {
      // Nhánh cốt lõi của sentinel tri-state: ô rỗng KHÔNG phải "không gửi" mà là
      // "bỏ bảo hành" (null-clear). Không có test này thì mutant khiến _commit bỏ
      // qua ô rỗng vẫn xanh — mất chính năng lực mà kLineFieldAbsent sinh ra.
      final _RecordingUpdatePort port = _RecordingUpdatePort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm'); // Tấm pin JA Solar 580W — warrantyMonths 144
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      final Finder warrantyField = find.widgetWithText(TextField, '144');
      await tester.ensureVisible(warrantyField);
      await tester.pump();
      await tester.enterText(warrantyField, '');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      // CLEAR: field CÓ mặt trong PATCH (phân biệt "không gửi") nhưng giá trị null.
      final UpdateOrderLineInput last = port.updateCalls.last;
      expect(last.hasWarrantyMonths, isTrue);
      expect(last.warrantyMonths, isNull);
    });

    testWidgets(
        'dòng công lắp (priceEditable): thấy "Không có", KHÔNG input bảo hành',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen()));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Chọn từ danh mục');
      // Sản phẩm thứ 3 trong danh mục = "Phí lắp đặt" (priceEditable=true).
      final Finder themPhiLap = find
          .descendant(
            of: find.ancestor(
                of: find.text('Phí lắp đặt'), matching: find.byType(Row)),
            matching: find.widgetWithText(AppButton, 'Thêm'),
          )
          .first;
      await tester.ensureVisible(themPhiLap);
      await tester.pump();
      await tester.tap(themPhiLap);
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();

      expect(find.text('Phí lắp đặt'), findsOneWidget);
      // Cột bảo hành của dòng công lắp là chữ "Không có", không có ô nhập.
      expect(find.text('Không có'), findsOneWidget);
    });

    testWidgets(
        'dòng tự do: thấy "+ Thêm bảo hành", tap → input hiện, nhập 18 → port nhận 18',
        (WidgetTester tester) async {
      // Sheet dòng tự do cao hơn khung điện thoại — nới surface để nút "Thêm
      // dòng" nằm trong tầm chạm, rồi trả lại sau test.
      await tester.binding.setSurfaceSize(const Size(1400, 3200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final _RecordingUpdatePort port = _RecordingUpdatePort();
      await tester.pumpWidget(_host(_screen(ordersPort: port)));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);

      await _tap(tester, 'Dòng tự do');
      final Finder sheetFields = find.descendant(
          of: find.byType(AppSheet), matching: find.byType(TextField));
      await tester.enterText(sheetFields.at(0), 'Vệ sinh mái trước lắp'); // tên
      await tester.enterText(sheetFields.at(1), 'lần'); // đơn vị
      // Sheet body cuộn trong 260px — kéo nút "Thêm dòng" vào tầm nhìn trước tap.
      final Finder themDong = find.widgetWithText(AppButton, 'Thêm dòng');
      await tester.scrollUntilVisible(
        themDong,
        120.0,
        scrollable: find
            .descendant(
                of: find.byType(AppSheet), matching: find.byType(Scrollable))
            .first,
      );
      await tester.tap(themDong);
      await tester.pumpAndSettle();

      // Dòng tự do THỰC SỰ vào giỏ (không còn kẹt trong sheet).
      expect(find.byType(AppCartLineRow), findsOneWidget);
      // Chưa có bảo hành → link "+ Thêm bảo hành".
      final Finder link = find.widgetWithText(AppButton, '+ Thêm bảo hành');
      await tester.ensureVisible(link);
      await tester.pump();
      await tester.tap(link);
      await tester.pumpAndSettle();

      // Bấm link → input bảo hành hiện (phân biệt với ô SL/đơn giá qua nhãn a11y);
      // nhập 18 rồi rời focus → port nhận 18.
      final Finder warrantyField = find
          .descendant(
              of: find.bySemanticsLabel('Bảo hành (tháng)'),
              matching: find.byType(TextField))
          .first;
      await tester.enterText(warrantyField, '18');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      expect(port.updateCalls.last.hasWarrantyMonths, isTrue);
      expect(port.updateCalls.last.warrantyMonths, 18);
    });

    testWidgets(
        'lỗi port bảo hành: banner câu backend, giỏ còn nguyên (bất biến k)',
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

      final Finder warrantyField = find.widgetWithText(TextField, '144');
      await tester.ensureVisible(warrantyField);
      await tester.pump();
      await tester.enterText(warrantyField, '24');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      // Câu backend nguyên văn; dòng giỏ KHÔNG mất.
      expect(find.text(backendSentence), findsOneWidget);
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
    });

    testWidgets(
        'sau chốt (read-only): cột bảo hành là chữ "12 năm" (144 tháng), không input',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(_screen(
        perms: const <PermissionKey>{AppPermissionKeys.ordersConfirm},
      )));
      await tester.pumpAndSettle();
      await _pickDemoCustomer(tester);
      await _chotDonQuaFake(tester);

      // Đơn 'dachot' → read-only: ô SL không còn input, bảo hành 144 tháng hiển
      // thị dạng "12 năm" (định dạng năm/tháng), KHÔNG có ô nhập bảo hành.
      expect(find.widgetWithText(TextField, '1'), findsNothing);
      expect(find.widgetWithText(TextField, '144'), findsNothing);
      expect(find.text('12 năm'), findsOneWidget);
    });
  });
}
