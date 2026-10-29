// hand-authored — mobile profit report port (mirror web
// web/src/design-system/session/profit-report-port.ts). The seam between the
// Báo cáo lợi nhuận screen and `GET /reports/profit`.
//
// READ ONLY. Every figure — revenue, cost, gross profit, margin, row labels —
// arrives computed by the backend (AD-2); the screen only prints it.
//
// Every data type below is the GENERATED contract type (AD-12).
import '../../api/generated/models/profit_figures_dto.dart';
import '../../api/generated/models/profit_group_by.dart';
import '../../api/generated/models/profit_period.dart';
import '../../api/generated/models/profit_report_response_dto.dart';
import '../../api/generated/models/profit_report_row_dto.dart';

export '../../api/generated/models/profit_group_by.dart';
export '../../api/generated/models/profit_period.dart';

/// The report: resolved period, totals and one row per group.
typedef ProfitReport = ProfitReportResponseDto;

/// One row: an order, a month, an assignee or a customer source.
typedef ProfitReportRow = ProfitReportRowDto;

/// Revenue, cost, gross profit, margin and order count.
typedef ProfitFigures = ProfitFiguresDto;

class ProfitReportPortException implements Exception {
  const ProfitReportPortException(this.message);

  final String message;

  @override
  String toString() => message;
}

abstract class ProfitReportPort {
  /// [from]/[to] are Vietnam days `YYYY-MM-DD`, both inclusive, sent with
  /// [ProfitPeriod.custom] only.
  Future<ProfitReport> getProfitReport({
    ProfitGroupBy? groupBy,
    ProfitPeriod? period,
    String? from,
    String? to,
  });
}
