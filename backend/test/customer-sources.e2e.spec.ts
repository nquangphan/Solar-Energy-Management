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
import { initAppOnLoopback } from './util/listen-loopback';

/**
 * GOTCHA (2.3/2.5): `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc **import module** ⇒ phải
 * set env TRƯỚC khi `AppModule` được nạp. Vì vậy KHÔNG static-import `AppModule`.
 */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/customer-sources` (hermetic — override `PrismaService`, ký JWT thật).
 *
 * Phủ những bất biến sống ở tầng HTTP/guard/pipe mà unit test KHÔNG chạm tới:
 *  - HAI GATE KHÁC NHAU trên cùng controller: 4 route ghi đòi `settings.manage`; `GET` vẫn chỉ
 *    đòi `customers.manage`. Cái thứ hai là thứ giữ cho luồng TẠO KHÁCH của Story 3.4 sống.
 *  - `ValidationPipe` thật: `isOther`/`active` gửi kèm body bị cắt, `null` trên cột NOT NULL ⇒ 400.
 *  - Event đi qua `EventBus` tới `AuditSubscriber` THẬT và ghi `AuditLog`.
 *  - `POST /:id/reactivate` không bị route nào nuốt.
 */
describe('/customer-sources (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'admin@example.com',
    displayName: 'Quản trị',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const FACEBOOK = {
    id: '5f4d3c2b-1a09-4e8d-9c7b-6a5f4e3d2c1b',
    name: 'Facebook',
    description: 'Từ quảng cáo Facebook.',
    active: true,
    sortOrder: 1,
    isOther: false,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };
  const KHAC = {
    ...FACEBOOK,
    id: '11111111-2222-4333-8444-555555555555',
    name: 'Khác',
    sortOrder: 99,
    isOther: true,
  };

  const sourceRepo = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule`.
  const auditRepo = { create: jest.fn() };
  const featureFlagRepo = { findUnique: jest.fn().mockResolvedValue(null) };
  const prismaMock = {
    customer: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    customerSource: sourceRepo,
    auditLog: auditRepo,
    featureFlag: featureFlagRepo,
    $transaction: jest.fn(),
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
    await initAppOnLoopback(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sourceRepo.findUnique.mockResolvedValue(FACEBOOK);
    sourceRepo.findFirst.mockResolvedValue(KHAC);
    sourceRepo.findMany.mockResolvedValue([FACEBOOK, KHAC]);
    sourceRepo.create.mockResolvedValue({ ...FACEBOOK, id: 'nguon-moi' });
    sourceRepo.update.mockResolvedValue(FACEBOOK);
    auditRepo.create.mockResolvedValue({});
  });

  describe('AC-5 — bốn route GHI gate settings.manage', () => {
    const routeGhi: readonly { name: string; call: () => request.Test }[] = [
      {
        name: 'POST /customer-sources',
        call: () => request(server()).post('/customer-sources'),
      },
      {
        name: 'PATCH /customer-sources/:id',
        call: () => request(server()).patch(`/customer-sources/${FACEBOOK.id}`),
      },
      {
        name: 'DELETE /customer-sources/:id',
        call: () =>
          request(server()).delete(`/customer-sources/${FACEBOOK.id}`),
      },
      {
        name: 'POST /customer-sources/:id/reactivate',
        call: () =>
          request(server()).post(`/customer-sources/${FACEBOOK.id}/reactivate`),
      },
    ];

    for (const route of routeGhi) {
      it(`${route.name} — thiếu settings.manage ⇒ 403 (dù CÓ customers.manage)`, async () => {
        // `customers.manage` là quyền của sale — nó KHÔNG được mở cửa cấu hình hệ thống. Cấp đúng
        // quyền đó ở đây để chứng minh guard đọc đúng key, không phải "có quyền nào cũng qua".
        givenPermissions(PERM.customersManage);

        const res = await route
          .call()
          .set('Authorization', `Bearer ${token()}`)
          .send({ name: 'TikTok' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
        expect(sourceRepo.create).not.toHaveBeenCalled();
        expect(sourceRepo.update).not.toHaveBeenCalled();
      });
    }

    it('không có token ⇒ 401 (authn fail-closed)', async () => {
      const res = await request(server()).post('/customer-sources').send({});

      expect(res.status).toBe(401);
    });
  });

  describe('🔴 AC-5 — GET giữ gate customers.manage: SALE VẪN ĐỌC ĐƯỢC DROPDOWN NGUỒN', () => {
    it('chỉ có customers.manage (KHÔNG settings.manage) ⇒ GET 200', async () => {
      // Đây là test canh cả luồng TẠO KHÁCH của Story 3.4. Preset THO_KS/QUAN_LY/KE_TOAN có
      // `customers.manage` nhưng KHÔNG có `settings.manage`; đổi gate của GET sang
      // `settings.manage` ⇒ họ không chọn nổi nguồn ⇒ không tạo nổi một khách nào. Đừng bỏ ca này.
      givenPermissions(PERM.customersManage);

      const res = await request(server())
        .get('/customer-sources')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('chỉ có settings.manage (KHÔNG customers.manage) ⇒ GET 403 — gate ĐỌC không bị nới ra', async () => {
      // Mặt còn lại của cùng một luật: `settings.manage` không phải "quyền trùm" mở luôn cửa đọc.
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .get('/customer-sources')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
    });

    it('màn cấu hình đọc cả nguồn đã tắt: ?includeInactive=true ⇒ where rỗng', async () => {
      givenPermissions(PERM.customersManage);

      await request(server())
        .get('/customer-sources?includeInactive=true')
        .set('Authorization', `Bearer ${token()}`);

      expect(sourceRepo.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('AC-1 — POST (có settings.manage)', () => {
    it('body hợp lệ ⇒ 201, ghi DB với isOther:false', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .post('/customer-sources')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'TikTok', description: 'Từ video TikTok.' });

      expect(res.status).toBe(201);
      expect(sourceRepo.create.mock.calls[0][0].data).toMatchObject({
        name: 'TikTok',
        description: 'Từ video TikTok.',
        isOther: false,
      });
    });

    it('name rỗng ⇒ 400 VALIDATION_ERROR, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .post('/customer-sources')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(sourceRepo.create).not.toHaveBeenCalled();
    });

    it('thiếu hẳn name ⇒ 400, KHÔNG ghi DB', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .post('/customer-sources')
        .set('Authorization', `Bearer ${token()}`)
        .send({ description: 'không tên' });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(sourceRepo.create).not.toHaveBeenCalled();
    });

    it('name vượt trần 100 ký tự ⇒ 400 (chuỗi 10MB không xuống nổi DB)', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .post('/customer-sources')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'x'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(sourceRepo.create).not.toHaveBeenCalled();
    });

    it('description vượt trần 500 ký tự ⇒ 400', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .post('/customer-sources')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'TikTok', description: 'x'.repeat(501) });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('description');
    });

    it('sortOrder âm ⇒ 400; null ⇒ 400 (cột NOT NULL); vượt trần int4 ⇒ 400 (không phải 500 P2020)', async () => {
      givenPermissions(PERM.settingsManage);

      for (const sortOrder of [-1, null, 9999999999]) {
        const res = await request(server())
          .post('/customer-sources')
          .set('Authorization', `Bearer ${token()}`)
          .send({ name: 'TikTok', sortOrder });

        expect(res.status).toBe(400);
        expect(res.body.fieldErrors[0].field).toBe('sortOrder');
      }
      expect(sourceRepo.create).not.toHaveBeenCalled();
    });

    it('🔴 isOther gửi kèm body ⇒ bị whitelist CẮT, cột ghi DB vẫn là false', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .post('/customer-sources')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Nguồn giả mạo', isOther: true, active: false });

      expect(res.status).toBe(201);
      expect(sourceRepo.create.mock.calls[0][0].data.isOther).toBe(false);
      expect(sourceRepo.create.mock.calls[0][0].data).not.toHaveProperty(
        'active',
      );
    });

    it('name trùng (P2002) ⇒ 409 CONFLICT + fieldErrors', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const res = await request(server())
        .post('/customer-sources')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Facebook' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(auditRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('AC-2 — PATCH', () => {
    it('sửa tên ⇒ 200, chỉ field có mặt xuống DB', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.update.mockResolvedValue({
        ...FACEBOOK,
        name: 'Facebook Ads',
      });

      const res = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Facebook Ads' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Facebook Ads');
    });

    it('🔴 ĐỔI TÊN dòng "Khác" ⇒ 200 (cờ isOther không rơi)', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.findUnique.mockResolvedValue(KHAC);
      sourceRepo.update.mockResolvedValue({ ...KHAC, name: 'Nguồn khác' });

      const res = await request(server())
        .patch(`/customer-sources/${KHAC.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Nguồn khác' });

      expect(res.status).toBe(200);
      expect(res.body.isOther).toBe(true);
      expect(sourceRepo.update.mock.calls[0][0].data).not.toHaveProperty(
        'isOther',
      );
    });

    it('name: null ⇒ 400 (cột NOT NULL), KHÔNG ghi DB', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: null });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(sourceRepo.update).not.toHaveBeenCalled();
    });

    it('description: null ⇒ 200 (cột nullable — đường XOÁ mô tả hợp lệ)', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.update.mockResolvedValue({ ...FACEBOOK, description: null });

      const res = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(sourceRepo.update.mock.calls[0][0].data.description).toBeNull();
    });

    it('active/isOther trong body PATCH ⇒ bị cắt, KHÔNG xuống DB', async () => {
      givenPermissions(PERM.settingsManage);

      await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'X', active: false, isOther: true });

      const data = sourceRepo.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('active');
      expect(data).not.toHaveProperty('isOther');
    });

    it('id không tồn tại ⇒ 404', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .patch('/customer-sources/id-ma')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'X' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('đổi sang tên đã có ở dòng khác (P2002) ⇒ 409 + fieldErrors, KHÔNG audit', async () => {
      // Cùng luật với POST, nhưng đi qua đường PATCH: `translateWriteError` chạy trong `update()`
      // là một nhánh code KHÁC. Chỉ có test unit canh nó ⇒ nếu ai đó bỏ `try/catch` của `update()`,
      // tầng HTTP sẽ trả 500 mà không suite nào ở đây kêu.
      givenPermissions(PERM.settingsManage);
      sourceRepo.update.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const res = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Khác' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.fieldErrors[0].field).toBe('name');
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('name rỗng ⇒ 400 (@IsNotEmpty vẫn chạy khi field CÓ MẶT), KHÔNG ghi DB', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(sourceRepo.update).not.toHaveBeenCalled();
    });

    it('trần trên cũng phải chặn ở PATCH: name > 100 và description > 500 ⇒ 400', async () => {
      // POST đã có test trần trên; PATCH là cửa THỨ HAI vào cùng hai cột đó. Trần chỉ gác một cửa
      // thì không phải trần (bài học HIGH review 3.2 — thiếu trần trên ⇒ tràn).
      givenPermissions(PERM.settingsManage);

      const qua_ten = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'x'.repeat(101) });

      const qua_mo_ta = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ description: 'x'.repeat(501) });

      expect(qua_ten.status).toBe(400);
      expect(qua_mo_ta.status).toBe(400);
      expect(sourceRepo.update).not.toHaveBeenCalled();
    });

    it('🔴 sortOrder vượt trần int4 ⇒ 400, KHÔNG xuống Postgres (P2020 sẽ là 500)', async () => {
      // PATCH là cửa THỨ HAI vào cột `sortOrder`. Trần chỉ gác cửa POST thì `sortOrder: 9999999999`
      // vẫn đi lọt tới Postgres qua đường này và nổ P2020 — mã lỗi không ai dịch ⇒ 500.
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ sortOrder: 9999999999 });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('sortOrder');
      expect(sourceRepo.update).not.toHaveBeenCalled();
    });

    it('🔴 body RỖNG ⇒ 200 nhưng KHÔNG ghi DB và KHÔNG có dòng AuditLog', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(FACEBOOK.name);
      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('AC-3 — DELETE = TẮT', () => {
    it('dòng đang bật ⇒ 204 và ghi active:false (KHÔNG xoá cứng)', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.update.mockResolvedValue({ ...FACEBOOK, active: false });

      const res = await request(server())
        .delete(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(204);
      expect(sourceRepo.update.mock.calls[0][0].data).toEqual({
        active: false,
      });
    });

    it('🔴 dòng "Khác" ⇒ 409 CONFLICT, KHÔNG chạm DB', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.findUnique.mockResolvedValue(KHAC);

      const res = await request(server())
        .delete(`/customer-sources/${KHAC.id}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(sourceRepo.update).not.toHaveBeenCalled();
    });

    it('id không tồn tại ⇒ 404', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .delete('/customer-sources/id-ma')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
    });

    it('dòng ĐÃ TẮT ⇒ vẫn 204, KHÔNG ghi DB, KHÔNG audit (một dòng audit cho việc không xảy ra là một dòng audit nói dối)', async () => {
      // Đối xứng với ca "reactivate dòng đang bật" của AC-4 — ca đó có test e2e, ca này thì chưa:
      // nó chỉ sống ở tầng unit với Prisma mock, tức là chưa ai chứng minh AuditSubscriber THẬT
      // im lặng khi trạng thái không đổi.
      givenPermissions(PERM.settingsManage);
      sourceRepo.findUnique.mockResolvedValue({ ...FACEBOOK, active: false });

      const res = await request(server())
        .delete(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(204);
      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('AC-4 — POST /:id/reactivate', () => {
    it('🔴 KHÔNG bị route khác nuốt — "reactivate" là sub-resource, không phải một id', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.findUnique.mockResolvedValue({ ...FACEBOOK, active: false });
      sourceRepo.update.mockResolvedValue(FACEBOOK);

      const res = await request(server())
        .post(`/customer-sources/${FACEBOOK.id}/reactivate`)
        .set('Authorization', `Bearer ${token()}`);

      // 200, không 201: không có tài nguyên nào được TẠO — nguồn đã tồn tại, chỉ bật lại.
      expect(res.status).toBe(200);
      expect(sourceRepo.update.mock.calls[0][0].data).toEqual({ active: true });
    });

    it('dòng ĐANG BẬT ⇒ vẫn 200, KHÔNG ghi DB, KHÔNG audit', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .post(`/customer-sources/${FACEBOOK.id}/reactivate`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('id không tồn tại ⇒ 404', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.findUnique.mockResolvedValue(null);

      const res = await request(server())
        .post('/customer-sources/id-ma/reactivate')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
    });
  });

  describe('AC-6 — MỌI mutation tới AuditSubscriber THẬT', () => {
    it('POST ⇒ AuditLog ghi CustomerSourceCreated', async () => {
      givenPermissions(PERM.settingsManage);

      await request(server())
        .post('/customer-sources')
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'TikTok' });

      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('CustomerSourceCreated');
      expect(logged.actorAccountId).toBe(ACCOUNT_ID);
      expect(logged.targetId).toBe('nguon-moi');
    });

    it('🔴 PATCH đổi tên ⇒ AuditLog mang CẢ tên cũ lẫn tên mới (AC gốc nhấn mạnh đúng ca này)', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.update.mockResolvedValue({
        ...FACEBOOK,
        name: 'Facebook Ads',
      });

      await request(server())
        .patch(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ name: 'Facebook Ads' });

      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('CustomerSourceUpdated');
      expect(logged.before.name).toBe('Facebook');
      expect(logged.after.name).toBe('Facebook Ads');
    });

    it('DELETE ⇒ AuditLog ghi CustomerSourceDeactivated (active true → false)', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.update.mockResolvedValue({ ...FACEBOOK, active: false });

      await request(server())
        .delete(`/customer-sources/${FACEBOOK.id}`)
        .set('Authorization', `Bearer ${token()}`);

      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('CustomerSourceDeactivated');
      expect(logged.before.active).toBe(true);
      expect(logged.after.active).toBe(false);
    });

    it('reactivate ⇒ AuditLog ghi CustomerSourceReactivated', async () => {
      givenPermissions(PERM.settingsManage);
      sourceRepo.findUnique.mockResolvedValue({ ...FACEBOOK, active: false });
      sourceRepo.update.mockResolvedValue(FACEBOOK);

      await request(server())
        .post(`/customer-sources/${FACEBOOK.id}/reactivate`)
        .set('Authorization', `Bearer ${token()}`);

      const logged = auditRepo.create.mock.calls[0][0].data;
      expect(logged.eventType).toBe('CustomerSourceReactivated');
      expect(logged.after.active).toBe(true);
    });
  });
});
