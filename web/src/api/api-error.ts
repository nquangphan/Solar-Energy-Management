// hand-authored — the ONE error type every HTTP adapter rejects with (Story 10.3, AD-5).
//
// Structurally a superset of the screens' `*PortError` shapes (`message` + `code?` +
// `status?` + `fieldErrors?`), so a screen that reads `.message` / `.code` /
// `.fieldErrors` / `.status` works unchanged when its fake port is swapped for an
// HTTP one. Only transport.ts builds it from a response (`toApiError`).
import type { components } from './generated/schema';

type ErrorEnvelope = components['schemas']['ErrorEnvelopeDto'];
type FieldError = components['schemas']['FieldErrorDto'];

/** Shown when the backend answered but the body is not an AD-5 envelope (proxy HTML 502, empty, foreign JSON). */
export const GENERIC_ERROR_MESSAGE = 'Không thực hiện được. Thử lại.';
/** Shown when the request never reached the backend (offline, DNS, CORS refusal). */
export const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
/** Shown when the session cannot be renewed and the backend gave no message. */
export const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.';

export interface ApiErrorInit {
  status?: number;
  code?: string;
  fieldErrors?: FieldError[];
  traceId?: string;
}

export class ApiError extends Error {
  /** HTTP status; absent when the request never reached the backend. */
  readonly status?: number;
  /** The envelope's `code` (AD-5) — screens branch on this, never on `message`. */
  readonly code?: string;
  readonly fieldErrors?: FieldError[];
  readonly traceId?: string;

  constructor(message: string, init: ApiErrorInit = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors;
    this.traceId = init.traceId;
  }
}

function isFieldError(value: unknown): value is FieldError {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.field === 'string' && typeof v.code === 'string' && typeof v.message === 'string';
}

/** Minimal AD-5 check: an object with string `code` and `message`; malformed field errors are dropped. */
export function parseEnvelope(body: unknown): ErrorEnvelope | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.code !== 'string' || typeof b.message !== 'string') return null;
  return {
    code: b.code,
    message: b.message,
    traceId: typeof b.traceId === 'string' ? b.traceId : '',
    fieldErrors: Array.isArray(b.fieldErrors) ? b.fieldErrors.filter(isFieldError) : undefined,
  };
}

/** Builds the ApiError for a non-ok response. Never throws on a body that is not JSON. */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = JSON.parse(await response.text());
  } catch {
    // Not JSON (proxy HTML, empty body) — falls through to the generic message.
  }
  const envelope = parseEnvelope(body);
  if (!envelope) return new ApiError(GENERIC_ERROR_MESSAGE, { status: response.status });
  return new ApiError(envelope.message, {
    status: response.status,
    code: envelope.code,
    fieldErrors: envelope.fieldErrors,
    traceId: envelope.traceId || undefined,
  });
}
