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

/**
 * The awaiting-discount-approval order status (Story 4.7, FR-18) — same rule as
 * `ORDER_STATUS_DACHOT`: screens import the constant, the guard forbids the raw
 * literal inside screen files.
 */
export const ORDER_STATUS_CHODUYET = 'choduyet';

/**
 * Discount-approval statuses (Story 4.7) — the `Order.discount.status` values.
 * Distinct from the ORDER status `'choduyet'`: these describe the approval
 * record, underscore-keyed like `vatMode`. They live HERE so screens compare
 * against constants, never ad-hoc literals.
 */
export const DISCOUNT_CHO_DUYET = 'cho_duyet';
export const DISCOUNT_DONG_Y = 'dong_y';
export const DISCOUNT_TU_CHOI = 'tu_choi';

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
  /**
   * Why the order was cancelled, and when (Story 5.7). Both null until it is
   * cancelled. Not permission-fenced: whoever can read the order can read why it
   * was cancelled.
   */
  cancelReason: string | null;
  cancelledAt: string | null;
  lineItems: OrderLine[];
  discount: OrderDiscount | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The LATEST discount-approval record of the order (Story 4.7) — null when the
 * order never had a discount applied. After a rejection the order is back to
 * `'baogia'` but still carries `status: 'tu_choi'` + `resolveNote` so the screen
 * can show the reason banner.
 */
export interface OrderDiscount {
  amount: number;
  status: string;
  requestNote: string | null;
  resolveNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

/**
 * One row of `GET /orders` (Story 5.3) — mirrors the backend `OrderListItemDto`
 * field-for-field (AD-12: the contract comes FROM the backend).
 *
 * Deliberately carries NO money: a list total would need the version + pricing
 * join, and a wrong number on a list row is a money regression. No `costPrice`
 * either (the `costs.view` fence, AD-4).
 */
export interface OrderListItem {
  id: string;
  status: string;
  customerSdt: string;
  customerName: string;
  ownerAccountId: string;
  assigneeAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One step of the order lifecycle stepper (Story 5.4) — mirrors the backend
 * `OrderLifecycleStepDto` field-for-field (AD-12).
 *
 * The BACKEND decides which steps exist for this order (it gates them by the
 * order's scope flags, FR-7) and which one the order is standing on. The screen
 * renders the array as given: it does not filter it, and it does not derive
 * steps from flags — a second copy of the transition table on the client would
 * drift the first time Epic 6 changes the real one (AD-2/AD-11).
 *
 * No Vietnamese label here: labels live in `STATUS_LABELS` and are parity-guarded
 * byte-for-byte against mobile.
 */
export interface OrderLifecycleStep {
  status: string;
  trangThai: 'done' | 'current' | 'upcoming';
}

/**
 * One step the CALLER can actually take right now (Story 5.5) — mirrors the
 * backend `OrderNextStepDto` field-for-field (AD-12).
 *
 * The BACKEND filters this by the order's current status, its scope flags and
 * the caller's REAL permissions. The client never recomputes it: the branches
 * require DIFFERENT permission keys, so an any-of expression on the client would
 * be a third copy of the rule and it would drift (AD-2/AD-4).
 *
 * No Vietnamese label here either — the destination's label comes from
 * `STATUS_LABELS`, which is parity-guarded against mobile byte-for-byte.
 */
export interface OrderNextStep {
  event: string;
  to: string;
  requires: string;
}

/**
 * The whole `GET /orders/:id/vong-doi` reply (Story 5.4 + 5.5): what the stepper
 * draws, and what this caller can do next.
 *
 * Both come from ONE read of the order. A second route for `buocKeTiep` would be
 * a second request asking the same question.
 *
 * `buocKeTiep` EMPTY means this caller has no legal step — the "Chuyển trạng
 * thái" button is then hidden outright, not greyed (UX-DR-22).
 */
export interface OrderLifecycle {
  buoc: OrderLifecycleStep[];
  buocKeTiep: OrderNextStep[];
  /**
   * Whether THIS caller can cancel THIS order (Story 5.7) — the backend read it
   * off the transition table against the caller's real permissions.
   *
   * It cannot be derived from `buocKeTiep`: cancelling is not part of the manual
   * lane, so `huy` never appears there. And the client must not derive it from
   * `status` either — that is business logic (AD-2). `false` ⇒ the button is
   * ABSENT, not greyed (UX-DR-22).
   */
  coTheHuy: boolean;
}

/** What one manual transition did — mirrors the backend `StatusChangeResponseDto`. */
export interface StatusChangeResult {
  status: string;
  occurredAt: string;
  soAnhDaLuu: number;
}

/**
 * One photo attached to an order (Story 5.6, FR-24) — mirrors the backend
 * `AttachmentItemDto` field for field.
 *
 * `statusFrom`/`statusTo` are the step coordinates: BOTH null means this is a
 * supplementary photo that belongs to no transition. The screen reads that pair
 * to pick the badge; it does not infer the kind from anywhere else.
 *
 * `coTheXoa` is computed by the BACKEND (uploader OR order-edit permission,
 * AD-2/AD-4). The client ONLY renders it — rebuilding that expression here would
 * be a second copy of the rule, and it would drift.
 *
 * There is NO object key here: R2 keys never leave the backend (AD-3). Bytes come
 * from `anhBytes()`, which goes through the authenticated proxy route.
 */
export interface AttachmentItem {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  nguoiTaiLen: string;
  statusFrom: string | null;
  statusTo: string | null;
  coTheXoa: boolean;
}

/** What changed between version N-1 and version N — lines and quantities only. */
export interface OrderVersionChange {
  them: string[];
  xoa: string[];
  doiSoLuong: { ten: string; tu: number; den: number }[];
}

/**
 * One update version in the order history (Story 5.4, FR-6) — mirrors the backend
 * `OrderVersionItemDto`.
 *
 * `laBanHienLuc` is resolved by the backend through `Order.currentVersionId`
 * (AD-6) — the screen must NOT re-derive it from the highest `versionNo`.
 *
 * Carries NO money: history answers which/who/when/what-changed, and money only
 * ever travels through `previewTotal` (AD-10).
 */
export interface OrderVersionItem {
  id: string;
  versionNo: number;
  laBanHienLuc: boolean;
  createdAt: string;
  chotAt: string | null;
  createdByAccountId: string | null;
  createdByDisplayName: string | null;
  soDong: number;
  thayDoi: OrderVersionChange;
}

/** Paged envelope of `GET /orders` — `total` counts the whole scoped+filtered set. */
export interface OrderPage {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Query of `GET /orders` (Story 5.3). There is deliberately NO scope field:
 * "all orders" vs "my orders" is a PERMISSION resolved server-side, never a
 * client parameter — accepting one here would be an IDOR hole (AD-4, FR-18).
 *
 * `followUp` and `status` are mutually exclusive; sending both is a 400 from the
 * backend, not a silently-empty list.
 */
export interface OrderListQuery {
  status?: string;
  followUp?: boolean;
  page?: number;
  pageSize?: number;
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
  // Absent = keep; a number (≥ 1) = set; `null` = clear warranty (a valid business value,
  // NOT "keep"). Catalogue install lines (productId set + priceEditable) are ignored backend-side.
  warrantyMonths?: number | null;
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
  discountAmount: number;
  vatAmount: number;
  total: number;
  vatRate: number;
  applyVat: boolean;
}

/** Body of `POST /orders/:id/ap-chiet-khau` (Story 4.7) — one integer đồng amount on the ORDER. */
export interface ApplyDiscountInput {
  amount: number;
  note?: string;
}

/** Body of `POST /orders/:id/duyet-chiet-khau` (Story 4.7) — `reason` REQUIRED when rejecting. */
export interface ResolveDiscountInput {
  approve: boolean;
  reason?: string;
}

/**
 * One exported quote file (Story 4.8, FR-21) — `bytes` are the BACKEND-rendered
 * binary (image or PDF), fetched through the JWT proxy routes (AD-3: no public
 * bucket, no presigned URL). The screen only wraps them into `File`/share.
 */
export interface QuoteExportFile {
  fileName: string;
  mimeType: string;
  // `<ArrayBuffer>` (không phải ArrayBufferLike mặc định): `new File([bytes])` chỉ nhận
  // view trên ArrayBuffer thường — response.arrayBuffer() của port HTTP luôn là loại này.
  bytes: Uint8Array<ArrayBuffer>;
}

/** The pair one `exportQuote` call yields — share order is [image, pdf] (UX-DR-21). */
export interface QuoteExportFiles {
  image: QuoteExportFile;
  pdf: QuoteExportFile;
}

/**
 * One line of a pending-discount item — `estimatedMarginPct` is a BACKEND-rounded
 * integer percent (or null: free line, zero price, or caller lacks `costs.view`,
 * FR-37). The screen renders it verbatim ("X%" / "—"), never computes it.
 */
export interface DiscountPendingLine {
  name: string;
  qty: number;
  unitPrice: number;
  estimatedMarginPct: number | null;
}

/**
 * One item of `GET /orders/cho-duyet-chiet-khau` (Story 4.7, FR-18/FR-37) —
 * `subtotal`/`afterDiscount` are BACKEND numbers (AD-16), the screen displays
 * them as-is.
 */
export interface DiscountPendingItem {
  orderId: string;
  customerSdt: string;
  amount: number;
  requestNote: string | null;
  requestedByAccountId: string;
  requestedByDisplayName: string;
  requestedAt: string;
  subtotal: number;
  afterDiscount: number;
  lines: DiscountPendingLine[];
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
  /** Echoed from `Order.discount.amount` (Story 4.7) — never computed client-side. */
  discountAmount?: number;
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
  /**
   * The envelope's `code` (AD-5). Screens branch on THIS, never on `message`:
   * "đơn không tồn tại / ngoài phạm vi" is an ANSWER and a retry button will
   * never change it, while a transport failure is worth retrying — telling the
   * two apart by matching Vietnamese prose breaks the day someone reworded it.
   * Absent when the request never reached the backend (network failure).
   */
  code?: string;
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

  /**
   * List orders — `GET /orders` (Story 5.3, FR-10). The BACKEND narrows the set
   * to what the caller may see (`orders.view_all` ⇒ every order; only
   * `orders.view_own` ⇒ orders they own or are assigned) and owns `total`.
   * Rejects 400 (bad status/page/pageSize, or `followUp` sent together with
   * `status`), 403 (holds NEITHER order-view key).
   */
  list(query: OrderListQuery): Promise<OrderPage>;

  /**
   * Lifecycle of one order — `GET /orders/:id/vong-doi` (Story 5.4 + 5.5, FR-7).
   * Steps already gated by the order's scope flags: those that do not apply are
   * ABSENT from the array, not dimmed (UX-DR-11). `buocKeTiep` is already
   * filtered by the caller's real permissions. Rejects 404 (absent or out of the
   * caller's scope — the two are indistinguishable by design), 403.
   */
  getLifecycle(orderId: string): Promise<OrderLifecycle>;

  /**
   * Update history of one order — `GET /orders/:id/phien-ban` (Story 5.4, FR-6).
   * Every version, `versionNo` ascending; exactly one carries `laBanHienLuc`.
   * Rejects 404 / 403 like `getLifecycle`.
   */
  listVersions(orderId: string): Promise<OrderVersionItem[]>;

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

  /**
   * Apply a discount and send it for approval — `POST /orders/:id/ap-chiet-khau`
   * (Story 4.7, FR-18). The BACKEND flips the status to `'choduyet'` (content
   * frozen until resolved) and records the approval request. Rejects 400 (amount
   * over subtotal / empty quote), 403 (`discounts.apply` missing), 404, 409
   * (non-`'baogia'` status — applying is NOT idempotent).
   */
  applyDiscount(orderId: string, input: ApplyDiscountInput): Promise<Order>;

  /**
   * Approve or reject the pending discount — `POST /orders/:id/duyet-chiet-khau`
   * (Story 4.7, FR-18). Approve keeps the order `'choduyet'` (confirming is a
   * separate `confirmOrder` action); reject returns it to `'baogia'` with the
   * reason on `discount.resolveNote`. Rejects 400 (missing reason on reject),
   * 403 (`discounts.approve` missing), 404, 409 (no pending approval / opposite
   * decision). Retrying the SAME decision is idempotent on the server.
   */
  resolveDiscount(orderId: string, input: ResolveDiscountInput): Promise<Order>;

  /**
   * List the orders awaiting discount approval — `GET /orders/cho-duyet-chiet-khau`
   * (Story 4.7, FR-18/FR-37). Every number (subtotal, afterDiscount, margins) is
   * backend-computed; margins are null when the caller lacks `costs.view`.
   * Rejects 403 (`discounts.approve` missing).
   */
  listPendingDiscounts(): Promise<DiscountPendingItem[]>;

  /**
   * Export the quote as PDF + image and fetch both files (Story 4.8, FR-21) —
   * `POST /orders/:id/xuat-bao-gia` then the two `GET /orders/:id/bao-gia/*`
   * proxy routes. The BACKEND renders both from ONE template (totals from the
   * one pricing function, AD-16) and overwrites the order's latest file pair.
   * Rejects 400 (empty quote), 403 (`quotes.create_edit` missing), 404.
   */
  exportQuote(orderId: string): Promise<QuoteExportFiles>;

  /**
   * Move the order one step and attach evidence photos (Story 5.5, FR-9/FR-23) —
   * `POST /orders/:id/chuyen-trang-thai` as `multipart/form-data`.
   *
   * `event` is one of the events `getLifecycle().buocKeTiep` handed back. The
   * caller does NOT name a destination: the destination belongs to the backend's
   * transition table, not to the client (AD-11).
   *
   * `anh` is ALWAYS optional — an empty array is the ordinary path, not an edge
   * case (FR-23, UX-DR-25). Limits are the backend's: 10 photos, 10 MB each,
   * jpeg/png/webp/heic.
   *
   * Rejects 400 (photo rejected — `fieldErrors` carries which one), 403 (missing
   * the permission this step needs), 409 (step outside this screen's lane,
   * outside the order's scope, or not reachable from the current status —
   * including pressing twice), 404.
   */
  chuyenTrangThai(
    orderId: string,
    event: string,
    anh: File[],
  ): Promise<StatusChangeResult>;

  /**
   * Cancel the order with a REASON — `POST /orders/:id/huy` (Story 5.7, FR-9).
   *
   * Its own endpoint, not an `event` of `chuyenTrangThai`: the reason is
   * mandatory and only this path enforces it.
   *
   * `lyDo` is required, 3–500 characters after trimming. Call this only when
   * `getLifecycle().coTheHuy` is true — the backend enforces the same rule anyway
   * and answers 403/409 otherwise (AD-4: hiding the button is UX, not security).
   *
   * Rejects 400 (`fieldErrors` carries `lyDo`), 403, 409 (current status has no
   * cancel edge — including an order already cancelled), 404.
   */
  huyDon(orderId: string, lyDo: string): Promise<void>;

  /**
   * Every photo of the order — step photos AND supplementary ones, in ONE flat
   * list newest first (Story 5.6, FR-24) — `GET /orders/:id/anh`.
   *
   * The order is the backend's (`createdAt` descending); the screen does not
   * re-sort. Rejects 403 (neither `orders.view_all` nor `orders.view_own`), 404
   * (order out of scope or missing).
   */
  listAnh(orderId: string): Promise<AttachmentItem[]>;

  /**
   * Attach supplementary photos OUTSIDE the transition flow (Story 5.6, FR-24) —
   * `POST /orders/:id/anh` as `multipart/form-data`. The rows land with all three
   * step coordinates null: they belong to no step.
   *
   * Limits are the backend's: 10 photos per upload, 10 MB each,
   * jpeg/png/webp/heic. Rejects 400 (`fieldErrors` says which photo), 403, 404.
   */
  themAnh(orderId: string, files: File[]): Promise<void>;

  /**
   * Delete ONE photo — `DELETE /orders/:id/anh/:attachmentId` (Story 5.6, FR-24).
   * Hard delete; the trail lives in the audit log.
   *
   * Call this only for items whose `coTheXoa` is true — the backend enforces the
   * same rule anyway and answers 403 otherwise (AD-4: hiding the button is UX,
   * not security). Rejects 403, 404.
   */
  xoaAnh(orderId: string, attachmentId: string): Promise<void>;

  /**
   * Bytes of ONE photo for preview — `GET /orders/:id/anh/:attachmentId`
   * (Story 5.5 proxy route, AD-3: the bucket is not public, every byte comes
   * through the backend behind JWT).
   *
   * The SCREEN calls this and hands the result to the gallery component; the
   * gallery itself never touches the network. Rejects 403, 404.
   */
  anhBytes(orderId: string, attachmentId: string): Promise<Blob>;
}
