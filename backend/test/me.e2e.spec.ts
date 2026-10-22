import type { Server } from 'node:http';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { RequirePermissions } from '../src/auth/require-permissions.decorator';
import { ErrorCode } from '../src/common/errors/error-code';
import { initAppOnLoopback } from './util/listen-loopback';

/**
 * GOTCHA (2.3/2.5): `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc **import module** →
 * phải set env TRƯỚC khi `AppModule` được nạp. Vì vậy KHÔNG static-import `AppModule` ở
 * đầu file (import bị hoist); set env ở top-level rồi `await import()` động trong
 * `beforeAll` để guard + `JwtService` dùng CÙNG secret → token ký test verify được.
 */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * Controller test-only chứng minh AC-2 "gọi thẳng API thiếu quyền bị từ chối": khai
 * `@RequirePermissions(PERM.auditRead)` → guard toàn cục enforce 403 nếu effective set
 * thiếu `audit.read`, 200 nếu đủ. KHÔNG phải endpoint domain thật (Epic 3+).
 */
@Controller()
class TestGuardedController {
  @Get('__test-guarded')
  @RequirePermissions(PERM.auditRead)
  guarded(): { ok: true } {
    return { ok: true };
  }
}

/**
 * e2e `/me` + enforcement 403 (hermetic — override `PrismaService` no-op, mock
 * `AccountsService`/`AccountPermissionsService`, ký JWT thật bằng `JwtService` cùng
 * secret). Phủ AC-1 (`/me` trả shape đúng, permissions sorted, KHÔNG leak passwordHash),
 * AC-2 (no/rác token → 401; thiếu quyền → 403), AC-3 (server enforce, không phụ thuộc client).
 */
describe('/me + enforcement (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const account: {
    id: string;
    email: string;
    phone: string | null;
    displayName: string;
    passwordHash: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } = {
    id: 'acc-1',
    email: 'me@example.com',
    phone: '+84912345678',
    displayName: 'Tôi',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const accountsMock = {
    findById: jest.fn((id: string) => (id === 'acc-1' ? account : null)),
  };
  const accountPermissionsMock = {
    listForAccount: jest.fn(),
  };

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestGuardedController],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
      })
      .overrideProvider(AccountsService)
      .useValue(accountsMock)
      .overrideProvider(AccountPermissionsService)
      .useValue(accountPermissionsMock)
      .compile();

    app = moduleRef.createNestApplication();
    await initAppOnLoopback(app);
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
    fieldErrors?: unknown;
  }

  async function signAccessToken(sub = 'acc-1'): Promise<string> {
    return jwt.signAsync({ sub });
  }

  describe('GET /me', () => {
    it('không header → 401 envelope UNAUTHENTICATED (+ traceId, KHÔNG fieldErrors)', async () => {
      const res = await request(server()).get('/me');
      const body = res.body as Envelope;

      expect(res.status).toBe(401);
      expect(body.code).toBe(ErrorCode.UNAUTHENTICATED);
      expect(typeof body.traceId).toBe('string');
      expect(body.fieldErrors).toBeUndefined();
    });

    it('Bearer rác → 401 (verify fail, envelope generic)', async () => {
      const res = await request(server())
        .get('/me')
        .set('Authorization', 'Bearer rac.khong.hop.le');
      expect(res.status).toBe(401);
      expect((res.body as Envelope).code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('Bearer hợp lệ → 200 shape đúng, permissions sorted, KHÔNG passwordHash', async () => {
      accountPermissionsMock.listForAccount.mockResolvedValueOnce(
        new Set([PERM.ordersViewAll, PERM.auditRead]),
      );
      const token = await signAccessToken();

      const res = await request(server())
        .get('/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'acc-1',
        email: 'me@example.com',
        phone: '+84912345678',
        displayName: 'Tôi',
        // sorted tất định: 'audit.read' < 'orders.view_all'
        permissions: ['audit.read', 'orders.view_all'],
      });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      expect(accountPermissionsMock.listForAccount).toHaveBeenCalledWith(
        'acc-1',
      );
    });

    it('account không có quyền nào → 200 permissions: [] (mảng rỗng tất định)', async () => {
      accountPermissionsMock.listForAccount.mockResolvedValueOnce(new Set());
      const token = await signAccessToken();

      const res = await request(server())
        .get('/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'acc-1',
        email: 'me@example.com',
        phone: '+84912345678',
        displayName: 'Tôi',
        permissions: [],
      });
    });

    it('account without a phone yet → 200 with phone: null (key present)', async () => {
      accountsMock.findById.mockImplementationOnce(() => ({
        ...account,
        phone: null,
      }));
      accountPermissionsMock.listForAccount.mockResolvedValueOnce(new Set());
      const token = await signAccessToken();

      const res = await request(server())
        .get('/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body as object).sort()).toEqual([
        'displayName',
        'email',
        'id',
        'permissions',
        'phone',
      ]);
      expect((res.body as { phone: unknown }).phone).toBeNull();
    });

    it('token hợp lệ nhưng account inactive → 401', async () => {
      accountsMock.findById.mockImplementationOnce(() => ({
        ...account,
        isActive: false,
      }));
      const token = await signAccessToken();
      const res = await request(server())
        .get('/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect((res.body as Envelope).code).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });

  describe('enforcement @RequirePermissions (AC-2/AC-3)', () => {
    it('Bearer hợp lệ nhưng thiếu audit.read → 403 FORBIDDEN', async () => {
      accountPermissionsMock.listForAccount.mockResolvedValueOnce(
        new Set([PERM.ordersViewAll]),
      );
      const token = await signAccessToken();
      const res = await request(server())
        .get('/__test-guarded')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect((res.body as Envelope).code).toBe(ErrorCode.FORBIDDEN);
    });

    it('Bearer hợp lệ + có audit.read → 200', async () => {
      accountPermissionsMock.listForAccount.mockResolvedValueOnce(
        new Set([PERM.auditRead]),
      );
      const token = await signAccessToken();
      const res = await request(server())
        .get('/__test-guarded')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('không token trên route guarded → 401 (không lộ, chặn trước cả check quyền)', async () => {
      const res = await request(server()).get('/__test-guarded');
      expect(res.status).toBe(401);
      expect((res.body as Envelope).code).toBe(ErrorCode.UNAUTHENTICATED);
      expect(accountPermissionsMock.listForAccount).not.toHaveBeenCalled();
    });
  });
});
