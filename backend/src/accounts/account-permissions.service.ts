import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import type { AccountsTransactionClient } from './accounts.service';
import { AccountPermissionsChanged } from './domain/account-events';
import {
  PERMISSION_REQUIRES,
  dependencyMessage,
  missingDependencies,
} from './domain/permission-dependencies';
import {
  grantableBy,
  keysActorCannotGrant,
  keysBlockingActorFromTarget,
} from './domain/permission-escalation';
import {
  PERMISSIONS,
  isPermissionKey,
  type PermissionKey,
} from './domain/permission-registry';
import {
  ROLE_PRESETS,
  ROLE_PRESET_KEYS,
  ROLE_PRESET_LABELS,
  matchingPreset,
  type RolePreset,
} from './domain/role-presets';

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
   * đọc mà Story 2.5 (`/me`) + guard sẽ gọi. Pass `tx` to read inside a transaction (under
   * its row locks).
   */
  async listForAccount(
    accountId: string,
    tx?: AccountsTransactionClient,
  ): Promise<Set<PermissionKey>> {
    const rows = await (tx ?? this.prisma).accountPermission.findMany({
      where: { accountId },
      select: { permission: true },
    });
    return new Set(rows.map((row) => row.permission as PermissionKey));
  }

  /**
   * THAY THẾ toàn bộ bộ quyền của `targetAccountId` (xoá cũ → tạo mới), dưới danh nghĩa
   * `actorAccountId`.
   *
   * Thứ tự kiểm — fail-closed, KHÔNG ghi gì khi từ chối:
   *  1. Mọi key ∈ registry (AD-17) ⇒ key lạ: `VALIDATION_ERROR` 400 + `fieldErrors.permissions`.
   *  2. Actor = target ⇒ 403 (nobody edits their own permissions: the only Super Admin could
   *     otherwise lock themselves out of this screen for good).
   *  3. Target không tồn tại ⇒ 404 (checked under the lock, not left to an FK error ⇒ 500).
   *  4. Luật #2 — actor KHÔNG sửa được account đang mang quyền actor không có ⇒ 403.
   *  5. Luật #1 — actor KHÔNG cấp được quyền chính mình không có ⇒ 403.
   *  6. Bộ mới có quyền thiếu quyền nó cần (`PERMISSION_REQUIRES`) ⇒ 400 + `fieldErrors`.
   *
   * Quyền của actor lẫn target resolve TƯƠI từ DB (AD-8) — KHÔNG nhận từ tham số/JWT:
   * caller có thể nói dối, còn service là ranh giới bảo mật cuối.
   *
   * The FIRST statement of the transaction locks both account rows (`ORDER BY id`, so two
   * saves touching the same pair never deadlock). Without it, READ COMMITTED lets a second
   * save's `deleteMany` miss the rows the first one just committed ⇒ the two sets merge, or
   * `@@unique` breaks inside the tx ⇒ 500 on a double-click. Both permission sets are read
   * THROUGH `tx`, after the lock: a concurrent revoke of the actor's permissions is either
   * fully visible or waits — never checked against a stale set.
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
      const message = `Permission key không hợp lệ (ngoài registry): ${invalid.join(', ')}`;
      throw new AppException(ErrorCode.VALIDATION_ERROR, 400, message, [
        { field: 'permissions', code: UNKNOWN_PERMISSION, message },
      ]);
    }

    if (actorAccountId === targetAccountId) {
      throw new AppException(ErrorCode.FORBIDDEN, 403, SELF_EDIT_MESSAGE);
    }

    const unique = [...new Set<PermissionKey>(keys)];

    const before = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM accounts WHERE id = ANY(${[actorAccountId, targetAccountId]}::text[]) ORDER BY id FOR UPDATE`;
      if (!locked.some((row) => row.id === targetAccountId)) {
        throw new AppException(
          ErrorCode.NOT_FOUND,
          404,
          'Không tìm thấy tài khoản.',
        );
      }

      const actorPermissions = await this.listForAccount(actorAccountId, tx);
      const targetPermissions = await this.listForAccount(targetAccountId, tx);

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

      const cannotGrant = keysActorCannotGrant(actorPermissions, unique);
      if (cannotGrant.length > 0) {
        throw new AppException(
          ErrorCode.FORBIDDEN,
          403,
          `Không thể cấp quyền bạn không có: ${cannotGrant.join(', ')}`,
        );
      }

      const gaps = missingDependencies(unique);
      if (gaps.length > 0) {
        const messages = gaps.map((gap) => dependencyMessage(gap, labelOf));
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          400,
          messages.join(' '),
          messages.map((message) => ({
            field: 'permissions',
            code: PERMISSION_DEPENDENCY,
            message,
          })),
        );
      }

      // Xoá bộ quyền cũ, rồi CHỈ tạo mới khi có key: `createMany` rỗng vừa thừa vừa
      // có thể ném ở Prisma 7 + adapter-pg. Bộ rỗng ⇒ chỉ `deleteMany` → thu hồi TẤT
      // CẢ quyền (vô hiệu account / "bỏ tick hết").
      await tx.accountPermission.deleteMany({
        where: { accountId: targetAccountId },
      });
      if (unique.length > 0) {
        await tx.accountPermission.createMany({
          data: unique.map((permission) => ({
            accountId: targetAccountId,
            permission,
          })),
        });
      }
      return targetPermissions;
    });

    // SAU commit — audit là consumer best-effort; publish trong tx sẽ trộn side-effect
    // vào ranh giới giao dịch (sai AD-18).
    await this.eventBus.publish(
      new AccountPermissionsChanged(
        actorAccountId,
        targetAccountId,
        [...before],
        unique,
        new Date(),
      ),
    );
  }

  /**
   * Every account with its permission set and what the actor may do with it — the left column
   * of the Permissions screen. `editable`/`readOnlyReason` come from the same escalation rules
   * `setForAccount` enforces, so the client never re-derives them (AD-2).
   */
  async summaries(actorAccountId: string): Promise<AccountPermissionSummary[]> {
    const actorPermissions = await this.listForAccount(actorAccountId);
    const accounts = await this.prisma.account.findMany({
      orderBy: { displayName: 'asc' },
      select: ACCOUNT_SUMMARY_SELECT,
    });
    return accounts.map((account) =>
      toSummary(actorAccountId, actorPermissions, account),
    );
  }

  /** One account's summary (after a save), or 404. */
  async summary(
    actorAccountId: string,
    targetAccountId: string,
  ): Promise<AccountPermissionSummary> {
    const actorPermissions = await this.listForAccount(actorAccountId);
    const account = await this.prisma.account.findUnique({
      where: { id: targetAccountId },
      select: ACCOUNT_SUMMARY_SELECT,
    });
    if (!account) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        'Không tìm thấy tài khoản.',
      );
    }
    return toSummary(actorAccountId, actorPermissions, account);
  }

  /**
   * The registry (grouped, with labels and dependencies) plus the presets, as seen by the
   * actor: `grantable` = rule #1 lets the actor grant the key, and only presets the actor can grant
   * in full are listed — an Admin never sees Super Admin.
   */
  async permissionOptions(actorAccountId: string): Promise<PermissionOptions> {
    const actorPermissions = await this.listForAccount(actorAccountId);
    const grantable = grantableBy(actorPermissions);
    const groupOrder = [...new Set(PERMISSIONS.map((entry) => entry.group))];
    const permissions = [...PERMISSIONS]
      .sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group))
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        group: entry.group,
        requires: [...(PERMISSION_REQUIRES[entry.key] ?? [])],
        grantable: grantable.has(entry.key),
      }));
    const presets = ROLE_PRESET_KEYS.filter(
      (preset) =>
        keysActorCannotGrant(actorPermissions, ROLE_PRESETS[preset]).length ===
        0,
    ).map((preset) => ({
      key: preset,
      label: ROLE_PRESET_LABELS[preset],
      permissions: [...ROLE_PRESETS[preset]],
    }));
    return { permissions, presets };
  }
}

const UNKNOWN_PERMISSION = 'UNKNOWN_PERMISSION';
const PERMISSION_DEPENDENCY = 'PERMISSION_DEPENDENCY';
const SELF_EDIT_MESSAGE = 'Không thể tự sửa quyền của chính mình.';

const LABELS = new Map(PERMISSIONS.map((entry) => [entry.key, entry.label]));
const labelOf = (key: PermissionKey): string => LABELS.get(key) ?? key;

const ACCOUNT_SUMMARY_SELECT = {
  id: true,
  displayName: true,
  phone: true,
  email: true,
  isActive: true,
  permissions: { select: { permission: true } },
} as const;

interface AccountSummaryRow {
  id: string;
  displayName: string;
  phone: string | null;
  email: string;
  isActive: boolean;
  permissions: { permission: string }[];
}

export interface AccountPermissionSummary {
  id: string;
  displayName: string;
  phone: string | null;
  email: string;
  isActive: boolean;
  permissions: PermissionKey[];
  matchingPreset: RolePreset | null;
  matchingPresetLabel: string | null;
  editable: boolean;
  readOnlyReason: string | null;
}

export interface PermissionOptions {
  permissions: {
    key: PermissionKey;
    label: string;
    group: string;
    requires: PermissionKey[];
    grantable: boolean;
  }[];
  presets: { key: RolePreset; label: string; permissions: PermissionKey[] }[];
}

function toSummary(
  actorAccountId: string,
  actorPermissions: ReadonlySet<PermissionKey>,
  account: AccountSummaryRow,
): AccountPermissionSummary {
  const held = new Set(
    account.permissions.map((row) => row.permission as PermissionKey),
  );
  const blocking = keysBlockingActorFromTarget(actorPermissions, held);
  const preset = matchingPreset(held);
  const readOnlyReason =
    account.id === actorAccountId
      ? 'Đây là tài khoản của bạn.'
      : blocking.length > 0
        ? `Tài khoản mang quyền bạn không có: ${blocking.map(labelOf).join(', ')}.`
        : null;
  return {
    id: account.id,
    displayName: account.displayName,
    phone: account.phone,
    email: account.email,
    isActive: account.isActive,
    permissions: [...held].sort(),
    matchingPreset: preset,
    matchingPresetLabel: preset === null ? null : ROLE_PRESET_LABELS[preset],
    editable: readOnlyReason === null,
    readOnlyReason,
  };
}
