// InvoiceDetailCubit (Story 11.4): the invoice read, export and retarget InvoiceDetailScreen used to hold in its State.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/fake_invoices_port.dart';
import 'package:pns_mobile/design_system/session/invoices_port.dart';
import 'package:pns_mobile/screens/invoices/invoice_detail_cubit.dart';
import 'package:pns_mobile/screens/invoices/invoice_detail_state.dart';

import '../recording_port_calls.dart';
import 'recording_invoices_port.dart';

const String _orderId = 'DH-2048';
const String _exportError = 'Không xuất được PDF hoá đơn. Vui lòng thử lại.';

/// Two invoices that differ (the generated DTO has no `==`, so each is its own instance).
final InvoiceDetail _one = demoInvoiceDetail(id: 'invoice-1', invoiceNo: 'HD-2026-0001');
final InvoiceDetail _two = demoInvoiceDetail(id: 'invoice-2', invoiceNo: 'HD-2026-0002');

InvoiceDetailState _ready(InvoiceDetail i, {bool busy = false, String? error}) =>
    InvoiceDetailState(status: InvoiceDetailStatus.ready, invoice: i, busy: busy, error: error);

RecordingInvoicesPort _port() => RecordingInvoicesPort(details: [_one, _two]);

void main() {
  test('starts loading, no invoice, not busy, no banner', () {
    final cubit = InvoiceDetailCubit(_port(), _orderId, 'invoice-1');
    expect(cubit.state, const InvoiceDetailState());
    cubit.close();
  });

  group('load', () {
    late RecordingInvoicesPort port;
    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'ok ⇒ loading, then ready with that invoice',
      setUp: () => port = _port()..answers['getInvoice'] = _one,
      build: () => InvoiceDetailCubit(port, _orderId, 'invoice-1'),
      act: (cubit) => cubit.load(),
      expect: () => [const InvoiceDetailState(), _ready(_one)],
      verify: (_) => expect(port.argsOf('getInvoice'), [
        [_orderId, 'invoice-1'],
      ]),
    );

    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'a port error ⇒ error',
      build: () => InvoiceDetailCubit(_port()..errors['getInvoice'] = StateError('offline'), _orderId, 'invoice-1'),
      act: (cubit) => cubit.load(),
      expect: () => [const InvoiceDetailState(), const InvoiceDetailState(status: InvoiceDetailStatus.error)],
    );

    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'a silent re-read that fails keeps the invoice, still ready, busy and banner untouched',
      build: () => InvoiceDetailCubit(_port()..errors['getInvoice'] = StateError('offline'), _orderId, 'invoice-1'),
      seed: () => _ready(_one, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(showSkeleton: false),
      expect: () => const <InvoiceDetailState>[],
    );

    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'a silent re-read with no invoice yet that fails ⇒ error',
      build: () => InvoiceDetailCubit(_port()..errors['getInvoice'] = StateError('offline'), _orderId, 'invoice-1'),
      seed: () => const InvoiceDetailState(status: InvoiceDetailStatus.ready, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(showSkeleton: false),
      expect: () => const [InvoiceDetailState(status: InvoiceDetailStatus.error, busy: true, error: 'banner')],
    );

    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'a reload with the skeleton keeps the invoice, busy and banner behind it',
      build: () => InvoiceDetailCubit(_port()..answers['getInvoice'] = _two, _orderId, 'invoice-1'),
      seed: () => _ready(_one, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(),
      expect: () => [
        InvoiceDetailState(status: InvoiceDetailStatus.loading, invoice: _one, busy: true, error: 'banner'),
        _ready(_two, busy: true, error: 'banner'),
      ],
    );

    for (final outcome in ['answers', 'fails']) {
      test('ticket: the first read $outcome after the second answered ⇒ only the second shows', () async {
        final port = _port()..held.add('getInvoice');
        final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
        unawaited(cubit.load());
        unawaited(cubit.load());
        port.pendingOf('getInvoice', 1).complete(_two);
        await pumpEventQueue();
        outcome == 'answers'
            ? port.pendingOf('getInvoice', 0).complete(_one)
            : port.pendingOf('getInvoice', 0).completeError(StateError('late'));
        await pumpEventQueue();
        expect(cubit.state, _ready(_two));
        await cubit.close();
      });
    }
  });

  group('exportPdf', () {
    late RecordingInvoicesPort port;
    late RecordingShare share;

    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'ok ⇒ busy (banner cleared), export → download → share, re-read WHILE STILL busy, then the button back',
      setUp: () {
        port = _port()..answers['getInvoice'] = _two;
        share = RecordingShare();
      },
      build: () => InvoiceDetailCubit(port, _orderId, 'invoice-1'),
      seed: () => _ready(_one, error: 'old banner'),
      act: (cubit) => cubit.exportPdf(share.call),
      expect: () => [_ready(_one, busy: true), _ready(_two, busy: true), _ready(_two)],
      verify: (_) {
        expect(port.log, ['exportInvoicePdf', 'downloadInvoicePdf', 'getInvoice']);
        expect(port.argsOf('exportInvoicePdf'), [
          [_orderId, 'invoice-1'],
        ]);
        expect(port.argsOf('downloadInvoicePdf'), [
          [_orderId, 'invoice-1'],
        ]);
        expect(share.calls, hasLength(1));
        expect(share.calls.single.mimeTypes, ['application/pdf']);
        expect(share.calls.single.title, 'hoa-don-HD-2026-0001.pdf');
        expect(share.calls.single.fileNames, ['hoa-don-HD-2026-0001.pdf']);
      },
    );

    test('the button stays disabled until the re-read answers', () async {
      final port = _port()..held.add('getInvoice');
      final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
      cubit.emit(_ready(_one));
      final Future<void> run = cubit.exportPdf(RecordingShare().call);
      await pumpEventQueue();
      expect(port.log, ['exportInvoicePdf', 'downloadInvoicePdf', 'getInvoice']);
      expect(cubit.state, _ready(_one, busy: true));
      port.pendingOf('getInvoice').complete(_two);
      await run;
      expect(cubit.state, _ready(_two));
      await cubit.close();
    });

    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'an InvoicesPortError ⇒ its message verbatim; no download, no share',
      setUp: () {
        port = _port()
          ..answers['getInvoice'] = _one
          ..errors['exportInvoicePdf'] = const InvoicesPortError(status: 404, message: 'Không tìm thấy hoá đơn.');
        share = RecordingShare();
      },
      build: () => InvoiceDetailCubit(port, _orderId, 'invoice-1'),
      seed: () => _ready(_one),
      act: (cubit) => cubit.exportPdf(share.call),
      expect: () => [
        _ready(_one, busy: true),
        _ready(_one, busy: true, error: 'Không tìm thấy hoá đơn.'),
        _ready(_one, error: 'Không tìm thấy hoá đơn.'),
      ],
      verify: (_) {
        expect(port.log, ['exportInvoicePdf', 'getInvoice']);
        expect(share.calls, isEmpty);
      },
    );

    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'a download failure ⇒ the fallback sentence',
      setUp: () => port = _port()
        ..answers['getInvoice'] = _one
        ..errors['downloadInvoicePdf'] = StateError('offline'),
      build: () => InvoiceDetailCubit(port, _orderId, 'invoice-1'),
      seed: () => _ready(_one),
      act: (cubit) => cubit.exportPdf(RecordingShare().call),
      verify: (cubit) => expect(cubit.state, _ready(_one, error: _exportError)),
    );

    blocTest<InvoiceDetailCubit, InvoiceDetailState>(
      'a share that throws ⇒ the fallback sentence',
      setUp: () {
        port = _port()..answers['getInvoice'] = _one;
        share = RecordingShare()..error = StateError('share failed');
      },
      build: () => InvoiceDetailCubit(port, _orderId, 'invoice-1'),
      seed: () => _ready(_one),
      act: (cubit) => cubit.exportPdf(share.call),
      verify: (cubit) => expect(cubit.state, _ready(_one, error: _exportError)),
    );

    test('a second press while busy ⇒ no request', () async {
      final port = _port()..held.add('exportInvoicePdf');
      final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
      cubit.emit(_ready(_one));
      final Future<void> first = cubit.exportPdf(RecordingShare().call);
      await cubit.exportPdf(RecordingShare().call);
      expect(port.log, ['exportInvoicePdf']);
      port.pendingOf('exportInvoicePdf').complete();
      await first;
      expect(port.log, ['exportInvoicePdf', 'downloadInvoicePdf', 'getInvoice']);
      await cubit.close();
    });
  });

  group('retarget', () {
    test('clears the invoice, reads the new one; the old one answering late is dropped; busy and banner kept', () async {
      final port = _port()..held.add('getInvoice');
      final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
      unawaited(cubit.load());
      cubit.emit(InvoiceDetailState(status: InvoiceDetailStatus.ready, invoice: _one, busy: true, error: 'banner'));
      cubit.retarget(port, _orderId, 'invoice-2');
      expect(cubit.state, const InvoiceDetailState(busy: true, error: 'banner'));
      expect(port.argsOf('getInvoice'), [
        [_orderId, 'invoice-1'],
        [_orderId, 'invoice-2'],
      ]);
      port.pendingOf('getInvoice', 1).complete(_two);
      await pumpEventQueue();
      port.pendingOf('getInvoice', 0).complete(_one);
      await pumpEventQueue();
      expect(cubit.state, _ready(_two, busy: true, error: 'banner'));
      await cubit.close();
    });

    test('takes the new port and order too', () async {
      final first = _port();
      final second = _port()..answers['getInvoice'] = _two;
      final cubit = InvoiceDetailCubit(first, _orderId, 'invoice-1');
      cubit.retarget(second, 'DH-9', 'invoice-2');
      await pumpEventQueue();
      expect(first.log, isEmpty);
      expect(second.argsOf('getInvoice'), [
        ['DH-9', 'invoice-2'],
      ]);
      expect(cubit.state, _ready(_two));
      await cubit.close();
    });

    test('an export running across a retarget re-reads the NEW invoice and only then frees the button', () async {
      final port = _port()..held.add('exportInvoicePdf');
      final share = RecordingShare();
      final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
      cubit.emit(_ready(_one));
      final Future<void> run = cubit.exportPdf(share.call);
      await pumpEventQueue();
      port.answers['getInvoice'] = _two;
      cubit.retarget(port, _orderId, 'invoice-2');
      await pumpEventQueue();
      expect(cubit.state, _ready(_two, busy: true));
      port.pendingOf('exportInvoicePdf').complete();
      await run;
      // As before the move, each step reads the CURRENT target: the export sent for
      // invoice-1 downloads invoice-2 (never exported ⇒ the server's refusal) and
      // re-reads invoice-2.
      expect(port.argsOf('downloadInvoicePdf'), [
        [_orderId, 'invoice-2'],
      ]);
      expect(port.argsOf('getInvoice').last, [_orderId, 'invoice-2']);
      expect(share.calls, isEmpty);
      expect(cubit.state, _ready(_two, error: 'Hoá đơn này chưa xuất PDF.'));
      await cubit.close();
    });
  });

  group('closed early', () {
    for (final outcome in ['answers', 'fails']) {
      test('load: the port $outcome after close ⇒ no throw, no emit', () async {
        final port = _port()..held.add('getInvoice');
        final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
        final Future<void> pending = cubit.load();
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('getInvoice').complete(_one)
            : port.pendingOf('getInvoice').completeError(StateError('late'));
        await pending;
        expect(cubit.state, const InvoiceDetailState());
      });

      test('export: exportInvoicePdf $outcome after close ⇒ no share, no emit, no re-read', () async {
        final port = _port()..held.add('exportInvoicePdf');
        final share = RecordingShare();
        final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
        cubit.emit(_ready(_one));
        final Future<void> pending = cubit.exportPdf(share.call);
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('exportInvoicePdf').complete()
            : port.pendingOf('exportInvoicePdf').completeError(StateError('late'));
        await pending;
        expect(share.calls, isEmpty);
        expect(port.log, isNot(contains('getInvoice')));
        expect(cubit.state, _ready(_one, busy: true));
      });

      test('export: downloadInvoicePdf $outcome after close ⇒ no share', () async {
        final port = _port()..held.add('downloadInvoicePdf');
        final share = RecordingShare();
        final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
        cubit.emit(_ready(_one));
        final Future<void> pending = cubit.exportPdf(share.call);
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('downloadInvoicePdf').complete()
            : port.pendingOf('downloadInvoicePdf').completeError(StateError('late'));
        await pending;
        expect(share.calls, isEmpty);
        expect(port.log, ['exportInvoicePdf', 'downloadInvoicePdf']);
      });

      test('export: the re-read $outcome after close ⇒ no throw, no emit (finally included)', () async {
        final port = _port()..held.add('getInvoice');
        final cubit = InvoiceDetailCubit(port, _orderId, 'invoice-1');
        cubit.emit(_ready(_one));
        final Future<void> pending = cubit.exportPdf(RecordingShare().call);
        await pumpEventQueue();
        expect(cubit.state, _ready(_one, busy: true));
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('getInvoice').complete(_two)
            : port.pendingOf('getInvoice').completeError(StateError('late'));
        await pending;
        expect(cubit.state, _ready(_one, busy: true));
      });
    }
  });
}
