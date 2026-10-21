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
      ten: 'Battery LiFePO4 10kWh',
      sku: 'BAT-10K',
      donVi: 'bình',
      onHand: 0,
      reserved: 2,
      khaDung: -2,
      canNhap: 2,
      tinhTrang: 'am',
    ),
    StockItemView(
      productId: 'prod-day-dc-4',
      ten: 'Dây DC 4mm² (cuộn 100m)',
      sku: 'DC-4-100',
      donVi: 'cuộn',
      onHand: 11,
      reserved: 2,
      khaDung: 9,
      canNhap: 0,
      tinhTrang: 'du',
    ),
    StockItemView(
      productId: 'prod-inverter-hybrid-10k',
      ten: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
      sku: 'INV-ASW10K-H',
      donVi: 'bộ',
      onHand: 5,
      reserved: 20,
      khaDung: -15,
      canNhap: 15,
      tinhTrang: 'am',
    ),
    StockItemView(
      productId: 'prod-inverter-8k',
      ten: 'Inverter Solplanet ASW8000-S',
      sku: 'INV-ASW8000',
      donVi: 'bộ',
      onHand: 3,
      reserved: 3,
      khaDung: 0,
      canNhap: 0,
      tinhTrang: 'het',
    ),
    StockItemView(
      productId: 'prod-pin-ae-630',
      ten: 'Tấm pin AE 630W',
      sku: 'PIN-AE-630',
      donVi: 'tấm',
      onHand: 42,
      reserved: 14,
      khaDung: 28,
      canNhap: 0,
      tinhTrang: 'du',
    ),
  ],
  danhSachCanMua: <CanMuaView>[
    CanMuaView(
      productId: 'prod-inverter-hybrid-10k',
      ten: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
      donVi: 'bộ',
      canNhap: 15,
    ),
    CanMuaView(
      productId: 'prod-battery-10kwh',
      ten: 'Battery LiFePO4 10kWh',
      donVi: 'bình',
      canNhap: 2,
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
              i.ten.toLowerCase().contains(needle) ||
              i.sku.toLowerCase().contains(needle),
        )
        .toList();
    final Set<String> ids = items.map((StockItemView i) => i.productId).toSet();
    return StockList(
      items: items,
      danhSachCanMua: data.danhSachCanMua
          .where((CanMuaView c) => ids.contains(c.productId))
          .toList(),
    );
  }
}
