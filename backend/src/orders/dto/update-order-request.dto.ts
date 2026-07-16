import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { IsOptionalNotNull } from '../../catalog/dto/is-optional-not-null.decorator';

/**
 * Body của `PATCH /orders/:id` — partial VIẾT TAY, CẤM `PartialType` (nó auto-gắn
 * `@IsOptional` không gỡ được — `{"scopeThiCong": null}` sẽ lọt xuống cột NOT NULL).
 *
 * CHỈ 2 cờ toggle được (Story 4.3): `scopeThietBi` KHÔNG có ở đây — luôn `true` với mọi đơn
 * (EXPERIENCE.md: mọi đơn có vật tư); client gửi kèm sẽ bị `whitelist: true` strip im lặng
 * nên không có đường ghi nào chạm tới nó. Field 4.4 (kWp/vatMode) chưa mở — story đó tự mở
 * rộng DTO này.
 */
export class UpdateOrderRequestDto {
  @ApiPropertyOptional({
    description: 'Cờ phạm vi Thi công — chỉ đổi được khi đơn còn ở baogia.',
  })
  @IsOptionalNotNull()
  @IsBoolean()
  scopeThiCong?: boolean;

  @ApiPropertyOptional({
    description: 'Cờ phạm vi Vận chuyển — chỉ đổi được khi đơn còn ở baogia.',
  })
  @IsOptionalNotNull()
  @IsBoolean()
  scopeVanChuyen?: boolean;
}
