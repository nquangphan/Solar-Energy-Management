import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ErrorCode } from '../src/common/errors/error-code';
import { INVOICE_BLOCKED_MESSAGE } from '../src/invoices/domain/invoice-eligibility';
import { ORDER_CHANGED_MESSAGE } from '../src/invoices/invoices.service';
import { lineAmount } from '../src/orders/domain/line-amount';
import { resolveOrderTotals } from '../src/orders/domain/order-totals';
import { VAT_MODE } from '../src/orders/domain/vat-mode';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';
import { fakeStorage } from './util/fake-storage';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time ⇒ set env BEFORE loading `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/orders/:id/invoices` (hermetic — `PrismaService` overridden; real JWT, guards,
 * `ParseUUIDPipe`, exception filter, JSON serialisation and AuditSubscriber). HTTP codes are
 * measured HERE, through the real pipe and filter. The invoice fake returns money as `bigint`
 * exactly like Prisma, so a `bigint` leaking into a response fails here as a 500.
 */
describe('/orders/:id/invoices (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-invoices-e2e';
  const OTHER = 'acc-other-sale';
  const ORDER_ID = '88888888-8888-4888-8888-888888888888';
  const UNKNOWN_ID = '77777777-7777-4777-8777-777777777777';
  const VERSION_ID = 'ver-inv-1';
  const REVISED_VERSION_ID = 'ver-inv-2';
  const VERSION_NO: Record<string, number> = {
    [VERSION_ID]: 1,
    [REVISED_VERSION_ID]: 2,
  };
  const account = {
    id: ACCOUNT_ID,
    email: 'admin@example.com',
    displayName: 'Quản trị',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function order(id: string, status: string, ownerAccountId = OTHER) {
    return {
      id,
      status,
      customerSdt: '+84912345678',
      currentVersionId: VERSION_ID,
      ownerAccountId,
      assigneeAccountId: null as string | null,
      sourceId: 'src-fb',
      custType: 'THUONG_MAI',
      scopeThietBi: true,
      scopeThiCong: true,
      scopeVanChuyen: false,
      kWp: 10,
      vatMode: 'co_vat',
      validityNote: null,
      cancelReason: null,
      cancelledAt: null,
      createdAt: new Date('2026-10-20T01:00:00Z'),
      updatedAt: new Date('2026-10-20T01:00:00Z'),
    };
  }

  const LINES = [
    { name: 'Tấm pin 580W', unit: 'Tấm', qty: 18, unitPrice: 2_650_000 },
    { name: 'Biến tần 10kW', unit: 'Bộ', qty: 1, unitPrice: 18_500_000 },
  ].map((line, index) => ({
    ...line,
    id: `l-${index}`,
    orderVersionId: VERSION_ID,
    productId: null,
    unitPriceSnapshot: line.unitPrice,
    priceEditable: true,
    isFlexible: false,
    note: null,
    warrantyMonths: 120,
    displayOrder: index,
  }));
  /** Expected totals from the real resolver — never hand-typed. */
  const EXPECTED = resolveOrderTotals({
    lines: LINES,
    version: { vatRate: 8, vatMode: 'co_vat', discountAmount: null },
    order: { status: 'dachot', vatMode: 'co_vat', discount: null },
    fallbackVatRate: 8,
  }).totals;

  type InvoiceRow = Record<string, unknown> & {
    id: string;
    seq: number;
    orderId: string;
    orderVersionId: string;
    issuedAt: Date;
    lines: { create: unknown[] };
  };

  let orders: ReturnType<typeof order>[];
  let lines: typeof LINES;
  /** VAT mode + approved discount frozen on the order version (what the invoice copies). */
  let versionSnapshot: { vatMode: string; discountAmount: number | null };
  let invoices: InvoiceRow[];
  let nextSeq: number;
  let customer: {
    sdt: string;
    name: string;
    taxCode: string | null;
    address: string | null;
  };

  const auditRepo = { create: jest.fn() };
  const queryRaw = jest.fn();
  const withIncludes = (row: InvoiceRow) => ({
    ...row,
    orderVersion: { versionNo: VERSION_NO[row.orderVersionId] },
    _count: { lines: row.lines.create.length },
  });
  const invoiceRepo = {
    create: jest.fn((args: { data: Omit<InvoiceRow, 'id'> }) => {
      const row = {
        id: `inv-${invoices.length + 1}`,
        ...args.data,
      } as InvoiceRow;
      invoices.push(row);
      return Promise.resolve(withIncludes(row));
    }),
    findUnique: jest.fn((args: { where: { orderVersionId: string } }) => {
      const row = invoices.find(
        (i) => i.orderVersionId === args.where.orderVersionId,
      );
      return Promise.resolve(row === undefined ? null : withIncludes(row));
    }),
    findMany: jest.fn((args: { where: { orderId: string } }) =>
      Promise.resolve(
        invoices
          .filter((i) => i.orderId === args.where.orderId)
          .sort((a, b) => b.seq - a.seq)
          .map(withIncludes),
      ),
    ),
  };
  const repos = {
    order: { findFirst: jest.fn(), findUnique: jest.fn() },
    orderVersion: {
      findUnique: jest.fn((args: { where: { id: string } }) =>
        Promise.resolve({
          id: args.where.id,
          versionNo: VERSION_NO[args.where.id],
          vatRate: 8,
          ...versionSnapshot,
        }),
      ),
    },
    orderLineItem: { findMany: jest.fn(() => Promise.resolve(lines)) },
    discountApproval: { findFirst: jest.fn(() => Promise.resolve(null)) },
    product: { findMany: jest.fn(() => Promise.resolve([])) },
    customer: { findUnique: jest.fn(() => Promise.resolve(customer)) },
    paymentSchedule: { findUnique: jest.fn(() => Promise.resolve(null)) },
    payment: { count: jest.fn(() => Promise.resolve(0)) },
    invoice: invoiceRepo,
    quoteExport: { upsert: jest.fn(() => Promise.resolve({})) },
    auditLog: auditRepo,
    featureFlag: { findUnique: jest.fn(() => Promise.resolve(null)) },
    systemSetting: {
      findUnique: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
    $queryRaw: queryRaw,
  };
  const prismaMock = {
    ...repos,
    $transaction: jest.fn(
      (arg: Promise<unknown>[] | ((tx: typeof repos) => Promise<unknown>)) =>
        typeof arg === 'function' ? arg(repos) : Promise.all(arg),
    ),
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  function givenPermissions(...keys: readonly string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  const server = () => app.getHttpServer() as Server;
  const auth = () =>
    `Bearer ${jwt.sign({ sub: ACCOUNT_ID, email: account.email })}`;
  const overview = (id = ORDER_ID) =>
    request(server())
      .get(`/orders/${id}/invoices`)
      .set('Authorization', auth());
  const create = (id = ORDER_ID) =>
    request(server())
      .post(`/orders/${id}/invoices`)
      .set('Authorization', auth())
      .send({});
  const invoiceAudits = () =>
    auditRepo.create.mock.calls.filter(
      ([a]) =>
        (a as { data: { eventType: string } }).data.eventType ===
        'InvoiceCreated',
    );

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
      .useValue({
        render: jest.fn(() =>
          Promise.resolve({
            pdf: Buffer.from('%PDF'),
            image: Buffer.from('x'),
          }),
        ),
        renderPdf: jest.fn(),
      })
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
    orders = [order(ORDER_ID, 'dachot')];
    lines = LINES;
    versionSnapshot = { vatMode: VAT_MODE.coVat, discountAmount: null };
    invoices = [];
    nextSeq = 731;
    customer = {
      sdt: '+84912345678',
      name: 'VP Công Chứng Lê Đình Thao',
      taxCode: '0316552018',
      address: '45 Lê Lợi',
    };
    // Scope fake: applies the owner/assignee clause the service ACTUALLY sends.
    repos.order.findFirst.mockImplementation(
      (args: { where: { AND: Record<string, unknown>[] } }) => {
        const o = orders.find((x) => x.id === args.where.AND[0].id);
        if (o === undefined) return Promise.resolve(null);
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
    repos.order.findUnique.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve(orders.find((o) => o.id === args.where.id) ?? null),
    );
    queryRaw.mockImplementation((sql: TemplateStringsArray) =>
      Promise.resolve(
        sql.join('?').includes('FOR UPDATE')
          ? [{ id: ORDER_ID }]
          : [{ seq: BigInt(nextSeq++) }],
      ),
    );
    auditRepo.create.mockResolvedValue({});
    givenPermissions(PERM.invoicesManage, PERM.ordersViewAll);
  });

  it('no token ⇒ 401', async () => {
    const res = await request(server()).get(`/orders/${ORDER_ID}/invoices`);
    expect(res.status).toBe(401);
  });

  describe('GET overview', () => {
    it('200: the source the invoice will copy, creatable, empty list', async () => {
      const res = await overview();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        creatable: true,
        blockedReason: null,
        currentInvoiceId: null,
        versionNo: 1,
        customerName: 'VP Công Chứng Lê Đình Thao',
        customerTaxCode: '0316552018',
        lineCount: 2,
        orderTotal: EXPECTED.total,
        invoices: [],
      });
    });
  });

  describe('POST create', () => {
    it('200: the snapshot as plain JSON numbers, one row, one audit row', async () => {
      const res = await create();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'inv-1',
        invoiceNo: expect.stringMatching(/^HD-\d{4}-0731$/),
        versionNo: 1,
        issuedAt: expect.any(String),
        customerName: 'VP Công Chứng Lê Đình Thao',
        customerTaxCode: '0316552018',
        vatRate: 8,
        applyVat: true,
        subtotal: EXPECTED.subtotal,
        discountAmount: 0,
        vatAmount: EXPECTED.vatAmount,
        total: EXPECTED.total,
        lineCount: 2,
      });
      for (const key of ['subtotal', 'discountAmount', 'vatAmount', 'total']) {
        expect(Number.isInteger(res.body[key])).toBe(true);
      }
      expect(invoices).toHaveLength(1);
      expect(invoices[0]).toMatchObject({
        orderId: ORDER_ID,
        orderVersionId: VERSION_ID,
        total: BigInt(EXPECTED.total),
        createdByAccountId: ACCOUNT_ID,
      });
      expect(invoices[0].lines.create).toEqual(
        LINES.map((line, index) => ({
          displayOrder: index,
          name: line.name,
          unit: line.unit,
          qty: line.qty,
          unitPrice: line.unitPrice,
          amount: BigInt(lineAmount(line.unitPrice, line.qty)),
        })),
      );
      expect(invoiceAudits()).toHaveLength(1);
      const audit = invoiceAudits()[0][0] as {
        data: Record<string, unknown> & {
          occurredAt: Date;
          after: Record<string, unknown>;
        };
      };
      expect(audit.data).toMatchObject({
        eventType: 'InvoiceCreated',
        targetType: 'Order',
        targetId: ORDER_ID,
        actorAccountId: ACCOUNT_ID,
      });
      expect(audit.data.occurredAt.toISOString()).toBe(res.body.issuedAt);
      expect(audit.data.after).toEqual({
        invoiceId: res.body.id,
        invoiceNo: res.body.invoiceNo,
        orderVersionId: VERSION_ID,
        total: EXPECTED.total,
      });
    });

    it('twice for the same version ⇒ both 200, same body, ONE row, ONE audit row', async () => {
      const first = await create();
      const second = await create();

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(invoices).toHaveLength(1);
      expect(invoiceAudits()).toHaveLength(1);
      const o = await overview();
      expect(o.body.creatable).toBe(false);
      expect(o.body.blockedReason).toBeNull();
      expect(o.body.currentInvoiceId).toBe(first.body.id);
    });

    it('the overview lists the created invoice with the very body POST returned; the number year is the UTC+7 year of issuedAt', async () => {
      const created = await create();

      const o = await overview();

      expect(o.status).toBe(200);
      expect(o.body.invoices).toEqual([created.body]);
      const issuedVn = new Date(
        Date.parse(created.body.issuedAt as string) + 7 * 3_600_000,
      );
      expect(created.body.invoiceNo).toBe(
        `HD-${issuedVn.getUTCFullYear()}-0731`,
      );
    });

    it('approved discount frozen on the version ⇒ copied; total = subtotal − discount + VAT', async () => {
      versionSnapshot = { vatMode: VAT_MODE.coVat, discountAmount: 1_862_000 };
      const expected = resolveOrderTotals({
        lines: LINES,
        version: { vatRate: 8, ...versionSnapshot },
        order: { status: 'dachot', vatMode: 'co_vat', discount: null },
        fallbackVatRate: 8,
      }).totals;

      const res = await create();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        subtotal: expected.subtotal,
        discountAmount: 1_862_000,
        vatAmount: expected.vatAmount,
        total: expected.total,
      });
      expect(res.body.total).toBe(
        res.body.subtotal - res.body.discountAmount + res.body.vatAmount,
      );
      expect(res.body.total).toBeLessThan(EXPECTED.total);
      expect(invoices[0]).toMatchObject({
        discountAmount: BigInt(1_862_000),
        total: BigInt(expected.total),
      });
      expect((await overview()).body.orderTotal).toBe(expected.total);
    });

    it('order without VAT ⇒ applyVat false, vatAmount 0, total = subtotal', async () => {
      versionSnapshot = { vatMode: VAT_MODE.khongVat, discountAmount: null };

      const res = await create();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        applyVat: false,
        vatAmount: 0,
        subtotal: EXPECTED.subtotal,
        total: EXPECTED.subtotal,
      });
      expect(invoices[0]).toMatchObject({ applyVat: false, vatAmount: 0n });
    });

    it('order above INT4 (2 × 1.500.000.000) ⇒ 200, exact JSON numbers in POST and overview', async () => {
      lines = [
        {
          ...LINES[0],
          name: 'Hệ 1MWp trọn gói',
          qty: 2,
          unitPrice: 1_500_000_000,
          unitPriceSnapshot: 1_500_000_000,
        },
      ];
      const expected = resolveOrderTotals({
        lines,
        version: { vatRate: 8, ...versionSnapshot },
        order: { status: 'dachot', vatMode: 'co_vat', discount: null },
        fallbackVatRate: 8,
      }).totals;
      expect(expected.total).toBeGreaterThan(2_147_483_647);

      const res = await create();

      expect(res.status).toBe(200);
      expect(res.body.subtotal).toBe(3_000_000_000);
      expect(res.body.total).toBe(expected.total);
      expect(invoices[0].lines.create).toEqual([
        expect.objectContaining({ amount: 3_000_000_000n }),
      ]);
      const o = await overview();
      expect(o.body.orderTotal).toBe(expected.total);
      expect(o.body.invoices[0].total).toBe(expected.total);
    });

    it.each(['dacoc', 'thicong', 'nghiemthu', 'danggiao', 'dagiao'])(
      'confirmed order already moved on (%s) ⇒ overview creatable, POST 200',
      async (status) => {
        orders[0].status = status;

        const o = await overview();
        const res = await create();

        expect(o.body.creatable).toBe(true);
        expect(o.body.blockedReason).toBeNull();
        expect(res.status).toBe(200);
        expect(invoiceAudits()).toHaveLength(1);
      },
    );

    it.each(['hoanthanh', 'huy'])(
      'replay after the order moved to %s ⇒ 200 with the stored invoice, no new audit',
      async (status) => {
        const first = await create();
        orders[0].status = status;

        const again = await create();

        expect(again.status).toBe(200);
        expect(again.body).toEqual(first.body);
        expect(invoiceAudits()).toHaveLength(1);
      },
    );

    it('order revised after the first invoice ⇒ a NEW invoice for the new version; the old one stays; newest first', async () => {
      const first = await create();
      orders[0].currentVersionId = REVISED_VERSION_ID;

      const second = await create();

      expect(second.status).toBe(200);
      expect(second.body.id).not.toBe(first.body.id);
      expect(second.body.invoiceNo).not.toBe(first.body.invoiceNo);
      expect([first.body.versionNo, second.body.versionNo]).toEqual([1, 2]);
      const o = await overview();
      expect(
        o.body.invoices.map((i: { id: string; versionNo: number }) => [
          i.id,
          i.versionNo,
        ]),
      ).toEqual([
        [second.body.id, 2],
        [first.body.id, 1],
      ]);
      expect(o.body.currentInvoiceId).toBe(second.body.id);
      expect(invoiceAudits()).toHaveLength(2);
    });

    it('a customer without a tax code ⇒ 200, customerTaxCode null', async () => {
      customer = { ...customer, taxCode: null };

      const res = await create();

      expect(res.status).toBe(200);
      expect(res.body.customerTaxCode).toBeNull();
      expect((await overview()).body.customerTaxCode).toBeNull();
    });

    it('hoanthanh ⇒ 200 (invoiced at settlement)', async () => {
      orders[0].status = 'hoanthanh';

      expect((await create()).status).toBe(200);
    });

    it.each([
      ['baogia', 409, ErrorCode.CONFLICT, INVOICE_BLOCKED_MESSAGE.status],
      ['choduyet', 409, ErrorCode.CONFLICT, INVOICE_BLOCKED_MESSAGE.status],
      ['huy', 409, ErrorCode.CONFLICT, INVOICE_BLOCKED_MESSAGE.status],
    ])(
      'order %s ⇒ %i, nothing written, no number taken; overview says the same',
      async (status, code, errorCode, message) => {
        orders[0].status = status;

        const res = await create();

        expect(res.status).toBe(code);
        expect(res.body.code).toBe(errorCode);
        expect(res.body.message).toBe(message);
        expect(invoiceRepo.create).not.toHaveBeenCalled();
        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(invoiceAudits()).toHaveLength(0);
        const o = await overview();
        expect(o.body.creatable).toBe(false);
        expect(o.body.blockedReason).toBe(message);
      },
    );

    it('confirmed order without lines ⇒ 400 VALIDATION_ERROR, nothing written', async () => {
      lines = [];

      const res = await create();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.message).toBe(INVOICE_BLOCKED_MESSAGE.noLines);
      expect(invoiceRepo.create).not.toHaveBeenCalled();
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(invoiceAudits()).toHaveLength(0);
      const o = await overview();
      expect(o.body.creatable).toBe(false);
      expect(o.body.blockedReason).toBe(INVOICE_BLOCKED_MESSAGE.noLines);
    });

    it('revised between the scoped read and the lock ⇒ 409 "Đơn vừa thay đổi"', async () => {
      // The scoped read sees version 1; the row read under the lock already points at version 2.
      repos.order.findUnique.mockImplementation(() =>
        Promise.resolve({
          ...orders[0],
          currentVersionId: REVISED_VERSION_ID,
        }),
      );

      const res = await create();

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.message).toBe(ORDER_CHANGED_MESSAGE);
      expect(invoiceRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('permissions and scope', () => {
    const routes = [
      ['GET overview', () => overview()],
      ['POST create', () => create()],
    ] as const;

    it.each(routes)('%s without invoices.manage ⇒ 403', async (_name, call) => {
      givenPermissions(PERM.ordersViewAll, PERM.contractsGenerate);

      const res = await call();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(invoiceRepo.findMany).not.toHaveBeenCalled();
      expect(invoiceRepo.create).not.toHaveBeenCalled();
    });

    it.each(routes)(
      '%s with invoices.manage but neither orders.view_all nor view_own ⇒ 403',
      async (_name, call) => {
        givenPermissions(PERM.invoicesManage);

        const res = await call();

        expect(res.status).toBe(403);
        expect(invoiceRepo.findUnique).not.toHaveBeenCalled();
      },
    );

    it.each(routes)(
      '%s for a view_own caller who is not owner/assignee ⇒ 404 like an unknown order, even when the invoice exists',
      async (_name, call) => {
        await create();
        givenPermissions(PERM.invoicesManage, PERM.ordersViewOwn);
        jest.clearAllMocks();
        auditRepo.create.mockResolvedValue({});

        const res = await call();
        const unknown = await overview(UNKNOWN_ID);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe(`Không tìm thấy đơn hàng: ${ORDER_ID}`);
        expect(res.body.id).toBeUndefined();
        expect(unknown.status).toBe(404);
        expect(unknown.body.message).toBe(
          `Không tìm thấy đơn hàng: ${UNKNOWN_ID}`,
        );
        expect(invoiceRepo.findUnique).not.toHaveBeenCalled();
        expect(invoiceRepo.findMany).not.toHaveBeenCalled();
      },
    );

    it('owner or assignee with view_own ⇒ allowed', async () => {
      orders[0].assigneeAccountId = ACCOUNT_ID;
      givenPermissions(PERM.invoicesManage, PERM.ordersViewOwn);

      expect((await overview()).status).toBe(200);
      expect((await create()).status).toBe(200);
    });

    it('owner (not assignee) with view_own ⇒ overview 200, POST 200', async () => {
      orders = [order(ORDER_ID, 'dachot', ACCOUNT_ID)];
      givenPermissions(PERM.invoicesManage, PERM.ordersViewOwn);

      expect((await overview()).status).toBe(200);
      expect((await create()).status).toBe(200);
      expect(invoices).toHaveLength(1);
    });

    it('POST on an unknown order with view_all ⇒ 404, nothing locked or written', async () => {
      const res = await create(UNKNOWN_ID);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
      expect(res.body.message).toBe(`Không tìm thấy đơn hàng: ${UNKNOWN_ID}`);
      expect(queryRaw).not.toHaveBeenCalled();
      expect(invoiceRepo.create).not.toHaveBeenCalled();
      expect(invoiceAudits()).toHaveLength(0);
    });

    it.each([
      [
        'GET overview',
        () => request(server()).get('/orders/not-a-uuid/invoices'),
      ],
      [
        'POST create',
        () => request(server()).post('/orders/not-a-uuid/invoices'),
      ],
    ])('%s with a non-UUID id ⇒ 400', async (_name, call) => {
      const res = await call().set('Authorization', auth());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('existing order routes still work beside the new controller', () => {
    it('POST /orders/:id/xuat-bao-gia ⇒ 200', async () => {
      givenPermissions(PERM.quotesCreateEdit, PERM.ordersViewAll);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/xuat-bao-gia`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
    });

    it('GET /orders/:id/payment-schedule ⇒ 200', async () => {
      givenPermissions(PERM.paymentsRecord, PERM.ordersViewAll);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}/payment-schedule`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
    });

    it.each([
      ['GET', `/orders/${ORDER_ID}/contracts`],
      ['POST', `/orders/${ORDER_ID}/payments`],
    ])(
      '%s %s is still routed (403 without its permission, not 404)',
      async (method, path) => {
        const res =
          method === 'GET'
            ? await request(server()).get(path).set('Authorization', auth())
            : await request(server())
                .post(path)
                .set('Authorization', auth())
                .send({});

        expect(res.status).toBe(403);
      },
    );
  });
});
