// OrderListCubit (Story 11.3): the filter, paging and ticket OrderListScreen used to hold in its State.
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart' show StatusKey;
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_list_cubit.dart';
import 'package:pns_mobile/screens/orders/order_list_state.dart';

import 'recording_orders_port.dart';

/// `(status, followUp, page)` of every list call.
List<(String?, bool?, int?)> _queries(RecordingOrdersPort port) =>
    [for (final a in port.argsOf('list')) (a[0] as String?, a[1] as bool?, a[2] as int?)];

OrderPage _pageOf(List<OrderListItem> items, {int total = 45, int page = 1, int pageSize = 10}) =>
    OrderPage(items: items, total: total, page: page, pageSize: pageSize);

void main() {
  test('starts loading on page 1 of every order', () {
    final cubit = OrderListCubit(RecordingOrdersPort());
    expect(cubit.state, const OrderListState());
    cubit.close();
  });

  final ok = RecordingOrdersPort();
  blocTest<OrderListCubit, OrderListState>(
    'load ⇒ ready with the rows, total and page size from the port; Tất cả sends no status, no followUp',
    build: () => OrderListCubit(ok),
    act: (cubit) => cubit.load(),
    // bloc lets the first emit through even when it equals the initial state.
    expect: () => [
      const OrderListState(),
      OrderListState(status: OrderListStatus.ready, items: kDemoOrderRows, total: 4, pageSize: 20),
    ],
    verify: (_) => expect(_queries(ok), [(null, null, 1)]),
  );

  final followUp = RecordingOrdersPort();
  blocTest<OrderListCubit, OrderListState>(
    'Follow-up ⇒ followUp: true and no status; the state marks the filter',
    build: () => OrderListCubit(followUp),
    act: (cubit) => cubit.setFilter(kOrderFilterFollowUp),
    verify: (cubit) {
      expect(_queries(followUp), [(null, true, 1)]);
      expect(cubit.state.filter, kOrderFilterFollowUp);
    },
  );

  final byStatus = RecordingOrdersPort();
  blocTest<OrderListCubit, OrderListState>(
    'a status ⇒ that status key, no followUp',
    build: () => OrderListCubit(byStatus),
    act: (cubit) => cubit.setFilter(StatusKey.dachot.name),
    verify: (_) => expect(_queries(byStatus), [('dachot', null, 1)]),
  );

  final paged = RecordingOrdersPort();
  blocTest<OrderListCubit, OrderListState>(
    'goToPage(2) then a filter change ⇒ back to page 1',
    build: () => OrderListCubit(paged),
    act: (cubit) async {
      await cubit.goToPage(2);
      await cubit.setFilter(StatusKey.baogia.name);
    },
    verify: (cubit) {
      expect(_queries(paged), [(null, null, 2), ('baogia', null, 1)]);
      expect(cubit.state.page, 1);
    },
  );

  final reloaded = RecordingOrdersPort();
  blocTest<OrderListCubit, OrderListState>(
    'load keeps the page and the filter it was on',
    build: () => OrderListCubit(reloaded),
    act: (cubit) async {
      await cubit.setFilter(kOrderFilterFollowUp);
      await cubit.goToPage(3);
      await cubit.load();
    },
    verify: (_) => expect(_queries(reloaded).last, (null, true, 3)),
  );

  blocTest<OrderListCubit, OrderListState>(
    'a failing port ⇒ error',
    build: () => OrderListCubit(RecordingOrdersPort(errors: {'list': StateError('offline')})),
    act: (cubit) => cubit.load(),
    expect: () => [const OrderListState(), const OrderListState(status: OrderListStatus.error)],
  );

  test('a reload keeps the rows, total, page size, page and filter already shown, through loading and error', () async {
    // Every field off its default, so dropping one from an emit is visible.
    final port = RecordingOrdersPort(held: {'list'});
    final cubit = OrderListCubit(port);
    final first = cubit.setFilter(kOrderFilterFollowUp);
    port.pendingOf('list').complete(_pageOf(kDemoOrderRows.sublist(0, 2), total: 45, page: 1, pageSize: 10));
    await first;
    final second = cubit.goToPage(2);
    port.pendingOf('list', 1).complete(_pageOf(kDemoOrderRows.sublist(2), total: 45, page: 2, pageSize: 10));
    await second;
    final OrderListState shown = cubit.state;
    expect((shown.status, shown.page, shown.total, shown.pageSize, shown.filter),
        (OrderListStatus.ready, 2, 45, 10, kOrderFilterFollowUp));

    final states = <OrderListState>[];
    final sub = cubit.stream.listen(states.add);
    final third = cubit.load();
    port.pendingOf('list', 2).completeError(StateError('offline'));
    await third;
    await pumpEventQueue();
    expect(states, [
      OrderListState(items: shown.items, page: 2, total: 45, pageSize: 10, filter: kOrderFilterFollowUp),
      OrderListState(
          status: OrderListStatus.error, items: shown.items, page: 2, total: 45, pageSize: 10, filter: kOrderFilterFollowUp),
    ]);
    await sub.cancel();
    await cubit.close();
  });

  group('answers arriving out of order', () {
    for (final (outcome, Object? lateError) in [('answers', null), ('fails', StateError('offline'))]) {
      test('the first query $outcome AFTER the second ⇒ only the second is shown', () async {
        // Two DIFFERENT answers: an identical late one would be dropped as a duplicate state.
        final port = RecordingOrdersPort(held: {'list'});
        final cubit = OrderListCubit(port);
        final first = cubit.load();
        final second = cubit.setFilter(StatusKey.dachot.name);
        port.pendingOf('list', 1).complete(_pageOf([kDemoOrderRows[2]], total: 1));
        await second;
        final OrderListState shown = cubit.state;
        expect(shown.status, OrderListStatus.ready);

        final states = <OrderListState>[];
        final sub = cubit.stream.listen(states.add);
        final reply = port.pendingOf('list');
        lateError == null ? reply.complete(_pageOf(kDemoOrderRows, total: 4)) : reply.completeError(lateError);
        await first;
        await pumpEventQueue();
        expect(states, isEmpty);
        expect(cubit.state, shown);
        await sub.cancel();
        await cubit.close();
      });
    }
  });

  for (final (outcome, Object? error) in [('answering', null), ('failing', StateError('offline'))]) {
    test('the port $outcome after close ⇒ no throw, no emit', () async {
      final port = RecordingOrdersPort(held: {'list'});
      final cubit = OrderListCubit(port);
      final load = cubit.load();
      final states = <OrderListState>[];
      final sub = cubit.stream.listen(states.add);
      await cubit.close();
      final reply = port.pendingOf('list');
      error == null ? reply.complete() : reply.completeError(error);
      await load;
      expect(states, isEmpty);
      await sub.cancel();
    });
  }
}
