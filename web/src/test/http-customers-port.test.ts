// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpCustomersPort } from '../api/http-customers-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const CUSTOMER = {
  phone: '+84903176968',
  custType: 'CA_NHAN',
  name: 'Nguyễn Văn A',
  nationalId: '079201001234',
  taxCode: null,
  address: null,
  bankAccount: null,
  sourceId: 'src-1',
  sourceNote: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('HttpCustomersPort', () => {
  it('lookup sends the RAW phone in the query (no client normalisation, AD-9)', async () => {
    const h = setupHarness(() => json(200, { found: true, phone: '+84903176968', customer: CUSTOMER }));
    const result = await new HttpCustomersPort(h.client).lookup('0903 176 968');
    expect(result).toEqual({ found: true, phone: '+84903176968', customer: CUSTOMER });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(h.requests[0].url);
    expect(h.requests[0].method).toBe('GET');
    expect(url.pathname).toBe('/customers/lookup');
    expect(url.searchParams.get('phone')).toBe('0903 176 968');
  });

  it('lookup rejects an invalid phone with the envelope and its fieldErrors', async () => {
    const h = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Số điện thoại không hợp lệ.', [
        { field: 'phone', code: 'INVALID_PHONE', message: 'Số điện thoại không hợp lệ.' },
      ]),
    );
    const error = await new HttpCustomersPort(h.client).lookup('abc').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Số điện thoại không hợp lệ.',
      fieldErrors: [{ field: 'phone', code: 'INVALID_PHONE', message: 'Số điện thoại không hợp lệ.' }],
    });
  });

  it('get encodes the E.164 plus in the path segment', async () => {
    const h = setupHarness(() => json(200, CUSTOMER));
    await expect(new HttpCustomersPort(h.client).get('+84903176968')).resolves.toEqual(CUSTOMER);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(new URL(h.requests[0].url).pathname).toBe('/customers/%2B84903176968');
  });

  it('get rejects NOT_FOUND as ApiError', async () => {
    const h = setupHarness(() => envelope(404, 'NOT_FOUND', 'Không tìm thấy khách hàng.'));
    await expect(new HttpCustomersPort(h.client).get('+84900000000')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Không tìm thấy khách hàng.',
    });
  });

  it('list leaves absent filters out of the query', async () => {
    const page = { items: [CUSTOMER], total: 1, page: 1, pageSize: 20 };
    const h = setupHarness(() => json(200, page));
    await expect(new HttpCustomersPort(h.client).list({ q: 'an' })).resolves.toEqual(page);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/customers?q=an');
  });

  it('list passes every present filter', async () => {
    const h = setupHarness(() => json(200, { items: [], total: 0, page: 2, pageSize: 20 }));
    await new HttpCustomersPort(h.client).list({ q: '0903', custType: 'THUONG_MAI', page: 2 });
    const params = new URL(h.requests[0].url).searchParams;
    expect(params.get('q')).toBe('0903');
    expect(params.get('custType')).toBe('THUONG_MAI');
    expect(params.get('page')).toBe('2');
  });

  it('create POSTs the body untouched and resolves the created customer', async () => {
    const h = setupHarness(() => json(201, CUSTOMER));
    const input = {
      phone: '0903 176 968',
      custType: 'CA_NHAN' as const,
      name: 'Nguyễn Văn A',
      nationalId: '079201001234',
      sourceId: 'src-1',
    };
    await expect(new HttpCustomersPort(h.client).create(input)).resolves.toEqual(CUSTOMER);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('POST');
    expect(target(h.requests[0])).toBe('/customers');
    expect(await h.requests[0].json()).toEqual(input);
  });

  it('create rejects a duplicate phone (409) as ApiError', async () => {
    const h = setupHarness(() => envelope(409, 'CONFLICT', 'Số điện thoại đã có khách hàng.'));
    await expect(
      new HttpCustomersPort(h.client).create({
        phone: '0903176968',
        custType: 'CA_NHAN',
        name: 'A',
        sourceId: 'src-1',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT', message: 'Số điện thoại đã có khách hàng.' });
  });

  it('listSources GETs switched-off sources too, so an old customer keeps its source name', async () => {
    const sources = [
      { id: 'src-1', name: 'Facebook', description: null, active: true, sortOrder: 1, isOther: false },
      { id: 'src-2', name: 'Hội chợ', description: null, active: false, sortOrder: 2, isOther: false },
    ];
    const h = setupHarness(() => json(200, sources));
    await expect(new HttpCustomersPort(h.client).listSources()).resolves.toEqual(sources);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/customer-sources?includeInactive=true');
  });
});
