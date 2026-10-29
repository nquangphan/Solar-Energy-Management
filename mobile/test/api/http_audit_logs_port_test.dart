// HttpAuditLogsPort (Story 8.5): the filter, range and page as query parameters,
// the five dimensions mapped from the contract, and a rejection carrying the
// backend's sentence.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_audit_logs_port.dart';
import 'package:pns_mobile/design_system/session/audit_logs_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpAuditLogsPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpAuditLogsPort(s.client, s.transport));
}

Map<String, Object?> _page() => {
  'items': [
    {
      'id': 'log-1',
      'eventType': 'PaymentRecorded',
      'eventLabel': 'Ghi nhận thanh toán',
      'actorAccountId': null,
      'actorDisplayName': null,
      'targetType': 'Order',
      'targetId': 'ord-1',
      'occurredAt': '2026-10-30T03:00:00.000Z',
      'changes': [
        {
          'field': 'orderPaid',
          'before': '0',
          'after': '83010960',
          'isMoney': true,
        },
      ],
    },
  ],
  'total': 41,
  'page': 3,
  'pageSize': 20,
};

void main() {
  test(
    'listAuditLogs sends the filter, range and page and maps the record',
    () async {
      final (s, port) = await _port((_) => jsonBody(200, _page()));
      final result = await port.listAuditLogs(
        targetType: AuditTargetType.order,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 3,
      );
      final AuditLogEntry entry = result.items.single;
      expect(entry.actorAccountId, isNull);
      expect(entry.targetType, AuditTargetType.order);
      expect(entry.occurredAt, DateTime.utc(2026, 10, 30, 3));
      expect(entry.changes.single.isMoney, isTrue);
      expect(entry.changes.single.after, '83010960');
      expect([result.total, result.page, result.pageSize], [41, 3, 20]);
      final request = s.adapter.requests.single;
      expect([request.method, request.path], ['GET', '/audit-logs']);
      expect(request.query, {
        'targetType': 'Order',
        'from': '2026-10-01',
        'to': '2026-10-30',
        'page': '3',
        'pageSize': '20',
      });
    },
  );

  test('no filter sends no filter parameter', () async {
    final (s, port) = await _port((_) => jsonBody(200, _page()));
    await port.listAuditLogs();
    expect(s.adapter.requests.single.query.keys, isNot(contains('targetType')));
    expect(s.adapter.requests.single.query.keys, isNot(contains('from')));
    expect(s.adapter.requests.single.query.keys, isNot(contains('to')));
  });

  test(
    'a 400 is an AuditLogsPortException with the backend sentence',
    () async {
      final (_, port) = await _port(
        (_) => jsonBody(
          400,
          envelope(
            'VALIDATION_ERROR',
            'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
          ),
        ),
      );
      await expectLater(
        port.listAuditLogs(from: '2026-10-06', to: '2026-10-05'),
        throwsA(
          isA<AuditLogsPortException>().having(
            (e) => e.message,
            'message',
            'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
          ),
        ),
      );
    },
  );

  test('a 403 is an AuditLogsPortException', () async {
    final (_, port) = await _port(
      (_) => jsonBody(403, envelope('FORBIDDEN', 'Bạn không có quyền.')),
    );
    await expectLater(
      port.listAuditLogs(),
      throwsA(isA<AuditLogsPortException>()),
    );
  });
}
