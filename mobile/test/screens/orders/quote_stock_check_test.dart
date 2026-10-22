// Native Flutter widget tests for the quote screen's early stock warning —
// mobile twin of web `quote-stock-check.test.tsx`.
//
// Every outer condition is switched ON in the fixtures (the caller holds the
// quote + confirm keys, the order is a draft with lines), so no assertion
// passes merely because an outer gate hid the thing under test. Covered:
// per-line labels picked from the backend's `status`, one warn sentence per
// short product, "Chốt" never gated by stock, a failed read only hides the
// hints, an answer for older lines never overwrites a newer one, and the
// LONGEST product name with its "Cần nhập" label does not overflow at 320/360.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/catalog_port.dart';
import 'package:pns_mobile/design_system/session/fake_catalog_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/design_system/tokens/app_tokens.dart';
import 'package:pns_mobile/screens/orders/create_quote_screen.dart';

const String _kLongestName = 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha';
const String _kShortSentence =
    'Inverter Hybrid 8kW — Còn 1 · Đã hứa 1 · Cần nhập 1. Vẫn chốt đơn được; chặn nằm ở khâu xuất kho.';

const Set<String> _kPerms = <String>{
  AppPermissionKeys.quotesCreateEdit,
  AppPermissionKeys.ordersConfirm,
};

/// A draft quote — one enough product, one short product, one free-text line —
/// handed to the screen as the order its customer pick creates. `stockError`
/// makes the stock read fail; `stockAnswers` answers it call by call.
class _QuotePort extends FakeOrdersPort {
  _QuotePort({super.products, this.stockError});

  final Object? stockError;
  final List<Completer<OrderStockCheck>> stockAnswers =
      <Completer<OrderStockCheck>>[];
  int stockCalls = 0;
  int confirmCalls = 0;
  late Order seeded;

  Future<void> seed(List<AddOrderLineInput> lines) async {
    final Order order =
        await super.create(const CreateOrderInput(customerPhone: '+84903176968'));
    for (final AddOrderLineInput line in lines) {
      await super.addLine(order.id, line);
    }
    seeded = await super.get(order.id);
  }

  @override
  Future<Order> create(CreateOrderInput input) async => seeded;

  @override
  Future<OrderStockCheck> getStockCheck(String orderId) {
    stockCalls += 1;
    if (stockError != null) return Future<OrderStockCheck>.error(stockError!);
    if (stockAnswers.length >= stockCalls) {
      return stockAnswers[stockCalls - 1].future;
    }
    return super.getStockCheck(orderId);
  }

  @override
  Future<Order> confirmOrder(String orderId) {
    confirmCalls += 1;
    return super.confirmOrder(orderId);
  }
}

const List<AddOrderLineInput> _kDraftLines = <AddOrderLineInput>[
  AddOrderLineInput(productId: 'prod-pin-580', qty: 2),
  AddOrderLineInput(productId: 'prod-inverter-8k', qty: 1),
  AddOrderLineInput(
      name: 'Phí khảo sát', unit: 'lần', qty: 1, unitPrice: 500000),
];

OrderStockCheck _single(String status,
        {required int available, required int shortfall}) =>
    OrderStockCheck(lines: <OrderStockCheckLine>[
      OrderStockCheckLine(
        productId: 'prod-pin-580',
        name: 'Tấm pin JA Solar 580W',
        unit: 'tấm',
        qty: 3,
        onHand: available,
        reserved: 0,
        available: available,
        shortfall: shortfall,
        status: OrderStockCheckLineDtoStatus.fromJson(status),
      ),
    ]);

Widget _host(FakeOrdersPort port) => MaterialApp(
      home: Scaffold(
        body: CreateQuoteScreen(
          ordersPort: port,
          catalogPort: FakeCatalogPort(),
          customersPort: FakeCustomersPort(),
          perms: _kPerms,
        ),
      ),
    );

void _screenSize(WidgetTester tester, double width) {
  tester.view.physicalSize = Size(width, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Future<void> _tap(WidgetTester tester, String label) async {
  final Finder finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _openQuote(WidgetTester tester, FakeOrdersPort port) async {
  await tester.pumpWidget(_host(port));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField).first, '0903176968');
  await _tap(tester, 'Tra cứu');
  await _tap(tester, 'Dùng khách này');
}

/// The cart row carrying [name] (the stock hint renders inside it).
Finder _row(String name) => find.ancestor(
      of: find.text(name),
      matching: find.byType(AppCartLineRow),
    );

void main() {
  group('Quote — early stock warning', () {
    testWidgets(
        'labels: enough ⇒ "Kho còn {available}", short ⇒ "Cần nhập {shortfall}", free-text line ⇒ no label; one warn sentence per short product',
        (tester) async {
      _screenSize(tester, 400.0);
      final _QuotePort port = _QuotePort();
      await port.seed(_kDraftLines);
      await _openQuote(tester, port);

      expect(
        find.descendant(
            of: _row('Tấm pin JA Solar 580W'),
            matching: find.text('Kho còn 42')),
        findsOneWidget,
      );
      final Finder shortLabel = find.descendant(
          of: _row('Inverter Hybrid 8kW'), matching: find.text('Cần nhập 1'));
      expect(shortLabel, findsOneWidget);
      expect(tester.widget<Text>(shortLabel).style?.color, AppTokens.danger);
      expect(
        find.descendant(
          of: _row('Phí khảo sát'),
          matching: find.textContaining(RegExp('Kho còn|Cần nhập')),
        ),
        findsNothing,
      );
      expect(find.text(_kShortSentence), findsOneWidget);
      expect(find.textContaining('Vẫn chốt đơn được'), findsOneWidget);
    });

    testWidgets(
        '"Chốt báo giá" stays enabled while a product is short and goes through confirmOrder',
        (tester) async {
      _screenSize(tester, 400.0);
      final _QuotePort port = _QuotePort();
      await port.seed(_kDraftLines);
      await _openQuote(tester, port);
      expect(find.text(_kShortSentence), findsOneWidget);

      final Finder chot = find.widgetWithText(AppButton, 'Chốt báo giá');
      expect(tester.widget<AppButton>(chot.first).onPressed, isNotNull);
      await _tap(tester, 'Chốt báo giá');
      await _tap(tester, 'Xác nhận');

      expect(port.confirmCalls, 1);
    });

    testWidgets(
        'stock read fails ⇒ no hints, no warn banner, NO error banner; the cart is untouched',
        (tester) async {
      _screenSize(tester, 400.0);
      final _QuotePort port = _QuotePort(
        stockError:
            const OrderPortException('Không có quyền.', code: 'FORBIDDEN'),
      );
      await port.seed(_kDraftLines);
      await _openQuote(tester, port);

      expect(port.stockCalls, greaterThan(0));
      expect(find.textContaining(RegExp('Kho còn|Cần nhập')), findsNothing);
      expect(find.textContaining('Vẫn chốt đơn được'), findsNothing);
      expect(find.text('Không có quyền.'), findsNothing);
      expect(find.text('Tấm pin JA Solar 580W'), findsOneWidget);
      expect(find.text('Inverter Hybrid 8kW'), findsOneWidget);
      expect(find.text('Phí khảo sát'), findsOneWidget);
    });

    testWidgets(
        'removing the short line re-reads stock ⇒ its label and the warn banner go away, the enough label stays',
        (tester) async {
      _screenSize(tester, 400.0);
      final _QuotePort port = _QuotePort();
      await port.seed(_kDraftLines);
      await _openQuote(tester, port);
      expect(find.text(_kShortSentence), findsOneWidget);
      final int callsBefore = port.stockCalls;

      final Finder shortRow = find.ancestor(
        of: find.text('Inverter Hybrid 8kW'),
        matching: find.byType(Dismissible),
      );
      await tester.ensureVisible(shortRow);
      await tester.pump();
      await tester.drag(shortRow, const Offset(-500.0, 0.0));
      await tester.pumpAndSettle();

      expect(find.text('Inverter Hybrid 8kW'), findsNothing);
      expect(port.stockCalls, greaterThan(callsBefore));
      expect(find.textContaining('Vẫn chốt đơn được'), findsNothing);
      expect(find.textContaining('Cần nhập'), findsNothing);
      expect(
        find.descendant(
            of: _row('Tấm pin JA Solar 580W'),
            matching: find.text('Kho còn 42')),
        findsOneWidget,
      );
    });

    testWidgets(
        'an answer for older lines is dropped when the lines changed meanwhile',
        (tester) async {
      _screenSize(tester, 400.0);
      final _QuotePort port = _QuotePort()
        ..stockAnswers.add(Completer<OrderStockCheck>())
        ..stockAnswers.add(Completer<OrderStockCheck>());
      await port.seed(const <AddOrderLineInput>[
        AddOrderLineInput(productId: 'prod-pin-580', qty: 2),
      ]);
      await _openQuote(tester, port);

      // A qty edit re-reads the lines ⇒ a second stock read.
      await tester.enterText(find.widgetWithText(TextField, '2').first, '3');
      await tester.pumpAndSettle();
      expect(port.stockCalls, 2);

      port.stockAnswers[1]
          .complete(_single('enough', available: 7, shortfall: 0));
      await tester.pumpAndSettle();
      expect(find.text('Kho còn 7'), findsOneWidget);

      port.stockAnswers[0]
          .complete(_single('short', available: 0, shortfall: 2));
      await tester.pumpAndSettle();
      expect(find.text('Kho còn 7'), findsOneWidget);
      expect(find.text('Cần nhập 2'), findsNothing);
    });

    for (final double width in <double>[320.0, 360.0]) {
      testWidgets(
          'LONGEST name + "Cần nhập" label + warn banner do not overflow at ${width}px',
          (tester) async {
        _screenSize(tester, width);
        final _QuotePort port = _QuotePort(
          products: <CatalogProduct>[
            ...kDemoCatalogProducts,
            const CatalogProduct(
              id: 'prod-inverter-hybrid-10k',
              name: _kLongestName,
              sku: 'INV-ASW10K-H',
              unit: 'bộ',
              price: 42000000,
              priceEditable: false,
              isActive: true,
            ),
          ],
        );
        await port.seed(const <AddOrderLineInput>[
          AddOrderLineInput(productId: 'prod-inverter-hybrid-10k', qty: 2),
        ]);
        // An order the fake never stored ⇒ its fixed demo answer, whose short
        // product IS the longest-named one.
        port.stockAnswers.add(Completer<OrderStockCheck>()
          ..complete(await FakeOrdersPort().getStockCheck('ord-unknown')));
        await _openQuote(tester, port);

        expect(find.text(_kLongestName), findsWidgets);
        expect(
          find.descendant(
              of: _row(_kLongestName), matching: find.text('Cần nhập 1')),
          findsOneWidget,
        );
        expect(find.textContaining('$_kLongestName — Còn 1'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });
}
