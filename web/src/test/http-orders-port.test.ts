// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpOrdersPort } from '../api/http-orders-port';
import { BASE, envelope, json, setupHarness, target } from './http-adapter-harness';

const ORDER = {
  id: 'o1',
  status: 'baogia',
  customerPhone: '+84903176968',
  currentVersionId: 'v1',
  ownerAccountId: 'acc-1',
  assigneeAccountId: null,
  sourceId: 'src-1',
  custType: 'CA_NHAN',
  scopeEquipment: true,
  scopeConstruction: false,
  scopeDelivery: true,
  kWp: 8.82,
  vatMode: 'co_vat',
  validityNote: null,
  cancelReason: null,
  cancelledAt: null,
  lineItems: [],
  discount: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
const LINE = {
  id: 'l1',
  productId: 'p1',
  name: 'Tấm pin 550W',
  unit: 'tấm',
  qty: 16,
  unitPrice: 2_500_000,
  priceEditable: false,
  isFlexible: false,
  note: null,
  warrantyMonths: 144,
  displayOrder: 1,
  amount: 40_000_000,
};
const VERSION = {
  id: 'v1',
  versionNo: 1,
  isCurrent: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  confirmedAt: null,
  createdByAccountId: 'acc-1',
  createdByDisplayName: 'Sale An',
  lineCount: 1,
  changes: { added: [], removed: [], qtyChanged: [] },
};
const ATTACHMENT = {
  id: 'a1',
  fileName: 'giao-hang.jpg',
  contentType: 'image/jpeg',
  size: 1024,
  createdAt: '2026-10-01T00:00:00.000Z',
  uploadedBy: 'Kho Bình',
  statusFrom: 'danggiao',
  statusTo: 'dagiao',
  canDelete: true,
};
const VOUCHER = {
  id: 'pk1',
  code: 'PK-X-0097',
  type: 'xuat',
  orderId: 'o1',
  createdAt: '2026-10-01T00:00:00.000Z',
  createdBy: { id: 'acc-kho', displayName: 'Kho Bình' },
  lineCount: 1,
  totalQty: 16,
  note: null,
  lines: [{ productId: 'p1', name: 'Tấm pin 550W', sku: 'PIN-550', unit: 'tấm', qty: 16 }],
  canReturn: false,
};

function photo(name: string, type = 'image/jpeg'): File {
  return new File([`bytes-of-${name}`], name, { type });
}

/** Answers by `METHOD /path`; anything else is a 500 the test would see. */
function routes(table: Record<string, (request: Request) => Response | Promise<Response>>) {
  return (request: Request) => {
    const key = `${request.method} ${new URL(request.url).pathname}`;
    const handler = table[key];
    return handler ? handler(request) : json(500, { unexpected: key });
  };
}

async function bodyOf(request: Request): Promise<unknown> {
  return JSON.parse(await request.text());
}

describe('HttpOrdersPort — reads', () => {
  it('get GETs the order by id', async () => {
    const h = setupHarness(() => json(200, ORDER));
    await expect(new HttpOrdersPort(h.client).get('o1')).resolves.toEqual(ORDER);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/orders/o1');
  });

  it('list sends only the filters given (no followUp/page/pageSize keys when absent)', async () => {
    const page = { items: [], total: 0, page: 1, pageSize: 20 };
    const h = setupHarness(() => json(200, page));
    await expect(new HttpOrdersPort(h.client).list({ status: 'baogia' })).resolves.toEqual(page);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/orders?status=baogia');
  });

  it('list passes followUp as a boolean and the page', async () => {
    const h = setupHarness(() => json(200, { items: [], total: 0, page: 2, pageSize: 20 }));
    await new HttpOrdersPort(h.client).list({ followUp: true, page: 2 });
    expect(target(h.requests[0])).toBe('/orders?followUp=true&page=2');
  });

  it('getLifecycle GETs the lifecycle as the backend computed it', async () => {
    const lifecycle = {
      steps: [{ status: 'baogia', progress: 'current' }],
      nextSteps: [],
      canCancel: true,
    };
    const h = setupHarness(() => json(200, lifecycle));
    await expect(new HttpOrdersPort(h.client).getLifecycle('o1')).resolves.toEqual(lifecycle);
    expect(target(h.requests[0])).toBe('/orders/o1/lifecycle');
  });

  it('listVersions unwraps `items`', async () => {
    const h = setupHarness(() => json(200, { items: [VERSION] }));
    await expect(new HttpOrdersPort(h.client).listVersions('o1')).resolves.toEqual([VERSION]);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/orders/o1/versions');
  });

  it('listAttachments unwraps `items`', async () => {
    const h = setupHarness(() => json(200, { items: [ATTACHMENT] }));
    await expect(new HttpOrdersPort(h.client).listAttachments('o1')).resolves.toEqual([ATTACHMENT]);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/orders/o1/attachments');
  });

  it('listPendingDiscounts GETs the approval queue', async () => {
    const items = [{ orderId: 'o1', customerPhone: '+84903176968', amount: 1_000_000, lines: [] }];
    const h = setupHarness(() => json(200, items));
    await expect(new HttpOrdersPort(h.client).listPendingDiscounts()).resolves.toEqual(items);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/orders/pending-discount-approvals');
  });

  it('getStockIssue and getStockCheck GET the two stock views', async () => {
    const view = { issued: false, canIssue: true, blocked: false, lines: [], untrackedItems: [] };
    const check = { lines: [] };
    const h = setupHarness(
      routes({
        'GET /orders/o1/stock-issue': () => json(200, view),
        'GET /orders/o1/stock-check': () => json(200, check),
      }),
    );
    const port = new HttpOrdersPort(h.client);
    await expect(port.getStockIssue('o1')).resolves.toEqual(view);
    await expect(port.getStockCheck('o1')).resolves.toEqual(check);
    expect(h.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('attachmentBytes returns the Blob with the media type of the response', async () => {
    const h = setupHarness(
      () => new Response('jpeg-bytes', { status: 200, headers: { 'content-type': 'image/webp' } }),
    );
    const blob = await new HttpOrdersPort(h.client).attachmentBytes('o1', 'a1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/webp');
    expect(await blob.text()).toBe('jpeg-bytes');
    expect(target(h.requests[0])).toBe('/orders/o1/attachments/a1');
  });
});

describe('HttpOrdersPort — writes', () => {
  it('create POSTs the RAW phone in `customerPhone`', async () => {
    const h = setupHarness(() => json(201, ORDER));
    await expect(new HttpOrdersPort(h.client).create({ customerPhone: '0903 176 968' })).resolves.toEqual(ORDER);
    expect(h.requests[0].method).toBe('POST');
    expect(target(h.requests[0])).toBe('/orders');
    expect(await bodyOf(h.requests[0])).toEqual({ customerPhone: '0903 176 968' });
  });

  it('addLine / updateLine / removeLine hit the line-item routes with the given body', async () => {
    const h = setupHarness(
      routes({
        'POST /orders/o1/line-items': () => json(201, LINE),
        'PATCH /orders/o1/line-items/l1': () => json(200, { ...LINE, qty: 20 }),
        'DELETE /orders/o1/line-items/l1': () => new Response(null, { status: 204 }),
      }),
    );
    const port = new HttpOrdersPort(h.client);
    await expect(port.addLine('o1', { productId: 'p1', qty: 16 })).resolves.toEqual(LINE);
    await expect(port.updateLine('o1', 'l1', { qty: 20, warrantyMonths: null })).resolves.toEqual({ ...LINE, qty: 20 });
    await expect(port.removeLine('o1', 'l1')).resolves.toBeUndefined();
    expect(h.fetchImpl).toHaveBeenCalledTimes(3);
    expect(await bodyOf(h.requests[0])).toEqual({ productId: 'p1', qty: 16 });
    // `null` is "clear the warranty", so it must travel as null, not vanish.
    expect(await bodyOf(h.requests[1])).toEqual({ qty: 20, warrantyMonths: null });
    expect(h.requests[2].method).toBe('DELETE');
  });

  it('updateScopeFlags and updateOrderMeta both PATCH /orders/{id} with only their group', async () => {
    const h = setupHarness(() => json(200, ORDER));
    const port = new HttpOrdersPort(h.client);
    await expect(port.updateScopeFlags('o1', { scopeConstruction: true })).resolves.toEqual(ORDER);
    await expect(port.updateOrderMeta('o1', { vatMode: 'khong_vat', kWp: null })).resolves.toEqual(ORDER);
    expect(h.fetchImpl).toHaveBeenCalledTimes(2);
    for (const request of h.requests) {
      expect(request.method).toBe('PATCH');
      expect(target(request)).toBe('/orders/o1');
    }
    expect(await bodyOf(h.requests[0])).toEqual({ scopeConstruction: true });
    expect(await bodyOf(h.requests[1])).toEqual({ vatMode: 'khong_vat', kWp: null });
  });

  it('previewTotal POSTs the displayed lines and returns the backend totals untouched', async () => {
    const totals = { subtotal: 40_000_000, discountAmount: 0, vatAmount: 3_200_000, total: 43_200_000, vatRate: 8, applyVat: true };
    const h = setupHarness(() => json(200, totals));
    const input = { lines: [{ unitPrice: 2_500_000, qty: 16 }], vatMode: 'co_vat' as const };
    await expect(new HttpOrdersPort(h.client).previewTotal(input)).resolves.toEqual(totals);
    expect(target(h.requests[0])).toBe('/orders/preview-total');
    expect(await bodyOf(h.requests[0])).toEqual(input);
  });

  it('confirmOrder → /confirm, reviseOrder → /reopen, both without a body', async () => {
    const h = setupHarness(() => json(200, ORDER));
    const port = new HttpOrdersPort(h.client);
    await port.confirmOrder('o1');
    await port.reviseOrder('o1');
    expect(h.requests.map((r) => `${r.method} ${target(r)}`)).toEqual([
      'POST /orders/o1/confirm',
      'POST /orders/o1/reopen',
    ]);
  });

  it('applyDiscount / resolveDiscount POST their bodies', async () => {
    const h = setupHarness(() => json(200, ORDER));
    const port = new HttpOrdersPort(h.client);
    await port.applyDiscount('o1', { amount: 1_000_000, note: 'Khách quen' });
    await port.resolveDiscount('o1', { approve: false, reason: 'Vượt hạn mức' });
    expect(target(h.requests[0])).toBe('/orders/o1/apply-discount');
    expect(await bodyOf(h.requests[0])).toEqual({ amount: 1_000_000, note: 'Khách quen' });
    expect(target(h.requests[1])).toBe('/orders/o1/resolve-discount');
    expect(await bodyOf(h.requests[1])).toEqual({ approve: false, reason: 'Vượt hạn mức' });
  });

  it('cancel POSTs `{reason}` and resolves undefined', async () => {
    const h = setupHarness(() => json(200, { status: 'huy', occurredAt: '2026-10-01T00:00:00.000Z' }));
    await expect(new HttpOrdersPort(h.client).cancel('o1', 'Khách đổi ý')).resolves.toBeUndefined();
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/orders/o1/cancel');
    expect(await h.requests[0].text()).toBe('{"reason":"Khách đổi ý"}');
  });

  it('cancel rejects a 400 with the `reason` field error', async () => {
    const h = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', [
        { field: 'reason', code: 'minLength', message: 'Tối thiểu 3 ký tự.' },
      ]),
    );
    const error = await new HttpOrdersPort(h.client).cancel('o1', 'a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: [{ field: 'reason', code: 'minLength', message: 'Tối thiểu 3 ký tự.' }],
    });
  });

  it('issueStock resolves the voucher on 201 (first issue) and on 200 (replay)', async () => {
    let calls = 0;
    const h = setupHarness(() => json(++calls === 1 ? 201 : 200, { voucher: VOUCHER }));
    const port = new HttpOrdersPort(h.client);
    await expect(port.issueStock('o1')).resolves.toEqual({ voucher: VOUCHER });
    await expect(port.issueStock('o1')).resolves.toEqual({ voucher: VOUCHER });
    expect(h.fetchImpl).toHaveBeenCalledTimes(2);
    expect(h.requests.every((r) => r.method === 'POST' && target(r) === '/orders/o1/stock-issue')).toBe(true);
  });

  it('removeAttachment DELETEs one photo (204, no body to read)', async () => {
    const h = setupHarness(() => new Response(null, { status: 204 }));
    await expect(new HttpOrdersPort(h.client).removeAttachment('o1', 'a1')).resolves.toBeUndefined();
    expect(h.requests[0].method).toBe('DELETE');
    expect(target(h.requests[0])).toBe('/orders/o1/attachments/a1');
  });
});

describe('HttpOrdersPort — multipart uploads', () => {
  it('transition sends multipart: `event` plus one `files` part per photo, by name', async () => {
    const h = setupHarness(() => json(200, { status: 'dagiao', occurredAt: '2026-10-01T00:00:00.000Z', savedAttachmentCount: 2 }));
    const result = await new HttpOrdersPort(h.client).transition('o1', 'xong_giao', [photo('a.jpg'), photo('b.png', 'image/png')]);
    expect(result).toEqual({ status: 'dagiao', occurredAt: '2026-10-01T00:00:00.000Z', savedAttachmentCount: 2 });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    const request = h.requests[0];
    expect(request.method).toBe('POST');
    expect(target(request)).toBe('/orders/o1/transition');
    expect(request.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
    const form = await request.formData();
    expect(form.get('event')).toBe('xong_giao');
    const files = form.getAll('files') as File[];
    expect(files.map((f) => f.name)).toEqual(['a.jpg', 'b.png']);
    expect(await files[0].text()).toBe('bytes-of-a.jpg');
  });

  it('transition with no photo is the ordinary path: no `files` part at all', async () => {
    const h = setupHarness(() => json(200, { status: 'dacoc', occurredAt: '', savedAttachmentCount: 0 }));
    await new HttpOrdersPort(h.client).transition('o1', 'bat_dau_giao', []);
    const form = await h.requests[0].formData();
    expect(form.get('event')).toBe('bat_dau_giao');
    expect(form.has('files')).toBe(false);
  });

  it('transition 401 → one refresh → the replay still carries every part', async () => {
    const h = setupHarness(
      routes({
        'POST /orders/o1/transition': (request) =>
          request.headers.get('authorization') === 'Bearer access-2'
            ? json(200, { status: 'dagiao', occurredAt: '', savedAttachmentCount: 2 })
            : envelope(401, 'UNAUTHENTICATED', 'Phiên hết hạn'),
        'POST /auth/refresh': () => json(200, { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 }),
      }),
    );
    const result = await new HttpOrdersPort(h.client).transition('o1', 'xong_giao', [photo('a.jpg'), photo('b.jpg')]);
    expect(result.savedAttachmentCount).toBe(2);
    expect(h.fetchImpl).toHaveBeenCalledTimes(3);
    const replay = h.requests[2];
    expect(replay.url).toBe(`${BASE}/orders/o1/transition`);
    expect(replay.headers.get('authorization')).toBe('Bearer access-2');
    const form = await replay.formData();
    expect(form.get('event')).toBe('xong_giao');
    expect((form.getAll('files') as File[]).map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('addAttachments sends multipart with field `files` and resolves undefined', async () => {
    const h = setupHarness(() => json(201, { savedAttachmentCount: 1, attachmentIds: ['a9'] }));
    await expect(new HttpOrdersPort(h.client).addAttachments('o1', [photo('bo-sung.heic', 'image/heic')])).resolves.toBeUndefined();
    const request = h.requests[0];
    expect(target(request)).toBe('/orders/o1/attachments');
    expect(request.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
    const form = await request.formData();
    expect((form.getAll('files') as File[]).map((f) => f.name)).toEqual(['bo-sung.heic']);
    expect(form.has('event')).toBe(false);
  });

  it('a rejected photo surfaces the envelope and its fieldErrors', async () => {
    const h = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Ảnh không hợp lệ', [
        { field: 'files.0', code: 'FILE_TOO_LARGE', message: 'Ảnh vượt 10 MB.' },
      ]),
    );
    await expect(new HttpOrdersPort(h.client).addAttachments('o1', [photo('big.jpg')])).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: [{ field: 'files.0', code: 'FILE_TOO_LARGE', message: 'Ảnh vượt 10 MB.' }],
    });
  });
});

describe('HttpOrdersPort — quote export', () => {
  it('exportQuote: POST export-quote, then GET image, then GET pdf; names from the metadata', async () => {
    const h = setupHarness(
      routes({
        'POST /orders/o1/export-quote': () =>
          json(200, {
            orderId: 'o1',
            orderVersionId: 'v1',
            exportedAt: '2026-10-01T00:00:00.000Z',
            image: { fileName: 'BG-0001.png', size: 3 },
            pdf: { fileName: 'BG-0001.pdf', size: 4 },
          }),
        'GET /orders/o1/quote/image': () =>
          new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } }),
        'GET /orders/o1/quote/pdf': () =>
          new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { 'content-type': 'application/pdf' } }),
      }),
    );
    const files = await new HttpOrdersPort(h.client).exportQuote('o1');
    expect(h.fetchImpl).toHaveBeenCalledTimes(3);
    expect(h.requests.map((r) => `${r.method} ${target(r)}`)).toEqual([
      'POST /orders/o1/export-quote',
      'GET /orders/o1/quote/image',
      'GET /orders/o1/quote/pdf',
    ]);
    expect(files.image.fileName).toBe('BG-0001.png');
    expect(files.image.mimeType).toBe('image/png');
    expect([...files.image.bytes]).toEqual([1, 2, 3]);
    expect(files.pdf.fileName).toBe('BG-0001.pdf');
    expect(files.pdf.mimeType).toBe('application/pdf');
    expect([...files.pdf.bytes]).toEqual([37, 80, 68, 70]);
  });

  it('exportQuote falls back to image/png and application/pdf when a file response has no Content-Type', async () => {
    const h = setupHarness(
      routes({
        'POST /orders/o1/export-quote': () =>
          json(200, {
            orderId: 'o1',
            orderVersionId: 'v1',
            exportedAt: '2026-10-01T00:00:00.000Z',
            image: { fileName: 'BG-0001.png', size: 1 },
            pdf: { fileName: 'BG-0001.pdf', size: 1 },
          }),
        'GET /orders/o1/quote/image': () => new Response(new Uint8Array([1]), { status: 200 }),
        'GET /orders/o1/quote/pdf': () => new Response(new Uint8Array([2]), { status: 200 }),
      }),
    );
    const files = await new HttpOrdersPort(h.client).exportQuote('o1');
    expect(files.image.mimeType).toBe('image/png');
    expect(files.pdf.mimeType).toBe('application/pdf');
  });

  it('exportQuote stops at the first refusal (no file fetched for an empty quote)', async () => {
    const h = setupHarness(() => envelope(400, 'VALIDATION_ERROR', 'Báo giá chưa có dòng nào.'));
    await expect(new HttpOrdersPort(h.client).exportQuote('o1')).rejects.toMatchObject({
      status: 400,
      message: 'Báo giá chưa có dòng nào.',
    });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('HttpOrdersPort — errors', () => {
  it('a 404 envelope is rejected as ApiError with status, code and message', async () => {
    const h = setupHarness(() => envelope(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.'));
    const error = await new HttpOrdersPort(h.client).get('o-missing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
  });

  it('a 409 on a status-changing write is rejected, not swallowed', async () => {
    const h = setupHarness(() => envelope(409, 'CONFLICT', 'Đơn không ở trạng thái báo giá.'));
    await expect(new HttpOrdersPort(h.client).confirmOrder('o1')).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Đơn không ở trạng thái báo giá.',
    });
  });
});
