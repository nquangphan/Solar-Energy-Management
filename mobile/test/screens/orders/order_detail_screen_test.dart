// Native Flutter widget tests for the Chi tiết đơn screen (Story 5.4).
// Mirrors mobile/test/screens/orders/order_list_screen_test.dart.
//
// These exist because mobile CAN run them. The web twin is guarded only by text
// (no tsc/bundler/JSDOM yet, TD-1), so the behaviour a text-guard cannot see is
// asserted here instead of taken on faith: that each of the four states renders
// its exact copy, that 404 is NOT the network error, that "Thử lại" really calls
// the port again, that switching tabs swaps the content, that a scope-blocked
// step is genuinely absent — and that a full seven-step stepper does not overflow
// a phone.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_detail_screen.dart';

const String _kOrderId = 'ord-test-1';

Order _order({
  String status = 'baogia',
  List<OrderLine> lines = const <OrderLine>[],
}) =>
    Order(
      id: _kOrderId,
      status: status,
      customerSdt: '+84903176968',
      currentVersionId: 'ver-1',
      ownerAccountId: 'acc-1',
      sourceId: 'src-facebook',
      custType: 'CA_NHAN',
      scopeThietBi: true,
      scopeThiCong: true,
      scopeVanChuyen: true,
      vatMode: 'co_vat',
      lineItems: lines,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    );

OrderVersionItem _version(int no, {required bool hienLuc, String? actor}) =>
    OrderVersionItem(
      id: 'ver-$no',
      versionNo: no,
      laBanHienLuc: hienLuc,
      createdAt: '2026-07-18T00:00:00.000Z',
      chotAt: null,
      createdByAccountId: actor == null ? null : 'acc-1',
      createdByDisplayName: actor,
      soDong: 3,
      thayDoi: const OrderVersionChange(
        them: <String>['Tủ điện DC'],
        xoa: <String>[],
        doiSoLuong: <OrderVersionQtyChange>[],
      ),
    );

/// A port answering a fixed order + a caller-chosen lifecycle and history.
class _StubPort extends FakeOrdersPort {
  _StubPort({
    required this.steps,
    this.versions = const <OrderVersionItem>[],
  });

  final List<String> steps;
  final List<OrderVersionItem> versions;

  @override
  Future<Order> get(String id) async => _order();

  @override
  Future<List<OrderLifecycleStep>> getLifecycle(String orderId) async =>
      <OrderLifecycleStep>[
        for (int i = 0; i < steps.length; i++)
          OrderLifecycleStep(
            status: steps[i],
            trangThai: i == 0 ? 'current' : 'upcoming',
          ),
      ];

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async => versions;
}

/// A port whose reads always fail with a TRANSPORT error — the retryable state.
class _FailingPort extends FakeOrdersPort {
  int calls = 0;

  @override
  Future<Order> get(String id) async {
    calls += 1;
    throw StateError('network down');
  }

  @override
  Future<List<OrderLifecycleStep>> getLifecycle(String orderId) async =>
      throw StateError('network down');

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async =>
      throw StateError('network down');
}

/// A port answering the backend's 404 envelope — the order does not exist, or it
/// is outside the caller's scope. The two are indistinguishable BY DESIGN.
class _NotFoundPort extends FakeOrdersPort {
  @override
  Future<Order> get(String id) async =>
      throw const OrderPortException('Không tìm thấy đơn hàng: x',
          code: 'NOT_FOUND');

  @override
  Future<List<OrderLifecycleStep>> getLifecycle(String orderId) async =>
      throw const OrderPortException('Không tìm thấy đơn hàng: x',
          code: 'NOT_FOUND');

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async =>
      throw const OrderPortException('Không tìm thấy đơn hàng: x',
          code: 'NOT_FOUND');
}

/// A port whose order read never answers until the test says so — the only way
/// to hold a load open across an unmount.
class _HangingPort extends FakeOrdersPort {
  _HangingPort(this.cho);

  final Completer<Order> cho;

  @override
  Future<Order> get(String id) => cho.future;

  @override
  Future<List<OrderLifecycleStep>> getLifecycle(String orderId) async =>
      const <OrderLifecycleStep>[];

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async =>
      const <OrderVersionItem>[];
}

Widget _host(OrdersPort port) => MaterialApp(
      home: Scaffold(
        body: OrderDetailScreen(port: port, orderId: _kOrderId),
      ),
    );

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('loading → ready: the four steps render with their labels',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      _host(_StubPort(steps: const <String>['baogia', 'dachot', 'hoanthanh'])),
    );

    // First frame is the loading state — the port has not answered yet.
    expect(find.text('Đang tải chi tiết đơn…'), findsOneWidget);
    expect(find.byType(AppSkeleton), findsWidgets);

    await tester.pumpAndSettle();

    expect(find.text('Đang tải chi tiết đơn…'), findsNothing);
    // Labels come from kStatusLabels, never re-typed on the screen.
    expect(find.text('Báo giá'), findsWidgets);
    expect(find.text('Đã chốt'), findsWidgets);
    expect(find.text('Hoàn thành'), findsWidgets);
  });

  testWidgets('transport error shows the retry copy, and "Thử lại" calls again',
      (WidgetTester tester) async {
    final _FailingPort port = _FailingPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    expect(find.text('Không tải được chi tiết đơn.'), findsOneWidget);
    // A retry button that does not retry is the dead end the error state exists
    // to prevent.
    final int before = port.calls;
    await _tap(tester, find.widgetWithText(AppButton, 'Thử lại'));
    expect(port.calls, greaterThan(before));
  });

  testWidgets('404 shows its OWN copy — not the network-error copy (AC-13)',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_NotFoundPort()));
    await tester.pumpAndSettle();

    expect(find.text('Không tìm thấy đơn này.'), findsOneWidget);
    // Collapsing the two would tell a user to retry a question that already has
    // its final answer.
    expect(find.text('Không tải được chi tiết đơn.'), findsNothing);
  });

  testWidgets('switching tabs swaps the pane content',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      _host(
        _StubPort(
          steps: const <String>['baogia'],
          versions: <OrderVersionItem>[
            _version(1, hienLuc: false, actor: 'Nguyễn Quản Lý'),
            _version(2, hienLuc: true),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Facts tab first.
    expect(find.text('Mã đơn'), findsOneWidget);
    expect(find.text('Bản hiệu lực'), findsNothing);

    await _tap(tester, find.text('Lịch sử update'));

    expect(find.text('Mã đơn'), findsNothing);
    expect(find.text('Bản 1'), findsOneWidget);
    expect(find.text('Bản 2'), findsOneWidget);
    // Exactly one version is the effective one — it comes from the backend's
    // currentVersionId pointer, and the screen never re-derives it.
    expect(find.text('Bản hiệu lực'), findsOneWidget);
    // The first version has no diff to show; a version with no actor shows `—`
    // rather than an invented name.
    expect(find.text('Bản gốc'), findsOneWidget);
    expect(find.textContaining('—'), findsWidgets);
  });

  testWidgets('empty history shows the empty state, not a blank pane',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_StubPort(steps: const <String>['baogia'])));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Lịch sử update'));

    expect(find.text('Chưa có bản update nào'), findsOneWidget);
    expect(find.text('Đơn vẫn ở bản gốc.'), findsOneWidget);
  });

  testWidgets(
      'a scope-blocked step is ABSENT, not dimmed: thuong_mai renders no "Đang thi công"',
      (WidgetTester tester) async {
    // The backend already dropped the construction branch for an equipment-only
    // order; the screen draws what it was given (UX-DR-11, AC-7).
    await tester.pumpWidget(
      _host(
        _StubPort(steps: const <String>['baogia', 'dachot', 'hoanthanh']),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đang thi công'), findsNothing);
    expect(find.text('Nghiệm thu'), findsNothing);
  });

  testWidgets(
      'a full seven-step stepper does NOT overflow a phone width (horizontal scroll)',
      (WidgetTester tester) async {
    // AppStepper is a Row that does not wrap: 7×64 + 6×26 = 604px, well past any
    // phone. Without the horizontal scroller this throws RenderFlex overflowed —
    // and it would only ever show up on a real device.
    tester.view.physicalSize = const Size(1080, 2340); // ~360dp at dpr 3
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _host(
        _StubPort(
          steps: const <String>[
            'baogia',
            'dachot',
            'dacoc',
            'thicong',
            'nghiemthu',
            'danggiao',
            'dagiao',
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Báo giá'), findsWidgets);
  });

  // The screen fires THREE reads as one batch and only publishes them if it is
  // still on screen. Nothing else in this suite ever leaves a read in flight, so
  // the `mounted` guard — the one that keeps a back-tap during a slow load from
  // calling setState on a dead State — has never actually been exercised.
  //
  // Note what is NOT asserted here: the stale-BATCH branch (`ticket != _latest`).
  // A second load can only start from the "Thử lại" button, which exists only in
  // the error state, which is only reached after the first batch has already
  // settled — so no second batch can overtake a first one in this screen today.
  // Faking that race would produce a green test that proves nothing; the ticket
  // stays as defence for the day a reload trigger IS added.
  testWidgets('leaving the screen mid-load does not publish onto a dead State',
      (WidgetTester tester) async {
    final Completer<Order> chuaTraLoi = Completer<Order>();
    await tester.pumpWidget(_host(_HangingPort(chuaTraLoi)));
    await tester.pump(); // the batch is in flight; the skeleton is up

    // The user backs out before the network answers.
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox())));
    chuaTraLoi.complete(_order());
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('a mid-load exit does not publish an ERROR onto a dead State',
      (WidgetTester tester) async {
    // The catch branch needs its own guard: it also calls setState.
    final Completer<Order> chuaTraLoi = Completer<Order>();
    await tester.pumpWidget(_host(_HangingPort(chuaTraLoi)));
    await tester.pump();

    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox())));
    chuaTraLoi.completeError(StateError('network down'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
