import { HttpException } from '@nestjs/common';
import { ErrorCode } from './error-code';
import { FieldErrorDto } from './dto/field-error.dto';

/**
 * Cách code nghiệp vụ (Application/Domain) **ném lỗi có mã** mà KHÔNG tự dựng envelope
 * (AD-5: chỉ `AllExceptionsFilter` dựng envelope). Story sau:
 *
 *   throw new AppException(ErrorCode.CONFLICT, 409, 'SĐT đã tồn tại');
 *
 * Filter đọc `errorCode`/`fieldErrors`/`getStatus()` của exception này để dựng envelope.
 * Kế thừa `HttpException` để Nest giữ nguyên HTTP status khi filter đọc `getStatus()`.
 */
export class AppException extends HttpException {
  constructor(
    /** Mã lỗi string (enum có tài liệu) đưa vào envelope. */
    readonly errorCode: ErrorCode,
    status: number,
    message: string,
    /** Lỗi cấp field (chỉ dùng cho VALIDATION_ERROR); vắng mặt với lỗi khác. */
    readonly fieldErrors?: FieldErrorDto[],
  ) {
    super(message, status);
  }
}
