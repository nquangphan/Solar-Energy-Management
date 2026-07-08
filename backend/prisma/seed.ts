import 'dotenv/config';
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/auth/password.service';

/**
 * Seed MỘT account admin để đăng nhập được lúc dev (AC-1 "có gì để đăng nhập"). Đọc
 * email/mật khẩu từ env (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) — KHÔNG hardcode
 * mật khẩu trong repo. Băm argon2id qua `PasswordService` (cùng thuật toán như login).
 *
 * Chạy: `npm run prisma:migrate:deploy` (tạo bảng) rồi `npx prisma db seed`.
 * Đây là CLI script (không phải runtime backend) nên được phép `new PrismaClient`
 * với driver adapter — source-guard AD-1 chỉ quét `src/`.
 */
async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Cần SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD trong .env để seed admin.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.account.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: { email, passwordHash, displayName: 'Admin', isActive: true },
    });
    console.log(`Đã seed account admin: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});
