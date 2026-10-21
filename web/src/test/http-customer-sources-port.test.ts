// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpCustomerSourcesPort } from '../api/http-customer-sources-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const ROW = { id: 'src-9', name: 'TikTok', description: null, active: true, sortOrder: 5, isOther: false };

describe('HttpCustomerSourcesPort', () => {
  it('list(true) asks for the switched-off rows too', async () => {
    const h = setupHarness(() => json(200, [ROW]));
    await expect(new HttpCustomerSourcesPort(h.client).list(true)).resolves.toEqual([ROW]);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/customer-sources?includeInactive=true');
  });

  it('create POSTs the input and resolves the new row', async () => {
    const h = setupHarness(() => json(201, ROW));
    await expect(new HttpCustomerSourcesPort(h.client).create({ name: 'TikTok' })).resolves.toEqual(ROW);
    expect(h.requests[0].method).toBe('POST');
    expect(target(h.requests[0])).toBe('/customer-sources');
    expect(await h.requests[0].json()).toEqual({ name: 'TikTok' });
  });

  it('create rejects a duplicate name (409) as ApiError with the backend message', async () => {
    const h = setupHarness(() => envelope(409, 'CONFLICT', 'Tên nguồn đã tồn tại.'));
    const error = await new HttpCustomerSourcesPort(h.client).create({ name: 'Facebook' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Tên nguồn đã tồn tại.' });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('update PATCHes the row by id with only the given keys', async () => {
    const h = setupHarness(() => json(200, { ...ROW, description: null }));
    await new HttpCustomerSourcesPort(h.client).update('src-9', { description: null });
    expect(h.requests[0].method).toBe('PATCH');
    expect(target(h.requests[0])).toBe('/customer-sources/src-9');
    expect(await h.requests[0].json()).toEqual({ description: null });
  });

  it('deactivate DELETEs and resolves undefined on 204', async () => {
    const h = setupHarness(() => new Response(null, { status: 204 }));
    await expect(new HttpCustomerSourcesPort(h.client).deactivate('src-9')).resolves.toBeUndefined();
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('DELETE');
    expect(target(h.requests[0])).toBe('/customer-sources/src-9');
  });

  it('deactivate of the Khác row rejects 409', async () => {
    const h = setupHarness(() => envelope(409, 'CONFLICT', 'Không tắt được nguồn "Khác".'));
    await expect(new HttpCustomerSourcesPort(h.client).deactivate('src-khac')).rejects.toMatchObject({
      status: 409,
      message: 'Không tắt được nguồn "Khác".',
    });
  });

  it('reactivate POSTs to the reactivate route', async () => {
    const h = setupHarness(() => json(200, ROW));
    await expect(new HttpCustomerSourcesPort(h.client).reactivate('src-9')).resolves.toEqual(ROW);
    expect(h.requests[0].method).toBe('POST');
    expect(target(h.requests[0])).toBe('/customer-sources/src-9/reactivate');
  });
});
