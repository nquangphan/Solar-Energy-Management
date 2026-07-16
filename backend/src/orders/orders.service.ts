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
  OrderCreated,
  OrderLineAdded,
  OrderLineRemoved,
  OrderLineUpdated,
  OrderMetaChanged,
  OrderScopeChanged,
  type OrderLineSnapshot,
  type OrderSnapshot,
} from './domain/order-events';
import { TRANG_THAI_BAO_GIA } from './domain/order-status';
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
 * là cache lúc nhập. Giá chỉ đóng băng lúc Chốt (`unitPriceSnapshot`, Story 4.5 — ở đây để NULL).
 *
 * MUTATION DÒNG chỉ khi `status === 'baogia'` (khác ⇒ 409) — sửa sau chốt là luồng version
 * mới (Story 4.6). Story 4.1 không có đường nào ĐỔI status (AD-11: đổi = `applyTransition()`, 5.1).
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
   * Dòng catalog `priceEditable = false` ⇒ giá SỐNG tính lại từ danh mục hiện hành qua CÙNG
   * `resolveUnitPrice()` + cờ với lúc thêm (FR-5: đơn chưa chốt luôn theo giá mới nhất; giá trị
   * lưu chỉ là cache lúc nhập, KHÔNG ghi đè DB). Dòng `priceEditable = true` và dòng tự do trả
   * giá đã lưu. Product tra MỘT lần cho cả danh sách — không N+1.
   */
  private async toViews(
    lines: OrderLineItem[],
    tieredPricingEnabled: boolean,
  ): Promise<OrderLineView[]> {
    const liveIds = [
      ...new Set(
        lines
          .filter((line) => line.productId !== null && !line.priceEditable)
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
        line.productId !== null && !line.priceEditable
          ? productById.get(line.productId)
          : undefined;
      const unitPrice =
        product === undefined
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
