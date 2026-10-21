import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ErrorCode } from '../src/common/errors/error-code';
import {
  INVOICE_NOT_FOUND_MESSAGE,
  INVOICE_PDF_NOT_EXPORTED_MESSAGE,
} from '../src/invoices/invoice-document.service';
import { quoteNumberOf } from '../src/orders/domain/quote-number';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';
import { fakeStorage, type FakeStorage } from './util/fake-storage';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time ⇒ set env BEFORE loading `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/orders/:id/invoices/:invoiceId[/pdf]` (hermetic — `PrismaService` overridden; real JWT,
 * guards, `ParseUUIDPipe`, exception filter, JSON serialisation and AuditSubscriber). HTTP codes
 * are measured HERE. The invoice fake returns money as `bigint` exactly like Prisma, so a `bigint`
 * leaking into a response fails here as a 500. R2 and Chromium are in-memory fakes.
 */
describe('/orders/:id/invoices/:invoiceId (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let storage: FakeStorage;

  const ACCOUNT_ID = 'acc-invoice-doc-e2e';
  const OTHER = 'acc-other-sale';
  const ORDER_A = '88888888-8888-4888-8888-888888888888';
  const ORDER_B = '99999999-9999-4999-8999-999999999999';
  const UNKNOWN_ID = '77777777-7777-4777-8777-777777777777';
  const INVOICE_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
  const INVOICE_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
  const PDF = Buffer.from('%PDF-1.4 invoice bytes');
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
      currentVersionId: 'ver-1',
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

  type PdfRow = {
    id: string;
    invoiceId: string;
    pdfKey: string;
    pdfSize: number;
    fileName: string;
    createdByAccountId: string;
    createdAt: Date;
  };

  /** A stored invoice as Prisma returns it — money columns are `bigint`. */
  function invoice(id: string, orderId: string, invoiceNo: string) {
    return {
      id,
      seq: 731,
      invoiceNo,
      orderId,
      orderVersionId: 'ver-1',
      customerSdt: '+84912345678',
      customerName: 'VP Công Chứng Lê Đình Thao',
      customerTaxCode: '0316552018',
      customerAddress: null as string | null,
      sellerLegalName: 'CÔNG TY NLMT PHƯƠNG NAM',
      sellerTaxCode: '0312998771',
      // Seven DISTINCT values: a mapping that swaps two seller fields cannot pass.
      sellerAddress: '12 Nguyễn Văn Bảo, Gò Vấp',
      sellerRepresentative: 'Nguyễn Văn An',
      sellerRepresentativeTitle: 'Giám đốc',
      sellerPhone: '028 3899 1234',
      sellerBankAccount: '0071001234567 Vietcombank',
      vatRate: 8,
      applyVat: true,
      subtotal: 3_000_000_000n,
      discountAmount: 0n,
      vatAmount: 240_000_000n,
      total: 3_240_000_000n,
      issuedAt: new Date('2026-07-05T18:30:00Z'),
      createdByAccountId: OTHER,
      createdAt: new Date('2026-07-05T18:30:00Z'),
      lines: [
        {
          id: `${id}-l1`,
          invoiceId: id,
          displayOrder: 1,
          name: 'Hệ 1MWp trọn gói',
          unit: 'Bộ',
          qty: 1,
          unitPrice: 2_000_000_000,
          amount: 2_000_000_000n,
        },
        {
          id: `${id}-l2`,
          invoiceId: id,
          displayOrder: 2,
          name: 'Công lắp đặt',
          unit: 'Gói',
          qty: 1,
          unitPrice: 1_000_000_000,
          amount: 1_000_000_000n,
        },
      ],
    };
  }

  let orders: ReturnType<typeof order>[];
  let invoices: ReturnType<typeof invoice>[];
  let pdfs: PdfRow[];

  const auditRepo = { create: jest.fn() };
  const renderPdf = jest.fn();
  const withIncludes = (
    row: ReturnType<typeof invoice>,
    include: Record<string, unknown> = {},
  ) => ({
    ...row,
    orderVersion: { versionNo: 1 },
    pdf: include.pdf
      ? (pdfs.find((p) => p.invoiceId === row.id) ?? null)
      : undefined,
    _count: { lines: row.lines.length },
  });
  const invoiceRepo = {
    findFirst: jest.fn(
      (args: {
        where: { id: string; orderId: string };
        include?: Record<string, unknown>;
      }) => {
        const row = invoices.find(
          (i) => i.id === args.where.id && i.orderId === args.where.orderId,
        );
        return Promise.resolve(
          row === undefined ? null : withIncludes(row, args.include),
        );
      },
    ),
    findUnique: jest.fn(
      (args: { where: { id: string }; include?: Record<string, unknown> }) => {
        const row = invoices.find((i) => i.id === args.where.id);
        return Promise.resolve(
          row === undefined ? null : withIncludes(row, args.include),
        );
      },
    ),
    findMany: jest.fn((args: { where: { orderId: string } }) =>
      Promise.resolve(
        invoices
          .filter((i) => i.orderId === args.where.orderId)
          .map((row) => withIncludes(row)),
      ),
    ),
  };
  const invoicePdfRepo = {
    findUnique: jest.fn((args: { where: { invoiceId: string } }) =>
      Promise.resolve(
        pdfs.find((p) => p.invoiceId === args.where.invoiceId) ?? null,
      ),
    ),
    create: jest.fn((args: { data: Omit<PdfRow, 'id' | 'createdAt'> }) => {
      const row = {
        id: `pdf-${pdfs.length + 1}`,
        createdAt: new Date('2026-10-22T03:00:00Z'),
        ...args.data,
      };
      pdfs.push(row);
      return Promise.resolve(row);
    }),
  };
  /** The invoice row lock: returns the row only when it belongs to the order in the SQL. A lock
   *  that lost its `order_id` filter fails loudly instead of looking like a plain 404. */
  const queryRaw = jest.fn((sql: TemplateStringsArray, ...values: string[]) => {
    if (!sql.join('?').includes('AND order_id = ?')) {
      throw new Error('invoice lock must filter by order_id');
    }
    const [invoiceId, orderId] = values;
    return Promise.resolve(
      invoices
        .filter((i) => i.id === invoiceId && i.orderId === orderId)
        .map((i) => ({ id: i.id })),
    );
  });
  const repos = {
    order: { findFirst: jest.fn(), findUnique: jest.fn() },
    orderVersion: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: 'ver-1',
          versionNo: 1,
          vatRate: 8,
          vatMode: 'co_vat',
          discountAmount: null,
        }),
      ),
    },
    orderLineItem: { findMany: jest.fn(() => Promise.resolve([])) },
    discountApproval: { findFirst: jest.fn(() => Promise.resolve(null)) },
    product: { findMany: jest.fn(() => Promise.resolve([])) },
    customer: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          sdt: '+84912345678',
          name: 'VP Công Chứng Lê Đình Thao',
          taxCode: null,
          address: null,
        }),
      ),
    },
    invoice: invoiceRepo,
    invoicePdf: invoicePdfRepo,
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
  const detail = (orderId = ORDER_A, invoiceId = INVOICE_A) =>
    request(server())
      .get(`/orders/${orderId}/invoices/${invoiceId}`)
      .set('Authorization', auth());
  const exportPdf = (orderId = ORDER_A, invoiceId = INVOICE_A) =>
    request(server())
      .post(`/orders/${orderId}/invoices/${invoiceId}/pdf`)
      .set('Authorization', auth())
      .send({});
  const download = (orderId = ORDER_A, invoiceId = INVOICE_A) =>
    request(server())
      .get(`/orders/${orderId}/invoices/${invoiceId}/pdf`)
      .set('Authorization', auth())
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
  const pdfAudits = () =>
    auditRepo.create.mock.calls.filter(
      ([a]) =>
        (a as { data: { eventType: string } }).data.eventType ===
        'InvoicePdfExported',
    );

  beforeAll(async () => {
    storage = fakeStorage();
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(AccountsService)
      .useValue(accountsMock)
      .overrideProvider(AccountPermissionsService)
      .useValue(accountPermissionsMock)
      .overrideProvider(StoragePort)
      .useValue(storage)
      .overrideProvider(QuoteRendererPort)
      .useValue({ render: jest.fn(), renderPdf })
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
    storage.objects.clear();
    orders = [order(ORDER_A, 'dachot'), order(ORDER_B, 'dachot')];
    invoices = [
      invoice(INVOICE_A, ORDER_A, 'HD-2026-0731'),
      invoice(INVOICE_B, ORDER_B, 'HD-2026-0732'),
    ];
    pdfs = [];
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
    renderPdf.mockResolvedValue(PDF);
    auditRepo.create.mockResolvedValue({});
    givenPermissions(PERM.invoicesManage, PERM.ordersViewAll);
  });

  it('no token ⇒ 401', async () => {
    const res = await request(server()).get(
      `/orders/${ORDER_A}/invoices/${INVOICE_A}`,
    );
    expect(res.status).toBe(401);
  });

  describe('GET detail', () => {
    it('200: the snapshot as plain integer JSON numbers, even above INT4', async () => {
      const res = await detail();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: INVOICE_A,
        invoiceNo: 'HD-2026-0731',
        versionNo: 1,
        issuedAt: '2026-07-05T18:30:00.000Z',
        customerName: 'VP Công Chứng Lê Đình Thao',
        customerTaxCode: '0316552018',
        vatRate: 8,
        applyVat: true,
        subtotal: Number(invoices[0].subtotal),
        discountAmount: 0,
        vatAmount: Number(invoices[0].vatAmount),
        total: Number(invoices[0].total),
        lineCount: 2,
        orderId: ORDER_A,
        quoteNo: quoteNumberOf(ORDER_A),
        customerPhone: '+84912345678',
        customerAddress: null,
        seller: {
          legalName: 'CÔNG TY NLMT PHƯƠNG NAM',
          taxCode: '0312998771',
          address: invoices[0].sellerAddress,
          representative: invoices[0].sellerRepresentative,
          representativeTitle: invoices[0].sellerRepresentativeTitle,
          phone: invoices[0].sellerPhone,
          bankAccount: invoices[0].sellerBankAccount,
        },
        lines: invoices[0].lines.map((line) => ({
          displayOrder: line.displayOrder,
          name: line.name,
          unit: line.unit,
          qty: line.qty,
          unitPrice: line.unitPrice,
          amount: Number(line.amount),
        })),
        pdf: null,
      });
      expect(res.body.total).toBeGreaterThan(2_147_483_647);
      for (const value of [
        res.body.subtotal,
        res.body.vatAmount,
        res.body.total,
        ...res.body.lines.flatMap(
          (l: { unitPrice: number; amount: number }) => [l.unitPrice, l.amount],
        ),
      ]) {
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it.each(['huy', 'hoanthanh', 'baogia'])(
      'is viewable whatever the order status is now (%s after issue)',
      async (status) => {
        orders[0].status = status;
        expect((await detail()).status).toBe(200);
      },
    );
  });

  describe('POST export', () => {
    it('200 first time: renders once, stores at the deterministic key, one row, one audit row', async () => {
      const res = await exportPdf();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        fileName: 'hoa-don-HD-2026-0731.pdf',
        pdfSize: PDF.length,
        exportedAt: '2026-10-22T03:00:00.000Z',
      });
      expect(renderPdf).toHaveBeenCalledTimes(1);
      expect(renderPdf.mock.calls[0][0]).toContain('HOÁ ĐƠN BÁN HÀNG');
      expect([...storage.objects.keys()]).toEqual([
        `invoices/${ORDER_A}/${INVOICE_A}.pdf`,
      ]);
      expect(
        storage.objects.get(`invoices/${ORDER_A}/${INVOICE_A}.pdf`),
      ).toEqual({ body: PDF, contentType: 'application/pdf' });
      expect(pdfs).toHaveLength(1);
      expect(pdfAudits()).toHaveLength(1);
      const audit = pdfAudits()[0][0] as {
        data: { targetType: string; targetId: string };
      };
      expect(audit.data).toMatchObject({
        targetType: 'Order',
        targetId: ORDER_A,
      });
    });

    it('200 again: same body, no render, no upload, no row, no audit; detail shows the file', async () => {
      const first = await exportPdf();
      jest.clearAllMocks();
      auditRepo.create.mockResolvedValue({});
      const second = await exportPdf();

      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(renderPdf).toHaveBeenCalledTimes(0);
      expect(pdfs).toHaveLength(1);
      expect(pdfAudits()).toHaveLength(0);

      const view = await detail();
      expect(view.body.pdf).toEqual(first.body);
    });

    it.each(['huy', 'hoanthanh', 'baogia'])(
      'exports whatever the order status is now (%s after issue)',
      async (status) => {
        orders[0].status = status;
        expect((await exportPdf()).status).toBe(200);
      },
    );

    it('upload failure ⇒ 500 envelope without a stack, no row, no audit', async () => {
      const put = jest
        .spyOn(storage, 'putObject')
        .mockRejectedValueOnce(new Error('r2 refused at /srv/r2.js'));

      const res = await exportPdf();

      expect(res.status).toBe(500);
      expect(res.body.code).toBe(ErrorCode.INTERNAL);
      expect(JSON.stringify(res.body)).not.toContain('r2 refused');
      expect(put).toHaveBeenCalledTimes(1);
      expect(renderPdf).toHaveBeenCalledTimes(1);
      expect(pdfs).toHaveLength(0);
      expect(pdfAudits()).toHaveLength(0);
      put.mockRestore();
    });

    it('render failure ⇒ 500 envelope without a stack, no row, no audit', async () => {
      renderPdf.mockRejectedValue(new Error('chromium crashed at /srv/x.js'));

      const res = await exportPdf();

      expect(res.status).toBe(500);
      expect(res.body.code).toBe(ErrorCode.INTERNAL);
      expect(JSON.stringify(res.body)).not.toContain('chromium');
      expect(storage.objects.size).toBe(0);
      expect(pdfs).toHaveLength(0);
      expect(pdfAudits()).toHaveLength(0);
    });
  });

  describe('GET pdf (download proxy)', () => {
    it('200 after export: application/pdf, attachment file name, the stored bytes', async () => {
      await exportPdf();

      const res = await download();

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="hoa-don-HD-2026-0731.pdf"',
      );
      expect(Buffer.compare(res.body as Buffer, PDF)).toBe(0);
    });

    it('not exported yet ⇒ 404 "Hoá đơn này chưa xuất PDF." without reading R2', async () => {
      const get = jest.spyOn(storage, 'getObject');

      const res = await request(server())
        .get(`/orders/${ORDER_A}/invoices/${INVOICE_A}/pdf`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
      expect(res.body.message).toBe(INVOICE_PDF_NOT_EXPORTED_MESSAGE);
      expect(get).not.toHaveBeenCalled();
      get.mockRestore();
    });
  });

  describe('linked to the right order — no leak', () => {
    it.each([
      ['GET detail', () => detail(ORDER_A, INVOICE_B)],
      ['POST export', () => exportPdf(ORDER_A, INVOICE_B)],
      [
        'GET pdf',
        () =>
          request(server())
            .get(`/orders/${ORDER_A}/invoices/${INVOICE_B}/pdf`)
            .set('Authorization', auth()),
      ],
      ['GET detail (unknown id)', () => detail(ORDER_A, UNKNOWN_ID)],
    ])(
      '%s with another order\'s invoice ⇒ 404 "Không tìm thấy hoá đơn."',
      async (_name, call) => {
        pdfs.push({
          id: 'pdf-b',
          invoiceId: INVOICE_B,
          pdfKey: `invoices/${ORDER_B}/${INVOICE_B}.pdf`,
          pdfSize: PDF.length,
          fileName: 'hoa-don-HD-2026-0732',
          createdByAccountId: OTHER,
          createdAt: new Date(),
        });
        await storage.putObject(
          `invoices/${ORDER_B}/${INVOICE_B}.pdf`,
          PDF,
          'application/pdf',
        );

        const res = await call();

        expect(res.status).toBe(404);
        expect(res.body.message).toBe(INVOICE_NOT_FOUND_MESSAGE);
        expect(renderPdf).not.toHaveBeenCalled();
        expect(pdfs).toHaveLength(1);
      },
    );
  });

  describe('permissions and scope', () => {
    const routes = [
      ['GET detail', () => detail()],
      ['POST export', () => exportPdf()],
      [
        'GET pdf',
        () =>
          request(server())
            .get(`/orders/${ORDER_A}/invoices/${INVOICE_A}/pdf`)
            .set('Authorization', auth()),
      ],
    ] as const;

    it.each(routes)('%s without invoices.manage ⇒ 403', async (_name, call) => {
      givenPermissions(PERM.ordersViewAll, PERM.contractsGenerate);

      const res = await call();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(invoiceRepo.findFirst).not.toHaveBeenCalled();
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it.each(routes)(
      '%s with invoices.manage but neither orders.view_all nor view_own ⇒ 403',
      async (_name, call) => {
        givenPermissions(PERM.invoicesManage);

        const res = await call();

        expect(res.status).toBe(403);
        expect(invoiceRepo.findFirst).not.toHaveBeenCalled();
      },
    );

    it.each(routes)(
      '%s for a view_own caller who is not owner/assignee ⇒ 404 like an unknown order, even with an exported PDF',
      async (_name, call) => {
        await exportPdf();
        givenPermissions(PERM.invoicesManage, PERM.ordersViewOwn);
        jest.clearAllMocks();

        const res = await call();
        const unknown = await detail(UNKNOWN_ID, INVOICE_A);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe(`Không tìm thấy đơn hàng: ${ORDER_A}`);
        expect(res.body.fileName).toBeUndefined();
        expect(unknown.status).toBe(404);
        expect(unknown.body.message).toBe(
          `Không tìm thấy đơn hàng: ${UNKNOWN_ID}`,
        );
        expect(invoiceRepo.findFirst).not.toHaveBeenCalled();
        expect(invoicePdfRepo.findUnique).not.toHaveBeenCalled();
        expect(queryRaw).not.toHaveBeenCalled();
      },
    );

    it('owner with view_own ⇒ all three routes allowed', async () => {
      orders[0].ownerAccountId = ACCOUNT_ID;
      givenPermissions(PERM.invoicesManage, PERM.ordersViewOwn);

      expect((await detail()).status).toBe(200);
      expect((await exportPdf()).status).toBe(200);
      expect((await download()).status).toBe(200);
    });

    it.each([
      ['GET detail id', `/orders/not-a-uuid/invoices/${INVOICE_A}`, 'get'],
      ['GET detail invoiceId', `/orders/${ORDER_A}/invoices/nope`, 'get'],
      ['POST export id', `/orders/nope/invoices/${INVOICE_A}/pdf`, 'post'],
      ['POST export invoiceId', `/orders/${ORDER_A}/invoices/nope/pdf`, 'post'],
      ['GET pdf id', `/orders/nope/invoices/${INVOICE_A}/pdf`, 'get'],
      ['GET pdf invoiceId', `/orders/${ORDER_A}/invoices/nope/pdf`, 'get'],
    ] as const)('%s not a UUID ⇒ 400', async (_name, path, method) => {
      const res = await request(server())
        [method](path)
        .set('Authorization', auth());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(invoiceRepo.findFirst).not.toHaveBeenCalled();
    });
  });

  it('the Story 7.4 overview route still answers next to the new routes', async () => {
    const res = await request(server())
      .get(`/orders/${ORDER_A}/invoices`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0].id).toBe(INVOICE_A);
  });
});
