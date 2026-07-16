import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Một dòng báo giá trong response — service trả object thường, class chỉ để OpenAPI có schema
 * thật (AD-12). Field nullable khai `type` TƯỜNG MINH: union `string | null` sinh
 * `"type":"object"` hỏng codegen (bug đã sửa ở 3.6).
 *
 * `unitPrice` là đơn giá HIỆU LỰC: dòng catalog `priceEditable = false` là giá SỐNG tính lại
 * từ danh mục hiện hành mỗi lần đọc (FR-5/FR-14 — đơn chưa chốt luôn theo giá mới nhất); dòng
 * `priceEditable = true` và dòng tự do là giá đã lưu. `amount` = server tính (AD-16) — client
 * CHỈ hiển thị, CẤM tự nhân.
 */
export class OrderLineItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '`null` = dòng tự do; có giá trị = dòng trỏ Product danh mục.',
  })
  productId!: string | null;

  @ApiProperty({ description: 'Tên dòng — nhiều dòng được.' })
  name!: string;

  @ApiProperty({ example: 'tấm' })
  unit!: string;

  @ApiProperty()
  qty!: number;

  @ApiProperty({
    description:
      'Đơn giá HIỆU LỰC — số nguyên ĐỒNG (giá sống với dòng catalog không sửa giá).',
  })
  unitPrice!: number;

  @ApiProperty({
    description:
      'true = giá sửa được tại chỗ (dòng tự do, hoặc Product.priceEditable).',
  })
  priceEditable!: boolean;

  @ApiProperty({ description: 'Cờ "linh động/dự kiến" — chỉ hiển thị.' })
  isFlexible!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  note!: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Bảo hành (tháng), copy default từ Product — hành vi thuộc Story 4.9.',
  })
  warrantyMonths!: number | null;

  @ApiProperty({ description: 'Thứ tự hiển thị trong giỏ (server gán).' })
  displayOrder!: number;

  @ApiProperty({
    description: 'Thành tiền = unitPrice hiệu lực × qty — SERVER tính (AD-16).',
    example: 19_600_000,
  })
  amount!: number;
}
