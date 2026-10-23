// InventoryCubit (Story 11.4): the stock read InventoryScreen used to hold in its State.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/fake_inventory_port.dart';
import 'package:pns_mobile/design_system/session/inventory_port.dart';
import 'package:pns_mobile/screens/inventory/inventory_cubit.dart';
import 'package:pns_mobile/screens/inventory/inventory_state.dart';

/// Every listStock call waits on its own completer until the test answers it.
class _HeldInventoryPort implements InventoryPort {
  final List<Completer<StockList>> calls = <Completer<StockList>>[];

  @override
  Future<StockList> listStock({String? q}) {
    final Completer<StockList> reply = Completer<StockList>();
    calls.add(reply);
    return reply.future;
  }
}

class _FailingInventoryPort implements InventoryPort {
  int calls = 0;

  @override
  Future<StockList> listStock({String? q}) async {
    calls++;
    throw StateError('offline');
  }
}

StockList _list(String id) => StockList(items: [
      StockItemView(
        productId: id,
        sku: 'SKU-$id',
        name: 'Product $id',
        unit: 'cái',
        onHand: 1,
        reserved: 0,
        available: 1,
        toPurchase: 0,
        stockStatus: kDemoStockList.items.first.stockStatus,
      ),
    ], purchaseList: const []);

void main() {
  test('starts loading', () {
    final cubit = InventoryCubit(const FakeInventoryPort());
    expect(cubit.state, const InventoryLoading());
    cubit.close();
  });

  blocTest<InventoryCubit, InventoryState>(
    'load ⇒ ready with the very StockList the port returned',
    build: () => InventoryCubit(const FakeInventoryPort()),
    act: (cubit) => cubit.load(),
    expect: () => [const InventoryLoading(), const InventoryReady(kDemoStockList)],
    verify: (cubit) => expect((cubit.state as InventoryReady).data, same(kDemoStockList)),
  );

  final failing = _FailingInventoryPort();
  blocTest<InventoryCubit, InventoryState>(
    'a port error ⇒ error',
    build: () => InventoryCubit(failing),
    act: (cubit) => cubit.load(),
    expect: () => [const InventoryLoading(), const InventoryError()],
    verify: (_) => expect(failing.calls, 1),
  );

  blocTest<InventoryCubit, InventoryState>(
    'a reload from ready ⇒ loading, then ready again',
    build: () => InventoryCubit(const FakeInventoryPort()),
    seed: () => const InventoryReady(kDemoStockList),
    act: (cubit) => cubit.load(),
    expect: () => [const InventoryLoading(), const InventoryReady(kDemoStockList)],
  );

  blocTest<InventoryCubit, InventoryState>(
    'a reload after an error ⇒ loading, then ready',
    build: () => InventoryCubit(const FakeInventoryPort()),
    seed: () => const InventoryError(),
    act: (cubit) => cubit.load(),
    expect: () => [const InventoryLoading(), const InventoryReady(kDemoStockList)],
  );

  // Pins the behaviour as it is (TD-75): there is no ticket, so two overlapping
  // reads let the answer that arrives LAST win, even when it was asked first.
  test('two overlapping loads, the first answering last ⇒ the later answer wins (no ticket, TD-75)', () async {
    final port = _HeldInventoryPort();
    final cubit = InventoryCubit(port);
    final StockList first = _list('first');
    final StockList second = _list('second');
    unawaited(cubit.load());
    unawaited(cubit.load());
    expect(port.calls, hasLength(2));
    port.calls[1].complete(second);
    await pumpEventQueue();
    expect((cubit.state as InventoryReady).data, same(second));
    port.calls[0].complete(first);
    await pumpEventQueue();
    expect((cubit.state as InventoryReady).data, same(first));
    await cubit.close();
  });

  for (final outcome in ['answers', 'fails']) {
    test('the port $outcome after close ⇒ no throw, no emit', () async {
      final port = _HeldInventoryPort();
      final cubit = InventoryCubit(port);
      final List<InventoryState> seen = <InventoryState>[];
      final StreamSubscription<InventoryState> sub = cubit.stream.listen(seen.add);
      final Future<void> pending = cubit.load();
      await pumpEventQueue();
      seen.clear();
      await cubit.close();
      if (outcome == 'answers') {
        port.calls.single.complete(kDemoStockList);
      } else {
        port.calls.single.completeError(StateError('offline'));
      }
      await pending;
      expect(seen, isEmpty);
      await sub.cancel();
    });
  }
}
