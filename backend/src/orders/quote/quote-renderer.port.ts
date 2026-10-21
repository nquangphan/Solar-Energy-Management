/**
 * `QuoteRendererPort` — port render HTML báo giá thành PDF + ảnh (FR-21).
 *
 * Abstract class kiêm DI token (khuôn `events/event-bus.ts`, `storage/storage.port.ts`):
 * service nghiệp vụ inject port và chỉ gọi `render(html)` — KHÔNG biết Puppeteer/Chromium
 * đứng sau. Test hermetic override port bằng stub, KHÔNG đụng browser.
 *
 * MỘT html → CẢ pdf lẫn image: hai output cùng MỘT layout, không drift
 * (quyết định spec — xem story 4.8 Dev Notes).
 *
 * Also used by contracts (7.3) through `renderPdf`: a multi-page PDF only, no share image —
 * the same Chromium, never a second browser.
 */
export abstract class QuoteRendererPort {
  abstract render(html: string): Promise<{ pdf: Buffer; image: Buffer }>;

  /** HTML → PDF only; page size and margins come from the HTML's `@page` rule. */
  abstract renderPdf(html: string): Promise<Buffer>;
}
