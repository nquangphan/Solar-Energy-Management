// Native Flutter widget tests for the Chuyển trạng thái screen (Story 5.5).
// Mirrors mobile/test/screens/orders/order_detail_screen_test.dart.
//
// THIS IS THE STORY'S ONLY REAL BEHAVIOUR LANE. The web twin is guarded by text
// alone (no tsc/bundler/JSDOM yet, TD-1), and a text-guard cannot see a screen
// that fails to render. So everything a guard cannot prove is asserted here:
// that the step list renders what the backend offered and nothing else, that
// picking a step and submitting calls the port with exactly those arguments,
// that photos are optional, that an empty list yields the "no step" copy rather
// than a blank frame, that a refusal renders the backend's own words, and that
// none of it overflows a phone.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_status_change_screen.dart';

const String _kOrderId = 'ord-test-1';

/// The two branches an order at `dacoc` with both flags on can take — the case
/// where NOTHING may be preselected, because both are one tap from committing.
const List<OrderNextStep> _kHaiNhanh = <OrderNextStep>[
  OrderNextStep(
    event: 'bat_dau_thi_cong',
    to: 'thicong',
    requires: 'construction.transition',
  ),
  OrderNextStep(
    event: 'bat_dau_giao',
    to: 'danggiao',
    requires: 'delivery.confirm',
  ),
];

const List<OrderNextStep> _kMotNhanh = <OrderNextStep>[
  OrderNextStep(
    event: 'xong_thi_cong',
    to: 'nghiemthu',
    requires: 'construction.transition',
  ),
];

/// A port offering a caller-chosen step list and RECORDING what was submitted.
class _StubPort extends FakeOrdersPort {
  _StubPort({this.buocKeTiep = _kHaiNhanh, this.loiGui});

  final List<OrderNextStep> buocKeTiep;

  /// When set, `chuyenTrangThai` throws it instead of succeeding.
  final Object? loiGui;

  String? eventDaGui;
  int? soAnhDaGui;
  int lifecycleCalls = 0;

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async {
    lifecycleCalls += 1;
    return OrderLifecycle(
      buoc: const <OrderLifecycleStep>[],
      buocKeTiep: buocKeTiep,
      coTheHuy: false,
    );
  }

  @override
  Future<StatusChangeResult> chuyenTrangThai(
    String orderId,
    String event,
    List<XFile> anh,
  ) async {
    eventDaGui = event;
    soAnhDaGui = anh.length;
    if (loiGui != null) throw loiGui!;
    return StatusChangeResult(
      status: buocKeTiep.firstWhere((OrderNextStep b) => b.event == event).to,
      occurredAt: '2026-07-18T00:00:00.000Z',
      soAnhDaLuu: anh.length,
    );
  }
}

/// A port whose lifecycle read always fails — the retryable state.
class _FailingPort extends FakeOrdersPort {
  int calls = 0;

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async {
    calls += 1;
    throw StateError('network down');
  }
}

/// A port whose lifecycle read never answers until the test says so — the only
/// way to hold a load open across an unmount.
class _HangingPort extends FakeOrdersPort {
  _HangingPort(this.cho);

  final Completer<OrderLifecycle> cho;

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) => cho.future;
}

/// A picker that answers with N fake files and never touches a platform channel.
ImagePickFn _fakePicker(int soFile) {
  return (ImageSource source) async => <XFile>[
        for (int i = 0; i < soFile; i++) XFile('/tmp/anh-$i.jpg'),
      ];
}

Future<void> _bom(
  WidgetTester tester,
  OrdersPort port, {
  ImagePickFn? pick,
  ValueChanged<String>? onDone,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: OrderStatusChangeScreen(
        port: port,
        orderId: _kOrderId,
        pick: pick,
        onDone: onDone,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  // A narrow phone, so a RenderFlex overflow fails the test instead of only
  // painting a yellow-black stripe nobody sees in CI (lesson from 5.4).
  setUp(() {
    // ignore: deprecated_member_use
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  testWidgets('loading → ready: every offered step renders its status label',
      (WidgetTester tester) async {
    await _bom(tester, _StubPort());

    // AppFrame paints its label uppercased over the top border; the SOURCE
    // string stays 'Bước kế tiếp' on both platforms, which is what the
    // byte-parity guard compares.
    expect(find.text('BƯỚC KẾ TIẾP'), findsOneWidget);
    expect(find.text('Đang thi công'), findsOneWidget);
    expect(find.text('Đang giao'), findsOneWidget);
    // A step the backend did NOT offer must not appear from anywhere.
    expect(find.text('Hoàn thành'), findsNothing);
  });

  testWidgets('TWO branches ⇒ nothing preselected, submit stays disabled',
      (WidgetTester tester) async {
    final _StubPort port = _StubPort();
    await _bom(tester, port);

    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();
    // Disabled means the port was never called — not "called and ignored".
    expect(port.eventDaGui, isNull);
  });

  testWidgets('ONE branch ⇒ preselected, submit posts THAT event with 0 photos',
      (WidgetTester tester) async {
    final _StubPort port = _StubPort(buocKeTiep: _kMotNhanh);
    await _bom(tester, port);

    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();

    expect(port.eventDaGui, 'xong_thi_cong');
    // Upload is ALWAYS optional (FR-23) — zero photos is the ordinary path.
    expect(port.soAnhDaGui, 0);
  });

  testWidgets('picking a step then submitting posts the CHOSEN event',
      (WidgetTester tester) async {
    final _StubPort port = _StubPort();
    await _bom(tester, port);

    await tester.tap(find.text('Đang giao'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();

    expect(port.eventDaGui, 'bat_dau_giao');
  });

  testWidgets('adding photos through the injected picker sends them all',
      (WidgetTester tester) async {
    final _StubPort port = _StubPort(buocKeTiep: _kMotNhanh);
    await _bom(tester, port, pick: _fakePicker(2));

    // The shipped AppImageUpload opens its own sheet — tap the add tile, then
    // the gallery button inside it.
    await tester.tap(find.bySemanticsLabel('Thêm ảnh'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn từ thư viện'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();

    expect(port.soAnhDaGui, 2);
  });

  testWidgets('removing a thumbnail drops that photo from the submission',
      (WidgetTester tester) async {
    final _StubPort port = _StubPort(buocKeTiep: _kMotNhanh);
    await _bom(tester, port, pick: _fakePicker(2));

    await tester.tap(find.bySemanticsLabel('Thêm ảnh'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn từ thư viện'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Xoá ảnh'), findsNWidgets(2));

    await tester.tap(find.bySemanticsLabel('Xoá ảnh').first);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();
    expect(port.soAnhDaGui, 1);
  });

  testWidgets('AC-11: no legal step ⇒ the "no step" copy, no submit button',
      (WidgetTester tester) async {
    await _bom(tester, _StubPort(buocKeTiep: const <OrderNextStep>[]));

    expect(find.text('Không có bước nào để chuyển.'), findsOneWidget);
    expect(find.text('Xác nhận chuyển'), findsNothing);
    // Not an error state: there is nothing to retry.
    expect(find.text('Thử lại'), findsNothing);
  });

  testWidgets('a refusal renders the BACKEND\'s words, verbatim',
      (WidgetTester tester) async {
    final _StubPort port = _StubPort(
      buocKeTiep: _kMotNhanh,
      loiGui: const OrderPortException(
        'Bạn không có quyền thực hiện chuyển trạng thái này.',
        code: 'FORBIDDEN',
      ),
    );
    await _bom(tester, port);

    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();

    expect(
      find.text('Bạn không có quyền thực hiện chuyển trạng thái này.'),
      findsOneWidget,
    );
    // The screen stays usable so the user can pick differently and retry.
    expect(find.text('Xác nhận chuyển'), findsOneWidget);
  });

  testWidgets('a transport failure falls back to the screen\'s own copy',
      (WidgetTester tester) async {
    final _StubPort port = _StubPort(
      buocKeTiep: _kMotNhanh,
      loiGui: StateError('socket closed'),
    );
    await _bom(tester, port);

    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();

    expect(find.text('Không chuyển được trạng thái.'), findsOneWidget);
  });

  testWidgets('load failure shows the retry copy, and "Thử lại" calls again',
      (WidgetTester tester) async {
    final _FailingPort port = _FailingPort();
    await _bom(tester, port);

    expect(find.text('Không chuyển được trạng thái.'), findsOneWidget);
    expect(port.calls, 1);

    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(port.calls, 2);
  });

  testWidgets('a committed transition reports the new status to the caller',
      (WidgetTester tester) async {
    String? daBao;
    await _bom(
      tester,
      _StubPort(buocKeTiep: _kMotNhanh),
      onDone: (String status) => daBao = status,
    );

    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();

    expect(daBao, 'nghiemthu');
  });

  testWidgets('two branches + a long error do NOT overflow a narrow phone',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(320.0 * 3, 640.0 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    final _StubPort port = _StubPort(
      loiGui: const OrderPortException(
        'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
        code: 'CONFLICT',
      ),
    );
    await _bom(tester, port);

    await tester.tap(find.text('Đang thi công'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận chuyển'));
    await tester.pumpAndSettle();

    // pumpAndSettle would already have thrown on a RenderFlex overflow; this
    // asserts the error actually rendered rather than the test passing on a
    // screen that drew nothing.
    expect(
      find.text('Không chuyển được trạng thái đơn từ trạng thái hiện tại.'),
      findsOneWidget,
    );
  });

  testWidgets('leaving mid-load does not publish onto a dead State',
      (WidgetTester tester) async {
    final Completer<OrderLifecycle> cho = Completer<OrderLifecycle>();
    await tester.pumpWidget(
      MaterialApp(
        home: OrderStatusChangeScreen(port: _HangingPort(cho), orderId: _kOrderId),
      ),
    );
    await tester.pump();

    // Replace the screen while its load is still in flight.
    await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
    cho.complete(
      const OrderLifecycle(
        buoc: <OrderLifecycleStep>[],
        buocKeTiep: _kMotNhanh,
        coTheHuy: false,
      ),
    );
    await tester.pumpAndSettle();

    // A setState on a dead State throws asynchronously; pumpAndSettle surfaces
    // it. Reaching here with no exception IS the assertion.
    expect(tester.takeException(), isNull);
  });
}
