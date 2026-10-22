import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PasswordService } from '../src/auth/password.service';
import { EventBus } from '../src/events/event-bus';
import { PasswordResetRequested } from '../src/auth/domain/password-events';
import { ErrorCode } from '../src/common/errors/error-code';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` reads the secret at import time — set it before the dynamic import. */
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-0123456789abcdef';

/**
 * e2e of sign-in by phone through the REAL `AuthService` and `PasswordResetService`.
 *
 * `auth.e2e.spec.ts` mocks `AuthService`, so phone normalization never runs there. Here only
 * the storage edges are faked: `AccountsService` is an in-memory table looked up by strict
 * equality on `phone` (what `findUnique({ where: { phone } })` does), `PrismaService` stubs
 * the session/reset-code/audit writes. Hashes are real argon2id.
 */
describe('sign-in by phone (e2e, real auth services)', () => {
  let app: INestApplication;
  let eventBus: EventBus;

  const PASSWORD = 'MatKhau123';
  const accounts: Array<{
    id: string;
    email: string;
    phone: string | null;
    passwordHash: string;
    displayName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const accountsMock = {
    findByPhone: jest.fn((phone: string) =>
      Promise.resolve(accounts.find((a) => a.phone === phone) ?? null),
    ),
    findById: jest.fn((id: string) =>
      Promise.resolve(accounts.find((a) => a.id === id) ?? null),
    ),
    updatePasswordHash: jest.fn(),
  };

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    session: { create: jest.fn().mockResolvedValue({}) },
    passwordResetCode: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeAll(async () => {
    const hash = await new PasswordService().hash(PASSWORD);
    const base = {
      passwordHash: hash,
      displayName: 'Người dùng',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    accounts.push(
      {
        ...base,
        id: 'acc-active',
        email: 'a@example.com',
        phone: '+84912345678',
        isActive: true,
      },
      {
        ...base,
        id: 'acc-inactive',
        email: 'i@example.com',
        phone: '+84911111111',
        isActive: false,
      },
      {
        ...base,
        id: 'acc-no-phone',
        email: 'n@example.com',
        phone: null,
        isActive: true,
      },
    );

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .overrideProvider(AccountsService)
      .useValue(accountsMock)
      .compile();

    app = moduleRef.createNestApplication();
    await initAppOnLoopback(app);
    eventBus = moduleRef.get(EventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  interface Envelope {
    code: string;
    message: string;
    traceId: string;
    fieldErrors?: Array<{ field: string; code: string; message: string }>;
  }

  /** The envelope minus its per-request `traceId`, so two failures compare equal. */
  function withoutTraceId(envelope: Envelope): Omit<Envelope, 'traceId'> {
    const copy: Partial<Envelope> = { ...envelope };
    delete copy.traceId;
    return copy as Omit<Envelope, 'traceId'>;
  }

  describe('POST /auth/login', () => {
    it.each(['0912 345 678', '+84912345678', '84912345678', '0912.345.678'])(
      '%p → 200 tokens, looked up as +84912345678',
      async (phone) => {
        const res = await request(server())
          .post('/auth/login')
          .send({ phone, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(Object.keys(res.body as object).sort()).toEqual([
          'accessToken',
          'expiresIn',
          'refreshToken',
        ]);
        expect(accountsMock.findByPhone).toHaveBeenCalledTimes(1);
        expect(accountsMock.findByPhone).toHaveBeenCalledWith('+84912345678');
      },
    );

    it('unparseable phone → 400 fieldErrors.phone isPhoneNumber, no lookup', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ phone: 'abc', password: PASSWORD });
      const body = res.body as Envelope;

      expect(res.status).toBe(400);
      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(body.fieldErrors).toEqual([
        expect.objectContaining({ field: 'phone', code: 'isPhoneNumber' }),
      ]);
      expect(accountsMock.findByPhone).toHaveBeenCalledTimes(0);
    });

    it('a foreign number → 400 fieldErrors.phone, no lookup (accounts are VN-only)', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ phone: '+12025550123', password: PASSWORD });

      expect(res.status).toBe(400);
      expect((res.body as Envelope).fieldErrors).toEqual([
        expect.objectContaining({ field: 'phone', code: 'isPhoneNumber' }),
      ]);
      expect(accountsMock.findByPhone).toHaveBeenCalledTimes(0);
    });

    it('a well-formed landline nobody owns → the generic 401, not a format 400', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ phone: '028 3822 1234', password: PASSWORD });

      expect(res.status).toBe(401);
      expect((res.body as Envelope).message).toBe(
        'Thông tin đăng nhập không đúng',
      );
      expect(accountsMock.findByPhone).toHaveBeenCalledWith('+842838221234');
    });

    it('a phone longer than 32 characters → 400 at the DTO, no lookup', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ phone: '0'.repeat(33), password: PASSWORD });

      expect(res.status).toBe(400);
      expect(
        ((res.body as Envelope).fieldErrors ?? []).map((fe) => fe.field),
      ).toContain('phone');
      expect(accountsMock.findByPhone).toHaveBeenCalledTimes(0);
    });

    it('unknown phone / account without phone / inactive / wrong password → one identical 401', async () => {
      const attempts = [
        // A valid number nobody has — also how the no-phone account looks from outside.
        { phone: '0900000000', password: PASSWORD },
        { phone: '0911111111', password: PASSWORD },
        { phone: '0912345678', password: 'SaiMatKhau1' },
      ];
      const envelopes: Array<Omit<Envelope, 'traceId'>> = [];
      for (const body of attempts) {
        const res = await request(server()).post('/auth/login').send(body);
        expect(res.status).toBe(401);
        envelopes.push(withoutTraceId(res.body as Envelope));
      }

      expect(envelopes[0]).toEqual({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Thông tin đăng nhập không đúng',
      });
      for (const envelope of envelopes) {
        expect(envelope).toEqual(envelopes[0]);
      }
      // The account whose phone is NULL never matched any lookup.
      const returned = await Promise.all(
        accountsMock.findByPhone.mock.results.map((r) => r.value),
      );
      expect(
        returned.map((a: { id?: string } | null) => a?.id ?? null),
      ).toEqual([null, 'acc-inactive', 'acc-active']);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('registered vs unregistered number → same 200 body; event published once, for the registered one', async () => {
      const publish = jest.spyOn(eventBus, 'publish');

      const known = await request(server())
        .post('/auth/forgot-password')
        .send({ phone: '0912 345 678' });
      const unknown = await request(server())
        .post('/auth/forgot-password')
        .send({ phone: '0900000000' });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body).toEqual(unknown.body);
      const requested = publish.mock.calls.filter(
        ([event]) => event instanceof PasswordResetRequested,
      );
      expect(requested).toHaveLength(1);
      expect((requested[0][0] as PasswordResetRequested).actorAccountId).toBe(
        'acc-active',
      );
    });

    it('unparseable phone → 400 fieldErrors.phone', async () => {
      const res = await request(server())
        .post('/auth/forgot-password')
        .send({ phone: '12' });
      expect(res.status).toBe(400);
      expect((res.body as Envelope).fieldErrors).toEqual([
        expect.objectContaining({ field: 'phone', code: 'isPhoneNumber' }),
      ]);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('no live code for a registered or unknown number → the same 401', async () => {
      const bodies = [];
      for (const phone of ['0912345678', '0900000000']) {
        const res = await request(server())
          .post('/auth/reset-password')
          .send({ phone, code: '123456', newPassword: 'MatKhauMoi123' });
        expect(res.status).toBe(401);
        bodies.push(withoutTraceId(res.body as Envelope));
      }
      expect(bodies[0]).toEqual(bodies[1]);
      expect(bodies[0].message).toBe(
        'Mã xác thực không hợp lệ hoặc đã hết hạn',
      );
    });

    it('unparseable phone → 400 fieldErrors.phone, no lookup and no code check', async () => {
      const res = await request(server())
        .post('/auth/reset-password')
        .send({ phone: 'abc', code: '123456', newPassword: 'MatKhauMoi123' });

      expect(res.status).toBe(400);
      expect((res.body as Envelope).fieldErrors).toEqual([
        expect.objectContaining({ field: 'phone', code: 'isPhoneNumber' }),
      ]);
      expect(accountsMock.findByPhone).toHaveBeenCalledTimes(0);
      expect(prismaStub.passwordResetCode.findFirst).toHaveBeenCalledTimes(0);
    });

    it('a registered number in another spelling is looked up as E.164', async () => {
      await request(server()).post('/auth/reset-password').send({
        phone: '0912 345 678',
        code: '123456',
        newPassword: 'MatKhauMoi123',
      });

      expect(accountsMock.findByPhone).toHaveBeenCalledTimes(1);
      expect(accountsMock.findByPhone).toHaveBeenCalledWith('+84912345678');
    });
  });
});
