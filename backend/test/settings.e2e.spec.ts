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
 * e2e `/settings/vat-rate` (hermetic — override `PrismaService`, ký JWT thật). Phủ các bất
 * biến sống ở tầng HTTP/guard/pipe mà unit test KHÔNG chạm tới:
 *
 *  - CẢ GET lẫn PATCH gate `settings.manage` — khác feature-flags (GET mở cho authenticated):
 *    sale nhận rate qua preview-total response, không qua đây.
 *  - `ValidationPipe` thật: ratePercent 8.5 / -1 / 101 / null ⇒ 400 kèm fieldErrors.
 *  - Event đi qua `EventBus` tới `AuditSubscriber` THẬT và ghi `AuditLog` before→after.
 */
describe('/settings/vat-rate (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-settings-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'admin@example.com',
    displayName: 'Quản trị hệ thống',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const systemSettingRepo = { findUnique: jest.fn(), upsert: jest.fn() };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule`.
  const auditRepo = { create: jest.fn().mockResolvedValue({}) };
  const prismaMock = {
    systemSetting: systemSettingRepo,
    auditLog: auditRepo,
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
    systemSettingRepo.findUnique.mockResolvedValue(null);
    systemSettingRepo.upsert.mockImplementation(
      ({ create }: { create: { key: string; value: string } }) =>
        Promise.resolve({ ...create, updatedAt: new Date() }),
    );
    auditRepo.create.mockResolvedValue({});
  });

  describe('authn/authz fail-closed trên CẢ HAI route', () => {
    const routes: readonly { name: string; call: () => request.Test }[] = [
      {
        name: 'GET /settings/vat-rate',
        call: () => request(server()).get('/settings/vat-rate'),
      },
      {
        name: 'PATCH /settings/vat-rate',
        call: () => request(server()).patch('/settings/vat-rate'),
      },
    ];

    for (const route of routes) {
      it(`${route.name} không token ⇒ 401`, async () => {
        const res = await route.call().send({});

        expect(res.status).toBe(401);
      });

      it(`${route.name} thiếu settings.manage ⇒ 403 (quotes.create_edit KHÔNG thay thế được)`, async () => {
        givenPermissions(PERM.quotesCreateEdit, PERM.systemFeatureFlags);

        const res = await route
          .call()
          .set('Authorization', `Bearer ${token()}`)
          .send({ ratePercent: 10 });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
        expect(systemSettingRepo.upsert).not.toHaveBeenCalled();
      });
    }
  });

  describe('GET /settings/vat-rate', () => {
    it('chưa cấu hình (bảng rỗng) ⇒ 200 {ratePercent: 8} — default từ registry, không cần seed', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .get('/settings/vat-rate')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ratePercent: 8 });
    });

    it('đã cấu hình row "10" ⇒ 200 {ratePercent: 10}', async () => {
      givenPermissions(PERM.settingsManage);
      systemSettingRepo.findUnique.mockResolvedValue({
        key: 'vat.rate_percent',
        value: '10',
        updatedAt: new Date(),
      });

      const res = await request(server())
        .get('/settings/vat-rate')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ratePercent: 10 });
    });
  });

  describe('PATCH /settings/vat-rate', () => {
    it('happy path ⇒ 200 {ratePercent: 10}, upsert bảng system_settings, audit SystemSettingChanged', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .patch('/settings/vat-rate')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ratePercent: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ratePercent: 10 });
      expect(systemSettingRepo.upsert).toHaveBeenCalledWith({
        where: { key: 'vat.rate_percent' },
        create: { key: 'vat.rate_percent', value: '10' },
        update: { value: '10' },
      });
      // Event tới AuditSubscriber thật — đổi thuế suất phải để lại dấu vết.
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'SystemSettingChanged',
          }),
        }),
      );
    });

    it.each([
      ['8.5 (không phải Int)', 8.5],
      ['-1 (dưới 0)', -1],
      ['101 (trên 100)', 101],
      ['null', null],
      ['chuỗi "10"', '10'],
    ])(
      'ratePercent %s ⇒ 400 fieldErrors trỏ ratePercent, KHÔNG upsert',
      async (_ten, giaTri) => {
        givenPermissions(PERM.settingsManage);

        const res = await request(server())
          .patch('/settings/vat-rate')
          .set('Authorization', `Bearer ${token()}`)
          .send({ ratePercent: giaTri });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(res.body.fieldErrors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'ratePercent' }),
          ]),
        );
        expect(systemSettingRepo.upsert).not.toHaveBeenCalled();
        expect(auditRepo.create).not.toHaveBeenCalled();
      },
    );

    it('body rỗng {} (ratePercent VẮNG hẳn, khác null) ⇒ 400 fieldErrors, KHÔNG upsert', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .patch('/settings/vat-rate')
        .set('Authorization', `Bearer ${token()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'ratePercent' }),
        ]),
      );
      expect(systemSettingRepo.upsert).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('smuggle key/value kèm ratePercent hợp lệ ⇒ bị strip: upsert vẫn ĐÚNG key registry', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .patch('/settings/vat-rate')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ratePercent: 10, key: 'pricing.discount', value: '99' });

      // key/value lạ KHÔNG lái được upsert sang setting khác — payload y hệt happy path.
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ratePercent: 10 });
      expect(systemSettingRepo.upsert).toHaveBeenCalledWith({
        where: { key: 'vat.rate_percent' },
        create: { key: 'vat.rate_percent', value: '10' },
        update: { value: '10' },
      });
    });

    it('biên hợp lệ: 0 và 100 đều 200 (0% là thuế suất hợp lệ)', async () => {
      givenPermissions(PERM.settingsManage);

      const khong = await request(server())
        .patch('/settings/vat-rate')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ratePercent: 0 });
      expect(khong.status).toBe(200);
      expect(khong.body).toEqual({ ratePercent: 0 });

      const tram = await request(server())
        .patch('/settings/vat-rate')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ratePercent: 100 });
      expect(tram.status).toBe(200);
      expect(tram.body).toEqual({ ratePercent: 100 });
    });
  });
});
