// A CustomersPort for the customer cubit tests (Story 11.2): logs every call in
// order and, when [hold] is set, keeps each answer pending until the test
// completes it — in any order, with a value or an error.
import 'dart:async';

import 'package:pns_mobile/design_system/session/customers_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';

class RecordingCustomersPort implements CustomersPort {
  RecordingCustomersPort({this.error, this.sourcesError, this.hold = false});

  /// Thrown by every method (after it is logged).
  final Object? error;

  /// Thrown by [listSources] only.
  final Object? sourcesError;

  /// Every answer waits on a completer in [pending] (completeError ⇒ that call throws).
  final bool hold;
  final List<Completer<void>> pending = [];

  /// Method names in call order, e.g. `['get', 'listSources']`.
  final List<String> log = [];
  final List<({String? q, String? custType, int? page})> listCalls = [];
  final List<String> lookups = [];
  final List<String> gets = [];
  final List<CreateCustomerInput> created = [];

  final Customer customer = kDemoCustomers.first;
  final List<CustomerSource> sources = kDemoCustomerSources;
  /// Replaceable, so a test can answer a miss.
  late CustomerLookup lookupResult = CustomerLookup(found: true, phone: customer.phone, customer: customer);
  late final CustomerPage page = CustomerPage(items: kDemoCustomers, total: 45, page: 2, pageSize: 20);

  /// When set, the n-th list call answers `pages[n]` instead of [page].
  List<CustomerPage>? pages;

  Future<void> _answer(String method) async {
    log.add(method);
    if (error != null) throw error!;
    if (!hold) return;
    final Completer<void> reply = Completer<void>();
    pending.add(reply);
    await reply.future;
  }

  @override
  Future<CustomerPage> list({String? q, String? custType, int? page, int? pageSize}) async {
    listCalls.add((q: q, custType: custType, page: page));
    final int call = listCalls.length - 1;
    await _answer('list');
    return pages?[call] ?? this.page;
  }

  @override
  Future<Customer> get(String sdt) async {
    gets.add(sdt);
    await _answer('get');
    return customer;
  }

  @override
  Future<List<CustomerSource>> listSources() async {
    await _answer('listSources');
    if (sourcesError != null) throw sourcesError!;
    return sources;
  }

  @override
  Future<CustomerLookup> lookup(String sdt) async {
    lookups.add(sdt);
    await _answer('lookup');
    return lookupResult;
  }

  @override
  Future<Customer> create(CreateCustomerInput input) async {
    created.add(input);
    await _answer('create');
    return customer;
  }
}
