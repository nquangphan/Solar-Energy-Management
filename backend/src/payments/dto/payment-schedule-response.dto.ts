import { ApiProperty } from '@nestjs/swagger';
import { PAYMENT_STATUS } from '../domain/payment';
import { InstallmentResponseDto } from './installment-response.dto';

/**
 * Payment schedule of an order. All totals are computed by the server against the order's
 * CURRENT after-VAT total on every read — clients display them and never add or subtract.
 */
export class PaymentScheduleResponseDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty({
    description: 'false ⇒ đơn chưa có lịch (installments rỗng).',
  })
  configured!: boolean;

  @ApiProperty({
    description:
      'Server quyết: đơn đã chốt, chưa đóng VÀ chưa có khoản thu nào thì được cấu hình lịch. Nút Sửa còn cần quyền payments.record.',
  })
  editable!: boolean;

  @ApiProperty({
    description: 'Tổng đơn sau VAT hiện tại — số nguyên đồng.',
    example: 83_010_960,
  })
  orderTotal!: number;

  @ApiProperty({
    description: 'Tổng các đợt — số nguyên đồng.',
    example: 83_010_960,
  })
  scheduledTotal!: number;

  @ApiProperty({
    description:
      'orderTotal − scheduledTotal — số nguyên đồng, có thể âm khi các đợt vượt tổng đơn.',
    example: 0,
  })
  difference!: number;

  @ApiProperty({
    description:
      'true khi tổng các đợt khớp tổng đơn sau VAT; false ⇒ hiện cảnh báo.',
  })
  totalMatches!: boolean;

  @ApiProperty({
    description: 'Tổng đã thu của đơn — số nguyên đồng.',
    example: 16_602_192,
  })
  paidTotal!: number;

  @ApiProperty({
    description:
      'orderTotal − paidTotal — số nguyên đồng, có thể âm khi thu vượt tổng đơn.',
    example: 66_408_768,
  })
  remainingTotal!: number;

  @ApiProperty({
    description:
      'Phần trăm đã thu trên tổng đơn, số nguyên làm tròn xuống; 0 khi tổng đơn bằng 0.',
    example: 20,
  })
  paidPercent!: number;

  @ApiProperty({
    enum: Object.values(PAYMENT_STATUS),
    description: 'paid khi đã thu đủ tổng đơn sau VAT.',
  })
  paymentStatus!: string;

  @ApiProperty({
    description:
      'Server quyết: trạng thái đơn cho phép ghi nhận thanh toán. Nút Ghi nhận còn cần quyền payments.record.',
  })
  recordable!: boolean;

  @ApiProperty({ type: [InstallmentResponseDto] })
  installments!: InstallmentResponseDto[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Lần lưu lịch gần nhất (ISO-8601 UTC); null khi chưa cấu hình.',
  })
  updatedAt!: Date | null;
}
