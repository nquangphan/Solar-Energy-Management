import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PasswordService } from '../src/auth/password.service';
import type { AuthConfig } from '../src/auth/auth.config';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EventBus } from '../src/events/event-bus';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * Unit `AuthService` — HERMETIC (không cần Postgres): mock `AccountsService` + Session
 * repo qua PrismaService stub; dùng **argon2 + jwt thật**. Phủ: login đúng/sai (chống
 * enumeration), refresh rotate/revoke/expired, logout idempotent. (Chiến lược test:
 * unit hermetic là bắt buộc; integration cần DB tách riêng — xem Dev Notes.)
 */

const TEST_JWT_SECRET = 'test-secret-toi-thieu-32-ky-tu-abcdefgh';

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Bắt AppException từ một promise bị reject (fail nếu resolve). */
async function catchAppException(p: Promise<unknown>): Promise<AppException> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppException) return err;
    throw err;
  }
  throw new Error('Kỳ vọng AppException nhưng promise resolve');
}

interface SessionRepoMock {
  create: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
}

describe('AuthService (unit, hermetic)', () => {
  const config: AuthConfig = {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1000,
    passwordResetTtlMs: 5 * 60 * 1000,
    passwordResetMaxAttempts: 5,
  };

  let accounts: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updatePasswordHash: jest.Mock;
  };
  let sessionRepo: SessionRepoMock;
  let jwt: JwtService;
  let passwords: PasswordService;
  let service: AuthService;

  beforeEach(() => {
    accounts = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    };
    sessionRepo = {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    jwt = new JwtService({ secret: TEST_JWT_SECRET });
    passwords = new PasswordService();
    const prisma = { session: sessionRepo } as unknown as PrismaService;
    const eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    } as unknown as EventBus;
    service = new AuthService(
      accounts as unknown as AccountsService,
      passwords,
      jwt,
      prisma,
      eventBus,
      config,
    );
  });

  function makeAccount(passwordHash: string, isActive = true) {
    return {
      id: 'acc-1',
      email: 'user@example.com',
      passwordHash,
      displayName: 'User',
      isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  describe('login', () => {
    it('creds đúng → phát access JWT (sub=accountId) + refresh + expiresIn, tạo Session', async () => {
      const hash = await new PasswordService().hash('correct-horse');
      accounts.findByEmail.mockResolvedValue(makeAccount(hash));

      const tokens = await service.login('user@example.com', 'correct-horse');

      expect(tokens.expiresIn).toBe(900);
      expect(typeof tokens.refreshToken).toBe('string');
      expect(tokens.refreshToken.length).toBeGreaterThan(0);
      const payload = jwt.verify<{ sub: string }>(tokens.accessToken);
      expect(payload.sub).toBe('acc-1');

      // Session lưu HASH của refresh token (không lưu token thô) + expiresAt tương lai.
      expect(sessionRepo.create).toHaveBeenCalledTimes(1);
      const data = sessionRepo.create.mock.calls[0][0].data;
      expect(data.accountId).toBe('acc-1');
      expect(data.refreshTokenHash).toBe(sha256(tokens.refreshToken));
      expect(data.refreshTokenHash).not.toBe(tokens.refreshToken);
      expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('sai mật khẩu → AppException(UNAUTHENTICATED, 401), KHÔNG tạo session', async () => {
      const hash = await new PasswordService().hash('correct-horse');
      accounts.findByEmail.mockResolvedValue(makeAccount(hash));

      const err = await catchAppException(
        service.login('user@example.com', 'wrong-password'),
      );
      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
      expect(err.getStatus()).toBe(401);
      expect(sessionRepo.create).not.toHaveBeenCalled();
    });

    it('email không tồn tại → AppException(UNAUTHENTICATED)', async () => {
      accounts.findByEmail.mockResolvedValue(null);
      const err = await catchAppException(
        service.login('unknown@example.com', 'whatever'),
      );
      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('email không tồn tại VẪN gọi verify (dummy hash) — cân bằng timing chống enumeration', async () => {
      // Bất biến bảo mật AC-1: nhánh "email lạ" KHÔNG được bỏ qua verify (nếu bỏ, thời
      // gian phản hồi ngắn hơn nhánh "sai mật khẩu" → lộ email nào tồn tại). Verify được
      // gọi với một hash argon2 hợp lệ (dummy) chứ không phải null/rỗng.
      accounts.findByEmail.mockResolvedValue(null);
      const verifySpy = jest.spyOn(passwords, 'verify');

      await catchAppException(service.login('unknown@example.com', 'whatever'));

      expect(verifySpy).toHaveBeenCalledTimes(1);
      const [hashArg, plainArg] = verifySpy.mock.calls[0];
      expect(plainArg).toBe('whatever');
      expect(typeof hashArg).toBe('string');
      expect(hashArg).toMatch(/^\$argon2id\$/);
    });

    it('account isActive=false → AppException(UNAUTHENTICATED) dù mật khẩu đúng', async () => {
      const hash = await new PasswordService().hash('correct-horse');
      accounts.findByEmail.mockResolvedValue(makeAccount(hash, false));
      const err = await catchAppException(
        service.login('user@example.com', 'correct-horse'),
      );
      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('chống enumeration: message "email lạ" === "sai mật khẩu" === "inactive"', async () => {
      const hash = await new PasswordService().hash('correct-horse');

      accounts.findByEmail.mockResolvedValueOnce(null);
      const unknownEmail = await catchAppException(
        service.login('unknown@example.com', 'x'),
      );

      accounts.findByEmail.mockResolvedValueOnce(makeAccount(hash));
      const wrongPassword = await catchAppException(
        service.login('user@example.com', 'wrong'),
      );

      accounts.findByEmail.mockResolvedValueOnce(makeAccount(hash, false));
      const inactive = await catchAppException(
        service.login('user@example.com', 'correct-horse'),
      );

      expect(unknownEmail.message).toBe(wrongPassword.message);
      expect(wrongPassword.message).toBe(inactive.message);
    });
  });

  describe('refresh', () => {
    function activeSession(overrides: Record<string, unknown> = {}) {
      return {
        id: 's1',
        accountId: 'acc-1',
        refreshTokenHash: sha256('old-token'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
        ...overrides,
      };
    }

    it('token hợp lệ → rotate (revoke phiên cũ) + access JWT mới + session mới', async () => {
      sessionRepo.findUnique.mockResolvedValue(activeSession());
      // Revoke ATOMIC thắng cuộc: lật đúng 1 dòng (revokedAt null → now).
      sessionRepo.updateMany.mockResolvedValue({ count: 1 });

      const tokens = await service.refresh('old-token');

      // Tra theo hash của token gửi lên.
      expect(
        sessionRepo.findUnique.mock.calls[0][0].where.refreshTokenHash,
      ).toBe(sha256('old-token'));
      // Revoke phiên cũ bằng updateMany CÓ ĐIỀU KIỆN `revokedAt: null` (cổng single-use).
      expect(sessionRepo.updateMany).toHaveBeenCalledTimes(1);
      const revokeArg = sessionRepo.updateMany.mock.calls[0][0];
      expect(revokeArg.where.id).toBe('s1');
      expect(revokeArg.where.revokedAt).toBeNull();
      expect(revokeArg.data.revokedAt).toBeInstanceOf(Date);
      // Phiên mới + access JWT mới.
      expect(sessionRepo.create).toHaveBeenCalledTimes(1);
      const payload = jwt.verify<{ sub: string }>(tokens.accessToken);
      expect(payload.sub).toBe('acc-1');

      // Rotate phát refresh token MỚI thật sự (khác token cũ) → phiên mới lưu hash khác
      // hash cũ; token cũ replay không tra ra phiên mới (bất biến AC-2, chống replay).
      expect(tokens.refreshToken).not.toBe('old-token');
      const newSessionData = sessionRepo.create.mock.calls[0][0].data;
      expect(newSessionData.accountId).toBe('acc-1');
      expect(newSessionData.refreshTokenHash).toBe(sha256(tokens.refreshToken));
      expect(newSessionData.refreshTokenHash).not.toBe(sha256('old-token'));
    });

    it('token đã thu hồi → AppException(UNAUTHENTICATED), KHÔNG rotate', async () => {
      sessionRepo.findUnique.mockResolvedValue(
        activeSession({ revokedAt: new Date() }),
      );
      const err = await catchAppException(service.refresh('old-token'));
      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
      expect(sessionRepo.updateMany).not.toHaveBeenCalled();
      expect(sessionRepo.create).not.toHaveBeenCalled();
    });

    it('đua đồng thời: kẻ thua revoke atomic (count=0) → UNAUTHENTICATED, KHÔNG phát phiên mới', async () => {
      // Bất biến bảo mật: phiên còn hợp lệ lúc findUnique nhưng bị request song song
      // tiêu trước → updateMany có điều kiện lật 0 dòng → single-use giữ vững, không mint
      // token thứ hai từ cùng một refresh token (chống replay khi hai request cùng token).
      sessionRepo.findUnique.mockResolvedValue(activeSession());
      sessionRepo.updateMany.mockResolvedValue({ count: 0 });

      const err = await catchAppException(service.refresh('old-token'));
      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
      expect(sessionRepo.create).not.toHaveBeenCalled();
    });

    it('token hết hạn → AppException(UNAUTHENTICATED)', async () => {
      sessionRepo.findUnique.mockResolvedValue(
        activeSession({ expiresAt: new Date(Date.now() - 1000) }),
      );
      const err = await catchAppException(service.refresh('old-token'));
      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('token không tồn tại → AppException(UNAUTHENTICATED)', async () => {
      sessionRepo.findUnique.mockResolvedValue(null);
      const err = await catchAppException(service.refresh('nope'));
      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });

  describe('logout', () => {
    it('revoke phiên khớp (chỉ phiên chưa thu hồi), idempotent — không lỗi nếu count=0', async () => {
      await expect(service.logout('any-token')).resolves.toBeUndefined();
      const arg = sessionRepo.updateMany.mock.calls[0][0];
      expect(arg.where.refreshTokenHash).toBe(sha256('any-token'));
      expect(arg.where.revokedAt).toBeNull();
      expect(arg.data.revokedAt).toBeInstanceOf(Date);
    });
  });
});
