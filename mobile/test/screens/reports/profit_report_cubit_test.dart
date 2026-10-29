// ProfitReportCubit: the grouping, the period, the custom days, the
// load phases, the backend's error sentence, and the ticket that keeps a late
// answer off the screen. Expected states are built field by field with the
// constructor (no copyWith), seeds carry every field off its default, and each
// port answer is distinct.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/fake_profit_report_port.dart';
import 'package:pns_mobile/design_system/session/profit_report_port.dart';
import 'package:pns_mobile/screens/reports/profit_report_cubit.dart';
import 'package:pns_mobile/screens/reports/profit_report_state.dart';

ProfitReport _report(String tag, int n) => ProfitReport(
  groupBy: ProfitGroupBy.order,
  from: '2026-10-01',
  to: '2026-10-30',
  totals: ProfitFigures(
    revenue: 1000 + n,
    cost: 800,
    grossProfit: 200 + n,
    marginPct: n,
    orderCount: n,
  ),
  rows: <ProfitReportRow>[
    ProfitReportRow(
      key: tag,
      label: tag,
      revenue: 1000 + n,
      cost: 800,
      grossProfit: 200 + n,
      marginPct: n,
      orderCount: 1,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    ),
  ],
);

// The generated DTO has no value equality: states compare this exact instance.
final ProfitReport _seededReport = _report('seed', 0);

/// Answers call n with a report of its own: two calls never return equal states.
class _CountingPort implements ProfitReportPort {
  final List<ProfitReportQuery> calls = <ProfitReportQuery>[];
  final List<ProfitReport> answers = <ProfitReport>[];

  @override
  Future<ProfitReport> getProfitReport({
    ProfitGroupBy? groupBy,
    ProfitPeriod? period,
    String? from,
    String? to,
  }) async {
    calls.add((groupBy: groupBy, period: period, from: from, to: to));
    final ProfitReport answer = _report('call-${calls.length}', calls.length);
    answers.add(answer);
    return answer;
  }
}

class _FailingPort implements ProfitReportPort {
  _FailingPort(this.error);

  final Object error;
  int calls = 0;

  @override
  Future<ProfitReport> getProfitReport({
    ProfitGroupBy? groupBy,
    ProfitPeriod? period,
    String? from,
    String? to,
  }) async {
    calls++;
    throw error;
  }
}

/// Every call waits on its own completer until the test answers it.
class _HeldPort implements ProfitReportPort {
  final List<ProfitGroupBy?> groupings = <ProfitGroupBy?>[];
  final List<Completer<ProfitReport>> replies = <Completer<ProfitReport>>[];

  @override
  Future<ProfitReport> getProfitReport({
    ProfitGroupBy? groupBy,
    ProfitPeriod? period,
    String? from,
    String? to,
  }) {
    groupings.add(groupBy);
    final Completer<ProfitReport> reply = Completer<ProfitReport>();
    replies.add(reply);
    return reply.future;
  }
}

/// Every field off its default: a custom period with both days, grouped by source.
ProfitReportState _seed() => ProfitReportState(
  status: ProfitReportStatus.ready,
  groupBy: ProfitGroupBy.source,
  period: ProfitPeriod.custom,
  from: '2026-07-01',
  to: '2026-07-31',
  report: _seededReport,
  errorMessage: 'Lỗi cũ.',
);

ProfitReportState _phase(
  ProfitReportStatus status, {
  required ProfitGroupBy groupBy,
  required ProfitPeriod period,
  required String? from,
  required String? to,
}) => ProfitReportState(
  status: status,
  groupBy: groupBy,
  period: period,
  from: from,
  to: to,
  report: _seededReport,
  errorMessage: 'Lỗi cũ.',
);

ProfitReportState _ready(
  ProfitReport answer, {
  required ProfitGroupBy groupBy,
  required ProfitPeriod period,
  required String? from,
  required String? to,
}) => ProfitReportState(
  status: ProfitReportStatus.ready,
  groupBy: groupBy,
  period: period,
  from: from,
  to: to,
  report: answer,
);

void main() {
  test('starts loading this month by order, nothing shown', () {
    final cubit = ProfitReportCubit(FakeProfitReportPort());
    expect(cubit.state.status, ProfitReportStatus.loading);
    expect(cubit.state.groupBy, ProfitGroupBy.order);
    expect(cubit.state.period, ProfitPeriod.month);
    expect(cubit.state.from, isNull);
    expect(cubit.state.to, isNull);
    expect(cubit.state.report, isNull);
    expect(cubit.state.errorMessage, isNull);
    cubit.close();
  });

  final first = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'first load ⇒ loading, then ready with groupBy=order, period=month and no days',
    build: () => ProfitReportCubit(first),
    act: (cubit) => cubit.load(),
    expect: () => [
      const ProfitReportState(),
      ProfitReportState(
        status: ProfitReportStatus.ready,
        report: first.answers[0],
      ),
    ],
    verify: (_) => expect(first.calls, [
      (
        groupBy: ProfitGroupBy.order,
        period: ProfitPeriod.month,
        from: null,
        to: null,
      ),
    ]),
  );

  final reload = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'load ⇒ loading (keeps every field), then ready with the port report; the old error is gone',
    build: () => ProfitReportCubit(reload),
    seed: _seed,
    act: (cubit) => cubit.load(),
    expect: () => [
      _phase(
        ProfitReportStatus.loading,
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
      ),
      _ready(
        reload.answers[0],
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
      ),
    ],
    verify: (_) => expect(reload.calls, [
      (
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
      ),
    ]),
  );

  final grouping = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'selectGroupBy ⇒ the new grouping, the period and days kept',
    build: () => ProfitReportCubit(grouping),
    seed: _seed,
    act: (cubit) => cubit.selectGroupBy(ProfitGroupBy.month),
    expect: () => [
      _phase(
        ProfitReportStatus.loading,
        groupBy: ProfitGroupBy.month,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
      ),
      _ready(
        grouping.answers[0],
        groupBy: ProfitGroupBy.month,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
      ),
    ],
    verify: (_) => expect(grouping.calls.single.groupBy, ProfitGroupBy.month),
  );

  final preset = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'selectPeriod(year) ⇒ the days stay in state but are NOT sent',
    build: () => ProfitReportCubit(preset),
    seed: _seed,
    act: (cubit) => cubit.selectPeriod(ProfitPeriod.year),
    expect: () => [
      _phase(
        ProfitReportStatus.loading,
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.year,
        from: '2026-07-01',
        to: '2026-07-31',
      ),
      _ready(
        preset.answers[0],
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.year,
        from: '2026-07-01',
        to: '2026-07-31',
      ),
    ],
    verify: (_) => expect(preset.calls, [
      (
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.year,
        from: null,
        to: null,
      ),
    ]),
  );

  final awaiting = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'custom without both days ⇒ awaitingDates, nothing sent, the last report kept',
    build: () => ProfitReportCubit(awaiting),
    seed: () => ProfitReportState(
      status: ProfitReportStatus.ready,
      groupBy: ProfitGroupBy.assignee,
      period: ProfitPeriod.year,
      from: '2026-07-01',
      report: _seededReport,
      errorMessage: 'Lỗi cũ.',
    ),
    act: (cubit) => cubit.selectPeriod(ProfitPeriod.custom),
    expect: () => [
      ProfitReportState(
        status: ProfitReportStatus.awaitingDates,
        groupBy: ProfitGroupBy.assignee,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        report: _seededReport,
        errorMessage: 'Lỗi cũ.',
      ),
    ],
    verify: (_) => expect(awaiting.calls, isEmpty),
  );

  final setFrom = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'setFrom with a full day ⇒ that day sent with the kept end',
    build: () => ProfitReportCubit(setFrom),
    seed: _seed,
    act: (cubit) => cubit.setFrom(' 2026-07-05 '),
    expect: () => [
      _phase(
        ProfitReportStatus.loading,
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-05',
        to: '2026-07-31',
      ),
      _ready(
        setFrom.answers[0],
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-05',
        to: '2026-07-31',
      ),
    ],
    verify: (_) => expect(setFrom.calls.single.from, '2026-07-05'),
  );

  final clearTo = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'setTo with an empty field ⇒ awaitingDates, nothing sent',
    build: () => ProfitReportCubit(clearTo),
    seed: _seed,
    act: (cubit) => cubit.setTo(''),
    expect: () => [
      _phase(
        ProfitReportStatus.awaitingDates,
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: null,
      ),
    ],
    verify: (_) => expect(clearTo.calls, isEmpty),
  );

  final reversed = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'an end day before the start ⇒ reversedDates, nothing sent, the last report kept',
    build: () => ProfitReportCubit(reversed),
    seed: _seed,
    act: (cubit) => cubit.setTo('2026-06-30'),
    expect: () => [
      ProfitReportState(
        status: ProfitReportStatus.reversedDates,
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-06-30',
        report: _seededReport,
        errorMessage: 'Lỗi cũ.',
      ),
    ],
    verify: (_) => expect(reversed.calls, isEmpty),
  );

  final sameDay = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'the same day at both ends is a valid range and is sent',
    build: () => ProfitReportCubit(sameDay),
    seed: _seed,
    act: (cubit) => cubit.setTo('2026-07-01'),
    verify: (cubit) {
      expect(sameDay.calls.single.to, '2026-07-01');
      expect(cubit.state.status, ProfitReportStatus.ready);
    },
  );

  final completing = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'the second day typed ⇒ the custom report is asked for',
    build: () => ProfitReportCubit(completing),
    seed: () => ProfitReportState(
      status: ProfitReportStatus.awaitingDates,
      groupBy: ProfitGroupBy.month,
      period: ProfitPeriod.custom,
      from: '2026-07-01',
      report: _seededReport,
      errorMessage: 'Lỗi cũ.',
    ),
    act: (cubit) => cubit.setTo('2026-08-31'),
    expect: () => [
      _phase(
        ProfitReportStatus.loading,
        groupBy: ProfitGroupBy.month,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-08-31',
      ),
      _ready(
        completing.answers[0],
        groupBy: ProfitGroupBy.month,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-08-31',
      ),
    ],
    verify: (_) => expect(completing.calls, [
      (
        groupBy: ProfitGroupBy.month,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-08-31',
      ),
    ]),
  );

  final typing = _CountingPort();
  blocTest<ProfitReportCubit, ProfitReportState>(
    'a half-typed day, a day that does not exist, or the day already set sends nothing',
    build: () => ProfitReportCubit(typing),
    seed: _seed,
    act: (cubit) async {
      await cubit.setFrom('2026-1');
      await cubit.setTo('2026-02-30');
      await cubit.setFrom('2026-13-01');
      await cubit.setFrom('2026-07-01');
      await cubit.setTo('2026-07-31');
    },
    expect: () => <ProfitReportState>[],
    verify: (_) => expect(typing.calls, isEmpty),
  );

  final failing = _FailingPort(
    const ProfitReportPortException('Bạn không có quyền.'),
  );
  blocTest<ProfitReportCubit, ProfitReportState>(
    'a port error ⇒ error with the backend sentence, everything else kept',
    build: () => ProfitReportCubit(failing),
    seed: _seed,
    act: (cubit) => cubit.load(),
    expect: () => [
      _phase(
        ProfitReportStatus.loading,
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
      ),
      ProfitReportState(
        status: ProfitReportStatus.error,
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
        report: _seededReport,
        errorMessage: 'Bạn không có quyền.',
      ),
    ],
    verify: (_) => expect(failing.calls, 1),
  );

  for (final Object error in <Object>[
    StateError('offline'),
    const ProfitReportPortException(''),
  ]) {
    blocTest<ProfitReportCubit, ProfitReportState>(
      'an error without a sentence ($error) ⇒ the generic sentence',
      build: () => ProfitReportCubit(_FailingPort(error)),
      act: (cubit) => cubit.load(),
      expect: () => [
        const ProfitReportState(),
        const ProfitReportState(
          status: ProfitReportStatus.error,
          errorMessage: kProfitReportLoadError,
        ),
      ],
    );
  }

  test(
    'two overlapping groupings, the old one answering last ⇒ only the new one shows',
    () async {
      final port = _HeldPort();
      final cubit = ProfitReportCubit(port);
      unawaited(cubit.selectGroupBy(ProfitGroupBy.month));
      unawaited(cubit.selectGroupBy(ProfitGroupBy.source));
      final ProfitReport newer = _report('new', 1);
      port.replies[1].complete(newer);
      await Future<void>.delayed(Duration.zero);
      port.replies[0].complete(_report('old', 2));
      await Future<void>.delayed(Duration.zero);
      expect(port.groupings, [ProfitGroupBy.month, ProfitGroupBy.source]);
      expect(cubit.state.groupBy, ProfitGroupBy.source);
      expect(cubit.state.status, ProfitReportStatus.ready);
      expect(identical(cubit.state.report, newer), isTrue);
      await cubit.close();
    },
  );

  test(
    'two overlapping groupings, the old one FAILING last ⇒ the new report stays shown',
    () async {
      final port = _HeldPort();
      final cubit = ProfitReportCubit(port);
      unawaited(cubit.selectGroupBy(ProfitGroupBy.month));
      unawaited(cubit.selectGroupBy(ProfitGroupBy.source));
      final ProfitReport newer = _report('new', 1);
      port.replies[1].complete(newer);
      await Future<void>.delayed(Duration.zero);
      port.replies[0].completeError(const ProfitReportPortException('Lỗi.'));
      await Future<void>.delayed(Duration.zero);
      expect(cubit.state.status, ProfitReportStatus.ready);
      expect(identical(cubit.state.report, newer), isTrue);
      expect(cubit.state.errorMessage, isNull);
      await cubit.close();
    },
  );

  test(
    'a request still in flight when the custom period starts waiting for days paints nothing',
    () async {
      final port = _HeldPort();
      final cubit = ProfitReportCubit(port);
      unawaited(cubit.load());
      await cubit.selectPeriod(ProfitPeriod.custom);
      port.replies.single.complete(_report('late', 3));
      await Future<void>.delayed(Duration.zero);
      expect(cubit.state.status, ProfitReportStatus.awaitingDates);
      expect(cubit.state.report, isNull);
      await cubit.close();
    },
  );

  test(
    'a request still in flight when the custom range turns reversed paints nothing',
    () async {
      final port = _HeldPort();
      final cubit = ProfitReportCubit(port);
      await cubit.selectPeriod(ProfitPeriod.custom);
      await cubit.setFrom('2026-07-01');
      unawaited(cubit.setTo('2026-07-31'));
      await cubit.setFrom('2026-08-01');
      port.replies.single.complete(_report('late', 5));
      await Future<void>.delayed(Duration.zero);
      expect(cubit.state.status, ProfitReportStatus.reversedDates);
      expect(cubit.state.report, isNull);
      await cubit.close();
    },
  );

  test(
    'a period change overtakes the earlier request ⇒ only the new period shows',
    () async {
      final port = _HeldPort();
      final cubit = ProfitReportCubit(port);
      unawaited(cubit.load());
      unawaited(cubit.selectPeriod(ProfitPeriod.year));
      final ProfitReport newer = _report('year', 6);
      port.replies[1].complete(newer);
      await Future<void>.delayed(Duration.zero);
      port.replies[0].complete(_report('month', 7));
      await Future<void>.delayed(Duration.zero);
      expect(cubit.state.period, ProfitPeriod.year);
      expect(identical(cubit.state.report, newer), isTrue);
      await cubit.close();
    },
  );

  test(
    'Thử lại overtakes the request that is still pending ⇒ only the retry shows',
    () async {
      final port = _HeldPort();
      final cubit = ProfitReportCubit(port);
      unawaited(cubit.load());
      unawaited(cubit.load());
      final ProfitReport retry = _report('retry', 8);
      port.replies[1].complete(retry);
      await Future<void>.delayed(Duration.zero);
      port.replies[0].completeError(const ProfitReportPortException('Lỗi.'));
      await Future<void>.delayed(Duration.zero);
      expect(cubit.state.status, ProfitReportStatus.ready);
      expect(identical(cubit.state.report, retry), isTrue);
      await cubit.close();
    },
  );

  test('closed before the answer arrives ⇒ the answer emits nothing', () async {
    final port = _HeldPort();
    final cubit = ProfitReportCubit(port);
    unawaited(cubit.load());
    await cubit.close();
    port.replies.single.complete(_report('late', 4));
    await Future<void>.delayed(Duration.zero);
    expect(cubit.state.status, ProfitReportStatus.loading);
  });

  test(
    'closed before the failure arrives ⇒ the failure emits nothing',
    () async {
      final port = _HeldPort();
      final cubit = ProfitReportCubit(port);
      unawaited(cubit.load());
      await cubit.close();
      port.replies.single.completeError(
        const ProfitReportPortException('Lỗi.'),
      );
      await Future<void>.delayed(Duration.zero);
      expect(cubit.state.status, ProfitReportStatus.loading);
    },
  );
}
