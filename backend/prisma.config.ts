import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 config — nguồn khai báo cho Prisma CLI (generate/migrate).
 *
 * Prisma 7 chuyển connection URL ra khỏi `schema.prisma`; `datasource.url` khai ở
 * đây, đọc từ `DATABASE_URL` (nạp qua dotenv từ `.env` gitignored — chỉ backend giữ
 * credential, AD-1). Runtime PrismaClient dùng driver adapter riêng (xem PrismaService).
 *
 * Migration đầu tiên land ở Story 2.3 (Account + Session); Story 2.4 thêm migration
 * `account_permissions` (mở rộng cùng entity Account, KHÔNG tạo lại bảng cũ).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Lệnh `prisma db seed` chạy — upsert account admin đầu tiên (Story 2.3).
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
