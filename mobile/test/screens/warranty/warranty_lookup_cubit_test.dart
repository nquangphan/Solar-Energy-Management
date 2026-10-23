// WarrantyLookupCubit (Story 11.2): the lookup WarrantyLookupScreen used to run in its State.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/warranty_port.dart';
import 'package:pns_mobile/screens/warranty/warranty_lookup_cubit.dart';
import 'package:pns_mobile/screens/warranty/warranty_lookup_state.dart';

const WarrantyLookup _miss = WarrantyLookup(found: false, phone: '+84903176968', customer: null, orders: []);

/// Records every phone sent; answers a miss (or throws [error]) once [reply] completes.
class _RecordingWarrantyPort implements WarrantyPort {
  _RecordingWarrantyPort({this.error});

  final Object? error;
  Completer<void>? reply;
  final List<String> calls = [];

  @override
  Future<WarrantyLookup> lookup(String sdt) async {
    calls.add(sdt);
    await reply?.future;
    if (error != null) throw error!;
    return _miss;
  }
}

const WarrantyLookup _found = WarrantyLookup(found: true, phone: '+84903176968', customer: null, orders: []);

/// Each lookup waits on its own completer, so answers can arrive in any order.
class _OrderedWarrantyPort implements WarrantyPort {
  final List<String> calls = [];
  final List<Completer<WarrantyLookup>> replies = [];

  @override
  Future<WarrantyLookup> lookup(String sdt) {
    calls.add(sdt);
    replies.add(Completer<WarrantyLookup>());
    return replies.last.future;
  }
}

void main() {
  test('starts idle', () {
    final cubit = WarrantyLookupCubit(_RecordingWarrantyPort());
    expect(cubit.state, const WarrantyLookupIdle());
    cubit.close();
  });

  final answered = _RecordingWarrantyPort();
  blocTest<WarrantyLookupCubit, WarrantyLookupState>(
    'an answer ⇒ loading then ready; the phone goes out raw',
    build: () => WarrantyLookupCubit(answered),
    act: (cubit) => cubit.lookup(' 0903 176 968 '),
    expect: () => [const WarrantyLookupLoading(), const WarrantyLookupReady(_miss)],
    verify: (_) => expect(answered.calls, [' 0903 176 968 ']),
  );

  blocTest<WarrantyLookupCubit, WarrantyLookupState>(
    'a WarrantyPortException ⇒ its message verbatim',
    build: () => WarrantyLookupCubit(_RecordingWarrantyPort(error: const WarrantyPortException('Số điện thoại không hợp lệ.'))),
    act: (cubit) => cubit.lookup('abc'),
    expect: () => [const WarrantyLookupLoading(), const WarrantyLookupError('Số điện thoại không hợp lệ.')],
  );

  blocTest<WarrantyLookupCubit, WarrantyLookupState>(
    'any other failure ⇒ the fixed sentence, never its English text',
    build: () => WarrantyLookupCubit(_RecordingWarrantyPort(error: StateError('offline'))),
    act: (cubit) => cubit.lookup('0903'),
    expect: () => [const WarrantyLookupLoading(), const WarrantyLookupError('Không tra cứu được bảo hành.')],
  );

  final retried = _RecordingWarrantyPort(error: StateError('offline'));
  blocTest<WarrantyLookupCubit, WarrantyLookupState>(
    'Thử lại after an error ⇒ loading again, a second request',
    build: () => WarrantyLookupCubit(retried),
    act: (cubit) async {
      await cubit.lookup('0903');
      await cubit.lookup('0903');
    },
    expect: () => [
      const WarrantyLookupLoading(),
      const WarrantyLookupError('Không tra cứu được bảo hành.'),
      const WarrantyLookupLoading(),
      const WarrantyLookupError('Không tra cứu được bảo hành.'),
    ],
    verify: (_) => expect(retried.calls, hasLength(2)),
  );

  test('no ticket: two taps send two requests and the answer arriving LAST is shown', () async {
    final port = _OrderedWarrantyPort();
    final cubit = WarrantyLookupCubit(port);
    final first = cubit.lookup('0903');
    final second = cubit.lookup('0904');
    port.replies[1].complete(_found);
    await second;
    port.replies[0].complete(_miss);
    await first;
    expect(port.calls, ['0903', '0904']);
    expect(cubit.state, const WarrantyLookupReady(_miss));
    await cubit.close();
  });

  for (final (outcome, Object? error) in [('answering', null), ('failing', StateError('offline'))]) {
    test('the port $outcome after close ⇒ no throw, no emit', () async {
      final port = _RecordingWarrantyPort(error: error)..reply = Completer<void>();
      final cubit = WarrantyLookupCubit(port);
      final lookup = cubit.lookup('0903');
      final states = <WarrantyLookupState>[];
      final sub = cubit.stream.listen(states.add);
      await cubit.close();
      port.reply!.complete();
      await lookup;
      expect(states, isEmpty);
      await sub.cancel();
    });
  }
}
