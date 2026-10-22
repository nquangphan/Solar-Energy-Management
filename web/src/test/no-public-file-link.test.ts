// Guard (AD-3, Story 10.5): files reach the web only as bytes through the
// authenticated transport, opened with an object URL or the share sheet. Nothing in
// the HTTP layer or the screens may build a storage link (an R2 host, a presigned
// URL, an S3 signature) or open a backend URL in a new window — such a link carries
// no Bearer (401), and one that worked would be a public link in disguise.
//
// Reads sources as text with comments dropped but strings KEPT: the forbidden thing
// is usually a string (`'https://….r2.cloudflarestorage.com'`, `'X-Amz-Signature'`).
import { describe, expect, it } from 'vitest';

import { withoutComments } from './source-text';

const sources = import.meta.glob(['../api/**/*.ts', '../screens/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const STORAGE_LINK: { name: string; pattern: RegExp }[] = [
  { name: 'r2 host', pattern: /\br2\./i },
  { name: 'cloudflarestorage', pattern: /cloudflarestorage/i },
  { name: 'presign', pattern: /presign/i },
  { name: 'S3 signature', pattern: /X-Amz-/i },
];
const WINDOW_OPEN = /\bwindow\s*(?:\?\.|\.)\s*open\s*\(/;

/** Screens that show order documents/photos: none may open a URL in a new window. */
const DOCUMENT_SCREENS = /^\.\.\/screens\/(?:orders|contracts|invoices|payments|inventory)\//;

const scanned = Object.entries(sources).map(([path, raw]) => [path, withoutComments(raw)] as const);

describe('no public file link in the HTTP layer or the screens (AD-3)', () => {
  it('scans the adapters and the screens (not blind)', () => {
    // Measured 2026-10-22: 21 api files + 21 screens.
    expect(scanned.length).toBeGreaterThanOrEqual(35);
    for (const path of ['../api/http-orders-port.ts', '../api/http-contracts-port.ts', '../screens/orders/OrderDetailScreen.tsx']) {
      expect(scanned.some(([p]) => p === path), path).toBe(true);
    }
    expect(scanned.filter(([p]) => DOCUMENT_SCREENS.test(p)).length).toBeGreaterThanOrEqual(10);
  });

  it('the patterns catch real links and calls (guard has teeth)', () => {
    const samples = [
      "const url = 'https://acc.r2.cloudflarestorage.com/bucket/a.jpg';",
      "const u = `${base}?X-Amz-Signature=${sig}`;",
      "await port.presignedUrl(id);",
    ];
    for (const sample of samples) {
      expect(STORAGE_LINK.some(({ pattern }) => pattern.test(withoutComments(sample))), sample).toBe(true);
    }
    expect(WINDOW_OPEN.test("window.open(`/api/orders/${id}/contracts/${cid}/pdf`)")).toBe(true);
    // Prose in a comment is not a link.
    expect(STORAGE_LINK.some(({ pattern }) => pattern.test(withoutComments('// never touches R2. ok')))).toBe(false);
  });

  it('no file builds a storage link', () => {
    const found = scanned.flatMap(([path, code]) =>
      STORAGE_LINK.filter(({ pattern }) => pattern.test(code)).map(({ name }) => `${path}: ${name}`),
    );
    expect(found).toEqual([]);
  });

  it('no order/document screen opens a URL in a new window', () => {
    const found = scanned.filter(([path, code]) => DOCUMENT_SCREENS.test(path) && WINDOW_OPEN.test(code)).map(([p]) => p);
    expect(found).toEqual([]);
  });
});
