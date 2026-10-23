import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { PasswordService } from '../src/auth/password.service';
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
 * e2e of `POST /accounts` + `PUT /accounts/:id` (hermetic — `PrismaService` mocked, REAL
 * `AccountsService`/`AccountPermissionsService`, real JWT guard, real ValidationPipe +
 * exception filter). Covers what only exists at the HTTP layer: the permission gate, DTO
 * refusals with their `fieldErrors`, the status codes and the response contract.
 */
describe('/accounts create + update (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
  const WORKER_ID = '22222222-2222-4222-8222-222222222222';
  const SUPER_ID = '33333333-3333-4333-8333-333333333333';
  const MISSING_ID = '44444444-4444-4444-8444-444444444444';
  const NEW_ID = '55555555-5555-4555-8555-555555555555';

  let accounts: Record<string, { displayName: string; isActive: boolean }>;
  let held: Record<string, string[]>;

  const row = (id: string) => ({
    id,
    email: `${id}@example.com`,
    displayName: accounts[id].displayName,
    phone: '+84900000001',
    passwordHash: 'argon2-secret-hash',
    isActive: accounts[id].isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
    // The mock ignores `select`: the response must still carry only the contract keys.
    permissions: (held[id] ?? []).map((permission) => ({ permission })),
  });

  const permissionRepo = {
    findMany: jest.fn(({ where }: { where: { accountId: string } }) =>
      Promise.resolve(
        (held[where.accountId] ?? []).map((permission) => ({ permission })),
      ),
    ),
    createMany: jest.fn(
      ({ data }: { data: { accountId: string; permission: string }[] }) => {
        for (const d of data) (held[d.accountId] ??= []).push(d.permission);
        return Promise.resolve({ count: data.length });
      },
    ),
  };
  const accountRepo = {
    findUnique: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id in accounts ? row(where.id) : null),
    ),
    findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(row(where.id)),
    ),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn(({ data }: { data: { displayName: string } }) => {
      accounts[NEW_ID] = { displayName: data.displayName, isActive: true };
      return Promise.resolve({ id: NEW_ID });
    }),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: { displayName: string; isActive: boolean };
      }) => {
        accounts[where.id] = {
          displayName: data.displayName,
          isActive: data.isActive,
        };
        return Promise.resolve({});
      },
    ),
  };
  const sessionRepo = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  const queryRaw = jest.fn((_s: TemplateStringsArray, ids: string[]) =>
    Promise.resolve(ids.filter((id) => id in accounts).map((id) => ({ id }))),
  );
  const auditCreate = jest.fn().mockResolvedValue({});
  const prismaMock = {
    accountPermission: permissionRepo,
    account: accountRepo,
    session: sessionRepo,
    auditLog: { create: auditCreate },
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        $queryRaw: queryRaw,
        accountPermission: permissionRepo,
        account: accountRepo,
        session: sessionRepo,
      }),
    ),
  };
  const hash = jest.fn((plain: string) => Promise.resolve(`hashed:${plain}`));

  const auth = (id: string) =>
    `Bearer ${jwt.sign({ sub: id, email: `${id}@example.com` })}`;
  const server = () => request(app.getHttpServer() as Server);
  const post = (as: string, body: Record<string, unknown>) =>
    server().post('/accounts').set('Authorization', auth(as)).send(body);
  const put = (as: string, id: string, body: Record<string, unknown>) =>
    server().put(`/accounts/${id}`).set('Authorization', auth(as)).send(body);

  const createBody = (): Record<string, unknown> => ({
    displayName: 'Thợ Mới',
    phone: '0912 345 678',
    email: 'Tho.Moi@Local.Test',
    password: 'MatKhau123',
    preset: 'THO_KS',
    isActive: true,
  });
  const updateBody = (): Record<string, unknown> => ({
    displayName: 'Bình Mới',
    phone: '0912 345 679',
    email: 'binh@local.test',
    isActive: false,
  });

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
  const fieldsOf = (body: unknown) =>
    ((body as { fieldErrors?: { field: string }[] }).fieldErrors ?? []).map(
      (e) => e.field,
    );

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(PasswordService)
      .useValue({ hash, verify: jest.fn() })
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
    accounts = {
      [ADMIN_ID]: { displayName: 'An Admin', isActive: true },
      [WORKER_ID]: { displayName: 'Bình Thợ', isActive: true },
      [SUPER_ID]: { displayName: 'Chủ Super', isActive: true },
    };
    held = {
      [ADMIN_ID]: [...ROLE_PRESETS.ADMIN],
      [WORKER_ID]: [...ROLE_PRESETS.THO_KS],
      [SUPER_ID]: [...ROLE_PRESETS.SUPER_ADMIN],
    };
  });

  it.each([
    ['POST /accounts', () => post(WORKER_ID, createBody())],
    ['PUT /accounts/:id', () => put(WORKER_ID, ADMIN_ID, updateBody())],
  ])('%s without permissions.manage ⇒ 403', async (_name, call) => {
    held[WORKER_ID] = [...ROLE_PRESETS.QUAN_LY];
    const res = await call();
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    expect(accountRepo.create).not.toHaveBeenCalled();
    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  describe('POST /accounts', () => {
    it('valid ⇒ 201 + summary with contract keys only, preset loaded, raw phone normalized, one audit row', async () => {
      const res = await post(ADMIN_ID, createBody());

      expect(res.status).toBe(201);
      const body = res.body as Record<string, unknown>;
      expect(Object.keys(body).every((k) => SUMMARY_KEYS.includes(k))).toBe(
        true,
      );
      expect(body.id).toBe(NEW_ID);
      expect(body.permissions).toEqual([...ROLE_PRESETS.THO_KS].sort());
      expect(body.matchingPreset).toBe('THO_KS');
      expect(JSON.stringify(body)).not.toMatch(/password|hash/i);
      expect(accountRepo.create).toHaveBeenCalledWith({
        data: {
          displayName: 'Thợ Mới',
          phone: '+84912345678',
          email: 'tho.moi@local.test',
          isActive: true,
          passwordHash: 'hashed:MatKhau123',
        },
        select: { id: true },
      });
      expect(auditCreate).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['missing phone', { phone: undefined }, 'phone'],
      ['garbage phone', { phone: 'abc' }, 'phone'],
      ['weak password', { password: 'abcdefgh' }, 'password'],
      ['unknown preset', { preset: 'BOSS' }, 'preset'],
      ['blank display name', { displayName: '   ' }, 'displayName'],
      ['non-boolean isActive', { isActive: 'yes' }, 'isActive'],
    ])('%s ⇒ 400 on %s, nothing written', async (_name, patch, field) => {
      const res = await post(ADMIN_ID, { ...createBody(), ...patch });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(fieldsOf(res.body)).toContain(field);
      expect(accountRepo.create).not.toHaveBeenCalled();
    });

    it('an email typed with surrounding spaces is trimmed, not refused', async () => {
      const res = await post(ADMIN_ID, {
        ...createBody(),
        email: '  Tho.Moi@Local.Test ',
      });

      expect(res.status).toBe(201);
      expect(accountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'tho.moi@local.test' }),
        }),
      );
    });

    it('the update body trims the email the same way', async () => {
      const res = await put(ADMIN_ID, WORKER_ID, {
        ...updateBody(),
        email: ' binh@local.test  ',
      });

      expect(res.status).toBe(200);
      expect(accountRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'binh@local.test' }),
        }),
      );
    });

    it('invalid email ⇒ 400 with the Vietnamese message', async () => {
      const res = await post(ADMIN_ID, { ...createBody(), email: 'not-mail' });

      expect(res.status).toBe(400);
      expect(res.body.fieldErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Email không hợp lệ.',
          }),
        ]),
      );
    });

    it('an ADMIN creating a SUPER_ADMIN ⇒ 403, nothing written, no audit', async () => {
      const res = await post(ADMIN_ID, {
        ...createBody(),
        preset: 'SUPER_ADMIN',
      });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Không thể cấp quyền bạn không có');
      expect(accountRepo.create).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it('P2002 on the phone ⇒ 409 CONFLICT with fieldErrors.phone, no audit', async () => {
      accountRepo.create.mockRejectedValueOnce({ code: 'P2002' });
      accountRepo.findFirst.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve('phone' in where ? { id: WORKER_ID } : null),
      );

      const res = await post(ADMIN_ID, createBody());

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.fieldErrors).toEqual([
        {
          field: 'phone',
          code: 'isUnique',
          message: 'Số điện thoại đã thuộc tài khoản khác.',
        },
      ]);
      expect(auditCreate).not.toHaveBeenCalled();
      accountRepo.findFirst.mockResolvedValue(null);
    });
  });

  describe('PUT /accounts/:id', () => {
    it('valid ⇒ 200 + new summary, sessions revoked on deactivate, one audit row', async () => {
      const res = await put(ADMIN_ID, WORKER_ID, updateBody());

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(Object.keys(body).every((k) => SUMMARY_KEYS.includes(k))).toBe(
        true,
      );
      expect(body.displayName).toBe('Bình Mới');
      expect(body.isActive).toBe(false);
      expect(sessionRepo.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: WORKER_ID, revokedAt: null },
        }),
      );
      expect(auditCreate).toHaveBeenCalledTimes(1);
    });

    it('self ⇒ 403 with the self-edit message', async () => {
      const res = await put(ADMIN_ID, ADMIN_ID, updateBody());

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        'Không thể tự sửa tài khoản của chính mình.',
      );
      expect(accountRepo.update).not.toHaveBeenCalled();
    });

    it('a target holding a permission the actor lacks ⇒ 403', async () => {
      const res = await put(ADMIN_ID, SUPER_ID, updateBody());

      expect(res.status).toBe(403);
      expect(res.body.message).toContain(
        'Không thể sửa account mang quyền bạn không có',
      );
      expect(accountRepo.update).not.toHaveBeenCalled();
    });

    it('a non-UUID id ⇒ 400 with the Vietnamese message', async () => {
      const res = await put(ADMIN_ID, 'not-a-uuid', updateBody());

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(INVALID_UUID_MESSAGE);
    });

    it('a password in the body ⇒ 400 on password, never silently dropped', async () => {
      const res = await put(ADMIN_ID, WORKER_ID, {
        ...updateBody(),
        password: 'MatKhau123',
      });

      expect(res.status).toBe(400);
      expect(fieldsOf(res.body)).toEqual(['password']);
      expect(accountRepo.update).not.toHaveBeenCalled();
    });

    it('a missing field ⇒ 400 (PUT replaces, nothing is optional)', async () => {
      const res = await put(ADMIN_ID, WORKER_ID, {
        ...updateBody(),
        email: undefined,
      });

      expect(res.status).toBe(400);
      expect(fieldsOf(res.body)).toContain('email');
    });

    it('an unknown account ⇒ 404', async () => {
      const res = await put(ADMIN_ID, MISSING_ID, updateBody());

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('GET /accounts/permission-options still resolves to its own route', async () => {
      const res = await server()
        .get('/accounts/permission-options')
        .set('Authorization', auth(ADMIN_ID));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.presets)).toBe(true);
    });
  });
});
