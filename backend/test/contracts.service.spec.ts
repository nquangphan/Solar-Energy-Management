import {
  ContractsService,
  ORDER_CHANGED_MESSAGE,
} from '../src/contracts/contracts.service';
import { CONTRACT_BLOCKED_MESSAGE } from '../src/contracts/domain/contract-eligibility';
import { ContractGenerated } from '../src/contracts/domain/contract-events';
import { AppException } from '../src/common/errors/app.exception';
import type { EventBus } from '../src/events/event-bus';
import { quoteNumberOf } from '../src/orders/domain/quote-number';
import type { OrdersService } from '../src/orders/orders.service';
import type { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { SettingsService } from '../src/settings/settings.service';
import type { StoragePort } from '../src/storage/storage.port';

/**
 * Unit `ContractsService` — HERMETIC. Every collaborator is a mock that appends to ONE log, so the
 * order of the pipeline (scope → [lock → fresh → read → blocker → seq → render → upload → create]
 * → commit → publish) is asserted directly, and each failing step is shown to stop everything
 * after it. The transaction mock RUNS its callback and logs the commit only when it resolves, so
 * "publish after commit" is measured, not assumed.
 */

const ORDER_ID = '3f2a9b1c-1111-4222-8333-444444444444';
const VERSION_ID = 'aaaaaaaa-1111-4222-8333-444444444444';
const ACTOR = 'acc-contracts-1';
const PERMS = new Set<string>(['orders.view_all', 'contracts.generate']);
const PDF = Buffer.from('%PDF-1.4 test');
/** 76.862.000 + VAT 8% (snapshotted on the version) = 83.010.960. */
const TOTAL = 83_010_960;

describe('ContractsService (unit, hermetic)', () => {
  let log: string[];
  let view: Record<string, unknown>;
  let schedule: unknown;
  let getScoped: jest.Mock;
  let assertScoped: jest.Mock;
  let queryRaw: jest.Mock;
  let renderPdf: jest.Mock;
  let putObject: jest.Mock;
  let getObject: jest.Mock;
  let create: jest.Mock;
  let findFirst: jest.Mock;
  let findMany: jest.Mock;
  let publish: jest.Mock;
  let transaction: jest.Mock;
  let fresh: { status: string; currentVersionId: string } | null;
  let service: ContractsService;

  const step =
    <T>(name: string, value?: T) =>
    () => {
      log.push(name);
      return Promise.resolve(value);
    };

  beforeEach(() => {
    log = [];
    view = {
      id: ORDER_ID,
      status: 'dachot',
      customerSdt: '+84901234567',
      currentVersionId: VERSION_ID,
      scopeThietBi: true,
      scopeThiCong: true,
      scopeVanChuyen: false,
      kWp: 10,
      vatMode: 'co_vat',
      discount: null,
      lineItems: [
        {
          name: 'Hệ 10kWp',
          unit: 'Bộ',
          qty: 1,
          unitPrice: 76_862_000,
          amount: 76_862_000,
          warrantyMonths: 120,
        },
      ],
    };
    schedule = {
      installments: [
        { seq: 1, percent: 20, amount: 16_602_192, conditionNote: 'Cọc' },
        { seq: 2, percent: 70, amount: 58_107_672, conditionNote: 'TC' },
        { seq: 3, percent: 10, amount: 8_301_096, conditionNote: 'NT' },
      ],
    };
    getScoped = jest.fn().mockImplementation(() => step('scope', view)());
    assertScoped = jest.fn().mockImplementation(step('scope'));
    fresh = { status: 'dachot', currentVersionId: VERSION_ID };
    queryRaw = jest
      .fn()
      .mockImplementation((sql: TemplateStringsArray) =>
        sql.join('?').includes('FOR UPDATE')
          ? step('lock', [{ id: ORDER_ID }])()
          : step('seq', [{ seq: 41n }])(),
      );
    renderPdf = jest.fn().mockImplementation(step('render', PDF));
    putObject = jest.fn().mockImplementation(step('upload'));
    getObject = jest
      .fn()
      .mockImplementation(step('download', { body: PDF, contentType: 'x' }));
    create = jest.fn().mockImplementation(step('create'));
    findFirst = jest.fn().mockResolvedValue(null);
    findMany = jest.fn().mockResolvedValue([]);
    publish = jest.fn().mockImplementation(step('publish'));
    const prisma = {
      order: {
        findUnique: jest.fn().mockImplementation(() => step('fresh', fresh)()),
      },
      customer: {
        findUnique: jest.fn().mockImplementation(() =>
          step('read', {
            sdt: '+84901234567',
            name: 'Nguyễn Văn Khách',
            address: null,
            cccd: null,
            taxCode: null,
            bankAccount: null,
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
      paymentSchedule: {
        findUnique: jest
          .fn()
          .mockImplementation(() => step('read', schedule)()),
      },
      contract: { create, findFirst, findMany },
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
    const settings = {
      companyLegalEntity: jest.fn().mockResolvedValue({
        legalName: '',
        taxCode: '',
        address: '',
        representative: '',
        representativeTitle: '',
        phone: '',
        bankAccount: '',
      }),
    } as unknown as SettingsService;
    service = new ContractsService(
      { getScoped, assertScoped } as unknown as OrdersService,
      prisma,
      { publish } as unknown as EventBus,
      { putObject, getObject } as unknown as StoragePort,
      { renderPdf } as unknown as QuoteRendererPort,
      settings,
    );
  });

  const generate = () => service.generate(ACTOR, PERMS, ORDER_ID, 8, false);

  async function rejection(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (e) {
      return e as AppException;
    }
    throw new Error('expected a rejection');
  }

  describe('generate — happy path', () => {
    it('runs scope → [lock → fresh → read → seq → render → upload → create] → commit → publish, each once', async () => {
      await generate();

      expect(log).toEqual([
        'scope',
        'lock',
        'fresh',
        'read',
        'read',
        'read',
        'seq',
        'render',
        'upload',
        'create',
        'commit',
        'publish',
      ]);
      expect(getScoped).toHaveBeenCalledWith(ACTOR, PERMS, ORDER_ID, false);
      expect(renderPdf).toHaveBeenCalledTimes(1);
      expect(putObject).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);
      // ONE transaction; its first statement is the order row lock, then the number.
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(queryRaw).toHaveBeenCalledTimes(2);
      const lockSql = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join(
        '?',
      );
      expect(lockSql).toBe('SELECT id FROM orders WHERE id = ? FOR UPDATE');
      expect(queryRaw.mock.calls[0][1]).toBe(ORDER_ID);
    });

    it('reserves the number with nextval (not count()+1) and prints it', async () => {
      const result = await generate();

      const sql = (queryRaw.mock.calls[1][0] as TemplateStringsArray).join('?');
      expect(sql).toContain(
        "nextval(pg_get_serial_sequence('contracts', 'seq'))",
      );
      expect(result.contractNo).toMatch(/^HĐTC-41\/\d{4}$/);
      const html = renderPdf.mock.calls[0][0] as string;
      expect(html).toContain(result.contractNo);
      expect(html).toContain('HỢP ĐỒNG THI CÔNG');
      expect(html).not.toContain('HỢP ĐỒNG MUA BÁN');
    });

    it('uploads the renderer bytes under contracts/{orderId}/{id}.pdf and writes the metadata row', async () => {
      const result = await generate();

      expect(putObject).toHaveBeenCalledWith(
        `contracts/${ORDER_ID}/${result.id}.pdf`,
        PDF,
        'application/pdf',
      );
      expect(create).toHaveBeenCalledWith({
        data: {
          id: result.id,
          seq: 41,
          orderId: ORDER_ID,
          orderVersionId: VERSION_ID,
          type: 'construction',
          contractNo: result.contractNo,
          pdfKey: `contracts/${ORDER_ID}/${result.id}.pdf`,
          pdfSize: PDF.length,
          fileName: 'hop-dong-thi-cong-41',
          createdByAccountId: ACTOR,
          createdAt: result.createdAt,
        },
      });
      expect(result).toEqual({
        id: result.id,
        contractNo: result.contractNo,
        contractType: 'construction',
        versionNo: 2,
        fileName: 'hop-dong-thi-cong-41',
        pdfSize: PDF.length,
        createdAt: result.createdAt,
      });
    });

    it('publishes ContractGenerated targeting the order, occurredAt = createdAt, no customer data', async () => {
      const result = await generate();

      const event = publish.mock.calls[0][0] as ContractGenerated;
      expect(event).toBeInstanceOf(ContractGenerated);
      expect(event.target).toEqual({ type: 'Order', id: ORDER_ID });
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.occurredAt).toBe(result.createdAt);
      expect(event.after).toEqual({
        contractId: result.id,
        contractNo: result.contractNo,
        contractType: 'construction',
        orderVersionId: VERSION_ID,
        fileName: 'hop-dong-thi-cong-41',
      });
      expect(JSON.stringify(event)).not.toContain('Nguyễn Văn Khách');
    });

    it('equipment only ⇒ sale contract HĐMB-…, hop-dong-mua-ban-…', async () => {
      view.scopeThiCong = false;

      const result = await generate();

      expect(result.contractType).toBe('sale');
      expect(result.contractNo).toMatch(/^HĐMB-41\/\d{4}$/);
      expect(result.fileName).toBe('hop-dong-mua-ban-41');
      expect(renderPdf.mock.calls[0][0]).toContain('HỢP ĐỒNG MUA BÁN');
    });

    it('cites the same quote number as the printed quote, and the resolved total', async () => {
      await generate();

      const html = renderPdf.mock.calls[0][0] as string;
      expect(html).toContain(quoteNumberOf(ORDER_ID));
      expect(html).toContain('83.010.960');
    });

    it('two generations ⇒ two ids, two keys (never overwritten)', async () => {
      const a = await generate();
      queryRaw.mockImplementation(step('seq', [{ seq: 42n }]));
      const b = await generate();

      expect(a.id).not.toBe(b.id);
      expect(a.contractNo).not.toBe(b.contractNo);
      expect(putObject.mock.calls[0][0]).not.toBe(putObject.mock.calls[1][0]);
    });
  });

  describe('generate — a failing step stops everything after it', () => {
    it('renderer throws ⇒ 0 upload, 0 create, 0 publish', async () => {
      renderPdf.mockRejectedValue(new Error('chromium'));

      await expect(generate()).rejects.toThrow('chromium');
      expect(putObject).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('upload throws ⇒ 0 create, 0 publish', async () => {
      putObject.mockRejectedValue(new Error('r2'));

      await expect(generate()).rejects.toThrow('r2');
      expect(create).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('create throws ⇒ 0 publish', async () => {
      create.mockRejectedValue(new Error('db'));

      await expect(generate()).rejects.toThrow('db');
      expect(publish).not.toHaveBeenCalled();
    });

    it('scope throws ⇒ nothing read, rendered or written', async () => {
      getScoped.mockRejectedValue(new Error('404'));

      await expect(generate()).rejects.toThrow('404');
      expect(log).toEqual([]);
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('generate — refused orders (same messages as the overview)', () => {
    const cases: [string, () => void, number, string][] = [
      [
        'baogia',
        () => {
          view.status = 'baogia';
          fresh = { status: 'baogia', currentVersionId: VERSION_ID };
        },
        409,
        CONTRACT_BLOCKED_MESSAGE.status,
      ],
      [
        'huy',
        () => {
          view.status = 'huy';
          fresh = { status: 'huy', currentVersionId: VERSION_ID };
        },
        409,
        CONTRACT_BLOCKED_MESSAGE.status,
      ],
      [
        'no lines',
        () => (view.lineItems = []),
        400,
        CONTRACT_BLOCKED_MESSAGE.noLines,
      ],
      [
        'no schedule',
        () => (schedule = null),
        409,
        CONTRACT_BLOCKED_MESSAGE.noSchedule,
      ],
      [
        'schedule off by 1 đồng',
        () =>
          (schedule = {
            installments: [
              { seq: 1, percent: null, amount: TOTAL - 1, conditionNote: '' },
            ],
          }),
        409,
        CONTRACT_BLOCKED_MESSAGE.scheduleMismatch,
      ],
    ];

    it.each(cases)(
      '%s ⇒ %i, no seq/render/upload/create/publish',
      async (_name, arrange, status, message) => {
        arrange();

        const error = await rejection(generate());

        expect(error).toBeInstanceOf(AppException);
        expect(error.getStatus()).toBe(status);
        expect(error.message).toBe(message);
        expect(log).not.toContain('seq');
        expect(log).not.toContain('commit');
        expect(renderPdf).not.toHaveBeenCalled();
        expect(putObject).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
      },
    );

    it.each(cases)(
      'overview of %s ⇒ generatable:false + the same message',
      async (_name, arrange, _status, message) => {
        arrange();

        const overview = await service.overview(
          ACTOR,
          PERMS,
          ORDER_ID,
          8,
          false,
        );

        expect(overview.generatable).toBe(false);
        expect(overview.blockedReason).toBe(message);
      },
    );

    it('hoanthanh may still print', async () => {
      view.status = 'hoanthanh';
      fresh = { status: 'hoanthanh', currentVersionId: VERSION_ID };

      await expect(generate()).resolves.toMatchObject({
        contractType: 'construction',
      });
    });
  });

  describe('generate — state re-read under the order row lock', () => {
    it('reopened between the scoped read and the lock ⇒ 409 status, no number taken', async () => {
      fresh = { status: 'baogia', currentVersionId: VERSION_ID };

      const error = await rejection(generate());

      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(CONTRACT_BLOCKED_MESSAGE.status);
      expect(log).toEqual(['scope', 'lock', 'fresh', 'read', 'read', 'read']);
      expect(renderPdf).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('revised between the scoped read and the lock ⇒ 409 "Đơn vừa thay đổi", nothing read further', async () => {
      fresh = {
        status: 'dachot',
        currentVersionId: 'bbbbbbbb-1111-4222-8333-444444444444',
      };

      const error = await rejection(generate());

      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(ORDER_CHANGED_MESSAGE);
      expect(log).toEqual(['scope', 'lock', 'fresh']);
      expect(create).not.toHaveBeenCalled();
    });

    it('confirmed between the scoped read and the lock (same version) ⇒ 409 "Đơn vừa thay đổi", the quote-time lines never printed', async () => {
      view = { ...view, status: 'baogia' };
      fresh = { status: 'dachot', currentVersionId: VERSION_ID };

      const error = await rejection(generate());

      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(ORDER_CHANGED_MESSAGE);
      expect(log).toEqual(['scope', 'lock', 'fresh']);
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(renderPdf).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('a payment advanced the status meanwhile (dacoc) ⇒ still generated', async () => {
      fresh = { status: 'dacoc', currentVersionId: VERSION_ID };

      await expect(generate()).resolves.toMatchObject({
        contractType: 'construction',
      });
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('overview', () => {
    it('server-built fields: type, quote no, total, schedule label, missing party fields, contracts', async () => {
      const createdAt = new Date('2026-10-22T03:00:00Z');
      findMany.mockResolvedValue([
        {
          id: 'c-2',
          contractNo: 'HĐTC-2/2026',
          type: 'construction',
          orderVersion: { versionNo: 2 },
          fileName: 'hop-dong-thi-cong-2',
          pdfSize: 10,
          createdAt,
        },
      ]);

      const overview = await service.overview(ACTOR, PERMS, ORDER_ID, 8, false);

      expect(overview).toEqual({
        contractType: 'construction',
        generatable: true,
        blockedReason: null,
        quoteNo: quoteNumberOf(ORDER_ID),
        versionNo: 2,
        customerName: 'Nguyễn Văn Khách',
        lineCount: 1,
        orderTotal: TOTAL,
        scheduleLabel: '20/70/10',
        missingPartyFields: [
          'Tên công ty',
          'Mã số thuế',
          'Địa chỉ',
          'Người đại diện',
          'Chức danh',
          'Điện thoại',
          'Tài khoản ngân hàng',
        ],
        contracts: [
          {
            id: 'c-2',
            contractNo: 'HĐTC-2/2026',
            contractType: 'construction',
            versionNo: 2,
            fileName: 'hop-dong-thi-cong-2',
            pdfSize: 10,
            createdAt,
          },
        ],
      });
      expect(findMany).toHaveBeenCalledWith({
        where: { orderId: ORDER_ID },
        include: { orderVersion: { select: { versionNo: true } } },
        orderBy: [{ createdAt: 'desc' }, { seq: 'desc' }],
      });
      expect(log[0]).toBe('scope');
    });
  });

  describe('getPdf', () => {
    it('scope first, contract looked up BY id AND orderId, then R2', async () => {
      findFirst.mockImplementation(
        step('lookup', {
          id: 'c-1',
          pdfKey: 'contracts/x/c-1.pdf',
          fileName: 'hop-dong-mua-ban-3',
        }),
      );

      const file = await service.getPdf(ACTOR, PERMS, ORDER_ID, 'c-1');

      expect(log).toEqual(['scope', 'lookup', 'download']);
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'c-1', orderId: ORDER_ID },
      });
      expect(getObject).toHaveBeenCalledWith('contracts/x/c-1.pdf');
      expect(file).toEqual({ body: PDF, fileName: 'hop-dong-mua-ban-3.pdf' });
    });

    it('contract of another order ⇒ 404 "Không tìm thấy hợp đồng." and R2 is never touched', async () => {
      findFirst.mockResolvedValue(null);

      const error = await rejection(
        service.getPdf(ACTOR, PERMS, ORDER_ID, 'c-other'),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Không tìm thấy hợp đồng.');
      expect(getObject).not.toHaveBeenCalled();
    });

    it('out of scope ⇒ the scope error, no lookup', async () => {
      assertScoped.mockRejectedValue(new Error('404'));

      await expect(
        service.getPdf(ACTOR, PERMS, ORDER_ID, 'c-1'),
      ).rejects.toThrow('404');
      expect(findFirst).not.toHaveBeenCalled();
      expect(getObject).not.toHaveBeenCalled();
    });
  });
});
