import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { normalizeVnPhone } from '../customers/domain/phone';

/**
 * Raw sign-in phone ⇒ E.164, or 400. The single door every auth identifier goes through
 * (login, forgot-password, reset-password), so `0912 345 678` and `+84912345678` look up
 * the same account. Reuses the customers' normalizer (AD-9) — never a second copy.
 *
 * A malformed number is rejected BEFORE any lookup: format is a property of the string,
 * not of the database, so the 400 reveals nothing about which accounts exist. The wording
 * matches `CustomersService.normalizeOrThrow` on purpose.
 *
 * Never returns `null`: callers look up by the returned string with `findUnique`, so an
 * account whose `phone` is still NULL can never match.
 */
export function accountPhoneOrThrow(raw: string): string {
  const phone = normalizeVnPhone(raw);
  if (phone === null) {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      400,
      'Số điện thoại không hợp lệ.',
      [
        {
          field: 'phone',
          code: 'isPhoneNumber',
          message:
            'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).',
        },
      ],
    );
  }
  return phone;
}
