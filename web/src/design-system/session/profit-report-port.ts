// hand-authored — web profit report port (mirror Flutter
// mobile/lib/design_system/session/profit_report_port.dart). The seam between the
// Lợi nhuận screen and `GET /reports/profit`.
//
// READ ONLY. Every figure — revenue, cost, gross profit, margin, row labels —
// arrives computed by the backend (AD-2); the screen only prints it.
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components, paths } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** The report: resolved period, totals and one row per group (`ProfitReportResponseDto`). */
export type ProfitReport = Schemas['ProfitReportResponseDto'];

/** One row: an order, a month, an assignee or a customer source (`ProfitReportRowDto`). */
export type ProfitReportRow = Schemas['ProfitReportRowDto'];

/** Revenue, cost, gross profit, margin and order count (`ProfitFiguresDto`). */
export type ProfitFigures = Schemas['ProfitFiguresDto'];

/** How to group the rows (`ProfitGroupBy`). */
export type ProfitGroupBy = Schemas['ProfitGroupBy'];

/** Preset or custom period (`ProfitPeriod`). */
export type ProfitPeriod = Schemas['ProfitPeriod'];

/** `groupBy`, `period` and — for the custom period only — `from`/`to` (`YYYY-MM-DD`, both inclusive). */
export type ProfitReportQuery = NonNullable<paths['/reports/profit']['get']['parameters']['query']>;

/** Injectable transport for the profit report screen — a PORT, not an HTTP client. */
export interface ProfitReportPort {
  /** Rejects with the AD-5 error (403 without `costs.view`, 400 on a bad period). */
  getProfitReport(query: ProfitReportQuery): Promise<ProfitReport>;
}
