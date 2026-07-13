import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response của mọi endpoint `/customers`. Chỉ để OpenAPI có schema thật (AD-12) — service trả
 * object thường, KHÔNG instantiate class này.
 *
 * `sdt` LUÔN là chuỗi đã chuẩn hoá E.164 — client gửi thô, nhận về chuẩn. Đây cũng chính là
 * khoá chính dùng ở `GET /customers/:sdt` và `PATCH /customers/:sdt`.
 */
export class CustomerResponseDto {
  @ApiProperty({
    description: 'SĐT đã chuẩn hoá E.164 — khoá chính của khách hàng.',
    example: '+84912345678',
  })
  sdt!: string;

  @ApiProperty({ description: 'Loại khách: CA_NHAN | THUONG_MAI.' })
  custType!: string;

  @ApiProperty({ description: 'Họ tên hoặc tên công ty.' })
  name!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'CCCD — chỉ khách Cá nhân; `null` với khách Thương mại.',
  })
  cccd!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Mã số thuế — chỉ khách Thương mại; `null` với khách Cá nhân.',
  })
  taxCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  address!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Tài khoản ngân hàng — chỉ khách Thương mại.',
  })
  bankAccount!: string | null;

  @ApiProperty({ description: 'Nguồn khách (id của CustomerSource).' })
  sourceId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Ghi chú nguồn — bắt buộc khi nguồn mang cờ `isOther`.',
  })
  sourceNote!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
