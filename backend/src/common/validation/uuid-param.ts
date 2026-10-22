import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/** One sentence for one rule: the same text the ValidationPipe shows for `isUuid` on a body field. */
export const INVALID_UUID_MESSAGE = 'Mã định danh không hợp lệ.';

/**
 * The only `ParseUUIDPipe` a controller may use for a path param. Nest's default answers
 * "Validation failed (uuid is expected)", and the web shows a 400 message as-is (an id typed in
 * the address bar). The factory only returns the exception; `AllExceptionsFilter` still builds
 * the envelope (AD-5) — a 400 maps to `VALIDATION_ERROR` with no `fieldErrors` (a path param is
 * not a body field).
 */
export const UUID_PARAM = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException(INVALID_UUID_MESSAGE),
});
