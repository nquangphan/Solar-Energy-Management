// hand-authored — TEST/DEMO-ONLY fake port (Story 6.2, mirror web
// web/src/design-system/session/fake-inventory-port.ts).
//
// NOT a real backend: an in-memory answer so the Tồn kho screen is demoable and
// guardable without an app-runtime. Every derived number below was PRINTED by
// running the backend's `tinhTonKho` on the (onHand, reserved) pair — never
// typed by hand — so this fake owns no second copy of the availability rule.
// The `q` match is a demo convenience over precomputed rows, not a computation.

import 'inventory_port.dart';

/// All three states + the LONGEST product name, so layouts are exercised.
const StockList kDemoStockList = StockList(
  items: <StockItemView>[
    StockItemView(
      productId: 'prod-battery-10kwh',
      name: 'Battery LiFePO4 10kWh',
      sku: 'BAT-10K',
      unit: 'bình',
      onHand: 0,
      reserved: 2,
      available: -2,
      toPurchase: 2,
      stockStatus: StockItemViewDtoStockStatus.am,
    ),
    StockItemView(
      productId: 'prod-day-dc-4',
      name: 'Dây DC 4mm² (cuộn 100m)',
      sku: 'DC-4-100',
      unit: 'cuộn',
      onHand: 11,
      reserved: 2,
      available: 9,
      toPurchase: 0,
      stockStatus: StockItemViewDtoStockStatus.du,
    ),
    StockItemView(
      productId: 'prod-inverter-hybrid-10k',
      name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
      sku: 'INV-ASW10K-H',
      unit: 'bộ',
      onHand: 5,
      reserved: 20,
      available: -15,
      toPurchase: 15,
      stockStatus: StockItemViewDtoStockStatus.am,
    ),
    StockItemView(
      productId: 'prod-inverter-8k',
      name: 'Inverter Solplanet ASW8000-S',
      sku: 'INV-ASW8000',
      unit: 'bộ',
      onHand: 3,
      reserved: 3,
      available: 0,
      toPurchase: 0,
      stockStatus: StockItemViewDtoStockStatus.het,
    ),
    StockItemView(
      productId: 'prod-pin-ae-630',
      name: 'Tấm pin AE 630W',
      sku: 'PIN-AE-630',
      unit: 'tấm',
      onHand: 42,
      reserved: 14,
      available: 28,
      toPurchase: 0,
      stockStatus: StockItemViewDtoStockStatus.du,
    ),
  ],
  purchaseList: <PurchaseNeedView>[
    PurchaseNeedView(
      productId: 'prod-inverter-hybrid-10k',
      name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
      unit: 'bộ',
      toPurchase: 15,
    ),
    PurchaseNeedView(
      productId: 'prod-battery-10kwh',
      name: 'Battery LiFePO4 10kWh',
      unit: 'bình',
      toPurchase: 2,
    ),
  ],
);

class FakeInventoryPort implements InventoryPort {
  const FakeInventoryPort([this.data = kDemoStockList]);

  final StockList data;

  @override
  Future<StockList> listStock({String? q}) async {
    final String needle = (q ?? '').trim().toLowerCase();
    if (needle.isEmpty) return data;
    final List<StockItemView> items = data.items
        .where(
          (StockItemView i) =>
              i.name.toLowerCase().contains(needle) ||
              i.sku.toLowerCase().contains(needle),
        )
        .toList();
    final Set<String> ids = items.map((StockItemView i) => i.productId).toSet();
    return StockList(
      items: items,
      purchaseList: data.purchaseList
          .where((PurchaseNeedView c) => ids.contains(c.productId))
          .toList(),
    );
  }
}
