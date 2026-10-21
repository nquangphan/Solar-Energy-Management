import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { tinhTonKho, type TonKho } from './domain/ton-kho';

export interface StockItemView extends TonKho {
  productId: string;
  ten: string;
  sku: string;
  donVi: string;
}

export interface CanMuaView {
  productId: string;
  ten: string;
  donVi: string;
  canNhap: number;
}

export interface StockList {
  items: StockItemView[];
  danhSachCanMua: CanMuaView[];
}

/**
 * `contains` của Prisma đổ thẳng chuỗi vào `ILIKE '%…%'` mà KHÔNG escape ký tự đại diện (đo trên
 * Postgres: `a_c` khớp "abc", `%` khớp mọi dòng) — SKU kiểu `INV_8K` sẽ kéo theo cả `INVX8K`.
 * Escape bằng `\`, ký tự escape mặc định của LIKE trên Postgres.
 */
function thoatLike(chuoi: string): string {
  return chuoi.replace(/[\\%_]/g, '\\$&');
}

/**
 * Đường ĐỌC tồn kho (FR-25, AD-19) — thuần đọc: không ghi, không event.
 *
 * `reserved` là `SUM(StockMovement.qty)` theo `stockItemId`, gom bằng MỘT `groupBy` cho cả tập
 * — không N+1, không kéo cả ledger về JS để cộng.
 *
 * The two reads (`onHand` and `reserved`) run in ONE array-form `REPEATABLE READ`
 * transaction ⇒ the same snapshot. Under READ COMMITTED each statement sees its own snapshot:
 * an order-bound stock issue committing between them (deducting `onHand` and releasing
 * `reserved` in one tx) would yield an available figure that never existed. Array form ⇒ the
 * `groupBy` cannot use the first query's result: it filters the ledger by the SAME product
 * condition through the `stockItem.product` relation.
 *
 * Tập sản phẩm = (theo dõi tồn VÀ đang bán) HOẶC còn số khác 0. Sản phẩm bị ẩn/đổi cờ mà vẫn
 * còn hàng thật hoặc còn bị hứa KHÔNG được biến khỏi màn — đó là hàng có thật phải xử lý.
 */
@Injectable()
export class StockItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async lietKeTonKho(query: {
    q?: string;
    productIds?: string[];
  }): Promise<StockList> {
    const dieuKien: Prisma.ProductWhereInput[] = [
      {
        OR: [
          { tracksStock: true, isActive: true },
          { stockItem: { isNot: null } },
        ],
      },
    ];
    if (query.q) {
      const q = thoatLike(query.q);
      dieuKien.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.productIds) {
      dieuKien.push({ id: { in: query.productIds } });
    }

    const [products, tong] = await this.prisma.$transaction(
      [
        this.prisma.product.findMany({
          where: { AND: dieuKien },
          include: { stockItem: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.stockMovement.groupBy({
          by: ['stockItemId'],
          where: { stockItem: { product: { AND: dieuKien } } },
          // Prisma's `groupBy` typing demands `orderBy` when not awaited directly.
          orderBy: { stockItemId: 'asc' },
          _sum: { qty: true },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const reservedTheoStockItem = new Map(
      tong.map((t) => [t.stockItemId, t._sum?.qty ?? 0]),
    );

    const items: StockItemView[] = [];
    for (const p of products) {
      const ton = tinhTonKho({
        onHand: p.stockItem?.onHand ?? 0,
        reserved: p.stockItem
          ? (reservedTheoStockItem.get(p.stockItem.id) ?? 0)
          : 0,
      });
      const dangTheoDoi = p.tracksStock && p.isActive;
      if (!dangTheoDoi && ton.onHand === 0 && ton.reserved === 0) continue;
      items.push({
        productId: p.id,
        ten: p.name,
        sku: p.sku,
        donVi: p.unit,
        ...ton,
      });
    }

    // `items` đã theo tên (collation DB) và `sort` ổn định ⇒ hoà `canNhap` giữ thứ tự tên.
    const danhSachCanMua = items
      .filter((i) => i.canNhap > 0)
      .sort((a, b) => b.canNhap - a.canNhap)
      .map(({ productId, ten, donVi, canNhap }) => ({
        productId,
        ten,
        donVi,
        canNhap,
      }));

    return { items, danhSachCanMua };
  }
}
