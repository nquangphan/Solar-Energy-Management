import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import type { FieldErrorDto } from '../common/errors/dto/field-error.dto';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';
import {
  INSUFFICIENT_STOCK,
  PRODUCT_NOT_STOCKABLE,
  maPhieu,
  tinhGiaVonBinhQuan,
  type LoaiPhieu,
} from './domain/gia-von';
import { stockIssueLines } from './domain/stock-issue-lines';
import { StockOutBlocked } from './domain/stock-out-blocked-event';
import { issueShortfall } from './domain/stock-shortfall';
import {
  StockIssued,
  type StockIssuedLineSnapshot,
} from './domain/stock-issued-event';
import {
  StockVoucherCreated,
  type StockVoucherLineSnapshot,
} from './domain/stock-voucher-events';
import { InsufficientStockException } from './insufficient-stock.exception';

export interface StockVoucherSummary {
  id: string;
  ma: string;
  type: LoaiPhieu;
  /** Present only on an order-bound stock-out — a free-standing voucher omits the key. */
  orderId?: string;
  createdAt: Date;
  nguoiTao: { id: string; displayName: string };
  soDong: number;
  tongSoLuong: number;
}

export interface StockVoucherLineView {
  productId: string;
  ten: string;
  sku: string;
  donVi: string;
  qty: number;
  /** Luôn có ở tầng service — controller loại key khi caller thiếu `costs.view`. */
  unitCost?: number;
}

export interface StockVoucherDetail extends StockVoucherSummary {
  note: string | null;
  lines: StockVoucherLineView[];
}

export interface TaoPhieuInput {
  type: LoaiPhieu;
  note?: string;
  lines: { productId: string; qty: number; unitCost?: number }[];
}

export interface IssueForOrderInput {
  orderId: string;
  orderVersionId: string;
  /** EVERY line of the current version that has a `productId` — `tracksStock` is filtered here. */
  orderLines: readonly { productId: string; qty: number }[];
  actorAccountId: string;
  occurredAt: Date;
}

export interface IssueForOrderResult {
  /** `null` ⇒ the order has no stock-tracked line: nothing was written. */
  voucher: StockVoucherDetail | null;
  /** `productId → costPrice` (read under the lock) of exactly the products issued. */
  costByProduct: ReadonlyMap<string, number>;
  /** Not published — the caller publishes AFTER commit. */
  event: StockIssued | null;
}

/** One preview row of an order-bound stock-out — carries NO cost. */
export interface StockIssuePreviewLine {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  onHand: number;
  /** `qty` beyond `onHand` — the SAME rule as the check under the lock; a warning only. */
  shortfall: number;
}

/**
 * Stock check of a stock-out under the lock — shared by free-standing and order-bound
 * stock-outs. `lines[i]` maps to field `lines.{i}.qty`. `null` ⇒ every line is covered.
 */
function insufficientStockError(
  lines: readonly {
    productId: string;
    qty: number;
    onHand: number;
    unit: string;
  }[],
): InsufficientStockException | null {
  const shortages: { productId: string; qty: number; onHand: number }[] = [];
  const fieldErrors: FieldErrorDto[] = [];
  lines.forEach((line, i) => {
    if (issueShortfall(line.qty, line.onHand) === 0) return;
    shortages.push({
      productId: line.productId,
      qty: line.qty,
      onHand: line.onHand,
    });
    fieldErrors.push({
      field: `lines.${i}.qty`,
      code: INSUFFICIENT_STOCK,
      message: `Còn ${line.onHand} ${line.unit}, không xuất được ${line.qty}.`,
    });
  });
  return shortages.length === 0
    ? null
    : new InsufficientStockException(shortages, fieldErrors);
}

/** Trần danh sách phiếu — Phase 1 không phân trang (~20 user nội bộ, khối lượng thấp). */
const SO_PHIEU_TOI_DA = 100;

const CHI_TIET_INCLUDE = {
  createdBy: { select: { id: true, displayName: true } },
  lines: {
    include: { product: { select: { name: true, sku: true, unit: true } } },
    orderBy: { product: { name: 'asc' } },
  },
} satisfies Prisma.StockVoucherInclude;

type PhieuChiTietRow = Prisma.StockVoucherGetPayload<{
  include: typeof CHI_TIET_INCLUDE;
}>;

function tomTat(
  phieu: {
    id: string;
    seq: number;
    type: string;
    orderId?: string | null;
    createdAt: Date;
    createdBy: { id: string; displayName: string };
  },
  lines: readonly { qty: number }[],
): StockVoucherSummary {
  const type = phieu.type as LoaiPhieu;
  return {
    id: phieu.id,
    ma: maPhieu(type, phieu.seq),
    type,
    ...(phieu.orderId != null && { orderId: phieu.orderId }),
    createdAt: phieu.createdAt,
    nguoiTao: phieu.createdBy,
    soDong: lines.length,
    tongSoLuong: lines.reduce((tong, l) => tong + l.qty, 0),
  };
}

function chiTiet(phieu: PhieuChiTietRow): StockVoucherDetail {
  return {
    ...tomTat(phieu, phieu.lines),
    note: phieu.note,
    lines: phieu.lines.map((l) => ({
      productId: l.productId,
      ten: l.product.name,
      sku: l.product.sku,
      donVi: l.product.unit,
      qty: l.qty,
      unitCost: l.unitCost,
    })),
  };
}

/**
 * Phiếu kho nhập/xuất (FR-25) — đường GHI tồn kho duy nhất ở `inventory/` hiện nay.
 *
 * HỢP ĐỒNG KHOÁ (mọi đường ghi tồn sau này — xuất gắn đơn, giữ chỗ, nhập trả — PHẢI lấy CÙNG
 * khoá, CÙNG thứ tự; khoá một phía là vô nghĩa): lệnh ĐẦU TIÊN của transaction là
 * `SELECT id FROM products WHERE id = ANY(…) ORDER BY id FOR UPDATE`.
 *  - ORDER-BOUND paths (stock issue, later reservations): the `orders` row is locked FIRST
 *    (first op of the tx `OrdersService` opens), then `products`. Free-standing vouchers lock
 *    only `products`, order transitions only `orders` ⇒ system-wide order
 *    `orders → products`, no cycle.
 *  - Khoá `products` chứ không `stock_items`: dòng tồn sinh lười, `FOR UPDATE` trên tập rỗng
 *    không khoá gì ⇒ hai phiếu nhập đầu tiên cùng sản phẩm cùng `upsert`, một bên vỡ unique.
 *  - MỘT câu, `ORDER BY id`: hai phiếu chéo sản phẩm (A,B)/(B,A) khoá cùng thứ tự ⇒ không
 *    deadlock.
 *  - Đọc `onHand` + `costPrice` SAU khoá ⇒ phép tính dựa trên trạng thái đã commit mới nhất
 *    (READ COMMITTED lấy ảnh chụp mới cho mỗi câu lệnh).
 *
 * Lỗi nghiệp vụ ném TRONG tx ⇒ rollback toàn phiếu. Event publish SAU commit (AD-18).
 * A stock-out refused for insufficient stock publishes `StockOutBlocked` AFTER the rollback
 * (nothing commits, the attempt itself is the fact), then rethrows the same error.
 */
@Injectable()
export class StockVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async taoPhieu(
    input: TaoPhieuInput,
    actorAccountId: string,
  ): Promise<StockVoucherDetail> {
    const { type } = input;
    const ids = input.lines.map((l) => l.productId);

    let committed: {
      phieu: PhieuChiTietRow;
      dongSnapshot: StockVoucherLineSnapshot[];
    };
    try {
      committed = await this.prisma.$transaction(async (tx) => {
        const khoa = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM products WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;
        if (khoa.length !== new Set(ids).size) {
          const coThat = new Set(khoa.map((r) => r.id));
          throw new AppException(
            ErrorCode.NOT_FOUND,
            404,
            `Không tìm thấy sản phẩm: ${ids.filter((id) => !coThat.has(id)).join(', ')}`,
          );
        }

        const products = await tx.product.findMany({
          where: { id: { in: ids } },
          include: { stockItem: true },
        });
        const theoId = new Map(products.map((p) => [p.id, p]));

        if (type === 'xuat') {
          const shortage = insufficientStockError(
            input.lines.map((dong) => {
              const p = theoId.get(dong.productId)!;
              return {
                productId: p.id,
                qty: dong.qty,
                onHand: p.stockItem?.onHand ?? 0,
                unit: p.unit,
              };
            }),
          );
          if (shortage) throw shortage;
        } else {
          const loi: FieldErrorDto[] = [];
          input.lines.forEach((dong, i) => {
            const p = theoId.get(dong.productId)!;
            if (!(p.tracksStock && p.isActive)) {
              loi.push({
                field: `lines.${i}.productId`,
                code: PRODUCT_NOT_STOCKABLE,
                message: `${p.name} không theo dõi tồn hoặc đã ngừng bán — không nhập kho được.`,
              });
            }
          });
          if (loi.length > 0) {
            throw new AppException(
              ErrorCode.CONFLICT,
              409,
              'Có sản phẩm không nhập kho được.',
              loi,
            );
          }
        }

        const dongSnapshot: StockVoucherLineSnapshot[] = [];
        for (const dong of input.lines) {
          const p = theoId.get(dong.productId)!;
          const onHandTruoc = p.stockItem?.onHand ?? 0;
          const giaVonTruoc = p.costPrice;
          const onHandSau =
            type === 'nhap' ? onHandTruoc + dong.qty : onHandTruoc - dong.qty;
          // Phiếu xuất KHÔNG đổi giá vốn bình quân; giá vốn dòng xuất = snapshot lúc xuất.
          const unitCost = type === 'nhap' ? dong.unitCost! : giaVonTruoc;
          const giaVonSau =
            type === 'nhap'
              ? tinhGiaVonBinhQuan({
                  onHandTruoc,
                  giaVonTruoc,
                  qtyNhap: dong.qty,
                  donGiaNhap: unitCost,
                })
              : giaVonTruoc;

          await tx.stockItem.upsert({
            where: { productId: p.id },
            create: { productId: p.id, onHand: onHandSau },
            update: { onHand: onHandSau },
          });
          if (type === 'nhap') {
            await tx.product.update({
              where: { id: p.id },
              data: { costPrice: giaVonSau },
            });
          }
          dongSnapshot.push({
            productId: p.id,
            qty: dong.qty,
            unitCost,
            onHandTruoc,
            onHandSau,
            giaVonTruoc,
            giaVonSau,
          });
        }

        const phieu = await tx.stockVoucher.create({
          data: {
            type,
            note: input.note || null,
            createdByAccountId: actorAccountId,
            lines: {
              create: dongSnapshot.map((d) => ({
                productId: d.productId,
                qty: d.qty,
                unitCost: d.unitCost,
              })),
            },
          },
          include: CHI_TIET_INCLUDE,
        });
        return { phieu, dongSnapshot };
      });
    } catch (error) {
      if (error instanceof InsufficientStockException) {
        await this.eventBus.publish(
          new StockOutBlocked(
            actorAccountId,
            { lines: error.shortages },
            new Date(),
          ),
        );
      }
      throw error;
    }
    const { phieu, dongSnapshot } = committed;

    const ketQua = chiTiet(phieu);
    await this.eventBus.publish(
      new StockVoucherCreated(
        actorAccountId,
        {
          id: ketQua.id,
          ma: ketQua.ma,
          type,
          note: ketQua.note,
          lines: dongSnapshot,
        },
        new Date(),
      ),
    );
    return ketQua;
  }

  /**
   * Order-bound stock-out — runs INSIDE the CALLER's transaction (`OrdersService`): never opens
   * a tx, never publishes, never touches `this.prisma`, never writes order tables.
   *
   * Why the tx belongs to `orders/` (unlike the `chuyenTrangThaiTuDong` pattern, where
   * inventory would commit stock and then ask for a status change): a stock issue writes
   * THREE aggregates that must be atomic — stock (here), the order lines' cost snapshot (only
   * `orders/` may write orders) and, at "Đã giao", `Order.status` (only `applyTransition`).
   * Committing stock first would leave a "stock deducted, order not delivered" gap, and the
   * cost snapshot would no longer be guaranteed equal to the voucher line's `unitCost`.
   *
   * ASSUMES NOT YET ISSUED: the caller checks `findOrderIssueVoucher` after locking the order
   * row. The `(orderId, orderVersionId)` unique index is the last net — hitting it is a
   * programming error, not a business branch.
   *
   * `reserved` is released by exactly what is CURRENTLY HELD for this order (ledger `SUM` per
   * order + product), not by the issued `qty`: an order that was never reserved would push
   * `reserved` negative.
   */
  async issueForOrderInTx(
    tx: Prisma.TransactionClient,
    input: IssueForOrderInput,
  ): Promise<IssueForOrderResult> {
    const nothing: IssueForOrderResult = {
      voucher: null,
      costByProduct: new Map(),
      event: null,
    };
    const ids = [...new Set(input.orderLines.map((l) => l.productId))];
    if (ids.length === 0) return nothing;

    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM products WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;
    if (locked.length !== ids.length) {
      const found = new Set(locked.map((r) => r.id));
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy sản phẩm: ${ids.filter((id) => !found.has(id)).join(', ')}`,
      );
    }

    const products = await tx.product.findMany({
      where: { id: { in: ids } },
      include: { stockItem: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = stockIssueLines(
      input.orderLines,
      new Map(
        products.map((p) => [
          p.id,
          { name: p.name, tracksStock: p.tracksStock },
        ]),
      ),
    );
    if (lines.length === 0) return nothing;

    const shortage = insufficientStockError(
      lines.map((line) => {
        const p = byId.get(line.productId)!;
        return {
          productId: p.id,
          qty: line.qty,
          onHand: p.stockItem?.onHand ?? 0,
          unit: p.unit,
        };
      }),
    );
    if (shortage) throw shortage;

    const snapshots: StockIssuedLineSnapshot[] = [];
    for (const line of lines) {
      const p = byId.get(line.productId)!;
      const onHandBefore = p.stockItem?.onHand ?? 0;
      const onHandAfter = onHandBefore - line.qty;
      const stockItem = await tx.stockItem.upsert({
        where: { productId: p.id },
        create: { productId: p.id, onHand: onHandAfter },
        update: { onHand: onHandAfter },
      });
      const held = await tx.stockMovement.aggregate({
        where: { orderId: input.orderId, stockItemId: stockItem.id },
        _sum: { qty: true },
      });
      const reservedReleased = Math.max(held._sum.qty ?? 0, 0);
      if (reservedReleased > 0) {
        await tx.stockMovement.create({
          data: {
            stockItemId: stockItem.id,
            orderId: input.orderId,
            orderVersionId: input.orderVersionId,
            qty: -reservedReleased,
            type: 'xuat',
          },
        });
      }
      snapshots.push({
        productId: p.id,
        qty: line.qty,
        // A stock-out does NOT move the weighted-average cost; the line cost is a snapshot.
        unitCost: p.costPrice,
        onHandBefore,
        onHandAfter,
        reservedReleased,
      });
    }

    const voucher = chiTiet(
      await tx.stockVoucher.create({
        data: {
          type: 'xuat',
          note: null,
          orderId: input.orderId,
          orderVersionId: input.orderVersionId,
          createdByAccountId: input.actorAccountId,
          lines: {
            create: snapshots.map((s) => ({
              productId: s.productId,
              qty: s.qty,
              unitCost: s.unitCost,
            })),
          },
        },
        include: CHI_TIET_INCLUDE,
      }),
    );

    return {
      voucher,
      costByProduct: new Map(snapshots.map((s) => [s.productId, s.unitCost])),
      event: new StockIssued(
        input.actorAccountId,
        {
          id: voucher.id,
          code: voucher.ma,
          orderId: input.orderId,
          orderVersionId: input.orderVersionId,
          lines: snapshots,
        },
        input.occurredAt,
      ),
    };
  }

  /**
   * Ids among `productIds` that track stock — runs INSIDE the caller's tx AFTER the order row
   * lock, and locks `products` with the SAME statement as every stock write (`ORDER BY id
   * FOR UPDATE`) before reading `tracksStock`. Read-only otherwise.
   */
  async lockTrackedProductsInTx(
    tx: Prisma.TransactionClient,
    productIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const ids = [...new Set(productIds)];
    if (ids.length === 0) return new Set();
    await tx.$queryRaw`
      SELECT id FROM products WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;
    const tracked = await tx.product.findMany({
      where: { id: { in: ids }, tracksStock: true },
      select: { id: true },
    });
    return new Set(tracked.map((p) => p.id));
  }

  /**
   * The existing stock-out of (order, current version) — `client` is the caller's `tx` (read
   * AFTER the order lock) or the root client for a plain read.
   */
  async findOrderIssueVoucher(
    client: Prisma.TransactionClient,
    orderId: string,
    orderVersionId: string,
  ): Promise<StockVoucherDetail | null> {
    const voucher = await client.stockVoucher.findUnique({
      where: { orderId_orderVersionId: { orderId, orderVersionId } },
      include: CHI_TIET_INCLUDE,
    });
    return voucher === null ? null : chiTiet(voucher);
  }

  /**
   * Preview of an order-bound stock-out — PLAIN READ, no lock. `shortfall` warns BEFORE the
   * click with the same rule as the write path (`issueShortfall`), but the decision is still
   * the check under the lock (stock may move between preview and click). `tracked` = the
   * products that will be on the voucher.
   */
  async previewOrderIssue(
    orderLines: readonly { productId: string; qty: number }[],
  ): Promise<{
    lines: StockIssuePreviewLine[];
    tracked: ReadonlySet<string>;
  }> {
    const ids = [...new Set(orderLines.map((l) => l.productId))];
    if (ids.length === 0) return { lines: [], tracked: new Set() };
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        tracksStock: true,
        stockItem: { select: { onHand: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = stockIssueLines(
      orderLines,
      new Map(
        products.map((p) => [
          p.id,
          { name: p.name, tracksStock: p.tracksStock },
        ]),
      ),
    ).map((line) => {
      const p = byId.get(line.productId)!;
      const onHand = p.stockItem?.onHand ?? 0;
      return {
        productId: line.productId,
        name: line.name,
        sku: p.sku,
        unit: p.unit,
        qty: line.qty,
        onHand,
        shortfall: issueShortfall(line.qty, onHand),
      };
    });
    return { lines, tracked: new Set(lines.map((l) => l.productId)) };
  }

  async lietKePhieu(query: {
    type?: LoaiPhieu;
  }): Promise<{ items: StockVoucherSummary[] }> {
    const rows = await this.prisma.stockVoucher.findMany({
      where: query.type ? { type: query.type } : {},
      include: {
        createdBy: { select: { id: true, displayName: true } },
        lines: { select: { qty: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { seq: 'desc' }],
      take: SO_PHIEU_TOI_DA,
    });
    return { items: rows.map((r) => tomTat(r, r.lines)) };
  }

  async chiTietPhieu(id: string): Promise<StockVoucherDetail> {
    const phieu = await this.prisma.stockVoucher.findUnique({
      where: { id },
      include: CHI_TIET_INCLUDE,
    });
    if (phieu === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy phiếu kho: ${id}`,
      );
    }
    return chiTiet(phieu);
  }
}
