import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape phản hồi của `GET /health`. Khai báo tường minh (@ApiProperty) để OpenAPI
 * có schema thật — làm mẫu contract-first (BE định nghĩa DTO trước, spec sinh từ code).
 */
export class HealthResponseDto {
  @ApiProperty({
    description: 'Trạng thái tổng thể của backend.',
    example: 'ok',
    enum: ['ok'],
  })
  status!: 'ok';

  @ApiProperty({
    description: 'Kết quả ping DB qua PrismaService (chứng minh wiring AD-1).',
    example: 'up',
    enum: ['up'],
  })
  database!: 'up';

  @ApiProperty({
    description: 'Thời điểm phản hồi, ISO-8601 UTC (client hiển thị UTC+7).',
    example: '2026-07-08T09:00:00.000Z',
    format: 'date-time',
  })
  timestamp!: string;
}
