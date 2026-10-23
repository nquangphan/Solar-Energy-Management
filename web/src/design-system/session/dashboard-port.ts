// hand-authored — web dashboard port (Story 8.1, mirror Flutter
// mobile/lib/design_system/session/dashboard_port.dart). The seam between the
// Trang chủ screen and `GET /dashboard/summary`.
//
// EVERY NUMBER ARRIVES COMPUTED (AD-2): the revenue, the counts and the period
// days. A block the caller may not see arrives as `null` — the backend never
// sends the number (AD-4) — and the screen does not render it at all.
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** `DashboardSummaryResponseDto`: `revenue` is integer đồng or null; counts are null without an order read permission. */
export type DashboardSummary = Schemas['DashboardSummaryResponseDto'];

/** One status of the snapshot breakdown (`DashboardStatusCountDto`). */
export type DashboardStatusCount = Schemas['DashboardStatusCountDto'];

/** `day` = today, `week` = Monday → today, `month` = the 1st → today (Vietnam time). */
export type DashboardPeriod = DashboardSummary['period'];

/** Injectable transport for the dashboard screen — a PORT, not an HTTP client. */
export interface DashboardPort {
  /** Rejects with the AD-5 error (`status` 403 when the account may see no block at all). */
  getSummary(period: DashboardPeriod): Promise<DashboardSummary>;
}
