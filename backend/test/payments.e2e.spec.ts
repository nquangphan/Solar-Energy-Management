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
 * e2e `POST /orders/:id/payments` (hermetic — `PrismaService` overridden by an in-memory fake,
 * real JWT, real ValidationPipe + exception filter, real transition engine). Covers what only
 * exists at the HTTP layer: permission gates by real presets, `ParseUUIDPipe`, the HTTP codes
 * and `fieldErrors` of the AC, scope 404 with the same message as an unknown id, the response
 * shape, a replay answering 200 with the same body, and exactly one audit row per event.
 * Locks, CHECKs and the stock gate on close are proven on Postgres (`payments.db.integration`).
 */
describe('POST /orders/:id/payments (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-accountant-1';
  const OTHER = 'acc-other-sale';
  const ORDER_ID = '66666666-6666-4666-8666-666666666666';
  const UNKNOWN_ID = '77777777-7777-4777-8777-777777777777';
  const VERSION_ID = 'ver-pay-1';
  const KEY_1 = '3b241101-e2bb-4255-8caf-4136c566a962';
  const KEY_2 = '9c5b94b1-35ad-49bb-b118-8e8fc24abf80';
  const KEY_3 = 'c2c6f6a4-8f0e-4d55-9d3e-1f2a3b4c5d6e';
  const TODAY = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const TOTAL = 83_010_960;
  const AMOUNTS = [16_602_192, 58_107_672, 8_301_096];
  const MILESTONES = ['coc', null, 'tat_toan'];
  const INST = [
    'aaaaaaa1-0000-4000-8000-000000000001',
    'aaaaaaa2-0000-4000-8000-000000000002',
    'aaaaaaa3-0000-4000-8000-000000000003',
  ];

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

  /** One snapshotted line: 76,862,000 + VAT 8% = 83,010,960 — the mockup total. */
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

  type PaymentRow = {
    id: string;
    orderId: string;
    installmentId: string;
    amount: number;
    paidOn: Date;
    method: string;
    note: string | null;
    idempotencyKey: string;
    recordedByAccountId: string;
    createdAt: Date;
  };

  let currentOrder: ReturnType<typeof order> | null;
  let hasSchedule: boolean;
  let payments: PaymentRow[];

  const installmentRows = () =>
    AMOUNTS.map((amount, i) => ({
      id: INST[i],
      scheduleId: 'sched-1',
      seq: i + 1,
      percent: [20, 70, 10][i],
      amount,
      conditionNote: `Đợt ${i + 1}`,
      milestone: MILESTONES[i],
      payments: payments
        .filter((p) => p.installmentId === INST[i])
        .sort(
          (a, b) =>
            a.paidOn.getTime() - b.paidOn.getTime() ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        ),
    }));

  const orderRepo = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const paymentRepo = {
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  };
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
    // Closing releases held stock in the same tx; this order holds none.
    stockMovement: { groupBy: jest.fn(() => Promise.resolve([])) },
    paymentSchedule: {
      findUnique: jest.fn(() =>
        Promise.resolve(
          hasSchedule
            ? {
                id: 'sched-1',
                orderId: ORDER_ID,
                updatedAt: new Date('2026-10-21T05:00:00Z'),
                installments: installmentRows(),
              }
            : null,
        ),
      ),
    },
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

  const server = (): Server => app.getHttpServer() as Server;
  const auth = () =>
    `Bearer ${jwt.sign({ sub: ACCOUNT_ID, email: account.email })}`;

  const body = (overrides: Record<string, unknown> = {}) => ({
    idempotencyKey: KEY_1,
    installmentId: INST[0],
    amount: AMOUNTS[0],
    paidOn: TODAY,
    method: 'bank_transfer',
    ...overrides,
  });

  const post = (payload: unknown, id = ORDER_ID) =>
    request(server())
      .post(`/orders/${id}/payments`)
      .set('Authorization', auth())
      .send(payload as object);

  const auditRows = (type: string) =>
    auditRepo.create.mock.calls.filter(
      ([a]) => (a as { data: { eventType: string } }).data.eventType === type,
    ).length;

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
    hasSchedule = true;
    payments = [];
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
    // The engine's atomic gate: `status` as observed is the WHERE condition.
    orderRepo.updateMany.mockImplementation(
      (args: { where: { status: string }; data: { status: string } }) => {
        if (currentOrder === null || currentOrder.status !== args.where.status)
          return Promise.resolve({ count: 0 });
        currentOrder = { ...currentOrder, status: args.data.status };
        return Promise.resolve({ count: 1 });
      },
    );
    queryRaw.mockResolvedValue([{ id: ORDER_ID }]);
    paymentRepo.findUnique.mockImplementation(
      (args: { where: { idempotencyKey: string } }) =>
        Promise.resolve(
          payments.find(
            (p) => p.idempotencyKey === args.where.idempotencyKey,
          ) ?? null,
        ),
    );
    paymentRepo.create.mockImplementation(
      (args: { data: Omit<PaymentRow, 'id' | 'createdAt'> }) => {
        const row = {
          ...args.data,
          id: `pay-${payments.length + 1}`,
          createdAt: new Date(),
        };
        payments.push(row);
        return Promise.resolve(row);
      },
    );
    paymentRepo.count.mockImplementation(() =>
      Promise.resolve(payments.length),
    );
    auditRepo.create.mockResolvedValue({});
    givenPermissions(...ROLE_PRESETS.KE_TOAN);
  });

  it('no token ⇒ 401', async () => {
    const res = await request(server())
      .post(`/orders/${ORDER_ID}/payments`)
      .send(body());
    expect(res.status).toBe(401);
  });

  it('full deposit on dachot ⇒ 200, order moves to dacoc, mockup figures, one row per event in audit', async () => {
    const res = await post(body({ note: '  VCB  ' }));
    expect(res.status).toBe(200);
    expect(payments).toHaveLength(1);
    expect(currentOrder?.status).toBe('dacoc');
    expect(res.body.orderStatus).toBe('dacoc');
    expect(res.body.autoTransition).toEqual({
      event: 'du_coc',
      outcome: 'applied',
      message: null,
    });
    expect(res.body.payment).toEqual({
      id: 'pay-1',
      installmentId: INST[0],
      amount: AMOUNTS[0],
      paidOn: TODAY,
      method: 'bank_transfer',
      note: 'VCB',
      recordedAt: expect.any(String) as string,
    });
    const { schedule } = res.body;
    expect(schedule).toMatchObject({
      orderTotal: TOTAL,
      paidTotal: 16_602_192,
      remainingTotal: 66_408_768,
      paidPercent: 20,
      paymentStatus: 'partial',
      recordable: true,
      editable: false,
    });
    expect(schedule.installments[0]).toMatchObject({
      id: INST[0],
      status: 'paid',
      paidAmount: AMOUNTS[0],
      remainingAmount: 0,
    });
    expect(schedule.installments[0].payments).toHaveLength(1);
    for (const n of [
      schedule.paidTotal,
      schedule.remainingTotal,
      ...schedule.installments.flatMap(
        (i: { paidAmount: number; remainingAmount: number }) => [
          i.paidAmount,
          i.remainingAmount,
        ],
      ),
    ]) {
      expect(Number.isInteger(n)).toBe(true);
    }
    expect(auditRows('DepositRecorded')).toBe(1);
    expect(auditRows('StatusChanged')).toBe(1);
  });

  it('retry with the same key + payload ⇒ 200, same payment id, one row, no new audit row', async () => {
    const first = await post(body());
    jest.clearAllMocks();
    auditRepo.create.mockResolvedValue({});
    const again = await post(body());
    expect(again.status).toBe(200);
    expect(again.body.payment).toEqual(first.body.payment);
    expect(again.body.autoTransition).toBeNull();
    expect(again.body.orderStatus).toBe('dacoc');
    expect(payments).toHaveLength(1);
    expect(paymentRepo.create).not.toHaveBeenCalled();
    expect(auditRepo.create).not.toHaveBeenCalled();
  });

  it('same key with another amount ⇒ 409, nothing written', async () => {
    await post(body({ amount: 1_000 }));
    const res = await post(body({ amount: 2_000 }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.CONFLICT);
    expect(res.body.message).toBe(
      'Khoá ghi nhận đã được dùng cho một khoản khác.',
    );
    expect(payments).toHaveLength(1);
  });

  it('deposit in two parts: partial keeps dachot, the completing part moves to dacoc, one dong more ⇒ 400', async () => {
    const part = await post(body({ amount: 10_000_000 }));
    expect(part.status).toBe(200);
    expect(part.body.autoTransition).toBeNull();
    expect(part.body.orderStatus).toBe('dachot');
    expect(part.body.schedule.installments[0].status).toBe('partial');
    expect(auditRows('DepositRecorded')).toBe(1);

    const rest = await post(
      body({ idempotencyKey: KEY_2, amount: AMOUNTS[0] - 10_000_000 }),
    );
    expect(rest.body.autoTransition).toEqual({
      event: 'du_coc',
      outcome: 'applied',
      message: null,
    });
    expect(currentOrder?.status).toBe('dacoc');

    const over = await post(body({ idempotencyKey: KEY_3, amount: 1 }));
    expect(over.status).toBe(400);
    expect(over.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(over.body.fieldErrors).toEqual([
      {
        field: 'amount',
        code: 'exceedsRemaining',
        message: 'Số tiền thu vượt phần còn lại của đợt.',
      },
    ]);
    expect(payments).toHaveLength(2);
  });

  it('last installment paid on thicong (no close edge from there) ⇒ 200, money kept, skipped with message, no StatusChanged', async () => {
    currentOrder = order('thicong');
    payments = [
      {
        id: 'pay-a',
        orderId: ORDER_ID,
        installmentId: INST[0],
        amount: AMOUNTS[0],
        paidOn: new Date('2026-10-01T00:00:00Z'),
        method: 'cash',
        note: null,
        idempotencyKey: KEY_2,
        recordedByAccountId: ACCOUNT_ID,
        createdAt: new Date('2026-10-01T03:00:00Z'),
      },
      {
        id: 'pay-b',
        orderId: ORDER_ID,
        installmentId: INST[1],
        amount: AMOUNTS[1],
        paidOn: new Date('2026-10-05T00:00:00Z'),
        method: 'cash',
        note: null,
        idempotencyKey: KEY_3,
        recordedByAccountId: ACCOUNT_ID,
        createdAt: new Date('2026-10-05T03:00:00Z'),
      },
    ];
    const res = await post(
      body({ installmentId: INST[2], amount: AMOUNTS[2] }),
    );
    expect(res.status).toBe(200);
    expect(payments).toHaveLength(3);
    expect(currentOrder?.status).toBe('thicong');
    expect(res.body.autoTransition).toEqual({
      event: 'hoan_thanh',
      outcome: 'skipped',
      message: 'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
    });
    expect(res.body.schedule.paymentStatus).toBe('paid');
    expect(orderRepo.updateMany).not.toHaveBeenCalled();
    expect(auditRows('PaymentRecorded')).toBe(1);
    expect(auditRows('StatusChanged')).toBe(0);
  });

  /** Installments 1 and 2 already fully paid — the next recording on 3 settles the order. */
  const firstTwoPaid = (): PaymentRow[] =>
    [0, 1].map((i) => ({
      id: `pay-prior-${i + 1}`,
      orderId: ORDER_ID,
      installmentId: INST[i],
      amount: AMOUNTS[i],
      paidOn: new Date(`2026-10-0${i + 1}T00:00:00Z`),
      method: 'cash',
      note: null,
      idempotencyKey: [KEY_2, KEY_3][i],
      recordedByAccountId: ACCOUNT_ID,
      createdAt: new Date(`2026-10-0${i + 1}T03:00:00Z`),
    }));

  it('last installment paid on dagiao by a recorder holding delivery.confirm ⇒ hoanthanh applied, PaymentRecorded + StatusChanged once each', async () => {
    currentOrder = order('dagiao');
    payments = firstTwoPaid();
    givenPermissions(...ROLE_PRESETS.KE_TOAN, PERM.deliveryConfirm);
    const res = await post(
      body({ installmentId: INST[2], amount: AMOUNTS[2] }),
    );
    expect(res.status).toBe(200);
    expect(res.body.autoTransition).toEqual({
      event: 'hoan_thanh',
      outcome: 'applied',
      message: null,
    });
    expect(res.body.orderStatus).toBe('hoanthanh');
    expect(currentOrder?.status).toBe('hoanthanh');
    expect(res.body.schedule).toMatchObject({
      paidTotal: TOTAL,
      remainingTotal: 0,
      paidPercent: 100,
      paymentStatus: 'paid',
    });
    expect(auditRows('PaymentRecorded')).toBe(1);
    expect(auditRows('DepositRecorded')).toBe(0);
    expect(auditRows('StatusChanged')).toBe(1);
  });

  it('same settlement by a recorder WITHOUT delivery.confirm ⇒ still 200 (the engine 403 never leaks), skipped, money kept', async () => {
    currentOrder = order('dagiao');
    payments = firstTwoPaid();
    const res = await post(
      body({ installmentId: INST[2], amount: AMOUNTS[2] }),
    );
    expect(res.status).toBe(200);
    expect(res.body.autoTransition).toEqual({
      event: 'hoan_thanh',
      outcome: 'skipped',
      message: 'Bạn không có quyền thực hiện chuyển trạng thái này.',
    });
    expect(res.body.orderStatus).toBe('dagiao');
    expect(payments).toHaveLength(3);
    expect(orderRepo.updateMany).not.toHaveBeenCalled();
    expect(auditRows('PaymentRecorded')).toBe(1);
    expect(auditRows('StatusChanged')).toBe(0);
  });

  it('a whitespace-only note is stored as null', async () => {
    const res = await post(body({ amount: 1_000, note: '   ' }));
    expect(res.status).toBe(200);
    expect(res.body.payment.note).toBeNull();
    expect(payments[0].note).toBeNull();
  });

  it('retry whose note differs only by surrounding spaces ⇒ replay (same id, one row), not a 409', async () => {
    const first = await post(body({ amount: 1_000, note: 'VCB' }));
    const again = await post(body({ amount: 1_000, note: '  VCB ' }));
    expect(again.status).toBe(200);
    expect(again.body.payment.id).toBe(first.body.payment.id);
    expect(payments).toHaveLength(1);
  });

  it('deposit completed while the order is already dacoc ⇒ outcome already, no StatusChanged', async () => {
    currentOrder = order('dacoc');
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(res.body.autoTransition.outcome).toBe('already');
    expect(auditRows('StatusChanged')).toBe(0);
  });

  it.each([
    ['amount 0', { amount: 0 }, 'amount'],
    ['amount negative', { amount: -5 }, 'amount'],
    ['amount decimal', { amount: 1000.5 }, 'amount'],
    ['amount over the cap', { amount: 2_000_000_001 }, 'amount'],
    ['amount missing', { amount: undefined }, 'amount'],
    ['paidOn not a date', { paidOn: '21/10/2026' }, 'paidOn'],
    ['paidOn with a time', { paidOn: '2026-10-21T00:00:00Z' }, 'paidOn'],
    ['paidOn impossible day', { paidOn: '2026-02-30' }, 'paidOn'],
    ['method unknown', { method: 'momo' }, 'method'],
    ['paidOn missing', { paidOn: undefined }, 'paidOn'],
    ['method missing', { method: undefined }, 'method'],
    ['note > 200', { note: 'a'.repeat(201) }, 'note'],
    ['key missing', { idempotencyKey: undefined }, 'idempotencyKey'],
    ['key not a UUID v4', { idempotencyKey: 'abc' }, 'idempotencyKey'],
    [
      'key a UUID v1',
      { idempotencyKey: 'a8098c1a-f86e-11da-bd1a-00112444be1e' },
      'idempotencyKey',
    ],
    ['installmentId not a UUID-ish', { installmentId: 12 }, 'installmentId'],
  ])('%s ⇒ 400 on %s, nothing written', async (_l, diff, field) => {
    const res = await post(body(diff));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(
      res.body.fieldErrors.map((e: { field: string }) => e.field),
    ).toContain(field);
    expect(paymentRepo.create).not.toHaveBeenCalled();
    expect(auditRepo.create).not.toHaveBeenCalled();
  });

  it('payment date tomorrow (Vietnam time) ⇒ 400 paidOn/futureDate', async () => {
    const tomorrow = new Date(Date.now() + 31 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    const res = await post(body({ paidOn: tomorrow }));
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toEqual([
      {
        field: 'paidOn',
        code: 'futureDate',
        message: 'Ngày thu không được sau hôm nay.',
      },
    ]);
    expect(paymentRepo.create).not.toHaveBeenCalled();
  });

  it.each(['baogia', 'choduyet', 'huy'])(
    'order %s ⇒ 409, nothing written',
    async (status) => {
      currentOrder = order(status);
      const res = await post(body());
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(paymentRepo.create).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    },
  );

  it('hoanthanh order with money still owed ⇒ 200', async () => {
    currentOrder = order('hoanthanh');
    const res = await post(body({ installmentId: INST[1], amount: 1_000 }));
    expect(res.status).toBe(200);
    expect(payments).toHaveLength(1);
  });

  it('order without a schedule ⇒ 409', async () => {
    hasSchedule = false;
    const res = await post(body());
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Đơn chưa có lịch thanh toán.');
  });

  it('installment of an old / other schedule ⇒ 409, nothing written', async () => {
    const res = await post(
      body({ installmentId: '11111111-1111-4111-8111-111111111111' }),
    );
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'Lịch thanh toán vừa thay đổi — tải lại rồi ghi nhận lại.',
    );
    expect(payments).toHaveLength(0);
  });

  it('without payments.record ⇒ 403', async () => {
    givenPermissions(...ROLE_PRESETS.THO_KS);
    currentOrder = order('dachot', ACCOUNT_ID);
    expect((await post(body())).status).toBe(403);
    expect(paymentRepo.create).not.toHaveBeenCalled();
  });

  it('payments.record without any orders.view_* ⇒ 403', async () => {
    givenPermissions(PERM.paymentsRecord);
    expect((await post(body())).status).toBe(403);
  });

  it("view_own on someone else's order ⇒ 404 with the same message as an unknown id, even with a used key", async () => {
    await post(body());
    givenPermissions(PERM.paymentsRecord, PERM.ordersViewOwn);
    const outOfScope = await post(body());
    const unknown = await post(body(), UNKNOWN_ID);
    expect(outOfScope.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(outOfScope.body.message.replace(ORDER_ID, '')).toBe(
      unknown.body.message.replace(UNKNOWN_ID, ''),
    );
    expect(payments).toHaveLength(1);
  });

  it.each(['owner', 'assignee'])(
    'view_own on an order the caller is the %s of ⇒ 200, recorded',
    async (role) => {
      givenPermissions(PERM.paymentsRecord, PERM.ordersViewOwn);
      currentOrder =
        role === 'owner'
          ? order('dachot', ACCOUNT_ID)
          : { ...order('dachot'), assigneeAccountId: ACCOUNT_ID };
      expect((await post(body())).status).toBe(200);
      expect(payments).toHaveLength(1);
    },
  );

  it('non-UUID order id ⇒ 400', async () => {
    expect((await post(body(), 'not-a-uuid')).status).toBe(400);
  });

  it('the schedule routes and the order routes still resolve next to the new controller', async () => {
    const schedule = await request(server())
      .get(`/orders/${ORDER_ID}/payment-schedule`)
      .set('Authorization', auth());
    expect(schedule.status).toBe(200);
    expect(schedule.body.recordable).toBe(true);
    const detail = await request(server())
      .get(`/orders/${ORDER_ID}`)
      .set('Authorization', auth());
    expect(detail.status).toBe(200);
  });
});
