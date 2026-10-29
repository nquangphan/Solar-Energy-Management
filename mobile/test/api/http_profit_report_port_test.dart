// HttpProfitReportPort: the grouping, period and custom days as query
// parameters, the report mapped from the contract (bigint-sized money, a null
// margin, the null assignee row), and a rejection carrying the backend's sentence.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_profit_report_port.dart';
import 'package:pns_mobile/design_system/session/profit_report_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpProfitReportPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpProfitReportPort(s.client, s.transport));
}

Map<String, Object?> _report() => {
  'groupBy': 'assignee',
  'from': '2026-07-01',
  'to': '2026-07-31',
  'totals': {
    'revenue': 6000000000,
    'cost': 4500000000,
    'grossProfit': 1500000000,
    'marginPct': 25,
    'orderCount': 2,
  },
  'rows': [
    {
      'key': null,
      'label': 'Chưa giao người phụ trách',
      'revenue': 6000000000,
      'cost': 4500000000,
      'grossProfit': 1500000000,
      'marginPct': null,
      'orderCount': 2,
      'customerName': null,
      'assigneeDisplayName': null,
      'sourceName': null,
      'issuedAt': null,
    },
  ],
};

void main() {
  test(
    'getProfitReport sends the grouping, period and days and maps the report',
    () async {
      final (s, port) = await _port((_) => jsonBody(200, _report()));
      final ProfitReport result = await port.getProfitReport(
        groupBy: ProfitGroupBy.assignee,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
      );
      expect(result.groupBy, ProfitGroupBy.assignee);
      expect(result.totals.revenue, 6000000000);
      expect(result.totals.marginPct, 25);
      final ProfitReportRow row = result.rows.single;
      expect(row.key, isNull);
      expect(row.marginPct, isNull);
      expect(row.issuedAt, isNull);
      expect(row.label, 'Chưa giao người phụ trách');
      final request = s.adapter.requests.single;
      expect([request.method, request.path], ['GET', '/reports/profit']);
      expect(request.query, {
        'groupBy': 'assignee',
        'period': 'custom',
        'from': '2026-07-01',
        'to': '2026-07-31',
      });
    },
  );

  test('no argument sends no parameter', () async {
    final (s, port) = await _port((_) => jsonBody(200, _report()));
    await port.getProfitReport();
    expect(s.adapter.requests.single.query, isEmpty);
  });

  test(
    'a 400 is a ProfitReportPortException with the backend sentence',
    () async {
      final (_, port) = await _port(
        (_) => jsonBody(
          400,
          envelope('VALIDATION_ERROR', 'Chọn ngày cho kỳ tuỳ chọn.'),
        ),
      );
      await expectLater(
        port.getProfitReport(period: ProfitPeriod.custom, from: '2026-07-01'),
        throwsA(
          isA<ProfitReportPortException>().having(
            (e) => e.message,
            'message',
            'Chọn ngày cho kỳ tuỳ chọn.',
          ),
        ),
      );
    },
  );

  test('a 403 is a ProfitReportPortException', () async {
    final (_, port) = await _port(
      (_) => jsonBody(403, envelope('FORBIDDEN', 'Bạn không có quyền.')),
    );
    await expectLater(
      port.getProfitReport(),
      throwsA(isA<ProfitReportPortException>()),
    );
  });
}
