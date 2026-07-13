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
 *  - `sdt` trong body PATCH ⇒ 400 — KHÔNG bị `whitelist: true` âm thầm cắt đi rồi trả 200.
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
  };
  const customerSourceRepo = { findUnique: jest.fn(), findMany: jest.fn() };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule`; thiếu nó thì subscriber
  // ném (bus cô lập lỗi nên test vẫn xanh, chỉ ồn log) và ta mất luôn bằng chứng event tới đích.
  const auditRepo = { create: jest.fn().mockResolvedValue({}) };
  const featureFlagRepo = { findUnique: jest.fn().mockResolvedValue(null) };
  const prismaMock = {
    customer: customerRepo,
    customerSource: customerSourceRepo,
    auditLog: auditRepo,
    featureFlag: featureFlagRepo,
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  const bodyHopLe = {
    sdt: '0912 345 678',
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
    await app.init();
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
    customerSourceRepo.findUnique.mockResolvedValue(NGUON_FACEBOOK);
    customerSourceRepo.findMany.mockResolvedValue([NGUON_FACEBOOK, NGUON_KHAC]);
    auditRepo.create.mockResolvedValue({});
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
        name: 'GET /customers/:sdt',
        call: () => request(server()).get(`/customers/${SDT_E164}`),
      },
      {
        name: 'PATCH /customers/:sdt',
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
      expect(res.body.sdt).toBe(SDT_E164);
      expect(customerRepo.create.mock.calls[0][0].data.sdt).toBe(SDT_E164);
    });

    for (const rac of [
      'abc',
      '123',
      '+16505550123',
      '0912345',
      '',
      '09123456789012345678',
    ]) {
      it(`POST sdt "${rac}" ⇒ 400 VALIDATION_ERROR, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .post('/customers')
          .set('Authorization', `Bearer ${token()}`)
          .send({ ...bodyHopLe, sdt: rac });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors[0].field).toBe('sdt');
        expect(customerRepo.create).not.toHaveBeenCalled();
      });
    }

    // Khoá chính không được nhận thứ không phải chuỗi: một mảng/số lọt tới `normalizeVnPhone`
    // là 500 chờ sẵn, và `@IsString()` là thứ duy nhất đứng chắn. Không test = không ai biết
    // khi nó bị gỡ.
    for (const [nhan, sdt] of [
      ['số', 912345678],
      ['mảng', ['0912345678']],
      ['object lồng', { $ne: null }],
    ] as const) {
      it(`POST sdt là ${nhan} ⇒ 400, KHÔNG ghi DB`, async () => {
        givenPermissions(PERM.customersManage);

        const res = await request(server())
          .post('/customers')
          .set('Authorization', `Bearer ${token()}`)
          .send({ ...bodyHopLe, sdt });

        expect(res.status).toBe(400);
        expect(res.body.fieldErrors[0].field).toBe('sdt');
        expect(customerRepo.create).not.toHaveBeenCalled();
      });
    }

    it('GET /customers/:sdt với SĐT rác ⇒ 400 (KHÔNG phải 404 — chưa từng là khoá hợp lệ)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/abc')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });

    it('GET /customers/:sdt bằng dạng THÔ ⇒ tra bằng E.164 (cùng bộ chuẩn hoá)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customers/0912345678')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(customerRepo.findUnique).toHaveBeenCalledWith({
        where: { sdt: SDT_E164 },
      });
    });

    it('GET /customers/:sdt không tồn tại ⇒ 404', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .get('/customers/0912345678')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('GET /customers — danh sách khách hàng', () => {
    it('trả danh sách, mới nhất TRƯỚC (sale mở màn khách là thấy khách vừa nhập)', async () => {
      givenPermissions(PERM.customersManage);
      const khachCu = { ...KHACH, sdt: '+84987654321', name: 'Trần Thị B' };
      customerRepo.findMany.mockResolvedValue([KHACH, khachCu]);

      const res = await request(server())
        .get('/customers')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].sdt).toBe(SDT_E164);
      expect(customerRepo.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('chưa có khách nào ⇒ 200 mảng rỗng (không phải 404)', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.findMany.mockResolvedValue([]);

      const res = await request(server())
        .get('/customers')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('AC-3 — chặn trùng SĐT: dạng thô KHÁC NHAU, cùng một E.164 ⇒ 409', () => {
    for (const raw of ['0912345678', '0912.345.678', '84912345678', SDT_E164]) {
      it(`POST "${raw}" khi SĐT đã tồn tại ⇒ 409 CONFLICT (fieldErrors trỏ ô sdt)`, async () => {
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
          .send({ ...bodyHopLe, sdt: raw });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe(ErrorCode.CONFLICT);
        expect(res.body.fieldErrors[0].field).toBe('sdt');
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

    it('THUONG_MAI kèm cccd ⇒ 400', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .post('/customers')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          ...bodyHopLe,
          custType: CUST_TYPE.thuongMai,
          cccd: '079201001234',
        });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('cccd');
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
          sdt: bodyHopLe.sdt,
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

  describe('AC-7 — sdt BẤT BIẾN: PATCH kèm sdt ⇒ 400 (không im lặng bỏ qua)', () => {
    it('PATCH body chứa sdt ⇒ 400, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ sdt: '+84987654321', name: 'Tên mới' });

      // `whitelist: true` sẽ ÂM THẦM CẮT field không khai báo ⇒ client tin là đã đổi được SĐT.
      // DTO khai `sdt` rồi từ chối tường minh, nên nó phải là 400 chứ không phải 200.
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('sdt');
      expect(customerRepo.update).not.toHaveBeenCalled();
    });

    it('PATCH sdt: null ⇒ vẫn 400 (có mặt KEY là sai, bất kể giá trị)', async () => {
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ sdt: null });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('sdt');
    });

    it('PATCH hợp lệ ⇒ 200 và payload ghi DB KHÔNG chứa sdt', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.update.mockResolvedValue({ ...KHACH, name: 'Tên mới' });

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Tên mới' });

      expect(res.status).toBe(200);
      expect(res.body.sdt).toBe(SDT_E164);
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
      expect(res.body.sdt).toBe(SDT_E164);
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

    it('PATCH cccd: null ⇒ 200 (cột nullable — `null` là đường XOÁ hợp lệ)', async () => {
      givenPermissions(PERM.customersManage);
      customerRepo.findUnique.mockResolvedValue({
        ...KHACH,
        cccd: '079201001234',
      });
      customerRepo.update.mockResolvedValue({ ...KHACH, cccd: null });

      const res = await request(server())
        .patch(`/customers/${SDT_E164}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ cccd: null });

      expect(res.status).toBe(200);
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
      ['cccd', 20, CUST_TYPE.caNhan],
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
    for (const field of ['sdt', 'custType', 'name', 'sourceId'] as const) {
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
