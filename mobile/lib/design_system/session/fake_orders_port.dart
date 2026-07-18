// hand-authored — TEST/DEMO-ONLY fake port (Story 4.1, mirror web
// web/src/design-system/session/fake-orders-port.ts).
//
// NOT a real backend: an in-memory order store so the quote screen is demoable
// and guardable WITHOUT an app-runtime or network. It PLAYS THE BACKEND's role
// for the demo — which is why the line `amount` is computed HERE and never in a
// screen/widget (AD-10/16: the client renders backend numbers; this fake IS the
// stand-in backend). It enforces no security rule — permissions, the `'baogia'`
// window, the priceEditable gate all live on the real server (AD-4).

import 'dart:typed_data';

import 'catalog_port.dart';
import 'customers_port.dart';
import 'fake_catalog_port.dart';
import 'fake_customers_port.dart';
import 'orders_port.dart';

const String _now = '2026-07-16T00:00:00.000Z';

/// STATIC demo bytes for `exportQuote` (Story 4.8) — the real backend renders
/// PDF/PNG from the quote template; the demo just hands back a valid 1×1 PNG
/// and a minimal PDF header so the share plumbing is exercisable offline.
final Uint8List _demoQuotePng = Uint8List.fromList(const <int>[
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, //
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, //
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, //
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, //
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, //
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82, //
]);
final Uint8List _demoQuotePdf =
    Uint8List.fromList('%PDF-1.4\n%%EOF\n'.codeUnits);

/// Digits of a string, minus leading zeros — mirrors the backend's phone matching.
String _digits(String raw) =>
    raw.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^0+'), '');

/// Stand-in for the backend's scopePresetFor() (Story 4.3, FR-2) — lives in the
/// fake (the demo "server"), never in a screen: CA_NHAN → all three on,
/// THUONG_MAI → equipment only.
({bool scopeThietBi, bool scopeThiCong, bool scopeVanChuyen}) _presetFor(
  String custType,
) {
  final bool caNhan = custType == 'CA_NHAN';
  return (scopeThietBi: true, scopeThiCong: caNhan, scopeVanChuyen: caNhan);
}

/// Demo rows for the order-list screen (Story 5.3) — used only when nothing was
/// created in this session, so the list screen is demoable standalone. Spread
/// across statuses so the follow-up filter ('baogia') and the "filtered but
/// empty" state are both reachable without a backend. Mirrors the web fake.
const List<OrderListItem> kDemoOrderRows = <OrderListItem>[
  OrderListItem(
    id: 'ord-demo-1',
    status: 'baogia',
    customerSdt: '+84903176968',
    customerName: 'Khách lẻ',
    ownerAccountId: 'acc-demo',
    assigneeAccountId: null,
    createdAt: '2026-07-17T09:00:00.000Z',
    updatedAt: '2026-07-17T09:00:00.000Z',
  ),
  OrderListItem(
    id: 'ord-demo-2',
    status: 'baogia',
    customerSdt: '+84912345678',
    customerName: 'Khách lẻ',
    ownerAccountId: 'acc-demo',
    assigneeAccountId: 'acc-demo',
    createdAt: '2026-07-16T08:00:00.000Z',
    updatedAt: '2026-07-16T08:00:00.000Z',
  ),
  OrderListItem(
    id: 'ord-demo-3',
    status: 'dachot',
    customerSdt: '+84903176968',
    customerName: 'Khách lẻ',
    ownerAccountId: 'acc-demo',
    assigneeAccountId: null,
    createdAt: '2026-07-15T07:00:00.000Z',
    updatedAt: '2026-07-15T07:00:00.000Z',
  ),
  OrderListItem(
    id: 'ord-demo-4',
    status: 'thicong',
    customerSdt: '+84912345678',
    customerName: 'Khách lẻ',
    ownerAccountId: 'acc-demo',
    assigneeAccountId: 'acc-demo',
    createdAt: '2026-07-14T06:00:00.000Z',
    updatedAt: '2026-07-14T06:00:00.000Z',
  ),
];

/// An [OrdersPort] backed by an in-memory store — TEST/DEMO ONLY.
class FakeOrdersPort implements OrdersPort {
  FakeOrdersPort({
    this.products = kDemoCatalogProducts,
    this.customers = kDemoCustomers,
  });

  final List<CatalogProduct> products;
  final List<Customer> customers;
  final Map<String, Order> _orders = <String, Order>{};
  int _seq = 0;

  /// `GET /orders` stand-in (Story 5.3). Plays the BACKEND's role for the demo:
  /// it filters and pages, and it reports [OrderPage.total] over the whole
  /// filtered set — a screen that counted rows itself would show one page and
  /// lose the rest.
  ///
  /// It does NOT model permission scope: scope is a server decision (AD-4), and
  /// a fake that pretended to enforce it would teach the screen to expect a
  /// client-side scope knob that must never exist.
  @override
  Future<OrderPage> list({
    String? status,
    bool? followUp,
    int? page,
    int? pageSize,
  }) async {
    if (followUp == true && status != null) {
      throw const OrderPortException(
        'Không dùng đồng thời `followUp` và `status` — follow-up đã là bộ lọc trạng thái (đơn chưa chốt).',
      );
    }

    final List<OrderListItem> rows = _orders.isEmpty
        ? kDemoOrderRows
        : _orders.values
            .map(
              (Order o) => OrderListItem(
                id: o.id,
                status: o.status,
                customerSdt: o.customerSdt,
                customerName: 'Khách lẻ',
                ownerAccountId: o.ownerAccountId,
                assigneeAccountId: o.assigneeAccountId,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
              ),
            )
            .toList();

    final String? wanted = followUp == true ? 'baogia' : status;
    final List<OrderListItem> filtered = wanted == null
        ? rows
        : rows.where((OrderListItem r) => r.status == wanted).toList();

    final int p = page ?? 1;
    final int size = pageSize ?? 20;
    final int start = (p - 1) * size;
    final int end = start + size;

    return OrderPage(
      items: start >= filtered.length
          ? const <OrderListItem>[]
          : filtered.sublist(
              start, end > filtered.length ? filtered.length : end),
      total: filtered.length,
      page: p,
      pageSize: size,
    );
  }

  @override
  Future<Order> create(CreateOrderInput input) async {
    _seq += 1;
    // The backend snapshots custType from the Customer and applies the scope
    // preset explicitly (Story 4.3) — the fake plays that role for its demo
    // customers; an unknown phone falls back to CA_NHAN.
    final String needle = _digits(input.customerSdt);
    Customer? customer;
    for (final Customer c in customers) {
      if (needle.isNotEmpty && _digits(c.sdt).endsWith(needle)) {
        customer = c;
        break;
      }
    }
    final String custType = customer?.custType ?? 'CA_NHAN';
    final ({bool scopeThietBi, bool scopeThiCong, bool scopeVanChuyen}) preset =
        _presetFor(custType);
    final Order order = Order(
      id: 'ord-demo-$_seq',
      status: 'baogia',
      customerSdt: input.customerSdt,
      currentVersionId: 'ver-demo-$_seq',
      ownerAccountId: 'acc-demo',
      sourceId: customer?.sourceId ?? 'src-facebook',
      custType: custType,
      scopeThietBi: preset.scopeThietBi,
      scopeThiCong: preset.scopeThiCong,
      scopeVanChuyen: preset.scopeVanChuyen,
      // The backend writes the VAT tick EXPLICITLY on create (Story 4.4) —
      // null is reserved for pre-4.4 orders; the fake plays that role.
      vatMode: 'co_vat',
      lineItems: <OrderLine>[],
      createdAt: _now,
      updatedAt: _now,
    );
    _orders[order.id] = order;
    return _copy(order);
  }

  @override
  Future<Order> updateScopeFlags(
    String orderId,
    UpdateScopeFlagsInput input,
  ) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    final Order updated = Order(
      id: order.id,
      status: order.status,
      customerSdt: order.customerSdt,
      currentVersionId: order.currentVersionId,
      ownerAccountId: order.ownerAccountId,
      assigneeAccountId: order.assigneeAccountId,
      sourceId: order.sourceId,
      custType: order.custType,
      scopeThietBi: order.scopeThietBi,
      scopeThiCong: input.scopeThiCong ?? order.scopeThiCong,
      scopeVanChuyen: input.scopeVanChuyen ?? order.scopeVanChuyen,
      kWp: order.kWp,
      vatMode: order.vatMode,
      validityNote: order.validityNote,
      lineItems: order.lineItems,
      discount: order.discount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    );
    _orders[orderId] = updated;
    return _copy(updated);
  }

  @override
  Future<Order> updateOrderMeta(
    String orderId,
    UpdateOrderMetaInput input,
  ) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    // PATCH semantics mirror the backend: absent = keep, null = clear (kWp/
    // validityNote are nullable business values; vatMode never goes null here).
    final Order updated = Order(
      id: order.id,
      status: order.status,
      customerSdt: order.customerSdt,
      currentVersionId: order.currentVersionId,
      ownerAccountId: order.ownerAccountId,
      assigneeAccountId: order.assigneeAccountId,
      sourceId: order.sourceId,
      custType: order.custType,
      scopeThietBi: order.scopeThietBi,
      scopeThiCong: order.scopeThiCong,
      scopeVanChuyen: order.scopeVanChuyen,
      kWp: input.hasKWp ? input.kWp : order.kWp,
      vatMode: input.vatMode ?? order.vatMode,
      validityNote:
          input.hasValidityNote ? input.validityNote : order.validityNote,
      lineItems: order.lineItems,
      discount: order.discount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    );
    _orders[orderId] = updated;
    return _copy(updated);
  }

  @override
  Future<Order> get(String id) async {
    final Order? order = _orders[id];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $id');
    }
    return _copy(order);
  }

  /// Demo stand-in for the backend's `buocVongDoi()` — it lives in the FAKE (the
  /// demo "server"), never in a screen, exactly like the scope preset above. The
  /// real sequence is derived from ALLOWED_TRANSITIONS server-side
  /// (AD-2/AD-11); this one only needs the right shape to draw.
  ///
  /// Steps blocked by a scope flag are ABSENT, not dimmed (UX-DR-11).
  @override
  Future<List<OrderLifecycleStep>> getLifecycle(String orderId) async {
    final Order? order = _orders[orderId];
    // Demo rows carry no scope flags — treat them as CA_NHAN so the demo shows a
    // full-length stepper (also the case that overflows a phone width).
    final bool thiCong = order?.scopeThiCong ?? true;
    final bool vanChuyen = order?.scopeVanChuyen ?? true;
    final String status = order?.status ?? 'baogia';
    final List<String> chuoi = <String>[
      'baogia',
      'dachot',
      'dacoc',
      if (thiCong) ...<String>['thicong', 'nghiemthu'],
      if (vanChuyen) ...<String>['danggiao', 'dagiao'],
      'hoanthanh',
    ];
    final int dangO = chuoi.indexOf(status);
    return <OrderLifecycleStep>[
      for (int i = 0; i < chuoi.length; i++)
        OrderLifecycleStep(
          status: chuoi[i],
          trangThai: dangO == -1 || i > dangO
              ? 'upcoming'
              : i == dangO
                  ? 'current'
                  : 'done',
        ),
    ];
  }

  /// Demo history. Two shapes on purpose so the screen's empty and populated
  /// branches both have data: an order whose id ends in `-1` gets several
  /// versions, every other order stays at its original version.
  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async {
    final OrderVersionItem goc = OrderVersionItem(
      id: '$orderId-v1',
      versionNo: 1,
      laBanHienLuc: !orderId.endsWith('-1'),
      createdAt: _now,
      chotAt: null,
      createdByAccountId: 'acc-demo',
      createdByDisplayName: 'Nguyễn Văn Quản Lý',
      soDong: 3,
      thayDoi: const OrderVersionChange(
        them: <String>[],
        xoa: <String>[],
        doiSoLuong: <OrderVersionQtyChange>[],
      ),
    );
    if (!orderId.endsWith('-1')) return <OrderVersionItem>[goc];
    return <OrderVersionItem>[
      goc,
      OrderVersionItem(
        id: '$orderId-v2',
        versionNo: 2,
        laBanHienLuc: true,
        createdAt: _now,
        chotAt: null,
        // Bản cũ không có actor ⇒ null; màn hiện `—`, không bịa tên.
        createdByAccountId: null,
        createdByDisplayName: null,
        soDong: 4,
        thayDoi: const OrderVersionChange(
          them: <String>['Tủ điện DC 2 string'],
          xoa: <String>[],
          doiSoLuong: <OrderVersionQtyChange>[
            OrderVersionQtyChange(ten: 'Tấm pin JA Solar 580W', tu: 8, den: 12),
          ],
        ),
      ),
    ];
  }

  @override
  Future<OrderLine> addLine(String orderId, AddOrderLineInput input) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }

    _seq += 1;
    late final OrderLine line;
    if (input.productId != null) {
      CatalogProduct? product;
      for (final CatalogProduct p in products) {
        if (p.id == input.productId) {
          product = p;
          break;
        }
      }
      if (product == null) {
        throw const OrderPortException('Sản phẩm không tồn tại.');
      }
      // Stand-in for the backend's resolveUnitPrice(): demo has no tier data,
      // so the catalogue price wins unless the product allows a client price.
      final int unitPrice = product.priceEditable && input.unitPrice != null
          ? input.unitPrice!
          : product.price;
      line = OrderLine(
        id: 'line-demo-$_seq',
        productId: product.id,
        name: product.name,
        unit: product.unit,
        qty: input.qty,
        unitPrice: unitPrice,
        priceEditable: product.priceEditable,
        isFlexible: input.isFlexible ?? false,
        note: input.note,
        // Install/labour lines (priceEditable) never carry warranty — force null
        // even if the catalogue product has one (mirrors backend addLine).
        warrantyMonths: product.priceEditable ? null : product.warrantyMonths,
        displayOrder: order.lineItems.length,
        amount: _serverAmount(unitPrice, input.qty),
      );
    } else {
      final int unitPrice = input.unitPrice ?? 0;
      line = OrderLine(
        id: 'line-demo-$_seq',
        name: input.name ?? '',
        unit: input.unit ?? '',
        qty: input.qty,
        unitPrice: unitPrice,
        priceEditable: true,
        isFlexible: input.isFlexible ?? false,
        note: input.note,
        // Free lines start with no warranty (set later via the row link — AC #4),
        // mirrors web `warrantyMonths: null`.
        warrantyMonths: null,
        displayOrder: order.lineItems.length,
        amount: _serverAmount(unitPrice, input.qty),
      );
    }

    order.lineItems.add(line);
    return line;
  }

  @override
  Future<OrderLine> updateLine(
    String orderId,
    String lineId,
    UpdateOrderLineInput input,
  ) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    final int index =
        order.lineItems.indexWhere((OrderLine l) => l.id == lineId);
    if (index < 0) {
      throw OrderPortException('Không tìm thấy dòng báo giá: $lineId');
    }
    final OrderLine before = order.lineItems[index];
    final int qty = input.qty ?? before.qty;
    final int unitPrice = before.priceEditable && input.unitPrice != null
        ? input.unitPrice!
        : before.unitPrice;
    // Warranty tri-state: absent → keep; present → write (incl. null = clear), UNLESS the
    // line is a catalogue install/labour line (productId set + priceEditable) — those ignore
    // the field silently. Free lines (productId null) DO accept warranty. NO `?? before` —
    // that would drop a legitimate null-clear. Mirrors backend `warrantyLocked` guard.
    final bool warrantyLocked =
        before.productId != null && before.priceEditable;
    final int? warrantyMonths = input.hasWarrantyMonths && !warrantyLocked
        ? input.warrantyMonths
        : before.warrantyMonths;
    final OrderLine updated = OrderLine(
      id: before.id,
      productId: before.productId,
      name: before.name,
      unit: before.unit,
      qty: qty,
      unitPrice: unitPrice,
      priceEditable: before.priceEditable,
      isFlexible: input.isFlexible ?? before.isFlexible,
      note: input.note ?? before.note,
      warrantyMonths: warrantyMonths,
      displayOrder: before.displayOrder,
      amount: _serverAmount(unitPrice, qty),
    );
    order.lineItems[index] = updated;
    return updated;
  }

  @override
  Future<void> removeLine(String orderId, String lineId) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    order.lineItems.removeWhere((OrderLine l) => l.id == lineId);
  }

  @override
  Future<OrderTotals> previewTotal(PreviewTotalInput input) async {
    // The backend's computeOrderTotals() stand-in — SAME formula (8% VAT,
    // discount subtracted BEFORE VAT into vatBase — Story 4.7 —, integer
    // half-up at the grand vatBase, `vatMode` echo decides applyVat — Story
    // 4.4), lives in the fake (the demo "server"), never in a screen (AD-16).
    // Absent vatMode = pre-4.4 order = VAT applies.
    const int vatRate = 8;
    final bool applyVat = input.vatMode != 'khong_vat';
    int subtotal = 0;
    for (final PreviewTotalLine line in input.lines) {
      subtotal += _serverAmount(line.unitPrice, line.qty);
    }
    final int discountAmount = input.discountAmount ?? 0;
    final int vatBase = subtotal - discountAmount;
    final int vatAmount = applyVat ? (vatBase * vatRate + 50) ~/ 100 : 0;
    return OrderTotals(
      subtotal: subtotal,
      discountAmount: discountAmount,
      vatAmount: vatAmount,
      total: vatBase + vatAmount,
      vatRate: vatRate,
      applyVat: applyVat,
    );
  }

  @override
  Future<Order> confirmOrder(String orderId) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    // Confirming from 'choduyet' needs the discount APPROVED first (Story 4.7)
    // — the fake mirrors the backend's 409.
    if (order.status == 'choduyet' && order.discount?.status != 'dong_y') {
      throw const OrderPortException('Chiết khấu chưa được duyệt.');
    }
    // Already confirmed = idempotent no-op, mirroring the backend retry path.
    // The fake does NOT simulate the price freeze — the client never computes
    // money and never reads snapshots; the returned numbers just stay as-is.
    if (order.status == 'dachot') {
      return _copy(order);
    }
    final Order confirmed = Order(
      id: order.id,
      status: 'dachot',
      customerSdt: order.customerSdt,
      currentVersionId: order.currentVersionId,
      ownerAccountId: order.ownerAccountId,
      assigneeAccountId: order.assigneeAccountId,
      sourceId: order.sourceId,
      custType: order.custType,
      scopeThietBi: order.scopeThietBi,
      scopeThiCong: order.scopeThiCong,
      scopeVanChuyen: order.scopeVanChuyen,
      kWp: order.kWp,
      vatMode: order.vatMode,
      validityNote: order.validityNote,
      lineItems: order.lineItems,
      discount: order.discount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    );
    _orders[orderId] = confirmed;
    return _copy(confirmed);
  }

  @override
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    // Only a draft can be sent for approval — mirroring the backend's 409
    // (applying is NOT idempotent: two taps carry different amounts).
    if (order.status != 'baogia') {
      throw const OrderPortException(
        'Chỉ áp được chiết khấu khi đơn đang ở trạng thái Báo giá.',
      );
    }
    final Order applied = Order(
      id: order.id,
      status: 'choduyet',
      customerSdt: order.customerSdt,
      currentVersionId: order.currentVersionId,
      ownerAccountId: order.ownerAccountId,
      assigneeAccountId: order.assigneeAccountId,
      sourceId: order.sourceId,
      custType: order.custType,
      scopeThietBi: order.scopeThietBi,
      scopeThiCong: order.scopeThiCong,
      scopeVanChuyen: order.scopeVanChuyen,
      kWp: order.kWp,
      vatMode: order.vatMode,
      validityNote: order.validityNote,
      lineItems: order.lineItems,
      discount: OrderDiscount(
        amount: input.amount,
        status: 'cho_duyet',
        requestNote: input.note,
        requestedAt: _now,
      ),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    );
    _orders[orderId] = applied;
    return _copy(applied);
  }

  @override
  Future<Order> resolveDiscount(
    String orderId,
    ResolveDiscountInput input,
  ) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    final OrderDiscount? discount = order.discount;
    if (discount == null || discount.status != 'cho_duyet') {
      throw const OrderPortException('Đơn không có chiết khấu chờ duyệt.');
    }
    // Approving keeps the order 'choduyet' — confirming is a SEPARATE action;
    // rejecting returns it to draft with the reason on the record.
    final Order resolved = Order(
      id: order.id,
      status: input.approve ? order.status : 'baogia',
      customerSdt: order.customerSdt,
      currentVersionId: order.currentVersionId,
      ownerAccountId: order.ownerAccountId,
      assigneeAccountId: order.assigneeAccountId,
      sourceId: order.sourceId,
      custType: order.custType,
      scopeThietBi: order.scopeThietBi,
      scopeThiCong: order.scopeThiCong,
      scopeVanChuyen: order.scopeVanChuyen,
      kWp: order.kWp,
      vatMode: order.vatMode,
      validityNote: order.validityNote,
      lineItems: order.lineItems,
      discount: OrderDiscount(
        amount: discount.amount,
        status: input.approve ? 'dong_y' : 'tu_choi',
        requestNote: discount.requestNote,
        resolveNote: input.reason,
        requestedAt: discount.requestedAt,
        resolvedAt: _now,
      ),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    );
    _orders[orderId] = resolved;
    return _copy(resolved);
  }

  @override
  Future<List<DiscountPendingItem>> listPendingDiscounts() async {
    // Derived from the in-memory store: every order whose LATEST discount is
    // still pending. All numbers computed HERE (the demo "server") — subtotal,
    // afterDiscount, and a STATIC demo margin per catalogue line (the real
    // backend reads Product.costPrice; the demo has no cost data).
    final List<DiscountPendingItem> items = <DiscountPendingItem>[];
    for (final Order order in _orders.values) {
      final OrderDiscount? discount = order.discount;
      if (discount == null || discount.status != 'cho_duyet') continue;
      int subtotal = 0;
      for (final OrderLine line in order.lineItems) {
        subtotal += _serverAmount(line.unitPrice, line.qty);
      }
      items.add(
        DiscountPendingItem(
          orderId: order.id,
          customerSdt: order.customerSdt,
          amount: discount.amount,
          requestNote: discount.requestNote,
          requestedByAccountId: order.ownerAccountId,
          requestedByDisplayName: 'Nhân viên demo',
          requestedAt: discount.requestedAt,
          subtotal: subtotal,
          afterDiscount: subtotal - discount.amount,
          lines: order.lineItems
              .map(
                (OrderLine line) => DiscountPendingLine(
                  name: line.name,
                  qty: line.qty,
                  unitPrice: line.unitPrice,
                  // Static demo margin: catalogue lines show 20%, free/zero-
                  // price lines show null ("—") — same nullability contract
                  // as the backend.
                  estimatedMarginPct:
                      line.productId != null && line.unitPrice != 0 ? 20 : null,
                ),
              )
              .toList(),
        ),
      );
    }
    return items;
  }

  @override
  Future<QuoteExportFiles> exportQuote(String orderId) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    // Twin of the backend 400: an empty quote has nothing to export.
    if (order.lineItems.isEmpty) {
      throw const OrderPortException(
          'Không thể xuất báo giá chưa có dòng nào.');
    }
    final String fileBase =
        'bao-gia-${orderId.substring(0, orderId.length < 8 ? orderId.length : 8)}';
    return QuoteExportFiles(
      image: QuoteExportFile(
        fileName: '$fileBase.png',
        mimeType: 'image/png',
        bytes: _demoQuotePng,
      ),
      pdf: QuoteExportFile(
        fileName: '$fileBase.pdf',
        mimeType: 'application/pdf',
        bytes: _demoQuotePdf,
      ),
    );
  }

  @override
  Future<Order> reviseOrder(String orderId) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException('Không tìm thấy đơn hàng: $orderId');
    }
    // Already open = idempotent no-op, mirroring the backend retry path. The
    // fake does NOT simulate the new version / line copy — the client never
    // sees the version concept (4.1); the lines just come back as-is.
    if (order.status == 'baogia') {
      return _copy(order);
    }
    final Order revised = Order(
      id: order.id,
      status: 'baogia',
      customerSdt: order.customerSdt,
      currentVersionId: order.currentVersionId,
      ownerAccountId: order.ownerAccountId,
      assigneeAccountId: order.assigneeAccountId,
      sourceId: order.sourceId,
      custType: order.custType,
      scopeThietBi: order.scopeThietBi,
      scopeThiCong: order.scopeThiCong,
      scopeVanChuyen: order.scopeVanChuyen,
      kWp: order.kWp,
      vatMode: order.vatMode,
      validityNote: order.validityNote,
      lineItems: order.lineItems,
      discount: order.discount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    );
    _orders[orderId] = revised;
    return _copy(revised);
  }

  Order _copy(Order order) => Order(
        id: order.id,
        status: order.status,
        customerSdt: order.customerSdt,
        currentVersionId: order.currentVersionId,
        ownerAccountId: order.ownerAccountId,
        assigneeAccountId: order.assigneeAccountId,
        sourceId: order.sourceId,
        custType: order.custType,
        scopeThietBi: order.scopeThietBi,
        scopeThiCong: order.scopeThiCong,
        scopeVanChuyen: order.scopeVanChuyen,
        kWp: order.kWp,
        vatMode: order.vatMode,
        validityNote: order.validityNote,
        lineItems: List<OrderLine>.of(order.lineItems),
        discount: order.discount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      );

  /// The BACKEND's lineAmount() stand-in — lives in the fake (the demo
  /// "server"), never in UI code.
  int _serverAmount(int unitPrice, int qty) => unitPrice * qty;
}
