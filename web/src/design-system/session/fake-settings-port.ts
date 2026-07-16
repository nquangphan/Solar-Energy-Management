// hand-authored — TEST/DEMO-ONLY fake port (Story 4.4).
//
// NOT a real backend: one in-memory number so the VAT-rate section of the config
// screen is demoable/guardable WITHOUT an app-runtime, bundler or network. The
// Int 0..100 rule is mimicked so the demo shows the real error surface, NOT
// because this is where it is enforced — that is the server's job (AD-4).

import type { SettingsPort, SettingsPortError } from './settings-port';

/** An AD-5-shaped rejection, so the screen exercises its real error path in the demo. */
function reject(error: SettingsPortError): Promise<never> {
  return Promise.reject(error);
}

/**
 * A `SettingsPort` backed by one in-memory value — TEST/DEMO ONLY. Starts at the
 * backend's never-configured default (8).
 */
export class FakeSettingsPort implements SettingsPort {
  // Plain field, NOT a constructor parameter property — Node runs web fakes by
  // stripping types, and that TS-only shorthand cannot be stripped (see
  // fake-customer-sources-port.ts for the precedent).
  private ratePercent: number;

  constructor(ratePercent: number = 8) {
    this.ratePercent = ratePercent;
  }

  getVatRate(): Promise<number> {
    return Promise.resolve(this.ratePercent);
  }

  updateVatRate(ratePercent: number): Promise<number> {
    if (!Number.isInteger(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      return reject({
        message: 'Thuế suất VAT phải là số nguyên từ 0 đến 100.',
        fieldErrors: [
          { field: 'ratePercent', message: 'Thuế suất phải là số nguyên 0–100.' },
        ],
      });
    }
    this.ratePercent = ratePercent;
    return Promise.resolve(this.ratePercent);
  }
}
