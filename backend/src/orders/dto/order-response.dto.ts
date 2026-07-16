import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderLineItemResponseDto } from './order-line-item-response.dto';

/**
 * Response của `POST /orders` và `GET /orders/:id`. Dòng LUÔN phân giải qua
 * `currentVersionId` (AD-6) — response phẳng hoá chúng vào `lineItems`, client không cần
 * biết tới khái niệm version ở story này.
 *
 * KHÔNG có subtotal/VAT/tổng đơn: tính tổng là Story 4.2 (`POST /orders/preview-total`).
 * Khu tổng tiền trên màn render "—" placeholder tới lúc đó.
 */
export class OrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description:
      "Trạng thái đơn — 4.1 luôn 'baogia'; mọi thay đổi thuộc applyTransition() (Story 5.1).",
    example: 'baogia',
  })
  status!: string;

  @ApiProperty({ description: 'SĐT khách (E.164) — FK về Customer.' })
  customerSdt!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Con trỏ bản hiệu lực (AD-6) — luôn có sau khi tạo xong.',
  })
  currentVersionId!: string | null;

  @ApiProperty({ description: 'Người tạo/phụ trách (AD-15) — actor lúc tạo.' })
  ownerAccountId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  assigneeAccountId!: string | null;

  @ApiProperty({
    description:
      'SNAPSHOT nguồn khách LÚC TẠO đơn (FR-35) — copy từ Customer.sourceId, không đổi theo khách.',
  })
  sourceId!: string;

  @ApiProperty({
    description: 'Loại khách — nhãn báo cáo, copy từ Customer lúc tạo.',
  })
  custType!: string;

  @ApiProperty({
    description: 'Phạm vi: thiết bị. Hành vi preset thuộc Story 4.3.',
  })
  scopeThietBi!: boolean;

  @ApiProperty({
    description: 'Phạm vi: thi công. Hành vi preset thuộc Story 4.3.',
  })
  scopeThiCong!: boolean;

  @ApiProperty({
    description: 'Phạm vi: vận chuyển. Hành vi preset thuộc Story 4.3.',
  })
  scopeVanChuyen!: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Công suất hệ (kWp) — Float tối đa 2 chữ số lẻ (vd 8.82), nhập qua PATCH (Story 4.4). null = chưa nhập.',
  })
  kWp!: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Tick áp VAT: 'co_vat' | 'khong_vat' — đơn mới luôn 'co_vat'; null chỉ ở đơn tạo trước 4.4 (tính như có VAT).",
  })
  vatMode!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Hạn hiệu lực báo giá — chuỗi tự do ≤ 200 ký tự, Phase 1 chỉ hiển thị (Story 4.4). null = chưa nhập.',
  })
  validityNote!: string | null;

  @ApiProperty({
    type: [OrderLineItemResponseDto],
    description:
      'Dòng của BẢN HIỆU LỰC (qua currentVersionId), sắp theo displayOrder tăng dần. Rỗng = đơn mới tạo.',
  })
  lineItems!: OrderLineItemResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
