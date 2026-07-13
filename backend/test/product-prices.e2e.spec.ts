import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { FLAG } from '../src/feature-flags/domain/feature-flag-registry';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * GOTCHA (2.3/2.5): `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc **import module** →
 * phải set env TRƯỚC khi `AppModule` được nạp. Vì vậy KHÔNG static-import `AppModule` ở đầu
 * file (import bị hoist); set env ở top-level rồi `await import()` động trong `beforeAll`.
 */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e giá phân tầng + cờ tính năng (hermetic — override `PrismaService`, ký JWT thật).
 *
 * Phủ những bất biến sống ở tầng HTTP/guard mà unit test KHÔNG chứng minh được:
 *
 *  - AC-3: HAI QUYỀN TÁCH BẠCH. Có `catalog.manage` KHÔNG cho phép bấm cờ; có
 *    `system.feature_flags` KHÔNG cho phép cấu hình bậc thang. Gộp nhầm hai quyền này là cách
 *    một người bán tự bật giá sỉ cho cả công ty.
 *  - AC-5: cờ TẮT ⇒ body `GET /products/:id` KHÔNG CÓ KEY `prices` (đi qua dây thật, không
 *    phải "để FE tự ẩn" — AD-4).
 *  - AC-9: event chảy tới `AuditSubscriber` THẬT.
 */
describe('/products/:productId/prices + /feature-flags (e2e)', () => {
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

  const TIER_ROW = {
    id: 'pp-1',
    productId: PRODUCT.id,
    minQty: 10,
    price: 2_300_000,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };

  /** Bậc thang mà DB "có sẵn" cho `PRODUCT` — chỉ chảy ra client khi truy vấn CÓ `include`. */
  const TIERS_IN_DB = [{ id: 'pp-1', minQty: 10, price: 2_300_000 }];

  /**
   * Mock `product` phải BẮT CHƯỚC ngữ nghĩa `include` của Prisma: chỉ đính `prices` khi truy
   * vấn yêu cầu `include.prices`.
   *
   * Đây KHÔNG phải cầu kỳ thừa. Mock trả cứng một object không có `prices` khiến mọi test
   * "cờ TẮT ⇒ body không có key `prices`" XANH GIẢ — chúng xanh vì mock nghèo dữ liệu, không
   * vì service tôn trọng cờ. Đã kiểm bằng đột biến: ép `tieredPriceInclude` luôn trả `include`
   * mà cả suite vẫn xanh. Với mock này, đúng đột biến đó chuyển ĐỎ.
   */
  interface FindProductArgs {
    include?: { prices?: unknown };
  }
  type ProductRow = typeof PRODUCT & { prices?: typeof TIERS_IN_DB };

  function findProduct(args?: FindProductArgs): ProductRow {
    return args?.include?.prices
      ? { ...PRODUCT, prices: TIERS_IN_DB }
      : { ...PRODUCT };
  }

  const productRepo = {
    findUnique: jest.fn((args?: FindProductArgs): Promise<ProductRow | null> =>
      Promise.resolve(findProduct(args)),
    ),
    findMany: jest.fn((args?: FindProductArgs): Promise<ProductRow[]> =>
      Promise.resolve([findProduct(args)]),
    ),
    create: jest.fn(),
    update: jest.fn(),
  };
  const productPriceRepo = {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockReturnValue({ op: 'deleteMany' }),
    createMany: jest.fn().mockReturnValue({ op: 'createMany' }),
  };
  const featureFlagRepo = {
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn(),
  };
  // `AuditSubscriber` THẬT chạy trong `AppModule` và nhận mọi event ta publish.
  const auditRepo = { create: jest.fn().mockResolvedValue({}) };

  const prismaMock = {
    product: productRepo,
    productPrice: productPriceRepo,
    featureFlag: featureFlagRepo,
    auditLog: auditRepo,
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  /** Bộ quyền hiệu lực mà guard + controller sẽ resolve tươi cho request kế tiếp. */
  function givenPermissions(...keys: string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  /** Trạng thái cờ trong DB cho request kế tiếp. `null` = vắng dòng = TẮT. */
  function givenFlag(enabled: boolean | null): void {
    featureFlagRepo.findUnique.mockResolvedValue(
      enabled === null
        ? null
        : { key: FLAG.catalogTieredPricing, enabled, updatedAt: new Date() },
    );
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
    productRepo.findUnique.mockImplementation((args) =>
      Promise.resolve(findProduct(args)),
    );
    productRepo.findMany.mockImplementation((args) =>
      Promise.resolve([findProduct(args)]),
    );
    productPriceRepo.findMany.mockResolvedValue([]);
    productPriceRepo.deleteMany.mockReturnValue({ op: 'deleteMany' });
    productPriceRepo.createMany.mockReturnValue({ op: 'createMany' });
    prismaMock.$transaction.mockResolvedValue([]);
    auditRepo.create.mockResolvedValue({});
    givenFlag(null);
  });

  describe('AC-3 — hai quyền TÁCH BẠCH, không gộp', () => {
    it('thiếu catalog.manage ⇒ 403 trên GET /products/:productId/prices', async () => {
      givenPermissions(PERM.ordersViewOwn);

      const res = await request(server())
        .get(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('thiếu catalog.manage ⇒ 403 trên PUT /products/:productId/prices', async () => {
      givenPermissions(PERM.ordersViewOwn);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ prices: [] });

      expect(res.status).toBe(403);
    });

    it('CÓ catalog.manage nhưng THIẾU system.feature_flags ⇒ 403 khi bấm cờ', async () => {
      // Bất biến quan trọng nhất của AC-3: sửa danh mục ≠ bấm công tắc hệ thống. Người bán
      // được cấu hình mức giá (khi cờ đã bật) nhưng KHÔNG được tự bật giá sỉ cho cả công ty.
      givenPermissions(PERM.catalogManage);

      const res = await request(server())
        .patch(`/feature-flags/${FLAG.catalogTieredPricing}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ enabled: true });

      expect(res.status).toBe(403);
      expect(featureFlagRepo.upsert).not.toHaveBeenCalled();
    });

    it('CÓ system.feature_flags ⇒ bấm cờ được (200)', async () => {
      givenPermissions(PERM.systemFeatureFlags);
      featureFlagRepo.upsert.mockResolvedValue({
        key: FLAG.catalogTieredPricing,
        enabled: true,
        updatedAt: new Date(),
      });

      const res = await request(server())
        .patch(`/feature-flags/${FLAG.catalogTieredPricing}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });

    it('TẮT cờ qua HTTP ⇒ 200, enabled=false (công tắc chạy được hai chiều)', async () => {
      // Chiều BẬT đã có test. Chiều TẮT là chiều nguy hiểm hơn — nó đưa cả danh mục về một
      // giá — nên nó cũng phải đi qua đúng cái cổng đó và trả đúng trạng thái sau khi bấm.
      givenPermissions(PERM.systemFeatureFlags);
      givenFlag(true);
      featureFlagRepo.upsert.mockResolvedValue({
        key: FLAG.catalogTieredPricing,
        enabled: false,
        updatedAt: new Date(),
      });

      const res = await request(server())
        .patch(`/feature-flags/${FLAG.catalogTieredPricing}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(featureFlagRepo.upsert).toHaveBeenCalledTimes(1);
    });

    it('GET /feature-flags chỉ cần phiên hợp lệ (sale Epic 4 không có catalog.manage vẫn đọc được)', async () => {
      givenPermissions(PERM.quotesCreateEdit);

      const res = await request(server())
        .get('/feature-flags')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('key', FLAG.catalogTieredPricing);
      expect(res.body[0]).toHaveProperty('enabled', false);
    });

    it('không có token ⇒ 401 (authn fail-closed)', async () => {
      const res = await request(server()).get('/feature-flags');

      expect(res.status).toBe(401);
    });
  });

  describe('AC-1/AC-3 — cờ lạ không tồn tại', () => {
    it('PATCH /feature-flags/<key lạ> ⇒ 404, KHÔNG âm thầm tạo cờ mới', async () => {
      givenPermissions(PERM.systemFeatureFlags);

      const res = await request(server())
        .patch('/feature-flags/catalog.co-tuy-tien')
        .set('Authorization', `Bearer ${token()}`)
        .send({ enabled: true });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
      expect(featureFlagRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('AC-3/AC-7 — GET bậc thang (đường đi thành công)', () => {
    it('CÓ catalog.manage ⇒ 200, trả bậc thang sắp xếp minQty tăng dần', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);
      productPriceRepo.findMany.mockResolvedValue([
        TIER_ROW,
        { ...TIER_ROW, id: 'pp-2', minQty: 50, price: 2_150_000 },
      ]);

      const res = await request(server())
        .get(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      // Hợp đồng qua dây: chỉ `id`/`minQty`/`price` — KHÔNG rò `createdAt`/`updatedAt`/`productId`.
      expect(res.body).toEqual([
        { id: 'pp-1', minQty: 10, price: 2_300_000 },
        { id: 'pp-2', minQty: 50, price: 2_150_000 },
      ]);
      expect(productPriceRepo.findMany.mock.calls[0][0].orderBy).toEqual({
        minQty: 'asc',
      });
    });

    it('sản phẩm không tồn tại ⇒ 404 (không trả mảng rỗng giả vờ là "chưa cấu hình")', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);
      productRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get('/products/không-có/prices')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('cờ TẮT ⇒ vẫn ĐỌC được bậc thang đang ngủ đông (chỉ GHI mới bị chặn 409)', async () => {
      // Ghim hành vi cố ý: tắt cờ KHÔNG xoá dữ liệu (AC-6), nên người có `catalog.manage`
      // phải nhìn thấy được thứ sẽ sống lại khi bật cờ. Cờ chặn ĐƯỜNG GHI (409) và chặn
      // `prices` rò vào payload sản phẩm (AC-5) — nó không làm màn cấu hình mù.
      givenPermissions(PERM.catalogManage);
      givenFlag(false);
      productPriceRepo.findMany.mockResolvedValue([TIER_ROW]);

      const res = await request(server())
        .get(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'pp-1', minQty: 10, price: 2_300_000 }]);
    });
  });

  describe('AC-5 — cờ TẮT ⇒ payload sản phẩm KHÔNG CÓ key `prices`', () => {
    it('cờ TẮT ⇒ GET /products/:id body không có key `prices`', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(null); // vắng dòng = TẮT

      const res = await request(server())
        .get(`/products/${PRODUCT.id}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      // Loại HẲN key — không phải `[]`, không phải `null`.
      expect(res.body).not.toHaveProperty('prices');
    });

    it('cờ BẬT ⇒ GET /products/:id body CÓ `prices`', async () => {
      // KHÔNG override mock: bậc thang chỉ tới được client nếu service THẬT SỰ truyền
      // `include` xuống Prisma — tức là cờ đã được nối đúng dây.
      givenPermissions(PERM.catalogManage);
      givenFlag(true);

      const res = await request(server())
        .get(`/products/${PRODUCT.id}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.prices).toEqual(TIERS_IN_DB);
    });

    it('cờ TẮT ⇒ GET /products (DANH SÁCH) — mọi phần tử đều không có key `prices`', async () => {
      // AC-5 nêu CẢ HAI đường đọc. Danh sách là đường sale Epic 4 dùng nhiều nhất; ghim riêng
      // vì `findMany` và `findUnique` là hai call-site khác nhau — sửa đúng một chỗ là bug.
      givenPermissions(PERM.catalogManage);
      givenFlag(null);

      const res = await request(server())
        .get('/products')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      for (const item of res.body) {
        expect(item).not.toHaveProperty('prices');
      }
    });

    it('cờ BẬT ⇒ GET /products (DANH SÁCH) — mỗi phần tử mang bậc thang của nó', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);

      const res = await request(server())
        .get('/products')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body[0].prices).toEqual(TIERS_IN_DB);
    });

    it('cờ TẮT ⇒ PUT prices bị chặn 409 (không ghi dữ liệu ma)', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(false);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ prices: [{ minQty: 10, price: 2_300_000 }] });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('AC-4/AC-7 — validate bậc thang', () => {
    it('minQty = 1 ⇒ 400 (mức 1 CHÍNH LÀ giá gốc — không được có hai nguồn chân lý)', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ prices: [{ minQty: 1, price: 2_400_000 }] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors.length).toBeGreaterThan(0);
    });

    it('price là số thập phân ⇒ 400 (tiền là số nguyên đồng — AD-10)', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ prices: [{ minQty: 10, price: 2_300_000.5 }] });

      expect(res.status).toBe(400);
    });

    it('trùng minQty trong payload ⇒ 400', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({
          prices: [
            { minQty: 10, price: 2_300_000 },
            { minQty: 10, price: 2_200_000 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('sản phẩm không tồn tại ⇒ 404', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);
      productRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .put('/products/không-có/prices')
        .set('Authorization', `Bearer ${token()}`)
        .send({ prices: [] });

      expect(res.status).toBe(404);
    });

    it('price âm ⇒ 400 (@Min(0) — giá không thể âm)', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ prices: [{ minQty: 10, price: -1 }] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('thiếu hẳn key `prices` trong body ⇒ 400 (không được coi là "mảng rỗng")', async () => {
      // Body rỗng KHÁC `{"prices": []}`: một cái là quên gõ, một cái là cố ý xoá bậc thang.
      // Đoán hộ người dùng ở đây ⇒ một request lỗi âm thầm xoá sạch giá sỉ của sản phẩm.
      givenPermissions(PERM.catalogManage);
      givenFlag(true);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(productPriceRepo.deleteMany).not.toHaveBeenCalled();
    });

    it.each([
      ['prices: null', { prices: null }],
      ['minQty: null', { prices: [{ minQty: null, price: 2_300_000 }] }],
      ['price: null', { prices: [{ minQty: 10, price: null }] }],
    ])(
      '%s ⇒ 400, KHÔNG lọt xuống cột NOT NULL (bài học HIGH review 3.1)',
      async (_name, body) => {
        // `@IsOptional()` tha luôn `null` ⇒ `null` đi thẳng xuống cột NOT NULL ⇒ 500 thay vì
        // 400. Mock Prisma NUỐT `null` không kêu ca, nên chỉ có test tường minh qua HTTP mới
        // thấy được. DTO giá dùng validator trần — ghim lại để không ai "tiện tay" thêm
        // `@IsOptional()` vào sau này.
        givenPermissions(PERM.catalogManage);
        givenFlag(true);

        const res = await request(server())
          .put(`/products/${PRODUCT.id}/prices`)
          .set('Authorization', `Bearer ${token()}`)
          .send(body);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      },
    );

    it.each([
      // `@ValidateNested({ each: true })` KHÔNG loại một phần tử bản thân nó là MẢNG: phần tử
      // lồng lọt qua pipe, `minQty`/`price` thành `undefined`, rồi `undefined` xuống cột NOT
      // NULL ⇒ 500. Cùng họ lỗi với `null` ở trên, chỉ khác hình dạng.
      ['phần tử là MẢNG lồng', { prices: [[{ minQty: 5, price: 1 }]] }],
      ['phần tử là chuỗi', { prices: ['10:2300000'] }],
      // Cột là INTEGER (INT4): vượt trần ⇒ Postgres `22003` ⇒ 500. Gõ thừa một số 0 khi nhập
      // giá là chuyện thường ngày — phải là 400, không phải sập.
      [
        'price vượt trần INT4',
        { prices: [{ minQty: 10, price: 9_999_999_999 }] },
      ],
      [
        'minQty vượt trần INT4',
        { prices: [{ minQty: 3_000_000_000, price: 1 }] },
      ],
    ])('%s ⇒ 400, KHÔNG chạm DB', async (_name, body) => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(productPriceRepo.createMany).not.toHaveBeenCalled();
    });

    it('enabled: null ⇒ 400, KHÔNG lọt xuống cột NOT NULL (bài học HIGH review 3.1)', async () => {
      givenPermissions(PERM.systemFeatureFlags);

      const res = await request(server())
        .patch(`/feature-flags/${FLAG.catalogTieredPricing}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ enabled: null });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(featureFlagRepo.upsert).not.toHaveBeenCalled();
    });

    it('PUT [] hợp lệ ⇒ 200 và bậc thang trống (xoá hết, quay về một giá)', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);
      productPriceRepo.findMany.mockResolvedValue([]);

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ prices: [] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(productPriceRepo.deleteMany).toHaveBeenCalled();
      // Cạm bẫy Prisma 7: `createMany({ data: [] })` làm hỏng atomic-replace.
      expect(productPriceRepo.createMany).not.toHaveBeenCalled();
    });
  });

  describe('AC-9 — audit qua AuditSubscriber THẬT', () => {
    it('bấm cờ ⇒ AuditLog ghi FeatureFlagToggled', async () => {
      givenPermissions(PERM.systemFeatureFlags);
      featureFlagRepo.upsert.mockResolvedValue({
        key: FLAG.catalogTieredPricing,
        enabled: true,
        updatedAt: new Date(),
      });

      await request(server())
        .patch(`/feature-flags/${FLAG.catalogTieredPricing}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ enabled: true });

      expect(auditRepo.create).toHaveBeenCalledTimes(1);
      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('FeatureFlagToggled');
      expect(logged.actorAccountId).toBe(ACCOUNT_ID);
      expect(logged.targetType).toBe('FeatureFlag');
      expect(logged.targetId).toBe(FLAG.catalogTieredPricing);
    });

    it('thay bậc thang ⇒ AuditLog ghi ProductPricesReplaced với CẢ tập trước và sau', async () => {
      givenPermissions(PERM.catalogManage);
      givenFlag(true);
      productPriceRepo.findMany
        .mockResolvedValueOnce([TIER_ROW]) // before
        .mockResolvedValueOnce([{ ...TIER_ROW, id: 'pp-2', minQty: 20 }]); // after

      const res = await request(server())
        .put(`/products/${PRODUCT.id}/prices`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ prices: [{ minQty: 20, price: 2_300_000 }] });

      expect(res.status).toBe(200);
      expect(auditRepo.create).toHaveBeenCalledTimes(1);
      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('ProductPricesReplaced');
      expect(logged.targetType).toBe('Product');
      expect(logged.targetId).toBe(PRODUCT.id);
      expect(logged.before).toEqual([{ minQty: 10, price: 2_300_000 }]);
      expect(logged.after).toEqual([{ minQty: 20, price: 2_300_000 }]);
    });
  });
});
