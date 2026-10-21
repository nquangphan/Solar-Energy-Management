import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { stockIssueLines } from './domain/stock-issue-lines';
import {
  quoteStockLine,
  type QuoteStockStatus,
} from './domain/stock-shortfall';
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

/** Early stock warning of one quoted product — no money, no cost. */
export interface OrderStockCheckLine {
  productId: string;
  name: string;
  unit: string;
  /** Sum of the order's lines of this product. */
  qty: number;
  onHand: number;
  /** Promised to OTHER orders — what this order itself holds is excluded. */
  reserved: number;
  /** `onHand − reserved` — may be negative. */
  available: number;
  shortfall: number;
  status: QuoteStockStatus;
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

  /**
   * Early stock warning for an order's lines (quote screen). `orderLines` = every line of the
   * order's current version that has a `productId` — `orders/` reads the order (scope is its
   * job); products that do not track stock are dropped here, same-product lines merged, same
   * canonical order as the stock-out (`stockIssueLines`).
   *
   * `reserved` excludes what is held for THIS order (ledger `SUM` per order): once confirming
   * reserves stock, an order must not warn against its own reservation.
   *
   * One array-form `REPEATABLE READ` tx — `onHand`, the ledger total and the order's own share
   * come from the same snapshot (same reason as `lietKeTonKho`).
   */
  async checkOrderLines(
    orderId: string,
    orderLines: readonly { productId: string; qty: number }[],
  ): Promise<OrderStockCheckLine[]> {
    const ids = [...new Set(orderLines.map((l) => l.productId))];
    if (ids.length === 0) return [];

    const [products, totals, ownHeld] = await this.prisma.$transaction(
      [
        this.prisma.product.findMany({
          where: { id: { in: ids } },
          include: { stockItem: true },
        }),
        this.prisma.stockMovement.groupBy({
          by: ['stockItemId'],
          where: { stockItem: { productId: { in: ids } } },
          orderBy: { stockItemId: 'asc' },
          _sum: { qty: true },
        }),
        this.prisma.stockMovement.groupBy({
          by: ['stockItemId'],
          where: { orderId, stockItem: { productId: { in: ids } } },
          orderBy: { stockItemId: 'asc' },
          _sum: { qty: true },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const sumOf = (rows: typeof totals) =>
      new Map(rows.map((r) => [r.stockItemId, r._sum?.qty ?? 0]));
    const totalByStockItem = sumOf(totals);
    const ownByStockItem = sumOf(ownHeld);
    const byId = new Map(products.map((p) => [p.id, p]));

    return stockIssueLines(
      orderLines,
      new Map(
        products.map((p) => [
          p.id,
          { name: p.name, tracksStock: p.tracksStock },
        ]),
      ),
    ).map((line) => {
      const p = byId.get(line.productId)!;
      const stockItemId = p.stockItem?.id;
      const onHand = p.stockItem?.onHand ?? 0;
      const reserved =
        stockItemId === undefined
          ? 0
          : (totalByStockItem.get(stockItemId) ?? 0) -
            (ownByStockItem.get(stockItemId) ?? 0);
      return {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        qty: line.qty,
        onHand,
        reserved,
        ...quoteStockLine({ qty: line.qty, onHand, reserved }),
      };
    });
  }
}
