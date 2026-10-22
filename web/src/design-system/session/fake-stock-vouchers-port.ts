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
  CreateReturnVoucherInput,
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
    code: 'PK-N-0119',
    type: 'nhap',
    createdAt: '2026-07-06T01:05:00.000Z',
    createdBy: KHO,
    lineCount: 2,
    totalQty: 50,
    canReturn: false,
    note: 'Nhập từ nhà cung cấp',
    lines: [
      {
        productId: 'prod-day-dc-4',
        name: 'Dây DC 4mm² (cuộn 100m)',
        sku: 'DC-4-100',
        unit: 'cuộn',
        qty: 10,
        unitCost: 1_480_000,
      },
      {
        productId: 'prod-pin-ae-630',
        name: 'Tấm pin AE 630W',
        sku: 'PIN-AE-630',
        unit: 'tấm',
        qty: 40,
        unitCost: 2_110_000,
      },
    ],
  },
  {
    id: 'pk-x-0096',
    code: 'PK-X-0096',
    type: 'xuat',
    createdAt: '2026-07-05T23:30:00.000Z',
    createdBy: KHO,
    lineCount: 2,
    totalQty: 15,
    canReturn: false,
    note: 'Hàng mẫu cho khách',
    lines: [
      {
        productId: 'prod-inverter-8k',
        name: 'Inverter Solplanet ASW8000-S',
        sku: 'INV-ASW8000',
        unit: 'bộ',
        qty: 1,
      },
      {
        productId: 'prod-pin-ae-630',
        name: 'Tấm pin AE 630W',
        sku: 'PIN-AE-630',
        unit: 'tấm',
        qty: 14,
      },
    ],
  },
  {
    // Order-bound stock-out — `createdBy` is the person who CONFIRMED it.
    id: 'pk-x-0095',
    code: 'PK-X-0095',
    type: 'xuat',
    orderId: 'ord-demo-4',
    createdAt: '2026-07-04T02:30:00.000Z',
    createdBy: KHO,
    lineCount: 1,
    totalQty: 1,
    canReturn: true,
    note: null,
    lines: [
      {
        productId: 'prod-inverter-hybrid-10k',
        name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
        sku: 'INV-ASW10K-H',
        unit: 'bộ',
        qty: 1,
      },
    ],
  },
  {
    id: 'pk-n-0118',
    code: 'PK-N-0118',
    type: 'nhap',
    createdAt: '2026-07-02T02:00:00.000Z',
    createdBy: KHO,
    lineCount: 1,
    totalQty: 5,
    canReturn: false,
    note: 'Tồn đầu kỳ',
    lines: [
      {
        productId: 'prod-inverter-hybrid-10k',
        name: 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha',
        sku: 'INV-ASW10K-H',
        unit: 'bộ',
        qty: 5,
        unitCost: 18_500_000,
      },
    ],
  },
  {
    // Order-bound stock-out of a cancelled order that already has its return voucher.
    id: 'pk-x-0090',
    code: 'PK-X-0090',
    type: 'xuat',
    orderId: 'ord-demo-cancelled',
    createdAt: '2026-07-01T02:30:00.000Z',
    createdBy: KHO,
    lineCount: 1,
    totalQty: 4,
    canReturn: false,
    returnVoucher: { id: 'pk-nt-0004', code: 'PK-NT-0004' },
    note: null,
    lines: [
      {
        productId: 'prod-pin-ae-630',
        name: 'Tấm pin AE 630W',
        sku: 'PIN-AE-630',
        unit: 'tấm',
        qty: 4,
      },
    ],
  },
  {
    // Return voucher: type 'nhap', no top-level orderId.
    id: 'pk-nt-0004',
    code: 'PK-NT-0004',
    type: 'nhap',
    returnOfVoucherId: 'pk-x-0090',
    createdAt: '2026-07-03T02:00:00.000Z',
    createdBy: KHO,
    lineCount: 1,
    totalQty: 3,
    canReturn: false,
    returnOf: { id: 'pk-x-0090', code: 'PK-X-0090', orderId: 'ord-demo-cancelled' },
    note: 'Đã cắt 1 tấm',
    lines: [
      {
        productId: 'prod-pin-ae-630',
        name: 'Tấm pin AE 630W',
        sku: 'PIN-AE-630',
        unit: 'tấm',
        qty: 3,
        unitCost: 2_110_000,
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
  const { id, code, type, orderId, returnOfVoucherId, createdAt, createdBy, lineCount, totalQty } = d;
  return {
    id,
    code,
    type,
    ...(orderId === undefined ? {} : { orderId }),
    ...(returnOfVoucherId === undefined ? {} : { returnOfVoucherId }),
    createdAt,
    createdBy,
    lineCount,
    totalQty,
  };
}

export class FakeStockVouchersPort implements StockVouchersPort {
  private readonly data: StockVoucherDetail[];

  constructor(data: StockVoucherDetail[] = DEMO_STOCK_VOUCHERS) {
    this.data = [...data];
  }

  listVouchers(query: StockVoucherListQuery = {}): Promise<StockVoucherList> {
    const items = this.data.filter(
      (d) =>
        (query.type === undefined || d.type === query.type) &&
        (query.isReturn === undefined ||
          (d.returnOfVoucherId !== undefined) === query.isReturn),
    );
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
      code: input.type === 'nhap' ? 'PK-N-0120' : 'PK-X-0097',
      type: input.type,
      createdAt: '2026-10-21T03:15:00.000Z',
      createdBy: KHO,
      lineCount: input.lines.length,
      totalQty: input.lines.reduce((tong, l) => tong + l.qty, 0),
      canReturn: false,
      note: input.note ?? null,
      lines: input.lines.map((l) => {
        const sp = DEMO_STOCK_LIST.items.find((i) => i.productId === l.productId);
        return {
          productId: l.productId,
          name: sp?.name ?? l.productId,
          sku: sp?.sku ?? '',
          unit: sp?.unit ?? '',
          qty: l.qty,
          ...(l.unitCost === undefined ? {} : { unitCost: l.unitCost }),
        };
      }),
    };
    this.data.unshift(moi);
    return Promise.resolve(moi);
  }

  createReturnVoucher(
    originVoucherId: string,
    input: CreateReturnVoucherInput,
  ): Promise<StockVoucherDetail> {
    const origin = this.data.find((d) => d.id === originVoucherId);
    if (origin === undefined) {
      const err: StockVoucherPortError = { message: 'Không tìm thấy phiếu kho.' };
      return Promise.reject(err);
    }
    // A canned answer shaped like the backend's; stock and cost come from the backend.
    const created: StockVoucherDetail = {
      id: `pk-demo-${this.data.length + 1}`,
      code: 'PK-NT-0005',
      type: 'nhap',
      returnOfVoucherId: origin.id,
      createdAt: '2026-10-21T03:15:00.000Z',
      createdBy: KHO,
      lineCount: input.lines.length,
      totalQty: input.lines.reduce((sum, l) => sum + l.qty, 0),
      canReturn: false,
      returnOf: { id: origin.id, code: origin.code, orderId: origin.orderId ?? '' },
      note: input.note ?? null,
      lines: input.lines.map((l) => {
        const originLine = origin.lines.find((x) => x.productId === l.productId);
        return {
          productId: l.productId,
          name: originLine?.name ?? l.productId,
          sku: originLine?.sku ?? '',
          unit: originLine?.unit ?? '',
          qty: l.qty,
          ...(originLine?.unitCost === undefined ? {} : { unitCost: originLine.unitCost }),
        };
      }),
    };
    this.data[this.data.indexOf(origin)] = {
      ...origin,
      canReturn: false,
      returnVoucher: { id: created.id, code: created.code },
    };
    this.data.unshift(created);
    return Promise.resolve(created);
  }
}
