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
//
// Every data type below is the GENERATED contract type (AD-12) — no hand-written
// mirror that can drift from the backend.

import type { components, paths } from '../../api/generated/schema';

type Schemas = components['schemas'];

/**
 * The confirmed order status — the ONE status literal screens compare against
 * (Story 4.6). Screens import this constant; the guard forbids the raw literal
 * inside screen files, so the string lives here in the port file only.
 */
export const ORDER_STATUS_DACHOT = 'dachot';

/**
 * The "Đã giao" (delivered) transition event. Confirming it ALSO
 * issues the order's stock (if not issued yet), so the status-change screen
 * previews the stock-out when this step is picked. Lives here for the same
 * reason as `ORDER_STATUS_DACHOT`: screens must not carry the raw event literal.
 */
export const EVENT_DELIVERED = 'xong_giao';

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

/** The backend `OrderLineItemResponseDto` — `unitPrice`/`amount` are backend numbers. */
export type OrderLine = Schemas['OrderLineItemResponseDto'];

/**
 * The backend `OrderResponseDto`. `lineItems` are the lines of the CURRENT
 * version (AD-6). Totals are deliberately NOT on `Order`: they travel through
 * `previewTotal` (stateless `POST /orders/preview-total`) so there is exactly ONE
 * computer of money — the backend (AD-16). `cancelReason`/`cancelledAt` (Story
 * 5.7) stay null until the order is cancelled; whoever can read the order can
 * read why it was cancelled.
 */
export type Order = Schemas['OrderResponseDto'];

/**
 * The LATEST discount-approval record of the order (Story 4.7) — null when the
 * order never had a discount applied. After a rejection the order is back to
 * `'baogia'` but still carries `status: 'tu_choi'` + `resolveNote` so the screen
 * can show the reason banner.
 */
export type OrderDiscount = Schemas['OrderDiscountDto'];

/**
 * One row of `GET /orders` (Story 5.3) — the backend `OrderListItemDto`.
 *
 * Deliberately carries NO money: a list total would need the version + pricing
 * join, and a wrong number on a list row is a money regression. No `costPrice`
 * either (the `costs.view` fence, AD-4).
 */
export type OrderListItem = Schemas['OrderListItemDto'];

/**
 * One step of the order lifecycle stepper (Story 5.4) — the backend
 * `OrderLifecycleStepDto`.
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
export type OrderLifecycleStep = Schemas['OrderLifecycleStepDto'];

/**
 * One step the CALLER can actually take right now (Story 5.5) — the backend
 * `OrderNextStepDto`.
 *
 * The BACKEND filters this by the order's current status, its scope flags and
 * the caller's REAL permissions. The client never recomputes it: the branches
 * require DIFFERENT permission keys, so an any-of expression on the client would
 * be a third copy of the rule and it would drift (AD-2/AD-4).
 *
 * No Vietnamese label here either — the destination's label comes from
 * `STATUS_LABELS`, which is parity-guarded against mobile byte-for-byte.
 */
export type OrderNextStep = Schemas['OrderNextStepDto'];

/**
 * The whole `GET /orders/:id/lifecycle` reply (Story 5.4 + 5.5): what the stepper
 * draws (`steps`), and what this caller can do next (`nextSteps`). Both come from
 * ONE read of the order.
 *
 * `nextSteps` EMPTY means this caller has no legal step — the "Chuyển trạng
 * thái" button is then hidden outright, not greyed (UX-DR-22).
 *
 * `canCancel` (Story 5.7) is whether THIS caller can cancel THIS order — the
 * backend read it off the transition table against the caller's real
 * permissions. It cannot be derived from `nextSteps` (cancelling is not part of
 * the manual lane) nor from `status` (business logic, AD-2). `false` ⇒ the
 * button is ABSENT, not greyed (UX-DR-22).
 */
export type OrderLifecycle = Schemas['OrderLifecycleResponseDto'];

/**
 * One row of the stock-out preview — `OrderStockIssueLineDto`. `qty` is what the
 * order needs (same-product lines already summed); `onHand` is for counting
 * against. The go/no-go WARNING is `shortfall` / the view's `blocked` — never a
 * client-side comparison; the server re-checks under the lock when issuing.
 */
export type OrderStockIssueLine = Schemas['OrderStockIssueLineDto'];

/**
 * `GET /orders/:id/stock-issue` — `OrderStockIssueViewDto`.
 *
 * ONE ORDER, ONE STOCK-OUT. `issued` + `voucher` once issued (ABSENT until then;
 * its `unitCost` is absent without `costs.view`); before that, `lines` (in the
 * backend's canonical order — a 409's `lines.{i}.qty` indexes into it) and
 * `untrackedItems` (line names that never go on the voucher). `canIssue` is
 * computed by the BACKEND (status, stock lines, permission) — the screen does
 * not re-derive it, and never compares `qty` with `onHand` (AD-2). `blocked`
 * (some line short right now) is the backend's warning; it is kept apart from
 * `canIssue` so the screen can tell "may not issue" from "may issue, but goods
 * are missing".
 */
export type OrderStockIssueView = Schemas['OrderStockIssueViewDto'];

/**
 * One product of the quote's early stock warning — `OrderStockCheckLineDto`.
 * Every figure (`reserved` = promised to OTHER orders, `available` may be
 * negative, `shortfall` ≥ 0) and `status` are the backend's; the screen picks
 * its wording from `status` only.
 */
export type OrderStockCheckLine = Schemas['OrderStockCheckLineDto'];

/**
 * `GET /orders/:id/stock-check` — `OrderStockCheckDto`. One entry per
 * stock-tracked product of the current version, ordered by name; free-text and
 * non-tracked lines are absent. A warning only — confirming is never blocked.
 */
export type OrderStockCheck = Schemas['OrderStockCheckDto'];

/** `POST /orders/:id/stock-issue` — `OrderStockIssueResultDto`. */
export type OrderStockIssueResult = Schemas['OrderStockIssueResultDto'];

/** What one manual transition did — the backend `StatusChangeResponseDto`. */
export type StatusChangeResult = Schemas['StatusChangeResponseDto'];

/**
 * One photo attached to an order (Story 5.6, FR-24) — the backend
 * `AttachmentItemDto`.
 *
 * `statusFrom`/`statusTo` are the step coordinates: BOTH null means this is a
 * supplementary photo that belongs to no transition. The screen reads that pair
 * to pick the badge; it does not infer the kind from anywhere else.
 *
 * `canDelete` is computed by the BACKEND (uploader OR order-edit permission,
 * AD-2/AD-4). The client ONLY renders it — rebuilding that expression here would
 * be a second copy of the rule, and it would drift.
 *
 * There is NO object key here: R2 keys never leave the backend (AD-3). Bytes come
 * from `attachmentBytes()`, which goes through the authenticated proxy route.
 */
export type AttachmentItem = Schemas['AttachmentItemDto'];

/** What changed between version N-1 and version N — lines and quantities only. */
export type OrderVersionChange = Schemas['VersionChangesDto'];

/**
 * One update version in the order history (Story 5.4, FR-6) — the backend
 * `OrderVersionItemDto`.
 *
 * `isCurrent` is resolved by the backend through `Order.currentVersionId`
 * (AD-6) — the screen must NOT re-derive it from the highest `versionNo`.
 *
 * Carries NO money: history answers which/who/when/what-changed, and money only
 * ever travels through `previewTotal` (AD-10).
 */
export type OrderVersionItem = Schemas['OrderVersionItemDto'];

/** Paged envelope of `GET /orders` — `total` counts the whole scoped+filtered set. */
export type OrderPage = Schemas['OrderListResponseDto'];

/**
 * Query of `GET /orders` (Story 5.3). There is deliberately NO scope field:
 * "all orders" vs "my orders" is a PERMISSION resolved server-side, never a
 * client parameter — accepting one here would be an IDOR hole (AD-4, FR-18).
 *
 * `followUp` and `status` are mutually exclusive; sending both is a 400 from the
 * backend, not a silently-empty list.
 */
export type OrderListQuery = NonNullable<paths['/orders']['get']['parameters']['query']>;

/** Body of `POST /orders` — the customer phone, RAW or E.164 (backend normalises, AD-9). */
export type CreateOrderInput = Schemas['CreateOrderRequestDto'];

/**
 * Body of `POST /orders/:id/line-items` — two shapes in one input (UX-DR-24):
 * catalogue line (`productId` set — backend copies name/unit/priceEditable and
 * auto-fills the price; `unitPrice` allowed ONLY when the product permits) or
 * free line (`productId` absent — `name`/`unit`/`unitPrice` required).
 */
export type AddOrderLineInput = Schemas['AddLineItemRequestDto'];

/**
 * Body of `PATCH /orders/:id/line-items/:lineId` — `unitPrice` only on
 * `priceEditable` lines. `warrantyMonths`: absent = keep; a number (≥ 1) = set;
 * `null` = clear warranty (a valid business value, NOT "keep"). Catalogue install
 * lines (productId set + priceEditable) are ignored backend-side.
 */
export type UpdateOrderLineInput = Schemas['UpdateLineItemRequestDto'];

/**
 * Body of `PATCH /orders/:id` (Story 4.3) — partial toggle of the two MUTABLE
 * scope flags. `scopeEquipment` is deliberately absent: every order carries
 * equipment, the backend keeps it `true` and accepts no write for it.
 */
export type UpdateScopeFlagsInput = Pick<
  Schemas['UpdateOrderRequestDto'],
  'scopeConstruction' | 'scopeDelivery'
>;

/**
 * Body of `PATCH /orders/:id` (Story 4.4) — the order-metadata group of the same
 * endpoint: the VAT tick, the system capacity and the quote validity note.
 * `kWp`/`validityNote` accept `null` = clear the value; `vatMode` is always one
 * of the backend registry values echoed, never invented here.
 */
export type UpdateOrderMetaInput = Pick<
  Schemas['UpdateOrderRequestDto'],
  'vatMode' | 'kWp' | 'validityNote'
>;

/**
 * The backend `PreviewTotalResponseDto` — BACKEND-computed integer đồng numbers
 * (AD-16) plus the applied `vatRate`/`applyVat` (Story 4.4) so the screen can
 * label the VAT row ("VAT 8%") with a backend value, never a static label. The
 * screen renders them as-is, "—" until the first response (or after a failed
 * preview).
 */
export type OrderTotals = Schemas['PreviewTotalResponseDto'];

/** Body of `POST /orders/:id/apply-discount` (Story 4.7) — one integer đồng amount on the ORDER. */
export type ApplyDiscountInput = Schemas['ApplyDiscountRequestDto'];

/** Body of `POST /orders/:id/resolve-discount` (Story 4.7) — `reason` REQUIRED when rejecting. */
export type ResolveDiscountInput = Schemas['ResolveDiscountRequestDto'];

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
export type DiscountPendingLine = Schemas['DiscountPendingLineDto'];

/**
 * One item of `GET /orders/pending-discount-approvals` (Story 4.7, FR-18/FR-37) —
 * `subtotal`/`afterDiscount` are BACKEND numbers (AD-16), the screen displays
 * them as-is.
 */
export type DiscountPendingItem = Schemas['DiscountPendingItemDto'];

/**
 * Body of `POST /orders/preview-total` — the lines the screen is DISPLAYING,
 * echoed back (every `unitPrice` is a number the backend already returned).
 * `vatMode` (Story 4.4) is echoed from `Order.vatMode` and `discountAmount` from
 * `Order.discount.amount` (Story 4.7) the same way — the client never sends a
 * rate and never computes a discount.
 */
export type PreviewTotalInput = Schemas['PreviewTotalRequestDto'];

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
 * The real implementation is `web/src/api/http-orders-port.ts` (the transport
 * attaches the Bearer token and parses the AD-5 envelope into `ApiError`);
 * `FakeOrdersPort` drives the tests/demo.
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
   * Lifecycle of one order — `GET /orders/:id/lifecycle` (Story 5.4 + 5.5, FR-7).
   * Steps already gated by the order's scope flags: those that do not apply are
   * ABSENT from the array, not dimmed (UX-DR-11). `nextSteps` is already
   * filtered by the caller's real permissions. Rejects 404 (absent or out of the
   * caller's scope — the two are indistinguishable by design), 403.
   */
  getLifecycle(orderId: string): Promise<OrderLifecycle>;

  /**
   * Update history of one order — `GET /orders/:id/versions` (Story 5.4, FR-6).
   * Every version, `versionNo` ascending; exactly one carries `isCurrent`.
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
   * Confirm ("Chốt") the order — `POST /orders/:id/confirm` (Story 4.5, FR-5).
   * The BACKEND freezes every line price into snapshots and flips the status
   * to `'dachot'`; the screen just renders the returned order (whose line
   * `unitPrice` is now the frozen number). Idempotent on the server: retrying
   * an already-confirmed order returns it unchanged. Rejects 400 (empty
   * quote), 403 (`orders.confirm` missing), 404, 409 (non-confirmable status).
   */
  confirmOrder(orderId: string): Promise<Order>;

  /**
   * Reopen ("Mở lại") a confirmed order for editing — `POST /orders/:id/reopen`
   * (Story 4.6, FR-6). The BACKEND creates a NEW version (copying the lines,
   * snapshots reset) and flips the status back to `'baogia'`; the old version
   * stays untouched in history. The screen just renders the returned order —
   * catalogue line prices are live again (FR-5). Idempotent on the server:
   * calling it on an order already `'baogia'` returns it unchanged. Rejects
   * 403 (`quotes.create_edit` missing), 404, 409 (non-reopenable status).
   */
  reviseOrder(orderId: string): Promise<Order>;

  /**
   * Apply a discount and send it for approval — `POST /orders/:id/apply-discount`
   * (Story 4.7, FR-18). The BACKEND flips the status to `'choduyet'` (content
   * frozen until resolved) and records the approval request. Rejects 400 (amount
   * over subtotal / empty quote), 403 (`discounts.apply` missing), 404, 409
   * (non-`'baogia'` status — applying is NOT idempotent).
   */
  applyDiscount(orderId: string, input: ApplyDiscountInput): Promise<Order>;

  /**
   * Approve or reject the pending discount — `POST /orders/:id/resolve-discount`
   * (Story 4.7, FR-18). Approve keeps the order `'choduyet'` (confirming is a
   * separate `confirmOrder` action); reject returns it to `'baogia'` with the
   * reason on `discount.resolveNote`. Rejects 400 (missing reason on reject),
   * 403 (`discounts.approve` missing), 404, 409 (no pending approval / opposite
   * decision). Retrying the SAME decision is idempotent on the server.
   */
  resolveDiscount(orderId: string, input: ResolveDiscountInput): Promise<Order>;

  /**
   * List the orders awaiting discount approval — `GET /orders/pending-discount-approvals`
   * (Story 4.7, FR-18/FR-37). Every number (subtotal, afterDiscount, margins) is
   * backend-computed; margins are null when the caller lacks `costs.view`.
   * Rejects 403 (`discounts.approve` missing).
   */
  listPendingDiscounts(): Promise<DiscountPendingItem[]>;

  /**
   * Export the quote as PDF + image and fetch both files (Story 4.8, FR-21) —
   * `POST /orders/:id/export-quote` then the two `GET /orders/:id/quote/*`
   * proxy routes. The BACKEND renders both from ONE template (totals from the
   * one pricing function, AD-16) and overwrites the order's latest file pair.
   * Rejects 400 (empty quote), 403 (`quotes.create_edit` missing), 404.
   */
  exportQuote(orderId: string): Promise<QuoteExportFiles>;

  /**
   * Move the order one step and attach evidence photos (Story 5.5, FR-9/FR-23) —
   * `POST /orders/:id/transition` as `multipart/form-data`.
   *
   * `event` is one of the events `getLifecycle().nextSteps` handed back. The
   * caller does NOT name a destination: the destination belongs to the backend's
   * transition table, not to the client (AD-11).
   *
   * `files` is ALWAYS optional — an empty array is the ordinary path, not an edge
   * case (FR-23, UX-DR-25). Limits are the backend's: 10 photos, 10 MB each,
   * jpeg/png/webp/heic.
   *
   * Rejects 400 (photo rejected — `fieldErrors` carries which one), 403 (missing
   * the permission this step needs), 409 (step outside this screen's lane,
   * outside the order's scope, or not reachable from the current status —
   * including pressing twice), 404.
   */
  transition(
    orderId: string,
    event: string,
    files: File[],
  ): Promise<StatusChangeResult>;

  /**
   * Cancel the order with a REASON — `POST /orders/:id/cancel` (Story 5.7, FR-9).
   *
   * Its own endpoint, not an `event` of `transition`: the reason is
   * mandatory and only this path enforces it.
   *
   * `reason` is required, 3–500 characters after trimming. Call this only when
   * `getLifecycle().canCancel` is true — the backend enforces the same rule anyway
   * and answers 403/409 otherwise (AD-4: hiding the button is UX, not security).
   *
   * Rejects 400 (`fieldErrors` carries `reason`), 403, 409 (current status has no
   * cancel edge — including an order already cancelled), 404.
   */
  cancel(orderId: string, reason: string): Promise<void>;

  /**
   * Every photo of the order — step photos AND supplementary ones, in ONE flat
   * list newest first (Story 5.6, FR-24) — `GET /orders/:id/attachments`.
   *
   * The order is the backend's (`createdAt` descending); the screen does not
   * re-sort. Rejects 403 (neither `orders.view_all` nor `orders.view_own`), 404
   * (order out of scope or missing).
   */
  listAttachments(orderId: string): Promise<AttachmentItem[]>;

  /**
   * Attach supplementary photos OUTSIDE the transition flow (Story 5.6, FR-24) —
   * `POST /orders/:id/attachments` as `multipart/form-data`. The rows land with all three
   * step coordinates null: they belong to no step.
   *
   * Limits are the backend's: 10 photos per upload, 10 MB each,
   * jpeg/png/webp/heic. Rejects 400 (`fieldErrors` says which photo), 403, 404.
   */
  addAttachments(orderId: string, files: File[]): Promise<void>;

  /**
   * Delete ONE photo — `DELETE /orders/:id/attachments/:attachmentId` (Story 5.6, FR-24).
   * Hard delete; the trail lives in the audit log.
   *
   * Call this only for items whose `canDelete` is true — the backend enforces the
   * same rule anyway and answers 403 otherwise (AD-4: hiding the button is UX,
   * not security). Rejects 403, 404.
   */
  removeAttachment(orderId: string, attachmentId: string): Promise<void>;

  /**
   * Bytes of ONE photo for preview — `GET /orders/:id/attachments/:attachmentId`
   * (Story 5.5 proxy route, AD-3: the bucket is not public, every byte comes
   * through the backend behind JWT).
   *
   * The SCREEN calls this and hands the result to the gallery component; the
   * gallery itself never touches the network. Rejects 403, 404.
   */
  attachmentBytes(orderId: string, attachmentId: string): Promise<Blob>;

  /**
   * Stock-out preview of the order (FR-26) — `GET /orders/:id/stock-issue`.
   * Read-only. Rejects 403 (neither `inventory.manage` nor `delivery.confirm`),
   * 404.
   */
  getStockIssue(orderId: string): Promise<OrderStockIssueView>;

  /**
   * Issue the order's ONE stock-out WITHOUT moving its status —
   * `POST /orders/:id/stock-issue`, no body. Calling it again on an issued
   * order returns the same voucher (200) and writes nothing.
   *
   * Rejects 403 (no `inventory.manage`), 404, 409 (status cannot issue; no
   * stock-tracked lines; not enough stock — `fieldErrors[].field` is
   * `lines.{i}.qty`, indexing `getStockIssue().lines`).
   */
  issueStock(orderId: string): Promise<OrderStockIssueResult>;

  /**
   * Early stock warning of a quote (FR-25) — `GET /orders/:id/stock-check`.
   * Read-only, a warning only: confirming is never blocked by stock. Rejects
   * 403 (neither `quotes.create_edit` nor `inventory.manage`), 404.
   */
  getStockCheck(orderId: string): Promise<OrderStockCheck>;
}
