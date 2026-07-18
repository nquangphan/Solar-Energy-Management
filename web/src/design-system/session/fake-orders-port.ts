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
import type {
  AddOrderLineInput,
  OrderListItem,
  OrderListQuery,
  OrderPage,
  ApplyDiscountInput,
  CreateOrderInput,
  DiscountPendingItem,
  Order,
  OrderLifecycleStep,
  OrderLine,
  OrderTotals,
  OrderVersionItem,
  OrdersPort,
  PreviewTotalInput,
  QuoteExportFiles,
  ResolveDiscountInput,
  UpdateOrderLineInput,
  UpdateOrderMetaInput,
  UpdateScopeFlagsInput,
} from './orders-port';

const NOW = '2026-07-16T00:00:00.000Z';

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
   * Steps blocked by a scope flag are ABSENT, not dimmed (UX-DR-11).
   */
  getLifecycle(orderId: string): Promise<OrderLifecycleStep[]> {
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
      ...(vanChuyen ? ['danggiao', 'dagiao'] : []),
      'hoanthanh',
    ];
    const dangO = chuoi.indexOf(status);
    return Promise.resolve(
      chuoi.map((status, i) => ({
        status,
        trangThai:
          dangO === -1 || i > dangO
            ? ('upcoming' as const)
            : i === dangO
              ? ('current' as const)
              : ('done' as const),
      })),
    );
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
