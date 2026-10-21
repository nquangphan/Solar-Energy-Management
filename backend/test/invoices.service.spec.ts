import { AppException } from '../src/common/errors/app.exception';
import type { EventBus } from '../src/events/event-bus';
import { INVOICE_BLOCKED_MESSAGE } from '../src/invoices/domain/invoice-eligibility';
import { InvoiceCreated } from '../src/invoices/domain/invoice-events';
import {
  InvoicesService,
  ORDER_CHANGED_MESSAGE,
} from '../src/invoices/invoices.service';
import { lineAmount } from '../src/orders/domain/line-amount';
import { resolveOrderTotals } from '../src/orders/domain/order-totals';
import type { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { SettingsService } from '../src/settings/settings.service';

/**
 * Unit `InvoicesService` — HERMETIC. Every collaborator is a mock that appends to ONE log, so the
 * pipeline order (scope → [lock → fresh → replay check → read → seller → seq → create] → commit
 * → publish) is asserted directly, and each failing step is shown to stop everything after it.
 * The transaction mock RUNS its callback and logs the commit only when it resolves, so "publish
 * after commit" is measured, not assumed. Rows come back with `bigint` money like Prisma's.
 */

const ORDER_ID = '3f2a9b1c-1111-4222-8333-444444444444';
const VERSION_ID = 'aaaaaaaa-1111-4222-8333-444444444444';
const ACTOR = 'acc-invoices-1';
const PERMS = new Set<string>(['orders.view_all', 'invoices.manage']);
const SELLER = {
  legalName: 'Công ty TNHH Phương Nam Solar',
  taxCode: '0312345678',
  address: '12 Nguyễn Huệ',
  representative: 'Trần Văn A',
  representativeTitle: 'Giám đốc',
  phone: '0281234567',
  bankAccount: '0071000123456',
};

const LINES = [
  { name: 'Tấm pin 580W', unit: 'Tấm', qty: 18, unitPrice: 2_650_000 },
  { name: 'Biến tần 10kW', unit: 'Bộ', qty: 1, unitPrice: 18_500_000 },
].map((line, index) => ({
  ...line,
  id: `line-${index}`,
  displayOrder: index,
  amount: lineAmount(line.unitPrice, line.qty),
  warrantyMonths: 120,
}));
/** Expected totals come from the real resolver, never hand-typed. */
const EXPECTED = resolveOrderTotals({
  lines: LINES,
  version: { vatRate: 8, vatMode: 'co_vat', discountAmount: null },
  order: { status: 'dachot', vatMode: 'co_vat', discount: null },
  fallbackVatRate: 10,
}).totals;

describe('InvoicesService (unit, hermetic)', () => {
  let log: string[];
  let view: Record<string, unknown>;
  let fresh: { status: string; currentVersionId: string | null } | null;
  let existing: unknown;
  let getScoped: jest.Mock;
  let queryRaw: jest.Mock;
  let invoiceFindUnique: jest.Mock;
  let create: jest.Mock;
  let findMany: jest.Mock;
  let publish: jest.Mock;
  let transaction: jest.Mock;
  let companyLegalEntity: jest.Mock;
  let service: InvoicesService;

  const step =
    <T>(name: string, value?: T) =>
    () => {
      log.push(name);
      return Promise.resolve(value);
    };

  /** What Prisma returns for an invoice row (money as bigint). */
  function storedRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'inv-1',
      seq: 41,
      invoiceNo: 'HD-2026-0041',
      orderId: ORDER_ID,
      orderVersionId: VERSION_ID,
      customerName: 'VP Công Chứng Lê Đình Thao',
      customerTaxCode: '0316552018',
      vatRate: 8,
      applyVat: true,
      subtotal: BigInt(EXPECTED.subtotal),
      discountAmount: BigInt(EXPECTED.discountAmount),
      vatAmount: BigInt(EXPECTED.vatAmount),
      total: BigInt(EXPECTED.total),
      issuedAt: new Date('2026-10-22T03:00:00Z'),
      orderVersion: { versionNo: 2 },
      _count: { lines: 2 },
      ...overrides,
    };
  }

  beforeEach(() => {
    log = [];
    view = {
      id: ORDER_ID,
      status: 'dachot',
      customerSdt: '+84901234567',
      currentVersionId: VERSION_ID,
      vatMode: 'co_vat',
      discount: null,
      lineItems: LINES,
    };
    fresh = { status: 'dachot', currentVersionId: VERSION_ID };
    existing = null;
    getScoped = jest.fn().mockImplementation(() => step('scope', view)());
    queryRaw = jest
      .fn()
      .mockImplementation((sql: TemplateStringsArray) =>
        sql.join('?').includes('FOR UPDATE')
          ? step('lock', [{ id: ORDER_ID }])()
          : step('seq', [{ seq: 41n }])(),
      );
    invoiceFindUnique = jest
      .fn()
      .mockImplementation(() => step('replay-check', existing)());
    // Echo the written data back like Prisma does — money stays bigint.
    create = jest
      .fn()
      .mockImplementation(
        (args: {
          data: { lines: { create: unknown[] } } & Record<string, unknown>;
        }) => {
          log.push('create');
          const { lines, ...data } = args.data;
          return Promise.resolve({
            id: 'inv-new',
            ...data,
            orderVersion: { versionNo: 2 },
            _count: { lines: lines.create.length },
          });
        },
      );
    findMany = jest.fn().mockResolvedValue([]);
    publish = jest.fn().mockImplementation(step('publish'));
    companyLegalEntity = jest
      .fn()
      .mockImplementation(() => step('seller', SELLER)());
    const prisma = {
      order: {
        findUnique: jest.fn().mockImplementation(() => step('fresh', fresh)()),
      },
      customer: {
        findUnique: jest.fn().mockImplementation(() =>
          step('read', {
            sdt: '+84901234567',
            name: 'VP Công Chứng Lê Đình Thao',
            taxCode: '0316552018',
            address: '45 Lê Lợi',
          })(),
        ),
      },
      orderVersion: {
        findUnique: jest.fn().mockImplementation(() =>
          step('read', {
            id: VERSION_ID,
            versionNo: 2,
            vatRate: 8,
            vatMode: 'co_vat',
            discountAmount: null,
          })(),
        ),
      },
      invoice: { create, findMany, findUnique: invoiceFindUnique },
      $queryRaw: queryRaw,
    } as unknown as PrismaService;
    transaction = jest
      .fn()
      .mockImplementation(async (body: (tx: unknown) => Promise<unknown>) => {
        const result = await body(prisma);
        log.push('commit');
        return result;
      });
    (prisma as unknown as { $transaction: jest.Mock }).$transaction =
      transaction;
    service = new InvoicesService(
      { getScoped } as unknown as OrdersService,
      prisma,
      { publish } as unknown as EventBus,
      { companyLegalEntity } as unknown as SettingsService,
    );
  });

  const create_ = () => service.create(ACTOR, PERMS, ORDER_ID, 8, false);

  async function rejection(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (e) {
      return e as AppException;
    }
    throw new Error('expected a rejection');
  }

  describe('create — happy path', () => {
    it('runs scope → [lock → fresh → replay-check → read → seller → seq → create] → commit → publish, each once', async () => {
      await create_();

      expect(log).toEqual([
        'scope',
        'lock',
        'fresh',
        'replay-check',
        'read',
        'read',
        'seller',
        'seq',
        'create',
        'commit',
        'publish',
      ]);
      expect(getScoped).toHaveBeenCalledWith(ACTOR, PERMS, ORDER_ID, false);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);
      // The first statement of the transaction is the order row lock, then the number.
      expect(queryRaw).toHaveBeenCalledTimes(2);
      const lockSql = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join(
        '?',
      );
      expect(lockSql).toBe('SELECT id FROM orders WHERE id = ? FOR UPDATE');
      expect(queryRaw.mock.calls[0][1]).toBe(ORDER_ID);
      expect(invoiceFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderVersionId: VERSION_ID } }),
      );
    });

    it('reserves the number with nextval (not count()+1) and formats HD-yyyy-NNNN', async () => {
      const result = await create_();

      const sql = (queryRaw.mock.calls[1][0] as TemplateStringsArray).join('?');
      expect(sql).toContain(
        "nextval(pg_get_serial_sequence('invoices', 'seq'))",
      );
      expect(result.invoiceNo).toMatch(/^HD-\d{4}-0041$/);
    });

    it('writes ONE row with the snapshot (customer, seller, totals as BigInt) and nested lines', async () => {
      const result = await create_();

      const { data } = create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        seq: 41,
        invoiceNo: result.invoiceNo,
        orderId: ORDER_ID,
        orderVersionId: VERSION_ID,
        customerSdt: '+84901234567',
        customerName: 'VP Công Chứng Lê Đình Thao',
        customerTaxCode: '0316552018',
        customerAddress: '45 Lê Lợi',
        sellerLegalName: SELLER.legalName,
        sellerTaxCode: SELLER.taxCode,
        sellerAddress: SELLER.address,
        sellerRepresentative: SELLER.representative,
        sellerRepresentativeTitle: SELLER.representativeTitle,
        sellerPhone: SELLER.phone,
        sellerBankAccount: SELLER.bankAccount,
        vatRate: 8,
        applyVat: true,
        subtotal: BigInt(EXPECTED.subtotal),
        discountAmount: BigInt(EXPECTED.discountAmount),
        vatAmount: BigInt(EXPECTED.vatAmount),
        total: BigInt(EXPECTED.total),
        issuedAt: result.issuedAt,
        createdByAccountId: ACTOR,
        lines: {
          create: LINES.map((line, index) => ({
            displayOrder: index,
            name: line.name,
            unit: line.unit,
            qty: line.qty,
            unitPrice: line.unitPrice,
            amount: BigInt(line.amount),
          })),
        },
      });
    });

    it('returns every amount as an integer number (no bigint leaks), JSON-serialisable', async () => {
      const result = await create_();

      expect(result).toEqual({
        id: 'inv-new',
        invoiceNo: result.invoiceNo,
        versionNo: 2,
        issuedAt: result.issuedAt,
        customerName: 'VP Công Chứng Lê Đình Thao',
        customerTaxCode: '0316552018',
        vatRate: 8,
        applyVat: true,
        subtotal: EXPECTED.subtotal,
        discountAmount: EXPECTED.discountAmount,
        vatAmount: EXPECTED.vatAmount,
        total: EXPECTED.total,
        lineCount: 2,
      });
      for (const key of [
        'subtotal',
        'discountAmount',
        'vatAmount',
        'total',
      ] as const) {
        expect(typeof result[key]).toBe('number');
        expect(Number.isInteger(result[key])).toBe(true);
      }
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('publishes InvoiceCreated targeting the order, occurredAt = issuedAt, total a number, no customer data', async () => {
      const result = await create_();

      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0][0] as InvoiceCreated;
      expect(event).toBeInstanceOf(InvoiceCreated);
      expect(event.target).toEqual({ type: 'Order', id: ORDER_ID });
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.occurredAt).toBe(result.issuedAt);
      expect(event.after).toEqual({
        invoiceId: 'inv-new',
        invoiceNo: result.invoiceNo,
        orderVersionId: VERSION_ID,
        total: EXPECTED.total,
      });
      expect(typeof event.after.total).toBe('number');
      expect(JSON.stringify(event)).not.toContain('Lê Đình Thao');
    });
  });

  describe('create — replay (the current version already has an invoice)', () => {
    it('returns the stored invoice: 0 read, 0 seller, 0 nextval, 0 create, 0 publish', async () => {
      existing = storedRow();

      const result = await create_();

      expect(log).toEqual(['scope', 'lock', 'fresh', 'replay-check', 'commit']);
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(companyLegalEntity).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 'inv-1',
        invoiceNo: 'HD-2026-0041',
        total: EXPECTED.total,
        versionNo: 2,
        lineCount: 2,
      });
      expect(typeof result.total).toBe('number');
    });

    it.each(['hoanthanh', 'huy'])(
      'order moved to %s after the invoice ⇒ still the stored invoice, not a 409',
      async (status) => {
        existing = storedRow();
        fresh = { status, currentVersionId: VERSION_ID };
        view.status = status;

        await expect(create_()).resolves.toMatchObject({ id: 'inv-1' });
        expect(publish).not.toHaveBeenCalled();
      },
    );

    it('out of scope ⇒ the scope error, never the stored invoice', async () => {
      existing = storedRow();
      getScoped.mockRejectedValue(new Error('404'));

      await expect(create_()).rejects.toThrow('404');
      expect(transaction).not.toHaveBeenCalled();
      expect(invoiceFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('create — a failing step stops everything after it', () => {
    it('create throws ⇒ 0 publish', async () => {
      create.mockRejectedValue(new Error('db'));

      await expect(create_()).rejects.toThrow('db');
      expect(publish).not.toHaveBeenCalled();
      expect(log).not.toContain('commit');
    });

    it('scope throws ⇒ nothing read or written', async () => {
      getScoped.mockRejectedValue(new Error('404'));

      await expect(create_()).rejects.toThrow('404');
      expect(log).toEqual([]);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('lines that do not add up to the subtotal ⇒ throws before the number is taken', async () => {
      view.lineItems = LINES.map((line, index) =>
        index === 0 ? { ...line, amount: line.amount + 1 } : line,
      );

      await expect(create_()).rejects.toThrow(/add up/);
      expect(log).not.toContain('seq');
      expect(create).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });
  });

  describe('create — refused orders (same messages as the overview)', () => {
    const cases: [string, () => void, number, string][] = [
      [
        'baogia',
        () => {
          view.status = 'baogia';
          fresh = { status: 'baogia', currentVersionId: VERSION_ID };
        },
        409,
        INVOICE_BLOCKED_MESSAGE.status,
      ],
      [
        'choduyet',
        () => {
          view.status = 'choduyet';
          fresh = { status: 'choduyet', currentVersionId: VERSION_ID };
        },
        409,
        INVOICE_BLOCKED_MESSAGE.status,
      ],
      [
        'huy',
        () => {
          view.status = 'huy';
          fresh = { status: 'huy', currentVersionId: VERSION_ID };
        },
        409,
        INVOICE_BLOCKED_MESSAGE.status,
      ],
      [
        'no lines',
        () => (view.lineItems = []),
        400,
        INVOICE_BLOCKED_MESSAGE.noLines,
      ],
    ];

    it.each(cases)(
      '%s ⇒ %i, no seller/seq/create/publish',
      async (_name, arrange, status, message) => {
        arrange();

        const error = await rejection(create_());

        expect(error).toBeInstanceOf(AppException);
        expect(error.getStatus()).toBe(status);
        expect(error.message).toBe(message);
        expect(log).not.toContain('seq');
        expect(log).not.toContain('commit');
        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(companyLegalEntity).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
      },
    );

    it.each(cases)(
      'overview of %s ⇒ creatable:false + the same message',
      async (_name, arrange, _status, message) => {
        arrange();

        const overview = await service.overview(
          ACTOR,
          PERMS,
          ORDER_ID,
          8,
          false,
        );

        expect(overview.creatable).toBe(false);
        expect(overview.blockedReason).toBe(message);
      },
    );

    it('a customer without a tax code is still invoiced (customerTaxCode null)', async () => {
      const prisma = (service as unknown as { prisma: PrismaService }).prisma;
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
        sdt: '+84901234567',
        name: 'Nguyễn Văn Cá Nhân',
        taxCode: null,
        address: null,
      });

      await create_();

      expect(create.mock.calls[0][0].data.customerTaxCode).toBeNull();
    });

    it('hoanthanh may still be invoiced', async () => {
      view.status = 'hoanthanh';
      fresh = { status: 'hoanthanh', currentVersionId: VERSION_ID };

      await expect(create_()).resolves.toMatchObject({ id: 'inv-new' });
    });
  });

  describe('create — state re-read under the order row lock', () => {
    it('reopened between the scoped read and the lock ⇒ 409 status, no number taken', async () => {
      fresh = { status: 'baogia', currentVersionId: VERSION_ID };

      const error = await rejection(create_());

      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(INVOICE_BLOCKED_MESSAGE.status);
      expect(log).toEqual([
        'scope',
        'lock',
        'fresh',
        'replay-check',
        'read',
        'read',
      ]);
      expect(create).not.toHaveBeenCalled();
    });

    it('revised between the scoped read and the lock ⇒ 409 "Đơn vừa thay đổi", nothing read further', async () => {
      fresh = {
        status: 'dachot',
        currentVersionId: 'bbbbbbbb-1111-4222-8333-444444444444',
      };

      const error = await rejection(create_());

      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(ORDER_CHANGED_MESSAGE);
      expect(log).toEqual(['scope', 'lock', 'fresh']);
      expect(invoiceFindUnique).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('confirmed between the scoped read and the lock (same version) ⇒ 409 "Đơn vừa thay đổi", the quote-time lines never copied', async () => {
      view = { ...view, status: 'baogia' };
      fresh = { status: 'dachot', currentVersionId: VERSION_ID };

      const error = await rejection(create_());

      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(ORDER_CHANGED_MESSAGE);
      expect(log).toEqual(['scope', 'lock', 'fresh', 'replay-check']);
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(create).not.toHaveBeenCalled();
    });

    it('order gone under the lock ⇒ 409', async () => {
      fresh = null;

      const error = await rejection(create_());

      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(ORDER_CHANGED_MESSAGE);
    });

    it('a payment advanced the status meanwhile (dacoc) ⇒ still created', async () => {
      fresh = { status: 'dacoc', currentVersionId: VERSION_ID };

      await expect(create_()).resolves.toMatchObject({ id: 'inv-new' });
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('overview', () => {
    it('server-built fields: version, customer, tax code, total, invoices newest first as numbers', async () => {
      findMany.mockResolvedValue([
        storedRow({
          id: 'inv-old',
          orderVersionId: 'old-version',
          orderVersion: { versionNo: 1 },
        }),
      ]);

      const overview = await service.overview(ACTOR, PERMS, ORDER_ID, 8, false);

      expect(overview).toEqual({
        creatable: true,
        blockedReason: null,
        currentInvoiceId: null,
        versionNo: 2,
        customerName: 'VP Công Chứng Lê Đình Thao',
        customerTaxCode: '0316552018',
        lineCount: 2,
        orderTotal: EXPECTED.total,
        invoices: [
          {
            id: 'inv-old',
            invoiceNo: 'HD-2026-0041',
            versionNo: 1,
            issuedAt: new Date('2026-10-22T03:00:00Z'),
            customerName: 'VP Công Chứng Lê Đình Thao',
            customerTaxCode: '0316552018',
            vatRate: 8,
            applyVat: true,
            subtotal: EXPECTED.subtotal,
            discountAmount: EXPECTED.discountAmount,
            vatAmount: EXPECTED.vatAmount,
            total: EXPECTED.total,
            lineCount: 2,
          },
        ],
      });
      expect(findMany).toHaveBeenCalledWith({
        where: { orderId: ORDER_ID },
        include: {
          orderVersion: { select: { versionNo: true } },
          _count: { select: { lines: true } },
        },
        orderBy: [{ issuedAt: 'desc' }, { seq: 'desc' }],
      });
      expect(log[0]).toBe('scope');
      expect(() => JSON.stringify(overview)).not.toThrow();
    });

    it('current version already invoiced ⇒ creatable:false, blockedReason null, currentInvoiceId set', async () => {
      findMany.mockResolvedValue([storedRow()]);

      const overview = await service.overview(ACTOR, PERMS, ORDER_ID, 8, false);

      expect(overview.creatable).toBe(false);
      expect(overview.blockedReason).toBeNull();
      expect(overview.currentInvoiceId).toBe('inv-1');
    });

    it('out of scope ⇒ the scope error, no invoice read', async () => {
      getScoped.mockRejectedValue(new Error('404'));

      await expect(
        service.overview(ACTOR, PERMS, ORDER_ID, 8, false),
      ).rejects.toThrow('404');
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});
