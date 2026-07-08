import { ApiProperty } from '@nestjs/swagger';

/**
 * Một lỗi cấp field (validation). Khai tường minh (@ApiProperty) để OpenAPI có schema
 * thật — FE gen type từ đây và map lỗi vào đúng field của form (AC-3). Mirror mẫu
 * `HealthResponseDto`.
 */
export class FieldErrorDto {
  @ApiProperty({
    description: 'Tên field bị lỗi (khớp property của DTO).',
    example: 'email',
  })
  field!: string;

  @ApiProperty({
    description:
      'Mã lỗi field (constraint key của class-validator, vd "isEmail"), string ổn định để FE map.',
    example: 'isEmail',
  })
  code!: string;

  @ApiProperty({
    description: 'Mô tả người đọc được, có thể đổi/đa ngôn ngữ.',
    example: 'email phải là địa chỉ email hợp lệ',
  })
  message!: string;
}
