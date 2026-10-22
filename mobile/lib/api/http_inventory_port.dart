// hand-authored — the real InventoryPort over the generated client (Story 10.8,
// mirror web/src/api/http-inventory-port.ts).
//
// The Tồn kho screen shows one message for any failure, so an ApiError passes
// through as is — there is no inventory-specific error type to convert to.
import '../design_system/session/inventory_port.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpInventoryPort implements InventoryPort {
  HttpInventoryPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  @override
  Future<StockList> listStock({String? q}) => _transport.call(() => _client.inventory.stockItemsControllerList(q: q));
}
