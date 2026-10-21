import { ApiProperty } from '@nestjs/swagger';
import { MOC_TU_DONG } from '../../orders/domain/auto-transition-map';

/** One resolved installment. */
export class InstallmentResponseDto {
  @ApiProperty({ description: 'Thứ tự đợt, bắt đầu từ 1.', example: 1 })
  seq!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Phần trăm người dùng nhập; null nếu đợt nhập theo số tiền.',
    example: 20,
  })
  percent!: number | null;

  @ApiProperty({
    description: 'Số tiền của đợt — số nguyên đồng, server phân giải lúc lưu.',
    example: 16_602_192,
  })
  amount!: number;

  @ApiProperty({ example: 'Cọc khi ký hợp đồng' })
  conditionNote!: string;

  @ApiProperty({
    enum: Object.values(MOC_TU_DONG),
    nullable: true,
    description:
      'Mốc tự động do server gán theo vị trí: đợt 1 = coc, đợt cuối (khi ≥ 2 đợt) = tat_toan, còn lại null.',
  })
  milestone!: string | null;
}
