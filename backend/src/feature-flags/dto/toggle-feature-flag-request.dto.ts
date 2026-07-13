import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Body của `PATCH /feature-flags/:key` — bật/tắt một cờ.
 *
 * `@IsBoolean()` TRẦN, KHÔNG `@IsOptional()`: `enabled` là BẮT BUỘC. `@IsOptional()` tắt mọi
 * validator khi giá trị là `undefined` **hoặc `null`** ⇒ `{"enabled": null}` sẽ lọt xuống cột
 * NOT NULL và vỡ ở tầng DB thành 500, thay vì 400 kèm `fieldErrors` (lỗi HIGH của review 3.1
 * — đừng lặp lại).
 */
export class ToggleFeatureFlagRequestDto {
  @ApiProperty({ description: 'true = bật cờ, false = tắt cờ.' })
  @IsBoolean()
  enabled!: boolean;
}
