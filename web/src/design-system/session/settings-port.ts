// hand-authored — web settings port (Story 4.4). The seam between the VAT-rate
// section of the Cấu hình screen and the two `/settings/vat-rate` endpoints.
//
// WEB-ONLY, AND THAT IS DELIBERATE — same decision as customer-sources-port.ts:
// system configuration is desk work, DESIGN.md ships no mobile config screen, and
// a Dart twin would be code no screen calls. Sale screens never need this port
// either: the EFFECTIVE rate they display travels back on every
// `previewTotal` response (`OrderTotals.vatRate`).
//
// The backend enforces every rule behind these calls (AD-4): the
// `settings.manage` gate on BOTH reads and writes, the Int 0..100 validation.
// Nothing here is a security boundary.

import type { components } from '../../api/generated/schema';

/** The generated `CompanyLegalEntityDto`: the seller party printed on contracts. Empty string = not configured. */
export type CompanyLegalEntity = components['schemas']['CompanyLegalEntityDto'];

/**
 * The AD-5 error envelope this port rejects with when the backend refuses a call
 * (400 validation, 403 missing settings.manage). Mirrors `CustomerSourcePortError`.
 */
export interface SettingsPortError {
  message: string;
  fieldErrors?: { field: string; message: string }[];
}

/**
 * Injectable transport for the system-settings section. This is a PORT, NOT an
 * HTTP client — the seam that lets the screen exist before the web app owns a
 * bundler/router/token store.
 *
 * The real adapter is `web/src/api/http-settings-port.ts` (wired in main.tsx);
 * `FakeSettingsPort` drives the guards and demos.
 */
export interface SettingsPort {
  /** The effective VAT rate (%) — 8 when the system was never configured (backend default). */
  getVatRate(): Promise<number>;

  /** Change the VAT rate (%). Rejects 400 (not an Int 0..100) / 403. Resolves the new rate. */
  updateVatRate(ratePercent: number): Promise<number>;

  /** The company legal entity printed on contracts (all-empty when never configured). */
  getCompanyLegalEntity(): Promise<CompanyLegalEntity>;

  /** Replaces all 7 fields. Rejects 400 (`fieldErrors` keyed by field name) / 403. */
  updateCompanyLegalEntity(input: CompanyLegalEntity): Promise<CompanyLegalEntity>;
}
