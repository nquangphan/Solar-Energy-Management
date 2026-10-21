// hand-authored — the real CustomerSourcesPort over the generated client (Story 10.4).
import type {
  CreateCustomerSourceInput,
  CustomerSourceRow,
  CustomerSourcesPort,
  UpdateCustomerSourceInput,
} from '../design-system/session/customer-sources-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpCustomerSourcesPort implements CustomerSourcesPort {
  constructor(private readonly client: ApiClient) {}

  async list(includeInactive: boolean): Promise<CustomerSourceRow[]> {
    const { data } = await this.client.GET('/customer-sources', { params: { query: { includeInactive } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async create(input: CreateCustomerSourceInput): Promise<CustomerSourceRow> {
    const { data } = await this.client.POST('/customer-sources', { body: input });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async update(id: string, patch: UpdateCustomerSourceInput): Promise<CustomerSourceRow> {
    const { data } = await this.client.PATCH('/customer-sources/{id}', { params: { path: { id } }, body: patch });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async deactivate(id: string): Promise<void> {
    // 204 — there is no body to read.
    await this.client.DELETE('/customer-sources/{id}', { params: { path: { id } } });
  }

  async reactivate(id: string): Promise<CustomerSourceRow> {
    const { data } = await this.client.POST('/customer-sources/{id}/reactivate', { params: { path: { id } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
