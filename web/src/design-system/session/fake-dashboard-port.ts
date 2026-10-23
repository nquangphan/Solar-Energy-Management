// hand-authored — TEST/DEMO-ONLY fake port (Story 8.1, mirror Flutter
// mobile/lib/design_system/session/fake_dashboard_port.dart).
//
// NOT a real backend: fixed answers so the Trang chủ screen renders without a
// network. It computes nothing — every figure is a fixed literal, never derived.

import type {
  DashboardPeriod,
  DashboardPort,
  DashboardSummary,
} from './dashboard-port';

/** A month with every block visible (the caller holds finance + order read). */
export const DEMO_DASHBOARD_SUMMARY: DashboardSummary = {
  period: 'month',
  from: '2026-10-01',
  to: '2026-10-23',
  revenue: 1_240_000_000,
  newOrderCount: 37,
  ordersByStatus: [
    { status: 'baogia', count: 12 },
    { status: 'choduyet', count: 4 },
    { status: 'dachot', count: 9 },
    { status: 'dacoc', count: 11 },
    { status: 'thicong', count: 7 },
    { status: 'nghiemthu', count: 3 },
    { status: 'danggiao', count: 2 },
    { status: 'dagiao', count: 1 },
    { status: 'hoanthanh', count: 15 },
    { status: 'huy', count: 0 },
  ],
};

export class FakeDashboardPort implements DashboardPort {
  readonly calls: DashboardPeriod[] = [];

  constructor(private readonly summary: DashboardSummary = DEMO_DASHBOARD_SUMMARY) {}

  getSummary(period: DashboardPeriod): Promise<DashboardSummary> {
    this.calls.push(period);
    return Promise.resolve({ ...this.summary, period });
  }
}
