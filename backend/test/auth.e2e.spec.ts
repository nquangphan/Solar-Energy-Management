import type { Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { initAppOnLoopback } from './util/listen-loopback';

/**
 * e2e `/auth/*` — chứng minh WIRING + DTO validation + error envelope cho route mới,
 * KHÔNG cần DB: `PrismaService` override no-op, `AuthService` mock (logic đã phủ ở
 * unit test). Kiểm: body sai → 400 VALIDATION_ERROR + fieldErrors (ValidationPipe 2.2
 * áp cho route mới); creds sai → 401 UNAUTHENTICATED envelope; success trả AuthTokensDto
 * KHÔNG lộ passwordHash.
 *
 * Phone normalization through the REAL services lives in `auth-phone.e2e.spec.ts` — a
 * mock here would only measure `jest.fn`.
 */
describe('/auth/* (e2e)', () => {
  let app: INestApplication;
  const authMock = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
      })
      .overrideProvider(AuthService)
      .useValue(authMock)
      .compile();

    app = moduleRef.createNestApplication();
    await initAppOnLoopback(app);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  describe('POST /auth/login', () => {
    it('invalid DTO body → 400 VALIDATION_ERROR + fieldErrors (phone, password), service not called', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ phone: '', password: '' });
      const body = res.body as Envelope;

      expect(res.status).toBe(400);
      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(Array.isArray(body.fieldErrors)).toBe(true);
      expect((body.fieldErrors ?? []).map((fe) => fe.field)).toEqual(
        expect.arrayContaining(['phone', 'password']),
      );
      expect(authMock.login).not.toHaveBeenCalled();
    });

    it('missing phone → 400 fieldErrors[phone], service not called', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ password: 'dung' });
      const body = res.body as Envelope;

      expect(res.status).toBe(400);
      expect((body.fieldErrors ?? []).map((fe) => fe.field)).toContain('phone');
      expect(authMock.login).toHaveBeenCalledTimes(0);
    });

    it.each([
      ['an email string', 'user@example.com'],
      ['email: null', null],
    ])(
      'email in the body (%s) → 400 isAbsent, never silently stripped',
      async (_label, email) => {
        const res = await request(server())
          .post('/auth/login')
          .send({ phone: '0912345678', password: 'dung', email });
        const body = res.body as Envelope;

        expect(res.status).toBe(400);
        expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(body.fieldErrors).toEqual([
          expect.objectContaining({ field: 'email', code: 'isAbsent' }),
        ]);
        expect(authMock.login).toHaveBeenCalledTimes(0);
      },
    );

    it('a phone that is not a string → 400 before the normalizer', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ phone: ['0912345678'], password: 'dung' });
      expect(res.status).toBe(400);
      expect(
        ((res.body as Envelope).fieldErrors ?? []).map((fe) => fe.field),
      ).toContain('phone');
      expect(authMock.login).toHaveBeenCalledTimes(0);
    });

    it('creds sai → 401 envelope UNAUTHENTICATED (message generic, KHÔNG lộ chi tiết)', async () => {
      authMock.login.mockRejectedValueOnce(
        new AppException(
          ErrorCode.UNAUTHENTICATED,
          401,
          'Thông tin đăng nhập không đúng',
        ),
      );
      const res = await request(server())
        .post('/auth/login')
        .send({ phone: '0912345678', password: 'sai' });
      const body = res.body as Envelope;

      expect(res.status).toBe(401);
      expect(body.code).toBe(ErrorCode.UNAUTHENTICATED);
      expect(typeof body.traceId).toBe('string');
      expect(body.fieldErrors).toBeUndefined();
    });

    it('creds đúng → 200 AuthTokensDto { accessToken, refreshToken, expiresIn }, KHÔNG lộ passwordHash', async () => {
      authMock.login.mockResolvedValueOnce({
        accessToken: 'access.jwt.token',
        refreshToken: 'opaque-refresh',
        expiresIn: 900,
      });
      const res = await request(server())
        .post('/auth/login')
        .send({ phone: '0912 345 678', password: 'dung' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        accessToken: 'access.jwt.token',
        refreshToken: 'opaque-refresh',
        expiresIn: 900,
      });
      // Không leak field account nhạy cảm.
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      // The controller passes the RAW phone through; normalizing is the service's job.
      expect(authMock.login).toHaveBeenCalledWith('0912 345 678', 'dung');
    });
  });

  describe('POST /auth/refresh', () => {
    it('body sai → 400 VALIDATION_ERROR', async () => {
      const res = await request(server()).post('/auth/refresh').send({});
      expect(res.status).toBe(400);
      expect((res.body as Envelope).code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('token hợp lệ → 200 AuthTokensDto mới', async () => {
      authMock.refresh.mockResolvedValueOnce({
        accessToken: 'new.access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      });
      const res = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: 'old-refresh' });
      expect(res.status).toBe(200);
      expect((res.body as { accessToken: string }).accessToken).toBe(
        'new.access',
      );
    });

    it('token sai → 401 UNAUTHENTICATED', async () => {
      authMock.refresh.mockRejectedValueOnce(
        new AppException(ErrorCode.UNAUTHENTICATED, 401, 'x'),
      );
      const res = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: 'revoked' });
      expect(res.status).toBe(401);
      expect((res.body as Envelope).code).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });

  describe('POST /auth/logout', () => {
    it('body thiếu refreshToken → 400 VALIDATION_ERROR, KHÔNG gọi service', async () => {
      const res = await request(server()).post('/auth/logout').send({});
      expect(res.status).toBe(400);
      expect((res.body as Envelope).code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(authMock.logout).not.toHaveBeenCalled();
    });

    it('→ 204 No Content (idempotent, trung tính)', async () => {
      authMock.logout.mockResolvedValueOnce(undefined);
      const res = await request(server())
        .post('/auth/logout')
        .send({ refreshToken: 'any' });
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });
  });
});
