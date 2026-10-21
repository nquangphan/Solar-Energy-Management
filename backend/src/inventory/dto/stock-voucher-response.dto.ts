import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LOAI_PHIEU } from '../domain/gia-von';

/**
 * Response của `/stock-vouchers` — chỉ để OpenAPI có schema thật (AD-12); service trả object
 * thường. Mã phiếu, số dòng, tổng số lượng do BACKEND tính; client chỉ hiển thị.
 *
 * KHÔNG BAO GIỜ có `Product.costPrice`: giá vốn hiện hành xem ở danh mục (gate `costs.view`).
 */
export class StockVoucherCreatorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;
}

export class StockVoucherSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Mã phiếu hiển thị.', example: 'PK-N-0119' })
  ma!: string;

  @ApiProperty({ enum: LOAI_PHIEU })
  type!: string;

  @ApiPropertyOptional({
    description:
      'Đơn mà phiếu xuất này gắn vào (một Đơn — một phiếu xuất). CHỈ có mặt ở phiếu xuất gắn đơn; phiếu tự do ⇒ field vắng mặt hẳn (không phải null).',
  })
  orderId?: string;

  @ApiPropertyOptional({
    description:
      'Phiếu xuất gốc mà phiếu nhập trả này nhận hàng về. CHỈ có mặt ở phiếu nhập trả; phiếu khác ⇒ field vắng mặt hẳn.',
  })
  returnOfVoucherId?: string;

  @ApiProperty({ description: 'Thời điểm lưu phiếu (ISO-8601 UTC).' })
  createdAt!: Date;

  @ApiProperty({ type: StockVoucherCreatorDto })
  nguoiTao!: StockVoucherCreatorDto;

  @ApiProperty({ description: 'Số dòng sản phẩm.', example: 2 })
  soDong!: number;

  @ApiProperty({
    description: 'Tổng số lượng các dòng (luôn dương).',
    example: 45,
  })
  tongSoLuong!: number;
}

export class StockVoucherListResponseDto {
  @ApiProperty({
    type: [StockVoucherSummaryDto],
    description: 'Mới nhất trước; tối đa 100 phiếu.',
  })
  items!: StockVoucherSummaryDto[];
}

export class StockVoucherLineResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'Tên sản phẩm.' })
  ten!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ description: 'Đơn vị tính.', example: 'tấm' })
  donVi!: string;

  @ApiProperty({
    description: 'Số lượng (luôn dương; chiều theo `type`).',
    example: 40,
  })
  qty!: number;

  @ApiPropertyOptional({
    description:
      'Giá vốn / đv — số nguyên ĐỒNG. CHỈ có mặt khi caller mang quyền costs.view; thiếu quyền ⇒ field vắng mặt hẳn (không phải 0, không phải null).',
  })
  unitCost?: number;
}

export class StockVoucherReturnOfDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Mã phiếu xuất gốc.', example: 'PK-X-0096' })
  ma!: string;

  @ApiProperty({ description: 'Đơn (đã huỷ) của phiếu xuất gốc.' })
  orderId!: string;
}

export class StockVoucherReturnRefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Mã phiếu nhập trả.', example: 'PK-NT-0004' })
  ma!: string;
}

export class StockVoucherDetailDto extends StockVoucherSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: [StockVoucherLineResponseDto] })
  lines!: StockVoucherLineResponseDto[];

  @ApiPropertyOptional({
    type: StockVoucherReturnOfDto,
    description: 'CHỈ có mặt ở phiếu nhập trả: phiếu xuất gốc + đơn đã huỷ.',
  })
  returnOf?: StockVoucherReturnOfDto;

  @ApiPropertyOptional({
    type: StockVoucherReturnRefDto,
    description: 'CHỈ có mặt ở phiếu xuất gắn đơn đã có phiếu nhập trả.',
  })
  returnVoucher?: StockVoucherReturnRefDto;

  @ApiProperty({
    description:
      'true ⇔ phiếu xuất gắn đơn, đơn đã huỷ, chưa có phiếu nhập trả — backend tính, client không tự suy.',
  })
  canReturn!: boolean;
}
