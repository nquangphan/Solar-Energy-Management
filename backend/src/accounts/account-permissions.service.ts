import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import {
  isPermissionKey,
  type PermissionKey,
} from './domain/permission-registry';

/**
 * Đọc/ghi bộ quyền per-account — nguồn chân lý RBAC (AD-8). Bảng `account_permissions`
 * (join `account_id × permission`). Truy vấn CHỈ qua `PrismaService` (AD-1).
 *
 * Story 2.4 chỉ CUNG CẤP data API; KHÔNG build `/me`/guard/route (Story 2.5). `setForAccount`
 * dùng ở seed (Task 6) + màn Phân quyền Epic 8.
 */
@Injectable()
export class AccountPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bộ quyền hiệu lực của một account = tập key trên `account_permissions`. Đây là API
   * đọc mà Story 2.5 (`/me`) + guard sẽ gọi.
   */
  async listForAccount(accountId: string): Promise<Set<PermissionKey>> {
    const rows = await this.prisma.accountPermission.findMany({
      where: { accountId },
      select: { permission: true },
    });
    return new Set(rows.map((row) => row.permission as PermissionKey));
  }

  /**
   * THAY THẾ toàn bộ bộ quyền của account (xoá cũ → tạo mới, atomic qua transaction).
   * Validate mọi key ∈ registry TRƯỚC khi ghi — chặn literal ngoài registry lọt vào DB
   * (AD-17). Key lạ ⇒ ném `AppException(VALIDATION_ERROR)`, KHÔNG chạm DB.
   */
  async setForAccount(accountId: string, keys: PermissionKey[]): Promise<void> {
    const invalid = keys.filter((key) => !isPermissionKey(key));
    if (invalid.length > 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        `Permission key không hợp lệ (ngoài registry): ${invalid.join(', ')}`,
      );
    }

    const unique = [...new Set<PermissionKey>(keys)];
    // Xoá bộ quyền cũ, rồi CHỈ tạo mới khi có key: `createMany` rỗng vừa thừa vừa
    // có thể ném ở Prisma 7 + adapter-pg. Bộ rỗng ⇒ chỉ `deleteMany` → thu hồi TẤT
    // CẢ quyền (vô hiệu account / "bỏ tick hết"). Vẫn atomic: một `$transaction`.
    const ops = [
      this.prisma.accountPermission.deleteMany({ where: { accountId } }),
    ];
    if (unique.length > 0) {
      ops.push(
        this.prisma.accountPermission.createMany({
          data: unique.map((permission) => ({ accountId, permission })),
        }),
      );
    }
    await this.prisma.$transaction(ops);
  }
}
