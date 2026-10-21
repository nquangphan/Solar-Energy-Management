import { ApiProperty } from '@nestjs/swagger';
import { PAYMENT_METHODS } from '../domain/payment';

/** One recorded payment. */
export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  installmentId!: string;

  @ApiProperty({
    description: 'Số tiền đã thu — số nguyên đồng.',
    example: 16_602_192,
  })
  amount!: number;

  @ApiProperty({ format: 'date', example: '2026-10-21' })
  paidOn!: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  method!: string;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Lúc ghi nhận (ISO-8601 UTC).',
  })
  recordedAt!: Date;
}
