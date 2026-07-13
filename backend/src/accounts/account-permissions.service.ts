import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import { AccountPermissionsChanged } from './domain/account-events';
import {
  keysActorCannotGrant,
  keysBlockingActorFromTarget,
} from './domain/permission-escalation';
import {
  isPermissionKey,
  type PermissionKey,
} from './domain/permission-registry';

/**
 * Đọc/ghi bộ quyền per-account — nguồn chân lý RBAC (AD-8). Bảng `account_permissions`
 * (join `account_id × permission`). Truy vấn CHỈ qua `PrismaService` (AD-1).
 *
 * Story 2.4 chỉ CUNG CẤP data API; KHÔNG build `/me`/guard/route (Story 2.5). `setForAccount`
 * dùng ở màn Phân quyền Epic 8. `EventsModule` là `@Global` ⇒ inject `EventBus` không cần
 * import module.
 */
@Injectable()
export class AccountPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

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
   * THAY THẾ toàn bộ bộ quyền của `targetAccountId` (xoá cũ → tạo mới, atomic qua
   * transaction), dưới danh nghĩa `actorAccountId`.
   *
   * Thứ tự kiểm — fail-closed, KHÔNG chạm DB khi từ chối:
   *  1. Mọi key ∈ registry (AD-17) ⇒ key lạ: `VALIDATION_ERROR` 400.
   *  2. Luật #2 — actor KHÔNG sửa được account đang mang quyền actor không có ⇒ 403.
   *  3. Luật #1 — actor KHÔNG cấp được quyền chính mình không có ⇒ 403.
   *
   * Quyền của actor lẫn target resolve TƯƠI từ DB (AD-8) — KHÔNG nhận từ tham số/JWT:
   * caller có thể nói dối, còn service là ranh giới bảo mật cuối.
   *
   * Ghi thành công ⇒ publish `AccountPermissionsChanged` qua `EventBus` **sau commit**
   * (audit best-effort, AD-18) — KHÔNG inject `AuditService` trực tiếp.
   */
  async setForAccount(
    actorAccountId: string,
    targetAccountId: string,
    keys: PermissionKey[],
  ): Promise<void> {
    const invalid = keys.filter((key) => !isPermissionKey(key));
    if (invalid.length > 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        `Permission key không hợp lệ (ngoài registry): ${invalid.join(', ')}`,
      );
    }

    const actorPermissions = await this.listForAccount(actorAccountId);
    const targetPermissions = await this.listForAccount(targetAccountId);

    // Luật #2 TRƯỚC: kiểm bộ quyền HIỆN TẠI của target, không phải bộ mới. Kiểm nhầm
    // sang `keys` sẽ cho ADMIN thu sạch quyền SUPER_ADMIN bằng `keys = []`.
    const blocking = keysBlockingActorFromTarget(
      actorPermissions,
      targetPermissions,
    );
    if (blocking.length > 0) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        403,
        `Không thể sửa account mang quyền bạn không có: ${blocking.join(', ')}`,
      );
    }

    const cannotGrant = keysActorCannotGrant(actorPermissions, keys);
    if (cannotGrant.length > 0) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        403,
        `Không thể cấp quyền bạn không có: ${cannotGrant.join(', ')}`,
      );
    }

    const unique = [...new Set<PermissionKey>(keys)];
    // Xoá bộ quyền cũ, rồi CHỈ tạo mới khi có key: `createMany` rỗng vừa thừa vừa
    // có thể ném ở Prisma 7 + adapter-pg. Bộ rỗng ⇒ chỉ `deleteMany` → thu hồi TẤT
    // CẢ quyền (vô hiệu account / "bỏ tick hết"). Vẫn atomic: một `$transaction`.
    const ops = [
      this.prisma.accountPermission.deleteMany({
        where: { accountId: targetAccountId },
      }),
    ];
    if (unique.length > 0) {
      ops.push(
        this.prisma.accountPermission.createMany({
          data: unique.map((permission) => ({
            accountId: targetAccountId,
            permission,
          })),
        }),
      );
    }
    await this.prisma.$transaction(ops);

    // SAU commit — audit là consumer best-effort; publish trong tx sẽ trộn side-effect
    // vào ranh giới giao dịch (sai AD-18).
    await this.eventBus.publish(
      new AccountPermissionsChanged(
        actorAccountId,
        targetAccountId,
        [...targetPermissions],
        unique,
        new Date(),
      ),
    );
  }
}
