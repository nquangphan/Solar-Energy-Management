// The order screens' controls and signals reach their cubit (Story 11.3). The cubit
// tests prove what each method does; these prove the SCREEN still calls it — the
// reload signal, the pager, the reload after a pushed screen closes, the photo
// picker reset, the metadata inputs, the free-line form, the catalogue search, the
// group untick, the Chốt callback, the retry buttons, the step lock while sending,
// the reason box of the discount approval and the cart inputs have no other widget
// case that would notice the wire coming off.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/catalog_port.dart';
import 'package:pns_mobile/design_system/session/fake_catalog_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/create_quote_screen.dart';
import 'package:pns_mobile/screens/orders/discount_approval_screen.dart';
import 'package:pns_mobile/screens/orders/order_detail_screen.dart';
import 'package:pns_mobile/screens/orders/order_list_screen.dart';
import 'package:pns_mobile/screens/orders/order_status_change_screen.dart';

import 'orders/recording_orders_port.dart';

/// Three pages of the demo rows, so the pager shows.
class _PagedOrdersPort extends RecordingOrdersPort {
  @override
  Future<OrderPage> list({String? status, bool? followUp, int? page, int? pageSize}) async {
    await super.list(status: status, followUp: followUp, page: page, pageSize: pageSize);
    return OrderPage(items: kDemoOrderRows, total: 45, page: page ?? 1, pageSize: 20);
  }
}

Widget _host(Widget screen) => MaterialApp(home: Scaffold(body: screen));

Future<void> _tap(WidgetTester tester, String label) async {
  final finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// The `page` of every list call.
List<int?> _pages(RecordingOrdersPort port) => [for (final a in port.argsOf('list')) a[2] as int?];

void main() {
  group('OrderListScreen', () {
    testWidgets('the reload signal asks the backend exactly once more, on the same page', (tester) async {
      final port = _PagedOrdersPort();
      final signal = ValueNotifier<int>(0);
      addTearDown(signal.dispose);
      await tester.pumpWidget(_host(OrderListScreen(port: port, perms: const {}, reloadSignal: signal)));
      await tester.pumpAndSettle();
      await _tap(tester, 'Sau');
      expect(_pages(port), [1, 2]);

      signal.value++;
      await tester.pumpAndSettle();
      expect(_pages(port), [1, 2, 2]);
    });

    testWidgets('a new reload signal replaces the old one: the old no longer reloads, the new does', (tester) async {
      final port = RecordingOrdersPort();
      final oldSignal = ValueNotifier<int>(0);
      final newSignal = ValueNotifier<int>(0);
      addTearDown(oldSignal.dispose);
      addTearDown(newSignal.dispose);
      await tester.pumpWidget(_host(OrderListScreen(port: port, perms: const {}, reloadSignal: oldSignal)));
      await tester.pumpAndSettle();
      await tester.pumpWidget(_host(OrderListScreen(port: port, perms: const {}, reloadSignal: newSignal)));
      await tester.pumpAndSettle();
      expect(port.log, ['list']);

      oldSignal.value++;
      await tester.pumpAndSettle();
      expect(port.log, ['list']);
      newSignal.value++;
      await tester.pumpAndSettle();
      expect(port.log, ['list', 'list']);
    });

    testWidgets('Sau and Trước ask the backend for the next and the previous page', (tester) async {
      final port = _PagedOrdersPort();
      await tester.pumpWidget(_host(OrderListScreen(port: port, perms: const {})));
      await tester.pumpAndSettle();
      await _tap(tester, 'Sau');
      expect(find.text('Trang 2/3'), findsOneWidget);
      await _tap(tester, 'Trước');
      expect(_pages(port), [1, 2, 1]);
      expect(find.text('Trang 1/3'), findsOneWidget);
    });

    for (final (String button, Widget Function(RecordingOrdersPort, Future<void> Function()) screen) in [
      ('Xem', (p, open) => OrderListScreen(port: p, perms: const {}, onOpen: (_) => open())),
      ('+ Tạo đơn', (p, open) => OrderListScreen(port: p, perms: const {}, onAdd: open)),
      ('Duyệt chiết khấu', (p, open) => OrderListScreen(port: p, perms: const {}, onOpenDiscountApprovals: open)),
    ]) {
      testWidgets('$button: the list reads again once the opened screen closes, not before', (tester) async {
        final port = RecordingOrdersPort();
        final closed = Completer<void>();
        var opened = 0;
        Future<void> open() {
          opened++;
          return closed.future;
        }

        await tester.pumpWidget(_host(screen(port, open)));
        await tester.pumpAndSettle();
        await _tap(tester, button);
        expect(opened, 1);
        expect(port.log, ['list']);
        closed.complete();
        await tester.pumpAndSettle();
        expect(port.log, ['list', 'list']);
      });
    }
  });

  group('OrderDetailScreen', () {
    testWidgets('Thêm ảnh sent ⇒ the picked photos are cleared (the send button goes)', (tester) async {
      _tallView(tester);
      final port = RecordingOrdersPort(answers: {'addAttachments': true, 'listAttachments': const <AttachmentItem>[]});
      final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
      await tester.pumpWidget(_host(OrderDetailScreen(
        port: port,
        orderId: order.id,
        pick: (ImageSource source) async => <XFile>[XFile('/tmp/a.jpg')],
      )));
      await tester.pumpAndSettle();
      await _tapFinder(tester, find.text('Ảnh'));
      await _tapFinder(tester, find.bySemanticsLabel('Thêm ảnh'));
      await _tapFinder(tester, find.text('Chọn từ thư viện'));
      expect(find.widgetWithText(AppButton, 'Thêm ảnh'), findsOneWidget);

      await _tap(tester, 'Thêm ảnh');
      expect(port.log.where((m) => m == 'addAttachments').length, 1);
      expect(find.widgetWithText(AppButton, 'Thêm ảnh'), findsNothing);
    });

    testWidgets('Thêm ảnh refused ⇒ the picked photos stay, ready to send again', (tester) async {
      _tallView(tester);
      final port = RecordingOrdersPort(
          errors: {'addAttachments': const OrderPortException('Không tải ảnh lên được.')},
          answers: {'listAttachments': const <AttachmentItem>[]});
      final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
      await tester.pumpWidget(_host(OrderDetailScreen(
        port: port,
        orderId: order.id,
        pick: (ImageSource source) async => <XFile>[XFile('/tmp/a.jpg')],
      )));
      await tester.pumpAndSettle();
      await _tapFinder(tester, find.text('Ảnh'));
      await _tapFinder(tester, find.bySemanticsLabel('Thêm ảnh'));
      await _tapFinder(tester, find.text('Chọn từ thư viện'));

      await _tap(tester, 'Thêm ảnh');
      expect(port.log.where((m) => m == 'addAttachments').length, 1);
      expect(find.text('Không tải được ảnh của đơn.'), findsOneWidget);

      await _tap(tester, 'Thử lại');
      expect(find.widgetWithText(AppButton, 'Thêm ảnh'), findsOneWidget);
    });

    testWidgets('without the delivery permission a pushed screen closing never reads the stock-out',
        (tester) async {
      _tallView(tester);
      final port = RecordingOrdersPort();
      final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
      final closed = Completer<void>();
      await tester.pumpWidget(_host(OrderDetailScreen(
        port: port,
        orderId: order.id,
        onOpenPaymentSchedule: () => closed.future,
      )));
      await tester.pumpAndSettle();
      await _tap(tester, 'Thanh toán');
      closed.complete();
      await tester.pumpAndSettle();
      int calls(String m) => port.log.where((x) => x == m).length;
      expect((calls('get'), calls('getStockIssue')), (2, 0));
    });

    testWidgets('a pushed screen closing re-reads the stock-out and the opened Ảnh tab too, not only the order',
        (tester) async {
      _tallView(tester);
      final port = RecordingOrdersPort(answers: {'listAttachments': const <AttachmentItem>[]});
      final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
      final closed = Completer<void>();
      await tester.pumpWidget(_host(OrderDetailScreen(
        port: port,
        orderId: order.id,
        perms: const {AppPermissionKeys.deliveryConfirm},
        onOpenPaymentSchedule: () => closed.future,
      )));
      await tester.pumpAndSettle();
      await _tapFinder(tester, find.text('Ảnh'));
      await _tapFinder(tester, find.text('Thông tin'));
      int calls(String m) => port.log.where((x) => x == m).length;
      expect((calls('get'), calls('getStockIssue'), calls('listAttachments')), (1, 1, 1));

      await _tap(tester, 'Thanh toán');
      closed.complete();
      await tester.pumpAndSettle();
      expect((calls('get'), calls('getStockIssue'), calls('listAttachments')), (2, 2, 2));
    });

    testWidgets('a cancelled order reloads WITH the skeleton (unlike the silent re-read on return)', (tester) async {
      _tallView(tester);
      final port = RecordingOrdersPort();
      final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
      await tester.pumpWidget(_host(OrderDetailScreen(port: port, orderId: order.id)));
      await tester.pumpAndSettle();
      expect(find.byType(AppSkeleton), findsNothing);

      port.held.add('get');
      await _tap(tester, 'Huỷ đơn');
      await tester.enterText(find.descendant(of: find.byType(AppDialog), matching: find.byType(TextField)), 'Khách đổi ý');
      await tester.pump();
      await tester.tap(find.widgetWithText(AppButton, 'Xác nhận huỷ'));
      await tester.pump();
      await tester.pump();
      expect(port.argsOf('cancel').single[1], 'Khách đổi ý');
      expect(find.byType(AppSkeleton), findsWidgets);
      port.pendingOf('get').complete();
      await tester.pumpAndSettle();
      expect(find.byType(AppSkeleton), findsNothing);
    });

    testWidgets('"Thử lại" on the 404 copy asks for the order again', (tester) async {
      final port = RecordingOrdersPort(errors: {'get': const OrderPortException('Không tìm thấy đơn hàng: x', code: 'NOT_FOUND')});
      final Order order = await FakeOrdersPort().create(const CreateOrderInput(customerPhone: '0903176968'));
      await tester.pumpWidget(_host(OrderDetailScreen(port: port, orderId: order.id)));
      await tester.pumpAndSettle();
      expect(find.text('Không tìm thấy đơn này.'), findsOneWidget);

      await _tap(tester, 'Thử lại');
      expect(port.log.where((m) => m == 'get').length, 2);
    });
  });

  group('OrderStatusChangeScreen', () {
    const List<OrderNextStep> twoSteps = <OrderNextStep>[
      OrderNextStep(event: 'bat_dau_thi_cong', to: OrderNextStepDtoTo.thicong, requires: 'construction.transition'),
      OrderNextStep(event: 'bat_dau_giao', to: OrderNextStepDtoTo.danggiao, requires: 'delivery.confirm'),
    ];

    bool picked(WidgetTester tester, String label) => tester
        .widget<Semantics>(find.ancestor(of: find.text(label), matching: find.byType(Semantics)).first)
        .properties
        .selected!;

    testWidgets('while the transition is being sent, tapping another step changes nothing', (tester) async {
      final port = RecordingOrdersPort(
        held: {'transition'},
        answers: {
          'getLifecycle': const OrderLifecycle(steps: <OrderLifecycleStep>[], nextSteps: twoSteps, canCancel: false),
        },
      );
      await tester.pumpWidget(MaterialApp(home: OrderStatusChangeScreen(port: port, orderId: 'ord-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Đang thi công'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận chuyển'));
      await tester.pump();
      expect(port.log.where((m) => m == 'transition').length, 1);

      await tester.tap(find.text('Đang giao'), warnIfMissed: false);
      await tester.pump();
      expect((picked(tester, 'Đang thi công'), picked(tester, 'Đang giao')), (true, false));
      port.pendingOf('transition').completeError(StateError('offline'));
      await tester.pumpAndSettle();
    });
  });

  group('DiscountApprovalScreen', () {
    Future<RecordingOrdersPort> seeded() async {
      final port = RecordingOrdersPort();
      final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
      await port.addLine(order.id, const AddOrderLineInput(productId: 'prod-pin-580', qty: 2));
      await port.applyDiscount(order.id, const ApplyDiscountInput(amount: 1000000, note: 'Khách quen'));
      port.log.clear();
      port.args.clear();
      return port;
    }

    Future<void> pickRow(WidgetTester tester) => _tapFinder(tester, find.text('ord-demo-1'));

    testWidgets('"Thử lại" after a failed list asks the backend again and shows it', (tester) async {
      final port = await seeded();
      port.errors['listPendingDiscounts'] = StateError('offline');
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      await tester.pumpAndSettle();
      expect(find.text('Không tải được danh sách chờ duyệt.'), findsOneWidget);

      port.errors.remove('listPendingDiscounts');
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(port.log, ['listPendingDiscounts', 'listPendingDiscounts']);
      expect(find.text('ord-demo-1'), findsOneWidget);
    });

    testWidgets('a reason typed after the "required" error clears that error when Từ chối opens the dialog',
        (tester) async {
      final port = await seeded();
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      await tester.pumpAndSettle();
      await pickRow(tester);
      await _tap(tester, 'Từ chối');
      expect(find.text('Lý do là bắt buộc khi từ chối chiết khấu.'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Biên quá mỏng');
      await _tap(tester, 'Từ chối');
      expect(find.byType(AppConfirmDialog), findsOneWidget);
      expect(find.text('Lý do là bắt buộc khi từ chối chiết khấu.'), findsNothing);
      expect(port.log, ['listPendingDiscounts']);
    });

    testWidgets('tapping a row again empties the reason box', (tester) async {
      final port = await seeded();
      await tester.pumpWidget(_host(DiscountApprovalScreen(ordersPort: port)));
      await tester.pumpAndSettle();
      await pickRow(tester);
      await tester.enterText(find.byType(TextField), 'Biên quá mỏng');
      await tester.pump();

      await pickRow(tester);
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, '');
    });
  });

  group('CreateQuoteScreen', () {
    Future<void> toCart(WidgetTester tester, Widget screen) async {
      _tallView(tester);
      await tester.pumpWidget(_host(screen));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, '0903176968');
      await _tap(tester, 'Tra cứu');
      await _tap(tester, 'Dùng khách này');
    }

    CreateQuoteScreen quote(RecordingOrdersPort port, {void Function(Order)? onDone}) => CreateQuoteScreen(
          ordersPort: port,
          catalogPort: FakeCatalogPort(),
          customersPort: FakeCustomersPort(),
          perms: const {AppPermissionKeys.ordersConfirm},
          onDone: onDone,
        );

    Future<void> commitKWp(WidgetTester tester, String text) async {
      await tester.enterText(_field('Công suất (kWp)'), text);
      await tester.pump();
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
    }

    testWidgets('the kWp box shows the order the backend returned, and the old one again when it refuses',
        (tester) async {
      final port = RecordingOrdersPort();
      await toCart(tester, quote(port));
      await commitKWp(tester, '8,82');
      expect(tester.widget<TextField>(_field('Công suất (kWp)')).controller!.text, '8.82');

      port.errors['updateOrderMeta'] = const OrderPortException('Không sửa được.');
      await commitKWp(tester, '9');
      expect(tester.widget<TextField>(_field('Công suất (kWp)')).controller!.text, '8.82');
    });

    testWidgets('a free line that landed ⇒ the form opens empty next time', (tester) async {
      final port = RecordingOrdersPort();
      await toCart(tester, quote(port));
      await _tap(tester, 'Dòng tự do');
      await tester.enterText(_field('Tên dòng'), 'Công lắp');
      await tester.enterText(_field('Đơn vị'), 'gói');
      await tester.enterText(_field('Số lượng'), '2');
      await tester.enterText(_field('Đơn giá'), '1000');
      await tester.enterText(_field('Diễn giải'), 'Trọn gói');
      await _tap(tester, 'Thêm dòng');
      expect(port.log.where((m) => m == 'addLine').length, 1);

      await _tap(tester, 'Dòng tự do');
      final texts = [
        for (final label in ['Tên dòng', 'Đơn vị', 'Số lượng', 'Đơn giá', 'Diễn giải'])
          tester.widget<TextField>(_field(label)).controller!.text,
      ];
      expect(texts, ['', '', '1', '0', '']);
    });

    testWidgets('Chốt accepted ⇒ the confirmed order goes to the caller', (tester) async {
      final port = RecordingOrdersPort();
      final done = <Order>[];
      await toCart(tester, quote(port, onDone: done.add));
      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      await _tap(tester, 'Chốt báo giá');
      await _tap(tester, 'Xác nhận');
      expect(done.single.status, kOrderStatusDachot);
    });

    testWidgets('a caller callback failing after Chốt shows the generic banner, as before', (tester) async {
      final port = RecordingOrdersPort();
      await toCart(tester, quote(port, onDone: (Order _) => throw StateError('navigation failed')));
      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      await _tap(tester, 'Chốt báo giá');
      await _tap(tester, 'Xác nhận');
      expect(tester.takeException(), isNull);
      expect(find.text('Không thực hiện được. Thử lại.'), findsOneWidget);
    });

    testWidgets('typing in the catalogue search shows what the backend found', (tester) async {
      final port = RecordingOrdersPort();
      await toCart(tester, quote(port));
      await _tap(tester, 'Chọn từ danh mục');
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      await tester.enterText(_field('Tìm theo tên hoặc SKU'), 'Inverter');
      await tester.pumpAndSettle();
      expect(find.text('Tấm pin JA Solar 580W'), findsNothing);
      expect(find.text('Inverter Hybrid 8kW'), findsOneWidget);
    });

    testWidgets('Vận chuyển sends the ticked value of that flag alone', (tester) async {
      final port = RecordingOrdersPort();
      await toCart(tester, quote(port));
      final bool before = tester.widget<AppCheckbox>(find.widgetWithText(AppCheckbox, 'Vận chuyển')).checked;
      await tester.tap(find.widgetWithText(AppCheckbox, 'Vận chuyển'));
      await tester.pumpAndSettle();
      final input = port.argsOf('updateScopeFlags').single[1]! as UpdateScopeFlagsInput;
      expect((input.scopeDelivery, input.scopeConstruction), (!before, null));
    });

    testWidgets('"Thử lại" on a refused change re-reads the cart and clears the message', (tester) async {
      final port = RecordingOrdersPort(errors: {'updateScopeFlags': const OrderPortException('Không sửa được.')});
      await toCart(tester, quote(port));
      await tester.tap(find.widgetWithText(AppCheckbox, 'Vận chuyển'));
      await tester.pumpAndSettle();
      expect(find.text('Không sửa được.'), findsOneWidget);

      port.log.clear();
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(port.log.first, 'get');
      expect(find.text('Không sửa được.'), findsNothing);
    });

    testWidgets('the discount dialog sends the typed amount AND note', (tester) async {
      final port = RecordingOrdersPort();
      await toCart(
          tester,
          CreateQuoteScreen(
            ordersPort: port,
            catalogPort: FakeCatalogPort(),
            customersPort: FakeCustomersPort(),
            perms: const {AppPermissionKeys.discountsApply},
          ));
      await _tap(tester, 'Chọn từ danh mục');
      await _tap(tester, 'Thêm');
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      await _tap(tester, 'Áp chiết khấu');
      final fields = find.descendant(of: find.byType(AppDialog), matching: find.byType(TextField));
      await tester.enterText(fields.first, '500000');
      await tester.enterText(fields.at(1), 'Khách quen');
      await _tap(tester, 'Gửi duyệt');
      final input = port.argsOf('applyDiscount').single[1]! as ApplyDiscountInput;
      expect((input.amount, input.note), (500000, 'Khách quen'));
    });

    testWidgets('typing a unit price on an editable cart line sends it to that line', (tester) async {
      final port = RecordingOrdersPort();
      await toCart(tester, quote(port));
      await _tap(tester, 'Dòng tự do');
      await tester.enterText(_field('Tên dòng'), 'Công lắp');
      await tester.enterText(_field('Đơn vị'), 'gói');
      await tester.enterText(_field('Số lượng'), '1');
      await tester.enterText(_field('Đơn giá'), '1000');
      await _tap(tester, 'Thêm dòng');
      final String orderId = port.argsOf('addLine').single[0]! as String;
      final String lineId = (await port.get(orderId)).lineItems.single.id;

      final price = find.descendant(
          of: find.byWidgetPredicate((Widget w) => w is AppField && w.semanticsLabel == 'Đơn giá'),
          matching: find.byType(TextField));
      await tester.enterText(price, '1500');
      await tester.pumpAndSettle();
      final List<Object?> call = port.argsOf('updateLine').last;
      expect((call[1], (call[2]! as UpdateOrderLineInput).unitPrice), (lineId, 1500));
    });

    testWidgets('a catalogue search answered after the sheet closed is dropped silently', (tester) async {
      final catalog = _HeldCatalogPort()..holdSearch = true;
      await toCart(
          tester,
          CreateQuoteScreen(
              ordersPort: RecordingOrdersPort(), catalogPort: catalog, customersPort: FakeCustomersPort()));
      await _tap(tester, 'Chọn từ danh mục');
      await tester.enterText(_field('Tìm theo tên hoặc SKU'), 'Inverter');
      await tester.pump();
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      catalog.search!.complete(const <CatalogProduct>[]);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Không thực hiện được. Thử lại.'), findsNothing);
    });

    testWidgets('a group checklist answered after the sheet closed shows the generic banner, as before',
        (tester) async {
      final catalog = _HeldCatalogPort()..holdGroup = true;
      await toCart(
          tester,
          CreateQuoteScreen(
              ordersPort: RecordingOrdersPort(), catalogPort: catalog, customersPort: FakeCustomersPort()));
      await _tap(tester, 'Chọn gói vật tư');
      await tester.tap(find.widgetWithText(AppButton, 'Mở checklist').first);
      await tester.pump();
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      catalog.group!.complete(await FakeCatalogPort().getGroup(catalog.groupId!));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Không thực hiện được. Thử lại.'), findsOneWidget);
    });

    testWidgets('a group item ticked then unticked removes exactly the line it added', (tester) async {
      final port = RecordingOrdersPort();
      await toCart(tester, quote(port));
      await _tap(tester, 'Chọn gói vật tư');
      await _tap(tester, 'Mở checklist');
      await tester.tap(find.text('Tấm pin JA Solar 580W · tấm'));
      await tester.pumpAndSettle();
      final String orderId = port.argsOf('addLine').single[0]! as String;
      final String lineId = (await port.get(orderId)).lineItems.single.id;
      await tester.tap(find.text('Tấm pin JA Solar 580W · tấm'));
      await tester.pumpAndSettle();
      expect(port.argsOf('removeLine').single[1], lineId);
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      expect(find.text('Tấm pin JA Solar 580W'), findsNothing);
    });
  });
}

/// Holds the catalogue search or the group read until the test answers it.
class _HeldCatalogPort extends FakeCatalogPort {
  bool holdSearch = false;
  bool holdGroup = false;
  Completer<List<CatalogProduct>>? search;
  Completer<CatalogGroupDetail>? group;
  String? groupId;

  @override
  Future<List<CatalogProduct>> listProducts({String? search}) {
    if (!holdSearch || search == null) return super.listProducts(search: search);
    return (this.search = Completer<List<CatalogProduct>>()).future;
  }

  @override
  Future<CatalogGroupDetail> getGroup(String id) {
    if (!holdGroup) return super.getGroup(id);
    groupId = id;
    return (group = Completer<CatalogGroupDetail>()).future;
  }
}

/// A phone-height view, so the cart and its sheets lay out without scrolling surprises.
void _tallView(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.reset);
}

/// The text field of the AppField labelled [label].
Finder _field(String label) => find.descendant(
    of: find.byWidgetPredicate((Widget w) => w is AppField && w.label == label), matching: find.byType(TextField));

Future<void> _tapFinder(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}
