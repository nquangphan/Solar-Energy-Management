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
/// There is deliberately NO subtotal/VAT/total: that is Story 4.2's
/// `preview-total`; the totals area renders "—" until then.
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
    required this.lineItems,
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
  final int? kWp;
  final String? vatMode;
  final List<OrderLine> lineItems;
  final String createdAt;
  final String updatedAt;
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

/// Body of `PATCH /orders/:id/line-items/:lineId` — [unitPrice] only on `priceEditable` lines.
class UpdateOrderLineInput {
  const UpdateOrderLineInput({
    this.qty,
    this.unitPrice,
    this.note,
    this.isFlexible,
  });

  final int? qty;
  final int? unitPrice;
  final String? note;
  final bool? isFlexible;
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
}
