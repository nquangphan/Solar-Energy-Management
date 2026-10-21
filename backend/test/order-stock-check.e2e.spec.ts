import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { ErrorCode } from '../src/common/errors/error-code';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { fakeStorage } from './util/fake-storage';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time ⇒ set env BEFORE loading `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `GET /orders/:id/stock-check` (hermetic — `PrismaService` overridden, real JWT). Covers
 * what only lives at the HTTP layer: the OR gate by real presets, `ParseUUIDPipe`, order scope
 * (404 with the same message as an unknown id), the response shape (merged per product, free
 * and non-tracked lines absent, ordered by name then id, no money) and that it writes nothing.
 */
describe('/orders/:id/stock-check (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-sale-1';
  const OTHER = 'acc-other';
  const ORDER_ID = '66666666-6666-4666-8666-666666666666';
  const UNKNOWN_ID = '77777777-7777-4777-8777-777777777777';
  const VERSION_ID = 'ver-sc-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'sale@example.com',
    displayName: 'Thợ KS',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function order(ownerAccountId: string, assigneeAccountId: string | null) {
    return {
      id: ORDER_ID,
      status: 'baogia',
      customerSdt: '+84912345678',
      currentVersionId: VERSION_ID,
      ownerAccountId,
      assigneeAccountId,
      sourceId: 'src-fb',
      custType: 'CA_NHAN',
      scopeThietBi: true,
      scopeThiCong: true,
      scopeVanChuyen: false,
      kWp: null,
      vatMode: null,
      validityNote: null,
      cancelReason: null,
      cancelledAt: null,
      createdAt: new Date('2026-10-20T01:00:00Z'),
      updatedAt: new Date('2026-10-20T01:00:00Z'),
    };
  }

  const ORDER_LINES = [
    { productId: 'prod-panel', qty: 10 },
    { productId: 'prod-install', qty: 1 },
    { productId: null, qty: 1 },
    { productId: 'prod-panel', qty: 6 },
    { productId: 'prod-inverter', qty: 1 },
  ];
  const PRODUCTS = [
    {
      id: 'prod-panel',
      name: 'Tấm pin 550W',
      sku: 'PIN-550',
      unit: 'tấm',
      price: 3_000_000,
      costPrice: 2_088_000,
      tracksStock: true,
      stockItem: { id: 'si-panel', productId: 'prod-panel', onHand: 5 },
    },
    {
      id: 'prod-inverter',
      name: 'Inverter 8kW',
      sku: 'INV-8K',
      unit: 'bộ',
      price: 20_000_000,
      costPrice: 15_000_000,
      tracksStock: true,
      stockItem: { id: 'si-inv', productId: 'prod-inverter', onHand: 4 },
    },
    {
      id: 'prod-install',
      name: 'Công lắp đặt',
      sku: 'CONG',
      unit: 'gói',
      price: 1_500_000,
      costPrice: 0,
      tracksStock: false,
      stockItem: null,
    },
  ];

  let currentOrder: ReturnType<typeof order> | null;

  const orderRepo = { findFirst: jest.fn() };
  const lineRepo = { findMany: jest.fn() };
  const productRepo = { findMany: jest.fn() };
  const stockMovementRepo = { groupBy: jest.fn() };
  const stockVoucherRead = { findUnique: jest.fn() };
  const writes = {
    stockItem: { upsert: jest.fn(), update: jest.fn() },
    stockVoucher: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prismaMock = {
    order: orderRepo,
    orderLineItem: lineRepo,
    product: productRepo,
    stockMovement: stockMovementRepo,
    ...writes,
    stockVoucher: { ...writes.stockVoucher, ...stockVoucherRead },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  function givenPermissions(...keys: readonly string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function get(id = ORDER_ID) {
    return request(server())
      .get(`/orders/${id}/stock-check`)
      .set(
        'Authorization',
        `Bearer ${jwt.sign({ sub: ACCOUNT_ID, email: account.email })}`,
      );
  }

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
    currentOrder = order(ACCOUNT_ID, null);
    // Scope fake: applies the owner/assignee clause the service ACTUALLY sends — if it stops
    // sending it, the "someone else's order ⇒ 404" case goes red.
    orderRepo.findFirst.mockImplementation(
      (args: {
        where: { AND: ({ id?: string } & Record<string, unknown>)[] };
      }) => {
        const o = currentOrder;
        if (o === null || args.where.AND[0].id !== o.id) {
          return Promise.resolve(null);
        }
        for (const clause of args.where.AND.slice(1)) {
          const or = clause.OR as Record<string, string>[] | undefined;
          if (
            or &&
            !or.some(
              (branch) =>
                branch.ownerAccountId === o.ownerAccountId ||
                branch.assigneeAccountId === o.assigneeAccountId,
            )
          ) {
            return Promise.resolve(null);
          }
        }
        return Promise.resolve(o);
      },
    );
    lineRepo.findMany.mockResolvedValue(ORDER_LINES);
    productRepo.findMany.mockResolvedValue(PRODUCTS);
    // Not issued yet — the warning applies.
    stockVoucherRead.findUnique.mockResolvedValue(null);
    // Ledger: 3 panels promised in total, all of them to OTHER orders; this order holds none.
    stockMovementRepo.groupBy.mockImplementation(
      (args: { where: { orderId?: string } }) =>
        Promise.resolve(
          args.where.orderId === undefined
            ? [{ stockItemId: 'si-panel', _sum: { qty: 3 } }]
            : [],
        ),
    );
    givenPermissions(...ROLE_PRESETS.THO_KS);
  });

  it('no token ⇒ 401', async () => {
    const res = await request(server()).get(`/orders/${ORDER_ID}/stock-check`);
    expect(res.status).toBe(401);
  });

  it('THO_KS owning the order (quotes.create_edit) ⇒ 200: merged per product, free + non-tracked lines absent, name order, backend figures', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      lines: [
        {
          productId: 'prod-inverter',
          name: 'Inverter 8kW',
          unit: 'bộ',
          qty: 1,
          onHand: 4,
          reserved: 0,
          available: 4,
          shortfall: 0,
          status: 'enough',
        },
        {
          productId: 'prod-panel',
          name: 'Tấm pin 550W',
          unit: 'tấm',
          qty: 16,
          onHand: 5,
          reserved: 3,
          available: 2,
          shortfall: 14,
          status: 'short',
        },
      ],
    });
  });

  it('no money and no cost anywhere in the body', async () => {
    const res = await get();

    const keys = new Set(
      (res.body.lines as Record<string, unknown>[]).flatMap((l) =>
        Object.keys(l),
      ),
    );
    for (const money of ['price', 'costPrice', 'unitCost', 'unitPrice']) {
      expect(keys.has(money)).toBe(false);
    }
  });

  it('KHO_GIAO assigned to the order (inventory.manage) ⇒ 200', async () => {
    currentOrder = order(OTHER, ACCOUNT_ID);
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.lines).toHaveLength(2);
  });

  it('neither quotes.create_edit nor inventory.manage (KE_TOAN) ⇒ 403, nothing read', async () => {
    givenPermissions(...ROLE_PRESETS.KE_TOAN);

    const res = await get();

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    expect(orderRepo.findFirst).not.toHaveBeenCalled();
  });

  it.each(['QUAN_LY', 'ADMIN', 'SUPER_ADMIN'] as const)(
    "%s (orders.view_all) on someone else's order ⇒ 200 with the same figures",
    async (preset) => {
      currentOrder = order(OTHER, null);
      givenPermissions(...ROLE_PRESETS[preset]);

      const res = await get();

      expect(res.status).toBe(200);
      expect(
        (res.body.lines as { productId: string; status: string }[]).map((l) => [
          l.productId,
          l.status,
        ]),
      ).toEqual([
        ['prod-inverter', 'enough'],
        ['prod-panel', 'short'],
      ]);
    },
  );

  it('THI_CONG assigned to the order (neither key) ⇒ 403, nothing read', async () => {
    currentOrder = order(OTHER, ACCOUNT_ID);
    givenPermissions(...ROLE_PRESETS.THI_CONG);

    const res = await get();

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    expect(orderRepo.findFirst).not.toHaveBeenCalled();
  });

  it('only free-text lines ⇒ 200 with no lines, no stock read', async () => {
    lineRepo.findMany.mockResolvedValue([{ productId: null, qty: 1 }]);

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lines: [] });
    expect(productRepo.findMany).not.toHaveBeenCalled();
    expect(stockMovementRepo.groupBy).not.toHaveBeenCalled();
  });

  it('stock already issued for the current version ⇒ 200 with no lines, no stock read', async () => {
    stockVoucherRead.findUnique.mockResolvedValue({
      id: 'voucher-1',
      seq: 7,
      type: 'xuat',
      orderId: ORDER_ID,
      note: null,
      createdAt: new Date('2026-10-21T04:00:00Z'),
      createdBy: { id: ACCOUNT_ID, displayName: 'Kho' },
      lines: [],
    });

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lines: [] });
    expect(productRepo.findMany).not.toHaveBeenCalled();
    expect(stockMovementRepo.groupBy).not.toHaveBeenCalled();
  });

  it('out of scope ⇒ 404 with the same message as an unknown id; no stock read', async () => {
    currentOrder = order(OTHER, null);

    const outOfScope = await get();
    const unknown = await get(UNKNOWN_ID);

    expect(outOfScope.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(outOfScope.body.code).toBe(ErrorCode.NOT_FOUND);
    expect(outOfScope.body.message).toBe(
      unknown.body.message.replace(UNKNOWN_ID, ORDER_ID),
    );
    expect(productRepo.findMany).not.toHaveBeenCalled();
    expect(stockMovementRepo.groupBy).not.toHaveBeenCalled();
  });

  it('id is not a UUID ⇒ 400 VALIDATION_ERROR', async () => {
    const res = await get('not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('writes nothing and leaves no audit row', async () => {
    await get();

    for (const repo of Object.values(writes)) {
      for (const fn of Object.values(repo)) {
        expect(fn).not.toHaveBeenCalled();
      }
    }
  });
});
