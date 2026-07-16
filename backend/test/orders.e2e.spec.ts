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
