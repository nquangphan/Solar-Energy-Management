import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsOptionalNotNull } from '../../catalog/dto/is-optional-not-null.decorator';
import { VAT_MODES } from '../domain/vat-mode';

/**
 * Body của `PATCH /orders/:id` — partial VIẾT TAY, CẤM `PartialType` (nó auto-gắn
 * `@IsOptional` không gỡ được — `{"scopeConstruction": null}` sẽ lọt xuống cột NOT NULL).
 *
 * Hai NHÓM field, mỗi nhóm một event audit riêng:
 *  - Cờ phạm vi (Story 4.3): `scopeConstruction`/`scopeDelivery` — `scopeEquipment` KHÔNG có ở
 *    đây, luôn `true` với mọi đơn (EXPERIENCE.md: mọi đơn có vật tư); client gửi kèm sẽ bị
 *    `whitelist: true` strip im lặng.
 *  - Metadata (Story 4.4): `vatMode`/`kWp`/`validityNote`. `kWp`/`validityNote` nullable ở
 *    DB — `null` là giá trị nghiệp vụ ("xoá") nên dùng `@IsOptional` (khuôn
 *    `UpdateLineItemRequestDto.note`), KHÔNG `@IsOptionalNotNull`; `vatMode` NOT-nullable
 *    về ngữ nghĩa (đơn mới luôn có tick) — null bị chặn.
 */
export class UpdateOrderRequestDto {
  @ApiPropertyOptional({
    description: 'Cờ phạm vi Thi công — chỉ đổi được khi đơn còn ở baogia.',
  })
  @IsOptionalNotNull()
  @IsBoolean()
  scopeConstruction?: boolean;

  @ApiPropertyOptional({
    description: 'Cờ phạm vi Vận chuyển — chỉ đổi được khi đơn còn ở baogia.',
  })
  @IsOptionalNotNull()
  @IsBoolean()
  scopeDelivery?: boolean;

  @ApiPropertyOptional({
    enum: [...VAT_MODES],
    description:
      "Tick áp VAT (FR-3): 'co_vat' | 'khong_vat' — chỉ đổi được khi đơn còn ở baogia (4.5 snapshot lúc Chốt).",
  })
  @IsOptionalNotNull()
  @IsIn(VAT_MODES)
  vatMode?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Công suất hệ (kWp) — số > 0, tối đa 2 chữ số lẻ (vd 8.82). Gửi null để xoá.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  kWp?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Hạn hiệu lực báo giá — chuỗi tự do ≤ 200 ký tự (vd "48h kể từ ngày lên PO"), Phase 1 chỉ hiển thị. Gửi null để xoá.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  validityNote?: string | null;
}
