// hand-authored — web warranty-lookup port (Story 5.9, mirror Flutter
// mobile/lib/design_system/session/warranty_port.dart). The seam between the
// Tra cứu bảo hành screen and `GET /orders/warranty-lookup`.
//
// THE CLIENT NEVER NORMALISES A PHONE NUMBER (AD-9). The `sdt` that crosses this
// port OUTBOUND is the RAW string the staffer typed while the customer is on the
// phone (`0903 176 968`, `+84903176968`); the backend owns the single normaliser
// and returns the E.164 key.
//
// THE CLIENT NEVER DOES DATE ARITHMETIC EITHER. `warrantyEndAt`, `remainingDays`,
// `remainingMonths` and `warrantyStatus` all arrive computed. Neither platform
// ships a date library, and "start + N months" is arithmetic with real traps
// (31/01 + 1 month = ?) — two implementations would be two answers. The screen
// maps `warrantyStatus` to a colour and a label; it never derives it.

/** Mirrors the backend `WarrantyCustomerDto` — only what confirms "the right person". */
export interface WarrantyCustomer {
  sdt: string;
  name: string;
  custType: string;
}

/**
 * Mirrors `WarrantyLineItemDto`. Every date here is an ISO-8601 UTC string;
 * `warrantyEndAt` is always at `00:00:00Z` so slicing `YYYY-MM-DD` off the front
 * cannot shift the day.
 *
 * `warrantyStartAt` is the date THIS LINE was first finalised — two lines of the
 * same order may legitimately differ (FR-36, AD-20).
 */
export interface WarrantyLine {
  id: string;
  name: string;
  qty: number;
  unit: string;
  warrantyMonths: number;
  warrantyStartAt: string;
  warrantyEndAt: string;
  /** Negative once expired. This is the number the backend derived the status from. */
  remainingDays: number;
  /** Rounded DOWN, floored at 0 — display only ("Còn 5 năm"). */
  remainingMonths: number;
  warrantyStatus: 'con_han' | 'sap_het' | 'het_han';
}

/** Mirrors `WarrantyOrderDto` — only lines of the effective version, only lines WITH warranty. */
export interface WarrantyOrder {
  id: string;
  status: string;
  chotAt: string | null;
  lineItems: WarrantyLine[];
}

/**
 * Mirrors `WarrantyLookupResponseDto`. `found: false` is a NORMAL 200 result, not
 * an error — the staffer asked a question and "no such customer" is an answer.
 * `sdt` carries the normalised key back even when nothing was found.
 */
export interface WarrantyLookup {
  found: boolean;
  sdt: string;
  customer: WarrantyCustomer | null;
  orders: WarrantyOrder[];
}

/**
 * The AD-5 error envelope this port rejects with (400 invalid phone, 403 missing
 * both read permissions). The screen renders `message` VERBATIM — the client owns
 * no rule about what a valid phone is (AD-9), so it owns no words for one either.
 */
export interface WarrantyPortError {
  message: string;
  fieldErrors?: { field: string; message: string }[];
}

/**
 * Injectable transport for the warranty-lookup screen. This is a PORT, NOT an HTTP
 * client — the seam that lets the screen exist before the app owns a
 * bundler/router/token store.
 *
 * READ-ONLY on purpose (FR-36, Phase 1): there is no method to open a warranty
 * claim or move a warranty through a lifecycle. Those are a later phase, and a
 * port method the backend cannot serve is a button the UI would have to fake.
 */
export interface WarrantyPort {
  /** Look warranty up by RAW phone. Rejects on 400 (invalid phone) — NOT on "not found". */
  lookup(sdt: string): Promise<WarrantyLookup>;
}
