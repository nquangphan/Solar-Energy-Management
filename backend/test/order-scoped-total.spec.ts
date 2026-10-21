import type { Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { EventBus } from '../src/events/event-bus';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { resolveOrderTotals } from '../src/orders/domain/order-totals';
import { OrdersService } from '../src/orders/orders.service';
import { QuoteExportService } from '../src/orders/quote-export.service';
import type { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * The order's after-VAT total has ONE resolution rule (`resolveOrderTotals`), used by both the
 * printed quote and the payment schedule. These tests pin the rule and prove both paths print
 * the same number for the same order.
 */
describe('resolveOrderTotals', () => {
  const lines = [{ unitPrice: 10_000_000, qty: 1 }];
  const order = { status: 'dachot', vatMode: 'co_vat', discount: null };

  it('prefers the version snapshot (rate, mode, discount) over live values', () => {
    const r = resolveOrderTotals({
      lines,
      version: { vatRate: 10, vatMode: 'co_vat', discountAmount: 1_000_000 },
      order: { ...order, vatMode: 'khong_vat' },
      fallbackVatRate: 8,
    });
    expect(r.vatRate).toBe(10);
    expect(r.applyVat).toBe(true);
    expect(r.totals.total).toBe(9_000_000 + 900_000);
  });

  it('falls back to the configured rate and the order vat mode without a snapshot', () => {
    const r = resolveOrderTotals({
      lines,
      version: { vatRate: null, vatMode: null, discountAmount: null },
      order,
      fallbackVatRate: 8,
    });
    expect(r.totals.total).toBe(10_800_000);
  });

  it.each([
    ['dachot', 'cho_duyet', 1_000_000],
    ['dachot', 'dong_y', 1_000_000],
    ['dachot', 'tu_choi', 0],
    ['baogia', 'dong_y', 0],
  ])(
    'without a discount snapshot: status %s + approval %s ⇒ discount %i',
    (status, approvalStatus, expectedDiscount) => {
      const r = resolveOrderTotals({
        lines,
        version: null,
        order: {
          status,
          vatMode: 'co_vat',
          discount: { status: approvalStatus, amount: 1_000_000 },
        },
        fallbackVatRate: 8,
      });
      expect(r.totals.discountAmount).toBe(expectedDiscount);
    },
  );
});

describe('OrdersService.getScopedTotal', () => {
  const CALLER = 'acc-caller';
  const ORDER_ID = '0f43a2b1-9c8d-4e7f-a6b5-c4d3e2f10987';
  const VERSION_ID = 'aaaa1111-2222-3333-4444-555566667777';

  const ORDER = {
    id: ORDER_ID,
    status: 'dachot',
    customerSdt: '+84912345678',
    currentVersionId: VERSION_ID,
    ownerAccountId: CALLER,
    assigneeAccountId: null,
    scopeThietBi: true,
    scopeThiCong: false,
    scopeVanChuyen: false,
    kWp: 5.5,
    vatMode: 'co_vat',
    validityNote: null,
  };

  /** Snapshotted lines: 7,777,777×3 + 1,234,567×2 = 25,802,465. */
  const LINES = [
    {
      id: 'l1',
      orderVersionId: VERSION_ID,
      productId: 'p1',
      name: 'Tấm pin',
      unit: 'Tấm',
      qty: 3,
      unitPrice: 1,
      unitPriceSnapshot: 7_777_777,
      priceEditable: false,
      isFlexible: false,
      note: null,
      warrantyMonths: 60,
      displayOrder: 0,
    },
    {
      id: 'l2',
      orderVersionId: VERSION_ID,
      productId: null,
      name: 'Phụ kiện',
      unit: 'Bộ',
      qty: 2,
      unitPrice: 1_234_567,
      unitPriceSnapshot: 1_234_567,
      priceEditable: true,
      isFlexible: false,
      note: null,
      warrantyMonths: null,
      displayOrder: 1,
    },
  ];

  const VERSION = {
    id: VERSION_ID,
    orderId: ORDER_ID,
    versionNo: 1,
    vatRate: 8,
    vatMode: 'co_vat',
    discountAmount: 802_465,
  };

  function build(overrides: { order?: unknown; lines?: unknown[] } = {}) {
    const captured: { where?: Prisma.OrderWhereInput } = {};
    const prisma = {
      order: {
        findFirst: (args: Prisma.OrderFindFirstArgs) => {
          captured.where = args.where;
          return Promise.resolve(
            overrides.order === undefined ? ORDER : overrides.order,
          );
        },
      },
      orderLineItem: {
        findMany: () => Promise.resolve(overrides.lines ?? LINES),
      },
      orderVersion: { findUnique: () => Promise.resolve(VERSION) },
      discountApproval: { findFirst: () => Promise.resolve(null) },
      product: { findMany: () => Promise.resolve([]) },
      customer: {
        findUnique: () =>
          Promise.resolve({
            sdt: ORDER.customerSdt,
            name: 'Khách',
            address: null,
            taxCode: null,
          }),
      },
      quoteExport: { upsert: () => Promise.resolve({}) },
    } as unknown as PrismaService;
    const service = new OrdersService(
      prisma,
      {} as unknown as EventBus,
      fakeStorage(),
      {} as unknown as StockVouchersService,
      {} as unknown as StockItemsService,
    );
    return { service, prisma, captured };
  }

  it('returns snapshot subtotal − discount + VAT', async () => {
    const { service } = build();
    const result = await service.getScopedTotal(
      CALLER,
      new Set([PERM.ordersViewAll]),
      ORDER_ID,
      10,
      false,
    );
    // subtotal 25,802,465 − 802,465 = 25,000,000; VAT 8% = 2,000,000.
    expect(result.total).toBe(27_000_000);
    expect(result.order.id).toBe(ORDER_ID);
  });

  it('applies the caller scope for orders.view_own', async () => {
    const { service, captured } = build();
    await service.getScopedTotal(
      CALLER,
      new Set([PERM.ordersViewOwn]),
      ORDER_ID,
      8,
      false,
    );
    expect(captured.where).toEqual({
      AND: [
        { id: ORDER_ID },
        {
          OR: [{ ownerAccountId: CALLER }, { assigneeAccountId: CALLER }],
        },
      ],
    });
  });

  it('out of scope / missing ⇒ the same 404 as getScoped', async () => {
    const { service } = build({ order: null });
    await expect(
      service.getScopedTotal(
        CALLER,
        new Set([PERM.ordersViewOwn]),
        ORDER_ID,
        8,
        false,
      ),
    ).rejects.toMatchObject({ errorCode: 'NOT_FOUND' });
    await expect(
      service.getScoped(CALLER, new Set([PERM.ordersViewOwn]), ORDER_ID, false),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('an order without an effective version (no lines) totals 0 instead of throwing', async () => {
    const { service } = build({
      order: { ...ORDER, currentVersionId: null },
      lines: [],
    });
    const result = await service.getScopedTotal(
      CALLER,
      new Set([PERM.ordersViewAll]),
      ORDER_ID,
      8,
      false,
    );
    expect(result.total).toBe(0);
  });

  it('equals the total printed on the quote PDF for the same order', async () => {
    const { service, prisma } = build();
    const perms = new Set([PERM.ordersViewAll]);
    const { total } = await service.getScopedTotal(
      CALLER,
      perms,
      ORDER_ID,
      8,
      false,
    );

    let html = '';
    const renderer = {
      render: (h: string) => {
        html = h;
        return Promise.resolve({
          pdf: Buffer.from('x'),
          image: Buffer.from('y'),
        });
      },
    } as unknown as QuoteRendererPort;
    const quote = new QuoteExportService(
      service,
      prisma,
      { publish: () => Promise.resolve() } as unknown as EventBus,
      fakeStorage(),
      renderer,
    );
    await quote.exportQuote(CALLER, ORDER_ID, 8, false, perms);

    // Formatted with dot thousands separators on the printed quote.
    const printed = total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    expect(printed).toBe('27.000.000');
    expect(html).toContain(printed);
  });
});
