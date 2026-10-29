// hand-authored — web timestamp display helper (Story 6.3, twin of `ngayNgan()` /
// `ngayGio()` in mobile/lib/screens/inventory/stock_vouchers_screen.dart).
//
// Every timestamp arrives as ISO-8601 UTC (backend contract); the reader is in
// Vietnam (UTC+7, no daylight saving). This shifts the instant by a FIXED +7h and
// reads the UTC fields of the shifted instant — so the output never depends on the
// browser's own time zone.

const LECH_UTC7_MS = 7 * 3_600_000;

function thanhPhan(iso: string): string[] | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + LECH_UTC7_MS);
  const hai = (n: number) => String(n).padStart(2, '0');
  return [
    hai(d.getUTCDate()),
    hai(d.getUTCMonth() + 1),
    String(d.getUTCFullYear()),
    hai(d.getUTCHours()),
    hai(d.getUTCMinutes()),
  ];
}

/** Plain Vietnam day `YYYY-MM-DD` ⇒ `DD/MM/YYYY`: reorders the backend's day, no date arithmetic. */
export function formatPlainDay(day: string): string {
  return day.split('-').reverse().join('/');
}

/** `2026-07-06T01:05:00.000Z` ⇒ `06/07`. Unparseable ⇒ `—`. */
export function ngayNgan(iso: string): string {
  const p = thanhPhan(iso);
  return p === null ? '—' : `${p[0]}/${p[1]}`;
}

/** `2026-07-06T01:05:00.000Z` ⇒ `06/07/2026 · 08:05`. Unparseable ⇒ `—`. */
export function ngayGio(iso: string): string {
  const p = thanhPhan(iso);
  return p === null ? '—' : `${p[0]}/${p[1]}/${p[2]} · ${p[3]}:${p[4]}`;
}
