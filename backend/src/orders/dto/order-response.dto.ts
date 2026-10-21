import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { OrderView } from '../orders.service';
import { OrderLineItemResponseDto } from './order-line-item-response.dto';

/**
 * Trạng thái chiết khấu của Đơn — approval MỚI NHẤT (Story 4.7, FR-18). Client cần nó để
 * render banner/nút mà KHÔNG thấy khái niệm version/approval-list. Sau từ chối, đơn
 * `baogia` vẫn mang `status: 'tu_choi'` + `resolveNote` cho banner lý do.
 */
export class OrderDiscountDto {
  @ApiProperty({ description: 'Mức chiết khấu đề xuất — integer đồng.' })
  amount!: number;

  @ApiProperty({
    description:
      "Trạng thái hồ sơ duyệt: 'cho_duyet' | 'dong_y' | 'tu_choi' (phân biệt với Order.status 'choduyet').",
    example: 'cho_duyet',
  })
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  requestNote!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Lý do duyệt / từ chối — null khi chưa resolve.',
  })
  resolveNote!: string | null;

  @ApiProperty({ description: 'Thời điểm gửi duyệt.' })
  requestedAt!: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  resolvedAt!: Date | null;
}

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
      "Trạng thái đơn — đơn mới luôn 'baogia'; mọi thay đổi đi qua applyTransition().",
    example: 'baogia',
  })
  status!: string;

  @ApiProperty({ description: 'SĐT khách (E.164) — FK về Customer.' })
  customerPhone!: string;

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
  scopeEquipment!: boolean;

  @ApiProperty({
    description: 'Phạm vi: thi công. Hành vi preset thuộc Story 4.3.',
  })
  scopeConstruction!: boolean;

  @ApiProperty({
    description: 'Phạm vi: vận chuyển. Hành vi preset thuộc Story 4.3.',
  })
  scopeDelivery!: boolean;

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

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Lý do huỷ đơn (Story 5.7) — null khi đơn chưa huỷ. KHÔNG rào theo quyền: ai xem được đơn thì xem được lý do huỷ của nó.',
  })
  cancelReason!: string | null;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description:
      'Thời điểm huỷ (ISO-8601 UTC) — CÙNG một giá trị với `occurredAt` của hàng audit huỷ. null khi đơn chưa huỷ.',
  })
  cancelledAt!: Date | null;

  @ApiProperty({
    type: [OrderLineItemResponseDto],
    description:
      'Dòng của BẢN HIỆU LỰC (qua currentVersionId), sắp theo displayOrder tăng dần. Rỗng = đơn mới tạo.',
  })
  lineItems!: OrderLineItemResponseDto[];

  @ApiPropertyOptional({
    type: OrderDiscountDto,
    nullable: true,
    description:
      'Trạng thái chiết khấu — approval MỚI NHẤT (Story 4.7); null = đơn chưa từng áp chiết khấu.',
  })
  discount!: OrderDiscountDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/**
 * Maps the service view (a Prisma `Order` row + resolved lines) to the contract. There is no
 * serializer in the app, so the returned object IS the JSON body: every property the class
 * declares is listed explicitly (no spread), so the column names (`customerSdt`,
 * `scopeThiCong`…) never leak into the response.
 */
export function toOrderResponseDto(view: OrderView): OrderResponseDto {
  return {
    id: view.id,
    status: view.status,
    customerPhone: view.customerSdt,
    currentVersionId: view.currentVersionId,
    ownerAccountId: view.ownerAccountId,
    assigneeAccountId: view.assigneeAccountId,
    sourceId: view.sourceId,
    custType: view.custType,
    scopeEquipment: view.scopeThietBi,
    scopeConstruction: view.scopeThiCong,
    scopeDelivery: view.scopeVanChuyen,
    kWp: view.kWp,
    vatMode: view.vatMode,
    validityNote: view.validityNote,
    cancelReason: view.cancelReason,
    cancelledAt: view.cancelledAt,
    lineItems: view.lineItems,
    discount: view.discount,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}
