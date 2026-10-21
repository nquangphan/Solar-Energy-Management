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
 * e2e `/orders/:id/payment-schedule` (hermetic — `PrismaService` overridden, real JWT, real
 * ValidationPipe + exception filter). Covers what only exists at the HTTP layer: permission
 * gates by real presets, `ParseUUIDPipe`, the HTTP codes and `fieldErrors` of the AC, scope 404
 * with the same message as an unknown id, and exactly ONE audit row per real change.
 */
describe('/orders/:id/payment-schedule (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-accountant-1';
  const OTHER = 'acc-other-sale';
  const ORDER_ID = '66666666-6666-4666-8666-666666666666';
  const UNKNOWN_ID = '77777777-7777-4777-8777-777777777777';
  const VERSION_ID = 'ver-ps-1';
  const SCHEDULE_ID = 'sched-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'accountant@example.com',
    displayName: 'Kế toán',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function order(status: string, ownerAccountId = OTHER) {
    return {
      id: ORDER_ID,
      status,
      customerSdt: '+84912345678',
      currentVersionId: VERSION_ID,
      ownerAccountId,
      assigneeAccountId: null as string | null,
      sourceId: 'src-fb',
      custType: 'CA_NHAN',
      scopeThietBi: true,
      scopeThiCong: true,
      scopeVanChuyen: false,
      kWp: null,
      vatMode: 'co_vat',
      validityNote: null,
      cancelReason: null,
      cancelledAt: null,
      createdAt: new Date('2026-10-20T01:00:00Z'),
      updatedAt: new Date('2026-10-20T01:00:00Z'),
    };
  }

  /** One snapshotted line: 76,862,000 + VAT 8% (6,148,960) = 83,010,960 — the mockup total. */
  const LINES = [
    {
      id: 'l-1',
      orderVersionId: VERSION_ID,
      productId: null,
      name: 'Hệ 10kWp',
      unit: 'Bộ',
      qty: 1,
      unitPrice: 76_862_000,
      unitPriceSnapshot: 76_862_000,
      priceEditable: true,
      isFlexible: false,
      note: null,
      warrantyMonths: null,
      displayOrder: 0,
    },
  ];
  const TOTAL = 83_010_960;

  type Row = {
    id: string;
    scheduleId: string;
    seq: number;
    percent: number | null;
    amount: number;
    conditionNote: string;
    milestone: string | null;
  };

  let currentOrder: ReturnType<typeof order> | null;
  let schedule: { id: string; orderId: string; updatedAt: Date } | null;
  let rows: Row[];
  let payments: {
    id: string;
    installmentId: string;
    amount: number;
    paidOn: Date;
    method: string;
    note: string | null;
    createdAt: Date;
  }[];
  let nextRowId: number;

  const orderRepo = { findFirst: jest.fn(), findUnique: jest.fn() };
  const scheduleRepo = { findUnique: jest.fn(), upsert: jest.fn() };
  const installmentRepo = { deleteMany: jest.fn(), createMany: jest.fn() };
  const paymentRepo = { count: jest.fn() };
  const auditRepo = { create: jest.fn() };
  const queryRaw = jest.fn();
  const repos = {
    order: orderRepo,
    orderVersion: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: VERSION_ID,
          vatRate: 8,
          vatMode: 'co_vat',
          discountAmount: null,
        }),
      ),
    },
    orderLineItem: { findMany: jest.fn(() => Promise.resolve(LINES)) },
    discountApproval: { findFirst: jest.fn(() => Promise.resolve(null)) },
    product: { findMany: jest.fn(() => Promise.resolve([])) },
    paymentSchedule: scheduleRepo,
    installment: installmentRepo,
    payment: paymentRepo,
    auditLog: auditRepo,
    featureFlag: { findUnique: jest.fn(() => Promise.resolve(null)) },
    systemSetting: { findUnique: jest.fn(() => Promise.resolve(null)) },
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

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  const auth = () =>
    `Bearer ${jwt.sign({ sub: ACCOUNT_ID, email: account.email })}`;

  const put = (body: unknown, id = ORDER_ID) =>
    request(server())
      .put(`/orders/${id}/payment-schedule`)
      .set('Authorization', auth())
      .send(body as object);

  const get = (id = ORDER_ID) =>
    request(server())
      .get(`/orders/${id}/payment-schedule`)
      .set('Authorization', auth());

  const auditRows = () =>
    auditRepo.create.mock.calls.filter(
      ([a]) =>
        (a as { data: { eventType: string } }).data.eventType ===
        'PaymentScheduleConfigured',
    ).length;

  const body20_70_10 = {
    installments: [
      { percent: 20, conditionNote: 'Cọc khi ký hợp đồng' },
      { percent: 70, conditionNote: 'Khi thi công' },
      { percent: 10, conditionNote: 'Khi nghiệm thu, bàn giao' },
    ],
  };

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
    currentOrder = order('dachot');
    schedule = null;
    rows = [];
    payments = [];
    nextRowId = 0;
    // Scope fake: applies the owner/assignee clause the service ACTUALLY sends.
    orderRepo.findFirst.mockImplementation(
      (args: {
        where: { AND: ({ id?: string } & Record<string, unknown>)[] };
      }) => {
        const o = currentOrder;
        if (o === null || args.where.AND[0].id !== o.id)
          return Promise.resolve(null);
        for (const clause of args.where.AND.slice(1)) {
          const or = clause.OR as Record<string, string>[] | undefined;
          if (
            or &&
            !or.some(
              (b) =>
                b.ownerAccountId === o.ownerAccountId ||
                b.assigneeAccountId === o.assigneeAccountId,
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
    queryRaw.mockResolvedValue([{ id: ORDER_ID }]);
    scheduleRepo.findUnique.mockImplementation(() =>
      Promise.resolve(
        schedule === null
          ? null
          : {
              ...schedule,
              installments: [...rows]
                .sort((a, b) => a.seq - b.seq)
                .map((r) => ({
                  ...r,
                  payments: payments.filter((p) => p.installmentId === r.id),
                })),
            },
      ),
    );
    scheduleRepo.upsert.mockImplementation(() => {
      schedule = {
        id: SCHEDULE_ID,
        orderId: ORDER_ID,
        updatedAt: new Date('2026-10-21T05:00:00Z'),
      };
      return Promise.resolve(schedule);
    });
    installmentRepo.deleteMany.mockImplementation(() => {
      const count = rows.length;
      rows = [];
      return Promise.resolve({ count });
    });
    installmentRepo.createMany.mockImplementation(
      (args: { data: Omit<Row, 'id'>[] }) => {
        rows.push(
          ...args.data.map((r) => ({ ...r, id: `inst-${++nextRowId}` })),
        );
        return Promise.resolve({ count: args.data.length });
      },
    );
    paymentRepo.count.mockImplementation(() =>
      Promise.resolve(payments.length),
    );
    auditRepo.create.mockResolvedValue({});
    givenPermissions(...ROLE_PRESETS.KE_TOAN);
  });

  it('no token ⇒ 401', async () => {
    const res = await request(server()).get(
      `/orders/${ORDER_ID}/payment-schedule`,
    );
    expect(res.status).toBe(401);
  });

  it('GET before any configuration ⇒ 200, configured=false, difference = total', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      orderId: ORDER_ID,
      configured: false,
      editable: true,
      orderTotal: TOTAL,
      scheduledTotal: 0,
      difference: TOTAL,
      totalMatches: false,
      paidTotal: 0,
      remainingTotal: TOTAL,
      paidPercent: 0,
      paymentStatus: 'unpaid',
      recordable: true,
      installments: [],
      updatedAt: null,
    });
  });

  it('PUT 20/70/10 ⇒ 200 with the exact mockup split, one audit row; GET returns the same', async () => {
    const res = await put(body20_70_10);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      orderId: ORDER_ID,
      configured: true,
      editable: true,
      orderTotal: TOTAL,
      scheduledTotal: TOTAL,
      difference: 0,
      totalMatches: true,
      paidTotal: 0,
      remainingTotal: TOTAL,
      paidPercent: 0,
      paymentStatus: 'unpaid',
      recordable: true,
      updatedAt: '2026-10-21T05:00:00.000Z',
    });
    const unpaid = { paidAmount: 0, status: 'unpaid', payments: [] };
    expect(res.body.installments).toEqual([
      {
        id: 'inst-1',
        seq: 1,
        percent: 20,
        amount: 16_602_192,
        conditionNote: 'Cọc khi ký hợp đồng',
        milestone: 'coc',
        remainingAmount: 16_602_192,
        ...unpaid,
      },
      {
        id: 'inst-2',
        seq: 2,
        percent: 70,
        amount: 58_107_672,
        conditionNote: 'Khi thi công',
        milestone: null,
        remainingAmount: 58_107_672,
        ...unpaid,
      },
      {
        id: 'inst-3',
        seq: 3,
        percent: 10,
        amount: 8_301_096,
        conditionNote: 'Khi nghiệm thu, bàn giao',
        milestone: 'tat_toan',
        remainingAmount: 8_301_096,
        ...unpaid,
      },
    ]);
    expect(auditRows()).toBe(1);

    const again = await get();
    expect(again.body.installments).toEqual(res.body.installments);
    expect(again.body.totalMatches).toBe(true);
  });

  it('PUT the identical list twice ⇒ second is 200 with no write and no audit row', async () => {
    await put(body20_70_10);
    jest.clearAllMocks();
    auditRepo.create.mockResolvedValue({});
    const res = await put(body20_70_10);
    expect(res.status).toBe(200);
    expect(installmentRepo.deleteMany).not.toHaveBeenCalled();
    expect(auditRows()).toBe(0);
  });

  it('single 100% and mixed kinds are accepted; replace leaves only the new list', async () => {
    await put(body20_70_10);
    const res = await put({
      installments: [
        { amount: 30_000_000, conditionNote: 'Cọc' },
        { percent: 50, conditionNote: 'Thi công' },
      ],
    });
    expect(res.status).toBe(200);
    expect(rows.map((r) => r.seq)).toEqual([1, 2]);
    expect(
      res.body.installments.map((i: { percent: number | null }) => i.percent),
    ).toEqual([null, 50]);
    expect(res.body.totalMatches).toBe(false);
    expect(res.body.difference).toBe(
      TOTAL - 30_000_000 - Math.floor(TOTAL / 2),
    );

    const one = await put({
      installments: [{ percent: 100, conditionNote: 'Toàn bộ' }],
    });
    expect(one.body.installments).toEqual([
      {
        id: expect.any(String) as string,
        seq: 1,
        percent: 100,
        amount: TOTAL,
        conditionNote: 'Toàn bộ',
        milestone: 'coc',
        paidAmount: 0,
        remainingAmount: TOTAL,
        status: 'unpaid',
        payments: [],
      },
    ]);
  });

  it.each([
    ['percent 0', { percent: 0 }, 'installments.0.percent'],
    ['amount 0', { amount: 0 }, 'installments.0.amount'],
  ])(
    'first installment %s ⇒ 400 on that field, nothing written',
    async (_l, first, field) => {
      const res = await put({
        installments: [
          { ...first, conditionNote: 'Cọc' },
          { percent: 100, conditionNote: 'b' },
        ],
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(
        res.body.fieldErrors.map((e: { field: string }) => e.field),
      ).toContain(field);
      expect(installmentRepo.createMany).not.toHaveBeenCalled();
      expect(auditRows()).toBe(0);
    },
  );

  it('first percent resolving to 0 dong ⇒ 400 firstInstallmentZero', async () => {
    repos.orderLineItem.findMany.mockResolvedValueOnce([
      { ...LINES[0], unitPrice: 46, unitPriceSnapshot: 46 },
    ]); // 46 + VAT 4 = 50
    const res = await put({
      installments: [
        { percent: 1, conditionNote: 'Cọc' },
        { percent: 99, conditionNote: 'b' },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toEqual([
      {
        field: 'installments.0.amount',
        code: 'firstInstallmentZero',
        message: 'Đợt đầu (cọc) phải lớn hơn 0.',
      },
    ]);
  });

  it.each([
    [
      'both percent and amount',
      [{ percent: 20, amount: 1, conditionNote: 'x' }],
      'installments.0.percent',
    ],
    ['neither', [{ conditionNote: 'x' }], 'installments.0.percent'],
    [
      'blank condition',
      [{ percent: 100, conditionNote: '   ' }],
      'installments.0.conditionNote',
    ],
    [
      'condition > 200',
      [{ percent: 100, conditionNote: 'a'.repeat(201) }],
      'installments.0.conditionNote',
    ],
    ['empty list', [], 'installments'],
    [
      '13 installments',
      Array.from({ length: 13 }, () => ({ amount: 1_000, conditionNote: 'x' })),
      'installments',
    ],
  ])('%s ⇒ 400 on %s', async (_l, installments, field) => {
    const res = await put({ installments });
    expect(res.status).toBe(400);
    expect(
      res.body.fieldErrors.map((e: { field: string }) => e.field),
    ).toContain(field);
    expect(installmentRepo.createMany).not.toHaveBeenCalled();
  });

  it.each([
    ['percent 12.5', { percent: 12.5 }, 'installments.0.percent'],
    ['amount 1000.5', { amount: 1000.5 }, 'installments.0.amount'],
    ['percent 101', { percent: 101 }, 'installments.0.percent'],
    ['amount over the cap', { amount: 2_000_000_001 }, 'installments.0.amount'],
  ])(
    'non-integer or out-of-range %s ⇒ 400 on that field',
    async (_l, first, field) => {
      const res = await put({
        installments: [{ ...first, conditionNote: 'Cọc' }],
      });
      expect(res.status).toBe(400);
      expect(
        res.body.fieldErrors.map((e: { field: string }) => e.field),
      ).toContain(field);
      expect(installmentRepo.createMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'blank condition on the 2nd',
      [
        { percent: 20, conditionNote: 'Cọc' },
        { percent: 80, conditionNote: '  ' },
      ],
      'installments.1.conditionNote',
    ],
    [
      'both kinds on the 3rd',
      [
        { percent: 20, conditionNote: 'Cọc' },
        { percent: 70, conditionNote: 'b' },
        { percent: 10, amount: 1, conditionNote: 'c' },
      ],
      'installments.2.percent',
    ],
  ])('%s ⇒ 400 names that row, not row 0', async (_l, installments, field) => {
    const res = await put({ installments });
    expect(res.status).toBe(400);
    const fields = res.body.fieldErrors.map((e: { field: string }) => e.field);
    expect(fields).toContain(field);
    expect(fields).not.toContain('installments.0.percent');
    expect(installmentRepo.createMany).not.toHaveBeenCalled();
  });

  it('a client-sent milestone is ignored: the server assigns by position', async () => {
    const res = await put({
      installments: [
        { percent: 20, conditionNote: 'a', milestone: 'tat_toan' },
        { percent: 70, conditionNote: 'b', milestone: 'coc' },
        { percent: 10, conditionNote: 'c', milestone: 'coc' },
      ],
    });
    expect(res.status).toBe(200);
    expect(
      res.body.installments.map(
        (i: { milestone: string | null }) => i.milestone,
      ),
    ).toEqual(['coc', null, 'tat_toan']);
    expect(rows.map((r) => r.milestone)).toEqual(['coc', null, 'tat_toan']);
  });

  it('a schedule over the total ⇒ 200, saved, negative difference', async () => {
    const res = await put({
      installments: [
        { percent: 60, conditionNote: 'a' },
        { percent: 60, conditionNote: 'b' },
      ],
    });
    expect(res.status).toBe(200);
    expect(rows).toHaveLength(2);
    expect(res.body.totalMatches).toBe(false);
    expect(res.body.difference).toBeLessThan(0);
    expect(res.body.difference).toBe(TOTAL - res.body.scheduledTotal);
  });

  it.each([
    [
      'a changed list',
      { installments: [{ percent: 100, conditionNote: 'x' }] },
    ],
    ['the identical list', body20_70_10],
  ])(
    'order with a payment: PUT %s ⇒ 409 (never a 500 FK), nothing written; GET editable=false',
    async (_l, body) => {
      await put(body20_70_10);
      payments = [
        {
          id: 'pay-1',
          installmentId: rows[0].id,
          amount: 1_000_000,
          paidOn: new Date('2026-10-20T00:00:00.000Z'),
          method: 'cash',
          note: null,
          createdAt: new Date('2026-10-20T03:00:00.000Z'),
        },
      ];
      jest.clearAllMocks();
      auditRepo.create.mockResolvedValue({});
      const res = await put(body);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.message).toBe(
        'Đơn đã có thanh toán — không sửa lịch được.',
      );
      expect(installmentRepo.deleteMany).not.toHaveBeenCalled();
      expect(installmentRepo.createMany).not.toHaveBeenCalled();
      expect(auditRows()).toBe(0);
      const read = await get();
      expect(read.body.editable).toBe(false);
      expect(read.body.paidTotal).toBe(1_000_000);
      expect(read.body.installments[0].status).toBe('partial');
    },
  );

  it.each(['baogia', 'choduyet', 'hoanthanh', 'huy'])(
    'PUT on %s ⇒ 409; GET ⇒ 200 editable=false',
    async (status) => {
      currentOrder = order(status);
      const res = await put(body20_70_10);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(installmentRepo.createMany).not.toHaveBeenCalled();
      expect(auditRows()).toBe(0);
      const read = await get();
      expect(read.status).toBe(200);
      expect(read.body.editable).toBe(false);
    },
  );

  it.each(['dachot', 'dacoc', 'thicong', 'nghiemthu', 'danggiao', 'dagiao'])(
    'PUT on %s ⇒ 200',
    async (status) => {
      currentOrder = order(status);
      expect((await put(body20_70_10)).status).toBe(200);
    },
  );

  it('without payments.record ⇒ PUT 403, GET still 200', async () => {
    givenPermissions(...ROLE_PRESETS.THO_KS);
    currentOrder = order('dachot', ACCOUNT_ID);
    expect((await put(body20_70_10)).status).toBe(403);
    expect((await get()).status).toBe(200);
  });

  it("payments.record + view_own on someone else's order ⇒ 404 with the same message as an unknown id", async () => {
    givenPermissions(PERM.paymentsRecord, PERM.ordersViewOwn);
    const outOfScope = await put(body20_70_10);
    const unknown = await put(body20_70_10, UNKNOWN_ID);
    expect(outOfScope.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(outOfScope.body.message.replace(ORDER_ID, '')).toBe(
      unknown.body.message.replace(UNKNOWN_ID, ''),
    );
    const read = await get();
    const readUnknown = await get(UNKNOWN_ID);
    expect(read.status).toBe(404);
    expect(read.body.message.replace(ORDER_ID, '')).toBe(
      readUnknown.body.message.replace(UNKNOWN_ID, ''),
    );
    expect(installmentRepo.createMany).not.toHaveBeenCalled();
  });

  it.each([
    ['owner', order('dachot', ACCOUNT_ID)],
    ['assignee', { ...order('dachot'), assigneeAccountId: ACCOUNT_ID }],
  ])(
    'payments.record + view_own on an order where the caller is %s ⇒ PUT 200',
    async (_l, o) => {
      givenPermissions(PERM.paymentsRecord, PERM.ordersViewOwn);
      currentOrder = o;
      const res = await put(body20_70_10);
      expect(res.status).toBe(200);
      expect(rows).toHaveLength(3);
      expect((await get()).status).toBe(200);
    },
  );

  it('payments.record without any orders.view_* ⇒ 403 on both routes', async () => {
    givenPermissions(PERM.paymentsRecord);
    expect((await put(body20_70_10)).status).toBe(403);
    expect((await get()).status).toBe(403);
    expect(installmentRepo.createMany).not.toHaveBeenCalled();
  });

  it('non-UUID id ⇒ 400 on both routes', async () => {
    expect((await get('not-a-uuid')).status).toBe(400);
    expect((await put(body20_70_10, 'not-a-uuid')).status).toBe(400);
  });

  it('existing order routes still resolve next to the new controller', async () => {
    const res = await request(server())
      .get(`/orders/${ORDER_ID}`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ORDER_ID);
  });
});
