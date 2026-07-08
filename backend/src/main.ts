// Nạp `.env` cho HTTP server runtime (đọc DATABASE_URL/PORT). Cùng convention với
// `prisma.config.ts`; dotenv no-op an toàn khi không có `.env` (vd prod inject env qua
// process manager). PHẢI đứng trước mọi import đọc process.env (PrismaService khởi tạo
// trong DI đọc DATABASE_URL) — side-effect import này chạy trước khi bootstrap gọi.
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstrap HTTP server.
 *
 * `ValidationPipe` global (`whitelist` + `transform`) là nền cho contract-first:
 * request body được validate/strip theo DTO. Error envelope tập trung + exception
 * filter là phạm vi Story 2.2 — skeleton chỉ bật ValidationPipe.
 *
 * OpenAPI KHÔNG serve ở runtime tại đây; spec là build artifact sinh qua
 * `npm run openapi:gen` (AD-12). Xem `scripts/generate-openapi.ts`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const rawPort = process.env.PORT;
  const port = rawPort ? Number(rawPort) : 3000;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    // Fail rõ ràng thay vì để `app.listen(NaN)` bind cổng ngẫu nhiên âm thầm.
    throw new Error(`PORT không hợp lệ: "${rawPort}"`);
  }
  await app.listen(port);
}

void bootstrap();
