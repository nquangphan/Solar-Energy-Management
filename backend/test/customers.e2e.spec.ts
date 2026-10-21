import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ErrorCode } from '../src/common/errors/error-code';
import { CUST_TYPE } from '../src/customers/domain/customer-type';
import { PrismaService } from '../src/prisma/prisma.service';
import { initAppOnLoopback } from './util/listen-loopback';

/**
 * GOTCHA (2.3/2.5): `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc **import module** ⇒ phải
 * set env TRƯỚC khi `AppModule` được nạp. Vì vậy KHÔNG static-import `AppModule` (import bị
 * hoist); set env ở top-level rồi `await import()` động trong `beforeAll`.
 */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/customers` + `/customer-sources` (hermetic — override `PrismaService`, ký JWT thật).
 * Phủ những bất biến sống ở tầng HTTP/guard/pipe mà unit test KHÔNG chạm tới:
 *
 *  - Guard toàn cục thật sự chạy: thiếu `customers.manage` ⇒ 403 trên MỌI route.
 *  - `ValidationPipe` thật: SĐT rác/`null` trên cột NOT NULL ⇒ 400 và DB KHÔNG bị chạm.
 *  - `phone` trong body PATCH ⇒ 400 — KHÔNG bị `whitelist: true` âm thầm cắt đi rồi trả 200.
 *  - Event đi qua `EventBus` tới `AuditSubscriber` THẬT và ghi `AuditLog`.
 */
describe('/customers (e2e)', () => {
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
  const NGUON_FACEBOOK = {
    id: '5f4d3c2b-1a09-4e8d-9c7b-6a5f4e3d2c1b',
    name: 'Facebook',
    description: 'Từ quảng cáo Facebook.',
    active: true,
    sortOrder: 1,
    isOther: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const NGUON_KHAC = {
    ...NGUON_FACEBOOK,
    id: '11111111-2222-4333-8444-555555555555',
    name: 'Khác',
    sortOrder: 99,
    isOther: true,
  };

  const KHACH = {
    sdt: SDT_E164,
    custType: CUST_TYPE.caNhan,
    name: 'Nguyễn Văn A',
    cccd: null,
    taxCode: null,
    address: null,
    bankAccount: null,
    sourceId: NGUON_FACEBOOK.id,
    sourceNote: null,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };

  const customerRepo = {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const customerSourceRepo = { findUnique: jest.fn(), findMany: jest.fn() };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule`; thiếu nó thì subscriber
  // ném (bus cô lập lỗi nên test vẫn xanh, chỉ ồn log) và ta mất luôn bằng chứng event tới đích.
  const auditRepo = { create: jest.fn().mockResolvedValue({}) };
  const featureFlagRepo = { findUnique: jest.fn().mockResolvedValue(null) };
  // `list()` gói findMany + count vào `$transaction([...])` — thiếu mock này là 500 trên mọi
  // request danh sách. Trả tuple ĐÚNG thứ tự truyền vào (Prisma 7).
  const transaction = jest.fn(async (ops: Promise<unknown>[]) => [
    await ops[0],
    await ops[1],
  ]);
  const prismaMock = {
    customer: customerRepo,
    customerSource: customerSourceRepo,
    auditLog: auditRepo,
    featureFlag: featureFlagRepo,
    $transaction: transaction,
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  const bodyHopLe = {
    phone: '0912 345 678',
    custType: CUST_TYPE.caNhan,
    name: 'Nguyễn Văn A',
    sourceId: NGUON_FACEBOOK.id,
  };

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
    await initAppOnLoopback(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    customerRepo.create.mockResolvedValue(KHACH);
    customerRepo.update.mockResolvedValue(KHACH);
    customerRepo.findUnique.mockResolvedValue(KHACH);
    customerRepo.findMany.mockResolvedValue([KHACH]);
    customerRepo.count.mockResolvedValue(1);
    customerSourceRepo.findUnique.mockResolvedValue(NGUON_FACEBOOK);
    customerSourceRepo.findMany.mockResolvedValue([NGUON_FACEBOOK, NGUON_KHAC]);
    auditRepo.create.mockResolvedValue({});
    transaction.mockImplementation(async (ops: Promise<unknown>[]) => [
      await ops[0],
      await ops[1],
    ]);
  });

  describe('AC-11 — thiếu customers.manage ⇒ 403 trên MỌI route', () => {
    const routes: readonly { name: string; call: () => request.Test }[] = [
      {
        name: 'POST /customers',
        call: () => request(server()).post('/customers'),
      },
      {
        name: 'GET /customers',
        call: () => request(server()).get('/customers'),
      },
      {
        name: 'GET /customers/lookup',
        call: () => request(server()).get('/customers/lookup?phone=0912345678'),
      },
      {
        name: 'GET /customers/:phone',
        call: () => request(server()).get(`/customers/${SDT_E164}`),
      },
      {
        name: 'PATCH /customers/:phone',
        call: () => request(server()).patch(`/customers/${SDT_E164}`),
      },
      {
        name: 'GET /customer-sources',
        call: () => request(server()).get('/customer-sources'),
      },
    ];

    for (const route of routes) {
      it(`${route.name} ⇒ 403`, async () => {
        // Có quyền KHÁC nhưng không có customers.manage — chứng minh guard đọc đúng key.
        givenPermissions(PERM.catalogManage, PERM.costsView);

        const res = await route
          .call()
          .set('Authorization', `Bearer ${token()}`)
          .send({});

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      });
    }

    it('không có token ⇒ 401 (authn fail-closed)', async () => {
      const res = await request(server()).get('/customers');

      expect(res.status).toBe(401);
    });
  });

  describe('AC-1/AC-2 — chuẩn hoá E.164 ở backend; SĐT rác ⇒ 400', () => {
    it('POST SĐT thô ⇒ 201, PK ghi DB là E.164 và response trả về E.164', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send(bodyHopLe);

      expect(res.status).toBe(201);
      expect(res.body.phone).toBe(SDT_E164);
      expect(customerRepo.create.mock.calls[0][0].data.sdt).toBe(SDT_E164);
    });

    // The response is built by a map, not a cast of the Prisma row: the column names must not
    // reach the wire next to (or instead of) the contract names.
    it('POST ⇒ response carries contract names only (`phone`, `nationalId`), never the columns', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.create.mockResolvedValue({ ...KHACH, cccd: '079201001234' });

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...bodyHopLe, nationalId: '079201001234' });

      expect(res.status).toBe(201);
      expect(res.body.phone).toBe(SDT_E164);
      expect(res.body.nationalId).toBe('079201001234');
      expect(res.body.sdt).toBeUndefined();
      expect(res.body.cccd).toBeUndefined();
      expect(customerRepo.create.mock.calls[0][0].data.cccd).toBe(
        '079201001234',
      );
    });

    for (const rac of [
      'abc',
      '123',
      '+16505550123',
      '0912345',
      '',
      '09123456789012345678',
    ]) {
      it(`POST phone "${rac}" ⇒ 400 VALIDATION_ERROR, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .post('/customers')
          .set('Authorization', `Bearer ${token()}`)
          .send({ ...bodyHopLe, phone: rac });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].field).toBe('phone');
        expect(customerRepo.create).not.toHaveBeenCalled();
      });
    }

    // Khoá chính không được nhận thứ không phải chuỗi: một mảng/số lọt tới `normalizeVnPhone`
    // là 500 chờ sẵn, và `@IsString()` là thứ duy nhất đứng chắn. Không test = không ai biết
    // khi nó bị gỡ.
    for (const [nhan, phone] of [
      ['số', 912345678],
      ['mảng', ['0912345678']],
      ['object lồng', { $ne: null }],
    ] as const) {
      it(`POST phone là ${nhan} ⇒ 400, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .post('/customers')
          .set('Authorization', `Bearer ${token()}`)
          .send({ ...bodyHopLe, phone });

        expect(res.status).toBe(400);
        expect(res.body.fieldErrors[0].field).toBe('phone');
        expect(customerRepo.create).not.toHaveBeenCalled();
      });
    }

    it('GET /customers/:phone với SĐT rác ⇒ 400 (KHÔNG phải 404 — chưa từng là khoá hợp lệ)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/abc')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('phone');
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });

    it('PATCH /customers/:phone with an unparseable phone ⇒ 400 on field `phone`, no write', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .patch('/customers/abc')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Tên mới' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('phone');
      expect(customerRepo.update).not.toHaveBeenCalled();
    });

    it('GET /customers/:phone bằng dạng THÔ ⇒ tra bằng E.164 (cùng bộ chuẩn hoá)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/0912345678')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.phone).toBe(SDT_E164);
      expect(res.body).toHaveProperty('nationalId');
      expect(res.body.sdt).toBeUndefined();
      expect(res.body.cccd).toBeUndefined();
      expect(customerRepo.findUnique).toHaveBeenCalledWith({
        where: { sdt: SDT_E164 },
      });
    });

    it('GET /customers/:phone không tồn tại ⇒ 404', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get('/customers/0912345678')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('GET /customers — danh sách có search/filter/phân trang (Story 3.4, AC-3)', () => {
    it('trả ENVELOPE { items, total, page, pageSize }, mới nhất TRƯỚC', async () => {
      givenPermissions(PERM.customersManage);
      const khachCu = { ...KHACH, sdt: '+84987654321', name: 'Trần Thị B' };
      customerRepo.findMany.mockResolvedValue([KHACH, khachCu]);
      customerRepo.count.mockResolvedValue(2);

      const res = await request(server())
        .get('/customers')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].phone).toBe(SDT_E164);
      expect(res.body.items[0].sdt).toBeUndefined();
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
      expect(customerRepo.findMany.mock.calls[0][0]).toMatchObject({
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('chưa có khách nào ⇒ 200 envelope rỗng (không phải 404)', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.findMany.mockResolvedValue([]);
      customerRepo.count.mockResolvedValue(0);

      const res = await request(server())
        .get('/customers')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    });

    it('q dạng SỐ NỘI ĐỊA ⇒ nhánh sdt tra bằng needle (bỏ 0 đầu) — đi qua ValidationPipe thật', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers?q=0903')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(customerRepo.findMany.mock.calls[0][0].where).toEqual({
        OR: [
          { name: { contains: '0903', mode: 'insensitive' } },
          { sdt: { contains: '903' } },
        ],
      });
    });

    it('page/pageSize tới dưới dạng CHUỖI vẫn ép được sang số (@Type) và tính đúng skip', async () => {
      // Query string luôn là chuỗi. Thiếu `@Type(() => Number)` thì hoặc 400 oan, hoặc một chuỗi
      // lọt xuống `skip`/`take` của Prisma.
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers?page=3&pageSize=10')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(customerRepo.findMany.mock.calls[0][0]).toMatchObject({
        skip: 20,
        take: 10,
      });
    });

    const queryXau: readonly [string, string][] = [
      ['custType=XXX', 'custType'],
      ['pageSize=101', 'pageSize'],
      ['pageSize=0', 'pageSize'],
      ['page=0', 'page'],
      ['page=-1', 'page'],
    ];

    for (const [query, field] of queryXau) {
      it(`?${query} ⇒ 400 VALIDATION_ERROR (${field}), KHÔNG chạm DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .get(`/customers?${query}`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].field).toBe(field);
        expect(customerRepo.findMany).not.toHaveBeenCalled();
      });
    }
  });

  describe('GET /customers/lookup — tra SĐT (Story 3.4, AC-1)', () => {
    it('🔴 KHÔNG bị route `:phone` nuốt — "lookup" là ROUTE, không phải một SĐT', async () => {
      // Nest so route theo THỨ TỰ KHAI. Khai `@Get('lookup')` sau `@Get(':phone')` ⇒ request này
      // rơi vào findOne với sdt="lookup" ⇒ 400 "SĐT không hợp lệ". Test này là thứ duy nhất
      // đứng giữa hai cách khai đó.
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/lookup?phone=0912345678')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('found');
      expect(res.body).toHaveProperty('customer');
    });

    it('tìm thấy ⇒ 200 { found: true, phone E.164, customer } (đủ để form điền sẵn)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/lookup?phone=0912345678')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.phone).toBe(SDT_E164);
      expect(res.body.sdt).toBeUndefined();
      expect(res.body.customer.phone).toBe(SDT_E164);
      expect(res.body.customer.sdt).toBeUndefined();
      expect(customerRepo.findUnique).toHaveBeenCalledWith({
        where: { sdt: SDT_E164 },
      });
    });

    it('KHÔNG tìm thấy ⇒ 200 { found: false, customer: null } — KHÔNG phải 404', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get('/customers/lookup?phone=0912345678')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        found: false,
        phone: SDT_E164,
        customer: null,
      });
    });

    it('mọi dạng THÔ của cùng một số ⇒ CÙNG một kết quả (hội tụ — cái làm "một SĐT = một khách" có nghĩa)', async () => {
      givenPermissions(PERM.customersManage);

      for (const raw of [
        '0912345678',
        '0912 345 678',
        '+84912345678',
        '84912345678',
      ]) {
        const res = await request(server())
          .get('/customers/lookup')
          .query({ phone: raw })
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(200);
        expect(res.body.phone).toBe(SDT_E164);
        expect(res.body.found).toBe(true);
      }
    });

    for (const rac of ['abc', '123', '+16505550123']) {
      it(`SĐT rác "${rac}" ⇒ 400 VALIDATION_ERROR field phone, KHÔNG chạm DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .get('/customers/lookup')
          .query({ phone: rac })
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].field).toBe('phone');
        expect(customerRepo.findUnique).not.toHaveBeenCalled();
      });
    }

    it('thiếu hẳn `phone` ⇒ 400 (không tra rỗng hộ người dùng)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/lookup')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('phone');
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });

    // The query was renamed with no alias: whitelist strips the unknown `sdt`, so the request
    // arrives without `phone` and is rejected rather than silently looked up.
    it('old query name ?sdt= ⇒ 400 VALIDATION_ERROR, fieldErrors point at `phone`', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/lookup?sdt=0903176968')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('phone');
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Trần + KIỂU của query — ValidationPipe là thứ DUY NHẤT đứng giữa query string và Prisma', () => {
    // Query string tới từ URL: mọi giá trị là CHUỖI, và người gửi có thể lặp một key để biến nó
    // thành MẢNG. Không có test cho các trần/kiểu này thì gỡ một decorator cũng không ai đỏ — cái
    // trần chỉ còn là bình luận (bài học HIGH của 3.2), và một mảng đi thẳng tới normalizeVnPhone.

    // ⚠️ Hai ca dưới đây phải khẳng định MÃ RÀNG BUỘC, không chỉ status 400. Một chuỗi 33 ký tự
    // và một mảng đều bị `normalizeVnPhone` từ chối ⇒ 400 `isPhoneNumber` NGAY CẢ KHI gỡ hết
    // decorator khỏi DTO. Chỉ kiểm status là kiểm nhầm hàng rào: cái trần biến mất mà test vẫn
    // xanh. Mã lỗi là thứ nói cho ta biết request bị chặn Ở ĐÂU.
    it('lookup: phone dài quá trần 32 ký tự ⇒ 400 maxLength (pipe chặn), KHÔNG chạm DB', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/lookup')
        .query({ phone: '0'.repeat(33) })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('phone');
      expect(res.body.fieldErrors[0].code).toBe('maxLength');
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });

    it('lookup: phone lặp key (?phone=a&phone=b ⇒ MẢNG) ⇒ 400 isString — mảng không tới nổi tầng chuẩn hoá', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/lookup?phone=0912345678&phone=0987654321')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('phone');
      // Một mảng vi phạm NHIỀU ràng buộc cùng lúc (thứ tự không phải hợp đồng) — điều phải
      // khẳng định là `isString` CÓ MẶT, tức mảng bị chặn vì nó không phải chuỗi.
      expect(
        res.body.fieldErrors.map((e: { code: string }) => e.code),
      ).toContain('isString');
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });

    it('list: q vượt trần 200 ký tự ⇒ 400, KHÔNG chạm DB', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers')
        .query({ q: 'x'.repeat(201) })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('q');
      expect(customerRepo.findMany).not.toHaveBeenCalled();
    });

    // `@Type(() => Number)` + `@IsInt()`: thiếu một trong hai thì hoặc 400 oan, hoặc một chuỗi/số
    // thực lọt xuống `skip`/`take` của Prisma — nơi nó là lỗi tầng DB, không phải lỗi nhập liệu.
    const soXau: readonly [string, string][] = [
      ['page=abc', 'page'],
      ['pageSize=abc', 'pageSize'],
      ['page=1.5', 'page'],
      ['pageSize=10.5', 'pageSize'],
    ];

    for (const [query, field] of soXau) {
      it(`list: ?${query} không phải số nguyên ⇒ 400 (${field}), KHÔNG chạm DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .get(`/customers?${query}`)
          .set('Authorization', `Bearer ${token()}`);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].field).toBe(field);
        expect(customerRepo.findMany).not.toHaveBeenCalled();
      });
    }

    it('list: pageSize=100 (ĐÚNG trần) ⇒ 200, take=100 — trần không lệch một đơn vị', async () => {
      // `?pageSize=101 ⇒ 400` một mình KHÔNG chứng minh trần đúng: một `@Max(99)` cũng làm nó
      // xanh. Ca biên phải được kiểm từ CẢ HAI phía.
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers?pageSize=100')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(customerRepo.findMany.mock.calls[0][0]).toMatchObject({
        take: 100,
      });
    });

    it('list: custType rỗng (?custType=) ⇒ 400 — chuỗi rỗng KHÔNG phải "không lọc"', async () => {
      // "Vắng mặt" là không lọc; "rỗng" là một giá trị KHÔNG hợp lệ được gửi đi. Gộp hai thứ đó
      // vào nhau là cách một bộ lọc hỏng trông như một bộ lọc trống.
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers?custType=')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('custType');
      expect(customerRepo.findMany).not.toHaveBeenCalled();
    });

    it('list: q toàn khoảng trắng ⇒ 200 và KHÔNG lọc gì (không thành contains: " ")', async () => {
      // Người dùng gõ nhầm dấu cách rồi xoá chữ. Một `contains: '   '` khớp 0 dòng ⇒ danh bạ
      // trông như rỗng trong khi nó đầy.
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers')
        .query({ q: '   ' })
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(customerRepo.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('AC-3 — chặn trùng SĐT: dạng thô KHÁC NHAU, cùng một E.164 ⇒ 409', () => {
    for (const raw of ['0912345678', '0912.345.678', '84912345678', SDT_E164]) {
      it(`POST "${raw}" khi SĐT đã tồn tại ⇒ 409 CONFLICT (fieldErrors trỏ ô phone)`, async () => {
        givenPermissions(PERM.customersManage);
        // Tín hiệu đến từ PK của Postgres (P2002) — không phải từ một câu `if` ở tầng app.
        customerRepo.create.mockRejectedValue(
          Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
          }),
        );

        const res = await request(server())
          .post('/customers')
          .set('Authorization', `Bearer ${token()}`)
          .send({ ...bodyHopLe, phone: raw });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe(ErrorCode.CONFLICT);
        expect(res.body.fieldErrors[0].field).toBe('phone');
        expect(res.body.fieldErrors[0].code).toBe('isUnique');
        // Mọi dạng thô đều đi tới DB bằng CÙNG một khoá — đó là lý do DB chặn được chúng.
        expect(customerRepo.create.mock.calls[0][0].data.sdt).toBe(SDT_E164);
        expect(auditRepo.create).not.toHaveBeenCalled();
      });
    }
  });

  describe('AC-4 — hai loại khách, hai bộ trường', () => {
    it('CA_NHAN kèm taxCode ⇒ 400, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...bodyHopLe, taxCode: '0312345678' });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('taxCode');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    it('THUONG_MAI kèm nationalId ⇒ 400 `nationalId`, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          ...bodyHopLe,
          custType: CUST_TYPE.thuongMai,
          nationalId: '079201001234',
        });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('nationalId');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    it('custType lạ ⇒ 400', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...bodyHopLe, custType: 'DOANH_NGHIEP' });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('custType');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    it('THUONG_MAI đầy đủ MST + tài khoản NH ⇒ 201', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          ...bodyHopLe,
          custType: CUST_TYPE.thuongMai,
          name: 'Công ty TNHH ABC',
          taxCode: '0312345678',
          bankAccount: '0071000123456',
        });

      expect(res.status).toBe(201);
      expect(customerRepo.create.mock.calls[0][0].data).toMatchObject({
        custType: CUST_TYPE.thuongMai,
        taxCode: '0312345678',
        bankAccount: '0071000123456',
        cccd: null,
      });
    });
  });

  describe('AC-5/AC-6 — sourceId bắt buộc; sourceNote khi nguồn isOther', () => {
    it('thiếu sourceId ⇒ 400 (KHÔNG có mặc định, KHÔNG tự chọn "Khác" hộ)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          phone: bodyHopLe.phone,
          custType: bodyHopLe.custType,
          name: bodyHopLe.name,
        });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('sourceId');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    it('sourceId ma ⇒ 400 (không phải 500 do FK violation)', async () => {
      givenPermissions(PERM.customersManage);
      customerSourceRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          ...bodyHopLe,
          sourceId: '99999999-8888-4777-8666-555555555555',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('sourceId');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    it('nguồn isOther + thiếu sourceNote ⇒ 400', async () => {
      givenPermissions(PERM.customersManage);
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...bodyHopLe, sourceId: NGUON_KHAC.id });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('sourceNote');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    it('nguồn isOther + có sourceNote ⇒ 201', async () => {
      givenPermissions(PERM.customersManage);
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          ...bodyHopLe,
          sourceId: NGUON_KHAC.id,
          sourceNote: 'Khách cũ giới thiệu',
        });

      expect(res.status).toBe(201);
      expect(customerRepo.create.mock.calls[0][0].data.sourceNote).toBe(
        'Khách cũ giới thiệu',
      );
    });

    it('PATCH xoá sourceNote (`null`) khi nguồn ĐANG là "Khác" ⇒ 400 (luật không có cửa sau)', async () => {
      // Luật AC-6 kiểm lúc TẠO là chưa đủ: nếu PATCH được phép xoá ghi chú, khách nguồn "Khác"
      // vẫn kết thúc ở trạng thái mà AC-6 cấm — chỉ là đi vòng qua cửa sau.
      givenPermissions(PERM.customersManage);
      customerRepo.findUnique.mockResolvedValue({
        ...KHACH,
        sourceId: NGUON_KHAC.id,
        sourceNote: 'Khách cũ giới thiệu',
      });
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ sourceNote: null });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('sourceNote');
      expect(customerRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('AC-7 — phone BẤT BIẾN: PATCH kèm phone ⇒ 400 (không im lặng bỏ qua)', () => {
    it('PATCH body chứa phone ⇒ 400, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ phone: '+84987654321', name: 'Tên mới' });

      // `whitelist: true` sẽ ÂM THẦM CẮT field không khai báo ⇒ client tin là đã đổi được SĐT.
      // DTO khai `phone` rồi từ chối tường minh, nên nó phải là 400 chứ không phải 200.
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('phone');
      expect(customerRepo.update).not.toHaveBeenCalled();
    });

    it('PATCH phone: null ⇒ vẫn 400 (có mặt KEY là sai, bất kể giá trị)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ phone: null });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('phone');
    });

    it('PATCH hợp lệ ⇒ 200 và payload ghi DB KHÔNG chứa sdt', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.update.mockResolvedValue({ ...KHACH, name: 'Tên mới' });

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Tên mới' });

      expect(res.status).toBe(200);
      expect(res.body.phone).toBe(SDT_E164);
      expect(res.body.sdt).toBeUndefined();
      expect(customerRepo.update.mock.calls[0][0].data).not.toHaveProperty(
        'sdt',
      );
    });

    it('PATCH body RỖNG ⇒ 200 no-op (không 500) — mọi field undefined là hợp lệ', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.phone).toBe(SDT_E164);
    });
  });

  describe('AC-8 — event tới AuditSubscriber THẬT', () => {
    it('POST ⇒ AuditLog ghi CustomerCreated với snapshot đầy đủ', async () => {
      givenPermissions(PERM.customersManage);

      await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send(bodyHopLe);

      expect(auditRepo.create).toHaveBeenCalledTimes(1);
      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('CustomerCreated');
      expect(logged.actorAccountId).toBe(ACCOUNT_ID);
      expect(logged.targetId).toBe(SDT_E164);
      expect(logged.after.sdt).toBe(SDT_E164);
    });

    it('PATCH ⇒ AuditLog ghi CustomerUpdated với cả before lẫn after', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.update.mockResolvedValue({ ...KHACH, name: 'Tên mới' });

      await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Tên mới' });

      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('CustomerUpdated');
      expect(logged.before.name).toBe(KHACH.name);
      expect(logged.after.name).toBe('Tên mới');
    });
  });

  describe('null tường minh — cột NOT NULL ⇒ 400; cột nullable ⇒ chấp nhận', () => {
    // Mock Prisma NUỐT `null` không kêu ca (bài học 3.1) ⇒ chỉ test canh ĐÚNG HAI THỨ mới bắt
    // được: status phải 400, và DB phải KHÔNG bị chạm.
    for (const field of ['custType', 'name', 'sourceId'] as const) {
      it(`POST ${field}: null ⇒ 400, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .post('/customers')
          .set('Authorization', `Bearer ${token()}`)
          .send({ ...bodyHopLe, [field]: null });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(customerRepo.create).not.toHaveBeenCalled();
      });

      it(`PATCH ${field}: null ⇒ 400, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .patch(`/customers/${SDT_E164}`)
          .set('Authorization', `Bearer ${token()}`)
          .send({ [field]: null });

        expect(res.status).toBe(400);
        expect(customerRepo.update).not.toHaveBeenCalled();
      });
    }

    it('PATCH nationalId: null ⇒ 200 (cột nullable — `null` là đường XOÁ hợp lệ)', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.findUnique.mockResolvedValue({
        ...KHACH,
        cccd: '079201001234',
      });
      customerRepo.update.mockResolvedValue({ ...KHACH, cccd: null });

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ nationalId: null });

      expect(res.status).toBe(200);
      expect(res.body.nationalId).toBeNull();
      expect(customerRepo.update.mock.calls[0][0].data.cccd).toBeNull();
    });
  });

  describe('field ngoài DTO không lọt xuống DB', () => {
    it('POST kèm field lạ ⇒ bị loại khỏi payload ghi DB', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...bodyHopLe, createdAt: '1999-01-01', hacker: 'x' });

      expect(res.status).toBe(201);
      const data = customerRepo.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('createdAt');
      expect(data).not.toHaveProperty('hacker');
    });

    it('POST name là object lồng ⇒ 400 (không lọt xuống DB)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...bodyHopLe, name: { $ne: null } });

      expect(res.status).toBe(400);
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    it('POST name dài quá trần ⇒ 400 (chuỗi 10MB không xuống nổi DB)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...bodyHopLe, name: 'x'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    // MỌI field chuỗi phải có trần, không chỉ `name` (bài học HIGH review 3.2: thiếu trần trên).
    // Trần chỉ canh được nếu có test cho từng field — gỡ một `@MaxLength` mà không test nào đỏ
    // thì cái trần đó chỉ là bình luận. Field lạc loại khách nên body phải khớp loại: pipe chạy
    // TRƯỚC service, nên đây vẫn là lỗi trần, không phải lỗi loại khách.
    const tranChuoi: readonly [string, number, string][] = [
      ['nationalId', 20, CUST_TYPE.caNhan],
      ['address', 500, CUST_TYPE.caNhan],
      ['sourceNote', 500, CUST_TYPE.caNhan],
      ['taxCode', 20, CUST_TYPE.thuongMai],
      ['bankAccount', 100, CUST_TYPE.thuongMai],
    ];

    for (const [field, tran, custType] of tranChuoi) {
      it(`POST ${field} vượt trần ${tran} ký tự ⇒ 400, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .post('/customers')
          .set('Authorization', `Bearer ${token()}`)
          .send({
            ...bodyHopLe,
            custType,
            [field]: 'x'.repeat(tran + 1),
          });

        expect(res.status).toBe(400);
        expect(res.body.fieldErrors[0].field).toBe(field);
        expect(customerRepo.create).not.toHaveBeenCalled();
      });
    }
  });

  describe('field bắt buộc VẮNG MẶT ⇒ 400 (không chỉ `null`)', () => {
    // `null` đã được canh ở khối trên. Đây là ca KHÁC: field không xuất hiện trong body. Cả bốn
    // field định danh đều phải đòi — trước đây chỉ `sourceId` có test, ba field kia đi lọt.
    for (const field of ['phone', 'custType', 'name', 'sourceId'] as const) {
      it(`POST thiếu hẳn ${field} ⇒ 400, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.customersManage);
        const body: Record<string, unknown> = { ...bodyHopLe };
        delete body[field];

        const res = await request(server())
          .post('/customers')
          .set('Authorization', `Bearer ${token()}`)
          .send(body);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].field).toBe(field);
        expect(customerRepo.create).not.toHaveBeenCalled();
      });
    }
  });

  describe('AC-10 — GET /customer-sources (chỉ ĐỌC)', () => {
    it('trả danh mục nguồn, mặc định chỉ nguồn còn hiệu lực, sắp theo sortOrder', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customer-sources')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(customerSourceRepo.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      });
      // FE cần `isOther` để biết khi nào hiện ô "ghi rõ nguồn" — nhưng luật thật ở SERVER.
      expect(res.body.map((s: { isOther: boolean }) => s.isOther)).toEqual([
        false,
        true,
      ]);
    });

    it('?includeInactive=true ⇒ lấy cả nguồn đã ngừng dùng', async () => {
      givenPermissions(PERM.customersManage);

      await request(server())
        .get('/customer-sources?includeInactive=true')
        .set('Authorization', `Bearer ${token()}`);

      expect(customerSourceRepo.findMany.mock.calls[0][0].where).toEqual({});
    });
  });
});
