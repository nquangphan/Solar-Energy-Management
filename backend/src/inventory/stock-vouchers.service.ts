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
import {
  StockVoucherCreated,
  type StockVoucherLineSnapshot,
} from './domain/stock-voucher-events';

export interface StockVoucherSummary {
  id: string;
  ma: string;
  type: LoaiPhieu;
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
 *  - Khoá `products` chứ không `stock_items`: dòng tồn sinh lười, `FOR UPDATE` trên tập rỗng
 *    không khoá gì ⇒ hai phiếu nhập đầu tiên cùng sản phẩm cùng `upsert`, một bên vỡ unique.
 *  - MỘT câu, `ORDER BY id`: hai phiếu chéo sản phẩm (A,B)/(B,A) khoá cùng thứ tự ⇒ không
 *    deadlock.
 *  - Đọc `onHand` + `costPrice` SAU khoá ⇒ phép tính dựa trên trạng thái đã commit mới nhất
 *    (READ COMMITTED lấy ảnh chụp mới cho mỗi câu lệnh).
 *
 * Lỗi nghiệp vụ ném TRONG tx ⇒ rollback toàn phiếu. Event publish SAU commit (AD-18).
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

    const { phieu, dongSnapshot } = await this.prisma.$transaction(
      async (tx) => {
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

        const loi: FieldErrorDto[] = [];
        input.lines.forEach((dong, i) => {
          const p = theoId.get(dong.productId)!;
          const onHand = p.stockItem?.onHand ?? 0;
          if (type === 'nhap' && !(p.tracksStock && p.isActive)) {
            loi.push({
              field: `lines.${i}.productId`,
              code: PRODUCT_NOT_STOCKABLE,
              message: `${p.name} không theo dõi tồn hoặc đã ngừng bán — không nhập kho được.`,
            });
          }
          if (type === 'xuat' && dong.qty > onHand) {
            loi.push({
              field: `lines.${i}.qty`,
              code: INSUFFICIENT_STOCK,
              message: `Còn ${onHand} ${p.unit}, không xuất được ${dong.qty}.`,
            });
          }
        });
        if (loi.length > 0) {
          throw new AppException(
            ErrorCode.CONFLICT,
            409,
            type === 'xuat'
              ? 'Không đủ tồn — không thể xuất quá số tồn hiện có.'
              : 'Có sản phẩm không nhập kho được.',
            loi,
          );
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
      },
    );

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
