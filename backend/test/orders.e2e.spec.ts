import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ErrorCode } from '../src/common/errors/error-code';
import { PrismaService } from '../src/prisma/prisma.service';

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
  const orderVersionRepo = { create: jest.fn() };
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
  const transaction = jest.fn(async (ops: Promise<unknown>[]) =>
    Promise.all(ops),
  );
  const prismaMock = {
    order: orderRepo,
    orderVersion: orderVersionRepo,
    orderLineItem: lineRepo,
    product: productRepo,
    customer: customerRepo,
    auditLog: auditRepo,
    featureFlag: featureFlagRepo,
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
    transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
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
    ];

    for (const route of routes) {
      it(`${route.name} không token ⇒ 401`, async () => {
        const res = await route.call().send({});

        expect(res.status).toBe(401);
      });

      it(`${route.name} thiếu quotes.create_edit ⇒ 403`, async () => {
        // Có quyền KHÁC (kể cả catalog.view của THO_KS) nhưng không có quotes.create_edit.
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

    it('smuggle custType kèm cờ hợp lệ ⇒ custType bị strip: payload ghi CHỈ chứa 2 cờ, custType không đổi', async () => {
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
        data: { scopeThiCong: undefined, scopeVanChuyen: true },
      });
      expect(res.body.custType).toBe('CA_NHAN');
      expect(res.body.scopeVanChuyen).toBe(true);
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
      expect(res.body).toEqual({
        subtotal: 20_100_000,
        vatAmount: 1_608_000,
        total: 21_708_000,
      });
      // Stateless: đường preview không đọc/ghi các model nghiệp vụ, không audit.
      expect(orderRepo.findUnique).not.toHaveBeenCalled();
      expect(lineRepo.findMany).not.toHaveBeenCalled();
      expect(productRepo.findMany).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('lines rỗng ⇒ 200 {0,0,0} — giỏ vừa xoá sạch vẫn preview được', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .post('/orders/preview-total')
        .set('Authorization', `Bearer ${token()}`)
        .send({ lines: [] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ subtotal: 0, vatAmount: 0, total: 0 });
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
      expect(res.body).toEqual({ subtotal: 0, vatAmount: 0, total: 0 });
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
        vatAmount: 40,
        total: 540,
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
