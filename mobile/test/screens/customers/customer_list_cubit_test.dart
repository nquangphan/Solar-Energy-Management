// CustomerListCubit (Story 11.2): the query, paging and ticket CustomerListScreen used to hold in its State.
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/customers_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/screens/customers/customer_list_cubit.dart';
import 'package:pns_mobile/screens/customers/customer_list_state.dart';
import 'package:pns_mobile/screens/customers/customer_pick_screen.dart' show kCaNhan;

import 'recording_customers_port.dart';

void main() {
  test('starts loading on page 1 of everything', () {
    final cubit = CustomerListCubit(RecordingCustomersPort());
    expect(cubit.state, const CustomerListState());
    cubit.close();
  });

  final ok = RecordingCustomersPort();
  blocTest<CustomerListCubit, CustomerListState>(
    'load ⇒ ready with the rows, total and page size from the port; no q, no custType, page 1',
    build: () => CustomerListCubit(ok),
    act: (cubit) => cubit.load(),
    // bloc lets the first emit through even when it equals the initial state.
    expect: () => [
      const CustomerListState(),
      CustomerListState(status: CustomerListStatus.ready, items: ok.page.items, total: 45, pageSize: 20),
    ],
    verify: (_) => expect(ok.listCalls, [(q: null, custType: null, page: 1)]),
  );

  final searched = RecordingCustomersPort();
  blocTest<CustomerListCubit, CustomerListState>(
    'search sends the keyword untouched, from page 1',
    build: () => CustomerListCubit(searched),
    act: (cubit) => cubit.search('0903'),
    verify: (_) => expect(searched.listCalls, [(q: '0903', custType: null, page: 1)]),
  );

  final paged = RecordingCustomersPort();
  blocTest<CustomerListCubit, CustomerListState>(
    'goToPage(2) then a new search ⇒ back to page 1',
    build: () => CustomerListCubit(paged),
    act: (cubit) async {
      await cubit.goToPage(2);
      await cubit.search('x');
    },
    verify: (cubit) {
      expect(paged.listCalls, [(q: null, custType: null, page: 2), (q: 'x', custType: null, page: 1)]);
      expect(cubit.state.page, 1);
    },
  );

  final typed = RecordingCustomersPort();
  blocTest<CustomerListCubit, CustomerListState>(
    'setCustType ⇒ that type goes out, from page 1, and the state marks it selected',
    build: () => CustomerListCubit(typed),
    act: (cubit) async {
      await cubit.goToPage(3);
      await cubit.setCustType(kCaNhan);
    },
    verify: (cubit) {
      expect(typed.listCalls.last, (q: null, custType: 'CA_NHAN', page: 1));
      expect(cubit.state.custType, kCaNhan);
    },
  );

  blocTest<CustomerListCubit, CustomerListState>(
    'a failing port ⇒ error',
    build: () => CustomerListCubit(RecordingCustomersPort(error: StateError('offline'))),
    act: (cubit) => cubit.load(),
    expect: () => [const CustomerListState(), const CustomerListState(status: CustomerListStatus.error)],
  );

  test('a reload keeps the rows, total and page size already shown, through loading and error', () async {
    // A page size other than the state's default 20, so keeping it is visible.
    final port = RecordingCustomersPort(hold: true)
      ..pages = [CustomerPage(items: kDemoCustomers, total: 45, page: 1, pageSize: 10)];
    final cubit = CustomerListCubit(port);
    final first = cubit.load();
    port.pending.single.complete();
    await first;
    final CustomerListState shown = cubit.state;
    expect(shown.status, CustomerListStatus.ready);

    final states = <CustomerListState>[];
    final sub = cubit.stream.listen(states.add);
    final second = cubit.load();
    port.pending.last.completeError(StateError('offline'));
    await second;
    await pumpEventQueue();
    expect(states.map((s) => s.status), [CustomerListStatus.loading, CustomerListStatus.error]);
    for (final CustomerListState s in states) {
      expect(s.items, same(shown.items));
      expect((s.total, s.pageSize, s.page), (45, 10, 1));
    }
    await sub.cancel();
    await cubit.close();
  });

  for (final (q, custType, bool searching) in [
    ('', kAllCustTypes, false),
    ('09', kAllCustTypes, true),
    ('', kCaNhan, true),
    ('09', kCaNhan, true),
  ]) {
    test('searching is $searching for q "$q" and type $custType', () async {
      final cubit = CustomerListCubit(RecordingCustomersPort());
      await cubit.setCustType(custType);
      await cubit.search(q);
      expect(cubit.state.searching, searching);
      await cubit.close();
    });
  }

  group('answers arriving out of order', () {
    for (final (outcome, Object? lateError) in [('answers', null), ('fails', StateError('offline'))]) {
      test('the first query $outcome AFTER the second ⇒ only the second is shown', () async {
        // Two DIFFERENT answers: an identical late one would be dropped as a duplicate state.
        final port = RecordingCustomersPort(hold: true)
          ..pages = [
            CustomerPage(items: kDemoCustomers, total: 2, page: 1, pageSize: 20),
            CustomerPage(items: [kDemoCustomers.first], total: 1, page: 1, pageSize: 20),
          ];
        final cubit = CustomerListCubit(port);
        final first = cubit.search('090');
        final second = cubit.search('0903');
        port.pending[1].complete();
        await second;
        final CustomerListState shown = cubit.state;
        expect(shown.status, CustomerListStatus.ready);

        final states = <CustomerListState>[];
        final sub = cubit.stream.listen(states.add);
        lateError == null ? port.pending[0].complete() : port.pending[0].completeError(lateError);
        await first;
        expect(states, isEmpty);
        expect(cubit.state, shown);
        await sub.cancel();
        await cubit.close();
      });
    }
  });

  for (final (outcome, Object? error) in [('answering', null), ('failing', StateError('offline'))]) {
    test('the port $outcome after close ⇒ no throw, no emit', () async {
      final port = RecordingCustomersPort(hold: true);
      final cubit = CustomerListCubit(port);
      final load = cubit.load();
      final states = <CustomerListState>[];
      final sub = cubit.stream.listen(states.add);
      await cubit.close();
      error == null ? port.pending.single.complete() : port.pending.single.completeError(error);
      await load;
      expect(states, isEmpty);
      await sub.cancel();
    });
  }
}
