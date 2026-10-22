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
      name: 'Battery LiFePO4 10kWh',
      sku: 'BAT-10K',
      unit: 'bình',
      onHand: 0,
      reserved: 2,
      available: -2,
      toPurchase: 2,
      stockStatus: 'am',
    },
    {
      productId: 'prod-day-dc-4',
      name: 'Dây DC 4mm² (cuộn 100m)',
      sku: 'DC-4-100',
      unit: 'cuộn',
      onHand: 11,
      reserved: 2,
      available: 9,
      toPurchase: 0,
      stockStatus: 'du',
    },
    {
      productId: 'prod-inverter-hybrid-10k',
      name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
      sku: 'INV-ASW10K-H',
      unit: 'bộ',
      onHand: 5,
      reserved: 20,
      available: -15,
      toPurchase: 15,
      stockStatus: 'am',
    },
    {
      productId: 'prod-inverter-8k',
      name: 'Inverter Solplanet ASW8000-S',
      sku: 'INV-ASW8000',
      unit: 'bộ',
      onHand: 3,
      reserved: 3,
      available: 0,
      toPurchase: 0,
      stockStatus: 'het',
    },
    {
      productId: 'prod-pin-ae-630',
      name: 'Tấm pin AE 630W',
      sku: 'PIN-AE-630',
      unit: 'tấm',
      onHand: 42,
      reserved: 14,
      available: 28,
      toPurchase: 0,
      stockStatus: 'du',
    },
  ],
  purchaseList: [
    {
      productId: 'prod-inverter-hybrid-10k',
      name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
      unit: 'bộ',
      toPurchase: 15,
    },
    { productId: 'prod-battery-10kwh', name: 'Battery LiFePO4 10kWh', unit: 'bình', toPurchase: 2 },
  ],
};

export class FakeInventoryPort implements InventoryPort {
  constructor(private readonly data: StockList = DEMO_STOCK_LIST) {}

  listStock(query: StockListQuery = {}): Promise<StockList> {
    const needle = (query.q ?? '').trim().toLowerCase();
    if (needle === '') return Promise.resolve(this.data);
    const khop = (name: string, sku = ''): boolean =>
      name.toLowerCase().includes(needle) || sku.toLowerCase().includes(needle);
    const items = this.data.items.filter((i) => khop(i.name, i.sku));
    const ids = new Set(items.map((i) => i.productId));
    return Promise.resolve({
      items,
      purchaseList: this.data.purchaseList.filter((c) => ids.has(c.productId)),
    });
  }
}
