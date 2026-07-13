import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * GOTCHA (2.3/2.5): `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc **import module** →
 * phải set env TRƯỚC khi `AppModule` được nạp. Vì vậy KHÔNG static-import `AppModule` ở đầu
 * file (import bị hoist); set env ở top-level rồi `await import()` động trong `beforeAll`.
 */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/products` (hermetic — override `PrismaService`, ký JWT thật). Phủ hai bất biến mà
 * unit test KHÔNG chứng minh được vì chúng sống ở tầng HTTP/guard:
 *
 *  - AC-3: JWT thiếu `catalog.manage` ⇒ 403 trên CẢ 5 route (guard toàn cục thật sự chạy).
 *  - AC-4: có `catalog.manage` nhưng KHÔNG `costs.view` ⇒ 200 và body ĐI QUA DÂY không hề
 *    chứa `costPrice`. Đây là bài kiểm quan trọng nhất của story: giá vốn bị che ở SERVER
 *    (AD-4), không phải "để FE tự ẩn".
 */
describe('/products (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'catalog@example.com',
    displayName: 'Quản lý danh mục',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const PRODUCT = {
    id: 'prod-1',
    name: 'Tấm pin JA Solar 580W',
    sku: 'JAS-580-M10',
    unit: 'tấm',
    price: 2_450_000,
    costPrice: 1_950_000,
    tracksStock: true,
    priceEditable: false,
    warrantyMonths: 144,
    isActive: true,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };

  const productRepo = {
    create: jest.fn().mockResolvedValue(PRODUCT),
    update: jest.fn().mockResolvedValue(PRODUCT),
    findUnique: jest.fn().mockResolvedValue(PRODUCT),
    findMany: jest.fn().mockResolvedValue([PRODUCT]),
  };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule` và nhận mọi event ta
  // publish — không mock nó thì subscriber ném (bus cô lập lỗi nên test vẫn xanh, chỉ ồn
  // log). Có nó, ta khẳng định luôn: event ĐI TỚI được audit.
  const auditRepo = { create: jest.fn().mockResolvedValue({}) };
  // `featureFlag` (Story 3.2): `ProductsController` resolve cờ giá phân tầng trên MỌI request
  // đọc product. Thiếu mock này ⇒ `undefined.findUnique` ⇒ 500 trên toàn bộ suite.
  //
  // `null` = vắng dòng = cờ TẮT (fail-closed) ⇒ hành vi của story 3.1 giữ nguyên Y HỆT: không
  // include `prices`, payload không đổi. Đó là lý do mọi assertion 3.1 dưới đây vẫn đúng.
  const featureFlagRepo = { findUnique: jest.fn().mockResolvedValue(null) };
  const prismaMock = {
    product: productRepo,
    auditLog: auditRepo,
    featureFlag: featureFlagRepo,
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  /** Bộ quyền hiệu lực mà guard + controller sẽ resolve tươi cho request kế tiếp. */
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
    productRepo.create.mockResolvedValue(PRODUCT);
    productRepo.update.mockResolvedValue(PRODUCT);
    productRepo.findUnique.mockResolvedValue(PRODUCT);
    productRepo.findMany.mockResolvedValue([PRODUCT]);
    // Cờ TẮT — trạng thái mặc định của hệ thống, và là bối cảnh của mọi test 3.1 dưới đây.
    featureFlagRepo.findUnique.mockResolvedValue(null);
  });

  describe('AC-3 — thiếu catalog.manage ⇒ 403 trên CẢ 5 route', () => {
    // Một route quên `@RequirePermissions` sẽ đỏ ở đây — không cần nhớ kiểm tay.
    const routes: readonly {
      name: string;
      call: () => request.Test;
    }[] = [
      {
        name: 'POST /products',
        call: () => request(server()).post('/products'),
      },
      { name: 'GET /products', call: () => request(server()).get('/products') },
      {
        name: 'GET /products/:id',
        call: () => request(server()).get('/products/prod-1'),
      },
      {
        name: 'PATCH /products/:id',
        call: () => request(server()).patch('/products/prod-1'),
      },
      {
        name: 'DELETE /products/:id',
        call: () => request(server()).delete('/products/prod-1'),
      },
    ];

    for (const route of routes) {
      it(`${route.name} ⇒ 403`, async () => {
        // Có quyền khác (kể cả costs.view) nhưng KHÔNG có catalog.manage.
        givenPermissions(PERM.costsView, PERM.ordersViewOwn);

        const res = await route
          .call()
          .set('Authorization', `Bearer ${token()}`)
          .send({});

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      });
    }

    it('không có token ⇒ 401 (authn fail-closed)', async () => {
      const res = await request(server()).get('/products');

      expect(res.status).toBe(401);
    });
  });

  describe('AC-4 — costPrice chỉ lộ cho người có costs.view', () => {
    it('GET /products (có catalog.manage, KHÔNG costs.view) ⇒ 200, body KHÔNG chứa costPrice', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .get('/products')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).not.toHaveProperty('costPrice');
      expect(res.body[0].price).toBe(PRODUCT.price);
    });

    it('GET /products/:id (KHÔNG costs.view) ⇒ 200, không có costPrice', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .get('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('costPrice');
    });

    it('GET /products/:id (CÓ costs.view) ⇒ costPrice có mặt', async () => {
      givenPermissions(PERM.catalogManage, PERM.costsView);

      const res = await request(server())
        .get('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.costPrice).toBe(PRODUCT.costPrice);
    });

    it('POST có costPrice trong body nhưng KHÔNG costs.view ⇒ 403, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
          costPrice: 1_950_000,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(productRepo.create).not.toHaveBeenCalled();
    });

    it('PATCH có costPrice nhưng KHÔNG costs.view ⇒ 403', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .patch('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`)
        .send({ costPrice: 1 });

      expect(res.status).toBe(403);
      expect(productRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('CRUD happy path (có catalog.manage)', () => {
    it('POST /products ⇒ 201', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
        });

      expect(res.status).toBe(201);
      expect(res.body.sku).toBe(PRODUCT.sku);
      // Event đi qua EventBus tới AuditSubscriber thật (AD-18) — và audit ghi SỰ THẬT ĐẦY
      // ĐỦ: `costPrice` có trong nhật ký kể cả khi caller không được XEM nó ở response.
      expect(auditRepo.create).toHaveBeenCalledTimes(1);
      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('ProductCreated');
      expect(logged.after.costPrice).toBe(PRODUCT.costPrice);
      expect(res.body).not.toHaveProperty('costPrice');
    });

    it('POST giá thập phân ⇒ 400 VALIDATION_ERROR (tiền là INT đồng — AD-10)', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: 2_450_000.75,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('price');
    });

    it('POST giá âm ⇒ 400', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: -1,
        });

      expect(res.status).toBe(400);
    });

    it('DELETE /products/:id ⇒ 204 và là SOFT-delete (isActive=false)', async () => {
      givenPermissions(PERM.catalogManage);
      productRepo.update.mockResolvedValue({ ...PRODUCT, isActive: false });

      const res = await request(server())
        .delete('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(204);
      expect(productRepo.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isActive: false },
      });
    });

    it('GET /products/:id không tồn tại ⇒ 404', async () => {
      givenPermissions(PERM.catalogManage);
      productRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get('/products/không-có')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('PATCH /products/:id sửa giá ⇒ 200, audit ghi cả before lẫn after', async () => {
      givenPermissions(PERM.catalogManage);
      productRepo.update.mockResolvedValue({ ...PRODUCT, price: 2_600_000 });

      const res = await request(server())
        .patch('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`)
        .send({ price: 2_600_000 });

      expect(res.status).toBe(200);
      expect(res.body.price).toBe(2_600_000);
      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('ProductUpdated');
      expect(logged.before.price).toBe(PRODUCT.price);
      expect(logged.after.price).toBe(2_600_000);
    });

    it('PATCH /products/:id không tồn tại ⇒ 404, KHÔNG ghi DB, KHÔNG ghi audit', async () => {
      givenPermissions(PERM.catalogManage);
      productRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .patch('/products/không-có')
        .set('Authorization', `Bearer ${token()}`)
        .send({ price: 1 });

      expect(res.status).toBe(404);
      expect(productRepo.update).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('DELETE /products/:id không tồn tại ⇒ 404, KHÔNG ghi audit', async () => {
      givenPermissions(PERM.catalogManage);
      productRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .delete('/products/không-có')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('DELETE ⇒ event ProductDeactivated tới audit (isActive true → false)', async () => {
      givenPermissions(PERM.catalogManage);
      productRepo.update.mockResolvedValue({ ...PRODUCT, isActive: false });

      await request(server())
        .delete('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`);

      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('ProductDeactivated');
      expect(logged.before.isActive).toBe(true);
      expect(logged.after.isActive).toBe(false);
    });

    it('POST sku trùng ⇒ 409 CONFLICT kèm fieldErrors trỏ đúng ô sku', async () => {
      givenPermissions(PERM.catalogManage);
      productRepo.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.fieldErrors[0].field).toBe('sku');
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('POST thiếu field bắt buộc ⇒ 400 kèm fieldErrors cho từng ô', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({ price: PRODUCT.price });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      const fields = res.body.fieldErrors.map(
        (fieldError: { field: string }) => fieldError.field,
      );
      expect(fields).toEqual(expect.arrayContaining(['name', 'sku', 'unit']));
      expect(productRepo.create).not.toHaveBeenCalled();
    });

    it('POST warrantyMonths: null ⇒ 201 (không bảo hành là giá trị hợp lệ, KHÔNG bị chặn)', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: 'Công lắp đặt',
          sku: 'CONG-LAP',
          unit: 'gói',
          price: 3_000_000,
          warrantyMonths: null,
        });

      expect(res.status).toBe(201);
      expect(
        productRepo.create.mock.calls[0][0].data.warrantyMonths,
      ).toBeNull();
    });
  });

  describe('AC-4 — ghi/đọc costPrice khi CÓ costs.view', () => {
    it('POST kèm costPrice ⇒ 201, giá vốn ghi vào DB và có trong response', async () => {
      givenPermissions(PERM.catalogManage, PERM.costsView);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
          costPrice: PRODUCT.costPrice,
        });

      expect(res.status).toBe(201);
      expect(res.body.costPrice).toBe(PRODUCT.costPrice);
      expect(productRepo.create.mock.calls[0][0].data.costPrice).toBe(
        PRODUCT.costPrice,
      );
    });

    it('PATCH costPrice ⇒ 200, giá vốn mới được ghi (đường hiệu chỉnh tay của Story 3.1)', async () => {
      givenPermissions(PERM.catalogManage, PERM.costsView);
      productRepo.update.mockResolvedValue({
        ...PRODUCT,
        costPrice: 1_800_000,
      });

      const res = await request(server())
        .patch('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`)
        .send({ costPrice: 1_800_000 });

      expect(res.status).toBe(200);
      expect(res.body.costPrice).toBe(1_800_000);
      expect(productRepo.update.mock.calls[0][0].data.costPrice).toBe(
        1_800_000,
      );
    });

    it('GET /products (CÓ costs.view) ⇒ mọi phần tử danh sách đều mang costPrice', async () => {
      givenPermissions(PERM.catalogManage, PERM.costsView);
      productRepo.findMany.mockResolvedValue([
        PRODUCT,
        { ...PRODUCT, id: 'prod-2' },
      ]);

      const res = await request(server())
        .get('/products')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      for (const product of res.body) {
        expect(product.costPrice).toBe(PRODUCT.costPrice);
      }
    });

    it('POST costPrice: 0 mà KHÔNG có costs.view ⇒ 403 (0 là giá trị, không phải "vắng mặt")', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
          costPrice: 0,
        });

      expect(res.status).toBe(403);
      expect(productRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('query includeInactive — mặc định ẩn sản phẩm đã soft-delete', () => {
    // Controller nhận query dạng CHUỖI (`includeInactive === 'true'`); chỉ e2e chứng minh
    // được dây này nối đúng — unit test gọi thẳng service với boolean, không đi qua HTTP.
    it('không truyền query ⇒ chỉ lấy sản phẩm còn hiệu lực', async () => {
      givenPermissions(PERM.catalogManage);

      await request(server())
        .get('/products')
        .set('Authorization', `Bearer ${token()}`);

      expect(productRepo.findMany.mock.calls[0][0].where).toEqual({
        isActive: true,
      });
    });

    it('?includeInactive=true ⇒ lấy cả sản phẩm đã ẩn', async () => {
      givenPermissions(PERM.catalogManage);

      await request(server())
        .get('/products?includeInactive=true')
        .set('Authorization', `Bearer ${token()}`);

      expect(productRepo.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('?includeInactive=false ⇒ vẫn chỉ sản phẩm còn hiệu lực (không lật cờ nhầm)', async () => {
      givenPermissions(PERM.catalogManage);

      await request(server())
        .get('/products?includeInactive=false')
        .set('Authorization', `Bearer ${token()}`);

      expect(productRepo.findMany.mock.calls[0][0].where).toEqual({
        isActive: true,
      });
    });
  });

  describe('null tường minh trên cột NOT NULL ⇒ 400, KHÔNG lọt xuống DB', () => {
    // `@IsOptional()` của class-validator tha CẢ `undefined` LẪN `null` ⇒ nếu dùng nó cho
    // cột NOT NULL, `{"price": null}` sẽ đi thẳng xuống Prisma và vỡ ở tầng DB thành 500.
    // Mock Prisma nuốt `null` không kêu ca, nên chỉ test canh ĐÚNG HAI THỨ mới bắt được:
    // status phải là 400, và DB phải KHÔNG bị chạm.
    const NOT_NULL_FIELDS = [
      'name',
      'sku',
      'unit',
      'price',
      'costPrice',
      'tracksStock',
      'priceEditable',
    ] as const;

    for (const field of NOT_NULL_FIELDS) {
      it(`POST ${field}: null ⇒ 400 VALIDATION_ERROR, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.catalogManage, PERM.costsView);

        const res = await request(server())
          .post('/products')
          .set('Authorization', `Bearer ${token()}`)
          .send({
            name: PRODUCT.name,
            sku: PRODUCT.sku,
            unit: PRODUCT.unit,
            price: PRODUCT.price,
            [field]: null,
          });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(productRepo.create).not.toHaveBeenCalled();
      });

      it(`PATCH ${field}: null ⇒ 400 VALIDATION_ERROR, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.catalogManage, PERM.costsView);

        const res = await request(server())
          .patch('/products/prod-1')
          .set('Authorization', `Bearer ${token()}`)
          .send({ [field]: null });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(productRepo.update).not.toHaveBeenCalled();
      });
    }

    it('PATCH warrantyMonths: null ⇒ 200 (ngoại lệ DUY NHẤT — cột nullable, đặt lại "không bảo hành")', async () => {
      givenPermissions(PERM.catalogManage);
      productRepo.update.mockResolvedValue({
        ...PRODUCT,
        warrantyMonths: null,
      });

      const res = await request(server())
        .patch('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`)
        .send({ warrantyMonths: null });

      expect(res.status).toBe(200);
      expect(
        productRepo.update.mock.calls[0][0].data.warrantyMonths,
      ).toBeNull();
    });
  });

  describe('field ngoài DTO không lọt xuống DB', () => {
    // Phòng thủ hai lớp: `ValidationPipe({ whitelist: true })` loại field lạ khỏi DTO, VÀ
    // service liệt kê tay từng cột xuống Prisma. Test canh KẾT QUẢ (payload ghi DB), nên nó
    // vẫn đỏ khi một trong hai lớp bị phá — `isActive` chỉ được đổi qua DELETE (soft-delete),
    // không qua POST/PATCH tuỳ tiện.
    it('POST kèm isActive/field lạ ⇒ bị loại khỏi payload ghi DB', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .post('/products')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
          isActive: false,
          id: 'id-tự-chọn',
        });

      expect(res.status).toBe(201);
      const data = productRepo.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('isActive');
      expect(data).not.toHaveProperty('id');
    });

    it('PATCH kèm isActive ⇒ bị loại (bật lại sản phẩm đã ẩn phải đi đường riêng, không qua PATCH tuỳ tiện)', async () => {
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .patch('/products/prod-1')
        .set('Authorization', `Bearer ${token()}`)
        .send({ price: 1_000, isActive: true });

      expect(res.status).toBe(200);
      expect(productRepo.update.mock.calls[0][0].data).not.toHaveProperty(
        'isActive',
      );
    });
  });
});
