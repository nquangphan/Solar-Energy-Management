import { Injectable } from '@nestjs/common';
import type { Account } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * `accounts/domain` sở hữu entity `Account` — nguồn danh tính DUY NHẤT (AD-8). Story
 * 2.3 chỉ cung cấp phần đọc mà `auth/` cần để đăng nhập (`findByEmail`/`findById`);
 * KHÔNG build registry quyền / `/me` / guard ở đây (thuộc Story 2.4/2.5).
 *
 * Truy vấn DB CHỈ qua `PrismaService` (AD-1) — `auth/` KHÔNG chạm bảng `accounts`
 * trực tiếp, luôn đi qua service này (giữ ranh giới domain).
 */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tra account theo email đăng nhập (`@unique`). `null` nếu không tồn tại. */
  findByEmail(email: string): Promise<Account | null> {
    return this.prisma.account.findUnique({ where: { email } });
  }

  /** Tra account theo id (UUID). `null` nếu không tồn tại. */
  findById(id: string): Promise<Account | null> {
    return this.prisma.account.findUnique({ where: { id } });
  }
}
