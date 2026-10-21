// hand-authored — the typed API client (Story 10.3, AD-12). Types come from
// generated/schema.d.ts; every request goes through the transport, so adapters
// receive `data` and failures arrive as ApiError.
import createClient from 'openapi-fetch';

import type { paths } from './generated/schema';
import type { Transport } from './transport';

export function createApiClient(transport: Transport, baseUrl: string) {
  return createClient<paths>({ baseUrl, fetch: transport.fetch });
}

export type ApiClient = ReturnType<typeof createApiClient>;
