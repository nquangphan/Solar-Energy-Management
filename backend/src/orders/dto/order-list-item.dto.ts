import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ORDER_STATUS_KEYS } from '../domain/order-status';

/**
 * Một dòng của `GET /orders` — ĐỦ để vẽ danh sách, không hơn.
 *
 * KHÔNG có tổng tiền: cần join `OrderVersion` + chạy pricing (AD-10/AD-16) cho từng dòng, epic
 * không yêu cầu, và một con số tiền tính sai ở màn list là hồi quy TIỀN BẠC.
 * KHÔNG có `costPrice` hay bất cứ dữ liệu giá vốn nào (fence `costs.view`, AD-4).
 *
 * `customerName` lấy qua relation `customer` — `Order` KHÔNG có `customerId`, PK khách là SĐT
 * dạng E.164 (AD-9).
 */
export class OrderListItemDto {
  @ApiProperty({ example: '0b7f1f6e-1d7a-4c1e-9a4a-6a5e2f0c1b33' })
  id!: string;

  @ApiProperty({ enum: ORDER_STATUS_KEYS, example: ORDER_STATUS_KEYS[0] })
  status!: string;

  @ApiProperty({
    description: 'SĐT khách dạng E.164 (PK khách).',
    example: '+84903176968',
  })
  customerSdt!: string;

  @ApiProperty({
    description: 'Tên khách, đọc qua relation.',
    example: 'Nguyễn Văn A',
  })
  customerName!: string;

  @ApiProperty({ description: 'Người tạo/sở hữu đơn.' })
  ownerAccountId!: string;

  @ApiPropertyOptional({
    description: 'Người được giao chăm đơn; null nếu chưa giao.',
    nullable: true,
  })
  assigneeAccountId!: string | null;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  createdAt!: Date;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  updatedAt!: Date;
}
