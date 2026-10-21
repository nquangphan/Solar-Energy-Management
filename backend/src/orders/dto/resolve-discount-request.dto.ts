import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body của `POST /orders/:id/resolve-discount` (Story 4.7, FR-18). `reason` BẮT BUỘC khi
 * `approve = false` — luật liên-field đó sống ở service (400 fieldErrors `reason`), DTO chỉ
 * validate hình dạng; đồng ý thì optional (vẫn ghi vào `resolveNote` khi có).
 */
export class ResolveDiscountRequestDto {
  @ApiProperty({
    description:
      'true = đồng ý (đơn Ở NGUYÊN choduyet — được Chốt qua /confirm); false = từ chối (đơn về baogia).',
  })
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Lý do duyệt / từ chối — BẮT BUỘC khi từ chối (thiếu ⇒ 400), optional khi đồng ý; ghi Audit log.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}
