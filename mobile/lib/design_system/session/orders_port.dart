// hand-authored — mobile orders port (Story 4.1, mirror web
// web/src/design-system/session/orders-port.ts). The seam between the quote
// screen and the `/orders` endpoints.
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

import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

import '../../api/generated/models/add_line_item_request_dto.dart';
import '../../api/generated/models/apply_discount_request_dto.dart';
import '../../api/generated/models/attachment_item_dto.dart';
import '../../api/generated/models/create_order_request_dto.dart';
import '../../api/generated/models/discount_pending_item_dto.dart';
import '../../api/generated/models/discount_pending_line_dto.dart';
import '../../api/generated/models/order_discount_dto.dart';
import '../../api/generated/models/order_lifecycle_response_dto.dart';
import '../../api/generated/models/order_lifecycle_step_dto.dart';
import '../../api/generated/models/order_line_item_response_dto.dart';
import '../../api/generated/models/order_list_item_dto.dart';
import '../../api/generated/models/order_list_response_dto.dart';
import '../../api/generated/models/order_next_step_dto.dart';
import '../../api/generated/models/order_response_dto.dart';
import '../../api/generated/models/order_stock_check_dto.dart';
import '../../api/generated/models/order_stock_check_line_dto.dart';
import '../../api/generated/models/order_stock_issue_line_dto.dart';
import '../../api/generated/models/order_stock_issue_result_dto.dart';
import '../../api/generated/models/order_stock_issue_view_dto.dart';
import '../../api/generated/models/order_version_item_dto.dart';
import '../../api/generated/models/preview_total_line_dto.dart';
import '../../api/generated/models/preview_total_request_dto.dart';
import '../../api/generated/models/preview_total_response_dto.dart';
import '../../api/generated/models/qty_change_dto.dart';
import '../../api/generated/models/resolve_discount_request_dto.dart';
import '../../api/generated/models/status_change_response_dto.dart';
import '../../api/generated/models/version_changes_dto.dart';

export '../../api/generated/models/order_lifecycle_step_dto_progress.dart';
export '../../api/generated/models/order_lifecycle_step_dto_status.dart';
export '../../api/generated/models/order_list_item_dto_status.dart';
export '../../api/generated/models/order_next_step_dto_to.dart';
export '../../api/generated/models/order_response_dto_vat_mode.dart';
export '../../api/generated/models/order_stock_check_line_dto_status.dart';
export '../../api/generated/models/preview_total_request_dto_vat_mode.dart';
export '../../api/generated/models/status_change_response_dto_status.dart';

/// The confirmed order status — the ONE status literal screens compare against
/// (Story 4.6). Screens import this constant; the guard forbids the raw literal
/// inside screen files, so the string lives here in the port file only.
const String kOrderStatusDachot = 'dachot';

/// The awaiting-discount-approval order status (Story 4.7, FR-18) — same rule
/// as [kOrderStatusDachot]: screens import the constant, the guard forbids the
/// raw literal inside screen files.
const String kOrderStatusChoduyet = 'choduyet';

/// The "Đã giao" (delivered) transition event. Confirming it ALSO
/// issues the order's stock (if not issued yet), so the status-change screen
/// previews the stock-out when this step is picked. Same rule as
/// [kOrderStatusDachot]: screens must not carry the raw event literal.
const String kEventDelivered = 'xong_giao';

/// Discount-approval statuses (Story 4.7) — the `Order.discount.status` values.
/// Distinct from the ORDER status `'choduyet'`: these describe the approval
/// record, underscore-keyed like `vatMode`. They live HERE so screens compare
/// against constants, never ad-hoc literals.
const String kDiscountChoDuyet = 'cho_duyet';
const String kDiscountDongY = 'dong_y';
const String kDiscountTuChoi = 'tu_choi';

/// The backend `OrderLineItemResponseDto` (generated, Story 10.8) —
/// `unitPrice`/`amount` are backend numbers.
typedef OrderLine = OrderLineItemResponseDto;

/// The backend `OrderResponseDto`. `lineItems` are the lines of the CURRENT
/// version (AD-6). Totals are deliberately NOT on [Order]: they travel through
/// `previewTotal` so there is exactly ONE computer of money — the backend
/// (AD-16). `kWp` is fractional by nature ("8,82 kWp"); AD-10's integer rule is
/// for money only. `discount` is the LATEST discount-approval record (null when
/// the order never had one); `cancelReason`/`cancelledAt` are null until the
/// order is cancelled.
typedef Order = OrderResponseDto;

/// The LATEST discount-approval record of the order (Story 4.7) — after a
/// rejection the order is back to `'baogia'` but still carries
/// `status: 'tu_choi'` + `resolveNote` so the screen can show the reason banner.
typedef OrderDiscount = OrderDiscountDto;

/// One row of `GET /orders` (Story 5.3). Deliberately carries NO money and no
/// `costPrice` (the `costs.view` fence, AD-4).
typedef OrderListItem = OrderListItemDto;

/// One step of the order lifecycle stepper (Story 5.4). The BACKEND decides
/// which steps exist for this order and which one it stands on; the screen
/// renders the list as given (AD-2/AD-11). `progress` is
/// `done` | `current` | `upcoming`. Labels live in [kStatusLabels].
typedef OrderLifecycleStep = OrderLifecycleStepDto;

/// One step the CALLER can actually take right now (Story 5.5), filtered by the
/// backend against the order's status, scope flags and the caller's REAL
/// permissions. The client never recomputes it (AD-2/AD-4).
typedef OrderNextStep = OrderNextStepDto;

/// The whole `GET /orders/:id/lifecycle` reply (Story 5.4 + 5.5 + 5.7): what the
/// stepper draws (`steps`), what this caller can do next (`nextSteps` — EMPTY
/// hides "Chuyển trạng thái" outright, UX-DR-22) and whether this caller can
/// cancel (`canCancel` — read by the backend off the transition table; `false`
/// ⇒ the button is ABSENT, not greyed).
typedef OrderLifecycle = OrderLifecycleResponseDto;

/// One row of the stock-out preview. `shortfall` is the backend's warning — the
/// screen never compares `qty` with `onHand`.
typedef OrderStockIssueLine = OrderStockIssueLineDto;

/// `GET /orders/:id/stock-issue`. ONE ORDER, ONE STOCK-OUT: `issued` + `voucher`
/// once issued; before that `lines` (in the backend's canonical order — a 409's
/// `lines.{i}.qty` indexes into it) and `untrackedItems`. `canIssue` and
/// `blocked` are the backend's; the screen does not re-derive them (AD-2).
typedef OrderStockIssueView = OrderStockIssueViewDto;

/// One product of the quote's early stock warning. Every figure and `status`
/// are the backend's; the screen picks its wording from `status` only.
typedef OrderStockCheckLine = OrderStockCheckLineDto;

/// `GET /orders/:id/stock-check` — a warning only; confirming is never blocked.
typedef OrderStockCheck = OrderStockCheckDto;

/// The backend's `status` of a short product in [OrderStockCheckLine].
const String kStockCheckShort = 'short';

/// `POST /orders/:id/stock-issue`.
typedef OrderStockIssueResult = OrderStockIssueResultDto;

/// What one manual transition did.
typedef StatusChangeResult = StatusChangeResponseDto;

/// One photo attached to an order (Story 5.6, FR-24). `statusFrom`/`statusTo`
/// both null ⇒ a supplementary photo. `canDelete` is computed by the BACKEND
/// (uploader OR order-edit permission) — the client only renders it. No object
/// key: bytes come from [OrdersPort.attachmentBytes] through the authenticated
/// proxy (AD-3).
typedef AttachmentItem = AttachmentItemDto;

/// One quantity change between two versions.
typedef OrderVersionQtyChange = QtyChangeDto;

/// What changed between version N-1 and version N — lines and quantities only,
/// never money.
typedef OrderVersionChange = VersionChangesDto;

/// One update version in the order history (Story 5.4, FR-6). `isCurrent` is
/// resolved by the BACKEND through `Order.currentVersionId` (AD-6) — never
/// re-derived from the highest `versionNo`. `createdByDisplayName` is null for a
/// version older than the actor column; the screen shows `—`.
typedef OrderVersionItem = OrderVersionItemDto;

/// Paged envelope of `GET /orders` — `total` counts the whole scoped+filtered
/// set, never the length of this page.
typedef OrderPage = OrderListResponseDto;

/// Body of `POST /orders` — the customer phone, RAW (backend normalises, AD-9).
typedef CreateOrderInput = CreateOrderRequestDto;

/// Body of `POST /orders/:id/line-items` — catalogue line (`productId` set —
/// backend copies name/unit and auto-fills the price) or free line (`productId`
/// absent — `name`/`unit`/`unitPrice` required). The adapter sends only the keys
/// the line carries (lib/api/sparse_bodies.dart).
typedef AddOrderLineInput = AddLineItemRequestDto;

/// Sentinel meaning "field not included in this PATCH" — Dart has no
/// `undefined`, so [UpdateOrderLineInput.warrantyMonths] needs it to keep the
/// tri-state the backend PATCH speaks: absent = keep, value = set, `null` = clear.
/// (`qty`/`unitPrice`/`note`/`isFlexible` stay plain-nullable: none of them has a
/// legitimate `null`-to-clear meaning on their NOT-NULL columns.)
const Object kLineFieldAbsent = Object();

/// Body of `PATCH /orders/:id/line-items/:lineId` — [unitPrice] only on `priceEditable` lines.
///
/// Hand-kept: the tri-state of [warrantyMonths] (absent / set / clear) has no
/// equivalent on the generated `UpdateLineItemRequestDto`.
class UpdateOrderLineInput {
  const UpdateOrderLineInput({
    this.qty,
    this.unitPrice,
    this.note,
    this.isFlexible,
    Object? warrantyMonths = kLineFieldAbsent,
  }) : _warrantyMonths = warrantyMonths;

  final int? qty;
  final int? unitPrice;
  final String? note;
  final bool? isFlexible;
  final Object? _warrantyMonths;

  /// Whether the PATCH includes `warrantyMonths` at all (set OR clear). A plain
  /// `int?` cannot express this — `null` alone would be ambiguous with "keep".
  bool get hasWarrantyMonths => !identical(_warrantyMonths, kLineFieldAbsent);

  /// The warranty value to write — meaningful only when [hasWarrantyMonths];
  /// `null` = clear warranty (a valid business value).
  int? get warrantyMonths => hasWarrantyMonths ? _warrantyMonths as int? : null;
}

/// Body of `PATCH /orders/:id` (Story 4.3) — partial toggle of the two MUTABLE
/// scope flags. `scopeEquipment` is deliberately absent: every order carries
/// equipment, the backend keeps it `true` and accepts no write for it.
///
/// Hand-kept (not the generated `UpdateOrderRequestDto`): a null flag here means
/// "not in this PATCH", and the generated body would send every other field of
/// the shared PATCH as `null` — which CLEARS `kWp`/`validityNote` (Story 10.8).
class UpdateScopeFlagsInput {
  const UpdateScopeFlagsInput({this.scopeConstruction, this.scopeDelivery});

  final bool? scopeConstruction;
  final bool? scopeDelivery;
}

/// Sentinel meaning "field not included in this PATCH" — Dart has no
/// `undefined`, so [UpdateOrderMetaInput] needs it to keep the tri-state the
/// backend PATCH speaks: absent = keep, value = set, `null` = clear.
const Object kMetaFieldAbsent = Object();

/// Body of `PATCH /orders/:id` (Story 4.4) — the order-metadata group of the
/// same endpoint: the VAT tick, the system capacity and the quote validity
/// note. Call-site parity with the web input: omit a field to keep it, pass
/// `null` explicitly to clear ([kWp]/[validityNote] only; [vatMode] is always
/// one of the backend registry values echoed, never null).
///
/// Hand-kept for the same tri-state reason as [UpdateOrderLineInput].
class UpdateOrderMetaInput {
  const UpdateOrderMetaInput({
    this.vatMode,
    Object? kWp = kMetaFieldAbsent,
    Object? validityNote = kMetaFieldAbsent,
  })  : _kWp = kWp,
        _validityNote = validityNote;

  final String? vatMode;
  final Object? _kWp;
  final Object? _validityNote;

  /// Whether the PATCH includes `kWp` at all (set OR clear).
  bool get hasKWp => !identical(_kWp, kMetaFieldAbsent);

  /// The kWp value to write — meaningful only when [hasKWp]; `null` = clear.
  double? get kWp => hasKWp ? _kWp as double? : null;

  /// Whether the PATCH includes `validityNote` at all (set OR clear).
  bool get hasValidityNote => !identical(_validityNote, kMetaFieldAbsent);

  /// The note to write — meaningful only when [hasValidityNote]; `null` = clear.
  String? get validityNote => hasValidityNote ? _validityNote as String? : null;
}

/// The backend `PreviewTotalResponseDto` — BACKEND-computed integer đồng numbers
/// (AD-16) plus the applied `vatRate`/`applyVat` so the VAT row is labelled with
/// a backend value. "—" until the first response.
typedef OrderTotals = PreviewTotalResponseDto;

/// Body of `POST /orders/:id/apply-discount` (Story 4.7).
typedef ApplyDiscountInput = ApplyDiscountRequestDto;

/// Body of `POST /orders/:id/resolve-discount` (Story 4.7) — `reason` REQUIRED
/// when rejecting.
typedef ResolveDiscountInput = ResolveDiscountRequestDto;

/// One exported quote file (Story 4.8, FR-21) — [bytes] are the BACKEND-rendered
/// binary (image or PDF), fetched through the JWT proxy routes (AD-3: no public
/// bucket, no presigned URL). The screen only wraps them into XFile/share.
/// Hand-kept: the adapter assembles it from bytes, it is not a contract type.
class QuoteExportFile {
  const QuoteExportFile({
    required this.fileName,
    required this.mimeType,
    required this.bytes,
  });

  final String fileName;
  final String mimeType;
  final Uint8List bytes;
}

/// The pair one [OrdersPort.exportQuote] call yields — share order is
/// [image, pdf] (UX-DR-21).
class QuoteExportFiles {
  const QuoteExportFiles({required this.image, required this.pdf});

  final QuoteExportFile image;
  final QuoteExportFile pdf;
}

/// One line of a pending-discount item — `estimatedMarginPct` is a
/// BACKEND-rounded integer percent (or null: free line, zero price, or caller
/// lacks `costs.view`, FR-37). Rendered verbatim, never computed.
typedef DiscountPendingLine = DiscountPendingLineDto;

/// One item of `GET /orders/pending-discount-approvals` (Story 4.7) —
/// `subtotal`/`afterDiscount` are BACKEND numbers (AD-16).
typedef DiscountPendingItem = DiscountPendingItemDto;

/// Body of `POST /orders/preview-total` — the lines the screen is DISPLAYING,
/// echoed back; `vatMode` and `discountAmount` are echoed from the order too.
typedef PreviewTotalInput = PreviewTotalRequestDto;

/// One echoed line of a preview request.
typedef PreviewTotalLine = PreviewTotalLineDto;

/// The AD-5 error envelope, raised by an [OrdersPort] when the backend rejects a
/// call (400 validation, 404, 409 non-draft order).
///
/// The screen renders [message] VERBATIM — the backend owns the pricing/status
/// rules, so it owns the words for them too. Screen-invented copy is reserved for
/// transport failures the backend never saw.
/// [fieldErrors] maps `field` → `message` so each one lands on the input it names.
class OrderPortException implements Exception {
  const OrderPortException(
    this.message, {
    this.code,
    this.fieldErrors = const {},
  });

  /// The envelope's `code` (AD-5). Screens branch on THIS, never on [message]:
  /// "đơn không tồn tại / ngoài phạm vi" is an ANSWER and a retry button will
  /// never change it, while a transport failure is worth retrying — telling the
  /// two apart by matching Vietnamese prose breaks the day someone rewords it.
  /// Null when the request never reached the backend (network failure).
  final String? code;

  /// The backend's `message`, shown to the user as-is.
  final String message;

  /// `field` → `message`, flattened from the envelope's `fieldErrors[]`.
  final Map<String, String> fieldErrors;

  @override
  String toString() => 'OrderPortException: $message';
}

/// Injectable transport for the order screens. This is a PORT, NOT an HTTP
/// client. The real implementation is `HttpOrdersPort`
/// (lib/api/http_orders_port.dart), which turns the AD-5 envelope into an
/// [OrderPortException]; [FakeOrdersPort] drives tests and demos.
abstract class OrdersPort {
  /// Create a draft order for a customer. Throws 400 (bad phone) / 404 (no such customer).
  Future<Order> create(CreateOrderInput input);

  /// Read an order + the lines of its current version. Throws NOT_FOUND if absent.
  Future<Order> get(String id);

  /// List orders — `GET /orders` (Story 5.3, FR-10). The BACKEND narrows the set
  /// to what the caller may see (`orders.view_all` ⇒ every order; only
  /// `orders.view_own` ⇒ orders they own or are assigned) and owns `total`.
  ///
  /// There is deliberately NO scope argument: "all orders" vs "my orders" is a
  /// PERMISSION resolved server-side, never a client parameter (AD-4, FR-18).
  /// `followUp` and `status` are mutually exclusive — sending both is a 400, not
  /// a silently-empty list. Throws 403 when the caller holds NEITHER view key.
  Future<OrderPage> list({
    String? status,
    bool? followUp,
    int? page,
    int? pageSize,
  });

  /// Lifecycle of one order — `GET /orders/:id/lifecycle` (Story 5.4 + 5.5,
  /// FR-7). Steps already gated by the order's scope flags: those that do not
  /// apply are ABSENT from the list, not dimmed (UX-DR-11). `nextSteps` is
  /// already filtered by the caller's real permissions. Throws 404 (absent or
  /// out of the caller's scope — indistinguishable by design), 403.
  Future<OrderLifecycle> getLifecycle(String orderId);

  /// Update history of one order — `GET /orders/:id/versions` (Story 5.4,
  /// FR-6). Every version, `versionNo` ascending; exactly one carries
  /// `isCurrent`. Throws 404 / 403 like [getLifecycle].
  Future<List<OrderVersionItem>> listVersions(String orderId);

  /// Append a line (catalogue or free). Throws 400/404/409 per the backend rules.
  Future<OrderLine> addLine(String orderId, AddOrderLineInput input);

  /// Edit qty/note/isFlexible — and unitPrice only where `priceEditable`.
  Future<OrderLine> updateLine(
    String orderId,
    String lineId,
    UpdateOrderLineInput input,
  );

  /// Remove a line from the current version.
  Future<void> removeLine(String orderId, String lineId);

  /// Toggle the Thi công/Vận chuyển scope flags (Story 4.3) — only while the
  /// order is still `'baogia'` (409 otherwise). Returns the full fresh order.
  Future<Order> updateScopeFlags(String orderId, UpdateScopeFlagsInput input);

  /// Update the order metadata group — VAT tick / kWp / validity note (Story
  /// 4.4). Same PATCH endpoint as [updateScopeFlags], kept as a second typed
  /// method so each call site says which group it touches. Only while
  /// `'baogia'` (409 otherwise). Returns the full fresh order.
  Future<Order> updateOrderMeta(String orderId, UpdateOrderMetaInput input);

  /// Stateless totals preview (AD-16): send the displayed lines, get the ONE
  /// computer's subtotal/VAT/total back. No order is read or written.
  Future<OrderTotals> previewTotal(PreviewTotalInput input);

  /// Confirm ("Chốt") the order — `POST /orders/:id/confirm` (Story 4.5, FR-5).
  /// The BACKEND freezes every line price into snapshots and flips the status
  /// to `'dachot'`; the screen just renders the returned order (whose line
  /// `unitPrice` is now the frozen number). Idempotent on the server: retrying
  /// an already-confirmed order returns it unchanged. Throws 400 (empty
  /// quote), 403 (`orders.confirm` missing), 404, 409 (non-confirmable status).
  Future<Order> confirmOrder(String orderId);

  /// Reopen ("Mở lại") a confirmed order for editing — `POST /orders/:id/reopen`
  /// (Story 4.6, FR-6). The BACKEND creates a NEW version (copying the lines,
  /// snapshots reset) and flips the status back to `'baogia'`; the old version
  /// stays untouched in history. The screen just renders the returned order —
  /// catalogue line prices are live again (FR-5). Idempotent on the server:
  /// calling it on an order already `'baogia'` returns it unchanged. Throws
  /// 403 (`quotes.create_edit` missing), 404, 409 (non-reopenable status).
  Future<Order> reviseOrder(String orderId);

  /// Apply a discount and send it for approval — `POST /orders/:id/apply-discount`
  /// (Story 4.7, FR-18). The BACKEND flips the status to `'choduyet'` (content
  /// frozen until resolved) and records the approval request. Throws 400 (amount
  /// over subtotal / empty quote), 403 (`discounts.apply` missing), 404, 409
  /// (non-`'baogia'` status — applying is NOT idempotent).
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input);

  /// Approve or reject the pending discount — `POST /orders/:id/resolve-discount`
  /// (Story 4.7, FR-18). Approve keeps the order `'choduyet'` (confirming is a
  /// separate [confirmOrder] action); reject returns it to `'baogia'` with the
  /// reason on `discount.resolveNote`. Throws 400 (missing reason on reject),
  /// 403 (`discounts.approve` missing), 404, 409 (no pending approval / opposite
  /// decision). Retrying the SAME decision is idempotent on the server.
  Future<Order> resolveDiscount(String orderId, ResolveDiscountInput input);

  /// List the orders awaiting discount approval — `GET /orders/pending-discount-approvals`
  /// (Story 4.7, FR-18/FR-37). Every number (subtotal, afterDiscount, margins)
  /// is backend-computed; margins are null when the caller lacks `costs.view`.
  /// Throws 403 (`discounts.approve` missing).
  Future<List<DiscountPendingItem>> listPendingDiscounts();

  /// Export the quote as PDF + image and fetch both files (Story 4.8, FR-21) —
  /// `POST /orders/:id/export-quote` then the two `GET /orders/:id/quote/*`
  /// proxy routes. The BACKEND renders both from ONE template (totals from the
  /// one pricing function, AD-16) and overwrites the order's latest file pair.
  /// Throws 400 (empty quote), 403 (`quotes.create_edit` missing), 404.
  Future<QuoteExportFiles> exportQuote(String orderId);

  /// Move the order one step and attach evidence photos (Story 5.5,
  /// FR-9/FR-23) — `POST /orders/:id/transition` as `multipart/form-data`.
  ///
  /// [event] is one of the events `getLifecycle().nextSteps` handed back. The
  /// caller does NOT name a destination: the destination belongs to the
  /// backend's transition table, not to the client (AD-11).
  ///
  /// [files] is ALWAYS optional — an empty list is the ordinary path, not an edge
  /// case (FR-23, UX-DR-25). Limits are the backend's: 10 photos, 10 MB each,
  /// jpeg/png/webp/heic.
  ///
  /// Throws 400 (photo rejected — `fieldErrors` carries which one), 403 (missing
  /// the permission this step needs), 409 (step outside this screen's lane,
  /// outside the order's scope, or not reachable from the current status —
  /// including pressing twice), 404.
  Future<StatusChangeResult> transition(
    String orderId,
    String event,
    List<XFile> files,
  );

  /// Cancel the order with a REASON — `POST /orders/:id/cancel` (Story 5.7, FR-9).
  ///
  /// Its own endpoint, not an `event` of [transition]: the reason is
  /// mandatory and only this path enforces it.
  ///
  /// [reason] is required, 3–500 characters after trimming. Call this only when
  /// `getLifecycle().canCancel` is true — the backend enforces the same rule
  /// anyway and answers 403/409 otherwise (AD-4: hiding the button is UX, not
  /// security).
  ///
  /// Throws 400 (`fieldErrors` carries `reason`), 403, 409 (current status has no
  /// cancel edge — including an order already cancelled), 404.
  Future<void> cancel(String orderId, String reason);

  /// Every photo of the order — step photos AND supplementary ones, in ONE flat
  /// list newest first (Story 5.6, FR-24) — `GET /orders/:id/attachments`.
  ///
  /// The order is the backend's (`createdAt` descending); the screen does not
  /// re-sort. Throws 403 (neither `orders.view_all` nor `orders.view_own`), 404
  /// (order out of scope or missing).
  Future<List<AttachmentItem>> listAttachments(String orderId);

  /// Attach supplementary photos OUTSIDE the transition flow (Story 5.6,
  /// FR-24) — `POST /orders/:id/attachments` as `multipart/form-data`. The rows land
  /// with all three step coordinates null: they belong to no step.
  ///
  /// Limits are the backend's: 10 photos per upload, 10 MB each,
  /// jpeg/png/webp/heic. Throws 400 (`fieldErrors` says which photo), 403, 404.
  Future<void> addAttachments(String orderId, List<XFile> files);

  /// Delete ONE photo — `DELETE /orders/:id/attachments/:attachmentId` (Story 5.6,
  /// FR-24). Hard delete; the trail lives in the audit log.
  ///
  /// Call this only for items whose `AttachmentItem.canDelete` is true — the
  /// backend enforces the same rule anyway and answers 403 otherwise (AD-4:
  /// hiding the button is UX, not security). Throws 403, 404.
  Future<void> removeAttachment(String orderId, String attachmentId);

  /// Bytes of ONE photo for preview — `GET /orders/:id/attachments/:attachmentId`
  /// (Story 5.5 proxy route, AD-3: the bucket is not public, every byte comes
  /// through the backend behind JWT).
  ///
  /// The SCREEN calls this and hands the result to the gallery widget; the
  /// gallery itself never touches the network. Throws 403, 404.
  Future<Uint8List> attachmentBytes(String orderId, String attachmentId);

  /// Stock-out preview of the order (FR-26) — `GET /orders/:id/stock-issue`.
  /// Read-only. Throws 403 (neither `inventory.manage` nor `delivery.confirm`),
  /// 404.
  Future<OrderStockIssueView> getStockIssue(String orderId);

  /// Issue the order's ONE stock-out WITHOUT moving its status —
  /// `POST /orders/:id/stock-issue`, no body. Calling it again on an issued
  /// order returns the same voucher (200) and writes nothing.
  ///
  /// Throws 403 (no `inventory.manage`), 404, 409 (status cannot issue; no
  /// stock-tracked lines; not enough stock — `fieldErrors` key is
  /// `lines.{i}.qty`, indexing [getStockIssue]'s `lines`).
  Future<OrderStockIssueResult> issueStock(String orderId);

  /// Early stock warning of a quote (FR-25) — `GET /orders/:id/stock-check`.
  /// Read-only, a warning only: confirming is never blocked by stock. Throws
  /// 403 (neither `quotes.create_edit` nor `inventory.manage`), 404.
  Future<OrderStockCheck> getStockCheck(String orderId);
}
