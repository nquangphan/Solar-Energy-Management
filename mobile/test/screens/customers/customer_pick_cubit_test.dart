// CustomerPickCubit (Story 11.2): the lookup/create rules CustomerPickScreen used to hold in its State.
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/customers_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/screens/customers/customer_pick_cubit.dart';
import 'package:pns_mobile/screens/customers/customer_pick_screen.dart' show kCaNhan, kThuongMai;
import 'package:pns_mobile/screens/customers/customer_pick_state.dart';

import 'recording_customers_port.dart';

const CustomerPortException _rejected = CustomerPortException(
  'Dữ liệu không hợp lệ.',
  fieldErrors: {'phone': 'Số điện thoại không hợp lệ.', 'name': 'Nhập tên.'},
);

/// Every input typed — including the other type's — so the cubit's drop rule is visible.
Future<Customer?> _createAll(CustomerPickCubit cubit, String custType, {String sourceNote = 'Hội chợ'}) => cubit.create(
      phone: ' 0903 176 968 ',
      custType: custType,
      name: ' Nguyễn Văn A ',
      nationalId: '079201001234',
      taxCode: '0312345678',
      address: '12 Nguyễn Huệ',
      bankAccount: '0071000123456',
      sourceId: 'src-facebook',
      sourceNote: sourceNote,
    );

void main() {
  test('starts with no answer, no message, the form closed', () {
    final cubit = CustomerPickCubit(RecordingCustomersPort());
    expect(cubit.state, const CustomerPickState());
    cubit.close();
  });

  group('loadSources', () {
    final ok = RecordingCustomersPort();
    blocTest<CustomerPickCubit, CustomerPickState>(
      'answers ⇒ the catalogue',
      build: () => CustomerPickCubit(ok),
      act: (cubit) => cubit.loadSources(),
      expect: () => [CustomerPickState(sources: ok.sources)],
    );

    blocTest<CustomerPickCubit, CustomerPickState>(
      'fails ⇒ an empty catalogue and NO message',
      build: () => CustomerPickCubit(RecordingCustomersPort(sourcesError: StateError('offline'))),
      act: (cubit) => cubit.loadSources(),
      // bloc lets the first emit through even when it equals the initial state.
      expect: () => [const CustomerPickState()],
    );
  });

  test('a catalogue answering late keeps the answer, message and open form already shown', () async {
    final port = RecordingCustomersPort(hold: true);
    final cubit = CustomerPickCubit(port);
    final sources = cubit.loadSources();
    final lookup = cubit.lookup('0903');
    port.pending.last.complete();
    await lookup;
    cubit.startCreate();
    final CustomerPickState before = cubit.state;
    expect(before.result, isNotNull);

    port.pending.first.complete();
    await sources;
    expect(cubit.state.sources, port.sources);
    expect(cubit.state.result, same(before.result));
    expect(cubit.state.creating, isTrue);
    await cubit.close();
  });

  test('a catalogue answering late keeps a failed lookup\'s message and field errors', () async {
    final port = RecordingCustomersPort(hold: true);
    final cubit = CustomerPickCubit(port);
    final sources = cubit.loadSources();
    final lookup = cubit.lookup('abc');
    port.pending.last.completeError(_rejected);
    await lookup;
    expect(cubit.state.error, _rejected.message);

    port.pending.first.complete();
    await sources;
    expect(cubit.state.sources, port.sources);
    expect(cubit.state.error, _rejected.message);
    expect(cubit.state.fieldErrors, _rejected.fieldErrors);
    await cubit.close();
  });

  group('lookup', () {
    final found = RecordingCustomersPort();
    blocTest<CustomerPickCubit, CustomerPickState>(
      'sends the RAW string, clears messages and closes the form, then shows the answer',
      build: () => CustomerPickCubit(found),
      seed: () => const CustomerPickState(error: 'old', fieldErrors: {'phone': 'old'}, creating: true),
      act: (cubit) => cubit.lookup(' 0903 176 968 '),
      expect: () => [const CustomerPickState(), CustomerPickState(result: found.lookupResult)],
      verify: (_) => expect(found.lookups, [' 0903 176 968 ']),
    );

    final miss = RecordingCustomersPort()
      ..lookupResult = const CustomerLookup(found: false, phone: '+84999888777', customer: null);
    blocTest<CustomerPickCubit, CustomerPickState>(
      'a miss is an answer too (it offers creation), not an error',
      build: () => CustomerPickCubit(miss),
      act: (cubit) => cubit.lookup('0999888777'),
      expect: () => [const CustomerPickState(), CustomerPickState(result: miss.lookupResult)],
    );

    blocTest<CustomerPickCubit, CustomerPickState>(
      'a CustomerPortException ⇒ its message and field map verbatim, no answer',
      build: () => CustomerPickCubit(RecordingCustomersPort(error: _rejected)),
      seed: () => CustomerPickState(sources: kDemoCustomerSources, result: RecordingCustomersPort().lookupResult),
      act: (cubit) => cubit.lookup('abc'),
      // The clearing emit equals the seed, so bloc drops it; the answer is gone after the
      // failure, the catalogue is not.
      expect: () => [
        CustomerPickState(sources: kDemoCustomerSources, error: _rejected.message, fieldErrors: _rejected.fieldErrors),
      ],
    );

    blocTest<CustomerPickCubit, CustomerPickState>(
      'any other failure ⇒ the generic sentence and an empty field map',
      build: () => CustomerPickCubit(RecordingCustomersPort(error: StateError('socket closed'))),
      act: (cubit) => cubit.lookup('0903'),
      expect: () => [const CustomerPickState(), const CustomerPickState(error: 'Không thực hiện được. Thử lại.')],
    );
  });

  for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
    test('a lookup that $outcome keeps the form opened and the create refusal shown while it was in flight',
        () async {
      final port = RecordingCustomersPort(hold: true);
      final cubit = CustomerPickCubit(port);
      final lookup = cubit.lookup('0903');
      cubit.startCreate();
      final create = _createAll(cubit, kCaNhan);
      port.pending.last.completeError(_rejected);
      await create;
      error == null ? port.pending.first.complete() : port.pending.first.completeError(error);
      await lookup;
      expect(cubit.state.creating, isTrue);
      if (error == null) {
        expect(cubit.state.error, _rejected.message);
        expect(cubit.state.fieldErrors, _rejected.fieldErrors);
      }
      await cubit.close();
    });
  }

  final shownAnswer = RecordingCustomersPort().lookupResult;
  blocTest<CustomerPickCubit, CustomerPickState>(
    'startCreate / cancelCreate open and close the form, keeping the answer, catalogue and messages',
    build: () => CustomerPickCubit(RecordingCustomersPort()),
    seed: () => CustomerPickState(
      sources: kDemoCustomerSources,
      result: shownAnswer,
      error: _rejected.message,
      fieldErrors: _rejected.fieldErrors,
    ),
    act: (cubit) {
      cubit.startCreate();
      cubit.cancelCreate();
    },
    expect: () => [
      CustomerPickState(
        sources: kDemoCustomerSources,
        result: shownAnswer,
        error: _rejected.message,
        fieldErrors: _rejected.fieldErrors,
        creating: true,
      ),
      CustomerPickState(
        sources: kDemoCustomerSources,
        result: shownAnswer,
        error: _rejected.message,
        fieldErrors: _rejected.fieldErrors,
      ),
    ],
  );

  group('create', () {
    test('Cá nhân ⇒ CCCD sent, MST and bank account dropped; the phone raw; ok ⇒ the customer', () async {
      final port = RecordingCustomersPort();
      final cubit = CustomerPickCubit(port);
      expect(await _createAll(cubit, kCaNhan), same(port.customer));
      final CreateCustomerInput body = port.created.single;
      expect(body.phone, ' 0903 176 968 ');
      expect(body.custType, CreateCustomerRequestDtoCustType.caNhan);
      expect(body.name, ' Nguyễn Văn A ');
      expect(body.nationalId, '079201001234');
      expect(body.taxCode, isNull);
      expect(body.bankAccount, isNull);
      expect(body.address, '12 Nguyễn Huệ');
      expect(body.sourceId, 'src-facebook');
      expect(body.sourceNote, 'Hội chợ');
      await cubit.close();
    });

    test('Thương mại ⇒ MST and bank account sent, CCCD dropped', () async {
      final port = RecordingCustomersPort();
      final cubit = CustomerPickCubit(port);
      await _createAll(cubit, kThuongMai);
      final CreateCustomerInput body = port.created.single;
      expect(body.custType, CreateCustomerRequestDtoCustType.thuongMai);
      expect(body.nationalId, isNull);
      expect(body.taxCode, '0312345678');
      expect(body.bankAccount, '0071000123456');
      await cubit.close();
    });

    test('empty inputs are absent; the source note goes out even for a non-isOther source; sourceId as given', () async {
      final port = RecordingCustomersPort();
      final cubit = CustomerPickCubit(port);
      await cubit.create(
        phone: '0903',
        custType: kThuongMai,
        name: 'X',
        nationalId: '',
        taxCode: '',
        address: '',
        bankAccount: '',
        sourceId: '',
        sourceNote: '',
      );
      await _createAll(cubit, kCaNhan, sourceNote: 'Khách cũ giới thiệu');
      final [CreateCustomerInput blank, CreateCustomerInput noted] = port.created;
      expect([blank.taxCode, blank.bankAccount, blank.address, blank.sourceNote], everyElement(isNull));
      expect(blank.sourceId, '');
      expect(noted.sourceNote, 'Khách cũ giới thiệu');
      await cubit.close();
    });

    blocTest<CustomerPickCubit, CustomerPickState>(
      'refused ⇒ null, the messages (phone kept for the field under SĐT), form and answer kept',
      build: () => CustomerPickCubit(RecordingCustomersPort(error: _rejected)),
      seed: () => CustomerPickState(result: shownAnswer, error: 'old', creating: true),
      act: (cubit) async => expect(await _createAll(cubit, kCaNhan), isNull),
      expect: () => [
        CustomerPickState(result: shownAnswer, creating: true),
        CustomerPickState(
          result: shownAnswer,
          error: _rejected.message,
          fieldErrors: _rejected.fieldErrors,
          creating: true,
        ),
      ],
      verify: (cubit) => expect(cubit.state.fieldErrors['phone'], 'Số điện thoại không hợp lệ.'),
    );

    blocTest<CustomerPickCubit, CustomerPickState>(
      'a transport failure ⇒ null and the generic sentence',
      build: () => CustomerPickCubit(RecordingCustomersPort(error: StateError('offline'))),
      seed: () => const CustomerPickState(creating: true),
      act: (cubit) async => expect(await _createAll(cubit, kCaNhan), isNull),
      expect: () => [const CustomerPickState(error: 'Không thực hiện được. Thử lại.', creating: true)],
    );

    final twice = RecordingCustomersPort();
    blocTest<CustomerPickCubit, CustomerPickState>(
      'no in-flight flag: two taps send two requests',
      build: () => CustomerPickCubit(twice),
      act: (cubit) => Future.wait([_createAll(cubit, kCaNhan), _createAll(cubit, kCaNhan)]),
      verify: (_) => expect(twice.created, hasLength(2)),
    );
  });

  group('the port answering after close', () {
    for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
      test('loadSources $outcome ⇒ no throw, no emit', () async {
        final port = RecordingCustomersPort(hold: true);
        final cubit = CustomerPickCubit(port);
        final load = cubit.loadSources();
        final states = <CustomerPickState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        error == null ? port.pending.single.complete() : port.pending.single.completeError(error);
        await load;
        expect(states, isEmpty);
        await sub.cancel();
      });

      test('lookup $outcome ⇒ no throw, no emit', () async {
        final port = RecordingCustomersPort(hold: true);
        final cubit = CustomerPickCubit(port);
        final lookup = cubit.lookup('0903');
        final states = <CustomerPickState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        error == null ? port.pending.single.complete() : port.pending.single.completeError(error);
        await lookup;
        expect(states, isEmpty);
        await sub.cancel();
      });

      test('create $outcome ⇒ null, no throw, no emit', () async {
        final port = RecordingCustomersPort(hold: true);
        final cubit = CustomerPickCubit(port);
        final create = _createAll(cubit, kCaNhan);
        final states = <CustomerPickState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        error == null ? port.pending.single.complete() : port.pending.single.completeError(error);
        expect(await create, isNull);
        expect(states, isEmpty);
        await sub.cancel();
      });
    }
  });
}
