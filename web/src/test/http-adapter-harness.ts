// Shared harness for the HTTP adapter tests: the REAL transport + generated client
// over a stubbed fetchImpl (no network, no fake port). Every request the adapter
// makes is recorded as a `Request`, so a test can assert method, path, query and body.
import { vi } from 'vitest';

import { createApiClient, type ApiClient } from '../api/client';
import { createSessionStore, type SessionStore } from '../api/session-store';
import { createTransport } from '../api/transport';
import { memoryStorage } from './memory-storage';

export const BASE = 'http://api.test';

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function envelope(
  status: number,
  code: string,
  message: string,
  fieldErrors?: { field: string; code: string; message: string }[],
): Response {
  return json(status, { code, message, traceId: 'trace-1', ...(fieldErrors ? { fieldErrors } : {}) });
}

export interface Harness {
  client: ApiClient;
  session: SessionStore;
  fetchImpl: ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;
  onSessionExpired: ReturnType<typeof vi.fn<() => void>>;
  /** Every request seen by fetchImpl, in order. */
  requests: Request[];
}

/** Signed-in harness (access + refresh token present) answering every request with `respond`. */
export function setupHarness(respond: (request: Request) => Response | Promise<Response>): Harness {
  const storage = memoryStorage();
  const session = createSessionStore(() => storage);
  session.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  const requests: Request[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    return respond(request);
  });
  const onSessionExpired = vi.fn<() => void>();
  const transport = createTransport({ baseUrl: BASE, session, fetchImpl, onSessionExpired });
  return { client: createApiClient(transport, BASE), session, fetchImpl, onSessionExpired, requests };
}

/** `pathname + search` of a recorded request, e.g. `/customers?q=an`. */
export function target(request: Request): string {
  const url = new URL(request.url);
  return url.pathname + url.search;
}
