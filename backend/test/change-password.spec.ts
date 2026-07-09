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
 * Unit `AuthService.changePassword` — HERMETIC (không cần Postgres), argon2 thật.
 *
 * Ba bất biến (OWASP Authentication Cheat Sheet): bắt buộc verify mật khẩu HIỆN TẠI (một
 * phiên bị chiếm không tự đổi được mật khẩu), từ chối mật khẩu mới trùng mật khẩu cũ, và
 * **thu hồi mọi phiên** sau khi đổi. Audit đi QUA `EventBus` — service KHÔNG gọi
 * `AuditService` trực tiếp (AD-18).
 */

const ACCOUNT_ID = 'acc-1';
const CURRENT_PASSWORD = 'MatKhauCu123';
const NEW_PASSWORD = 'MatKhauMoi456';

async function catchAppException(p: Promise<unknown>): Promise<AppException> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppException) return err;
    throw err;
  }
  throw new Error('Kỳ vọng AppException nhưng promise resolve');
}

describe('AuthService.changePassword (unit, hermetic)', () => {
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
  let txSessionRepo: { updateMany: jest.Mock };
  let txResetRepo: { updateMany: jest.Mock };
  let transaction: jest.Mock;
  let eventBus: { publish: jest.Mock; subscribe: jest.Mock };
  let passwords: PasswordService;
  let service: AuthService;

  beforeEach(async () => {
    accounts = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    };
    txSessionRepo = { updateMany: jest.fn().mockResolvedValue({ count: 3 }) };
    txResetRepo = { updateMany: jest.fn().mockResolvedValue({ count: 0 }) };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };
    passwords = new PasswordService();

    transaction = jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
      cb({ session: txSessionRepo, passwordResetCode: txResetRepo }),
    );

    const prisma = {
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: transaction,
    } as unknown as PrismaService;

    service = new AuthService(
      accounts as unknown as AccountsService,
      passwords,
      new JwtService({ secret: 'test-secret-toi-thieu-32-ky-tu-abcdefgh' }),
      prisma,
      eventBus as unknown as EventBus,
      config,
    );

    accounts.findById.mockResolvedValue({
      id: ACCOUNT_ID,
      email: 'user@example.com',
      passwordHash: await passwords.hash(CURRENT_PASSWORD),
      displayName: 'User',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('mật khẩu hiện tại đúng → đổi hash, thu hồi MỌI phiên, publish PasswordChanged', async () => {
    await expect(
      service.changePassword(ACCOUNT_ID, CURRENT_PASSWORD, NEW_PASSWORD),
    ).resolves.toBeUndefined();

    expect(accounts.updatePasswordHash).toHaveBeenCalledTimes(1);
    const [id, hash] = accounts.updatePasswordHash.mock.calls[0] as [
      string,
      string,
    ];
    expect(id).toBe(ACCOUNT_ID);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await passwords.verify(hash, NEW_PASSWORD)).toBe(true);

    const revoke = txSessionRepo.updateMany.mock.calls[0][0];
    expect(revoke.where.accountId).toBe(ACCOUNT_ID);
    expect(revoke.where.revokedAt).toBeNull();
    expect(revoke.data.revokedAt).toBeInstanceOf(Date);

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const event = eventBus.publish.mock.calls[0][0];
    expect(event.type).toBe('PasswordChanged');
    expect(event.actorAccountId).toBe(ACCOUNT_ID);
    // Bí mật KHÔNG bao giờ rời khỏi service qua event (AuditLog là bất biến vĩnh viễn).
    expect(JSON.stringify(event)).not.toContain(NEW_PASSWORD);
    expect(JSON.stringify(event)).not.toContain(CURRENT_PASSWORD);
  });

  it('sai mật khẩu hiện tại → 401, KHÔNG đổi hash, KHÔNG thu hồi phiên, KHÔNG publish', async () => {
    const err = await catchAppException(
      service.changePassword(ACCOUNT_ID, 'sai-mat-khau', NEW_PASSWORD),
    );

    expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    expect(err.getStatus()).toBe(401);
    expect(accounts.updatePasswordHash).not.toHaveBeenCalled();
    expect(txSessionRepo.updateMany).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('mật khẩu mới trùng mật khẩu cũ → 400 VALIDATION_ERROR + fieldErrors[newPassword]', async () => {
    const err = await catchAppException(
      service.changePassword(ACCOUNT_ID, CURRENT_PASSWORD, CURRENT_PASSWORD),
    );

    expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.getStatus()).toBe(400);
    expect(err.fieldErrors).toHaveLength(1);
    expect(err.fieldErrors?.[0].field).toBe('newPassword');
    expect(accounts.updatePasswordHash).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('account không tồn tại VẪN verify (dummy hash) — cân bằng timing', async () => {
    accounts.findById.mockResolvedValue(null);
    const verifySpy = jest.spyOn(passwords, 'verify');

    const err = await catchAppException(
      service.changePassword('khong-ton-tai', CURRENT_PASSWORD, NEW_PASSWORD),
    );

    expect(err.errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(verifySpy.mock.calls[0][0]).toMatch(/^\$argon2id\$/);
  });

  it('đổi hash và thu hồi phiên nguyên tử (cùng một transaction)', async () => {
    // Nửa vời là lỗ hổng thật: hash mới đã ghi nhưng phiên cũ còn sống ⇒ kẻ đang giữ phiên
    // bị chiếm vẫn truy cập được, đúng thứ "thu hồi mọi phiên" sinh ra để chặn.
    await service.changePassword(ACCOUNT_ID, CURRENT_PASSWORD, NEW_PASSWORD);

    expect(transaction).toHaveBeenCalledTimes(1);
    // Ghi account đi qua CÙNG tx client với revoke phiên.
    expect(accounts.updatePasswordHash.mock.calls[0][2]).toBeDefined();
    expect(txSessionRepo.updateMany).toHaveBeenCalledTimes(1);
  });

  it('tiêu thụ mọi mã reset còn sống trong cùng transaction (mã cũ không đổi được mật khẩu lần nữa)', async () => {
    await service.changePassword(ACCOUNT_ID, CURRENT_PASSWORD, NEW_PASSWORD);

    expect(txResetRepo.updateMany).toHaveBeenCalledTimes(1);
    const consume = txResetRepo.updateMany.mock.calls[0][0];
    expect(consume.where.accountId).toBe(ACCOUNT_ID);
    expect(consume.where.consumedAt).toBeNull();
    expect(consume.data.consumedAt).toBeInstanceOf(Date);
  });
});
