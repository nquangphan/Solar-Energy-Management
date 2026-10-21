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

  const systemSettingRepo = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule`.
  const auditRepo = { create: jest.fn().mockResolvedValue({}) };
  const prismaMock = {
    systemSetting: systemSettingRepo,
    auditLog: auditRepo,
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
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
    systemSettingRepo.findUnique.mockResolvedValue(null);
    systemSettingRepo.findMany.mockResolvedValue([]);
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
      {
        name: 'GET /settings/company-legal-entity',
        call: () => request(server()).get('/settings/company-legal-entity'),
      },
      {
        name: 'PUT /settings/company-legal-entity',
        call: () => request(server()).put('/settings/company-legal-entity'),
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

  describe('/settings/company-legal-entity', () => {
    const FULL = {
      legalName: 'CÔNG TY TNHH A',
      taxCode: '0123456789',
      address: 'Số 1 Đường B',
      representative: 'Nguyễn Văn C',
      representativeTitle: 'Giám đốc',
      phone: '0909000000',
      bankAccount: '123 tại VIB',
    };

    it('GET nothing configured ⇒ 200, 7 empty fields', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .get('/settings/company-legal-entity')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        legalName: '',
        taxCode: '',
        address: '',
        representative: '',
        representativeTitle: '',
        phone: '',
        bankAccount: '',
      });
    });

    it('PUT all 7 fields ⇒ 200 trimmed entity, 7 upserts, 7 audit rows', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .put('/settings/company-legal-entity')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...FULL, legalName: '  CÔNG TY TNHH A  ' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(FULL);
      expect(systemSettingRepo.upsert).toHaveBeenCalledTimes(7);
      expect(auditRepo.create).toHaveBeenCalledTimes(7);
    });

    it.each([
      ['missing field', (b: Record<string, unknown>) => delete b.taxCode],
      ['null field', (b: Record<string, unknown>) => (b.taxCode = null)],
      ['number field', (b: Record<string, unknown>) => (b.taxCode = 123)],
      [
        'field over 200 chars',
        (b: Record<string, unknown>) => (b.taxCode = 'x'.repeat(201)),
      ],
    ])(
      '%s ⇒ 400 fieldErrors on taxCode (Vietnamese), no write',
      async (_name, mutate) => {
        givenPermissions(PERM.settingsManage);
        const body: Record<string, unknown> = { ...FULL };
        mutate(body);

        const res = await request(server())
          .put('/settings/company-legal-entity')
          .set('Authorization', `Bearer ${token()}`)
          .send(body);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
        const fieldError = (
          res.body.fieldErrors as { field: string; message: string }[]
        ).find((e) => e.field === 'taxCode');
        expect(fieldError?.message).toMatch(
          /Phải là chuỗi ký tự|Tối đa 200 ký tự/,
        );
        expect(systemSettingRepo.upsert).not.toHaveBeenCalled();
      },
    );

    it('configured entity: PUT changing 2 fields ⇒ 2 upserts, 2 audit rows before→after; same body again ⇒ no write, no audit', async () => {
      givenPermissions(PERM.settingsManage);
      systemSettingRepo.findMany.mockResolvedValue([
        { key: 'company.legal_name', value: FULL.legalName },
        { key: 'company.tax_code', value: FULL.taxCode },
        { key: 'company.address', value: FULL.address },
        { key: 'company.representative', value: FULL.representative },
        {
          key: 'company.representative_title',
          value: FULL.representativeTitle,
        },
        { key: 'company.phone', value: FULL.phone },
        { key: 'company.bank_account', value: FULL.bankAccount },
      ]);
      const put = (body: typeof FULL) =>
        request(server())
          .put('/settings/company-legal-entity')
          .set('Authorization', `Bearer ${token()}`)
          .send(body);

      const changed = await put({ ...FULL, phone: '0911111111', address: '' });

      expect(changed.status).toBe(200);
      expect(changed.body).toEqual({
        ...FULL,
        phone: '0911111111',
        address: '',
      });
      expect(systemSettingRepo.upsert).toHaveBeenCalledTimes(2);
      expect(auditRepo.create).toHaveBeenCalledTimes(2);
      const audits = auditRepo.create.mock.calls.map(
        ([a]) =>
          (
            a as {
              data: {
                eventType: string;
                targetId: string;
                before: unknown;
                after: unknown;
              };
            }
          ).data,
      );
      expect(audits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: 'SystemSettingChanged',
            targetId: 'company.phone',
            before: { key: 'company.phone', value: FULL.phone },
            after: { key: 'company.phone', value: '0911111111' },
          }),
          expect.objectContaining({
            eventType: 'SystemSettingChanged',
            targetId: 'company.address',
            before: { key: 'company.address', value: FULL.address },
            after: { key: 'company.address', value: '' },
          }),
        ]),
      );

      jest.clearAllMocks();
      const same = await put({ ...FULL, legalName: `  ${FULL.legalName}  ` });

      expect(same.status).toBe(200);
      expect(same.body).toEqual(FULL);
      expect(systemSettingRepo.upsert).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('200 chars exactly is accepted', async () => {
      givenPermissions(PERM.settingsManage);

      const res = await request(server())
        .put('/settings/company-legal-entity')
        .set('Authorization', `Bearer ${token()}`)
        .send({ ...FULL, address: 'x'.repeat(200) });

      expect(res.status).toBe(200);
    });
  });
});
