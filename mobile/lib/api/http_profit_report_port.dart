// hand-authored — the real ProfitReportPort over the generated client (twin of
// web/src/api/http-profit-report-port.ts). A rejection reaches the cubit
// as ProfitReportPortException carrying the backend's sentence.
import '../design_system/session/profit_report_port.dart';
import 'api_error.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpProfitReportPort implements ProfitReportPort {
  HttpProfitReportPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  @override
  Future<ProfitReport> getProfitReport({
    ProfitGroupBy? groupBy,
    ProfitPeriod? period,
    String? from,
    String? to,
  }) async {
    try {
      return await _transport.call(
        () => _client.reports.profitReportControllerProfit(
          groupBy: groupBy,
          period: period,
          from: from,
          to: to,
        ),
      );
    } on ApiError catch (e) {
      throw ProfitReportPortException(e.message);
    }
  }
}
