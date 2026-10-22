import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ErrorCode } from '../errors/error-code';
import { AppException } from '../errors/app.exception';
import { FieldErrorDto } from '../errors/dto/field-error.dto';
import { INVALID_UUID_MESSAGE } from './uuid-param';

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
        result.push({
          field: path,
          code,
          message: toClientMessage(code, message, error.property),
        });
      }
    }
    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, path));
    }
  }
  return result;
}

/**
 * Vietnamese text for class-validator's built-in constraints. The defaults are English
 * ("nationalId must be shorter than or equal to 20 characters") and the screens show
 * `fieldErrors[].message` as-is under the input, so a default must never reach a client.
 * A message the DTO wrote itself (`{ message: '…' }`, custom decorators) is kept.
 * `limit` is the constraint's number, read from the default text (see `toClientMessage`).
 */
const BUILT_IN_MESSAGES: Readonly<Record<string, (limit: string) => string>> = {
  isNotEmpty: () => 'Không được để trống.',
  isString: () => 'Phải là chuỗi ký tự.',
  maxLength: (limit) => `Tối đa ${limit} ký tự.`,
  minLength: (limit) => `Tối thiểu ${limit} ký tự.`,
  matches: () => 'Sai định dạng.',
  isEmail: () => 'Email không hợp lệ.',
  isInt: () => 'Phải là số nguyên.',
  isNumber: () => 'Phải là số.',
  min: (limit) => `Không được nhỏ hơn ${limit}.`,
  max: (limit) => `Không được lớn hơn ${limit}.`,
  isBoolean: () => 'Phải là đúng hoặc sai.',
  isIn: () => 'Giá trị không nằm trong danh sách cho phép.',
  isUuid: () => INVALID_UUID_MESSAGE,
  isIso8601: () => 'Ngày giờ không hợp lệ.',
  isArray: () => 'Phải là danh sách.',
  arrayNotEmpty: () => 'Danh sách không được rỗng.',
  arrayMinSize: (limit) => `Cần ít nhất ${limit} phần tử.`,
  arrayMaxSize: (limit) => `Tối đa ${limit} phần tử.`,
  isObject: () => 'Phải là một đối tượng.',
  nestedValidation: () => 'Dữ liệu lồng bên trong không hợp lệ.',
};

/** Any other built-in constraint: still Vietnamese, never the English default. */
const FALLBACK_MESSAGE = 'Giá trị không hợp lệ.';

/**
 * class-validator writes every default message about the property itself
 * (`<property> must…`, `each value in <property> must…`, `nested property <property>…`);
 * a DTO-authored message never starts that way.
 */
function isBuiltInDefault(message: string, property: string): boolean {
  return (
    message.startsWith(`${property} `) ||
    message.startsWith(`each value in ${property} `) ||
    message.startsWith(`nested property ${property} `)
  );
}

/** The `fieldErrors[].message` a client sees for one failed constraint. */
export function toClientMessage(
  code: string,
  message: string,
  property: string,
): string {
  if (!isBuiltInDefault(message, property)) return message;
  const template = BUILT_IN_MESSAGES[code];
  if (!template) return FALLBACK_MESSAGE;
  // A default with a limit carries it as its last number ("… 20 characters", "… less than 1").
  const limit = /-?\d+(?:\.\d+)?(?=\D*$)/.exec(message)?.[0] ?? '';
  return template(limit);
}
