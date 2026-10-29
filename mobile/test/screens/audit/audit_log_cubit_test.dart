// AuditLogCubit (Story 8.5): the filters, the page, the load phases, the
// backend's error sentence, and the ticket that keeps a late answer off the
// screen. Expected states are built field by field with the constructor (no
// copyWith), seeds carry every field off its default, and each port answer is
// distinct.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/generated/models/audit_change_dto.dart';
import 'package:pns_mobile/design_system/session/audit_logs_port.dart';
import 'package:pns_mobile/design_system/session/fake_audit_logs_port.dart';
import 'package:pns_mobile/screens/audit/audit_log_cubit.dart';
import 'package:pns_mobile/screens/audit/audit_log_state.dart';

AuditLogEntry _entry(String id) => AuditLogEntry(
  id: id,
  eventType: 'OrderConfirmed',
  eventLabel: 'Chốt đơn',
  actorAccountId: null,
  actorDisplayName: null,
  targetType: AuditTargetType.order,
  targetId: 'ord-$id',
  occurredAt: DateTime.utc(2026, 10, 30),
  changes: const <AuditChangeDto>[],
);

// The generated DTO has no value equality: states compare these exact instances.
final List<AuditLogEntry> _seededItems = <AuditLogEntry>[_entry('seed')];

/// Answers call n with a page of its own: two calls never return equal states.
class _CountingPort implements AuditLogsPort {
  final List<AuditLogQuery> calls = <AuditLogQuery>[];
  final List<AuditLogPage> answers = <AuditLogPage>[];

  @override
  Future<AuditLogPage> listAuditLogs({
    AuditTargetType? targetType,
    String? from,
    String? to,
    int? page,
  }) async {
    calls.add((targetType: targetType, from: from, to: to, page: page));
    final int n = calls.length;
    final AuditLogPage answer = AuditLogPage(
      items: <AuditLogEntry>[_entry('call-$n')],
      total: 100 + n,
      page: page ?? 1,
      pageSize: 20 + n,
    );
    answers.add(answer);
    return answer;
  }
}

class _FailingPort implements AuditLogsPort {
  _FailingPort(this.error);

  final Object error;
  int calls = 0;

  @override
  Future<AuditLogPage> listAuditLogs({
    AuditTargetType? targetType,
    String? from,
    String? to,
    int? page,
  }) async {
    calls++;
    throw error;
  }
}

/// Every call waits on its own completer until the test answers it.
class _HeldPort implements AuditLogsPort {
  final List<AuditTargetType?> targets = <AuditTargetType?>[];
  final List<Completer<AuditLogPage>> replies = <Completer<AuditLogPage>>[];

  @override
  Future<AuditLogPage> listAuditLogs({
    AuditTargetType? targetType,
    String? from,
    String? to,
    int? page,
  }) {
    targets.add(targetType);
    final Completer<AuditLogPage> reply = Completer<AuditLogPage>();
    replies.add(reply);
    return reply.future;
  }
}

/// Every field off its default.
AuditLogState _seed() => AuditLogState(
  status: AuditLogStatus.ready,
  targetType: AuditTargetType.product,
  from: '2026-10-01',
  to: '2026-10-30',
  page: 3,
  items: _seededItems,
  total: 77,
  pageSize: 10,
  errorMessage: 'Lỗi cũ.',
);

/// The loading state a fetch emits from [_seed] with the given query.
AuditLogState _loading({
  required AuditTargetType? targetType,
  required String? from,
  required String? to,
  required int page,
}) => AuditLogState(
  status: AuditLogStatus.loading,
  targetType: targetType,
  from: from,
  to: to,
  page: page,
  items: _seededItems,
  total: 77,
  pageSize: 10,
  errorMessage: 'Lỗi cũ.',
);

AuditLogState _ready(
  AuditLogPage answer, {
  required AuditTargetType? targetType,
  required String? from,
  required String? to,
  required int page,
}) => AuditLogState(
  status: AuditLogStatus.ready,
  targetType: targetType,
  from: from,
  to: to,
  page: page,
  items: answer.items,
  total: answer.total.toInt(),
  pageSize: answer.pageSize.toInt(),
);

void main() {
  test('starts loading page 1 of every type, nothing shown', () {
    final cubit = AuditLogCubit(FakeAuditLogsPort());
    expect(cubit.state.status, AuditLogStatus.loading);
    expect(cubit.state.targetType, isNull);
    expect(cubit.state.from, isNull);
    expect(cubit.state.to, isNull);
    expect(cubit.state.page, 1);
    expect(cubit.state.items, isEmpty);
    expect(cubit.state.total, 0);
    expect(cubit.state.pageSize, 20);
    expect(cubit.state.errorMessage, isNull);
    cubit.close();
  });

  final loading = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'load ⇒ loading (keeps every field), then ready with the port page; the old error is gone',
    build: () => AuditLogCubit(loading),
    seed: _seed,
    act: (cubit) => cubit.load(),
    expect: () => [
      _loading(
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 3,
      ),
      _ready(
        loading.answers[0],
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 3,
      ),
    ],
    verify: (_) => expect(loading.calls, [
      (
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 3,
      ),
    ]),
  );

  final selecting = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'selectTarget ⇒ the new type on page 1, the range kept',
    build: () => AuditLogCubit(selecting),
    seed: _seed,
    act: (cubit) => cubit.selectTarget(AuditTargetType.account),
    expect: () => [
      _loading(
        targetType: AuditTargetType.account,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 1,
      ),
      _ready(
        selecting.answers[0],
        targetType: AuditTargetType.account,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 1,
      ),
    ],
    verify: (_) => expect(selecting.calls.single.page, 1),
  );

  final clearing = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'selectTarget(null) ⇒ every type',
    build: () => AuditLogCubit(clearing),
    seed: _seed,
    act: (cubit) => cubit.selectTarget(null),
    expect: () => [
      _loading(targetType: null, from: '2026-10-01', to: '2026-10-30', page: 1),
      _ready(
        clearing.answers[0],
        targetType: null,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 1,
      ),
    ],
    verify: (_) => expect(clearing.calls.single.targetType, isNull),
  );

  final from = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'setFrom with a full day ⇒ that day on page 1',
    build: () => AuditLogCubit(from),
    seed: _seed,
    act: (cubit) => cubit.setFrom(' 2026-10-05 '),
    expect: () => [
      _loading(
        targetType: AuditTargetType.product,
        from: '2026-10-05',
        to: '2026-10-30',
        page: 1,
      ),
      _ready(
        from.answers[0],
        targetType: AuditTargetType.product,
        from: '2026-10-05',
        to: '2026-10-30',
        page: 1,
      ),
    ],
  );

  final to = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'setTo with an empty field ⇒ the end opens, page 1',
    build: () => AuditLogCubit(to),
    seed: _seed,
    act: (cubit) => cubit.setTo(''),
    expect: () => [
      _loading(
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: null,
        page: 1,
      ),
      _ready(
        to.answers[0],
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: null,
        page: 1,
      ),
    ],
  );

  final typing = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'a half-typed day, or the day already shown, sends nothing',
    build: () => AuditLogCubit(typing),
    seed: _seed,
    act: (cubit) async {
      await cubit.setFrom('2026-1');
      await cubit.setTo('2026-10-3');
      await cubit.setFrom('2026-10-01');
      await cubit.setTo('2026-10-30');
    },
    expect: () => <AuditLogState>[],
    verify: (_) => expect(typing.calls, isEmpty),
  );

  final impossible = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'a day that does not exist sends nothing',
    build: () => AuditLogCubit(impossible),
    seed: _seed,
    act: (cubit) async {
      await cubit.setFrom('2026-13-01');
      await cubit.setTo('2026-02-30');
      await cubit.setFrom('0000-00-00');
    },
    expect: () => <AuditLogState>[],
    verify: (_) => expect(impossible.calls, isEmpty),
  );

  final leapDay = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'a real day the range did not hold yet is sent (leap day)',
    build: () => AuditLogCubit(leapDay),
    seed: _seed,
    act: (cubit) => cubit.setTo('2028-02-29'),
    verify: (_) => expect(leapDay.calls.single.to, '2028-02-29'),
  );

  final paging = _CountingPort();
  blocTest<AuditLogCubit, AuditLogState>(
    'goToPage ⇒ that page, the filters kept',
    build: () => AuditLogCubit(paging),
    seed: _seed,
    act: (cubit) => cubit.goToPage(4),
    expect: () => [
      _loading(
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 4,
      ),
      _ready(
        paging.answers[0],
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 4,
      ),
    ],
  );

  final failing = _FailingPort(
    const AuditLogsPortException(
      'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
    ),
  );
  blocTest<AuditLogCubit, AuditLogState>(
    'a port error ⇒ error with the backend sentence, everything else kept',
    build: () => AuditLogCubit(failing),
    seed: _seed,
    act: (cubit) => cubit.load(),
    expect: () => [
      _loading(
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 3,
      ),
      AuditLogState(
        status: AuditLogStatus.error,
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 3,
        items: _seededItems,
        total: 77,
        pageSize: 10,
        errorMessage: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
      ),
    ],
    verify: (_) => expect(failing.calls, 1),
  );

  for (final Object error in <Object>[
    StateError('offline'),
    const AuditLogsPortException(''),
  ]) {
    blocTest<AuditLogCubit, AuditLogState>(
      'an error without a sentence ($error) ⇒ the generic sentence',
      build: () => AuditLogCubit(_FailingPort(error)),
      act: (cubit) => cubit.load(),
      expect: () => [
        const AuditLogState(),
        const AuditLogState(
          status: AuditLogStatus.error,
          errorMessage: kAuditLogLoadError,
        ),
      ],
    );
  }

  test(
    'two overlapping filters, the old one answering last ⇒ only the new one shows',
    () async {
      final port = _HeldPort();
      final cubit = AuditLogCubit(port);
      unawaited(cubit.selectTarget(AuditTargetType.order));
      unawaited(cubit.selectTarget(AuditTargetType.customer));
      final AuditLogPage newer = AuditLogPage(
        items: <AuditLogEntry>[_entry('new')],
        total: 1,
        page: 1,
        pageSize: 20,
      );
      port.replies[1].complete(newer);
      await Future<void>.delayed(Duration.zero);
      port.replies[0].complete(
        AuditLogPage(
          items: <AuditLogEntry>[_entry('old')],
          total: 2,
          page: 1,
          pageSize: 20,
        ),
      );
      await Future<void>.delayed(Duration.zero);
      expect(port.targets, [AuditTargetType.order, AuditTargetType.customer]);
      expect(cubit.state.targetType, AuditTargetType.customer);
      expect(cubit.state.status, AuditLogStatus.ready);
      expect(identical(cubit.state.items, newer.items), isTrue);
      expect(cubit.state.total, 1);
      await cubit.close();
    },
  );

  test('closed before the answer arrives ⇒ the answer emits nothing', () async {
    final port = _HeldPort();
    final cubit = AuditLogCubit(port);
    unawaited(cubit.load());
    await cubit.close();
    port.replies.single.complete(
      const AuditLogPage(
        items: <AuditLogEntry>[],
        total: 0,
        page: 1,
        pageSize: 20,
      ),
    );
    await Future<void>.delayed(Duration.zero);
    expect(cubit.state.status, AuditLogStatus.loading);
  });

  test(
    'closed before the failure arrives ⇒ the failure emits nothing',
    () async {
      final port = _HeldPort();
      final cubit = AuditLogCubit(port);
      unawaited(cubit.load());
      await cubit.close();
      port.replies.single.completeError(const AuditLogsPortException('Lỗi.'));
      await Future<void>.delayed(Duration.zero);
      expect(cubit.state.status, AuditLogStatus.loading);
    },
  );

  test(
    'two overlapping filters, the old one FAILING last ⇒ the new page stays shown',
    () async {
      final port = _HeldPort();
      final cubit = AuditLogCubit(port);
      unawaited(cubit.selectTarget(AuditTargetType.order));
      unawaited(cubit.selectTarget(AuditTargetType.customer));
      final AuditLogPage newer = AuditLogPage(
        items: <AuditLogEntry>[_entry('new')],
        total: 1,
        page: 1,
        pageSize: 20,
      );
      port.replies[1].complete(newer);
      await Future<void>.delayed(Duration.zero);
      port.replies[0].completeError(const AuditLogsPortException('Lỗi cũ.'));
      await Future<void>.delayed(Duration.zero);
      expect(cubit.state.status, AuditLogStatus.ready);
      expect(cubit.state.targetType, AuditTargetType.customer);
      expect(identical(cubit.state.items, newer.items), isTrue);
      expect(cubit.state.errorMessage, isNull);
      await cubit.close();
    },
  );
}
