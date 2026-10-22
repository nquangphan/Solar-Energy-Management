// hand-authored — the real CatalogPort over the generated client (Story 10.7,
// mirror web/src/api/http-catalog-port.ts).
//
// Every result is built field by field: `ProductResponseDto` carries `costPrice`
// for callers with `costs.view`, and the picker state must never hold it.
import '../design_system/session/catalog_port.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpCatalogPort implements CatalogPort {
  HttpCatalogPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  @override
  Future<List<CatalogProduct>> listProducts({String? search}) async {
    final data = await _transport.call(() => _client.catalog.productsControllerFindAll());
    final products = [
      for (final p in data)
        CatalogProduct(
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          price: p.price.toInt(),
          priceEditable: p.priceEditable,
          warrantyMonths: p.warrantyMonths?.toInt(),
          isActive: p.isActive,
        ),
    ];
    // `GET /products` has no search parameter: narrow the returned list for display,
    // the same name/SKU match the fake port does. A catalogue of a few hundred rows.
    final needle = search?.trim().toLowerCase() ?? '';
    if (needle.isEmpty) return products;
    return products
        .where((p) => p.name.toLowerCase().contains(needle) || p.sku.toLowerCase().contains(needle))
        .toList();
  }

  @override
  Future<List<CatalogGroup>> listGroups() async {
    final data = await _transport.call(() => _client.catalog.productGroupsControllerFindAll());
    return [
      for (final g in data) CatalogGroup(id: g.id, name: g.name, description: g.description, isActive: g.isActive),
    ];
  }

  @override
  Future<CatalogGroupDetail> getGroup(String id) async {
    final data = await _transport.call(() => _client.catalog.productGroupsControllerFindOne(id: id));
    return CatalogGroupDetail(
      id: data.id,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      items: data.items,
    );
  }
}
