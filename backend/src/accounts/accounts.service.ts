import { Injectable } from '@nestjs/common';
import type { Account, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Client Prisma bên trong một `$transaction(async (tx) => …)`. Cho phép caller ghi
 * `accounts` CÙNG transaction với bảng của mình mà vẫn đi qua service này (giữ ranh giới
 * domain: `auth/` không chạm bảng `accounts` trực tiếp — AD-1/AD-8).
 */
export type AccountsTransactionClient = Prisma.TransactionClient;

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

  /**
   * Ghi `passwordHash` mới (đã băm argon2id bởi `PasswordService` — service này KHÔNG
   * băm và KHÔNG nhận mật khẩu thô). Dùng bởi luồng đặt lại + đổi mật khẩu (Story 2.8).
   *
   * Cố ý là write method DUY NHẤT ở đây: CRUD account đầy đủ (tạo/sửa/vô hiệu hoá) thuộc
   * Epic 8 (FR-16) — không thêm method chưa có người gọi.
   *
   * Truyền `tx` khi cần ghi cùng transaction với thao tác khác (đặt lại mật khẩu phải
   * đổi hash VÀ thu hồi phiên nguyên tử — nửa vời để lại phiên cũ dùng được).
   */
  async updatePasswordHash(
    id: string,
    passwordHash: string,
    tx?: AccountsTransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).account.update({
      where: { id },
      data: { passwordHash },
    });
  }
}
