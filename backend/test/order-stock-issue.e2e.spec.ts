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
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { fakeStorage } from './util/fake-storage';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time ⇒ set env BEFORE loading `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/orders/:id/stock-issue` (hermetic — `PrismaService` overridden, real JWT). Covers what
 * only lives at the HTTP layer: permission gates by real presets, `ParseUUIDPipe`, 201/200 by
 * outcome, the HTTP codes of business errors (409 + `fieldErrors`), `unitCost` hidden without
 * `costs.view`, order scope (404 with the same message as an unknown id) and exactly ONE
 * `StockIssued` audit row.
 */
describe('/orders/:id/stock-issue (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-warehouse-1';
  const OTHER = 'acc-other-sale';
  const ORDER_ID = '44444444-4444-4444-8444-444444444444';
  const UNKNOWN_ID = '55555555-5555-4555-8555-555555555555';
  const VERSION_ID = 'ver-si-1';
  const PANEL = 'prod-panel';
  const INSTALL = 'prod-install';
  const account = {
    id: ACCOUNT_ID,
    email: 'warehouse@example.com',
    displayName: 'Thủ kho',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function order(
    status: string,
    assigneeAccountId: string | null = ACCOUNT_ID,
  ) {
    return {
      id: ORDER_ID,
      status,
      customerSdt: '+84912345678',
      currentVersionId: VERSION_ID,
      ownerAccountId: OTHER,
      assigneeAccountId,
      sourceId: 'src-fb',
      custType: 'CA_NHAN',
      scopeThietBi: true,
      scopeThiCong: false,
      scopeVanChuyen: true,
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
    {
      id: 'l-panel',
      name: 'Tấm pin 550W',
      productId: PANEL,
      qty: 10,
      unitPriceSnapshot: 3_000_000,
    },
    {
      id: 'l-install',
      name: 'Công lắp đặt',
      productId: INSTALL,
      qty: 1,
      unitPriceSnapshot: 1_500_000,
    },
  ];

  function products(panelOnHand: number) {
    return [
      {
        id: PANEL,
        name: 'Tấm pin 550W',
        sku: 'PIN-550',
        unit: 'tấm',
        costPrice: 2_088_000,
        tracksStock: true,
        stockItem: { id: 'si-panel', productId: PANEL, onHand: panelOnHand },
      },
      {
        id: INSTALL,
        name: 'Công lắp đặt',
        sku: 'CONG',
        unit: 'gói',
        costPrice: 0,
        tracksStock: false,
        stockItem: null,
      },
    ];
  }

  let currentOrder: ReturnType<typeof order> | null;
  let savedVoucher: Record<string, unknown> | null;

  const orderRepo = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  };
  const versionRepo = { findUnique: jest.fn(), create: jest.fn() };
  const lineRepo = {
    findMany: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
  };
  const productRepo = { findMany: jest.fn() };
  const stockItemRepo = { upsert: jest.fn(), findMany: jest.fn() };
  const stockMovementRepo = {
    aggregate: jest.fn(),
    create: jest.fn(),
    groupBy: jest.fn(),
  };
  const stockVoucherRepo = { findUnique: jest.fn(), create: jest.fn() };
  // `auditLog` is here because the REAL `AuditSubscriber` runs inside `AppModule`.
  const auditRepo = { create: jest.fn() };
  const queryRaw = jest.fn();
  const repos = {
    order: orderRepo,
    orderVersion: versionRepo,
    orderLineItem: lineRepo,
    product: productRepo,
    stockItem: stockItemRepo,
    stockMovement: stockMovementRepo,
    stockVoucher: stockVoucherRepo,
    auditLog: auditRepo,
    // `reopen` reads the tiered-pricing flag before the service runs.
    featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: queryRaw,
  };
  const prismaMock = {
    ...repos,
    $transaction: jest.fn((fn: (t: typeof repos) => Promise<unknown>) =>
      fn(repos),
    ),
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  function givenPermissions(...keys: readonly string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  function token(): string {
    return jwt.sign({ sub: ACCOUNT_ID, email: account.email });
  }

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function post(id = ORDER_ID) {
    return request(server())
      .post(`/orders/${id}/stock-issue`)
      .set('Authorization', `Bearer ${token()}`);
  }

  function get(id = ORDER_ID) {
    return request(server())
      .get(`/orders/${id}/stock-issue`)
      .set('Authorization', `Bearer ${token()}`);
  }

  function auditRows(eventType: string): number {
    return auditRepo.create.mock.calls.filter(
      ([a]) =>
        (a as { data: { eventType: string } }).data.eventType === eventType,
    ).length;
  }

  function stockIssuedAuditRows(): number {
    return auditRows('StockIssued');
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
    currentOrder = order('danggiao');
    savedVoucher = null;
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
    orderRepo.findUnique.mockImplementation(() =>
      Promise.resolve(currentOrder),
    );
    lineRepo.findMany.mockResolvedValue(ORDER_LINES);
    lineRepo.update.mockResolvedValue({});
    orderRepo.updateMany.mockResolvedValue({ count: 1 });
    orderRepo.update.mockResolvedValue({});
    versionRepo.findUnique.mockResolvedValue({ id: VERSION_ID, versionNo: 1 });
    versionRepo.create.mockResolvedValue({});
    lineRepo.createMany.mockResolvedValue({ count: 0 });
    // Honours the `id` + `tracksStock` filters the service sends.
    productRepo.findMany.mockImplementation(
      (args: { where?: { id?: { in?: string[] }; tracksStock?: boolean } }) =>
        Promise.resolve(
          products(40).filter(
            (p) =>
              (args.where?.id?.in === undefined ||
                args.where.id.in.includes(p.id)) &&
              (args.where?.tracksStock === undefined ||
                p.tracksStock === args.where.tracksStock),
          ),
        ),
    );
    queryRaw.mockImplementation((_s: TemplateStringsArray, arg: unknown) =>
      Promise.resolve(
        Array.isArray(arg)
          ? (arg as string[]).map((id) => ({ id }))
          : [{ id: ORDER_ID }],
      ),
    );
    stockItemRepo.upsert.mockResolvedValue({ id: 'si-panel' });
    stockMovementRepo.aggregate.mockResolvedValue({ _sum: { qty: null } });
    // Nothing held at close ⇒ the completion release writes nothing.
    stockMovementRepo.groupBy.mockResolvedValue([]);
    stockVoucherRepo.findUnique.mockImplementation(() =>
      Promise.resolve(savedVoucher),
    );
    stockVoucherRepo.create.mockImplementation(
      (args: {
        data: {
          orderId: string;
          createdByAccountId: string;
          lines: {
            create: { productId: string; qty: number; unitCost: number }[];
          };
        };
      }) => {
        savedVoucher = {
          id: 'voucher-si-1',
          seq: 96,
          type: 'xuat',
          note: null,
          orderId: args.data.orderId,
          createdAt: new Date('2026-10-21T04:00:00Z'),
          createdBy: {
            id: args.data.createdByAccountId,
            displayName: 'Thủ kho',
          },
          lines: args.data.lines.create.map((l) => ({
            ...l,
            product: { name: 'Tấm pin 550W', sku: 'PIN-550', unit: 'tấm' },
          })),
        };
        return Promise.resolve(savedVoucher);
      },
    );
    auditRepo.create.mockResolvedValue({});
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);
  });

  describe('POST', () => {
    it('no token ⇒ 401', async () => {
      const res = await request(server()).post(
        `/orders/${ORDER_ID}/stock-issue`,
      );
      expect(res.status).toBe(401);
    });

    it('KHO_GIAO assigned to the order ⇒ 201 first (body WITHOUT unitCost), 200 second with the same voucher, exactly 1 StockIssued audit row', async () => {
      const first = await post();

      expect(first.status).toBe(201);
      expect(first.body.voucher.code).toBe('PK-X-0096');
      expect(first.body.voucher.createdBy).toBeDefined();
      expect(first.body.voucher).not.toHaveProperty('ma');
      expect(first.body.voucher).not.toHaveProperty('nguoiTao');
      expect(first.body.voucher.orderId).toBe(ORDER_ID);
      // A live order's stock-out offers no return; the flag is always present.
      expect(first.body.voucher.canReturn).toBe(false);
      expect(first.body.voucher.lines).toEqual([
        {
          productId: PANEL,
          name: 'Tấm pin 550W',
          sku: 'PIN-550',
          unit: 'tấm',
          qty: 10,
        },
      ]);
      expect(stockIssuedAuditRows()).toBe(1);

      const second = await post();

      expect(second.status).toBe(200);
      expect(second.body.voucher.id).toBe(first.body.voucher.id);
      expect(stockVoucherRepo.create).toHaveBeenCalledTimes(1);
      expect(stockIssuedAuditRows()).toBe(1);
    });

    it('QUAN_LY (costs.view) ⇒ 201 with unitCost = cost at issue time', async () => {
      givenPermissions(...ROLE_PRESETS.QUAN_LY);

      const res = await post();

      expect(res.status).toBe(201);
      expect(res.body.voucher.lines[0].unitCost).toBe(2_088_000);
    });

    it.each(['ADMIN', 'SUPER_ADMIN'] as const)(
      '%s ⇒ 201 with unitCost (costs.view)',
      async (preset) => {
        givenPermissions(...ROLE_PRESETS[preset]);

        const res = await post();

        expect(res.status).toBe(201);
        expect(res.body.voucher.lines[0].unitCost).toBe(2_088_000);
      },
    );

    it.each(['KE_TOAN', 'THI_CONG'] as const)(
      '%s (no inventory.manage) ⇒ 403, no tx opened',
      async (preset) => {
        givenPermissions(...ROLE_PRESETS[preset]);

        const res = await post();

        expect(res.status).toBe(403);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      },
    );

    it('THO_KS (no inventory.manage) ⇒ 403, no tx opened', async () => {
      givenPermissions(...ROLE_PRESETS.THO_KS);

      const res = await post();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('KHO_GIAO neither owner nor assignee ⇒ 404 with the same message as an unknown id', async () => {
      currentOrder = order('danggiao', OTHER);

      const outOfScope = await post();
      const unknown = await post(UNKNOWN_ID);

      expect(outOfScope.status).toBe(404);
      expect(unknown.status).toBe(404);
      expect(outOfScope.body.message).toBe(
        `Không tìm thấy đơn hàng: ${ORDER_ID}`,
      );
      expect(unknown.body.message).toBe(
        `Không tìm thấy đơn hàng: ${UNKNOWN_ID}`,
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('id is not a UUID ⇒ 400 VALIDATION_ERROR', async () => {
      const res = await post('not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('status `dachot` (equipment-only order before its direct close) ⇒ 201', async () => {
      currentOrder = order('dachot');

      const res = await post();

      expect(res.status).toBe(201);
      expect(res.body.voucher.orderId).toBe(ORDER_ID);
      expect(stockIssuedAuditRows()).toBe(1);
    });

    it('status `nghiemthu` (acceptance reached without issuing) ⇒ 201', async () => {
      currentOrder = order('nghiemthu');

      const res = await post();

      expect(res.status).toBe(201);
      expect(res.body.voucher.orderId).toBe(ORDER_ID);
      expect(stockIssuedAuditRows()).toBe(1);
    });

    it('status `dagiao` ⇒ 409, no tx opened', async () => {
      currentOrder = order('dagiao');

      const res = await post();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Đơn ở trạng thái này không xuất kho được.',
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('no stock-tracked line ⇒ 409, nothing written', async () => {
      lineRepo.findMany.mockResolvedValue([ORDER_LINES[1]]);

      const res = await post();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Đơn không có vật tư theo dõi tồn kho — không cần phiếu xuất.',
      );
      expect(stockVoucherRepo.create).not.toHaveBeenCalled();
      expect(stockIssuedAuditRows()).toBe(0);
    });

    it('short stock ⇒ 409 CONFLICT, fieldErrors[0] INSUFFICIENT_STOCK on lines.0.qty, nothing written', async () => {
      productRepo.findMany.mockResolvedValue(products(3));

      const res = await post();

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.fieldErrors[0].code).toBe('INSUFFICIENT_STOCK');
      expect(res.body.fieldErrors[0].field).toBe('lines.0.qty');
      expect(res.body.message).toBe(
        'Không đủ tồn — không thể xuất quá số tồn hiện có.',
      );
      expect(stockVoucherRepo.create).not.toHaveBeenCalled();
      expect(lineRepo.update).not.toHaveBeenCalled();
      expect(stockIssuedAuditRows()).toBe(0);
      // Exactly one audit row for the refused attempt, on the order, with the version.
      expect(auditRepo.create).toHaveBeenCalledTimes(1);
      expect(auditRepo.create.mock.calls[0][0]).toMatchObject({
        data: {
          eventType: 'StockOutBlocked',
          targetType: 'Order',
          targetId: ORDER_ID,
          after: {
            orderId: ORDER_ID,
            orderVersionId: VERSION_ID,
            lines: [{ productId: PANEL, qty: 10, onHand: 3 }],
          },
        },
      });
    });

    it('refusals that are not a short stock (403, 409 status) ⇒ no StockOutBlocked audit row', async () => {
      givenPermissions(...ROLE_PRESETS.THO_KS);
      expect((await post()).status).toBe(403);
      givenPermissions(...ROLE_PRESETS.KHO_GIAO);
      currentOrder = order('dagiao');
      expect((await post()).status).toBe(409);

      expect(auditRows('StockOutBlocked')).toBe(0);
    });
  });

  describe('direct close dachot → hoan_thanh', () => {
    const NOT_ISSUED =
      'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.';

    function close() {
      return request(server())
        .post(`/orders/${ORDER_ID}/transition`)
        .set('Authorization', `Bearer ${token()}`)
        .field('event', 'hoan_thanh');
    }

    beforeEach(() => {
      currentOrder = order('dachot');
      givenPermissions(...ROLE_PRESETS.KE_TOAN);
    });

    it('stock-tracked lines not issued ⇒ 409 CONFLICT with the user message, status not written', async () => {
      const res = await close();

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.message).toBe(NOT_ISSUED);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('after the standalone stock issue ⇒ 200 hoanthanh', async () => {
      givenPermissions(...ROLE_PRESETS.QUAN_LY);
      expect((await post()).status).toBe(201);

      givenPermissions(...ROLE_PRESETS.KE_TOAN);
      const res = await close();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('hoanthanh');
      expect(orderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: 'dachot' },
        data: { status: 'hoanthanh' },
      });
    });

    it('no stock-tracked line ⇒ closes directly (200)', async () => {
      lineRepo.findMany.mockResolvedValue([ORDER_LINES[1]]);

      const res = await close();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('hoanthanh');
    });

    it('a hold left on a product untracked since confirm ⇒ 200, released in the close tx after the status write', async () => {
      lineRepo.findMany.mockResolvedValue([ORDER_LINES[1]]);
      stockMovementRepo.groupBy.mockResolvedValue([
        {
          orderVersionId: VERSION_ID,
          stockItemId: 'si-panel',
          _sum: { qty: 10 },
        },
      ]);
      stockItemRepo.findMany.mockResolvedValue([{ productId: PANEL }]);

      const res = await close();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('hoanthanh');
      expect(stockMovementRepo.create).toHaveBeenCalledTimes(1);
      expect(stockMovementRepo.create).toHaveBeenCalledWith({
        data: {
          stockItemId: 'si-panel',
          orderId: ORDER_ID,
          orderVersionId: VERSION_ID,
          qty: -10,
          type: 'release',
        },
      });
      expect(
        stockMovementRepo.create.mock.invocationCallOrder[0],
      ).toBeGreaterThan(orderRepo.updateMany.mock.invocationCallOrder[0]);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('re-opening (reopen) an issued order ⇒ 409, no new version', async () => {
      givenPermissions(...ROLE_PRESETS.QUAN_LY);
      expect((await post()).status).toBe(201);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/reopen`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Đơn đã xuất kho — không mở lại để sửa được.',
      );
      expect(versionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('construction close nghiemthu → hoan_thanh', () => {
    const NOT_ISSUED =
      'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.';

    function close() {
      return request(server())
        .post(`/orders/${ORDER_ID}/transition`)
        .set('Authorization', `Bearer ${token()}`)
        .field('event', 'hoan_thanh');
    }

    beforeEach(() => {
      currentOrder = { ...order('nghiemthu'), scopeThiCong: true };
      givenPermissions(...ROLE_PRESETS.THI_CONG);
    });

    it('stock-tracked lines not issued ⇒ 409 CONFLICT with the user message, status not written', async () => {
      const res = await close();

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.message).toBe(NOT_ISSUED);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('after the standalone stock issue at nghiemthu ⇒ 200 hoanthanh', async () => {
      givenPermissions(...ROLE_PRESETS.KHO_GIAO);
      expect((await post()).status).toBe(201);

      givenPermissions(...ROLE_PRESETS.THI_CONG);
      const res = await close();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('hoanthanh');
      expect(orderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: 'nghiemthu' },
        data: { status: 'hoanthanh' },
      });
    });

    it('no stock-tracked line ⇒ closes directly (200)', async () => {
      lineRepo.findMany.mockResolvedValue([ORDER_LINES[1]]);

      const res = await close();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('hoanthanh');
    });
  });

  describe('GET (preview)', () => {
    it('delivery.confirm without inventory.manage ⇒ 200, canIssue false, lines + untracked items', async () => {
      givenPermissions(PERM.ordersViewAll, PERM.deliveryConfirm);

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        issued: false,
        canIssue: false,
        blocked: false,
        lines: [
          {
            productId: PANEL,
            name: 'Tấm pin 550W',
            sku: 'PIN-550',
            unit: 'tấm',
            qty: 10,
            onHand: 40,
            shortfall: 0,
          },
        ],
        untrackedItems: ['Công lắp đặt'],
      });
    });

    it('short right now ⇒ blocked true + the line shortfall (backend-computed warning), canIssue unchanged', async () => {
      productRepo.findMany.mockResolvedValue(products(3));

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body.blocked).toBe(true);
      expect(res.body.canIssue).toBe(true);
      expect(res.body.lines[0]).toMatchObject({
        qty: 10,
        onHand: 3,
        shortfall: 7,
      });
    });

    it('dachot order ⇒ canIssue true (equipment-only orders issue before the direct close)', async () => {
      currentOrder = order('dachot');
      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body.canIssue).toBe(true);
    });

    it('nghiemthu order ⇒ canIssue true (acceptance reached without issuing)', async () => {
      currentOrder = order('nghiemthu');
      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body.canIssue).toBe(true);
    });

    it('dagiao order ⇒ canIssue false', async () => {
      currentOrder = order('dagiao');
      const res = await get();
      expect(res.body.canIssue).toBe(false);
    });

    it('KHO_GIAO ⇒ canIssue true', async () => {
      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body.canIssue).toBe(true);
    });

    it('neither inventory.manage nor delivery.confirm ⇒ 403', async () => {
      givenPermissions(...ROLE_PRESETS.THO_KS);
      const res = await get();
      expect(res.status).toBe(403);
    });

    it('after issuing ⇒ issued + voucher (KHO_GIAO sees no unitCost), empty lines', async () => {
      await post();

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.body.issued).toBe(true);
      expect(res.body.canIssue).toBe(false);
      expect(res.body.lines).toEqual([]);
      expect(res.body.voucher.code).toBe('PK-X-0096');
      expect(res.body.voucher).not.toHaveProperty('ma');
      expect(res.body.voucher.lines[0]).not.toHaveProperty('unitCost');
    });
  });
});
