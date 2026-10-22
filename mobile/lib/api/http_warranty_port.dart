// hand-authored — the real WarrantyPort over the generated client (Story 10.7,
// mirror web/src/api/http-warranty-port.ts).
//
// The phone goes out raw (AD-9); `found: false` is an ordinary 200 answer. A
// rejection reaches the screen as WarrantyPortException with the backend's words.
import '../design_system/session/warranty_port.dart';
import 'api_error.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpWarrantyPort implements WarrantyPort {
  HttpWarrantyPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  @override
  Future<WarrantyLookup> lookup(String sdt) async {
    try {
      return await _transport.call(() => _client.orders.ordersControllerWarrantyLookup(phone: sdt));
    } on ApiError catch (e) {
      throw WarrantyPortException(e.message, fieldErrors: fieldErrorMap(e));
    }
  }
}
