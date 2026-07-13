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

/** Mirrors the backend `CustomerResponseDto`. `sdt` is ALWAYS the normalised E.164 key. */
export interface Customer {
  sdt: string;
  custType: string;
  name: string;
  cccd: string | null;
  taxCode: string | null;
  address: string | null;
  bankAccount: string | null;
  sourceId: string;
  sourceNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the backend `CustomerSourceResponseDto`. */
export interface CustomerSource {
  id: string;
  name: string;
  description: string | null;
  isOther: boolean;
  sortOrder: number;
}

/**
 * Mirrors `CustomerLookupResponseDto`. `found: false` is a NORMAL 200 result, not
 * an error — it is the half of the feature that opens "Tạo khách hàng mới".
 * `sdt` carries the normalised key back even when nothing was found.
 */
export interface CustomerLookup {
  found: boolean;
  sdt: string;
  customer: Customer | null;
}

/** Mirrors `CustomerListResponseDto`. `total` counts the WHOLE filtered set, not this page. */
export interface CustomerPage {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

/** Query for the list screen. `q` is what the user typed — the backend builds the phone needle. */
export interface CustomerListQuery {
  q?: string;
  custType?: string;
  page?: number;
  pageSize?: number;
}

/** Body of `POST /customers`. Contract owned by Story 3.3 — unchanged here. */
export interface CreateCustomerInput {
  sdt: string;
  custType: string;
  name: string;
  cccd?: string | null;
  taxCode?: string | null;
  address?: string | null;
  bankAccount?: string | null;
  sourceId: string;
  sourceNote?: string | null;
}

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
 * TODO(app-runtime/login-network): the real implementation attaches
 * `Authorization: Bearer <accessToken>` (Story 2.3) and parses the AD-5 error
 * envelope into the screens' Banner + fieldErrors. Until then `FakeCustomersPort`
 * drives the guards/demo.
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

  /** The customer-source catalogue that fills the `Nguồn khách` select. */
  listSources(): Promise<CustomerSource[]>;
}
