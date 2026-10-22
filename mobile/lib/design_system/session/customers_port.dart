// hand-authored — mobile customers port (Story 3.4, mirror web
// web/src/design-system/session/customers-port.ts). The seam between the three
// customer screens and the `/customers` + `/customer-sources` endpoints.
//
// THE CLIENT NEVER NORMALISES A PHONE NUMBER (AD-9). Every phone that crosses
// this port OUTBOUND is the RAW string the user typed (`0903 176 968`,
// `+84903176968`); the backend owns the single normaliser and returns the E.164
// key. A second normaliser here — even a "harmless" regex — is a second chance to
// disagree, and disagreement means two records for one person.
//
// The backend enforces every rule behind these calls (AD-4): permission, phone
// validity, duplicate blocking, the source/`sourceNote` rule. Nothing here is a
// security boundary.

import '../../api/generated/models/create_customer_request_dto.dart';
import '../../api/generated/models/customer_list_response_dto.dart';
import '../../api/generated/models/customer_lookup_response_dto.dart';
import '../../api/generated/models/customer_response_dto.dart';
import '../../api/generated/models/customer_source_response_dto.dart';

export '../../api/generated/models/create_customer_request_dto_cust_type.dart';

/// The backend `CustomerResponseDto` (generated, Story 10.7). [Customer.phone] is
/// ALWAYS the normalised E.164 key.
typedef Customer = CustomerResponseDto;

/// The backend `CustomerSourceResponseDto`. `active == false` is a source switched
/// off later: details still resolve its name, the create select leaves it out.
typedef CustomerSource = CustomerSourceResponseDto;

/// `CustomerLookupResponseDto`. `found == false` is a NORMAL 200 result, not an
/// error — it is the half of the feature that opens "Tạo khách hàng mới".
/// `phone` carries the normalised key back even when nothing was found.
typedef CustomerLookup = CustomerLookupResponseDto;

/// `CustomerListResponseDto`. `total` counts the WHOLE filtered set, not this page.
typedef CustomerPage = CustomerListResponseDto;

/// Body of `POST /customers` — the generated `CreateCustomerRequestDto`.
typedef CreateCustomerInput = CreateCustomerRequestDto;

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
/// The real implementation is `HttpCustomersPort` (lib/api/http_customers_port.dart),
/// which turns the AD-5 envelope into a [CustomerPortException]; [FakeCustomersPort]
/// drives tests and demos.
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
