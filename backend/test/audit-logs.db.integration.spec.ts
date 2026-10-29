import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AuditLogReadService } from '../src/audit/audit-log-read.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Audit log read on REAL Postgres — what a mock cannot prove: the Vietnam-day boundaries on the
 * UTC `occurred_at` column, the `occurredAt desc, id desc` order when two records share an
 * instant, the target filter, and `total` counting past one page.
 *
 * Every record lives in 2031 so audit rows written by other suites or the dev seed (dated today)
 * never fall inside a range measured here.
 *
 * Skipped without `DATABASE_URL` ⇒ `npm test` stays hermetic. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Audit log read on real Postgres', () => {
  let prisma: PrismaClient;
  let service: AuditLogReadService;

  const ACTOR = 'acc-audit-85-actor';
  const GONE = 'acc-audit-85-gone';
  // Two ids that tie on `occurredAt`: 'f…' sorts after '0…', so `id desc` puts it first.
  const TIE_LOW = '00000000-0000-4000-8000-000000000085';
  const TIE_HIGH = 'ffffffff-ffff-4fff-bfff-ffffffffff85';
  const TIE_AT = new Date('2031-03-10T05:00:00Z');

  interface Fixture {
    id: string;
    actorAccountId: string | null;
    targetType: string;
    occurredAt: Date;
  }

  const fixtures: Fixture[] = [
    // 2031-03-09 23:59:59 in Vietnam — the last second of the 9th.
    {
      id: randomUUID(),
      actorAccountId: ACTOR,
      targetType: 'Order',
      occurredAt: new Date('2031-03-09T16:59:59Z'),
    },
    // 2031-03-10 00:00:00 in Vietnam — the first instant of the 10th.
    {
      id: randomUUID(),
      actorAccountId: null,
      targetType: 'Order',
      occurredAt: new Date('2031-03-09T17:00:00Z'),
    },
    {
      id: TIE_LOW,
      actorAccountId: GONE,
      targetType: 'Product',
      occurredAt: TIE_AT,
    },
    {
      id: TIE_HIGH,
      actorAccountId: ACTOR,
      targetType: 'Order',
      occurredAt: TIE_AT,
    },
    // 2031-03-11 23:59:59 in Vietnam — last second of the 11th.
    {
      id: randomUUID(),
      actorAccountId: ACTOR,
      targetType: 'Account',
      occurredAt: new Date('2031-03-11T16:59:59Z'),
    },
    // 2031-03-12 00:00:00 in Vietnam — outside a range ending on the 11th.
    {
      id: randomUUID(),
      actorAccountId: ACTOR,
      targetType: 'Order',
      occurredAt: new Date('2031-03-11T17:00:00Z'),
    },
  ];

  /** Vietnam calendar day of an instant, computed independently of the code under test. */
  const vnDay = (at: Date) =>
    new Date(at.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const expectedIds = (from: string, to: string, targetType?: string) =>
    fixtures
      .filter(
        (f) =>
          vnDay(f.occurredAt) >= from &&
          vnDay(f.occurredAt) <= to &&
          (targetType === undefined || f.targetType === targetType),
      )
      .sort(
        (a, b) =>
          b.occurredAt.getTime() - a.occurredAt.getTime() ||
          (a.id < b.id ? 1 : -1),
      )
      .map((f) => f.id);

  async function cleanUp(): Promise<void> {
    await prisma.auditLog.deleteMany({
      where: { id: { in: fixtures.map((f) => f.id) } },
    });
    await prisma.account.deleteMany({ where: { id: ACTOR } });
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new AuditLogReadService(prisma as unknown as PrismaService);
    await cleanUp();
    await prisma.account.create({
      data: {
        id: ACTOR,
        email: 'audit-85-actor@test.local',
        passwordHash: 'x',
        displayName: 'Actor 8.5',
      },
    });
    await prisma.auditLog.createMany({
      data: fixtures.map((f) => ({
        id: f.id,
        eventType: 'StatusChanged',
        actorAccountId: f.actorAccountId,
        targetType: f.targetType,
        targetId: randomUUID(),
        before: { status: 'dachot' },
        after: { status: 'dacoc' },
        occurredAt: f.occurredAt,
      })),
    });
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it('a single day holds 00:00:00 to 23:59:59 Vietnam time, not the neighbours', async () => {
    const res = await service.list(
      { from: '2031-03-10', to: '2031-03-10' },
      true,
    );
    expect(res.items.map((i) => i.id)).toEqual(
      expectedIds('2031-03-10', '2031-03-10'),
    );
    expect(res.items.map((i) => i.id)).toContain(fixtures[1].id);
    expect(res.items.map((i) => i.id)).not.toContain(fixtures[0].id);
    expect(res.total).toBe(expectedIds('2031-03-10', '2031-03-10').length);
  });

  it('the last day is inclusive up to 23:59:59 and stops at midnight', async () => {
    const res = await service.list(
      { from: '2031-03-11', to: '2031-03-11' },
      true,
    );
    expect(res.items.map((i) => i.id)).toEqual([fixtures[4].id]);
  });

  it('ties on occurredAt are broken by id descending', async () => {
    const res = await service.list(
      { from: '2031-03-09', to: '2031-03-12' },
      true,
    );
    const ids = res.items.map((i) => i.id);
    expect(ids).toEqual(expectedIds('2031-03-09', '2031-03-12'));
    expect(ids.indexOf(TIE_HIGH)).toBe(ids.indexOf(TIE_LOW) - 1);
  });

  it('filters on the target type', async () => {
    const res = await service.list(
      {
        targetType: 'Order',
        from: '2031-03-09',
        to: '2031-03-12',
      },
      true,
    );
    expect(res.items.map((i) => i.id)).toEqual(
      expectedIds('2031-03-09', '2031-03-12', 'Order'),
    );
    expect(res.items.every((i) => i.targetType === 'Order')).toBe(true);
  });

  it('total counts every match, not just the page', async () => {
    const all = expectedIds('2031-03-09', '2031-03-12');
    const page2 = await service.list(
      {
        from: '2031-03-09',
        to: '2031-03-12',
        page: 2,
        pageSize: 4,
      },
      true,
    );
    expect(page2.total).toBe(all.length);
    expect(page2.items.map((i) => i.id)).toEqual(all.slice(4, 8));
  });

  it('names the actor, keeps the id of an account that is gone, and null for the system', async () => {
    const res = await service.list(
      { from: '2031-03-10', to: '2031-03-10' },
      true,
    );
    const byId = new Map(res.items.map((i) => [i.id, i]));
    expect(byId.get(TIE_HIGH)).toMatchObject({
      actorAccountId: ACTOR,
      actorDisplayName: 'Actor 8.5',
      eventLabel: 'Chuyển trạng thái',
      changes: [
        { field: 'status', before: 'dachot', after: 'dacoc', isMoney: false },
      ],
    });
    expect(byId.get(TIE_LOW)).toMatchObject({
      actorAccountId: GONE,
      actorDisplayName: null,
    });
    expect(byId.get(fixtures[1].id)).toMatchObject({
      actorAccountId: null,
      actorDisplayName: null,
    });
  });
});
