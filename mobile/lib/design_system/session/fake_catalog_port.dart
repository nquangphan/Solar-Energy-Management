// hand-authored — TEST/DEMO-ONLY fake port (Story 4.1, mirror web
// web/src/design-system/session/fake-catalog-port.ts).
//
// NOT a real backend: in-memory lists so the quote pickers are demoable and
// guardable WITHOUT an app-runtime or network. It enforces NO business rule —
// permission gates, `costs.view` stripping, price resolution all live on the
// server (AD-4). Prices here are demo constants, not computed.

import 'catalog_port.dart';

/// Demo products — one priceEditable (installation fee), one inactive.
const List<CatalogProduct> kDemoCatalogProducts = [
  CatalogProduct(
    id: 'prod-pin-580',
    name: 'Tấm pin JA Solar 580W',
    sku: 'JAS-580-M10',
    unit: 'tấm',
    price: 2450000,
    priceEditable: false,
    warrantyMonths: 144,
    isActive: true,
  ),
  CatalogProduct(
    id: 'prod-inverter-8k',
    name: 'Inverter Hybrid 8kW',
    sku: 'INV-HYB-8K',
    unit: 'bộ',
    price: 28500000,
    priceEditable: false,
    warrantyMonths: 60,
    isActive: true,
  ),
  CatalogProduct(
    id: 'prod-phi-lap-dat',
    name: 'Phí lắp đặt',
    sku: 'SVC-INSTALL',
    unit: 'gói',
    price: 5000000,
    priceEditable: true,
    isActive: true,
  ),
  CatalogProduct(
    id: 'prod-pin-cu',
    name: 'Tấm pin đời cũ (ngừng bán)',
    sku: 'JAS-450-LEGACY',
    unit: 'tấm',
    price: 1800000,
    priceEditable: false,
    warrantyMonths: 120,
    isActive: false,
  ),
];

/// Demo groups — one active with a checklist containing a deactivated item.
const List<CatalogGroupDetail> kDemoCatalogGroups = [
  CatalogGroupDetail(
    id: 'grp-hybrid-8k',
    name: 'Gói Hybrid 8kW',
    description: 'Combo pin + inverter + công lắp cho hộ gia đình.',
    isActive: true,
    items: [
      CatalogGroupItem(
        productId: 'prod-pin-580',
        name: 'Tấm pin JA Solar 580W',
        sku: 'JAS-580-M10',
        unit: 'tấm',
        price: 2450000,
        isActive: true,
        displayOrder: 0,
      ),
      CatalogGroupItem(
        productId: 'prod-inverter-8k',
        name: 'Inverter Hybrid 8kW',
        sku: 'INV-HYB-8K',
        unit: 'bộ',
        price: 28500000,
        isActive: true,
        displayOrder: 1,
      ),
      CatalogGroupItem(
        productId: 'prod-pin-cu',
        name: 'Tấm pin đời cũ (ngừng bán)',
        sku: 'JAS-450-LEGACY',
        unit: 'tấm',
        price: 1800000,
        isActive: false,
        displayOrder: 2,
      ),
    ],
  ),
];

/// A [CatalogPort] backed by in-memory lists — TEST/DEMO ONLY.
class FakeCatalogPort implements CatalogPort {
  FakeCatalogPort({
    this.products = kDemoCatalogProducts,
    this.groups = kDemoCatalogGroups,
  });

  final List<CatalogProduct> products;
  final List<CatalogGroupDetail> groups;

  @override
  Future<List<CatalogProduct>> listProducts({String? search}) async {
    final String q = search?.trim().toLowerCase() ?? '';
    final Iterable<CatalogProduct> active =
        products.where((CatalogProduct p) => p.isActive);
    if (q.isEmpty) return active.toList();
    return active
        .where((CatalogProduct p) =>
            p.name.toLowerCase().contains(q) || p.sku.toLowerCase().contains(q))
        .toList();
  }

  @override
  Future<List<CatalogGroup>> listGroups() async {
    return groups
        .where((CatalogGroupDetail g) => g.isActive)
        .map((CatalogGroupDetail g) => CatalogGroup(
              id: g.id,
              name: g.name,
              description: g.description,
              isActive: g.isActive,
            ))
        .toList();
  }

  @override
  Future<CatalogGroupDetail> getGroup(String id) async {
    for (final CatalogGroupDetail g in groups) {
      if (g.id == id) {
        // Checklist ordered by displayOrder — items keep the product's isActive.
        final List<CatalogGroupItem> items = List<CatalogGroupItem>.of(g.items)
          ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
        return CatalogGroupDetail(
          id: g.id,
          name: g.name,
          description: g.description,
          isActive: g.isActive,
          items: items,
        );
      }
    }
    throw Exception('Không tìm thấy gói vật tư: $id');
  }
}
