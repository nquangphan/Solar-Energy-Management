import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Body của `PATCH /settings/vat-rate` — đổi thuế suất VAT hệ thống.
 *
 * Validator TRẦN, KHÔNG `@IsOptional()`: `ratePercent` là BẮT BUỘC. `@IsOptional()` tắt mọi
 * validator khi giá trị `undefined`/`null` ⇒ `{"ratePercent": null}` sẽ vỡ ở tầng dưới thành
 * 500 thay vì 400 kèm `fieldErrors` (bài học review 3.1).
 *
 * `@IsInt` (KHÔNG `@IsNumber`): 8.5% không phải thuế suất hợp lệ ở đây — ERD `vatRate` là Int.
 */
export class UpdateVatRateRequestDto {
  @ApiProperty({ description: 'Thuế suất VAT mới (%) — Int 0..100.' })
  @IsInt()
  @Min(0)
  @Max(100)
  ratePercent!: number;
}
