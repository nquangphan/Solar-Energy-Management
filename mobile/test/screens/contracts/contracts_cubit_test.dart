// ContractsCubit (Story 11.4): the overview, generate and download ContractsScreen used to hold in its State.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/contracts_port.dart';
import 'package:pns_mobile/design_system/session/fake_contracts_port.dart';
import 'package:pns_mobile/screens/contracts/contracts_cubit.dart';
import 'package:pns_mobile/screens/contracts/contracts_state.dart';

import '../recording_port_calls.dart';
import 'recording_contracts_port.dart';

const String _orderId = 'order-1';
const String _unknownError = 'Không xuất được hợp đồng. Vui lòng thử lại.';
const String _downloadError = 'Không tải được file hợp đồng. Vui lòng thử lại.';

/// Two overviews that differ (the generated DTO has no `==`, so each is its own instance).
late ContractsOverview _a;
late ContractsOverview _b;

ContractsState _ready(ContractsOverview o, {bool busy = false, String? error}) =>
    ContractsState(status: ContractsStatus.ready, overview: o, busy: busy, error: error);

/// A port whose every getOverview answers [_b] — the "after" overview.
RecordingContractsPort _portAnsweringB() => RecordingContractsPort()..answers['getOverview'] = _b;

void main() {
  setUpAll(() async {
    _a = await FakeContractsPort().getOverview(_orderId);
    _b = await FakeContractsPort(customerName: 'Chị B').getOverview(_orderId);
  });

  test('starts loading, no overview, not busy, no banner', () {
    final cubit = ContractsCubit(RecordingContractsPort(), _orderId);
    expect(cubit.state, const ContractsState());
    cubit.close();
  });

  group('load', () {
    late RecordingContractsPort ok;
    blocTest<ContractsCubit, ContractsState>(
      'ok ⇒ loading, then ready with the overview; asks for this order',
      setUp: () => ok = _portAnsweringB(),
      build: () => ContractsCubit(ok, _orderId),
      act: (cubit) => cubit.load(),
      expect: () => [const ContractsState(), _ready(_b)],
      verify: (_) => expect(ok.log, ['getOverview']),
    );

    late RecordingContractsPort failing;
    blocTest<ContractsCubit, ContractsState>(
      'a port error ⇒ error',
      setUp: () => failing = RecordingContractsPort()..errors['getOverview'] = StateError('offline'),
      build: () => ContractsCubit(failing, _orderId),
      act: (cubit) => cubit.load(),
      expect: () => [const ContractsState(), const ContractsState(status: ContractsStatus.error)],
    );

    blocTest<ContractsCubit, ContractsState>(
      'a silent re-read that fails keeps the overview on screen, still ready, banner and busy untouched',
      build: () => ContractsCubit(RecordingContractsPort()..errors['getOverview'] = StateError('offline'), _orderId),
      seed: () => _ready(_a, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(showSkeleton: false),
      expect: () => const <ContractsState>[],
    );

    blocTest<ContractsCubit, ContractsState>(
      'a silent re-read with no overview yet that fails ⇒ error',
      build: () => ContractsCubit(RecordingContractsPort()..errors['getOverview'] = StateError('offline'), _orderId),
      seed: () => const ContractsState(status: ContractsStatus.ready, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(showSkeleton: false),
      expect: () => const [ContractsState(status: ContractsStatus.error, busy: true, error: 'banner')],
    );

    blocTest<ContractsCubit, ContractsState>(
      'a silent re-read that succeeds replaces the overview, keeps busy and the banner, no skeleton',
      build: () => ContractsCubit(_portAnsweringB(), _orderId),
      seed: () => _ready(_a, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(showSkeleton: false),
      expect: () => [_ready(_b, busy: true, error: 'banner')],
    );

    blocTest<ContractsCubit, ContractsState>(
      'a reload with the skeleton keeps the overview, busy and banner behind it',
      build: () => ContractsCubit(_portAnsweringB(), _orderId),
      seed: () => _ready(_a, busy: true, error: 'banner'),
      act: (cubit) => cubit.load(),
      expect: () => [
        ContractsState(status: ContractsStatus.loading, overview: _a, busy: true, error: 'banner'),
        _ready(_b, busy: true, error: 'banner'),
      ],
    );

    test('ticket: the first read answering after the second ⇒ only the second shows', () async {
      final port = RecordingContractsPort()..held.add('getOverview');
      final cubit = ContractsCubit(port, _orderId);
      unawaited(cubit.load());
      unawaited(cubit.load());
      port.pendingOf('getOverview', 1).complete(_b);
      await pumpEventQueue();
      port.pendingOf('getOverview', 0).complete(_a);
      await pumpEventQueue();
      expect(cubit.state, _ready(_b));
      await cubit.close();
    });

    test('ticket: the first read FAILING after the second answered ⇒ the second stays', () async {
      final port = RecordingContractsPort()..held.add('getOverview');
      final cubit = ContractsCubit(port, _orderId);
      unawaited(cubit.load());
      unawaited(cubit.load());
      port.pendingOf('getOverview', 1).complete(_b);
      await pumpEventQueue();
      port.pendingOf('getOverview', 0).completeError(StateError('late'));
      await pumpEventQueue();
      expect(cubit.state, _ready(_b));
      await cubit.close();
    });
  });

  group('generate', () {
    late RecordingContractsPort port;
    late RecordingShare share;

    blocTest<ContractsCubit, ContractsState>(
      'ok ⇒ busy (banner cleared), generate → download → share, button back BEFORE the re-read, then the new overview',
      setUp: () {
        port = _portAnsweringB();
        share = RecordingShare();
      },
      build: () => ContractsCubit(port, _orderId),
      seed: () => _ready(_a, error: 'old banner'),
      act: (cubit) => cubit.generate(share.call),
      expect: () => [
        _ready(_a, busy: true),
        _ready(_a),
        _ready(_b),
      ],
      verify: (_) {
        expect(port.log, ['generateContract', 'downloadContractPdf', 'getOverview']);
        expect(port.argsOf('generateContract'), [
          [_orderId],
        ]);
        expect(port.argsOf('downloadContractPdf'), [
          [_orderId, 'contract-1'],
        ]);
        expect(share.calls, hasLength(1));
        expect(share.calls.single.mimeTypes, ['application/pdf']);
        expect(share.calls.single.title, 'contract-1.pdf');
        expect(share.calls.single.fileNames, ['contract-1.pdf']);
      },
    );

    test('the button comes back while the re-read is still pending (busy false before getOverview answers)', () async {
      final port = RecordingContractsPort()..held.add('getOverview');
      final cubit = ContractsCubit(port, _orderId);
      cubit.emit(_ready(_a));
      final Future<void> run = cubit.generate(RecordingShare().call);
      await pumpEventQueue();
      expect(port.log, ['generateContract', 'downloadContractPdf', 'getOverview']);
      expect(cubit.state, _ready(_a));
      port.pendingOf('getOverview').complete(_b);
      await run;
      expect(cubit.state, _ready(_b));
      await cubit.close();
    });

    blocTest<ContractsCubit, ContractsState>(
      'generated but the download fails ⇒ the banner points at "Tải PDF"; one re-read',
      setUp: () {
        port = _portAnsweringB()..errors['downloadContractPdf'] = StateError('offline');
        share = RecordingShare();
      },
      build: () => ContractsCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.generate(share.call),
      expect: () => [
        _ready(_a, busy: true),
        _ready(_a, busy: true, error: 'Đã sinh hợp đồng HĐMB-123456/2026 nhưng chưa tải được — bấm “Tải PDF” trong danh sách.'),
        _ready(_a, error: 'Đã sinh hợp đồng HĐMB-123456/2026 nhưng chưa tải được — bấm “Tải PDF” trong danh sách.'),
        _ready(_b, error: 'Đã sinh hợp đồng HĐMB-123456/2026 nhưng chưa tải được — bấm “Tải PDF” trong danh sách.'),
      ],
      verify: (_) {
        expect(share.calls, isEmpty);
        expect(port.log.where((m) => m == 'getOverview'), hasLength(1));
      },
    );

    blocTest<ContractsCubit, ContractsState>(
      'generated but the share throws ⇒ the same "Tải PDF" banner',
      setUp: () {
        port = _portAnsweringB();
        share = RecordingShare()..error = StateError('share failed');
      },
      build: () => ContractsCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.generate(share.call),
      verify: (cubit) => expect(
        cubit.state,
        _ready(_b, error: 'Đã sinh hợp đồng HĐMB-123456/2026 nhưng chưa tải được — bấm “Tải PDF” trong danh sách.'),
      ),
    );

    blocTest<ContractsCubit, ContractsState>(
      'a ContractsPortError ⇒ its message verbatim; no download, no share; one re-read',
      setUp: () {
        port = _portAnsweringB()
          ..errors['generateContract'] = const ContractsPortError(status: 409, message: 'Đơn chưa chốt.');
        share = RecordingShare();
      },
      build: () => ContractsCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.generate(share.call),
      expect: () => [
        _ready(_a, busy: true),
        _ready(_a, busy: true, error: 'Đơn chưa chốt.'),
        _ready(_a, error: 'Đơn chưa chốt.'),
        _ready(_b, error: 'Đơn chưa chốt.'),
      ],
      verify: (_) {
        expect(port.log, ['generateContract', 'getOverview']);
        expect(share.calls, isEmpty);
      },
    );

    blocTest<ContractsCubit, ContractsState>(
      'any other error ⇒ the generic sentence',
      setUp: () => port = _portAnsweringB()..errors['generateContract'] = StateError('offline'),
      build: () => ContractsCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.generate(RecordingShare().call),
      verify: (cubit) => expect(cubit.state, _ready(_b, error: _unknownError)),
    );

    test('a second press while busy ⇒ no request', () async {
      final port = _portAnsweringB()..held.add('generateContract');
      final cubit = ContractsCubit(port, _orderId);
      cubit.emit(_ready(_a));
      final Future<void> first = cubit.generate(RecordingShare().call);
      await cubit.generate(RecordingShare().call);
      await cubit.download('contract-9', RecordingShare().call);
      expect(port.log, ['generateContract']);
      port.pendingOf('generateContract').complete();
      await first;
      await cubit.close();
    });
  });

  group('download', () {
    late RecordingContractsPort port;
    late RecordingShare share;

    blocTest<ContractsCubit, ContractsState>(
      'ok ⇒ that contract\'s PDF shared, named from its metadata; then one re-read',
      setUp: () {
        port = _portAnsweringB();
        share = RecordingShare();
      },
      build: () => ContractsCubit(port, _orderId),
      seed: () => _ready(_a, error: 'old banner'),
      act: (cubit) => cubit.download('contract-7', share.call),
      expect: () => [_ready(_a, busy: true), _ready(_a), _ready(_b)],
      verify: (_) {
        expect(port.log, ['downloadContractPdf', 'getOverview']);
        expect(port.argsOf('downloadContractPdf'), [
          [_orderId, 'contract-7'],
        ]);
        expect(share.calls.single.fileNames, ['contract-7.pdf']);
        expect(share.calls.single.title, 'contract-7.pdf');
        expect(share.calls.single.mimeTypes, ['application/pdf']);
      },
    );

    blocTest<ContractsCubit, ContractsState>(
      'any other error ⇒ the download sentence',
      setUp: () => port = _portAnsweringB()..errors['downloadContractPdf'] = StateError('offline'),
      build: () => ContractsCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.download('contract-7', RecordingShare().call),
      expect: () => [
        _ready(_a, busy: true),
        _ready(_a, busy: true, error: _downloadError),
        _ready(_a, error: _downloadError),
        _ready(_b, error: _downloadError),
      ],
    );

    blocTest<ContractsCubit, ContractsState>(
      'a ContractsPortError ⇒ its message verbatim',
      setUp: () => port = _portAnsweringB()
        ..errors['downloadContractPdf'] = const ContractsPortError(status: 404, message: 'Không tìm thấy hợp đồng.'),
      build: () => ContractsCubit(port, _orderId),
      seed: () => _ready(_a),
      act: (cubit) => cubit.download('contract-7', RecordingShare().call),
      verify: (cubit) => expect(cubit.state, _ready(_b, error: 'Không tìm thấy hợp đồng.')),
    );
  });

  group('closed early', () {
    for (final outcome in ['answers', 'fails']) {
      test('load: the port $outcome after close ⇒ no throw, no emit', () async {
        final port = RecordingContractsPort()..held.add('getOverview');
        final cubit = ContractsCubit(port, _orderId);
        final Future<void> pending = cubit.load();
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('getOverview').complete(_b)
            : port.pendingOf('getOverview').completeError(StateError('late'));
        await pending;
        expect(cubit.state, const ContractsState());
      });

      test('generate: generateContract $outcome after close ⇒ no download, no share, no re-read', () async {
        final port = RecordingContractsPort()..held.add('generateContract');
        final share = RecordingShare();
        final cubit = ContractsCubit(port, _orderId);
        cubit.emit(_ready(_a));
        final Future<void> pending = cubit.generate(share.call);
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('generateContract').complete()
            : port.pendingOf('generateContract').completeError(const ContractsPortError(status: 409, message: 'x'));
        await pending;
        expect(port.log, ['generateContract']);
        expect(share.calls, isEmpty);
        expect(cubit.state, _ready(_a, busy: true));
      });

      test('download: downloadContractPdf $outcome after close ⇒ no share, no re-read', () async {
        final port = RecordingContractsPort()..held.add('downloadContractPdf');
        final share = RecordingShare();
        final cubit = ContractsCubit(port, _orderId);
        cubit.emit(_ready(_a));
        final Future<void> pending = cubit.download('contract-7', share.call);
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('downloadContractPdf').complete()
            : port.pendingOf('downloadContractPdf').completeError(StateError('late'));
        await pending;
        expect(port.log, ['downloadContractPdf']);
        expect(share.calls, isEmpty);
      });

      test('generate: the re-read $outcome after close ⇒ no throw, no emit', () async {
        final port = RecordingContractsPort()..held.add('getOverview');
        final cubit = ContractsCubit(port, _orderId);
        cubit.emit(_ready(_a));
        final Future<void> pending = cubit.generate(RecordingShare().call);
        await pumpEventQueue();
        expect(cubit.state, _ready(_a));
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('getOverview').complete(_b)
            : port.pendingOf('getOverview').completeError(StateError('late'));
        await pending;
        expect(cubit.state, _ready(_a));
      });
    }

    test('generate: the generated-but-not-downloaded banner is not emitted after close', () async {
      final port = RecordingContractsPort();
      final Completer<void> gate = Completer<void>();
      final cubit = ContractsCubit(port, _orderId);
      cubit.emit(_ready(_a));
      final Future<void> pending = cubit.generate((files, {title, text, fileNames}) async {
        await gate.future;
        throw StateError('share failed');
      });
      await pumpEventQueue();
      await cubit.close();
      gate.complete();
      await pending;
      expect(cubit.state, _ready(_a, busy: true));
      expect(port.log, ['generateContract', 'downloadContractPdf']);
    });
  });
}
