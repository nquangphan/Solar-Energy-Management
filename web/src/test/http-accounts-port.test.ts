// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpAccountsPort } from '../api/http-accounts-port';
import { envelope, json, setupHarness } from './http-adapter-harness';

const SUMMARY = {
  id: '6f1c2a4e-0b7d-4c1a-9d3e-2f5a8b7c9d10',
  displayName: 'Trần Văn A',
  phone: null,
  email: 'a@pns.vn',
  isActive: true,
  permissions: ['catalog.view'],
  matchingPreset: null,
  matchingPresetLabel: null,
  editable: true,
  readOnlyReason: null,
};

describe('HttpAccountsPort', () => {
  it('listAccounts GETs /accounts and resolves the summaries', async () => {
    const h = setupHarness(() => json(200, [SUMMARY]));
    await expect(new HttpAccountsPort(h.client).listAccounts()).resolves.toEqual([SUMMARY]);
    expect(h.requests[0].method).toBe('GET');
    expect(new URL(h.requests[0].url).pathname).toBe('/accounts');
  });

  it('getPermissionOptions GETs /accounts/permission-options', async () => {
    const body = { permissions: [], presets: [] };
    const h = setupHarness(() => json(200, body));
    await expect(new HttpAccountsPort(h.client).getPermissionOptions()).resolves.toEqual(body);
    expect(new URL(h.requests[0].url).pathname).toBe('/accounts/permission-options');
  });

  it('updatePermissions PUTs the full set to /accounts/{id}/permissions', async () => {
    const h = setupHarness(() => json(200, SUMMARY));
    await expect(
      new HttpAccountsPort(h.client).updatePermissions(SUMMARY.id, ['catalog.view', 'customers.manage']),
    ).resolves.toEqual(SUMMARY);
    expect(h.requests[0].method).toBe('PUT');
    expect(new URL(h.requests[0].url).pathname).toBe(`/accounts/${SUMMARY.id}/permissions`);
    expect(await h.requests[0].json()).toEqual({
      permissions: ['catalog.view', 'customers.manage'],
    });
  });

  it('updatePermissions rejects a 400 with the backend sentence and fieldErrors', async () => {
    const sentence = '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».';
    const h = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', sentence, [
        {
          field: 'permissions',
          code: 'PERMISSION_DEPENDENCY',
          message: sentence,
        },
      ]),
    );
    const error = await new HttpAccountsPort(h.client).updatePermissions(SUMMARY.id, []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: sentence });
    expect((error as ApiError).fieldErrors?.[0].field).toBe('permissions');
  });
});
