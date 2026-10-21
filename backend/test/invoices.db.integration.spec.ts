import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import { AuditSubscriber } from '../src/audit/audit.subscriber';
import type { AppException } from '../src/common/errors/app.exception';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { INVOICE_BLOCKED_MESSAGE } from '../src/invoices/domain/invoice-eligibility';
import {
  InvoicesService,
  ORDER_CHANGED_MESSAGE,
} from '../src/invoices/invoices.service';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { LEGAL_ENTITY_FIELDS } from '../src/settings/domain/company-legal-entity';
import { SettingsService } from '../src/settings/settings.service';
import { fakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for invoice creation — facts a mock cannot prove:
 *  - the migration's CHECK constraints stand on their own (a direct write violating them fails);
 *  - a real creation writes the invoice, its lines and one `InvoiceCreated` audit row, with the
 *    totals of the real resolver (compared with the order's own scoped total, never hand-typed);
 *  - money is BIGINT: an order above INT4 is invoiced, and reads back as a JS number;
 *  - the invoice is a snapshot: changing the customer, the configured VAT or the company legal
 *    entity afterwards does not change it;
 *  - idempotent per version: two concurrent POSTs on one order end as ONE invoice and ONE event;
 *    a revise + re-confirm gets a new invoice and keeps the old one;
 *  - creation runs under the order row lock: a holder that WRITES the version pointer or the
 *    status under that lock makes the creation WAIT, then see the committed change and refuse.
 *
 * SKIPS itself without `DATABASE_URL`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Invoice creation on REAL Postgres', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let settings: SettingsService;
  let invoices: InvoicesService;

  const ACTOR = 'acc-invoices-74';
  const PHONE = '+84900000740';
  const ALL = new Set<string>(Object.values(PERM));
  const LEGAL_KEYS = LEGAL_ENTITY_FIELDS.map(({ key }) => key);
  let sourceId: string;
  let savedLegalRows: { key: string; value: string }[];

  async function cleanUp(): Promise<void> {
    const found = await prisma.order.findMany({
      where: { customerSdt: PHONE },
      select: { id: true },
    });
    const orderIds = found.map((o) => o.id);
    await prisma.invoiceLine.deleteMany({
      where: { invoice: { orderId: { in: orderIds } } },
    });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.auditLog.deleteMany({ where: { actorAccountId: ACTOR } });
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { currentVersionId: null },
    });
    await prisma.orderLineItem.deleteMany({
      where: { orderVersion: { orderId: { in: orderIds } } },
    });
    await prisma.orderVersion.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.customer.deleteMany({ where: { sdt: PHONE } });
    await prisma.account.deleteMany({ where: { id: ACTOR } });
  }

  /** A confirmed order (through the real `confirm`) with the given lines. */
  async function confirmedOrder(
    lines: { name: string; unit: string; qty: number; unitPrice: number }[],
    vatMode = 'co_vat',
  ): Promise<string> {
    const created = await prisma.order.create({
      data: {
        status: 'baogia',
        customerSdt: PHONE,
        ownerAccountId: ACTOR,
        sourceId,
        custType: 'THUONG_MAI',
        scopeThietBi: true,
        scopeThiCong: true,
        scopeVanChuyen: false,
        vatMode,
      },
    });
    const version = await prisma.orderVersion.create({
      data: { orderId: created.id, versionNo: 1 },
    });
    await prisma.orderLineItem.createMany({
      data: lines.map((line, index) => ({
        orderVersionId: version.id,
        productId: null,
        name: line.name,
        unit: line.unit,
        qty: line.qty,
        unitPrice: line.unitPrice,
        priceEditable: true,
        displayOrder: index,
      })),
    });
    await prisma.order.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
    await orders.confirm(ACTOR, created.id, 8, false, ALL);
    return created.id;
  }

  /** The mockup order: 4 lines, 76.862.000 before VAT. */
  const MOCKUP = [
    { name: 'Tấm pin 580W', unit: 'Tấm', qty: 18, unitPrice: 2_650_000 },
    { name: 'Biến tần 10kW', unit: 'Bộ', qty: 1, unitPrice: 18_500_000 },
    { name: 'Khung nhôm', unit: 'Bộ', qty: 1, unitPrice: 6_862_000 },
    { name: 'Nhân công lắp đặt', unit: 'Gói', qty: 1, unitPrice: 3_800_000 },
  ];

  const create = (orderId: string) =>
    invoices.create(ACTOR, ALL, orderId, 8, false);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  /** Holds `SELECT … FROM orders … FOR UPDATE` (and runs `underLock`) until `release()`. */
  function holdOrderLock(
    orderId: string,
    underLock: (t: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    let release!: () => void;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tx = prisma.$transaction(
      async (t) => {
        await t.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
        await underLock(t);
        await holding;
      },
      { timeout: 10_000 },
    );
    return { release, tx };
  }

  async function rejection(p: Promise<unknown>): Promise<Error> {
    try {
      await p;
    } catch (e) {
      return e as Error;
    }
    throw new Error('Expected an error, got none.');
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    const bus = new InProcessEventBus();
    new AuditSubscriber(
      bus,
      new AuditService(prisma as unknown as PrismaService),
    ).onModuleInit();
    orders = new OrdersService(
      prisma as unknown as PrismaService,
      bus,
      fakeStorage(),
      new StockVouchersService(prisma as unknown as PrismaService, bus),
      new StockItemsService(prisma as unknown as PrismaService),
    );
    settings = new SettingsService(prisma as unknown as PrismaService, bus);
    invoices = new InvoicesService(
      orders,
      prisma as unknown as PrismaService,
      bus,
      settings,
    );
    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('CustomerSource not seeded — run `npx prisma db seed`.');
    }
    sourceId = facebook.id;
    savedLegalRows = await prisma.systemSetting.findMany({
      where: { key: { in: LEGAL_KEYS } },
      select: { key: true, value: true },
    });
    await cleanUp();
    await prisma.account.create({
      data: {
        id: ACTOR,
        email: 'invoices-74@example.com',
        passwordHash: 'x',
        displayName: 'Test 7.4',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'THUONG_MAI',
        name: 'VP Công Chứng Lê Đình Thao',
        taxCode: '0316552018',
        address: '45 Lê Lợi',
        sourceId,
      },
    });
  });

  afterAll(async () => {
    await cleanUp();
    // The company legal entity is global: put back exactly what was there before this file.
    await prisma.systemSetting.deleteMany({
      where: { key: { in: LEGAL_KEYS } },
    });
    if (savedLegalRows.length > 0) {
      await prisma.systemSetting.createMany({ data: savedLegalRows });
    }
    await prisma.$disconnect();
  });

  describe('CHECK constraints stand on their own', () => {
    let invoiceId: string;

    beforeAll(async () => {
      invoiceId = (await create(await confirmedOrder(MOCKUP))).id;
    });

    const violation = async (sql: Promise<unknown>) =>
      (await rejection(sql)).message;

    it('total off by one ⇒ invoices_total_consistent', async () => {
      expect(
        await violation(
          prisma.$executeRaw`UPDATE invoices SET total = total + 1 WHERE id = ${invoiceId}`,
        ),
      ).toContain('invoices_total_consistent');
    });

    it('negative amount ⇒ invoices_amounts_nonneg', async () => {
      expect(
        await violation(
          prisma.$executeRaw`UPDATE invoices SET discount_amount = -1, total = total + 1 WHERE id = ${invoiceId}`,
        ),
      ).toContain('invoices_amounts_nonneg');
    });

    it('vat rate 101 ⇒ invoices_vat_rate_range', async () => {
      expect(
        await violation(
          prisma.$executeRaw`UPDATE invoices SET vat_rate = 101 WHERE id = ${invoiceId}`,
        ),
      ).toContain('invoices_vat_rate_range');
    });

    it('line qty 0 ⇒ invoice_lines_qty_positive', async () => {
      expect(
        await violation(
          prisma.$executeRaw`UPDATE invoice_lines SET qty = 0 WHERE invoice_id = ${invoiceId}`,
        ),
      ).toContain('invoice_lines_qty_positive');
    });

    it('negative line amount ⇒ invoice_lines_amount_nonneg', async () => {
      expect(
        await violation(
          prisma.$executeRaw`UPDATE invoice_lines SET amount = -1 WHERE invoice_id = ${invoiceId}`,
        ),
      ).toContain('invoice_lines_amount_nonneg');
    });

    it('a second invoice for the same version ⇒ unique order_version_id (the last net)', async () => {
      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
      });
      const error = await rejection(
        prisma.invoice.create({
          data: {
            invoiceNo: 'HD-TEST-DUP',
            orderId: row.orderId,
            orderVersionId: row.orderVersionId,
            customerSdt: row.customerSdt,
            customerName: row.customerName,
            sellerLegalName: '',
            sellerTaxCode: '',
            sellerAddress: '',
            sellerRepresentative: '',
            sellerRepresentativeTitle: '',
            sellerPhone: '',
            sellerBankAccount: '',
            vatRate: 8,
            applyVat: true,
            subtotal: 0n,
            discountAmount: 0n,
            vatAmount: 0n,
            total: 0n,
            issuedAt: new Date(),
            createdByAccountId: ACTOR,
          },
        }),
      );
      expect(error.message).toMatch(/order_version_id|Unique constraint/);
    });
  });

  it('a real creation ⇒ the snapshot row (totals = the order total), 4 lines, one InvoiceCreated audit row', async () => {
    const orderId = await confirmedOrder(MOCKUP);
    const view = await orders.getScoped(ACTOR, ALL, orderId, false);
    const orderTotal = await orders.getScopedTotal(
      ACTOR,
      ALL,
      orderId,
      8,
      false,
    );

    const result = await create(orderId);

    const row = await prisma.invoice.findUniqueOrThrow({
      where: { id: result.id },
      include: { lines: { orderBy: { displayOrder: 'asc' } } },
    });
    expect(row).toMatchObject({
      orderId,
      orderVersionId: view.currentVersionId,
      customerSdt: PHONE,
      customerName: 'VP Công Chứng Lê Đình Thao',
      customerTaxCode: '0316552018',
      customerAddress: '45 Lê Lợi',
      vatRate: 8,
      applyVat: true,
      invoiceNo: result.invoiceNo,
      createdByAccountId: ACTOR,
    });
    expect(Number(row.total)).toBe(orderTotal.total);
    expect(result.total).toBe(orderTotal.total);
    expect(result.total).toBe(83_010_960);
    expect(
      Number(row.subtotal) - Number(row.discountAmount) + Number(row.vatAmount),
    ).toBe(Number(row.total));
    expect(
      row.lines.map((l) => ({
        displayOrder: l.displayOrder,
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        unitPrice: l.unitPrice,
        amount: Number(l.amount),
      })),
    ).toEqual(
      view.lineItems.map((line, index) => ({
        displayOrder: index,
        name: line.name,
        unit: line.unit,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: line.amount,
      })),
    );
    expect(result.invoiceNo).toBe(
      `HD-${new Date(row.issuedAt.getTime() + 7 * 3600_000).getUTCFullYear()}-${String(row.seq).padStart(4, '0')}`,
    );
    const audits = await prisma.auditLog.findMany({
      where: {
        actorAccountId: ACTOR,
        eventType: 'InvoiceCreated',
        targetId: orderId,
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].targetType).toBe('Order');
    expect(audits[0].occurredAt.getTime()).toBe(row.issuedAt.getTime());
    expect(audits[0].after).toEqual({
      invoiceId: result.id,
      invoiceNo: result.invoiceNo,
      orderVersionId: view.currentVersionId,
      total: orderTotal.total,
    });
  });

  it('an order above INT4 (2 × 1.500.000.000) ⇒ invoiced, read back as an exact number', async () => {
    const orderId = await confirmedOrder([
      { name: 'Trạm biến áp', unit: 'Bộ', qty: 2, unitPrice: 1_500_000_000 },
    ]);
    const orderTotal = await orders.getScopedTotal(
      ACTOR,
      ALL,
      orderId,
      8,
      false,
    );
    expect(orderTotal.total).toBeGreaterThan(2_147_483_647);

    const result = await create(orderId);

    expect(result.total).toBe(orderTotal.total);
    expect(result.subtotal).toBe(3_000_000_000);
    expect(typeof result.total).toBe('number');
    const overview = await invoices.overview(ACTOR, ALL, orderId, 8, false);
    expect(overview.invoices[0].total).toBe(orderTotal.total);
    expect(() => JSON.stringify(overview)).not.toThrow();
  });

  it('no VAT ⇒ vatAmount 0, total = subtotal', async () => {
    const orderId = await confirmedOrder(MOCKUP, 'khong_vat');

    const result = await create(orderId);

    expect(result.applyVat).toBe(false);
    expect(result.vatAmount).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });

  it('a snapshot: changing the customer, the configured VAT and the company legal entity afterwards changes nothing', async () => {
    await settings.updateCompanyLegalEntity(ACTOR, {
      legalName: 'CÔNG TY TNHH PHƯƠNG NAM SOLAR',
      taxCode: '0312345678',
      address: '12 Nguyễn Huệ',
      representative: 'Trần Văn A',
      representativeTitle: 'Giám đốc',
      phone: '',
      bankAccount: '',
    });
    const orderId = await confirmedOrder(MOCKUP);
    const result = await create(orderId);

    await prisma.customer.update({
      where: { sdt: PHONE },
      data: { name: 'Tên mới', taxCode: '9999999999' },
    });
    await settings.updateCompanyLegalEntity(ACTOR, {
      legalName: 'TÊN ĐÃ ĐỔI',
      taxCode: '1111111111',
      address: 'Địa chỉ mới',
      representative: 'Người khác',
      representativeTitle: 'Phó giám đốc',
      phone: '0909',
      bankAccount: '123',
    });
    try {
      // A different configured VAT rate is what the controller would pass after a settings change.
      const overview = await invoices.overview(ACTOR, ALL, orderId, 10, false);

      expect(overview.customerName).toBe('Tên mới');
      expect(overview.invoices).toHaveLength(1);
      expect(overview.invoices[0]).toMatchObject({
        id: result.id,
        invoiceNo: result.invoiceNo,
        customerName: 'VP Công Chứng Lê Đình Thao',
        customerTaxCode: '0316552018',
        vatRate: 8,
        total: result.total,
      });
      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: result.id },
      });
      expect(row).toMatchObject({
        sellerLegalName: 'CÔNG TY TNHH PHƯƠNG NAM SOLAR',
        sellerTaxCode: '0312345678',
        sellerAddress: '12 Nguyễn Huệ',
        sellerRepresentative: 'Trần Văn A',
        sellerRepresentativeTitle: 'Giám đốc',
        sellerPhone: '',
        sellerBankAccount: '',
      });
    } finally {
      await prisma.customer.update({
        where: { sdt: PHONE },
        data: { name: 'VP Công Chứng Lê Đình Thao', taxCode: '0316552018' },
      });
    }
  });

  it('twice in a row ⇒ one row, the same invoice, one audit row', async () => {
    const orderId = await confirmedOrder(MOCKUP);

    const first = await create(orderId);
    const second = await create(orderId);

    expect(second).toEqual(first);
    expect(await prisma.invoice.count({ where: { orderId } })).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          actorAccountId: ACTOR,
          eventType: 'InvoiceCreated',
          targetId: orderId,
        },
      }),
    ).toBe(1);
  });

  it('two concurrent POSTs on the SAME order ⇒ serialised by the row lock: one row, the same id, one audit row, no error', async () => {
    const orderId = await confirmedOrder(MOCKUP);

    const [a, b] = await Promise.all([create(orderId), create(orderId)]);

    expect(a.id).toBe(b.id);
    expect(a.invoiceNo).toBe(b.invoiceNo);
    expect(await prisma.invoice.count({ where: { orderId } })).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          actorAccountId: ACTOR,
          eventType: 'InvoiceCreated',
          targetId: orderId,
        },
      }),
    ).toBe(1);
  });

  it('two concurrent POSTs on DIFFERENT orders ⇒ different seq and number', async () => {
    const [first, second] = [
      await confirmedOrder(MOCKUP),
      await confirmedOrder(MOCKUP),
    ];

    const [a, b] = await Promise.all([create(first), create(second)]);

    expect(a.invoiceNo).not.toBe(b.invoiceNo);
  });

  it('revise + re-confirm ⇒ a new invoice for version 2; the old one is untouched; newest first', async () => {
    const orderId = await confirmedOrder(MOCKUP);
    const first = await create(orderId);

    await orders.revise(ACTOR, orderId, false, ALL);
    const reopened = await invoices.overview(ACTOR, ALL, orderId, 8, false);
    expect(reopened.creatable).toBe(false);
    expect(reopened.blockedReason).toBe(INVOICE_BLOCKED_MESSAGE.status);
    await orders.confirm(ACTOR, orderId, 8, false, ALL);
    const second = await create(orderId);

    expect([first.versionNo, second.versionNo]).toEqual([1, 2]);
    expect(second.invoiceNo).not.toBe(first.invoiceNo);
    const overview = await invoices.overview(ACTOR, ALL, orderId, 8, false);
    expect(overview.invoices.map((i) => [i.id, i.versionNo])).toEqual([
      [second.id, 2],
      [first.id, 1],
    ]);
    expect(overview.currentInvoiceId).toBe(second.id);
    const old = await prisma.invoice.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(Number(old.total)).toBe(first.total);
  });

  it('a cancelled order after its invoice ⇒ the replay still returns the stored invoice', async () => {
    const orderId = await confirmedOrder(MOCKUP);
    const first = await create(orderId);
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'huy' },
    });

    await expect(create(orderId)).resolves.toEqual(first);
  });

  describe('🔴 FOR UPDATE on orders: FORCED interleaving', () => {
    it('a holder that WRITES a new current version under the lock ⇒ creation waits, then 409 "Đơn vừa thay đổi"; no row', async () => {
      const orderId = await confirmedOrder(MOCKUP);
      const lock = holdOrderLock(orderId, async (t) => {
        const next = await t.orderVersion.create({
          data: { orderId, versionNo: 2 },
        });
        await t.order.update({
          where: { id: orderId },
          data: { currentVersionId: next.id },
        });
      });
      await wait(150);
      let settled = false;
      const running = rejection(create(orderId)).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      lock.release();
      await lock.tx;

      const error = (await running) as AppException;
      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(ORDER_CHANGED_MESSAGE);
      expect(await prisma.invoice.count({ where: { orderId } })).toBe(0);
    });

    it('a holder that edits a quote line and confirms under the lock (same version) ⇒ creation waits, then 409 "Đơn vừa thay đổi"; no row from the quote-time lines', async () => {
      const created = await prisma.order.create({
        data: {
          status: 'baogia',
          customerSdt: PHONE,
          ownerAccountId: ACTOR,
          sourceId,
          custType: 'THUONG_MAI',
          scopeThietBi: true,
          scopeThiCong: true,
          scopeVanChuyen: false,
          vatMode: 'co_vat',
        },
      });
      const version = await prisma.orderVersion.create({
        data: { orderId: created.id, versionNo: 1 },
      });
      const line = await prisma.orderLineItem.create({
        data: {
          orderVersionId: version.id,
          productId: null,
          name: 'Tấm pin 580W',
          unit: 'Tấm',
          qty: 18,
          unitPrice: 2_650_000,
          priceEditable: true,
          displayOrder: 0,
        },
      });
      await prisma.order.update({
        where: { id: created.id },
        data: { currentVersionId: version.id },
      });
      const lock = holdOrderLock(created.id, async (t) => {
        await t.orderLineItem.update({
          where: { id: line.id },
          data: { qty: 20 },
        });
        await t.order.update({
          where: { id: created.id },
          data: { status: 'dachot' },
        });
      });
      await wait(150);
      let settled = false;
      const running = rejection(create(created.id)).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      lock.release();
      await lock.tx;

      const error = (await running) as AppException;
      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(ORDER_CHANGED_MESSAGE);
      expect(
        await prisma.invoice.count({ where: { orderId: created.id } }),
      ).toBe(0);
    });

    it('a holder that reopens the order (status baogia) under the lock ⇒ creation waits, then 409 by status; no row', async () => {
      const orderId = await confirmedOrder(MOCKUP);
      const lock = holdOrderLock(orderId, (t) =>
        t.order.update({ where: { id: orderId }, data: { status: 'baogia' } }),
      );
      await wait(150);
      let settled = false;
      const running = rejection(create(orderId)).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      lock.release();
      await lock.tx;

      const error = (await running) as AppException;
      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(INVOICE_BLOCKED_MESSAGE.status);
      expect(await prisma.invoice.count({ where: { orderId } })).toBe(0);
    });
  });
});
