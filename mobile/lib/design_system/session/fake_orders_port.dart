// hand-authored — TEST/DEMO-ONLY fake port (Story 4.1, mirror web
// web/src/design-system/session/fake-orders-port.ts).
//
// NOT a real backend: an in-memory order store so the quote screen is demoable
// and guardable WITHOUT an app-runtime or network. It PLAYS THE BACKEND's role
// for the demo — which is why the line `amount` is computed HERE and never in a
// screen/widget (AD-10/16: the client renders backend numbers; this fake IS the
// stand-in backend). It enforces no security rule — permissions, the `'baogia'`
// window, the priceEditable gate all live on the real server (AD-4).

import 'catalog_port.dart';
import 'customers_port.dart';
import 'fake_catalog_port.dart';
import 'fake_customers_port.dart';
import 'orders_port.dart';

const String _now = '2026-07-16T00:00:00.000Z';

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
      lineItems: order.lineItems,
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
        warrantyMonths: product.warrantyMonths,
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
      warrantyMonths: before.warrantyMonths,
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
    // integer half-up at the grand subtotal), lives in the fake (the demo
    // "server"), never in a screen (AD-16).
    int subtotal = 0;
    for (final PreviewTotalLine line in input.lines) {
      subtotal += _serverAmount(line.unitPrice, line.qty);
    }
    final int vatAmount = (subtotal * 8 + 50) ~/ 100;
    return OrderTotals(
      subtotal: subtotal,
      vatAmount: vatAmount,
      total: subtotal + vatAmount,
    );
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
        lineItems: List<OrderLine>.of(order.lineItems),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      );

  /// The BACKEND's lineAmount() stand-in — lives in the fake (the demo
  /// "server"), never in UI code.
  int _serverAmount(int unitPrice, int qty) => unitPrice * qty;
}
