import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ErrorCode } from '../errors/error-code';
import { AppException } from '../errors/app.exception';
import { FieldErrorDto } from '../errors/dto/field-error.dto';

/**
 * ValidationPipe dùng CHUNG cho runtime (`main.ts` qua APP_PIPE) và mọi app-context test
 * → cùng một cấu hình, tránh lệch runtime↔test (mối lo Task 4). Giữ nguyên `whitelist` +
 * `transform` đã bật từ Story 2.1.
 *
 * `exceptionFactory` KHÔNG dựng envelope (giữ AD-5: chỉ filter dựng). Nó chỉ **đóng gói**
 * `ValidationError[]` của class-validator thành một `AppException(VALIDATION_ERROR)` mang
 * `fieldErrors` có cấu trúc; `AllExceptionsFilter` mới dựng envelope từ đó.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Dữ liệu không hợp lệ',
        flattenValidationErrors(errors),
      ),
  });
}

/**
 * Ép `ValidationError[]` (có thể lồng nhau qua `children`) thành danh sách phẳng
 * `FieldErrorDto`. `field` là đường dẫn có dấu chấm (vd `address.city`); `code` là
 * constraint key của class-validator (vd `isEmail`) — string ổn định để FE map.
 */
function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldErrorDto[] {
  const result: FieldErrorDto[] = [];
  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    if (error.constraints) {
      for (const [code, message] of Object.entries(error.constraints)) {
        result.push({ field: path, code, message });
      }
    }
    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, path));
    }
  }
  return result;
}
