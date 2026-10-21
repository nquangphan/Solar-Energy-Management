import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateNested,
  type ValidationArguments,
} from 'class-validator';
import {
  DUPLICATE_PRODUCT,
  LOAI_PHIEU,
  type LoaiPhieu,
} from '../domain/gia-von';

/** Trần `qty` một dòng — giữ tích `onHand × costPrice` trong vùng số nguyên an toàn. */
export const QTY_TOI_DA = 1_000_000;
/** Trần giá vốn — Int32 của cột `cost_price`/`unit_cost`. */
export const DON_GIA_TOI_DA = 2_147_483_647;

/**
 * Loại phiếu của dòng cha, gắn vào từng dòng bằng KHOÁ SYMBOL: `whitelist` của `ValidationPipe`
 * chỉ duyệt key chuỗi nên không xoá nó, và `JSON.stringify`/Prisma không bao giờ thấy nó.
 * Cần vì luật `unitCost` phụ thuộc `type` của phiếu mà class-validator chỉ đưa dòng con.
 */
const LOAI_PHIEU_CUA_DONG = Symbol('loaiPhieuCuaDong');

type DongCoLoai = { [LOAI_PHIEU_CUA_DONG]?: unknown; unitCost?: unknown };

/**
 * `unitCost` theo loại phiếu: NHẬP ⇒ bắt buộc, số nguyên đồng `0..DON_GIA_TOI_DA`; XUẤT ⇒ phải
 * VẮNG MẶT (server tự snapshot giá vốn lúc xuất — client không được đặt giá vốn xuất).
 * `type` sai thì bỏ qua — lỗi đã báo ở field `type`.
 */
const DonGiaTheoLoaiPhieu = (): PropertyDecorator =>
  ValidateBy({
    name: 'unitCostTheoLoaiPhieu',
    validator: {
      validate: (value: unknown, args?: ValidationArguments): boolean => {
        const loai = (args?.object as DongCoLoai)[LOAI_PHIEU_CUA_DONG];
        if (loai === 'xuat') return value === undefined;
        if (loai === 'nhap') {
          return (
            Number.isInteger(value) &&
            (value as number) >= 0 &&
            (value as number) <= DON_GIA_TOI_DA
          );
        }
        return true;
      },
      defaultMessage: (args?: ValidationArguments): string =>
        (args?.object as DongCoLoai)[LOAI_PHIEU_CUA_DONG] === 'xuat'
          ? 'Phiếu xuất không nhận giá vốn — hệ thống tự lấy giá vốn hiện hành.'
          : `Phiếu nhập bắt buộc giá vốn / đv: số nguyên đồng từ 0 đến ${DON_GIA_TOI_DA}.`,
    },
  });

/** Một sản phẩm chỉ được xuất hiện MỘT dòng trong phiếu. */
const KhongLapSanPham = (): PropertyDecorator =>
  ValidateBy({
    name: DUPLICATE_PRODUCT,
    validator: {
      validate: (value: unknown): boolean => {
        if (!Array.isArray(value)) return true;
        const ids = value.map((l) => (l as { productId?: unknown })?.productId);
        return new Set(ids).size === ids.length;
      },
      defaultMessage: (): string =>
        'Mỗi sản phẩm chỉ được một dòng trong phiếu.',
    },
  });

export class StockVoucherLineRequestDto {
  @ApiProperty({ description: 'Sản phẩm (UUID).' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({
    description: `Số lượng — nguyên dương, tối đa ${QTY_TOI_DA}. Chiều cộng/trừ do \`type\` của phiếu quyết.`,
    example: 40,
  })
  @IsInt()
  @Min(1)
  @Max(QTY_TOI_DA)
  qty!: number;

  @ApiPropertyOptional({
    description:
      'Giá vốn / đv — số nguyên ĐỒNG. BẮT BUỘC khi phiếu nhập; phiếu xuất KHÔNG được gửi (server tự lấy giá vốn hiện hành).',
    example: 2_110_000,
  })
  @DonGiaTheoLoaiPhieu()
  unitCost?: number;
}

export class CreateStockVoucherRequestDto {
  @ApiProperty({
    enum: LOAI_PHIEU,
    description: 'nhap = nhập kho · xuat = xuất kho không gắn đơn.',
  })
  @IsIn(LOAI_PHIEU)
  type!: LoaiPhieu;

  @ApiPropertyOptional({
    description: 'Ghi chú (vd "Tồn đầu kỳ", lý do xuất). Tối đa 500 ký tự.',
    example: 'Tồn đầu kỳ',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({
    type: [StockVoucherLineRequestDto],
    description: 'Từ 1 đến 100 dòng; không lặp sản phẩm.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @KhongLapSanPham()
  @ValidateNested({ each: true })
  @Type(() => StockVoucherLineRequestDto)
  // Chạy SAU `@Type` (class-transformer áp transform tuỳ biến sau khi dựng instance) ⇒ gắn loại
  // phiếu vào từng dòng đã dựng.
  @Transform(({ value, obj }) => {
    if (Array.isArray(value)) {
      for (const dong of value) {
        if (dong !== null && typeof dong === 'object') {
          (dong as DongCoLoai)[LOAI_PHIEU_CUA_DONG] = (
            obj as { type?: unknown }
          ).type;
        }
      }
    }
    return value as unknown;
  })
  lines!: StockVoucherLineRequestDto[];
}
