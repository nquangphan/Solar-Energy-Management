// Chi tiết đơn must not overflow on a narrow phone, whatever the status label.
//
// The "Trạng thái" row gives the label column a fixed 120px and then the chip
// whatever is left; the longest label ('Đang thi công') plus the chip's dot and
// padding used to exceed it. The 5.4 suite never saw that because its fixture is
// the short 'baogia'. Flutter reports a RenderFlex overflow as a test exception,
// so merely pumping the screen at a narrow width is the assertion.
//
// The longest label is derived from kStatusLabels, never typed by hand, and the
// fixture turns on every outer condition (all scopes, a next step, cancellable,
// a wired onChangeStatus) so every button on the screen is actually laid out.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_detail_screen.dart';

const String _kOrderId = 'ord-long-1';

class _Port extends FakeOrdersPort {
  _Port(this.statusKey);

  final StatusKey statusKey;

  @override
  Future<Order> get(String id) async => Order(
        id: _kOrderId,
        status: statusKey.name,
        customerSdt: '+84903176968',
        currentVersionId: 'ver-1',
        ownerAccountId: 'acc-1',
        sourceId: 'src-facebook',
        custType: 'CA_NHAN',
        scopeThietBi: true,
        scopeThiCong: true,
        scopeVanChuyen: true,
        vatMode: 'co_vat',
        lineItems: const <OrderLine>[],
        createdAt: '2026-07-18T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
      );

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async => OrderLifecycle(
        buoc: <OrderLifecycleStep>[
          OrderLifecycleStep(status: statusKey.name, trangThai: 'current'),
        ],
        buocKeTiep: const <OrderNextStep>[
          OrderNextStep(
            event: 'bat_dau_thi_cong',
            to: 'thicong',
            requires: 'quotes.create_edit',
          ),
        ],
        coTheHuy: true,
      );

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async =>
      const <OrderVersionItem>[];
}

Widget _host(StatusKey key) => MaterialApp(
      home: Scaffold(
        body: OrderDetailScreen(
          key: ValueKey<StatusKey>(key),
          port: _Port(key),
          orderId: _kOrderId,
          onChangeStatus: () {},
        ),
      ),
    );

void main() {
  final StatusKey longest = kStatusLabels.keys.reduce(
    (StatusKey a, StatusKey b) =>
        kStatusLabels[a]!.length >= kStatusLabels[b]!.length ? a : b,
  );

  for (final double width in <double>[320.0, 360.0]) {
    testWidgets(
        'longest status label (${longest.name}) lays out at ${width}px '
        'with every button shown', (WidgetTester tester) async {
      tester.view.physicalSize = Size(width, 800.0);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(longest));
      await tester.pumpAndSettle();

      expect(find.text(kStatusLabels[longest]!), findsWidgets);
      // The outer conditions are really on, so the test cannot pass by
      // skipping the widgets that make the screen tight.
      expect(find.text('Chuyển trạng thái'), findsOneWidget);
      expect(find.text('Huỷ đơn'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('every status label lays out at 320px', (tester) async {
    tester.view.physicalSize = const Size(320.0, 800.0);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    for (final StatusKey key in StatusKey.values) {
      await tester.pumpWidget(_host(key));
      await tester.pumpAndSettle();
      expect(find.text(kStatusLabels[key]!), findsWidgets, reason: key.name);
      expect(tester.takeException(), isNull, reason: key.name);
    }
  });
}
