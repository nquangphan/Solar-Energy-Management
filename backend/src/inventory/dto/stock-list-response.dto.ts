import { ApiProperty } from '@nestjs/swagger';
import { TINH_TRANG_TON } from '../domain/ton-kho';

/**
 * Response của `GET /stock-items` — chỉ để OpenAPI có schema thật (AD-12); service trả object
 * thường. Mọi con số do BACKEND tính (`tinhTonKho`); client chỉ ghép chuỗi hiển thị.
 *
 * KHÔNG có giá vốn: payload này mở cho cả sale (`quotes.create_edit`) — thêm `costPrice` vào
 * đây là rò giá vốn cho người không có `costs.view`.
 */
export class StockItemViewDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'Tên sản phẩm.' })
  ten!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ description: 'Đơn vị tính.', example: 'tấm' })
  donVi!: string;

  @ApiProperty({ description: 'Tồn thật trong kho.', example: 5 })
  onHand!: number;

  @ApiProperty({
    description: 'Đã hứa cho đơn đã chốt — tổng ledger giữ chỗ.',
    example: 20,
  })
  reserved!: number;

  @ApiProperty({
    description: '`onHand − reserved` — CÓ THỂ ÂM.',
    example: -15,
  })
  khaDung!: number;

  @ApiProperty({
    description: 'Phần thiếu phải nhập (0 khi khả dụng không âm).',
    example: 15,
  })
  canNhap!: number;

  @ApiProperty({
    enum: TINH_TRANG_TON,
    description:
      'du = còn khả dụng · het = khả dụng 0 · am = hứa vượt hàng thật.',
  })
  tinhTrang!: string;
}

/** Một dòng của danh sách cần mua — gộp mọi sản phẩm khả dụng âm. */
export class CanMuaViewDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  ten!: string;

  @ApiProperty({ example: 'tấm' })
  donVi!: string;

  @ApiProperty({ example: 15 })
  canNhap!: number;
}

export class StockListResponseDto {
  @ApiProperty({
    type: [StockItemViewDto],
    description: 'Sắp theo tên sản phẩm.',
  })
  items!: StockItemViewDto[];

  @ApiProperty({
    type: [CanMuaViewDto],
    description:
      'Các sản phẩm khả dụng âm của CÙNG tập `items`, sắp `canNhap` giảm dần rồi theo tên.',
  })
  danhSachCanMua!: CanMuaViewDto[];
}
