import { OrdersModule } from '../src/orders/orders.module';
import { OrdersService } from '../src/orders/orders.service';
import { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';

/**
 * Wiring test AC-4 (Story 5.2): `OrdersModule` phải EXPORT `OrdersService`.
 *
 * Vì sao cần một test cho một dòng metadata: `exports` là thứ duy nhất trong story này mà
 * KHÔNG lane nào khác nhìn thấy. Unit test dựng service bằng `new OrdersService(...)`, lane DB
 * cũng vậy, e2e boot `AppModule` nhưng không module nào inject `OrdersService` từ ngoài
 * (`payments/` là 7.2, chưa tồn tại). Gỡ `exports` đi thì **cả 1032 test vẫn xanh** — và 7.2
 * chỉ phát hiện lúc boot đỏ, hoặc tệ hơn, phát minh một đường ghi `Order.status` riêng.
 *
 * Kiểm bằng metadata (`Reflect.getMetadata`) như `prisma-wiring.spec.ts` kiểm `@Global`:
 * `compile()` cả `OrdersModule` sẽ kéo theo Prisma/Storage/Puppeteer — đắt và giòn cho đúng
 * một bất biến khai báo.
 */
describe('OrdersModule wiring — cửa cho module ngoài (AC-4)', () => {
  // Khoá metadata của `@Module` (@nestjs/common MODULE_METADATA) — chuỗi trần, không prefix.
  const EXPORTS = 'exports';
  const PROVIDERS = 'providers';

  function metadata(key: string): unknown[] {
    return (Reflect.getMetadata(key, OrdersModule) as unknown[]) ?? [];
  }

  it('export OrdersService — đường hợp lệ duy nhất cho payments/ (7.2) và inventory/ (6.x)', () => {
    expect(metadata(EXPORTS)).toContain(OrdersService);
  });

  it('thứ được export cũng phải được provide (export suông là lỗi lúc boot)', () => {
    // A provider is either the class itself or a `{ provide: Token, … }` binding.
    const provided = metadata(PROVIDERS).map((p) =>
      typeof p === 'object' && p !== null && 'provide' in p
        ? (p as { provide: unknown }).provide
        : p,
    );
    for (const exported of metadata(EXPORTS)) {
      expect(provided).toContain(exported);
    }
  });

  it('exports exactly OrdersService + QuoteRendererPort — every extra door is surface to guard', () => {
    // QuoteRendererPort (7.3): contracts/ renders through the SAME binding — one Chromium.
    expect(metadata(EXPORTS)).toEqual([OrdersService, QuoteRendererPort]);
  });
});

describe('ContractsModule wiring — shares the orders renderer', () => {
  it('provides only ContractsService (no second QuoteRendererPort binding ⇒ no second Chromium)', async () => {
    const { ContractsModule } =
      await import('../src/contracts/contracts.module');
    expect(Reflect.getMetadata('providers', ContractsModule)).toEqual([
      (await import('../src/contracts/contracts.service')).ContractsService,
    ]);
    expect(Reflect.getMetadata('imports', ContractsModule)).toContain(
      OrdersModule,
    );
  });
});

describe('InvoicesModule wiring — shares the orders renderer, storage from StorageModule', () => {
  it('provides InvoicesService and InvoiceDocumentService only (no renderer or storage binding of its own)', async () => {
    const { InvoicesModule } = await import('../src/invoices/invoices.module');
    expect(Reflect.getMetadata('providers', InvoicesModule)).toEqual([
      (await import('../src/invoices/invoices.service')).InvoicesService,
      (await import('../src/invoices/invoice-document.service'))
        .InvoiceDocumentService,
    ]);
    const imports = Reflect.getMetadata('imports', InvoicesModule) as unknown[];
    expect(imports).toContain(OrdersModule);
    expect(imports).toContain(
      (await import('../src/storage/storage.module')).StorageModule,
    );
  });
});
