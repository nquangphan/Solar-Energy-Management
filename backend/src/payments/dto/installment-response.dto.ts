import { ApiProperty } from '@nestjs/swagger';
import { MOC_TU_DONG } from '../../orders/domain/auto-transition-map';
import { PAYMENT_STATUS } from '../domain/payment';
import { PaymentResponseDto } from './payment-response.dto';

/** One resolved installment. */
export class InstallmentResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'id của đợt — gửi kèm khi ghi nhận thanh toán.',
  })
  id!: string;

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

  @ApiProperty({
    description: 'Đã thu cho đợt này — số nguyên đồng.',
    example: 0,
  })
  paidAmount!: number;

  @ApiProperty({
    description:
      'Còn phải thu của đợt (amount − paidAmount, không âm) — số nguyên đồng.',
    example: 16_602_192,
  })
  remainingAmount!: number;

  @ApiProperty({ enum: Object.values(PAYMENT_STATUS) })
  status!: string;

  @ApiProperty({
    type: [PaymentResponseDto],
    description:
      'Các khoản đã thu của đợt, theo ngày thu rồi lúc ghi tăng dần.',
  })
  payments!: PaymentResponseDto[];
}
