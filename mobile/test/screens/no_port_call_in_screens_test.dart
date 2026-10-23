// Source-guard (Story 11.1, AD-12 mobile state rule): under lib/screens/ only a
// `*_cubit.dart` / `*_bloc.dart` file calls a method on a port. A screen hands
// its port to its cubit (constructor → BlocProvider) and renders the state.
//
// Screens not migrated yet sit in [notMigrated]; each entry must still call a
// port (a clean screen left in the list fails) and the list shrinks to empty in
// Story 11.4. lib/app/pns_app.dart and the session provider are held to the same
// rule with no allowlist: the session moved to SessionCubit / PermissionsCubit.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../support/dart_source.dart';

/// Screens still calling a port ⇒ the story that migrates them.
const Map<String, String> notMigrated = {
  'lib/screens/contracts/contracts_screen.dart': '11.4',
  'lib/screens/inventory/inventory_screen.dart': '11.4',
  'lib/screens/inventory/stock_vouchers_screen.dart': '11.4',
  'lib/screens/invoices/invoice_detail_screen.dart': '11.4',
  'lib/screens/invoices/invoices_screen.dart': '11.4',
  'lib/screens/orders/create_quote_screen.dart': '11.3',
  'lib/screens/orders/discount_approval_screen.dart': '11.3',
  'lib/screens/orders/order_detail_screen.dart': '11.3',
  'lib/screens/orders/order_list_screen.dart': '11.3',
  'lib/screens/orders/order_status_change_screen.dart': '11.3',
  'lib/screens/payments/payment_schedule_screen.dart': '11.4',
};

/// Held to the rule with no allowlist.
const List<String> alsoClean = [
  'lib/app/pns_app.dart',
  'lib/design_system/session/app_session.dart',
];

bool isCubitFile(String path) => path.endsWith('_cubit.dart') || path.endsWith('_bloc.dart');

final RegExp _portTyped = RegExp(r'\b\w*Port\??\s+(\w+)\b');
final RegExp _portsTyped = RegExp(r'\b\w*Ports\??\s+(\w+)\b');
const Set<String> _notNames = {'get', 'set', 'implements', 'extends', 'with', 'Function', 'on'};

/// Every name that holds a port in [code]: `port`, anything declared with a
/// `…Port` type (field, parameter, local), and local aliases of those.
Set<String> portNames(String code) {
  final names = <String>{'port'};
  for (final m in _portTyped.allMatches(code)) {
    if (!_notNames.contains(m.group(1))) names.add(m.group(1)!);
  }
  while (true) {
    final before = names.length;
    final known = _portPatterns(code, names);
    final alias = RegExp('(?:final|var|late final)\\s+(\\w+)\\s*=\\s*(?:widget\\s*\\.\\s*)?(?:$known)\\b(?!\\s*\\??\\.)');
    for (final m in alias.allMatches(code)) {
      names.add(m.group(1)!);
    }
    if (names.length == before) return names;
  }
}

/// Regex alternatives for "a port": each of [names], plus a member of a port
/// bundle (`ports.me`, any name declared with a `…Ports` type such as AppPorts).
String _portPatterns(String code, Set<String> names) {
  final bundles = <String>{'ports'};
  for (final m in _portsTyped.allMatches(code)) {
    if (!_notNames.contains(m.group(1))) bundles.add(m.group(1)!);
  }
  return [
    ...names.map(RegExp.escape),
    for (final bundle in bundles) '${RegExp.escape(bundle)}\\s*\\??\\.\\s*\\w+',
  ].join('|');
}

/// Port member accesses in [src] (comments and string text ignored): a call, a
/// tear-off, `.call(`, a chained `.then(`.
List<({int line, String snippet})> portCalls(String src) {
  final code = stripDart(src, dropStrings: true);
  final known = _portPatterns(code, portNames(code));
  final access = RegExp('(?:\\b\\w+\\s*\\.\\s*)?\\b(?:$known)\\s*\\??\\.\\s*(?!runtimeType\\b|hashCode\\b)[a-zA-Z_]\\w*');
  return [
    for (final m in access.allMatches(code))
      (line: '\n'.allMatches(code.substring(0, m.start)).length + 1, snippet: m.group(0)!),
  ];
}

List<String> screenFiles() {
  final files = Directory('lib/screens')
      .listSync(recursive: true)
      .whereType<File>()
      .map((f) => f.path)
      .where((p) => p.endsWith('.dart'))
      .toList()
    ..sort();
  return files;
}

String _report(String path, List<({int line, String snippet})> calls) =>
    calls.map((c) => '$path:${c.line}: ${c.snippet}').join('\n');

void main() {
  group('detector', () {
    const positives = {
      'port.x(': 'void f() { port.restoreSession(); }',
      'widget.port.x(': 'void f() { widget.port.restoreSession(); }',
      'widget.ordersPort.x(': 'final OrdersPort ordersPort; void f() { widget.ordersPort.list(); }',
      'local alias': 'void f() { final p = widget.port; p.restoreSession(); }',
      'tear-off': 'void f() { final f = widget.port.restoreSession; }',
      '.call(': 'void f() { widget.port.restoreSession.call(); }',
      'chained .then(': 'void f() { widget.port.restoreSession().then((_) {}); }',
      'typed alias, other name': 'void f() { AuthPort authPort = widget.port; authPort.logout(); }',
      'null-aware': 'final MePort? mePort; void f() { mePort?.fetchMe(); }',
      'a port of AppPorts': 'final AppPorts ports; void f() { widget.ports.me.fetchMe(); }',
      'a port of AppPorts, other name': 'final AppPorts all; void f() { all.password.requestResetCode(p); }',
      'an alias of a port of AppPorts': 'void f() { final me = widget.ports.me; me.fetchMe(); }',
    };
    positives.forEach((name, src) {
      test('catches $name', () => expect(portCalls(src), isNotEmpty, reason: src));
    });
    const negatives = {
      'passing the port down': 'Widget b() => Child(port: widget.port);',
      'comparing ports': 'bool c() => oldWidget.port != widget.port;',
      'a comment': '// widget.port.restoreSession()\nvoid f() {}',
      'a string': "const s = 'widget.port.restoreSession()';",
      'AppPorts (not a port)': 'final AppPorts ports; Widget b() => X(port: widget.ports.me);',
      'transport is not port': 'void f() { transport.close(); }',
    };
    negatives.forEach((name, src) {
      test('ignores $name', () => expect(portCalls(src), isEmpty, reason: src));
    });
  });

  test('no screen outside the allowlist calls a port; only cubit files may', () {
    final offenders = <String>[];
    for (final path in screenFiles()) {
      if (isCubitFile(path) || notMigrated.containsKey(path)) continue;
      final calls = portCalls(File(path).readAsStringSync());
      if (calls.isNotEmpty) offenders.add(_report(path, calls));
    }
    expect(offenders, isEmpty,
        reason: 'move these port calls into the screen\'s cubit:\n${offenders.join('\n')}');
  });

  test('every allowlist entry exists and still calls a port (clean ⇒ remove the entry)', () {
    final stale = <String>[];
    notMigrated.forEach((path, story) {
      final file = File(path);
      if (!file.existsSync()) {
        stale.add('$path (story $story): file is gone — remove the entry');
      } else if (portCalls(file.readAsStringSync()).isEmpty) {
        stale.add('$path (story $story): no port call left — remove the entry');
      }
    });
    expect(stale, isEmpty, reason: stale.join('\n'));
  });

  test('the guard is not blind: it scans ≥ 20 screens and sees the real login call in LoginCubit', () {
    final files = screenFiles();
    final screens = files.where((p) => !isCubitFile(p)).toList();
    expect(screens.length, greaterThanOrEqualTo(20), reason: 'scanned: $screens');
    final cubitCalls = [
      for (final path in files.where(isCubitFile)) ...portCalls(File(path).readAsStringSync()),
    ];
    expect(cubitCalls, isNotEmpty, reason: 'no cubit calls a port — the detector went blind');
    final login = portCalls(File('lib/screens/auth/login_cubit.dart').readAsStringSync());
    expect(login.map((c) => c.snippet), contains(matches(RegExp(r'\b_port\s*\.\s*login$'))),
        reason: 'LoginCubit signs in through _port.login(...) — the guard must see that call');
  });

  test('the app shell and the session provider call no port either', () {
    final offenders = <String>[];
    for (final path in alsoClean) {
      final calls = portCalls(File(path).readAsStringSync());
      if (calls.isNotEmpty) offenders.add(_report(path, calls));
    }
    expect(offenders, isEmpty, reason: 'the session lives in SessionCubit / PermissionsCubit:\n${offenders.join('\n')}');
  });
}
