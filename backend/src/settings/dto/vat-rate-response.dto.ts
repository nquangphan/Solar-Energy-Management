import { ApiProperty } from '@nestjs/swagger';

/**
 * Response của `GET/PATCH /settings/vat-rate`. Chỉ để OpenAPI có schema thật (AD-12) —
 * service trả object thường, KHÔNG instantiate class này.
 */
export class VatRateResponseDto {
  @ApiProperty({
    description:
      'Thuế suất VAT (%) hiệu lực — Int 0..100. Hệ thống chưa cấu hình ⇒ 8 (default từ registry, không cần seed).',
  })
  ratePercent!: number;
}
