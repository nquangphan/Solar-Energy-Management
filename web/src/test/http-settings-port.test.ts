// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpSettingsPort } from '../api/http-settings-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const ENTITY = {
  legalName: 'Công ty TNHH Phương Nam Solar',
  taxCode: '0312345678',
  address: '1 Lê Lợi',
  representative: 'Nguyễn Văn B',
  representativeTitle: 'Giám đốc',
  phone: '0909000000',
  bankAccount: '0071000123456',
};

describe('HttpSettingsPort', () => {
  it('getVatRate resolves the rate', async () => {
    const h = setupHarness(() => json(200, { ratePercent: 8 }));
    await expect(new HttpSettingsPort(h.client).getVatRate()).resolves.toBe(8);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/settings/vat-rate');
  });

  it('updateVatRate PATCHes {"ratePercent":10} and resolves 10', async () => {
    const h = setupHarness(() => json(200, { ratePercent: 10 }));
    await expect(new HttpSettingsPort(h.client).updateVatRate(10)).resolves.toBe(10);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('PATCH');
    expect(target(h.requests[0])).toBe('/settings/vat-rate');
    expect(await h.requests[0].text()).toBe('{"ratePercent":10}');
  });

  it('updateVatRate rejects an out-of-range rate with the envelope and its fieldErrors', async () => {
    const h = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', [
        { field: 'ratePercent', code: 'max', message: 'Thuế suất tối đa 100.' },
      ]),
    );
    const error = await new HttpSettingsPort(h.client).updateVatRate(101).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: [{ field: 'ratePercent', code: 'max', message: 'Thuế suất tối đa 100.' }],
    });
  });

  it('getCompanyLegalEntity resolves the entity', async () => {
    const h = setupHarness(() => json(200, ENTITY));
    await expect(new HttpSettingsPort(h.client).getCompanyLegalEntity()).resolves.toEqual(ENTITY);
    expect(target(h.requests[0])).toBe('/settings/company-legal-entity');
  });

  it('updateCompanyLegalEntity PUTs all seven fields', async () => {
    const h = setupHarness(() => json(200, ENTITY));
    await expect(new HttpSettingsPort(h.client).updateCompanyLegalEntity(ENTITY)).resolves.toEqual(ENTITY);
    expect(h.requests[0].method).toBe('PUT');
    expect(await h.requests[0].json()).toEqual(ENTITY);
  });
});
