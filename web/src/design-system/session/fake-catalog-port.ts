// hand-authored — TEST/DEMO-ONLY fake port (Story 4.1, mirror Flutter
// mobile/lib/design_system/session/fake_catalog_port.dart).
//
// NOT a real backend: in-memory lists so the quote pickers are demoable and
// guardable WITHOUT an app-runtime or network. It enforces NO business rule —
// permission gates, `costs.view` stripping, price resolution all live on the
// server (AD-4). Prices here are demo constants, not computed.

import type {
  CatalogGroup,
  CatalogGroupDetail,
  CatalogGroupItem,
  CatalogPort,
  CatalogProduct,
} from './catalog-port';

/** Demo products — one priceEditable (installation fee), one inactive. */
export const DEMO_CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 'prod-pin-580',
    name: 'Tấm pin JA Solar 580W',
    sku: 'JAS-580-M10',
    unit: 'tấm',
    price: 2_450_000,
    priceEditable: false,
    warrantyMonths: 144,
    isActive: true,
  },
  {
    id: 'prod-inverter-8k',
    name: 'Inverter Hybrid 8kW',
    sku: 'INV-HYB-8K',
    unit: 'bộ',
    price: 28_500_000,
    priceEditable: false,
    warrantyMonths: 60,
    isActive: true,
  },
  {
    id: 'prod-phi-lap-dat',
    name: 'Phí lắp đặt',
    sku: 'SVC-INSTALL',
    unit: 'gói',
    price: 5_000_000,
    priceEditable: true,
    warrantyMonths: null,
    isActive: true,
  },
  {
    id: 'prod-pin-cu',
    name: 'Tấm pin đời cũ (ngừng bán)',
    sku: 'JAS-450-LEGACY',
    unit: 'tấm',
    price: 1_800_000,
    priceEditable: false,
    warrantyMonths: 120,
    isActive: false,
  },
];

/** Demo groups — one active with a checklist containing a deactivated item. */
export const DEMO_CATALOG_GROUPS: CatalogGroupDetail[] = [
  {
    id: 'grp-hybrid-8k',
    name: 'Gói Hybrid 8kW',
    description: 'Combo pin + inverter + công lắp cho hộ gia đình.',
    isActive: true,
    items: [
      {
        productId: 'prod-pin-580',
        name: 'Tấm pin JA Solar 580W',
        sku: 'JAS-580-M10',
        unit: 'tấm',
        price: 2_450_000,
        isActive: true,
        displayOrder: 0,
      },
      {
        productId: 'prod-inverter-8k',
        name: 'Inverter Hybrid 8kW',
        sku: 'INV-HYB-8K',
        unit: 'bộ',
        price: 28_500_000,
        isActive: true,
        displayOrder: 1,
      },
      {
        productId: 'prod-pin-cu',
        name: 'Tấm pin đời cũ (ngừng bán)',
        sku: 'JAS-450-LEGACY',
        unit: 'tấm',
        price: 1_800_000,
        isActive: false,
        displayOrder: 2,
      },
    ],
  },
];

/** A `CatalogPort` backed by in-memory lists — TEST/DEMO ONLY. */
export class FakeCatalogPort implements CatalogPort {
  constructor(
    private readonly products: CatalogProduct[] = DEMO_CATALOG_PRODUCTS,
    private readonly groups: CatalogGroupDetail[] = DEMO_CATALOG_GROUPS,
  ) {}

  listProducts(search?: string): Promise<CatalogProduct[]> {
    const q = search?.trim().toLowerCase() ?? '';
    const active = this.products.filter((p) => p.isActive);
    if (q === '') return Promise.resolve(active);
    return Promise.resolve(
      active.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      ),
    );
  }

  listGroups(): Promise<CatalogGroup[]> {
    return Promise.resolve(
      this.groups
        .filter((g) => g.isActive)
        .map(({ items: _items, ...group }) => group),
    );
  }

  getGroup(id: string): Promise<CatalogGroupDetail> {
    const found = this.groups.find((g) => g.id === id);
    if (found === undefined) {
      return Promise.reject(new Error(`Không tìm thấy gói vật tư: ${id}`));
    }
    // Checklist ordered by displayOrder — items keep the product's isActive flag.
    const items: CatalogGroupItem[] = [...found.items].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    return Promise.resolve({ ...found, items });
  }
}
