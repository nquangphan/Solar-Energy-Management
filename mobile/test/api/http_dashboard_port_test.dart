// HttpDashboardPort (Story 8.1): the period as a query, `revenue: null` kept as
// null (the backend withheld it), a 403 flagged as forbidden for the screen.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_dashboard_port.dart';
import 'package:pns_mobile/design_system/session/dashboard_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpDashboardPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpDashboardPort(s.client, s.transport));
}

void main() {
  test('getSummary sends the period and maps the computed summary', () async {
    final (s, port) = await _port(
      (_) => jsonBody(200, {
        'period': 'week',
        'from': '2026-10-19',
        'to': '2026-10-23',
        'revenue': null,
        'newOrderCount': 5,
        'ordersByStatus': [
          {'status': 'thicong', 'count': 5},
        ],
      }),
    );
    final result = await port.getSummary(Period.week);
    expect(result.revenue, isNull);
    expect(result.newOrderCount, 5);
    expect(
      result.ordersByStatus!.single.status,
      DashboardStatusCountDtoStatus.thicong,
    );
    expect([result.from, result.to], ['2026-10-19', '2026-10-23']);
    final request = s.adapter.requests.single;
    expect([request.method, request.path], ['GET', '/dashboard/summary']);
    expect(request.query, {'period': 'week'});
  });

  test('403 is a DashboardPortException flagged forbidden', () async {
    final (_, port) = await _port(
      (_) => jsonBody(403, envelope('FORBIDDEN', 'Bạn không có quyền.')),
    );
    await expectLater(
      port.getSummary(Period.month),
      throwsA(
        isA<DashboardPortException>()
            .having((e) => e.forbidden, 'forbidden', isTrue)
            .having((e) => e.message, 'message', 'Bạn không có quyền.'),
      ),
    );
  });

  test('500 is a DashboardPortException that is not forbidden', () async {
    final (_, port) = await _port(
      (_) => jsonBody(500, envelope('INTERNAL', 'Lỗi máy chủ')),
    );
    await expectLater(
      port.getSummary(Period.day),
      throwsA(
        isA<DashboardPortException>().having(
          (e) => e.forbidden,
          'forbidden',
          isFalse,
        ),
      ),
    );
  });
}
