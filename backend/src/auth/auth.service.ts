import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { AccountsService } from '../accounts/accounts.service';
import { EventBus } from '../events/event-bus';
import { PasswordService } from './password.service';
import { accountPhoneOrThrow } from './account-phone';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { PasswordChanged } from './domain/password-events';

/**
 * Message DUY NHẤT cho MỌI nhánh auth-fail (SĐT lạ / account inactive / sai mật khẩu
 * / refresh sai-hết hạn-đã thu hồi). Cùng mã `UNAUTHENTICATED` + cùng message → chống
 * user-enumeration (an toàn > tiện, AD-5). KHÔNG dựng envelope ở đây — chỉ ném
 * `AppException`; `AllExceptionsFilter` dựng envelope + gắn traceId.
 */
const AUTH_FAILED_MESSAGE = 'Thông tin đăng nhập không đúng';

/**
 * Xác thực: login (phát access JWT + refresh opaque), refresh (rotate + revoke phiên
 * cũ), logout (revoke phiên, idempotent), changePassword (self-service). AD-12: session
 * thu hồi được ⇒ refresh token lưu HASH server-side ở `sessions`.
 *
 * Inject `EventBus` — PORT DUY NHẤT phát domain event (AD-18). Hệ quả nghiệp vụ (audit,
 * notification) đến qua consumer tự đăng ký; service này KHÔNG biết consumer nào tồn tại.
 *
 * Thiết kế token (xem CONVENTIONS.md#Auth):
 *  - Access = **JWT** ký `JWT_ACCESS_SECRET`, TTL ngắn, stateless (guard 2.5 verify).
 *  - Refresh = **opaque random** (không JWT), lưu **SHA-256 tất định** ở
 *    `sessions.refreshTokenHash` để tra + thu hồi. KHÔNG guard access-token ở đây (2.5).
 */
@Injectable()
export class AuthService {
  /**
   * Hash argon2id của một chuỗi ngẫu nhiên, tính MỘT lần lúc khởi tạo. Khi SĐT
   * không tồn tại, login vẫn verify với hash này để cân bằng thời gian phản hồi
   * (giảm lệch timing giúp dò SĐT tồn tại hay không). Không bao giờ khớp mật khẩu thật.
   */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly accounts: AccountsService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {
    this.dummyHash = this.passwords.hash(randomBytes(16).toString('hex'));
  }

  /**
   * Đăng nhập: creds đúng → phát access JWT + refresh token (tạo `Session`). Mọi nhánh
   * sai (account không tồn tại / `isActive=false` / sai mật khẩu) → cùng
   * `AppException(UNAUTHENTICATED)` + cùng message (chống enumeration).
   *
   * `phone` is raw as typed; a malformed number is a 400 before any lookup. An account
   * without a phone yet simply is not found ⇒ the same 401.
   */
  async login(phone: string, password: string): Promise<AuthTokensDto> {
    const account = await this.accounts.findByPhone(accountPhoneOrThrow(phone));
    // Verify LUÔN — kể cả khi account không tồn tại (dùng dummy hash) — để thời gian
    // phản hồi đồng đều giữa "SĐT lạ" và "sai mật khẩu".
    const passwordOk = await this.passwords.verify(
      account?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!account || !account.isActive || !passwordOk) {
      throw new AppException(
        ErrorCode.UNAUTHENTICATED,
        401,
        AUTH_FAILED_MESSAGE,
      );
    }
    return this.issueTokens(account.id);
  }

  /**
   * Làm mới: refresh token hợp lệ (chưa thu hồi + chưa hết hạn) → **rotate** (thu hồi
   * phiên cũ + phát phiên mới) + access JWT mới. Sai / hết hạn / đã thu hồi →
   * `AppException(UNAUTHENTICATED)`.
   */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
    });
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new AppException(
        ErrorCode.UNAUTHENTICATED,
        401,
        AUTH_FAILED_MESSAGE,
      );
    }
    // Rotate ATOMIC: revoke có điều kiện `revokedAt: null` là CỔNG tất định — không tách
    // "kiểm rồi ghi". Hai request đồng thời cùng một refresh token: chỉ request lật được
    // `revokedAt` (khoá dòng DB ⇒ đúng MỘT thắng, `count === 1`) mới phát phiên mới; kẻ
    // thua (`count === 0`, token đã bị tiêu) bị từ chối → single-use thật sự, chống replay.
    const revoked = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) {
      throw new AppException(
        ErrorCode.UNAUTHENTICATED,
        401,
        AUTH_FAILED_MESSAGE,
      );
    }
    // Re-check the account still exists and is active — a deactivated account must
    // not keep rotating refresh tokens (the per-request guard blocks its access
    // tokens, but refresh should not churn sessions for a disabled account).
    const account = await this.accounts.findById(session.accountId);
    if (!account || !account.isActive) {
      throw new AppException(
        ErrorCode.UNAUTHENTICATED,
        401,
        AUTH_FAILED_MESSAGE,
      );
    }
    return this.issueTokens(session.accountId);
  }

  /**
   * Đăng xuất: thu hồi phiên khớp refresh token NẾU đang hoạt động. Idempotent + trung
   * tính — không lỗi nếu token không tồn tại/đã thu hồi (KHÔNG tiết lộ token có tồn tại).
   */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Tự đổi mật khẩu (self-service, cần phiên hợp lệ). Bắt buộc verify mật khẩu HIỆN TẠI —
   * một phiên bị chiếm KHÔNG được phép tự đổi mật khẩu (OWASP). Mật khẩu mới trùng mật
   * khẩu cũ bị từ chối. Ghi hash mới + **thu hồi mọi phiên** trong CÙNG một transaction:
   * nếu chỉ ghi được một nửa, kẻ đang giữ phiên bị chiếm vẫn truy cập được — đúng thứ mà
   * "thu hồi mọi phiên" sinh ra để chặn. Publish `PasswordChanged` SAU khi commit; audit
   * đến qua `AuditSubscriber` (AD-18) — service này KHÔNG ghi audit trực tiếp.
   */
  async changePassword(
    accountId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const account = await this.accounts.findById(accountId);
    // Verify LUÔN (dummy hash khi account vắng) — cân bằng thời gian phản hồi.
    const currentOk = await this.passwords.verify(
      account?.passwordHash ?? (await this.dummyHash),
      currentPassword,
    );
    if (!account || !currentOk) {
      throw new AppException(
        ErrorCode.UNAUTHENTICATED,
        401,
        'Mật khẩu hiện tại không đúng',
      );
    }
    if (newPassword === currentPassword) {
      throw new AppException(
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
      );
    }

    const newPasswordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await this.accounts.updatePasswordHash(account.id, newPasswordHash, tx);
      await tx.session.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Consume any live reset code: after the user knows their password, an
      // outstanding code must not still be usable to change it again.
      await tx.passwordResetCode.updateMany({
        where: { accountId: account.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    });

    // Publish SAU khi commit: đổi mật khẩu KHÔNG được rollback vì audit ghi lỗi
    // (`InProcessEventBus` cô lập + log lỗi consumer).
    await this.eventBus.publish(new PasswordChanged(account.id, new Date()));
  }

  /** Ký access JWT + sinh refresh opaque + lưu phiên (băm refresh). */
  private async issueTokens(accountId: string): Promise<AuthTokensDto> {
    const accessToken = await this.jwt.signAsync(
      { sub: accountId },
      { expiresIn: this.config.accessTokenTtlSeconds },
    );
    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        accountId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.config.refreshTokenTtlMs),
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTokenTtlSeconds,
    };
  }
}

/**
 * Băm refresh token (opaque, entropy cao) bằng **SHA-256 tất định** để tra `sessions`
 * theo hash và thu hồi được. KHÔNG dùng argon2 cho refresh token: argon2 salt ngẫu
 * nhiên ⇒ không truy vấn theo hash; token ngẫu nhiên 256-bit không cần hàm băm chậm
 * (hàm chậm là để chống brute-force mật khẩu entropy thấp — đó là việc của argon2id ở
 * `PasswordService`). Token thô KHÔNG bao giờ lưu DB.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
