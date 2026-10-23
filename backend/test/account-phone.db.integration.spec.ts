import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { AccountsService } from '../src/accounts/accounts.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * DB lane for `accounts.phone` — the sign-in identifier. Only a real Postgres proves the
 * unique index (two accounts can never share a number) and that it still admits many
 * NULLs (accounts created before the column). Also proves `findByPhone` never returns an
 * account whose phone is NULL.
 *
 * Skips without `DATABASE_URL` so `npm test` stays hermetic. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('accounts.phone constraints (real Postgres)', () => {
  let prisma: PrismaClient;
  const EMAIL_PREFIX = 'zz-test-account-phone-';
  const PHONE = '+84900000777';

  async function cleanUp(): Promise<void> {
    await prisma.account.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
  }

  function account(suffix: string, phone: string | null) {
    return {
      email: `${EMAIL_PREFIX}${suffix}@local.test`,
      phone,
      passwordHash: 'not-a-real-hash',
      displayName: 'ZZ Test',
    };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await cleanUp();
  });

  afterEach(cleanUp);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('two accounts with the same phone → P2002 unique violation', async () => {
    await prisma.account.create({ data: account('a', PHONE) });

    let caught: unknown;
    try {
      await prisma.account.create({ data: account('b', PHONE) });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('two accounts without a phone → both created', async () => {
    await prisma.account.create({ data: account('n1', null) });
    await prisma.account.create({ data: account('n2', null) });

    expect(
      await prisma.account.count({
        where: { email: { startsWith: EMAIL_PREFIX }, phone: null },
      }),
    ).toBe(2);
  });

  it('findByPhone returns the owner of the number and never a phone-less account', async () => {
    await prisma.account.create({ data: account('none', null) });
    const owner = await prisma.account.create({ data: account('own', PHONE) });
    // Only the read path is exercised: the write collaborators are never reached.
    const accounts = new AccountsService(
      prisma as unknown as PrismaService,
      null as never,
      null as never,
      null as never,
    );

    expect((await accounts.findByPhone(PHONE))?.id).toBe(owner.id);
    expect(await accounts.findByPhone('+84900000778')).toBeNull();
  });
});
