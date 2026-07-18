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

/// The confirmed order status — the ONE status literal screens compare against
/// (Story 4.6). Screens import this constant; the guard forbids the raw literal
/// inside screen files, so the string lives here in the port file only.
const String kOrderStatusDachot = 'dachot';

/// The awaiting-discount-approval order status (Story 4.7, FR-18) — same rule
/// as [kOrderStatusDachot]: screens import the constant, the guard forbids the
/// raw literal inside screen files.
const String kOrderStatusChoduyet = 'choduyet';

/// Discount-approval statuses (Story 4.7) — the `Order.discount.status` values.
/// Distinct from the ORDER status `'choduyet'`: these describe the approval
/// record, underscore-keyed like `vatMode`. They live HERE so screens compare
/// against constants, never ad-hoc literals.
const String kDiscountChoDuyet = 'cho_duyet';
const String kDiscountDongY = 'dong_y';
const String kDiscountTuChoi = 'tu_choi';

/// Mirrors the backend `OrderLineItemResponseDto` — [unitPrice]/[amount] are backend numbers.
class OrderLine {
  const OrderLine({
    required this.id,
    this.productId,
    required this.name,
    required this.unit,
    required this.qty,
    required this.unitPrice,
    required this.priceEditable,
    required this.isFlexible,
    this.note,
    this.warrantyMonths,
    required this.displayOrder,
    required this.amount,
  });

  final String id;
  final String? productId;
  final String name;
  final String unit;
  final int qty;
  final int unitPrice;
  final bool priceEditable;
  final bool isFlexible;
  final String? note;
  final int? warrantyMonths;
  final int displayOrder;
  final int amount;
}

/// Mirrors the backend `OrderResponseDto`. [lineItems] are the lines of the
/// CURRENT version (AD-6) — the client never sees the version concept in 4.1.
/// Totals are deliberately NOT on [Order]: they travel through `previewTotal`
/// (stateless `POST /orders/preview-total`) so there is exactly ONE computer
/// of money — the backend (AD-16).
class Order {
  const Order({
    required this.id,
    required this.status,
    required this.customerSdt,
    this.currentVersionId,
    required this.ownerAccountId,
    this.assigneeAccountId,
    required this.sourceId,
    required this.custType,
    required this.scopeThietBi,
    required this.scopeThiCong,
    required this.scopeVanChuyen,
    this.kWp,
    this.vatMode,
    this.validityNote,
    required this.lineItems,
    this.discount,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String status;
  final String customerSdt;
  final String? currentVersionId;
  final String ownerAccountId;
  final String? assigneeAccountId;
  final String sourceId;
  final String custType;
  final bool scopeThietBi;
  final bool scopeThiCong;
  final bool scopeVanChuyen;

  /// System capacity in kWp — a FRACTIONAL number by nature ("8,82 kWp"), so
  /// `double`, not `int` (AD-10's integer rule is for MONEY only — Story 4.4).
  final double? kWp;
  final String? vatMode;

  /// Quote validity note — free text ≤ 200 chars, display-only in Phase 1.
  final String? validityNote;
  final List<OrderLine> lineItems;

  /// The LATEST discount-approval record (Story 4.7) — null when the order
  /// never had a discount applied.
  final OrderDiscount? discount;
  final String createdAt;
  final String updatedAt;
}

/// The LATEST discount-approval record of the order (Story 4.7) — after a
/// rejection the order is back to `'baogia'` but still carries
/// `status: 'tu_choi'` + [resolveNote] so the screen can show the reason banner.
class OrderDiscount {
  const OrderDiscount({
    required this.amount,
    required this.status,
    this.requestNote,
    this.resolveNote,
    required this.requestedAt,
    this.resolvedAt,
  });

  final int amount;
  final String status;
  final String? requestNote;
  final String? resolveNote;
  final String requestedAt;
  final String? resolvedAt;
}

/// One row of `GET /orders` (Story 5.3) — mirrors the backend `OrderListItemDto`
/// field-for-field and the web `OrderListItem` (AD-12: the contract comes FROM
/// the backend).
///
/// Deliberately carries NO money: a list total would need the version + pricing
/// join, and a wrong number on a list row is a money regression. No `costPrice`
/// either (the `costs.view` fence, AD-4).
class OrderListItem {
  const OrderListItem({
    required this.id,
    required this.status,
    required this.customerSdt,
    required this.customerName,
    required this.ownerAccountId,
    required this.assigneeAccountId,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String status;
  final String customerSdt;
  final String customerName;
  final String ownerAccountId;
  final String? assigneeAccountId;
  final String createdAt;
  final String updatedAt;
}

/// Paged envelope of `GET /orders` — `total` counts the whole scoped+filtered
/// set, never the length of this page.
class OrderPage {
  const OrderPage({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  final List<OrderListItem> items;
  final int total;
  final int page;
  final int pageSize;
}

/// Body of `POST /orders` — the customer phone, RAW or E.164 (backend normalises, AD-9).
class CreateOrderInput {
  const CreateOrderInput({required this.customerSdt});

  final String customerSdt;
}

/// Body of `POST /orders/:id/line-items` — two shapes in one input (UX-DR-24):
/// catalogue line ([productId] set — backend copies name/unit/priceEditable and
/// auto-fills the price; [unitPrice] allowed ONLY when the product permits) or
/// free line ([productId] absent — [name]/[unit]/[unitPrice] required).
class AddOrderLineInput {
  const AddOrderLineInput({
    this.productId,
    this.name,
    this.unit,
    required this.qty,
    this.unitPrice,
    this.note,
    this.isFlexible,
  });

  final String? productId;
  final String? name;
  final String? unit;
  final int qty;
  final int? unitPrice;
  final String? note;
  final bool? isFlexible;
}

/// Sentinel meaning "field not included in this PATCH" — Dart has no
/// `undefined`, so [UpdateOrderLineInput.warrantyMonths] needs it to keep the
/// tri-state the backend PATCH speaks: absent = keep, value = set, `null` = clear.
/// (`qty`/`unitPrice`/`note`/`isFlexible` stay plain-nullable: none of them has a
/// legitimate `null`-to-clear meaning on their NOT-NULL columns.)
const Object kLineFieldAbsent = Object();

/// Body of `PATCH /orders/:id/line-items/:lineId` — [unitPrice] only on `priceEditable` lines.
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
/// scope flags. `scopeThietBi` is deliberately absent: every order carries
/// equipment, the backend keeps it `true` and accepts no write for it.
class UpdateScopeFlagsInput {
  const UpdateScopeFlagsInput({this.scopeThiCong, this.scopeVanChuyen});

  final bool? scopeThiCong;
  final bool? scopeVanChuyen;
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

/// Mirrors the backend `PreviewTotalResponseDto` — three BACKEND-computed
/// integer đồng numbers (AD-16) plus the applied [vatRate]/[applyVat] (Story
/// 4.4) so the screen can label the VAT row ("VAT 8%") with a backend value,
/// never a static label. The screen renders them as-is, "—" until the first
/// response (or after a failed preview).
class OrderTotals {
  const OrderTotals({
    required this.subtotal,
    this.discountAmount = 0,
    required this.vatAmount,
    required this.total,
    required this.vatRate,
    required this.applyVat,
  });

  final int subtotal;

  /// The discount APPLIED to this computation — echoed back (Story 4.7).
  final int discountAmount;
  final int vatAmount;
  final int total;
  final int vatRate;
  final bool applyVat;
}

/// Body of `POST /orders/:id/ap-chiet-khau` (Story 4.7) — one integer đồng
/// amount on the ORDER.
class ApplyDiscountInput {
  const ApplyDiscountInput({required this.amount, this.note});

  final int amount;
  final String? note;
}

/// Body of `POST /orders/:id/duyet-chiet-khau` (Story 4.7) — [reason] REQUIRED
/// when rejecting.
class ResolveDiscountInput {
  const ResolveDiscountInput({required this.approve, this.reason});

  final bool approve;
  final String? reason;
}

/// One exported quote file (Story 4.8, FR-21) — [bytes] are the BACKEND-rendered
/// binary (image or PDF), fetched through the JWT proxy routes (AD-3: no public
/// bucket, no presigned URL). The screen only wraps them into XFile/share.
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

/// One line of a pending-discount item — [estimatedMarginPct] is a
/// BACKEND-rounded integer percent (or null: free line, zero price, or caller
/// lacks `costs.view`, FR-37). The screen renders it verbatim ("X%" / "—"),
/// never computes it.
class DiscountPendingLine {
  const DiscountPendingLine({
    required this.name,
    required this.qty,
    required this.unitPrice,
    this.estimatedMarginPct,
  });

  final String name;
  final int qty;
  final int unitPrice;
  final int? estimatedMarginPct;
}

/// One item of `GET /orders/cho-duyet-chiet-khau` (Story 4.7, FR-18/FR-37) —
/// [subtotal]/[afterDiscount] are BACKEND numbers (AD-16), the screen displays
/// them as-is.
class DiscountPendingItem {
  const DiscountPendingItem({
    required this.orderId,
    required this.customerSdt,
    required this.amount,
    this.requestNote,
    required this.requestedByAccountId,
    required this.requestedByDisplayName,
    required this.requestedAt,
    required this.subtotal,
    required this.afterDiscount,
    required this.lines,
  });

  final String orderId;
  final String customerSdt;
  final int amount;
  final String? requestNote;
  final String requestedByAccountId;
  final String requestedByDisplayName;
  final String requestedAt;
  final int subtotal;
  final int afterDiscount;
  final List<DiscountPendingLine> lines;
}

/// Body of `POST /orders/preview-total` — the lines the screen is DISPLAYING,
/// echoed back (every `unitPrice` is a number the backend already returned).
/// [vatMode] (Story 4.4) is echoed from `Order.vatMode` the same way — the
/// client never sends a rate.
class PreviewTotalInput {
  const PreviewTotalInput(
      {required this.lines, this.vatMode, this.discountAmount});

  final List<PreviewTotalLine> lines;
  final String? vatMode;

  /// Echoed from `Order.discount.amount` (Story 4.7) — never computed client-side.
  final int? discountAmount;
}

/// One echoed line of a preview request.
class PreviewTotalLine {
  const PreviewTotalLine({required this.unitPrice, required this.qty});

  final int unitPrice;
  final int qty;
}

/// The AD-5 error envelope, raised by an [OrdersPort] when the backend rejects a
/// call (400 validation, 404, 409 non-draft order).
///
/// The screen renders [message] VERBATIM — the backend owns the pricing/status
/// rules, so it owns the words for them too. Screen-invented copy is reserved for
/// transport failures the backend never saw.
/// [fieldErrors] maps `field` → `message` so each one lands on the input it names.
class OrderPortException implements Exception {
  const OrderPortException(this.message, {this.fieldErrors = const {}});

  /// The backend's `message`, shown to the user as-is.
  final String message;

  /// `field` → `message`, flattened from the envelope's `fieldErrors[]`.
  final Map<String, String> fieldErrors;

  @override
  String toString() => 'OrderPortException: $message';
}

/// Injectable transport for the quote screen. This is a PORT, NOT an HTTP client —
/// the seam that lets the screen exist before the app owns
/// networking/navigation/a token store.
///
/// TODO(app-runtime): the real implementation attaches `Authorization: Bearer
/// <accessToken>` (Story 2.3) and parses the AD-5 envelope into
/// [OrderPortException]. Until then [FakeOrdersPort] drives the guards/demo.
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

  /// Confirm ("Chốt") the order — `POST /orders/:id/chot` (Story 4.5, FR-5).
  /// The BACKEND freezes every line price into snapshots and flips the status
  /// to `'dachot'`; the screen just renders the returned order (whose line
  /// `unitPrice` is now the frozen number). Idempotent on the server: retrying
  /// an already-confirmed order returns it unchanged. Throws 400 (empty
  /// quote), 403 (`orders.confirm` missing), 404, 409 (non-confirmable status).
  Future<Order> confirmOrder(String orderId);

  /// Reopen ("Mở lại") a confirmed order for editing — `POST /orders/:id/mo-lai`
  /// (Story 4.6, FR-6). The BACKEND creates a NEW version (copying the lines,
  /// snapshots reset) and flips the status back to `'baogia'`; the old version
  /// stays untouched in history. The screen just renders the returned order —
  /// catalogue line prices are live again (FR-5). Idempotent on the server:
  /// calling it on an order already `'baogia'` returns it unchanged. Throws
  /// 403 (`quotes.create_edit` missing), 404, 409 (non-reopenable status).
  Future<Order> reviseOrder(String orderId);

  /// Apply a discount and send it for approval — `POST /orders/:id/ap-chiet-khau`
  /// (Story 4.7, FR-18). The BACKEND flips the status to `'choduyet'` (content
  /// frozen until resolved) and records the approval request. Throws 400 (amount
  /// over subtotal / empty quote), 403 (`discounts.apply` missing), 404, 409
  /// (non-`'baogia'` status — applying is NOT idempotent).
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input);

  /// Approve or reject the pending discount — `POST /orders/:id/duyet-chiet-khau`
  /// (Story 4.7, FR-18). Approve keeps the order `'choduyet'` (confirming is a
  /// separate [confirmOrder] action); reject returns it to `'baogia'` with the
  /// reason on `discount.resolveNote`. Throws 400 (missing reason on reject),
  /// 403 (`discounts.approve` missing), 404, 409 (no pending approval / opposite
  /// decision). Retrying the SAME decision is idempotent on the server.
  Future<Order> resolveDiscount(String orderId, ResolveDiscountInput input);

  /// List the orders awaiting discount approval — `GET /orders/cho-duyet-chiet-khau`
  /// (Story 4.7, FR-18/FR-37). Every number (subtotal, afterDiscount, margins)
  /// is backend-computed; margins are null when the caller lacks `costs.view`.
  /// Throws 403 (`discounts.approve` missing).
  Future<List<DiscountPendingItem>> listPendingDiscounts();

  /// Export the quote as PDF + image and fetch both files (Story 4.8, FR-21) —
  /// `POST /orders/:id/xuat-bao-gia` then the two `GET /orders/:id/bao-gia/*`
  /// proxy routes. The BACKEND renders both from ONE template (totals from the
  /// one pricing function, AD-16) and overwrites the order's latest file pair.
  /// Throws 400 (empty quote), 403 (`quotes.create_edit` missing), 404.
  Future<QuoteExportFiles> exportQuote(String orderId);
}
