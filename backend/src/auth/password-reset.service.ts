import { randomBytes, randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { AccountsService } from '../accounts/accounts.service';
import { EventBus } from '../events/event-bus';
import { PasswordService } from './password.service';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import {
  PasswordResetCompleted,
  PasswordResetRequested,
} from './domain/password-events';

/**
 * Message DUY NHẤT cho MỌI nhánh reset-fail (email lạ / account inactive / không có mã
 * sống / mã sai / mã hết hạn / vượt trần số lần thử). Cùng mã `UNAUTHENTICATED` + cùng
 * message → không tiết lộ email nào tồn tại, mã nào còn sống (mirror `AUTH_FAILED_MESSAGE`
 * của login). KHÔNG dựng envelope ở đây — chỉ ném `AppException`; filter trung tâm dựng
 * envelope (AD-5).
 */
const RESET_FAILED_MESSAGE = 'Mã xác thực không hợp lệ hoặc đã hết hạn';

const MS_PER_SECOND = 1000;

/**
 * Đặt lại mật khẩu bằng mã 6 chữ số gửi ngoài băng tần.
 *
 * Mã chỉ có ~20 bit entropy, nên an toàn KHÔNG đến từ độ dài mã mà từ bộ kiểm soát bù trừ,
 * tất cả đều bắt buộc (OWASP Forgot Password Cheat Sheet):
 *  - **Lưu HASH argon2id**, không bao giờ lưu/trả/log mã thô. (SHA-256 sẽ vỡ tức thì nếu
 *    DB bị đọc: chỉ 10⁶ khả năng.)
 *  - **TTL ngắn** + **single-use** (`consumedAt` lật bằng cổng atomic có điều kiện).
 *  - **Trần số lần thử**, tăng ATOMIC *trước* khi verify — mirror cổng rotate refresh (2.3).
 *  - **Cooldown gửi lại** = vòng đời mã: còn mã sống thì không phát mã mới.
 *  - **Response trung tính + cân bằng timing** ở cả hai endpoint.
 *
 * Publish `PasswordResetRequested` qua `EventBus` port (AD-18) — **đây là seam gửi mã**.
 * Service này KHÔNG gửi email/SMS/push và KHÔNG ghi audit trực tiếp.
 */
@Injectable()
export class PasswordResetService {
  /**
   * Hash argon2id của một chuỗi ngẫu nhiên, tính MỘT lần lúc khởi tạo. Khi không tra ra
   * account/mã, `reset` vẫn verify với hash này để cân bằng thời gian phản hồi (mirror
   * `dummyHash` của `AuthService`). Không bao giờ khớp mã thật.
   */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly accounts: AccountsService,
    private readonly passwords: PasswordService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {
    this.dummyHash = this.passwords.hash(randomBytes(16).toString('hex'));
  }

  /**
   * Phát mã đặt lại. Trả **cùng một response** dù email tồn tại hay không, và tốn cùng
   * lượng công việc (luôn băm đúng một mã) — chống user-enumeration qua cả body lẫn timing.
   */
  async requestCode(email: string): Promise<{ expiresInSeconds: number }> {
    const expiresInSeconds = this.config.passwordResetTtlMs / MS_PER_SECOND;
    const account = await this.accounts.findByEmail(email);

    // Băm LUÔN — kể cả khi account không tồn tại/bị vô hiệu. argon2id là chi phí trội của
    // request này; bỏ nó ở nhánh "email lạ" làm response nhanh hơn hẳn → lộ email tồn tại.
    const code = generateCode();
    const codeHash = await this.passwords.hash(code);

    if (!account || !account.isActive) {
      return { expiresInSeconds };
    }

    // Cooldown = vòng đời mã: còn mã sống thì không phát mã mới (chống flood, và khớp
    // countdown "Gửi lại mã sau MM:SS" của UI mà không cần cột riêng).
    const live = await this.prisma.passwordResetCode.findFirst({
      where: {
        accountId: account.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (live) {
      return { expiresInSeconds };
    }

    await this.prisma.passwordResetCode.create({
      data: {
        accountId: account.id,
        codeHash,
        expiresAt: new Date(Date.now() + this.config.passwordResetTtlMs),
      },
    });

    // Seam gửi mã (AD-18): producer chỉ publish. Kênh gửi thật lắp vào consumer sau.
    await this.eventBus.publish(
      new PasswordResetRequested(account.id, new Date()),
    );
    return { expiresInSeconds };
  }

  /**
   * Tiêu thụ mã + đặt mật khẩu mới + **thu hồi mọi phiên**. Mọi nhánh sai ném cùng một
   * `AppException(UNAUTHENTICATED)` với cùng message.
   */
  async reset(email: string, code: string, newPassword: string): Promise<void> {
    const account = await this.accounts.findByEmail(email);
    // Tra mã theo `accountId`, KHÔNG theo hash: argon2 dùng salt ngẫu nhiên nên hash không
    // tra được, và hai account có thể cùng mã 6 số. (`Session.refreshTokenHash` unique được
    // vì token entropy cao + băm SHA-256 tất định — đừng bắt chước máy móc.)
    const row =
      account && account.isActive
        ? await this.prisma.passwordResetCode.findFirst({
            where: {
              accountId: account.id,
              consumedAt: null,
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;

    if (!account || !row) {
      // Verify giả để cân bằng timing với nhánh có mã thật.
      await this.passwords.verify(await this.dummyHash, code);
      throw this.resetFailed();
    }

    // Tăng attempt ATOMIC *trước* khi verify: điều kiện `attemptCount < max` là CỔNG tất
    // định (khoá dòng DB). Khi mã đã hết lượt thử, `count === 0` ⇒ mã khoá vĩnh viễn, kể
    // cả khi lần này nhập ĐÚNG. Tách "đọc rồi ghi" sẽ để lọt brute-force song song.
    const attempt = await this.prisma.passwordResetCode.updateMany({
      where: {
        id: row.id,
        consumedAt: null,
        attemptCount: { lt: this.config.passwordResetMaxAttempts },
      },
      data: { attemptCount: { increment: 1 } },
    });
    if (attempt.count === 0) {
      throw this.resetFailed();
    }

    if (!(await this.passwords.verify(row.codeHash, code))) {
      throw this.resetFailed();
    }

    const newPasswordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      // Single-use: chỉ request lật được `consumedAt` (count === 1) mới được đổi mật khẩu.
      // Hai request cùng mã đúng ⇒ đúng MỘT thắng, kẻ thua bị từ chối (chống replay).
      const consumed = await tx.passwordResetCode.updateMany({
        where: { id: row.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw this.resetFailed();
      }
      await this.accounts.updatePasswordHash(account.id, newPasswordHash, tx);
      // Thu hồi MỌI phiên còn hoạt động: người đặt lại mật khẩu có thể đang bị chiếm phiên.
      await tx.session.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    // Publish SAU khi commit: đổi mật khẩu KHÔNG được rollback vì audit ghi lỗi
    // (`InProcessEventBus` đã cô lập + log lỗi consumer).
    await this.eventBus.publish(
      new PasswordResetCompleted(account.id, new Date()),
    );
  }

  private resetFailed(): AppException {
    return new AppException(
      ErrorCode.UNAUTHENTICATED,
      401,
      RESET_FAILED_MESSAGE,
    );
  }
}

/**
 * Mã 6 chữ số từ CSPRNG. `randomInt` dùng **rejection sampling** ⇒ phân phối đều.
 * KHÔNG dùng `randomBytes(…) % 1_000_000`: phép chia dư làm lệch phân phối (modulo bias),
 * thu hẹp không gian đoán.
 */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}
