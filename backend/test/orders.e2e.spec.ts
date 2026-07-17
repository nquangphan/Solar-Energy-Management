import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';

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
    create: jest.fn(),
    update: jest.fn(),
  };
  const orderVersionRepo = { create: jest.fn(), findUnique: jest.fn() };
  const lineRepo = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
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
  const discountApprovalRepo = { findFirst: jest.fn(), findMany: jest.fn() };
  // Hồ sơ xuất báo giá (4.8): upsert mô phỏng ĐÚNG ngữ nghĩa unique orderId — MỘT slot,
  // lần 2 đi nhánh update; findUnique đọc lại slot đó (2 route proxy + xuất lần n).
  let quoteExportRow: Record<string, unknown> | null = null;
  const quoteExportRepo = { findUnique: jest.fn(), upsert: jest.fn() };
  // Storage in-memory + renderer stub (override provider) — e2e KHÔNG đụng Chromium/R2.
  const storageMap = new Map<string, { body: Buffer; contentType: string }>();
  const storageStub = {
    putObject: async (key: string, body: Buffer, contentType: string) => {
      storageMap.set(key, { body, contentType });
    },
    getObject: async (key: string) => {
      const found = storageMap.get(key);
      if (found === undefined) {
        throw new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy file.');
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
  // Interactive tx cho POST :id/chot + :id/mo-lai + :id/ap-chiet-khau + :id/duyet-chiet-khau.
  const txOrderRepo = { updateMany: jest.fn(), update: jest.fn() };
  const txVersionRepo = { update: jest.fn(), create: jest.fn() };
  const txLineRepo = { update: jest.fn(), createMany: jest.fn() };
  const txDiscountRepo = { create: jest.fn(), updateMany: jest.fn() };
  const txMock = {
    order: txOrderRepo,
    orderVersion: txVersionRepo,
    orderLineItem: txLineRepo,
    discountApproval: txDiscountRepo,
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
    $transaction: transaction,
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    customerRepo.findUnique.mockResolvedValue(KHACH);
    orderRepo.findUnique.mockResolvedValue(DON_BAOGIA);
    orderRepo.create.mockResolvedValue({
      ...DON_BAOGIA,
      currentVersionId: null,
    });
    orderRepo.update.mockResolvedValue(DON_BAOGIA);
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
    auditRepo.create.mockResolvedValue({});
    featureFlagRepo.findUnique.mockResolvedValue(null);
    systemSettingRepo.findUnique.mockResolvedValue(null);
    transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(txMock)
        : Promise.all(arg as Promise<unknown>[]),
    );
    txOrderRepo.updateMany.mockResolvedValue({ count: 1 });
    txOrderRepo.update.mockResolvedValue({});
    txVersionRepo.update.mockResolvedValue({});
    txVersionRepo.create.mockResolvedValue({});
    txLineRepo.update.mockResolvedValue({});
    txLineRepo.createMany.mockResolvedValue({ count: 0 });
    orderVersionRepo.findUnique.mockResolvedValue(null);
    // Mặc định: đơn chưa từng áp chiết khấu.
    discountApprovalRepo.findFirst.mockResolvedValue(null);
    discountApprovalRepo.findMany.mockResolvedValue([]);
    txDiscountRepo.create.mockResolvedValue({});
    txDiscountRepo.updateMany.mockResolvedValue({ count: 1 });
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
        name: 'POST /orders/:id/mo-lai',
        call: () => request(server()).post(`/orders/${ORDER_ID}/mo-lai`),
      },
      {
        name: 'POST /orders/:id/ap-chiet-khau',
        call: () => request(server()).post(`/orders/${ORDER_ID}/ap-chiet-khau`),
      },
      {
        name: 'POST /orders/:id/duyet-chiet-khau',
        call: () =>
          request(server()).post(`/orders/${ORDER_ID}/duyet-chiet-khau`),
      },
      {
        name: 'GET /orders/cho-duyet-chiet-khau',
        call: () => request(server()).get('/orders/cho-duyet-chiet-khau'),
      },
      {
        name: 'POST /orders/:id/xuat-bao-gia',
        call: () => request(server()).post(`/orders/${ORDER_ID}/xuat-bao-gia`),
      },
      {
        name: 'GET /orders/:id/bao-gia/anh',
        call: () => request(server()).get(`/orders/${ORDER_ID}/bao-gia/anh`),
      },
      {
        name: 'GET /orders/:id/bao-gia/pdf',
        call: () => request(server()).get(`/orders/${ORDER_ID}/bao-gia/pdf`),
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

  describe('happy path 4 endpoint (giỏ hàng đầy đủ vòng đời)', () => {
    it('POST /orders ⇒ 201, lineItems rỗng, sourceId snapshot từ Customer', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ customerSdt: '0912 345 678' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('baogia');
      expect(res.body.sourceId).toBe(NGUON_FACEBOOK_ID);
      expect(res.body.ownerAccountId).toBe(ACCOUNT_ID);
      expect(res.body.lineItems).toEqual([]);
      // Event tới AuditSubscriber thật: OrderCreated được ghi.
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderCreated' }),
        }),
      );
    });

    it('GET /orders/:id ⇒ 200, dòng kèm amount server tính', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.lineItems).toHaveLength(1);
      expect(res.body.lineItems[0].amount).toBe(2_450_000 * 8);
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
      lineRepo.update.mockResolvedValue({ ...DONG_CATALOG, warrantyMonths: 24 });

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
      givenPermissions(PERM.quotesCreateEdit);
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
        .send({ scopeThiCong: true });

      expect(res.status).toBe(200);
      expect(res.body.scopeThiCong).toBe(true);
      expect(res.body.scopeThietBi).toBe(true);
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'OrderScopeChanged' }),
        }),
      );
    });

    it('cờ không phải boolean (scopeThiCong: "yes") ⇒ 400 kèm fieldErrors, không ghi', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeThiCong: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'scopeThiCong' }),
        ]),
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('cờ = null ⇒ 400 (null KHÔNG phải "bỏ qua field" trên cột NOT NULL)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeVanChuyen: null });

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
        .send({ scopeThiCong: true });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('scopeThietBi: false bị whitelist strip IM LẶNG ⇒ 200, KHÔNG ghi, KHÔNG audit, cờ vẫn true', async () => {
      // `scopeThietBi` không có trong DTO — client cố tắt cờ bất biến thì field bị strip,
      // dto còn lại RỖNG ⇒ nhánh "trả view hiện tại": không có đường ghi nào chạm tới cờ.
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ scopeThietBi: false });

      expect(res.status).toBe(200);
      expect(res.body.scopeThietBi).toBe(true);
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
        .send({ custType: 'THUONG_MAI', scopeVanChuyen: true });

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
      expect(res.body.scopeVanChuyen).toBe(true);
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

  describe('POST /orders/:id/chot — Chốt Đơn + snapshot giá (Story 4.5)', () => {
    it('không token ⇒ 401', async () => {
      const res = await request(server()).post(`/orders/${ORDER_ID}/chot`);

      expect(res.status).toBe(401);
    });

    it('CHỈ có quotes.create_edit ⇒ 403 — quyền dựng báo giá KHÔNG thay được orders.confirm', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/chot`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
    });

    it("happy: 200 status 'dachot', tx ghi status + version + snapshot dòng, audit OrderConfirmed qua AuditSubscriber thật", async () => {
      givenPermissions(PERM.ordersConfirm);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/chot`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('dachot');
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
        .post(`/orders/${ORDER_ID}/chot`)
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
      givenPermissions(PERM.ordersConfirm, PERM.quotesCreateEdit);
      const DON_DA_CHOT = { ...DON_BAOGIA, status: 'dachot' };
      const DONG_DA_CHOT = {
        ...DONG_CATALOG,
        unitPriceSnapshot: 2_450_000,
        catalogPriceSnapshot: 2_450_000,
      };
      orderRepo.findUnique.mockResolvedValue(DON_DA_CHOT);
      lineRepo.findMany.mockResolvedValue([DONG_DA_CHOT]);

      const retry = await request(server())
        .post(`/orders/${ORDER_ID}/chot`)
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
      givenPermissions(PERM.quotesCreateEdit);
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
        .post(`/orders/${ORDER_ID}/chot`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('đơn ma ⇒ 404 envelope chuẩn', async () => {
      givenPermissions(PERM.ordersConfirm);
      orderRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .post('/orders/khong-co/chot')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('POST /orders/:id/mo-lai — Mở lại Đơn đã chốt (Story 4.6, FR-6)', () => {
    it('không token ⇒ 401', async () => {
      const res = await request(server()).post(`/orders/${ORDER_ID}/mo-lai`);

      expect(res.status).toBe(401);
    });

    it('CHỈ có orders.confirm ⇒ 403 — quyền chốt KHÔNG thay được quotes.create_edit (nghịch đảo proof 4.5)', async () => {
      givenPermissions(PERM.ordersConfirm);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/mo-lai`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('vòng đời FR-6 đầy đủ: tạo → thêm dòng → chốt → giá danh mục đổi → mở lại (giá SỐNG mới, bản cũ nguyên snapshot, audit) → sửa dòng → re-chốt (snapshot MỚI trên bản mới, bản cũ vẫn cũ)', async () => {
      givenPermissions(PERM.quotesCreateEdit, PERM.ordersConfirm);

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
        .send({ customerSdt: '0912 345 678' });
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
        .post(`/orders/${tao.body.id}/chot`)
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
        .post(`/orders/${tao.body.id}/mo-lai`)
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

      // ===== 7. Re-chốt qua /chot HIỆN CÓ — snapshot MỚI lên bản MỚI, bản cũ vẫn CŨ =====
      const reChot = await request(server())
        .post(`/orders/${tao.body.id}/chot`)
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

    it("retry mo-lai khi đơn ĐANG 'baogia' ⇒ 200 body y hệt GET, KHÔNG ghi, audit KHÔNG ghi thêm", async () => {
      givenPermissions(PERM.quotesCreateEdit);
      orderRepo.findUnique.mockResolvedValue(DON_BAOGIA);
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);

      const retry = await request(server())
        .post(`/orders/${ORDER_ID}/mo-lai`)
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
        .post('/orders/khong-co/mo-lai')
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
        .post(`/orders/${ORDER_ID}/mo-lai`)
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
        .post(`/orders/${ORDER_ID}/ap-chiet-khau`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 1_000_000 });
      expect(ap.status).toBe(403);
      expect(ap.body.code).toBe(ErrorCode.FORBIDDEN);

      givenPermissions(PERM.discountsApply);
      const duyet = await request(server())
        .post(`/orders/${ORDER_ID}/duyet-chiet-khau`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: true });
      expect(duyet.status).toBe(403);
      const list = await request(server())
        .get('/orders/cho-duyet-chiet-khau')
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
        .send({ customerSdt: '0912 345 678' });
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
        .post(`/orders/${tao.body.id}/ap-chiet-khau`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 19_600_001 });
      expect(apVuot.status).toBe(400);
      expect(apVuot.body.fieldErrors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'amount' })]),
      );

      // ===== 3. Áp 1_000_000 ⇒ 200 choduyet + discount cho_duyet + audit =====
      const ap = await request(server())
        .post(`/orders/${tao.body.id}/ap-chiet-khau`)
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
        .post(`/orders/${tao.body.id}/ap-chiet-khau`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 2_000_000 });
      expect(apLan2.status).toBe(409);

      // ===== 6. List chờ duyệt — CÓ costs.view: margin đúng số =====
      const listCo = await request(server())
        .get('/orders/cho-duyet-chiet-khau')
        .set('Authorization', `Bearer ${token()}`);
      expect(listCo.status).toBe(200);
      expect(listCo.body).toHaveLength(1);
      expect(listCo.body[0]).toMatchObject({
        orderId: tao.body.id,
        customerSdt: SDT_E164,
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
        .get('/orders/cho-duyet-chiet-khau')
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
        .post(`/orders/${tao.body.id}/duyet-chiet-khau`)
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
        .post(`/orders/${tao.body.id}/chot`)
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
        .post(`/orders/${tao.body.id}/mo-lai`)
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
        .post(`/orders/${ORDER_ID}/duyet-chiet-khau`)
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
        .post(`/orders/${ORDER_ID}/duyet-chiet-khau`)
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
      givenPermissions(PERM.discountsApprove, PERM.quotesCreateEdit);
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
        .post(`/orders/${ORDER_ID}/duyet-chiet-khau`)
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
        .post('/orders/khong-co/ap-chiet-khau')
        .set('Authorization', `Bearer ${token()}`)
        .send({ amount: 1 });
      expect(ap.status).toBe(404);
      expect(ap.body.code).toBe(ErrorCode.NOT_FOUND);

      const duyet = await request(server())
        .post('/orders/khong-co/duyet-chiet-khau')
        .set('Authorization', `Bearer ${token()}`)
        .send({ approve: true });
      expect(duyet.status).toBe(404);
      expect(duyet.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('ValidationPipe: amount 0 / float / vắng ⇒ 400; preview discountAmount âm ⇒ 400', async () => {
      givenPermissions(PERM.discountsApply, PERM.quotesCreateEdit);

      for (const body of [{ amount: 0 }, { amount: 100.5 }, {}]) {
        const res = await request(server())
          .post(`/orders/${ORDER_ID}/ap-chiet-khau`)
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

    it('flow: POST xuat-bao-gia 200 metadata → GET anh (PNG magic) → GET pdf (%PDF) → audit QuoteExported', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      const fileBase = `bao-gia-${ORDER_ID.slice(0, 8)}`;

      const xuat = await request(server())
        .post(`/orders/${ORDER_ID}/xuat-bao-gia`)
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
        .get(`/orders/${ORDER_ID}/bao-gia/anh`)
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
        .get(`/orders/${ORDER_ID}/bao-gia/pdf`)
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
        .get(`/orders/${ORDER_ID}/bao-gia/anh`)
        .set('Authorization', `Bearer ${token()}`);
      expect(anh.status).toBe(404);
      expect(anh.body.code).toBe(ErrorCode.NOT_FOUND);

      const pdf = await request(server())
        .get(`/orders/${ORDER_ID}/bao-gia/pdf`)
        .set('Authorization', `Bearer ${token()}`);
      expect(pdf.status).toBe(404);
      expect(pdf.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('đơn 0 dòng → POST xuat-bao-gia 400 VALIDATION_ERROR, KHÔNG render/ghi', async () => {
      givenPermissions(PERM.quotesCreateEdit);
      lineRepo.findMany.mockResolvedValue([]);

      const res = await request(server())
        .post(`/orders/${ORDER_ID}/xuat-bao-gia`)
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
        .post(`/orders/${ORDER_ID}/xuat-bao-gia`)
        .set(auth)
        .send();
      const lan2 = await request(server())
        .post(`/orders/${ORDER_ID}/xuat-bao-gia`)
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
      givenPermissions(PERM.quotesCreateEdit);
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
        .send({ customerSdt: '0912345678' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });
  });
});
