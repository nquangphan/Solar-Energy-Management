// StockVouchersCubit (Story 11.4): the list, tab and detail StockVouchersScreen used to hold in its State,
// plus the calls it forwards for the two sheets.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/fake_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/stock_vouchers_port.dart';
import 'package:pns_mobile/screens/inventory/stock_vouchers_cubit.dart';
import 'package:pns_mobile/screens/inventory/stock_vouchers_state.dart';

import 'recording_stock_vouchers_port.dart';

StockVouchersCubit _cubit(RecordingStockVouchersPort port) =>
    StockVouchersCubit(port: port, inventoryPort: port);

/// Two lists and two details that differ (the generated DTOs have no `==`).
late StockVoucherList _listA;
late StockVoucherList _listB;
final StockVoucherDetail _detailA = kDemoStockVouchers[0];
final StockVoucherDetail _detailB = kDemoStockVouchers[1];

/// Every field away from its default, so a dropped carry-over shows.
StockVouchersState _seed() => StockVouchersState(
      status: StockVouchersStatus.ready,
      items: _listA.items,
      tab: kVoucherTabStockIn,
      selectedId: _detailA.id,
      detailStatus: StockVouchersStatus.ready,
      detail: _detailA,
    );

void main() {
  setUpAll(() async {
    _listA = await FakeStockVouchersPort().listVouchers(type: 'nhap');
    _listB = await FakeStockVouchersPort().listVouchers(type: 'xuat');
  });

  test('starts loading on "Tất cả", nothing opened', () {
    final cubit = _cubit(RecordingStockVouchersPort());
    expect(cubit.state, const StockVouchersState());
    cubit.close();
  });

  group('load', () {
    for (final (String tab, List<Object?> query) in [
      (kVoucherTabAll, [null, null]),
      (kVoucherTabStockIn, ['nhap', false]),
      (kVoucherTabStockOut, ['xuat', null]),
      (kVoucherTabReturn, [null, true]),
    ]) {
      late RecordingStockVouchersPort port;
      blocTest<StockVouchersCubit, StockVouchersState>(
        'tab $tab ⇒ listVouchers$query, ready with the rows; everything else carried over',
        setUp: () => port = RecordingStockVouchersPort()..answers['listVouchers'] = _listB,
        build: () => _cubit(port),
        seed: () => StockVouchersState(
          status: StockVouchersStatus.ready,
          items: _listA.items,
          tab: tab,
          selectedId: _detailA.id,
          detailStatus: StockVouchersStatus.ready,
          detail: _detailA,
        ),
        act: (cubit) => cubit.load(),
        expect: () => [
          StockVouchersState(
            items: _listA.items,
            tab: tab,
            selectedId: _detailA.id,
            detailStatus: StockVouchersStatus.ready,
            detail: _detailA,
          ),
          StockVouchersState(
            status: StockVouchersStatus.ready,
            items: _listB.items,
            tab: tab,
            selectedId: _detailA.id,
            detailStatus: StockVouchersStatus.ready,
            detail: _detailA,
          ),
        ],
        verify: (_) => expect(port.argsOf('listVouchers'), [query]),
      );
    }

    blocTest<StockVouchersCubit, StockVouchersState>(
      'a port error ⇒ error, rows and the opened voucher kept',
      build: () => _cubit(RecordingStockVouchersPort()..errors['listVouchers'] = StateError('offline')),
      seed: _seed,
      act: (cubit) => cubit.load(),
      expect: () => [
        StockVouchersState(
          items: _listA.items,
          tab: kVoucherTabStockIn,
          selectedId: _detailA.id,
          detailStatus: StockVouchersStatus.ready,
          detail: _detailA,
        ),
        StockVouchersState(
          status: StockVouchersStatus.error,
          items: _listA.items,
          tab: kVoucherTabStockIn,
          selectedId: _detailA.id,
          detailStatus: StockVouchersStatus.ready,
          detail: _detailA,
        ),
      ],
    );

    for (final outcome in ['answers', 'fails']) {
      test('ticket: the first read $outcome after the second answered ⇒ only the second shows', () async {
        final port = RecordingStockVouchersPort()..held.add('listVouchers');
        final cubit = _cubit(port);
        unawaited(cubit.load());
        unawaited(cubit.load());
        port.pendingOf('listVouchers', 1).complete(_listB);
        await pumpEventQueue();
        outcome == 'answers'
            ? port.pendingOf('listVouchers', 0).complete(_listA)
            : port.pendingOf('listVouchers', 0).completeError(StateError('late'));
        await pumpEventQueue();
        expect(cubit.state, StockVouchersState(status: StockVouchersStatus.ready, items: _listB.items));
        await cubit.close();
      });
    }
  });

  group('changeTab', () {
    late RecordingStockVouchersPort port;
    blocTest<StockVouchersCubit, StockVouchersState>(
      'another tab ⇒ the tab, then a read with its filter',
      setUp: () => port = RecordingStockVouchersPort()..answers['listVouchers'] = _listB,
      build: () => _cubit(port),
      act: (cubit) => cubit.changeTab(kVoucherTabStockOut),
      expect: () => [
        const StockVouchersState(tab: kVoucherTabStockOut),
        StockVouchersState(status: StockVouchersStatus.ready, items: _listB.items, tab: kVoucherTabStockOut),
      ],
      verify: (_) => expect(port.argsOf('listVouchers'), [
        ['xuat', null],
      ]),
    );

    blocTest<StockVouchersCubit, StockVouchersState>(
      'the same tab ⇒ nothing, no request',
      setUp: () => port = RecordingStockVouchersPort(),
      build: () => _cubit(port),
      seed: _seed,
      act: (cubit) => cubit.changeTab(kVoucherTabStockIn),
      expect: () => const <StockVouchersState>[],
      verify: (_) => expect(port.log, isEmpty),
    );
  });

  group('select', () {
    late RecordingStockVouchersPort port;
    blocTest<StockVouchersCubit, StockVouchersState>(
      'loading keeps the previous detail; then the new one; list fields carried over',
      setUp: () => port = RecordingStockVouchersPort()..answers['getVoucher'] = _detailB,
      build: () => _cubit(port),
      seed: _seed,
      act: (cubit) => cubit.select(_detailB.id),
      expect: () => [
        StockVouchersState(
          status: StockVouchersStatus.ready,
          items: _listA.items,
          tab: kVoucherTabStockIn,
          selectedId: _detailB.id,
          detail: _detailA,
        ),
        StockVouchersState(
          status: StockVouchersStatus.ready,
          items: _listA.items,
          tab: kVoucherTabStockIn,
          selectedId: _detailB.id,
          detailStatus: StockVouchersStatus.ready,
          detail: _detailB,
        ),
      ],
      verify: (_) => expect(port.argsOf('getVoucher'), [
        [_detailB.id],
      ]),
    );

    blocTest<StockVouchersCubit, StockVouchersState>(
      'a port error ⇒ detail error, the previous detail kept',
      build: () => _cubit(RecordingStockVouchersPort()..errors['getVoucher'] = StateError('offline')),
      seed: _seed,
      act: (cubit) => cubit.select(_detailB.id),
      skip: 1,
      expect: () => [
        StockVouchersState(
          status: StockVouchersStatus.ready,
          items: _listA.items,
          tab: kVoucherTabStockIn,
          selectedId: _detailB.id,
          detailStatus: StockVouchersStatus.error,
          detail: _detailA,
        ),
      ],
    );

    for (final outcome in ['answers', 'fails']) {
      test('select(a) then select(b), a $outcome last ⇒ only b shows', () async {
        final port = RecordingStockVouchersPort()..held.add('getVoucher');
        final cubit = _cubit(port);
        unawaited(cubit.select(_detailA.id));
        unawaited(cubit.select(_detailB.id));
        port.pendingOf('getVoucher', 1).complete(_detailB);
        await pumpEventQueue();
        outcome == 'answers'
            ? port.pendingOf('getVoucher', 0).complete(_detailA)
            : port.pendingOf('getVoucher', 0).completeError(StateError('late'));
        await pumpEventQueue();
        expect(cubit.state.selectedId, _detailB.id);
        expect(cubit.state.detailStatus, StockVouchersStatus.ready);
        expect(cubit.state.detail, same(_detailB));
        await cubit.close();
      });
    }
  });

  group('showCreated', () {
    late RecordingStockVouchersPort port;
    blocTest<StockVouchersCubit, StockVouchersState>(
      'a return voucher from tab Nhập ⇒ "Tất cả", listVouchers() then getVoucher(id), in that order',
      setUp: () => port = RecordingStockVouchersPort()
        ..answers['listVouchers'] = _listB
        ..answers['getVoucher'] = _detailB,
      build: () => _cubit(port),
      seed: _seed,
      act: (cubit) => cubit.showCreated(_detailB.id, fromReturn: true),
      verify: (cubit) {
        expect(port.log, ['listVouchers', 'getVoucher']);
        expect(port.args, [
          [null, null],
          [_detailB.id],
        ]);
        expect(
          cubit.state,
          StockVouchersState(
            status: StockVouchersStatus.ready,
            items: _listB.items,
            selectedId: _detailB.id,
            detailStatus: StockVouchersStatus.ready,
            detail: _detailB,
          ),
        );
      },
    );

    blocTest<StockVouchersCubit, StockVouchersState>(
      'a created voucher (not a return) ⇒ the tab stays, its filter re-read, then the voucher opened',
      setUp: () => port = RecordingStockVouchersPort()
        ..answers['listVouchers'] = _listB
        ..answers['getVoucher'] = _detailB,
      build: () => _cubit(port),
      seed: _seed,
      act: (cubit) => cubit.showCreated(_detailB.id, fromReturn: false),
      verify: (cubit) {
        expect(port.args, [
          ['nhap', false],
          [_detailB.id],
        ]);
        expect(cubit.state.tab, kVoucherTabStockIn);
      },
    );

    blocTest<StockVouchersCubit, StockVouchersState>(
      'a return voucher already on "Tất cả" ⇒ no tab emit',
      setUp: () => port = RecordingStockVouchersPort()
        ..answers['listVouchers'] = _listB
        ..answers['getVoucher'] = _detailB,
      build: () => _cubit(port),
      act: (cubit) => cubit.showCreated(_detailB.id, fromReturn: true),
      expect: () => [
        const StockVouchersState(),
        StockVouchersState(status: StockVouchersStatus.ready, items: _listB.items),
        StockVouchersState(status: StockVouchersStatus.ready, items: _listB.items, selectedId: _detailB.id),
        StockVouchersState(
          status: StockVouchersStatus.ready,
          items: _listB.items,
          selectedId: _detailB.id,
          detailStatus: StockVouchersStatus.ready,
          detail: _detailB,
        ),
      ],
    );
  });

  group('forwarded for the sheets — no emit, the port error untouched', () {
    final StateError boom = StateError('boom');

    test('searchStock ⇒ listStock(q), the very error rethrown', () async {
      final port = RecordingStockVouchersPort();
      final cubit = _cubit(port);
      final List<StockVouchersState> seen = <StockVouchersState>[];
      final StreamSubscription<StockVouchersState> sub = cubit.stream.listen(seen.add);
      expect((await cubit.searchStock('pin')).items, isNotEmpty);
      port.errors['listStock'] = boom;
      await expectLater(cubit.searchStock('x'), throwsA(same(boom)));
      expect(port.argsOf('listStock'), [
        ['pin'],
        ['x'],
      ]);
      await pumpEventQueue();
      expect(seen, isEmpty);
      await sub.cancel();
      await cubit.close();
    });

    test('createVoucher ⇒ the same input, the very error rethrown', () async {
      final port = RecordingStockVouchersPort()..errors['createVoucher'] = boom;
      final cubit = _cubit(port);
      const CreateStockVoucherInput input = CreateStockVoucherInput(
        type: CreateStockVoucherRequestDtoType.xuat,
        lines: [CreateStockVoucherLineInput(productId: 'p1', qty: 2)],
      );
      await expectLater(cubit.createVoucher(input), throwsA(same(boom)));
      expect(port.argsOf('createVoucher').single.single, same(input));
      expect(cubit.state, const StockVouchersState());
      await cubit.close();
    });

    test('createReturnVoucher ⇒ origin, note and lines as given, the very error rethrown', () async {
      final port = RecordingStockVouchersPort()..errors['createReturnVoucher'] = boom;
      final cubit = _cubit(port);
      const List<CreateReturnVoucherLineInput> lines = [CreateReturnVoucherLineInput(productId: 'p1', qty: 1)];
      await expectLater(cubit.createReturnVoucher('origin-1', note: 'n', lines: lines), throwsA(same(boom)));
      final List<Object?> args = port.argsOf('createReturnVoucher').single;
      expect(args[0], 'origin-1');
      expect(args[1], 'n');
      expect(args[2], same(lines));
      expect(cubit.state, const StockVouchersState());
      await cubit.close();
    });

    test('the forwarders return the port answer', () async {
      final port = RecordingStockVouchersPort()
        ..answers['createVoucher'] = _detailA
        ..answers['createReturnVoucher'] = _detailB;
      final cubit = _cubit(port);
      expect(
        await cubit.createVoucher(const CreateStockVoucherInput(type: CreateStockVoucherRequestDtoType.nhap, lines: [])),
        same(_detailA),
      );
      expect(await cubit.createReturnVoucher('o', lines: const []), same(_detailB));
      await cubit.close();
    });
  });

  group('closed early', () {
    for (final outcome in ['answers', 'fails']) {
      test('load: the port $outcome after close ⇒ no throw, no emit', () async {
        final port = RecordingStockVouchersPort()..held.add('listVouchers');
        final cubit = _cubit(port);
        final Future<void> pending = cubit.load();
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('listVouchers').complete(_listB)
            : port.pendingOf('listVouchers').completeError(StateError('late'));
        await pending;
        expect(cubit.state, const StockVouchersState());
      });

      test('select: the port $outcome after close ⇒ no throw, no emit', () async {
        final port = RecordingStockVouchersPort()..held.add('getVoucher');
        final cubit = _cubit(port);
        final Future<void> pending = cubit.select('x');
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('getVoucher').complete(_detailB)
            : port.pendingOf('getVoucher').completeError(StateError('late'));
        await pending;
        expect(cubit.state, const StockVouchersState(selectedId: 'x'));
      });

      test('showCreated: closed while the list read $outcome ⇒ no getVoucher', () async {
        final port = RecordingStockVouchersPort()..held.add('listVouchers');
        final cubit = _cubit(port);
        final Future<void> pending = cubit.showCreated(_detailB.id, fromReturn: true);
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('listVouchers').complete(_listB)
            : port.pendingOf('listVouchers').completeError(StateError('late'));
        await pending;
        expect(port.log, ['listVouchers']);
      });
    }
  });
}
