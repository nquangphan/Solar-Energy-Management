// CustomerDetailCubit (Story 11.2): the load CustomerDetailScreen used to run in its State.

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/screens/customers/customer_detail_cubit.dart';
import 'package:pns_mobile/screens/customers/customer_detail_state.dart';

import 'recording_customers_port.dart';

void main() {
  test('starts loading, with no customer', () {
    final cubit = CustomerDetailCubit(RecordingCustomersPort(), '0903');
    expect(cubit.state, const CustomerDetailState());
    cubit.close();
  });

  final ok = RecordingCustomersPort();
  blocTest<CustomerDetailCubit, CustomerDetailState>(
    'get THEN listSources, one after the other ⇒ ready with the customer and the catalogue',
    build: () => CustomerDetailCubit(ok, ' 0903 176 968 '),
    act: (cubit) => cubit.load(),
    // bloc lets the first emit through even when it equals the initial state.
    expect: () => [
      const CustomerDetailState(),
      CustomerDetailState(status: CustomerDetailStatus.ready, customer: ok.customer, sources: ok.sources),
    ],
    verify: (_) {
      expect(ok.log, ['get', 'listSources']);
      // The phone as the route handed it — the backend normalises (AD-9).
      expect(ok.gets, [' 0903 176 968 ']);
    },
  );

  final failing = RecordingCustomersPort(error: StateError('offline'));
  blocTest<CustomerDetailCubit, CustomerDetailState>(
    'get failing ⇒ error, and listSources is never asked',
    build: () => CustomerDetailCubit(failing, '0903'),
    act: (cubit) => cubit.load(),
    expect: () => [const CustomerDetailState(), const CustomerDetailState(status: CustomerDetailStatus.error)],
    verify: (_) => expect(failing.log, ['get']),
  );

  blocTest<CustomerDetailCubit, CustomerDetailState>(
    'listSources failing ⇒ error too',
    build: () => CustomerDetailCubit(RecordingCustomersPort(sourcesError: StateError('offline')), '0903'),
    act: (cubit) => cubit.load(),
    expect: () => [const CustomerDetailState(), const CustomerDetailState(status: CustomerDetailStatus.error)],
  );

  final retry = RecordingCustomersPort();
  blocTest<CustomerDetailCubit, CustomerDetailState>(
    'Thử lại after an error ⇒ loading then ready',
    build: () => CustomerDetailCubit(retry, '0903'),
    seed: () => const CustomerDetailState(status: CustomerDetailStatus.error),
    act: (cubit) => cubit.load(),
    expect: () => [
      const CustomerDetailState(),
      CustomerDetailState(status: CustomerDetailStatus.ready, customer: retry.customer, sources: retry.sources),
    ],
  );

  final shown = RecordingCustomersPort(error: StateError('offline'));
  blocTest<CustomerDetailCubit, CustomerDetailState>(
    'a reload keeps the customer already shown, through loading and error',
    build: () => CustomerDetailCubit(shown, '0903'),
    seed: () => CustomerDetailState(status: CustomerDetailStatus.ready, customer: shown.customer, sources: shown.sources),
    act: (cubit) => cubit.load(),
    expect: () => [
      CustomerDetailState(customer: shown.customer, sources: shown.sources),
      CustomerDetailState(status: CustomerDetailStatus.error, customer: shown.customer, sources: shown.sources),
    ],
  );

  for (final (outcome, Object? error) in [('answering', null), ('failing', StateError('offline'))]) {
    test('the port $outcome after close ⇒ no throw, no emit', () async {
      final port = RecordingCustomersPort(hold: true);
      final cubit = CustomerDetailCubit(port, '0903');
      final load = cubit.load();
      final states = <CustomerDetailState>[];
      final sub = cubit.stream.listen(states.add);
      await cubit.close();
      await pumpEventQueue();
      error == null ? port.pending.single.complete() : port.pending.single.completeError(error);
      if (error == null) {
        // The catalogue is the second call; it answers after close too.
        await pumpEventQueue();
        port.pending.last.complete();
      }
      await load;
      expect(states, isEmpty);
      await sub.cancel();
    });
  }
}
