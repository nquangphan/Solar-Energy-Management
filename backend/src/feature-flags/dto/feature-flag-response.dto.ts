import { ApiProperty } from '@nestjs/swagger';

/**
 * Response của mọi endpoint `/feature-flags`. Chỉ để OpenAPI có schema thật (AD-12) — service
 * trả object thường, KHÔNG instantiate class này.
 */
export class FeatureFlagResponseDto {
  @ApiProperty({
    description:
      'Tên cờ chính tắc (khoá chính). Chỉ những cờ trong registry mới tồn tại.',
  })
  key!: string;

  @ApiProperty({ description: 'Nhãn tiếng Việt để hiển thị.' })
  label!: string;

  @ApiProperty({
    description: 'Cờ chưa từng được bấm ⇒ false (mặc định TẮT, fail-closed).',
  })
  enabled!: boolean;
}
