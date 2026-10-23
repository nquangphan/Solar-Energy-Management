import { AccountsService } from '../src/accounts/accounts.service';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import {
  AccountCreated,
  AccountUpdated,
} from '../src/accounts/domain/account-events';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import type { PasswordService } from '../src/auth/password.service';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Unit `AccountsService.create`/`update` — HERMETIC. `$transaction` RUNS its callback with a
 * separate tx client, so a check reading permissions outside the tx, a publish before commit,
 * or a write after a refusal all show up in `calls`.
 *
 * The outer permission repo answers "every permission" while the tx repo answers the real
 * set: a service that reads the actor's permissions outside the transaction passes a check
 * it should fail.
 */

const ACTOR = 'actor-1';
const TARGET = 'target-1';
const PASSWORD = 'Secret123';
const PASSWORD_HASH = '$argon2id$hashed';

const ALL = Object.values(PERM);
const ADMIN_PERMS = [...ROLE_PRESETS.ADMIN];

async function catchAppException(p: Promise<unknown>): Promise<AppException> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppException) return err;
    throw err;
  }
  throw new Error('Expected an AppException, the promise resolved');
}

describe('AccountsService create/update (unit, hermetic)', () => {
  let calls: string[];
  let permissionsByAccount: Record<string, readonly string[]>;
  let existing: string[];
  let row: {
    displayName: string;
    phone: string | null;
    email: string;
    isActive: boolean;
  };
  let tx: {
    $queryRaw: jest.Mock;
    accountPermission: { findMany: jest.Mock; createMany: jest.Mock };
    account: {
      create: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    session: { updateMany: jest.Mock };
  };
  let outer: {
    accountPermission: { findMany: jest.Mock };
    account: { findUnique: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let hash: jest.Mock;
  let publish: jest.Mock;
  let service: AccountsService;

  const createInput = () => ({
    displayName: '  Thợ Mới  ',
    phone: '0912 345 678',
    email: '  Tho.Moi@Local.Test ',
    password: PASSWORD,
    preset: 'THO_KS' as const,
    isActive: true,
  });
  const updateInput = (isActive = true) => ({
    displayName: 'Tên Mới',
    phone: '0912 345 679',
    email: 'New@Local.Test',
    isActive,
  });

  beforeEach(() => {
    calls = [];
    permissionsByAccount = {
      [ACTOR]: ADMIN_PERMS,
      [TARGET]: [PERM.catalogView],
    };
    existing = [ACTOR, TARGET];
    row = {
      displayName: 'Tên Cũ',
      phone: '+84900000001',
      email: 'old@local.test',
      isActive: true,
    };
    tx = {
      $queryRaw: jest.fn((_s: TemplateStringsArray, ids: string[]) => {
        calls.push(`tx.lock:${ids.join(',')}`);
        return Promise.resolve(
          ids.filter((id) => existing.includes(id)).map((id) => ({ id })),
        );
      }),
      accountPermission: {
        findMany: jest.fn(({ where }: { where: { accountId: string } }) => {
          calls.push(`tx.perms:${where.accountId}`);
          return Promise.resolve(
            (permissionsByAccount[where.accountId] ?? []).map((permission) => ({
              permission,
            })),
          );
        }),
        createMany: jest.fn(() => {
          calls.push('tx.createPerms');
          return Promise.resolve({ count: 1 });
        }),
      },
      account: {
        create: jest.fn(() => {
          calls.push('tx.create');
          return Promise.resolve({ id: 'new-1' });
        }),
        update: jest.fn(() => {
          calls.push('tx.update');
          return Promise.resolve({});
        }),
        findUniqueOrThrow: jest.fn(() => {
          calls.push('tx.before');
          return Promise.resolve({ ...row });
        }),
      },
      session: {
        updateMany: jest.fn(() => {
          calls.push('tx.revokeSessions');
          return Promise.resolve({ count: 2 });
        }),
      },
    };
    outer = {
      // Outside the tx every account "has everything": reading here defeats every check.
      accountPermission: {
        findMany: jest.fn(() =>
          Promise.resolve(ALL.map((permission) => ({ permission }))),
        ),
      },
      account: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve({
            id: where.id,
            displayName: 'X',
            phone: '+84912345678',
            email: 'x@local.test',
            isActive: true,
            permissions: [],
          }),
        ),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(
        async (cb: (client: unknown) => Promise<unknown>) => {
          calls.push('tx.begin');
          const result = await cb(tx);
          calls.push('tx.commit');
          return result;
        },
      ),
    };
    hash = jest.fn(() => {
      calls.push('hash');
      return Promise.resolve(PASSWORD_HASH);
    });
    publish = jest.fn(() => {
      calls.push('publish');
      return Promise.resolve();
    });
    const prisma = outer as unknown as PrismaService;
    const eventBus = { publish } as unknown as EventBus;
    service = new AccountsService(
      prisma,
      new AccountPermissionsService(prisma, eventBus),
      { hash } as unknown as PasswordService,
      eventBus,
    );
  });

  describe('create', () => {
    it('hashes outside the tx, locks the actor first, writes account + preset, publishes once after commit', async () => {
      const summary = await service.create(ACTOR, createInput());

      expect(calls).toEqual([
        'hash',
        'tx.begin',
        `tx.lock:${ACTOR}`,
        `tx.perms:${ACTOR}`,
        'tx.create',
        'tx.createPerms',
        'tx.commit',
        'publish',
      ]);
      expect(hash).toHaveBeenCalledWith(PASSWORD);
      expect(tx.account.create).toHaveBeenCalledWith({
        data: {
          displayName: 'Thợ Mới',
          phone: '+84912345678',
          email: 'tho.moi@local.test',
          isActive: true,
          passwordHash: PASSWORD_HASH,
        },
        select: { id: true },
      });
      expect(tx.accountPermission.createMany).toHaveBeenCalledWith({
        data: ROLE_PRESETS.THO_KS.map((permission) => ({
          accountId: 'new-1',
          permission,
        })),
      });
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0][0] as AccountCreated;
      expect(event).toBeInstanceOf(AccountCreated);
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.target).toEqual({ type: 'Account', id: 'new-1' });
      expect(event.after).toEqual({
        displayName: 'Thợ Mới',
        phone: '+84912345678',
        email: 'tho.moi@local.test',
        isActive: true,
        permissions: [...ROLE_PRESETS.THO_KS].sort(),
        preset: 'THO_KS',
      });
      expect(JSON.stringify(event)).not.toMatch(/password|hash|Secret123/i);
      expect(summary.id).toBe('new-1');
    });

    it('a preset the actor cannot grant in full ⇒ 403, nothing created, no publish', async () => {
      const err = await catchAppException(
        service.create(ACTOR, { ...createInput(), preset: 'SUPER_ADMIN' }),
      );

      expect(err.getStatus()).toBe(403);
      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.message).toContain('Không thể cấp quyền bạn không có');
      expect(tx.account.create).not.toHaveBeenCalled();
      expect(tx.accountPermission.createMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('the actor lost permissions under the lock ⇒ 403 even though an unlocked read says otherwise', async () => {
      permissionsByAccount[ACTOR] = [PERM.catalogView];

      const err = await catchAppException(service.create(ACTOR, createInput()));

      expect(err.getStatus()).toBe(403);
      expect(outer.accountPermission.findMany).not.toHaveBeenCalled();
      expect(tx.account.create).not.toHaveBeenCalled();
    });

    it('the actor lost only permissions.manage under the lock ⇒ 403, though it can still grant the preset', async () => {
      permissionsByAccount[ACTOR] = ADMIN_PERMS.filter(
        (key) => key !== PERM.permissionsManage,
      );

      const err = await catchAppException(service.create(ACTOR, createInput()));

      expect(err.getStatus()).toBe(403);
      expect(err.message).toBe('Không đủ quyền thực hiện');
      expect(tx.account.create).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('a garbage phone ⇒ 400 on phone before hashing or any DB access', async () => {
      const err = await catchAppException(
        service.create(ACTOR, { ...createInput(), phone: 'abc' }),
      );

      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors?.[0].field).toBe('phone');
      expect(calls).toEqual([]);
    });

    it('a blank display name ⇒ 400 on displayName before any DB access', async () => {
      const err = await catchAppException(
        service.create(ACTOR, { ...createInput(), displayName: '   ' }),
      );

      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors?.[0].field).toBe('displayName');
      expect(calls).toEqual([]);
    });

    it.each([
      ['phone', 'Số điện thoại đã thuộc tài khoản khác.'],
      ['email', 'Email đã thuộc tài khoản khác.'],
    ] as const)(
      'P2002 where the %s is taken ⇒ 409 on that field, no publish',
      async (field, message) => {
        tx.account.create.mockRejectedValue({ code: 'P2002' });
        outer.account.findFirst.mockImplementation(
          ({ where }: { where: Record<string, unknown> }) =>
            Promise.resolve(field in where ? { id: 'other' } : null),
        );

        const err = await catchAppException(
          service.create(ACTOR, createInput()),
        );

        expect(err.getStatus()).toBe(409);
        expect(err.errorCode).toBe(ErrorCode.CONFLICT);
        expect(err.fieldErrors).toEqual([{ field, code: 'isUnique', message }]);
        // Looked up by the NORMALIZED values, with no own id to exclude on create.
        expect(outer.account.findFirst).toHaveBeenCalledWith({
          where: { phone: '+84912345678' },
          select: { id: true },
        });
        expect(publish).not.toHaveBeenCalled();
      },
    );

    it('P2002 with neither column taken anymore ⇒ the original error, not a guessed field', async () => {
      const original = { code: 'P2002' };
      tx.account.create.mockRejectedValue(original);

      await expect(service.create(ACTOR, createInput())).rejects.toBe(original);
    });

    it('any other write error is rethrown untouched', async () => {
      const boom = new Error('connection lost');
      tx.account.create.mockRejectedValue(boom);

      await expect(service.create(ACTOR, createInput())).rejects.toBe(boom);
      expect(outer.account.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('locks actor + target, reads both permission sets and before under the lock, publishes once after commit', async () => {
      await service.update(ACTOR, TARGET, updateInput());

      expect(calls).toEqual([
        'tx.begin',
        `tx.lock:${ACTOR},${TARGET}`,
        `tx.perms:${ACTOR}`,
        `tx.perms:${TARGET}`,
        'tx.before',
        'tx.update',
        'tx.commit',
        'publish',
      ]);
      expect(tx.account.update).toHaveBeenCalledWith({
        where: { id: TARGET },
        data: {
          displayName: 'Tên Mới',
          phone: '+84912345679',
          email: 'new@local.test',
          isActive: true,
        },
      });
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0][0] as AccountUpdated;
      expect(event).toBeInstanceOf(AccountUpdated);
      expect(event.target).toEqual({ type: 'Account', id: TARGET });
      expect(event.before).toEqual(row);
      expect(event.after).toEqual({
        displayName: 'Tên Mới',
        phone: '+84912345679',
        email: 'new@local.test',
        isActive: true,
      });
    });

    it('deactivating revokes every live session of the target inside the tx', async () => {
      await service.update(ACTOR, TARGET, updateInput(false));

      expect(tx.session.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.session.updateMany).toHaveBeenCalledWith({
        where: { accountId: TARGET, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
      expect(calls.indexOf('tx.revokeSessions')).toBeLessThan(
        calls.indexOf('tx.commit'),
      );
    });

    it('reactivating or renaming an active account revokes nothing', async () => {
      await service.update(ACTOR, TARGET, updateInput(true));
      row.isActive = false;
      await service.update(ACTOR, TARGET, updateInput(true));

      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });

    it('saving an already inactive account revokes again: sessions it still holds must not outlive it', async () => {
      row.isActive = false;

      await service.update(ACTOR, TARGET, updateInput(false));

      expect(tx.session.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.session.updateMany).toHaveBeenCalledWith({
        where: { accountId: TARGET, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('the actor lost only permissions.manage under the lock ⇒ 403, though the target holds less', async () => {
      permissionsByAccount[ACTOR] = ADMIN_PERMS.filter(
        (key) => key !== PERM.permissionsManage,
      );

      const err = await catchAppException(
        service.update(ACTOR, TARGET, updateInput(false)),
      );

      expect(err.getStatus()).toBe(403);
      expect(err.message).toBe('Không đủ quyền thực hiện');
      expect(tx.account.update).not.toHaveBeenCalled();
      expect(tx.session.updateMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('self ⇒ 403 before any DB access, even for a missing account', async () => {
      existing = [];

      const err = await catchAppException(
        service.update(ACTOR, ACTOR, updateInput()),
      );

      expect(err.getStatus()).toBe(403);
      expect(err.message).toBe('Không thể tự sửa tài khoản của chính mình.');
      expect(calls).toEqual([]);
    });

    it('a garbage phone wins over self', async () => {
      const err = await catchAppException(
        service.update(ACTOR, ACTOR, { ...updateInput(), phone: '12' }),
      );

      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors?.[0].field).toBe('phone');
    });

    it('a missing target ⇒ 404 before the escalation check, nothing written', async () => {
      existing = [ACTOR];
      permissionsByAccount[TARGET] = ALL;

      const err = await catchAppException(
        service.update(ACTOR, TARGET, updateInput()),
      );

      expect(err.getStatus()).toBe(404);
      expect(tx.accountPermission.findMany).not.toHaveBeenCalled();
      expect(tx.account.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('the target holds a permission the actor lacks ⇒ 403, nothing written', async () => {
      permissionsByAccount[TARGET] = [PERM.auditRead];

      const err = await catchAppException(
        service.update(ACTOR, TARGET, updateInput(false)),
      );

      expect(err.getStatus()).toBe(403);
      expect(err.message).toContain(
        'Không thể sửa account mang quyền bạn không có',
      );
      expect(outer.accountPermission.findMany).not.toHaveBeenCalled();
      expect(tx.account.update).not.toHaveBeenCalled();
      expect(tx.session.updateMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('P2002 on email ⇒ 409 on email, excluding the target itself from the lookup', async () => {
      tx.account.update.mockRejectedValue({ code: 'P2002' });
      outer.account.findFirst.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve('email' in where ? { id: 'other' } : null),
      );

      const err = await catchAppException(
        service.update(ACTOR, TARGET, updateInput()),
      );

      expect(err.getStatus()).toBe(409);
      expect(err.fieldErrors?.[0].field).toBe('email');
      expect(outer.account.findFirst).toHaveBeenCalledWith({
        where: { email: 'new@local.test', NOT: { id: TARGET } },
        select: { id: true },
      });
      expect(publish).not.toHaveBeenCalled();
    });
  });
});
