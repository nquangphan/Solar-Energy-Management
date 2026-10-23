// hand-authored — the real DashboardPort over the generated client (Story 8.1,
// mirror web/src/api/http-dashboard-port.ts). A rejection reaches the cubit as
// DashboardPortException; 403 is flagged so the screen does not offer a retry.
import '../design_system/session/dashboard_port.dart';
import 'api_error.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpDashboardPort implements DashboardPort {
  HttpDashboardPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  @override
  Future<DashboardSummary> getSummary(DashboardPeriod period) async {
    try {
      return await _transport.call(
        () => _client.dashboard.dashboardControllerSummary(period: period),
      );
    } on ApiError catch (e) {
      throw DashboardPortException(e.message, forbidden: e.status == 403);
    }
  }
}
