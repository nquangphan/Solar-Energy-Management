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
 * GOTCHA (2.3/2.5): `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc **import module** → phải set
 * env TRƯỚC khi `AppModule` được nạp. Vì vậy KHÔNG static-import `AppModule` ở đầu file (import
 * bị hoist); set env ở top-level rồi `await import()` động trong `beforeAll`.
 */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/product-groups` (hermetic — override `PrismaService`, ký JWT thật). Phủ ba bất biến mà
 * unit test KHÔNG chứng minh được vì chúng sống ở tầng HTTP/guard/route:
 *
 *  - Thiếu quyền sửa danh mục ⇒ 403 trên CẢ 7 route (guard toàn cục thật sự chạy).
 *  - 🔴 `costPrice` KHÔNG có trong body đi qua dây của `GET /product-groups` lẫn
 *    `GET /product-groups/:id`. Đây là bài kiểm quan trọng nhất của story: gói là một CỬA MỚI vào
 *    dữ liệu sản phẩm, và giá vốn không được phép rời server qua nó.
 *  - `:id/reactivate` và `:id/items` KHÔNG bị route `:id` trần nuốt (thứ tự khai route).
 */
describe('/product-groups (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-1';
  const GROUP_ID = '5f4d3c2b-1a09-4e8d-9c7b-6a5f4e3d2c1b';
  const PROD_A = '3b1f0c9a-5d2e-4a7b-8c6d-9e0f1a2b3c4d';

  const account = {
    id: ACCOUNT_ID,
    email: 'catalog@example.com',
    displayName: 'Quản lý danh mục',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const GROUP = {
    id: GROUP_ID,
    name: 'Gói Hybrid 8kW',
    description: 'Trọn bộ hybrid 8kW.',
    isActive: true,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };

  /**
   * Item như Prisma trả về sau `select` HẸP — sản phẩm con KHÔNG có `costPrice`.
   *
   * Mock này cố ý KHÔNG chứa giá vốn: nếu service đổi sang `include: { product: true }`, nó sẽ đòi
   * cả bản ghi và test `select` ở unit spec đỏ. Ở đây ta canh mặt còn lại của cùng bất biến — body
   * đi qua dây — bằng một bản ghi ĐẦY ĐỦ ở nhánh `GROUP_WITH_COST` dưới.
   */
  const ITEM = {
    displayOrder: 0,
    product: {
      id: PROD_A,
      name: 'Tấm pin JA Solar 580W',
      sku: 'JAS-580-M10',
      unit: 'tấm',
      price: 2_450_000,
      isActive: true,
    },
  };

  const groupRepo = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const groupItemRepo = {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  };
  const productRepo = { findMany: jest.fn(), findUnique: jest.fn() };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule` và nhận mọi event ta
  // publish. `featureFlag` có mặt vì các controller khác trong AppModule chạm nó — thiếu MỘT model
  // trên đường request là 500 cả suite (bài học `featureFlag` ở 3.1).
  const auditRepo = { create: jest.fn().mockResolvedValue({}) };
  const featureFlagRepo = { findUnique: jest.fn().mockResolvedValue(null) };
  const prismaMock = {
    productGroup: groupRepo,
    productGroupItem: groupItemRepo,
    product: productRepo,
    auditLog: auditRepo,
    featureFlag: featureFlagRepo,
    $transaction: jest.fn().mockResolvedValue([]),
    // `$queryRaw` là khoá `FOR UPDATE` mà `replaceItems` lấy trên dòng gói trước khi thay
    // checklist. Thiếu nó ở mock ⇒ 500 trên đường `PUT :id/items` — cùng loại với bài học
    // `featureFlag`: mock phải có đủ MỌI thứ đường request chạm, kể cả method của chính client.
    $queryRaw: jest.fn().mockResolvedValue([{ id: GROUP_ID }]),
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  /** Bộ quyền hiệu lực mà guard sẽ resolve tươi cho request kế tiếp. */
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
    groupRepo.findUnique.mockResolvedValue({ ...GROUP, items: [ITEM] });
    groupRepo.findMany.mockResolvedValue([GROUP]);
    groupRepo.create.mockResolvedValue(GROUP);
    groupRepo.update.mockResolvedValue(GROUP);
    groupItemRepo.findMany.mockResolvedValue([]);
    productRepo.findMany.mockResolvedValue([{ id: PROD_A }]);
    featureFlagRepo.findUnique.mockResolvedValue(null);
  });

  // C-2 (retro Epic 3): picker gói của giỏ hàng (Story 4.1) do THO_KS dùng — có `catalog.view`
  // KHÔNG có `catalog.manage`. Đọc được gói, không sửa được gói.
  describe('C-2 — catalog.view: ĐỌC được gói, KHÔNG ghi (kịch bản THO_KS)', () => {
    it('GET /product-groups (chỉ catalog.view) ⇒ 200', async () => {
      givenPermissions(PERM.catalogView);

      const res = await request(server())
        .get('/product-groups')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
    });

    it('POST /product-groups (chỉ catalog.view, thiếu catalog.manage) ⇒ 403', async () => {
      givenPermissions(PERM.catalogView);

      const res = await request(server())
        .post('/product-groups')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Gói thử' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('thiếu quyền sửa danh mục ⇒ 403 trên CẢ 7 route', () => {
    // Một route quên `@RequirePermissions` sẽ đỏ ở đây — không cần nhớ kiểm tay.
    const routes: readonly { name: string; call: () => request.Test }[] = [
      {
        name: 'GET /product-groups',
        call: () => request(server()).get('/product-groups'),
      },
      {
        name: 'GET /product-groups/:id',
        call: () => request(server()).get(`/product-groups/${GROUP_ID}`),
      },
      {
        name: 'POST /product-groups',
        call: () => request(server()).post('/product-groups'),
      },
      {
        name: 'PATCH /product-groups/:id',
        call: () => request(server()).patch(`/product-groups/${GROUP_ID}`),
      },
      {
        name: 'DELETE /product-groups/:id',
        call: () => request(server()).delete(`/product-groups/${GROUP_ID}`),
      },
      {
        name: 'POST /product-groups/:id/reactivate',
        call: () =>
          request(server()).post(`/product-groups/${GROUP_ID}/reactivate`),
      },
      {
        name: 'PUT /product-groups/:id/items',
        call: () => request(server()).put(`/product-groups/${GROUP_ID}/items`),
      },
    ];

    for (const route of routes) {
      it(`${route.name} ⇒ 403`, async () => {
        // Có quyền khác (kể cả costs.view và settings.manage) nhưng KHÔNG có quyền sửa danh mục.
        givenPermissions(
          PERM.costsView,
          PERM.settingsManage,
          PERM.ordersViewOwn,
        );

        const res = await route
          .call()
          .set('Authorization', `Bearer ${token()}`)
          .send({});

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      });
    }

    it('không có token ⇒ 401 (authn fail-closed)', async () => {
      const res = await request(server()).get('/product-groups');

      expect(res.status).toBe(401);
    });
  });

  describe('🔴 costPrice KHÔNG có đường nào rời server qua cửa gói', () => {
    it('GET /product-groups ⇒ 200, body KHÔNG chứa chuỗi costPrice', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .get('/product-groups')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/costPrice/);
    });

    it('GET /product-groups/:id ⇒ 200, body KHÔNG chứa chuỗi costPrice — KỂ CẢ khi Prisma trả về bản ghi Product đầy đủ', async () => {
      // Mock cố tình trả NGUYÊN bản ghi `Product` kèm giá vốn — đúng thứ mà một
      // `include: { product: true }` sẽ nhận được từ Postgres thật. Nếu service serialize thẳng
      // cái nó nhận, giá vốn ra tới dây và test này đỏ. Đây là lý do test canh BODY, không canh
      // mock: canh mock chỉ chứng minh ta dạy mock đúng.
      givenPermissions(PERM.catalogView, PERM.catalogManage);
      groupRepo.findUnique.mockResolvedValue({
        ...GROUP,
        items: [
          {
            ...ITEM,
            product: { ...ITEM.product, costPrice: 1_950_000 },
          },
        ],
      });

      const res = await request(server())
        .get(`/product-groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/costPrice/);
      expect(res.body.items[0].price).toBe(2_450_000);
      expect(res.body.items[0].productId).toBe(PROD_A);
    });

    it('người CÓ costs.view cũng KHÔNG thấy giá vốn ở đây — gói không cần nó cho việc gì', async () => {
      // Không đi đường `stripCostPrice` + `costs.view`: gói không lấy giá vốn về, nên không có gì
      // để lọc. Ai cần lãi gộp theo gói thì đi story riêng, qua `costs.view` tử tế.
      //
      // ⚠️ Fixture PHẢI mang `costPrice`, kẻo ca này vô nghĩa: một mock không có giá vốn thì
      // không có gì để rò, và assert dưới xanh kể cả khi service trả nguyên bản ghi Product.
      givenPermissions(PERM.catalogView, PERM.catalogManage, PERM.costsView);
      groupRepo.findUnique.mockResolvedValue({
        ...GROUP,
        items: [
          { ...ITEM, product: { ...ITEM.product, costPrice: 1_950_000 } },
        ],
      });

      const res = await request(server())
        .get(`/product-groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/costPrice/);
    });
  });

  describe('thứ tự khai route — :id trần KHÔNG nuốt sub-resource', () => {
    it('POST :id/reactivate ⇒ 200 (KHÔNG 201 — bật lại không tạo tài nguyên nào)', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);
      groupRepo.findUnique.mockResolvedValue({ ...GROUP, isActive: false });
      groupRepo.update.mockResolvedValue(GROUP);

      const res = await request(server())
        .post(`/product-groups/${GROUP_ID}/reactivate`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);
      expect(groupRepo.update.mock.calls[0][0].data).toEqual({
        isActive: true,
      });
    });

    it('PUT :id/items ⇒ 200 và trả gói kèm checklist mới', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .put(`/product-groups/${GROUP_ID}/items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productIds: [PROD_A] });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].productId).toBe(PROD_A);
    });
  });

  describe('?includeInactive — chuỗi query thành boolean, CHỈ ở controller', () => {
    // Unit test gọi thẳng `findAll(boolean)` nên nó KHÔNG bao giờ chạy qua chỗ chuỗi query được
    // dịch thành boolean. Đó là một dòng thật, và nó chỉ tồn tại ở đây. Không có ca nào dưới đây
    // thì `Boolean(includeInactive)` (mọi chuỗi kể cả 'false' đều thành true) vẫn xanh cả suite —
    // và gói ĐÃ TẮT rò ra picker qua `?includeInactive=false`.
    it('vắng query ⇒ chỉ gói còn hiệu lực', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .get('/product-groups')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(groupRepo.findMany.mock.calls[0][0].where).toEqual({
        isActive: true,
      });
    });

    it('?includeInactive=true ⇒ where rỗng (lấy cả gói đã tắt)', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .get('/product-groups?includeInactive=true')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(groupRepo.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('🔴 ?includeInactive=false ⇒ VẪN chỉ gói còn hiệu lực (chuỗi "false" KHÔNG phải true)', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .get('/product-groups?includeInactive=false')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(groupRepo.findMany.mock.calls[0][0].where).toEqual({
        isActive: true,
      });
    });
  });

  describe('trần độ dài — DTO là hàng rào DUY NHẤT (cột name/description là TEXT, DB không chặn)', () => {
    it('POST name dài quá 100 ký tự ⇒ 400, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .post('/product-groups')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'G'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(groupRepo.create).not.toHaveBeenCalled();
    });

    it('POST description dài quá 500 ký tự ⇒ 400, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .post('/product-groups')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Gói hợp lệ', description: 'M'.repeat(501) });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('description');
      expect(groupRepo.create).not.toHaveBeenCalled();
    });

    it('PATCH name dài quá 100 ký tự ⇒ 400 (đường sửa cũng phải có trần, không chỉ đường tạo)', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .patch(`/product-groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'G'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(groupRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('CRUD qua dây', () => {
    it('POST ⇒ 201, event ProductGroupCreated tới audit', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .post('/product-groups')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Gói Hybrid 8kW', description: 'Trọn bộ.' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Gói Hybrid 8kW');
      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('ProductGroupCreated');
      expect(logged.targetType).toBe('ProductGroup');
    });

    it('POST name rỗng ⇒ 400 VALIDATION_ERROR, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .post('/product-groups')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(groupRepo.create).not.toHaveBeenCalled();
    });

    it('POST tên trùng ⇒ 409 CONFLICT kèm fieldErrors trỏ ô name', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);
      groupRepo.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const res = await request(server())
        .post('/product-groups')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Gói Hybrid 8kW' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('POST kèm isActive ⇒ field bị loại khỏi payload ghi DB (isActive luôn true)', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .post('/product-groups')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Gói mới', isActive: false });

      expect(res.status).toBe(201);
      expect(groupRepo.create.mock.calls[0][0].data.isActive).toBe(true);
    });

    it('PATCH name: null ⇒ 400 (cột NOT NULL), KHÔNG ghi DB', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .patch(`/product-groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: null });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(groupRepo.update).not.toHaveBeenCalled();
    });

    it('PATCH description: null ⇒ 200 (cột nullable — đó là cách XOÁ mô tả)', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);
      groupRepo.update.mockResolvedValue({ ...GROUP, description: null });

      const res = await request(server())
        .patch(`/product-groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(groupRepo.update.mock.calls[0][0].data.description).toBeNull();
    });

    it('PATCH kèm isActive ⇒ field bị loại, KHÔNG có đường tắt/bật gói qua PATCH', async () => {
      // Đối xứng với ca POST ở trên. Tắt/bật đi route riêng (DELETE / :id/reactivate) vì hai việc
      // đó publish event RIÊNG (`Deactivated`/`Reactivated`). Nếu `isActive` lọt vào DTO sửa, gói
      // bị tắt qua PATCH sẽ ghi nhật ký là "ProductGroupUpdated" — một dòng audit sai tên việc.
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .patch(`/product-groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Gói Hybrid 10kW', isActive: false });

      expect(res.status).toBe(200);
      expect(groupRepo.update.mock.calls[0][0].data).not.toHaveProperty(
        'isActive',
      );
    });

    it('DELETE ⇒ 204 và là SOFT-delete (isActive=false)', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);
      groupRepo.findUnique.mockResolvedValue(GROUP);
      groupRepo.update.mockResolvedValue({ ...GROUP, isActive: false });

      const res = await request(server())
        .delete(`/product-groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(204);
      expect(groupRepo.update.mock.calls[0][0]).toEqual({
        where: { id: GROUP_ID },
        data: { isActive: false },
      });
    });

    it('GET /product-groups/:id không tồn tại ⇒ 404', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);
      groupRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get(`/product-groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('PUT :id/items với productId lặp ⇒ 400, KHÔNG chạm transaction', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .put(`/product-groups/${GROUP_ID}/items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productIds: [PROD_A, PROD_A] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('productIds');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('PUT :id/items với productIds không phải uuid ⇒ 400 ở pipe', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .put(`/product-groups/${GROUP_ID}/items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productIds: ['không-phải-uuid'] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('🔴 PUT :id/items THIẾU productIds ⇒ 400 ở pipe, KHÔNG phải 500', async () => {
      // `productIds` vắng mặt đi xuống service là `undefined`, và `for (const id of undefined)`
      // trong `assertNoDuplicateProductId` ném TypeError ⇒ 500 lộ stack thay vì 400 nói rõ sai ở
      // đâu. Thứ giữ ranh giới đó là việc `productIds` BẮT BUỘC có mặt: thêm một `@IsOptional()`
      // vào nó là pipe tha `undefined` xuống thẳng service — đã kiểm bằng đột biến, ca này ĐỎ với
      // đúng `Received: 500`. (Không phải `@IsArray()`: gỡ riêng nó đi thì `@IsUUID(each)` vẫn
      // chặn, suite vẫn xanh.)
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .put(`/product-groups/${GROUP_ID}/items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('productIds');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('PUT :id/items với productIds là chuỗi (không phải mảng) ⇒ 400', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);

      const res = await request(server())
        .put(`/product-groups/${GROUP_ID}/items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productIds: PROD_A });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('PUT :id/items với productIds: [] ⇒ 200 (gói rỗng là hợp lệ)', async () => {
      givenPermissions(PERM.catalogView, PERM.catalogManage);
      groupRepo.findUnique
        .mockResolvedValueOnce(GROUP)
        .mockResolvedValueOnce({ ...GROUP, items: [] });

      const res = await request(server())
        .put(`/product-groups/${GROUP_ID}/items`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ productIds: [] });

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });
  });
});
