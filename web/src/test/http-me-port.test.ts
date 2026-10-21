// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpMePort } from '../api/http-me-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const ME = { id: 'acc-1', email: 'sale@pns.vn', displayName: 'Sale A', permissions: ['customers.manage'] };

describe('HttpMePort', () => {
  it('fetchMe GETs /me with the bearer and resolves the payload', async () => {
    const h = setupHarness(() => json(200, ME));
    await expect(new HttpMePort(h.client).fetchMe()).resolves.toEqual(ME);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/me');
    expect(h.requests[0].headers.get('authorization')).toBe('Bearer access-1');
  });

  it('fetchMe rejects with the envelope as ApiError', async () => {
    const h = setupHarness(() => envelope(403, 'FORBIDDEN', 'Bạn không có quyền.'));
    const error = await new HttpMePort(h.client).fetchMe().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Bạn không có quyền.' });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
  });
});
