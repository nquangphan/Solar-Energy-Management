import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import {
  PERM,
  PERMISSION_KEYS,
} from '../src/accounts/domain/permission-registry';
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
 * e2e `GET /audit-logs` (hermetic — `PrismaService` overridden, real JWT, real ValidationPipe +
 * exception filter). Covers the HTTP-only parts: the `audit.read` PERMISSION gate (the full
 * ADMIN preset and `settings.manage` are not enough), the 400s of a bad query, the response
 * contract, and the absence of any write route.
 */
describe('/audit-logs (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-audit-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'audit@example.com',
    displayName: 'Audit',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const auditRepo = { findMany: jest.fn(), count: jest.fn() };
  const accountRepo = { findMany: jest.fn() };
  const prismaMock = {
    auditLog: auditRepo,
    account: accountRepo,
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  function givenPermissions(...keys: readonly string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  const auth = () =>
    `Bearer ${jwt.sign({ sub: ACCOUNT_ID, email: account.email })}`;
  const get = (query = '') =>
    request(app.getHttpServer() as Server)
      .get(`/audit-logs${query}`)
      .set('Authorization', auth());

  const ENVELOPE_KEYS = ['items', 'total', 'page', 'pageSize'];
  const ENTRY_KEYS = [
    'id',
    'eventType',
    'eventLabel',
    'actorAccountId',
    'actorDisplayName',
    'targetType',
    'targetId',
    'occurredAt',
    'changes',
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
    auditRepo.findMany.mockResolvedValue([
      {
        id: 'log-1',
        eventType: 'OrderConfirmed',
        actorAccountId: ACCOUNT_ID,
        targetType: 'Order',
        targetId: 'ord-1',
        before: { status: 'baogia' },
        after: { status: 'dachot' },
        occurredAt: new Date('2026-10-30T03:00:00Z'),
        createdAt: new Date('2026-10-30T03:00:00Z'),
      },
    ]);
    auditRepo.count.mockResolvedValue(21);
    accountRepo.findMany.mockResolvedValue([
      { id: ACCOUNT_ID, displayName: 'Audit' },
    ]);
  });

  it('with audit.read: 200, contract keys only, five dimensions filled', async () => {
    givenPermissions(PERM.auditRead);
    const res = await get('?targetType=Order&from=2026-10-01&to=2026-10-30');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body as object).sort()).toEqual(
      [...ENVELOPE_KEYS].sort(),
    );
    expect(res.body).toMatchObject({ total: 21, page: 1, pageSize: 20 });
    const [entry] = res.body.items as Record<string, unknown>[];
    expect(Object.keys(entry).every((k) => ENTRY_KEYS.includes(k))).toBe(true);
    expect(entry).toMatchObject({
      eventType: 'OrderConfirmed',
      eventLabel: 'Chốt đơn',
      actorAccountId: ACCOUNT_ID,
      actorDisplayName: 'Audit',
      targetType: 'Order',
      targetId: 'ord-1',
      occurredAt: '2026-10-30T03:00:00.000Z',
      changes: [
        { field: 'status', before: 'baogia', after: 'dachot', isMoney: false },
      ],
    });
  });

  it('page and pageSize arrive as query strings and reach the query as numbers', async () => {
    givenPermissions(PERM.auditRead);
    const res = await get('?page=3&pageSize=100');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 3, pageSize: 100 });
    expect(auditRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 200, take: 100 }),
    );
  });

  it('no bearer token ⇒ 401 and no read', async () => {
    const res = await request(app.getHttpServer() as Server).get('/audit-logs');
    expect(res.status).toBe(401);
    expect(auditRepo.findMany).not.toHaveBeenCalled();
  });

  it('the permission is read fresh per request: revoked ⇒ the same token gets 403', async () => {
    givenPermissions(PERM.auditRead);
    expect((await get()).status).toBe(200);
    // 200: the gate plus the costs.view check; 403: the gate alone.
    expect(accountPermissionsMock.listForAccount).toHaveBeenCalledTimes(2);
    givenPermissions(PERM.settingsManage);
    expect((await get()).status).toBe(403);
    expect(accountPermissionsMock.listForAccount).toHaveBeenCalledTimes(3);
  });

  it('cost fields reach only a reader with costs.view', async () => {
    auditRepo.findMany.mockResolvedValue([
      {
        id: 'log-2',
        eventType: 'StockVoucherCreated',
        actorAccountId: ACCOUNT_ID,
        targetType: 'StockVoucher',
        targetId: 'sv-1',
        before: null,
        after: {
          ma: 'PN-1',
          lines: [{ qty: 2, unitCost: 1500000, giaVonSau: 1500000 }],
        },
        occurredAt: new Date('2026-10-30T03:00:00Z'),
        createdAt: new Date('2026-10-30T03:00:00Z'),
      },
    ]);
    const fields = async () =>
      ((await get()).body.items[0].changes as { field: string }[]).map(
        (c) => c.field,
      );
    givenPermissions(PERM.auditRead);
    expect(await fields()).toEqual(['ma', 'lines[0].qty']);
    givenPermissions(PERM.auditRead, PERM.costsView);
    expect(await fields()).toEqual([
      'ma',
      'lines[0].qty',
      'lines[0].unitCost',
      'lines[0].giaVonSau',
    ]);
  });

  it('the full ADMIN preset (no audit.read) ⇒ 403 and no read', async () => {
    expect(ROLE_PRESETS.ADMIN).not.toContain(PERM.auditRead);
    givenPermissions(...ROLE_PRESETS.ADMIN);
    const res = await get();
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    expect(auditRepo.findMany).not.toHaveBeenCalled();
  });

  it('every permission but audit.read ⇒ 403', async () => {
    givenPermissions(...PERMISSION_KEYS.filter((k) => k !== PERM.auditRead));
    expect((await get()).status).toBe(403);
  });

  it('settings.manage alone ⇒ 403', async () => {
    givenPermissions(PERM.settingsManage);
    expect((await get()).status).toBe(403);
  });

  it.each([
    ['from after to', '?from=2026-10-06&to=2026-10-05', 'to'],
    ['unknown target type', '?targetType=Foo', 'targetType'],
    ['page size over 100', '?pageSize=101', 'pageSize'],
    ['impossible month', '?from=2026-13-01', 'from'],
    ['not a plain date', '?to=2026-10-05T00:00:00Z', 'to'],
    ['page zero', '?page=0', 'page'],
    ['page size zero', '?pageSize=0', 'pageSize'],
    ['page not a number', '?page=abc', 'page'],
  ])('%s ⇒ 400 VALIDATION_ERROR on %s', async (_name, query, field) => {
    givenPermissions(PERM.auditRead);
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    const fieldErrors = res.body.fieldErrors as {
      field: string;
      message: string;
    }[];
    expect(fieldErrors.map((e) => e.field)).toContain(field);
    expect(fieldErrors.every((e) => /[ạ-ỹà-ýăđơư]/i.test(e.message))).toBe(
      true,
    );
    expect(auditRepo.findMany).not.toHaveBeenCalled();
  });

  it.each(['patch', 'put', 'delete', 'post'] as const)(
    'no %s route on /audit-logs ⇒ 404',
    async (method) => {
      givenPermissions(...PERMISSION_KEYS);
      const server = request(app.getHttpServer() as Server);
      const res = await server[method]('/audit-logs').set(
        'Authorization',
        auth(),
      );
      expect(res.status).toBe(404);
      const one = await server[method]('/audit-logs/log-1').set(
        'Authorization',
        auth(),
      );
      expect(one.status).toBe(404);
    },
  );
});
