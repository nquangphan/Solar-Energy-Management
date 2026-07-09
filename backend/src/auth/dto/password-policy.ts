import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';

/**
 * Chính sách mật khẩu — hợp đồng UX đã chốt (in trên mockup: *"Tối thiểu 8 ký tự, có chữ
 * và số"*). Khai MỘT lần, dùng cho `newPassword` ở cả `ResetPasswordRequestDto` lẫn
 * `ChangePasswordRequestDto`: hai bản sao sẽ trôi khỏi nhau, và người dùng sẽ thấy hai
 * thông báo khác nhau cho cùng một luật.
 *
 * Ghi nợ có chủ ý: NIST SP 800-63B Rev 4 (7/2025) khuyến nghị **bỏ** composition rule kiểu
 * "phải có chữ và số", thay bằng độ dài tối thiểu lớn hơn + blocklist mật khẩu đã lộ. Ta
 * giữ nguyên rule vì nó là hợp đồng UX hiện hành — đảo quyết định đó là việc của chủ dự án.
 */

/** Độ dài tối thiểu (hợp đồng UX). */
export const PASSWORD_MIN_LENGTH = 8;

/** Ít nhất một chữ cái VÀ một chữ số, ở bất kỳ vị trí nào. */
export const PASSWORD_LETTER_AND_DIGIT = /(?=.*[A-Za-z])(?=.*\d)/;

/** Một message duy nhất cho cả hai ràng buộc — người dùng thấy đúng một luật, không hai. */
export const PASSWORD_POLICY_MESSAGE =
  'Mật khẩu tối thiểu 8 ký tự, có chữ và số.';

/**
 * Áp chính sách mật khẩu cho một field DTO. `ValidationPipe` (2.2) biến vi phạm thành
 * `400 VALIDATION_ERROR` + `fieldErrors` — FE map theo `fieldErrors[].code` (tên
 * constraint: `minLength`/`matches`), KHÔNG theo message.
 */
export function IsPasswordPolicy(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_POLICY_MESSAGE }),
    Matches(PASSWORD_LETTER_AND_DIGIT, { message: PASSWORD_POLICY_MESSAGE }),
  );
}
