import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Order, OrderLineItem } from '@prisma/client';
import {
  resolveUnitPrice,
  type PriceTier,
} from '../catalog/domain/price-resolution';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { CustType } from '../customers/domain/customer-type';
import { normalizeVnPhone } from '../customers/domain/phone';
import { EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';
import { lineAmount } from './domain/line-amount';
import { computeOrderTotals, type OrderTotals } from './domain/order-totals';
import {
  OrderConfirmed,
  OrderCreated,
  OrderLineAdded,
  OrderLineRemoved,
  OrderLineUpdated,
  OrderMetaChanged,
  OrderRevised,
  OrderScopeChanged,
  type OrderLineSnapshot,
  type OrderSnapshot,
} from './domain/order-events';
import {
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_DA_CHOT,
} from './domain/order-status';
import { scopePresetFor } from './domain/scope-preset';
import { VAT_MODE, vatApplies } from './domain/vat-mode';
import { AddLineItemRequestDto } from './dto/add-line-item-request.dto';
import { CreateOrderRequestDto } from './dto/create-order-request.dto';
import { PreviewTotalRequestDto } from './dto/preview-total-request.dto';
import { UpdateLineItemRequestDto } from './dto/update-line-item-request.dto';
import { UpdateOrderRequestDto } from './dto/update-order-request.dto';

/**
 * Tạo Đơn + CRUD dòng báo giá kiểu giỏ hàng (Story 4.1, FR-1). Truy vấn CHỈ qua
 * `PrismaService` (AD-1); side-effect CHỈ qua `EventBus` port (AD-18) — đúng HAI dependency,
 * cờ/quyền resolve ở controller truyền boolean xuống (khuôn `ProductsService`).
 *
 * BẤT BIẾN TRUNG TÂM (AD-6): `OrderVersion` sở hữu TẤT CẢ line item; `Order.currentVersionId`
 * là CON TRỎ CHÂN LÝ DUY NHẤT tới bản hiệu lực. Mọi đường đọc/ghi dòng đi qua con trỏ đó —
 * KHÔNG suy từ timestamp, KHÔNG đếm version.
 *
 * SNAPSHOT NGUỒN (FR-35): `Order.sourceId` copy từ `Customer.sourceId` ĐÚNG MỘT LẦN lúc tạo.
 * Khách quay lại qua kênh khác ⇒ `Customer.sourceId` đổi nhưng đơn cũ giữ nguyên kênh — cùng
 * bài học `unitPriceSnapshot` (FR-5). Đường đọc vì vậy KHÔNG BAO GIỜ join ngược về Customer
 * để lấy nguồn.
 *
 * GIÁ TRƯỚC CHỐT (FR-5/FR-14): dòng catalog `priceEditable = false` trả giá SỐNG tính lại từ
 * danh mục hiện hành qua `resolveUnitPrice()` mỗi lần đọc — giá trị lưu trong `unitPrice` chỉ
 * là cache lúc nhập. SAU CHỐT giá đóng băng: `confirm()` ghi `unitPriceSnapshot` từng dòng,
 * đường đọc `toViews` ưu tiên snapshot khi non-null và CHỈ live-resolve khi snapshot null —
 * tín hiệu tự thân trên DÒNG, không dựa `Order.status` (version cũ đã chốt ở 4.6 vẫn đọc đúng).
 *
 * MUTATION DÒNG chỉ khi `status === 'baogia'` (khác ⇒ 409) — sửa sau chốt là luồng version
 * mới (Story 4.6).
 *
 * GHI STATUS (AD-11): `confirm()` + `revise()` là HAI điểm ghi `Order.status` tạm thời trong
 * codebase — cùng khuôn transition nghiệp vụ có gate quyền + audit + cổng atomic. 5.1 nuốt cả
 * hai block vào `applyTransition()`; ngoài chúng không đường nào ĐỔI status.
 */

/**
 * Projection Product cho đường báo giá — `select` TƯỜNG MINH, 🔴 KHÔNG có `costPrice`:
 * service này là một CỬA MỚI vào bảng `products`, một `include: { product: true }` hồn nhiên
 * sẽ trả giá vốn cho mọi người có `quotes.create_edit`, đi vòng qua hàng rào `costs.view` +
 * `stripCostPrice` của catalog.
 */
const PRODUCT_QUOTE_SELECT = {
  id: true,
  name: true,
  unit: true,
  price: true,
  priceEditable: true,
  warrantyMonths: true,
  prices: { select: { minQty: true, price: true } },
} as const;

interface ProductQuoteView {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly price: number;
  readonly priceEditable: boolean;
  readonly warrantyMonths: number | null;
  readonly prices: readonly PriceTier[];
}

/** Shape một dòng trong response — đơn giá HIỆU LỰC + `amount` server tính (AD-16). */
export interface OrderLineView {
  readonly id: string;
  readonly productId: string | null;
  readonly name: string;
  readonly unit: string;
  readonly qty: number;
  readonly unitPrice: number;
  readonly priceEditable: boolean;
  readonly isFlexible: boolean;
  readonly note: string | null;
  readonly warrantyMonths: number | null;
  readonly displayOrder: number;
  readonly amount: number;
}

/** Shape Đơn trong response — dòng đã phân giải qua `currentVersionId`. */
export type OrderView = Order & { lineItems: OrderLineView[] };

/** Ảnh chụp Đơn cho event/audit — audit ghi sự thật đầy đủ, không lọc theo quyền người xem. */
function orderSnapshot(order: Order): OrderSnapshot {
  return {
    id: order.id,
    status: order.status,
    customerSdt: order.customerSdt,
    currentVersionId: order.currentVersionId,
    ownerAccountId: order.ownerAccountId,
    assigneeAccountId: order.assigneeAccountId,
    sourceId: order.sourceId,
    custType: order.custType,
    scopeThietBi: order.scopeThietBi,
    scopeThiCong: order.scopeThiCong,
    scopeVanChuyen: order.scopeVanChuyen,
    vatMode: order.vatMode,
    kWp: order.kWp,
    validityNote: order.validityNote,
  };
}

/**
 * Sentinel abort transaction Chốt: bên thua cổng atomic (`count === 0`) ném nó để rollback
 * toàn tx (Prisma interactive tx: throw trong callback ⇒ rollback), caller catch RIÊNG nó
 * rồi đọc lại trạng thái — mọi lỗi khác ném tiếp nguyên vẹn.
 */
const CHOT_GATE_THUA = new Error('chot-gate-thua');

/**
 * Sentinel abort transaction Mở lại (Story 4.6) — cùng khuôn `CHOT_GATE_THUA`: bên thua cổng
 * atomic rollback TOÀN tx (kể cả version/dòng đã create trong callback), caller đọc lại rồi
 * quyết idempotent hay 409.
 */
const MO_LAI_GATE_THUA = new Error('mo-lai-gate-thua');

/** Ảnh chụp Dòng cho event/audit. */
function lineSnapshot(line: OrderLineItem): OrderLineSnapshot {
  return {
    id: line.id,
    orderVersionId: line.orderVersionId,
    productId: line.productId,
    name: line.name,
    unit: line.unit,
    qty: line.qty,
    unitPrice: line.unitPrice,
    priceEditable: line.priceEditable,
    isFlexible: line.isFlexible,
    note: line.note,
    warrantyMonths: line.warrantyMonths,
    displayOrder: line.displayOrder,
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * SĐT thô ⇒ E.164 — CÙNG bộ chuẩn hoá với `customers/` (AD-9). Tra bằng chuỗi thô sẽ báo
   * 404 "chưa có khách" cho một khách ĐANG TỒN TẠI (`0912…` không phải chuỗi con của `+84912…`).
   */
  private normalizeOrThrow(raw: string): string {
    const sdt = normalizeVnPhone(raw);
    if (sdt === null) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Số điện thoại không hợp lệ.',
        [
          {
            field: 'customerSdt',
            code: 'isPhoneNumber',
            message:
              'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).',
          },
        ],
      );
    }
    return sdt;
  }

  private async findOrThrow(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (order === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy đơn hàng: ${id}`,
      );
    }
    return order;
  }

  /**
   * Mutation dòng CHỈ khi đơn còn ở Báo giá — khác ⇒ 409 CONFLICT (sửa sau chốt = version
   * mới, Story 4.6). So với khoá trạng thái chính tắc, KHÔNG so nhãn hiển thị.
   */
  private assertMutable(order: Order): void {
    if (order.status === TRANG_THAI_BAO_GIA) return;
    throw new AppException(
      ErrorCode.CONFLICT,
      409,
      'Chỉ sửa được dòng khi đơn còn ở trạng thái Báo giá.',
    );
  }

  /**
   * Con trỏ bản hiệu lực PHẢI có — `create` gắn nó trong cùng transaction tạo đơn và không
   * đường nào gỡ ra, nên null ở đây là dữ liệu hỏng, không phải nhánh nghiệp vụ.
   */
  private currentVersionIdOrThrow(order: Order): string {
    if (order.currentVersionId !== null) return order.currentVersionId;
    throw new AppException(
      ErrorCode.CONFLICT,
      409,
      'Đơn chưa có bản hiệu lực.',
    );
  }

  /**
   * Tạo Đơn: MỘT `$transaction` array 3 bước với id sinh TRƯỚC (FK vòng
   * `Order.currentVersionId ↔ OrderVersion.orderId`): order tạo với pointer null → version 1
   * → repoint. Tách 3 lệnh rời là mở cửa cho đơn-không-version khi bước giữa chết.
   *
   * `sourceId`/`custType` SNAPSHOT từ Customer NGAY TẠI ĐÂY (FR-35) — không nhận từ client.
   *
   * 3 cờ phạm vi ghi TƯỜNG MINH theo preset Loại khách (FR-2, Story 4.3) — KHÔNG dựa DB
   * default (default trùng preset Thương mại chỉ là ngẫu nhiên, không mang ngữ nghĩa).
   */
  async create(
    actorAccountId: string,
    dto: CreateOrderRequestDto,
  ): Promise<OrderView> {
    const sdt = this.normalizeOrThrow(dto.customerSdt);
    const customer = await this.prisma.customer.findUnique({ where: { sdt } });
    if (customer === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy khách hàng: ${sdt}`,
      );
    }

    const orderId = randomUUID();
    const versionId = randomUUID();
    const [, , order] = await this.prisma.$transaction([
      this.prisma.order.create({
        data: {
          id: orderId,
          status: TRANG_THAI_BAO_GIA,
          customerSdt: sdt,
          ownerAccountId: actorAccountId,
          sourceId: customer.sourceId,
          custType: customer.custType,
          // Cột `custType` là String ở Prisma nhưng giá trị đã validate `@IsIn(CUST_TYPES)`
          // lúc tạo khách — cast về union domain để tra preset.
          ...scopePresetFor(customer.custType as CustType),
          // Tick VAT ghi TƯỜNG MINH (FR-3, Story 4.4) — không dựa DB default/null; null chỉ
          // dành cho đơn tạo trước 4.4 (tính như có VAT qua `vatApplies`).
          vatMode: VAT_MODE.coVat,
        },
      }),
      this.prisma.orderVersion.create({
        data: { id: versionId, orderId, versionNo: 1 },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { currentVersionId: versionId },
      }),
    ]);

    // SAU khi transaction commit — publish trước/trong là ghi nhật ký cho một sự việc có thể
    // chưa xảy ra (AD-18).
    await this.eventBus.publish(
      new OrderCreated(actorAccountId, orderSnapshot(order), new Date()),
    );
    return { ...order, lineItems: [] };
  }

  /**
   * Tổng preview realtime — STATELESS (AD-16): KHÔNG chạm Prisma, KHÔNG publish event
   * (preview không phải mutation nghiệp vụ — FR-20 không đòi audit). Client echo các dòng
   * backend đã trả + `vatMode` của Đơn; MỌI số học tiền xảy ra ở `computeOrderTotals()` —
   * hàm pricing duy nhất.
   *
   * `vatRatePercent` do CONTROLLER resolve từ config hệ thống MỘT lần mỗi request rồi truyền
   * xuống (pattern `tieredPricingEnabled` — service giữ đúng 2 dep); client KHÔNG BAO GIỜ
   * gửi rate. `applyVat` theo tick echo — vắng field = đơn cũ vatMode null ⇒ có VAT.
   */
  previewTotal(
    dto: PreviewTotalRequestDto,
    vatRatePercent: number,
  ): OrderTotals {
    return computeOrderTotals({
      lines: dto.lines,
      vatRate: vatRatePercent,
      applyVat: vatApplies(dto.vatMode ?? null),
    });
  }

  /** Đơn + dòng của bản hiệu lực (qua `currentVersionId`), mỗi dòng kèm `amount` server tính. */
  async get(id: string, tieredPricingEnabled: boolean): Promise<OrderView> {
    const order = await this.findOrThrow(id);
    return this.viewOf(order, tieredPricingEnabled);
  }

  /** Bản ghi Order ⇒ view response: nạp dòng của bản hiệu lực rồi phân giải qua `toViews`. */
  private async viewOf(
    order: Order,
    tieredPricingEnabled: boolean,
  ): Promise<OrderView> {
    const lines =
      order.currentVersionId === null
        ? []
        : await this.prisma.orderLineItem.findMany({
            where: { orderVersionId: order.currentVersionId },
            orderBy: { displayOrder: 'asc' },
          });
    return {
      ...order,
      lineItems: await this.toViews(lines, tieredPricingEnabled),
    };
  }

  /**
   * PATCH Đơn — HAI nhóm field, mỗi nhóm một event audit đúng ngữ nghĩa:
   *  - Cờ phạm vi Thi công/Vận chuyển (Story 4.3, FR-2) ⇒ `OrderScopeChanged`. Độc lập với
   *    preset; `custType` KHÔNG đổi. `scopeThietBi` không có trong DTO nên không đường ghi
   *    nào chạm tới (luôn `true`).
   *  - Metadata vatMode/kWp/validityNote (Story 4.4, FR-3/FR-4) ⇒ `OrderMetaChanged`.
   *    `kWp`/`validityNote` nhận `null` = xoá giá trị.
   * Một PATCH đụng cả hai nhóm publish HAI event. Cửa sổ sửa = `baogia` cho MỌI field — cờ
   * gate máy trạng thái Epic 5 (AD-7); 4.5 snapshot vatRate/vatMode lúc Chốt, đổi tick sau
   * chốt là đổi tiền đã đóng băng — cùng ngữ nghĩa 409 với line-items.
   *
   * Nhận `tieredPricingEnabled` như `get()` vì `toViews` re-resolve giá SỐNG cho dòng catalog.
   * Body rỗng ⇒ trả view hiện tại, KHÔNG ghi, KHÔNG event (không có mutation để audit).
   */
  async update(
    actorAccountId: string,
    orderId: string,
    dto: UpdateOrderRequestDto,
    tieredPricingEnabled: boolean,
  ): Promise<OrderView> {
    const before = await this.findOrThrow(orderId);
    this.assertMutable(before);

    const coScope =
      dto.scopeThiCong !== undefined || dto.scopeVanChuyen !== undefined;
    const coMeta =
      dto.vatMode !== undefined ||
      dto.kWp !== undefined ||
      dto.validityNote !== undefined;
    if (!coScope && !coMeta) {
      return this.viewOf(before, tieredPricingEnabled);
    }

    const updated = await this.prisma.order.update({
      where: { id: before.id },
      // Partial: Prisma bỏ qua key `undefined` — đúng ngữ nghĩa PATCH; `kWp`/`validityNote`
      // = null GHI null (xoá giá trị).
      data: {
        scopeThiCong: dto.scopeThiCong,
        scopeVanChuyen: dto.scopeVanChuyen,
        vatMode: dto.vatMode,
        kWp: dto.kWp,
        validityNote: dto.validityNote,
      },
    });

    // Publish SAU write — mỗi event đúng nhóm field nó mô tả (audit tra theo ngữ nghĩa).
    if (coScope) {
      await this.eventBus.publish(
        new OrderScopeChanged(
          actorAccountId,
          orderSnapshot(before),
          orderSnapshot(updated),
          new Date(),
        ),
      );
    }
    if (coMeta) {
      await this.eventBus.publish(
        new OrderMetaChanged(
          actorAccountId,
          orderSnapshot(before),
          orderSnapshot(updated),
          new Date(),
        ),
      );
    }
    return this.viewOf(updated, tieredPricingEnabled);
  }

  /**
   * CHỐT Đơn (Story 4.5, FR-5/AD-6/AD-16): đóng băng giá bằng snapshot trong MỘT transaction.
   * ⚠️ 5.1 nuốt block này vào `applyTransition()` — đây là điểm ghi `Order.status` DUY NHẤT
   * tạm thời (KHÔNG thêm điểm ghi thứ hai; KHÔNG dựng bảng transition ở đây).
   *
   * Cổng idempotency = atomic `updateMany({where: {id, status: 'baogia'}})` + `count === 1`
   * (khuôn Story 2.3 chống replay): Postgres READ COMMITTED re-check WHERE sau row lock ⇒
   * 2 request đồng thời đúng MỘT bên thắng; bên thua nhận `count 0` → sentinel abort tx →
   * đọc lại → `dachot` thì trả idempotent, trạng thái lạ thì 409. Pre-check `dachot` trước
   * tx chỉ là fast-path; cổng thật nằm TRONG tx. Bắt buộc interactive `$transaction` —
   * array-style không abort được các op sau khi `count === 0`.
   *
   * Snapshot 3 loại dòng: catalog `priceEditable=false` ⇒ cả hai cột = giá resolve SỐNG tại
   * thời điểm chốt (không phải cache `unitPrice` lúc nhập); catalog `priceEditable=true` (phí
   * lắp) ⇒ `unitPriceSnapshot` = giá đã sửa, `catalogPriceSnapshot` = giá resolve — chênh lệch
   * lộ ra cho màn duyệt chiết khấu 4.7; dòng tự do ⇒ `catalogPriceSnapshot` null.
   * `costPriceSnapshot` KHÔNG ghi — giá vốn đóng băng lúc XUẤT KHO (AD-20, Story 6.4).
   *
   * `OrderVersion` hiệu lực ghi `vatRate` (config resolve ở controller) + `vatMode` GIÁ TRỊ
   * HIỆU LỰC (`order.vatMode ?? 'co_vat'` — sau chốt không bao giờ null) + `chotAt`.
   *
   * Publish `OrderConfirmed` SAU commit, CHỈ ở nhánh chốt thật — retry im lặng (NFR-1, AD-18).
   */
  async confirm(
    actorAccountId: string,
    orderId: string,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
  ): Promise<OrderView> {
    const before = await this.findOrThrow(orderId);
    if (before.status === TRANG_THAI_DA_CHOT) {
      // Retry sau khi đã chốt: 200 view hiện tại — KHÔNG ghi lại snapshot, KHÔNG event.
      return this.viewOf(before, tieredPricingEnabled);
    }
    if (before.status !== TRANG_THAI_BAO_GIA) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chỉ chốt được đơn đang ở trạng thái Báo giá.',
      );
    }
    const versionId = this.currentVersionIdOrThrow(before);

    const lines = await this.prisma.orderLineItem.findMany({
      where: { orderVersionId: versionId },
      orderBy: { displayOrder: 'asc' },
    });
    // Báo giá rỗng không có gì để đóng băng — gần như chắc chắn là mis-tap. Kiểm TRƯỚC tx.
    if (lines.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Không thể chốt báo giá chưa có dòng nào.',
      );
    }

    // Giá danh mục resolve MỘT lần cho mọi dòng catalog (kể cả priceEditable — cần
    // catalogPriceSnapshot song song), CÙNG cờ với đường live/toViews — đóng băng đúng con
    // số khách đang thấy trên màn.
    const catalogIds = [
      ...new Set(
        lines
          .filter((line) => line.productId !== null)
          .map((line) => line.productId as string),
      ),
    ];
    const products =
      catalogIds.length === 0
        ? []
        : ((await this.prisma.product.findMany({
            where: { id: { in: catalogIds } },
            select: PRODUCT_QUOTE_SELECT,
          })) as ProductQuoteView[]);
    const productById = new Map(products.map((p) => [p.id, p]));

    const lineSnapshots = lines.map((line) => {
      if (line.productId === null) {
        // Dòng tự do: giá nhập tay đóng băng, không có giá danh mục để so.
        return {
          id: line.id,
          unitPriceSnapshot: line.unitPrice,
          catalogPriceSnapshot: null,
        };
      }
      const product = productById.get(line.productId);
      // Product PHẢI còn (FK restrict) — nhánh undefined chỉ là phòng dữ liệu hỏng, rơi về
      // giá cache như `toViews`.
      const catalogPrice =
        product === undefined
          ? line.unitPrice
          : resolveUnitPrice({
              basePrice: product.price,
              tiers: product.prices,
              quantity: line.qty,
              tieredPricingEnabled,
            });
      return line.priceEditable
        ? {
            // Phí lắp đặt đã sửa giá: đóng băng giá ĐÃ SỬA, giá danh mục lưu SONG SONG.
            id: line.id,
            unitPriceSnapshot: line.unitPrice,
            catalogPriceSnapshot: catalogPrice,
          }
        : {
            // Catalog thường: giá SỐNG tại thời điểm chốt — cả hai cột cùng con số.
            id: line.id,
            unitPriceSnapshot: catalogPrice,
            catalogPriceSnapshot: catalogPrice,
          };
    });

    const chotAt = new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({
          where: { id: before.id, status: TRANG_THAI_BAO_GIA },
          data: { status: TRANG_THAI_DA_CHOT },
        });
        if (count === 0) throw CHOT_GATE_THUA;
        await tx.orderVersion.update({
          where: { id: versionId },
          data: {
            vatRate: vatRatePercent,
            // Giá trị HIỆU LỰC — đơn tạo trước 4.4 (vatMode null, tính như có VAT) chốt
            // xong phải tường minh 'co_vat': quyết định thuế đã đóng băng không được mập mờ.
            vatMode: before.vatMode ?? VAT_MODE.coVat,
            chotAt,
          },
        });
        for (const snap of lineSnapshots) {
          await tx.orderLineItem.update({
            where: { id: snap.id },
            data: {
              unitPriceSnapshot: snap.unitPriceSnapshot,
              catalogPriceSnapshot: snap.catalogPriceSnapshot,
            },
          });
        }
      });
    } catch (error) {
      if (error !== CHOT_GATE_THUA) throw error;
      // Thua cổng atomic (race 2 request đồng thời): đọc lại sự thật hiện tại.
      const current = await this.findOrThrow(orderId);
      if (current.status === TRANG_THAI_DA_CHOT) {
        return this.viewOf(current, tieredPricingEnabled);
      }
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chỉ chốt được đơn đang ở trạng thái Báo giá.',
      );
    }

    // `updateMany` không trả row — compose status mới lên object `before` trong bộ nhớ để
    // response (và snapshot `after` của event) nói 'dachot'.
    const after: Order = { ...before, status: TRANG_THAI_DA_CHOT };
    await this.eventBus.publish(
      new OrderConfirmed(
        actorAccountId,
        orderSnapshot(before),
        orderSnapshot(after),
        new Date(),
      ),
    );
    return this.viewOf(after, tieredPricingEnabled);
  }

  /**
   * MỞ LẠI Đơn đã chốt để sửa (Story 4.6, FR-6/AD-6): sinh BẢN UPDATE MỚI, không ghi đè bản
   * cũ. ⚠️ Điểm ghi `Order.status` tạm thời thứ HAI (cùng `confirm()`) — 5.1 nuốt block này
   * vào `applyTransition()`.
   *
   * MỘT interactive `$transaction`: cổng atomic `updateMany({where: {id, status: 'dachot'}})`
   * đặt ĐẦU tx — bên thua race (`count === 0`) abort TRƯỚC khi create gì, rollback rẻ; sau
   * cổng: tạo `OrderVersion` mới `versionNo + 1` (vatRate/vatMode/chotAt null — bản đang sửa
   * chưa đóng băng thuế), copy TOÀN BỘ dòng bản hiệu lực sang bản mới (snapshot cả 3 cột =
   * null ⇒ `toViews` live-resolve lại giá danh mục hiện tại — hành vi trước-chốt FR-5;
   * `warrantyStartAt` copy nguyên — AD-20 "hàng cũ giữ ngày cũ", 4.9 chỉ đặt khi null lúc
   * chốt), rồi repoint `currentVersionId`. Version cũ + dòng cũ + snapshot cũ KHÔNG bị op
   * update/delete nào chạm tới — lịch sử bất biến, "bản hiệu lực" CHỈ phân giải qua con trỏ.
   *
   * Idempotent kiểu 4.5: đơn ĐANG `baogia` (retry/double-tap, hoặc đơn chưa từng chốt) ⇒ 200
   * view hiện tại — KHÔNG version mới, KHÔNG event. Trạng thái khác `dachot`/`baogia` ⇒ 409.
   * Race mo-lai ↔ chot: hai cổng `updateMany` điều kiện NGƯỢC nhau trên cùng row — Postgres
   * READ COMMITTED re-check WHERE sau row lock ⇒ đúng một bên thắng.
   *
   * Publish `OrderRevised` SAU commit, CHỈ nhánh mở-lại thật (NFR-1, AD-18) — audit ghi
   * ai/khi nào/bản nào qua AuditSubscriber (before/after mang `currentVersionId` cũ→mới).
   *
   * KHÔNG nhận `vatRatePercent` — mở lại không ghi thuế; re-chốt qua `confirm()` hiện có mới
   * đóng băng lại.
   */
  async revise(
    actorAccountId: string,
    orderId: string,
    tieredPricingEnabled: boolean,
  ): Promise<OrderView> {
    const before = await this.findOrThrow(orderId);
    if (before.status === TRANG_THAI_BAO_GIA) {
      // Đơn đang mở sẵn (retry mo-lai, hoặc đơn chưa từng chốt): no-op vô hại.
      return this.viewOf(before, tieredPricingEnabled);
    }
    if (before.status !== TRANG_THAI_DA_CHOT) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chỉ mở lại được đơn đang ở trạng thái Đã chốt.',
      );
    }

    // Đọc versionNo bản hiệu lực + dòng của nó TRƯỚC tx — bản hiệu lực luôn mang versionNo
    // lớn nhất (version chỉ sinh từ create() = 1 và revise() = +1; bên thua race rollback);
    // `@@unique([orderId, versionNo])` là backstop ở DB.
    const currentVersionId = this.currentVersionIdOrThrow(before);
    const currentVersion = await this.prisma.orderVersion.findUnique({
      where: { id: currentVersionId },
    });
    if (currentVersion === null) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Đơn chưa có bản hiệu lực.',
      );
    }
    const lines = await this.prisma.orderLineItem.findMany({
      where: { orderVersionId: currentVersionId },
      orderBy: { displayOrder: 'asc' },
    });

    const newVersionId = randomUUID();
    // Bảng copy (Dev Notes 4.6): field nghiệp vụ copy nguyên; snapshot cả 3 cột = null (dòng
    // sống lại — re-chốt mới đóng băng; giá vốn thuộc sự kiện xuất kho trên version ĐÃ xuất);
    // `warrantyStartAt` copy nguyên; id MỚI + orderVersionId = bản mới.
    const copies = lines.map((line) => ({
      id: randomUUID(),
      orderVersionId: newVersionId,
      productId: line.productId,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      unitPrice: line.unitPrice,
      priceEditable: line.priceEditable,
      isFlexible: line.isFlexible,
      note: line.note,
      warrantyMonths: line.warrantyMonths,
      unitPriceSnapshot: null,
      catalogPriceSnapshot: null,
      costPriceSnapshot: null,
      warrantyStartAt: line.warrantyStartAt,
      displayOrder: line.displayOrder,
    }));

    try {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({
          where: { id: before.id, status: TRANG_THAI_DA_CHOT },
          data: { status: TRANG_THAI_BAO_GIA },
        });
        if (count === 0) throw MO_LAI_GATE_THUA;
        await tx.orderVersion.create({
          data: {
            id: newVersionId,
            orderId: before.id,
            versionNo: currentVersion.versionNo + 1,
          },
        });
        // Đơn đã chốt luôn ≥ 1 dòng nên copies rỗng là logic-impossible — nhưng Prisma 7
        // createMany mảng rỗng là gotcha đã biết, guard rẻ.
        if (copies.length > 0) {
          await tx.orderLineItem.createMany({ data: copies });
        }
        await tx.order.update({
          where: { id: before.id },
          data: { currentVersionId: newVersionId },
        });
      });
    } catch (error) {
      if (error !== MO_LAI_GATE_THUA) throw error;
      // Thua cổng atomic (race 2 request đồng thời): đọc lại sự thật hiện tại.
      const current = await this.findOrThrow(orderId);
      if (current.status === TRANG_THAI_BAO_GIA) {
        return this.viewOf(current, tieredPricingEnabled);
      }
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chỉ mở lại được đơn đang ở trạng thái Đã chốt.',
      );
    }

    // Compose status + con trỏ mới lên object `before` trong bộ nhớ (updateMany/update không
    // trả row) — `viewOf` đọc lines bản MỚI qua con trỏ; caveat `updatedAt` cũ (tiền lệ 4.5).
    const after: Order = {
      ...before,
      status: TRANG_THAI_BAO_GIA,
      currentVersionId: newVersionId,
    };
    await this.eventBus.publish(
      new OrderRevised(
        actorAccountId,
        orderSnapshot(before),
        orderSnapshot(after),
        new Date(),
      ),
    );
    return this.viewOf(after, tieredPricingEnabled);
  }

  /**
   * Thêm dòng — hai dạng (UX-DR-24):
   *  - CATALOG (`productId`): copy `name`/`unit`/`priceEditable`/`warrantyMonths` từ Product;
   *    `unitPrice` auto-điền qua `resolveUnitPrice()` — client CHỈ được gửi giá khi
   *    `Product.priceEditable = true` (phí lắp đặt…), ngược lại 400 (sửa giá là cửa sau né
   *    duyệt chiết khấu).
   *  - TỰ DO (không `productId`): name/unit/qty/unitPrice nhập tay, `priceEditable = true`.
   */
  async addLine(
    actorAccountId: string,
    orderId: string,
    dto: AddLineItemRequestDto,
    tieredPricingEnabled: boolean,
  ): Promise<OrderLineView> {
    const order = await this.findOrThrow(orderId);
    this.assertMutable(order);
    const versionId = this.currentVersionIdOrThrow(order);

    // Cuối danh sách của BẢN HIỆU LỰC — displayOrder do server gán, client không đánh số.
    // max + 1, KHÔNG count: sau một lần xoá dòng, count nhỏ hơn displayOrder lớn nhất còn
    // lại ⇒ dòng mới trùng số với dòng cũ và không còn đứng cuối (orderBy tie).
    const last = await this.prisma.orderLineItem.findFirst({
      where: { orderVersionId: versionId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    const displayOrder = last === null ? 0 : last.displayOrder + 1;

    let created: OrderLineItem;
    if (dto.productId !== undefined) {
      const product = (await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: PRODUCT_QUOTE_SELECT,
      })) as ProductQuoteView | null;
      if (product === null) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          400,
          'Sản phẩm không tồn tại.',
          [
            {
              field: 'productId',
              code: 'exists',
              message: 'Sản phẩm không tồn tại.',
            },
          ],
        );
      }
      if (dto.unitPrice !== undefined && !product.priceEditable) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          400,
          'Sản phẩm này không cho phép tự đặt đơn giá.',
          [
            {
              field: 'unitPrice',
              code: 'priceNotEditable',
              message:
                'Sản phẩm này không cho phép tự đặt đơn giá — backend tự điền theo danh mục.',
            },
          ],
        );
      }
      const unitPrice =
        dto.unitPrice !== undefined
          ? dto.unitPrice
          : resolveUnitPrice({
              basePrice: product.price,
              tiers: product.prices,
              quantity: dto.qty,
              tieredPricingEnabled,
            });
      created = await this.prisma.orderLineItem.create({
        data: {
          orderVersionId: versionId,
          productId: product.id,
          name: product.name,
          unit: product.unit,
          qty: dto.qty,
          unitPrice,
          priceEditable: product.priceEditable,
          warrantyMonths: product.warrantyMonths,
          isFlexible: dto.isFlexible ?? false,
          note: dto.note ?? null,
          displayOrder,
        },
      });
    } else {
      created = await this.prisma.orderLineItem.create({
        data: {
          orderVersionId: versionId,
          productId: null,
          // DTO đã bắt buộc name/unit/unitPrice với dòng tự do (`@ValidateIf`) — non-null ở đây.
          name: dto.name as string,
          unit: dto.unit as string,
          qty: dto.qty,
          unitPrice: dto.unitPrice as number,
          priceEditable: true,
          warrantyMonths: null,
          isFlexible: dto.isFlexible ?? false,
          note: dto.note ?? null,
          displayOrder,
        },
      });
    }

    await this.eventBus.publish(
      new OrderLineAdded(
        actorAccountId,
        order.id,
        lineSnapshot(created),
        new Date(),
      ),
    );
    const [view] = await this.toViews([created], tieredPricingEnabled);
    return view;
  }

  /** Sửa `qty`/`note`/`isFlexible` mọi dòng; `unitPrice` CHỈ dòng `priceEditable = true`. */
  async updateLine(
    actorAccountId: string,
    orderId: string,
    lineId: string,
    dto: UpdateLineItemRequestDto,
    tieredPricingEnabled: boolean,
  ): Promise<OrderLineView> {
    const order = await this.findOrThrow(orderId);
    this.assertMutable(order);
    const before = await this.findLineOrThrow(order, lineId);

    if (dto.unitPrice !== undefined && !before.priceEditable) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Dòng này không cho phép sửa đơn giá.',
        [
          {
            field: 'unitPrice',
            code: 'priceNotEditable',
            message:
              'Dòng này không cho phép sửa đơn giá — giá theo danh mục hiện tại.',
          },
        ],
      );
    }

    const updated = await this.prisma.orderLineItem.update({
      where: { id: lineId },
      // Partial: Prisma bỏ qua key `undefined` — đúng ngữ nghĩa PATCH; `note: null` xoá ghi chú.
      data: {
        qty: dto.qty,
        unitPrice: dto.unitPrice,
        note: dto.note,
        isFlexible: dto.isFlexible,
      },
    });

    await this.eventBus.publish(
      new OrderLineUpdated(
        actorAccountId,
        order.id,
        lineSnapshot(before),
        lineSnapshot(updated),
        new Date(),
      ),
    );
    const [view] = await this.toViews([updated], tieredPricingEnabled);
    return view;
  }

  /** Xoá dòng khỏi bản hiệu lực — hard-delete (dòng chưa chốt không phải dữ liệu lịch sử). */
  async removeLine(
    actorAccountId: string,
    orderId: string,
    lineId: string,
  ): Promise<void> {
    const order = await this.findOrThrow(orderId);
    this.assertMutable(order);
    const before = await this.findLineOrThrow(order, lineId);

    await this.prisma.orderLineItem.delete({ where: { id: lineId } });

    await this.eventBus.publish(
      new OrderLineRemoved(
        actorAccountId,
        order.id,
        lineSnapshot(before),
        new Date(),
      ),
    );
  }

  /**
   * Dòng phải TỒN TẠI và thuộc BẢN HIỆU LỰC của đúng đơn này — dòng của version cũ/đơn khác
   * là 404, kẻo một lineId đoán mò sửa được dữ liệu đơn người khác.
   */
  private async findLineOrThrow(
    order: Order,
    lineId: string,
  ): Promise<OrderLineItem> {
    const versionId = this.currentVersionIdOrThrow(order);
    const line = await this.prisma.orderLineItem.findUnique({
      where: { id: lineId },
    });
    if (line === null || line.orderVersionId !== versionId) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy dòng báo giá: ${lineId}`,
      );
    }
    return line;
  }

  /**
   * Dòng DB ⇒ view response: đơn giá HIỆU LỰC + `amount` server tính (AD-16).
   *
   * SNAPSHOT-FIRST (FR-5, Story 4.5): dòng có `unitPriceSnapshot` non-null là dòng ĐÃ đóng
   * băng — trả snapshot, bỏ hẳn tra product (không hồi tố theo danh mục mới). Tín hiệu nằm
   * trên DÒNG, không phải `Order.status` — 4.6 có version cũ đã chốt + version mới đang sửa
   * cùng lúc.
   *
   * Dòng snapshot null giữ hành vi live: catalog `priceEditable = false` ⇒ giá SỐNG tính lại
   * từ danh mục hiện hành qua CÙNG `resolveUnitPrice()` + cờ với lúc thêm (đơn chưa chốt luôn
   * theo giá mới nhất; giá trị lưu chỉ là cache lúc nhập, KHÔNG ghi đè DB). Dòng
   * `priceEditable = true` và dòng tự do trả giá đã lưu. Product tra MỘT lần — không N+1.
   */
  private async toViews(
    lines: OrderLineItem[],
    tieredPricingEnabled: boolean,
  ): Promise<OrderLineView[]> {
    const liveIds = [
      ...new Set(
        lines
          .filter(
            (line) =>
              line.unitPriceSnapshot === null &&
              line.productId !== null &&
              !line.priceEditable,
          )
          .map((line) => line.productId as string),
      ),
    ];
    const products =
      liveIds.length === 0
        ? []
        : ((await this.prisma.product.findMany({
            where: { id: { in: liveIds } },
            select: PRODUCT_QUOTE_SELECT,
          })) as ProductQuoteView[]);
    const productById = new Map(products.map((p) => [p.id, p]));

    return lines.map((line) => {
      const product =
        line.unitPriceSnapshot === null &&
        line.productId !== null &&
        !line.priceEditable
          ? productById.get(line.productId)
          : undefined;
      const unitPrice =
        line.unitPriceSnapshot !== null
          ? line.unitPriceSnapshot
          : product === undefined
            ? line.unitPrice
            : resolveUnitPrice({
                basePrice: product.price,
                tiers: product.prices,
                quantity: line.qty,
                tieredPricingEnabled,
              });
      return {
        id: line.id,
        productId: line.productId,
        name: line.name,
        unit: line.unit,
        qty: line.qty,
        unitPrice,
        priceEditable: line.priceEditable,
        isFlexible: line.isFlexible,
        note: line.note,
        warrantyMonths: line.warrantyMonths,
        displayOrder: line.displayOrder,
        amount: lineAmount(unitPrice, line.qty),
      };
    });
  }
}
