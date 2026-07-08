import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Dựng một Nest application-context để introspect controller/DTO cho OpenAPI, KHÔNG
 * cần server chạy và KHÔNG cần DB thật.
 *
 * `PrismaService` được override bằng stub no-op nên `onModuleInit` không `$connect`
 * tới PostgreSQL — cho phép sinh spec trong CI/pre-commit (và cho drift-guard) mà
 * không phụ thuộc DB. Dùng CHUNG bởi `generate-openapi.ts` và drift-guard test để
 * cả hai dựng document từ cùng một app-context.
 */
export async function createOpenApiApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      onModuleInit: async () => {},
      onModuleDestroy: async () => {},
      $connect: async () => {},
      $disconnect: async () => {},
    })
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}
