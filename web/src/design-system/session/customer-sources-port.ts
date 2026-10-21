// hand-authored — web customer-sources port (Story 3.5). The seam between the
// Cấu hình nguồn khách screen and the four WRITE endpoints on `/customer-sources`.
//
// WEB-ONLY, AND THAT IS DELIBERATE. Every other port in this folder has a Dart
// twin, because every other screen ships on both platforms. This one does not:
// DESIGN.md names Cấu hình nguồn khách as the single web-only screen (config is
// desk work — an admin at a keyboard, not an installer on a roof). Writing a Dart
// twin would mean shipping code no screen calls.
//
// The four write methods are NOT bolted onto `CustomersPort` for exactly that
// reason: that port IS a web↔Dart twin pair, and a web-only method on it would
// either break the parity guard or force a dead Dart method into existence.
//
// The backend enforces every rule behind these calls (AD-4): the `settings.manage`
// gate, the unique-name rule, the "the isOther row cannot be switched off" rule.
// Nothing here is a security boundary — and nothing here decides business rules
// either: `sortOrder` when omitted is computed by the SERVER, not here.
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];

/**
 * The backend `CustomerSourceResponseDto`. `isOther` (the "Khác" flag) is
 * READ-ONLY across this port — there is no write method that accepts it, because
 * the backend accepts it in no DTO. Exactly one row carries it, and that invariant
 * is owned by the seed. The screen reads it to decide two things: show the flag
 * chip, and disable the switch-off action.
 */
export type CustomerSourceRow = Schemas['CustomerSourceResponseDto'];

/**
 * Body of `POST /customer-sources`. `sortOrder` omitted ⇒ the BACKEND appends the
 * row at the end (max + 1). The client does not count rows and does not guess.
 */
export type CreateCustomerSourceInput = Schemas['CreateCustomerSourceRequestDto'];

/**
 * Body of `PATCH /customer-sources/:id`. An ABSENT key means "leave it alone"; an
 * explicit `description: null` means "clear the description". No `active` here —
 * switching a source off/on goes through `deactivate`/`reactivate`, so one action
 * is one call is one audit entry.
 */
export type UpdateCustomerSourceInput = Schemas['UpdateCustomerSourceRequestDto'];

/**
 * The AD-5 error envelope this port rejects with when the backend refuses a call
 * (400 validation, 409 duplicate name, 409 "cannot switch off the Khác row").
 * Mirrors `CustomerPortError` in customers-port.ts.
 *
 * The screen renders `message` VERBATIM and pins `fieldErrors` to the matching
 * input. The client owns none of these rules, so it owns no words for them either:
 * a message invented here is a SECOND opinion on screen, and it goes stale the day
 * the backend's rules move.
 */
export interface CustomerSourcePortError {
  message: string;
  fieldErrors?: { field: string; message: string }[];
}

/**
 * Injectable transport for the Cấu hình nguồn khách screen. This is a PORT, NOT an
 * HTTP client — the seam that lets the screen exist before the web app owns a
 * bundler/router/token store.
 *
 * The real adapter is `web/src/api/http-customer-sources-port.ts` (wired in
 * main.tsx); `FakeCustomerSourcesPort` drives the guards and demos.
 */
export interface CustomerSourcesPort {
  /** The whole catalogue. `includeInactive: true` — the config screen must see switched-off rows to switch them back on. */
  list(includeInactive: boolean): Promise<CustomerSourceRow[]>;

  /** Add a source. Rejects on 400 (validation) / 409 (name already taken). */
  create(input: CreateCustomerSourceInput): Promise<CustomerSourceRow>;

  /** Edit name/description/order. Rejects on 400 / 404 / 409. The `isOther` row CAN be renamed. */
  update(id: string, patch: UpdateCustomerSourceInput): Promise<CustomerSourceRow>;

  /** Switch a source OFF (`active: false`). Never deletes. Rejects 409 for the `isOther` row. */
  deactivate(id: string): Promise<void>;

  /** Switch a source back ON (`active: true`). */
  reactivate(id: string): Promise<CustomerSourceRow>;
}
