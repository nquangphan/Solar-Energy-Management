// Native Flutter widget tests for the Đơn hàng list screen (Story 5.3).
// Mirrors mobile/test/screens/customers/customer_screens_test.dart.
//
// These exist because mobile CAN run them. The web twin is guarded only by text
// (no tsc/bundler/JSDOM yet, TD-1), but Flutter has a real widget harness — so
// the behaviour a text-guard cannot see gets asserted here instead of taken on
// faith: that each of the four states renders its exact copy, that the two empty
// states are genuinely different, and that "Thử lại" actually calls the port again.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_list_screen.dart';

/// A port whose reads always fail — the list error state. This is also the state
/// an account lacking BOTH order-view keys lands in on mobile, where the locked
/// 5-tab bottom nav (UX-DR-15) cannot hide the tab and the backend answers 403.
class _FailingReadPort extends FakeOrdersPort {
  int calls = 0;

  @override
  Future<OrderPage> list({
    String? status,
    bool? followUp,
    int? page,
    int? pageSize,
  }) async {
    calls += 1;
    throw StateError('network down');
  }
}

/// A port that returns no rows — drives BOTH empty states depending on the filter.
class _EmptyPort extends FakeOrdersPort {
  @override
  Future<OrderPage> list({
    String? status,
    bool? followUp,
    int? page,
    int? pageSize,
  }) async =>
      OrderPage(items: const [], total: 0, page: page ?? 1, pageSize: 20);
}

/// A port that answers nothing on its own — every call parks in [pending] so the
/// test decides the ORDER in which the answers come back. Real networks do the
/// same thing; a fake that always resolves in call order can never show it.
class _ManualPort extends FakeOrdersPort {
  final List<Completer<OrderPage>> pending = <Completer<OrderPage>>[];

  @override
  Future<OrderPage> list({
    String? status,
    bool? followUp,
    int? page,
    int? pageSize,
  }) {
    final Completer<OrderPage> completer = Completer<OrderPage>();
    pending.add(completer);
    return completer.future;
  }
}

/// One-row page whose only distinguishing mark is the customer name.
OrderPage _pageOf(String customerName) => OrderPage(
      items: <OrderListItem>[
        OrderListItem(
          id: 'ord-$customerName',
          status: 'baogia',
          customerSdt: '+84900000000',
          customerName: customerName,
          ownerAccountId: 'acc-1',
          assigneeAccountId: null,
          createdAt: '2026-07-18T00:00:00.000Z',
          updatedAt: '2026-07-18T00:00:00.000Z',
        ),
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    );

Widget _host(Widget screen) => MaterialApp(home: Scaffold(body: screen));

Widget _screen(OrdersPort port) =>
    OrderListScreen(port: port, perms: const <String>{});

/// Tap the BUTTON carrying [label] — several labels also appear as chips or rows,
/// so the finder names the button explicitly.
///
/// `ensureVisible` first: the filter row wraps to several lines on a phone, so a
/// control further down the shell's scroll view can sit outside the viewport, and
/// a tap that lands on nothing would pass silently as "no state change".
Future<void> _tap(WidgetTester tester, String label) async {
  final Finder finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('loading → ready: renders the demo rows with their status chips',
      (
    tester,
  ) async {
    await tester.pumpWidget(_host(_screen(FakeOrdersPort())));

    // First frame is the loading state — the port has not answered yet.
    expect(find.text('Đang tải danh sách đơn…'), findsOneWidget);
    expect(find.byType(AppSkeleton), findsWidgets);

    await tester.pumpAndSettle();

    expect(find.text('Đang tải danh sách đơn…'), findsNothing);
    expect(find.byType(AppStatusChip), findsWidgets);
    // The rows carry the customer identity, never a money column (AD-10/16).
    expect(find.text('+84903176968'), findsWidgets);
  });

  testWidgets('follow-up filter asks the port for the unconfirmed orders only',
      (
    tester,
  ) async {
    await tester.pumpWidget(_host(_screen(FakeOrdersPort())));
    await tester.pumpAndSettle();

    await _tap(tester, 'Follow-up');

    // The fake plays the backend: follow-up = orders still at 'baogia' (FR-10),
    // so the confirmed demo order must be gone from the list.
    expect(find.byType(AppStatusChip), findsWidgets);
    for (final Element element in find.byType(AppStatusChip).evaluate()) {
      final AppStatusChip chip = element.widget as AppStatusChip;
      expect(chip.status, StatusKey.baogia);
    }
  });

  testWidgets(
      'empty + UNFILTERED shows the empty-book copy and the create action', (
    tester,
  ) async {
    await tester.pumpWidget(_host(_screen(_EmptyPort())));
    await tester.pumpAndSettle();

    expect(find.text('Chưa có đơn nào'), findsOneWidget);
    expect(find.text('Bấm ➕Tạo để bắt đầu.'), findsOneWidget);
  });

  testWidgets('empty + FILTERED shows the change-the-filter copy instead', (
    tester,
  ) async {
    await tester.pumpWidget(_host(_screen(_EmptyPort())));
    await tester.pumpAndSettle();

    await _tap(tester, 'Follow-up');

    // Two different truths ⇒ two different empty states. Collapsing them would
    // tell a user with an active filter that they have never created an order.
    expect(find.text('Không có đơn phù hợp'), findsOneWidget);
    expect(find.text('Thử đổi bộ lọc.'), findsOneWidget);
    expect(find.text('Chưa có đơn nào'), findsNothing);
  });

  testWidgets('a LATE answer to a superseded filter never repaints the list', (
    tester,
  ) async {
    final _ManualPort port = _ManualPort();
    await tester.pumpWidget(_host(_screen(port)));
    await tester.pump();

    // Request #0 is the initial unfiltered load; tapping a filter fires #1 while
    // #0 is still in flight.
    expect(port.pending, hasLength(1));
    final Finder followUp = find.widgetWithText(AppButton, 'Follow-up').first;
    await tester.ensureVisible(followUp);
    await tester.pump();
    await tester.tap(followUp);
    await tester.pump();
    expect(port.pending, hasLength(2));

    // The CURRENT request answers first, then the stale one straggles in.
    port.pending[1].complete(_pageOf('Khách hiện tại'));
    await tester.pump();
    port.pending[0].complete(_pageOf('Khách đã bỏ qua'));
    await tester.pump();

    // Without the ticket the late answer wins by arriving last, and the user
    // reads rows belonging to a filter they already left — wrong, and silent.
    expect(find.text('Khách hiện tại'), findsOneWidget);
    expect(find.text('Khách đã bỏ qua'), findsNothing);
  });

  testWidgets('error state renders the message and "Thử lại" re-calls the port',
      (
    tester,
  ) async {
    final _FailingReadPort port = _FailingReadPort();
    await tester.pumpWidget(_host(_screen(port)));
    await tester.pumpAndSettle();

    expect(find.text('Không tải được danh sách đơn.'), findsOneWidget);
    expect(port.calls, 1);

    await _tap(tester, 'Thử lại');

    // Retry must actually hit the port again — an error state whose button only
    // repaints the same message is worse than no button at all.
    expect(port.calls, 2);
    expect(find.text('Không tải được danh sách đơn.'), findsOneWidget);
  });
}
