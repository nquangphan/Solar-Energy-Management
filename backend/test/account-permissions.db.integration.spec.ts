import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { AuditService } from '../src/audit/audit.service';
import { AuditSubscriber } from '../src/audit/audit.subscriber';
import { AppException } from '../src/common/errors/app.exception';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * DB lane for saving an account's permission set. Only a real Postgres shows READ COMMITTED:
 * a save racing another uncommitted save of the same account must still REPLACE the set, and
 * the actor's permissions must be checked as committed once the lock is held. Mock Prisma
 * cannot model isolation, so these races only exist here.
 *
 * Skips without `DATABASE_URL` so `npm test` stays hermetic. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('account permissions save (real Postgres)', () => {
  let prisma: PrismaClient;
  let service: AccountPermissionsService;
  const EMAIL_PREFIX = 'zz-test-acc-perms-';
  let adminId: string;
  let workerA: string;
  let workerB: string;

  async function cleanUp(): Promise<void> {
    const ids = (
      await prisma.account.findMany({
        where: { email: { startsWith: EMAIL_PREFIX } },
        select: { id: true },
      })
    ).map((a) => a.id);
    await prisma.auditLog.deleteMany({
      where: { actorAccountId: { in: ids } },
    });
    // account_permissions cascade with the account.
    await prisma.account.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
  }

  async function createAccount(
    suffix: string,
    permissions: readonly string[],
  ): Promise<string> {
    const account = await prisma.account.create({
      data: {
        email: `${EMAIL_PREFIX}${suffix}@local.test`,
        passwordHash: 'not-a-real-hash',
        displayName: `ZZ ${suffix}`,
        permissions: {
          create: permissions.map((permission) => ({ permission })),
        },
      },
    });
    return account.id;
  }

  async function keysOf(accountId: string): Promise<string[]> {
    const rows = await prisma.accountPermission.findMany({
      where: { accountId },
      select: { permission: true },
    });
    return rows.map((r) => r.permission).sort();
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * An uncommitted save of `accountId` that has already replaced its set with `keys`
   * (deleteMany + createMany — the same writes the service makes). Returns `release` to commit.
   */
  async function holdUncommittedSave(
    accountId: string,
    keys: readonly string[],
  ): Promise<{ release: () => Promise<void> }> {
    let commit!: () => void;
    const held = new Promise<void>((resolve) => {
      commit = resolve;
    });
    let written!: () => void;
    const ready = new Promise<void>((resolve) => {
      written = resolve;
    });
    const tx = prisma.$transaction(
      async (t) => {
        await t.accountPermission.deleteMany({ where: { accountId } });
        await t.accountPermission.createMany({
          data: keys.map((permission) => ({ accountId, permission })),
        });
        written();
        await held;
      },
      { timeout: 20_000 },
    );
    await ready;
    return {
      release: async () => {
        commit();
        await tx;
      },
    };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    const bus = new InProcessEventBus();
    new AuditSubscriber(
      bus,
      new AuditService(prisma as unknown as PrismaService),
    ).onModuleInit();
    service = new AccountPermissionsService(
      prisma as unknown as PrismaService,
      bus,
    );
    await cleanUp();
  });

  beforeEach(async () => {
    await cleanUp();
    adminId = await createAccount('admin', ROLE_PRESETS.ADMIN);
    workerA = await createAccount('worker-a', ROLE_PRESETS.THO_KS);
    workerB = await createAccount('worker-b', ROLE_PRESETS.THO_KS);
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it('saving A leaves B (same preset) untouched; a later preset change could not reach either', async () => {
    await service.setForAccount(adminId, workerA, [...ROLE_PRESETS.KE_TOAN]);

    expect(await keysOf(workerA)).toEqual([...ROLE_PRESETS.KE_TOAN].sort());
    expect(await keysOf(workerB)).toEqual([...ROLE_PRESETS.THO_KS].sort());
  });

  it('a save racing an uncommitted save of the same account still REPLACES the set (no merge, no P2002)', async () => {
    // X and Y are disjoint and both valid. Without the `FOR UPDATE` on accounts, the racing
    // save's `deleteMany` waits on the holder's deleted rows, then skips them and never sees
    // the holder's new rows ⇒ the final set is X ∪ Y.
    const X = [PERM.inventoryManage, PERM.deliveryConfirm, PERM.ordersViewOwn];
    const Y = [PERM.catalogView, PERM.paymentsRecord, PERM.ordersViewAll];
    const holder = await holdUncommittedSave(workerA, X);

    const racing = service.setForAccount(adminId, workerA, Y);
    await wait(300);
    await holder.release();
    await racing;

    expect(await keysOf(workerA)).toEqual([...Y].sort());
  });

  it("the actor's permissions are checked as committed under the lock (a revoke racing the save wins)", async () => {
    // The admin's permissions are being revoked (uncommitted) while the admin saves worker A
    // with costs.view. Read before the lock, the stale set would allow it; read under the
    // lock, the save waits for the revoke and is refused.
    const holder = await holdUncommittedSave(adminId, [
      PERM.permissionsManage,
      PERM.catalogView,
    ]);

    const racing = service
      .setForAccount(adminId, workerA, [PERM.catalogView, PERM.costsView])
      .then(
        () => null,
        (err: unknown) => err,
      );
    await wait(300);
    await holder.release();
    const err = await racing;

    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).getStatus()).toBe(403);
    expect(await keysOf(workerA)).toEqual([...ROLE_PRESETS.THO_KS].sort());
  });

  it('a target that does not exist ⇒ 404 and nothing is written', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const err = await service
      .setForAccount(adminId, missing, [PERM.catalogView])
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).getStatus()).toBe(404);
    expect(
      await prisma.accountPermission.count({ where: { accountId: missing } }),
    ).toBe(0);
  });

  it('a successful save writes exactly one AccountPermissionsChanged audit row', async () => {
    await service.setForAccount(adminId, workerA, [...ROLE_PRESETS.KHO_GIAO]);

    const audits = await prisma.auditLog.findMany({
      where: { actorAccountId: adminId },
    });
    expect(audits.map((a) => [a.eventType, a.targetType, a.targetId])).toEqual([
      ['AccountPermissionsChanged', 'Account', workerA],
    ]);
  });
});
