import { randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { AuditService } from '../src/audit/audit.service';
import { AuditSubscriber } from '../src/audit/audit.subscriber';
import { loadAuthConfig } from '../src/auth/auth.config';
import { AuthService } from '../src/auth/auth.service';
import { PasswordService } from '../src/auth/password.service';
import { AppException } from '../src/common/errors/app.exception';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * DB lane for creating / updating / deactivating an account. Only a real Postgres shows the
 * unique indexes racing, READ COMMITTED under the row locks, and the sessions a deactivation
 * revokes — mocks cannot model any of it.
 *
 * Skips without `DATABASE_URL` so `npm test` stays hermetic. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('account create / update (real Postgres)', () => {
  let prisma: PrismaClient;
  let accounts: AccountsService;
  let auth: AuthService;
  const EMAIL_PREFIX = 'zz-test-acc-crud-';
  const SOURCE_NAME = 'ZZ acc-crud source';
  const CUSTOMER_PHONE = '+84900008301';
  const PASSWORD = 'MatKhau123';
  let adminId: string;

  const email = (suffix: string) => `${EMAIL_PREFIX}${suffix}@local.test`;

  async function cleanUp(): Promise<void> {
    const ids = (
      await prisma.account.findMany({
        where: { email: { startsWith: EMAIL_PREFIX } },
        select: { id: true },
      })
    ).map((a) => a.id);
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorAccountId: { in: ids } }, { targetId: { in: ids } }],
      },
    });
    await prisma.order.deleteMany({ where: { ownerAccountId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { sdt: CUSTOMER_PHONE } });
    await prisma.customerSource.deleteMany({ where: { name: SOURCE_NAME } });
    // account_permissions and sessions cascade with the account.
    await prisma.account.deleteMany({ where: { id: { in: ids } } });
  }

  const createInput = (suffix: string, phone: string) => ({
    displayName: `ZZ ${suffix}`,
    phone,
    email: email(suffix),
    password: PASSWORD,
    preset: 'THO_KS' as const,
    isActive: true,
  });
  const profileOf = async (id: string) =>
    prisma.account.findUniqueOrThrow({
      where: { id },
      select: { displayName: true, phone: true, email: true, isActive: true },
    });
  const auditRows = (targetId: string, eventType: string) =>
    prisma.auditLog.findMany({
      where: { targetType: 'Account', targetId, eventType },
      orderBy: { createdAt: 'asc' },
    });

  async function catchAppException(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (err) {
      if (err instanceof AppException) return err;
      throw err;
    }
    throw new Error('Expected an AppException, the promise resolved');
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * An uncommitted transaction that has already run `write`. Returns `release` to commit it.
   * The holder WRITES the very rows the service reads, so a missing `FOR UPDATE` reads the old
   * committed value instead of waiting.
   */
  async function holdUncommitted(
    write: (
      tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    ) => Promise<unknown>,
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
        await write(t);
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

  /** A real revoke of the actor's permissions, as `setForAccount` does it: lock, then replace. */
  const revokeActorPermissions = (keys: readonly string[]) =>
    holdUncommitted(async (t) => {
      await t.$queryRaw`SELECT id FROM accounts WHERE id = ${adminId} FOR UPDATE`;
      await t.accountPermission.deleteMany({ where: { accountId: adminId } });
      if (keys.length > 0) {
        await t.accountPermission.createMany({
          data: keys.map((permission) => ({ accountId: adminId, permission })),
        });
      }
    });

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    const db = prisma as unknown as PrismaService;
    const bus = new InProcessEventBus();
    new AuditSubscriber(bus, new AuditService(db)).onModuleInit();
    const passwords = new PasswordService();
    accounts = new AccountsService(
      db,
      new AccountPermissionsService(db, bus),
      passwords,
      bus,
    );
    auth = new AuthService(
      accounts,
      passwords,
      new JwtService({ secret: randomBytes(32).toString('hex') }),
      db,
      bus,
      loadAuthConfig(),
    );
  });

  beforeEach(async () => {
    await cleanUp();
    const admin = await prisma.account.create({
      data: {
        email: email('admin'),
        passwordHash: 'not-a-real-hash',
        displayName: 'ZZ admin',
        permissions: {
          create: ROLE_PRESETS.ADMIN.map((permission) => ({ permission })),
        },
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it('creates with the preset set, an E.164 phone and a lowercased email; one audit row', async () => {
    const summary = await accounts.create(adminId, {
      ...createInput('tho', '0912 345 678'),
      email: `  ${email('THO').toUpperCase()} `,
    });

    expect(await profileOf(summary.id)).toEqual({
      displayName: 'ZZ tho',
      phone: '+84912345678',
      email: email('tho'),
      isActive: true,
    });
    const keys = await prisma.accountPermission.findMany({
      where: { accountId: summary.id },
      select: { permission: true },
    });
    expect(keys.map((k) => k.permission).sort()).toEqual(
      [...ROLE_PRESETS.THO_KS].sort(),
    );
    const audit = await auditRows(summary.id, 'AccountCreated');
    expect(audit).toHaveLength(1);
    expect(audit[0].actorAccountId).toBe(adminId);
    expect(JSON.stringify(audit[0].after)).not.toMatch(/password|hash/i);
  });

  it('two concurrent creates with the same phone ⇒ one 201, one 409 on phone, one row', async () => {
    const results = await Promise.allSettled([
      accounts.create(adminId, createInput('p1', '0912 000 111')),
      accounts.create(adminId, createInput('p2', '+84912000111')),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    const err = rejected?.reason as AppException;
    expect(err).toBeInstanceOf(AppException);
    expect(err.getStatus()).toBe(409);
    expect(err.fieldErrors?.map((e) => e.field)).toEqual(['phone']);
    expect(
      await prisma.account.count({ where: { phone: '+84912000111' } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { eventType: 'AccountCreated', actorAccountId: adminId },
      }),
    ).toBe(1);
  });

  it('two concurrent creates with the same email ⇒ 409 on email (column found without meta)', async () => {
    const results = await Promise.allSettled([
      accounts.create(adminId, createInput('dup', '0912 000 221')),
      accounts.create(adminId, createInput('dup', '0912 000 222')),
    ]);

    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason as AppException;
    expect(err.getStatus()).toBe(409);
    expect(err.fieldErrors?.map((e) => e.field)).toEqual(['email']);
  });

  it('updating onto another account’s phone ⇒ 409 on phone, nothing changed, no audit', async () => {
    const a = await accounts.create(adminId, createInput('a', '0912 000 331'));
    const b = await accounts.create(adminId, createInput('b', '0912 000 332'));

    const err = await catchAppException(
      accounts.update(adminId, b.id, {
        displayName: 'ZZ b2',
        phone: '0912 000 331',
        email: email('b'),
        isActive: true,
      }),
    );

    expect(err.getStatus()).toBe(409);
    expect(err.fieldErrors?.map((e) => e.field)).toEqual(['phone']);
    expect((await profileOf(b.id)).displayName).toBe('ZZ b');
    expect(await auditRows(b.id, 'AccountUpdated')).toHaveLength(0);
    // Keeping one's own phone is not a conflict.
    await accounts.update(adminId, a.id, {
      displayName: 'ZZ a2',
      phone: '0912 000 331',
      email: email('a'),
      isActive: true,
    });
    expect(await auditRows(a.id, 'AccountUpdated')).toHaveLength(1);
  });

  it('deactivating revokes every session and blocks sign-in; data stays; reactivating does not revive old tokens', async () => {
    const worker = await accounts.create(
      adminId,
      createInput('worker', '0912 000 441'),
    );
    const first = await auth.login('0912 000 441', PASSWORD);
    await auth.login('0912000441', PASSWORD);
    const source = await prisma.customerSource.create({
      data: { name: SOURCE_NAME, sortOrder: 999 },
    });
    await prisma.customer.create({
      data: {
        sdt: CUSTOMER_PHONE,
        custType: 'CA_NHAN',
        name: 'ZZ customer',
        sourceId: source.id,
      },
    });
    const order = await prisma.order.create({
      data: {
        status: 'nhap',
        customerSdt: CUSTOMER_PHONE,
        ownerAccountId: worker.id,
        sourceId: source.id,
        custType: 'CA_NHAN',
      },
    });
    const off = {
      displayName: 'ZZ worker',
      phone: '0912 000 441',
      email: email('worker'),
      isActive: false,
    };

    await accounts.update(adminId, worker.id, off);

    const sessions = await prisma.session.findMany({
      where: { accountId: worker.id },
    });
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(
      (await catchAppException(auth.login('0912000441', PASSWORD))).getStatus(),
    ).toBe(401);
    expect(
      await prisma.order.findUnique({ where: { id: order.id } }),
    ).toMatchObject({ ownerAccountId: worker.id });
    expect(await auditRows(worker.id, 'AccountCreated')).toHaveLength(1);
    expect(await auditRows(worker.id, 'AccountUpdated')).toHaveLength(1);

    await accounts.update(adminId, worker.id, { ...off, isActive: true });

    expect(
      (await catchAppException(auth.refresh(first.refreshToken))).getStatus(),
    ).toBe(401);
    await expect(auth.login('0912000441', PASSWORD)).resolves.toBeDefined();
  });

  it('saving an account switched off elsewhere revokes the sessions it kept; reactivating does not revive them', async () => {
    const worker = await accounts.create(
      adminId,
      createInput('off', '0912 000 481'),
    );
    const live = await auth.login('0912000481', PASSWORD);
    // Switched off outside the account form: its session row is still live.
    await prisma.account.update({
      where: { id: worker.id },
      data: { isActive: false },
    });
    const off = {
      displayName: 'ZZ off',
      phone: '0912 000 481',
      email: email('off'),
      isActive: false,
    };

    await accounts.update(adminId, worker.id, off);
    await accounts.update(adminId, worker.id, { ...off, isActive: true });

    expect(
      (
        await prisma.session.findMany({ where: { accountId: worker.id } })
      ).every((s) => s.revokedAt !== null),
    ).toBe(true);
    expect(
      (await catchAppException(auth.refresh(live.refreshToken))).getStatus(),
    ).toBe(401);
  });

  it('a save racing an uncommitted rename of the target waits: last write wins, before = the first write', async () => {
    const worker = await accounts.create(
      adminId,
      createInput('race', '0912 000 551'),
    );
    const holder = await holdUncommitted(async (t) => {
      await t.$executeRaw`UPDATE accounts SET display_name = 'X' WHERE id = ${worker.id}`;
    });

    const save = accounts.update(adminId, worker.id, {
      displayName: 'Y',
      phone: '0912 000 551',
      email: email('race'),
      isActive: true,
    });
    await wait(300);
    await holder.release();
    await save;

    expect((await profileOf(worker.id)).displayName).toBe('Y');
    const audit = await auditRows(worker.id, 'AccountUpdated');
    expect(audit).toHaveLength(1);
    expect(audit[0].before).toMatchObject({ displayName: 'X' });
    expect(audit[0].after).toMatchObject({ displayName: 'Y' });
  });

  it("create checks the actor's permissions under the lock: a racing revoke of permissions.manage wins", async () => {
    const holder = await revokeActorPermissions([PERM.catalogView]);

    const save = catchAppException(
      accounts.create(adminId, createInput('late', '0912 000 661')),
    );
    await wait(300);
    await holder.release();

    expect((await save).getStatus()).toBe(403);
    expect(
      await prisma.account.count({ where: { email: email('late') } }),
    ).toBe(0);
  });

  /** Every ADMIN key but `permissions.manage`: the actor can still grant THO_KS and edit a THO_KS target. */
  const ADMIN_WITHOUT_MANAGE = ROLE_PRESETS.ADMIN.filter(
    (key) => key !== PERM.permissionsManage,
  );

  it('create: a racing revoke of permissions.manage alone wins, though the actor can still grant the preset', async () => {
    const holder = await revokeActorPermissions(ADMIN_WITHOUT_MANAGE);

    const save = catchAppException(
      accounts.create(adminId, createInput('nomanage', '0912 000 671')),
    );
    await wait(300);
    await holder.release();

    expect((await save).getStatus()).toBe(403);
    expect(
      await prisma.account.count({ where: { email: email('nomanage') } }),
    ).toBe(0);
  });

  it('update: a racing revoke of permissions.manage alone wins, though the target holds less', async () => {
    const worker = await accounts.create(
      adminId,
      createInput('lesser', '0912 000 781'),
    );
    const holder = await revokeActorPermissions(ADMIN_WITHOUT_MANAGE);

    const save = catchAppException(
      accounts.update(adminId, worker.id, {
        displayName: 'ZZ changed',
        phone: '0912 000 781',
        email: email('lesser'),
        isActive: false,
      }),
    );
    await wait(300);
    await holder.release();

    expect((await save).getStatus()).toBe(403);
    expect(await profileOf(worker.id)).toMatchObject({
      displayName: 'ZZ lesser',
      isActive: true,
    });
  });

  it("update checks the actor's permissions under the lock: a racing revoke wins", async () => {
    const worker = await accounts.create(
      adminId,
      createInput('target', '0912 000 771'),
    );
    const holder = await revokeActorPermissions([]);

    const save = catchAppException(
      accounts.update(adminId, worker.id, {
        displayName: 'ZZ changed',
        phone: '0912 000 771',
        email: email('target'),
        isActive: false,
      }),
    );
    await wait(300);
    await holder.release();

    expect((await save).getStatus()).toBe(403);
    expect(await profileOf(worker.id)).toMatchObject({
      displayName: 'ZZ target',
      isActive: true,
    });
  });
});
