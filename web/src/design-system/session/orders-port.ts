// hand-authored — web orders port (Story 4.1, mirror Flutter
// mobile/lib/design_system/session/orders_port.dart). The seam between the
// quote-building screen and the `/orders` endpoints.
//
// THE CLIENT DOES NO MONEY MATH (AD-10/16): every `unitPrice`/`amount` that
// crosses this port INBOUND is a number the BACKEND computed (auto-filled
// catalogue price, live pre-confirmation price, line amount). The screen renders
// them as-is — a qty edit goes OUT through `updateLine` and the fresh numbers
// come BACK in the response.
//
// The backend enforces every rule behind these calls (AD-4): permission, the
// `'baogia'`-only mutation window, the `priceEditable` gate on unit prices, the
// `Order.sourceId` snapshot. Nothing here is a security boundary.

/**
 * The confirmed order status — the ONE status literal screens compare against
 * (Story 4.6). Screens import this constant; the guard forbids the raw literal
 * inside screen files, so the string lives here in the port file only.
 */
export const ORDER_STATUS_DACHOT = 'dachot';

/** Mirrors the backend `OrderLineItemResponseDto` — `unitPrice`/`amount` are backend numbers. */
export interface OrderLine {
  id: string;
  productId: string | null;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  priceEditable: boolean;
  isFlexible: boolean;
  note: string | null;
  warrantyMonths: number | null;
  displayOrder: number;
  amount: number;
}

/**
 * Mirrors the backend `OrderResponseDto`. `lineItems` are the lines of the
 * CURRENT version (AD-6) — the client never sees the version concept in 4.1.
 * Totals are deliberately NOT on `Order`: they travel through `previewTotal`
 * (stateless `POST /orders/preview-total`) so there is exactly ONE computer
 * of money — the backend (AD-16).
 */
export interface Order {
  id: string;
  status: string;
  customerSdt: string;
  currentVersionId: string | null;
  ownerAccountId: string;
  assigneeAccountId: string | null;
  sourceId: string;
  custType: string;
  scopeThietBi: boolean;
  scopeThiCong: boolean;
  scopeVanChuyen: boolean;
  kWp: number | null;
  vatMode: string | null;
  validityNote: string | null;
  lineItems: OrderLine[];
  createdAt: string;
  updatedAt: string;
}

/** Body of `POST /orders` — the customer phone, RAW or E.164 (backend normalises, AD-9). */
export interface CreateOrderInput {
  customerSdt: string;
}

/**
 * Body of `POST /orders/:id/line-items` — two shapes in one input (UX-DR-24):
 * catalogue line (`productId` set — backend copies name/unit/priceEditable and
 * auto-fills the price; `unitPrice` allowed ONLY when the product permits) or
 * free line (`productId` absent — `name`/`unit`/`unitPrice` required).
 */
export interface AddOrderLineInput {
  productId?: string;
  name?: string;
  unit?: string;
  qty: number;
  unitPrice?: number;
  note?: string | null;
  isFlexible?: boolean;
}

/** Body of `PATCH /orders/:id/line-items/:lineId` — `unitPrice` only on `priceEditable` lines. */
export interface UpdateOrderLineInput {
  qty?: number;
  unitPrice?: number;
  note?: string | null;
  isFlexible?: boolean;
}

/**
 * Body of `PATCH /orders/:id` (Story 4.3) — partial toggle of the two MUTABLE
 * scope flags. `scopeThietBi` is deliberately absent: every order carries
 * equipment, the backend keeps it `true` and accepts no write for it.
 */
export interface UpdateScopeFlagsInput {
  scopeThiCong?: boolean;
  scopeVanChuyen?: boolean;
}

/**
 * Body of `PATCH /orders/:id` (Story 4.4) — the order-metadata group of the same
 * endpoint: the VAT tick, the system capacity and the quote validity note.
 * `kWp`/`validityNote` accept `null` = clear the value; `vatMode` is always one
 * of the backend registry values (`'co_vat' | 'khong_vat'`) echoed, never
 * invented here.
 */
export interface UpdateOrderMetaInput {
  vatMode?: string;
  kWp?: number | null;
  validityNote?: string | null;
}

/**
 * Mirrors the backend `PreviewTotalResponseDto` — three BACKEND-computed integer
 * đồng numbers (AD-16) plus the applied `vatRate`/`applyVat` (Story 4.4) so the
 * screen can label the VAT row ("VAT 8%") with a backend value, never a static
 * label. The screen renders them as-is, "—" until the first response (or after
 * a failed preview).
 */
export interface OrderTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: number;
  applyVat: boolean;
}

/**
 * Body of `POST /orders/preview-total` — the lines the screen is DISPLAYING,
 * echoed back (every `unitPrice` is a number the backend already returned).
 * `vatMode` (Story 4.4) is echoed from `Order.vatMode` the same way — the
 * client never sends a rate.
 */
export interface PreviewTotalInput {
  lines: Array<{ unitPrice: number; qty: number }>;
  vatMode?: string;
}

/**
 * The AD-5 error envelope an `OrdersPort` rejects with when the backend refuses a
 * call (400 validation, 404, 409 non-draft order). Mirrors Flutter `OrderPortException`.
 *
 * The screen renders `message` VERBATIM — the backend owns the pricing/status
 * rules, so it owns the words for them too. Screen-invented copy is reserved for
 * transport failures the backend never saw.
 */
export interface OrderPortError {
  message: string;
  fieldErrors?: { field: string; message: string }[];
}

/**
 * Injectable transport for the quote screen. This is a PORT, NOT an HTTP client —
 * the seam that lets the screen exist before the app owns a bundler/router/token
 * store.
 *
 * TODO(app-runtime): the real implementation attaches `Authorization: Bearer
 * <accessToken>` (Story 2.3) and parses the AD-5 envelope into `OrderPortError`.
 * Until then `FakeOrdersPort` drives the guards/demo.
 */
export interface OrdersPort {
  /** Create a draft order for a customer. Rejects 400 (bad phone) / 404 (no such customer). */
  create(input: CreateOrderInput): Promise<Order>;

  /** Read an order + the lines of its current version. Rejects NOT_FOUND if absent. */
  get(id: string): Promise<Order>;

  /** Append a line (catalogue or free). Rejects 400/404/409 per the backend rules. */
  addLine(orderId: string, input: AddOrderLineInput): Promise<OrderLine>;

  /** Edit qty/note/isFlexible — and unitPrice only where `priceEditable`. */
  updateLine(
    orderId: string,
    lineId: string,
    input: UpdateOrderLineInput,
  ): Promise<OrderLine>;

  /** Remove a line from the current version. */
  removeLine(orderId: string, lineId: string): Promise<void>;

  /**
   * Toggle the Thi công/Vận chuyển scope flags (Story 4.3) — only while the
   * order is still `'baogia'` (409 otherwise). Returns the full fresh order.
   */
  updateScopeFlags(orderId: string, input: UpdateScopeFlagsInput): Promise<Order>;

  /**
   * Update the order metadata group — VAT tick / kWp / validity note (Story
   * 4.4). Same PATCH endpoint as `updateScopeFlags`, kept as a second typed
   * method so each call site says which group it touches. Only while `'baogia'`
   * (409 otherwise). Returns the full fresh order.
   */
  updateOrderMeta(orderId: string, input: UpdateOrderMetaInput): Promise<Order>;

  /**
   * Stateless totals preview (AD-16): send the displayed lines, get the ONE
   * computer's subtotal/VAT/total back. No order is read or written.
   */
  previewTotal(input: PreviewTotalInput): Promise<OrderTotals>;

  /**
   * Confirm ("Chốt") the order — `POST /orders/:id/chot` (Story 4.5, FR-5).
   * The BACKEND freezes every line price into snapshots and flips the status
   * to `'dachot'`; the screen just renders the returned order (whose line
   * `unitPrice` is now the frozen number). Idempotent on the server: retrying
   * an already-confirmed order returns it unchanged. Rejects 400 (empty
   * quote), 403 (`orders.confirm` missing), 404, 409 (non-confirmable status).
   */
  confirmOrder(orderId: string): Promise<Order>;

  /**
   * Reopen ("Mở lại") a confirmed order for editing — `POST /orders/:id/mo-lai`
   * (Story 4.6, FR-6). The BACKEND creates a NEW version (copying the lines,
   * snapshots reset) and flips the status back to `'baogia'`; the old version
   * stays untouched in history. The screen just renders the returned order —
   * catalogue line prices are live again (FR-5). Idempotent on the server:
   * calling it on an order already `'baogia'` returns it unchanged. Rejects
   * 403 (`quotes.create_edit` missing), 404, 409 (non-reopenable status).
   */
  reviseOrder(orderId: string): Promise<Order>;
}
