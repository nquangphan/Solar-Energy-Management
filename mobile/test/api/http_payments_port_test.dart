// HttpPaymentsPort (Story 10.8): schedule read/replace and payment recording over
// the real transport. The idempotency key the screen generated travels in the
// body byte for byte, a retry reuses it, `paidOn` is the plain `YYYY-MM-DD`, and a
// blank amount never becomes a number (refused here, nothing sent).
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_payments_port.dart';
import 'package:pns_mobile/design_system/session/payments_port.dart';

import 'support/api_stack.dart';
import 'support/contract_json.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpPaymentsPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpPaymentsPort(s.client, s.transport));
}

const String _key = '7f1c1d3e-0b0a-4c4e-9a51-6d0c2b3e9f10';

RecordPaymentInput _input({int? amount = 16602192}) => RecordPaymentInput(
  idempotencyKey: _key,
  installmentId: 'inst-1',
  amount: amount,
  paidOn: '2026-10-21',
  method: 'bank_transfer',
);

void main() {
  test('getSchedule maps the backend figures; paidOn stays the plain date', () async {
    final (s, port) = await _port((_) => jsonBody(200, scheduleJson()));
    final schedule = await port.getSchedule('o1');
    expect([s.adapter.requests.single.method, s.adapter.requests.single.path], ['GET', '/orders/o1/payment-schedule']);
    expect(schedule.paymentStatus, PaymentScheduleResponseDtoPaymentStatus.partial);
    expect(schedule.installments.single.milestone, InstallmentResponseDtoMilestone.coc);
    expect(schedule.installments.single.payments.single.paidOn, '2026-10-21');
    expect(schedule.updatedAt, DateTime.utc(2026, 10, 21, 3));
  });

  test('replaceSchedule PUTs the installments (a blank field travels as null = absent)', () async {
    final (s, port) = await _port((_) => jsonBody(200, scheduleJson()));
    await port.replaceSchedule(
      'o1',
      const ReplacePaymentScheduleInput(
        installments: [
          InstallmentInput(percent: 20, conditionNote: 'Cọc'),
          InstallmentInput(amount: 500000, conditionNote: 'Tất toán'),
        ],
      ),
    );
    final r = s.adapter.requests.single;
    expect([r.method, r.path], ['PUT', '/orders/o1/payment-schedule']);
    expect(r.json, {
      'installments': [
        {'percent': 20, 'amount': null, 'conditionNote': 'Cọc'},
        {'percent': null, 'amount': 500000, 'conditionNote': 'Tất toán'},
      ],
    });
  });

  test('recordPayment sends the key as given, twice for a retry; paidOn "2026-10-21"', () async {
    final (s, port) = await _port((_) => jsonBody(201, recordPaymentJson()));
    final first = await port.recordPayment('o1', _input());
    await port.recordPayment('o1', _input());
    final sent = s.adapter.to('/orders/o1/payments').toList();
    expect(sent, hasLength(2));
    for (final r in sent) {
      expect(r.method, 'POST');
      expect(r.json, {
        'idempotencyKey': _key,
        'installmentId': 'inst-1',
        'amount': 16602192,
        'paidOn': '2026-10-21',
        'method': 'bank_transfer',
        'note': null,
      });
      expect(r.headers.keys.map((k) => k.toLowerCase()), isNot(contains('idempotency-key')));
    }
    expect(first.orderStatus, 'dacoc');
    expect(first.autoTransition?.outcome, AutoTransitionResultDtoOutcome.applied);
  });

  test('a blank amount is refused with the backend field error and NOTHING is sent', () async {
    final (s, port) = await _port((_) => jsonBody(201, recordPaymentJson()));
    await expectLater(
      port.recordPayment('o1', _input(amount: null)),
      throwsA(
        isA<PaymentsPortError>().having((e) => e.code, 'code', 'VALIDATION_ERROR').having(
          (e) => e.fieldErrors?.map((f) => '${f.field}|${f.message}').toList(),
          'fieldErrors',
          ['amount|Số tiền thu phải là số nguyên đồng.'],
        ),
      ),
    );
    expect(s.adapter.requests, isEmpty);
  });

  test('a 400 on paidOn reaches the screen as a field error', () async {
    final (_, port) = await _port(
      (_) => jsonBody(
        400,
        envelope(
          'VALIDATION_ERROR',
          'Dữ liệu không hợp lệ',
          fieldErrors: [
            {'field': 'paidOn', 'code': 'matches', 'message': 'Ngày thu phải có dạng YYYY-MM-DD.'},
          ],
        ),
      ),
    );
    await expectLater(
      port.recordPayment('o1', _input()),
      throwsA(
        isA<PaymentsPortError>()
            .having((e) => e.code, 'code', 'VALIDATION_ERROR')
            .having((e) => e.fieldErrors?.single.field, 'field', 'paidOn'),
      ),
    );
  });
}
