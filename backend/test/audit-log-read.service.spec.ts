import { AuditLogReadService } from '../src/audit/audit-log-read.service';
import { AppException } from '../src/common/errors/app.exception';
import type { PrismaService } from '../src/prisma/prisma.service';

/** The audit read query: filters, order, paging and the one-query actor lookup. */
describe('AuditLogReadService.list', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const accountFindMany = jest.fn();
  const transaction = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));
  const prisma = {
    auditLog: { findMany, count },
    account: { findMany: accountFindMany },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new AuditLogReadService(prisma);

  const row = (over: Record<string, unknown>) => ({
    id: 'log-1',
    eventType: 'OrderConfirmed',
    actorAccountId: 'acc-a',
    targetType: 'Order',
    targetId: 'ord-1',
    before: { status: 'baogia' },
    after: { status: 'dachot' },
    occurredAt: new Date('2026-10-30T03:00:00Z'),
    createdAt: new Date('2026-10-30T03:00:01Z'),
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    accountFindMany.mockResolvedValue([]);
  });

  it('defaults: page 1 of 20, newest first with id tiebreak, no filter', async () => {
    const res = await service.list({}, true);
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(count).toHaveBeenCalledWith({ where: {} });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(accountFindMany).not.toHaveBeenCalled();
  });

  it('target type and Vietnam-day range become one where for both queries', async () => {
    await service.list(
      {
        targetType: 'Order',
        from: '2026-10-01',
        to: '2026-10-30',
        page: 3,
        pageSize: 10,
      },
      true,
    );
    const where = {
      targetType: 'Order',
      occurredAt: {
        gte: new Date('2026-09-30T17:00:00Z'),
        lt: new Date('2026-10-30T17:00:00Z'),
      },
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 20, take: 10 }),
    );
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('a single end of the range filters on that end only', async () => {
    await service.list({ from: '2026-10-05' }, true);
    expect(count).toHaveBeenCalledWith({
      where: { occurredAt: { gte: new Date('2026-10-04T17:00:00Z') } },
    });
    await service.list({ to: '2026-10-05' }, true);
    expect(count).toHaveBeenLastCalledWith({
      where: { occurredAt: { lt: new Date('2026-10-05T17:00:00Z') } },
    });
  });

  it('from equal to to is one whole day', async () => {
    await service.list({ from: '2026-10-05', to: '2026-10-05' }, true);
    expect(count).toHaveBeenCalledWith({
      where: {
        occurredAt: {
          gte: new Date('2026-10-04T17:00:00Z'),
          lt: new Date('2026-10-05T17:00:00Z'),
        },
      },
    });
  });

  it('from after to ⇒ 400 with fieldErrors.to and no query', async () => {
    await expect(
      service.list({ from: '2026-10-06', to: '2026-10-05' }, true),
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: [
        {
          field: 'to',
          code: 'INVALID_DATE_RANGE',
          message: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
        },
      ],
    });
    await expect(
      service.list({ from: '2026-10-06', to: '2026-10-05' }, true),
    ).rejects.toBeInstanceOf(AppException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('names every actor of the page with ONE account query', async () => {
    findMany.mockResolvedValue([
      row({ id: 'l1', actorAccountId: 'acc-a' }),
      row({ id: 'l2', actorAccountId: 'acc-b' }),
      row({ id: 'l3', actorAccountId: 'acc-a' }),
      row({ id: 'l4', actorAccountId: null }),
      row({ id: 'l5', actorAccountId: 'acc-gone' }),
    ]);
    count.mockResolvedValue(42);
    accountFindMany.mockResolvedValue([
      { id: 'acc-a', displayName: 'An' },
      { id: 'acc-b', displayName: 'Bình' },
    ]);
    const res = await service.list({}, true);
    expect(accountFindMany).toHaveBeenCalledTimes(1);
    expect(accountFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['acc-a', 'acc-b', 'acc-gone'] } },
      select: { id: true, displayName: true },
    });
    expect(
      res.items.map((i) => [i.id, i.actorAccountId, i.actorDisplayName]),
    ).toEqual([
      ['l1', 'acc-a', 'An'],
      ['l2', 'acc-b', 'Bình'],
      ['l3', 'acc-a', 'An'],
      ['l4', null, null],
      ['l5', 'acc-gone', null],
    ]);
    expect(res.total).toBe(42);
  });

  it('drops cost fields from changes for a reader without costs.view', async () => {
    findMany.mockResolvedValue([
      row({
        eventType: 'ProductUpdated',
        targetType: 'Product',
        before: { price: 2000000, costPrice: 1500000 },
        after: { price: 2100000, costPrice: 1600000 },
      }),
    ]);
    const fields = async (canViewCosts: boolean) =>
      (await service.list({}, canViewCosts)).items[0].changes.map(
        (c) => c.field,
      );
    expect(await fields(false)).toEqual(['price']);
    expect(await fields(true)).toEqual(['price', 'costPrice']);
  });

  it('maps the five dimensions: label, target, instant and flat changes', async () => {
    const occurredAt = new Date('2026-10-30T03:00:00Z');
    findMany.mockResolvedValue([
      row({
        id: 'l1',
        eventType: 'PaymentRecorded',
        targetType: null,
        targetId: null,
        before: { orderPaid: 0 },
        after: { orderPaid: 83010960 },
        occurredAt,
      }),
    ]);
    accountFindMany.mockResolvedValue([{ id: 'acc-a', displayName: 'An' }]);
    const [item] = (await service.list({}, true)).items;
    expect(item).toEqual({
      id: 'l1',
      eventType: 'PaymentRecorded',
      eventLabel: 'Ghi nhận thanh toán',
      actorAccountId: 'acc-a',
      actorDisplayName: 'An',
      targetType: null,
      targetId: null,
      occurredAt,
      changes: [
        { field: 'orderPaid', before: '0', after: '83010960', isMoney: true },
      ],
    });
  });
});
