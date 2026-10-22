// Native Flutter widget tests for HUỶ ĐƠN on the Chi tiết đơn screen
// (Story 5.7, FR-9).
//
// These exist because the web twin is guarded only by text (TD-1): a text-guard
// can see that the string 'Huỷ đơn' appears in a file, but not that the button
// actually renders, that it disappears when the backend says it must, that the
// dialog opens, or that confirming is blocked until a reason is typed. Those are
// asserted here.
//
// THE MOST IMPORTANT CASE IS `canCancel: true` WITH AN EMPTY `buocKeTiep`. That is
// the real shape at 'baogia' — the status orders are cancelled from most often —
// and it is exactly the shape a shared `buocKeTiep.isNotEmpty` wrapper would
// render as nothing at all.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_detail_screen.dart';

const String _kOrderId = 'ord-huy-1';

Order _order({String status = 'baogia', String? cancelReason}) => Order(
      id: _kOrderId,
      status: status,
      customerPhone: '+84903176968',
      currentVersionId: 'ver-1',
      ownerAccountId: 'acc-1',
      sourceId: 'src-facebook',
      custType: 'CA_NHAN',
      scopeEquipment: true,
      scopeConstruction: false,
      scopeDelivery: false,
      vatMode: OrderResponseDtoVatMode.coVat,
      cancelReason: cancelReason,
      cancelledAt: cancelReason == null ? null : DateTime.utc(2026, 7, 18),
      lineItems: const <OrderLine>[],
      createdAt: DateTime.utc(2026, 7, 18),
      updatedAt: DateTime.utc(2026, 7, 18),
    );

/// A port that answers a fixed order + `coTheHuy`, and records the cancel call.
class _HuyPort extends FakeOrdersPort {
  _HuyPort({this.canCancel = true, this.loi, this.coBuocKeTiep = false});

  final bool canCancel;

  /// When true the lifecycle also offers a manual-lane step, so the OUTER
  /// action-container condition is satisfied on its own. Without this the
  /// `canCancel: false` case proves nothing: the whole container is skipped and
  /// the button would be absent even with its own gate deleted.
  final bool coBuocKeTiep;

  /// Every cancellable status behaves the same; 'baogia' is the one that
  /// matters because its `buocKeTiep` is empty.
  static const String status = 'baogia';

  /// When set, `cancel` throws it instead of succeeding.
  final OrderPortException? loi;

  final List<String> lyDoDaGui = <String>[];
  String? cancelReason;

  @override
  Future<Order> get(String id) async => _order(
      status: cancelReason == null ? status : 'huy',
      cancelReason: cancelReason);

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async => OrderLifecycle(
        steps: <OrderLifecycleStep>[
          OrderLifecycleStep(
            status: OrderLifecycleStepDtoStatus.fromJson(status),
            progress: OrderLifecycleStepDtoProgress.current,
          ),
        ],
        // EMPTY on purpose: at 'baogia' no manual-lane step is available, which
        // is the exact shape that hides a wrongly-nested cancel button.
        nextSteps: coBuocKeTiep
            ? const <OrderNextStep>[
                OrderNextStep(
                  event: 'bat_dau_thi_cong',
                  to: OrderNextStepDtoTo.thicong,
                  requires: 'quotes.create_edit',
                ),
              ]
            : const <OrderNextStep>[],
        canCancel: cancelReason == null && canCancel,
      );

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async =>
      const <OrderVersionItem>[];

  @override
  Future<void> cancel(String orderId, String reason) async {
    if (loi != null) throw loi!;
    lyDoDaGui.add(reason);
    cancelReason = reason.trim();
  }
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
  testWidgets('coTheHuy true + buocKeTiep EMPTY ⇒ nút "Huỷ đơn" vẫn hiện',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_HuyPort()));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(AppButton, 'Huỷ đơn'), findsOneWidget);
    // And the transition button is genuinely absent — the two gates are
    // independent, not one wrapper.
    expect(find.widgetWithText(AppButton, 'Chuyển trạng thái'), findsNothing);
  });

  testWidgets('coTheHuy false ⇒ nút ẨN HẲN, không vẽ xám (UX-DR-22)',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_HuyPort(canCancel: false)));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(AppButton, 'Huỷ đơn'), findsNothing);
  });

  testWidgets(
      'coTheHuy false NHƯNG có bước kế ⇒ nút "Chuyển trạng thái" hiện, "Huỷ đơn" vẫn ẩn',
      (WidgetTester tester) async {
    // The case above cannot see the button's OWN gate: with an empty
    // `buocKeTiep` and no `onChangeStatus`, the action container never renders,
    // so deleting `if (_coTheHuy)` would still leave the button absent and the
    // test still green. Here the container DOES render — a lost gate shows up.
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderDetailScreen(
            port: _HuyPort(canCancel: false, coBuocKeTiep: true),
            orderId: _kOrderId,
            onChangeStatus: () async {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.widgetWithText(AppButton, 'Chuyển trạng thái'), findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Huỷ đơn'), findsNothing);
  });

  testWidgets('bấm "Huỷ đơn" mở Dialog nêu hậu quả + ô lý do',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_HuyPort()));
    await tester.pumpAndSettle();

    await _tap(tester, find.widgetWithText(AppButton, 'Huỷ đơn'));

    expect(find.byType(AppDialog), findsOneWidget);
    expect(
      find.text(
        'Đơn sẽ đóng lại và không tiếp tục được. Thao tác này không hoàn tác được.',
      ),
      findsOneWidget,
    );
    // AppField upper-cases its caption for display (`.flabel`), so the visible
    // text differs from the source string the parity guard compares.
    expect(find.text('Lý do huỷ'.toUpperCase()), findsOneWidget);
  });

  testWidgets('lý do rỗng ⇒ nút xác nhận BỊ CHẶN, port không được gọi',
      (WidgetTester tester) async {
    final _HuyPort port = _HuyPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();
    await _tap(tester, find.widgetWithText(AppButton, 'Huỷ đơn'));

    await _tap(tester, find.widgetWithText(AppButton, 'Xác nhận huỷ'));

    expect(port.lyDoDaGui, isEmpty);
    // Dialog stays open: a refusal the user cannot see is a dead button.
    expect(find.byType(AppDialog), findsOneWidget);
  });

  testWidgets('chỉ khoảng trắng cũng BỊ CHẶN — trim trước khi xét',
      (WidgetTester tester) async {
    final _HuyPort port = _HuyPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();
    await _tap(tester, find.widgetWithText(AppButton, 'Huỷ đơn'));

    await tester.enterText(find.byType(TextField), '    ');
    await tester.pumpAndSettle();
    await _tap(tester, find.widgetWithText(AppButton, 'Xác nhận huỷ'));

    expect(port.lyDoDaGui, isEmpty);
  });

  testWidgets('có lý do ⇒ gọi port đúng tham số, dialog đóng, màn nạp lại',
      (WidgetTester tester) async {
    final _HuyPort port = _HuyPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();
    await _tap(tester, find.widgetWithText(AppButton, 'Huỷ đơn'));

    await tester.enterText(find.byType(TextField), 'Khách đổi ý');
    await tester.pumpAndSettle();
    await _tap(tester, find.widgetWithText(AppButton, 'Xác nhận huỷ'));

    expect(port.lyDoDaGui, <String>['Khách đổi ý']);
    expect(find.byType(AppDialog), findsNothing);
    // Reloaded, so the button is gone and the reason is on the facts tab.
    expect(find.widgetWithText(AppButton, 'Huỷ đơn'), findsNothing);
    expect(find.text('Lý do huỷ'), findsOneWidget);
    expect(find.text('Khách đổi ý'), findsOneWidget);
  });

  testWidgets(
      'backend từ chối ⇒ thông điệp của SERVER hiện nguyên văn, dialog mở',
      (WidgetTester tester) async {
    final _HuyPort port = _HuyPort(
      loi: const OrderPortException(
        'Không huỷ được đơn ở trạng thái hiện tại.',
        code: 'CONFLICT',
      ),
    );
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();
    await _tap(tester, find.widgetWithText(AppButton, 'Huỷ đơn'));

    await tester.enterText(find.byType(TextField), 'Khách đổi ý');
    await tester.pumpAndSettle();
    await _tap(tester, find.widgetWithText(AppButton, 'Xác nhận huỷ'));

    expect(
        find.text('Không huỷ được đơn ở trạng thái hiện tại.'), findsOneWidget);
    // The typed reason survives the refusal — retyping it is a punishment.
    expect(find.byType(AppDialog), findsOneWidget);
  });

  testWidgets('đơn chưa huỷ ⇒ KHÔNG có hàng "Lý do huỷ" ở tab Thông tin',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_HuyPort()));
    await tester.pumpAndSettle();

    expect(find.text('Lý do huỷ'), findsNothing);
  });
}
