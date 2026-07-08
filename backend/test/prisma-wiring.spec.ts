import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Wiring test cho lớp truy cập DB (AD-1):
 *  - `PrismaModule` là `@Global` → mọi module domain sau inject chung một instance.
 *  - `PrismaService` inject được và là subclass của PrismaClient.
 *
 * Chỉ `compile()` (không `init()`) nên `onModuleInit.$connect` không chạy — test
 * không cần PostgreSQL.
 */
describe('PrismaModule / PrismaService wiring', () => {
  // `@Global()` gắn metadata khoá này (@nestjs/common GLOBAL_MODULE_METADATA).
  const GLOBAL_MODULE_METADATA = '__module:global__';

  it('PrismaModule được đánh dấu @Global', () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, PrismaModule)).toBe(
      true,
    );
  });

  it('PrismaService inject được và kế thừa PrismaClient', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    const prisma = moduleRef.get(PrismaService);
    // Prisma 7 client trả về proxy → `instanceof` không tin cậy; kiểm bằng
    // constructor name + API kế thừa PrismaClient (điểm truy cập DB duy nhất).
    expect(prisma).toBeDefined();
    expect(prisma.constructor.name).toBe('PrismaService');
    expect(typeof prisma.$queryRaw).toBe('function');
    expect(typeof prisma.$connect).toBe('function');

    await moduleRef.close();
  });
});
