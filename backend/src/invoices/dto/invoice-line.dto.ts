import { ApiProperty } from '@nestjs/swagger';

/** One line of the invoice snapshot, as copied at issue time. */
export class InvoiceLineDto {
  @ApiProperty({
    description: 'Thứ tự dòng trên hoá đơn (tăng dần).',
    example: 1,
  })
  displayOrder!: number;

  @ApiProperty({ example: 'Tấm pin AE 630W' })
  name!: string;

  @ApiProperty({ example: 'Tấm' })
  unit!: string;

  @ApiProperty({ description: 'Số lượng.', example: 14 })
  qty!: number;

  @ApiProperty({ description: 'Đơn giá — số nguyên đồng.', example: 2_583_000 })
  unitPrice!: number;

  @ApiProperty({
    description: 'Thành tiền — số nguyên đồng.',
    example: 36_162_000,
  })
  amount!: number;
}
