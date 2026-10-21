import { ApiProperty } from '@nestjs/swagger';
import { CONTRACT_TYPES, type ContractType } from '../domain/contract-type';
import { ContractResponseDto } from './contract-response.dto';

/**
 * What the "Sinh hợp đồng" screen shows before generating: the dynamic fields the contract will
 * carry, whether the server would generate it, and the contracts already generated. Every value
 * is computed by the server; clients only display it.
 */
export class ContractsOverviewResponseDto {
  @ApiProperty({
    enum: CONTRACT_TYPES,
    description:
      'Loại hợp đồng server suy từ cờ phạm vi của đơn — không chọn tay.',
  })
  contractType!: ContractType;

  @ApiProperty({
    description:
      'true ⇒ POST sẽ sinh được; false ⇒ blockedReason nói vì sao (cùng message POST trả).',
  })
  generatable!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Lý do không sinh được (tiếng Việt), null khi generatable.',
  })
  blockedReason!: string | null;

  @ApiProperty({
    description: 'Số báo giá tham chiếu — trùng số in trên báo giá của đơn.',
    example: 'BG-3F2A9B1C',
  })
  quoteNo!: string;

  @ApiProperty({ description: 'Số thứ tự bản đơn hiệu lực.', example: 1 })
  versionNo!: number;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({ description: 'Số dòng vật tư của bản hiệu lực.', example: 4 })
  lineCount!: number;

  @ApiProperty({
    description: 'Tổng đơn sau VAT in vào hợp đồng — số nguyên đồng.',
    example: 83_010_960,
  })
  orderTotal!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Tóm tắt lịch thanh toán: "20/70/10" khi mọi đợt theo %, "N đợt" khi có đợt theo số tiền, null khi chưa có lịch.',
    example: '20/70/10',
  })
  scheduleLabel!: string | null;

  @ApiProperty({
    type: [String],
    description:
      'Nhãn các ô pháp nhân công ty chưa cấu hình (in "Chưa cấu hình" — không chặn sinh).',
  })
  missingPartyFields!: string[];

  @ApiProperty({
    type: [ContractResponseDto],
    description: 'Hợp đồng đã sinh của đơn, mới nhất trước.',
  })
  contracts!: ContractResponseDto[];
}
