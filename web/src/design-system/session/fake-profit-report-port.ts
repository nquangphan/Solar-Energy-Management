// hand-authored — TEST/DEMO-ONLY fake port (mirror Flutter
// mobile/lib/design_system/session/fake_profit_report_port.dart).
//
// NOT a real backend: fixed reports so the Lợi nhuận screen renders without a
// network. It computes nothing — every figure below was printed by the backend
// domain functions (`profitTotals` / `groupProfitRows`) over four seeded orders,
// never typed in. It records every query.

import type {
  ProfitFigures,
  ProfitGroupBy,
  ProfitReport,
  ProfitReportPort,
  ProfitReportQuery,
  ProfitReportRow,
} from './profit-report-port';

/** Totals of the four seeded orders: one negative margin, one with no revenue (margin null). */
export const DEMO_PROFIT_TOTALS: ProfitFigures = {
  revenue: 238_962_000,
  cost: 187_440_000,
  grossProfit: 51_522_000,
  marginPct: 22,
  orderCount: 4,
};

/** Rows of each grouping over the same four orders (unassigned ones share the null row). */
export const DEMO_PROFIT_ROWS: Record<ProfitGroupBy, ProfitReportRow[]> = {
  order: [
    {
      key: '9f8e7d6c-5b4a-4321-8765-0123456789ab',
      label: 'BG-9F8E7D6C',
      revenue: 76_862_000,
      cost: 58_140_000,
      grossProfit: 18_722_000,
      marginPct: 24,
      orderCount: 1,
      customerName: 'VP CC Lê Đình Thao',
      assigneeDisplayName: 'Trần Thị Mai',
      sourceName: 'Fanpage',
      issuedAt: '2026-10-28T03:00:00.000Z',
    },
    {
      key: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
      label: 'BG-7A6B5C4D',
      revenue: 152_300_000,
      cost: 118_900_000,
      grossProfit: 33_400_000,
      marginPct: 22,
      orderCount: 1,
      customerName: 'Nguyễn Văn Hùng',
      assigneeDisplayName: 'Lê Quốc Bảo',
      sourceName: 'Zalo',
      issuedAt: '2026-10-20T08:30:00.000Z',
    },
    {
      key: '5e4d3c2b-1a09-4f8e-8d7c-6b5a49382716',
      label: 'BG-5E4D3C2B',
      revenue: 9_800_000,
      cost: 10_400_000,
      grossProfit: -600_000,
      marginPct: -6,
      orderCount: 1,
      customerName: 'Cty TNHH Minh Phát',
      assigneeDisplayName: null,
      sourceName: 'Fanpage',
      issuedAt: '2026-09-14T02:00:00.000Z',
    },
    {
      key: '3c2b1a09-8f7e-4d6c-8b5a-493827160514',
      label: 'BG-3C2B1A09',
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      marginPct: null,
      orderCount: 1,
      customerName: 'Phạm Thu Hà',
      assigneeDisplayName: null,
      sourceName: 'Đại lý',
      issuedAt: '2026-09-02T01:00:00.000Z',
    },
  ],
  month: [
    {
      key: '2026-10',
      label: '10/2026',
      revenue: 229_162_000,
      cost: 177_040_000,
      grossProfit: 52_122_000,
      marginPct: 23,
      orderCount: 2,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    },
    {
      key: '2026-09',
      label: '09/2026',
      revenue: 9_800_000,
      cost: 10_400_000,
      grossProfit: -600_000,
      marginPct: -6,
      orderCount: 2,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    },
  ],
  assignee: [
    {
      key: '22222222-2222-4222-8222-222222222222',
      label: 'Lê Quốc Bảo',
      revenue: 152_300_000,
      cost: 118_900_000,
      grossProfit: 33_400_000,
      marginPct: 22,
      orderCount: 1,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    },
    {
      key: '11111111-1111-4111-8111-111111111111',
      label: 'Trần Thị Mai',
      revenue: 76_862_000,
      cost: 58_140_000,
      grossProfit: 18_722_000,
      marginPct: 24,
      orderCount: 1,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    },
    {
      key: null,
      label: 'Chưa giao người phụ trách',
      revenue: 9_800_000,
      cost: 10_400_000,
      grossProfit: -600_000,
      marginPct: -6,
      orderCount: 2,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    },
  ],
  source: [
    {
      key: 'aaaaaaaa-1111-4111-8111-000000000002',
      label: 'Zalo',
      revenue: 152_300_000,
      cost: 118_900_000,
      grossProfit: 33_400_000,
      marginPct: 22,
      orderCount: 1,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    },
    {
      key: 'aaaaaaaa-1111-4111-8111-000000000001',
      label: 'Fanpage',
      revenue: 86_662_000,
      cost: 68_540_000,
      grossProfit: 18_122_000,
      marginPct: 21,
      orderCount: 2,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    },
    {
      key: 'aaaaaaaa-1111-4111-8111-000000000003',
      label: 'Đại lý',
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      marginPct: null,
      orderCount: 1,
      customerName: null,
      assigneeDisplayName: null,
      sourceName: null,
      issuedAt: null,
    },
  ],
};

export class FakeProfitReportPort implements ProfitReportPort {
  readonly calls: ProfitReportQuery[] = [];

  getProfitReport(query: ProfitReportQuery): Promise<ProfitReport> {
    this.calls.push(query);
    const groupBy = query.groupBy ?? 'order';
    const custom = query.period === 'custom';
    // The resolved days follow the period as the backend's would; the demo rows stay the same.
    const presetFrom = query.period === 'year' ? '2026-01-01' : '2026-10-01';
    return Promise.resolve({
      groupBy,
      from: custom && query.from ? query.from : presetFrom,
      to: custom && query.to ? query.to : '2026-10-30',
      totals: DEMO_PROFIT_TOTALS,
      rows: DEMO_PROFIT_ROWS[groupBy],
    });
  }
}
