import { PuppeteerQuoteRenderer } from '../src/orders/quote/puppeteer-quote-renderer';

/**
 * `PuppeteerQuoteRenderer` without Chromium: the lazily-launched browser is replaced by a fake
 * through the same cached promise `resolveBrowser()` fills, so the test proves both `render` and
 * `renderPdf` go through that ONE singleton.
 */
describe('PuppeteerQuoteRenderer.renderPdf', () => {
  function fakeBrowser(
    pdf: jest.Mock = jest.fn().mockResolvedValue(new Uint8Array([1, 2])),
  ) {
    const page = {
      setViewport: jest.fn(),
      setContent: jest.fn(),
      pdf,
      screenshot: jest.fn().mockResolvedValue(new Uint8Array([3])),
      close: jest.fn(),
    };
    const browser = { newPage: jest.fn().mockResolvedValue(page) };
    return { browser, page };
  }

  function rendererWith(browser: unknown): PuppeteerQuoteRenderer {
    const renderer = new PuppeteerQuoteRenderer();
    (
      renderer as unknown as { browserPromise: Promise<unknown> }
    ).browserPromise = Promise.resolve(browser);
    return renderer;
  }

  it('renders a PDF with the CSS page size, on the same browser as the quote render', async () => {
    const { browser, page } = fakeBrowser();
    const renderer = rendererWith(browser);

    const pdf = await renderer.renderPdf('<html></html>');
    await renderer.render('<html></html>');

    expect(pdf).toEqual(Buffer.from([1, 2]));
    expect(page.setContent).toHaveBeenCalledWith('<html></html>', {
      waitUntil: 'load',
    });
    expect(page.pdf).toHaveBeenNthCalledWith(1, {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    // One browser served both renders.
    expect(browser.newPage).toHaveBeenCalledTimes(2);
    // The contract PDF takes no share image.
    expect(page.screenshot).toHaveBeenCalledTimes(1);
    expect(page.close).toHaveBeenCalledTimes(2);
  });

  it('closes the page even when the PDF step throws', async () => {
    const { browser, page } = fakeBrowser(
      jest.fn().mockRejectedValue(new Error('pdf failed')),
    );

    await expect(rendererWith(browser).renderPdf('<p/>')).rejects.toThrow(
      'pdf failed',
    );
    expect(page.close).toHaveBeenCalledTimes(1);
  });
});
