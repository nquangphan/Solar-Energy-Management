// hand-authored — TEST/DEMO-ONLY fake port (Story 4.1, mirror Flutter
// mobile/lib/design_system/session/fake_orders_port.dart).
//
// NOT a real backend: an in-memory order store so the quote screen is demoable
// and guardable WITHOUT an app-runtime or network. It PLAYS THE BACKEND's role
// for the demo — which is why the line `amount` is computed HERE and never in a
// screen/component (AD-10/16: the client renders backend numbers; this fake IS
// the stand-in backend). It enforces no security rule — permissions, the
// `'baogia'` window, the priceEditable gate all live on the real server (AD-4).

import {
  DEMO_CATALOG_PRODUCTS,
} from './fake-catalog-port';
import type { CatalogProduct } from './catalog-port';
import { DEMO_CUSTOMERS } from './fake-customers-port';
import type { Customer } from './customers-port';
import { DEMO_STOCK_VOUCHERS } from './fake-stock-vouchers-port';
import type { StockVoucherDetail } from './stock-vouchers-port';
import type {
  AddOrderLineInput,
  AttachmentItem,
  OrderListItem,
  OrderListQuery,
  OrderPage,
  ApplyDiscountInput,
  CreateOrderInput,
  DiscountPendingItem,
  Order,
  OrderLifecycle,
  OrderLine,
  OrderNextStep,
  OrderPortError,
  OrderStockCheck,
  OrderStockCheckLine,
  OrderStockIssueLine,
  OrderStockIssueResult,
  OrderStockIssueView,
  OrderTotals,
  OrderVersionItem,
  OrdersPort,
  PreviewTotalInput,
  QuoteExportFiles,
  ResolveDiscountInput,
  StatusChangeResult,
  UpdateOrderLineInput,
  UpdateOrderMetaInput,
  UpdateScopeFlagsInput,
} from './orders-port';
import { EVENT_DELIVERED } from './orders-port';

const NOW = '2026-07-16T00:00:00.000Z';

/** Demo mirror of the backend's photo-count ceiling (`SO_ANH_TOI_DA`). */
const DEMO_SO_ANH_TOI_DA = 10;

/** Demo mirror of the backend's minimum cancel-reason length (Story 5.7). */
const DEMO_LY_DO_TOI_THIEU = 3;

/**
 * Demo rows for the order-list screen (Story 5.3) — used only when nothing was
 * created in this session, so the list screen is demoable standalone. Spread
 * across statuses so the follow-up filter ('baogia') and the "filtered but
 * empty" state are both reachable without a backend.
 */
const DEMO_ORDER_ROWS = [
  {
    id: 'ord-demo-1',
    status: 'baogia',
    customerSdt: '+84903176968',
    ownerAccountId: 'acc-demo',
    assigneeAccountId: null,
    createdAt: '2026-07-17T09:00:00.000Z',
    updatedAt: '2026-07-17T09:00:00.000Z',
  },
  {
    id: 'ord-demo-2',
    status: 'baogia',
    customerSdt: '+84912345678',
    ownerAccountId: 'acc-demo',
    assigneeAccountId: 'acc-demo',
    createdAt: '2026-07-16T08:00:00.000Z',
    updatedAt: '2026-07-16T08:00:00.000Z',
  },
  {
    id: 'ord-demo-3',
    status: 'dachot',
    customerSdt: '+84903176968',
    ownerAccountId: 'acc-demo',
    assigneeAccountId: null,
    createdAt: '2026-07-15T07:00:00.000Z',
    updatedAt: '2026-07-15T07:00:00.000Z',
  },
  {
    id: 'ord-demo-4',
    status: 'thicong',
    customerSdt: '+84912345678',
    ownerAccountId: 'acc-demo',
    assigneeAccountId: 'acc-demo',
    createdAt: '2026-07-14T06:00:00.000Z',
    updatedAt: '2026-07-14T06:00:00.000Z',
  },
];

/**
 * STATIC demo bytes for `exportQuote` (Story 4.8) — the real backend renders
 * PDF/PNG from the quote template; the demo just hands back a valid 1×1 PNG and
 * a minimal PDF header so the share/download plumbing is exercisable offline.
 */
const DEMO_QUOTE_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const DEMO_QUOTE_PDF = new TextEncoder().encode('%PDF-1.4\n%%EOF\n');

/** Demo order whose stock is ALREADY issued — its voucher carries no `unitCost`. */
export const FAKE_ORDER_ISSUED = 'ord-demo-4';

/** Demo order whose stock-out the fake refuses (409 INSUFFICIENT_STOCK on `lines.0.qty`). */
export const FAKE_ORDER_SHORT_STOCK = 'ord-demo-3';

/**
 * Stock-out preview rows, typed as the backend returns them: already summed per
 * product and in its canonical order (name, then id). Includes the LONGEST
 * product name. The fake owns no stock rule — "not enough" is a fixed branch on a
 * fixed order, never a `qty`/`onHand` comparison.
 */
const DEMO_ISSUE_LINES: OrderStockIssueLine[] = [
  {
    productId: 'prod-inverter-hybrid-10k',
    name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
    sku: 'INV-ASW10K-H',
    unit: 'bộ',
    qty: 1,
    onHand: 5,
    shortfall: 0,
  },
  {
    productId: 'prod-pin-ae-630',
    name: 'Tấm pin AE 630W',
    sku: 'PIN-AE-630',
    unit: 'tấm',
    qty: 14,
    onHand: 40,
    shortfall: 0,
  },
];
const DEMO_SHORT_LINE: OrderStockIssueLine = {
  productId: 'prod-battery-10kwh',
  name: 'Battery LiFePO4 10kWh',
  sku: 'BAT-10K',
  unit: 'bình',
  qty: 2,
  onHand: 0,
  shortfall: 2,
};

/**
 * Quote stock warning rows, typed as the backend returns them — per product,
 * figures and `status` fixed (the fake owns no stock rule: "short" is a fixed
 * fact of a fixed product, never a comparison). Keyed by catalogue product so a
 * quote built in this session gets hints for what it contains.
 */
const DEMO_STOCK_BY_PRODUCT: Record<
  string,
  Omit<OrderStockCheckLine, 'productId' | 'name' | 'unit' | 'qty'>
> = {
  'prod-pin-580': {
    onHand: 42,
    reserved: 0,
    available: 42,
    shortfall: 0,
    status: 'enough',
  },
  'prod-inverter-8k': {
    onHand: 1,
    reserved: 1,
    available: 0,
    shortfall: 1,
    status: 'short',
  },
};

/**
 * Stock warning of an order the fake never created (test fixtures, standalone
 * demo): one product enough, one short with the LONGEST product name; the
 * quote's free-text line has no entry, as on the backend.
 */
const DEMO_STOCK_CHECK: OrderStockCheckLine[] = [
  {
    productId: 'prod-inverter-hybrid-10k',
    name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
    unit: 'bộ',
    qty: 2,
    onHand: 1,
    reserved: 0,
    available: 1,
    shortfall: 1,
    status: 'short',
  },
  {
    productId: 'prod-pin-580',
    name: 'Tấm pin JA Solar 580W',
    unit: 'tấm',
    qty: 12,
    onHand: 42,
    reserved: 0,
    available: 42,
    shortfall: 0,
    status: 'enough',
  },
];
const DEMO_UNTRACKED_ITEMS = ['Công lắp đặt'];

/** The statuses the backend accepts for a standalone stock issue. */
const DEMO_ISSUABLE_STATUSES = [
  'dachot',
  'dacoc',
  'danggiao',
  'thicong',
  'nghiemthu',
];

/** The statuses whose close into `hoanthanh` the backend refuses before the stock-out. */
const DEMO_CLOSE_REQUIRES_ISSUE_FROM = ['dachot', 'nghiemthu'];

/** The backend's refusal of a close `dachot`/`nghiemthu` → `hoan_thanh` before the stock-out. */
export const FAKE_CLOSE_BEFORE_ISSUE_ERROR: OrderPortError = {
  code: 'CONFLICT',
  message: 'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.',
};

/** The backend's refusal of re-opening an order whose stock already left. */
export const FAKE_REVISE_AFTER_ISSUE_ERROR: OrderPortError = {
  code: 'CONFLICT',
  message: 'Đơn đã xuất kho — không mở lại để sửa được.',
};

export const FAKE_STOCK_ISSUE_SHORT_ERROR: OrderPortError = {
  code: 'CONFLICT',
  message: 'Không đủ tồn — không thể xuất quá số tồn hiện có.',
  fieldErrors: [{ field: 'lines.0.qty', message: 'Còn 0 bình, không xuất được 2.' }],
};

/** Digits of a string, minus leading zeros — mirrors the backend's phone matching. */
function digits(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * Stand-in for the backend's scopePresetFor() (Story 4.3, FR-2) — lives in the
 * fake (the demo "server"), never in a screen: CA_NHAN → all three on,
 * THUONG_MAI → equipment only.
 */
function presetFor(custType: string): {
  scopeThietBi: boolean;
  scopeThiCong: boolean;
  scopeVanChuyen: boolean;
} {
  const caNhan = custType === 'CA_NHAN';
  return { scopeThietBi: true, scopeThiCong: caNhan, scopeVanChuyen: caNhan };
}

/** An `OrdersPort` backed by an in-memory store — TEST/DEMO ONLY. */
export class FakeOrdersPort implements OrdersPort {
  private readonly orders = new Map<string, Order>();
  private seq = 0;
  /** One order, one stock-out — the fake's record of what is issued. */
  private readonly issuedVouchers = new Map<string, StockVoucherDetail>(
    DEMO_STOCK_VOUCHERS.filter((p) => p.orderId !== undefined).map((p) => [p.orderId!, p]),
  );

  constructor(
    private readonly products: CatalogProduct[] = DEMO_CATALOG_PRODUCTS,
    private readonly customers: Customer[] = DEMO_CUSTOMERS,
  ) {}

  create(input: CreateOrderInput): Promise<Order> {
    this.seq += 1;
    // The backend snapshots custType from the Customer and applies the scope
    // preset explicitly (Story 4.3) — the fake plays that role for its demo
    // customers; an unknown phone falls back to CA_NHAN.
    const needle = digits(input.customerSdt);
    const customer = this.customers.find(
      (c) => needle !== '' && digits(c.sdt).endsWith(needle),
    );
    const custType = customer?.custType ?? 'CA_NHAN';
    const order: Order = {
      id: `ord-demo-${this.seq}`,
      status: 'baogia',
      customerSdt: input.customerSdt,
      currentVersionId: `ver-demo-${this.seq}`,
      ownerAccountId: 'acc-demo',
      assigneeAccountId: null,
      sourceId: customer?.sourceId ?? 'src-facebook',
      custType,
      ...presetFor(custType),
      kWp: null,
      // The backend writes the VAT tick EXPLICITLY on create (Story 4.4) —
      // null is reserved for pre-4.4 orders; the fake plays that role.
      vatMode: 'co_vat',
      validityNote: null,
      cancelReason: null,
      cancelledAt: null,
      lineItems: [],
      discount: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.orders.set(order.id, order);
    return Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  updateScopeFlags(
    orderId: string,
    input: UpdateScopeFlagsInput,
  ): Promise<Order> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    if (input.scopeThiCong !== undefined) order.scopeThiCong = input.scopeThiCong;
    if (input.scopeVanChuyen !== undefined) {
      order.scopeVanChuyen = input.scopeVanChuyen;
    }
    return Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  updateOrderMeta(orderId: string, input: UpdateOrderMetaInput): Promise<Order> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    // PATCH semantics mirror the backend: absent = keep, null = clear (kWp/
    // validityNote are nullable business values; vatMode never goes null here).
    if (input.vatMode !== undefined) order.vatMode = input.vatMode;
    if (input.kWp !== undefined) order.kWp = input.kWp;
    if (input.validityNote !== undefined) order.validityNote = input.validityNote;
    return Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  get(id: string): Promise<Order> {
    const order = this.orders.get(id);
    return order === undefined
      ? Promise.reject(new Error(`Không tìm thấy đơn hàng: ${id}`))
      : Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  addLine(orderId: string, input: AddOrderLineInput): Promise<OrderLine> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }

    this.seq += 1;
    let line: OrderLine;
    if (input.productId !== undefined) {
      const product = this.products.find((p) => p.id === input.productId);
      if (product === undefined) {
        return Promise.reject(new Error('Sản phẩm không tồn tại.'));
      }
      // Stand-in for the backend's resolveUnitPrice(): demo has no tier data,
      // so the catalogue price wins unless the product allows a client price.
      const unitPrice =
        product.priceEditable && input.unitPrice !== undefined
          ? input.unitPrice
          : product.price;
      line = this.buildLine(order, {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        qty: input.qty,
        unitPrice,
        priceEditable: product.priceEditable,
        // Install/labour lines (priceEditable) never carry warranty — force null even
        // if the catalogue product happens to have one (mirrors backend addLine).
        warrantyMonths: product.priceEditable ? null : product.warrantyMonths,
        note: input.note ?? null,
        isFlexible: input.isFlexible ?? false,
      });
    } else {
      line = this.buildLine(order, {
        productId: null,
        name: input.name ?? '',
        unit: input.unit ?? '',
        qty: input.qty,
        unitPrice: input.unitPrice ?? 0,
        priceEditable: true,
        warrantyMonths: null,
        note: input.note ?? null,
        isFlexible: input.isFlexible ?? false,
      });
    }

    order.lineItems.push(line);
    return Promise.resolve({ ...line });
  }

  updateLine(
    orderId: string,
    lineId: string,
    input: UpdateOrderLineInput,
  ): Promise<OrderLine> {
    const order = this.orders.get(orderId);
    const line = order?.lineItems.find((l) => l.id === lineId);
    if (order === undefined || line === undefined) {
      return Promise.reject(new Error(`Không tìm thấy dòng báo giá: ${lineId}`));
    }
    if (input.qty !== undefined) line.qty = input.qty;
    if (input.unitPrice !== undefined && line.priceEditable) {
      line.unitPrice = input.unitPrice;
    }
    if (input.note !== undefined) line.note = input.note;
    if (input.isFlexible !== undefined) line.isFlexible = input.isFlexible;
    // Warranty: catalogue install/labour lines (productId set + priceEditable) ignore the
    // field silently; free lines (productId null) and normal catalogue lines write it,
    // including `null` (= clear). Mirrors backend `warrantyLocked` guard.
    if (input.warrantyMonths !== undefined) {
      const warrantyLocked = line.productId !== null && line.priceEditable;
      if (!warrantyLocked) line.warrantyMonths = input.warrantyMonths;
    }
    line.amount = this.serverAmount(line.unitPrice, line.qty);
    return Promise.resolve({ ...line });
  }

  removeLine(orderId: string, lineId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    order.lineItems = order.lineItems.filter((l) => l.id !== lineId);
    return Promise.resolve();
  }

  previewTotal(input: PreviewTotalInput): Promise<OrderTotals> {
    // The backend's computeOrderTotals() stand-in — SAME formula (8% VAT,
    // discount subtracted BEFORE VAT into vatBase — Story 4.7 —, integer
    // half-up at the grand vatBase, `vatMode` echo decides applyVat — Story
    // 4.4), lives in the fake (the demo "server"), never in a screen (AD-16).
    // Absent vatMode = pre-4.4 order = VAT applies.
    const vatRate = 8;
    const applyVat = input.vatMode !== 'khong_vat';
    let subtotal = 0;
    for (const line of input.lines) {
      subtotal += this.serverAmount(line.unitPrice, line.qty);
    }
    const discountAmount = input.discountAmount ?? 0;
    const vatBase = subtotal - discountAmount;
    const vatAmount = applyVat
      ? Math.floor((vatBase * vatRate + 50) / 100)
      : 0;
    return Promise.resolve({
      subtotal,
      discountAmount,
      vatAmount,
      total: vatBase + vatAmount,
      vatRate,
      applyVat,
    });
  }

  confirmOrder(orderId: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    // Confirming from 'choduyet' needs the discount APPROVED first (Story 4.7)
    // — the fake mirrors the backend's 409.
    if (order.status === 'choduyet' && order.discount?.status !== 'dong_y') {
      return Promise.reject(new Error('Chiết khấu chưa được duyệt.'));
    }
    // Already confirmed = idempotent no-op, mirroring the backend retry path.
    // The fake does NOT simulate the price freeze — the client never computes
    // money and never reads snapshots; the returned numbers just stay as-is.
    if (order.status !== 'dachot') {
      order.status = 'dachot';
    }
    return Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  applyDiscount(orderId: string, input: ApplyDiscountInput): Promise<Order> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    // Only a draft can be sent for approval — mirroring the backend's 409
    // (applying is NOT idempotent: two taps carry different amounts).
    if (order.status !== 'baogia') {
      return Promise.reject(
        new Error('Chỉ áp được chiết khấu khi đơn đang ở trạng thái Báo giá.'),
      );
    }
    order.status = 'choduyet';
    order.discount = {
      amount: input.amount,
      status: 'cho_duyet',
      requestNote: input.note ?? null,
      resolveNote: null,
      requestedAt: NOW,
      resolvedAt: null,
    };
    return Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  resolveDiscount(orderId: string, input: ResolveDiscountInput): Promise<Order> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    if (order.discount?.status !== 'cho_duyet') {
      return Promise.reject(new Error('Đơn không có chiết khấu chờ duyệt.'));
    }
    if (input.approve) {
      // Approving keeps the order 'choduyet' — confirming is a SEPARATE action.
      order.discount = {
        ...order.discount,
        status: 'dong_y',
        resolveNote: input.reason ?? null,
        resolvedAt: NOW,
      };
    } else {
      // Rejecting returns the order to draft with the reason on the record.
      order.status = 'baogia';
      order.discount = {
        ...order.discount,
        status: 'tu_choi',
        resolveNote: input.reason ?? null,
        resolvedAt: NOW,
      };
    }
    return Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  listPendingDiscounts(): Promise<DiscountPendingItem[]> {
    // Derived from the in-memory store: every order whose LATEST discount is
    // still pending. All numbers computed HERE (the demo "server") — subtotal,
    // afterDiscount, and a STATIC demo margin per catalogue line (the real
    // backend reads Product.costPrice; the demo has no cost data).
    const items: DiscountPendingItem[] = [];
    for (const order of this.orders.values()) {
      if (order.discount?.status !== 'cho_duyet') continue;
      let subtotal = 0;
      for (const line of order.lineItems) {
        subtotal += this.serverAmount(line.unitPrice, line.qty);
      }
      items.push({
        orderId: order.id,
        customerSdt: order.customerSdt,
        amount: order.discount.amount,
        requestNote: order.discount.requestNote,
        requestedByAccountId: order.ownerAccountId,
        requestedByDisplayName: 'Nhân viên demo',
        requestedAt: order.discount.requestedAt,
        subtotal,
        afterDiscount: subtotal - order.discount.amount,
        lines: order.lineItems.map((line) => ({
          name: line.name,
          qty: line.qty,
          unitPrice: line.unitPrice,
          // Static demo margin: catalogue lines show 20%, free/zero-price
          // lines show null ("—") — same nullability contract as the backend.
          estimatedMarginPct:
            line.productId !== null && line.unitPrice !== 0 ? 20 : null,
        })),
      });
    }
    return Promise.resolve(items);
  }

  exportQuote(orderId: string): Promise<QuoteExportFiles> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    // Twin of the backend 400: an empty quote has nothing to export.
    if (order.lineItems.length === 0) {
      return Promise.reject(
        new Error('Không thể xuất báo giá chưa có dòng nào.'),
      );
    }
    const fileBase = `bao-gia-${orderId.slice(0, 8)}`;
    return Promise.resolve({
      image: {
        fileName: `${fileBase}.png`,
        mimeType: 'image/png',
        bytes: DEMO_QUOTE_PNG,
      },
      pdf: {
        fileName: `${fileBase}.pdf`,
        mimeType: 'application/pdf',
        bytes: DEMO_QUOTE_PDF,
      },
    });
  }

  reviseOrder(orderId: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    // An issued order cannot be re-opened — the backend's 409, mirrored.
    if (order.status === 'dachot' && this.issuedVouchers.has(orderId)) {
      return Promise.reject(FAKE_REVISE_AFTER_ISSUE_ERROR);
    }
    // Already open = idempotent no-op, mirroring the backend retry path. The
    // fake does NOT simulate the new version / line copy — the client never
    // sees the version concept (4.1); the lines just come back as-is.
    if (order.status !== 'baogia') {
      order.status = 'baogia';
    }
    return Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  /**
   * `GET /orders` stand-in (Story 5.3). Plays the BACKEND's role for the demo:
   * it filters and pages, and it reports `total` over the whole filtered set —
   * a screen that counted rows itself would show one page and lose the rest.
   *
   * It does NOT model permission scope: scope is a server decision (AD-4), and
   * a fake that pretended to enforce it would teach the screen to expect a
   * client-side scope knob that must never exist.
   */
  list(query: OrderListQuery): Promise<OrderPage> {
    if (query.followUp === true && query.status !== undefined) {
      return Promise.reject(
        new Error(
          'Không dùng đồng thời `followUp` và `status` — follow-up đã là bộ lọc trạng thái (đơn chưa chốt).',
        ),
      );
    }

    const seeded = this.orders.size > 0 ? [...this.orders.values()] : DEMO_ORDER_ROWS;
    const rows = seeded.map(
      (order): OrderListItem => ({
        id: order.id,
        status: order.status,
        customerSdt: order.customerSdt,
        customerName:
          this.customers.find((c) => c.sdt === order.customerSdt)?.name ??
          'Khách lẻ',
        ownerAccountId: order.ownerAccountId,
        assigneeAccountId: order.assigneeAccountId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }),
    );

    const wanted =
      query.followUp === true ? 'baogia' : (query.status ?? null);
    const filtered =
      wanted === null ? rows : rows.filter((row) => row.status === wanted);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;

    return Promise.resolve({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    });
  }

  /**
   * Demo stand-in for the backend's `buocVongDoi()` — it lives in the FAKE (the
   * demo "server"), never in a screen, exactly like `presetFor` above. The real
   * sequence is derived from ALLOWED_TRANSITIONS server-side (AD-2/AD-11); this
   * one only needs to be shaped right so the screen has something to draw.
   *
   * Steps blocked by a scope flag are ABSENT, not dimmed (UX-DR-11). Thiết bị
   * is always on in the demo, so `dagiao` is always reachable: through
   * `danggiao` when Vận chuyển is on, straight from `dacoc` (customer pick-up)
   * when it is off.
   */
  getLifecycle(orderId: string): Promise<OrderLifecycle> {
    const order = this.orders.get(orderId);
    // Demo rows carry no scope flags — treat them as CA_NHAN so the demo shows a
    // full-length stepper (that is also the case that overflows on mobile).
    const status = order?.status ?? DEMO_ORDER_ROWS[0].status;
    const thiCong = order?.scopeThiCong ?? true;
    const vanChuyen = order?.scopeVanChuyen ?? true;
    const chuoi = [
      'baogia',
      'dachot',
      'dacoc',
      ...(thiCong ? ['thicong', 'nghiemthu'] : []),
      ...(vanChuyen ? ['danggiao'] : []),
      'dagiao',
      'hoanthanh',
    ];
    const dangO = chuoi.indexOf(status);
    return Promise.resolve({
      buoc: chuoi.map((status, i) => ({
        status,
        trangThai:
          dangO === -1 || i > dangO
            ? ('upcoming' as const)
            : i === dangO
              ? ('current' as const)
              : ('done' as const),
      })),
      buocKeTiep: this.buocKeTiepDemo(status, thiCong, vanChuyen),
      // The demo "server" answers this the way the real one does — from the same
      // three statuses the transition table gives a `huy` edge. It lives HERE and
      // never in a screen (AD-2), which is also why the fake, not the screen,
      // knows that a cancelled order can no longer be cancelled.
      coTheHuy: ['baogia', 'dachot', 'dacoc'].includes(status),
    });
  }

  /**
   * Demo twin of `POST /orders/:id/huy` (Story 5.7). Applies the same three
   * refusals in the same order as the real backend so the dialog's error branch
   * is exercisable offline: unknown order → 404, status with no cancel edge
   * (including one already cancelled) → 409, reason too short → 400 with
   * `fieldErrors`.
   */
  huyDon(orderId: string, lyDo: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(
        this.loi('NOT_FOUND', `Không tìm thấy đơn hàng: ${orderId}`),
      );
    }
    if (!['baogia', 'dachot', 'dacoc'].includes(order.status)) {
      return Promise.reject(
        this.loi('CONFLICT', 'Không huỷ được đơn ở trạng thái hiện tại.'),
      );
    }
    const sach = lyDo.trim();
    if (sach.length < DEMO_LY_DO_TOI_THIEU) {
      return Promise.reject(
        this.loi('VALIDATION_ERROR', 'Cần lý do khi huỷ đơn.', [
          {
            field: 'lyDo',
            message: `Lý do huỷ là bắt buộc, tối thiểu ${DEMO_LY_DO_TOI_THIEU} ký tự.`,
          },
        ]),
      );
    }
    this.orders.set(orderId, {
      ...order,
      status: 'huy',
      cancelReason: sach,
      cancelledAt: NOW,
    });
    return Promise.resolve();
  }

  /**
   * Demo stand-in for the backend's `buocKeTiep()`. Like `getLifecycle` above it
   * lives in the FAKE (the demo "server"), NEVER in a screen — the real one
   * reads ALLOWED_TRANSITIONS and filters by the caller's real permissions
   * (AD-2/AD-11).
   *
   * Only the five MANUAL-lane events appear. `chot`/`mo_lai`/`huy`/`du_coc`/
   * `ap_chiet_khau` each own a separate endpoint carrying logic this screen does
   * not run, so the demo must not offer them either — a demo that offers a step
   * the real backend rejects teaches the wrong shape.
   *
   * An order at a terminal status yields an EMPTY array, which is what drives
   * the hidden-button branch of the screen.
   */
  private buocKeTiepDemo(
    status: string,
    thiCong: boolean,
    vanChuyen: boolean,
  ): OrderNextStep[] {
    const buoc: OrderNextStep[] = [];
    // Thiết bị is always on in the demo ⇒ a confirmed order may close directly.
    if (status === 'dachot') {
      buoc.push({ event: 'hoan_thanh', to: 'hoanthanh', requires: 'payments.record' });
    }
    if (status === 'dacoc' && thiCong) {
      buoc.push({
        event: 'bat_dau_thi_cong',
        to: 'thicong',
        requires: 'construction.transition',
      });
    }
    if (status === 'dacoc' && vanChuyen) {
      buoc.push({
        event: 'bat_dau_giao',
        to: 'danggiao',
        requires: 'delivery.confirm',
      });
    }
    if (status === 'dacoc' && !vanChuyen) {
      buoc.push({ event: 'xong_giao', to: 'dagiao', requires: 'delivery.confirm' });
    }
    if (status === 'thicong') {
      buoc.push({
        event: 'xong_thi_cong',
        to: 'nghiemthu',
        requires: 'construction.transition',
      });
    }
    if (status === 'danggiao') {
      buoc.push({ event: 'xong_giao', to: 'dagiao', requires: 'delivery.confirm' });
    }
    if (status === 'nghiemthu') {
      buoc.push({
        event: 'hoan_thanh',
        to: 'hoanthanh',
        requires: 'construction.transition',
      });
    }
    if (status === 'dagiao') {
      buoc.push({ event: 'hoan_thanh', to: 'hoanthanh', requires: 'delivery.confirm' });
    }
    return buoc;
  }

  /**
   * Demo twin of `POST /orders/:id/chuyen-trang-thai` (Story 5.5). It applies the
   * same three refusals the real backend applies, in the same order, so the
   * screen's error branches are exercisable offline:
   * unknown order → 404, step not offered for this status → 409, photo outside
   * the limits → 400 with `fieldErrors`.
   *
   * Photos are COUNTED, not stored: the demo has no R2 and inventing a fake
   * object key would teach the screen a shape the real port does not return.
   */
  chuyenTrangThai(
    orderId: string,
    event: string,
    anh: File[],
  ): Promise<StatusChangeResult> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(
        this.loi('NOT_FOUND', `Không tìm thấy đơn hàng: ${orderId}`),
      );
    }
    const buoc = this.buocKeTiepDemo(
      order.status,
      order.scopeThiCong ?? true,
      order.scopeVanChuyen ?? true,
    ).find((b) => b.event === event);
    if (buoc === undefined) {
      return Promise.reject(
        this.loi(
          'CONFLICT',
          'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
        ),
      );
    }
    // Every demo order carries stock-tracked lines ⇒ the direct and construction closes
    // are refused until the stock is issued, exactly as the backend does.
    if (
      DEMO_CLOSE_REQUIRES_ISSUE_FROM.includes(order.status) &&
      event === 'hoan_thanh' &&
      !this.issuedVouchers.has(orderId)
    ) {
      return Promise.reject(FAKE_CLOSE_BEFORE_ISSUE_ERROR);
    }
    if (anh.length > DEMO_SO_ANH_TOI_DA) {
      return Promise.reject(
        this.loi('VALIDATION_ERROR', 'Ảnh đính kèm không hợp lệ.', [
          {
            field: 'anh',
            message: `Tối đa ${DEMO_SO_ANH_TOI_DA} ảnh cho một lần chuyển trạng thái.`,
          },
        ]),
      );
    }
    // "Đã giao" issues the stock in the same commit when it was not issued yet.
    if (event === EVENT_DELIVERED && !this.issuedVouchers.has(orderId)) {
      if (orderId === FAKE_ORDER_SHORT_STOCK) {
        return Promise.reject(FAKE_STOCK_ISSUE_SHORT_ERROR);
      }
      this.recordIssue(orderId);
    }
    this.orders.set(orderId, { ...order, status: buoc.to });
    return Promise.resolve({
      status: buoc.to,
      occurredAt: NOW,
      soAnhDaLuu: anh.length,
    });
  }

  /**
   * Demo photos — three shapes on purpose so every branch of the gallery has
   * data: one step photo (both coordinates set), one supplementary photo (both
   * null), and one the caller cannot delete.
   *
   * `coTheXoa` arrives PRE-COMPUTED here exactly as it does from the real
   * backend — the fake plays the server's role, so the rule lives here and never
   * in a screen or component (AD-2).
   */
  private anhDemo = new Map<string, AttachmentItem[]>();

  private anhCuaDon(orderId: string): AttachmentItem[] {
    const daCo = this.anhDemo.get(orderId);
    if (daCo !== undefined) return daCo;
    const khoiTao: AttachmentItem[] = [
      {
        id: `${orderId}-anh-bo-sung`,
        fileName: 'bien-ban-bo-sung.png',
        contentType: 'image/png',
        size: 204800,
        createdAt: NOW,
        nguoiTaiLen: 'Nguyễn Văn Quản Lý',
        statusFrom: null,
        statusTo: null,
        coTheXoa: true,
      },
      {
        id: `${orderId}-anh-buoc`,
        fileName: 'nghiem-thu-thi-cong.jpg',
        contentType: 'image/jpeg',
        size: 512000,
        createdAt: NOW,
        nguoiTaiLen: 'Trần Thợ Thi Công',
        statusFrom: 'dacoc',
        statusTo: 'thicong',
        coTheXoa: true,
      },
      {
        id: `${orderId}-anh-nguoi-khac`,
        fileName: 'giao-hang.jpg',
        contentType: 'image/jpeg',
        size: 348160,
        createdAt: NOW,
        nguoiTaiLen: 'Lê Kho Giao',
        statusFrom: 'thicong',
        statusTo: 'danggiao',
        coTheXoa: false,
      },
    ];
    this.anhDemo.set(orderId, khoiTao);
    return khoiTao;
  }

  listAnh(orderId: string): Promise<AttachmentItem[]> {
    if (!this.orders.has(orderId)) {
      return Promise.reject(
        this.loi('NOT_FOUND', `Không tìm thấy đơn hàng: ${orderId}`),
      );
    }
    return Promise.resolve([...this.anhCuaDon(orderId)]);
  }

  themAnh(orderId: string, files: File[]): Promise<void> {
    if (!this.orders.has(orderId)) {
      return Promise.reject(
        this.loi('NOT_FOUND', `Không tìm thấy đơn hàng: ${orderId}`),
      );
    }
    if (files.length > DEMO_SO_ANH_TOI_DA) {
      return Promise.reject(
        this.loi('VALIDATION_ERROR', 'Ảnh đính kèm không hợp lệ.', [
          {
            field: 'anh',
            message: `Tối đa ${DEMO_SO_ANH_TOI_DA} ảnh cho một lần tải lên.`,
          },
        ]),
      );
    }
    const danhSach = this.anhCuaDon(orderId);
    files.forEach((file, i) => {
      this.seq += 1;
      danhSach.unshift({
        id: `${orderId}-anh-moi-${this.seq}-${i}`,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        createdAt: NOW,
        nguoiTaiLen: 'Nguyễn Văn Quản Lý',
        statusFrom: null,
        statusTo: null,
        coTheXoa: true,
      });
    });
    return Promise.resolve();
  }

  xoaAnh(orderId: string, attachmentId: string): Promise<void> {
    const danhSach = this.anhCuaDon(orderId);
    const viTri = danhSach.findIndex((a) => a.id === attachmentId);
    if (viTri === -1) {
      return Promise.reject(
        this.loi('NOT_FOUND', 'Không tìm thấy ảnh đính kèm.'),
      );
    }
    if (!danhSach[viTri].coTheXoa) {
      return Promise.reject(
        this.loi('FORBIDDEN', 'Bạn không có quyền xoá ảnh này.'),
      );
    }
    danhSach.splice(viTri, 1);
    return Promise.resolve();
  }

  anhBytes(orderId: string, attachmentId: string): Promise<Blob> {
    const found = this.anhCuaDon(orderId).find((a) => a.id === attachmentId);
    if (found === undefined) {
      return Promise.reject(
        this.loi('NOT_FOUND', 'Không tìm thấy ảnh đính kèm.'),
      );
    }
    // Demo bytes, not a real image: the fake stands in for the proxy route, and
    // no test renders actual pixels.
    return Promise.resolve(
      new Blob([`anh-demo-${attachmentId}`], { type: found.contentType }),
    );
  }

  /** AD-5 envelope shape the real port rejects with. */
  private loi(
    code: string,
    message: string,
    fieldErrors?: { field: string; message: string }[],
  ): OrderPortError {
    return fieldErrors === undefined
      ? { code, message }
      : { code, message, fieldErrors };
  }

  /** Demo twin of `GET /orders/:id/stock-issue`. */
  getStockIssue(orderId: string): Promise<OrderStockIssueView> {
    const voucher = this.issuedVouchers.get(orderId);
    if (voucher !== undefined) {
      return Promise.resolve({
        issued: true,
        voucher,
        canIssue: false,
        blocked: false,
        lines: [],
        untrackedItems: [],
      });
    }
    // The demo "server" answers `canIssue` from the status it knows; ids it never
    // created (test fixtures) keep the issuable demo.
    const status = this.orders.get(orderId)?.status;
    return Promise.resolve({
      issued: false,
      canIssue: status === undefined || DEMO_ISSUABLE_STATUSES.includes(status),
      // The backend's warning for the fixed short demo order.
      blocked: orderId === FAKE_ORDER_SHORT_STOCK,
      lines:
        orderId === FAKE_ORDER_SHORT_STOCK
          ? [DEMO_SHORT_LINE, ...DEMO_ISSUE_LINES]
          : [...DEMO_ISSUE_LINES],
      untrackedItems: [...DEMO_UNTRACKED_ITEMS],
    });
  }

  /**
   * Demo twin of `POST /orders/:id/stock-issue`: issued once, the same
   * voucher on every later call; a fixed 409 on `FAKE_ORDER_SHORT_STOCK`.
   */
  issueStock(orderId: string): Promise<OrderStockIssueResult> {
    const existing = this.issuedVouchers.get(orderId);
    if (existing !== undefined) return Promise.resolve({ voucher: existing });
    if (orderId === FAKE_ORDER_SHORT_STOCK) {
      return Promise.reject(FAKE_STOCK_ISSUE_SHORT_ERROR);
    }
    return Promise.resolve({ voucher: this.recordIssue(orderId) });
  }

  /**
   * Demo twin of `GET /orders/:id/stock-check`: per stock-tracked product of
   * the order, same-product lines merged, ordered by name; figures from the
   * fixed demo table. An order the fake never created gets `DEMO_STOCK_CHECK`.
   */
  getStockCheck(orderId: string): Promise<OrderStockCheck> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.resolve({ lines: DEMO_STOCK_CHECK.map((l) => ({ ...l })) });
    }
    const merged = new Map<string, OrderStockCheckLine>();
    for (const line of order.lineItems) {
      const stock = line.productId === null ? undefined : DEMO_STOCK_BY_PRODUCT[line.productId];
      if (line.productId === null || stock === undefined) continue;
      const seen = merged.get(line.productId);
      merged.set(line.productId, {
        productId: line.productId,
        name: line.name,
        unit: line.unit,
        qty: (seen?.qty ?? 0) + line.qty,
        ...stock,
      });
    }
    return Promise.resolve({
      lines: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    });
  }

  /** The order's one stock-out, as the backend writes it (standalone or "Đã giao"). */
  private recordIssue(orderId: string): StockVoucherDetail {
    const voucher: StockVoucherDetail = {
      id: `pk-xuat-${orderId}`,
      ma: 'PK-X-0097',
      type: 'xuat',
      orderId,
      createdAt: NOW,
      nguoiTao: { id: 'acc-kho-binh', displayName: 'Kho/Giao hàng (Bình)' },
      soDong: DEMO_ISSUE_LINES.length,
      tongSoLuong: 15,
      note: null,
      lines: DEMO_ISSUE_LINES.map(({ productId, name, sku, unit, qty }) => ({
        productId,
        ten: name,
        sku,
        donVi: unit,
        qty,
      })),
    };
    this.issuedVouchers.set(orderId, voucher);
    return voucher;
  }

  /**
   * Demo history. Two shapes on purpose so the screen's empty/populated branches
   * both have data: an order whose id ends in `-1` gets several versions, every
   * other order stays at its original version.
   */
  listVersions(orderId: string): Promise<OrderVersionItem[]> {
    const goc: OrderVersionItem = {
      id: `${orderId}-v1`,
      versionNo: 1,
      laBanHienLuc: !orderId.endsWith('-1'),
      createdAt: NOW,
      chotAt: null,
      createdByAccountId: 'acc-demo',
      createdByDisplayName: 'Nguyễn Văn Quản Lý',
      soDong: 3,
      thayDoi: { them: [], xoa: [], doiSoLuong: [] },
    };
    if (!orderId.endsWith('-1')) return Promise.resolve([goc]);
    return Promise.resolve([
      goc,
      {
        id: `${orderId}-v2`,
        versionNo: 2,
        laBanHienLuc: true,
        createdAt: NOW,
        chotAt: null,
        // Bản cũ không có actor ⇒ null; màn hiện `—`, không bịa tên.
        createdByAccountId: null,
        createdByDisplayName: null,
        soDong: 4,
        thayDoi: {
          them: ['Tủ điện DC 2 string'],
          xoa: [],
          doiSoLuong: [{ ten: 'Tấm pin JA Solar 580W', tu: 8, den: 12 }],
        },
      },
    ]);
  }

  private buildLine(
    order: Order,
    fields: Omit<OrderLine, 'id' | 'displayOrder' | 'amount'>,
  ): OrderLine {
    return {
      ...fields,
      id: `line-demo-${this.seq}`,
      displayOrder: order.lineItems.length,
      amount: this.serverAmount(fields.unitPrice, fields.qty),
    };
  }

  /** The BACKEND's lineAmount() stand-in — lives in the fake (the demo "server"), never in UI code. */
  private serverAmount(unitPrice: number, qty: number): number {
    return unitPrice * qty;
  }
}
