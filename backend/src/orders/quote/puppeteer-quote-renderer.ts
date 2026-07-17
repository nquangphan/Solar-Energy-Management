import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import { QuoteRendererPort } from './quote-renderer.port';

/**
 * `PuppeteerQuoteRenderer` — implementation `QuoteRendererPort` bằng Chromium headless.
 *
 * Browser là SINGLETON LAZY-LAUNCH ở lần render đầu (KHÔNG launch trong constructor —
 * boot app và test hermetic không bao giờ đụng Chromium); đóng ở `onModuleDestroy`.
 *
 * Module `puppeteer` cũng nạp LAZY (dynamic import trong `resolveBrowser`, KHÔNG import
 * tĩnh đầu file): puppeteer ≥25 là ESM-only — import tĩnh làm Jest (CJS transformer) vỡ
 * ngay khi app.module được nạp trong test hermetic, dù render chưa bao giờ chạy. Node 24
 * production nạp bình thường ở lần render đầu.
 *
 * `--no-sandbox` CHỈ khi env `PUPPETEER_NO_SANDBOX=1` — VPS/container cần (Chromium
 * sandbox đòi user namespace), mac dev không bật.
 */
@Injectable()
export class PuppeteerQuoteRenderer
  extends QuoteRendererPort
  implements OnModuleDestroy
{
  private browserPromise: Promise<Browser> | null = null;

  private resolveBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      const args =
        process.env.PUPPETEER_NO_SANDBOX === '1'
          ? ['--no-sandbox', '--disable-setuid-sandbox']
          : [];
      this.browserPromise = import('puppeteer').then((mod) =>
        mod.default.launch({ args }),
      );
    }
    return this.browserPromise;
  }

  async render(html: string): Promise<{ pdf: Buffer; image: Buffer }> {
    const browser = await this.resolveBrowser();
    const page = await browser.newPage();
    try {
      // Viewport = bề ngang A4 ở 96dpi — ảnh share cùng tỷ lệ trang PDF.
      await page.setViewport({ width: 794, height: 1123 });
      // Mọi asset đã inline base64 trong html — 'load' là đủ, không chờ network.
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = Buffer.from(
        await page.pdf({ format: 'A4', printBackground: true }),
      );
      const image = Buffer.from(
        await page.screenshot({ fullPage: true, type: 'png' }),
      );
      return { pdf, image };
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = null;
    }
  }
}
