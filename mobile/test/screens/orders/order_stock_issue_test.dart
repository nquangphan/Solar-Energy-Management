// Native Flutter widget tests for the order stock-out — mobile twin
// of web `order-stock-issue.test.tsx`.
//
// Every outer condition is switched ON in the fixtures (the order has a step,
// the caller holds the keys), so no assertion passes merely because an outer
// gate hid the thing under test. Covered: the "Đã giao" step previews the
// stock-out and relabels its button; an issued order shows its voucher code; a
// 409 renders the backend's words and the row error under the row it names; the
// detail screen's "Xuất kho" sheet reaches the port once on a double tap; the
// voucher screen tells an order-bound stock-out from a free one; and the LONGEST
// product name does not overflow at 320/360px.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/fake_inventory_port.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/fake_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/inventory/stock_vouchers_screen.dart';
import 'package:pns_mobile/screens/orders/order_detail_screen.dart';
import 'package:pns_mobile/screens/orders/order_status_change_screen.dart';

const String _kLongestName = 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha';
const String _kOrderId = 'ord-test-1';

const String _kBlockedSentence =
    'CHẶN xuất kho — Battery LiFePO4 10kWh không đủ tồn thật (cần 2, còn 0). Đơn này đã được chốt dù thiếu hàng; chặn chỉ nằm ở đây. Nhập hàng trước khi xuất.';

/// The race the server still guards: a preview read BEFORE the stock ran out
/// (not blocked, no shortfall) — the tap then hits a 409.
OrderStockIssueView _stale(OrderStockIssueView v) => OrderStockIssueView(
      issued: v.issued,
      voucher: v.voucher,
      canIssue: v.canIssue,
      blocked: false,
      lines: <OrderStockIssueLine>[
        for (final OrderStockIssueLine l in v.lines)
          OrderStockIssueLine(
            productId: l.productId,
            name: l.name,
            sku: l.sku,
            unit: l.unit,
            qty: l.qty,
            onHand: l.onHand,
            shortfall: 0,
          ),
      ],
      untrackedItems: v.untrackedItems,
    );

/// An order standing at `danggiao`: the one next step is "Đã giao".
/// `stalePreview` ⇒ the FIRST preview read is [_stale], later reads are real.
class _InDeliveryPort extends FakeOrdersPort {
  _InDeliveryPort({this.transitionError, this.stalePreview = false});

  final Object? transitionError;
  final bool stalePreview;
  int transitionCalls = 0;
  int issueCalls = 0;
  int _previewReads = 0;

  @override
  Future<OrderStockIssueView> getStockIssue(String orderId) async {
    final OrderStockIssueView real = await super.getStockIssue(orderId);
    _previewReads += 1;
    return stalePreview && _previewReads == 1 ? _stale(real) : real;
  }

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async =>
      const OrderLifecycle(
        steps: <OrderLifecycleStep>[],
        nextSteps: <OrderNextStep>[
          OrderNextStep(
            event: 'xong_giao',
            to: OrderNextStepDtoTo.dagiao,
            requires: 'delivery.confirm',
          ),
        ],
        canCancel: false,
      );

  @override
  Future<StatusChangeResult> transition(
    String orderId,
    String event,
    List<XFile> files,
  ) async {
    transitionCalls += 1;
    if (transitionError != null) throw transitionError!;
    return const StatusChangeResult(
      status: StatusChangeResponseDtoStatus.dagiao,
      occurredAt: '2026-10-21T04:00:00.000Z',
      savedAttachmentCount: 0,
    );
  }

  @override
  Future<OrderStockIssueResult> issueStock(String orderId) {
    issueCalls += 1;
    return super.issueStock(orderId);
  }
}

Order _order() => Order(
      id: _kOrderId,
      status: 'danggiao',
      customerPhone: '+84903176968',
      currentVersionId: 'ver-1',
      ownerAccountId: 'acc-1',
      sourceId: 'src-facebook',
      custType: 'CA_NHAN',
      scopeEquipment: true,
      scopeConstruction: true,
      scopeDelivery: true,
      vatMode: OrderResponseDtoVatMode.coVat,
      lineItems: <OrderLine>[],
      createdAt: DateTime.utc(2026, 7, 18),
      updatedAt: DateTime.utc(2026, 7, 18),
    );

/// A fixed order for the detail screen; `issueStock` hangs until the test lets go.
class _DetailPort extends FakeOrdersPort {
  _DetailPort({this.canIssue = true});

  final bool canIssue;
  int issueCalls = 0;
  Completer<void>? hold;

  @override
  Future<Order> get(String id) async => _order();

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async =>
      const OrderLifecycle(
        steps: <OrderLifecycleStep>[],
        nextSteps: <OrderNextStep>[],
        canCancel: false,
      );

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async =>
      const <OrderVersionItem>[];

  @override
  Future<OrderStockIssueView> getStockIssue(String orderId) async {
    final OrderStockIssueView v = await super.getStockIssue(orderId);
    if (canIssue || v.issued) return v;
    return OrderStockIssueView(
      issued: false,
      canIssue: false,
      blocked: false,
      lines: v.lines,
      untrackedItems: v.untrackedItems,
    );
  }

  @override
  Future<OrderStockIssueResult> issueStock(String orderId) async {
    issueCalls += 1;
    await hold?.future;
    return super.issueStock(orderId);
  }
}

/// An order at `dacoc` without Vận chuyển: two open steps, none preselected.
/// `previews` answers `getStockIssue` call by call (a Completer or an error);
/// `stalePreview` ⇒ the first unscripted read is [_stale].
class _TwoStepPort extends FakeOrdersPort {
  _TwoStepPort({this.transitionError, this.stalePreview = false});

  final Object? transitionError;
  final bool stalePreview;
  final List<Completer<OrderStockIssueView>> previews =
      <Completer<OrderStockIssueView>>[];
  int previewCalls = 0;

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async =>
      const OrderLifecycle(
        steps: <OrderLifecycleStep>[],
        nextSteps: <OrderNextStep>[
          OrderNextStep(
            event: 'bat_dau_thi_cong',
            to: OrderNextStepDtoTo.thicong,
            requires: 'construction.transition',
          ),
          OrderNextStep(
            event: 'xong_giao',
            to: OrderNextStepDtoTo.dagiao,
            requires: 'delivery.confirm',
          ),
        ],
        canCancel: false,
      );

  @override
  Future<OrderStockIssueView> getStockIssue(String orderId) {
    previewCalls += 1;
    if (previews.length >= previewCalls) {
      return previews[previewCalls - 1].future;
    }
    if (stalePreview && previewCalls == 1) {
      return super.getStockIssue(orderId).then(_stale);
    }
    return super.getStockIssue(orderId);
  }

  @override
  Future<StatusChangeResult> transition(
    String orderId,
    String event,
    List<XFile> anh,
  ) async {
    if (transitionError != null) throw transitionError!;
    return super.transition(orderId, event, anh);
  }
}

/// The detail port whose preview is the backend's BLOCKED warning.
class _BlockedDetailPort extends _DetailPort {
  @override
  Future<OrderStockIssueView> getStockIssue(String orderId) =>
      super.getStockIssue(kFakeOrderShortStock);
}

/// The detail port whose `issueStock` always answers the backend's 409.
class _ShortStockDetailPort extends _DetailPort {
  int previewCalls = 0;

  @override
  Future<OrderStockIssueView> getStockIssue(String orderId) {
    previewCalls += 1;
    return super.getStockIssue(orderId);
  }

  @override
  Future<OrderStockIssueResult> issueStock(String orderId) async {
    issueCalls += 1;
    throw kFakeStockIssueShortError;
  }
}

const Set<String> _kWarehousePerms = <String>{
  AppPermissionKeys.ordersViewAll,
  AppPermissionKeys.inventoryManage,
  AppPermissionKeys.deliveryConfirm,
};

Widget _statusChange(OrdersPort port, {String orderId = _kOrderId}) =>
    MaterialApp(
      home: Scaffold(
        body: OrderStatusChangeScreen(port: port, orderId: orderId),
      ),
    );

Widget _detail(OrdersPort port, {Set<String> perms = _kWarehousePerms}) =>
    MaterialApp(
      home: Scaffold(
        body: OrderDetailScreen(port: port, orderId: _kOrderId, perms: perms),
      ),
    );

void _screenSize(WidgetTester tester, double width) {
  tester.view.physicalSize = Size(width, 1600.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

void main() {
  group('Status change — "Đã giao" issues stock', () {
    testWidgets(
        'preview table (LONGEST name, Đơn cần, Tồn thật), untracked row, notecard; button relabelled',
        (tester) async {
      _screenSize(tester, 400.0);
      await tester.pumpWidget(_statusChange(_InDeliveryPort()));
      await tester.pumpAndSettle();

      expect(find.text('PHIẾU XUẤT KHO'), findsOneWidget);
      expect(find.text(_kLongestName), findsOneWidget);
      // AppTable paints its header labels upper-cased.
      expect(find.text('ĐƠN CẦN'), findsOneWidget);
      expect(find.text('TỒN THẬT'), findsOneWidget);
      expect(
        find.textContaining('Không theo kho — không có trong phiếu xuất',
            findRichText: true),
        findsOneWidget,
      );
      expect(find.textContaining('lần duy nhất', findRichText: true),
          findsOneWidget);
      expect(
        find.widgetWithText(AppButton, 'Xác nhận xuất kho & chuyển Đã giao'),
        findsOneWidget,
      );
    });

    testWidgets(
        'issued order ⇒ "Đã xuất kho · code", no table, button label kept',
        (tester) async {
      _screenSize(tester, 400.0);
      await tester.pumpWidget(
          _statusChange(_InDeliveryPort(), orderId: kFakeOrderIssued));
      await tester.pumpAndSettle();

      expect(find.text('Đã xuất kho · PK-X-0095'), findsOneWidget);
      expect(find.text('ĐƠN CẦN'), findsNothing);
      expect(find.widgetWithText(AppButton, 'Xác nhận chuyển'), findsOneWidget);
    });

    testWidgets(
        '409 short stock ⇒ banner with the backend message + error under row lines.0',
        (tester) async {
      _screenSize(tester, 400.0);
      final _InDeliveryPort port = _InDeliveryPort(
        transitionError: kFakeStockIssueShortError,
        stalePreview: true,
      );
      await tester
          .pumpWidget(_statusChange(port, orderId: kFakeOrderShortStock));
      await tester.pumpAndSettle();

      await _tap(
        tester,
        find.widgetWithText(AppButton, 'Xác nhận xuất kho & chuyển Đã giao'),
      );

      expect(port.transitionCalls, 1);
      expect(port.issueCalls, 0);
      expect(
        find.text('Không đủ tồn — không thể xuất quá số tồn hiện có.'),
        findsOneWidget,
      );
      // The row error sits in the SAME cell column as the product it names.
      final Finder shortCell = find.ancestor(
        of: find.text('Battery LiFePO4 10kWh'),
        matching: find.byType(Column),
      );
      expect(
        find.descendant(
          of: shortCell.first,
          matching: find.text('Còn 0 bình, không xuất được 2.'),
        ),
        findsOneWidget,
      );
      final Finder otherCell = find.ancestor(
        of: find.text(_kLongestName),
        matching: find.byType(Column),
      );
      expect(
        find.descendant(
          of: otherCell.first,
          matching: find.textContaining('không xuất được'),
        ),
        findsNothing,
      );
    });

    testWidgets(
        'preview blocked ⇒ CHẶN banner (one sentence per short line), "Thiếu N unit" under that row only, button LOCKED, port never called',
        (tester) async {
      _screenSize(tester, 400.0);
      final _InDeliveryPort port = _InDeliveryPort();
      await tester
          .pumpWidget(_statusChange(port, orderId: kFakeOrderShortStock));
      await tester.pumpAndSettle();

      expect(find.text(_kBlockedSentence), findsOneWidget);
      expect(find.textContaining('CHẶN xuất kho'), findsOneWidget);
      final Finder shortCell = find.ancestor(
        of: find.text('Battery LiFePO4 10kWh'),
        matching: find.byType(Column),
      );
      expect(
        find.descendant(
            of: shortCell.first, matching: find.text('Thiếu 2 bình')),
        findsOneWidget,
      );
      final Finder otherCell = find.ancestor(
        of: find.text(_kLongestName),
        matching: find.byType(Column),
      );
      expect(
        find.descendant(
            of: otherCell.first, matching: find.textContaining('Thiếu')),
        findsNothing,
      );
      final Finder button =
          find.widgetWithText(AppButton, 'Xác nhận xuất kho & chuyển Đã giao');
      expect(tester.widget<AppButton>(button).onPressed, isNull);
      await tester.ensureVisible(button);
      await tester.tap(button, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(port.transitionCalls, 0);
    });

    testWidgets(
        'preview not blocked ⇒ no CHẶN banner, no "Thiếu" row, button usable',
        (tester) async {
      _screenSize(tester, 400.0);
      await tester.pumpWidget(_statusChange(_InDeliveryPort()));
      await tester.pumpAndSettle();

      expect(find.textContaining('CHẶN xuất kho'), findsNothing);
      expect(find.textContaining('Thiếu '), findsNothing);
      expect(
        tester
            .widget<AppButton>(find.widgetWithText(
                AppButton, 'Xác nhận xuất kho & chuyển Đã giao'))
            .onPressed,
        isNotNull,
      );
    });

    for (final double width in <double>[320.0, 360.0]) {
      testWidgets('blocked banner + LONGEST name do not overflow at ${width}px',
          (tester) async {
        _screenSize(tester, width);
        await tester.pumpWidget(
            _statusChange(_InDeliveryPort(), orderId: kFakeOrderShortStock));
        await tester.pumpAndSettle();
        expect(find.text(_kBlockedSentence), findsOneWidget);
        expect(find.text(_kLongestName), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }

    for (final double width in <double>[320.0, 360.0]) {
      testWidgets('LONGEST name + row error do not overflow at ${width}px',
          (tester) async {
        _screenSize(tester, width);
        await tester.pumpWidget(_statusChange(
          _InDeliveryPort(
            transitionError: kFakeStockIssueShortError,
            stalePreview: true,
          ),
          orderId: kFakeOrderShortStock,
        ));
        await tester.pumpAndSettle();
        expect(find.text(_kLongestName), findsOneWidget);
        expect(tester.takeException(), isNull);

        await _tap(
          tester,
          find.widgetWithText(AppButton, 'Xác nhận xuất kho & chuyển Đã giao'),
        );
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('Status change — the "Đã giao" preview gates the button', () {
    Finder dangGiaoStep() => find.byWidgetPredicate(
          (Widget w) => w is AppStatusChip && w.status == StatusKey.dagiao,
        );
    Finder thiCongStep() => find.byWidgetPredicate(
          (Widget w) => w is AppStatusChip && w.status == StatusKey.thicong,
        );

    testWidgets(
        'button disabled while the preview loads, then relabelled and enabled',
        (tester) async {
      _screenSize(tester, 400.0);
      final _TwoStepPort port = _TwoStepPort()
        ..previews.add(Completer<OrderStockIssueView>());
      final OrderStockIssueView real =
          await FakeOrdersPort().getStockIssue('ord-x');
      await tester.pumpWidget(_statusChange(port, orderId: 'ord-x'));
      await tester.pumpAndSettle();

      await _tap(tester, dangGiaoStep());
      final Finder plain = find.widgetWithText(AppButton, 'Xác nhận chuyển');
      expect(tester.widget<AppButton>(plain).onPressed, isNull);

      port.previews.first.complete(real);
      await tester.pumpAndSettle();
      final Finder relabelled =
          find.widgetWithText(AppButton, 'Xác nhận xuất kho & chuyển Đã giao');
      expect(tester.widget<AppButton>(relabelled).onPressed, isNotNull);
    });

    testWidgets(
        'preview read fails ⇒ an error with "Thử lại", button disabled; retry loads it',
        (tester) async {
      _screenSize(tester, 400.0);
      final _TwoStepPort port = _TwoStepPort()
        ..previews.add(Completer<OrderStockIssueView>());
      await tester.pumpWidget(_statusChange(port, orderId: 'ord-x'));
      await tester.pumpAndSettle();

      await _tap(tester, dangGiaoStep());
      port.previews.first.completeError(Exception('network'));
      await tester.pumpAndSettle();

      expect(find.text('Không tải được phiếu xuất kho.'), findsOneWidget);
      expect(
        tester
            .widget<AppButton>(
                find.widgetWithText(AppButton, 'Xác nhận chuyển'))
            .onPressed,
        isNull,
      );

      await _tap(tester, find.textContaining('Thử lại'));
      expect(find.text(_kLongestName), findsOneWidget);
      expect(port.previewCalls, 2);
    });

    testWidgets('a late preview for a step the user already left is dropped',
        (tester) async {
      _screenSize(tester, 400.0);
      final _TwoStepPort port = _TwoStepPort()
        ..previews.add(Completer<OrderStockIssueView>());
      final OrderStockIssueView real =
          await FakeOrdersPort().getStockIssue('ord-x');
      await tester.pumpWidget(_statusChange(port, orderId: 'ord-x'));
      await tester.pumpAndSettle();

      await _tap(tester, dangGiaoStep());
      await _tap(tester, thiCongStep());
      port.previews.first.complete(real);
      await tester.pumpAndSettle();

      expect(find.text(_kLongestName), findsNothing);
      expect(find.text('ĐƠN CẦN'), findsNothing);
      expect(
        tester
            .widget<AppButton>(
                find.widgetWithText(AppButton, 'Xác nhận chuyển'))
            .onPressed,
        isNotNull,
      );
    });

    testWidgets('a 409 re-reads the preview; a new step clears the banner',
        (tester) async {
      _screenSize(tester, 400.0);
      final _TwoStepPort port = _TwoStepPort(
        transitionError: kFakeStockIssueShortError,
        stalePreview: true,
      );
      await tester
          .pumpWidget(_statusChange(port, orderId: kFakeOrderShortStock));
      await tester.pumpAndSettle();

      await _tap(tester, dangGiaoStep());
      await _tap(
        tester,
        find.widgetWithText(AppButton, 'Xác nhận xuất kho & chuyển Đã giao'),
      );

      expect(find.byType(AppBanner), findsWidgets);
      expect(find.text(kFakeStockIssueShortError.message), findsOneWidget);
      expect(port.previewCalls, 2);
      expect(find.text('Còn 0 bình, không xuất được 2.'), findsOneWidget);

      await _tap(tester, thiCongStep());
      expect(find.text(kFakeStockIssueShortError.message), findsNothing);
    });
  });

  group('Order detail — Phiếu xuất', () {
    testWidgets(
        'Xuất kho opens the preview sheet; a double tap reaches the port once; success shows the voucher code',
        (tester) async {
      _screenSize(tester, 400.0);
      final _DetailPort port = _DetailPort()..hold = Completer<void>();
      await tester.pumpWidget(_detail(port));
      await tester.pumpAndSettle();

      expect(find.text('PHIẾU XUẤT'), findsOneWidget);
      await _tap(tester, find.widgetWithText(AppButton, 'Xuất kho'));
      expect(find.text(_kLongestName), findsOneWidget);

      final Finder confirm =
          find.widgetWithText(AppButton, 'Xác nhận xuất kho');
      await tester.tap(confirm);
      await tester.pump();
      await tester.tap(confirm, warnIfMissed: false);
      await tester.pump();
      expect(port.issueCalls, 1);
      expect(tester.widget<AppButton>(confirm).onPressed, isNull);

      port.hold!.complete();
      await tester.pumpAndSettle();
      expect(find.textContaining('PK-X-0097'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Xuất kho'), findsNothing);
    });

    testWidgets(
        '409 short stock in the sheet ⇒ backend message + row error under the row it names; button usable again',
        (tester) async {
      _screenSize(tester, 400.0);
      final _ShortStockDetailPort port = _ShortStockDetailPort();
      await tester.pumpWidget(_detail(port));
      await tester.pumpAndSettle();

      await _tap(tester, find.widgetWithText(AppButton, 'Xuất kho'));
      final Finder confirm =
          find.widgetWithText(AppButton, 'Xác nhận xuất kho');
      await _tap(tester, confirm);

      expect(port.issueCalls, 1);
      expect(find.text(kFakeStockIssueShortError.message), findsOneWidget);
      // The refusal re-reads the preview: current numbers next to the messages.
      expect(port.previewCalls, 2);
      // `lines.0` is the FIRST row of the preview the backend sent.
      final Finder named = find.ancestor(
        of: find.text(_kLongestName),
        matching: find.byType(Column),
      );
      expect(
        find.descendant(
          of: named.first,
          matching: find.text('Còn 0 bình, không xuất được 2.'),
        ),
        findsOneWidget,
      );
      final Finder other = find.ancestor(
        of: find.text('Tấm pin AE 630W'),
        matching: find.byType(Column),
      );
      expect(
        find.descendant(
          of: other.first,
          matching: find.textContaining('không xuất được'),
        ),
        findsNothing,
      );
      expect(tester.widget<AppButton>(confirm).onPressed, isNotNull);
      await _tap(tester, confirm);
      expect(port.issueCalls, 2);
    });

    testWidgets(
        'preview blocked ⇒ the sheet shows the CHẶN banner and a LOCKED "Xuất kho (bị chặn)"; the port is never called',
        (tester) async {
      _screenSize(tester, 400.0);
      final _BlockedDetailPort port = _BlockedDetailPort();
      await tester.pumpWidget(_detail(port));
      await tester.pumpAndSettle();

      await _tap(tester, find.widgetWithText(AppButton, 'Xuất kho'));
      expect(find.text(_kBlockedSentence), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Xác nhận xuất kho'), findsNothing);
      final Finder locked =
          find.widgetWithText(AppButton, 'Xuất kho (bị chặn)');
      expect(tester.widget<AppButton>(locked).onPressed, isNull);
      await tester.ensureVisible(locked);
      await tester.tap(locked, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(port.issueCalls, 0);
      expect(tester.takeException(), isNull);
    });

    testWidgets('cannot issue ⇒ "Chưa xuất kho.", no button', (tester) async {
      _screenSize(tester, 400.0);
      await tester.pumpWidget(_detail(_DetailPort(canIssue: false)));
      await tester.pumpAndSettle();

      expect(find.text('Chưa xuất kho.'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Xuất kho'), findsNothing);
    });

    testWidgets('neither inventory.manage nor delivery.confirm ⇒ no frame',
        (tester) async {
      _screenSize(tester, 400.0);
      await tester.pumpWidget(_detail(
        _DetailPort(),
        perms: const <String>{AppPermissionKeys.ordersViewAll},
      ));
      await tester.pumpAndSettle();

      expect(find.text('VÒNG ĐỜI ĐƠN'), findsOneWidget);
      expect(find.text('PHIẾU XUẤT'), findsNothing);
    });

    for (final double width in <double>[320.0, 360.0]) {
      testWidgets(
          'stock-issue sheet with the LONGEST name does not overflow at ${width}px',
          (tester) async {
        _screenSize(tester, width);
        await tester.pumpWidget(_detail(_DetailPort()));
        await tester.pumpAndSettle();
        await _tap(tester, find.widgetWithText(AppButton, 'Xuất kho'));
        expect(find.text(_kLongestName), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('Equipment-only order at dachot — issue before the direct close', () {
    Future<String> confirmed(FakeOrdersPort port) async {
      final Order order = await port
          .create(const CreateOrderInput(customerPhone: '+84903176968'));
      await port.confirmOrder(order.id);
      return order.id;
    }

    Widget closeScreen(OrdersPort port, String orderId, List<String> done) =>
        MaterialApp(
          home: Scaffold(
            body: OrderStatusChangeScreen(
              port: port,
              orderId: orderId,
              onDone: done.add,
            ),
          ),
        );

    testWidgets(
        'detail screen of a dachot order offers "Xuất kho" (the backend says canIssue)',
        (tester) async {
      _screenSize(tester, 400.0);
      final FakeOrdersPort port = FakeOrdersPort();
      final String id = await confirmed(port);
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: OrderDetailScreen(
              port: port, orderId: id, perms: _kWarehousePerms),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(AppButton, 'Xuất kho'), findsOneWidget);
    });

    testWidgets(
        'direct close before the stock-out ⇒ the backend message in a danger banner, onDone not called',
        (tester) async {
      _screenSize(tester, 400.0);
      final FakeOrdersPort port = FakeOrdersPort();
      final String id = await confirmed(port);
      final List<String> done = <String>[];
      await tester.pumpWidget(closeScreen(port, id, done));
      await tester.pumpAndSettle();

      await _tap(tester, find.widgetWithText(AppButton, 'Xác nhận chuyển'));

      final Finder banner = find.byType(AppBanner);
      expect(banner, findsOneWidget);
      expect(tester.widget<AppBanner>(banner).tone, AppBannerTone.danger);
      expect(
        find.descendant(
          of: banner,
          matching: find.text(kFakeCloseBeforeIssueError.message),
        ),
        findsOneWidget,
      );
      expect(done, isEmpty);
    });

    testWidgets('after the stock-out the same close goes through',
        (tester) async {
      _screenSize(tester, 400.0);
      final FakeOrdersPort port = FakeOrdersPort();
      final String id = await confirmed(port);
      await port.issueStock(id);
      final List<String> done = <String>[];
      await tester.pumpWidget(closeScreen(port, id, done));
      await tester.pumpAndSettle();

      await _tap(tester, find.widgetWithText(AppButton, 'Xác nhận chuyển'));

      expect(done, <String>['hoanthanh']);
      expect(find.byType(AppBanner), findsNothing);
    });
  });

  group('Phiếu kho — order-bound voucher detail', () {
    Widget host() => MaterialApp(
          home: Scaffold(
            body: StockVouchersScreen(
              port: FakeStockVouchersPort(),
              inventoryPort: const FakeInventoryPort(),
            ),
          ),
        );

    testWidgets(
        'order-bound ⇒ "Xuất kho · gắn đơn", Gắn đơn, Người xác nhận, notecard',
        (tester) async {
      _screenSize(tester, 400.0);
      await tester.pumpWidget(host());
      await tester.pumpAndSettle();
      await _tap(tester, find.text('PK-X-0095'));

      expect(find.text('Xuất kho · gắn đơn'), findsOneWidget);
      expect(find.text('Gắn đơn'), findsOneWidget);
      expect(find.text(kFakeOrderIssued), findsOneWidget);
      expect(find.text('Người xác nhận'), findsOneWidget);
      expect(find.text('Người tạo'), findsNothing);
      expect(
        find.textContaining('Một Đơn — một phiếu xuất.', findRichText: true),
        findsOneWidget,
      );
    });

    testWidgets('free-standing ⇒ "Xuất kho · không gắn đơn", Người tạo',
        (tester) async {
      _screenSize(tester, 400.0);
      await tester.pumpWidget(host());
      await tester.pumpAndSettle();
      await _tap(tester, find.text('PK-X-0096'));

      expect(find.text('Xuất kho · không gắn đơn'), findsOneWidget);
      expect(find.text('Người tạo'), findsOneWidget);
      expect(find.text('Gắn đơn'), findsNothing);
    });
  });
}
