// hand-authored — web date display helper (Story 5.9, twin of `dinhDangNgay()` in
// mobile/lib/screens/warranty/warranty_lookup_screen.dart, pinned by
// design-system/session/parity.test.mjs).
//
// The web app ships NO date library, and it must not grow one for this: every
// timestamp that reaches a screen is an ISO-8601 UTC string the backend already
// resolved. This helper does the only thing left — reorder the date part for a
// Vietnamese reader.
//
// It is a STRING SLICE, not date arithmetic (AD-2/QĐ-4): `warrantyEndAt` arrives
// at `00:00:00Z`, so taking `YYYY-MM-DD` off the front cannot shift the day the
// way a local-timezone parse would.

/** `2038-02-10T00:00:00.000Z` ⇒ `10/02/2038`. Anything unparseable comes back as `—`. */
export function formatNgay(iso: string | null): string {
  if (iso === null) return '—';
  const phanNgay = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(phanNgay)) return '—';
  const [nam, thang, ngay] = phanNgay.split('-');
  return `${ngay}/${thang}/${nam}`;
}
