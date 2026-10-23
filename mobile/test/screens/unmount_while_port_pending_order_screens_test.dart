// The order screens torn down while their port call is still in flight (Story 11.3).
// Under BLoC the cubit closes with the widget, so the late answer — success or
// failure — must neither throw (emit after close) nor fire the screen's callback.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/fake_catalog_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/create_quote_screen.dart';
import 'package:pns_mobile/screens/orders/discount_approval_screen.dart';
import 'package:pns_mobile/screens/orders/order_detail_screen.dart';
import 'package:pns_mobile/screens/orders/order_list_screen.dart';
import 'package:pns_mobile/screens/orders/order_status_change_screen.dart';

import 'orders/recording_orders_port.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

Future<void> _tapLabel(WidgetTester tester, String label) async {
  final finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Removes the screen, then answers the pending call with [error] (or the fake's value).
Future<void> _leaveThenAnswer(WidgetTester tester, Completer<Object?> pending, Object? error) async {
  await tester.pumpWidget(const SizedBox());
  error == null ? pending.complete() : pending.completeError(error);
  await tester.pump();
  expect(tester.takeException(), isNull);
}

/// The fake's order, with one catalogue line and a pending discount.
Future<Order> _pendingDiscount(RecordingOrdersPort port) async {
  final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
  await port.addLine(order.id, const AddOrderLineInput(productId: 'prod-pin-580', qty: 2));
  await port.applyDiscount(order.id, const ApplyDiscountInput(amount: 1000000));
  port.log.clear();
  return order;
}

const OrderNextStep _step = OrderNextStep(event: 'bat_dau_thi_cong', to: OrderNextStepDtoTo.thicong, requires: 'x');

void main() {
  for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
    testWidgets('Đơn hàng left while the list loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingOrdersPort(held: {'list'});
      await tester.pumpWidget(_host(OrderListScreen(port: port, perms: const {})));
      expect(port.log, ['list']);
      await _leaveThenAnswer(tester, port.pendingOf('list'), error);
    });

    testWidgets('Chi tiết đơn left while the order loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingOrdersPort(held: {'get'});
      final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
      port.log.clear();
      await tester.pumpWidget(_host(OrderDetailScreen(port: port, orderId: order.id)));
      expect(port.log, ['get', 'getLifecycle', 'listVersions']);
      await _leaveThenAnswer(tester, port.pendingOf('get'), error);
    });

    testWidgets('Chi tiết đơn left while the photos load, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingOrdersPort(held: {'listAttachments'});
      final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
      await tester.pumpWidget(_host(OrderDetailScreen(port: port, orderId: order.id)));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Ảnh'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ảnh'));
      await tester.pump();
      expect(port.log.last, 'listAttachments');
      await _leaveThenAnswer(tester, port.pendingOf('listAttachments'), error);
    });

    testWidgets('Chuyển trạng thái left while the steps load, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingOrdersPort(held: {'getLifecycle'});
      await tester.pumpWidget(_host(OrderStatusChangeScreen(port: port, orderId: 'ord-1')));
      expect(port.log, ['getLifecycle']);
      await _leaveThenAnswer(tester, port.pendingOf('getLifecycle'), error);
    });

    testWidgets('Chuyển trạng thái left while the transition is sent, then the port $outcome ⇒ no crash, no onDone',
        (tester) async {
      final port = RecordingOrdersPort(
        held: {'transition'},
        answers: {
          'getLifecycle': const OrderLifecycle(steps: [], nextSteps: [_step], canCancel: false),
          'transition': const StatusChangeResult(
              status: StatusChangeResponseDtoStatus.thicong, occurredAt: '2026-10-23T00:00:00.000Z', savedAttachmentCount: 0),
        },
      );
      var done = 0;
      await tester.pumpWidget(_host(OrderStatusChangeScreen(port: port, orderId: 'ord-1', onDone: (_) => done++)));
      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Xác nhận chuyển');
      expect(port.log, ['getLifecycle', 'transition']);
      await _leaveThenAnswer(tester, port.pendingOf('transition'), error);
      expect(done, 0);
    });

    testWidgets('Duyệt chiết khấu left while the list loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingOrdersPort(held: {'listPendingDiscounts'});
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      expect(port.log, ['listPendingDiscounts']);
      await _leaveThenAnswer(tester, port.pendingOf('listPendingDiscounts'), error);
    });

    testWidgets('Duyệt chiết khấu left while a decision is sent, then the port $outcome ⇒ no crash, no reload',
        (tester) async {
      final port = RecordingOrdersPort();
      final Order order = await _pendingDiscount(port);
      port.held.add('resolveDiscount');
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      await tester.pumpAndSettle();
      await tester.tap(find.text(order.id));
      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Đồng ý chiết khấu');
      await _tapLabel(tester, 'Xác nhận');
      expect(port.log, ['listPendingDiscounts', 'resolveDiscount']);
      await _leaveThenAnswer(tester, port.pendingOf('resolveDiscount'), error);
      expect(port.log, ['listPendingDiscounts', 'resolveDiscount']);
    });

    testWidgets('Tạo báo giá left while the order is created, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingOrdersPort(held: {'create'});
      await tester.pumpWidget(_host(CreateQuoteScreen(
        ordersPort: port,
        catalogPort: FakeCatalogPort(),
        customersPort: FakeCustomersPort(),
      )));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, '0903176968');
      await _tapLabel(tester, 'Tra cứu');
      await _tapLabel(tester, 'Dùng khách này');
      expect(port.log, ['create']);
      await _leaveThenAnswer(tester, port.pendingOf('create'), error);
      expect(port.log, ['create']);
    });

    testWidgets('Tạo báo giá left while Chốt is sent, then the port $outcome ⇒ no crash, no onDone', (tester) async {
      final port = RecordingOrdersPort(held: {'confirmOrder'});
      var done = 0;
      await tester.pumpWidget(_host(CreateQuoteScreen(
        ordersPort: port,
        catalogPort: FakeCatalogPort(),
        customersPort: FakeCustomersPort(),
        perms: const {AppPermissionKeys.ordersConfirm},
        onDone: (_) => done++,
      )));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, '0903176968');
      await _tapLabel(tester, 'Tra cứu');
      await _tapLabel(tester, 'Dùng khách này');
      await _tapLabel(tester, 'Chọn từ danh mục');
      await _tapLabel(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Chốt báo giá');
      await _tapLabel(tester, 'Xác nhận');
      expect(port.log.last, 'confirmOrder');
      await _leaveThenAnswer(tester, port.pendingOf('confirmOrder'), error);
      expect(done, 0);
    });
  }

  testWidgets('Đơn hàng: the reload signal after the list is gone asks nothing', (tester) async {
    final port = RecordingOrdersPort();
    final signal = ValueNotifier<int>(0);
    addTearDown(signal.dispose);
    await tester.pumpWidget(_host(OrderListScreen(port: port, perms: const {}, reloadSignal: signal)));
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
    signal.value++;
    await tester.pump();
    expect(port.log, ['list']);
    expect(tester.takeException(), isNull);
  });
}
