import { ApiProperty } from '@nestjs/swagger';
import { FieldErrorDto } from './field-error.dto';

/**
 * HỢP ĐỒNG LỖI cross-repo (AD-5): mọi lỗi backend trả về **đúng một** shape này. FE
 * web/mobile gen type từ đây và handle ở MỘT chỗ (interceptor) — không bên nào tự bịa
 * field lỗi. `AllExceptionsFilter` là **nơi DUY NHẤT** dựng envelope này.
 *
 * DTO này KHÔNG được endpoint nào tham chiếu trực tiếp (lỗi là nhánh chung, không phải
 * response "thành công"); vì vậy nó được ép vào `components.schemas` qua `extraModels`
 * khi build OpenAPI document (xem `openapi-document.ts`) để FE luôn gen được type.
 */
export class ErrorEnvelopeDto {
  @ApiProperty({
    description:
      'Mã lỗi string từ enum có tài liệu (ErrorCode). FE map lỗi theo mã này, KHÔNG theo message.',
    example: 'VALIDATION_ERROR',
  })
  code!: string;

  @ApiProperty({
    description: 'Mô tả lỗi người đọc được (có thể đổi/đa ngôn ngữ).',
    example: 'Dữ liệu không hợp lệ',
  })
  message!: string;

  @ApiProperty({
    description:
      'Danh sách lỗi cấp field (chỉ có ở lỗi validation). Vắng mặt với lỗi không phải validation.',
    type: [FieldErrorDto],
    required: false,
  })
  fieldErrors?: FieldErrorDto[];

  @ApiProperty({
    description:
      'ID lần lỗi (UUID v4 hoặc x-request-id) — dùng để tra log server-side cùng sự cố.',
    example: '3f2b0c9e-8a1d-4e2f-9c7a-1b2c3d4e5f60',
  })
  traceId!: string;
}
