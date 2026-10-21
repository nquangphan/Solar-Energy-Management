// hand-authored — TEST/DEMO-ONLY fake port (Story 6.2, mirror Flutter
// mobile/lib/design_system/session/fake_inventory_port.dart).
//
// NOT a real backend: an in-memory answer so the Tồn kho screen is demoable and
// guardable without an app-runtime. Every derived number below was PRINTED by
// running the backend's `tinhTonKho` on the (onHand, reserved) pair — never
// typed by hand — so this fake owns no second copy of the availability rule.
// The `q` match is a demo convenience over precomputed rows, not a computation.

import type { InventoryPort, StockList, StockListQuery } from './inventory-port';

/** All three states + the LONGEST product name, so layouts are exercised. */
export const DEMO_STOCK_LIST: StockList = {
  items: [
    {
      productId: 'prod-battery-10kwh',
      ten: 'Battery LiFePO4 10kWh',
      sku: 'BAT-10K',
      donVi: 'bình',
      onHand: 0,
      reserved: 2,
      khaDung: -2,
      canNhap: 2,
      tinhTrang: 'am',
    },
    {
      productId: 'prod-day-dc-4',
      ten: 'Dây DC 4mm² (cuộn 100m)',
      sku: 'DC-4-100',
      donVi: 'cuộn',
      onHand: 11,
      reserved: 2,
      khaDung: 9,
      canNhap: 0,
      tinhTrang: 'du',
    },
    {
      productId: 'prod-inverter-hybrid-10k',
      ten: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
      sku: 'INV-ASW10K-H',
      donVi: 'bộ',
      onHand: 5,
      reserved: 20,
      khaDung: -15,
      canNhap: 15,
      tinhTrang: 'am',
    },
    {
      productId: 'prod-inverter-8k',
      ten: 'Inverter Solplanet ASW8000-S',
      sku: 'INV-ASW8000',
      donVi: 'bộ',
      onHand: 3,
      reserved: 3,
      khaDung: 0,
      canNhap: 0,
      tinhTrang: 'het',
    },
    {
      productId: 'prod-pin-ae-630',
      ten: 'Tấm pin AE 630W',
      sku: 'PIN-AE-630',
      donVi: 'tấm',
      onHand: 42,
      reserved: 14,
      khaDung: 28,
      canNhap: 0,
      tinhTrang: 'du',
    },
  ],
  danhSachCanMua: [
    {
      productId: 'prod-inverter-hybrid-10k',
      ten: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
      donVi: 'bộ',
      canNhap: 15,
    },
    { productId: 'prod-battery-10kwh', ten: 'Battery LiFePO4 10kWh', donVi: 'bình', canNhap: 2 },
  ],
};

export class FakeInventoryPort implements InventoryPort {
  constructor(private readonly data: StockList = DEMO_STOCK_LIST) {}

  listStock(query: StockListQuery = {}): Promise<StockList> {
    const needle = (query.q ?? '').trim().toLowerCase();
    if (needle === '') return Promise.resolve(this.data);
    const khop = (ten: string, sku = ''): boolean =>
      ten.toLowerCase().includes(needle) || sku.toLowerCase().includes(needle);
    const items = this.data.items.filter((i) => khop(i.ten, i.sku));
    const ids = new Set(items.map((i) => i.productId));
    return Promise.resolve({
      items,
      danhSachCanMua: this.data.danhSachCanMua.filter((c) => ids.has(c.productId)),
    });
  }
}
