import type { INestApplication } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS allowlist from `CORS_ORIGINS` (comma-separated exact origins, e.g.
 * `https://app.example.vn`). Empty or unset ⇒ null ⇒ CORS stays OFF: the dev web
 * goes through the vite proxy (same origin) and needs none.
 *
 * Exact string match only — no wildcard, no regex — so `https://x.evil` can never
 * slip through a pattern. Bearer auth, no cookies ⇒ `credentials: false`. The only
 * request headers the clients send are Authorization and Content-Type (the payment
 * idempotency key travels in the body).
 */
export function corsOptionsFromEnv(
  raw: string | undefined,
): CorsOptions | null {
  const origins = [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  ];
  if (origins.length === 0) return null;
  return {
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
  };
}

/**
 * Enables CORS on `app` when `raw` lists origins. Runtime (`main.ts`) and the e2e
 * test call this same function, so both run one configuration.
 */
export function applyCors(
  app: INestApplication,
  raw: string | undefined = process.env.CORS_ORIGINS,
): void {
  const options = corsOptionsFromEnv(raw);
  if (options) app.enableCors(options);
}
