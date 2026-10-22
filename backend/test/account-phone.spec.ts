import { accountPhoneOrThrow } from '../src/auth/account-phone';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/** The single 400 door for every auth identifier (login, forgot, reset). */
describe('accountPhoneOrThrow', () => {
  it.each([
    ['0912345678', '+84912345678'],
    ['0912 345 678', '+84912345678'],
    ['0912.345.678', '+84912345678'],
    ['+84912345678', '+84912345678'],
    ['84912345678', '+84912345678'],
    ['028 3822 1234', '+842838221234'],
  ])('normalizes %p to %p', (raw, e164) => {
    expect(accountPhoneOrThrow(raw)).toBe(e164);
  });

  it.each(['abc', '', '   ', '+12025550123', '0912'])(
    'rejects %p with a 400 that points at the phone field',
    (raw) => {
      let caught: unknown;
      try {
        accountPhoneOrThrow(raw);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(AppException);
      const err = caught as AppException;
      expect(err.getStatus()).toBe(400);
      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors).toEqual([
        expect.objectContaining({ field: 'phone', code: 'isPhoneNumber' }),
      ]);
    },
  );
});
