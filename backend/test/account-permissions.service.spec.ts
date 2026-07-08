import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * Unit `AccountPermissionsService` — HERMETIC (mock `PrismaService`, không cần Postgres):
 * `listForAccount` map rows → Set; `setForAccount` validate key lạ → ném lỗi KHÔNG ghi DB;
 * `setForAccount` transaction xoá-cũ-tạo-mới (atomic). Mirror chiến lược test 2.3.
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
  let repo: AccountPermissionRepoMock;
  let transaction: jest.Mock;
  let service: AccountPermissionsService;

  beforeEach(() => {
    repo = {
      findMany: jest.fn(),
      deleteMany: jest.fn().mockReturnValue({ op: 'deleteMany' }),
      createMany: jest.fn().mockReturnValue({ op: 'createMany' }),
    };
    transaction = jest.fn().mockResolvedValue([]);
    const prisma = {
      accountPermission: repo,
      $transaction: transaction,
    } as unknown as PrismaService;
    service = new AccountPermissionsService(prisma);
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
    it('key lạ (ngoài registry) → ném VALIDATION_ERROR, KHÔNG ghi DB', async () => {
      const err = await catchAppException(
        service.setForAccount(ACCOUNT_ID, [
          PERM.ordersViewAll,
          'orders.delete_all' as never,
        ]),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(transaction).not.toHaveBeenCalled();
      expect(repo.deleteMany).not.toHaveBeenCalled();
      expect(repo.createMany).not.toHaveBeenCalled();
    });

    it('key hợp lệ → transaction xoá-cũ-tạo-mới (atomic)', async () => {
      await service.setForAccount(ACCOUNT_ID, [
        PERM.ordersViewAll,
        PERM.auditRead,
      ]);

      expect(repo.deleteMany).toHaveBeenCalledWith({
        where: { accountId: ACCOUNT_ID },
      });
      expect(repo.createMany).toHaveBeenCalledWith({
        data: [
          { accountId: ACCOUNT_ID, permission: PERM.ordersViewAll },
          { accountId: ACCOUNT_ID, permission: PERM.auditRead },
        ],
      });
      // Một lệnh $transaction ôm cả delete + create (atomic, đúng thứ tự).
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(transaction).toHaveBeenCalledWith([
        { op: 'deleteMany' },
        { op: 'createMany' },
      ]);
    });

    it('khử trùng lặp key trước khi ghi', async () => {
      await service.setForAccount(ACCOUNT_ID, [
        PERM.ordersViewAll,
        PERM.ordersViewAll,
      ]);

      expect(repo.createMany).toHaveBeenCalledWith({
        data: [{ accountId: ACCOUNT_ID, permission: PERM.ordersViewAll }],
      });
    });

    it('mảng rỗng → thu hồi TẤT CẢ quyền (chỉ deleteMany, KHÔNG createMany rỗng)', async () => {
      // Epic 8 "bỏ tick hết" / vô hiệu account: thay bằng bộ quyền rỗng. KHÔNG phát
      // `createMany` rỗng (thừa + có thể ném ở Prisma 7 adapter-pg) — chỉ `deleteMany`.
      await service.setForAccount(ACCOUNT_ID, []);

      expect(repo.deleteMany).toHaveBeenCalledWith({
        where: { accountId: ACCOUNT_ID },
      });
      expect(repo.createMany).not.toHaveBeenCalled();
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(transaction).toHaveBeenCalledWith([{ op: 'deleteMany' }]);
    });
  });
});
