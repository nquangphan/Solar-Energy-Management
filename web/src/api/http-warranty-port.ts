// hand-authored — the real WarrantyPort over the generated client (Story 10.4).
//
// The phone goes out raw (AD-9); "no such customer" is a 200 `found: false`, not an error.
import type { WarrantyLookup, WarrantyPort } from '../design-system/session/warranty-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpWarrantyPort implements WarrantyPort {
  constructor(private readonly client: ApiClient) {}

  async lookup(sdt: string): Promise<WarrantyLookup> {
    const { data } = await this.client.GET('/orders/warranty-lookup', { params: { query: { phone: sdt } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
