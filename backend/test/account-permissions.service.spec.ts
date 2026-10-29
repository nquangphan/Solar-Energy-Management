import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EventBus } from '../src/events/event-bus';
import { AccountPermissionsChanged } from '../src/accounts/domain/account-events';
import {
  PERM,
  PERMISSION_KEYS,
} from '../src/accounts/domain/permission-registry';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * Unit `AccountPermissionsService` — HERMETIC (mock `PrismaService` + `EventBus`, không
 * cần Postgres): `listForAccount` map rows → Set; `setForAccount` validate key lạ, enforce
 * hai luật không-leo-thang (KHÔNG chạm DB khi từ chối), transaction xoá-cũ-tạo-mới, rồi
 * publish `AccountPermissionsChanged` SAU commit.
 *
 * `findMany` mock theo `where.accountId` để actor và target trả HAI bộ quyền khác nhau —
 * mock trả cùng một Set cho cả hai sẽ khiến test luật #2 giả xanh.
 */

interface AccountPermissionRepoMock {
  findMany: jest.Mock;
  deleteMany: jest.Mock;
  createMany: jest.Mock;
}

async function catchAppException(p: Promise<unknown>): Promise<AppException> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppException) return err;
    throw err;
  }
  throw new Error('Kỳ vọng AppException nhưng promise resolve');
}

describe('AccountPermissionsService (unit, hermetic)', () => {
  const ACCOUNT_ID = 'acc-123';
  const ACTOR_ID = 'actor-1';
  const TARGET_ID = 'target-1';
  /** Repo outside the transaction: a save must never read permissions through it. */
  let repo: AccountPermissionRepoMock;
  /** Repo handed to the `$transaction` callback. */
  let txRepo: AccountPermissionRepoMock;
  let queryRaw: jest.Mock;
  let transaction: jest.Mock;
  let accountRepo: { findMany: jest.Mock; findUnique: jest.Mock };
  let publish: jest.Mock;
  let service: AccountPermissionsService;
  /** Order of side effects, to prove the lock is first and publish is after commit. */
  let calls: string[];

  /** Per-account permission sets, served by BOTH repos — actor ≠ target. */
  function givenPermissions(
    byAccount: Record<string, readonly string[]>,
  ): void {
    const impl = ({ where }: { where: { accountId: string } }) =>
      Promise.resolve(
        (byAccount[where.accountId] ?? []).map((permission) => ({
          permission,
        })),
      );
    repo.findMany.mockImplementation(impl);
    txRepo.findMany.mockImplementation(
      (args: { where: { accountId: string } }) => {
        calls.push(`tx.findMany:${args.where.accountId}`);
        return impl(args);
      },
    );
  }

  function newRepo(): AccountPermissionRepoMock {
    return {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
  }

  beforeEach(() => {
    calls = [];
    repo = newRepo();
    txRepo = newRepo();
    txRepo.deleteMany.mockImplementation(() => {
      calls.push('tx.deleteMany');
      return Promise.resolve({ count: 0 });
    });
    txRepo.createMany.mockImplementation(() => {
      calls.push('tx.createMany');
      return Promise.resolve({ count: 0 });
    });
    // The lock returns every requested id that "exists" (both, by default).
    queryRaw = jest.fn((_strings: TemplateStringsArray, ids: string[]) => {
      calls.push('tx.lock');
      return Promise.resolve(ids.map((id) => ({ id })));
    });
    // Runs the callback like Prisma does; a throw inside rejects (rollback).
    transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      calls.push('tx.begin');
      const result = await cb({
        $queryRaw: queryRaw,
        accountPermission: txRepo,
      });
      calls.push('tx.commit');
      return result;
    });
    accountRepo = { findMany: jest.fn(), findUnique: jest.fn() };
    publish = jest.fn(() => {
      calls.push('publish');
      return Promise.resolve();
    });
    const prisma = {
      accountPermission: repo,
      account: accountRepo,
      $transaction: transaction,
    } as unknown as PrismaService;
    const eventBus = { publish } as unknown as EventBus;
    service = new AccountPermissionsService(prisma, eventBus);
  });

  describe('listForAccount', () => {
    it('map rows → Set các key', async () => {
      repo.findMany.mockResolvedValue([
        { permission: PERM.ordersViewAll },
        { permission: PERM.auditRead },
      ]);

      const result = await service.listForAccount(ACCOUNT_ID);

      expect(repo.findMany).toHaveBeenCalledWith({
        where: { accountId: ACCOUNT_ID },
        select: { permission: true },
      });
      expect(result).toEqual(new Set([PERM.ordersViewAll, PERM.auditRead]));
    });

    it('account không có quyền → Set rỗng', async () => {
      repo.findMany.mockResolvedValue([]);
      expect((await service.listForAccount(ACCOUNT_ID)).size).toBe(0);
    });
  });

  describe('setForAccount', () => {
    /** Actor đủ quyền cho các ca không kiểm luật (validate / ghi / dedup). */
    function givenPermittedActor(targetKeys: readonly string[] = []): void {
      givenPermissions({
        [ACTOR_ID]: [
          PERM.ordersViewAll,
          PERM.auditRead,
          PERM.costsView,
          PERM.permissionsManage,
          PERM.settingsManage,
          PERM.customersManage,
          PERM.quotesCreateEdit,
          PERM.catalogView,
        ],
        [TARGET_ID]: targetKeys,
      });
    }

    function expectNothingWritten(): void {
      expect(txRepo.deleteMany).not.toHaveBeenCalled();
      expect(txRepo.createMany).not.toHaveBeenCalled();
      expect(repo.deleteMany).not.toHaveBeenCalled();
      expect(repo.createMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    }

    it('key lạ (ngoài registry) → 400 + fieldErrors.permissions, KHÔNG mở transaction', async () => {
      givenPermittedActor();

      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, TARGET_ID, [
          PERM.ordersViewAll,
          'orders.delete_all' as never,
        ]),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors?.map((e) => e.field)).toEqual(['permissions']);
      expect(transaction).not.toHaveBeenCalled();
      expectNothingWritten();
    });

    it('unknown key wins over self-edit (validation first)', async () => {
      givenPermittedActor();
      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, ACTOR_ID, ['nope.nope' as never]),
      );
      expect(err.getStatus()).toBe(400);
    });

    it('self-edit → 403 with the self-edit sentence, no transaction', async () => {
      givenPermittedActor();

      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, ACTOR_ID, [PERM.ordersViewAll]),
      );

      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.getStatus()).toBe(403);
      expect(err.message).toBe('Không thể tự sửa quyền của chính mình.');
      expect(transaction).not.toHaveBeenCalled();
      expectNothingWritten();
    });

    it('self-edit wins over the escalation rules (an actor lacking keys still gets the self-edit 403)', async () => {
      givenPermissions({ [ACTOR_ID]: [PERM.permissionsManage] });
      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, ACTOR_ID, [PERM.auditRead]),
      );
      expect(err.message).toBe('Không thể tự sửa quyền của chính mình.');
    });

    it('target missing under the lock → 404, nothing written', async () => {
      givenPermittedActor();
      queryRaw.mockImplementation(() => Promise.resolve([{ id: ACTOR_ID }]));

      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, TARGET_ID, [PERM.ordersViewAll]),
      );

      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(err.getStatus()).toBe(404);
      expectNothingWritten();
    });

    it('locks both account rows as the FIRST statement, ordered by id', async () => {
      givenPermittedActor();

      await service.setForAccount(ACTOR_ID, TARGET_ID, [PERM.ordersViewAll]);

      expect(calls[0]).toBe('tx.begin');
      expect(calls[1]).toBe('tx.lock');
      const [strings, ids] = queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        string[],
      ];
      const sql = strings.join('?').replace(/\s+/g, ' ');
      expect(sql).toMatch(
        /SELECT id FROM accounts WHERE id = ANY\(\?::text\[\]\) ORDER BY id FOR UPDATE/,
      );
      expect([...ids].sort()).toEqual([ACTOR_ID, TARGET_ID].sort());
    });

    it('reads actor AND target permissions through tx, after the lock — never through this.prisma', async () => {
      givenPermittedActor([PERM.ordersViewAll]);

      await service.setForAccount(ACTOR_ID, TARGET_ID, [PERM.ordersViewAll]);

      expect(repo.findMany).not.toHaveBeenCalled();
      const lockAt = calls.indexOf('tx.lock');
      expect(calls.indexOf(`tx.findMany:${ACTOR_ID}`)).toBeGreaterThan(lockAt);
      expect(calls.indexOf(`tx.findMany:${TARGET_ID}`)).toBeGreaterThan(lockAt);
    });

    it('actor whose permissions.manage was revoked before the lock → 403, nothing written, though rules #1/#2 pass', async () => {
      givenPermissions({
        [ACTOR_ID]: [PERM.ordersViewAll, PERM.catalogView],
        [TARGET_ID]: [PERM.ordersViewAll],
      });

      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, TARGET_ID, [PERM.catalogView]),
      );

      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.getStatus()).toBe(403);
      expect(err.message).toBe('Không đủ quyền thực hiện');
      expectNothingWritten();
    });

    it('luật #1 — actor cấp quyền chính mình KHÔNG có → FORBIDDEN 403, KHÔNG ghi', async () => {
      givenPermissions({
        [ACTOR_ID]: [PERM.ordersViewAll, PERM.permissionsManage],
        [TARGET_ID]: [],
      });

      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, TARGET_ID, [
          PERM.ordersViewAll,
          PERM.costsView,
        ]),
      );

      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.getStatus()).toBe(403);
      expect(err.message).toContain(PERM.costsView);
      expectNothingWritten();
    });

    it('luật #2 — target mang quyền actor KHÔNG có → FORBIDDEN 403 kể cả khi thu sạch (keys = [])', async () => {
      // Ca "ADMIN xoá Super Admin": bộ mới RỖNG ⇒ luật #1 không có gì để bắt. Chỉ luật #2
      // (kiểm bộ quyền HIỆN TẠI của target) mới chặn được.
      givenPermissions({
        [ACTOR_ID]: [PERM.ordersViewAll, PERM.permissionsManage],
        [TARGET_ID]: [PERM.ordersViewAll, PERM.auditRead],
      });

      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, TARGET_ID, []),
      );

      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.getStatus()).toBe(403);
      expect(err.message).toContain(PERM.auditRead);
      expectNothingWritten();
    });

    it.each([
      [
        'settings.manage without customers.manage',
        [PERM.settingsManage],
        ['«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».'],
      ],
      [
        'quotes.create_edit without customers.manage',
        [PERM.quotesCreateEdit, PERM.catalogView, PERM.ordersViewOwn],
        ['«Tạo/sửa báo giá» cần thêm «Quản lý khách hàng».'],
      ],
      [
        'quotes.create_edit without catalog.view',
        [PERM.quotesCreateEdit, PERM.customersManage, PERM.ordersViewOwn],
        ['«Tạo/sửa báo giá» cần thêm «Xem danh mục vật tư».'],
      ],
    ])(
      'dependency gap (%s) → 400 + fieldErrors.permissions naming both permissions, nothing written',
      async (_name, keys, messages) => {
        givenPermittedActor();

        const err = await catchAppException(
          service.setForAccount(ACTOR_ID, TARGET_ID, keys),
        );

        expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
        expect(err.getStatus()).toBe(400);
        expect(err.fieldErrors).toEqual(
          messages.map((message) => ({
            field: 'permissions',
            code: 'PERMISSION_DEPENDENCY',
            message,
          })),
        );
        expect(err.message).toBe(messages.join(' '));
        expectNothingWritten();
      },
    );

    it('escalation is checked before dependencies (403 wins over 400)', async () => {
      givenPermissions({
        [ACTOR_ID]: [PERM.permissionsManage],
        [TARGET_ID]: [],
      });
      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, TARGET_ID, [PERM.settingsManage]),
      );
      expect(err.getStatus()).toBe(403);
    });

    it('happy path → deleteMany + createMany through tx, publish exactly once AFTER commit', async () => {
      givenPermittedActor([PERM.ordersViewAll]);

      await service.setForAccount(ACTOR_ID, TARGET_ID, [
        PERM.ordersViewAll,
        PERM.auditRead,
      ]);

      expect(txRepo.deleteMany).toHaveBeenCalledWith({
        where: { accountId: TARGET_ID },
      });
      expect(txRepo.createMany).toHaveBeenCalledWith({
        data: [
          { accountId: TARGET_ID, permission: PERM.ordersViewAll },
          { accountId: TARGET_ID, permission: PERM.auditRead },
        ],
      });
      expect(repo.deleteMany).not.toHaveBeenCalled();
      expect(repo.createMany).not.toHaveBeenCalled();
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(calls.slice(-4)).toEqual([
        'tx.deleteMany',
        'tx.createMany',
        'tx.commit',
        'publish',
      ]);

      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0][0] as AccountPermissionsChanged;
      expect(event).toBeInstanceOf(AccountPermissionsChanged);
      expect(event.type).toBe('AccountPermissionsChanged');
      expect(event.actorAccountId).toBe(ACTOR_ID);
      expect(event.target).toEqual({ type: 'Account', id: TARGET_ID });
      expect(event.before.permissions).toEqual([PERM.ordersViewAll]);
      expect(event.after.permissions).toEqual(
        [PERM.ordersViewAll, PERM.auditRead].sort(),
      );
    });

    it('a failure inside the transaction publishes nothing', async () => {
      givenPermittedActor();
      txRepo.createMany.mockRejectedValue(new Error('boom'));

      await expect(
        service.setForAccount(ACTOR_ID, TARGET_ID, [PERM.ordersViewAll]),
      ).rejects.toThrow('boom');
      expect(publish).not.toHaveBeenCalled();
    });

    it('khử trùng lặp key trước khi ghi', async () => {
      givenPermittedActor();

      await service.setForAccount(ACTOR_ID, TARGET_ID, [
        PERM.ordersViewAll,
        PERM.ordersViewAll,
      ]);

      expect(txRepo.createMany).toHaveBeenCalledWith({
        data: [{ accountId: TARGET_ID, permission: PERM.ordersViewAll }],
      });
    });

    it('mảng rỗng → thu hồi TẤT CẢ quyền (chỉ deleteMany, KHÔNG createMany rỗng)', async () => {
      // Epic 8 "bỏ tick hết" / vô hiệu account: thay bằng bộ quyền rỗng. KHÔNG phát
      // `createMany` rỗng (thừa + có thể ném ở Prisma 7 adapter-pg) — chỉ `deleteMany`.
      givenPermittedActor([PERM.ordersViewAll]);

      await service.setForAccount(ACTOR_ID, TARGET_ID, []);

      expect(txRepo.deleteMany).toHaveBeenCalledWith({
        where: { accountId: TARGET_ID },
      });
      expect(txRepo.createMany).not.toHaveBeenCalled();
      expect(transaction).toHaveBeenCalledTimes(1);

      const event = publish.mock.calls[0][0] as AccountPermissionsChanged;
      expect(event.before.permissions).toEqual([PERM.ordersViewAll]);
      expect(event.after.permissions).toEqual([]);
    });
  });

  describe('summaries / summary', () => {
    const row = (id: string, permissions: readonly string[], extra = {}) => ({
      id,
      displayName: `Name ${id}`,
      phone: id === TARGET_ID ? null : '+84901234567',
      email: `${id}@x.test`,
      isActive: true,
      permissions: permissions.map((permission) => ({ permission })),
      ...extra,
    });

    it('labels the matching preset, flags self and higher accounts read-only, never selects passwordHash', async () => {
      givenPermissions({ [ACTOR_ID]: ROLE_PRESETS.ADMIN });
      accountRepo.findMany.mockResolvedValue([
        row(ACTOR_ID, ROLE_PRESETS.ADMIN),
        row(TARGET_ID, ROLE_PRESETS.THO_KS, { isActive: false }),
        row('super', ROLE_PRESETS.SUPER_ADMIN),
        row('custom', [PERM.catalogView]),
      ]);

      const result = await service.summaries(ACTOR_ID);

      const args = accountRepo.findMany.mock.calls[0][0] as {
        select: Record<string, unknown>;
        orderBy: unknown;
      };
      expect(args.select).not.toHaveProperty('passwordHash');
      expect(args.orderBy).toEqual({ displayName: 'asc' });
      expect(result.map((s) => [s.id, s.matchingPreset, s.editable])).toEqual([
        [ACTOR_ID, 'ADMIN', false],
        [TARGET_ID, 'THO_KS', true],
        ['super', 'SUPER_ADMIN', false],
        ['custom', null, true],
      ]);
      expect(result.map((s) => s.matchingPresetLabel)).toEqual([
        'Admin',
        'Thợ khảo sát',
        'Super Admin',
        null,
      ]);
      expect(result[0].readOnlyReason).toBe('Đây là tài khoản của bạn.');
      expect(result[1].readOnlyReason).toBeNull();
      expect(result[1].isActive).toBe(false);
      expect(result[1].phone).toBeNull();
      expect(result[2].readOnlyReason).toBe(
        'Tài khoản mang quyền bạn không có: Xem Audit log (Super Admin), Cờ tính năng (vận hành app).',
      );
      expect(result[3].permissions).toEqual([PERM.catalogView]);
    });

    it('summary of a missing account → 404', async () => {
      givenPermissions({ [ACTOR_ID]: ROLE_PRESETS.ADMIN });
      accountRepo.findUnique.mockResolvedValue(null);
      const err = await catchAppException(service.summary(ACTOR_ID, 'gone'));
      expect(err.getStatus()).toBe(404);
    });
  });

  describe('permissionOptions', () => {
    it('ADMIN: grantable follows the actor set, presets exclude what the actor cannot grant in full', async () => {
      givenPermissions({ [ACTOR_ID]: ROLE_PRESETS.ADMIN });

      const options = await service.permissionOptions(ACTOR_ID);

      expect(options.presets.map((p) => p.key)).toEqual([
        'THO_KS',
        'THI_CONG',
        'KE_TOAN',
        'KHO_GIAO',
        'QUAN_LY',
        'ADMIN',
      ]);
      expect(options.presets[0]).toEqual({
        key: 'THO_KS',
        label: 'Thợ khảo sát',
        permissions: [...ROLE_PRESETS.THO_KS],
      });
      const byKey = new Map(options.permissions.map((p) => [p.key, p]));
      expect(byKey.get(PERM.auditRead)?.grantable).toBe(false);
      expect(byKey.get(PERM.systemFeatureFlags)?.grantable).toBe(false);
      expect(byKey.get(PERM.costsView)?.grantable).toBe(true);
      expect(byKey.get(PERM.quotesCreateEdit)?.requires).toEqual([
        PERM.customersManage,
        PERM.catalogView,
      ]);
      expect(byKey.get(PERM.settingsManage)?.requires).toEqual([
        PERM.customersManage,
      ]);
      expect(byKey.get(PERM.ordersViewAll)?.requires).toEqual([]);
    });

    it('lists every registry permission once, grouped (each group contiguous)', async () => {
      givenPermissions({ [ACTOR_ID]: ROLE_PRESETS.SUPER_ADMIN });

      const options = await service.permissionOptions(ACTOR_ID);

      expect(new Set(options.permissions.map((p) => p.key))).toEqual(
        new Set(PERMISSION_KEYS),
      );
      expect(options.permissions).toHaveLength(PERMISSION_KEYS.length);
      const groups = options.permissions.map((p) => p.group);
      const seen = new Set<string>();
      groups.forEach((group, i) => {
        if (i > 0 && groups[i - 1] !== group) {
          expect(seen.has(group)).toBe(false);
        }
        seen.add(group);
      });
      expect(options.presets.map((p) => p.key)).toContain('SUPER_ADMIN');
    });
  });
});
