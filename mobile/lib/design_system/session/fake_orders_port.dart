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

import 'package:image_picker/image_picker.dart';

import 'catalog_port.dart';
import 'customers_port.dart';
import 'fake_catalog_port.dart';
import 'fake_customers_port.dart';
import 'fake_stock_vouchers_port.dart';
import 'orders_port.dart';
import 'stock_vouchers_port.dart';

const String _now = '2026-07-16T00:00:00.000Z';

/// Demo mirror of the backend's photo-count ceiling (`SO_ANH_TOI_DA`).
const int _kDemoSoAnhToiDa = 10;

/// Demo mirror of the backend's minimum cancel-reason length (Story 5.7).
const int _kDemoLyDoToiThieu = 3;

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

/// Demo order whose stock is ALREADY issued — its voucher carries no `unitCost`.
const String kFakeOrderIssued = 'ord-demo-4';

/// Demo order whose stock-out the fake refuses (409 INSUFFICIENT_STOCK on `lines.0.qty`).
const String kFakeOrderShortStock = 'ord-demo-3';

/// Stock-out preview rows, typed as the backend returns them: already summed per
/// product and in its canonical order (name, then id). Includes the LONGEST
/// product name. The fake owns no stock rule — "not enough" is a fixed branch on
/// a fixed order, never a `qty`/`onHand` comparison.
const List<OrderStockIssueLine> _kDemoIssueLines = <OrderStockIssueLine>[
  OrderStockIssueLine(
    productId: 'prod-inverter-hybrid-10k',
    name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
    sku: 'INV-ASW10K-H',
    unit: 'bộ',
    qty: 1,
    onHand: 5,
  ),
  OrderStockIssueLine(
    productId: 'prod-pin-ae-630',
    name: 'Tấm pin AE 630W',
    sku: 'PIN-AE-630',
    unit: 'tấm',
    qty: 14,
    onHand: 40,
  ),
];
const OrderStockIssueLine _kDemoShortLine = OrderStockIssueLine(
  productId: 'prod-battery-10kwh',
  name: 'Battery LiFePO4 10kWh',
  sku: 'BAT-10K',
  unit: 'bình',
  qty: 2,
  onHand: 0,
);
const List<String> _kDemoUntrackedItems = <String>['Công lắp đặt'];

const OrderPortException kFakeStockIssueShortError = OrderPortException(
  'Không đủ tồn — không thể xuất quá số tồn hiện có.',
  code: 'CONFLICT',
  fieldErrors: <String, String>{
    'lines.0.qty': 'Còn 0 bình, không xuất được 2.',
  },
);

/// The statuses the backend accepts for a standalone stock issue.
const List<String> _kDemoIssuableStatuses = <String>[
  'dachot',
  'dacoc',
  'danggiao',
  'thicong',
];

/// The backend's refusal of a direct close `dachot → hoan_thanh` before the
/// stock-out.
const OrderPortException kFakeCloseBeforeIssueError = OrderPortException(
  'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.',
  code: 'CONFLICT',
);

/// The backend's refusal of re-opening an order whose stock already left.
const OrderPortException kFakeReviseAfterIssueError = OrderPortException(
  'Đơn đã xuất kho — không mở lại để sửa được.',
  code: 'CONFLICT',
);

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

  /// One order, one stock-out — the fake's record of what is issued.
  final Map<String, StockVoucherDetail> _issuedVouchers =
      <String, StockVoucherDetail>{
    for (final StockVoucherDetail v in kDemoStockVouchers)
      if (v.orderId != null) v.orderId!: v,
  };

  /// Demo twin of `GET /orders/:id/stock-issue`.
  @override
  Future<OrderStockIssueView> getStockIssue(String orderId) async {
    final StockVoucherDetail? voucher = _issuedVouchers[orderId];
    if (voucher != null) {
      return OrderStockIssueView(
        issued: true,
        voucher: voucher,
        canIssue: false,
        lines: const <OrderStockIssueLine>[],
        untrackedItems: const <String>[],
      );
    }
    // The demo "server" answers `canIssue` from the status it knows; ids it
    // never created (test fixtures) keep the issuable demo.
    final String? status = _orders[orderId]?.status;
    return OrderStockIssueView(
      issued: false,
      canIssue: status == null || _kDemoIssuableStatuses.contains(status),
      lines: <OrderStockIssueLine>[
        if (orderId == kFakeOrderShortStock) _kDemoShortLine,
        ..._kDemoIssueLines,
      ],
      untrackedItems: List<String>.of(_kDemoUntrackedItems),
    );
  }

  /// Demo twin of `POST /orders/:id/stock-issue`: issued once, the
  /// same voucher on every later call; a fixed 409 on [kFakeOrderShortStock].
  @override
  Future<OrderStockIssueResult> issueStock(String orderId) async {
    final StockVoucherDetail? existing = _issuedVouchers[orderId];
    if (existing != null) return OrderStockIssueResult(voucher: existing);
    if (orderId == kFakeOrderShortStock) throw kFakeStockIssueShortError;
    return OrderStockIssueResult(voucher: _recordIssue(orderId));
  }

  /// The order's one stock-out, as the backend writes it (standalone or
  /// "Đã giao").
  StockVoucherDetail _recordIssue(String orderId) {
    final StockVoucherDetail voucher = StockVoucherDetail(
      id: 'pk-xuat-$orderId',
      ma: 'PK-X-0097',
      type: 'xuat',
      orderId: orderId,
      createdAt: _now,
      nguoiTao: const StockVoucherCreator(
        id: 'acc-kho-binh',
        displayName: 'Kho/Giao hàng (Bình)',
      ),
      soDong: _kDemoIssueLines.length,
      tongSoLuong: 15,
      note: null,
      lines: <StockVoucherLine>[
        for (final OrderStockIssueLine l in _kDemoIssueLines)
          StockVoucherLine(
            productId: l.productId,
            ten: l.name,
            sku: l.sku,
            donVi: l.unit,
            qty: l.qty,
          ),
      ],
    );
    _issuedVouchers[orderId] = voucher;
    return voucher;
  }

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
  /// Steps blocked by a scope flag are ABSENT, not dimmed (UX-DR-11). Thiết bị
  /// is always on in the demo, so `dagiao` is always reachable: through
  /// `danggiao` when Vận chuyển is on, straight from `dacoc` (customer pick-up)
  /// when it is off.
  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async {
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
      if (vanChuyen) 'danggiao',
      'dagiao',
      'hoanthanh',
    ];
    final int dangO = chuoi.indexOf(status);
    return OrderLifecycle(
      buoc: <OrderLifecycleStep>[
        for (int i = 0; i < chuoi.length; i++)
          OrderLifecycleStep(
            status: chuoi[i],
            trangThai: dangO == -1 || i > dangO
                ? 'upcoming'
                : i == dangO
                    ? 'current'
                    : 'done',
          ),
      ],
      buocKeTiep: _buocKeTiepDemo(status, thiCong, vanChuyen),
      // The demo "server" answers this the way the real one does — from the
      // same three statuses the transition table gives a `huy` edge. It lives
      // HERE and never in a screen (AD-2), which is also why the fake, not the
      // screen, knows a cancelled order can no longer be cancelled.
      coTheHuy: const <String>['baogia', 'dachot', 'dacoc'].contains(status),
    );
  }

  /// Demo stand-in for the backend's `buocKeTiep()`. Like `getLifecycle` above
  /// it lives in the FAKE (the demo "server"), NEVER in a screen — the real one
  /// reads ALLOWED_TRANSITIONS and filters by the caller's real permissions
  /// (AD-2/AD-11).
  ///
  /// Only the five MANUAL-lane events appear. `chot`/`mo_lai`/`huy`/`du_coc`/
  /// `ap_chiet_khau` each own a separate endpoint carrying logic this screen
  /// does not run, so the demo must not offer them either — a demo that offers
  /// a step the real backend rejects teaches the wrong shape.
  ///
  /// An order at a terminal status yields an EMPTY list, which is what drives
  /// the hidden-button branch of the screen.
  List<OrderNextStep> _buocKeTiepDemo(
    String status,
    bool thiCong,
    bool vanChuyen,
  ) {
    return <OrderNextStep>[
      // Thiết bị is always on in the demo ⇒ a confirmed order may close directly.
      if (status == 'dachot')
        const OrderNextStep(
          event: 'hoan_thanh',
          to: 'hoanthanh',
          requires: 'payments.record',
        ),
      if (status == 'dacoc' && thiCong)
        const OrderNextStep(
          event: 'bat_dau_thi_cong',
          to: 'thicong',
          requires: 'construction.transition',
        ),
      if (status == 'dacoc' && vanChuyen)
        const OrderNextStep(
          event: 'bat_dau_giao',
          to: 'danggiao',
          requires: 'delivery.confirm',
        ),
      if (status == 'dacoc' && !vanChuyen)
        const OrderNextStep(
          event: 'xong_giao',
          to: 'dagiao',
          requires: 'delivery.confirm',
        ),
      if (status == 'thicong')
        const OrderNextStep(
          event: 'xong_thi_cong',
          to: 'nghiemthu',
          requires: 'construction.transition',
        ),
      if (status == 'danggiao')
        const OrderNextStep(
          event: 'xong_giao',
          to: 'dagiao',
          requires: 'delivery.confirm',
        ),
      if (status == 'nghiemthu')
        const OrderNextStep(
          event: 'hoan_thanh',
          to: 'hoanthanh',
          requires: 'construction.transition',
        ),
      if (status == 'dagiao')
        const OrderNextStep(
          event: 'hoan_thanh',
          to: 'hoanthanh',
          requires: 'delivery.confirm',
        ),
    ];
  }

  /// Demo twin of `POST /orders/:id/chuyen-trang-thai` (Story 5.5). It applies
  /// the same three refusals the real backend applies, in the same order, so
  /// the screen's error branches are exercisable offline: unknown order → 404,
  /// step not offered for this status → 409, too many photos → 400 with
  /// `fieldErrors`.
  ///
  /// Photos are COUNTED, not stored: the demo has no R2 and inventing a fake
  /// object key would teach the screen a shape the real port does not return.
  @override
  Future<StatusChangeResult> chuyenTrangThai(
    String orderId,
    String event,
    List<XFile> anh,
  ) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException(
        'Không tìm thấy đơn hàng: $orderId',
        code: 'NOT_FOUND',
      );
    }
    final List<OrderNextStep> buoc = _buocKeTiepDemo(
      order.status,
      order.scopeThiCong,
      order.scopeVanChuyen,
    ).where((OrderNextStep b) => b.event == event).toList();
    if (buoc.isEmpty) {
      throw const OrderPortException(
        'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
        code: 'CONFLICT',
      );
    }
    // Every demo order carries stock-tracked lines ⇒ the direct close is
    // refused until it is issued, exactly as the backend does.
    if (order.status == 'dachot' &&
        event == 'hoan_thanh' &&
        !_issuedVouchers.containsKey(orderId)) {
      throw kFakeCloseBeforeIssueError;
    }
    if (anh.length > _kDemoSoAnhToiDa) {
      throw const OrderPortException(
        'Ảnh đính kèm không hợp lệ.',
        code: 'VALIDATION_ERROR',
        fieldErrors: <String, String>{
          'anh': 'Tối đa $_kDemoSoAnhToiDa ảnh cho một lần chuyển trạng thái.',
        },
      );
    }
    // "Đã giao" issues the stock in the same commit when it was not issued yet.
    if (event == kEventDelivered && !_issuedVouchers.containsKey(orderId)) {
      if (orderId == kFakeOrderShortStock) throw kFakeStockIssueShortError;
      _recordIssue(orderId);
    }
    return StatusChangeResult(
      status: buoc.first.to,
      occurredAt: _now,
      soAnhDaLuu: anh.length,
    );
  }

  /// Demo twin of `POST /orders/:id/huy` (Story 5.7). Applies the same three
  /// refusals in the same order as the real backend so the dialog's error
  /// branch is exercisable offline: unknown order → 404, status with no cancel
  /// edge (including one already cancelled) → 409, reason too short → 400 with
  /// `fieldErrors`.
  @override
  Future<void> huyDon(String orderId, String lyDo) async {
    final Order? order = _orders[orderId];
    if (order == null) {
      throw OrderPortException(
        'Không tìm thấy đơn hàng: $orderId',
        code: 'NOT_FOUND',
      );
    }
    if (!const <String>['baogia', 'dachot', 'dacoc'].contains(order.status)) {
      throw const OrderPortException(
        'Không huỷ được đơn ở trạng thái hiện tại.',
        code: 'CONFLICT',
      );
    }
    final String sach = lyDo.trim();
    if (sach.length < _kDemoLyDoToiThieu) {
      throw const OrderPortException(
        'Cần lý do khi huỷ đơn.',
        code: 'VALIDATION_ERROR',
        fieldErrors: <String, String>{
          'lyDo':
              'Lý do huỷ là bắt buộc, tối thiểu $_kDemoLyDoToiThieu ký tự.',
        },
      );
    }
    _orders[orderId] = Order(
      id: order.id,
      status: 'huy',
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
      cancelReason: sach,
      cancelledAt: _now,
      lineItems: order.lineItems,
      discount: order.discount,
      createdAt: order.createdAt,
      updatedAt: _now,
    );
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
    // An issued order cannot be re-opened — the backend's 409, mirrored.
    if (order.status == 'dachot' && _issuedVouchers.containsKey(orderId)) {
      throw kFakeReviseAfterIssueError;
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

  /// Demo photos — three shapes on purpose so every branch of the gallery has
  /// data: one step photo (both coordinates set), one supplementary photo (both
  /// null), and one the caller cannot delete.
  ///
  /// [AttachmentItem.coTheXoa] arrives PRE-COMPUTED here exactly as it does from
  /// the real backend — the fake plays the server's role, so the rule lives here
  /// and never in a screen or widget (AD-2).
  final Map<String, List<AttachmentItem>> _anhDemo =
      <String, List<AttachmentItem>>{};

  List<AttachmentItem> _anhCuaDon(String orderId) =>
      _anhDemo.putIfAbsent(orderId, () => <AttachmentItem>[
            AttachmentItem(
              id: '$orderId-anh-bo-sung',
              fileName: 'bien-ban-bo-sung.png',
              contentType: 'image/png',
              size: 204800,
              createdAt: _now,
              nguoiTaiLen: 'Nguyễn Văn Quản Lý',
              statusFrom: null,
              statusTo: null,
              coTheXoa: true,
            ),
            AttachmentItem(
              id: '$orderId-anh-buoc',
              fileName: 'nghiem-thu-thi-cong.jpg',
              contentType: 'image/jpeg',
              size: 512000,
              createdAt: _now,
              nguoiTaiLen: 'Trần Thợ Thi Công',
              statusFrom: 'dacoc',
              statusTo: 'thicong',
              coTheXoa: true,
            ),
            AttachmentItem(
              id: '$orderId-anh-nguoi-khac',
              fileName: 'giao-hang.jpg',
              contentType: 'image/jpeg',
              size: 348160,
              createdAt: _now,
              nguoiTaiLen: 'Lê Kho Giao',
              statusFrom: 'thicong',
              statusTo: 'danggiao',
              coTheXoa: false,
            ),
          ]);

  @override
  Future<List<AttachmentItem>> listAnh(String orderId) async {
    if (!_orders.containsKey(orderId)) {
      throw OrderPortException(
        'Không tìm thấy đơn hàng: $orderId',
        code: 'NOT_FOUND',
      );
    }
    return List<AttachmentItem>.of(_anhCuaDon(orderId));
  }

  @override
  Future<void> themAnh(String orderId, List<XFile> files) async {
    if (!_orders.containsKey(orderId)) {
      throw OrderPortException(
        'Không tìm thấy đơn hàng: $orderId',
        code: 'NOT_FOUND',
      );
    }
    if (files.length > _kDemoSoAnhToiDa) {
      throw const OrderPortException(
        'Ảnh đính kèm không hợp lệ.',
        code: 'VALIDATION_ERROR',
        fieldErrors: <String, String>{
          'anh': 'Tối đa $_kDemoSoAnhToiDa ảnh cho một lần tải lên.',
        },
      );
    }
    final List<AttachmentItem> danhSach = _anhCuaDon(orderId);
    for (int i = 0; i < files.length; i++) {
      _seq++;
      danhSach.insert(
        0,
        AttachmentItem(
          id: '$orderId-anh-moi-$_seq-$i',
          fileName: files[i].name,
          contentType: 'image/jpeg',
          size: 102400,
          createdAt: _now,
          nguoiTaiLen: 'Nguyễn Văn Quản Lý',
          statusFrom: null,
          statusTo: null,
          coTheXoa: true,
        ),
      );
    }
  }

  @override
  Future<void> xoaAnh(String orderId, String attachmentId) async {
    final List<AttachmentItem> danhSach = _anhCuaDon(orderId);
    final int viTri =
        danhSach.indexWhere((AttachmentItem a) => a.id == attachmentId);
    if (viTri == -1) {
      throw const OrderPortException(
        'Không tìm thấy ảnh đính kèm.',
        code: 'NOT_FOUND',
      );
    }
    if (!danhSach[viTri].coTheXoa) {
      throw const OrderPortException(
        'Bạn không có quyền xoá ảnh này.',
        code: 'FORBIDDEN',
      );
    }
    danhSach.removeAt(viTri);
  }

  @override
  Future<Uint8List> anhBytes(String orderId, String attachmentId) async {
    final bool coAnh = _anhCuaDon(orderId)
        .any((AttachmentItem a) => a.id == attachmentId);
    if (!coAnh) {
      throw const OrderPortException(
        'Không tìm thấy ảnh đính kèm.',
        code: 'NOT_FOUND',
      );
    }
    // Demo bytes, not a real image: the fake stands in for the proxy route, and
    // no test decodes actual pixels.
    return Uint8List.fromList(<int>[0x89, 0x50, 0x4e, 0x47]);
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
        cancelReason: order.cancelReason,
        cancelledAt: order.cancelledAt,
        lineItems: List<OrderLine>.of(order.lineItems),
        discount: order.discount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      );

  /// The BACKEND's lineAmount() stand-in — lives in the fake (the demo
  /// "server"), never in UI code.
  int _serverAmount(int unitPrice, int qty) => unitPrice * qty;
}
