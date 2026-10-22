import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AccountsService } from '../accounts/accounts.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { RequestWithAccount } from './current-account.decorator';

/**
 * Message TRUNG TÍNH cho MỌI nhánh 401 (thiếu token / sai định dạng / verify lỗi /
 * account không tồn tại / inactive). KHÔNG tiết lộ "token hết hạn" vs "account inactive"
 * → chống enumeration (đối xứng `AuthService` 2.3). Guard chỉ ném `AppException`;
 * `AllExceptionsFilter` dựng envelope + traceId (AD-5).
 */
const UNAUTHENTICATED_MESSAGE = 'Chưa xác thực';

/**
 * Guard toàn cục #1 (fail-closed): verify access JWT MỖI request → resolve account →
 * gắn danh tính vào `request.account`. Đối xứng với `AuthService` ký `{ sub: accountId }`
 * bằng cùng `JWT_ACCESS_SECRET` (2.3): guard `verifyAsync` cùng secret qua `JwtService`
 * đã cấu hình ở `AuthModule` — KHÔNG tự đọc `process.env` cho secret (AD-12).
 *
 * `@Public()` → bỏ qua. Thiếu/sai Bearer, verify lỗi, account null hoặc `isActive=false`
 * → `AppException(UNAUTHENTICATED, 401)`. Kiểm `isActive` mỗi request ⇒ deactivate có
 * hiệu lực tức thì, không đợi hết TTL ("enforce mỗi request", AD-4/NFR-7). Đọc account
 * QUA `AccountsService` (AD-1), KHÔNG chạm DB trực tiếp.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly accounts: AccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAccount>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new AppException(
        ErrorCode.UNAUTHENTICATED,
        401,
        UNAUTHENTICATED_MESSAGE,
      );
    }

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token);
    } catch {
      // Nuốt JsonWebTokenError/TokenExpiredError/NotBeforeError → envelope generic (KHÔNG
      // leak lý do verify ra filter → chống enumeration, giữ đối xứng 2.3).
      throw new AppException(
        ErrorCode.UNAUTHENTICATED,
        401,
        UNAUTHENTICATED_MESSAGE,
      );
    }

    const account = await this.accounts.findById(payload.sub);
    if (!account || !account.isActive) {
      throw new AppException(
        ErrorCode.UNAUTHENTICATED,
        401,
        UNAUTHENTICATED_MESSAGE,
      );
    }

    request.account = {
      id: account.id,
      email: account.email,
      phone: account.phone,
      displayName: account.displayName,
    };
    return true;
  }
}

/** Rút token từ header `Authorization: Bearer <jwt>`; `null` nếu thiếu/không phải Bearer. */
function extractBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
