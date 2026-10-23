// InvoicesCubit (Story 11.4): the overview and create InvoicesScreen used to hold in its State.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/fake_invoices_port.dart';
import 'package:pns_mobile/design_system/session/invoices_port.dart';
import 'package:pns_mobile/screens/invoices/invoices_cubit.dart';
import 'package:pns_mobile/screens/invoices/invoices_state.dart';

import 'recording_invoices_port.dart';

const String _orderId = 'order-1';
const String _unknownError = 'Không tạo được hoá đơn. Vui lòng thử lại.';

/// [_a] has no invoice for the current version; [_b] has one (the create landed).
late InvoicesOverview _a;
late InvoicesOverview _b;

InvoicesState _ready(InvoicesOverview o, {bool busy = false, String? error}) =>
    InvoicesState(status: InvoicesStatus.ready, overview: o, busy: busy, error: error);

RecordingInvoicesPort _portAnswering(InvoicesOverview o) => RecordingInvoicesPort()..answers['getOverview'] = o;

void main() {
  setUpAll(() async {
    _a = await FakeInvoicesPort().getOverview(_orderId);
    _b = await FakeInvoicesPort(currentInvoiceId: 'invoice-1', creatable: false).getOverview(_orderId);
  });

  test('starts loading, no overview, not busy, no banner', () {
    final cubit = InvoicesCubit(RecordingInvoicesPort(), _orderId);
    expect(cubit.state, const InvoicesState());
    cubit.close();
  });

  group('load', () {
    late RecordingInvoicesPort port;
    blocTest<InvoicesCubit, InvoicesState>(
      'ok ⇒ loading, then ready with the overview of this order',
      setUp: () => port = _portAnswering(_a),
      build: () => InvoicesCubit(port, _orderId),
      act: (cubit) => cubit.load(),
      expect: () => [const InvoicesState(), _ready(_a)],
      verify: (_) => expect(port.argsOf('getOverview'), [
        [_orderId],
      ]),
    );

    blocTest<InvoicesCubit, InvoicesState>(
      'a port error ⇒ error',
      build: () => InvoicesCubit(RecordingInvoicesPort()..errors['getOverview'] = StateError('offline'), _orderId),
      act: (cubit) => cubit.load(),
      expect: () => [const InvoicesState(), const InvoicesState(status: InvoicesStatus.error)],
    );

    blocTest<InvoicesCubit, InvoicesState>(
      'a silent re-read that fails keeps the overview, still ready, busy and banner untouched',
      build: () => InvoicesCubit(RecordingInvoicesPort()..errors['getOverview'] = StateError('offline'), _orderId),
      seed: () => _ready(_a, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(showSkeleton: false),
      expect: () => const <InvoicesState>[],
    );

    blocTest<InvoicesCubit, InvoicesState>(
      'a silent re-read with no overview yet that fails ⇒ error',
      build: () => InvoicesCubit(RecordingInvoicesPort()..errors['getOverview'] = StateError('offline'), _orderId),
      seed: () => const InvoicesState(status: InvoicesStatus.ready, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(showSkeleton: false),
      expect: () => const [InvoicesState(status: InvoicesStatus.error, busy: true, error: 'banner')],
    );

    blocTest<InvoicesCubit, InvoicesState>(
      'a reload with the skeleton keeps the overview, busy and banner behind it',
      build: () => InvoicesCubit(_portAnswering(_b), _orderId),
      seed: () => _ready(_a, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(),
      expect: () => [
        InvoicesState(status: InvoicesStatus.loading, overview: _a, busy: true, error: 'banner'),
        _ready(_b, busy: true, error: 'banner'),
      ],
    );

    for (final outcome in ['answers', 'fails']) {
      test('ticket: the first read $outcome after the second answered ⇒ only the second shows', () async {
        final port = RecordingInvoicesPort()..held.add('getOverview');
        final cubit = InvoicesCubit(port, _orderId);
        unawaited(cubit.load());
        unawaited(cubit.load());
        port.pendingOf('getOverview', 1).complete(_b);
        await pumpEventQueue();
        outcome == 'answers'
            ? port.pendingOf('getOverview', 0).complete(_a)
            : port.pendingOf('getOverview', 0).completeError(StateError('late'));
        await pumpEventQueue();
        expect(cubit.state, _ready(_b));
        await cubit.close();
      });
    }
  });

  group('create', () {
    late RecordingInvoicesPort port;

    blocTest<InvoicesCubit, InvoicesState>(
      'ok ⇒ busy (banner cleared), create, re-read WHILE STILL busy, then the button back',
      setUp: () => port = _portAnswering(_b),
      build: () => InvoicesCubit(port, _orderId),
      seed: () => _ready(_a, error: 'old banner'),
      act: (cubit) => cubit.create(),
      expect: () => [_ready(_a, busy: true), _ready(_b, busy: true), _ready(_b)],
      verify: (_) {
        expect(port.log, ['createInvoice', 'getOverview']);
        expect(port.argsOf('createInvoice'), [
          [_orderId],
        ]);
      },
    );

    test('the button stays disabled until the re-read answers', () async {
      final port = RecordingInvoicesPort()..held.add('getOverview');
      final cubit = InvoicesCubit(port, _orderId);
      cubit.emit(_ready(_a));
      final Future<void> run = cubit.create();
      await pumpEventQueue();
      expect(port.log, ['createInvoice', 'getOverview']);
      expect(cubit.state, _ready(_a, busy: true));
      port.pendingOf('getOverview').complete(_b);
      await run;
      expect(cubit.state, _ready(_b));
      await cubit.close();
    });

    blocTest<InvoicesCubit, InvoicesState>(
      'an InvoicesPortError ⇒ its message verbatim, kept even when the re-read shows an invoice',
      setUp: () => port = _portAnswering(_b)
        ..errors['createInvoice'] = const InvoicesPortError(status: 409, message: 'Bản này đã có hoá đơn.'),
      build: () => InvoicesCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.create(),
      expect: () => [
        _ready(_a, busy: true),
        _ready(_a, busy: true, error: 'Bản này đã có hoá đơn.'),
        _ready(_b, busy: true, error: 'Bản này đã có hoá đơn.'),
        _ready(_b, error: 'Bản này đã có hoá đơn.'),
      ],
    );

    blocTest<InvoicesCubit, InvoicesState>(
      'a lost response whose invoice was in fact created ⇒ the fallback banner is cleared by the re-read',
      setUp: () => port = _portAnswering(_b)..errors['createInvoice'] = StateError('connection reset'),
      build: () => InvoicesCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.create(),
      expect: () => [
        _ready(_a, busy: true),
        _ready(_a, busy: true, error: _unknownError),
        _ready(_b, busy: true, error: _unknownError),
        _ready(_b),
      ],
    );

    blocTest<InvoicesCubit, InvoicesState>(
      'a lost response with no invoice after the re-read ⇒ the fallback banner stays',
      setUp: () => port = _portAnswering(_a)..errors['createInvoice'] = StateError('connection reset'),
      build: () => InvoicesCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.create(),
      verify: (cubit) => expect(cubit.state, _ready(_a, error: _unknownError)),
    );

    blocTest<InvoicesCubit, InvoicesState>(
      'a lost response whose re-read fails ⇒ the old overview and the fallback banner stay',
      setUp: () => port = RecordingInvoicesPort()
        ..errors['createInvoice'] = StateError('connection reset')
        ..errors['getOverview'] = StateError('offline'),
      build: () => InvoicesCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.create(),
      verify: (cubit) => expect(cubit.state, _ready(_a, error: _unknownError)),
    );

    test('a second confirm while busy ⇒ no request', () async {
      final port = _portAnswering(_b)..held.add('createInvoice');
      final cubit = InvoicesCubit(port, _orderId);
      cubit.emit(_ready(_a));
      final Future<void> first = cubit.create();
      await cubit.create();
      expect(port.log, ['createInvoice']);
      port.pendingOf('createInvoice').complete();
      await first;
      expect(port.log, ['createInvoice', 'getOverview']);
      await cubit.close();
    });
  });

  group('closed early', () {
    for (final outcome in ['answers', 'fails']) {
      test('load: the port $outcome after close ⇒ no throw, no emit', () async {
        final port = RecordingInvoicesPort()..held.add('getOverview');
        final cubit = InvoicesCubit(port, _orderId);
        final Future<void> pending = cubit.load();
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('getOverview').complete(_b)
            : port.pendingOf('getOverview').completeError(StateError('late'));
        await pending;
        expect(cubit.state, const InvoicesState());
      });

      test('create: createInvoice $outcome after close ⇒ no throw, no emit, no re-read', () async {
        final port = RecordingInvoicesPort()..held.add('createInvoice');
        final cubit = InvoicesCubit(port, _orderId);
        cubit.emit(_ready(_a));
        final Future<void> pending = cubit.create();
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('createInvoice').complete()
            : port.pendingOf('createInvoice').completeError(StateError('late'));
        await pending;
        expect(port.log, ['createInvoice']);
        expect(cubit.state, _ready(_a, busy: true));
      });

      test('create: the re-read $outcome after close ⇒ no throw, no emit (finally included)', () async {
        final port = RecordingInvoicesPort()
          ..held.add('getOverview')
          ..errors['createInvoice'] = StateError('connection reset');
        final cubit = InvoicesCubit(port, _orderId);
        cubit.emit(_ready(_a));
        final Future<void> pending = cubit.create();
        await pumpEventQueue();
        expect(cubit.state, _ready(_a, busy: true, error: _unknownError));
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('getOverview').complete(_b)
            : port.pendingOf('getOverview').completeError(StateError('late'));
        await pending;
        expect(cubit.state, _ready(_a, busy: true, error: _unknownError));
      });
    }
  });
}
