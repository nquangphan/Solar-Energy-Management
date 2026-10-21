import { ApiProperty } from '@nestjs/swagger';
import { SU_KIEN } from '../../orders/domain/allowed-transition';

/** What happened to the automatic status transition a payment triggered. */
export class AutoTransitionResultDto {
  @ApiProperty({ enum: [SU_KIEN.duCoc, SU_KIEN.hoanThanh] })
  event!: string;

  @ApiProperty({
    enum: ['applied', 'already', 'skipped'],
    description:
      'applied = đơn đã chuyển; already = đơn đã ở đích; skipped = chuyển bị từ chối (tiền VẪN được ghi).',
  })
  outcome!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Lý do bị bỏ qua (khi skipped); null trong trường hợp khác.',
  })
  message!: string | null;
}
