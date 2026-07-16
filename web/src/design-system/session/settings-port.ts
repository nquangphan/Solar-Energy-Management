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
 * TODO(app-runtime): the real implementation attaches `Authorization: Bearer
 * <accessToken>` (Story 2.3) and parses the AD-5 envelope into
 * `SettingsPortError`. Until then `FakeSettingsPort` drives the guards/demo.
 */
export interface SettingsPort {
  /** The effective VAT rate (%) — 8 when the system was never configured (backend default). */
  getVatRate(): Promise<number>;

  /** Change the VAT rate (%). Rejects 400 (not an Int 0..100) / 403. Resolves the new rate. */
  updateVatRate(ratePercent: number): Promise<number>;
}
