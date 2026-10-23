// hand-authored — TEST/DEMO-ONLY fake port (Story 8.1, mirror web
// web/src/design-system/session/fake-dashboard-port.ts).
//
// NOT a real backend: fixed answers so the Trang chủ screen renders without a
// network. It computes nothing — every figure is a fixed literal, never derived.

import '../../api/generated/models/dashboard_status_count_dto.dart';
import 'dashboard_port.dart';

/// A month with every block visible (the caller holds finance + order read).
const DashboardSummary kDemoDashboardSummary = DashboardSummary(
  period: DashboardSummaryResponseDtoPeriod.month,
  from: '2026-10-01',
  to: '2026-10-23',
  revenue: 1240000000,
  newOrderCount: 37,
  ordersByStatus: <DashboardStatusCountDto>[
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.baogia,
      count: 12,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.choduyet,
      count: 4,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.dachot,
      count: 9,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.dacoc,
      count: 11,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.thicong,
      count: 7,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.nghiemthu,
      count: 3,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.danggiao,
      count: 2,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.dagiao,
      count: 1,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.hoanthanh,
      count: 15,
    ),
    DashboardStatusCountDto(
      status: DashboardStatusCountDtoStatus.huy,
      count: 0,
    ),
  ],
);

class FakeDashboardPort implements DashboardPort {
  FakeDashboardPort([this.summary = kDemoDashboardSummary]);

  final DashboardSummary summary;
  final List<DashboardPeriod> calls = <DashboardPeriod>[];

  @override
  Future<DashboardSummary> getSummary(DashboardPeriod period) async {
    calls.add(period);
    return summary;
  }
}
