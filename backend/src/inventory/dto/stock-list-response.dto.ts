import { ApiProperty } from '@nestjs/swagger';
import { TINH_TRANG_TON } from '../domain/ton-kho';
import type {
  CanMuaView,
  StockItemView,
  StockList,
} from '../stock-items.service';

/**
 * Response của `GET /stock-items` — chỉ để OpenAPI có schema thật (AD-12); service trả object
 * thường, controller dựng response qua `toStockListResponseDto`. Mọi con số do BACKEND tính
 * (`tinhTonKho`); client chỉ ghép chuỗi hiển thị.
 *
 * KHÔNG có giá vốn: payload này mở cho cả sale (`quotes.create_edit`) — thêm `costPrice` vào
 * đây là rò giá vốn cho người không có `costs.view`.
 */
export class StockItemViewDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'Tên sản phẩm.' })
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ description: 'Đơn vị tính.', example: 'tấm' })
  unit!: string;

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
  available!: number;

  @ApiProperty({
    description: 'Phần thiếu phải nhập (0 khi khả dụng không âm).',
    example: 15,
  })
  toPurchase!: number;

  @ApiProperty({
    enum: TINH_TRANG_TON,
    description:
      'du = còn khả dụng · het = khả dụng 0 · am = hứa vượt hàng thật.',
  })
  stockStatus!: string;
}

/** Một dòng của danh sách cần mua — gộp mọi sản phẩm khả dụng âm. */
export class PurchaseNeedViewDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: 'tấm' })
  unit!: string;

  @ApiProperty({ example: 15 })
  toPurchase!: number;
}

export class StockListResponseDto {
  @ApiProperty({
    type: [StockItemViewDto],
    description: 'Sắp theo tên sản phẩm.',
  })
  items!: StockItemViewDto[];

  @ApiProperty({
    type: [PurchaseNeedViewDto],
    description:
      'Các sản phẩm khả dụng âm của CÙNG tập `items`, sắp `toPurchase` giảm dần rồi theo tên.',
  })
  purchaseList!: PurchaseNeedViewDto[];
}

/** Maps one stock row of the service (domain names) to the contract — fields listed, no spread. */
export function toStockItemViewDto(item: StockItemView): StockItemViewDto {
  return {
    productId: item.productId,
    name: item.ten,
    sku: item.sku,
    unit: item.donVi,
    onHand: item.onHand,
    reserved: item.reserved,
    available: item.khaDung,
    toPurchase: item.canNhap,
    stockStatus: item.tinhTrang,
  };
}

export function toPurchaseNeedViewDto(need: CanMuaView): PurchaseNeedViewDto {
  return {
    productId: need.productId,
    name: need.ten,
    unit: need.donVi,
    toPurchase: need.canNhap,
  };
}

export function toStockListResponseDto(list: StockList): StockListResponseDto {
  return {
    items: list.items.map(toStockItemViewDto),
    purchaseList: list.danhSachCanMua.map(toPurchaseNeedViewDto),
  };
}
