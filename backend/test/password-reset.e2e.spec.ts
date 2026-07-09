import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { AuthService } from '../src/auth/auth.service';
import { PasswordResetService } from '../src/auth/password-reset.service';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * GOTCHA (2.3/2.5): `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc **import module** →
 * set env ở top-level rồi `await import()` động `AppModule` trong `beforeAll` (static import
 * bị hoist lên trước dòng gán env).
 */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e 3 route mật khẩu — chứng minh WIRING + DTO validation + envelope + **ranh giới
 * guard**, KHÔNG cần DB (mock service; logic đã phủ ở unit test).
 *
 * Bất biến quan trọng nhất ở đây: `forgot-password`/`reset-password` phải CÔNG KHAI (người
 * quên mật khẩu chưa có token) còn `change-password` phải ĐÒI Bearer. Đảo một trong hai là
 * lỗ hổng, và cả hai chiều đều được assert.
 */
describe('/auth/{forgot,reset,change}-password (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const account = {
    id: 'acc-1',
    email: 'me@example.com',
    displayName: 'Tôi',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const passwordResetMock = { requestCode: jest.fn(), reset: jest.fn() };
  const authMock = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === 'acc-1' ? account : null)),
  };

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
      })
      .overrideProvider(AccountsService)
      .useValue(accountsMock)
      .overrideProvider(AuthService)
      .useValue(authMock)
      .overrideProvider(PasswordResetService)
      .useValue(passwordResetMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    accountsMock.findById.mockImplementation((id: string) =>
      id === 'acc-1' ? account : null,
    );
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

  const validReset = {
    email: 'me@example.com',
    code: '123456',
    newPassword: 'MatKhauMoi123',
  };

  describe('POST /auth/forgot-password', () => {
    it('công khai (KHÔNG cần Bearer) — người quên mật khẩu chưa có token', async () => {
      passwordResetMock.requestCode.mockResolvedValueOnce({
        expiresInSeconds: 300,
      });
      const res = await request(server())
        .post('/auth/forgot-password')
        .send({ email: 'me@example.com' });
      expect(res.status).toBe(200);
    });

    it('email không hợp lệ → 400 VALIDATION_ERROR + fieldErrors[email], KHÔNG gọi service', async () => {
      const res = await request(server())
        .post('/auth/forgot-password')
        .send({ email: 'khong-phai-email' });
      const body = res.body as Envelope;

      expect(res.status).toBe(400);
      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect((body.fieldErrors ?? []).map((fe) => fe.field)).toContain('email');
      expect(passwordResetMock.requestCode).not.toHaveBeenCalled();
    });

    it('email lạ vs email tồn tại → CÙNG status + CÙNG body (chống enumeration)', async () => {
      // Service trả cùng một giá trị cho hai nhánh (unit test đã chứng minh); ở đây chứng
      // minh controller KHÔNG thêm bất kỳ khác biệt nào vào response.
      passwordResetMock.requestCode.mockResolvedValue({
        expiresInSeconds: 300,
      });

      const existing = await request(server())
        .post('/auth/forgot-password')
        .send({ email: 'me@example.com' });
      const unknown = await request(server())
        .post('/auth/forgot-password')
        .send({ email: 'khong-ton-tai@example.com' });

      expect(existing.status).toBe(unknown.status);
      expect(existing.body).toEqual(unknown.body);
      expect(existing.body).toEqual({ expiresInSeconds: 300 });
    });

    it('response KHÔNG mang mã xác thực dưới bất kỳ tên field nào', async () => {
      passwordResetMock.requestCode.mockResolvedValueOnce({
        expiresInSeconds: 300,
      });
      const res = await request(server())
        .post('/auth/forgot-password')
        .send({ email: 'me@example.com' });
      expect(Object.keys(res.body as object)).toEqual(['expiresInSeconds']);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('công khai, mã đúng → 204 No Content', async () => {
      passwordResetMock.reset.mockResolvedValueOnce(undefined);
      const res = await request(server())
        .post('/auth/reset-password')
        .send(validReset);
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(passwordResetMock.reset).toHaveBeenCalledWith(
        validReset.email,
        validReset.code,
        validReset.newPassword,
      );
    });

    it('mã không đủ 6 số → 400 VALIDATION_ERROR + fieldErrors[code]', async () => {
      const res = await request(server())
        .post('/auth/reset-password')
        .send({ ...validReset, code: '12ab' });
      const body = res.body as Envelope;

      expect(res.status).toBe(400);
      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect((body.fieldErrors ?? []).map((fe) => fe.field)).toContain('code');
      expect(passwordResetMock.reset).not.toHaveBeenCalled();
    });

    it('mật khẩu mới <8 ký tự hoặc thiếu chữ/số → 400 VALIDATION_ERROR + fieldErrors[newPassword]', async () => {
      for (const newPassword of ['Ab1', 'chikytuchubiet', '1234567890']) {
        const res = await request(server())
          .post('/auth/reset-password')
          .send({ ...validReset, newPassword });
        const body = res.body as Envelope;

        expect(res.status).toBe(400);
        expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect((body.fieldErrors ?? []).map((fe) => fe.field)).toContain(
          'newPassword',
        );
      }
      expect(passwordResetMock.reset).not.toHaveBeenCalled();
    });

    it('mã sai/hết hạn → 401 envelope UNAUTHENTICATED (message generic, có traceId)', async () => {
      passwordResetMock.reset.mockRejectedValueOnce(
        new AppException(
          ErrorCode.UNAUTHENTICATED,
          401,
          'Mã xác thực không hợp lệ hoặc đã hết hạn',
        ),
      );
      const res = await request(server())
        .post('/auth/reset-password')
        .send(validReset);
      const body = res.body as Envelope;

      expect(res.status).toBe(401);
      expect(body.code).toBe(ErrorCode.UNAUTHENTICATED);
      expect(typeof body.traceId).toBe('string');
      expect(body.fieldErrors).toBeUndefined();
    });
  });

  describe('POST /auth/change-password', () => {
    const validChange = {
      currentPassword: 'MatKhauCu123',
      newPassword: 'MatKhauMoi456',
    };

    async function signAccessToken(sub = 'acc-1'): Promise<string> {
      return jwt.signAsync({ sub });
    }

    it('KHÔNG Bearer → 401 (chứng minh route KHÔNG @Public, guard toàn cục enforce)', async () => {
      // Đây là bất biến trung tâm của việc tách `ChangePasswordController`: nếu ai chuyển
      // route này vào `AuthController` (class `@Public()`), test đỏ ngay.
      const res = await request(server())
        .post('/auth/change-password')
        .send(validChange);

      expect(res.status).toBe(401);
      expect((res.body as Envelope).code).toBe(ErrorCode.UNAUTHENTICATED);
      expect(authMock.changePassword).not.toHaveBeenCalled();
    });

    it('Bearer rác → 401, không chạm service', async () => {
      const res = await request(server())
        .post('/auth/change-password')
        .set('Authorization', 'Bearer rac.khong.hop.le')
        .send(validChange);
      expect(res.status).toBe(401);
      expect(authMock.changePassword).not.toHaveBeenCalled();
    });

    it('Bearer hợp lệ → 204, accountId lấy từ TOKEN chứ không từ body', async () => {
      authMock.changePassword.mockResolvedValueOnce(undefined);
      const token = await signAccessToken();

      const res = await request(server())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        // Cố tình nhét accountId của người khác vào body — phải bị bỏ qua hoàn toàn.
        .send({ ...validChange, accountId: 'acc-nan-nhan' });

      expect(res.status).toBe(204);
      expect(authMock.changePassword).toHaveBeenCalledWith(
        'acc-1',
        validChange.currentPassword,
        validChange.newPassword,
      );
    });

    it('mật khẩu hiện tại sai → 401 envelope', async () => {
      authMock.changePassword.mockRejectedValueOnce(
        new AppException(
          ErrorCode.UNAUTHENTICATED,
          401,
          'Mật khẩu hiện tại không đúng',
        ),
      );
      const token = await signAccessToken();
      const res = await request(server())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(validChange);

      expect(res.status).toBe(401);
      expect((res.body as Envelope).code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('mật khẩu mới trùng mật khẩu cũ → 400 + fieldErrors[newPassword]', async () => {
      authMock.changePassword.mockRejectedValueOnce(
        new AppException(
          ErrorCode.VALIDATION_ERROR,
          400,
          'Mật khẩu mới phải khác mật khẩu hiện tại.',
          [
            {
              field: 'newPassword',
              code: 'sameAsCurrent',
              message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
            },
          ],
        ),
      );
      const token = await signAccessToken();
      const res = await request(server())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'MatKhauCu123', newPassword: 'MatKhauCu123' });
      const body = res.body as Envelope;

      expect(res.status).toBe(400);
      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(body.fieldErrors?.[0].field).toBe('newPassword');
    });

    it('DTO sai → 400 trước khi chạm service (ValidationPipe chạy sau guard)', async () => {
      const token = await signAccessToken();
      const res = await request(server())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: '', newPassword: 'yeu' });

      expect(res.status).toBe(400);
      expect((res.body as Envelope).code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(authMock.changePassword).not.toHaveBeenCalled();
    });
  });
});
