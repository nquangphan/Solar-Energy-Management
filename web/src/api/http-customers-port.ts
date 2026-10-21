// hand-authored — the real CustomersPort over the generated client (Story 10.4).
//
// The phone goes out exactly as the user typed it: the backend is the only
// normaliser (AD-9). openapi-fetch encodes the `{phone}` path segment, so an
// E.164 `+` reaches the server as `%2B`.
import type {
  CreateCustomerInput,
  Customer,
  CustomerListQuery,
  CustomerLookup,
  CustomerPage,
  CustomerSource,
  CustomersPort,
} from '../design-system/session/customers-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpCustomersPort implements CustomersPort {
  constructor(private readonly client: ApiClient) {}

  async lookup(sdt: string): Promise<CustomerLookup> {
    const { data } = await this.client.GET('/customers/lookup', { params: { query: { phone: sdt } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async list(query: CustomerListQuery): Promise<CustomerPage> {
    const { data } = await this.client.GET('/customers', { params: { query } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async get(sdt: string): Promise<Customer> {
    const { data } = await this.client.GET('/customers/{phone}', { params: { path: { phone: sdt } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const { data } = await this.client.POST('/customers', { body: input });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async listSources(): Promise<CustomerSource[]> {
    // Switched-off sources too: detail and lookup resolve a customer's `sourceId` against this
    // list, and a source turned off later must still show its name. The create select filters.
    const { data } = await this.client.GET('/customer-sources', { params: { query: { includeInactive: true } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
