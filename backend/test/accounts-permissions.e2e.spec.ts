import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountsService } from '../src/accounts/accounts.service';
import {
  PERM,
  PERMISSION_KEYS,
} from '../src/accounts/domain/permission-registry';
import {
  ROLE_PRESETS,
  type RolePreset,
} from '../src/accounts/domain/role-presets';
import { ErrorCode } from '../src/common/errors/error-code';
import { INVALID_UUID_MESSAGE } from '../src/common/validation/uuid-param';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoragePort } from '../src/storage/storage.port';
import { fakeStorage } from './util/fake-storage';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time ⇒ set env BEFORE loading `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e of the Permissions screen API (hermetic — `PrismaService` overridden, the REAL
 * `AccountPermissionsService`, real JWT, real ValidationPipe + exception filter). Covers what
 * only exists at the HTTP layer: the `permissions.manage` gate on all three routes, the response
 * contract (no `passwordHash`), the escalation-aware options, and every refusal of a save with
 * its status and `fieldErrors`.
 */
describe('/accounts permissions (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
  const WORKER_ID = '22222222-2222-4222-8222-222222222222';
  const SUPER_ID = '33333333-3333-4333-8333-333333333333';
  const MISSING_ID = '44444444-4444-4444-8444-444444444444';

  const accounts: Record<
    string,
    { displayName: string; phone: string | null }
  > = {
    [ADMIN_ID]: { displayName: 'An Admin', phone: '+84900000001' },
    [WORKER_ID]: { displayName: 'Bình Thợ', phone: null },
    [SUPER_ID]: { displayName: 'Chủ Super', phone: '+84900000003' },
  };
  let held: Record<string, string[]>;

  const row = (id: string) => ({
    id,
    email: `${id}@example.com`,
    displayName: accounts[id].displayName,
    phone: accounts[id].phone,
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  // The mock ignores `select` and returns the full row, passwordHash included: the response
  // must still carry only the contract keys.
  const withPermissions = (id: string) => ({
    ...row(id),
    permissions: (held[id] ?? []).map((permission) => ({ permission })),
  });

  const permissionRepo = {
    findMany: jest.fn(({ where }: { where: { accountId: string } }) =>
      Promise.resolve(
        (held[where.accountId] ?? []).map((permission) => ({ permission })),
      ),
    ),
    deleteMany: jest.fn(({ where }: { where: { accountId: string } }) => {
      held[where.accountId] = [];
      return Promise.resolve({ count: 0 });
    }),
    createMany: jest.fn(
      ({ data }: { data: { accountId: string; permission: string }[] }) => {
        for (const d of data) (held[d.accountId] ??= []).push(d.permission);
        return Promise.resolve({ count: data.length });
      },
    ),
  };
  const queryRaw = jest.fn((_s: TemplateStringsArray, ids: string[]) =>
    Promise.resolve(ids.filter((id) => id in accounts).map((id) => ({ id }))),
  );
  const auditCreate = jest.fn().mockResolvedValue({});
  const prismaMock = {
    accountPermission: permissionRepo,
    account: {
      findMany: jest.fn(() =>
        Promise.resolve(Object.keys(accounts).map(withPermissions)),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id in accounts ? withPermissions(where.id) : null,
        ),
      ),
    },
    auditLog: { create: auditCreate },
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
      cb({ $queryRaw: queryRaw, accountPermission: permissionRepo }),
    ),
  };
  const accountsMock = {
    findById: jest.fn((id: string) =>
      Promise.resolve(id in accounts ? row(id) : null),
    ),
  };

  const auth = (id: string) =>
    `Bearer ${jwt.sign({ sub: id, email: `${id}@example.com` })}`;
  const server = () => request(app.getHttpServer() as Server);
  const put = (as: string, target: string, permissions: unknown) =>
    server()
      .put(`/accounts/${target}/permissions`)
      .set('Authorization', auth(as))
      .send({ permissions });

  const SUMMARY_KEYS = [
    'id',
    'displayName',
    'phone',
    'email',
    'isActive',
    'permissions',
    'matchingPreset',
    'matchingPresetLabel',
    'editable',
    'readOnlyReason',
  ];

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(AccountsService)
      .useValue(accountsMock)
      .overrideProvider(StoragePort)
      .useValue(fakeStorage())
      .overrideProvider(QuoteRendererPort)
      .useValue({ render: jest.fn() })
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
    held = {
      [ADMIN_ID]: [...ROLE_PRESETS.ADMIN],
      [WORKER_ID]: [...ROLE_PRESETS.THO_KS],
      [SUPER_ID]: [...ROLE_PRESETS.SUPER_ADMIN],
    };
  });

  describe('permissions.manage gate', () => {
    beforeEach(() => {
      held[WORKER_ID] = [...ROLE_PRESETS.QUAN_LY];
    });

    it.each([
      ['GET /accounts', () => server().get('/accounts')],
      [
        'GET /accounts/permission-options',
        () => server().get('/accounts/permission-options'),
      ],
      [
        'PUT /accounts/:id/permissions',
        () =>
          server()
            .put(`/accounts/${ADMIN_ID}/permissions`)
            .send({ permissions: [] }),
      ],
    ])('%s without permissions.manage ⇒ 403', async (_name, call) => {
      const res = await call().set('Authorization', auth(WORKER_ID));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(permissionRepo.deleteMany).not.toHaveBeenCalled();
    });
  });

  it('GET /accounts: contract keys only (no passwordHash), preset labels and read-only flags', async () => {
    const res = await server()
      .get('/accounts')
      .set('Authorization', auth(ADMIN_ID));
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>[];
    expect(body).toHaveLength(3);
    for (const item of body) {
      expect(Object.keys(item).every((k) => SUMMARY_KEYS.includes(k))).toBe(
        true,
      );
      expect(item).not.toHaveProperty('passwordHash');
    }
    const byId = new Map(body.map((item) => [item.id, item]));
    expect(byId.get(ADMIN_ID)).toMatchObject({
      matchingPreset: 'ADMIN',
      editable: false,
      readOnlyReason: 'Đây là tài khoản của bạn.',
    });
    expect(byId.get(WORKER_ID)).toMatchObject({
      matchingPreset: 'THO_KS',
      editable: true,
      readOnlyReason: null,
      phone: null,
    });
    expect(byId.get(SUPER_ID)).toMatchObject({
      matchingPreset: 'SUPER_ADMIN',
      matchingPresetLabel: 'Super Admin',
      editable: false,
    });
  });

  it('permission-options for an ADMIN: no SUPER_ADMIN preset, audit.read not grantable, field-worker presets listed', async () => {
    const res = await server()
      .get('/accounts/permission-options')
      .set('Authorization', auth(ADMIN_ID));
    expect(res.status).toBe(200);
    const presets = (res.body.presets as { key: RolePreset }[]).map(
      (p) => p.key,
    );
    expect(presets).not.toContain('SUPER_ADMIN');
    expect(presets).toEqual([
      'THO_KS',
      'THI_CONG',
      'KE_TOAN',
      'KHO_GIAO',
      'QUAN_LY',
      'ADMIN',
    ]);
    const options = res.body.permissions as {
      key: string;
      grantable: boolean;
      requires: string[];
    }[];
    expect(options.map((o) => o.key).sort()).toEqual(
      [...PERMISSION_KEYS].sort(),
    );
    const byKey = new Map(options.map((o) => [o.key, o]));
    expect(byKey.get(PERM.auditRead)?.grantable).toBe(false);
    expect(byKey.get(PERM.systemFeatureFlags)?.grantable).toBe(false);
    expect(byKey.get(PERM.ordersViewOwn)?.grantable).toBe(true);
    expect(byKey.get(PERM.costsView)?.grantable).toBe(true);
    expect(byKey.get(PERM.settingsManage)?.requires).toEqual([
      PERM.customersManage,
    ]);
    expect(byKey.get(PERM.quotesCreateEdit)?.requires).toEqual([
      PERM.customersManage,
      PERM.catalogView,
    ]);
  });

  it('permission-options: requiresAnyOf and the table edges each key gates; option keys stay within the contract', async () => {
    const res = await server()
      .get('/accounts/permission-options')
      .set('Authorization', auth(ADMIN_ID));
    expect(res.status).toBe(200);
    const OPTION_KEYS = [
      'key',
      'label',
      'group',
      'requires',
      'requiresAnyOf',
      'grantable',
      'transitions',
    ];
    const options = res.body.permissions as {
      key: string;
      requiresAnyOf: string[];
      transitions: { event: string; from: string; to: string }[];
    }[];
    for (const option of options) {
      expect(Object.keys(option).every((k) => OPTION_KEYS.includes(k))).toBe(
        true,
      );
      expect(Array.isArray(option.requiresAnyOf)).toBe(true);
      expect(Array.isArray(option.transitions)).toBe(true);
    }
    const byKey = new Map(options.map((o) => [o.key, o]));
    expect(byKey.get(PERM.ordersConfirm)?.requiresAnyOf).toEqual([
      PERM.ordersViewAll,
      PERM.ordersViewOwn,
    ]);
    expect(byKey.get(PERM.settingsManage)?.requiresAnyOf).toEqual([]);
    expect(byKey.get(PERM.constructionTransition)?.transitions).toEqual([
      { event: 'bat_dau_thi_cong', from: 'dacoc', to: 'thicong' },
      { event: 'xong_thi_cong', from: 'thicong', to: 'nghiemthu' },
      { event: 'hoan_thanh', from: 'nghiemthu', to: 'hoanthanh' },
    ]);
    expect(byKey.get(PERM.auditRead)?.transitions).toEqual([]);
  });

  it.each([
    [
      'orders.confirm without any view scope',
      [PERM.ordersConfirm],
      '«Chốt đơn» cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình».',
    ],
    [
      'discounts.approve with only orders.view_own',
      [PERM.discountsApprove, PERM.ordersViewOwn],
      '«Duyệt chiết khấu» cần thêm «Xem tất cả đơn».',
    ],
  ])(
    'PUT %s ⇒ 400 with the dependency sentence, nothing written',
    async (_n, keys, sentence) => {
      const res = await put(ADMIN_ID, WORKER_ID, keys);
      expect(res.status).toBe(400);
      expect(res.body.fieldErrors).toEqual([
        {
          field: 'permissions',
          code: 'PERMISSION_DEPENDENCY',
          message: sentence,
        },
      ]);
      expect(permissionRepo.deleteMany).not.toHaveBeenCalled();
    },
  );

  it('PUT orders.confirm with orders.view_own ⇒ 200', async () => {
    const res = await put(ADMIN_ID, WORKER_ID, [
      PERM.ordersConfirm,
      PERM.ordersViewOwn,
    ]);
    expect(res.status).toBe(200);
    expect(held[WORKER_ID]).toEqual(
      [PERM.ordersConfirm, PERM.ordersViewOwn].sort(),
    );
  });

  it('permission-options for the SUPER_ADMIN lists every preset', async () => {
    const res = await server()
      .get('/accounts/permission-options')
      .set('Authorization', auth(SUPER_ID));
    expect((res.body.presets as { key: string }[]).map((p) => p.key)).toContain(
      'SUPER_ADMIN',
    );
  });

  it('PUT with a key outside the registry ⇒ 400, fieldErrors[0].field = permissions', async () => {
    const res = await put(ADMIN_ID, WORKER_ID, [PERM.catalogView, 'x.nope']);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.body.fieldErrors[0].field).toBe('permissions');
    expect(permissionRepo.deleteMany).not.toHaveBeenCalled();
  });

  it('PUT with permissions not an array ⇒ 400 on permissions', async () => {
    const res = await put(ADMIN_ID, WORKER_ID, 'catalog');
    expect(res.status).toBe(400);
    expect(
      (res.body.fieldErrors as { field: string }[]).map((e) => e.field),
    ).toContain('permissions');
  });

  it.each([
    [
      'settings.manage without customers.manage',
      [PERM.settingsManage, PERM.catalogView],
      '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».',
    ],
    [
      'quotes.create_edit without customers.manage',
      [PERM.quotesCreateEdit, PERM.catalogView, PERM.ordersViewOwn],
      '«Tạo/sửa báo giá» cần thêm «Quản lý khách hàng».',
    ],
    [
      'quotes.create_edit without catalog.view',
      [PERM.quotesCreateEdit, PERM.customersManage, PERM.ordersViewOwn],
      '«Tạo/sửa báo giá» cần thêm «Xem danh mục vật tư».',
    ],
  ])(
    'PUT %s ⇒ 400 with the dependency sentence, nothing written',
    async (_n, keys, sentence) => {
      const res = await put(ADMIN_ID, WORKER_ID, keys);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.message).toBe(sentence);
      expect(res.body.fieldErrors).toEqual([
        {
          field: 'permissions',
          code: 'PERMISSION_DEPENDENCY',
          message: sentence,
        },
      ]);
      expect(permissionRepo.deleteMany).not.toHaveBeenCalled();
      expect(held[WORKER_ID]).toEqual([...ROLE_PRESETS.THO_KS]);
    },
  );

  it('PUT on your own account ⇒ 403 with the self-edit sentence', async () => {
    const res = await put(ADMIN_ID, ADMIN_ID, [...ROLE_PRESETS.ADMIN]);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Không thể tự sửa quyền của chính mình.');
    expect(permissionRepo.deleteMany).not.toHaveBeenCalled();
  });

  it('ADMIN editing the SUPER_ADMIN (even revoking everything) ⇒ 403', async () => {
    const res = await put(ADMIN_ID, SUPER_ID, []);
    expect(res.status).toBe(403);
    expect(held[SUPER_ID]).toEqual([...ROLE_PRESETS.SUPER_ADMIN]);
  });

  it('ADMIN granting audit.read ⇒ 403', async () => {
    const res = await put(ADMIN_ID, WORKER_ID, [PERM.auditRead]);
    expect(res.status).toBe(403);
  });

  it('PUT on a non-UUID id ⇒ 400 with the Vietnamese sentence', async () => {
    const res = await put(ADMIN_ID, 'not-a-uuid', []);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(INVALID_UUID_MESSAGE);
  });

  it('PUT on an account that does not exist ⇒ 404', async () => {
    const res = await put(ADMIN_ID, MISSING_ID, [PERM.catalogView]);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    expect(permissionRepo.createMany).not.toHaveBeenCalled();
  });

  it('valid PUT ⇒ 200 with the saved summary, other accounts untouched, one audit row', async () => {
    const res = await put(ADMIN_ID, WORKER_ID, [...ROLE_PRESETS.KE_TOAN]);
    expect(res.status).toBe(200);
    expect(
      Object.keys(res.body as object).every((k) => SUMMARY_KEYS.includes(k)),
    ).toBe(true);
    expect(res.body).toMatchObject({
      id: WORKER_ID,
      matchingPreset: 'KE_TOAN',
      editable: true,
      permissions: [...ROLE_PRESETS.KE_TOAN].sort(),
    });
    expect(held[ADMIN_ID]).toEqual([...ROLE_PRESETS.ADMIN]);
    expect(held[SUPER_ID]).toEqual([...ROLE_PRESETS.SUPER_ADMIN]);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});
