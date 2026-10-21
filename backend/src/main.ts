// Nạp `.env` cho HTTP server runtime (đọc DATABASE_URL/PORT). Cùng convention với
// `prisma.config.ts`; dotenv no-op an toàn khi không có `.env` (vd prod inject env qua
// process manager). PHẢI đứng trước mọi import đọc process.env (PrismaService khởi tạo
// trong DI đọc DATABASE_URL) — side-effect import này chạy trước khi bootstrap gọi.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyCors } from './common/http/cors';

/**
 * Bootstrap HTTP server.
 *
 * ValidationPipe global (`whitelist` + `transform` + exceptionFactory→fieldErrors) và
 * exception filter trung tâm được đăng ký qua DI trong `CommonModule` (`APP_PIPE`/
 * `APP_FILTER`) — KHÔNG `useGlobalPipes/Filters` ở đây — để runtime và mọi app-context
 * test/OpenAPI dùng CHUNG một cấu hình (Story 2.2, AD-5).
 *
 * OpenAPI KHÔNG serve ở runtime tại đây; spec là build artifact sinh qua
 * `npm run openapi:gen` (AD-12). Xem `scripts/generate-openapi.ts`.
 */
/** Độ dài tối thiểu cho `JWT_ACCESS_SECRET` — chặn ký JWT bằng secret rỗng/yếu. */
const MIN_JWT_SECRET_LENGTH = 32;

async function bootstrap(): Promise<void> {
  // Fail-fast (như pattern PORT): thiếu/quá ngắn secret ký JWT → dừng ngay lúc bootstrap
  // thay vì phát access token ký bằng secret rỗng (JwtModule đọc secret này lúc import).
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret || jwtSecret.trim().length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_ACCESS_SECRET thiếu hoặc quá ngắn (cần ≥${MIN_JWT_SECRET_LENGTH} ký tự).`,
    );
  }

  const app = await NestFactory.create(AppModule);
  // Cross-origin web only when CORS_ORIGINS lists it; empty ⇒ off.
  applyCors(app);

  // Drain the Prisma pool on SIGTERM/SIGINT: without this, PrismaService's
  // onModuleDestroy ($disconnect) never runs on a prod deploy/restart.
  app.enableShutdownHooks();

  const rawPort = process.env.PORT;
  const port = rawPort ? Number(rawPort) : 3000;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    // Fail rõ ràng thay vì để `app.listen(NaN)` bind cổng ngẫu nhiên âm thầm.
    throw new Error(`PORT không hợp lệ: "${rawPort}"`);
  }
  await app.listen(port);
}

void bootstrap();
