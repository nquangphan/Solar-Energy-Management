// DiscountApprovalCubit (Story 11.3): the list, selection and decision DiscountApprovalScreen used to hold in its State.
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/discount_approval_cubit.dart';
import 'package:pns_mobile/screens/orders/discount_approval_state.dart';

import 'recording_orders_port.dart';

/// One order awaiting approval, then a clean log.
Future<RecordingOrdersPort> _seeded({Set<String>? held, Map<String, Object>? errors}) async {
  final port = RecordingOrdersPort();
  final Order order = await port.create(const CreateOrderInput(customerPhone: '0903176968'));
  await port.addLine(order.id, const AddOrderLineInput(productId: 'prod-pin-580', qty: 2));
  await port.applyDiscount(order.id, const ApplyDiscountInput(amount: 1000000, note: 'Khách quen'));
  port.log.clear();
  port.args.clear();
  port.held.addAll(held ?? const {});
  port.errors.addAll(errors ?? const {});
  return port;
}

/// A cubit whose list is loaded and whose first item is selected.
Future<DiscountApprovalCubit> _withSelection(RecordingOrdersPort port) async {
  final cubit = DiscountApprovalCubit(port);
  await cubit.load();
  cubit.select(cubit.state.items.single);
  port.log.clear();
  port.args.clear();
  return cubit;
}

const OrderPortException _refused = OrderPortException('Đơn không còn chờ duyệt.', code: 'CONFLICT');

/// [s] with some fields replaced — built field by field, independent of the
/// production copyWith, so an expectation cannot share its carry-over bug.
DiscountApprovalState _copy(DiscountApprovalState s, {DiscountApprovalStatus? status, String? error}) =>
    DiscountApprovalState(
      status: status ?? s.status,
      items: s.items,
      selected: s.selected,
      error: error ?? s.error,
      reasonError: s.reasonError,
      resolveBusy: s.resolveBusy,
    );

void main() {
  test('starts loading, nothing selected, nothing busy', () {
    final cubit = DiscountApprovalCubit(RecordingOrdersPort());
    expect(cubit.state, const DiscountApprovalState());
    cubit.close();
  });

  late RecordingOrdersPort listed;
  blocTest<DiscountApprovalCubit, DiscountApprovalState>(
    'load ⇒ ready with the pending items the port returned',
    setUp: () async => listed = await _seeded(),
    build: () => DiscountApprovalCubit(listed),
    act: (cubit) => cubit.load(),
    // bloc lets the first emit through even when it equals the initial state.
    expect: () => [
      const DiscountApprovalState(),
      isA<DiscountApprovalState>()
          .having((s) => s.status, 'status', DiscountApprovalStatus.ready)
          .having((s) => s.items.single.amount, 'amount', 1000000),
    ],
    verify: (_) => expect(listed.log, ['listPendingDiscounts']),
  );

  blocTest<DiscountApprovalCubit, DiscountApprovalState>(
    'a failing list ⇒ error',
    build: () => DiscountApprovalCubit(RecordingOrdersPort(errors: {'listPendingDiscounts': StateError('offline')})),
    act: (cubit) => cubit.load(),
    expect: () => [const DiscountApprovalState(), const DiscountApprovalState(status: DiscountApprovalStatus.error)],
  );

  test('requireReason ⇒ the exact sentence, no request', () async {
    final port = await _seeded();
    final cubit = await _withSelection(port);
    cubit.requireReason();
    expect(cubit.state.reasonError, 'Lý do là bắt buộc khi từ chối chiết khấu.');
    expect(port.log, isEmpty);
    cubit.clearReasonError();
    expect(cubit.state.reasonError, isNull);
    await cubit.close();
  });

  test('select clears the reason error and keeps the banner', () async {
    final port = await _seeded(errors: {'resolveDiscount': _refused});
    final cubit = await _withSelection(port);
    await cubit.resolve(true, '');
    cubit.requireReason();
    final DiscountPendingItem item = cubit.state.items.single;
    cubit.select(item);
    expect(cubit.state.selected, same(item));
    expect(cubit.state.reasonError, isNull);
    expect(cubit.state.error, _refused.message);
    await cubit.close();
  });

  for (final (String typed, String? sent) in [('  lý do  ', '  lý do  '), ('', null)]) {
    test('resolve sends the reason "$typed" as ${sent == null ? 'absent' : 'typed, untrimmed'}', () async {
      final port = await _seeded();
      final cubit = await _withSelection(port);
      final String orderId = cubit.state.selected!.orderId;
      await cubit.resolve(false, typed);
      final List<Object?> call = port.argsOf('resolveDiscount').single;
      expect(call[0], orderId);
      final ResolveDiscountInput input = call[1]! as ResolveDiscountInput;
      expect(input.approve, isFalse);
      expect(input.reason, sent);
      await cubit.close();
    });
  }

  test('resolve accepted ⇒ selection, reason error and banner cleared, list reloaded, busy off AFTER the reload, true',
      () async {
    final port = await _seeded();
    final cubit = await _withSelection(port);
    cubit.requireReason();
    final states = <DiscountApprovalState>[];
    final sub = cubit.stream.listen(states.add);

    expect(await cubit.resolve(true, 'ok'), isTrue);
    await pumpEventQueue();
    expect(port.log, ['resolveDiscount', 'listPendingDiscounts']);
    expect(states.map((s) => (s.resolveBusy, s.status, s.selected == null)), [
      (true, DiscountApprovalStatus.ready, false),
      (true, DiscountApprovalStatus.ready, true),
      (true, DiscountApprovalStatus.loading, true),
      (true, DiscountApprovalStatus.ready, true),
      (false, DiscountApprovalStatus.ready, true),
    ]);
    expect(cubit.state.reasonError, isNull);
    expect(cubit.state.error, isNull);
    expect(cubit.state.items, isEmpty);
    await sub.cancel();
    await cubit.close();
  });

  test('a decision accepted after a failed one clears the old banner', () async {
    final port = await _seeded(errors: {'resolveDiscount': _refused});
    final cubit = await _withSelection(port);
    await cubit.resolve(true, '');
    expect(cubit.state.error, _refused.message);
    port.errors.clear();
    await cubit.resolve(true, '');
    expect(cubit.state.error, isNull);
    await cubit.close();
  });

  for (final (String what, Object error, String message) in [
    ('the backend refuses', _refused, _refused.message),
    ('the network fails', StateError('offline'), 'Không thực hiện được. Thử lại.'),
  ]) {
    test('resolve when $what ⇒ only the banner changes: list + selection + reason error kept, false', () async {
      final port = await _seeded(errors: {'resolveDiscount': error});
      final cubit = await _withSelection(port);
      cubit.requireReason();
      final DiscountApprovalState before = cubit.state;

      expect(await cubit.resolve(true, ''), isFalse);
      expect(port.log, ['resolveDiscount']);
      expect(cubit.state, _copy(before, error: message));
      await cubit.close();
    });
  }

  test('resolve with nothing selected ⇒ no request, false', () async {
    final port = await _seeded();
    final cubit = DiscountApprovalCubit(port);
    await cubit.load();
    port.log.clear();
    expect(await cubit.resolve(true, 'x'), isFalse);
    expect(port.log, isEmpty);
    await cubit.close();
  });

  test('a reload keeps every other field through loading and error', () async {
    final port = await _seeded(errors: {'resolveDiscount': _refused});
    final cubit = await _withSelection(port);
    await cubit.resolve(true, '');
    cubit.requireReason();
    final DiscountApprovalState shown = cubit.state;
    port.errors['listPendingDiscounts'] = StateError('offline');
    port.held.add('listPendingDiscounts');

    final load = cubit.load();
    expect(cubit.state, _copy(shown, status: DiscountApprovalStatus.loading));
    port.pendingOf('listPendingDiscounts').complete();
    await load;
    expect(cubit.state, _copy(shown, status: DiscountApprovalStatus.error));
    await cubit.close();
  });

  group('the port answering after close ⇒ no throw, no emit', () {
    for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
      test('load: the port $outcome', () async {
        final port = RecordingOrdersPort(held: {'listPendingDiscounts'});
        final cubit = DiscountApprovalCubit(port);
        final load = cubit.load();
        final states = <DiscountApprovalState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        final reply = port.pendingOf('listPendingDiscounts');
        error == null ? reply.complete() : reply.completeError(error);
        await load;
        expect(states, isEmpty);
        await sub.cancel();
      });

      test('resolve: the port $outcome ⇒ false, no reload', () async {
        final port = await _seeded(held: {'resolveDiscount'});
        final cubit = await _withSelection(port);
        final resolve = cubit.resolve(true, '');
        final states = <DiscountApprovalState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        final reply = port.pendingOf('resolveDiscount');
        error == null ? reply.complete() : reply.completeError(error);
        expect(await resolve, isFalse);
        expect(states, isEmpty);
        expect(port.log, ['resolveDiscount']);
        await sub.cancel();
      });
    }
  });
}
