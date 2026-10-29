// hand-authored — profit report state, held by ProfitReportCubit.
import 'package:equatable/equatable.dart';

import '../../design_system/session/profit_report_port.dart';

/// [awaitingDates]: the custom period is chosen but a day is still missing —
/// nothing is asked of the backend until both are real days.
/// [reversedDates]: both days are set but the end is before the start — the
/// backend would only refuse it, and Thử lại could not fix it.
enum ProfitReportStatus { loading, ready, error, awaitingDates, reversedDates }

/// One class for every phase: the grouping, the period and the last report
/// outlive a load or a failure.
final class ProfitReportState extends Equatable {
  const ProfitReportState({
    this.status = ProfitReportStatus.loading,
    this.groupBy = ProfitGroupBy.order,
    this.period = ProfitPeriod.month,
    this.from,
    this.to,
    this.report,
    this.errorMessage,
  });

  final ProfitReportStatus status;
  final ProfitGroupBy groupBy;
  final ProfitPeriod period;

  /// Vietnam days `YYYY-MM-DD` (both inclusive) of the custom period; sent only
  /// with [ProfitPeriod.custom], kept while another period is shown.
  final String? from;
  final String? to;

  /// The last report, exactly as the backend sent it.
  final ProfitReport? report;

  /// The backend's sentence of the last failure.
  final String? errorMessage;

  @override
  List<Object?> get props => [
    status,
    groupBy,
    period,
    from,
    to,
    report,
    errorMessage,
  ];
}
