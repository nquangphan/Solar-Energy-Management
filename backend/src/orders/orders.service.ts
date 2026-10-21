import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Order, OrderLineItem, Prisma } from '@prisma/client';
import {
  resolveUnitPrice,
  type PriceTier,
} from '../catalog/domain/price-resolution';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { CustType } from '../customers/domain/customer-type';
import { normalizeVnPhone } from '../customers/domain/phone';
import { EventBus } from '../events/event-bus';
import { PERM } from '../accounts/domain/permission-registry';
import { PrismaService } from '../prisma/prisma.service';
import {
  CHIET_KHAU_CHO_DUYET,
  CHIET_KHAU_DONG_Y,
  CHIET_KHAU_TU_CHOI,
} from './domain/discount-approval-status';
import { StoragePort } from '../storage/storage.port';
import {
  SU_KIEN,
  SU_KIEN_THU_CONG,
  buocKeTiep,
  buocVongDoi,
  coTheHuy,
  daTaiDich,
  evaluateTransition,
  type BuocKeTiep,
  type BuocVongDoi,
  type TransitionEvent,
} from './domain/allowed-transition';
import {
  duoiTuMime,
  kiemTraAnh,
  tenFileAnToan,
  type AnhTaiLen,
} from './domain/attachment-limits';
import { diffDong, type ThayDoiBanUpdate } from './domain/version-diff';
import { lineAmount } from './domain/line-amount';
import {
  soNgayConLai,
  soThangConLai,
  tinhHanBaoHanh,
  trangThaiBaoHanh,
  type TrangThaiBaoHanh,
} from './domain/warranty';
import { computeOrderTotals, type OrderTotals } from './domain/order-totals';
import {
  AttachmentAdded,
  AttachmentRemoved,
  DiscountRequested,
  DiscountResolved,
  OrderCancelled,
  OrderConfirmed,
  OrderCreated,
  OrderLineAdded,
  OrderLineRemoved,
  OrderLineUpdated,
  OrderMetaChanged,
  OrderRevised,
  OrderScopeChanged,
  StatusChanged,
  type OrderLineSnapshot,
  type OrderSnapshot,
} from './domain/order-events';
import {
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_CHO_DUYET,
  TRANG_THAI_DA_CHOT,
  type OrderStatusKey,
} from './domain/order-status';
import { scopePresetFor } from './domain/scope-preset';
import { VAT_MODE, vatApplies } from './domain/vat-mode';
import { AddLineItemRequestDto } from './dto/add-line-item-request.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
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
 * GHI STATUS (AD-11): `applyTransition()` là con đường code DUY NHẤT ĐỔI `Order.status`.
 * Ngoại lệ duy nhất là `create()` — nó INSERT trạng thái khởi tạo, không phải chuyển trạng
 * thái. Bất biến này không phải lời hứa: source-guard
 * `no-order-status-write-outside-transition.spec.ts` quét `src/` và fail nếu có điểm ghi thứ
 * hai. Luật "được chuyển hay không" sống ở `domain/allowed-transition.ts` (thuần, không
 * Prisma); executor ở đây chỉ khoá dòng, ghi, và trả event `StatusChanged` cho caller publish
 * SAU commit.
 *
 * KHOÁ DÒNG: mọi đường ĐỌC-rồi-GHI trên một đơn (`applyTransition` và 4 mutator nội dung)
 * lấy CÙNG một khoá `SELECT … FOR UPDATE` trên dòng `orders` làm op đầu tiên trong tx của
 * mình. Khoá một phía là vô nghĩa: nếu chỉ transition khoá mà mutator dòng không khoá, một
 * `addLine` vẫn chèn được dòng chưa-snapshot vào giữa lúc `confirm` đọc dòng và lúc commit.
 */

/**
 * Client Prisma BÊN TRONG một interactive `$transaction`. Engine transition và mọi mutator
 * nhận `tx` từ caller và chạy trong tx của caller — KHÔNG tự mở transaction riêng (tx lồng
 * nhau là hai tx độc lập, cổng atomic sẽ mất tác dụng).
 */
type PrismaTx = Prisma.TransactionClient;

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

/**
 * Trạng thái chiết khấu của Đơn trong response — approval MỚI NHẤT, nullable (Story 4.7).
 * Client cần biết để render banner/nút mà KHÔNG thấy khái niệm version/approval-list
 * (khuôn 4.1 "client không thấy version").
 */
export interface OrderDiscountView {
  readonly amount: number;
  readonly status: string;
  readonly requestNote: string | null;
  readonly resolveNote: string | null;
  readonly requestedAt: Date;
  readonly resolvedAt: Date | null;
}

/** Shape Đơn trong response — dòng đã phân giải qua `currentVersionId`. */
export type OrderView = Order & {
  lineItems: OrderLineView[];
  discount: OrderDiscountView | null;
};

/** Một dòng trong item chờ duyệt — biên ƯỚC TÍNH theo `Product.costPrice` hiện hành. */
export interface DiscountPendingLineView {
  readonly name: string;
  readonly qty: number;
  readonly unitPrice: number;
  readonly estimatedMarginPct: number | null;
}

/**
 * Một dòng của danh sách đơn (Story 5.3) — đủ để vẽ list, KHÔNG có tổng tiền và KHÔNG có bất
 * cứ dữ liệu giá vốn nào (AD-4/AD-10).
 */
export interface OrderListRow {
  readonly id: string;
  readonly status: string;
  readonly customerSdt: string;
  readonly customerName: string;
  readonly ownerAccountId: string;
  readonly assigneeAccountId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Một bản update trong lịch sử đơn (Story 5.4, FR-6) — KHÔNG có tiền/giá: lịch sử trả lời
 * "bản nào/ai/khi nào/đổi gì", tiền chỉ đi qua `preview-total` (AD-10).
 */
export interface OrderVersionRow {
  readonly id: string;
  readonly versionNo: number;
  readonly laBanHienLuc: boolean;
  readonly createdAt: Date;
  readonly chotAt: Date | null;
  readonly createdByAccountId: string | null;
  readonly createdByDisplayName: string | null;
  readonly soDong: number;
  readonly thayDoi: ThayDoiBanUpdate;
}

/**
 * Một dòng vật tư còn theo dõi bảo hành (Story 5.9). Mọi số ngày tháng do BACKEND tính —
 * client không có thư viện ngày và không được tự suy trạng thái.
 */
export interface WarrantyLineView {
  readonly id: string;
  readonly name: string;
  readonly qty: number;
  readonly unit: string;
  readonly warrantyMonths: number;
  /** Ngày DÒNG NÀY chốt lần đầu — mốc theo DÒNG, không theo Đơn (FR-36, AD-20). */
  readonly warrantyStartAt: Date;
  readonly warrantyEndAt: Date;
  /** Âm khi đã hết hạn — đây là số điều khiển `warrantyStatus`. */
  readonly remainingDays: number;
  readonly remainingMonths: number;
  readonly warrantyStatus: TrangThaiBaoHanh;
}

/** Một đơn trong kết quả tra cứu bảo hành — chỉ dòng của bản hiệu lực (AD-6). */
export interface WarrantyOrderView {
  readonly id: string;
  readonly status: string;
  readonly chotAt: Date | null;
  readonly lineItems: readonly WarrantyLineView[];
}

/** Kết quả `GET /orders/tra-cuu-bao-hanh` — "không có khách" là kết quả, không phải lỗi. */
export interface WarrantyLookupView {
  readonly found: boolean;
  readonly sdt: string;
  readonly customer: {
    readonly sdt: string;
    readonly name: string;
    readonly custType: string;
  } | null;
  readonly orders: readonly WarrantyOrderView[];
}

/** Một item danh sách chờ duyệt chiết khấu (FR-18/FR-37) — số backend tính (AD-16). */
export interface DiscountPendingView {
  readonly orderId: string;
  readonly customerSdt: string;
  readonly amount: number;
  readonly requestNote: string | null;
  readonly requestedByAccountId: string;
  readonly requestedByDisplayName: string;
  readonly requestedAt: Date;
  readonly subtotal: number;
  readonly afterDiscount: number;
  readonly lines: DiscountPendingLineView[];
}

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

/**
 * Sentinel abort transaction Áp chiết khấu (Story 4.7) — cùng khuôn `CHOT_GATE_THUA`: thua
 * cổng atomic `baogia → choduyet` rollback toàn tx (kể cả approval đã create), caller đọc lại
 * rồi trả 409 (áp KHÔNG idempotent-return — body mang amount, hai lần bấm khác nhau không
 * được im lặng nuốt).
 */
const AP_CK_GATE_THUA = new Error('ap-ck-gate-thua');

/**
 * Sentinel abort transaction Duyệt chiết khấu (Story 4.7) — cổng atomic nằm trên CHÍNH row
 * approval (`cho_duyet` → resolved): 2 người duyệt đồng thời đúng MỘT bên thắng; bên thua
 * đọc lại — cùng decision trả idempotent, ngược decision 409.
 */
const DUYET_CK_GATE_THUA = new Error('duyet-ck-gate-thua');

/**
 * Sentinel abort transaction Auto-transition (Story 5.2) — cùng khuôn `CHOT_GATE_THUA`: bên
 * thua cổng atomic rollback toàn tx, caller đọc lại rồi quyết. Khác một điểm: ở đường auto,
 * "đã tới đích" là RETRY chứ không phải xung đột ⇒ kẻ thua trả no-op im lặng, không 409.
 */
const TU_DONG_GATE_THUA = new Error('tu-dong-gate-thua');

/**
 * Sentinel abort transaction lane THỦ CÔNG (Story 5.5). Khác `TU_DONG_GATE_THUA` ở đúng chỗ
 * quan trọng nhất: thua cổng atomic ở đây là NGƯỜI BẤM HAI LẦN, và người bấm hai lần phải
 * biết lần nào ăn ⇒ 409, KHÔNG nuốt thành no-op.
 */
const THU_CONG_GATE_THUA = new Error('thu-cong-gate-thua');

/**
 * Sentinel abort transaction lane HUỶ ĐƠN (Story 5.7). Cùng luật với lane thủ công — người
 * bấm Huỷ mà thua cuộc đua phải ăn 409, không được nuốt thành no-op — nhưng là một OBJECT
 * RIÊNG: hai lane bắt sentinel theo IDENTITY, dùng chung một instance là để lane này nuốt
 * mất abort của lane kia khi hai request chạy song song.
 */
const HUY_GATE_THUA = new Error('huy-gate-thua');

/** Số ký tự tối thiểu của lý do huỷ SAU khi trim — chặn `"."` / `"x"` cho có lệ. */
const DO_DAI_LY_DO_TOI_THIEU = 3;

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
  /** Chỉ dùng cho lỗi ĐÃ NUỐT có chủ đích (xoá object R2 sau khi DB đã commit). */
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    // Dependency THỨ BA, chỉ cho lane chuyển trạng thái thủ công (5.5): ảnh bằng chứng đi
    // lên R2 qua port (AD-3). Nó ở ĐÂY chứ không ở một service riêng vì transition + ghi
    // metadata ảnh là MỘT `$transaction`, mà `applyTransition()` là `private` của service
    // này — tách ra buộc phải nới engine thành public, tức phá AD-11.
    private readonly storage: StoragePort,
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

  /**
   * Đọc TRẦN, không phạm vi — chỉ dành cho đường hệ thống không có người gọi
   * (`chuyenTrangThaiTuDong`) và cho lần đọc LẠI sau khi `findScopedOrThrow` đã qua.
   */
  private async findOrThrow(id: string): Promise<Order> {
    return this.findOrThrowIn(this.prisma, id);
  }

  /**
   * Như `findOrThrow` nhưng đọc qua client được truyền vào — dùng để đọc LẠI đơn BÊN TRONG
   * tx sau khi đã cầm khoá dòng. Đọc status ngoài tx rồi ghi trong tx là một lời hứa suông:
   * giữa hai thời điểm đó ai cũng chen vào được.
   */
  private async findOrThrowIn(tx: PrismaTx, id: string): Promise<Order> {
    const order = await tx.order.findUnique({ where: { id } });
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
   * Khoá dòng `orders` trong tx hiện tại — op ĐẦU TIÊN chạm DB của mọi đường đọc-rồi-ghi
   * trên một đơn. Postgres giữ khoá tới hết tx, nên hai request trên cùng đơn xếp hàng thay
   * vì cùng đọc một ảnh chụp rồi cùng ghi đè.
   *
   * `$queryRaw` template-tag ⇒ tham số bind, KHÔNG nội suy chuỗi. Precedent
   * `product-prices.service.ts` dùng dạng mảng `$transaction([ops])`; ở đây tx là
   * interactive nên phải `await tx.$queryRaw` bên trong callback.
   */
  private async lockOrderRow(tx: PrismaTx, orderId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
  }

  /**
   * ENGINE CHUYỂN TRẠNG THÁI — method DUY NHẤT toàn codebase có `status` trong `data` của
   * một lệnh ghi Prisma trên `order` (trừ `create()` lúc INSERT). Đây là hiện thực của AD-11.
   *
   * Chạy BÊN TRONG `$transaction` của caller. Thứ tự KHÔNG được đảo:
   *  1. `evaluateTransition()` — hợp lệ hay không quyết TRƯỚC khi đụng DB (từ chối không tốn
   *     một khoá nào, và không để lại dấu vết ghi nào để rollback).
   *  2. Khoá dòng đơn.
   *  3. Cổng atomic `updateMany` với `status` QUAN SÁT ĐƯỢC làm điều kiện WHERE — không
   *     hardcode literal: `chot` hợp lệ từ CẢ `baogia` LẪN `choduyet`, một literal sẽ âm
   *     thầm vô hiệu hoá nhánh còn lại.
   *  4. Thua cổng (`count === 0`) ⇒ ném sentinel của caller để rollback TOÀN tx; caller bắt
   *     theo IDENTITY (`error !== SENTINEL`), không `instanceof`.
   *
   * Trả về event `StatusChanged` CHƯA publish — caller publish SAU khi commit (AD-18). Engine
   * KHÔNG BAO GIỜ gọi `AuditService`: nó phát event, `AuditSubscriber` ghi log.
   */
  private async applyTransition(
    tx: PrismaTx,
    input: {
      readonly order: Order;
      readonly event: TransitionEvent;
      readonly actorPermissions: ReadonlySet<string>;
      readonly actorAccountId: string;
      readonly sentinel: Error;
      readonly occurredAt: Date;
    },
  ): Promise<StatusChanged> {
    const { order } = input;
    const ketQua = evaluateTransition({
      order,
      event: input.event,
      actorPermissions: input.actorPermissions,
      scopeFlags: {
        thietBi: order.scopeThietBi,
        thiCong: order.scopeThiCong,
        vanChuyen: order.scopeVanChuyen,
      },
    });
    if (!ketQua.ok) {
      // Envelope do `AllExceptionsFilter` dựng (AD-5) — service chỉ ném `AppException`.
      // Thiếu quyền là 403; ngoài bảng / sai cờ phạm vi là xung đột trạng thái ⇒ 409.
      if (ketQua.reason === 'permission') {
        throw new AppException(
          ErrorCode.FORBIDDEN,
          403,
          'Bạn không có quyền thực hiện chuyển trạng thái này.',
        );
      }
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        ketQua.reason === 'scope'
          ? 'Bước này không thuộc phạm vi của đơn.'
          : 'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
      );
    }

    await this.lockOrderRow(tx, order.id);
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: ketQua.to },
    });
    if (count === 0) throw input.sentinel;

    const after: Order = { ...order, status: ketQua.to };
    return new StatusChanged(
      input.actorAccountId,
      orderSnapshot(order),
      orderSnapshot(after),
      input.occurredAt,
    );
  }

  /**
   * CỬA VÀO CÔNG KHAI DUY NHẤT cho auto-transition (Story 5.2, AD-11/AD-7) — `payments/`
   * (7.2) và `inventory/` (6.x) gọi method NÀY thay vì phát minh một đường ghi status riêng.
   *
   * Method này KHÔNG sở hữu một luật transition nào: hợp lệ hay không vẫn do CÙNG
   * `applyTransition()` mà `confirm`/`revise`/`applyDiscount` đi qua, và đích đến vẫn do
   * bảng quyết. Nó chỉ sở hữu ba thứ: cổng no-op, ranh giới transaction, và publish.
   *
   * QUYỀN LÀ CỦA ACTOR THẬT, KHÔNG CÓ BYPASS: `actorPermissions` nhận TỪ CALLER (controller
   * resolve tươi mỗi request qua `AccountPermissionsService`) — không có tham số "chạy với
   * toàn quyền", không có hằng toàn quyền trong `orders/`. Sự kiện auto luôn có con người ở
   * đầu nguồn: người ghi nhận thanh toán cầm `payments.record`, đúng key mà dòng `duCoc` đòi.
   * Nhờ vậy gate AD-7 còn hiệu lực VÀ audit truy được về người thật.
   *
   * IDEMPOTENT (NFR-1 — caller đầu tiên của cửa này là ghi nhận tiền, phải retry được an
   * toàn): đơn đã ở CHÍNH đích của sự kiện ⇒ no-op im lặng, không đổi status, không event
   * thứ hai, không dòng audit thứ hai, KHÔNG 409. Cổng suy từ BẢNG (`daTaiDich`), không từ
   * một danh sách cặp status/event chép tay ở đây.
   *
   * ⚠️ RANH GIỚI TRANSACTION: method tự mở transaction của NÓ, không chạy trong tx của
   * caller — `payments/` không được cầm `tx` của `orders/` (hai module, hai aggregate) và
   * engine cần khoá dòng đơn ở đúng phạm vi của mình. Đánh đổi phải biết: giữa "Payment
   * commit" và "status đổi" có một khe; chấp nhận được vì cửa này idempotent nên caller
   * retry được.
   *
   * Chỉ MỘT event: `StatusChanged`. Event nghiệp vụ đi kèm (`DepositRecorded`…) là của
   * `payments/` ở 7.2, không phải của `orders/`.
   */
  async chuyenTrangThaiTuDong(input: {
    readonly orderId: string;
    readonly event: TransitionEvent;
    readonly actorAccountId: string;
    readonly actorPermissions: ReadonlySet<string>;
  }): Promise<void> {
    const before = await this.findOrThrow(input.orderId);
    // FAST-PATH no-op: sự kiện tới lần thứ hai (retry mạng / ghi nhận thanh toán lặp) trên
    // một đơn đã ở đích — không mở transaction, không khoá, không publish.
    if (daTaiDich(before.status, input.event)) return;

    // MỘT timestamp cho MỘT sự kiện.
    const occurredAt = new Date();
    let statusChanged: StatusChanged;
    try {
      statusChanged = await this.prisma.$transaction(async (tx) =>
        // Engine là op ĐẦU TIÊN của tx: đánh giá guard → khoá dòng → cổng atomic theo status
        // quan sát được → sentinel nếu thua.
        this.applyTransition(tx, {
          order: before,
          event: input.event,
          actorPermissions: input.actorPermissions,
          actorAccountId: input.actorAccountId,
          sentinel: TU_DONG_GATE_THUA,
          occurredAt,
        }),
      );
    } catch (error) {
      // Bắt theo IDENTITY — mọi lỗi khác (403, 409 ngoài bảng/sai cờ) ném tiếp nguyên vẹn.
      if (error !== TU_DONG_GATE_THUA) throw error;
      // Thua cuộc đua: đọc lại sự thật. Nếu đơn đã ở đích thì kẻ thua vừa thấy đúng kết quả
      // mình muốn ⇒ no-op, không 409 (hai lần ghi nhận cùng một khoản tiền không được biến
      // thành một lỗi cho người dùng).
      const current = await this.findOrThrow(input.orderId);
      if (daTaiDich(current.status, input.event)) return;
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
      );
    }

    // SAU commit (AD-18) — producer không gọi audit/FCM trực tiếp.
    await this.eventBus.publish(statusChanged);
  }

  /**
   * CỬA VÀO CÔNG KHAI cho lane chuyển trạng thái THỦ CÔNG (Story 5.5, FR-9/FR-23) — màn
   * "Chuyển trạng thái" gọi method NÀY.
   *
   * KHÔNG tái dùng `chuyenTrangThaiTuDong()`: lane đó nuốt "đã ở đích" thành no-op im lặng
   * (đúng cho retry thanh toán), còn ở đây "đã ở đích" là người bấm hai lần và phải ăn 409.
   *
   * THỨ TỰ BẮT BUỘC — mỗi bước đứng trước bước sau vì một lý do, đảo là hỏng:
   *  1. Đọc đơn qua `findScopedOrThrow` — phạm vi đóng ở ĐƯỜNG ĐỌC DÙNG CHUNG, endpoint
   *     không thể quên.
   *  2. Chặn sự kiện ngoài `SU_KIEN_THU_CONG` — TRƯỚC `evaluateTransition()`, vì năm sự kiện
   *     kia HỢP LỆ với bảng: để engine trả `ok` rồi mới chặn là đã tin vào thứ tự may rủi.
   *  3. Pre-check thuần `evaluateTransition()` — từ chối 403/409 TRƯỚC khi trả tiền bytes lên
   *     R2. Đây KHÔNG phải lớp bảo mật thứ hai: engine dưới row lock vẫn là quyền lực cuối.
   *  4. Validate file — sai định dạng/dung lượng ⇒ 400 và transition KHÔNG chạy (AC-9).
   *  5. Upload R2.
   *  6. `$transaction`: engine ghi status → `createMany` metadata ảnh với CÙNG `occurredAt`.
   *     Transition bị từ chối trong tx ⇒ rollback ⇒ KHÔNG hàng `Attachment` nào (AC-7).
   *  7. Publish SAU commit (AD-18).
   *
   * `occurredAt` là MỘT biến `Date` cho cả lượt — nó vừa là `occurredAt` của `StatusChanged`
   * (tức của hàng audit mà subscriber ghi) vừa là cột `occurred_at` của mọi ảnh trong lượt.
   * Đó chính là khoá nối ảnh vào bước, đúng bốn toạ độ FR-23. Hai lần `new Date()` sẽ đẻ ra
   * hai "lúc" cho một việc và cắt đứt khoá đó.
   */
  async chuyenTrangThaiThuCong(input: {
    readonly callerAccountId: string;
    readonly quyen: ReadonlySet<string>;
    readonly orderId: string;
    readonly event: TransitionEvent;
    readonly anh: readonly (AnhTaiLen & { readonly buffer: Buffer })[];
  }): Promise<{
    readonly status: OrderStatusKey;
    readonly occurredAt: Date;
    readonly soAnhDaLuu: number;
  }> {
    const before = await this.findScopedOrThrow(
      input.callerAccountId,
      input.quyen,
      input.orderId,
    );

    if (!SU_KIEN_THU_CONG.includes(input.event)) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Bước này không chuyển được ở màn Chuyển trạng thái.',
      );
    }

    const preCheck = evaluateTransition({
      order: before,
      event: input.event,
      actorPermissions: input.quyen,
      scopeFlags: {
        thietBi: before.scopeThietBi,
        thiCong: before.scopeThiCong,
        vanChuyen: before.scopeVanChuyen,
      },
    });
    if (!preCheck.ok) {
      if (preCheck.reason === 'permission') {
        throw new AppException(
          ErrorCode.FORBIDDEN,
          403,
          'Bạn không có quyền thực hiện chuyển trạng thái này.',
        );
      }
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        preCheck.reason === 'scope'
          ? 'Bước này không thuộc phạm vi của đơn.'
          : 'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
      );
    }

    const loiFile = kiemTraAnh(input.anh);
    if (loiFile.length > 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Ảnh đính kèm không hợp lệ.',
        [...loiFile],
      );
    }

    // Id sinh TRƯỚC upload: object key phải deterministic để hàng DB và bytes trên R2 trỏ
    // đúng nhau, và để `createMany` (không trả id) vẫn ghi được đúng key đã upload.
    const anhDaLen = input.anh.map((file) => {
      const id = randomUUID();
      return {
        id,
        file,
        objectKey: `attachments/${input.orderId}/${id}.${duoiTuMime(file.mimetype)}`,
      };
    });
    for (const item of anhDaLen) {
      await this.storage.putObject(
        item.objectKey,
        item.file.buffer,
        item.file.mimetype,
      );
    }

    const occurredAt = new Date();
    let statusChanged: StatusChanged;
    try {
      statusChanged = await this.prisma.$transaction(async (tx) => {
        const event = await this.applyTransition(tx, {
          order: before,
          event: input.event,
          actorPermissions: input.quyen,
          actorAccountId: input.callerAccountId,
          sentinel: THU_CONG_GATE_THUA,
          occurredAt,
        });
        if (anhDaLen.length > 0) {
          await tx.attachment.createMany({
            data: anhDaLen.map((item) => ({
              id: item.id,
              orderId: input.orderId,
              uploadedByAccountId: input.callerAccountId,
              objectKey: item.objectKey,
              // Dọn NGAY LÚC GHI, không lúc đọc: tên này còn đi vào gallery của 5.6 và mọi
              // chỗ khác đọc cột. Một chỗ dọn, mọi consumer an toàn.
              fileName: tenFileAnToan(item.file.originalname),
              contentType: item.file.mimetype,
              size: item.file.size,
              statusFrom: before.status,
              statusTo: preCheck.to,
              occurredAt,
            })),
          });
        }
        return event;
      });
    } catch (error) {
      if (error !== THU_CONG_GATE_THUA) throw error;
      // Thua cổng atomic = một lượt chuyển khác đã commit trước trong khoảng giữa pre-check
      // và row lock. Lane thủ công BÁO LỖI, không no-op: người bấm cần biết lần bấm của
      // mình không phải lần ăn.
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
      );
    }

    await this.eventBus.publish(statusChanged);

    return {
      status: preCheck.to,
      occurredAt,
      soAnhDaLuu: anhDaLen.length,
    };
  }

  /**
   * CỬA VÀO CÔNG KHAI DUY NHẤT cho HUỶ ĐƠN kèm lý do (Story 5.7, FR-9) — `POST /:id/huy`.
   *
   * Vì sao là một cửa riêng chứ không phải một sự kiện của lane thủ công: lý do là BẮT BUỘC,
   * và một `applyTransition` trần không có chỗ nào enforce điều đó. Đưa `huy` vào
   * `SU_KIEN_THU_CONG` sẽ mở đúng một đường huỷ đơn không cần lý do.
   *
   * THỨ TỰ BẮT BUỘC:
   *  1. `findScopedOrThrow` — ngoài phạm vi ⇒ 404 CÙNG thông điệp với không tồn tại.
   *  2. Validate lý do — luật NGHIỆP VỤ ("rỗng sau trim") sống ở đây, không ở DTO: decorator
   *     quá chặt khiến `ValidationPipe` trả 400 bằng một envelope khác trước khi service chạy.
   *  3. Pre-check thuần `evaluateTransition()` — 403/409 CÓ THÔNG ĐIỆP trước khi mở
   *     transaction. Không phải lớp bảo mật thứ hai: engine dưới row lock vẫn là quyền cuối.
   *  4. `$transaction`: engine ghi status → `update` hai cột lý do. Rollback ⇒ không cột nào
   *     đổi và status cũng không.
   *  5. Publish SAU commit (AD-18), `StatusChanged` rồi `OrderCancelled`.
   *
   * ⚠️ Lệnh `update` ở bước 4 KHÔNG ghi field `status` — AD-11 còn nguyên, engine vẫn là nơi
   * duy nhất đổi status. Nhét `cancelReason` vào chữ ký `applyTransition()` sẽ đổi hợp đồng
   * của một engine đang phục vụ ba lane khác.
   *
   * ⚠️ AC-11 — KHÔNG một lệnh nào ở đây chạm tồn kho. Không có model tồn kho nào tồn tại; việc
   * giải phóng chỗ giữ / phiếu nhập trả thuộc Epic 6.7 và nối vào qua `OrderCancelled`.
   *
   * Đơn ĐÃ ở `huy` ⇒ 409 (bảng không có cạnh `huy → huy`), KHÔNG no-op như lane auto: đây là
   * người bấm nút, và người bấm hai lần cần biết lần nào ăn.
   */
  async huyDon(input: {
    readonly callerAccountId: string;
    readonly quyen: ReadonlySet<string>;
    readonly orderId: string;
    readonly lyDo: string;
  }): Promise<{
    readonly status: OrderStatusKey;
    readonly occurredAt: Date;
  }> {
    const before = await this.findScopedOrThrow(
      input.callerAccountId,
      input.quyen,
      input.orderId,
    );

    const lyDo = input.lyDo.trim();
    if (lyDo.length < DO_DAI_LY_DO_TOI_THIEU) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Cần lý do khi huỷ đơn.',
        [
          {
            field: 'lyDo',
            code: 'required',
            message: `Lý do huỷ là bắt buộc, tối thiểu ${DO_DAI_LY_DO_TOI_THIEU} ký tự.`,
          },
        ],
      );
    }

    const preCheck = evaluateTransition({
      order: before,
      event: SU_KIEN.huy,
      actorPermissions: input.quyen,
      scopeFlags: {
        thietBi: before.scopeThietBi,
        thiCong: before.scopeThiCong,
        vanChuyen: before.scopeVanChuyen,
      },
    });
    if (!preCheck.ok) {
      if (preCheck.reason === 'permission') {
        throw new AppException(
          ErrorCode.FORBIDDEN,
          403,
          'Bạn không có quyền huỷ đơn này.',
        );
      }
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Không huỷ được đơn ở trạng thái hiện tại.',
      );
    }

    // MỘT timestamp cho MỘT sự kiện — cột `cancelledAt`, `StatusChanged` (tức hàng audit) và
    // `OrderCancelled` phải cùng một "lúc", nếu không lý do và vết audit không nối được nhau.
    const occurredAt = new Date();
    let statusChanged: StatusChanged;
    try {
      statusChanged = await this.prisma.$transaction(async (tx) => {
        const event = await this.applyTransition(tx, {
          order: before,
          event: SU_KIEN.huy,
          actorPermissions: input.quyen,
          actorAccountId: input.callerAccountId,
          sentinel: HUY_GATE_THUA,
          occurredAt,
        });
        await tx.order.update({
          where: { id: input.orderId },
          data: { cancelReason: lyDo, cancelledAt: occurredAt },
        });
        return event;
      });
    } catch (error) {
      if (error !== HUY_GATE_THUA) throw error;
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Không huỷ được đơn ở trạng thái hiện tại.',
      );
    }

    await this.eventBus.publish(statusChanged);
    await this.eventBus.publish(
      new OrderCancelled(
        input.callerAccountId,
        input.orderId,
        lyDo,
        before.status,
        before.currentVersionId,
        occurredAt,
      ),
    );

    return { status: preCheck.to, occurredAt };
  }

  /**
   * Bytes của MỘT ảnh đính kèm, sau khi đã khẳng định đơn nằm trong phạm vi người gọi
   * (AD-3: bucket không public, mọi byte đi qua backend).
   *
   * ⚠️ `findScopedOrThrow` chạy TRƯỚC khi chạm R2 — khác `getExportFile()` của
   * `QuoteExportService`, vốn không nhận caller và không scope (nợ ghi nhận ở 5.4). Ảnh bằng
   * chứng của công trường là dữ liệu của đơn, nên nó chịu ĐÚNG phạm vi của đơn.
   *
   * Ảnh không thuộc đơn này ⇒ 404 CÙNG thông điệp với ảnh không tồn tại: 403 sẽ xác nhận
   * ảnh có thật, một bit rò ra cho người không được thấy nó.
   */
  async anhDinhKem(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    orderId: string,
    attachmentId: string,
  ): Promise<{
    readonly body: Buffer;
    readonly contentType: string;
    readonly fileName: string;
  }> {
    await this.findScopedOrThrow(callerAccountId, quyen, orderId);
    const row = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, orderId },
    });
    if (row === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        'Không tìm thấy ảnh đính kèm.',
      );
    }
    const { body } = await this.storage.getObject(row.objectKey);
    return { body, contentType: row.contentType, fileName: row.fileName };
  }

  /**
   * `GET /orders/:id/anh` — DANH SÁCH PHẲNG mọi ảnh của đơn: cả ảnh gắn vào một bước (5.5,
   * `statusTo != null`) lẫn ảnh bổ sung (5.6, `statusTo == null`), FR-24.
   *
   * Sắp theo `createdAt` giảm dần chứ KHÔNG theo `occurredAt`: cột đó `null` cho mọi ảnh bổ
   * sung ⇒ dùng nó sắp thì nửa danh sách có vị trí không xác định.
   *
   * `objectKey` KHÔNG vào DTO (AD-3): key R2 là chi tiết hạ tầng, client không cần và không
   * được biết — mọi byte đi qua route proxy đã scope.
   */
  async danhSachAnh(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    orderId: string,
  ): Promise<
    readonly {
      readonly id: string;
      readonly fileName: string;
      readonly contentType: string;
      readonly size: number;
      readonly createdAt: Date;
      readonly nguoiTaiLen: string;
      readonly statusFrom: string | null;
      readonly statusTo: string | null;
      readonly coTheXoa: boolean;
    }[]
  > {
    await this.findScopedOrThrow(callerAccountId, quyen, orderId);
    const rows = await this.prisma.attachment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { displayName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      size: row.size,
      createdAt: row.createdAt,
      nguoiTaiLen: row.uploadedBy.displayName,
      statusFrom: row.statusFrom,
      statusTo: row.statusTo,
      coTheXoa: this.xoaDuocAnh(callerAccountId, quyen, row.uploadedByAccountId),
    }));
  }

  /**
   * Luật xoá ảnh của FR-24 — MỘT chỗ, ở backend: người đã tải lên HOẶC người có quyền chỉnh
   * sửa đơn. Client chỉ hiển thị cờ này, KHÔNG dựng lại biểu thức (AD-2/AD-4) — bản sao luật
   * thứ hai chắc chắn sẽ lệch.
   *
   * `quotesCreateEdit` chính là "quyền chỉnh sửa đơn" trong repo này: registry không có
   * `orders.edit`, và key đó đang gate mọi đường ghi đơn hiện có.
   */
  private xoaDuocAnh(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    uploadedByAccountId: string,
  ): boolean {
    return (
      uploadedByAccountId === callerAccountId || quyen.has(PERM.quotesCreateEdit)
    );
  }

  /**
   * `POST /orders/:id/anh` — thêm ảnh bổ sung NGOÀI luồng chuyển trạng thái (FR-24).
   *
   * THỨ TỰ BẮT BUỘC: phạm vi → validate → upload R2 → ghi DB → publish. Validate đứng TRƯỚC
   * R2 vì một lượt 400 mà bytes đã lên bucket là rác vĩnh viễn không hàng DB nào trỏ tới.
   *
   * Ba cột toạ độ ghi `null` CÓ CHỦ ĐÍCH: những hàng này không thuộc bước nào. Ghi trạng thái
   * hiện tại vào đó là bịa ra một transition không ai bấm và làm hỏng ngữ nghĩa FR-23.
   *
   * KHÔNG gọi `applyTransition`, KHÔNG đọc/ghi `Order.status` — đây là đường ghi metadata.
   */
  async themAnh(input: {
    readonly callerAccountId: string;
    readonly quyen: ReadonlySet<string>;
    readonly orderId: string;
    readonly anh: readonly (AnhTaiLen & { readonly buffer: Buffer })[];
  }): Promise<{
    readonly soAnhDaLuu: number;
    readonly attachmentIds: readonly string[];
  }> {
    await this.findScopedOrThrow(
      input.callerAccountId,
      input.quyen,
      input.orderId,
    );

    // Một lượt rỗng KHÔNG phải lỗi ở `kiemTraAnh()`: kèm ảnh là optional cho
    // chuyển trạng thái (FR-23), nên domain nói mảng rỗng là hợp lệ. Ở ĐÂY thì
    // khác — cả route này chỉ có một việc là thêm ảnh. Cho nó đi tiếp sẽ ghi một
    // hàng audit `AttachmentAdded` nói rằng đã thêm ảnh trong khi không có ảnh
    // nào, và một vết audit sai còn tệ hơn không có vết nào.
    if (input.anh.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Ảnh đính kèm không hợp lệ.',
        [{ field: 'anh', code: 'minCount', message: 'Chọn ít nhất 1 ảnh.' }],
      );
    }

    const loiFile = kiemTraAnh(input.anh);
    if (loiFile.length > 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Ảnh đính kèm không hợp lệ.',
        [...loiFile],
      );
    }

    // Id sinh TRƯỚC upload: `createMany` không trả id, nên đây là cách DUY NHẤT object key và
    // hàng DB trỏ đúng nhau VÀ `AttachmentAdded` có `attachmentIds`.
    const anhDaLen = input.anh.map((file) => {
      const id = randomUUID();
      return {
        id,
        file,
        objectKey: `attachments/${input.orderId}/${id}.${duoiTuMime(file.mimetype)}`,
      };
    });
    for (const item of anhDaLen) {
      await this.storage.putObject(
        item.objectKey,
        item.file.buffer,
        item.file.mimetype,
      );
    }

    await this.prisma.attachment.createMany({
      data: anhDaLen.map((item) => ({
        id: item.id,
        orderId: input.orderId,
        uploadedByAccountId: input.callerAccountId,
        objectKey: item.objectKey,
        fileName: tenFileAnToan(item.file.originalname),
        contentType: item.file.mimetype,
        size: item.file.size,
        statusFrom: null,
        statusTo: null,
        occurredAt: null,
      })),
    });

    await this.eventBus.publish(
      new AttachmentAdded(
        input.callerAccountId,
        input.orderId,
        anhDaLen.map((item) => item.id),
        anhDaLen.length,
        new Date(),
      ),
    );

    return {
      soAnhDaLuu: anhDaLen.length,
      attachmentIds: anhDaLen.map((item) => item.id),
    };
  }

  /**
   * `DELETE /orders/:id/anh/:attachmentId` — xoá HẲN một ảnh (hard delete, FR-24).
   *
   * Vết xoá nằm ở `audit_logs` (append-only) qua `AttachmentRemoved`, nên không cần cột
   * soft-delete — thêm nó là thêm một trạng thái phải lọc ở mọi truy vấn về sau.
   *
   * ⚠️ THỨ TỰ DB TRƯỚC, R2 SAU. Xoá R2 trước rồi DB fail ⇒ hàng còn đó trỏ vào bytes không
   * tồn tại ⇒ gallery vỡ. Chiều này hỏng chỉ để lại bytes mồ côi — vô hình với mọi endpoint
   * vì không còn hàng nào trỏ tới. Vì vậy lỗi R2 bị NUỐT: một lần xoá đã commit không được
   * biến thành 500 cho người dùng.
   */
  async xoaAnh(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    orderId: string,
    attachmentId: string,
  ): Promise<void> {
    await this.findScopedOrThrow(callerAccountId, quyen, orderId);
    const row = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, orderId },
    });
    if (row === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        'Không tìm thấy ảnh đính kèm.',
      );
    }

    if (!this.xoaDuocAnh(callerAccountId, quyen, row.uploadedByAccountId)) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        403,
        'Bạn không có quyền xoá ảnh này.',
      );
    }

    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    await this.eventBus.publish(
      new AttachmentRemoved(
        callerAccountId,
        orderId,
        attachmentId,
        row.fileName,
        new Date(),
      ),
    );

    try {
      await this.storage.deleteObject(row.objectKey);
    } catch (error) {
      this.logger.warn(
        `Xoá object R2 thất bại (bytes mồ côi, không ảnh hưởng người dùng): ${row.objectKey} — ${String(error)}`,
      );
    }
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
        data: {
          id: versionId,
          orderId,
          versionNo: 1,
          createdByAccountId: actorAccountId,
        },
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
    // Đơn vừa tạo trong chính tx này chưa thể có approval nào — không cần query.
    return { ...order, lineItems: [], discount: null };
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
    const totals = computeOrderTotals({
      lines: dto.lines,
      vatRate: vatRatePercent,
      applyVat: vatApplies(dto.vatMode ?? null),
      // Chiết khấu echo (Story 4.7) — client gửi lại con số backend đã trả trên
      // `order.discount`, KHÔNG tự tính; vắng field = không chiết khấu.
      discountAmount: dto.discountAmount ?? 0,
    });
    if (totals.discountAmount > totals.subtotal) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Mức chiết khấu vượt quá tổng tiền hàng.',
        [
          {
            field: 'discountAmount',
            code: 'max',
            message: 'Mức chiết khấu không được vượt quá tổng tiền hàng.',
          },
        ],
      );
    }
    return totals;
  }

  /**
   * ĐƯỜNG ĐỌC SCOPED DÙNG CHUNG DUY NHẤT cho mọi endpoint đọc-theo-id của màn chi tiết
   * (`GET /:id`, `/:id/vong-doi`, `/:id/phien-ban`) VÀ là lần đọc ĐẦU TIÊN của mọi đường
   * GHI do người gọi kích hoạt (sửa/chốt/mở lại/chiết khấu/dòng/xuất báo giá…): không xem
   * được đơn thì cũng không sửa được nó. Một chỗ đóng phạm vi ⇒ endpoint mới KHÔNG THỂ quên
   * nó — source-guard `no-unscoped-order-write.spec.ts` canh điều đó.
   *
   * Ngoài phạm vi và không tồn tại trả CÙNG một 404 với CÙNG thông điệp: 403 sẽ xác nhận đơn
   * có tồn tại — một bit rò ra cho người không được thấy nó (AD-4/AD-15).
   *
   * Gom `where.AND` như `list()`: gán thẳng `where.OR` sẽ bị mệnh đề lọc khác chiếm chỗ.
   */
  private async findScopedOrThrow(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    id: string,
  ): Promise<Order> {
    const order = await this.prisma.order.findFirst({
      where: {
        AND: [{ id }, ...this.dieuKienPhamVi(callerAccountId, quyen)],
      },
    });
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
   * Mệnh đề phạm vi DUY NHẤT trên `Order`: `view_all` ⇒ không thêm gì; còn lại ⇒ người gọi là
   * owner HOẶC assignee. Trả MẢNG để gom vào `AND` (gán thẳng `OR` sẽ bị bộ lọc khác chiếm chỗ).
   */
  private dieuKienPhamVi(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
  ): Prisma.OrderWhereInput[] {
    if (quyen.has(PERM.ordersViewAll)) return [];
    return [
      {
        OR: [
          { ownerAccountId: callerAccountId },
          { assigneeAccountId: callerAccountId },
        ],
      },
    ];
  }

  /**
   * Cửa phạm vi cho service KHÁC trong module (`QuoteExportService`) phải chặn đơn ngoài phạm vi
   * TRƯỚC khi chạm R2, mà không cần dựng cả view như `getScoped()` (live-resolve giá từng dòng).
   * Cùng mệnh đề, cùng 404 với `findScopedOrThrow`.
   */
  async assertScoped(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    orderId: string,
  ): Promise<void> {
    await this.findScopedOrThrow(callerAccountId, quyen, orderId);
  }

  /** `GET /orders/:id` — đơn trong phạm vi người gọi, kèm dòng của bản hiệu lực. */
  async getScoped(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    id: string,
    tieredPricingEnabled: boolean,
  ): Promise<OrderView> {
    const order = await this.findScopedOrThrow(callerAccountId, quyen, id);
    return this.viewOf(order, tieredPricingEnabled);
  }

  /**
   * Chuỗi bước vòng đời của đơn (Story 5.4) — KHÔNG đi qua `viewOf()`: endpoint này không
   * trả dòng và không trả tiền, kéo `toViews` vào là gánh live-resolve giá vô ích.
   */
  async lifecycle(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    id: string,
  ): Promise<{
    readonly buoc: readonly BuocVongDoi[];
    readonly buocKeTiep: readonly BuocKeTiep[];
    readonly coTheHuy: boolean;
  }> {
    const order = await this.findScopedOrThrow(callerAccountId, quyen, id);
    const scopeFlags = {
      thietBi: order.scopeThietBi,
      thiCong: order.scopeThiCong,
      vanChuyen: order.scopeVanChuyen,
    };
    const status = order.status as OrderStatusKey;
    // Hai câu trả lời cho CÙNG một lần đọc đơn: stepper vẽ gì (5.4) và người này bấm được
    // bước nào (5.5). Đẻ route thứ hai cho vế sau là thêm một request cho cùng một câu hỏi.
    return {
      buoc: buocVongDoi(status, scopeFlags),
      buocKeTiep: buocKeTiep(status, scopeFlags, quyen),
      // Câu trả lời THỨ BA cho cùng một lần đọc đơn (5.7): nút "Huỷ đơn" hiện hay ẩn.
      // `huy` KHÔNG BAO GIỜ có trong `buocKeTiep` (nó không thuộc lane thủ công), nên client
      // không có cách nào suy ra cờ này từ hai mảng trên — và AD-2 cấm nó tự suy từ status.
      coTheHuy: coTheHuy(status, quyen),
    };
  }

  /**
   * Lịch sử MỌI bản update của đơn theo `versionNo` tăng dần (FR-6, AD-6).
   *
   * `laBanHienLuc` so CON TRỎ `Order.currentVersionId` — AD-6 cấm suy bằng `versionNo` lớn
   * nhất hay timestamp: sau mở-lại/hoàn tác con trỏ có thể trỏ bản KHÔNG phải bản mới nhất.
   *
   * KHÔNG trả tiền/giá (AD-10 + fence `costs.view`).
   */
  async listVersions(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    orderId: string,
  ): Promise<readonly OrderVersionRow[]> {
    const order = await this.findScopedOrThrow(callerAccountId, quyen, orderId);
    const versions = await this.prisma.orderVersion.findMany({
      where: { orderId },
      orderBy: { versionNo: 'asc' },
      include: {
        createdBy: true,
        lineItems: { orderBy: { displayOrder: 'asc' } },
      },
    });

    return versions.map((version, i) => ({
      id: version.id,
      versionNo: version.versionNo,
      laBanHienLuc: version.id === order.currentVersionId,
      createdAt: version.createdAt,
      chotAt: version.chotAt,
      createdByAccountId: version.createdByAccountId,
      createdByDisplayName: version.createdBy?.displayName ?? null,
      soDong: version.lineItems.length,
      // Bản đầu tiên không có gì để so — ba mảng rỗng.
      thayDoi: diffDong(
        i === 0 ? [] : versions[i - 1].lineItems,
        i === 0 ? [] : version.lineItems,
      ),
    }));
  }

  /**
   * Tra cứu bảo hành theo SĐT khách (Story 5.9, FR-36) — ĐỌC THUẦN: không event, không ghi.
   *
   * Ba thứ backend làm hộ client, mỗi thứ vì một lý do khác nhau:
   *  - **Chuẩn hoá SĐT** qua `normalizeVnPhone` — hàm DUY NHẤT biết cách dựng khoá chính
   *    `Customer` (AD-9); client gửi chuỗi thô đúng như nhân viên gõ lúc khách gọi tới.
   *  - **Số học ngày tháng** qua `domain/warranty` — cả web lẫn mobile đều không có thư viện
   *    ngày, nên "start + N tháng" ở client là hai bản cài đặt của cùng một quy tắc có bẫy.
   *  - **Phạm vi đọc** theo đúng mệnh đề của `findScopedOrThrow` — một đường tra cứu bỏ qua
   *    phạm vi là một lỗ IDOR ngay cạnh nơi 5.3 vừa bịt.
   *
   * `now` là THAM SỐ (mặc định mốc hiện tại) và được lấy MỘT lần: mọi dòng phải so cùng một
   * mốc, và test biên cần một mốc xác định.
   */
  async traCuuBaoHanh(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    sdtTho: string,
    now: Date = new Date(),
  ): Promise<WarrantyLookupView> {
    const sdt = normalizeVnPhone(sdtTho);
    if (sdt === null) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Số điện thoại không hợp lệ.',
        [
          {
            field: 'sdt',
            code: 'isPhoneNumber',
            message:
              'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).',
          },
        ],
      );
    }

    const customer = await this.prisma.customer.findUnique({ where: { sdt } });
    // Khách chưa có trong hệ thống là KẾT QUẢ hợp lệ của một phép tra, không phải lỗi — 404 ở
    // đây buộc màn bắt exception cho một đường đi thành công (khuôn `customers/lookup`).
    if (customer === null) {
      return { found: false, sdt, customer: null, orders: [] };
    }

    const dieuKienPhamVi: Prisma.OrderWhereInput[] = [];
    if (!quyen.has(PERM.ordersViewAll)) {
      dieuKienPhamVi.push({
        OR: [
          { ownerAccountId: callerAccountId },
          { assigneeAccountId: callerAccountId },
        ],
      });
    }
    const orders = await this.prisma.order.findMany({
      where: { customerSdt: sdt, AND: dieuKienPhamVi },
      include: { currentVersion: true },
      orderBy: { createdAt: 'desc' },
    });

    // Đơn chưa chốt không có bản hiệu lực — lọc TRƯỚC khi dựng `in`, đừng để `null` lọt vào.
    const banHieuLuc = orders
      .map((order) => order.currentVersionId)
      .filter((id): id is string => id !== null);

    // Dòng KHÔNG có bảo hành (công lắp, phí vận chuyển) bị loại ngay ở tầng API: endpoint tên
    // là "tra cứu bảo hành", trả dòng không bảo hành là nhiễu cho người đang nghe máy.
    const lines =
      banHieuLuc.length === 0
        ? []
        : await this.prisma.orderLineItem.findMany({
            where: {
              orderVersionId: { in: banHieuLuc },
              warrantyMonths: { not: null },
              warrantyStartAt: { not: null },
            },
            orderBy: { displayOrder: 'asc' },
          });

    const theoBan = new Map<string, WarrantyLineView[]>();
    for (const line of lines) {
      // Hai field đã được `where` lọc, ép kiểu ở đây chỉ để TS thấy điều đó.
      const startAt = line.warrantyStartAt as Date;
      const months = line.warrantyMonths as number;
      const endAt = tinhHanBaoHanh(startAt, months);
      const ngayConLai = soNgayConLai(endAt, now);
      const cua = theoBan.get(line.orderVersionId) ?? [];
      cua.push({
        id: line.id,
        name: line.name,
        qty: line.qty,
        unit: line.unit,
        warrantyMonths: months,
        warrantyStartAt: startAt,
        warrantyEndAt: endAt,
        remainingDays: ngayConLai,
        remainingMonths: soThangConLai(endAt, now),
        warrantyStatus: trangThaiBaoHanh(ngayConLai),
      });
      theoBan.set(line.orderVersionId, cua);
    }

    return {
      found: true,
      sdt,
      customer: {
        sdt: customer.sdt,
        name: customer.name,
        custType: customer.custType,
      },
      orders: orders.flatMap((order) => {
        const lineItems =
          order.currentVersionId === null
            ? []
            : (theoBan.get(order.currentVersionId) ?? []);
        // Đơn không còn dòng bảo hành nào biến mất khỏi kết quả (không phải hiện rỗng).
        if (lineItems.length === 0) return [];
        return [
          {
            id: order.id,
            status: order.status,
            chotAt: order.currentVersion?.chotAt ?? null,
            lineItems,
          },
        ];
      }),
    };
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
      discount: await this.latestDiscountViewOf(order.id),
    };
  }

  /**
   * Approval MỚI NHẤT của đơn ⇒ `OrderDiscountView` nullable — sau từ chối, đơn `baogia`
   * vẫn mang `status: 'tu_choi'` + `resolveNote` cho banner lý do; áp lại thì approval mới
   * đè vai trò "mới nhất" (row cũ nằm lại làm hồ sơ).
   */
  private async latestDiscountViewOf(
    orderId: string,
  ): Promise<OrderDiscountView | null> {
    const approval = await this.prisma.discountApproval.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (approval === null) return null;
    return {
      amount: approval.amount,
      status: approval.status,
      requestNote: approval.requestNote,
      resolveNote: approval.resolveNote,
      requestedAt: approval.createdAt,
      resolvedAt: approval.resolvedAt,
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
   * Nhận `tieredPricingEnabled` như `getScoped()` vì `toViews` re-resolve giá SỐNG cho dòng catalog.
   * Body rỗng ⇒ trả view hiện tại, KHÔNG ghi, KHÔNG event (không có mutation để audit).
   */
  async update(
    actorAccountId: string,
    orderId: string,
    dto: UpdateOrderRequestDto,
    tieredPricingEnabled: boolean,
    actorPermissions: ReadonlySet<string>,
  ): Promise<OrderView> {
    const before = await this.findScopedOrThrow(
      actorAccountId,
      actorPermissions,
      orderId,
    );
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

    // Khoá dòng đơn rồi đọc lại status TRONG tx: `assertMutable` ở trên chỉ là fast-path,
    // cửa sổ giữa nó và lệnh ghi đủ rộng cho một `chot` chen ngang.
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockOrderRow(tx, before.id);
      this.assertMutable(await this.findOrThrowIn(tx, orderId));
      return tx.order.update({
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
   * Việc ĐỔI status uỷ thác cho `applyTransition()` — hàm này chỉ còn sở hữu phần snapshot.
   *
   * Cổng idempotency nằm trong engine (`updateMany` theo status quan sát được + `count === 1`,
   * khuôn Story 2.3 chống replay): Postgres READ COMMITTED re-check WHERE sau row lock ⇒
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
   * CHỐT TỪ `choduyet` (Story 4.7, spine "duyệt then Chốt"): approval mới nhất PHẢI `dong_y`
   * (chưa duyệt/`tu_choi` ⇒ 409); snapshot thêm `OrderVersion.discountAmount` = amount đã
   * duyệt. Đường `baogia` giữ NGUYÊN hành vi cũ (`discountAmount` null). Cổng atomic dùng
   * status QUAN SÁT ĐƯỢC — race reject-giữa-chừng tự an toàn: reject đổi status về `baogia`
   * ⇒ cổng `choduyet` count 0 ⇒ sentinel ⇒ đọc lại.
   *
   * Publish `OrderConfirmed` SAU commit, CHỈ ở nhánh chốt thật — retry im lặng (NFR-1, AD-18).
   */
  async confirm(
    actorAccountId: string,
    orderId: string,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
    actorPermissions: ReadonlySet<string>,
  ): Promise<OrderView> {
    const before = await this.findScopedOrThrow(
      actorAccountId,
      actorPermissions,
      orderId,
    );
    if (before.status === TRANG_THAI_DA_CHOT) {
      // Retry sau khi đã chốt: 200 view hiện tại — KHÔNG ghi lại snapshot, KHÔNG event.
      return this.viewOf(before, tieredPricingEnabled);
    }
    let discountAmount: number | null = null;
    if (before.status === TRANG_THAI_CHO_DUYET) {
      const approval = await this.prisma.discountApproval.findFirst({
        where: { orderId: before.id },
        orderBy: { createdAt: 'desc' },
      });
      if (approval === null || approval.status !== CHIET_KHAU_DONG_Y) {
        throw new AppException(
          ErrorCode.CONFLICT,
          409,
          'Chiết khấu chưa được duyệt.',
        );
      }
      discountAmount = approval.amount;
    } else if (before.status !== TRANG_THAI_BAO_GIA) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chỉ chốt được đơn đang ở trạng thái Báo giá.',
      );
    }
    const versionId = this.currentVersionIdOrThrow(before);

    // Báo giá rỗng không có gì để đóng băng — gần như chắc chắn là mis-tap. Đây là FAST-PATH
    // ngoài tx để trả 400 mà không mở transaction; danh sách dòng THẬT dùng để snapshot được
    // đọc LẠI bên trong tx sau khi đã cầm khoá (xem dưới).
    const dongTruocTx = await this.prisma.orderLineItem.findMany({
      where: { orderVersionId: versionId },
      orderBy: { displayOrder: 'asc' },
    });
    if (dongTruocTx.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Không thể chốt báo giá chưa có dòng nào.',
      );
    }

    /**
     * Dựng snapshot cho một tập dòng. Giá danh mục resolve MỘT lần cho mọi dòng catalog (kể
     * cả `priceEditable` — cần `catalogPriceSnapshot` song song), CÙNG cờ với đường
     * live/`toViews` — đóng băng đúng con số khách đang thấy trên màn.
     *
     * `warrantyStartAt` mang theo từng snapshot: cần biết dòng nào CHƯA có mốc bảo hành để
     * chỉ ghi cho dòng đó (dòng đã có mốc — re-chốt bản update — giữ nguyên ngày cũ).
     */
    const dungSnapshot = async (tx: PrismaTx, lines: OrderLineItem[]) => {
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
          : ((await tx.product.findMany({
              where: { id: { in: catalogIds } },
              select: PRODUCT_QUOTE_SELECT,
            })) as ProductQuoteView[]);
      const productById = new Map(products.map((p) => [p.id, p]));

      return lines.map((line) => {
        if (line.productId === null) {
          // Dòng tự do: giá nhập tay đóng băng, không có giá danh mục để so.
          return {
            id: line.id,
            unitPriceSnapshot: line.unitPrice,
            catalogPriceSnapshot: null,
            warrantyStartAt: line.warrantyStartAt,
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
              warrantyStartAt: line.warrantyStartAt,
            }
          : {
              // Catalog thường: giá SỐNG tại thời điểm chốt — cả hai cột cùng con số.
              id: line.id,
              unitPriceSnapshot: catalogPrice,
              catalogPriceSnapshot: catalogPrice,
              warrantyStartAt: line.warrantyStartAt,
            };
      });
    };

    // MỘT timestamp cho MỘT sự kiện: cùng con số dùng cho `chotAt` trên version/dòng và cho
    // `occurredAt` của cả hai event — hai lần `new Date()` sẽ đẻ ra hai "lúc" cho một việc.
    const chotAt = new Date();
    let statusChanged: StatusChanged;
    try {
      statusChanged = await this.prisma.$transaction(async (tx) => {
        // Engine: đánh giá guard → khoá dòng → cổng atomic theo status QUAN SÁT ĐƯỢC
        // (`baogia` hoặc `choduyet`) → sentinel nếu thua. Op ĐẦU TIÊN của tx.
        const event = await this.applyTransition(tx, {
          order: before,
          event: SU_KIEN.chot,
          actorPermissions,
          actorAccountId,
          sentinel: CHOT_GATE_THUA,
          occurredAt: chotAt,
        });
        // Dòng đọc BÊN TRONG tx, SAU khoá — đây là điểm mấu chốt của TOCTOU: đọc ngoài tx
        // thì một `addLine` commit trong khoảng giữa sẽ để lại một dòng KHÔNG có snapshot
        // trong một đơn đã chốt, tức giá của đơn đã chốt vẫn còn tự đổi theo danh mục.
        const lines = await tx.orderLineItem.findMany({
          where: { orderVersionId: versionId },
          orderBy: { displayOrder: 'asc' },
        });
        const lineSnapshots = await dungSnapshot(tx, lines);
        await tx.orderVersion.update({
          where: { id: versionId },
          data: {
            vatRate: vatRatePercent,
            // Giá trị HIỆU LỰC — đơn tạo trước 4.4 (vatMode null, tính như có VAT) chốt
            // xong phải tường minh 'co_vat': quyết định thuế đã đóng băng không được mập mờ.
            vatMode: before.vatMode ?? VAT_MODE.coVat,
            chotAt,
            // Chiết khấu ĐÃ DUYỆT đóng băng lên version (4.7) — null ở đường `baogia`.
            discountAmount,
          },
        });
        for (const snap of lineSnapshots) {
          await tx.orderLineItem.update({
            where: { id: snap.id },
            data: {
              unitPriceSnapshot: snap.unitPriceSnapshot,
              catalogPriceSnapshot: snap.catalogPriceSnapshot,
              // Mốc bảo hành = ngày dòng chốt LẦN ĐẦU (FR-36), ghi cho MỌI dòng còn null
              // (kể cả dòng không bảo hành — mốc là thuộc tính "dòng chốt lần đầu"). CÙNG
              // hằng `chotAt` với `OrderVersion` — một sự kiện một timestamp. Dòng đã có
              // mốc (re-chốt bản update) giữ nguyên — key vắng mặt, không ghi lại.
              ...(snap.warrantyStartAt === null
                ? { warrantyStartAt: chotAt }
                : {}),
            },
          });
        }
        return event;
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
    // HAI event cho MỘT hành động: `OrderConfirmed` mang ngữ nghĩa nghiệp vụ (đường thông
    // báo tiêu thụ), `StatusChanged` là vết from→to chính tắc của AD-11. Cả hai SAU commit.
    await this.eventBus.publish(
      new OrderConfirmed(
        actorAccountId,
        orderSnapshot(before),
        orderSnapshot(after),
        chotAt,
      ),
    );
    await this.eventBus.publish(statusChanged);
    return this.viewOf(after, tieredPricingEnabled);
  }

  /**
   * MỞ LẠI Đơn đã chốt để sửa (Story 4.6, FR-6/AD-6): sinh BẢN UPDATE MỚI, không ghi đè bản
   * cũ. Việc ĐỔI status uỷ thác cho `applyTransition()`.
   *
   * MỘT interactive `$transaction`: cổng transition đặt ĐẦU tx — bên thua race
   * (`count === 0`) abort TRƯỚC khi create gì, rollback rẻ; sau
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
    actorPermissions: ReadonlySet<string>,
  ): Promise<OrderView> {
    const before = await this.findScopedOrThrow(
      actorAccountId,
      actorPermissions,
      orderId,
    );
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

    // MỘT timestamp cho MỘT sự kiện — dùng chung cho `OrderRevised` và `StatusChanged`.
    const moLaiAt = new Date();
    let statusChanged: StatusChanged;
    try {
      statusChanged = await this.prisma.$transaction(async (tx) => {
        // Cổng transition VẪN là op đầu tiên của tx: bên thua rollback trước khi create gì.
        const event = await this.applyTransition(tx, {
          order: before,
          event: SU_KIEN.moLai,
          actorPermissions,
          actorAccountId,
          sentinel: MO_LAI_GATE_THUA,
          occurredAt: moLaiAt,
        });
        await tx.orderVersion.create({
          data: {
            id: newVersionId,
            orderId: before.id,
            versionNo: currentVersion.versionNo + 1,
            createdByAccountId: actorAccountId,
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
        return event;
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
        moLaiAt,
      ),
    );
    await this.eventBus.publish(statusChanged);
    return this.viewOf(after, tieredPricingEnabled);
  }

  /**
   * ÁP CHIẾT KHẤU + gửi duyệt (Story 4.7, FR-18/AD-18): baogia → choduyet + tạo hồ sơ
   * `DiscountApproval` `cho_duyet` trong MỘT interactive transaction. Việc ĐỔI status uỷ
   * thác cho `applyTransition()`.
   *
   * ⚠️ Cổng transition ở đây KIÊM bất biến "một pending mỗi đơn": approval chỉ được tạo sau
   * khi cổng `baogia → choduyet` thắng, nên không bao giờ sinh 2 approval `cho_duyet` cùng
   * đơn. Uỷ thác cổng cho engine KHÔNG được làm yếu bất biến đó — engine khoá dòng rồi mới
   * `updateMany`, chặt hơn cổng cũ chứ không lỏng hơn (có test race khẳng định đúng MỘT
   * approval sinh ra khi hai request đua nhau).
   * Thua cổng ⇒ 409 (KHÔNG idempotent-return — body mang amount, hai lần bấm khác nhau
   * không được im lặng nuốt). Validate TRƯỚC tx: `amount ≤ subtotal` hiện hành (qua
   * `computeOrderTotals` — hàm pricing duy nhất), đơn 0 dòng ⇒ 400 (khuôn `confirm`).
   *
   * Trong `choduyet`, `assertMutable` tự đóng băng nội dung đơn — thứ được duyệt chính là
   * thứ được chốt. Publish `DiscountRequested` SAU commit, CHỈ nhánh áp thật (AD-18).
   */
  async applyDiscount(
    actorAccountId: string,
    orderId: string,
    amount: number,
    note: string | null,
    tieredPricingEnabled: boolean,
    actorPermissions: ReadonlySet<string>,
  ): Promise<OrderView> {
    const before = await this.findScopedOrThrow(
      actorAccountId,
      actorPermissions,
      orderId,
    );
    if (before.status !== TRANG_THAI_BAO_GIA) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chỉ áp được chiết khấu khi đơn đang ở trạng thái Báo giá.',
      );
    }
    const versionId = this.currentVersionIdOrThrow(before);

    const view = await this.viewOf(before, tieredPricingEnabled);
    if (view.lineItems.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Không thể áp chiết khấu cho báo giá chưa có dòng nào.',
      );
    }
    // Subtotal HIỆN HÀNH (giá sống đã resolve trong view) — chiết khấu không được vượt.
    const totals = computeOrderTotals({
      lines: view.lineItems,
      vatRate: 0,
      applyVat: false,
    });
    if (amount > totals.subtotal) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Mức chiết khấu vượt quá tổng tiền hàng.',
        [
          {
            field: 'amount',
            code: 'max',
            message: 'Mức chiết khấu không được vượt quá tổng tiền hàng.',
          },
        ],
      );
    }

    const approvalId = randomUUID();
    // MỘT timestamp cho MỘT sự kiện — dùng chung cho `DiscountRequested` và `StatusChanged`.
    const apAt = new Date();
    let statusChanged: StatusChanged;
    try {
      statusChanged = await this.prisma.$transaction(async (tx) => {
        const event = await this.applyTransition(tx, {
          order: before,
          event: SU_KIEN.apChietKhau,
          actorPermissions,
          actorAccountId,
          sentinel: AP_CK_GATE_THUA,
          occurredAt: apAt,
        });
        await tx.discountApproval.create({
          data: {
            id: approvalId,
            orderId: before.id,
            orderVersionId: versionId,
            amount,
            status: CHIET_KHAU_CHO_DUYET,
            requestNote: note,
            requestedByAccountId: actorAccountId,
          },
        });
        return event;
      });
    } catch (error) {
      if (error !== AP_CK_GATE_THUA) throw error;
      // Thua cổng atomic (race 2 request đồng thời): đọc lại rồi 409 — áp không idempotent.
      await this.findOrThrow(orderId);
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chỉ áp được chiết khấu khi đơn đang ở trạng thái Báo giá.',
      );
    }

    const after: Order = { ...before, status: TRANG_THAI_CHO_DUYET };
    await this.eventBus.publish(
      new DiscountRequested(
        actorAccountId,
        orderSnapshot(before),
        orderSnapshot(after),
        amount,
        note,
        apAt,
      ),
    );
    await this.eventBus.publish(statusChanged);
    return this.viewOf(after, tieredPricingEnabled);
  }

  /**
   * DUYỆT / TỪ CHỐI chiết khấu (Story 4.7, FR-18/AD-18).
   *
   * ⚠️ BẤT ĐỐI XỨNG với ba đường transition kia: cổng atomic thắng-thua ở đây nằm trên CHÍNH
   * row `DiscountApproval` (`cho_duyet` → resolved), KHÔNG phải trên dòng `Order` — 2 người
   * duyệt đồng thời đúng MỘT bên thắng ở đó. Lệnh ghi `Order.status` là HỆ QUẢ của việc
   * thắng cổng ấy, chỉ ở nhánh TỪ CHỐI (choduyet → baogia, đơn sửa lại được), và nó mang
   * theo một assertion bất biến: approval đang `cho_duyet` thì đơn BẮT BUỘC ở `choduyet`,
   * lệch là dữ liệu hỏng ⇒ huỷ cả tx. Thứ tự (approval trước, order sau) KHÔNG được đảo.
   *
   * Nhánh ĐỒNG Ý KHÔNG đổi status đơn (vẫn `choduyet` — "được Chốt", Chốt là hành động
   * riêng qua `confirm()`) nên KHÔNG gọi engine.
   *
   * Idempotency (NFR SM-1): retry CÙNG decision trên approval đã resolve ⇒ 200 view hiện
   * tại KHÔNG event; decision NGƯỢC ⇒ 409. `reason` BẮT BUỘC khi từ chối (400 fieldErrors),
   * optional khi đồng ý. Publish `DiscountResolved` (mang `approved` + `reason` cho Epic 9)
   * SAU commit, CHỈ nhánh resolve thật.
   */
  async resolveDiscount(
    actorAccountId: string,
    orderId: string,
    approve: boolean,
    reason: string | null,
    tieredPricingEnabled: boolean,
    actorPermissions: ReadonlySet<string>,
  ): Promise<OrderView> {
    const before = await this.findScopedOrThrow(
      actorAccountId,
      actorPermissions,
      orderId,
    );
    const approval = await this.prisma.discountApproval.findFirst({
      where: { orderId: before.id },
      orderBy: { createdAt: 'desc' },
    });
    if (approval === null) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Đơn không có chiết khấu chờ duyệt.',
      );
    }
    if (approval.status !== CHIET_KHAU_CHO_DUYET) {
      const sameDecision = approve
        ? approval.status === CHIET_KHAU_DONG_Y
        : approval.status === CHIET_KHAU_TU_CHOI;
      if (sameDecision) {
        // Retry cùng decision: 200 view hiện tại — KHÔNG ghi, KHÔNG event (NFR SM-1).
        return this.viewOf(before, tieredPricingEnabled);
      }
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chiết khấu đã được quyết theo hướng ngược lại.',
      );
    }
    if (!approve && (reason === null || reason.trim() === '')) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Cần lý do khi từ chối chiết khấu.',
        [
          {
            field: 'reason',
            code: 'required',
            message: 'Lý do là bắt buộc khi từ chối chiết khấu.',
          },
        ],
      );
    }

    // MỘT timestamp cho MỘT sự kiện — dùng chung cho `resolvedAt`, `DiscountResolved` và
    // `StatusChanged` của cùng một lần quyết.
    const quyetAt = new Date();
    let statusChanged: StatusChanged | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.discountApproval.updateMany({
          where: { id: approval.id, status: CHIET_KHAU_CHO_DUYET },
          data: {
            status: approve ? CHIET_KHAU_DONG_Y : CHIET_KHAU_TU_CHOI,
            resolvedByAccountId: actorAccountId,
            resolveNote: reason,
            resolvedAt: quyetAt,
          },
        });
        if (count === 0) throw DUYET_CK_GATE_THUA;
        if (!approve) {
          // Từ chối trả đơn về Báo giá. Sentinel truyền vào engine ở ĐÂY chính là lỗi BẤT
          // BIẾN GÃY, không phải một cổng thua bình thường: approval `cho_duyet` ⇒ đơn PHẢI
          // ở `choduyet` (cổng áp bảo đảm), nên `count === 0` nghĩa là dữ liệu hỏng. Caller
          // KHÔNG bắt nó ⇒ nó nổi lên, huỷ TOÀN tx (kể cả approval vừa resolve).
          statusChanged = await this.applyTransition(tx, {
            order: before,
            event: SU_KIEN.tuChoiChietKhau,
            actorPermissions,
            actorAccountId,
            sentinel: new Error(
              `Bất biến gãy: approval cho_duyet nhưng đơn ${before.id} không ở choduyet.`,
            ),
            occurredAt: quyetAt,
          });
        }
      });
    } catch (error) {
      if (error !== DUYET_CK_GATE_THUA) throw error;
      // Thua cổng atomic (2 người duyệt đồng thời): đọc lại — cùng decision idempotent.
      const currentOrder = await this.findOrThrow(orderId);
      const current = await this.prisma.discountApproval.findFirst({
        where: { orderId: before.id },
        orderBy: { createdAt: 'desc' },
      });
      const sameDecision =
        current !== null &&
        (approve
          ? current.status === CHIET_KHAU_DONG_Y
          : current.status === CHIET_KHAU_TU_CHOI);
      if (sameDecision) {
        return this.viewOf(currentOrder, tieredPricingEnabled);
      }
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Chiết khấu đã được quyết theo hướng ngược lại.',
      );
    }

    const after: Order = approve
      ? before
      : { ...before, status: TRANG_THAI_BAO_GIA };
    await this.eventBus.publish(
      new DiscountResolved(
        actorAccountId,
        orderSnapshot(before),
        orderSnapshot(after),
        approve,
        reason,
        quyetAt,
      ),
    );
    // CHỈ nhánh từ chối đổi status ⇒ chỉ nó có vết `StatusChanged`.
    if (statusChanged !== null) await this.eventBus.publish(statusChanged);
    return this.viewOf(after, tieredPricingEnabled);
  }

  /**
   * Danh sách đơn có PHẠM VI theo quyền (Story 5.3, FR-10/AC-1/AC-5).
   *
   * Phạm vi là chuyện SERVER quyết, không phải tham số client gửi lên (AD-4): thiếu
   * `orders.view_all` ⇒ chỉ thấy đơn mình `owner` HOẶC mình `assignee` — đúng HAI trường
   * phân giải phạm vi (AD-15), không suy diễn trường thứ ba.
   *
   * BẪY TRUNG TÂM — mọi mệnh đề gom vào `where.AND`, KHÔNG gán thẳng `where.OR`. `where.OR`
   * chỉ có ĐÚNG MỘT chỗ: bộ lọc thứ hai nào cũng cần `OR` (search, tương lai) sẽ GHI ĐÈ mệnh
   * đề phạm vi và làm RÒ đơn của người khác — chính cái bẫy đang chờ ở `customers.service.ts`
   * nơi `where.OR` đã bị search chiếm chỗ.
   *
   * Follow-up KHÔNG phải cột DB, không phải reminder, không phải job: nó là đơn ở trạng thái
   * `baogia` (chưa chốt) — một bộ lọc DẪN XUẤT, hết (FR-10).
   */
  async list(
    callerAccountId: string,
    quyen: ReadonlySet<string>,
    query: ListOrdersQueryDto,
  ): Promise<{
    items: OrderListRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    // Hai bộ lọc trạng thái mâu thuẫn nhau ⇒ 400 tường minh. KHÔNG AND thầm lặng thành tập
    // rỗng: một danh sách rỗng câm khiến người dùng tin là "không có đơn nào" trong khi thật
    // ra họ vừa gửi một truy vấn vô nghĩa.
    if (query.followUp === true && query.status !== undefined) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Không dùng đồng thời `followUp` và `status` — follow-up đã là bộ lọc trạng thái (đơn chưa chốt).',
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.OrderWhereInput = {};
    const dieuKien: Prisma.OrderWhereInput[] = [];

    if (!quyen.has(PERM.ordersViewAll)) {
      dieuKien.push({
        OR: [
          { ownerAccountId: callerAccountId },
          { assigneeAccountId: callerAccountId },
        ],
      });
    }

    if (query.followUp === true) {
      dieuKien.push({ status: TRANG_THAI_BAO_GIA });
    } else if (query.status !== undefined) {
      dieuKien.push({ status: query.status });
    }

    if (dieuKien.length > 0) {
      where.AND = dieuKien;
    }

    // Một `$transaction` để trang và TỔNG đọc trên cùng một ảnh chụp — đếm riêng ngoài
    // transaction cho phép một đơn chen vào giữa hai truy vấn ⇒ tổng lệch với danh sách.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: { select: { name: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((don) => ({
        id: don.id,
        status: don.status,
        customerSdt: don.customerSdt,
        customerName: don.customer.name,
        ownerAccountId: don.ownerAccountId,
        assigneeAccountId: don.assigneeAccountId,
        createdAt: don.createdAt,
        updatedAt: don.updatedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * DANH SÁCH chờ duyệt chiết khấu + biên ước tính (Story 4.7, FR-18/FR-37/AD-4).
   *
   * Tiền qua `computeOrderTotals({applyVat: false, discountAmount})` — KHÔNG máy tính thứ
   * hai; `afterDiscount` = `total` khi không VAT. Biên ƯỚC TÍNH per-line đọc
   * `Product.costPrice` HIỆN HÀNH (chưa xuất kho chưa biết giá vốn thật — nhãn ước tính là
   * chữ bắt buộc trên UI): integer percent half-up của `(unitPrice − costPrice) / unitPrice`,
   * null khi dòng tự do hoặc `unitPrice = 0`.
   *
   * FENCE `costs.view` (FR-37): margin lộ ngược costPrice (`costPrice = unitPrice×(1−margin)`)
   * nên đi theo fence — `hasCostsView === false` ⇒ mọi `estimatedMarginPct` null và KHÔNG
   * query costPrice. Select costPrice là SELECT RIÊNG chỉ trong path này — KHÔNG nới
   * `PRODUCT_QUOTE_SELECT` (fence của nó giữ nguyên cho mọi đường khác).
   *
   * Danh sách pending thực tế nhỏ (cổng áp giữ ≤ 1 pending mỗi đơn) — loop per-approval
   * chấp nhận được, không cần batch.
   */
  async listPendingDiscounts(
    hasCostsView: boolean,
    tieredPricingEnabled: boolean,
    callerAccountId: string,
    quyen: ReadonlySet<string>,
  ): Promise<DiscountPendingView[]> {
    const approvals = await this.prisma.discountApproval.findMany({
      // Phạm vi cùng mệnh đề với đường đọc chi tiết: người không xem được đơn thì cũng không
      // thấy nó trong hàng chờ duyệt (preset hiện tại có `discounts.approve` đều kèm `view_all`
      // — đây là phòng thủ cho account tick quyền lẻ).
      where: {
        status: CHIET_KHAU_CHO_DUYET,
        order: { AND: this.dieuKienPhamVi(callerAccountId, quyen) },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        order: true,
        requestedBy: { select: { displayName: true } },
      },
    });

    const items: DiscountPendingView[] = [];
    for (const approval of approvals) {
      const order = approval.order;
      const lines =
        order.currentVersionId === null
          ? []
          : await this.prisma.orderLineItem.findMany({
              where: { orderVersionId: order.currentVersionId },
              orderBy: { displayOrder: 'asc' },
            });
      const views = await this.toViews(lines, tieredPricingEnabled);
      const totals = computeOrderTotals({
        lines: views,
        vatRate: 0,
        applyVat: false,
        discountAmount: approval.amount,
      });

      const costById = new Map<string, number>();
      if (hasCostsView) {
        const productIds = [
          ...new Set(
            lines
              .filter((line) => line.productId !== null)
              .map((line) => line.productId as string),
          ),
        ];
        if (productIds.length > 0) {
          const rows = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, costPrice: true },
          });
          for (const row of rows) costById.set(row.id, row.costPrice);
        }
      }

      items.push({
        orderId: order.id,
        customerSdt: order.customerSdt,
        amount: approval.amount,
        requestNote: approval.requestNote,
        requestedByAccountId: approval.requestedByAccountId,
        requestedByDisplayName: approval.requestedBy.displayName,
        requestedAt: approval.createdAt,
        subtotal: totals.subtotal,
        afterDiscount: totals.total,
        lines: views.map((view) => {
          const costPrice =
            view.productId === null ? undefined : costById.get(view.productId);
          // Half-up thuần integer trên phần trăm (khuôn VAT AD-16) — tỷ lệ không phải tiền
          // nên không phạm AD-10, nhưng làm tròn ở BACKEND để client hiển thị nguyên văn.
          const estimatedMarginPct =
            !hasCostsView || costPrice === undefined || view.unitPrice === 0
              ? null
              : Math.floor(
                  ((view.unitPrice - costPrice) * 100 +
                    Math.floor(view.unitPrice / 2)) /
                    view.unitPrice,
                );
          return {
            name: view.name,
            qty: view.qty,
            unitPrice: view.unitPrice,
            estimatedMarginPct,
          };
        }),
      });
    }
    return items;
  }

  /**
   * Thêm dòng — hai dạng (UX-DR-24):
   *  - CATALOG (`productId`): copy `name`/`unit`/`priceEditable` từ Product; `warrantyMonths`
   *    copy TRỪ khi `priceEditable = true` (công lắp/phí lắp đặt không bao giờ mang bảo
   *    hành — ép null); `unitPrice` auto-điền qua `resolveUnitPrice()` — client CHỈ được gửi
   *    giá khi `Product.priceEditable = true` (phí lắp đặt…), ngược lại 400 (sửa giá là cửa
   *    sau né duyệt chiết khấu).
   *  - TỰ DO (không `productId`): name/unit/qty/unitPrice nhập tay, `priceEditable = true`.
   */
  async addLine(
    actorAccountId: string,
    orderId: string,
    dto: AddLineItemRequestDto,
    tieredPricingEnabled: boolean,
    actorPermissions: ReadonlySet<string>,
  ): Promise<OrderLineView> {
    const order = await this.findScopedOrThrow(
      actorAccountId,
      actorPermissions,
      orderId,
    );
    this.assertMutable(order);
    const versionId = this.currentVersionIdOrThrow(order);

    // Dữ liệu dòng dựng TRƯỚC tx (validate + tra danh mục là đọc thuần, không cần khoá);
    // `displayOrder` cố tình VẮNG MẶT ở đây — nó là kết quả của một phép đọc-rồi-ghi nên
    // phải sinh BÊN TRONG tx đã cầm khoá.
    let duLieuDong: Omit<
      Prisma.OrderLineItemUncheckedCreateInput,
      'displayOrder'
    >;
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
      duLieuDong = {
        orderVersionId: versionId,
        productId: product.id,
        name: product.name,
        unit: product.unit,
        qty: dto.qty,
        unitPrice,
        priceEditable: product.priceEditable,
        // Công lắp/phí lắp đặt (`priceEditable = true`) KHÔNG BAO GIỜ mang bảo hành lên
        // dòng — kể cả khi catalog lỡ có `warrantyMonths` (form Sản phẩm cho nhập với mọi
        // product). Bảo hành của dòng đó luôn null, UI hiện "Không có".
        warrantyMonths: product.priceEditable ? null : product.warrantyMonths,
        isFlexible: dto.isFlexible ?? false,
        note: dto.note ?? null,
      };
    } else {
      duLieuDong = {
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
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await this.lockOrderRow(tx, orderId);
      // Đọc lại status TRONG tx: nếu không, một `chot` chen giữa `assertMutable` và lệnh
      // create sẽ để lọt một dòng CHƯA snapshot vào đơn đã chốt.
      const trongTx = await this.findOrThrowIn(tx, orderId);
      this.assertMutable(trongTx);
      // Con trỏ bản hiệu lực cũng phải đọc LẠI trong tx, không dùng lại giá trị ngoài tx:
      // một cặp `chot` + `mo_lai` chen vào cửa sổ này đưa status VỀ LẠI `baogia` (nên
      // `assertMutable` vẫn qua) nhưng đã repoint sang bản mới — ghi theo con trỏ cũ là chèn
      // dòng vào một bản đã chết, mất hút khỏi báo giá mà không một lỗi nào nổi lên.
      const versionIdTrongTx = this.currentVersionIdOrThrow(trongTx);
      // Cuối danh sách của BẢN HIỆU LỰC — displayOrder do server gán, client không đánh số.
      // max + 1, KHÔNG count: sau một lần xoá dòng, count nhỏ hơn displayOrder lớn nhất còn
      // lại ⇒ dòng mới trùng số với dòng cũ và không còn đứng cuối (orderBy tie).
      const last = await tx.orderLineItem.findFirst({
        where: { orderVersionId: versionIdTrongTx },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      return tx.orderLineItem.create({
        data: {
          ...duLieuDong,
          orderVersionId: versionIdTrongTx,
          displayOrder: last === null ? 0 : last.displayOrder + 1,
        },
      });
    });

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

  /**
   * Sửa `qty`/`note`/`isFlexible` mọi dòng; `unitPrice` CHỈ dòng `priceEditable = true`.
   * `warrantyMonths` (kể cả `null` = bỏ bảo hành) ghi được với dòng catalog thường + dòng
   * tự do; dòng catalog `priceEditable = true` (công lắp/phí lắp đặt) bị BỎ QUA im lặng —
   * không 400 (quyết định khách: "KHÔNG viết validation chặn — chỉ để null, không hiện ô").
   */
  async updateLine(
    actorAccountId: string,
    orderId: string,
    lineId: string,
    dto: UpdateLineItemRequestDto,
    tieredPricingEnabled: boolean,
    actorPermissions: ReadonlySet<string>,
  ): Promise<OrderLineView> {
    const order = await this.findScopedOrThrow(
      actorAccountId,
      actorPermissions,
      orderId,
    );
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

    // Bảo hành: CHỈ catalog công lắp/phí lắp đặt (`productId` non-null + `priceEditable`)
    // không mang bảo hành. Dòng TỰ DO cũng `priceEditable = true` (server ép lúc add) nhưng
    // VẪN được có bảo hành — điều kiện phải kèm `productId !== null`.
    const warrantyLocked = before.productId !== null && before.priceEditable;

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockOrderRow(tx, orderId);
      // Đọc lại status TRONG tx sau khi có khoá — `assertMutable` ở trên chỉ là fast-path.
      const trongTx = await this.findOrThrowIn(tx, orderId);
      this.assertMutable(trongTx);
      // Và con trỏ bản hiệu lực cũng phải đọc LẠI: dòng phải thuộc bản ĐANG hiệu lực tại
      // thời điểm ghi, không phải bản đã thấy lúc fast-path.
      await this.findLineOrThrowIn(
        tx,
        this.currentVersionIdOrThrow(trongTx),
        lineId,
      );
      return tx.orderLineItem.update({
        where: { id: lineId },
        // Partial: Prisma bỏ qua key `undefined` — đúng ngữ nghĩa PATCH; `note: null` xoá ghi chú.
        // `warrantyMonths` phân biệt "không gửi" (undefined — key vắng mặt) vs "gửi null" (bỏ
        // bảo hành — ghi null thật); dòng công lắp bị khoá thì key vắng mặt luôn, kể cả khi gửi.
        data: {
          qty: dto.qty,
          unitPrice: dto.unitPrice,
          note: dto.note,
          isFlexible: dto.isFlexible,
          ...(dto.warrantyMonths !== undefined && !warrantyLocked
            ? { warrantyMonths: dto.warrantyMonths }
            : {}),
        },
      });
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
    actorPermissions: ReadonlySet<string>,
  ): Promise<void> {
    const order = await this.findScopedOrThrow(
      actorAccountId,
      actorPermissions,
      orderId,
    );
    this.assertMutable(order);
    const before = await this.findLineOrThrow(order, lineId);

    await this.prisma.$transaction(async (tx) => {
      await this.lockOrderRow(tx, orderId);
      // Đọc lại status TRONG tx sau khi có khoá — `assertMutable` ở trên chỉ là fast-path.
      const trongTx = await this.findOrThrowIn(tx, orderId);
      this.assertMutable(trongTx);
      // Con trỏ bản hiệu lực đọc LẠI trong tx (cùng lý do với `updateLine`): xoá theo con trỏ
      // cũ là xoá dòng của một bản đã bị thay thế.
      await this.findLineOrThrowIn(
        tx,
        this.currentVersionIdOrThrow(trongTx),
        lineId,
      );
      await tx.orderLineItem.delete({ where: { id: lineId } });
    });

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
    return this.findLineOrThrowIn(
      this.prisma,
      this.currentVersionIdOrThrow(order),
      lineId,
    );
  }

  /**
   * Như `findLineOrThrow` nhưng đọc qua client được truyền vào và nhận con trỏ bản hiệu lực
   * TƯỜNG MINH — dùng để validate lại BÊN TRONG tx sau khi đã cầm khoá.
   *
   * Vì sao con trỏ phải là tham số chứ không suy từ `order` đọc ngoài tx: một cặp `chot` +
   * `mo_lai` chen vào cửa sổ đưa status VỀ LẠI `baogia` (nên `assertMutable` vẫn qua) nhưng
   * đã repoint sang bản mới. Ghi theo con trỏ cũ là thao tác trên dòng của một bản ĐÃ CHẾT:
   * dữ liệu mồ côi, không lỗi nào nổi lên.
   */
  private async findLineOrThrowIn(
    tx: PrismaTx,
    versionId: string,
    lineId: string,
  ): Promise<OrderLineItem> {
    const line = await tx.orderLineItem.findUnique({
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
