import { OrdersModule } from '../src/orders/orders.module';
import { OrdersService } from '../src/orders/orders.service';

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
    const providers = metadata(PROVIDERS);
    for (const exported of metadata(EXPORTS)) {
      expect(providers).toContain(exported);
    }
  });

  it('CHỈ OrdersService được export — mở thêm cửa là mở thêm bề mặt phải canh', () => {
    expect(metadata(EXPORTS)).toEqual([OrdersService]);
  });
});
