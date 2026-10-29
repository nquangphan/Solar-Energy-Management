import { AppException } from '../src/common/errors/app.exception';
import {
  groupProfitRows,
  profitTotals,
} from '../src/dashboard/domain/profit-report';
import { ProfitReportService } from '../src/dashboard/profit-report.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * `ProfitReportService` with a mocked `$queryRaw` (hermetic). The SQL itself is proven in the DB
 * lane; here: one query per report, bigint → number at one point, period → instant parameters,
 * and the period validation rules.
 */
describe('ProfitReportService', () => {
  const queryRaw = jest.fn();
  const service = new ProfitReportService({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);
  const NOW = new Date('2026-10-30T05:00:00Z');

  const rawRow = {
    orderId: 'aaaaaaaa-0000-4000-8000-000000000001',
    issuedAt: new Date('2026-10-10T03:00:00Z'),
    issuedMonth: '2026-10',
    customerName: 'Khách A',
    assigneeAccountId: null,
    assigneeDisplayName: null,
    sourceId: 'src-1',
    sourceName: 'Facebook',
    revenue: 3_000_000_000n,
    cost: 2_400_000_000n,
  };

  /** The instant parameters bound into the tagged template, in order. */
  function boundInstants(): Date[] {
    const [, ...values] = queryRaw.mock.calls[0] as [unknown, ...unknown[]];
    return values.filter((v): v is Date => v instanceof Date);
  }

  beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([rawRow]);
  });

  it('runs exactly one query and turns bigint money into numbers', async () => {
    const report = await service.report({ groupBy: 'assignee' }, NOW);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const order = { ...rawRow, revenue: 3_000_000_000, cost: 2_400_000_000 };
    expect(report).toEqual({
      groupBy: 'assignee',
      from: '2026-10-01',
      to: '2026-10-30',
      totals: profitTotals([order]),
      rows: groupProfitRows([order], 'assignee'),
    });
    expect(typeof report.totals.revenue).toBe('number');
    expect(typeof report.rows[0].cost).toBe('number');
  });

  it('defaults to grouping by order over the current month', async () => {
    const report = await service.report({}, NOW);
    expect(report.groupBy).toBe('order');
    expect([report.from, report.to]).toEqual(['2026-10-01', '2026-10-30']);
    expect(boundInstants()).toEqual([
      new Date('2026-10-01T00:00:00+07:00'),
      new Date('2026-10-31T00:00:00+07:00'),
    ]);
  });

  it('year runs from 1 January', async () => {
    const report = await service.report({ period: 'year' }, NOW);
    expect([report.from, report.to]).toEqual(['2026-01-01', '2026-10-30']);
    expect(boundInstants()[0]).toEqual(new Date('2026-01-01T00:00:00+07:00'));
  });

  it('custom binds both Vietnam days, the last one inclusive', async () => {
    const report = await service.report(
      { period: 'custom', from: '2026-07-01', to: '2026-07-31' },
      NOW,
    );
    expect([report.from, report.to]).toEqual(['2026-07-01', '2026-07-31']);
    expect(boundInstants()).toEqual([
      new Date('2026-07-01T00:00:00+07:00'),
      new Date('2026-08-01T00:00:00+07:00'),
    ]);
  });

  it('custom over a single day is allowed', async () => {
    const report = await service.report(
      { period: 'custom', from: '2026-07-01', to: '2026-07-01' },
      NOW,
    );
    expect([report.from, report.to]).toEqual(['2026-07-01', '2026-07-01']);
  });

  async function fieldErrorsOf(
    query: Parameters<ProfitReportService['report']>[0],
  ): Promise<{ field: string; code: string; message: string }[]> {
    const error = await service.report(query, NOW).then(
      () => {
        throw new Error('expected a validation error');
      },
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(400);
    expect(queryRaw).not.toHaveBeenCalled();
    return [...((error as AppException).fieldErrors ?? [])];
  }

  it.each([
    [{}, ['from', 'to']],
    [{ from: '2026-07-01' }, ['to']],
    [{ to: '2026-07-31' }, ['from']],
  ])('custom missing days %j ⇒ 400 on %j', async (days, fields) => {
    const errors = await fieldErrorsOf({ period: 'custom', ...days });
    expect(errors.map((e) => e.field)).toEqual(fields);
    expect(errors[0].message).toBe('Chọn ngày cho kỳ tuỳ chọn.');
  });

  it('from after to ⇒ 400 on to', async () => {
    const errors = await fieldErrorsOf({
      period: 'custom',
      from: '2026-07-02',
      to: '2026-07-01',
    });
    expect(errors).toEqual([
      {
        field: 'to',
        code: 'INVALID_DATE_RANGE',
        message: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
      },
    ]);
  });

  it.each([
    ['month', { from: '2026-07-01' }, 'from'],
    ['year', { to: '2026-07-01' }, 'to'],
    [undefined, { from: '2026-07-01', to: '2026-07-02' }, 'from'],
  ] as const)(
    'days with period %s ⇒ 400, never silently dropped',
    async (period, days, field) => {
      const errors = await fieldErrorsOf({ period, ...days });
      expect(errors).toEqual([
        {
          field,
          code: 'DATES_ONLY_FOR_CUSTOM',
          message: 'Chỉ gửi ngày khi chọn kỳ tuỳ chọn.',
        },
      ]);
    },
  );
});
