import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EventBus } from '../src/events/event-bus';
import { AccountPermissionsChanged } from '../src/accounts/domain/account-events';
import { PERM } from '../src/accounts/domain/permission-registry';
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
  let repo: AccountPermissionRepoMock;
  let transaction: jest.Mock;
  let publish: jest.Mock;
  let service: AccountPermissionsService;

  /** Bộ quyền per-account cho mock `findMany` — actor ≠ target. */
  function givenPermissions(
    byAccount: Record<string, readonly string[]>,
  ): void {
    repo.findMany.mockImplementation(
      ({ where }: { where: { accountId: string } }) =>
        Promise.resolve(
          (byAccount[where.accountId] ?? []).map((permission) => ({
            permission,
          })),
        ),
    );
  }

  beforeEach(() => {
    repo = {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockReturnValue({ op: 'deleteMany' }),
      createMany: jest.fn().mockReturnValue({ op: 'createMany' }),
    };
    transaction = jest.fn().mockResolvedValue([]);
    publish = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      accountPermission: repo,
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
        ],
        [TARGET_ID]: targetKeys,
      });
    }

    it('key lạ (ngoài registry) → ném VALIDATION_ERROR, KHÔNG ghi DB', async () => {
      givenPermittedActor();

      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, TARGET_ID, [
          PERM.ordersViewAll,
          'orders.delete_all' as never,
        ]),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(transaction).not.toHaveBeenCalled();
      expect(repo.deleteMany).not.toHaveBeenCalled();
      expect(repo.createMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('luật #1 — actor cấp quyền chính mình KHÔNG có → FORBIDDEN 403, KHÔNG chạm DB', async () => {
      givenPermissions({
        [ACTOR_ID]: [PERM.ordersViewAll],
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
      expect(transaction).not.toHaveBeenCalled();
      expect(repo.deleteMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('luật #2 — target mang quyền actor KHÔNG có → FORBIDDEN 403 kể cả khi thu sạch (keys = [])', async () => {
      // Ca "ADMIN xoá Super Admin": bộ mới RỖNG ⇒ luật #1 không có gì để bắt. Chỉ luật #2
      // (kiểm bộ quyền HIỆN TẠI của target) mới chặn được.
      givenPermissions({
        [ACTOR_ID]: [PERM.ordersViewAll],
        [TARGET_ID]: [PERM.ordersViewAll, PERM.auditRead],
      });

      const err = await catchAppException(
        service.setForAccount(ACTOR_ID, TARGET_ID, []),
      );

      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.getStatus()).toBe(403);
      expect(err.message).toContain(PERM.auditRead);
      expect(transaction).not.toHaveBeenCalled();
      expect(repo.deleteMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('happy path → transaction xoá-cũ-tạo-mới (atomic) + publish event SAU commit', async () => {
      givenPermittedActor([PERM.ordersViewAll]);

      await service.setForAccount(ACTOR_ID, TARGET_ID, [
        PERM.ordersViewAll,
        PERM.auditRead,
      ]);

      expect(repo.deleteMany).toHaveBeenCalledWith({
        where: { accountId: TARGET_ID },
      });
      expect(repo.createMany).toHaveBeenCalledWith({
        data: [
          { accountId: TARGET_ID, permission: PERM.ordersViewAll },
          { accountId: TARGET_ID, permission: PERM.auditRead },
        ],
      });
      // Một lệnh $transaction ôm cả delete + create (atomic, đúng thứ tự).
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(transaction).toHaveBeenCalledWith([
        { op: 'deleteMany' },
        { op: 'createMany' },
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

    it('khử trùng lặp key trước khi ghi', async () => {
      givenPermittedActor();

      await service.setForAccount(ACTOR_ID, TARGET_ID, [
        PERM.ordersViewAll,
        PERM.ordersViewAll,
      ]);

      expect(repo.createMany).toHaveBeenCalledWith({
        data: [{ accountId: TARGET_ID, permission: PERM.ordersViewAll }],
      });
    });

    it('mảng rỗng → thu hồi TẤT CẢ quyền (chỉ deleteMany, KHÔNG createMany rỗng)', async () => {
      // Epic 8 "bỏ tick hết" / vô hiệu account: thay bằng bộ quyền rỗng. KHÔNG phát
      // `createMany` rỗng (thừa + có thể ném ở Prisma 7 adapter-pg) — chỉ `deleteMany`.
      givenPermittedActor([PERM.ordersViewAll]);

      await service.setForAccount(ACTOR_ID, TARGET_ID, []);

      expect(repo.deleteMany).toHaveBeenCalledWith({
        where: { accountId: TARGET_ID },
      });
      expect(repo.createMany).not.toHaveBeenCalled();
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(transaction).toHaveBeenCalledWith([{ op: 'deleteMany' }]);

      const event = publish.mock.calls[0][0] as AccountPermissionsChanged;
      expect(event.before.permissions).toEqual([PERM.ordersViewAll]);
      expect(event.after.permissions).toEqual([]);
    });
  });
});
