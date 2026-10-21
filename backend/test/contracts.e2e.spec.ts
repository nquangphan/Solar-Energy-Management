import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ErrorCode } from '../src/common/errors/error-code';
import { CONTRACT_BLOCKED_MESSAGE } from '../src/contracts/domain/contract-eligibility';
import { quoteNumberOf } from '../src/orders/domain/quote-number';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { SETTING } from '../src/settings/domain/setting-registry';
import { StoragePort } from '../src/storage/storage.port';
import { fakeStorage, type FakeStorage } from './util/fake-storage';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time ⇒ set env BEFORE loading `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/orders/:id/contracts` (hermetic — `PrismaService` overridden, renderer stubbed, storage
 * faked in memory; real JWT, guards, `ParseUUIDPipe`, exception filter and AuditSubscriber).
 * HTTP codes are measured HERE, through the real pipe and filter, not in the unit lane.
 */
describe('/orders/:id/contracts (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let storage: FakeStorage;

  const ACCOUNT_ID = 'acc-contracts-e2e';
  const OTHER = 'acc-other-sale';
  const ORDER_ID = '88888888-8888-4888-8888-888888888888';
  const OTHER_ORDER_ID = '99999999-9999-4999-8999-999999999999';
  const UNKNOWN_ID = '77777777-7777-4777-8777-777777777777';
  const VERSION_ID = 'ver-ct-1';
  const REVISED_VERSION_ID = 'ver-ct-2';
  const VERSION_NO: Record<string, number> = {
    [VERSION_ID]: 1,
    [REVISED_VERSION_ID]: 2,
  };
  const PDF = Buffer.from('%PDF-1.4 test');
  const TOTAL = 83_010_960;
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
      custType: 'CA_NHAN',
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
      warrantyMonths: 120,
      displayOrder: 0,
    },
  ];

  type ContractRow = {
    id: string;
    seq: number;
    orderId: string;
    orderVersionId: string;
    type: string;
    contractNo: string;
    pdfKey: string;
    pdfSize: number;
    fileName: string;
    createdByAccountId: string;
    createdAt: Date;
  };

  let orders: ReturnType<typeof order>[];
  let lines: typeof LINES;
  let installments:
    { seq: number; percent: number | null; amount: number }[] | null;
  let contracts: ContractRow[];
  let settingRows: { key: string; value: string }[];
  let nextSeq: number;

  const renderPdf = jest.fn();
  const auditRepo = { create: jest.fn() };
  const contractRepo = {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  };
  const queryRaw = jest.fn();
  const repos = {
    order: { findFirst: jest.fn(), findUnique: jest.fn() },
    orderVersion: {
      findUnique: jest.fn((args: { where: { id: string } }) =>
        Promise.resolve({
          id: args.where.id,
          versionNo: VERSION_NO[args.where.id],
          vatRate: 8,
          vatMode: 'co_vat',
          discountAmount: null,
        }),
      ),
    },
    orderLineItem: { findMany: jest.fn(() => Promise.resolve(lines)) },
    discountApproval: { findFirst: jest.fn(() => Promise.resolve(null)) },
    product: { findMany: jest.fn(() => Promise.resolve([])) },
    customer: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          sdt: '+84912345678',
          name: 'Nguyễn Văn Khách',
          address: '12 Lê Lợi',
          cccd: null,
          taxCode: null,
          bankAccount: null,
        }),
      ),
    },
    paymentSchedule: {
      findUnique: jest.fn(() =>
        Promise.resolve(
          installments === null
            ? null
            : {
                id: 'sched-1',
                orderId: ORDER_ID,
                installments: installments.map((i) => ({
                  ...i,
                  id: `inst-${i.seq}`,
                  conditionNote: `Đợt ${i.seq}`,
                  milestone: null,
                  payments: [],
                })),
              },
        ),
      ),
    },
    payment: { count: jest.fn(() => Promise.resolve(0)) },
    contract: contractRepo,
    quoteExport: { upsert: jest.fn(() => Promise.resolve({})) },
    auditLog: auditRepo,
    featureFlag: { findUnique: jest.fn(() => Promise.resolve(null)) },
    systemSetting: {
      findUnique: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve(settingRows)),
      upsert: jest.fn(
        ({ create }: { create: { key: string; value: string } }) => {
          settingRows = [
            ...settingRows.filter((r) => r.key !== create.key),
            create,
          ];
          return Promise.resolve(create);
        },
      ),
    },
    $queryRaw: queryRaw,
  };
  const prismaMock = {
    ...repos,
    // Interactive form (contract generation) runs its callback on the same repos; array form
    // (settings upsert) resolves the batch.
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
      .get(`/orders/${id}/contracts`)
      .set('Authorization', auth());
  const generate = (id = ORDER_ID) =>
    request(server())
      .post(`/orders/${id}/contracts`)
      .set('Authorization', auth())
      .send({});
  const download = (contractId: string, id = ORDER_ID) =>
    request(server())
      .get(`/orders/${id}/contracts/${contractId}/pdf`)
      .set('Authorization', auth())
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  const contractAudits = () =>
    auditRepo.create.mock.calls.filter(
      ([a]) =>
        (a as { data: { eventType: string } }).data.eventType ===
        'ContractGenerated',
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
      .useValue({
        render: jest.fn(() => Promise.resolve({ pdf: PDF, image: PDF })),
        renderPdf,
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
    storage.objects.clear();
    orders = [order(ORDER_ID, 'dachot'), order(OTHER_ORDER_ID, 'dachot')];
    lines = LINES;
    installments = [
      { seq: 1, percent: 20, amount: 16_602_192 },
      { seq: 2, percent: 70, amount: 58_107_672 },
      { seq: 3, percent: 10, amount: 8_301_096 },
    ];
    contracts = [];
    settingRows = [];
    nextSeq = 100;
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
    // The order row lock returns the id; `nextval` hands out the next number.
    queryRaw.mockImplementation((sql: TemplateStringsArray) =>
      Promise.resolve(
        sql.join('?').includes('FOR UPDATE')
          ? [{ id: ORDER_ID }]
          : [{ seq: BigInt(nextSeq++) }],
      ),
    );
    renderPdf.mockResolvedValue(PDF);
    contractRepo.create.mockImplementation((args: { data: ContractRow }) => {
      contracts.push(args.data);
      return Promise.resolve(args.data);
    });
    contractRepo.findMany.mockImplementation(
      (args: { where: { orderId: string } }) =>
        Promise.resolve(
          contracts
            .filter((c) => c.orderId === args.where.orderId)
            .sort((a, b) => b.seq - a.seq)
            .map((c) => ({
              ...c,
              orderVersion: { versionNo: VERSION_NO[c.orderVersionId] },
            })),
        ),
    );
    contractRepo.findFirst.mockImplementation(
      (args: { where: { id: string; orderId?: string } }) =>
        Promise.resolve(
          contracts.find(
            (c) =>
              c.id === args.where.id &&
              (args.where.orderId === undefined ||
                c.orderId === args.where.orderId),
          ) ?? null,
        ),
    );
    auditRepo.create.mockResolvedValue({});
    givenPermissions(PERM.contractsGenerate, PERM.ordersViewAll);
  });

  it('no token ⇒ 401', async () => {
    const res = await request(server()).get(`/orders/${ORDER_ID}/contracts`);
    expect(res.status).toBe(401);
  });

  describe('GET overview', () => {
    it('200: server-built dynamic fields, generatable, empty list; nothing configured ⇒ 7 missing', async () => {
      const res = await overview();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        contractType: 'construction',
        generatable: true,
        blockedReason: null,
        quoteNo: quoteNumberOf(ORDER_ID),
        versionNo: 1,
        customerName: 'Nguyễn Văn Khách',
        lineCount: 1,
        orderTotal: TOTAL,
        scheduleLabel: '20/70/10',
        missingPartyFields: [
          'Tên công ty',
          'Mã số thuế',
          'Địa chỉ',
          'Người đại diện',
          'Chức danh',
          'Điện thoại',
          'Tài khoản ngân hàng',
        ],
        contracts: [],
      });
    });

    it('equipment-only order ⇒ contractType sale before any generation', async () => {
      orders[0].scopeThiCong = false;

      const res = await overview();

      expect(res.body.contractType).toBe('sale');
    });
  });

  describe('POST generate', () => {
    it('201 construction, bytes in storage under the contract key, one row, one audit row', async () => {
      const res = await generate();

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        contractNo: expect.stringMatching(/^HĐTC-100\/\d{4}$/),
        contractType: 'construction',
        versionNo: 1,
        fileName: 'hop-dong-thi-cong-100',
        pdfSize: PDF.length,
        createdAt: expect.any(String),
      });
      const key = `contracts/${ORDER_ID}/${res.body.id}.pdf`;
      expect([...storage.objects.keys()]).toEqual([key]);
      expect(storage.objects.get(key)).toEqual({
        body: PDF,
        contentType: 'application/pdf',
      });
      expect(contracts).toHaveLength(1);
      expect(contracts[0]).toMatchObject({
        orderId: ORDER_ID,
        orderVersionId: VERSION_ID,
        type: 'construction',
        pdfKey: key,
        pdfSize: PDF.length,
        createdByAccountId: ACCOUNT_ID,
      });
      expect(contractAudits()).toHaveLength(1);
      expect(contractAudits()[0][0]).toMatchObject({
        data: {
          eventType: 'ContractGenerated',
          targetType: 'Order',
          targetId: ORDER_ID,
          actorAccountId: ACCOUNT_ID,
        },
      });
      const html = renderPdf.mock.calls[0][0] as string;
      expect(html).toContain('HỢP ĐỒNG THI CÔNG');
      expect(html).not.toContain('HỢP ĐỒNG MUA BÁN');
    });

    it('201 sale for an equipment-only order', async () => {
      orders[0].scopeThiCong = false;

      const res = await generate();

      expect(res.status).toBe(201);
      expect(res.body.contractType).toBe('sale');
      expect(res.body.contractNo).toMatch(/^HĐMB-\d+\/\d{4}$/);
      expect(res.body.fileName).toBe('hop-dong-mua-ban-100');
      const html = renderPdf.mock.calls[0][0] as string;
      expect(html).toContain('HỢP ĐỒNG MUA BÁN');
      expect(html).not.toContain('HỢP ĐỒNG THI CÔNG');
    });

    it('company not configured ⇒ still 201, every company cell "Chưa cấu hình"; after PUT name + tax code ⇒ printed, 5 left', async () => {
      const first = await generate();
      expect(first.status).toBe(201);
      expect(
        (renderPdf.mock.calls[0][0] as string).split('Chưa cấu hình').length -
          1,
      ).toBeGreaterThanOrEqual(7);

      givenPermissions(
        PERM.contractsGenerate,
        PERM.ordersViewAll,
        PERM.settingsManage,
      );
      const put = await request(server())
        .put('/settings/company-legal-entity')
        .set('Authorization', auth())
        .send({
          legalName: 'CÔNG TY TNHH E2E',
          taxCode: '1234567890',
          address: '',
          representative: '',
          representativeTitle: '',
          phone: '',
          bankAccount: '',
        });
      expect(put.status).toBe(200);
      expect(settingRows.map((r) => r.key).sort()).toEqual(
        [SETTING.companyLegalName, SETTING.companyTaxCode].sort(),
      );

      const second = await generate();
      expect(second.status).toBe(201);
      const html = renderPdf.mock.calls[1][0] as string;
      expect(html).toContain('CÔNG TY TNHH E2E');
      expect(html).toContain('1234567890');
      expect((await overview()).body.missingPartyFields).toEqual([
        'Địa chỉ',
        'Người đại diện',
        'Chức danh',
        'Điện thoại',
        'Tài khoản ngân hàng',
      ]);
    });

    it('twice ⇒ 2 rows, 2 numbers, 2 keys; overview lists newest first; first still downloads', async () => {
      const a = await generate();
      const b = await generate();

      expect(a.body.contractNo).not.toBe(b.body.contractNo);
      expect(storage.objects.size).toBe(2);
      const list = await overview();
      expect(list.body.contracts.map((c: { id: string }) => c.id)).toEqual([
        b.body.id,
        a.body.id,
      ]);
      const pdf = await download(a.body.id as string);
      expect(pdf.status).toBe(200);
      expect(pdf.body).toEqual(PDF);
    });

    it.each([
      ['baogia', 409, CONTRACT_BLOCKED_MESSAGE.status],
      ['choduyet', 409, CONTRACT_BLOCKED_MESSAGE.status],
      ['huy', 409, CONTRACT_BLOCKED_MESSAGE.status],
    ])(
      'order %s ⇒ %i, nothing rendered or written; overview says the same',
      async (status, code, message) => {
        orders[0].status = status;

        const res = await generate();

        expect(res.status).toBe(code);
        expect(res.body.code).toBe(ErrorCode.CONFLICT);
        expect(res.body.message).toBe(message);
        expect(renderPdf).not.toHaveBeenCalled();
        expect(storage.objects.size).toBe(0);
        expect(contracts).toHaveLength(0);
        expect(contractAudits()).toHaveLength(0);
        const o = await overview();
        expect(o.body.generatable).toBe(false);
        expect(o.body.blockedReason).toBe(message);
      },
    );

    it('confirmed order without lines ⇒ 400 VALIDATION_ERROR', async () => {
      lines = [];

      const res = await generate();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.message).toBe(CONTRACT_BLOCKED_MESSAGE.noLines);
      expect(contracts).toHaveLength(0);
    });

    it('no schedule ⇒ 409 noSchedule; schedule off total ⇒ 409 mismatch', async () => {
      installments = null;
      const none = await generate();
      expect(none.status).toBe(409);
      expect(none.body.message).toBe(CONTRACT_BLOCKED_MESSAGE.noSchedule);
      expect((await overview()).body.scheduleLabel).toBeNull();

      installments = [{ seq: 1, percent: null, amount: TOTAL - 1 }];
      const off = await generate();
      expect(off.status).toBe(409);
      expect(off.body.message).toBe(CONTRACT_BLOCKED_MESSAGE.scheduleMismatch);
      expect((await overview()).body.scheduleLabel).toBe('1 đợt');
      expect(contracts).toHaveLength(0);
    });

    it('hoanthanh ⇒ 201 (reprint allowed)', async () => {
      orders[0].status = 'hoanthanh';

      expect((await generate()).status).toBe(201);
    });

    it.each(['dacoc', 'thicong', 'nghiemthu', 'danggiao', 'dagiao'])(
      'confirmed order already moved on (%s) ⇒ 201, overview generatable',
      async (status) => {
        orders[0].status = status;

        expect((await generate()).status).toBe(201);
        expect((await overview()).body.generatable).toBe(true);
      },
    );

    it.each([
      [
        'no lines',
        () => {
          lines = [];
        },
        CONTRACT_BLOCKED_MESSAGE.noLines,
      ],
      [
        'no schedule',
        () => {
          installments = null;
        },
        CONTRACT_BLOCKED_MESSAGE.noSchedule,
      ],
      [
        'schedule off total',
        () => {
          installments = [{ seq: 1, percent: null, amount: TOTAL - 1 }];
        },
        CONTRACT_BLOCKED_MESSAGE.scheduleMismatch,
      ],
    ])(
      '%s ⇒ nothing rendered, stored or audited; overview gives the same reason',
      async (_name, arrange, message) => {
        arrange();

        const res = await generate();

        expect(res.body.message).toBe(message);
        expect(renderPdf).not.toHaveBeenCalled();
        expect(storage.objects.size).toBe(0);
        expect(contractRepo.create).not.toHaveBeenCalled();
        expect(contractAudits()).toHaveLength(0);
        const o = await overview();
        expect(o.status).toBe(200);
        expect(o.body.generatable).toBe(false);
        expect(o.body.blockedReason).toBe(message);
      },
    );

    it('the audit row carries the response timestamp, number and file name', async () => {
      const res = await generate();

      expect(contractAudits()).toHaveLength(1);
      const audit = contractAudits()[0][0] as {
        data: { occurredAt: Date; after: Record<string, unknown> };
      };
      expect(audit.data.occurredAt.toISOString()).toBe(res.body.createdAt);
      expect(audit.data.after).toMatchObject({
        contractId: res.body.id,
        contractNo: res.body.contractNo,
        contractType: 'construction',
        orderVersionId: VERSION_ID,
        fileName: res.body.fileName,
      });
      expect(contracts[0]).toMatchObject({
        id: res.body.id,
        contractNo: res.body.contractNo,
        fileName: res.body.fileName,
      });
    });

    it('order revised after the first contract ⇒ the new one prints the new version, the old keeps its own', async () => {
      const first = await generate();
      orders[0].currentVersionId = REVISED_VERSION_ID;

      const second = await generate();

      expect(first.body.versionNo).toBe(1);
      expect(second.body.versionNo).toBe(2);
      expect(contracts.map((c) => c.orderVersionId)).toEqual([
        VERSION_ID,
        REVISED_VERSION_ID,
      ]);
      const o = await overview();
      expect(o.body.versionNo).toBe(2);
      expect(
        o.body.contracts.map((c: { id: string; versionNo: number }) => [
          c.id,
          c.versionNo,
        ]),
      ).toEqual([
        [second.body.id, 2],
        [first.body.id, 1],
      ]);
    });
  });

  describe('GET pdf', () => {
    it('200 bytes, application/pdf, attachment filename hop-dong-….pdf', async () => {
      const created = await generate();

      const res = await download(created.body.id as string);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="hop-dong-thi-cong-100.pdf"',
      );
      expect(res.body).toEqual(PDF);
    });

    it('contract of ANOTHER order (in scope) ⇒ 404 "Không tìm thấy hợp đồng.", R2 not read', async () => {
      const created = await generate(OTHER_ORDER_ID);
      const getObject = jest.spyOn(storage, 'getObject');

      const res = await download(created.body.id as string, ORDER_ID);

      expect(res.status).toBe(404);
      expect(
        (JSON.parse(String(res.body)) as { message: string }).message,
      ).toBe('Không tìm thấy hợp đồng.');
      expect(getObject).not.toHaveBeenCalled();
      getObject.mockRestore();
    });
  });

  describe('permissions and scope', () => {
    const routes = [
      ['GET overview', () => overview()],
      ['POST generate', () => generate()],
      ['GET pdf', () => download('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')],
    ] as const;

    it.each(routes)(
      '%s without contracts.generate ⇒ 403',
      async (_name, call) => {
        givenPermissions(PERM.ordersViewAll, PERM.paymentsRecord);

        const res = await call();

        expect(res.status).toBe(403);
        expect(renderPdf).not.toHaveBeenCalled();
      },
    );

    it.each(routes)(
      '%s for a view_own caller who is not owner/assignee ⇒ 404 like an unknown order',
      async (_name, call) => {
        const created = await generate();
        givenPermissions(PERM.contractsGenerate, PERM.ordersViewOwn);
        jest.clearAllMocks();
        const getObject = jest.spyOn(storage, 'getObject');

        const res =
          _name === 'GET pdf'
            ? await download(created.body.id as string)
            : await call();
        const unknown = await request(server())
          .get(`/orders/${UNKNOWN_ID}/contracts`)
          .set('Authorization', auth());

        expect(res.status).toBe(404);
        const body =
          res.body instanceof Buffer
            ? JSON.parse(res.body.toString())
            : res.body;
        expect(body.message).toBe(`Không tìm thấy đơn hàng: ${ORDER_ID}`);
        expect(unknown.status).toBe(404);
        expect(unknown.body.message).toBe(
          `Không tìm thấy đơn hàng: ${UNKNOWN_ID}`,
        );
        expect(renderPdf).not.toHaveBeenCalled();
        expect(getObject).not.toHaveBeenCalled();
        getObject.mockRestore();
      },
    );

    it.each(routes)(
      '%s with contracts.generate but neither orders.view_all nor view_own ⇒ 403',
      async (_name, call) => {
        givenPermissions(PERM.contractsGenerate);

        const res = await call();

        expect(res.status).toBe(403);
        expect(renderPdf).not.toHaveBeenCalled();
        expect(contractRepo.findFirst).not.toHaveBeenCalled();
      },
    );

    it('owner with view_own ⇒ allowed', async () => {
      orders[0].ownerAccountId = ACCOUNT_ID;
      givenPermissions(PERM.contractsGenerate, PERM.ordersViewOwn);

      expect((await generate()).status).toBe(201);
    });

    it('assignee with view_own ⇒ overview, generate and download all allowed', async () => {
      orders[0].assigneeAccountId = ACCOUNT_ID;
      givenPermissions(PERM.contractsGenerate, PERM.ordersViewOwn);

      expect((await overview()).status).toBe(200);
      const created = await generate();
      expect(created.status).toBe(201);
      const pdf = await download(created.body.id as string);
      expect(pdf.status).toBe(200);
      expect(pdf.body).toEqual(PDF);
    });

    it.each([
      [
        'GET overview',
        () => request(server()).get('/orders/not-a-uuid/contracts'),
      ],
      [
        'POST generate',
        () => request(server()).post('/orders/not-a-uuid/contracts'),
      ],
      [
        'GET pdf (order id)',
        () =>
          request(server()).get(
            '/orders/not-a-uuid/contracts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pdf',
          ),
      ],
      [
        'GET pdf (contract id)',
        () =>
          request(server()).get(`/orders/${ORDER_ID}/contracts/not-a-uuid/pdf`),
      ],
    ])('%s with a non-UUID id ⇒ 400', async (_name, call) => {
      const res = await call().set('Authorization', auth());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('existing order routes still work beside the new controller', () => {
    it('POST /orders/:id/export-quote ⇒ 200', async () => {
      givenPermissions(PERM.quotesCreateEdit, PERM.ordersViewAll);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/export-quote`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
    });

    it('GET /orders/:id/payment-schedule ⇒ 200', async () => {
      const res = await request(server())
        .get(`/orders/${ORDER_ID}/payment-schedule`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.orderTotal).toBe(TOTAL);
    });

    it('POST /orders/:id/payments is still routed (403 without payments.record, not 404)', async () => {
      const res = await request(server())
        .post(`/orders/${ORDER_ID}/payments`)
        .set('Authorization', auth())
        .send({});

      expect(res.status).toBe(403);
    });
  });
});
