// hand-authored — mobile dashboard port (Story 8.1, mirror web
// web/src/design-system/session/dashboard-port.ts). The seam between the Trang
// chủ screen and `GET /dashboard/summary`.
//
// EVERY NUMBER ARRIVES COMPUTED (AD-2): the revenue, the counts and the period
// days. A block the caller may not see arrives as `null` — the backend never
// sends the number (AD-4) — and the screen does not render it at all.
//
// Every data type below is the GENERATED contract type (AD-12).

import '../../api/generated/models/dashboard_status_count_dto.dart';
import '../../api/generated/models/dashboard_summary_response_dto.dart';
import '../../api/generated/models/period.dart';

export '../../api/generated/models/dashboard_status_count_dto_status.dart';
export '../../api/generated/models/dashboard_summary_response_dto_period.dart';
export '../../api/generated/models/period.dart';

/// `revenue` is integer đồng or null; counts are null without an order read permission.
typedef DashboardSummary = DashboardSummaryResponseDto;

/// One status of the snapshot breakdown.
typedef DashboardStatusCount = DashboardStatusCountDto;

/// `day` = today, `week` = Monday → today, `month` = the 1st → today (Vietnam time).
typedef DashboardPeriod = Period;

class DashboardPortException implements Exception {
  const DashboardPortException(this.message, {this.forbidden = false});

  final String message;

  /// 403: the account may see no block at all — retrying cannot help.
  final bool forbidden;

  @override
  String toString() => message;
}

abstract class DashboardPort {
  Future<DashboardSummary> getSummary(DashboardPeriod period);
}
