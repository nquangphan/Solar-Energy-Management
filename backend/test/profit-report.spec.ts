import { profitPeriodRange } from '../src/dashboard/domain/dashboard-period';
import {
  PROFIT_GROUP_BY,
  PROFIT_PERIODS,
  UNASSIGNED_LABEL,
  groupProfitRows,
  profitFigures,
  profitTotals,
  type OrderProfitRow,
} from '../src/dashboard/domain/profit-report';
import { quoteNumberOf } from '../src/orders/domain/quote-number';

/**
 * Gross profit report domain (FR-37). Formula expectations are recomputed in the test from the
 * AC's own wording (Σ(unitPriceSnapshot − costPriceSnapshot) × qty, minus the discount), never
 * typed in as derived numbers.
 */

interface Line {
  unitPriceSnapshot: number;
  costPriceSnapshot: number;
  qty: number;
}

/** The per-order revenue/cost the read query produces, written straight from the AC. */
function orderMoney(lines: Line[], discountAmount: number | null) {
  const sum = (f: (l: Line) => number) =>
    lines.reduce((total, line) => total + f(line), 0);
  return {
    revenue: sum((l) => l.unitPriceSnapshot * l.qty) - (discountAmount ?? 0),
    cost: sum((l) => l.costPriceSnapshot * l.qty),
  };
}

function order(
  overrides: Partial<OrderProfitRow> & Pick<OrderProfitRow, 'orderId'>,
): OrderProfitRow {
  return {
    issuedAt: new Date('2026-07-10T03:00:00Z'),
    issuedMonth: '2026-07',
    customerName: 'Khách A',
    assigneeAccountId: 'acc-1',
    assigneeDisplayName: 'Sale Một',
    sourceId: 'src-1',
    sourceName: 'Facebook',
    revenue: 1_000_000,
    cost: 800_000,
    ...overrides,
  };
}

describe('profit report domain', () => {
  it('lists the four groupings and three periods', () => {
    expect([...PROFIT_GROUP_BY]).toEqual([
      'order',
      'month',
      'assignee',
      'source',
    ]);
    expect([...PROFIT_PERIODS]).toEqual(['month', 'year', 'custom']);
  });

  describe('formula', () => {
    const panels: Line = {
      unitPriceSnapshot: 3_250_000,
      costPriceSnapshot: 2_610_000,
      qty: 14,
    };
    const inverter: Line = {
      unitPriceSnapshot: 18_900_000,
      costPriceSnapshot: 15_300_000,
      qty: 1,
    };
    // A line without a cost price is frozen at its selling price at issue (lineCostSnapshot).
    const installation: Line = {
      unitPriceSnapshot: 6_500_000,
      costPriceSnapshot: 6_500_000,
      qty: 1,
    };

    it('without a discount equals Σ(unitPriceSnapshot − costPriceSnapshot) × qty', () => {
      const lines = [panels, inverter];
      const { revenue, cost } = orderMoney(lines, null);
      const literal = lines.reduce(
        (total, l) =>
          total + (l.unitPriceSnapshot - l.costPriceSnapshot) * l.qty,
        0,
      );
      expect(profitFigures(revenue, cost).grossProfit).toBe(literal);
    });

    it('subtracts the approved discount from revenue and profit, not from cost', () => {
      const lines = [panels, inverter];
      const plain = orderMoney(lines, null);
      const discounted = orderMoney(lines, 2_000_000);
      const figures = profitFigures(discounted.revenue, discounted.cost);
      expect(figures.cost).toBe(plain.cost);
      expect(figures.revenue).toBe(plain.revenue - 2_000_000);
      expect(figures.grossProfit).toBe(
        profitFigures(plain.revenue, plain.cost).grossProfit - 2_000_000,
      );
    });

    it('an installation line adds revenue and cost but no profit', () => {
      const without = orderMoney([panels], null);
      const withInstall = orderMoney([panels, installation], null);
      expect(
        profitFigures(withInstall.revenue, withInstall.cost).grossProfit,
      ).toBe(profitFigures(without.revenue, without.cost).grossProfit);
      expect(withInstall.revenue).toBe(
        without.revenue + installation.unitPriceSnapshot,
      );
    });
  });

  describe('marginPct', () => {
    it('rounds half up to a whole percent', () => {
      // 1 × 100 / 200 = 0.5 ⇒ 1; 1 × 100 / 201 < 0.5 ⇒ 0; 249 × 100 / 1000 = 24.9 ⇒ 25.
      expect(profitFigures(200, 199).marginPct).toBe(1);
      expect(profitFigures(201, 200).marginPct).toBe(0);
      expect(profitFigures(1000, 751).marginPct).toBe(25);
      expect(profitFigures(1000, 755).marginPct).toBe(25);
      expect(profitFigures(1000, 756).marginPct).toBe(24);
    });

    it('is negative for a loss and rounds half toward +∞', () => {
      // −50 × 100 / 1000 = −5 exactly; −245 × 100 / 1000 = −24.5 ⇒ −24; −246 ⇒ −24.6 ⇒ −25.
      expect(profitFigures(1000, 1050).marginPct).toBe(-5);
      expect(profitFigures(1000, 1245).marginPct).toBe(-24);
      expect(profitFigures(1000, 1246).marginPct).toBe(-25);
      expect(profitFigures(1000, 1246).grossProfit).toBe(-246);
    });

    it('is null without positive revenue', () => {
      expect(profitFigures(0, 0).marginPct).toBeNull();
      expect(profitFigures(-500, 0).marginPct).toBeNull();
    });
  });

  describe('grouping', () => {
    const rows: OrderProfitRow[] = [
      order({
        orderId: 'aaaaaaaa-0000-4000-8000-000000000001',
        issuedAt: new Date('2026-07-05T02:00:00Z'),
        issuedMonth: '2026-07',
        revenue: 10_000_000,
        cost: 7_000_000,
      }),
      order({
        orderId: 'bbbbbbbb-0000-4000-8000-000000000002',
        issuedAt: new Date('2026-08-02T02:00:00Z'),
        issuedMonth: '2026-08',
        assigneeAccountId: 'acc-2',
        assigneeDisplayName: 'Sale Hai',
        sourceId: 'src-2',
        sourceName: 'Giới thiệu',
        revenue: 20_000_000,
        cost: 12_000_000,
      }),
      order({
        orderId: 'cccccccc-0000-4000-8000-000000000003',
        issuedAt: new Date('2026-08-20T02:00:00Z'),
        issuedMonth: '2026-08',
        assigneeAccountId: null,
        assigneeDisplayName: null,
        revenue: 5_000_000,
        cost: 5_500_000,
      }),
      order({
        orderId: 'dddddddd-0000-4000-8000-000000000004',
        issuedAt: new Date('2026-08-20T02:00:00Z'),
        issuedMonth: '2026-08',
        assigneeAccountId: null,
        assigneeDisplayName: null,
        sourceId: 'src-2',
        sourceName: 'Giới thiệu',
        revenue: 3_000_000,
        cost: 1_000_000,
      }),
    ];

    it.each(PROFIT_GROUP_BY)('rows of %s add up to the totals', (groupBy) => {
      const grouped = groupProfitRows(rows, groupBy);
      const totals = profitTotals(rows);
      const sum = (f: (r: (typeof grouped)[number]) => number) =>
        grouped.reduce((total, row) => total + f(row), 0);
      expect(grouped.length).toBeGreaterThan(1);
      expect(sum((r) => r.revenue)).toBe(totals.revenue);
      expect(sum((r) => r.cost)).toBe(totals.cost);
      expect(sum((r) => r.grossProfit)).toBe(totals.grossProfit);
      expect(sum((r) => r.orderCount)).toBe(totals.orderCount);
      expect(totals.orderCount).toBe(rows.length);
    });

    it('totals carry the figures of their own sums', () => {
      const totals = profitTotals(rows);
      const revenue = rows.reduce((t, r) => t + r.revenue, 0);
      const cost = rows.reduce((t, r) => t + r.cost, 0);
      expect(totals).toEqual({
        ...profitFigures(revenue, cost),
        orderCount: rows.length,
      });
    });

    it('by order: one row per order, newest issue first, ties by id descending', () => {
      const grouped = groupProfitRows(rows, 'order');
      expect(grouped.map((r) => r.key)).toEqual([
        'dddddddd-0000-4000-8000-000000000004',
        'cccccccc-0000-4000-8000-000000000003',
        'bbbbbbbb-0000-4000-8000-000000000002',
        'aaaaaaaa-0000-4000-8000-000000000001',
      ]);
      const first = grouped[3];
      expect(first).toEqual({
        key: rows[0].orderId,
        label: quoteNumberOf(rows[0].orderId),
        ...profitFigures(rows[0].revenue, rows[0].cost),
        orderCount: 1,
        customerName: 'Khách A',
        assigneeDisplayName: 'Sale Một',
        sourceName: 'Facebook',
        issuedAt: rows[0].issuedAt,
      });
      expect(first.label).toBe('BG-AAAAAAAA');
    });

    it('by month: newest month first, labelled MM/YYYY, order-only fields null', () => {
      const grouped = groupProfitRows(rows, 'month');
      expect(grouped.map((r) => [r.key, r.label, r.orderCount])).toEqual([
        ['2026-08', '08/2026', 3],
        ['2026-07', '07/2026', 1],
      ]);
      for (const row of grouped) {
        expect(row.customerName).toBeNull();
        expect(row.assigneeDisplayName).toBeNull();
        expect(row.sourceName).toBeNull();
        expect(row.issuedAt).toBeNull();
      }
    });

    it('by assignee: unassigned orders share one null row, highest profit first', () => {
      const grouped = groupProfitRows(rows, 'assignee');
      expect(grouped.map((r) => [r.key, r.label, r.orderCount])).toEqual([
        ['acc-2', 'Sale Hai', 1],
        ['acc-1', 'Sale Một', 1],
        [null, UNASSIGNED_LABEL, 2],
      ]);
      const unassigned = grouped[2];
      expect(unassigned).toMatchObject(
        profitFigures(
          rows[2].revenue + rows[3].revenue,
          rows[2].cost + rows[3].cost,
        ),
      );
    });

    it('by source: highest profit first', () => {
      const grouped = groupProfitRows(rows, 'source');
      expect(grouped.map((r) => [r.key, r.label, r.orderCount])).toEqual([
        ['src-2', 'Giới thiệu', 2],
        ['src-1', 'Facebook', 2],
      ]);
    });

    it('equal profits fall back to the label, ascending', () => {
      const tied = [
        order({ orderId: 'o1', sourceId: 's-z', sourceName: 'Zalo' }),
        order({ orderId: 'o2', sourceId: 's-a', sourceName: 'Đối tác' }),
        order({ orderId: 'o3', sourceId: 's-b', sourceName: 'Biển hiệu' }),
      ];
      expect(groupProfitRows(tied, 'source').map((r) => r.label)).toEqual([
        'Biển hiệu',
        'Zalo',
        'Đối tác',
      ]);
    });

    it('no orders ⇒ no rows and zero totals with a null margin', () => {
      for (const groupBy of PROFIT_GROUP_BY)
        expect(groupProfitRows([], groupBy)).toEqual([]);
      expect(profitTotals([])).toEqual({
        revenue: 0,
        cost: 0,
        grossProfit: 0,
        marginPct: null,
        orderCount: 0,
      });
    });
  });

  describe('profitPeriodRange', () => {
    // 2026-12-31T17:30Z is already 1 January 2027 in Vietnam.
    it('month runs from the 1st to today in Vietnam', () => {
      expect(
        profitPeriodRange('month', new Date('2026-10-30T05:00:00Z')),
      ).toEqual({ from: '2026-10-01', to: '2026-10-30' });
      expect(
        profitPeriodRange('month', new Date('2026-12-31T17:30:00Z')),
      ).toEqual({ from: '2027-01-01', to: '2027-01-01' });
    });

    it('year runs from 1 January to today in Vietnam', () => {
      expect(
        profitPeriodRange('year', new Date('2026-10-30T05:00:00Z')),
      ).toEqual({ from: '2026-01-01', to: '2026-10-30' });
      expect(
        profitPeriodRange('year', new Date('2026-12-31T16:59:00Z')),
      ).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    });
  });
});
