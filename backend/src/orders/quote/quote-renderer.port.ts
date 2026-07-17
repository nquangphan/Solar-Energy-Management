/**
 * `QuoteRendererPort` — port render HTML báo giá thành PDF + ảnh (FR-21).
 *
 * Abstract class kiêm DI token (khuôn `events/event-bus.ts`, `storage/storage.port.ts`):
 * service nghiệp vụ inject port và chỉ gọi `render(html)` — KHÔNG biết Puppeteer/Chromium
 * đứng sau. Test hermetic override port bằng stub, KHÔNG đụng browser.
 *
 * MỘT html → CẢ pdf lẫn image: hai output cùng MỘT layout, không drift
 * (quyết định spec — xem story 4.8 Dev Notes).
 */
export abstract class QuoteRendererPort {
  abstract render(html: string): Promise<{ pdf: Buffer; image: Buffer }>;
}
