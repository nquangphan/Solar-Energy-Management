import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LOAI_PHIEU } from '../domain/gia-von';
import type {
  StockVoucherDetail,
  StockVoucherLineView,
  StockVoucherSummary,
} from '../stock-vouchers.service';

/**
 * Response của `/stock-vouchers` — chỉ để OpenAPI có schema thật (AD-12); service trả object
 * thường, controller dựng response qua các hàm `to…Dto` cuối file. Mã phiếu, số dòng, tổng số lượng
 * do BACKEND tính; client chỉ hiển thị.
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
  code!: string;

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
  createdBy!: StockVoucherCreatorDto;

  @ApiProperty({ description: 'Số dòng sản phẩm.', example: 2 })
  lineCount!: number;

  @ApiProperty({
    description: 'Tổng số lượng các dòng (luôn dương).',
    example: 45,
  })
  totalQty!: number;
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
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ description: 'Đơn vị tính.', example: 'tấm' })
  unit!: string;

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
  code!: string;

  @ApiProperty({ description: 'Đơn (đã huỷ) của phiếu xuất gốc.' })
  orderId!: string;
}

export class StockVoucherReturnRefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Mã phiếu nhập trả.', example: 'PK-NT-0004' })
  code!: string;
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

/*
 * Service views keep their database-side names; these maps are the only place the contract
 * names are produced. There is no serializer in the app, so the returned object IS the JSON
 * body — every field is listed (no spread) and an absent optional key stays absent.
 */

export function toStockVoucherSummaryDto(
  voucher: StockVoucherSummary,
): StockVoucherSummaryDto {
  return {
    id: voucher.id,
    code: voucher.ma,
    type: voucher.type,
    ...(voucher.orderId !== undefined && { orderId: voucher.orderId }),
    ...(voucher.returnOfVoucherId !== undefined && {
      returnOfVoucherId: voucher.returnOfVoucherId,
    }),
    createdAt: voucher.createdAt,
    createdBy: {
      id: voucher.nguoiTao.id,
      displayName: voucher.nguoiTao.displayName,
    },
    lineCount: voucher.soDong,
    totalQty: voucher.tongSoLuong,
  };
}

/**
 * Call AFTER `anGiaVonDongPhieu`: a line whose `unitCost` key was removed for a caller
 * without `costs.view` keeps it removed here.
 */
export function toStockVoucherLineResponseDto(
  line: StockVoucherLineView,
): StockVoucherLineResponseDto {
  return {
    productId: line.productId,
    name: line.ten,
    sku: line.sku,
    unit: line.donVi,
    qty: line.qty,
    ...(line.unitCost !== undefined && { unitCost: line.unitCost }),
  };
}

export function toStockVoucherDetailDto(
  voucher: StockVoucherDetail,
): StockVoucherDetailDto {
  return {
    ...toStockVoucherSummaryDto(voucher),
    note: voucher.note,
    lines: voucher.lines.map(toStockVoucherLineResponseDto),
    ...(voucher.returnOf !== undefined && {
      returnOf: {
        id: voucher.returnOf.id,
        code: voucher.returnOf.ma,
        orderId: voucher.returnOf.orderId,
      },
    }),
    ...(voucher.returnVoucher !== undefined && {
      returnVoucher: {
        id: voucher.returnVoucher.id,
        code: voucher.returnVoucher.ma,
      },
    }),
    canReturn: voucher.canReturn,
  };
}

export function toStockVoucherListResponseDto(view: {
  items: StockVoucherSummary[];
}): StockVoucherListResponseDto {
  return { items: view.items.map(toStockVoucherSummaryDto) };
}
