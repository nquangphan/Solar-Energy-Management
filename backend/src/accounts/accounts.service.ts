import { Injectable } from '@nestjs/common';
import type { Account, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { accountPhoneOrThrow } from '../auth/account-phone';
import { PasswordService } from '../auth/password.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { isUniqueViolation } from '../common/errors/prisma-unique-violation';
import { EventBus } from '../events/event-bus';
import {
  AccountPermissionsService,
  assertStillManages,
  blockingMessage,
  cannotGrantMessage,
  type AccountPermissionSummary,
} from './account-permissions.service';
import {
  AccountCreated,
  AccountUpdated,
  type AccountSnapshot,
} from './domain/account-events';
import {
  keysActorCannotGrant,
  keysBlockingActorFromTarget,
} from './domain/permission-escalation';
import { ROLE_PRESETS, type RolePreset } from './domain/role-presets';

/**
 * Client Prisma bên trong một `$transaction(async (tx) => …)`. Cho phép caller ghi
 * `accounts` CÙNG transaction với bảng của mình mà vẫn đi qua service này (giữ ranh giới
 * domain: `auth/` không chạm bảng `accounts` trực tiếp — AD-1/AD-8).
 */
export type AccountsTransactionClient = Prisma.TransactionClient;

/**
 * `accounts/domain` sở hữu entity `Account` — nguồn danh tính DUY NHẤT (AD-8). Story
 * 2.3 chỉ cung cấp phần đọc mà `auth/` cần để đăng nhập (`findByPhone`/`findById`);
 * KHÔNG build registry quyền / `/me` / guard ở đây (thuộc Story 2.4/2.5).
 *
 * Truy vấn DB CHỈ qua `PrismaService` (AD-1) — `auth/` KHÔNG chạm bảng `accounts`
 * trực tiếp, luôn đi qua service này (giữ ranh giới domain).
 *
 * Story 8.3 adds the admin writes: `create` (from a role preset) and `update` (profile +
 * active flag). Permission edits stay in `AccountPermissionsService.setForAccount`.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountPermissions: AccountPermissionsService,
    private readonly passwords: PasswordService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Look up the account by its sign-in phone (`@unique`). Takes an ALREADY-normalized
   * E.164 string (`accountPhoneOrThrow`) — never a raw one, never `null`, so an account
   * whose `phone` is still NULL cannot match. `null` if not found.
   */
  findByPhone(phone: string): Promise<Account | null> {
    return this.prisma.account.findUnique({ where: { phone } });
  }

  /** Tra account theo id (UUID). `null` nếu không tồn tại. */
  findById(id: string): Promise<Account | null> {
    return this.prisma.account.findUnique({ where: { id } });
  }

  /**
   * Ghi `passwordHash` mới (đã băm argon2id bởi `PasswordService` — service này KHÔNG
   * băm và KHÔNG nhận mật khẩu thô). Dùng bởi luồng đặt lại + đổi mật khẩu (Story 2.8).
   *
   * Never touches the profile: `create`/`update` below own those columns.
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

  /**
   * Creates an account and loads `ROLE_PRESETS[preset]` as its permission set in ONE
   * transaction (AD-8: the preset is only loaded, never stored on the account).
   *
   * Fail-closed order, nothing written on refusal: display name / phone (400) → [tx] lock the
   * actor → the actor still holds `permissions.manage` (403) → rule #1, the actor must be able
   * to grant the whole preset (403) → insert (409 on a duplicate phone or email) → commit →
   * publish `AccountCreated`.
   *
   * The password is hashed BEFORE the transaction: argon2 is slow on purpose, and the actor's
   * row lock must not be held while it runs.
   */
  async create(
    actorAccountId: string,
    input: CreateAccountInput,
  ): Promise<AccountPermissionSummary> {
    const profile = normalizeProfile(input);
    const passwordHash = await this.passwords.hash(input.password);
    const permissions = [...ROLE_PRESETS[input.preset]];

    const accountId = await this.translateConflict(
      profile,
      undefined,
      this.prisma.$transaction(async (tx) => {
        await lockAccounts(tx, [actorAccountId]);
        // Read under the lock: a concurrent revoke of the actor's `permissions.manage` is
        // either fully visible here or still waiting — never checked against a stale set.
        const actorPermissions = await this.accountPermissions.listForAccount(
          actorAccountId,
          tx,
        );
        assertStillManages(actorPermissions);
        const cannotGrant = keysActorCannotGrant(actorPermissions, permissions);
        if (cannotGrant.length > 0) {
          throw new AppException(
            ErrorCode.FORBIDDEN,
            403,
            cannotGrantMessage(cannotGrant),
          );
        }

        const created = await tx.account.create({
          data: { ...profile, passwordHash },
          select: { id: true },
        });
        // Every preset is non-empty today; the guard stays because an empty `createMany`
        // can throw on Prisma 7 + adapter-pg.
        if (permissions.length > 0) {
          await tx.accountPermission.createMany({
            data: permissions.map((permission) => ({
              accountId: created.id,
              permission,
            })),
          });
        }
        return created.id;
      }),
    );

    // AFTER commit (AD-18): publishing inside the tx would mix a side effect into it.
    await this.eventBus.publish(
      new AccountCreated(
        actorAccountId,
        accountId,
        profile,
        permissions,
        input.preset,
        new Date(),
      ),
    );
    return this.accountPermissions.summary(actorAccountId, accountId);
  }

  /**
   * Replaces the profile and active flag of `targetAccountId` (PUT — all four fields). The
   * permission set is untouched.
   *
   * Fail-closed order, nothing written on refusal: display name / phone (400) → self (403) →
   * [tx] lock actor + target → missing target (404) → the actor still holds
   * `permissions.manage` (403) → rule #2, the target holds a permission the actor lacks (403) →
   * read `before` → write (409 on a duplicate phone or email) →
   * commit → publish `AccountUpdated`.
   *
   * Saving it inactive revokes every session of the account in the same transaction: the guard
   * already refuses its access tokens on the next request, and reactivating must not bring
   * an old refresh token back to life.
   */
  async update(
    actorAccountId: string,
    targetAccountId: string,
    input: UpdateAccountInput,
  ): Promise<AccountPermissionSummary> {
    const profile = normalizeProfile(input);
    if (actorAccountId === targetAccountId) {
      throw new AppException(ErrorCode.FORBIDDEN, 403, SELF_EDIT_MESSAGE);
    }

    const before = await this.translateConflict(
      profile,
      targetAccountId,
      this.prisma.$transaction(async (tx) => {
        const locked = await lockAccounts(tx, [
          actorAccountId,
          targetAccountId,
        ]);
        if (!locked.includes(targetAccountId)) {
          throw new AppException(
            ErrorCode.NOT_FOUND,
            404,
            'Không tìm thấy tài khoản.',
          );
        }

        const actorPermissions = await this.accountPermissions.listForAccount(
          actorAccountId,
          tx,
        );
        assertStillManages(actorPermissions);
        const targetPermissions = await this.accountPermissions.listForAccount(
          targetAccountId,
          tx,
        );
        const blocking = keysBlockingActorFromTarget(
          actorPermissions,
          targetPermissions,
        );
        if (blocking.length > 0) {
          throw new AppException(
            ErrorCode.FORBIDDEN,
            403,
            blockingMessage(blocking),
          );
        }

        // Under the lock, so two concurrent saves chain: the second `before` is the first `after`.
        const snapshot = await tx.account.findUniqueOrThrow({
          where: { id: targetAccountId },
          select: SNAPSHOT_SELECT,
        });
        await tx.account.update({
          where: { id: targetAccountId },
          data: profile,
        });
        // Every save as inactive, not only the active → inactive one: an account switched off
        // some other way may still hold live sessions, and reactivating must not revive them.
        if (!profile.isActive) {
          await tx.session.updateMany({
            where: { accountId: targetAccountId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return snapshot;
      }),
    );

    await this.eventBus.publish(
      new AccountUpdated(
        actorAccountId,
        targetAccountId,
        before,
        profile,
        new Date(),
      ),
    );
    return this.accountPermissions.summary(actorAccountId, targetAccountId);
  }

  /**
   * A unique violation (P2002) ⇒ 409 on the field that clashed. The column is found by looking
   * the values up again, not by parsing the error's `meta` (Prisma 7 + adapter-pg reports it
   * differently) — and never by a lookup BEFORE the write, which two concurrent saves would
   * both pass. Any other error is rethrown unchanged.
   */
  private async translateConflict<T>(
    profile: AccountProfile,
    ownId: string | undefined,
    write: Promise<T>,
  ): Promise<T> {
    try {
      return await write;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const notOwn = ownId === undefined ? {} : { NOT: { id: ownId } };
      const phoneTaken = await this.prisma.account.findFirst({
        where: { phone: profile.phone, ...notOwn },
        select: { id: true },
      });
      if (phoneTaken) {
        throw conflict('phone', 'Số điện thoại đã thuộc tài khoản khác.');
      }
      const emailTaken = await this.prisma.account.findFirst({
        where: { email: profile.email, ...notOwn },
        select: { id: true },
      });
      if (emailTaken) {
        throw conflict('email', 'Email đã thuộc tài khoản khác.');
      }
      throw err;
    }
  }
}

export interface CreateAccountInput {
  displayName: string;
  /** Raw, as typed — normalized here (AD-9). */
  phone: string;
  email: string;
  password: string;
  preset: RolePreset;
  isActive: boolean;
}

export interface UpdateAccountInput {
  displayName: string;
  /** Raw, as typed — normalized here (AD-9). */
  phone: string;
  email: string;
  isActive: boolean;
}

/** The columns a create/update writes, normalized; also the audit snapshot. */
type AccountProfile = AccountSnapshot & { readonly phone: string };

const SELF_EDIT_MESSAGE = 'Không thể tự sửa tài khoản của chính mình.';

const SNAPSHOT_SELECT = {
  displayName: true,
  phone: true,
  email: true,
  isActive: true,
} as const;

/**
 * Display name trimmed and required, phone to E.164 (`accountPhoneOrThrow` ⇒ 400 on
 * `phone`), email trimmed + lowercased like the seed. Runs before any DB access.
 */
function normalizeProfile(input: UpdateAccountInput): AccountProfile {
  const displayName = input.displayName.trim();
  if (displayName === '') {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      400,
      'Họ tên không được để trống.',
      [
        {
          field: 'displayName',
          code: 'isNotEmpty',
          message: 'Không được để trống.',
        },
      ],
    );
  }
  return {
    displayName,
    phone: accountPhoneOrThrow(input.phone),
    email: input.email.trim().toLowerCase(),
    isActive: input.isActive,
  };
}

/**
 * The FIRST statement of every account write: lock the rows `ORDER BY id` (two saves on the
 * same pair never deadlock). `accounts.id` is TEXT — cast `text[]`, not `uuid[]`. Returns
 * the ids that exist.
 */
async function lockAccounts(
  tx: AccountsTransactionClient,
  ids: string[],
): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM accounts WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
  return rows.map((row) => row.id);
}

function conflict(field: 'phone' | 'email', message: string): AppException {
  return new AppException(ErrorCode.CONFLICT, 409, message, [
    { field, code: 'isUnique', message },
  ]);
}
