import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — điểm truy cập DB DUY NHẤT của backend (AD-1).
 *
 * Đây là nơi DUY NHẤT mở kết nối tới PostgreSQL. Mọi module domain sau (accounts,
 * orders, …) inject service này để dùng CHUNG một client — không module nào được
 * tự `new PrismaClient()` (chống nhiều nguồn kết nối/sự thật). Source-guard trong
 * test sẽ fail nếu có `new PrismaClient(` xuất hiện ở nơi khác trong `src/`.
 *
 * Prisma 7 dùng driver adapter thay engine Rust: truyền `PrismaPg` (đọc DATABASE_URL
 * — credential chỉ backend giữ) cho `PrismaClient`. Adapter/pool là lazy: chỉ mở
 * kết nối thật khi `$connect()` chạy ở `onModuleInit`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
