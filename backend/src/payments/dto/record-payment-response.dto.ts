import { ApiProperty } from '@nestjs/swagger';
import { AutoTransitionResultDto } from './auto-transition-result.dto';
import { PaymentResponseDto } from './payment-response.dto';
import { PaymentScheduleResponseDto } from './payment-schedule-response.dto';

/** Result of recording a payment — the same body on the first call and on a retry. */
export class RecordPaymentResponseDto {
  @ApiProperty({ type: PaymentResponseDto })
  payment!: PaymentResponseDto;

  @ApiProperty({
    type: PaymentScheduleResponseDto,
    description: 'Lịch thanh toán HIỆN TẠI sau lần ghi.',
  })
  schedule!: PaymentScheduleResponseDto;

  @ApiProperty({ description: 'Trạng thái đơn hiện tại.', example: 'dacoc' })
  orderStatus!: string;

  @ApiProperty({
    type: AutoTransitionResultDto,
    nullable: true,
    description:
      'null khi lần ghi này không làm đủ mốc nào, và luôn null khi gửi lại cùng khoá. Khi một lần ghi làm đủ cả cọc lẫn tất toán (đợt cọc trả sau cùng), đây là lần chuyển đã đổi trạng thái đơn, nếu không có thì là lần thử sau cùng.',
  })
  autoTransition!: AutoTransitionResultDto | null;
}
