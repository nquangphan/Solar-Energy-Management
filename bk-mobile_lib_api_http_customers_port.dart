// hand-authored — the real CustomersPort over the generated client (Story 10.7,
// mirror web/src/api/http-customers-port.ts).
//
// The phone goes out exactly as the user typed it: the backend is the only
// normaliser (AD-9). The generated client puts `{phone}` into the path as is,
// so `get` escapes it here: an E.164 `+` reaches the server as `%2B`, and a `/`
// typed by mistake stays inside one path segment.
//
// The screens read a backend rejection off CustomerPortException, so every
// ApiError is converted in [_call] — the one place, not per method.
import '../design_system/session/customers_port.dart';
import 'api_error.dart';
import 'generated/models/cust_type.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpCustomersPort implements CustomersPort {
  HttpCustomersPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await _transport.call(request);
    } on ApiError catch (e) {
      throw CustomerPortException(e.message, fieldErrors: fieldErrorMap(e));
    }
  }

  @override
  Future<CustomerLookup> lookup(String sdt) => _call(() => _client.customers.customersControllerLookup(phone: sdt));

  @override
  Future<CustomerPage> list({String? q, String? custType, int? page, int? pageSize}) => _call(
    () => _client.customers.customersControllerList(
      q: q,
      custType: custType == null ? null : CustType.fromJson(custType),
      page: page,
      pageSize: pageSize,
    ),
  );

  @override
  Future<Customer> get(String sdt) =>
      _call(() => _client.customers.customersControllerFindOne(phone: Uri.encodeComponent(sdt)));

  @override
  Future<Customer> create(CreateCustomerInput input) =>
      _call(() => _client.customers.customersControllerCreate(body: input));

  @override
  Future<List<CustomerSource>> listSources() =>
      // Switched-off sources too: detail and lookup resolve a customer's `sourceId` against this
      // list, and a source turned off later must still show its name. The create select filters.
      _call(() => _client.customers.customerSourcesControllerFindAll(includeInactive: true));
}
