// hand-authored — TEST/DEMO-ONLY fake port (Story 6.3, mirror Flutter
// mobile/lib/design_system/session/fake_stock_vouchers_port.dart).
//
// NOT a real backend: canned vouchers so the Phiếu kho screen is demoable and
// guardable without an app-runtime. Codes, counts and costs below are typed as
// the backend would return them — this fake owns no copy of the cost or stock
// rules. Its one refusal (409 INSUFFICIENT_STOCK) is a fixed branch on a fixed
// product, not a stock comparison.

import { DEMO_STOCK_LIST } from './fake-inventory-port';
import type {
  CreateStockVoucherInput,
  StockVoucherDetail,
  StockVoucherList,
  StockVoucherListQuery,
  StockVoucherPortError,
  StockVouchersPort,
  StockVoucherSummary,
} from './stock-vouchers-port';

const KHO = { id: 'acc-kho-binh', displayName: 'Kho/Giao hàng (Bình)' };

/** Stock-in with costs, stock-out WITHOUT costs (caller lacks `costs.view`), and the LONGEST product name. */
export const DEMO_STOCK_VOUCHERS: StockVoucherDetail[] = [
  {
    id: 'pk-n-0119',
    ma: 'PK-N-0119',
    type: 'nhap',
    createdAt: '2026-07-06T01:05:00.000Z',
    nguoiTao: KHO,
    soDong: 2,
    tongSoLuong: 50,
    note: 'Nhập từ nhà cung cấp',
    lines: [
      {
        productId: 'prod-day-dc-4',
        ten: 'Dây DC 4mm² (cuộn 100m)',
        sku: 'DC-4-100',
        donVi: 'cuộn',
        qty: 10,
        unitCost: 1_480_000,
      },
      {
        productId: 'prod-pin-ae-630',
        ten: 'Tấm pin AE 630W',
        sku: 'PIN-AE-630',
        donVi: 'tấm',
        qty: 40,
        unitCost: 2_110_000,
      },
    ],
  },
  {
    id: 'pk-x-0096',
    ma: 'PK-X-0096',
    type: 'xuat',
    createdAt: '2026-07-05T23:30:00.000Z',
    nguoiTao: KHO,
    soDong: 2,
    tongSoLuong: 15,
    note: 'Hàng mẫu cho khách',
    lines: [
      {
        productId: 'prod-inverter-8k',
        ten: 'Inverter Solplanet ASW8000-S',
        sku: 'INV-ASW8000',
        donVi: 'bộ',
        qty: 1,
      },
      {
        productId: 'prod-pin-ae-630',
        ten: 'Tấm pin AE 630W',
        sku: 'PIN-AE-630',
        donVi: 'tấm',
        qty: 14,
      },
    ],
  },
  {
    id: 'pk-n-0118',
    ma: 'PK-N-0118',
    type: 'nhap',
    createdAt: '2026-07-02T02:00:00.000Z',
    nguoiTao: KHO,
    soDong: 1,
    tongSoLuong: 5,
    note: 'Tồn đầu kỳ',
    lines: [
      {
        productId: 'prod-inverter-hybrid-10k',
        ten: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
        sku: 'INV-ASW10K-H',
        donVi: 'bộ',
        qty: 5,
        unitCost: 18_500_000,
      },
    ],
  },
];

/** The fake refuses any stock-out of this product (it has nothing on hand in the demo stock list). */
export const FAKE_OUT_OF_STOCK_PRODUCT_ID = 'prod-battery-10kwh';

export const FAKE_INSUFFICIENT_STOCK_ERROR: StockVoucherPortError = {
  message: 'Không đủ tồn — không thể xuất quá số tồn hiện có.',
  fieldErrors: [
    {
      field: 'lines.0.qty',
      code: 'INSUFFICIENT_STOCK',
      message: 'Còn 0 bình, không xuất được 1.',
    },
  ],
};

function tomTat(d: StockVoucherDetail): StockVoucherSummary {
  const { id, ma, type, createdAt, nguoiTao, soDong, tongSoLuong } = d;
  return { id, ma, type, createdAt, nguoiTao, soDong, tongSoLuong };
}

export class FakeStockVouchersPort implements StockVouchersPort {
  private readonly data: StockVoucherDetail[];

  constructor(data: StockVoucherDetail[] = DEMO_STOCK_VOUCHERS) {
    this.data = [...data];
  }

  listVouchers(query: StockVoucherListQuery = {}): Promise<StockVoucherList> {
    const items = this.data.filter((d) => query.type === undefined || d.type === query.type);
    return Promise.resolve({ items: items.map(tomTat) });
  }

  getVoucher(id: string): Promise<StockVoucherDetail> {
    const found = this.data.find((d) => d.id === id);
    if (found === undefined) {
      const err: StockVoucherPortError = { message: 'Không tìm thấy phiếu kho.' };
      return Promise.reject(err);
    }
    return Promise.resolve(found);
  }

  createVoucher(input: CreateStockVoucherInput): Promise<StockVoucherDetail> {
    if (
      input.type === 'xuat' &&
      input.lines.some((l) => l.productId === FAKE_OUT_OF_STOCK_PRODUCT_ID)
    ) {
      return Promise.reject(FAKE_INSUFFICIENT_STOCK_ERROR);
    }
    // A canned answer shaped like the backend's — the demo screen needs a row to select.
    const moi: StockVoucherDetail = {
      id: `pk-demo-${this.data.length + 1}`,
      ma: input.type === 'nhap' ? 'PK-N-0120' : 'PK-X-0097',
      type: input.type,
      createdAt: '2026-10-21T03:15:00.000Z',
      nguoiTao: KHO,
      soDong: input.lines.length,
      tongSoLuong: input.lines.reduce((tong, l) => tong + l.qty, 0),
      note: input.note ?? null,
      lines: input.lines.map((l) => {
        const sp = DEMO_STOCK_LIST.items.find((i) => i.productId === l.productId);
        return {
          productId: l.productId,
          ten: sp?.ten ?? l.productId,
          sku: sp?.sku ?? '',
          donVi: sp?.donVi ?? '',
          qty: l.qty,
          ...(l.unitCost === undefined ? {} : { unitCost: l.unitCost }),
        };
      }),
    };
    this.data.unshift(moi);
    return Promise.resolve(moi);
  }
}
