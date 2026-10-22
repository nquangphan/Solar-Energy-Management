// hand-authored — TEST/DEMO-ONLY fake port (Story 3.4, mirror web
// web/src/design-system/session/fake-customers-port.ts).
//
// NOT a real backend: an in-memory list so the three customer screens are
// demoable/guardable WITHOUT an app-runtime or network. It enforces NO business
// rule — the real ones (phone normalisation, duplicate blocking, the `isOther` ⇒
// `sourceNote` rule, permissions) all live on the server (AD-4/AD-9).
//
// The lookup here matches on the digits of the stored key so the demo behaves
// like the real endpoint for a raw-typed number. That is a DEMO CONVENIENCE, not
// a normaliser: it never produces a key, it only compares.

import 'customers_port.dart';

// Fixed UTC instants (DateTime.utc): a local DateTime would shift by the device offset.
final DateTime _now = DateTime.utc(2026, 7, 13);

/// Demo catalogue — one source carries `isOther`, which is what reveals `Ghi rõ nguồn`.
const List<CustomerSource> kDemoCustomerSources = [
  CustomerSource(
    id: 'src-facebook',
    name: 'Facebook',
    description: 'Từ quảng cáo Facebook.',
    active: true,
    isOther: false,
    sortOrder: 1,
  ),
  CustomerSource(id: 'src-zalo', name: 'Zalo', active: true, isOther: false, sortOrder: 2),
  CustomerSource(id: 'src-khac', name: 'Khác', active: true, isOther: true, sortOrder: 99),
];

/// Demo customers — at least one of each type, one of them on the `isOther` source.
final List<Customer> kDemoCustomers = [
  Customer(
    phone: '+84903176968',
    custType: 'CA_NHAN',
    name: 'Nguyễn Văn A',
    nationalId: '079201001234',
    address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
    sourceId: 'src-facebook',
    createdAt: _now,
    updatedAt: _now,
  ),
  Customer(
    phone: '+84912345678',
    custType: 'THUONG_MAI',
    name: 'Công ty TNHH Hoà Phát',
    taxCode: '0312345678',
    address: '45 Lê Lợi, Quận 1, TP.HCM',
    bankAccount: '0071000123456 - Vietcombank',
    sourceId: 'src-khac',
    sourceNote: 'Khách cũ giới thiệu',
    createdAt: _now,
    updatedAt: _now,
  ),
];

/// Digits of a string, minus any leading zeros — mirrors what the BACKEND does when searching.
String _digits(String raw) =>
    raw.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^0+'), '');

/// A [CustomersPort] backed by an in-memory list — TEST/DEMO ONLY. Pass custom
/// data to model any state (empty catalogue, a customer on an `isOther` source…).
class FakeCustomersPort implements CustomersPort {
  FakeCustomersPort({
    List<Customer>? customers,
    this.sources = kDemoCustomerSources,
  }) : _customers = List<Customer>.of(customers ?? kDemoCustomers);

  List<Customer> _customers;
  final List<CustomerSource> sources;

  @override
  Future<CustomerLookup> lookup(String sdt) async {
    final String needle = _digits(sdt);
    Customer? found;
    for (final Customer c in _customers) {
      if (needle.isNotEmpty && _digits(c.phone).endsWith(needle)) {
        found = c;
        break;
      }
    }
    return CustomerLookup(
      found: found != null,
      phone: found?.phone ?? sdt,
      customer: found,
    );
  }

  @override
  Future<CustomerPage> list({
    String? q,
    String? custType,
    int? page,
    int? pageSize,
  }) async {
    final String query = (q ?? '').trim();
    final String needle = _digits(query);
    final List<Customer> matched = _customers.where((Customer c) {
      if (custType != null && custType.isNotEmpty && c.custType != custType) {
        return false;
      }
      if (query.isEmpty) return true;
      final bool byName = c.name.toLowerCase().contains(query.toLowerCase());
      final bool bySdt = needle.isNotEmpty && c.phone.contains(needle);
      return byName || bySdt;
    }).toList();

    final int p = page ?? 1;
    final int size = pageSize ?? 20;
    final int from = (p - 1) * size;
    final int to = from + size;
    return CustomerPage(
      items: matched.sublist(
        from.clamp(0, matched.length),
        to.clamp(0, matched.length),
      ),
      total: matched.length,
      page: p,
      pageSize: size,
    );
  }

  @override
  Future<Customer> get(String sdt) async {
    final String needle = _digits(sdt);
    for (final Customer c in _customers) {
      if (_digits(c.phone).endsWith(needle)) return c;
    }
    throw StateError('Không tìm thấy khách hàng: $sdt');
  }

  @override
  Future<Customer> create(CreateCustomerInput input) async {
    final Customer created = Customer(
      phone: input.phone,
      custType: input.custType.json ?? '',
      name: input.name,
      nationalId: input.nationalId,
      taxCode: input.taxCode,
      address: input.address,
      bankAccount: input.bankAccount,
      sourceId: input.sourceId,
      sourceNote: input.sourceNote,
      createdAt: _now,
      updatedAt: _now,
    );
    _customers = <Customer>[created, ..._customers];
    return created;
  }

  @override
  Future<List<CustomerSource>> listSources() async => sources;
}
