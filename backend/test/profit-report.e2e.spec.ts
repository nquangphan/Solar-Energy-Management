import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { ErrorCode } from '../src/common/errors/error-code';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';
import { fakeStorage } from './util/fake-storage';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time ⇒ set env BEFORE loading `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `GET /reports/profit` (hermetic — `PrismaService` overridden, real JWT, real
 * ValidationPipe + exception filter). Covers what only exists at the HTTP layer: the `costs.view`
 * gate resolved per request, the 400 envelopes of the query, and the response shape.
 */
describe('/reports/profit (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-profit-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'profit@example.com',
    displayName: 'Profit',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const queryRaw = jest.fn();
  const prismaMock = { $queryRaw: queryRaw };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  function givenPermissions(...keys: readonly string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  const get = (query = '') =>
    request(app.getHttpServer() as Server)
      .get(`/reports/profit${query}`)
      .set(
        'Authorization',
        `Bearer ${jwt.sign({ sub: ACCOUNT_ID, email: account.email })}`,
      );

  const RESPONSE_KEYS = ['groupBy', 'from', 'to', 'totals', 'rows'];
  const FIGURE_KEYS = [
    'revenue',
    'cost',
    'grossProfit',
    'marginPct',
    'orderCount',
  ];
  const ROW_KEYS = [
    ...FIGURE_KEYS,
    'key',
    'label',
    'customerName',
    'assigneeDisplayName',
    'sourceName',
    'issuedAt',
  ];
  const keysWithin = (body: object, allowed: string[]) =>
    Object.keys(body).every((k) => allowed.includes(k));

  const rawRows = [
    {
      orderId: 'aaaaaaaa-0000-4000-8000-000000000001',
      issuedAt: new Date('2026-10-10T03:00:00Z'),
      issuedMonth: '2026-10',
      customerName: 'Khách A',
      assigneeAccountId: 'acc-sale',
      assigneeDisplayName: 'Sale Một',
      sourceId: 'src-1',
      sourceName: 'Facebook',
      revenue: 3_000_000_000n,
      cost: 2_400_000_000n,
    },
    {
      orderId: 'bbbbbbbb-0000-4000-8000-000000000002',
      issuedAt: new Date('2026-10-12T03:00:00Z'),
      issuedMonth: '2026-10',
      customerName: 'Khách B',
      assigneeAccountId: null,
      assigneeDisplayName: null,
      sourceId: 'src-1',
      sourceName: 'Facebook',
      revenue: 10n,
      cost: 10n,
    },
  ];

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(AccountsService)
      .useValue(accountsMock)
      .overrideProvider(AccountPermissionsService)
      .useValue(accountPermissionsMock)
      .overrideProvider(StoragePort)
      .useValue(fakeStorage())
      .overrideProvider(QuoteRendererPort)
      .useValue({ render: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    jwt = moduleRef.get(JwtService);
    await initAppOnLoopback(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue(rawRows);
  });

  it('KE_TOAN (costs.view): 200 with the contract shape and money as numbers', async () => {
    givenPermissions(...ROLE_PRESETS.KE_TOAN);
    const res = await get('?groupBy=order');
    expect(res.status).toBe(200);
    expect(keysWithin(res.body as object, RESPONSE_KEYS)).toBe(true);
    expect(keysWithin(res.body.totals as object, FIGURE_KEYS)).toBe(true);
    const rows = res.body.rows as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(keysWithin(row, ROW_KEYS)).toBe(true);
    expect(res.body.groupBy).toBe('order');
    expect(res.body.totals.revenue).toBe(
      Number(rawRows[0].revenue + rawRows[1].revenue),
    );
    expect(res.body.totals.orderCount).toBe(2);
    expect(rows[0]).toMatchObject({
      key: 'bbbbbbbb-0000-4000-8000-000000000002',
      label: 'BG-BBBBBBBB',
      assigneeDisplayName: null,
      marginPct: 0,
      issuedAt: '2026-10-12T03:00:00.000Z',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('permissions are read fresh on every request', async () => {
    givenPermissions(PERM.costsView);
    expect((await get()).status).toBe(200);
    givenPermissions(PERM.ordersViewAll);
    expect((await get()).status).toBe(403);
    expect(accountPermissionsMock.listForAccount).toHaveBeenCalledTimes(2);
  });

  it('every order and finance permission but costs.view ⇒ 403, nothing read', async () => {
    givenPermissions(
      ...ROLE_PRESETS.KE_TOAN.filter((key) => key !== PERM.costsView),
    );
    const res = await get();
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('orders.view_all + dashboard.finance_view + payments.record alone ⇒ 403', async () => {
    givenPermissions(
      PERM.ordersViewAll,
      PERM.dashboardFinanceView,
      PERM.paymentsRecord,
    );
    expect((await get()).status).toBe(403);
  });

  it('a valid custom period passes the query validation: 200 with the resolved days bound as Vietnam instants', async () => {
    givenPermissions(PERM.costsView);
    const res = await get(
      '?groupBy=month&period=custom&from=2026-07-01&to=2026-07-31',
    );
    expect(res.status).toBe(200);
    expect([res.body.groupBy, res.body.from, res.body.to]).toEqual([
      'month',
      '2026-07-01',
      '2026-07-31',
    ]);
    const [, ...bound] = queryRaw.mock.calls[0] as [unknown, ...unknown[]];
    expect(bound.filter((v) => v instanceof Date)).toEqual([
      new Date('2026-07-01T00:00:00+07:00'),
      new Date('2026-08-01T00:00:00+07:00'),
    ]);
  });

  it.each([
    ['?groupBy=assignee', 'assignee'],
    ['?groupBy=source&period=year', 'source'],
    ['?period=month', 'order'],
  ])('%s ⇒ 200 grouped by %s', async (query, groupBy) => {
    givenPermissions(PERM.costsView);
    const res = await get(query);
    expect(res.status).toBe(200);
    expect(res.body.groupBy).toBe(groupBy);
  });

  it('no token ⇒ 401', async () => {
    const res = await request(app.getHttpServer() as Server).get(
      '/reports/profit',
    );
    expect(res.status).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ['?groupBy=foo', ['groupBy']],
    ['?period=week', ['period']],
    ['?period=custom&from=2026-02-30&to=2026-03-01', ['from']],
    ['?period=custom&from=2026-07-01&to=31/07/2026', ['to']],
    ['?period=custom', ['from', 'to']],
    ['?period=custom&from=2026-07-01', ['to']],
    ['?period=custom&to=2026-07-31', ['from']],
    ['?period=custom&from=2026-07-31&to=2026-07-01', ['to']],
    ['?period=month&from=2026-07-01', ['from']],
    ['?period=year&to=2026-07-31', ['to']],
    ['?from=2026-07-01&to=2026-07-31', ['from']],
  ])('%s ⇒ 400 VALIDATION_ERROR on %j', async (query, fields) => {
    givenPermissions(PERM.costsView);
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    const errors = res.body.fieldErrors as { field: string; message: string }[];
    expect([...new Set(errors.map((e) => e.field))]).toEqual(fields);
    for (const e of errors) expect(e.message).toMatch(/[ạ-ỹà-ýđ]/);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
