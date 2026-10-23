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
import { ORDER_STATUS_KEYS } from '../src/orders/domain/order-status';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';
import { fakeStorage } from './util/fake-storage';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time ⇒ set env BEFORE loading `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `GET /dashboard/summary` (hermetic — `PrismaService` overridden, real JWT, real
 * ValidationPipe + exception filter). Covers what only exists at the HTTP layer: the permission
 * gate by real presets, the 400 + `fieldErrors` of a bad period, and the money figure being
 * absent from the response body (not merely hidden by a client) without the finance permission.
 */
describe('/dashboard/summary (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-dashboard-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'dashboard@example.com',
    displayName: 'Dashboard',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const queryRaw = jest.fn();
  const orderRepo = { count: jest.fn(), groupBy: jest.fn() };
  const prismaMock = { order: orderRepo, $queryRaw: queryRaw };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  function givenPermissions(...keys: readonly string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  const get = (query = '') =>
    request(app.getHttpServer() as Server)
      .get(`/dashboard/summary${query}`)
      .set(
        'Authorization',
        `Bearer ${jwt.sign({ sub: ACCOUNT_ID, email: account.email })}`,
      );

  /** Keys of the response contract; the body must not carry anything else. */
  const CONTRACT_KEYS = [
    'period',
    'from',
    'to',
    'revenue',
    'newOrderCount',
    'ordersByStatus',
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
    queryRaw.mockResolvedValue([{ total: 1_240_000_000n }]);
    orderRepo.count.mockResolvedValue(37);
    orderRepo.groupBy.mockResolvedValue([
      { status: 'thicong', _count: { _all: 5 } },
    ]);
  });

  it('KE_TOAN (finance + view_all): 200 with revenue as a number and every block filled', async () => {
    givenPermissions(...ROLE_PRESETS.KE_TOAN);
    const res = await get('?period=week');
    expect(res.status).toBe(200);
    expect(
      Object.keys(res.body as object).every((k) => CONTRACT_KEYS.includes(k)),
    ).toBe(true);
    expect(res.body).toMatchObject({
      period: 'week',
      revenue: 1_240_000_000,
      newOrderCount: 37,
    });
    expect(res.body.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      (res.body.ordersByStatus as { status: string }[]).map((s) => s.status),
    ).toEqual([...ORDER_STATUS_KEYS]);
  });

  it('THI_CONG (view_own, no finance): revenue is null in the body and no money query runs', async () => {
    givenPermissions(...ROLE_PRESETS.THI_CONG);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.revenue).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(res.body.newOrderCount).toBe(37);
    expect(res.body.period).toBe('month');
  });

  it('finance only: order blocks are null and no order query runs', async () => {
    givenPermissions(PERM.dashboardFinanceView);
    const res = await get('?period=day');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      revenue: 1_240_000_000,
      newOrderCount: null,
      ordersByStatus: null,
    });
    expect(orderRepo.count).not.toHaveBeenCalled();
    expect(orderRepo.groupBy).not.toHaveBeenCalled();
  });

  it('period=year ⇒ 400 VALIDATION_ERROR with fieldErrors.period', async () => {
    givenPermissions(...ROLE_PRESETS.KE_TOAN);
    const res = await get('?period=year');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(
      (res.body.fieldErrors as { field: string }[]).map((e) => e.field),
    ).toEqual(['period']);
  });

  it('no token ⇒ 401, and nothing is read', async () => {
    const res = await request(app.getHttpServer() as Server).get(
      '/dashboard/summary',
    );
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(orderRepo.count).not.toHaveBeenCalled();
  });

  it('none of the three permissions ⇒ 403', async () => {
    givenPermissions(PERM.catalogView, PERM.inventoryManage);
    const res = await get();
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
  });
});
