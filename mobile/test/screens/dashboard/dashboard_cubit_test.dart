// DashboardCubit (Story 8.1): the period, the load phases, the 403 empty state,
// and the ticket that keeps a late answer for an old period off the screen.
// Expected states are built field by field with the constructor (no copyWith),
// seeds carry every field off its default, and each port answer is distinct.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/dashboard_port.dart';
import 'package:pns_mobile/design_system/session/fake_dashboard_port.dart';
import 'package:pns_mobile/screens/dashboard/dashboard_cubit.dart';
import 'package:pns_mobile/screens/dashboard/dashboard_state.dart';

DashboardSummary _summary(int newOrders) => DashboardSummary(
  period: DashboardSummaryResponseDtoPeriod.month,
  from: '2026-10-01',
  to: '2026-10-23',
  revenue: null,
  newOrderCount: newOrders,
  ordersByStatus: null,
);

// The generated DTO has no value equality: states compare these exact instances.
final DashboardSummary _seeded = _summary(1);
final DashboardSummary _first = _summary(101);
final DashboardSummary _second = _summary(202);
final DashboardSummary _late = _summary(201);

/// Answers call n with a summary of its own: two calls never return equal states.
class _CountingPort implements DashboardPort {
  final List<DashboardPeriod> calls = <DashboardPeriod>[];

  @override
  Future<DashboardSummary> getSummary(DashboardPeriod period) async {
    calls.add(period);
    return calls.length == 1 ? _first : _summary(100 + calls.length);
  }
}

class _FailingPort implements DashboardPort {
  _FailingPort(this.error);

  final Object error;
  int calls = 0;

  @override
  Future<DashboardSummary> getSummary(DashboardPeriod period) async {
    calls++;
    throw error;
  }
}

/// Every call waits on its own completer until the test answers it.
class _HeldPort implements DashboardPort {
  final List<DashboardPeriod> periods = <DashboardPeriod>[];
  final List<Completer<DashboardSummary>> replies =
      <Completer<DashboardSummary>>[];

  @override
  Future<DashboardSummary> getSummary(DashboardPeriod period) {
    periods.add(period);
    final Completer<DashboardSummary> reply = Completer<DashboardSummary>();
    replies.add(reply);
    return reply.future;
  }
}

void main() {
  test('starts loading the month, with no summary', () {
    final cubit = DashboardCubit(FakeDashboardPort());
    expect(cubit.state.period, Period.month);
    expect(cubit.state.status, DashboardStatus.loading);
    expect(cubit.state.summary, isNull);
    cubit.close();
  });

  final counting = _CountingPort();
  blocTest<DashboardCubit, DashboardState>(
    'load ⇒ loading (keeps period and summary), then ready with the port answer',
    build: () => DashboardCubit(counting),
    seed: () => DashboardState(
      period: Period.week,
      status: DashboardStatus.error,
      summary: _seeded,
    ),
    act: (cubit) => cubit.load(),
    expect: () => [
      DashboardState(
        period: Period.week,
        status: DashboardStatus.loading,
        summary: _seeded,
      ),
      DashboardState(
        period: Period.week,
        status: DashboardStatus.ready,
        summary: _first,
      ),
    ],
    verify: (_) => expect(counting.calls, [Period.week]),
  );

  final selecting = _CountingPort();
  blocTest<DashboardCubit, DashboardState>(
    'selectPeriod ⇒ asks the port for the new period and shows it',
    build: () => DashboardCubit(selecting),
    seed: () => DashboardState(
      period: Period.week,
      status: DashboardStatus.ready,
      summary: _seeded,
    ),
    act: (cubit) => cubit.selectPeriod(Period.day),
    expect: () => [
      DashboardState(
        period: Period.day,
        status: DashboardStatus.loading,
        summary: _seeded,
      ),
      DashboardState(
        period: Period.day,
        status: DashboardStatus.ready,
        summary: _first,
      ),
    ],
    verify: (_) => expect(selecting.calls, [Period.day]),
  );

  final failing = _FailingPort(StateError('offline'));
  blocTest<DashboardCubit, DashboardState>(
    'a port error ⇒ error, the period and the last summary kept',
    build: () => DashboardCubit(failing),
    seed: () => DashboardState(
      period: Period.week,
      status: DashboardStatus.ready,
      summary: _seeded,
    ),
    act: (cubit) => cubit.load(),
    expect: () => [
      DashboardState(
        period: Period.week,
        status: DashboardStatus.loading,
        summary: _seeded,
      ),
      DashboardState(
        period: Period.week,
        status: DashboardStatus.error,
        summary: _seeded,
      ),
    ],
    verify: (_) => expect(failing.calls, 1),
  );

  blocTest<DashboardCubit, DashboardState>(
    'a 403 ⇒ forbidden (an empty state, not a retry)',
    build: () => DashboardCubit(
      _FailingPort(
        const DashboardPortException('Không có quyền.', forbidden: true),
      ),
    ),
    seed: () => DashboardState(
      period: Period.week,
      status: DashboardStatus.ready,
      summary: _seeded,
    ),
    act: (cubit) => cubit.load(),
    expect: () => [
      DashboardState(
        period: Period.week,
        status: DashboardStatus.loading,
        summary: _seeded,
      ),
      DashboardState(
        period: Period.week,
        status: DashboardStatus.forbidden,
        summary: _seeded,
      ),
    ],
  );

  blocTest<DashboardCubit, DashboardState>(
    'a port exception that is not forbidden ⇒ error',
    build: () => DashboardCubit(
      _FailingPort(const DashboardPortException('Lỗi máy chủ.')),
    ),
    act: (cubit) => cubit.load(),
    expect: () => [
      const DashboardState(
        period: Period.month,
        status: DashboardStatus.loading,
      ),
      const DashboardState(period: Period.month, status: DashboardStatus.error),
    ],
  );

  test(
    'two overlapping period switches, the old one answering last ⇒ only the new one shows',
    () async {
      final port = _HeldPort();
      final cubit = DashboardCubit(port);
      unawaited(cubit.selectPeriod(Period.week));
      unawaited(cubit.selectPeriod(Period.day));
      expect(port.periods, [Period.week, Period.day]);

      port.replies[1].complete(_second);
      await pumpEventQueue();
      expect(
        cubit.state,
        DashboardState(
          period: Period.day,
          status: DashboardStatus.ready,
          summary: _second,
        ),
      );

      port.replies[0].complete(_late);
      await pumpEventQueue();
      expect(
        cubit.state,
        DashboardState(
          period: Period.day,
          status: DashboardStatus.ready,
          summary: _second,
        ),
      );
      await cubit.close();
    },
  );

  test(
    'an old period failing after the new one answered ⇒ the new one stays',
    () async {
      final port = _HeldPort();
      final cubit = DashboardCubit(port);
      unawaited(cubit.selectPeriod(Period.week));
      unawaited(cubit.selectPeriod(Period.day));
      port.replies[1].complete(_second);
      await pumpEventQueue();
      port.replies[0].completeError(StateError('offline'));
      await pumpEventQueue();
      expect(
        cubit.state,
        DashboardState(
          period: Period.day,
          status: DashboardStatus.ready,
          summary: _second,
        ),
      );
      await cubit.close();
    },
  );

  for (final outcome in ['answers', 'fails']) {
    test('the port $outcome after close ⇒ no throw, no emit', () async {
      final port = _HeldPort();
      final cubit = DashboardCubit(port);
      final List<DashboardState> seen = <DashboardState>[];
      final StreamSubscription<DashboardState> sub = cubit.stream.listen(
        seen.add,
      );
      final Future<void> pending = cubit.load();
      await pumpEventQueue();
      seen.clear();
      await cubit.close();
      if (outcome == 'answers') {
        port.replies.single.complete(_summary(301));
      } else {
        port.replies.single.completeError(StateError('offline'));
      }
      await pending;
      expect(seen, isEmpty);
      await sub.cancel();
    });
  }
}
