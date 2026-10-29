import type { Server } from 'node:http';
import { Logger, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { REQUIRE_ANY_PERMISSION_KEY } from '../src/auth/require-any-permission.decorator';
import { REQUIRE_PERMISSIONS_KEY } from '../src/auth/require-permissions.decorator';
import {
  ALLOWED_TRANSITIONS,
  MANUAL_TRANSITION_PERMISSIONS,
  SU_KIEN,
  type TransitionEvent,
} from '../src/orders/domain/allowed-transition';
import { OrdersController } from '../src/orders/orders.controller';
import {
  KICH_THUOC_TOI_DA_BYTE,
  SO_ANH_TOI_DA,
} from '../src/orders/domain/attachment-limits';
import {
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_DA_CHOT,
} from '../src/orders/domain/order-status';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';
import { initAppOnLoopback } from './util/listen-loopback';

/**
 * GOTCHA (2.3/2.5): `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc **import module** ⇒ phải
 * set env TRƯỚC khi `AppModule` được nạp. Vì vậy KHÔNG static-import `AppModule` (import bị
 * hoist); set env ở top-level rồi `await import()` động trong `beforeAll`.
 */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/orders` (hermetic — override `PrismaService`, ký JWT thật). Phủ những bất biến sống ở
 * tầng HTTP/guard/pipe mà unit test KHÔNG chạm tới:
 *
 *  - Guard toàn cục thật sự chạy: thiếu `quotes.create_edit` ⇒ 403 trên MỌI route.
 *  - `ValidationPipe` thật: dòng tự do thiếu name/unit/unitPrice ⇒ 400 kèm fieldErrors;
 *    name toàn whitespace bị TRIM rồi chặn (TD-21).
 *  - Envelope lỗi chuẩn AD-5 (`code`/`message`/`traceId`) cho 404/409.
 *  - Event đi qua `EventBus` tới `AuditSubscriber` THẬT và ghi `AuditLog`.
 *
 * Mock Prisma đủ MỌI model đường request chạm (order/orderVersion/orderLineItem/product/
 * customer/auditLog/featureFlag) — thiếu model nào là 500 cả suite.
 */
describe('/orders (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'sale@example.com',
    displayName: 'Nhân viên sale',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const SDT_E164 = '+84912345678';

  // Key set of `OrderResponseDto`. There is no serializer, so a handler that returns the service
  // row instead of mapping it would leak column names (`customerSdt`, `scopeThiCong`…). Checked
  // as "no key outside the contract": mocked rows omit some nullable columns (JSON drops undefined).
  const ORDER_RESPONSE_KEYS = [
    'assigneeAccountId',
    'cancelReason',
    'cancelledAt',
    'createdAt',
    'currentVersionId',
    'custType',
    'customerPhone',
    'discount',
    'id',
    'kWp',
    'lineItems',
    'ownerAccountId',
    'scopeConstruction',
    'scopeDelivery',
    'scopeEquipment',
    'sourceId',
    'status',
    'updatedAt',
    'validityNote',
    'vatMode',
  ];
  const expectOrderResponseKeys = (body: object): void => {
    expect(ORDER_RESPONSE_KEYS).toEqual(
      expect.arrayContaining(Object.keys(body)),
    );
  };
  const NGUON_FACEBOOK_ID = '5f4d3c2b-1a09-4e8d-9c7b-6a5f4e3d2c1b';
  const KHACH = {
    sdt: SDT_E164,
    custType: 'CA_NHAN',
    name: 'Nguyễn Văn A',
    cccd: null,
    taxCode: null,
    address: null,
    bankAccount: null,
    sourceId: NGUON_FACEBOOK_ID,
    sourceNote: null,
    createdAt: new Date('2026-07-16T00:00:00Z'),
    updatedAt: new Date('2026-07-16T00:00:00Z'),
  };

  const ORDER_ID = 'ord-e2e-1';
  const VERSION_ID = 'ver-e2e-1';
  const DON_BAOGIA = {
    id: ORDER_ID,
    status: 'baogia',
    customerSdt: SDT_E164,
    currentVersionId: VERSION_ID,
    ownerAccountId: ACCOUNT_ID,
    assigneeAccountId: null,
    sourceId: NGUON_FACEBOOK_ID,
    custType: 'CA_NHAN',
    scopeThietBi: true,
    scopeThiCong: false,
    scopeVanChuyen: false,
    kWp: null,
    vatMode: null,
    validityNote: null,
    createdAt: new Date('2026-07-16T01:00:00Z'),
    updatedAt: new Date('2026-07-16T01:00:00Z'),
  };

  const PIN_580W = {
    id: 'prod-pin',
    name: 'Tấm pin JA Solar 580W',
    unit: 'tấm',
    price: 2_450_000,
    priceEditable: false,
    warrantyMonths: 144,
    prices: [],
  };

  const DONG_CATALOG = {
    id: 'line-1',
    orderVersionId: VERSION_ID,
    productId: PIN_580W.id,
    name: PIN_580W.name,
    unit: PIN_580W.unit,
    qty: 8,
    unitPrice: 2_450_000,
    priceEditable: false,
    isFlexible: false,
    note: null,
    warrantyMonths: 144,
    unitPriceSnapshot: null,
    catalogPriceSnapshot: null,
    costPriceSnapshot: null,
    warrantyStartAt: null,
    displayOrder: 0,
    createdAt: new Date('2026-07-16T02:00:00Z'),
    updatedAt: new Date('2026-07-16T02:00:00Z'),
  };

  const orderRepo = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const orderVersionRepo = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };
  const lineRepo = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const productRepo = { findUnique: jest.fn(), findMany: jest.fn() };
  const customerRepo = { findUnique: jest.fn() };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule`.
  const auditRepo = { create: jest.fn().mockResolvedValue({}) };
  // Cờ giá phân tầng: vắng dòng = TẮT (fail-closed).
  const featureFlagRepo = { findUnique: jest.fn().mockResolvedValue(null) };
  // Config hệ thống: vắng row = default 8% (preview-total resolve rate qua SettingsService).
  const systemSettingRepo = { findUnique: jest.fn().mockResolvedValue(null) };
  // Hồ sơ duyệt chiết khấu (4.7): findFirst = approval mới nhất cho view; findMany = list chờ duyệt.
  const discountApprovalRepo = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  };
  // Hồ sơ xuất báo giá (4.8): upsert mô phỏng ĐÚNG ngữ nghĩa unique orderId — MỘT slot,
  // lần 2 đi nhánh update; findUnique đọc lại slot đó (2 route proxy + xuất lần n).
  let quoteExportRow: Record<string, unknown> | null = null;
  const quoteExportRepo = { findUnique: jest.fn(), upsert: jest.fn() };
  // Ảnh đính kèm bước chuyển trạng thái (5.5): `createMany` chạy TRONG tx cùng
  // `applyTransition`; `findFirst` là đường đọc của proxy bytes.
  const attachmentRepo = {
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  };
  // Order-bound stock issue ("Đã giao" step): the order stock-out + stock + reservation ledger —
  // run INSIDE the transition tx. Default: order not issued yet, empty ledger.
  const stockVoucherRepo = { findUnique: jest.fn(), create: jest.fn() };
  const stockItemRepo = { upsert: jest.fn(), findMany: jest.fn() };
  const stockMovementRepo = {
    aggregate: jest.fn(),
    create: jest.fn(),
    groupBy: jest.fn(),
    findUnique: jest.fn(),
  };
  // Storage in-memory + renderer stub (override provider) — e2e KHÔNG đụng Chromium/R2.
  const storageMap = new Map<string, { body: Buffer; contentType: string }>();
  // `deleteObject` là jest.fn để lane này đo được HAI thứ mà stub im lặng che mất:
  // nó CÓ được gọi thật, và lỗi của nó bị nuốt sau khi DB đã commit.
  const deleteObjectStub = jest.fn(async (key: string) => {
    storageMap.delete(key);
  });
  const storageStub = {
    putObject: async (key: string, body: Buffer, contentType: string) => {
      storageMap.set(key, { body, contentType });
    },
    deleteObject: deleteObjectStub,
    getObject: async (key: string) => {
      const found = storageMap.get(key);
      if (found === undefined) {
        throw new AppException(
          ErrorCode.NOT_FOUND,
          404,
          'Không tìm thấy file.',
        );
      }
      return found;
    },
  };
  const PDF_STUB = Buffer.from('%PDF-1.4 stub');
  const PNG_STUB = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('png-stub'),
  ]);
  const rendererStub = {
    render: jest.fn(async () => ({ pdf: PDF_STUB, image: PNG_STUB })),
  };
  // `tx` bên trong interactive `$transaction` dùng CHÍNH bộ repo mock ở trên (cùng object,
  // khác tên) — đúng sự thật của Prisma, và giữ cho assertion trên repo thường vẫn đúng khi
  // lệnh ghi nằm trong tx. `$queryRaw` là khoá dòng đơn.
  const queryRaw = jest.fn(async () => [{ id: ORDER_ID }]);
  const txOrderRepo = orderRepo;
  const txVersionRepo = orderVersionRepo;
  const txLineRepo = lineRepo;
  const txDiscountRepo = discountApprovalRepo;
  const txMock = {
    order: txOrderRepo,
    orderVersion: txVersionRepo,
    orderLineItem: txLineRepo,
    discountApproval: txDiscountRepo,
    // `confirm` resolve giá danh mục BÊN TRONG tx (đọc dòng sau khoá ⇒ tra product cũng ở đó).
    product: productRepo,
    // Ảnh ghi cùng tx với transition — một `$transaction`, không hai lượt ghi.
    attachment: attachmentRepo,
    stockVoucher: stockVoucherRepo,
    stockItem: stockItemRepo,
    stockMovement: stockMovementRepo,
    $queryRaw: queryRaw,
  };
  const transaction = jest.fn(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => Promise<unknown>)(txMock)
      : Promise.all(arg as Promise<unknown>[]),
  );
  const prismaMock = {
    order: orderRepo,
    orderVersion: orderVersionRepo,
    orderLineItem: lineRepo,
    product: productRepo,
    customer: customerRepo,
    auditLog: auditRepo,
    featureFlag: featureFlagRepo,
    systemSetting: systemSettingRepo,
    discountApproval: discountApprovalRepo,
    quoteExport: quoteExportRepo,
    attachment: attachmentRepo,
    stockVoucher: stockVoucherRepo,
    $transaction: transaction,
    $queryRaw: queryRaw,
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  function givenPermissions(...keys: string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  function token(): string {
    return jwt.sign({ sub: ACCOUNT_ID, email: account.email });
  }

  function server(): Server {
    return app.getHttpServer() as Server;
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
      .useValue(storageStub)
      .overrideProvider(QuoteRendererPort)
      .useValue(rendererStub)
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
    customerRepo.findUnique.mockResolvedValue(KHACH);
    orderRepo.findUnique.mockResolvedValue(DON_BAOGIA);
    // Đường đọc scoped (`findScopedOrThrow`) dùng `findFirst` với `where.AND`. Fake này ĐỌC
    // LẠI qua `findUnique` để mọi test stateful (đơn đổi status trong bài) vẫn thấy đúng một
    // sự thật, rồi áp CHÍNH mệnh đề phạm vi mà service gửi xuống — nếu service quên gửi, ca
    // "đơn người khác ⇒ 404" sẽ xanh giả.
    orderRepo.findFirst.mockImplementation(
      async (args: {
        where?: { AND?: Array<Record<string, unknown>> };
      }): Promise<unknown> => {
        const don = (await orderRepo.findUnique({
          where: { id: ORDER_ID },
        })) as {
          ownerAccountId?: string | null;
          assigneeAccountId?: string | null;
        } | null;
        if (don === null) return null;
        const menhDe = args.where?.AND ?? [];
        for (const dieu of menhDe) {
          const or = dieu.OR as
            Array<Record<string, string | null>> | undefined;
          if (or === undefined) continue;
          const khop = or.some(
            (nhanh) =>
              (nhanh.ownerAccountId !== undefined &&
                nhanh.ownerAccountId === don.ownerAccountId) ||
              (nhanh.assigneeAccountId !== undefined &&
                nhanh.assigneeAccountId === don.assigneeAccountId),
          );
          if (!khop) return null;
        }
        return don;
      },
    );
    orderRepo.create.mockResolvedValue({
      ...DON_BAOGIA,
      currentVersionId: null,
    });
    orderRepo.update.mockResolvedValue(DON_BAOGIA);
    orderRepo.findMany.mockResolvedValue([]);
    orderRepo.count.mockResolvedValue(0);
    orderVersionRepo.create.mockResolvedValue({ id: VERSION_ID });
    // Giỏ rỗng mặc định ⇒ displayOrder dòng mới bắt đầu từ 0 (max + 1).
    lineRepo.findFirst.mockResolvedValue(null);
    lineRepo.create.mockResolvedValue(DONG_CATALOG);
    lineRepo.update.mockResolvedValue(DONG_CATALOG);
    lineRepo.delete.mockResolvedValue(DONG_CATALOG);
    lineRepo.findUnique.mockResolvedValue(DONG_CATALOG);
    lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
    productRepo.findUnique.mockResolvedValue(PIN_580W);
    productRepo.findMany.mockResolvedValue([PIN_580W]);
    stockVoucherRepo.findUnique.mockResolvedValue(null);
    stockVoucherRepo.create.mockImplementation(
      (args: {
        data: {
          orderId: string;
          createdByAccountId: string;
          lines: {
            create: { productId: string; qty: number; unitCost: number }[];
          };
        };
      }) =>
        Promise.resolve({
          id: 'stock-out-1',
          seq: 96,
          type: 'xuat',
          note: null,
          orderId: args.data.orderId,
          createdAt: new Date('2026-10-21T04:00:00Z'),
          createdBy: { id: args.data.createdByAccountId, displayName: 'Kho' },
          lines: args.data.lines.create.map((l) => ({
            ...l,
            product: { name: PIN_580W.name, sku: 'PIN-580', unit: 'tấm' },
          })),
        }),
    );
    stockItemRepo.upsert.mockResolvedValue({ id: 'si-pin' });
    stockMovementRepo.aggregate.mockResolvedValue({ _sum: { qty: null } });
    // Confirm-time reservation: no older version holds stock, nothing reserved yet.
    stockMovementRepo.groupBy.mockResolvedValue([]);
    stockMovementRepo.findUnique.mockResolvedValue(null);
    stockItemRepo.findMany.mockResolvedValue([]);
    auditRepo.create.mockResolvedValue({});
    featureFlagRepo.findUnique.mockResolvedValue(null);
    systemSettingRepo.findUnique.mockResolvedValue(null);
    transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(txMock)
        : Promise.all(arg as Promise<unknown>[]),
    );
    // CHỈ khai default cho method chưa có default ở trên — `tx*` và repo thường là CÙNG
    // object, khai lại sẽ ghi đè mất giá trị trả về mà test khác đang dựa vào.
    txOrderRepo.updateMany.mockResolvedValue({ count: 1 });
    txVersionRepo.update.mockResolvedValue({});
    txLineRepo.createMany.mockResolvedValue({ count: 0 });
    queryRaw.mockResolvedValue([{ id: ORDER_ID }]);
    orderVersionRepo.findUnique.mockResolvedValue(null);
    orderVersionRepo.findMany.mockResolvedValue([]);
    // Mặc định: đơn chưa từng áp chiết khấu.
    discountApprovalRepo.findFirst.mockResolvedValue(null);
    discountApprovalRepo.findMany.mockResolvedValue([]);
    txDiscountRepo.create.mockResolvedValue({});
    txDiscountRepo.updateMany.mockResolvedValue({ count: 1 });
    // Ảnh đính kèm (5.5): mặc định đơn chưa có ảnh nào.
    attachmentRepo.createMany.mockResolvedValue({ count: 0 });
    attachmentRepo.findFirst.mockResolvedValue(null);
    // Hồ sơ xuất báo giá (4.8): slot reset mỗi test; upsert giữ ngữ nghĩa unique orderId.
    quoteExportRow = null;
    storageMap.clear();
    rendererStub.render.mockClear();
    rendererStub.render.mockImplementation(async () => ({
      pdf: PDF_STUB,
      image: PNG_STUB,
    }));
    quoteExportRepo.upsert.mockImplementation(
      async (args: {
        where: { orderId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        quoteExportRow =
          quoteExportRow === null
            ? { id: 'qe-1', ...args.create }
            : { ...quoteExportRow, ...args.update };
        return quoteExportRow;
      },
    );
    quoteExportRepo.findUnique.mockImplementation(
      async (args: { where: { orderId: string } }) =>
        quoteExportRow !== null && quoteExportRow.orderId === args.where.orderId
          ? quoteExportRow
          : null,
    );
  });

  describe('authn/authz fail-closed trên MỌI route', () => {
    const routes: readonly { name: string; call: () => request.Test }[] = [
      { name: 'POST /orders', call: () => request(server()).post('/orders') },
      {
        name: 'GET /orders/:id',
        call: () => request(server()).get(`/orders/${ORDER_ID}`),
      },
      {
        name: 'PATCH /orders/:id',
        call: () => request(server()).patch(`/orders/${ORDER_ID}`),
      },
      {
        name: 'POST /orders/:id/line-items',
        call: () => request(server()).post(`/orders/${ORDER_ID}/line-items`),
      },
      {
        name: 'PATCH /orders/:id/line-items/:lineId',
        call: () =>
          request(server()).patch(`/orders/${ORDER_ID}/line-items/line-1`),
      },
      {
        name: 'DELETE /orders/:id/line-items/:lineId',
        call: () =>
          request(server()).delete(`/orders/${ORDER_ID}/line-items/line-1`),
      },
      {
        name: 'POST /orders/preview-total',
        call: () => request(server()).post('/orders/preview-total'),
      },
      {
        name: 'POST /orders/:id/reopen',
        call: () => request(server()).post(`/orders/${ORDER_ID}/reopen`),
      },
      {
        name: 'POST /orders/:id/apply-discount',
        call: () =>
          request(server()).post(`/orders/${ORDER_ID}/apply-discount`),
      },
      {
        name: 'POST /orders/:id/resolve-discount',
        call: () =>
          request(server()).post(`/orders/${ORDER_ID}/resolve-discount`),
      },
      {
        name: 'GET /orders/pending-discount-approvals',
        call: () => request(server()).get('/orders/pending-discount-approvals'),
      },
      {
        name: 'POST /orders/:id/export-quote',
        call: () => request(server()).post(`/orders/${ORDER_ID}/export-quote`),
      },
      {
        name: 'GET /orders/:id/quote/image',
        call: () => request(server()).get(`/orders/${ORDER_ID}/quote/image`),
      },
      {
        name: 'GET /orders/:id/quote/pdf',
        call: () => request(server()).get(`/orders/${ORDER_ID}/quote/pdf`),
      },
      {
        name: 'POST /orders/:id/transition',
        call: () => request(server()).post(`/orders/${ORDER_ID}/transition`),
      },
      {
        name: 'POST /orders/:id/cancel',
        call: () => request(server()).post(`/orders/${ORDER_ID}/cancel`),
      },
      {
        name: 'GET /orders/:id/attachments/:attachmentId',
        call: () =>
          request(server()).get(`/orders/${ORDER_ID}/attachments/att-1`),
      },
      {
        name: 'GET /orders/:id/attachments',
        call: () => request(server()).get(`/orders/${ORDER_ID}/attachments`),
      },
      {
        name: 'POST /orders/:id/attachments',
        call: () => request(server()).post(`/orders/${ORDER_ID}/attachments`),
      },
      {
        name: 'DELETE /orders/:id/attachments/:attachmentId',
        call: () =>
          request(server()).delete(`/orders/${ORDER_ID}/attachments/att-1`),
      },
    ];

    for (const route of routes) {
      it(`${route.name} không token ⇒ 401`, async () => {
        const res = await route.call().send({});

        expect(res.status).toBe(401);
      });

      it(`${route.name} thiếu quyền cần thiết ⇒ 403`, async () => {
        // Có quyền KHÁC (kể cả catalog.view của THO_KS) nhưng không có key mà route đòi
        // (quotes.create_edit / discounts.apply / discounts.approve).
        givenPermissions(PERM.catalogView, PERM.customersManage);

        const res = await route
          .call()
          .set('Authorization', `Bearer ${token()}`)
          .send({});

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      });
    }
  });

  describe('old Vietnamese routes are gone (renamed with no alias) ⇒ 404 envelope', () => {
    function prismaCallCount(): number {
      return Object.values(prismaMock)
        .flatMap((repo) =>
          jest.isMockFunction(repo) ? [repo] : Object.values(repo),
        )
        .filter((fn) => jest.isMockFunction(fn))
        .reduce((n, fn) => n + fn.mock.calls.length, 0);
    }

    // Multi-segment old routes match no handler at all: Nest's own NotFoundException goes
    // through the global filter, guards never run, nothing reads the DB. A valid token is sent
    // so a 401 can never be mistaken for the 404 under test.
    it.each([
      ['post', 'anh'],
      ['get', 'anh'],
      ['get', 'anh/att-1'],
      ['delete', 'anh/att-1'],
      ['post', 'ap-chiet-khau'],
      ['post', 'duyet-chiet-khau'],
      ['get', 'bao-gia/anh'],
      ['get', 'bao-gia/pdf'],
      ['post', 'xuat-bao-gia'],
      ['post', 'chot'],
      ['post', 'chuyen-trang-thai'],
      ['post', 'huy'],
      ['post', 'mo-lai'],
      ['get', 'phien-ban'],
      ['get', 'vong-doi'],
    ] as const)(
      '%s /orders/:id/%s ⇒ 404 NOT_FOUND, no permission lookup and no DB call',
      async (method, suffix) => {
        givenPermissions(...Object.values(PERM));

        const res = await request(server())
          [method](`/orders/${ORDER_ID}/${suffix}`)
          .set('Authorization', `Bearer ${token()}`)
          .send({});

        expect(res.status).toBe(404);
        expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
        expect(typeof res.body.traceId).toBe('string');
        expect(accountPermissionsMock.listForAccount).not.toHaveBeenCalled();
        expect(prismaCallCount()).toBe(0);
      },
    );

    // The two old single-segment static routes now fall into `@Get(':id')` (id = the old
    // segment), so they need a token with read permission to reach the handler; the lookup
    // finds no such order ⇒ the standard "order not found" 404, not a routing error.
    it.each(['cho-duyet-chiet-khau', 'tra-cuu-bao-hanh?sdt=0903176968'])(
      'GET /orders/%s ⇒ 404 NOT_FOUND (swallowed by GET /orders/:id, no order with that id)',
      async (oldPath) => {
        givenPermissions(PERM.ordersViewAll, PERM.discountsApprove);
        orderRepo.findUnique.mockResolvedValue(null);

        const res = await request(server())
          .get(`/orders/${oldPath}`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(404);
        expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
        expect(typeof res.body.traceId).toBe('string');
        // The 404 comes from the scoped order lookup with the old segment as the id — no
        // alias handler answered first.
        expect(orderRepo.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              AND: expect.arrayContaining([{ id: oldPath.split('?')[0] }]),
            },
          }),
        );
      },
    );

    it('old query name ?sdt= on GET /orders/warranty-lookup ⇒ 400, fieldErrors point at `phone`', async () => {
      givenPermissions(PERM.ordersViewAll);

      const res = await request(server())
        .get('/orders/warranty-lookup?sdt=0903176968')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(
        (res.body.fieldErrors as { field: string }[]).map((e) => e.field),
      ).toContain('phone');
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });

    // No route matches, so the auth guard never runs: the old URL is gone even for an
    // anonymous caller, rather than hiding behind a 401.
    it('old multi-segment route without a token ⇒ still 404, not 401', async () => {
      const res = await request(server()).post(`/orders/${ORDER_ID}/chot`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('GET /orders/warranty-lookup?phone= — renamed query reaches the lookup', () => {
    it('raw phone ⇒ 200, the customer is looked up by its E.164 key', async () => {
      givenPermissions(PERM.ordersViewAll);
      customerRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get('/orders/warranty-lookup')
        .query({ phone: '0903176968' })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        found: false,
        phone: '+84903176968',
        customer: null,
        orders: [],
      });
      expect(customerRepo.findUnique).toHaveBeenCalledWith({
        where: { sdt: '+84903176968' },
      });
    });

    // The pipe accepts any non-empty string; the service's own phone check must report the
    // same input name the client sent, not the DB column name.
    it('unparseable phone ⇒ 400 isPhoneNumber on field `phone`, no DB read', async () => {
      givenPermissions(PERM.ordersViewAll);

      const res = await request(server())
        .get('/orders/warranty-lookup')
        .query({ phone: 'abc' })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors).toEqual([
        expect.objectContaining({ field: 'phone', code: 'isPhoneNumber' }),
      ]);
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('happy path 4 endpoint (giỏ hàng đầy đủ vòng đời)', () => {
    it('POST /orders ⇒ 201, lineItems rỗng, sourceId snapshot từ Customer', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ customerPhone: '0912 345 678' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('baogia');
      expect(res.body.sourceId).toBe(NGUON_FACEBOOK_ID);
      expect(res.body.ownerAccountId).toBe(ACCOUNT_ID);
      expect(res.body.lineItems).toEqual([]);
      expect(res.body.customerPhone).toBe(SDT_E164);
      expectOrderResponseKeys(res.body);
      // Event tới AuditSubscriber thật: OrderCreated được ghi.
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderCreated' }),
        }),
      );
    });

    it('GET /orders/:id ⇒ 200, dòng kèm amount server tính', async () => {
      givenPermissions(PERM.quotesCreateEdit, PERM.ordersViewOwn);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.lineItems).toHaveLength(1);
      expect(res.body.lineItems[0].amount).toBe(2_450_000 * 8);
      // Built by a map, not a cast of the Prisma row: contract names only on the wire.
      expect(res.body).toMatchObject({
        customerPhone: SDT_E164,
        scopeEquipment: true,
        scopeConstruction: false,
        scopeDelivery: false,
      });
      for (const old of [
        'customerSdt',
        'scopeThietBi',
        'scopeThiCong',
        'scopeVanChuyen',
      ]) {
        expect(res.body).not.toHaveProperty(old);
      }
      // Response KHÔNG có tổng đơn — Story 4.2.
      expect(res.body).not.toHaveProperty('subtotal');
      expect(res.body).not.toHaveProperty('total');
    });

    it('POST line-items (catalog) ⇒ 201 + audit; PATCH ⇒ 200; DELETE ⇒ 204 body rỗng', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const themDong = await request(server())
        .post(`/orders/${ORDER_ID}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productId: PIN_580W.id, qty: 8 });
      expect(themDong.status).toBe(201);
      expect(themDong.body.name).toBe(PIN_580W.name);
      expect(themDong.body.amount).toBe(2_450_000 * 8);
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderLineAdded' }),
        }),
      );

      lineRepo.update.mockResolvedValue({ ...DONG_CATALOG, qty: 12 });
      const suaDong = await request(server())
        .patch(`/orders/${ORDER_ID}/line-items/line-1`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ qty: 12 });
      expect(suaDong.status).toBe(200);
      expect(suaDong.body.qty).toBe(12);

      const xoaDong = await request(server())
        .delete(`/orders/${ORDER_ID}/line-items/line-1`)
        .set('Authorization', `Bearer ${token()}`);
      expect(xoaDong.status).toBe(204);
      expect(xoaDong.body).toEqual({});
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderLineRemoved' }),
        }),
      );
    });
  });

  describe('Story 4.9 — bảo hành theo dòng vật tư (FR-36)', () => {
    it('PATCH warrantyMonths: 24 ⇒ 200, response warrantyMonths 24', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      lineRepo.update.mockResolvedValue({
        ...DONG_CATALOG,
        warrantyMonths: 24,
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}/line-items/line-1`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ warrantyMonths: 24 });

      expect(res.status).toBe(200);
      expect(res.body.warrantyMonths).toBe(24);
    });

    it('PATCH warrantyMonths: null (bỏ bảo hành) ⇒ 200, response null (giá trị nghiệp vụ hợp lệ)', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      lineRepo.update.mockResolvedValue({
        ...DONG_CATALOG,
        warrantyMonths: null,
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}/line-items/line-1`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ warrantyMonths: null });

      expect(res.status).toBe(200);
      expect(res.body.warrantyMonths).toBeNull();
    });

    it('PATCH warrantyMonths: 0 và -5 ⇒ 400 fieldErrors (nguyên ≥ 1 khi non-null)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      for (const bad of [0, -5]) {
        const res = await request(server())
          .patch(`/orders/${ORDER_ID}/line-items/line-1`)
          .set('Authorization', `Bearer ${token()}`)
          .send({ warrantyMonths: bad });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        const fields = (res.body.fieldErrors as { field: string }[]).map(
          (e) => e.field,
        );
        expect(fields).toContain('warrantyMonths');
      }
      expect(lineRepo.update).not.toHaveBeenCalled();
    });

    it('PATCH warrantyMonths: 1.5 (không nguyên) ⇒ 400 fieldErrors (chặn số thập phân, không chỉ ≥ 1)', async () => {
      // @Min(1) một mình vẫn nhận 1.5 — chỉ @IsInt mới chặn số thập phân. Gửi
      // một giá trị ≥ 1 nhưng KHÔNG nguyên để pin riêng ràng buộc @IsInt.
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}/line-items/line-1`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ warrantyMonths: 1.5 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      const fields = (res.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields).toContain('warrantyMonths');
      expect(lineRepo.update).not.toHaveBeenCalled();
    });

    it('PATCH dòng công lắp (catalog priceEditable=true) warrantyMonths: 12 ⇒ 200 nhưng warrantyMonths vẫn null (bỏ qua im lặng, KHÔNG 400)', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      const dongCongLap = {
        ...DONG_CATALOG,
        id: 'line-conglap',
        productId: 'prod-lapdat',
        priceEditable: true,
        warrantyMonths: null,
      };
      lineRepo.findUnique.mockResolvedValue(dongCongLap);
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, id: 'prod-lapdat', priceEditable: true },
      ]);
      // Service bỏ qua field ⇒ Prisma update giữ null; mock trả bản null.
      lineRepo.update.mockResolvedValue(dongCongLap);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}/line-items/line-conglap`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ warrantyMonths: 12 });

      expect(res.status).toBe(200);
      expect(res.body.warrantyMonths).toBeNull();
    });

    it('PATCH warrantyMonths sau khi Đơn đã chốt ⇒ 409 (đóng băng — assertMutable)', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}/line-items/line-1`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ warrantyMonths: 24 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
    });

    it('GET /orders/:id KHÔNG lộ warrantyStartAt (mốc nội bộ — 5.9 mới expose)', async () => {
      givenPermissions(PERM.quotesCreateEdit, PERM.ordersViewOwn);
      // Dòng đã có mốc bảo hành nội bộ — response tuyệt đối không chứa field.
      lineRepo.findMany.mockResolvedValue([
        { ...DONG_CATALOG, warrantyStartAt: new Date('2026-07-10T00:00:00Z') },
      ]);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.lineItems[0]).toHaveProperty('warrantyMonths');
      expect(res.body.lineItems[0]).not.toHaveProperty('warrantyStartAt');
    });
  });

  describe('PATCH /orders/:id — toggle cờ phạm vi (Story 4.3)', () => {
    it('happy path ⇒ 200, cờ mới trong response, audit OrderScopeChanged qua EventBus', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.update.mockResolvedValue({ ...DON_BAOGIA, scopeThiCong: true });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeConstruction: true });

      expect(res.status).toBe(200);
      expect(res.body.scopeConstruction).toBe(true);
      expect(res.body.scopeEquipment).toBe(true);
      expect(res.body).not.toHaveProperty('scopeThiCong');
      expect(res.body).not.toHaveProperty('customerSdt');
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderScopeChanged' }),
        }),
      );
    });

    it('cờ không phải boolean (scopeConstruction: "yes") ⇒ 400 kèm fieldErrors, không ghi', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeConstruction: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'scopeConstruction' }),
        ]),
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('cờ = null ⇒ 400 (null KHÔNG phải "bỏ qua field" trên cột NOT NULL)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeDelivery: null });

      expect(res.status).toBe(400);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('đơn đã chốt ⇒ 409 CONFLICT envelope chuẩn', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeConstruction: true });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('scopeEquipment: false bị whitelist strip IM LẶNG ⇒ 200, KHÔNG ghi, KHÔNG audit, cờ vẫn true', async () => {
      // `scopeEquipment` không có trong DTO — client cố tắt cờ bất biến thì field bị strip,
      // dto còn lại RỖNG ⇒ nhánh "trả view hiện tại": không có đường ghi nào chạm tới cờ.
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeEquipment: false });

      expect(res.status).toBe(200);
      expect(res.body.scopeEquipment).toBe(true);
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('smuggle custType kèm cờ hợp lệ ⇒ custType bị strip: payload ghi CHỈ chứa field DTO, custType không đổi', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        scopeVanChuyen: true,
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ custType: 'THUONG_MAI', scopeDelivery: true });

      expect(res.status).toBe(200);
      // toHaveBeenCalledWith so KHỚP TOÀN BỘ object ⇒ chứng minh `custType` vắng mặt
      // trong data — nhãn báo cáo snapshot lúc tạo đơn không đổi được qua PATCH.
      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: {
          scopeThiCong: undefined,
          scopeVanChuyen: true,
          vatMode: undefined,
          kWp: undefined,
          validityNote: undefined,
        },
      });
      expect(res.body.custType).toBe('CA_NHAN');
      expect(res.body.scopeDelivery).toBe(true);
    });
  });

  describe('PATCH /orders/:id — metadata vatMode/kWp/validityNote (Story 4.4)', () => {
    it('happy path: đổi tick + kWp + hạn hiệu lực ⇒ 200, audit OrderMetaChanged qua EventBus', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        vatMode: 'khong_vat',
        kWp: 8.82,
        validityNote: '48h kể từ ngày lên PO',
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({
          vatMode: 'khong_vat',
          kWp: 8.82,
          validityNote: '48h kể từ ngày lên PO',
        });

      expect(res.status).toBe(200);
      expect(res.body.vatMode).toBe('khong_vat');
      expect(res.body.kWp).toBe(8.82);
      expect(res.body.validityNote).toBe('48h kể từ ngày lên PO');
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderMetaChanged' }),
        }),
      );
      // CHỈ meta ⇒ KHÔNG có audit OrderScopeChanged ké theo.
      expect(auditRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderScopeChanged' }),
        }),
      );
    });

    it("vatMode 'khac' + kWp 8.825 (3 chữ số lẻ) ⇒ 400 fieldErrors đủ 2 field, không ghi", async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ vatMode: 'khac', kWp: 8.825 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      const fields = (res.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields).toEqual(expect.arrayContaining(['vatMode', 'kWp']));
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('kWp = 0 (không > 0) và validityNote quá 200 ký tự ⇒ 400 fieldErrors', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ kWp: 0, validityNote: 'x'.repeat(201) });

      expect(res.status).toBe(400);
      const fields = (res.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields).toEqual(expect.arrayContaining(['kWp', 'validityNote']));
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('kWp/validityNote = null ⇒ 200 (null nghiệp vụ = xoá); vatMode = null ⇒ 400', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      // Nửa CHO QUA: kWp/validityNote nullable ở DB — null là "xoá giá trị".
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        kWp: null,
        validityNote: null,
      });
      const choQua = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ kWp: null, validityNote: null });
      expect(choQua.status).toBe(200);
      expect(choQua.body.kWp).toBeNull();
      expect(choQua.body.validityNote).toBeNull();

      // Nửa CHẶN: tick VAT không có trạng thái "null" — đơn mới luôn có tick.
      const biChan = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ vatMode: null });
      expect(biChan.status).toBe(400);
      expect(biChan.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('biên HỢP LỆ: kWp 0.01 (min) + validityNote đúng 200 ký tự ⇒ 200, có ghi', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      const note200 = 'x'.repeat(200);
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        kWp: 0.01,
        validityNote: note200,
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ kWp: 0.01, validityNote: note200 });

      expect(res.status).toBe(200);
      expect(res.body.kWp).toBe(0.01);
      expect(res.body.validityNote).toBe(note200);
      expect(orderRepo.update).toHaveBeenCalled();
    });

    it('meta trên đơn đã chốt ⇒ 409 CONFLICT (4.5 snapshot lúc Chốt — tick là tiền đóng băng)', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ vatMode: 'khong_vat' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /orders/preview-total — stateless, một bộ tính (AD-16, Story 4.2)', () => {
    it('happy path 2 dòng ⇒ 200 với 3 integer đồng (VAT 8% mặc định), KHÔNG chạm order/line/product', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          lines: [
            { unitPrice: 2_450_000, qty: 8 },
            { unitPrice: 500_000, qty: 1 },
          ],
        });

      // 200 chứ không 201 — compute thuần, không tạo resource.
      expect(res.status).toBe(200);
      // Số kỳ vọng tính TAY: 19_600_000 + 500_000 = 20_100_000; 8% = 1_608_000.
      // `vatRate`/`applyVat` (4.4) để client hiển thị nhãn thuế suất — giá trị backend.
      expect(res.body).toEqual({
        subtotal: 20_100_000,
        discountAmount: 0,
        vatAmount: 1_608_000,
        total: 21_708_000,
        vatRate: 8,
        applyVat: true,
      });
      // Stateless: đường preview không đọc/ghi các model nghiệp vụ, không audit.
      expect(orderRepo.findUnique).not.toHaveBeenCalled();
      expect(lineRepo.findMany).not.toHaveBeenCalled();
      expect(productRepo.findMany).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it("vatMode 'khong_vat' ⇒ vatAmount 0, total = subtotal; body vẫn mang vatRate + applyVat=false (4.4)", async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          lines: [{ unitPrice: 2_450_000, qty: 8 }],
          vatMode: 'khong_vat',
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subtotal: 19_600_000,
        discountAmount: 0,
        vatAmount: 0,
        total: 19_600_000,
        vatRate: 8,
        applyVat: false,
      });
    });

    it("vatMode 'khac' (ngoài registry) ⇒ 400 fieldErrors trỏ vatMode", async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 100, qty: 1 }], vatMode: 'khac' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'vatMode' })]),
      );
    });

    it('rate đọc từ CONFIG: row vat.rate_percent = "10" ⇒ vatAmount theo 10%, vatRate 10 (4.4)', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      systemSettingRepo.findUnique.mockResolvedValue({
        key: 'vat.rate_percent',
        value: '10',
        updatedAt: new Date(),
      });

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 1_000_000, qty: 1 }] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subtotal: 1_000_000,
        discountAmount: 0,
        vatAmount: 100_000,
        total: 1_100_000,
        vatRate: 10,
        applyVat: true,
      });
      // Resolve đúng key registry — MỘT lần mỗi request.
      expect(systemSettingRepo.findUnique).toHaveBeenCalledWith({
        where: { key: 'vat.rate_percent' },
      });
    });

    it("vatMode 'co_vat' TƯỜNG MINH ⇒ 200 như vắng field — nhánh tick-ON của UI đi qua @IsIn", async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 1_000_000, qty: 1 }], vatMode: 'co_vat' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subtotal: 1_000_000,
        discountAmount: 0,
        vatAmount: 80_000,
        total: 1_080_000,
        vatRate: 8,
        applyVat: true,
      });
    });

    it('client smuggle vatRate: 50 ⇒ bị whitelist strip IM LẶNG, tính theo CONFIG (client không bao giờ gửi rate)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 1_000_000, qty: 1 }], vatRate: 50 });

      // Rate lạ của client KHÔNG lọt vào phép tính — vẫn 8% default từ config.
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subtotal: 1_000_000,
        discountAmount: 0,
        vatAmount: 80_000,
        total: 1_080_000,
        vatRate: 8,
        applyVat: true,
      });
    });

    it('lines rỗng ⇒ 200 {0,0,0} — giỏ vừa xoá sạch vẫn preview được', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subtotal: 0,
        discountAmount: 0,
        vatAmount: 0,
        total: 0,
        vatRate: 8,
        applyVat: true,
      });
    });

    it('unitPrice âm ⇒ 400 fieldErrors envelope (nested validation CHẠY THẬT — @Type instantiate phần tử)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: -1, qty: 1 }] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      const fields = (res.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields.some((f) => f.includes('unitPrice'))).toBe(true);
    });

    it('unitPrice=0 hợp lệ (dòng tự do 0 đồng) ⇒ 200 — @Min(0) là 0, không phải 1', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 0, qty: 3 }] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subtotal: 0,
        discountAmount: 0,
        vatAmount: 0,
        total: 0,
        vatRate: 8,
        applyVat: true,
      });
    });

    it('tiền/số lượng FLOAT ⇒ 400 — @IsInt chặn trước khi float lọt vào hàm pricing (AD-10)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const floatPrice = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 100.5, qty: 1 }] });
      expect(floatPrice.status).toBe(400);
      expect(floatPrice.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      const fields = (floatPrice.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields.some((f) => f.includes('unitPrice'))).toBe(true);

      const floatQty = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 100, qty: 1.5 }] });
      expect(floatQty.status).toBe(400);
      expect(floatQty.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('biên 500 dòng: đúng 500 ⇒ 200 (tính tay 500/40/540), 501 ⇒ 400 — @ArrayMaxSize chạy thật', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      const line = { unitPrice: 1, qty: 1 };

      const dung500 = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: Array.from({ length: 500 }, () => line) });
      expect(dung500.status).toBe(200);
      // subtotal 500×1 = 500; VAT 8%: floor((500×8 + 50)/100) = floor(40.5) = 40.
      expect(dung500.body).toEqual({
        subtotal: 500,
        discountAmount: 0,
        vatAmount: 40,
        total: 540,
        vatRate: 8,
        applyVat: true,
      });

      const qua500 = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: Array.from({ length: 501 }, () => line) });
      expect(qua500.status).toBe(400);
      expect(qua500.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('qty=0 ⇒ 400; thiếu lines ⇒ 400', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const qtyKhong = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 100, qty: 0 }] });
      expect(qtyKhong.status).toBe(400);
      expect(qtyKhong.body.code).toBe(ErrorCode.VALIDATION_ERROR);

      const thieuLines = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({});
      expect(thieuLines.status).toBe(400);
      expect(thieuLines.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('POST /orders/:id/confirm — Chốt Đơn + snapshot giá (Story 4.5)', () => {
    it('không token ⇒ 401', async () => {
      const res = await request(server()).post(`/orders/${ORDER_ID}/confirm`);

      expect(res.status).toBe(401);
    });

    it('CHỈ có quotes.create_edit ⇒ 403 — quyền dựng báo giá KHÔNG thay được orders.confirm', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/confirm`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
    });

    it("happy: 200 status 'dachot', tx ghi status + version + snapshot dòng, audit OrderConfirmed qua AuditSubscriber thật", async () => {
      givenPermissions(PERM.ordersConfirm);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/confirm`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('dachot');
      expectOrderResponseKeys(res.body);
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: 'baogia' },
        data: { status: 'dachot' },
      });
      // vatRate 8 = default config (systemSetting vắng row); vatMode null ⇒ 'co_vat';
      // đường baogia KHÔNG mang chiết khấu ⇒ discountAmount null (4.7).
      expect(txVersionRepo.update).toHaveBeenCalledWith({
        where: { id: VERSION_ID },
        data: {
          vatRate: 8,
          vatMode: 'co_vat',
          chotAt: expect.any(Date),
          discountAmount: null,
        },
      });
      // Chốt lần đầu đóng băng warrantyStartAt cho dòng còn null (AC#3, Story 4.9).
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_450_000,
          catalogPriceSnapshot: 2_450_000,
          warrantyStartAt: expect.any(Date),
        },
      });
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderConfirmed' }),
        }),
      );
      // Vết from→to chính tắc (AD-11) đi qua CHÍNH `AuditSubscriber` thật — engine không
      // gọi AuditService, nó publish event và consumer ghi log (AD-18).
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'StatusChanged',
            actorAccountId: ACCOUNT_ID,
          }),
        }),
      );
    });

    it('confirming is NOT blocked by stock: a stock-tracked line with on-hand 0 still confirms (200 dachot) and reserves it, on-hand untouched, no voucher', async () => {
      givenPermissions(PERM.ordersConfirm);
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, sku: 'PIN-580', tracksStock: true, stockItem: null },
      ]);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/confirm`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('dachot');
      expect(stockItemRepo.upsert).toHaveBeenCalledTimes(1);
      expect(stockItemRepo.upsert).toHaveBeenCalledWith({
        where: { productId: PIN_580W.id },
        create: { productId: PIN_580W.id, onHand: 0 },
        update: {},
      });
      expect(stockMovementRepo.create).toHaveBeenCalledTimes(1);
      expect(stockMovementRepo.create).toHaveBeenCalledWith({
        data: {
          stockItemId: 'si-pin',
          orderId: ORDER_ID,
          orderVersionId: VERSION_ID,
          qty: DONG_CATALOG.qty,
          type: 'reserve',
        },
      });
      expect(stockVoucherRepo.create).not.toHaveBeenCalled();
    });

    it('confirm retried on an already-confirmed order writes no reservation', async () => {
      givenPermissions(PERM.ordersConfirm);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/confirm`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('dachot');
      expect(transaction).not.toHaveBeenCalled();
      expect(stockMovementRepo.create).not.toHaveBeenCalled();
    });

    it('mỗi transition để lại ĐÚNG MỘT vết StatusChanged mang from→to (AD-11)', async () => {
      givenPermissions(PERM.ordersConfirm);

      await request(server())
        .post(`/orders/${ORDER_ID}/confirm`)
        .set('Authorization', `Bearer ${token()}`);

      const vet = auditRepo.create.mock.calls
        .map((call) => (call[0] as { data: Record<string, unknown> }).data)
        .filter((data) => data.eventType === 'StatusChanged');
      expect(vet).toHaveLength(1);
      expect(vet[0].before).toMatchObject({ status: 'baogia' });
      expect(vet[0].after).toMatchObject({ status: 'dachot' });
    });

    it("vatRate đóng băng theo CONFIG: row vat.rate_percent = '10' ⇒ version snapshot vatRate 10, không phải default", async () => {
      // Chứng minh controller resolve SettingsService thật rồi truyền xuống —
      // hardcode default 8 ở bất kỳ tầng nào cũng làm test này RED.
      givenPermissions(PERM.ordersConfirm);
      systemSettingRepo.findUnique.mockResolvedValue({
        key: 'vat.rate_percent',
        value: '10',
        updatedAt: new Date(),
      });

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/confirm`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(txVersionRepo.update).toHaveBeenCalledWith({
        where: { id: VERSION_ID },
        data: {
          vatRate: 10,
          vatMode: 'co_vat',
          chotAt: expect.any(Date),
          discountAmount: null,
        },
      });
    });

    it('retry trên đơn đã chốt ⇒ 200 body y hệt GET, KHÔNG ghi, audit KHÔNG ghi thêm', async () => {
      givenPermissions(
        PERM.ordersConfirm,
        PERM.quotesCreateEdit,
        PERM.ordersViewOwn,
      );
      const DON_DA_CHOT = { ...DON_BAOGIA, status: 'dachot' };
      const DONG_DA_CHOT = {
        ...DONG_CATALOG,
        unitPriceSnapshot: 2_450_000,
        catalogPriceSnapshot: 2_450_000,
      };
      orderRepo.findUnique.mockResolvedValue(DON_DA_CHOT);
      lineRepo.findMany.mockResolvedValue([DONG_DA_CHOT]);

      const retry = await request(server())
        .post(`/orders/${ORDER_ID}/confirm`)
        .set('Authorization', `Bearer ${token()}`);
      const get = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(retry.status).toBe(200);
      expect(retry.body).toEqual(get.body);
      expect(transaction).not.toHaveBeenCalled();
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('sửa giá danh mục SAU chốt ⇒ GET trả đơn giá dòng KHÔNG đổi (snapshot thắng giá sống — FR-5)', async () => {
      givenPermissions(PERM.quotesCreateEdit, PERM.ordersViewOwn);
      // Dòng đã đóng băng 2_450_000; danh mục hiện hành đã nhảy lên 9_999_999.
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });
      lineRepo.findMany.mockResolvedValue([
        {
          ...DONG_CATALOG,
          unitPriceSnapshot: 2_450_000,
          catalogPriceSnapshot: 2_450_000,
        },
      ]);
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 9_999_999 },
      ]);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.lineItems[0].unitPrice).toBe(2_450_000);
      expect(res.body.lineItems[0].amount).toBe(2_450_000 * 8);
    });

    it('chốt đơn 0 dòng ⇒ 400 VALIDATION_ERROR, không ghi', async () => {
      givenPermissions(PERM.ordersConfirm);
      lineRepo.findMany.mockResolvedValue([]);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/confirm`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('đơn ma ⇒ 404 envelope chuẩn', async () => {
      givenPermissions(PERM.ordersConfirm);
      orderRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .post('/orders/khong-co/confirm')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('POST /orders/:id/reopen — Mở lại Đơn đã chốt (Story 4.6, FR-6)', () => {
    it('không token ⇒ 401', async () => {
      const res = await request(server()).post(`/orders/${ORDER_ID}/reopen`);

      expect(res.status).toBe(401);
    });

    it('CHỈ có orders.confirm ⇒ 403 — quyền chốt KHÔNG thay được quotes.create_edit (nghịch đảo proof 4.5)', async () => {
      givenPermissions(PERM.ordersConfirm);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/reopen`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('vòng đời FR-6 đầy đủ: tạo → thêm dòng → chốt → giá danh mục đổi → mở lại (giá SỐNG mới, bản cũ nguyên snapshot, audit) → sửa dòng → re-chốt (snapshot MỚI trên bản mới, bản cũ vẫn cũ)', async () => {
      givenPermissions(
        PERM.quotesCreateEdit,
        PERM.ordersConfirm,
        PERM.ordersViewOwn,
      );

      // ===== Mock STATEFUL: DB giả trong bộ nhớ — mọi op đọc/ghi cùng một sự thật. =====
      let orderState: Record<string, unknown> | null = null;
      const versions = new Map<string, Record<string, unknown>>();
      const linesByVersion = new Map<string, Array<Record<string, unknown>>>();
      let lineSeq = 0;
      const NOW = new Date('2026-07-17T00:00:00Z');

      function allLines(): Array<Record<string, unknown>> {
        return [...linesByVersion.values()].flat();
      }

      orderRepo.findUnique.mockImplementation(async () =>
        orderState === null ? null : { ...orderState },
      );
      orderRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          orderState = {
            ...DON_BAOGIA,
            ...data,
            currentVersionId: null,
            createdAt: NOW,
            updatedAt: NOW,
          };
          return { ...orderState };
        },
      );
      orderRepo.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          orderState = { ...orderState, ...data };
          return { ...orderState };
        },
      );
      orderVersionRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          versions.set(data.id as string, { ...data });
          linesByVersion.set(data.id as string, []);
          return { ...data };
        },
      );
      orderVersionRepo.findUnique.mockImplementation(
        async ({ where }: { where: { id: string } }) => {
          const ver = versions.get(where.id);
          return ver === undefined ? null : { ...ver };
        },
      );
      lineRepo.findMany.mockImplementation(
        async ({ where }: { where: { orderVersionId: string } }) =>
          (linesByVersion.get(where.orderVersionId) ?? []).map((l) => ({
            ...l,
          })),
      );
      lineRepo.findFirst.mockImplementation(
        async ({ where }: { where: { orderVersionId: string } }) => {
          const lines = linesByVersion.get(where.orderVersionId) ?? [];
          if (lines.length === 0) return null;
          return lines.reduce((a, b) =>
            (a.displayOrder as number) > (b.displayOrder as number) ? a : b,
          );
        },
      );
      lineRepo.findUnique.mockImplementation(
        async ({ where }: { where: { id: string } }) =>
          allLines().find((l) => l.id === where.id) ?? null,
      );
      lineRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          lineSeq += 1;
          const row = {
            id: `line-song-${lineSeq}`,
            unitPriceSnapshot: null,
            catalogPriceSnapshot: null,
            costPriceSnapshot: null,
            warrantyStartAt: null,
            createdAt: NOW,
            updatedAt: NOW,
            ...data,
          };
          linesByVersion.get(data.orderVersionId as string)?.push(row);
          return { ...row };
        },
      );
      lineRepo.update.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = allLines().find((l) => l.id === where.id);
          if (row === undefined) throw new Error('line ma');
          for (const [k, v] of Object.entries(data)) {
            if (v !== undefined) row[k] = v;
          }
          return { ...row };
        },
      );
      // Cổng atomic stateful: WHERE status khớp sự thật hiện tại mới được đổi (count 1).
      txOrderRepo.updateMany.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { status: string };
          data: { status: string };
        }) => {
          if (orderState !== null && orderState.status === where.status) {
            orderState = { ...orderState, status: data.status };
            return { count: 1 };
          }
          return { count: 0 };
        },
      );
      txOrderRepo.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          orderState = { ...orderState, ...data };
          return { ...orderState };
        },
      );
      txVersionRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          versions.set(data.id as string, { ...data });
          if (!linesByVersion.has(data.id as string)) {
            linesByVersion.set(data.id as string, []);
          }
          return { ...data };
        },
      );
      txVersionRepo.update.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          versions.set(where.id, {
            ...(versions.get(where.id) ?? { id: where.id }),
            ...data,
          });
          return {};
        },
      );
      txLineRepo.update.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = allLines().find((l) => l.id === where.id);
          if (row === undefined) throw new Error('line ma');
          Object.assign(row, data);
          return { ...row };
        },
      );
      txLineRepo.createMany.mockImplementation(
        async ({ data }: { data: Array<Record<string, unknown>> }) => {
          for (const row of data) {
            const verId = row.orderVersionId as string;
            if (!linesByVersion.has(verId)) linesByVersion.set(verId, []);
            linesByVersion
              .get(verId)
              ?.push({ ...row, createdAt: NOW, updatedAt: NOW });
          }
          return { count: data.length };
        },
      );

      // ===== 1. Tạo đơn =====
      const tao = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ customerPhone: '0912 345 678' });
      expect(tao.status).toBe(201);
      // create() trả order SAU op repoint — con trỏ đã trỏ version 1.
      const verCu = tao.body.currentVersionId as string;

      // ===== 2. Thêm dòng catalog (giá danh mục lúc này 2_450_000) =====
      const themDong = await request(server())
        .post(`/orders/${tao.body.id}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productId: PIN_580W.id, qty: 8 });
      expect(themDong.status).toBe(201);

      // ===== 3. Chốt — snapshot đóng băng 2_450_000 =====
      const chot = await request(server())
        .post(`/orders/${tao.body.id}/confirm`)
        .set('Authorization', `Bearer ${token()}`);
      expect(chot.status).toBe(200);
      expect(chot.body.status).toBe('dachot');
      expect(chot.body.lineItems[0].unitPrice).toBe(2_450_000);

      // ===== 4. Giá danh mục ĐỔI sau chốt =====
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 2_600_000 },
      ]);

      // ===== 5. Mở lại — 200 baogia, version MỚI, giá dòng = giá danh mục MỚI (live) =====
      const moLai = await request(server())
        .post(`/orders/${tao.body.id}/reopen`)
        .set('Authorization', `Bearer ${token()}`);
      expect(moLai.status).toBe(200);
      expect(moLai.body.status).toBe('baogia');
      const verMoi = moLai.body.currentVersionId as string;
      expect(verMoi).not.toBe(verCu);
      // Snapshot null trên bản mới ⇒ live-resolve giá HIỆN TẠI — không phải snapshot cũ.
      expect(moLai.body.lineItems[0].unitPrice).toBe(2_600_000);
      expect(moLai.body.lineItems[0].amount).toBe(2_600_000 * 8);
      // Bản CŨ vẫn nguyên vẹn trong "DB": snapshot cũ + version cũ không bị chạm (FR-6).
      const dongCu = linesByVersion.get(verCu) ?? [];
      expect(dongCu).toHaveLength(1);
      expect(dongCu[0].unitPriceSnapshot).toBe(2_450_000);
      expect(versions.get(verCu)?.vatRate).toBe(8);
      expect(versions.get(verCu)?.chotAt).toEqual(expect.any(Date));
      // Version mới CHƯA đóng băng thuế.
      expect(versions.get(verMoi)?.vatRate).toBeUndefined();
      // Audit OrderRevised qua AuditSubscriber thật.
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderRevised' }),
        }),
      );

      // ===== 6. Sửa dòng trên bản MỚI (máy sửa hiện có hoạt động lại — AC #3) =====
      const lineMoiId = moLai.body.lineItems[0].id as string;
      const suaDong = await request(server())
        .patch(`/orders/${tao.body.id}/line-items/${lineMoiId}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ qty: 12 });
      expect(suaDong.status).toBe(200);
      expect(suaDong.body.qty).toBe(12);

      // ===== 7. Re-chốt qua /confirm HIỆN CÓ — snapshot MỚI lên bản MỚI, bản cũ vẫn CŨ =====
      const reChot = await request(server())
        .post(`/orders/${tao.body.id}/confirm`)
        .set('Authorization', `Bearer ${token()}`);
      expect(reChot.status).toBe(200);
      expect(reChot.body.status).toBe('dachot');
      expect(reChot.body.lineItems[0].unitPrice).toBe(2_600_000);
      const dongMoi = linesByVersion.get(verMoi) ?? [];
      expect(dongMoi[0].unitPriceSnapshot).toBe(2_600_000);
      // Hai đợt đóng băng SONG SONG tồn tại: bản cũ giữ snapshot CŨ của nó.
      expect(dongCu[0].unitPriceSnapshot).toBe(2_450_000);
      expect(versions.get(verMoi)?.vatRate).toBe(8);
      expect(versions.get(verMoi)?.chotAt).toEqual(expect.any(Date));

      // ===== 8. Giá danh mục đổi TIẾP sau re-chốt — bản mới ĐÃ đóng băng, GET không đổi =====
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 2_800_000 },
      ]);
      const getSauReChot = await request(server())
        .get(`/orders/${tao.body.id}`)
        .set('Authorization', `Bearer ${token()}`);
      expect(getSauReChot.status).toBe(200);
      // Đường đọc snapshot-first: giá giữ 2_600_000 — KHÔNG ăn giá sống 2_800_000.
      expect(getSauReChot.body.lineItems[0].unitPrice).toBe(2_600_000);
      expect(getSauReChot.body.lineItems[0].amount).toBe(2_600_000 * 12);
    });

    it("retry reopen khi đơn ĐANG 'baogia' ⇒ 200 body y hệt GET, KHÔNG ghi, audit KHÔNG ghi thêm", async () => {
      givenPermissions(PERM.quotesCreateEdit, PERM.ordersViewOwn);
      orderRepo.findUnique.mockResolvedValue(DON_BAOGIA);
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);

      const retry = await request(server())
        .post(`/orders/${ORDER_ID}/reopen`)
        .set('Authorization', `Bearer ${token()}`);
      const get = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(retry.status).toBe(200);
      expect(retry.body).toEqual(get.body);
      expect(transaction).not.toHaveBeenCalled();
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(txVersionRepo.create).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('đơn ma ⇒ 404 envelope chuẩn', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .post('/orders/khong-co/reopen')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it("đơn 'huy' ⇒ 409 CONFLICT envelope chuẩn qua exception filter, KHÔNG ghi, KHÔNG audit", async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'huy',
      });

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/reopen`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.traceId).toEqual(expect.any(String));
      expect(transaction).not.toHaveBeenCalled();
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('Story 4.7 — áp/duyệt chiết khấu + chốt sau duyệt (FR-18/FR-37)', () => {
    it('403 chéo: áp với CHỈ quotes.create_edit; duyệt + list với CHỈ discounts.apply (nghịch đảo proof)', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      const ap = await request(server())
        .post(`/orders/${ORDER_ID}/apply-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 1_000_000 });
      expect(ap.status).toBe(403);
      expect(ap.body.code).toBe(ErrorCode.FORBIDDEN);

      givenPermissions(PERM.discountsApply);
      const duyet = await request(server())
        .post(`/orders/${ORDER_ID}/resolve-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: true });
      expect(duyet.status).toBe(403);
      const list = await request(server())
        .get('/orders/pending-discount-approvals')
        .set('Authorization', `Bearer ${token()}`);
      expect(list.status).toBe(403);
      expect(transaction).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('vòng đời ĐỒNG Ý đầy đủ: tạo → thêm dòng → áp (audit) → khoá sửa lúc choduyet → list (margin theo fence costs.view) → duyệt → chốt (snapshot discount) → preview echo → mở lại (version mới KHÔNG mang chiết khấu)', async () => {
      givenPermissions(
        PERM.quotesCreateEdit,
        PERM.discountsApply,
        PERM.discountsApprove,
        PERM.ordersConfirm,
        PERM.costsView,
      );

      // ===== Mock STATEFUL (khuôn vòng đời FR-6): DB giả trong bộ nhớ. =====
      let orderState: Record<string, unknown> | null = null;
      const versions = new Map<string, Record<string, unknown>>();
      const linesByVersion = new Map<string, Array<Record<string, unknown>>>();
      const approvals: Array<Record<string, unknown>> = [];
      let lineSeq = 0;
      let approvalSeq = 0;
      const NOW = new Date('2026-07-17T00:00:00Z');

      function allLines(): Array<Record<string, unknown>> {
        return [...linesByVersion.values()].flat();
      }

      orderRepo.findUnique.mockImplementation(async () =>
        orderState === null ? null : { ...orderState },
      );
      orderRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          orderState = {
            ...DON_BAOGIA,
            ...data,
            currentVersionId: null,
            createdAt: NOW,
            updatedAt: NOW,
          };
          return { ...orderState };
        },
      );
      orderRepo.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          orderState = { ...orderState, ...data };
          return { ...orderState };
        },
      );
      orderVersionRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          versions.set(data.id as string, { ...data });
          linesByVersion.set(data.id as string, []);
          return { ...data };
        },
      );
      orderVersionRepo.findUnique.mockImplementation(
        async ({ where }: { where: { id: string } }) => {
          const ver = versions.get(where.id);
          return ver === undefined ? null : { ...ver };
        },
      );
      lineRepo.findMany.mockImplementation(
        async ({ where }: { where: { orderVersionId: string } }) =>
          (linesByVersion.get(where.orderVersionId) ?? []).map((l) => ({
            ...l,
          })),
      );
      lineRepo.findFirst.mockImplementation(
        async ({ where }: { where: { orderVersionId: string } }) => {
          const lines = linesByVersion.get(where.orderVersionId) ?? [];
          if (lines.length === 0) return null;
          return lines.reduce((a, b) =>
            (a.displayOrder as number) > (b.displayOrder as number) ? a : b,
          );
        },
      );
      lineRepo.findUnique.mockImplementation(
        async ({ where }: { where: { id: string } }) =>
          allLines().find((l) => l.id === where.id) ?? null,
      );
      lineRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          lineSeq += 1;
          const row = {
            id: `line-song-${lineSeq}`,
            unitPriceSnapshot: null,
            catalogPriceSnapshot: null,
            costPriceSnapshot: null,
            warrantyStartAt: null,
            createdAt: NOW,
            updatedAt: NOW,
            ...data,
          };
          linesByVersion.get(data.orderVersionId as string)?.push(row);
          return { ...row };
        },
      );
      txOrderRepo.updateMany.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { status: string };
          data: { status: string };
        }) => {
          if (orderState !== null && orderState.status === where.status) {
            orderState = { ...orderState, status: data.status };
            return { count: 1 };
          }
          return { count: 0 };
        },
      );
      txOrderRepo.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          orderState = { ...orderState, ...data };
          return { ...orderState };
        },
      );
      txVersionRepo.update.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          versions.set(where.id, {
            ...(versions.get(where.id) ?? { id: where.id }),
            ...data,
          });
          return {};
        },
      );
      txVersionRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          versions.set(data.id as string, { ...data });
          if (!linesByVersion.has(data.id as string)) {
            linesByVersion.set(data.id as string, []);
          }
          return { ...data };
        },
      );
      txLineRepo.update.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = allLines().find((l) => l.id === where.id);
          if (row === undefined) throw new Error('line ma');
          Object.assign(row, data);
          return { ...row };
        },
      );
      txLineRepo.createMany.mockImplementation(
        async ({ data }: { data: Array<Record<string, unknown>> }) => {
          for (const row of data) {
            const verId = row.orderVersionId as string;
            if (!linesByVersion.has(verId)) linesByVersion.set(verId, []);
            linesByVersion
              .get(verId)
              ?.push({ ...row, createdAt: NOW, updatedAt: NOW });
          }
          return { count: data.length };
        },
      );
      // Hồ sơ duyệt stateful: create push; updateMany là cổng atomic trên row; findFirst =
      // MỚI NHẤT (đơn duy nhất trong test — phần tử cuối); findMany = pending kèm include.
      txDiscountRepo.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          approvalSeq += 1;
          const row = {
            resolveNote: null,
            resolvedByAccountId: null,
            resolvedAt: null,
            createdAt: new Date(NOW.getTime() + approvalSeq * 1000),
            updatedAt: NOW,
            ...data,
          };
          approvals.push(row);
          return { ...row };
        },
      );
      txDiscountRepo.updateMany.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { id: string; status: string };
          data: Record<string, unknown>;
        }) => {
          const row = approvals.find(
            (a) => a.id === where.id && a.status === where.status,
          );
          if (row === undefined) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      );
      discountApprovalRepo.findFirst.mockImplementation(async () =>
        approvals.length === 0 ? null : { ...approvals[approvals.length - 1] },
      );
      discountApprovalRepo.findMany.mockImplementation(async () =>
        approvals
          .filter((a) => a.status === 'cho_duyet')
          .map((a) => ({
            ...a,
            order: { ...orderState },
            requestedBy: { displayName: account.displayName },
          })),
      );
      // HAI đường tra product: quote select (KHÔNG costPrice) vs margin select riêng
      // {id, costPrice} — costPrice 1_960_000 ⇒ biên (2_450_000−1_960_000)/2_450_000 = 20%.
      productRepo.findMany.mockImplementation(
        async (args: { select: Record<string, unknown> }) =>
          args.select.costPrice === true
            ? [{ id: PIN_580W.id, costPrice: 1_960_000 }]
            : [PIN_580W],
      );

      // ===== 1. Tạo đơn + thêm dòng (subtotal 19_600_000) =====
      const tao = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ customerPhone: '0912 345 678' });
      expect(tao.status).toBe(201);
      expect(tao.body.discount).toBeNull();
      const verCu = tao.body.currentVersionId as string;
      const themDong = await request(server())
        .post(`/orders/${tao.body.id}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productId: PIN_580W.id, qty: 8 });
      expect(themDong.status).toBe(201);

      // ===== 2. Áp vượt subtotal ⇒ 400 fieldErrors amount =====
      const apVuot = await request(server())
        .post(`/orders/${tao.body.id}/apply-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 19_600_001 });
      expect(apVuot.status).toBe(400);
      expect(apVuot.body.fieldErrors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'amount' })]),
      );

      // ===== 3. Áp 1_000_000 ⇒ 200 choduyet + discount cho_duyet + audit =====
      const ap = await request(server())
        .post(`/orders/${tao.body.id}/apply-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 1_000_000, note: 'Khách quen' });
      expect(ap.status).toBe(200);
      expect(ap.body.status).toBe('choduyet');
      expect(ap.body.discount).toMatchObject({
        amount: 1_000_000,
        status: 'cho_duyet',
        requestNote: 'Khách quen',
      });
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'DiscountRequested' }),
        }),
      );

      // ===== 4. choduyet đóng băng nội dung: PATCH meta + PATCH dòng ⇒ 409 =====
      const patchMeta = await request(server())
        .patch(`/orders/${tao.body.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ kWp: 5.5 });
      expect(patchMeta.status).toBe(409);
      const lineId = ap.body.lineItems[0].id as string;
      const patchLine = await request(server())
        .patch(`/orders/${tao.body.id}/line-items/${lineId}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ qty: 12 });
      expect(patchLine.status).toBe(409);

      // ===== 5. Áp LẦN HAI khi đang choduyet ⇒ 409 (áp KHÔNG idempotent) =====
      const apLan2 = await request(server())
        .post(`/orders/${tao.body.id}/apply-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 2_000_000 });
      expect(apLan2.status).toBe(409);

      // ===== 6. List chờ duyệt — CÓ costs.view: margin đúng số =====
      const listCo = await request(server())
        .get('/orders/pending-discount-approvals')
        .set('Authorization', `Bearer ${token()}`);
      expect(listCo.status).toBe(200);
      expect(listCo.body).toHaveLength(1);
      expect(listCo.body[0]).not.toHaveProperty('customerSdt');
      expect(listCo.body[0]).toMatchObject({
        orderId: tao.body.id,
        customerPhone: SDT_E164,
        amount: 1_000_000,
        requestNote: 'Khách quen',
        requestedByAccountId: ACCOUNT_ID,
        requestedByDisplayName: account.displayName,
        subtotal: 19_600_000,
        afterDiscount: 18_600_000,
      });
      expect(listCo.body[0].lines[0].estimatedMarginPct).toBe(20);
      expect(JSON.stringify(listCo.body)).not.toContain('costPrice');

      // ===== 7. List — KHÔNG costs.view: margin null toàn bộ, body sạch costPrice (FR-37) =====
      givenPermissions(PERM.quotesCreateEdit, PERM.discountsApprove);
      const listKhong = await request(server())
        .get('/orders/pending-discount-approvals')
        .set('Authorization', `Bearer ${token()}`);
      expect(listKhong.status).toBe(200);
      expect(listKhong.body[0].lines[0].estimatedMarginPct).toBeNull();
      expect(JSON.stringify(listKhong.body)).not.toContain('costPrice');
      givenPermissions(
        PERM.quotesCreateEdit,
        PERM.discountsApply,
        PERM.discountsApprove,
        PERM.ordersConfirm,
        PERM.costsView,
      );

      // ===== 8. Duyệt đồng ý ⇒ 200 VẪN choduyet + discount dong_y + audit =====
      const duyet = await request(server())
        .post(`/orders/${tao.body.id}/resolve-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: true });
      expect(duyet.status).toBe(200);
      expect(duyet.body.status).toBe('choduyet');
      expect(duyet.body.discount.status).toBe('dong_y');
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'DiscountResolved' }),
        }),
      );

      // ===== 9. Chốt từ choduyet ⇒ 200 dachot; version snapshot mang discountAmount =====
      const chot = await request(server())
        .post(`/orders/${tao.body.id}/confirm`)
        .set('Authorization', `Bearer ${token()}`);
      expect(chot.status).toBe(200);
      expect(chot.body.status).toBe('dachot');
      expect(versions.get(verCu)?.discountAmount).toBe(1_000_000);
      expect(versions.get(verCu)?.vatRate).toBe(8);

      // ===== 10. Preview echo discount ⇒ VAT trên vatBase (con số phân biệt) =====
      const preview = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          lines: [{ unitPrice: 2_450_000, qty: 8 }],
          discountAmount: 1_000_000,
        });
      expect(preview.status).toBe(200);
      // vatBase = 18_600_000; VAT 8% half-up = 1_488_000 (KHÔNG phải 1_568_000 trên subtotal).
      expect(preview.body).toEqual({
        subtotal: 19_600_000,
        discountAmount: 1_000_000,
        vatAmount: 1_488_000,
        total: 20_088_000,
        vatRate: 8,
        applyVat: true,
      });

      // ===== 11. Mở lại ⇒ version MỚI KHÔNG mang chiết khấu =====
      const moLai = await request(server())
        .post(`/orders/${tao.body.id}/reopen`)
        .set('Authorization', `Bearer ${token()}`);
      expect(moLai.status).toBe(200);
      expect(moLai.body.status).toBe('baogia');
      const verMoi = moLai.body.currentVersionId as string;
      expect(verMoi).not.toBe(verCu);
      expect(versions.get(verMoi)?.discountAmount).toBeUndefined();
      // Bản cũ giữ nguyên chiết khấu đã đóng băng trong lịch sử.
      expect(versions.get(verCu)?.discountAmount).toBe(1_000_000);
    });

    it('nhánh TỪ CHỐI: thiếu reason ⇒ 400; có reason ⇒ 200 baogia + resolveNote + audit', async () => {
      givenPermissions(PERM.discountsApprove, PERM.quotesCreateEdit);
      const DON_CHODUYET = { ...DON_BAOGIA, status: 'choduyet' };
      const APPROVAL_PENDING = {
        id: 'apr-e2e-1',
        orderId: ORDER_ID,
        orderVersionId: VERSION_ID,
        amount: 1_000_000,
        status: 'cho_duyet',
        requestNote: 'Khách quen',
        resolveNote: null,
        requestedByAccountId: ACCOUNT_ID,
        resolvedByAccountId: null,
        resolvedAt: null,
        createdAt: new Date('2026-07-17T03:00:00Z'),
        updatedAt: new Date('2026-07-17T03:00:00Z'),
      };
      orderRepo.findUnique.mockResolvedValue(DON_CHODUYET);
      discountApprovalRepo.findFirst.mockResolvedValue(APPROVAL_PENDING);

      const thieuReason = await request(server())
        .post(`/orders/${ORDER_ID}/resolve-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: false });
      expect(thieuReason.status).toBe(400);
      expect(thieuReason.body.fieldErrors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'reason' })]),
      );
      expect(transaction).not.toHaveBeenCalled();

      // Có reason: sau tx, view compose approval ĐÃ resolve (findFirst trả bản mới).
      discountApprovalRepo.findFirst
        .mockResolvedValueOnce(APPROVAL_PENDING)
        .mockResolvedValue({
          ...APPROVAL_PENDING,
          status: 'tu_choi',
          resolveNote: 'Biên quá mỏng',
          resolvedByAccountId: ACCOUNT_ID,
          resolvedAt: new Date('2026-07-17T04:00:00Z'),
        });
      const tuChoi = await request(server())
        .post(`/orders/${ORDER_ID}/resolve-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: false, reason: 'Biên quá mỏng' });
      expect(tuChoi.status).toBe(200);
      expect(tuChoi.body.status).toBe('baogia');
      expect(tuChoi.body.discount).toMatchObject({
        status: 'tu_choi',
        resolveNote: 'Biên quá mỏng',
      });
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'DiscountResolved' }),
        }),
      );
    });

    it('retry duyệt CÙNG decision trên approval đã dong_y ⇒ 200 body y hệt GET, KHÔNG audit thêm', async () => {
      givenPermissions(
        PERM.discountsApprove,
        PERM.quotesCreateEdit,
        PERM.ordersViewOwn,
      );
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'choduyet',
      });
      discountApprovalRepo.findFirst.mockResolvedValue({
        id: 'apr-e2e-2',
        orderId: ORDER_ID,
        orderVersionId: VERSION_ID,
        amount: 1_000_000,
        status: 'dong_y',
        requestNote: null,
        resolveNote: null,
        requestedByAccountId: ACCOUNT_ID,
        resolvedByAccountId: ACCOUNT_ID,
        resolvedAt: new Date('2026-07-17T04:00:00Z'),
        createdAt: new Date('2026-07-17T03:00:00Z'),
        updatedAt: new Date('2026-07-17T04:00:00Z'),
      });

      const retry = await request(server())
        .post(`/orders/${ORDER_ID}/resolve-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: true });
      const get = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(retry.status).toBe(200);
      expect(retry.body).toEqual(get.body);
      expect(retry.body.discount.status).toBe('dong_y');
      expect(transaction).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('đơn ma ⇒ 404 envelope chuẩn cho cả áp lẫn duyệt', async () => {
      givenPermissions(PERM.discountsApply, PERM.discountsApprove);
      orderRepo.findUnique.mockResolvedValue(null);

      const ap = await request(server())
        .post('/orders/khong-co/apply-discount')
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 1 });
      expect(ap.status).toBe(404);
      expect(ap.body.code).toBe(ErrorCode.NOT_FOUND);

      const duyet = await request(server())
        .post('/orders/khong-co/resolve-discount')
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: true });
      expect(duyet.status).toBe(404);
      expect(duyet.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('ValidationPipe: amount 0 / float / vắng ⇒ 400; preview discountAmount âm ⇒ 400', async () => {
      givenPermissions(PERM.discountsApply, PERM.quotesCreateEdit);

      for (const body of [{ amount: 0 }, { amount: 100.5 }, {}]) {
        const res = await request(server())
          .post(`/orders/${ORDER_ID}/apply-discount`)
          .set('Authorization', `Bearer ${token()}`)
          .send(body);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      }

      const previewAm = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [{ unitPrice: 100, qty: 1 }], discountAmount: -1 });
      expect(previewAm.status).toBe(400);
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('Story 4.8 — xuất & tải báo giá (FR-21, AD-3)', () => {
    /** Parser binary cho supertest — superagent không tự buffer image/pdf. */
    function binaryParser(
      res: request.Response,
      callback: (err: Error | null, body: Buffer) => void,
    ): void {
      // Ở tầng parse, superagent đưa vào response STREAM thô (type khai là Response).
      const stream = res as unknown as NodeJS.ReadableStream;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => callback(null, Buffer.concat(chunks)));
    }

    const VERSION_CHUA_CHOT = {
      id: VERSION_ID,
      orderId: ORDER_ID,
      versionNo: 1,
      vatRate: null,
      vatMode: null,
      chotAt: null,
      discountAmount: null,
      createdAt: new Date('2026-07-16T01:00:00Z'),
      updatedAt: new Date('2026-07-16T01:00:00Z'),
    };

    beforeEach(() => {
      // Khác default suite (null): export cần version hiện hành để đọc snapshot thuế.
      orderVersionRepo.findUnique.mockResolvedValue(VERSION_CHUA_CHOT);
    });

    it('flow: POST export-quote 200 metadata → GET anh (PNG magic) → GET pdf (%PDF) → audit QuoteExported', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      const fileBase = `bao-gia-${ORDER_ID.slice(0, 8)}`;

      const xuat = await request(server())
        .post(`/orders/${ORDER_ID}/export-quote`)
        .set('Authorization', `Bearer ${token()}`)
        .send();

      expect(xuat.status).toBe(200);
      expect(xuat.body.orderId).toBe(ORDER_ID);
      expect(xuat.body.orderVersionId).toBe(VERSION_ID);
      expect(xuat.body.image).toEqual({
        fileName: `${fileBase}.png`,
        size: PNG_STUB.length,
      });
      expect(xuat.body.pdf).toEqual({
        fileName: `${fileBase}.pdf`,
        size: PDF_STUB.length,
      });
      // Bytes KHÔNG nằm trong response metadata.
      expect(JSON.stringify(xuat.body)).not.toContain('%PDF');
      // exportedAt là ISO datetime hợp lệ (client hiển thị "xuất lúc nào").
      expect(new Date(xuat.body.exportedAt as string).getTime()).not.toBeNaN();

      const anh = await request(server())
        .get(`/orders/${ORDER_ID}/quote/image`)
        .set('Authorization', `Bearer ${token()}`)
        .buffer(true)
        .parse(binaryParser);

      expect(anh.status).toBe(200);
      expect(anh.headers['content-type']).toContain('image/png');
      expect(anh.headers['content-disposition']).toContain(`${fileBase}.png`);
      // Magic bytes PNG.
      expect((anh.body as Buffer).subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );

      const pdf = await request(server())
        .get(`/orders/${ORDER_ID}/quote/pdf`)
        .set('Authorization', `Bearer ${token()}`)
        .buffer(true)
        .parse(binaryParser);

      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.headers['content-disposition']).toContain(`${fileBase}.pdf`);
      expect((pdf.body as Buffer).toString('utf8')).toMatch(/^%PDF/);

      // AuditSubscriber THẬT đã ghi QuoteExported (AD-18 — không gọi audit trực tiếp).
      expect(auditRepo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'QuoteExported',
          actorAccountId: ACCOUNT_ID,
          targetType: 'Order',
          targetId: ORDER_ID,
        }),
      });
    });

    it('đơn CHƯA xuất lần nào → GET anh/pdf 404 NOT_FOUND', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const anh = await request(server())
        .get(`/orders/${ORDER_ID}/quote/image`)
        .set('Authorization', `Bearer ${token()}`);
      expect(anh.status).toBe(404);
      expect(anh.body.code).toBe(ErrorCode.NOT_FOUND);

      const pdf = await request(server())
        .get(`/orders/${ORDER_ID}/quote/pdf`)
        .set('Authorization', `Bearer ${token()}`);
      expect(pdf.status).toBe(404);
      expect(pdf.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('đơn 0 dòng → POST export-quote 400 VALIDATION_ERROR, KHÔNG render/ghi', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      lineRepo.findMany.mockResolvedValue([]);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/export-quote`)
        .set('Authorization', `Bearer ${token()}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(rendererStub.render).not.toHaveBeenCalled();
      expect(quoteExportRepo.upsert).not.toHaveBeenCalled();
    });

    it('xuất LẦN HAI → 200, vẫn MỘT row QuoteExport (upsert nhánh update), key R2 không đổi', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      const auth = { Authorization: `Bearer ${token()}` };

      const lan1 = await request(server())
        .post(`/orders/${ORDER_ID}/export-quote`)
        .set(auth)
        .send();
      const lan2 = await request(server())
        .post(`/orders/${ORDER_ID}/export-quote`)
        .set(auth)
        .send();

      expect(lan1.status).toBe(200);
      expect(lan2.status).toBe(200);
      expect(quoteExportRepo.upsert).toHaveBeenCalledTimes(2);
      // MỘT slot duy nhất — lần 2 merge update lên row cũ, id giữ nguyên.
      expect(quoteExportRow).not.toBeNull();
      expect((quoteExportRow as Record<string, unknown>).id).toBe('qe-1');
      // Key deterministic — R2 vẫn đúng 2 object (đè, không rác).
      expect([...storageMap.keys()].sort()).toEqual([
        `quotes/${ORDER_ID}/bao-gia.pdf`,
        `quotes/${ORDER_ID}/bao-gia.png`,
      ]);
    });
  });

  describe('ValidationPipe thật + envelope lỗi chuẩn (AD-5)', () => {
    it('dòng tự do thiếu name/unit/unitPrice ⇒ 400 VALIDATION_ERROR kèm fieldErrors', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ qty: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      const fields = (res.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields).toEqual(
        expect.arrayContaining(['name', 'unit', 'unitPrice']),
      );
    });

    it('name dòng tự do toàn whitespace ⇒ 400 (TRIM trước IsNotEmpty — TD-21)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: '   ', unit: 'bộ', qty: 1, unitPrice: 100 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('qty=0 và unitPrice thập phân ⇒ 400 (tiền integer đồng, qty ≥ 1)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Dòng tự do', unit: 'bộ', qty: 0, unitPrice: 100.5 });

      expect(res.status).toBe(400);
      const fields = (res.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields).toEqual(expect.arrayContaining(['qty', 'unitPrice']));
    });

    it('PATCH qty/isFlexible = null ⇒ 400 (null KHÔNG phải "bỏ qua field" trên cột NOT NULL); note = null ⇒ 200 (null nghiệp vụ)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      // Nửa CHẶN: `@IsOptionalNotNull` tha undefined nhưng bắt null đi qua validator —
      // đây là chính cái lỗ mà `PartialType` sẽ mở ra (null lọt xuống cột NOT NULL ⇒ 500).
      const biChan = await request(server())
        .patch(`/orders/${ORDER_ID}/line-items/line-1`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ qty: null, isFlexible: null });

      expect(biChan.status).toBe(400);
      expect(biChan.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      const fields = (biChan.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields).toEqual(expect.arrayContaining(['qty', 'isFlexible']));
      expect(lineRepo.update).not.toHaveBeenCalled();

      // Nửa CHO QUA: `note` nullable ở DB — null là giá trị nghiệp vụ ("xoá ghi chú").
      lineRepo.update.mockResolvedValue({ ...DONG_CATALOG, note: null });
      const choQua = await request(server())
        .patch(`/orders/${ORDER_ID}/line-items/line-1`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ note: null });

      expect(choQua.status).toBe(200);
      expect(choQua.body.note).toBeNull();
    });

    it('dòng tự do vượt trần độ dài (name 500 / unit 50 / note 2000) ⇒ 400 fieldErrors đủ 3 field', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: 'a'.repeat(501),
          unit: 'b'.repeat(51),
          note: 'c'.repeat(2001),
          qty: 1,
          unitPrice: 100_000,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      const fields = (res.body.fieldErrors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields).toEqual(expect.arrayContaining(['name', 'unit', 'note']));
      expect(lineRepo.create).not.toHaveBeenCalled();
    });

    it('đơn không tồn tại ⇒ 404 envelope chuẩn (code/message/traceId)', async () => {
      givenPermissions(PERM.quotesCreateEdit, PERM.ordersViewOwn);
      orderRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get('/orders/khong-co')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
      expect(typeof res.body.message).toBe('string');
      expect(typeof res.body.traceId).toBe('string');
    });

    it('mutation trên đơn đã chốt ⇒ 409 CONFLICT', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productId: PIN_580W.id, qty: 1 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
    });

    it('POST /orders khách chưa tồn tại ⇒ 404 (luồng tạo khách inline nằm ở màn pick)', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      customerRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ customerPhone: '0912345678' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('POST /orders invalid phone ⇒ 400, fieldErrors point at `customerPhone`', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ customerPhone: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('customerPhone');
      expect(orderRepo.create).not.toHaveBeenCalled();
    });

    it('POST /orders with the old body name `customerSdt` ⇒ 400 on `customerPhone` (no alias)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ customerSdt: '0912345678' });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('customerPhone');
      expect(orderRepo.create).not.toHaveBeenCalled();
    });
  });

  /**
   * `GET /orders` — danh sách + follow-up + phạm vi theo QUYỀN (Story 5.3).
   *
   * Phạm vi ở đây là bề mặt bảo mật, không phải tiện nghi UI: một người chỉ có
   * `orders.view_own` mà đọc được đơn người khác là rò dữ liệu khách hàng, và triệu chứng
   * duy nhất là "danh sách hơi dài" — nên ma trận phạm vi được khẳng định ở tầng HTTP thật,
   * nơi guard + pipe + service cùng chạy.
   */
  describe('GET /orders — danh sách, follow-up, phạm vi theo quyền (Story 5.3)', () => {
    const DON_LIST = {
      ...DON_BAOGIA,
      customer: { name: KHACH.name },
    };

    /** `where` mà service thực sự đưa xuống Prisma ở lần gọi `findMany` đầu tiên. */
    function whereDaDung(): Record<string, unknown> {
      const args = orderRepo.findMany.mock.calls[0][0] as {
        where?: Record<string, unknown>;
      };
      return args.where ?? {};
    }

    it('actor CHỈ có view_own ⇒ 200 và where thu hẹp về owner HOẶC assignee của chính mình', async () => {
      givenPermissions(PERM.ordersViewOwn);
      orderRepo.findMany.mockResolvedValue([DON_LIST]);
      orderRepo.count.mockResolvedValue(1);

      const res = await request(server())
        .get('/orders')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(whereDaDung().AND).toEqual([
        {
          OR: [
            { ownerAccountId: ACCOUNT_ID },
            { assigneeAccountId: ACCOUNT_ID },
          ],
        },
      ]);
    });

    it('actor có view_all ⇒ 200 và KHÔNG mệnh đề phạm vi nào (thấy toàn bộ)', async () => {
      givenPermissions(PERM.ordersViewAll);
      orderRepo.findMany.mockResolvedValue([DON_LIST]);
      orderRepo.count.mockResolvedValue(1);

      const res = await request(server())
        .get('/orders')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(whereDaDung().AND).toBeUndefined();
      expect(whereDaDung().OR).toBeUndefined();
    });

    it('actor KHÔNG có key xem đơn nào ⇒ 403, và KHÔNG chạm DB', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .get('/orders')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(orderRepo.findMany).not.toHaveBeenCalled();
    });

    it('trả ENVELOPE { items, total, page, pageSize }, item KHÔNG có tiền/giá vốn', async () => {
      givenPermissions(PERM.ordersViewAll);
      orderRepo.findMany.mockResolvedValue([DON_LIST]);
      orderRepo.count.mockResolvedValue(1);

      const res = await request(server())
        .get('/orders')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      const item = res.body.items[0] as Record<string, unknown>;
      expect(item).not.toHaveProperty('customerSdt');
      expect(item).toMatchObject({
        id: DON_BAOGIA.id,
        status: DON_BAOGIA.status,
        customerPhone: SDT_E164,
        customerName: KHACH.name,
      });
      // Fence tiền/giá vốn: list KHÔNG được lộ tổng tiền hay costPrice (AD-4/AD-10).
      for (const cam of [
        'total',
        'subtotal',
        'amount',
        'costPrice',
        'unitPrice',
      ]) {
        expect(item[cam]).toBeUndefined();
      }
    });

    it('`total` là TỔNG tập đã lọc, KHÔNG phải items.length (nhiều hơn một trang)', async () => {
      givenPermissions(PERM.ordersViewAll);
      orderRepo.findMany.mockResolvedValue([DON_LIST]);
      orderRepo.count.mockResolvedValue(57);

      const res = await request(server())
        .get('/orders?pageSize=1')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(57);
    });

    it('followUp=true ⇒ chỉ lọc trạng thái baogia (đơn chưa chốt, FR-10)', async () => {
      givenPermissions(PERM.ordersViewAll);
      orderRepo.findMany.mockResolvedValue([DON_LIST]);
      orderRepo.count.mockResolvedValue(1);

      const res = await request(server())
        .get('/orders?followUp=true')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(whereDaDung().AND).toEqual([{ status: TRANG_THAI_BAO_GIA }]);
    });

    it('followUp=true + status=dachot ⇒ 400 (hai bộ lọc mâu thuẫn, KHÔNG im lặng trả rỗng)', async () => {
      givenPermissions(PERM.ordersViewAll);

      const res = await request(server())
        .get(`/orders?followUp=true&status=${TRANG_THAI_DA_CHOT}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(orderRepo.findMany).not.toHaveBeenCalled();
    });

    /**
     * Trần + KIỂU của query — `ValidationPipe` là thứ DUY NHẤT đứng giữa query string và
     * Prisma. Thiếu `@Type(() => Number)` thì một CHUỖI lọt xuống `skip`/`take`; thiếu
     * `@Max` thì một request kéo trọn bảng đơn.
     */
    describe('trần + KIỂU của query (AC-7)', () => {
      beforeEach(() => {
        givenPermissions(PERM.ordersViewAll);
        orderRepo.findMany.mockResolvedValue([]);
        orderRepo.count.mockResolvedValue(0);
      });

      it.each([
        ['status rác ngoài 10 khoá', '/orders?status=dangthicong'],
        ['status là khoá cũ đã bỏ', '/orders?status=khong-ton-tai'],
        ['page = 0', '/orders?page=0'],
        ['page âm', '/orders?page=-3'],
        ['pageSize = 101 (vượt trần)', '/orders?pageSize=101'],
        ['pageSize = 0', '/orders?pageSize=0'],
        ['pageSize không phải số', '/orders?pageSize=abc'],
        ['followUp không phải boolean', '/orders?followUp=xyz'],
      ])('%s ⇒ 400 VALIDATION_ERROR và KHÔNG chạm DB', async (_ten, url) => {
        const res = await request(server())
          .get(url)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(orderRepo.findMany).not.toHaveBeenCalled();
      });

      it("page='2' (chuỗi số từ query) ⇒ 200 và `skip` xuống Prisma là NUMBER", async () => {
        const res = await request(server())
          .get('/orders?page=2&pageSize=20')
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        const args = orderRepo.findMany.mock.calls[0][0] as {
          skip: unknown;
          take: unknown;
        };
        expect(typeof args.skip).toBe('number');
        expect(typeof args.take).toBe('number');
        expect(args.skip).toBe(20);
        expect(args.take).toBe(20);
      });

      it('followUp=false kèm status ⇒ 200 và lọc theo status (chỉ followUp=true mới mâu thuẫn)', async () => {
        // Màn lọc gửi cả hai field khi người dùng đang tắt follow-up. Coi mọi `followUp` có
        // mặt là xung đột sẽ chặn oan đúng luồng bình thường của UI.
        const res = await request(server())
          .get(`/orders?followUp=false&status=${TRANG_THAI_DA_CHOT}`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(whereDaDung().AND).toEqual([{ status: TRANG_THAI_DA_CHOT }]);
      });

      it('page/pageSize trong body PHẢN CHIẾU tham số đã gửi, không phải hằng số', async () => {
        // Pager của cả hai màn suy `totalPages` và nút Trước/Sau từ `page`+`pageSize` trong
        // body. Trả cứng `page: 1` làm pager kẹt ở trang đầu dù dữ liệu đã sang trang khác.
        const res = await request(server())
          .get('/orders?page=3&pageSize=5')
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ page: 3, pageSize: 5 });
      });

      it('status hợp lệ ⇒ 200 và mệnh đề status nằm trong where.AND', async () => {
        const res = await request(server())
          .get(`/orders?status=${TRANG_THAI_DA_CHOT}`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(whereDaDung().AND).toEqual([{ status: TRANG_THAI_DA_CHOT }]);
      });
    });

    it('KHÔNG nhận tham số phạm vi từ client (ownerId bị whitelist cắt, không rò đơn người khác)', async () => {
      // Phạm vi là QUYỀN, không phải input. Nếu tham số này có tác dụng, bất kỳ ai cũng đọc
      // được sổ đơn của người khác bằng cách đổi một chữ trên URL.
      givenPermissions(PERM.ordersViewOwn);
      orderRepo.findMany.mockResolvedValue([]);
      orderRepo.count.mockResolvedValue(0);

      const res = await request(server())
        .get('/orders?ownerAccountId=acc-nguoi-khac')
        .set('Authorization', `Bearer ${token()}`);

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(whereDaDung().AND).toEqual([
          {
            OR: [
              { ownerAccountId: ACCOUNT_ID },
              { assigneeAccountId: ACCOUNT_ID },
            ],
          },
        ]);
      }
    });
  });

  describe('GET /orders/:id · /lifecycle · /versions — màn chi tiết (Story 5.4)', () => {
    /** Đơn của NGƯỜI KHÁC: không phải owner, không phải assignee của người gọi. */
    const DON_NGUOI_KHAC = {
      ...DON_BAOGIA,
      ownerAccountId: 'acc-nguoi-khac',
      assigneeAccountId: 'acc-nguoi-khac-2',
    };

    it('AC-4: chỉ view_own + đơn của người khác ⇒ 404 GIỐNG HỆT ca đơn không tồn tại', async () => {
      // 403 ở đây sẽ xác nhận "đơn này có tồn tại" cho người không được thấy nó. Hai body
      // phải không phân biệt được: so cả `code` lẫn `message`.
      givenPermissions(PERM.ordersViewOwn);

      orderRepo.findUnique.mockResolvedValue(DON_NGUOI_KHAC);
      const ngoaiPhamVi = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      orderRepo.findUnique.mockResolvedValue(null);
      const khongTonTai = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(ngoaiPhamVi.status).toBe(404);
      expect(khongTonTai.status).toBe(404);
      expect(ngoaiPhamVi.body.code).toBe(khongTonTai.body.code);
      expect(ngoaiPhamVi.body.message).toBe(khongTonTai.body.message);
      expect(ngoaiPhamVi.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('AC-4: view_all ⇒ đọc được đơn của người khác', async () => {
      givenPermissions(PERM.ordersViewAll);
      orderRepo.findUnique.mockResolvedValue(DON_NGUOI_KHAC);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ORDER_ID);
    });

    it('AC-5: có orders.view_own nhưng KHÔNG có quotes.create_edit ⇒ 200 (preset KE_TOAN/THI_CONG/KHO_GIAO)', async () => {
      // Trước 5.4 ba preset này bị 403: 5.3 cho họ thấy đơn trong danh sách, bấm vào thì
      // cửa khoá. Đây chính là ca đó.
      givenPermissions(PERM.ordersViewOwn);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
    });

    it('không có CẢ HAI orders.view_* ⇒ 403 ở cả ba route (quotes.create_edit KHÔNG còn mở được cửa đọc)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      for (const duong of ['', '/lifecycle', '/versions']) {
        const res = await request(server())
          .get(`/orders/${ORDER_ID}${duong}`)
          .set('Authorization', `Bearer ${token()}`);
        expect(res.status).toBe(403);
      }
    });

    it('/lifecycle: đơn thuong_mai (chỉ Thiết bị) KHÔNG có bước thicong; đơn ca_nhan thì có', async () => {
      givenPermissions(PERM.ordersViewOwn);

      orderRepo.findUnique.mockResolvedValue(DON_BAOGIA); // thiCong=false, vanChuyen=false
      const thuongMai = await request(server())
        .get(`/orders/${ORDER_ID}/lifecycle`)
        .set('Authorization', `Bearer ${token()}`);

      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        scopeThiCong: true,
        scopeVanChuyen: true,
      });
      const caNhan = await request(server())
        .get(`/orders/${ORDER_ID}/lifecycle`)
        .set('Authorization', `Bearer ${token()}`);
      // Built by a map: the service's domain names never reach the wire.
      for (const old of ['buoc', 'buocKeTiep', 'coTheHuy']) {
        expect(caNhan.body).not.toHaveProperty(old);
      }
      expect(Array.isArray(caNhan.body.nextSteps)).toBe(true);
      expect(typeof caNhan.body.canCancel).toBe('boolean');
      expect(caNhan.body.steps[0]).not.toHaveProperty('trangThai');

      expect(thuongMai.status).toBe(200);
      const buocThuongMai = (
        thuongMai.body.steps as Array<{ status: string }>
      ).map((b) => b.status);
      expect(buocThuongMai).not.toContain('thicong');
      expect(buocThuongMai).not.toContain('danggiao');

      const buocCaNhan = (caNhan.body.steps as Array<{ status: string }>).map(
        (b) => b.status,
      );
      expect(buocCaNhan).toContain('thicong');
      // Bước đơn đang đứng phải được đánh dấu — stepper thiếu `current` là stepper câm.
      expect(
        (caNhan.body.steps as Array<{ status: string; progress: string }>).find(
          (b) => b.status === 'baogia',
        )?.progress,
      ).toBe('current');
    });

    it('/versions: mọi bản theo versionNo tăng dần, ĐÚNG MỘT bản isCurrent — và nó theo CON TRỎ, không theo versionNo lớn nhất', async () => {
      // ⚠️ Fixture cố ý trỏ `currentVersionId` vào bản CŨ hơn. Với fixture "tự nhiên"
      // (con trỏ luôn ở bản mới nhất) thì một cài đặt sai theo `max(versionNo)` vẫn xanh —
      // ca này là chốt chặn của AD-6.
      givenPermissions(PERM.ordersViewOwn);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        currentVersionId: 'ver-1',
      });
      orderVersionRepo.findMany.mockResolvedValue([
        {
          id: 'ver-1',
          versionNo: 1,
          createdAt: new Date('2026-07-16T01:00:00Z'),
          chotAt: null,
          createdByAccountId: ACCOUNT_ID,
          createdBy: { displayName: 'Nguyễn Quản Lý' },
          lineItems: [
            {
              productId: 'prod-pin',
              name: 'Tấm pin',
              unit: 'tấm',
              qty: 8,
              displayOrder: 0,
            },
          ],
        },
        {
          id: 'ver-2',
          versionNo: 2,
          createdAt: new Date('2026-07-17T01:00:00Z'),
          chotAt: null,
          createdByAccountId: null,
          createdBy: null,
          // ⚠️ Bản 2 có SỐ DÒNG KHÁC bản 1 có chủ đích: với hai bản cùng số dòng,
          // `lineCount` lấy nhầm từ bản khác (hoặc từ bản đầu) vẫn xanh ở mọi assert.
          lineItems: [
            {
              productId: 'prod-pin',
              name: 'Tấm pin',
              unit: 'tấm',
              qty: 12,
              displayOrder: 0,
            },
            {
              productId: 'prod-inverter',
              name: 'Inverter',
              unit: 'bộ',
              qty: 1,
              displayOrder: 1,
            },
          ],
        },
      ]);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}/versions`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      const items = res.body.items as Array<
        Record<string, unknown> & {
          versionNo: number;
          isCurrent: boolean;
          confirmedAt: string | null;
          createdByDisplayName: string | null;
          lineCount: number;
          changes: {
            added: string[];
            removed: string[];
            qtyChanged: Array<{ name: string; from: number; to: number }>;
          };
        }
      >;
      expect(items.map((v) => v.versionNo)).toEqual([1, 2]);
      expect(items.filter((v) => v.isCurrent)).toHaveLength(1);
      // Bản HIỆU LỰC là bản CŨ (con trỏ), không phải bản versionNo lớn nhất.
      expect(items[0].isCurrent).toBe(true);
      expect(items[1].isCurrent).toBe(false);
      expect(items[0].confirmedAt).toBeNull();

      // Bản gốc: không có gì để so. Bản 2: đổi số lượng 8 → 12.
      expect(items[0].changes).toEqual({
        added: [],
        removed: [],
        qtyChanged: [],
      });
      expect(items[1].changes.qtyChanged).toEqual([
        { name: 'Tấm pin', from: 8, to: 12 },
      ]);
      // Chiều diff: bản N so với bản N-1. Đảo hai đối số thì dòng mới thành "xoá" —
      // lịch sử kể ngược chuyện đã xảy ra, và không assert nào khác thấy được.
      expect(items[1].changes.added).toEqual(['Inverter']);
      expect(items[1].changes.removed).toEqual([]);

      // Bản cũ không có actor ⇒ null, KHÔNG bịa tên.
      expect(items[0].createdByDisplayName).toBe('Nguyễn Quản Lý');
      expect(items[1].createdByDisplayName).toBeNull();
      // `lineCount` là số dòng của CHÍNH bản đó — hai giá trị khác nhau, không một hằng chép.
      expect(items.map((v) => v.lineCount)).toEqual([1, 2]);
      // Built by a map, not a cast of the service row: the old keys never reach the wire.
      for (const old of ['laBanHienLuc', 'chotAt', 'soDong', 'thayDoi']) {
        expect(items[1][old]).toBeUndefined();
      }
    });

    it('/versions: KHÔNG trả tiền/giá (AD-10 — tiền chỉ qua preview-total)', async () => {
      givenPermissions(PERM.ordersViewOwn);
      orderVersionRepo.findMany.mockResolvedValue([
        {
          id: VERSION_ID,
          versionNo: 1,
          createdAt: new Date('2026-07-16T01:00:00Z'),
          chotAt: null,
          createdByAccountId: null,
          createdBy: null,
          lineItems: [],
        },
      ]);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}/versions`)
        .set('Authorization', `Bearer ${token()}`);

      const raw = JSON.stringify(res.body);
      for (const cam of ['unitPrice', 'amount', 'total', 'costPrice']) {
        expect(raw).not.toContain(cam);
      }
    });
  });

  /**
   * Story 5.5 — chuyển trạng thái thủ công + ảnh đính kèm, ĐO Ở TẦNG DÂY.
   *
   * Unit test của lane này gọi thẳng `OrdersService`, nên nó KHÔNG đi qua ba thứ chỉ tồn tại
   * ở tầng HTTP — và cả ba đều là chỗ AC-9 có thể chết im lặng:
   *
   *  1. `FilesInterceptor` (multer). Trần cứng của interceptor đặt CAO HƠN giới hạn hợp đồng
   *     một cách có chủ đích. Hạ nó xuống bằng hợp đồng trông như dọn dẹp hợp lý, nhưng khi
   *     đó multer ném TRƯỚC handler ⇒ envelope `VALIDATION_ERROR` + `fieldErrors` mà AC-9
   *     đòi biến mất. Không unit test nào thấy được điều đó vì multer không chạy ở đó.
   *  2. `ValidationPipe` + `@IsIn(SU_KIEN_THU_CONG)` trên body multipart — field text của
   *     form đi đường khác body JSON.
   *  3. `StreamableFile` → header thật (`content-type`, `content-disposition`).
   */
  describe('Story 5.5 — POST /orders/:id/transition · GET /orders/:id/attachments/:id', () => {
    /** Đơn ở `dacoc`, bật cờ Thi công + Vận chuyển ⇒ hai bước kế cùng mở. */
    const DON_DACOC = {
      ...DON_BAOGIA,
      status: 'dacoc',
      scopeThiCong: true,
      scopeVanChuyen: true,
    };

    /** Quyền đủ cho cả ba nhánh của lane thủ công + đọc đơn. */
    function quyenDuLaneThuCong(): void {
      givenPermissions(
        PERM.ordersViewAll,
        PERM.constructionTransition,
        PERM.deliveryConfirm,
        PERM.paymentsRecord,
      );
    }

    function binaryParser(
      res: request.Response,
      callback: (err: Error | null, body: Buffer) => void,
    ): void {
      const stream = res as unknown as NodeJS.ReadableStream;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => callback(null, Buffer.concat(chunks)));
    }

    /** Một request multipart: field `event` + N file trên field `files`. */
    function post(
      event: string,
      files: readonly { name: string; mime: string; size: number }[] = [],
    ): request.Test {
      const req = request(server())
        .post(`/orders/${ORDER_ID}/transition`)
        .set('Authorization', `Bearer ${token()}`)
        .field('event', event);
      for (const f of files) {
        req.attach('files', Buffer.alloc(f.size, 0x41), {
          filename: f.name,
          contentType: f.mime,
        });
      }
      return req;
    }

    function anh(
      ghiDe: Partial<{ name: string; mime: string; size: number }> = {},
    ) {
      return {
        name: ghiDe.name ?? 'cong-truong.jpg',
        mime: ghiDe.mime ?? 'image/jpeg',
        size: ghiDe.size ?? 1024,
      };
    }

    beforeEach(() => {
      orderRepo.findUnique.mockResolvedValue(DON_DACOC);
      quyenDuLaneThuCong();
    });

    describe('đường hạnh phúc qua dây (AC-1, AC-2, AC-3)', () => {
      it('không ảnh ⇒ 200, savedAttachmentCount 0 — upload LUÔN optional (FR-23)', async () => {
        const res = await post(SU_KIEN.batDauThiCong);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('thicong');
        expect(res.body.savedAttachmentCount).toBe(0);
        expect(typeof res.body.occurredAt).toBe('string');
        expect(storageMap.size).toBe(0);
      });

      // The form field was renamed with no alias on this route too: a file under the old
      // name is rejected before the handler, so no transition and nothing stored.
      it('a file under the old form field `anh` ⇒ 400 envelope, no transition, nothing stored', async () => {
        const res = await request(server())
          .post(`/orders/${ORDER_ID}/transition`)
          .set('Authorization', `Bearer ${token()}`)
          .field('event', SU_KIEN.batDauThiCong)
          .attach('anh', Buffer.alloc(512, 0x41), {
            filename: 'cong-truong.jpg',
            contentType: 'image/jpeg',
          });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(typeof res.body.traceId).toBe('string');
        expect(res.body).not.toHaveProperty('status');
        expect(attachmentRepo.createMany).not.toHaveBeenCalled();
        expect(storageMap.size).toBe(0);
      });

      it('kèm 2 ảnh ⇒ 200, bytes lên storage, metadata xuống DB, audit ghi StatusChanged', async () => {
        const res = await post(SU_KIEN.batDauThiCong, [
          anh(),
          anh({ name: 'mai-nha.png', mime: 'image/png' }),
        ]);

        expect(res.status).toBe(200);
        expect(res.body.savedAttachmentCount).toBe(2);
        expect(storageMap.size).toBe(2);

        // Metadata trỏ đúng object đã ghi — hàng DB mồ côi là ảnh vô hình.
        const { data } = attachmentRepo.createMany.mock.calls[0][0];
        expect(data).toHaveLength(2);
        for (const hang of data) {
          expect(storageMap.has(hang.objectKey)).toBe(true);
          expect(hang.orderId).toBe(ORDER_ID);
          expect(hang.uploadedByAccountId).toBe(ACCOUNT_ID);
        }

        // AD-18: producer không gọi audit trực tiếp — subscriber THẬT ghi sau commit.
        expect(auditRepo.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            eventType: 'StatusChanged',
            actorAccountId: ACCOUNT_ID,
            targetType: 'Order',
            targetId: ORDER_ID,
          }),
        });
      });

      it('ĐUÔI OBJECT KEY suy từ MIME, không từ đuôi client gửi', async () => {
        // Cả hai file mang tên `.jpg`; file thứ hai khai `image/png`.
        await post(SU_KIEN.batDauThiCong, [
          anh(),
          anh({ name: 'noi-dung-that-la-png.jpg', mime: 'image/png' }),
        ]);

        const keys = [...storageMap.keys()];
        expect(
          keys.every((k) => k.startsWith(`attachments/${ORDER_ID}/`)),
        ).toBe(true);
        expect(keys.some((k) => k.endsWith('.png'))).toBe(true);
      });
    });

    /**
     * ĐÂY LÀ LÝ DO SUITE NÀY TỒN TẠI. Mỗi test dưới đây chết nếu trần cứng của interceptor
     * bị hạ xuống bằng giới hạn hợp đồng — ca mà toàn bộ lane unit vẫn xanh.
     */
    describe('AC-9 giữ được envelope 400 dù đi qua multer', () => {
      it(`${SO_ANH_TOI_DA + 1} ảnh ⇒ 400 VALIDATION_ERROR + fieldErrors, KHÔNG 500/413`, async () => {
        const res = await post(
          SU_KIEN.batDauThiCong,
          Array.from({ length: SO_ANH_TOI_DA + 1 }, () => anh()),
        );

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].code).toBe('maxCount');
        expect(res.body.traceId).toBeDefined();
        // Transition KHÔNG chạy và không byte nào nằm lại storage.
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
        expect(storageMap.size).toBe(0);
      });

      it('ảnh quá dung lượng hợp đồng ⇒ 400 `maxSize`, KHÔNG 413 của multer', async () => {
        const res = await post(SU_KIEN.batDauThiCong, [
          anh({ size: KICH_THUOC_TOI_DA_BYTE + 1 }),
        ]);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].code).toBe('maxSize');
        expect(storageMap.size).toBe(0);
      });

      it('mime ngoài allow-list ⇒ 400 `mimeType`, transition KHÔNG chạy', async () => {
        const res = await post(SU_KIEN.batDauThiCong, [
          anh({ name: 'ke-hoach.jpg', mime: 'application/pdf' }),
        ]);

        expect(res.status).toBe(400);
        expect(res.body.fieldErrors[0].code).toBe('mimeType');
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      });
    });

    describe('ValidationPipe trên field text của form multipart', () => {
      it('event lạ ⇒ 400, không chạm service', async () => {
        const res = await post('bay_len_troi');

        expect(res.status).toBe(400);
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      });

      it('thiếu hẳn field `event` ⇒ 400', async () => {
        const res = await request(server())
          .post(`/orders/${ORDER_ID}/transition`)
          .set('Authorization', `Bearer ${token()}`)
          .field('khong-phai-event', 'x');

        expect(res.status).toBe(400);
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      });
    });

    /**
     * AC-13 đo ở tầng dây. Năm sự kiện này có cửa riêng mang theo logic riêng (snapshot giá,
     * lý do huỷ, lane auto). Đi tắt qua đây là đổi status mà bỏ hết phần còn lại — đơn
     * `dachot` có giá vẫn trôi theo danh mục. Điều BẤT BIẾN là: KHÔNG bao giờ 2xx, và
     * `Order.status` không đổi. Mã lỗi cụ thể do tầng nào chặn trước quyết định.
     */
    describe('AC-13 — năm sự kiện có cửa riêng bị chặn qua dây', () => {
      const CUA_RIENG = [
        SU_KIEN.chot,
        SU_KIEN.moLai,
        SU_KIEN.huy,
        SU_KIEN.duCoc,
        SU_KIEN.apChietKhau,
      ];

      it.each(CUA_RIENG)(
        '`%s` KHÔNG bao giờ 2xx và Order.status không đổi',
        async (event) => {
          // Quyền RỘNG nhất có thể — kể cả key của các cửa riêng. Nếu ca này lọt thì lọt
          // vì logic, không vì thiếu quyền.
          givenPermissions(
            PERM.ordersViewAll,
            PERM.constructionTransition,
            PERM.deliveryConfirm,
            PERM.paymentsRecord,
            PERM.quotesCreateEdit,
            PERM.ordersConfirm,
          );

          const res = await post(event, [anh()]);

          expect(res.status).toBeGreaterThanOrEqual(400);
          expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
          expect(storageMap.size).toBe(0);
        },
      );

      /**
       * MÃ LỖI, không chỉ "không 2xx". Sự kiện có cửa riêng là xung đột NGHIỆP VỤ: tên sự
       * kiện có thật, bảng transition chấp nhận nó, chỉ riêng CỬA NÀY từ chối. AC-13 và
       * `@ApiConflictResponse` của route đều gọi đó là 409 CONFLICT.
       *
       * Test này canh đúng chỗ từng lệch: siết `@IsIn` về `SU_KIEN_THU_CONG` khiến
       * `ValidationPipe` nuốt thành 400 và whitelist 409 trong service không bao giờ tới
       * lượt — unit test của service vẫn xanh vì nó gọi thẳng service, bỏ qua pipe.
       */
      it.each(CUA_RIENG)(
        '`%s` trả 409 CONFLICT với thông điệp của lane thủ công (AC-13)',
        async (event) => {
          givenPermissions(
            PERM.ordersViewAll,
            PERM.constructionTransition,
            PERM.deliveryConfirm,
            PERM.paymentsRecord,
            PERM.quotesCreateEdit,
            PERM.ordersConfirm,
          );

          const res = await post(event);

          expect(res.status).toBe(409);
          expect(res.body.code).toBe(ErrorCode.CONFLICT);
          expect(res.body.message).toBe(
            'Bước này không chuyển được ở màn Chuyển trạng thái.',
          );
        },
      );

      /** Tên sự kiện KHÔNG TỒN TẠI vẫn là body sai cú pháp ⇒ 400, không phải 409. */
      it('sự kiện không có trong bảng vẫn 400 tại ValidationPipe, không 409', async () => {
        const res = await post('khong-co-that');

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      });
    });

    describe('từ chối qua dây (AC-5, AC-6, AC-7)', () => {
      it('thiếu quyền của BƯỚC (vẫn qua được gate cửa) ⇒ 403, status không đổi', async () => {
        // `delivery.confirm` mở được cửa route nhưng KHÔNG mở được `bat_dau_thi_cong`.
        givenPermissions(PERM.ordersViewAll, PERM.deliveryConfirm);

        const res = await post(SU_KIEN.batDauThiCong, [anh()]);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
        expect(res.body.message).toBe(
          'Bạn không có quyền thực hiện chuyển trạng thái này.',
        );
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
        // AC-7 + pre-check: không hàng Attachment, không byte nào lên storage.
        expect(attachmentRepo.createMany).not.toHaveBeenCalled();
        expect(storageMap.size).toBe(0);
      });

      it('BẤM HAI LẦN: đơn đã ở đích ⇒ 409, không no-op im lặng', async () => {
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          status: 'thicong',
        });

        const res = await post(SU_KIEN.batDauThiCong);

        expect(res.status).toBe(409);
        expect(res.body.code).toBe(ErrorCode.CONFLICT);
        expect(res.body.message).toBe(
          'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
        );
      });

      it('bước ngoài phạm vi đơn ⇒ 409 với thông điệp PHẠM VI', async () => {
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          scopeThiCong: false,
        });

        const res = await post(SU_KIEN.batDauThiCong);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe('Bước này không thuộc phạm vi của đơn.');
      });

      it('đơn của NGƯỜI KHÁC (chỉ view_own) ⇒ 404, không rò việc đơn có tồn tại', async () => {
        givenPermissions(PERM.ordersViewOwn, PERM.constructionTransition);
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          ownerAccountId: 'acc-nguoi-khac',
          assigneeAccountId: null,
        });

        const res = await post(SU_KIEN.batDauThiCong, [anh()]);

        expect(res.status).toBe(404);
        expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
        expect(storageMap.size).toBe(0);
      });
    });

    /**
     * The door gate is derived from the transition table, not a hand-kept list: each key a
     * manual-lane row requires opens the door on its own, and keys of the dedicated doors
     * (confirm / reopen / cancel) never do.
     */
    describe('door gate derived from the table (Story 8.4)', () => {
      it('only `orders.view_own` + `construction.transition` on an own order ⇒ through the door, 200', async () => {
        givenPermissions(PERM.ordersViewOwn, PERM.constructionTransition);

        const res = await post(SU_KIEN.batDauThiCong);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('thicong');
      });

      it('only `payments.record` closes an equipment-only order ⇒ 200 `hoanthanh`', async () => {
        givenPermissions(PERM.ordersViewAll, PERM.paymentsRecord);
        orderRepo.findUnique.mockResolvedValue({
          ...DON_BAOGIA,
          status: 'dachot',
        });
        stockVoucherRepo.findUnique.mockResolvedValue({
          id: 'stock-out-1',
          seq: 97,
          type: 'xuat',
          note: null,
          orderId: ORDER_ID,
          createdAt: new Date('2026-10-21T04:00:00Z'),
          createdBy: { id: ACCOUNT_ID, displayName: 'Kho' },
          lines: [],
        });

        const res = await post(SU_KIEN.hoanThanh);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('hoanthanh');
      });

      it('every dedicated door gates exactly the `requires` of its table rows — no hand-kept second key', () => {
        const requiresOf = (event: TransitionEvent): string[] => [
          ...new Set(
            ALLOWED_TRANSITIONS.filter((rule) => rule.event === event).map(
              (rule) => rule.requires,
            ),
          ),
        ];
        const metaOf = (
          key: string,
          handler: keyof OrdersController,
        ): unknown =>
          Reflect.getMetadata(key, OrdersController.prototype[handler]);
        const doors: [keyof OrdersController, TransitionEvent][] = [
          ['confirm', SU_KIEN.chot],
          ['revise', SU_KIEN.moLai],
          ['cancel', SU_KIEN.huy],
          ['applyDiscount', SU_KIEN.apChietKhau],
          ['resolveDiscount', SU_KIEN.tuChoiChietKhau],
        ];
        for (const [handler, event] of doors) {
          const required = requiresOf(event);
          expect({ handler, required: required.length }).toEqual({
            handler,
            required: 1,
          });
          expect({
            handler,
            gate: metaOf(REQUIRE_PERMISSIONS_KEY, handler),
          }).toEqual({ handler, gate: required });
        }
        expect(metaOf(REQUIRE_ANY_PERMISSION_KEY, 'transition')).toEqual([
          ...MANUAL_TRANSITION_PERMISSIONS,
        ]);
      });

      it('`quotes.create_edit` + `orders.confirm` + view ⇒ 403 at the door, nothing written', async () => {
        givenPermissions(
          PERM.ordersViewAll,
          PERM.quotesCreateEdit,
          PERM.ordersConfirm,
        );

        const res = await post(SU_KIEN.batDauThiCong, [anh()]);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
        expect(res.body.message).toBe('Không đủ quyền thực hiện');
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
        expect(storageMap.size).toBe(0);
      });
    });

    describe('AC-8 — proxy đọc bytes', () => {
      const OBJECT_KEY = `attachments/${ORDER_ID}/att-1.jpg`;
      const HANG_ANH = {
        id: 'att-1',
        orderId: ORDER_ID,
        objectKey: OBJECT_KEY,
        fileName: 'cong-truong.jpg',
        contentType: 'image/jpeg',
      };
      const BYTES = Buffer.from('bytes-anh-cong-truong');

      it('trả đúng bytes + content-type + disposition', async () => {
        storageMap.set(OBJECT_KEY, {
          body: BYTES,
          contentType: 'image/jpeg',
        });
        attachmentRepo.findFirst.mockResolvedValue(HANG_ANH);

        const res = await request(server())
          .get(`/orders/${ORDER_ID}/attachments/att-1`)
          .set('Authorization', `Bearer ${token()}`)
          .buffer(true)
          .parse(binaryParser);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('image/jpeg');
        expect(res.headers['content-disposition']).toContain('cong-truong.jpg');
        expect((res.body as Buffer).equals(BYTES)).toBe(true);
      });

      it('đơn NGOÀI PHẠM VI ⇒ 404 và KHÔNG rò một byte nào', async () => {
        givenPermissions(PERM.ordersViewOwn);
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          ownerAccountId: 'acc-nguoi-khac',
          assigneeAccountId: null,
        });
        storageMap.set(OBJECT_KEY, { body: BYTES, contentType: 'image/jpeg' });
        attachmentRepo.findFirst.mockResolvedValue(HANG_ANH);

        const res = await request(server())
          .get(`/orders/${ORDER_ID}/attachments/att-1`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(404);
        expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
        expect(JSON.stringify(res.body)).not.toContain(BYTES.toString());
      });

      it('ảnh không thuộc đơn ⇒ 404 CÙNG thông điệp — không xác nhận ảnh có thật', async () => {
        attachmentRepo.findFirst.mockResolvedValue(null);

        const res = await request(server())
          .get(`/orders/${ORDER_ID}/attachments/att-cua-don-khac`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(404);
        expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
      });
    });

    /**
     * Story 5.6 — ảnh bổ sung qua dây.
     *
     * Mã HTTP chỉ đo được ở lane này: unit test khẳng định `AppException` mang
     * status 403/404, nhưng cái người dùng nhận là kết quả của `AllExceptionsFilter`
     * dựng envelope trên đường ra. 5.5 đã có tiền lệ hai con số lệch nhau.
     */
    describe('Story 5.6 — ảnh bổ sung qua dây', () => {
      const HANG_ANH_NGUOI_KHAC = {
        id: 'att-nguoi-khac',
        orderId: ORDER_ID,
        uploadedByAccountId: 'acc-ai-do-khac',
        objectKey: `attachments/${ORDER_ID}/att-nguoi-khac.jpg`,
        fileName: 'nghiem-thu.jpg',
        contentType: 'image/jpeg',
        size: 2048,
        statusFrom: 'dacoc',
        statusTo: 'thicong',
        occurredAt: new Date('2026-07-18T03:00:00Z'),
        createdAt: new Date('2026-07-18T03:00:00Z'),
      };

      it('GET danh sách ⇒ 200 với items + coTheXoa, KHÔNG rò objectKey (AC-4)', async () => {
        attachmentRepo.findMany.mockResolvedValue([
          { ...HANG_ANH_NGUOI_KHAC, uploadedBy: { displayName: 'Trần Thợ' } },
        ]);

        const res = await request(server())
          .get(`/orders/${ORDER_ID}/attachments`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].uploadedBy).toBe('Trần Thợ');
        expect(res.body.items[0]).toHaveProperty('canDelete');
        expect(res.body.items[0]).not.toHaveProperty('nguoiTaiLen');
        expect(res.body.items[0]).not.toHaveProperty('coTheXoa');
        expect(JSON.stringify(res.body)).not.toContain('attachments/');
      });

      it('DELETE ảnh của người khác khi KHÔNG có quyền sửa đơn ⇒ 403 qua dây (AC-7)', async () => {
        // Quyền đủ mở CỬA NGOÀI (gate HTTP), nhưng luật hàng vẫn chặn: cửa thật
        // là "người tải lên HOẶC có quyền chỉnh sửa đơn".
        givenPermissions(PERM.ordersViewAll, PERM.constructionTransition);
        attachmentRepo.findFirst.mockResolvedValue(HANG_ANH_NGUOI_KHAC);

        const res = await request(server())
          .delete(`/orders/${ORDER_ID}/attachments/att-nguoi-khac`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
        expect(res.body.message).toBe('Bạn không có quyền xoá ảnh này.');
        expect(attachmentRepo.delete).not.toHaveBeenCalled();
      });

      it('DELETE thành công ⇒ 204 không body', async () => {
        givenPermissions(PERM.ordersViewAll, PERM.quotesCreateEdit);
        attachmentRepo.findFirst.mockResolvedValue(HANG_ANH_NGUOI_KHAC);
        attachmentRepo.delete.mockResolvedValue(HANG_ANH_NGUOI_KHAC);

        const res = await request(server())
          .delete(`/orders/${ORDER_ID}/attachments/att-nguoi-khac`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(204);
        expect(attachmentRepo.delete).toHaveBeenCalledWith({
          where: { id: 'att-nguoi-khac' },
        });
      });

      it('POST ảnh hợp lệ ⇒ 201 + attachmentIds (AC-9)', async () => {
        attachmentRepo.createMany.mockResolvedValue({ count: 1 });

        const res = await request(server())
          .post(`/orders/${ORDER_ID}/attachments`)
          .set('Authorization', `Bearer ${token()}`)
          .attach('files', Buffer.alloc(1024, 0x41), {
            filename: 'bo-sung.jpg',
            contentType: 'image/jpeg',
          });

        expect(res.status).toBe(201);
        expect(res.body.savedAttachmentCount).toBe(1);
        expect(res.body).not.toHaveProperty('soAnhDaLuu');
        expect(res.body.attachmentIds).toHaveLength(1);
        // Ba cột toạ độ null — hàng này không thuộc bước nào.
        const hang = attachmentRepo.createMany.mock.calls[0][0].data[0];
        expect(hang.statusFrom).toBeNull();
        expect(hang.statusTo).toBeNull();
        expect(hang.occurredAt).toBeNull();
      });

      it('POST ảnh sai định dạng ⇒ 400 + fieldErrors giữ được envelope qua multer (AC-10)', async () => {
        const res = await request(server())
          .post(`/orders/${ORDER_ID}/attachments`)
          .set('Authorization', `Bearer ${token()}`)
          .attach('files', Buffer.alloc(512, 0x41), {
            filename: 'hop-dong.pdf',
            contentType: 'application/pdf',
          });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].code).toBe('mimeType');
        expect(attachmentRepo.createMany).not.toHaveBeenCalled();
      });

      /** Một request multipart chỉ gồm N file trên field `anh` — route ảnh bổ sung. */
      function postAnh(
        files: readonly { name: string; mime: string; size: number }[],
      ): request.Test {
        const req = request(server())
          .post(`/orders/${ORDER_ID}/attachments`)
          .set('Authorization', `Bearer ${token()}`);
        for (const f of files) {
          req.attach('files', Buffer.alloc(f.size, 0x41), {
            filename: f.name,
            contentType: f.mime,
          });
        }
        return req;
      }

      /**
       * Trần cứng multer của route này CỐ Ý cao hơn ngưỡng hợp đồng. Hạ nó xuống bằng
       * ngưỡng hợp đồng ⇒ `MulterError` bắn TRƯỚC handler ⇒ 500/413 thay vì 400 +
       * `fieldErrors` mà AC-10 đòi. Toàn bộ lane unit mù với thay đổi đó vì nó gọi thẳng
       * service, không đi qua interceptor.
       */
      describe('AC-10 — envelope 400 sống sót qua multer trên route ảnh bổ sung', () => {
        it('no file ⇒ 400 `minCount` on `files`', async () => {
          const res = await postAnh([]);

          expect(res.status).toBe(400);
          expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(res.body.fieldErrors[0]).toMatchObject({
            field: 'files',
            code: 'minCount',
          });
          expect(attachmentRepo.createMany).not.toHaveBeenCalled();
        });

        // The form field was renamed with no alias: a file sent under the old name is not
        // taken as `files`, and the rejection is a 4xx envelope, never a 500.
        it('a file under the old form field `anh` ⇒ 400 envelope, nothing stored', async () => {
          const res = await request(server())
            .post(`/orders/${ORDER_ID}/attachments`)
            .set('Authorization', `Bearer ${token()}`)
            .attach('anh', Buffer.alloc(512, 0x41), {
              filename: 'bo-sung.jpg',
              contentType: 'image/jpeg',
            });

          expect(res.status).toBe(400);
          expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(typeof res.body.traceId).toBe('string');
          expect(attachmentRepo.createMany).not.toHaveBeenCalled();
          expect(storageMap.size).toBe(0);
        });

        it(`${SO_ANH_TOI_DA + 1} ảnh ⇒ 400 \`maxCount\`, KHÔNG 500/413`, async () => {
          const res = await postAnh(
            Array.from({ length: SO_ANH_TOI_DA + 1 }, () => anh()),
          );

          expect(res.status).toBe(400);
          expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(res.body.fieldErrors[0].code).toBe('maxCount');
          expect(res.body.traceId).toBeDefined();
          expect(attachmentRepo.createMany).not.toHaveBeenCalled();
          expect(storageMap.size).toBe(0);
        });

        it('ảnh vượt dung lượng hợp đồng ⇒ 400 `maxSize`, KHÔNG 413 của multer', async () => {
          const res = await postAnh([
            anh({ size: KICH_THUOC_TOI_DA_BYTE + 1 }),
          ]);

          expect(res.status).toBe(400);
          expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(res.body.fieldErrors[0].code).toBe('maxSize');
          expect(attachmentRepo.createMany).not.toHaveBeenCalled();
          expect(storageMap.size).toBe(0);
        });
      });

      /**
       * AC-5 qua dây: quyền đủ mở CỬA HTTP nhưng đơn không thuộc phạm vi actor ⇒ 404 với
       * đúng thông điệp "không tìm thấy đơn". Fake `findFirst` áp chính mệnh đề phạm vi mà
       * service gửi xuống, nên bỏ `findScopedOrThrow` khỏi một route là ca đó đỏ.
       */
      describe('AC-5 — đơn ngoài phạm vi ⇒ 404 ở CẢ BA route', () => {
        beforeEach(() => {
          orderRepo.findUnique.mockResolvedValue({
            ...DON_DACOC,
            ownerAccountId: 'acc-nguoi-khac',
            assigneeAccountId: 'acc-nguoi-khac-2',
          });
          // Không có `ordersViewAll` ⇒ phạm vi thu hẹp; vẫn đủ quyền qua gate của cả ba route.
          givenPermissions(PERM.ordersViewOwn, PERM.constructionTransition);
          attachmentRepo.findFirst.mockResolvedValue(HANG_ANH_NGUOI_KHAC);
        });

        it('GET danh sách ⇒ 404, KHÔNG chạm bảng attachments', async () => {
          const res = await request(server())
            .get(`/orders/${ORDER_ID}/attachments`)
            .set('Authorization', `Bearer ${token()}`);

          expect(res.status).toBe(404);
          expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
          expect(res.body.message).toContain('Không tìm thấy đơn hàng');
          expect(attachmentRepo.findMany).not.toHaveBeenCalled();
        });

        it('POST ⇒ 404, KHÔNG byte nào lên storage', async () => {
          const res = await postAnh([anh()]);

          expect(res.status).toBe(404);
          expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
          expect(attachmentRepo.createMany).not.toHaveBeenCalled();
          expect(storageMap.size).toBe(0);
        });

        it('DELETE ⇒ 404, hàng DB và object R2 còn nguyên', async () => {
          const res = await request(server())
            .delete(`/orders/${ORDER_ID}/attachments/att-nguoi-khac`)
            .set('Authorization', `Bearer ${token()}`);

          expect(res.status).toBe(404);
          expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
          expect(attachmentRepo.delete).not.toHaveBeenCalled();
          expect(deleteObjectStub).not.toHaveBeenCalled();
        });
      });

      /**
       * AC-8 qua dây. Unit test canh THỨ TỰ hai lệnh; lane này canh hai thứ khác: bytes
       * thật sự rời storage, và lỗi R2 sau commit không bao giờ thành 500 cho người dùng.
       */
      describe('AC-8 — xoá DB trước, R2 sau, lỗi R2 bị nuốt', () => {
        beforeEach(() => {
          givenPermissions(PERM.ordersViewAll, PERM.quotesCreateEdit);
          attachmentRepo.findFirst.mockResolvedValue(HANG_ANH_NGUOI_KHAC);
          attachmentRepo.delete.mockResolvedValue(HANG_ANH_NGUOI_KHAC);
          storageMap.set(HANG_ANH_NGUOI_KHAC.objectKey, {
            body: Buffer.from('bytes'),
            contentType: 'image/jpeg',
          });
        });

        it('204 ⇒ object R2 biến mất thật, đúng objectKey của hàng đã xoá', async () => {
          const res = await request(server())
            .delete(`/orders/${ORDER_ID}/attachments/att-nguoi-khac`)
            .set('Authorization', `Bearer ${token()}`);

          expect(res.status).toBe(204);
          expect(deleteObjectStub).toHaveBeenCalledWith(
            HANG_ANH_NGUOI_KHAC.objectKey,
          );
          expect(storageMap.has(HANG_ANH_NGUOI_KHAC.objectKey)).toBe(false);
        });

        it('R2 chớp sau khi DB commit ⇒ VẪN 204, không rò 500 ra người dùng', async () => {
          deleteObjectStub.mockRejectedValueOnce(new Error('R2 down'));

          const res = await request(server())
            .delete(`/orders/${ORDER_ID}/attachments/att-nguoi-khac`)
            .set('Authorization', `Bearer ${token()}`);

          expect(res.status).toBe(204);
          expect(attachmentRepo.delete).toHaveBeenCalled();
        });
      });
    });

    describe('AC-4/AC-11 — `buocKeTiep` trên response /lifecycle', () => {
      it('trả bước kế lọc theo quyền THẬT của actor', async () => {
        givenPermissions(PERM.ordersViewAll, PERM.deliveryConfirm);

        const res = await request(server())
          .get(`/orders/${ORDER_ID}/lifecycle`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(
          res.body.nextSteps.map((b: { event: string }) => b.event),
        ).toEqual([SU_KIEN.batDauGiao]);
      });

      it('AC-11: không còn bước nào ⇒ mảng RỖNG, stepper vẫn đủ (client ẩn hẳn nút)', async () => {
        givenPermissions(PERM.ordersViewAll);

        const res = await request(server())
          .get(`/orders/${ORDER_ID}/lifecycle`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(res.body.nextSteps).toEqual([]);
        expect(res.body.steps.length).toBeGreaterThan(0);
      });
    });

    /**
     * NHÁNH THI CÔNG ĐI HẾT CHUỖI QUA DÂY: `thicong → nghiemthu → hoanthanh`.
     *
     * Cạnh vào nhánh (`dacoc → thicong`) đã được canh ở các describe trên. Hai cạnh CÒN LẠI
     * chưa từng chạy qua lane HTTP nào: mọi case cũ dừng ở `bat_dau_thi_cong`. Đó là chỗ
     * nhánh có thể cụt mà toàn bộ suite vẫn xanh — đơn vào được `thicong` rồi không còn
     * đường ra, và chỉ người dùng thật phát hiện.
     *
     * Lane này là lane DUY NHẤT đo được mã HTTP: `ValidationPipe` + `@IsIn(SU_KIEN_THU_CONG)`
     * chạy TRƯỚC service, nên một unit test khẳng định "service trả nghiemthu" không khẳng
     * định người dùng nhận được 200.
     */
    describe('nhánh thi công đi hết chuỗi qua dây', () => {
      /** Đơn đứng giữa nhánh; mọi cờ + quyền của `beforeEach` giữ nguyên. */
      function donDangO(status: string): void {
        orderRepo.findUnique.mockResolvedValue({ ...DON_DACOC, status });
      }

      it('`thicong` --xong_thi_cong--> 200 `nghiemthu`, soAnhDaLuu 0 (ảnh optional)', async () => {
        donDangO('thicong');

        const res = await post(SU_KIEN.xongThiCong);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('nghiemthu');
        expect(res.body.savedAttachmentCount).toBe(0);
        expect(typeof res.body.occurredAt).toBe('string');
        expect(storageMap.size).toBe(0);
      });

      it('kèm 1 ảnh ⇒ 200, ảnh mang CẶP KHOÁ `thicong`→`nghiemthu` của đúng bước này', async () => {
        donDangO('thicong');

        const res = await post(SU_KIEN.xongThiCong, [anh()]);

        expect(res.status).toBe(200);
        expect(res.body.savedAttachmentCount).toBe(1);

        const { data } = attachmentRepo.createMany.mock.calls[0][0];
        expect(data).toHaveLength(1);
        // Cặp (statusFrom, statusTo) là cách ảnh nối vào đúng bước ở gallery (FR-23).
        // Ghi nhầm cặp của bước khác thì ảnh vẫn lưu nhưng hiện sai chỗ.
        expect(data[0].statusFrom).toBe('thicong');
        expect(data[0].statusTo).toBe('nghiemthu');
        expect(storageMap.has(data[0].objectKey)).toBe(true);
      });

      it('thiếu `construction.transition` ở `thicong` ⇒ 403, KHÔNG ghi status', async () => {
        // `delivery.confirm` mở được cửa route nhưng không mở được bước của nhánh thi công.
        givenPermissions(PERM.ordersViewAll, PERM.deliveryConfirm);
        donDangO('thicong');

        const res = await post(SU_KIEN.xongThiCong, [anh()]);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
        // `updateMany` là CỔNG DUY NHẤT ghi `Order.status` (AD-11); không gọi = status
        // không đổi. Đọc lại đơn ở đây chỉ đọc lại chính mock, không chứng minh gì thêm.
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
        expect(attachmentRepo.createMany).not.toHaveBeenCalled();
        expect(storageMap.size).toBe(0);
      });

      it('actor thiếu quyền ⇒ `buocKeTiep` RỖNG, client ẩn hẳn nút (UX-DR-22)', async () => {
        givenPermissions(PERM.ordersViewAll, PERM.deliveryConfirm);
        donDangO('thicong');

        const res = await request(server())
          .get(`/orders/${ORDER_ID}/lifecycle`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(res.body.nextSteps).toEqual([]);
      });

      it('LỐI RA: `nghiemthu` chỉ còn ĐÚNG MỘT bước kế — nhánh không cụt', async () => {
        donDangO('nghiemthu');

        const res = await request(server())
          .get(`/orders/${ORDER_ID}/lifecycle`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(res.body.nextSteps).toEqual([
          {
            event: SU_KIEN.hoanThanh,
            to: 'hoanthanh',
            requires: PERM.constructionTransition,
          },
        ]);
      });

      it('LỐI RA: `nghiemthu` --hoan_thanh--> 200 `hoanthanh` once the stock is issued', async () => {
        donDangO('nghiemthu');
        stockVoucherRepo.findUnique.mockResolvedValue({
          id: 'stock-out-1',
          seq: 96,
          type: 'xuat',
          note: null,
          orderId: ORDER_ID,
          createdAt: new Date('2026-10-21T04:00:00Z'),
          createdBy: { id: ACCOUNT_ID, displayName: 'Kho' },
          lines: [],
        });

        const res = await post(SU_KIEN.hoanThanh);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('hoanthanh');
      });

      it('`nghiemthu` --hoan_thanh--> with stock-tracked lines not issued ⇒ 409, status not written', async () => {
        donDangO('nghiemthu');

        const res = await post(SU_KIEN.hoanThanh);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.',
        );
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      });
    });

    /**
     * NHÁNH GIAO HÀNG ĐI HẾT CHUỖI QUA DÂY. Hai đường vào `dagiao`: khách tự lấy
     * (`dacoc → dagiao`, có Thiết bị, không Vận chuyển) và đi giao
     * (`dacoc → danggiao → dagiao`, có Vận chuyển). Cạnh `danggiao → dagiao` trước đây chưa
     * từng chạy qua lane HTTP nào.
     */
    describe('nhánh giao hàng đi hết chuỗi qua dây', () => {
      /** Đơn Thương mại tự lấy: có Thiết bị, không Thi công, không Vận chuyển. */
      const DON_TU_LAY = {
        ...DON_DACOC,
        scopeThiCong: false,
        scopeVanChuyen: false,
      };

      function donTuLayO(status: string): void {
        orderRepo.findUnique.mockResolvedValue({ ...DON_TU_LAY, status });
      }

      /** Stock-tracked panel, 50 on hand. */
      const PIN_THEO_KHO = {
        ...PIN_580W,
        sku: 'PIN-580',
        costPrice: 1_900_000,
        tracksStock: true,
        isActive: true,
        stockItem: { id: 'si-pin', productId: PIN_580W.id, onHand: 50 },
      };

      // "Đã giao" is now the order's stock deduction: the confirmed order has a stock-tracked
      // panel line, and the confirmer also holds `inventory.manage` (real presets always pair
      // it with delivery.confirm).
      beforeEach(() => {
        lineRepo.findMany.mockResolvedValue([
          { ...DONG_CATALOG, unitPriceSnapshot: 2_450_000 },
        ]);
        productRepo.findMany.mockResolvedValue([PIN_THEO_KHO]);
        givenPermissions(
          PERM.ordersViewAll,
          PERM.constructionTransition,
          PERM.deliveryConfirm,
          PERM.paymentsRecord,
          PERM.inventoryManage,
        );
      });

      function vongDoi(): request.Test {
        return request(server())
          .get(`/orders/${ORDER_ID}/lifecycle`)
          .set('Authorization', `Bearer ${token()}`);
      }

      it('tự lấy ở `dacoc`: bước kế ĐÚNG một — `xong_giao` thẳng tới `dagiao`; stepper có `dagiao`, không `danggiao`', async () => {
        donTuLayO('dacoc');

        const res = await vongDoi();

        expect(res.status).toBe(200);
        expect(res.body.nextSteps).toEqual([
          {
            event: SU_KIEN.xongGiao,
            to: 'dagiao',
            requires: PERM.deliveryConfirm,
          },
        ]);
        const buoc = res.body.steps as { status: string; progress: string }[];
        expect(buoc).toContainEqual({
          status: 'dagiao',
          progress: 'upcoming',
        });
        expect(buoc.map((b) => b.status)).not.toContain('danggiao');
      });

      it('tự lấy: `dacoc` --xong_giao--> 200 `dagiao`, 0 ảnh', async () => {
        donTuLayO('dacoc');

        const res = await post(SU_KIEN.xongGiao);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('dagiao');
        expect(res.body.savedAttachmentCount).toBe(0);
        expect(storageMap.size).toBe(0);
      });

      it('tự lấy kèm 1 ảnh ⇒ ảnh mang CẶP KHOÁ `dacoc`→`dagiao`', async () => {
        donTuLayO('dacoc');

        const res = await post(SU_KIEN.xongGiao, [anh()]);

        expect(res.status).toBe(200);
        expect(res.body.savedAttachmentCount).toBe(1);
        const { data } = attachmentRepo.createMany.mock.calls[0][0];
        expect(data).toHaveLength(1);
        expect(data[0].statusFrom).toBe('dacoc');
        expect(data[0].statusTo).toBe('dagiao');
        expect(storageMap.has(data[0].objectKey as string)).toBe(true);
      });

      it('tự lấy qua dây để lại ĐÚNG MỘT vết StatusChanged `dacoc`→`dagiao`', async () => {
        donTuLayO('dacoc');

        const res = await post(SU_KIEN.xongGiao);

        expect(res.status).toBe(200);
        const vet = auditRepo.create.mock.calls
          .map((call) => (call[0] as { data: Record<string, unknown> }).data)
          .filter((data) => data.eventType === 'StatusChanged');
        expect(vet).toHaveLength(1);
        expect(vet[0]).toMatchObject({
          actorAccountId: ACCOUNT_ID,
          targetType: 'Order',
          targetId: ORDER_ID,
        });
        expect(vet[0].before).toMatchObject({ status: 'dacoc' });
        expect(vet[0].after).toMatchObject({ status: 'dagiao' });
      });

      it('Thi công + tự lấy ở `dacoc`: bước kế ĐÚNG hai — `bat_dau_thi_cong` và `xong_giao` thẳng tới `dagiao`', async () => {
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          scopeVanChuyen: false,
        });

        const ke = await vongDoi();

        expect(ke.status).toBe(200);
        expect(ke.body.nextSteps).toEqual([
          {
            event: SU_KIEN.batDauThiCong,
            to: 'thicong',
            requires: PERM.constructionTransition,
          },
          {
            event: SU_KIEN.xongGiao,
            to: 'dagiao',
            requires: PERM.deliveryConfirm,
          },
        ]);

        const res = await post(SU_KIEN.xongGiao);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('dagiao');
      });

      it('có Vận chuyển ở `dacoc`: bước kế KHÔNG lộ `xong_giao` — chỉ `bat_dau_thi_cong` và `bat_dau_giao`', async () => {
        const ke = await vongDoi();

        expect(ke.status).toBe(200);
        expect(
          ke.body.nextSteps.map((b: { event: string }) => b.event),
        ).toEqual([SU_KIEN.batDauThiCong, SU_KIEN.batDauGiao]);
      });

      it('LỐI RA: tự lấy ở `dagiao` chỉ còn `hoan_thanh`, và đi được ⇒ 200 `hoanthanh`', async () => {
        donTuLayO('dagiao');

        const ke = await vongDoi();
        expect(ke.status).toBe(200);
        expect(ke.body.nextSteps).toEqual([
          {
            event: SU_KIEN.hoanThanh,
            to: 'hoanthanh',
            requires: PERM.deliveryConfirm,
          },
        ]);

        const res = await post(SU_KIEN.hoanThanh);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('hoanthanh');
      });

      it('có Vận chuyển: `dacoc` --bat_dau_giao--> 200 `danggiao`', async () => {
        const res = await post(SU_KIEN.batDauGiao);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('danggiao');
      });

      it('có Vận chuyển: `danggiao` --xong_giao--> 200 `dagiao`', async () => {
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          status: 'danggiao',
        });

        const ke = await vongDoi();
        expect(ke.status).toBe(200);
        expect(ke.body.nextSteps).toEqual([
          {
            event: SU_KIEN.xongGiao,
            to: 'dagiao',
            requires: PERM.deliveryConfirm,
          },
        ]);

        const res = await post(SU_KIEN.xongGiao);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('dagiao');
      });

      it('`danggiao` --xong_giao--> issues stock in the same call: 1 order-bound voucher, EXACTLY one audit row each for StatusChanged and StockIssued', async () => {
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          status: 'danggiao',
        });

        const res = await post(SU_KIEN.xongGiao);

        expect(res.status).toBe(200);
        expect(Object.keys(res.body as object).sort()).toEqual([
          'occurredAt',
          'savedAttachmentCount',
          'status',
        ]);
        expect(stockVoucherRepo.create).toHaveBeenCalledTimes(1);
        expect(stockVoucherRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: 'xuat',
              orderId: ORDER_ID,
              orderVersionId: VERSION_ID,
            }) as unknown,
          }),
        );
        const loai = auditRepo.create.mock.calls.map(
          ([a]) => (a as { data: { eventType: string } }).data.eventType,
        );
        expect(loai.filter((t) => t === 'StatusChanged')).toHaveLength(1);
        expect(loai.filter((t) => t === 'StockIssued')).toHaveLength(1);
      });

      it('tracked lines NOT yet issued and no `inventory.manage` ⇒ 403, no byte uploaded, nothing written', async () => {
        givenPermissions(PERM.ordersViewAll, PERM.deliveryConfirm);
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          status: 'danggiao',
        });

        const res = await post(SU_KIEN.xongGiao, [anh()]);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
        expect(res.body.message).toBe(
          'Xác nhận Đã giao sẽ xuất kho — cần quyền nhập/xuất kho.',
        );
        expect(storageMap.size).toBe(0);
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
        expect(stockVoucherRepo.create).not.toHaveBeenCalled();
      });

      it('short stock ⇒ 409 INSUFFICIENT_STOCK `lines.0.qty`, no voucher, no photo, exactly 1 audit row = StockOutBlocked on the order', async () => {
        productRepo.findMany.mockResolvedValue([
          {
            ...PIN_THEO_KHO,
            stockItem: { ...PIN_THEO_KHO.stockItem, onHand: 3 },
          },
        ]);
        orderRepo.findUnique.mockResolvedValue({
          ...DON_DACOC,
          status: 'danggiao',
        });

        const res = await post(SU_KIEN.xongGiao, [anh()]);

        expect(res.status).toBe(409);
        expect(res.body.code).toBe(ErrorCode.CONFLICT);
        expect(res.body.message).toBe(
          'Không đủ tồn — không thể xuất quá số tồn hiện có.',
        );
        expect(res.body.fieldErrors).toEqual([
          {
            field: 'lines.0.qty',
            code: 'INSUFFICIENT_STOCK',
            message: 'Còn 3 tấm, không xuất được 8.',
          },
        ]);
        expect(stockVoucherRepo.create).not.toHaveBeenCalled();
        expect(attachmentRepo.createMany).not.toHaveBeenCalled();
        // No StatusChanged / StockIssued row — only the blocked attempt.
        expect(auditRepo.create).toHaveBeenCalledTimes(1);
        expect(auditRepo.create.mock.calls[0][0]).toMatchObject({
          data: {
            eventType: 'StockOutBlocked',
            targetType: 'Order',
            targetId: DON_DACOC.id,
            after: { lines: [{ qty: 8, onHand: 3 }] },
          },
        });
      });

      it('có Vận chuyển ở `dacoc` gửi `xong_giao` ⇒ 409 PHẠM VI — không nhảy cóc qua `danggiao`', async () => {
        const res = await post(SU_KIEN.xongGiao, [anh()]);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe('Bước này không thuộc phạm vi của đơn.');
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
        expect(storageMap.size).toBe(0);
      });

      it('thiếu `delivery.confirm` ở `dacoc` tự lấy ⇒ 403, không ghi gì; bước kế không có `xong_giao`', async () => {
        // `construction.transition` mở được cửa route nhưng không mở được bước giao hàng.
        givenPermissions(PERM.ordersViewAll, PERM.constructionTransition);
        donTuLayO('dacoc');

        const res = await post(SU_KIEN.xongGiao, [anh()]);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
        expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
        expect(attachmentRepo.createMany).not.toHaveBeenCalled();
        expect(storageMap.size).toBe(0);

        const ke = await vongDoi();
        expect(ke.status).toBe(200);
        expect(
          ke.body.nextSteps.map((b: { event: string }) => b.event),
        ).not.toContain(SU_KIEN.xongGiao);
      });
    });
  });

  /**
   * Story 5.7 — `POST /orders/:id/cancel`.
   *
   * ⚠️ MÃ HTTP CHỈ ĐO ĐƯỢC Ở ĐÂY. `ValidationPipe` chạy TRƯỚC service, nên một unit test
   * khẳng định "lý do rỗng ⇒ 400" chỉ khẳng định service ném gì, không khẳng định người dùng
   * nhận gì. Bài học 5.5 HIGH-1: DTO quá chặt ⇒ 400 của pipe thay 409 của nghiệp vụ và unit
   * test không thấy.
   */
  describe('Story 5.7 — POST /orders/:id/cancel (huỷ đơn kèm lý do)', () => {
    const LY_DO = 'Khách đổi ý, không lắp nữa';

    function huy(body: unknown = { reason: LY_DO }): request.Test {
      return request(server())
        .post(`/orders/${ORDER_ID}/cancel`)
        .set('Authorization', `Bearer ${token()}`)
        .send(body as object);
    }

    // The cancel now drives the stock subscriber on the real bus, which isolates handler
    // errors: a broken release would still answer as expected. No cancel case may log one.
    let loggedError: jest.SpyInstance;

    beforeEach(() => {
      givenPermissions(PERM.ordersViewAll, PERM.quotesCreateEdit);
      loggedError = jest.spyOn(Logger.prototype, 'error');
    });

    afterEach(() => {
      const errors = loggedError.mock.calls.length;
      loggedError.mockRestore();
      expect(errors).toBe(0);
    });

    it('đơn `baogia` + lý do hợp lệ ⇒ 200, status `huy`, occurredAt ISO-8601', async () => {
      const res = await huy();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('huy');
      expect(new Date(res.body.occurredAt).toISOString()).toBe(
        res.body.occurredAt,
      );
      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { cancelReason: LY_DO, cancelledAt: expect.any(Date) },
      });
    });

    it('the stock subscriber runs on the real bus after the cancel: releases what the order holds, logs no error', async () => {
      // The bus isolates subscriber errors, so a broken handler would still answer 200 —
      // the Logger spy is what makes a swallowed failure visible here.
      const logged = loggedError;
      const defaultFindUnique = orderRepo.findUnique.getMockImplementation();
      // The subscriber re-reads only the status under its own order lock: answer `huy` there.
      orderRepo.findUnique.mockImplementation(
        (args: { select?: Record<string, unknown> }) =>
          args?.select?.status === true && Object.keys(args.select).length === 1
            ? Promise.resolve({ status: 'huy' })
            : defaultFindUnique?.(args),
      );
      stockMovementRepo.groupBy.mockResolvedValue([
        { orderVersionId: 'ver-1', stockItemId: 'si-1', _sum: { qty: 5 } },
      ]);
      stockItemRepo.findMany.mockResolvedValue([{ productId: 'p-1' }]);
      stockMovementRepo.create.mockResolvedValue({});
      try {
        const res = await huy();

        expect(res.status).toBe(200);
        expect(stockMovementRepo.create).toHaveBeenCalledTimes(1);
        expect(stockMovementRepo.create).toHaveBeenCalledWith({
          data: {
            stockItemId: 'si-1',
            orderId: ORDER_ID,
            orderVersionId: 'ver-1',
            qty: -5,
            type: 'release',
          },
        });
        expect(logged).not.toHaveBeenCalled();
      } finally {
        orderRepo.findUnique.mockImplementation(defaultFindUnique);
        stockMovementRepo.groupBy.mockReset();
        stockItemRepo.findMany.mockReset();
        stockMovementRepo.create.mockReset();
      }
    });

    it.each([
      ['thiếu hẳn field', {}],
      ['rỗng', { reason: '' }],
      ['chỉ khoảng trắng', { reason: '     ' }],
      ['hai ký tự sau trim', { reason: ' ok ' }],
      ['quá 500 ký tự', { reason: 'x'.repeat(501) }],
      // Sai KIỂU: `@IsString` là hàng rào duy nhất. Gỡ nó ⇒ service chạy `input.lyDo.trim()`
      // trên một số/null/mảng ⇒ TypeError ⇒ 500 INTERNAL, không phải 400 có `fieldErrors`.
      // Unit test luôn truyền string nên không lane nào khác thấy được độ lệch này.
      ['số, không phải chuỗi', { reason: 123 }],
      ['null tường minh', { reason: null }],
      ['mảng chuỗi', { reason: ['khách', 'đổi ý'] }],
      // Renamed with no alias: the old name is stripped by `whitelist`, so `reason` is absent.
      ['old body name `lyDo`', { lyDo: 'Khách đổi ý, không lắp nữa' }],
    ])(
      '%s ⇒ 400 VALIDATION_ERROR — envelope trung tâm, không do controller dựng',
      async (_ten, body) => {
        const res = await huy(body);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors?.[0]?.field).toBe('reason');
        expect(orderRepo.updateMany).not.toHaveBeenCalled();
      },
    );

    it('lý do 2 ký tự ⇒ lỗi mang code `required` của SERVICE, không phải `minLength` của DTO', async () => {
      // Chốt bằng test cái mà DTO cố ý KHÔNG làm: luật độ dài tối thiểu sống ở service để
      // người dùng nhận đúng MỘT thông điệp. Thêm `@MinLength(3)` vào DTO sẽ đổi code sang
      // `minLength` và đổi message — unit test không thấy vì pipe không chạy ở đó.
      // Input KHÔNG có khoảng trắng bao quanh: `' ok '` dài 4 ký tự thô nên lọt qua
      // `@MinLength(3)`, và một mutant thêm decorator đó vào DTO sẽ sống sót.
      const res = await huy({ reason: 'ok' });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors?.[0]?.code).toBe('required');
      expect(res.body.fieldErrors?.[0]?.message).toContain('3 ký tự');
    });

    it('lý do ĐÚNG 500 ký tự ⇒ 200 — trần là <= 500, không phải < 500', async () => {
      // Cận trên chỉ đo được ở đây: `@MaxLength(500)` là luật của ValidationPipe. Ca 501 một
      // mình không khoá được trần — hạ xuống 499 (hay 50) thì nó vẫn đỏ đúng như cũ.
      const lyDo = 'x'.repeat(500);

      const res = await huy({ reason: lyDo });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('huy');
      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { cancelReason: lyDo, cancelledAt: expect.any(Date) },
      });
    });

    it('lý do ĐÚNG 3 ký tự ⇒ 200 — ngưỡng dưới là >= 3 trên dây thật', async () => {
      const res = await huy({ reason: 'xa.' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('huy');
    });

    it('field lạ trong body bị `whitelist` chặn — không có đường ghi đè `status`/`cancelledAt`', async () => {
      // `whitelist: true` sống ở pipe, nên chỉ lane này chứng minh được rằng client không
      // thể tự nhét cột vào lệnh update bằng cách gửi thêm field.
      const res = await huy({
        reason: LY_DO,
        status: 'hoanthanh',
        cancelledAt: '2020-01-01T00:00:00.000Z',
        cancelReason: 'lý do giả mạo',
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('huy');
      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { cancelReason: LY_DO, cancelledAt: expect.any(Date) },
      });
    });

    it('thiếu `quotes.create_edit` ⇒ 403, status không đổi', async () => {
      givenPermissions(PERM.ordersViewAll, PERM.catalogView);

      const res = await huy();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('đơn ở `thicong` (không có cạnh huỷ) ⇒ 409', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'thicong',
      });

      const res = await huy();

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
    });

    it('đơn ĐÃ huỷ ⇒ 409, không phải 200 no-op', async () => {
      orderRepo.findUnique.mockResolvedValue({ ...DON_BAOGIA, status: 'huy' });

      const res = await huy();

      expect(res.status).toBe(409);
    });

    it('đơn của người khác, actor không có `orders.view_all` ⇒ 404 (không rò rỉ)', async () => {
      givenPermissions(PERM.ordersViewOwn, PERM.quotesCreateEdit);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        ownerAccountId: 'acc-nguoi-khac',
        assigneeAccountId: null,
      });

      const res = await huy();

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('`/lifecycle` trả `coTheHuy: true` cho đơn `baogia` khi actor có quyền', async () => {
      const res = await request(server())
        .get(`/orders/${ORDER_ID}/lifecycle`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.canCancel).toBe(true);
      // `huy` KHÔNG BAO GIỜ lọt vào lane thủ công — cờ trên là đường DUY NHẤT client biết.
      expect(
        res.body.nextSteps.map((b: { event: string }) => b.event),
      ).not.toContain(SU_KIEN.huy);
    });

    it('`/lifecycle` trả `coTheHuy: false` khi actor thiếu `quotes.create_edit`', async () => {
      givenPermissions(PERM.ordersViewAll);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}/lifecycle`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.canCancel).toBe(false);
    });

    it('`GET /orders/:id` trả `cancelReason`/`cancelledAt` của đơn đã huỷ', async () => {
      const luc = new Date('2026-07-18T09:00:00Z');
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'huy',
        cancelReason: LY_DO,
        cancelledAt: luc,
      });

      const res = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.cancelReason).toBe(LY_DO);
      expect(res.body.cancelledAt).toBe(luc.toISOString());
    });
  });

  /**
   * Lane DUY NHẤT đo được mã HTTP của đường tra cứu: `ValidationPipe` + guard + exception
   * filter chỉ tồn tại ở đây. Đặc biệt là bẫy THỨ TỰ ROUTE — unit test không thấy nó.
   */
  describe('GET /orders/warranty-lookup (Story 5.9)', () => {
    const DON_BAO_HANH = {
      ...DON_BAOGIA,
      status: 'nghiem_thu',
      currentVersion: {
        id: VERSION_ID,
        chotAt: new Date('2026-01-15T02:00:00Z'),
      },
    };
    const DONG_CO_BAO_HANH = {
      ...DONG_CATALOG,
      warrantyMonths: 144,
      warrantyStartAt: new Date('2026-01-15T00:00:00Z'),
    };

    function danhSachDon(rows: readonly unknown[]): void {
      orderRepo.findMany.mockResolvedValue(rows);
    }

    it('SĐT thô ⇒ 200 kèm khách + dòng bảo hành đã tính hạn', async () => {
      givenPermissions(PERM.ordersViewAll);
      danhSachDon([DON_BAO_HANH]);
      lineRepo.findMany.mockResolvedValue([DONG_CO_BAO_HANH]);

      const res = await request(server())
        .get('/orders/warranty-lookup')
        .query({ phone: '0912 345 678' })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      // SĐT trả về đã chuẩn hoá — client gửi thô, nhận chuẩn (AD-9).
      expect(res.body.phone).toBe(SDT_E164);
      expect(res.body.sdt).toBeUndefined();
      expect(res.body.customer).toEqual({
        phone: SDT_E164,
        name: KHACH.name,
        custType: KHACH.custType,
      });
      expect(res.body.orders[0].confirmedAt).toBe('2026-01-15T02:00:00.000Z');
      expect(res.body.orders[0]).not.toHaveProperty('chotAt');
      const dong = res.body.orders[0].lineItems[0];
      expect(dong.warrantyEndAt).toBe('2038-01-15T00:00:00.000Z');
      expect(dong.warrantyStatus).toBe('con_han');
    });

    it('không có khách ⇒ 200 `found:false`, KHÔNG phải 404', async () => {
      givenPermissions(PERM.ordersViewAll);
      customerRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get('/orders/warranty-lookup')
        .query({ phone: '0912345678' })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        found: false,
        phone: SDT_E164,
        customer: null,
        orders: [],
      });
    });

    it('SĐT rác ⇒ 400 VALIDATION_ERROR kèm fieldErrors trỏ `phone`', async () => {
      givenPermissions(PERM.ordersViewAll);

      const res = await request(server())
        .get('/orders/warranty-lookup')
        .query({ phone: 'khong-phai-so' })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('phone');
    });

    it('thiếu CẢ hai quyền đọc đơn ⇒ 403', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .get('/orders/warranty-lookup')
        .query({ phone: '0912345678' })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
    });

    it('chỉ view_own ⇒ 200 nhưng phạm vi DỮ LIỆU thu hẹp về đơn của chính người gọi', async () => {
      // Ca 403 ở trên chỉ đo CỬA VÀO (guard). Cửa mở rồi, thứ quyết định người gọi thấy đơn
      // của ai là bộ quyền mà handler chuyển XUỐNG service — và bộ đó phải là quyền THẬT của
      // người gọi. Nếu handler chuyền một tập cố định có `view_all`, mọi ca khác vẫn xanh
      // trong khi nhân viên chỉ có `view_own` đọc được đơn của người khác.
      givenPermissions(PERM.ordersViewOwn);
      danhSachDon([]);

      const res = await request(server())
        .get('/orders/warranty-lookup')
        .query({ phone: '0912345678' })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(orderRepo.findMany).toHaveBeenCalledTimes(1);
      expect(orderRepo.findMany.mock.calls[0][0].where).toEqual({
        customerSdt: SDT_E164,
        AND: [
          {
            OR: [
              { ownerAccountId: ACCOUNT_ID },
              { assigneeAccountId: ACCOUNT_ID },
            ],
          },
        ],
      });
    });

    it('KHÔNG rơi vào handler `@Get(":id")` — route tĩnh khai trước', async () => {
      givenPermissions(PERM.ordersViewAll);
      danhSachDon([]);

      const res = await request(server())
        .get('/orders/warranty-lookup')
        .query({ phone: '0912345678' })
        .set('Authorization', `Bearer ${token()}`);

      // Rơi vào `:id` sẽ cho 404 "Không tìm thấy đơn hàng: warranty-lookup" — một lỗi trông
      // như lỗi dữ liệu. Hai assert: mã đúng, và đường đọc-theo-id KHÔNG hề được gọi.
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('found');
      expect(orderRepo.findFirst).not.toHaveBeenCalled();
    });
  });

  /**
   * Đường GHI đơn qua dây: người chỉ có `orders.view_own` (preset Thợ KS THẬT) không xem được
   * đơn người khác thì cũng KHÔNG sửa/chốt/áp chiết khấu/thêm-sửa-xoá dòng/xuất báo giá được.
   * Mã HTTP đo ở lane này vì nó đi qua guard + ValidationPipe + filter envelope thật — gọi
   * thẳng service không chứng minh được client nhận 404 chứ không 403/400/500.
   *
   * Body mọi request đều HỢP LỆ: một body sai sẽ ăn 400 ở pipe và ca 404 xanh giả.
   */
  describe('đường GHI đơn ngoài phạm vi ⇒ 404 qua dây, không lộ sự tồn tại', () => {
    const NGUOI_KHAC = 'acc-tho-ks-b';
    const THONG_DIEP = `Không tìm thấy đơn hàng: ${ORDER_ID}`;

    const DUONG_GHI: readonly [string, () => request.Test][] = [
      [
        'PATCH /orders/:id',
        () =>
          request(server())
            .patch(`/orders/${ORDER_ID}`)
            .send({ scopeConstruction: true }),
      ],
      [
        'POST /:id/confirm',
        () => request(server()).post(`/orders/${ORDER_ID}/confirm`),
      ],
      [
        'POST /:id/reopen',
        () => request(server()).post(`/orders/${ORDER_ID}/reopen`),
      ],
      [
        'POST /:id/apply-discount',
        () =>
          request(server())
            .post(`/orders/${ORDER_ID}/apply-discount`)
            .send({ amount: 1_000_000 }),
      ],
      [
        'POST /:id/line-items',
        () =>
          request(server())
            .post(`/orders/${ORDER_ID}/line-items`)
            .send({ productId: PIN_580W.id, qty: 2 }),
      ],
      [
        'PATCH /:id/line-items/:lineId',
        () =>
          request(server())
            .patch(`/orders/${ORDER_ID}/line-items/${DONG_CATALOG.id}`)
            .send({ qty: 3 }),
      ],
      [
        'DELETE /:id/line-items/:lineId',
        () =>
          request(server()).delete(
            `/orders/${ORDER_ID}/line-items/${DONG_CATALOG.id}`,
          ),
      ],
      [
        'POST /:id/export-quote',
        () => request(server()).post(`/orders/${ORDER_ID}/export-quote`),
      ],
    ];

    function khongGhiGi(): void {
      expect(transaction).not.toHaveBeenCalled();
      expect(queryRaw).not.toHaveBeenCalled();
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(lineRepo.create).not.toHaveBeenCalled();
      expect(lineRepo.update).not.toHaveBeenCalled();
      expect(lineRepo.delete).not.toHaveBeenCalled();
      expect(rendererStub.render).not.toHaveBeenCalled();
      expect(quoteExportRepo.upsert).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    }

    it('bảng đủ 8 route ghi (chống bảng rỗng ⇒ it.each xanh giả)', () => {
      expect(DUONG_GHI).toHaveLength(8);
    });

    it.each(DUONG_GHI)(
      'Thợ KS A trên đơn của Thợ KS B: %s ⇒ 404 NOT_FOUND, không ghi gì',
      async (_ten, goi) => {
        givenPermissions(...ROLE_PRESETS.THO_KS);
        orderRepo.findUnique.mockResolvedValue({
          ...DON_BAOGIA,
          ownerAccountId: NGUOI_KHAC,
          assigneeAccountId: null,
        });

        const res = await goi().set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(404);
        expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
        expect(res.body.message).toBe(THONG_DIEP);
        khongGhiGi();
      },
    );

    it.each(DUONG_GHI)(
      'ngoài phạm vi và KHÔNG tồn tại trả CÙNG một phản hồi: %s',
      async (_ten, goi) => {
        givenPermissions(...ROLE_PRESETS.THO_KS);
        orderRepo.findUnique.mockResolvedValue({
          ...DON_BAOGIA,
          ownerAccountId: NGUOI_KHAC,
          assigneeAccountId: null,
        });
        const ngoaiPhamVi = await goi().set(
          'Authorization',
          `Bearer ${token()}`,
        );
        orderRepo.findUnique.mockResolvedValue(null);
        const khongTonTai = await goi().set(
          'Authorization',
          `Bearer ${token()}`,
        );

        expect(ngoaiPhamVi.status).toBe(khongTonTai.status);
        expect(ngoaiPhamVi.body.code).toBe(khongTonTai.body.code);
        expect(ngoaiPhamVi.body.message).toBe(khongTonTai.body.message);
      },
    );

    it('POST /:id/resolve-discount: có discounts.approve nhưng CHỈ view_own, đơn người khác ⇒ 404', async () => {
      givenPermissions(PERM.discountsApprove, PERM.ordersViewOwn);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'choduyet',
        ownerAccountId: NGUOI_KHAC,
        assigneeAccountId: null,
      });

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/resolve-discount`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: true });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
      expect(res.body.message).toBe(THONG_DIEP);
      expect(discountApprovalRepo.findFirst).not.toHaveBeenCalled();
      khongGhiGi();
    });

    describe('tải file báo giá đã xuất — phạm vi chạy TRƯỚC hồ sơ xuất và R2', () => {
      beforeEach(() => {
        // Đơn của B ĐÃ xuất báo giá: không có phạm vi, A sẽ tải được bytes thật.
        quoteExportRow = {
          orderId: ORDER_ID,
          orderVersionId: VERSION_ID,
          imageKey: `quotes/${ORDER_ID}/bao-gia.png`,
          pdfKey: `quotes/${ORDER_ID}/bao-gia.pdf`,
          fileName: 'bao-gia-b',
        };
        storageMap.set(`quotes/${ORDER_ID}/bao-gia.png`, {
          body: Buffer.from('png-cua-b'),
          contentType: 'image/png',
        });
        storageMap.set(`quotes/${ORDER_ID}/bao-gia.pdf`, {
          body: Buffer.from('%PDF-cua-b'),
          contentType: 'application/pdf',
        });
      });

      it.each(['image', 'pdf'])(
        'Thợ KS A tải /quote/%s của đơn B ⇒ 404 "không tìm thấy đơn", không đọc hồ sơ xuất',
        async (kind) => {
          givenPermissions(...ROLE_PRESETS.THO_KS);
          orderRepo.findUnique.mockResolvedValue({
            ...DON_BAOGIA,
            ownerAccountId: NGUOI_KHAC,
            assigneeAccountId: null,
          });

          const res = await request(server())
            .get(`/orders/${ORDER_ID}/quote/${kind}`)
            .set('Authorization', `Bearer ${token()}`);

          expect(res.status).toBe(404);
          expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
          // Thông điệp của ĐƠN, không phải "chưa xuất" — cái sau xác nhận đơn có thật.
          expect(res.body.message).toBe(THONG_DIEP);
          expect(quoteExportRepo.findUnique).not.toHaveBeenCalled();
        },
      );

      it.each(['image', 'pdf'])(
        'chủ đơn vẫn tải được /quote/%s',
        async (kind) => {
          givenPermissions(...ROLE_PRESETS.THO_KS);

          const res = await request(server())
            .get(`/orders/${ORDER_ID}/quote/${kind}`)
            .set('Authorization', `Bearer ${token()}`);

          expect(res.status).toBe(200);
        },
      );
    });

    it('GET /pending-discount-approvals: chỉ view_own ⇒ hàng chờ lọc theo owner/assignee của người gọi', async () => {
      givenPermissions(PERM.discountsApprove, PERM.ordersViewOwn);

      const res = await request(server())
        .get('/orders/pending-discount-approvals')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(discountApprovalRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'cho_duyet',
            order: {
              AND: [
                {
                  OR: [
                    { ownerAccountId: ACCOUNT_ID },
                    { assigneeAccountId: ACCOUNT_ID },
                  ],
                },
              ],
            },
          },
        }),
      );
    });

    it('GET /pending-discount-approvals: view_all ⇒ KHÔNG mệnh đề phạm vi', async () => {
      givenPermissions(...ROLE_PRESETS.QUAN_LY);

      const res = await request(server())
        .get('/orders/pending-discount-approvals')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(discountApprovalRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'cho_duyet', order: { AND: [] } },
        }),
      );
    });

    it('Thợ KS vẫn PATCH được đơn CỦA MÌNH (owner) — phạm vi không chặn nhầm', async () => {
      givenPermissions(...ROLE_PRESETS.THO_KS);
      orderRepo.update.mockResolvedValue({ ...DON_BAOGIA, scopeThiCong: true });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeConstruction: true });

      expect(res.status).toBe(200);
      expect(orderRepo.update).toHaveBeenCalledTimes(1);
    });

    it('Thợ KS vẫn thêm dòng được trên đơn GIAO cho mình (nhánh assignee)', async () => {
      givenPermissions(...ROLE_PRESETS.THO_KS);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        ownerAccountId: NGUOI_KHAC,
        assigneeAccountId: ACCOUNT_ID,
      });

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/line-items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productId: PIN_580W.id, qty: 2 });

      expect(res.status).toBe(201);
      expect(lineRepo.create).toHaveBeenCalledTimes(1);
    });

    it('Quản lý (orders.view_all) vẫn PATCH được đơn của người khác', async () => {
      givenPermissions(...ROLE_PRESETS.QUAN_LY);
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        ownerAccountId: NGUOI_KHAC,
        assigneeAccountId: null,
      });
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        ownerAccountId: NGUOI_KHAC,
        scopeThiCong: true,
      });

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeConstruction: true });

      expect(res.status).toBe(200);
      expect(orderRepo.update).toHaveBeenCalledTimes(1);
    });
  });
});
