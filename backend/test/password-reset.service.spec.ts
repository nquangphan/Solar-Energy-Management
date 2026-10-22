import { AccountsService } from '../src/accounts/accounts.service';
import { PasswordService } from '../src/auth/password.service';
import { PasswordResetService } from '../src/auth/password-reset.service';
import type { AuthConfig } from '../src/auth/auth.config';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EventBus } from '../src/events/event-bus';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * Unit `PasswordResetService` — HERMETIC (không cần Postgres): mock `AccountsService`,
 * `PrismaService`, `EventBus`; dùng **argon2 thật** (mã được băm/kiểm y như production).
 *
 * Phủ toàn bộ bộ kiểm soát bù trừ cho một mã entropy thấp (6 số ≈ 20 bit): TTL, single-use,
 * trần số lần thử tăng ATOMIC, cooldown gửi lại, response trung tính + cân bằng timing
 * (chống user-enumeration), thu hồi mọi phiên sau khi đặt lại.
 */

const ACCOUNT_ID = 'acc-1';
const PHONE = '0912345678';
const NEW_PASSWORD = 'MatKhauMoi123';
const MAX_ATTEMPTS = 5;
const TTL_MS = 5 * 60 * 1000;

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

describe('PasswordResetService (unit, hermetic)', () => {
  const config: AuthConfig = {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1000,
    passwordResetTtlMs: TTL_MS,
    passwordResetMaxAttempts: MAX_ATTEMPTS,
  };

  let accounts: {
    findByPhone: jest.Mock;
    findById: jest.Mock;
    updatePasswordHash: jest.Mock;
  };
  let codeRepo: {
    findFirst: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
  };
  let txCodeRepo: { updateMany: jest.Mock };
  let txSessionRepo: { updateMany: jest.Mock };
  let eventBus: { publish: jest.Mock; subscribe: jest.Mock };
  let passwords: PasswordService;
  let service: PasswordResetService;

  beforeEach(() => {
    accounts = {
      findByPhone: jest.fn(),
      findById: jest.fn(),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    };
    codeRepo = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      // Cổng tăng attempt ATOMIC — mặc định thắng (lật đúng 1 dòng).
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    txCodeRepo = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    txSessionRepo = { updateMany: jest.fn().mockResolvedValue({ count: 2 }) };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };
    passwords = new PasswordService();

    const prisma = {
      passwordResetCode: codeRepo,
      $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
        cb({ passwordResetCode: txCodeRepo, session: txSessionRepo }),
      ),
    } as unknown as PrismaService;

    service = new PasswordResetService(
      accounts as unknown as AccountsService,
      passwords,
      prisma,
      eventBus as unknown as EventBus,
      config,
    );
  });

  function makeAccount(isActive = true) {
    return {
      id: ACCOUNT_ID,
      email: 'user@example.com',
      phone: '+84912345678',
      passwordHash: 'irrelevant',
      displayName: 'User',
      isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /** Một dòng `password_reset_codes` còn sống, mang hash argon2id của [code]. */
  async function liveCode(
    code: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: 'code-1',
      accountId: ACCOUNT_ID,
      codeHash: await passwords.hash(code),
      attemptCount: 0,
      expiresAt: new Date(Date.now() + TTL_MS),
      consumedAt: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  describe('requestCode', () => {
    it('registered phone → creates a 6-digit code (argon2id hash), publishes PasswordResetRequested', async () => {
      accounts.findByPhone.mockResolvedValue(makeAccount());
      const hashSpy = jest.spyOn(passwords, 'hash');

      const result = await service.requestCode(PHONE);

      expect(result).toEqual({ expiresInSeconds: TTL_MS / 1000 });

      // Mã sinh bằng CSPRNG, đúng 6 chữ số (rejection sampling — không modulo bias).
      expect(hashSpy).toHaveBeenCalledTimes(1);
      expect(hashSpy.mock.calls[0][0]).toMatch(/^\d{6}$/);

      // Lưu HASH, không bao giờ lưu mã thô.
      expect(codeRepo.create).toHaveBeenCalledTimes(1);
      const data = codeRepo.create.mock.calls[0][0].data;
      expect(data.accountId).toBe(ACCOUNT_ID);
      expect(data.codeHash).toMatch(/^\$argon2id\$/);
      expect(data.codeHash).not.toContain(hashSpy.mock.calls[0][0]);
      expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Seam gửi mã = event (AD-18). Producer KHÔNG gửi email/SMS/FCM.
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish.mock.calls[0][0].type).toBe(
        'PasswordResetRequested',
      );
    });

    it('unknown phone → SAME response, no row, no publish', async () => {
      accounts.findByPhone.mockResolvedValue(null);

      const result = await service.requestCode('0987654321');

      expect(result).toEqual({ expiresInSeconds: TTL_MS / 1000 });
      expect(codeRepo.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('unknown phone STILL hashes exactly once — timing balance against enumeration', async () => {
      // Bất biến bảo mật AC-1: nhánh "email lạ" phải trả cùng response VÀ tốn cùng lượng
      // công việc. argon2id là chi phí trội của request này; bỏ nó ở nhánh email lạ khiến
      // thời gian phản hồi ngắn hơn hẳn → lộ email nào tồn tại.
      accounts.findByPhone.mockResolvedValue(null);
      const hashSpy = jest.spyOn(passwords, 'hash');

      await service.requestCode('0987654321');

      expect(hashSpy).toHaveBeenCalledTimes(1);
      expect(hashSpy.mock.calls[0][0]).toMatch(/^\d{6}$/);
    });

    it('inactive account → neutral like an unknown phone (no row, no event)', async () => {
      accounts.findByPhone.mockResolvedValue(makeAccount(false));

      const result = await service.requestCode(PHONE);

      expect(result).toEqual({ expiresInSeconds: TTL_MS / 1000 });
      expect(codeRepo.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('đang còn mã sống → cooldown: KHÔNG sinh mã mới, vẫn trả response trung tính', async () => {
      accounts.findByPhone.mockResolvedValue(makeAccount());
      codeRepo.findFirst.mockResolvedValue(await liveCode('111111'));

      const result = await service.requestCode(PHONE);

      expect(result).toEqual({ expiresInSeconds: TTL_MS / 1000 });
      expect(codeRepo.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      // Cooldown chỉ tính mã CHƯA tiêu thụ và CHƯA hết hạn.
      const where = codeRepo.findFirst.mock.calls[0][0].where;
      expect(where.accountId).toBe(ACCOUNT_ID);
      expect(where.consumedAt).toBeNull();
      expect(where.expiresAt.gt).toBeInstanceOf(Date);
    });
  });

  describe('phone identifier', () => {
    it('requestCode and reset look up the E.164 form of a spaced number', async () => {
      accounts.findByPhone.mockResolvedValue(null);
      await service.requestCode('0912 345 678');
      await catchAppException(
        service.reset('+84912345678', '654321', NEW_PASSWORD),
      );
      expect(accounts.findByPhone.mock.calls).toEqual([
        ['+84912345678'],
        ['+84912345678'],
      ]);
    });

    it('malformed phone → 400 fieldErrors.phone on both endpoints, no lookup', async () => {
      const forgot = await catchAppException(service.requestCode('abc'));
      const reset = await catchAppException(
        service.reset('abc', '654321', NEW_PASSWORD),
      );
      for (const err of [forgot, reset]) {
        expect(err.getStatus()).toBe(400);
        expect(err.fieldErrors).toEqual([
          expect.objectContaining({ field: 'phone', code: 'isPhoneNumber' }),
        ]);
      }
      expect(accounts.findByPhone).toHaveBeenCalledTimes(0);
    });
  });

  describe('reset', () => {
    it('mã đúng → tiêu thụ mã, đổi hash, THU HỒI MỌI PHIÊN, publish PasswordResetCompleted', async () => {
      accounts.findByPhone.mockResolvedValue(makeAccount());
      codeRepo.findFirst.mockResolvedValue(await liveCode('654321'));

      await expect(
        service.reset(PHONE, '654321', NEW_PASSWORD),
      ).resolves.toBeUndefined();

      // Single-use: consumedAt lật bằng updateMany CÓ ĐIỀU KIỆN (cổng atomic).
      expect(txCodeRepo.updateMany).toHaveBeenCalledTimes(1);
      const consume = txCodeRepo.updateMany.mock.calls[0][0];
      expect(consume.where.id).toBe('code-1');
      expect(consume.where.consumedAt).toBeNull();
      expect(consume.data.consumedAt).toBeInstanceOf(Date);

      // Mật khẩu mới lưu dạng hash argon2id, không bao giờ lưu thô.
      expect(accounts.updatePasswordHash).toHaveBeenCalledTimes(1);
      const [id, hash] = accounts.updatePasswordHash.mock.calls[0] as [
        string,
        string,
      ];
      expect(id).toBe(ACCOUNT_ID);
      expect(hash).toMatch(/^\$argon2id\$/);
      expect(await passwords.verify(hash, NEW_PASSWORD)).toBe(true);

      // Thu hồi MỌI phiên còn hoạt động của account (OWASP: kết thúc mọi phiên).
      const revoke = txSessionRepo.updateMany.mock.calls[0][0];
      expect(revoke.where.accountId).toBe(ACCOUNT_ID);
      expect(revoke.where.revokedAt).toBeNull();
      expect(revoke.data.revokedAt).toBeInstanceOf(Date);

      // Publish SAU khi commit (giữ cô lập lỗi của EventBus — audit lỗi không rollback).
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish.mock.calls[0][0].type).toBe(
        'PasswordResetCompleted',
      );
    });

    it('tăng attemptCount ATOMIC trước khi verify (có điều kiện lt maxAttempts)', async () => {
      accounts.findByPhone.mockResolvedValue(makeAccount());
      codeRepo.findFirst.mockResolvedValue(await liveCode('654321'));

      await service.reset(PHONE, '654321', NEW_PASSWORD);

      expect(codeRepo.updateMany).toHaveBeenCalledTimes(1);
      const gate = codeRepo.updateMany.mock.calls[0][0];
      expect(gate.where.id).toBe('code-1');
      expect(gate.where.consumedAt).toBeNull();
      expect(gate.where.attemptCount).toEqual({ lt: MAX_ATTEMPTS });
      expect(gate.data.attemptCount).toEqual({ increment: 1 });
    });

    it('mã sai → 401, attempt VẪN bị tính, không đổi mật khẩu', async () => {
      accounts.findByPhone.mockResolvedValue(makeAccount());
      codeRepo.findFirst.mockResolvedValue(await liveCode('654321'));

      const err = await catchAppException(
        service.reset(PHONE, '000000', NEW_PASSWORD),
      );

      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
      expect(err.getStatus()).toBe(401);
      expect(codeRepo.updateMany).toHaveBeenCalledTimes(1); // attempt đã tính
      expect(accounts.updatePasswordHash).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('vượt trần số lần thử → 401 KỂ CẢ khi nhập đúng mã (cổng atomic count=0)', async () => {
      // Bất biến bảo mật: khi `attemptCount >= max`, updateMany có điều kiện lật 0 dòng ⇒
      // mã bị khoá vĩnh viễn. Đây là thứ chặn brute-force 10⁶ khả năng của mã 6 số.
      accounts.findByPhone.mockResolvedValue(makeAccount());
      codeRepo.findFirst.mockResolvedValue(
        await liveCode('654321', { attemptCount: MAX_ATTEMPTS }),
      );
      codeRepo.updateMany.mockResolvedValue({ count: 0 });

      const err = await catchAppException(
        service.reset(PHONE, '654321', NEW_PASSWORD),
      );

      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
      expect(accounts.updatePasswordHash).not.toHaveBeenCalled();
      expect(txCodeRepo.updateMany).not.toHaveBeenCalled();
    });

    it('đua đồng thời tiêu thụ: kẻ thua (consume count=0) → 401, KHÔNG đổi mật khẩu', async () => {
      // Hai request cùng mã đúng: chỉ request lật được `consumedAt` (count===1) mới đổi
      // mật khẩu — mirror cổng rotate refresh của 2.3. Kẻ thua bị từ chối.
      accounts.findByPhone.mockResolvedValue(makeAccount());
      codeRepo.findFirst.mockResolvedValue(await liveCode('654321'));
      txCodeRepo.updateMany.mockResolvedValue({ count: 0 });

      const err = await catchAppException(
        service.reset(PHONE, '654321', NEW_PASSWORD),
      );

      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
      expect(accounts.updatePasswordHash).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('mã hết hạn / đã tiêu thụ → không tra ra dòng sống → 401', async () => {
      accounts.findByPhone.mockResolvedValue(makeAccount());
      codeRepo.findFirst.mockResolvedValue(null);

      const err = await catchAppException(
        service.reset(PHONE, '654321', NEW_PASSWORD),
      );

      expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
      // Tra mã sống theo accountId + orderBy createdAt desc (KHÔNG tra theo codeHash:
      // argon2 salt ngẫu nhiên nên hash không tra được, và mã 6 số trùng nhau giữa account).
      const query = codeRepo.findFirst.mock.calls[0][0];
      expect(query.where.accountId).toBe(ACCOUNT_ID);
      expect(query.where.consumedAt).toBeNull();
      expect(query.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('nhánh thiếu account/mã VẪN verify với dummy hash — cân bằng timing', async () => {
      accounts.findByPhone.mockResolvedValue(null);
      const verifySpy = jest.spyOn(passwords, 'verify');

      await catchAppException(
        service.reset('0987654321', '654321', NEW_PASSWORD),
      );

      expect(verifySpy).toHaveBeenCalledTimes(1);
      const [hashArg, plainArg] = verifySpy.mock.calls[0];
      expect(plainArg).toBe('654321');
      expect(hashArg).toMatch(/^\$argon2id\$/);
    });

    it('MỌI nhánh sai trả CÙNG MỘT message (chống enumeration)', async () => {
      const messages: string[] = [];

      accounts.findByPhone.mockResolvedValueOnce(null);
      messages.push(
        (
          await catchAppException(
            service.reset('0987654321', '654321', NEW_PASSWORD),
          )
        ).message,
      );

      accounts.findByPhone.mockResolvedValueOnce(makeAccount(false));
      messages.push(
        (await catchAppException(service.reset(PHONE, '654321', NEW_PASSWORD)))
          .message,
      );

      accounts.findByPhone.mockResolvedValueOnce(makeAccount());
      codeRepo.findFirst.mockResolvedValueOnce(null);
      messages.push(
        (await catchAppException(service.reset(PHONE, '654321', NEW_PASSWORD)))
          .message,
      );

      accounts.findByPhone.mockResolvedValueOnce(makeAccount());
      codeRepo.findFirst.mockResolvedValueOnce(await liveCode('654321'));
      messages.push(
        (await catchAppException(service.reset(PHONE, '000000', NEW_PASSWORD)))
          .message,
      );

      accounts.findByPhone.mockResolvedValueOnce(makeAccount());
      codeRepo.findFirst.mockResolvedValueOnce(await liveCode('654321'));
      codeRepo.updateMany.mockResolvedValueOnce({ count: 0 });
      messages.push(
        (await catchAppException(service.reset(PHONE, '654321', NEW_PASSWORD)))
          .message,
      );

      expect(messages).toHaveLength(5);
      for (const message of messages) {
        expect(message).toBe(messages[0]);
      }
      // Message generic: không nhắc mã, mật khẩu, hay sự tồn tại của account.
      expect(messages[0]).not.toMatch(/passwordHash|654321|000000/);
    });
  });
});
