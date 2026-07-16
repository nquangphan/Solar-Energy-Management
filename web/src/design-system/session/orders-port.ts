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
 * There is deliberately NO subtotal/VAT/total: that is Story 4.2's
 * `preview-total`; the totals area renders "—" until then.
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
}
