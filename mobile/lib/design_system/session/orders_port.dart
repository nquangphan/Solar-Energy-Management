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

import 'stock_vouchers_port.dart';

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
    this.cancelReason,
    this.cancelledAt,
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

  /// Why the order was cancelled, and when (Story 5.7). Both null until it is
  /// cancelled. Not permission-fenced: whoever can read the order can read why
  /// it was cancelled.
  final String? cancelReason;
  final String? cancelledAt;
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

/// One step of the order lifecycle stepper (Story 5.4) — mirrors the backend
/// `OrderLifecycleStepDto` and the web `OrderLifecycleStep` (AD-12).
///
/// The BACKEND decides which steps exist for this order (gated by its scope
/// flags, FR-7) and which one it stands on. The screen renders the list as
/// given: it does not filter it and it does not derive steps from flags — a
/// second copy of the transition table on the client would drift the first time
/// Epic 6 changes the real one (AD-2/AD-11).
///
/// No Vietnamese label here: labels live in [kStatusLabels] and are
/// parity-guarded byte-for-byte against web.
class OrderLifecycleStep {
  const OrderLifecycleStep({required this.status, required this.trangThai});

  final String status;

  /// `done` | `current` | `upcoming`.
  final String trangThai;
}

/// One step the CALLER can actually take right now (Story 5.5) — mirrors the
/// backend `OrderNextStepDto` and the web `OrderNextStep` field-for-field
/// (AD-12).
///
/// The BACKEND filters this by the order's current status, its scope flags and
/// the caller's REAL permissions. The client never recomputes it: the branches
/// require DIFFERENT permission keys, so an any-of expression on the client
/// would be a third copy of the rule and it would drift (AD-2/AD-4).
///
/// No Vietnamese label here either — the destination's label comes from
/// [kStatusLabels], parity-guarded byte-for-byte against web.
class OrderNextStep {
  const OrderNextStep({
    required this.event,
    required this.to,
    required this.requires,
  });

  final String event;
  final String to;
  final String requires;
}

/// The whole `GET /orders/:id/lifecycle` reply (Story 5.4 + 5.5): what the
/// stepper draws, and what this caller can do next.
///
/// Both come from ONE read of the order. A second route for [buocKeTiep] would
/// be a second request asking the same question.
///
/// [buocKeTiep] EMPTY means this caller has no legal step — the "Chuyển trạng
/// thái" button is then hidden outright, not greyed (UX-DR-22).
class OrderLifecycle {
  const OrderLifecycle({
    required this.buoc,
    required this.buocKeTiep,
    required this.coTheHuy,
  });

  final List<OrderLifecycleStep> buoc;
  final List<OrderNextStep> buocKeTiep;

  /// Whether THIS caller can cancel THIS order (Story 5.7) — the backend read it
  /// off the transition table against the caller's real permissions.
  ///
  /// It cannot be derived from [buocKeTiep]: cancelling is not part of the
  /// manual lane, so `huy` never appears there. And the client must not derive
  /// it from `status` either — that is business logic (AD-2). `false` ⇒ the
  /// button is ABSENT, not greyed (UX-DR-22).
  final bool coTheHuy;
}

/// One row of the stock-out preview — mirrors `OrderStockIssueLineDto` field for field.
class OrderStockIssueLine {
  const OrderStockIssueLine({
    required this.productId,
    required this.name,
    required this.sku,
    required this.unit,
    required this.qty,
    required this.onHand,
    required this.shortfall,
  });

  final String productId;
  final String name;
  final String sku;
  final String unit;

  /// What the order needs — the backend already summed same-product lines.
  final int qty;

  /// Real on-hand right now, for counting against. The go/no-go WARNING is
  /// [shortfall] / the view's `blocked` — never a client-side comparison.
  final int onHand;

  /// Units of [qty] beyond [onHand] right now (≥ 0), computed by the backend.
  /// A warning: the server re-checks under the lock when issuing.
  final int shortfall;
}

/// `GET /orders/:id/stock-issue` — mirrors `OrderStockIssueViewDto`.
///
/// ONE ORDER, ONE STOCK-OUT. [issued] + [voucher] once issued; before that,
/// [lines] (in the backend's canonical order — a 409's `lines.{i}.qty` indexes
/// into it) and [untrackedItems] (line names that never go on the voucher).
/// [canIssue] is computed by the BACKEND — the screen does not re-derive it,
/// and never compares `qty` with `onHand` (AD-2). [blocked] (some line short
/// right now) is the backend's warning, kept apart from [canIssue] so the
/// screen can tell "may not issue" from "may issue, but goods are missing".
class OrderStockIssueView {
  const OrderStockIssueView({
    required this.issued,
    this.voucher,
    required this.canIssue,
    required this.blocked,
    required this.lines,
    required this.untrackedItems,
  });

  final bool issued;

  /// NULL until issued (field absent). Its `unitCost` is null without `costs.view`.
  final StockVoucherDetail? voucher;
  final bool canIssue;
  final bool blocked;
  final List<OrderStockIssueLine> lines;
  final List<String> untrackedItems;
}

/// One product of the quote's early stock warning — mirrors
/// `OrderStockCheckLineDto` field for field. Every figure and [status] are the
/// backend's; the screen picks its wording from [status] only.
class OrderStockCheckLine {
  const OrderStockCheckLine({
    required this.productId,
    required this.name,
    required this.unit,
    required this.qty,
    required this.onHand,
    required this.reserved,
    required this.available,
    required this.shortfall,
    required this.status,
  });

  final String productId;
  final String name;
  final String unit;

  /// What the quote needs — the backend already summed same-product lines.
  final int qty;
  final int onHand;

  /// Promised to OTHER orders.
  final int reserved;

  /// `onHand − reserved`, may be negative.
  final int available;

  /// What to bring in (≥ 0).
  final int shortfall;

  /// `enough` | `short`.
  final String status;
}

/// `GET /orders/:id/stock-check` — mirrors `OrderStockCheckDto`. One entry per
/// stock-tracked product of the current version, ordered by name; free-text and
/// non-tracked lines are absent. A warning only — confirming is never blocked.
class OrderStockCheck {
  const OrderStockCheck({required this.lines});

  final List<OrderStockCheckLine> lines;
}

/// The backend's `status` of a short product in [OrderStockCheckLine].
const String kStockCheckShort = 'short';

/// `POST /orders/:id/stock-issue` — mirrors `OrderStockIssueResultDto`.
class OrderStockIssueResult {
  const OrderStockIssueResult({required this.voucher});

  final StockVoucherDetail voucher;
}

/// What one manual transition did — mirrors the backend `StatusChangeResponseDto`.
class StatusChangeResult {
  const StatusChangeResult({
    required this.status,
    required this.occurredAt,
    required this.soAnhDaLuu,
  });

  final String status;
  final String occurredAt;
  final int soAnhDaLuu;
}

/// One photo attached to an order (Story 5.6, FR-24) — mirrors the backend
/// `AttachmentItemDto` field for field.
///
/// [statusFrom]/[statusTo] are the step coordinates: BOTH null means this is a
/// supplementary photo that belongs to no transition. The screen reads that pair
/// to pick the badge; it does not infer the kind from anywhere else.
///
/// [coTheXoa] is computed by the BACKEND (uploader OR order-edit permission,
/// AD-2/AD-4). The client ONLY renders it — rebuilding that expression here
/// would be a second copy of the rule, and it would drift.
///
/// There is NO object key here: R2 keys never leave the backend (AD-3). Bytes
/// come from [OrdersPort.anhBytes], which goes through the authenticated proxy.
class AttachmentItem {
  const AttachmentItem({
    required this.id,
    required this.fileName,
    required this.contentType,
    required this.size,
    required this.createdAt,
    required this.nguoiTaiLen,
    required this.statusFrom,
    required this.statusTo,
    required this.coTheXoa,
  });

  final String id;
  final String fileName;
  final String contentType;
  final int size;
  final String createdAt;
  final String nguoiTaiLen;
  final String? statusFrom;
  final String? statusTo;
  final bool coTheXoa;
}

/// One quantity change between two versions.
class OrderVersionQtyChange {
  const OrderVersionQtyChange({
    required this.ten,
    required this.tu,
    required this.den,
  });

  final String ten;
  final int tu;
  final int den;
}

/// What changed between version N-1 and version N — lines and quantities only.
/// Never money: before Chốt a price is resolved live from the catalogue, so
/// diffing prices would report "changed" on a version nobody touched.
class OrderVersionChange {
  const OrderVersionChange({
    required this.them,
    required this.xoa,
    required this.doiSoLuong,
  });

  final List<String> them;
  final List<String> xoa;
  final List<OrderVersionQtyChange> doiSoLuong;
}

/// One update version in the order history (Story 5.4, FR-6) — mirrors the
/// backend `OrderVersionItemDto` and the web `OrderVersionItem`.
///
/// [laBanHienLuc] is resolved by the BACKEND through `Order.currentVersionId`
/// (AD-6) — the screen must NOT re-derive it from the highest [versionNo].
///
/// [createdByDisplayName] is null for a version created before the actor column
/// existed; the screen shows `—` rather than inventing a name.
class OrderVersionItem {
  const OrderVersionItem({
    required this.id,
    required this.versionNo,
    required this.laBanHienLuc,
    required this.createdAt,
    required this.chotAt,
    required this.createdByAccountId,
    required this.createdByDisplayName,
    required this.soDong,
    required this.thayDoi,
  });

  final String id;
  final int versionNo;
  final bool laBanHienLuc;
  final String createdAt;
  final String? chotAt;
  final String? createdByAccountId;
  final String? createdByDisplayName;
  final int soDong;
  final OrderVersionChange thayDoi;
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

/// Body of `POST /orders/:id/apply-discount` (Story 4.7) — one integer đồng
/// amount on the ORDER.
class ApplyDiscountInput {
  const ApplyDiscountInput({required this.amount, this.note});

  final int amount;
  final String? note;
}

/// Body of `POST /orders/:id/resolve-discount` (Story 4.7) — [reason] REQUIRED
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

/// One item of `GET /orders/pending-discount-approvals` (Story 4.7, FR-18/FR-37) —
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

  /// Lifecycle of one order — `GET /orders/:id/lifecycle` (Story 5.4 + 5.5,
  /// FR-7). Steps already gated by the order's scope flags: those that do not
  /// apply are ABSENT from the list, not dimmed (UX-DR-11). `buocKeTiep` is
  /// already filtered by the caller's real permissions. Throws 404 (absent or
  /// out of the caller's scope — indistinguishable by design), 403.
  Future<OrderLifecycle> getLifecycle(String orderId);

  /// Update history of one order — `GET /orders/:id/versions` (Story 5.4,
  /// FR-6). Every version, `versionNo` ascending; exactly one carries
  /// `laBanHienLuc`. Throws 404 / 403 like [getLifecycle].
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
  /// [event] is one of the events `getLifecycle().buocKeTiep` handed back. The
  /// caller does NOT name a destination: the destination belongs to the
  /// backend's transition table, not to the client (AD-11).
  ///
  /// [anh] is ALWAYS optional — an empty list is the ordinary path, not an edge
  /// case (FR-23, UX-DR-25). Limits are the backend's: 10 photos, 10 MB each,
  /// jpeg/png/webp/heic.
  ///
  /// Throws 400 (photo rejected — `fieldErrors` carries which one), 403 (missing
  /// the permission this step needs), 409 (step outside this screen's lane,
  /// outside the order's scope, or not reachable from the current status —
  /// including pressing twice), 404.
  Future<StatusChangeResult> chuyenTrangThai(
    String orderId,
    String event,
    List<XFile> anh,
  );

  /// Cancel the order with a REASON — `POST /orders/:id/cancel` (Story 5.7, FR-9).
  ///
  /// Its own endpoint, not an `event` of [chuyenTrangThai]: the reason is
  /// mandatory and only this path enforces it.
  ///
  /// [lyDo] is required, 3–500 characters after trimming. Call this only when
  /// `getLifecycle().coTheHuy` is true — the backend enforces the same rule
  /// anyway and answers 403/409 otherwise (AD-4: hiding the button is UX, not
  /// security).
  ///
  /// Throws 400 (`fieldErrors` carries `lyDo`), 403, 409 (current status has no
  /// cancel edge — including an order already cancelled), 404.
  Future<void> huyDon(String orderId, String lyDo);

  /// Every photo of the order — step photos AND supplementary ones, in ONE flat
  /// list newest first (Story 5.6, FR-24) — `GET /orders/:id/attachments`.
  ///
  /// The order is the backend's (`createdAt` descending); the screen does not
  /// re-sort. Throws 403 (neither `orders.view_all` nor `orders.view_own`), 404
  /// (order out of scope or missing).
  Future<List<AttachmentItem>> listAnh(String orderId);

  /// Attach supplementary photos OUTSIDE the transition flow (Story 5.6,
  /// FR-24) — `POST /orders/:id/attachments` as `multipart/form-data`. The rows land
  /// with all three step coordinates null: they belong to no step.
  ///
  /// Limits are the backend's: 10 photos per upload, 10 MB each,
  /// jpeg/png/webp/heic. Throws 400 (`fieldErrors` says which photo), 403, 404.
  Future<void> themAnh(String orderId, List<XFile> files);

  /// Delete ONE photo — `DELETE /orders/:id/attachments/:attachmentId` (Story 5.6,
  /// FR-24). Hard delete; the trail lives in the audit log.
  ///
  /// Call this only for items whose [AttachmentItem.coTheXoa] is true — the
  /// backend enforces the same rule anyway and answers 403 otherwise (AD-4:
  /// hiding the button is UX, not security). Throws 403, 404.
  Future<void> xoaAnh(String orderId, String attachmentId);

  /// Bytes of ONE photo for preview — `GET /orders/:id/attachments/:attachmentId`
  /// (Story 5.5 proxy route, AD-3: the bucket is not public, every byte comes
  /// through the backend behind JWT).
  ///
  /// The SCREEN calls this and hands the result to the gallery widget; the
  /// gallery itself never touches the network. Throws 403, 404.
  Future<Uint8List> anhBytes(String orderId, String attachmentId);

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
