// Source-guard (Stories 10.7–10.8, AD-12 client rule; twin of web composition-root.test.ts):
// lib/main.dart is the mobile's ONE composition root.
//
//  - No fake port reaches the production path: main.dart, the app layer, the HTTP
//    layer and everything production renders (screens, shared components, shell)
//    never name a Fake…Port, import a fake_… module or the session barrel (which
//    re-exports the fakes).
//  - Only main.dart builds the session store, the transport, the generated client
//    and the HTTP adapters (tests excepted): a second place assembling ports is a
//    second session.
//  - The ports whose data types are contract types alias the GENERATED models
//    (`typedef X = …Dto;`) instead of declaring the contract by hand.
//
// Reads sources as text with the shared lexer. Not blind: it must scan enough files
// and must still see the real calls in main.dart.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../support/dart_source.dart';

const String mainPath = 'lib/main.dart';

final Map<String, String> sources = {
  for (final f in Directory('lib').listSync(recursive: true).whereType<File>())
    if (f.path.endsWith('.dart') && !f.path.startsWith('lib/api/generated/')) f.path: f.readAsStringSync(),
};

bool isProductionPath(String path) =>
    path == mainPath ||
    path.startsWith('lib/app/') ||
    path.startsWith('lib/api/') ||
    path.startsWith('lib/screens/') ||
    path.startsWith('lib/design_system/components/') ||
    path.startsWith('lib/design_system/shell/');

/// Fake ports by name (code), fake modules and the session barrel by import (raw text).
List<String> fakeReferences(String src) {
  final code = stripDart(src, dropStrings: true);
  final raw = stripDart(src, dropStrings: false);
  return [
    for (final m in RegExp(r'\bFake\w*Port\b').allMatches(code)) m[0]!,
    for (final m in RegExp(r'''(import|export)\s+['"][^'"]*\bfake_\w*\.dart['"]''').allMatches(raw)) m[0]!,
    for (final m in RegExp(r'''(import|export)\s+['"][^'"]*\bsession/session\.dart['"]''').allMatches(raw)) m[0]!,
  ];
}

/// The classes only the composition root may construct.
const List<String> assembled = ['SessionStore', 'Transport', 'PnsApiClient', r'Http\w+Port'];

/// Constructor calls of [assembled] in [src]; a class's own constructor declaration
/// (`Transport({…})` inside `class Transport`) is a definition, not a call.
List<String> assemblyCalls(String src) {
  final code = stripDart(src, dropStrings: true);
  final declared = {for (final m in RegExp(r'\bclass\s+(\w+)').allMatches(code)) m[1]!};
  return [
    for (final name in assembled)
      for (final m in RegExp('\\b($name)\\s*\\(').allMatches(code))
        if (!declared.contains(m[1])) m[1]!,
  ];
}

/// Port file → the contract types it must alias to a generated model.
const Map<String, List<String>> generatedTypes = {
  'lib/design_system/session/me_port.dart': ['MeResponse'],
  'lib/design_system/session/customers_port.dart': [
    'Customer',
    'CustomerSource',
    'CustomerLookup',
    'CustomerPage',
    'CreateCustomerInput',
  ],
  'lib/design_system/session/warranty_port.dart': [
    'WarrantyCustomer',
    'WarrantyLine',
    'WarrantyOrder',
    'WarrantyLookup',
  ],
  'lib/design_system/session/catalog_port.dart': ['CatalogGroupItem'],
  'lib/design_system/session/orders_port.dart': [
    'OrderLine',
    'Order',
    'OrderDiscount',
    'OrderListItem',
    'OrderLifecycleStep',
    'OrderNextStep',
    'OrderLifecycle',
    'OrderStockIssueLine',
    'OrderStockIssueView',
    'OrderStockCheckLine',
    'OrderStockCheck',
    'OrderStockIssueResult',
    'StatusChangeResult',
    'AttachmentItem',
    'OrderVersionQtyChange',
    'OrderVersionChange',
    'OrderVersionItem',
    'OrderPage',
    'CreateOrderInput',
    'AddOrderLineInput',
    'OrderTotals',
    'ApplyDiscountInput',
    'ResolveDiscountInput',
    'DiscountPendingLine',
    'DiscountPendingItem',
    'PreviewTotalInput',
    'PreviewTotalLine',
  ],
  'lib/design_system/session/inventory_port.dart': ['StockItemView', 'PurchaseNeedView', 'StockList'],
  'lib/design_system/session/stock_vouchers_port.dart': [
    'StockVoucherCreator',
    'StockVoucherSummary',
    'StockVoucherReturnOf',
    'StockVoucherReturnRef',
    'StockVoucherLine',
    'StockVoucherDetail',
    'StockVoucherList',
    'CreateStockVoucherLineInput',
    'CreateStockVoucherInput',
    'CreateReturnVoucherLineInput',
  ],
  'lib/design_system/session/payments_port.dart': [
    'Payment',
    'Installment',
    'PaymentSchedule',
    'InstallmentInput',
    'ReplacePaymentScheduleInput',
    'AutoTransitionResult',
    'RecordPaymentResult',
  ],
  'lib/design_system/session/contracts_port.dart': ['ContractSummary', 'ContractsOverview'],
  'lib/design_system/session/invoices_port.dart': [
    'InvoiceSummary',
    'InvoicesOverview',
    'InvoiceSeller',
    'InvoiceLine',
    'InvoicePdfInfo',
    'InvoiceDetail',
  ],
};

String snake(String name) =>
    name.replaceAllMapped(RegExp(r'([a-z0-9])([A-Z])'), (m) => '${m[1]}_${m[2]}').toLowerCase();

void main() {
  test('scans the hand-written production path (not blind)', () {
    final production = sources.keys.where(isProductionPath).toList();
    expect(production.length, greaterThanOrEqualTo(40));
    expect(production, containsAll([mainPath, 'lib/app/pns_app.dart', 'lib/app/signed_in_app.dart']));
  });

  test('the detectors see a fake and an assembly when there is one', () {
    expect(
      fakeReferences(
        "import '../design_system/session/fake_me_port.dart';\n"
        "import 'package:pns_mobile/design_system/session/session.dart';\n"
        'final p = FakeMePort(); // FakeOrdersPort in a comment\n',
      ),
      hasLength(3),
    );
    expect(
      assemblyCalls(
        'class HttpMePort { HttpMePort(this.c); }\nfinal t = Transport(baseUrl: u);\n'
        "final x = HttpCustomersPort(c, t); final s = 'SessionStore(';\n",
      ),
      ['Transport', 'HttpCustomersPort'],
    );
  });

  test('no fake port, fake module or session barrel on the production path', () {
    final offenders = [
      for (final MapEntry(key: path, value: src) in sources.entries)
        if (isProductionPath(path))
          for (final ref in fakeReferences(src)) '$path: $ref',
    ];
    expect(offenders, isEmpty, reason: 'fakes are for tests and demos only');
  });

  test('main.dart really assembles every piece (positive self-check)', () {
    final calls = assemblyCalls(sources[mainPath]!);
    for (final name in [
      'SessionStore',
      'Transport',
      'PnsApiClient',
      'HttpAuthPort',
      'HttpMePort',
      'HttpPasswordPort',
      'HttpCustomersPort',
      'HttpWarrantyPort',
      'HttpCatalogPort',
      'HttpOrdersPort',
      'HttpInventoryPort',
      'HttpStockVouchersPort',
      'HttpPaymentsPort',
      'HttpContractsPort',
      'HttpInvoicesPort',
    ]) {
      expect(calls, contains(name), reason: 'main.dart no longer calls $name( — the guard would check nothing');
    }
  });

  test('only main.dart assembles the session, the transport, the client and the adapters', () {
    final offenders = [
      for (final MapEntry(key: path, value: src) in sources.entries)
        if (path != mainPath)
          for (final call in assemblyCalls(src)) '$path: $call(',
    ];
    expect(offenders, isEmpty, reason: 'a second place building ports is a second session');
  });

  test('the ports alias the generated contract types, with no hand-written twin', () {
    var aliased = 0;
    for (final MapEntry(key: path, value: types) in generatedTypes.entries) {
      final code = stripDart(sources[path]!, dropStrings: true);
      for (final type in types) {
        final alias = RegExp('^typedef $type = (\\w+Dto);\$', multiLine: true).firstMatch(code);
        expect(alias, isNotNull, reason: '$path must declare typedef $type = …Dto;');
        expect(
          File('lib/api/generated/models/${snake(alias![1]!)}.dart').existsSync(),
          isTrue,
          reason: '$type aliases ${alias[1]}, which is not a generated model',
        );
        expect(RegExp('\\bclass\\s+$type\\b').hasMatch(code), isFalse, reason: '$path hand-declares class $type');
        aliased++;
      }
    }
    // 11 (Story 10.7) + 55 order/stock/money/document types (Story 10.8).
    expect(aliased, 66);
  });
}
