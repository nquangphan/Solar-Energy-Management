import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Danh tính tối thiểu `JwtAuthGuard` gắn vào request sau khi xác thực. CHỈ field an toàn
 * để dựng phiên UI — KHÔNG `passwordHash`/token/field nhạy cảm khác (chống leak).
 */
export interface AuthenticatedAccount {
  id: string;
  email: string;
  /** Sign-in phone (E.164); `null` for an account that has no number yet. */
  phone: string | null;
  displayName: string;
}

/** Request Express đã đi qua `JwtAuthGuard` — `account` có mặt khi không `@Public`. */
export interface RequestWithAccount extends Request {
  account?: AuthenticatedAccount;
}

/**
 * `@CurrentAccount()` — lấy danh tính (`{ id, email, phone, displayName }`) mà `JwtAuthGuard`
 * gắn vào `request.account`, để controller KHÔNG đọc `request` thô.
 */
export const CurrentAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAccount | undefined =>
    ctx.switchToHttp().getRequest<RequestWithAccount>().account,
);
