// hand-authored — web customers port (Story 3.4, mirror Flutter
// mobile/lib/design_system/session/customers_port.dart). The seam between the
// three customer screens and the `/customers` + `/customer-sources` endpoints.
//
// THE CLIENT NEVER NORMALISES A PHONE NUMBER (AD-9). Every `sdt` that crosses
// this port OUTBOUND is the RAW string the user typed (`0903 176 968`,
// `+84903176968`); the backend owns the single normaliser and returns the E.164
// key. A second normaliser here — even a "harmless" regex — is a second chance to
// disagree, and disagreement means two records for one person.
//
// The backend enforces every rule behind these calls (AD-4): permission, phone
// validity, duplicate blocking, the source/`sourceNote` rule. Nothing here is a
// security boundary.
//
// Every data type below is the GENERATED contract type (AD-12) — no hand-written
// mirror that can drift from the backend.

import type { components, paths } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** The backend `CustomerResponseDto`. `phone` is ALWAYS the normalised E.164 key. */
export type Customer = Schemas['CustomerResponseDto'];

/** The backend `CustomerSourceResponseDto`. */
export type CustomerSource = Schemas['CustomerSourceResponseDto'];

/**
 * `CustomerLookupResponseDto`. `found: false` is a NORMAL 200 result, not an
 * error — it is the half of the feature that opens "Tạo khách hàng mới".
 * `phone` carries the normalised key back even when nothing was found.
 */
export type CustomerLookup = Schemas['CustomerLookupResponseDto'];

/** `CustomerListResponseDto`. `total` counts the WHOLE filtered set, not this page. */
export type CustomerPage = Schemas['CustomerListResponseDto'];

/** Query for the list screen. `q` is what the user typed — the backend builds the phone needle. */
export type CustomerListQuery = NonNullable<paths['/customers']['get']['parameters']['query']>;

/** Body of `POST /customers` (`CreateCustomerRequestDto`). */
export type CreateCustomerInput = Schemas['CreateCustomerRequestDto'];

/**
 * The AD-5 error envelope a `CustomersPort` rejects with when the backend refuses a
 * call (400 validation, 409 duplicate phone). Mirrors Flutter `CustomerPortException`.
 *
 * The screen renders `message` VERBATIM. The client owns no rule about what a valid
 * phone is (AD-9), so it owns no words for one either: a message invented here is a
 * SECOND opinion on screen, and it goes stale the moment the backend's rules move.
 */
export interface CustomerPortError {
  message: string;
  fieldErrors?: { field: string; message: string }[];
}

/**
 * Injectable transport for the customer screens. This is a PORT, NOT an HTTP
 * client — the seam that lets the screens exist before the app owns a
 * bundler/router/token store.
 *
 * There is deliberately NO order data on this port (no `orderCount`, no
 * `orders`): `Order` does not exist until Story 4.1, and a UI cannot honestly
 * render a number no table can back.
 *
 * The real adapter is `web/src/api/http-customers-port.ts` (wired in main.tsx);
 * `FakeCustomersPort` drives the guards and demos.
 */
export interface CustomersPort {
  /** Look a customer up by RAW phone. Rejects only on invalid phone (400) — not on "not found". */
  lookup(sdt: string): Promise<CustomerLookup>;

  /** Page through customers, filtered by `q` / `custType`. */
  list(query: CustomerListQuery): Promise<CustomerPage>;

  /** Read one customer by RAW or E.164 phone. Rejects with NOT_FOUND if absent. */
  get(sdt: string): Promise<Customer>;

  /** Create a customer. Rejects on 400 (validation) / 409 (phone already taken). */
  create(input: CreateCustomerInput): Promise<Customer>;

  /**
   * The whole customer-source catalogue, switched-off sources included (`active: false`):
   * a customer keeps showing the source they came from after an admin turns it off. The
   * `Nguồn khách` select of the create form offers only the active ones.
   */
  listSources(): Promise<CustomerSource[]>;
}
