// hand-authored — mobile customers port (Story 3.4, mirror web
// web/src/design-system/session/customers-port.ts). The seam between the three
// customer screens and the `/customers` + `/customer-sources` endpoints.
//
// THE CLIENT NEVER NORMALISES A PHONE NUMBER (AD-9). Every `sdt` that crosses
// this port OUTBOUND is the RAW string the user typed (`0903 176 968`,
// `+84903176968`); the backend owns the single normaliser and returns the E.164
// key. A second normaliser here — even a "harmless" regex — is a second chance to
// disagree, and disagreement means two records for one person.
//
// The backend enforces every rule behind these calls (AD-4): permission, phone
// validity, duplicate blocking, the source/`sourceNote` rule. Nothing here is a
// security boundary.

/// Mirrors the backend `CustomerResponseDto`. [sdt] is ALWAYS the normalised E.164 key.
class Customer {
  const Customer({
    required this.sdt,
    required this.custType,
    required this.name,
    this.cccd,
    this.taxCode,
    this.address,
    this.bankAccount,
    required this.sourceId,
    this.sourceNote,
    required this.createdAt,
    required this.updatedAt,
  });

  final String sdt;
  final String custType;
  final String name;
  final String? cccd;
  final String? taxCode;
  final String? address;
  final String? bankAccount;
  final String sourceId;
  final String? sourceNote;
  final String createdAt;
  final String updatedAt;
}

/// Mirrors the backend `CustomerSourceResponseDto`.
class CustomerSource {
  const CustomerSource({
    required this.id,
    required this.name,
    this.description,
    required this.isOther,
    required this.sortOrder,
  });

  final String id;
  final String name;
  final String? description;
  final bool isOther;
  final int sortOrder;
}

/// Mirrors `CustomerLookupResponseDto`. [found] == false is a NORMAL 200 result,
/// not an error — it is the half of the feature that opens "Tạo khách hàng mới".
/// [sdt] carries the normalised key back even when nothing was found.
class CustomerLookup {
  const CustomerLookup({
    required this.found,
    required this.sdt,
    this.customer,
  });

  final bool found;
  final String sdt;
  final Customer? customer;
}

/// Mirrors `CustomerListResponseDto`. [total] counts the WHOLE filtered set, not this page.
class CustomerPage {
  const CustomerPage({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  final List<Customer> items;
  final int total;
  final int page;
  final int pageSize;
}

/// Body of `POST /customers`. Contract owned by Story 3.3 — unchanged here.
class CreateCustomerInput {
  const CreateCustomerInput({
    required this.sdt,
    required this.custType,
    required this.name,
    this.cccd,
    this.taxCode,
    this.address,
    this.bankAccount,
    required this.sourceId,
    this.sourceNote,
  });

  final String sdt;
  final String custType;
  final String name;
  final String? cccd;
  final String? taxCode;
  final String? address;
  final String? bankAccount;
  final String sourceId;
  final String? sourceNote;
}

/// The AD-5 error envelope, raised by a [CustomersPort] when the backend rejects a
/// call (400 validation, 409 duplicate phone).
///
/// The screen renders [message] VERBATIM. The client owns no rule about what a valid
/// phone is (AD-9), so it owns no words for one either: a message invented here is a
/// SECOND opinion on screen, and it goes stale the moment the backend's rules move.
/// [fieldErrors] maps `field` → `message` so each one lands on the input it names.
class CustomerPortException implements Exception {
  const CustomerPortException(this.message, {this.fieldErrors = const {}});

  /// The backend's `message`, shown to the user as-is.
  final String message;

  /// `field` → `message`, flattened from the envelope's `fieldErrors[]`.
  final Map<String, String> fieldErrors;

  @override
  String toString() => 'CustomerPortException: $message';
}

/// Injectable transport for the customer screens. This is a PORT, NOT an HTTP
/// client — the seam that lets the screens exist before the app owns
/// networking/navigation/a token store.
///
/// There is deliberately NO order data on this port (no `orderCount`, no
/// `orders`): `Order` does not exist until Story 4.1, and a UI cannot honestly
/// render a number no table can back.
///
/// TODO(app-runtime/login-network): the real implementation attaches
/// `Authorization: Bearer <accessToken>` (Story 2.3) and parses the AD-5 error
/// envelope into the screens' banner + field errors. Until then [FakeCustomersPort]
/// drives the guards/demo.
abstract class CustomersPort {
  /// Look a customer up by RAW phone. Throws only on an invalid phone (400) — not on "not found".
  Future<CustomerLookup> lookup(String sdt);

  /// Page through customers, filtered by [q] / [custType].
  Future<CustomerPage> list(
      {String? q, String? custType, int? page, int? pageSize});

  /// Read one customer by RAW or E.164 phone. Throws NOT_FOUND if absent.
  Future<Customer> get(String sdt);

  /// Create a customer. Throws on 400 (validation) / 409 (phone already taken).
  Future<Customer> create(CreateCustomerInput input);

  /// The customer-source catalogue that fills the `Nguồn khách` select.
  Future<List<CustomerSource>> listSources();
}
