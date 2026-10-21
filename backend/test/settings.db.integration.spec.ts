import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AuditSubscriber } from '../src/audit/audit.subscriber';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';
import { LEGAL_ENTITY_FIELDS } from '../src/settings/domain/company-legal-entity';
import { SETTING } from '../src/settings/domain/setting-registry';
import { SettingsService } from '../src/settings/settings.service';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho Story 4.4 — các sự thật mà mock KHÔNG chứng minh được:
 *
 *  1. Migration của story này `migrate deploy` được ĐÈ LÊN lịch sử có sẵn (sinh OFFLINE,
 *     chưa từng chạy trên Postgres cho tới lane này).
 *  2. Upsert `system_settings` IDEMPOTENT: hai lần upsert cùng key ⇒ vẫn MỘT row, value mới
 *     — PK thật đứng ra bảo đảm, không phải mock hứa.
 *  3. `orders.k_wp` đã đổi kiểu Int → double precision (nhận "8.82", không truncate).
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 * Phạm vi: CHỈ ràng buộc do story này thêm.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB: vắng DATABASE_URL (npm test vẫn hermetic). Chạy: npm run test:db',
  );
}

moTa(
  'Ràng buộc tầng DB của system_settings + order metadata (Postgres THẬT)',
  () => {
    let prisma: PrismaClient;

    const LEGAL_KEYS = LEGAL_ENTITY_FIELDS.map(({ key }) => key);
    const ACTOR = 'acc-settings-73';

    async function donDep(): Promise<void> {
      await prisma.systemSetting.deleteMany({
        where: { key: { in: [SETTING.vatRatePercent, ...LEGAL_KEYS] } },
      });
      await prisma.auditLog.deleteMany({ where: { actorAccountId: ACTOR } });
    }

    beforeAll(async () => {
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      await prisma.$connect();
      await donDep();
    });

    afterAll(async () => {
      await donDep();
      await prisma.$disconnect();
    });

    describe('AC-1 — migration deploy sạch + upsert system_settings idempotent', () => {
      it('migration của story này nằm trong _prisma_migrations cùng lịch sử cũ', async () => {
        const applied = await prisma.$queryRawUnsafe<
          { migration_name: string }[]
        >(
          'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL',
        );
        const names = applied.map((row) => row.migration_name);

        expect(names).toContain(
          '20260717000000_add_system_settings_and_order_metadata',
        );
        // Deploy ĐÈ LÊN lịch sử có sẵn, không phải chỉ chạy được trên DB mới tinh.
        expect(names).toContain('20260716000000_add_orders');
      });

      it('upsert hai lần cùng key ⇒ MỘT row với value mới (PK thật enforce)', async () => {
        await prisma.systemSetting.upsert({
          where: { key: SETTING.vatRatePercent },
          create: { key: SETTING.vatRatePercent, value: '10' },
          update: { value: '10' },
        });
        await prisma.systemSetting.upsert({
          where: { key: SETTING.vatRatePercent },
          create: { key: SETTING.vatRatePercent, value: '12' },
          update: { value: '12' },
        });

        const rows = await prisma.systemSetting.findMany({
          where: { key: SETTING.vatRatePercent },
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].value).toBe('12');
      });
    });

    describe('AC-4 — orders.k_wp đổi kiểu Int → double precision', () => {
      it('cột k_wp trong information_schema là double precision (migration alter THẬT)', async () => {
        const cols = await prisma.$queryRawUnsafe<{ data_type: string }[]>(
          "SELECT data_type FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'k_wp'",
        );
        expect(cols).toHaveLength(1);
        expect(cols[0].data_type).toBe('double precision');
      });

      it('cột validity_note tồn tại kiểu text', async () => {
        const cols = await prisma.$queryRawUnsafe<{ data_type: string }[]>(
          "SELECT data_type FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'validity_note'",
        );
        expect(cols).toHaveLength(1);
        expect(cols[0].data_type).toBe('text');
      });
    });

    describe('company legal entity — rows + one audit row per changed key', () => {
      it('PUT two fields ⇒ 2 system_settings rows + 2 SystemSettingChanged audit rows by key; again ⇒ nothing new', async () => {
        const bus = new InProcessEventBus();
        new AuditSubscriber(
          bus,
          new AuditService(prisma as unknown as PrismaService),
        ).onModuleInit();
        const settings = new SettingsService(
          prisma as unknown as PrismaService,
          bus,
        );
        const input = {
          legalName: 'CÔNG TY TNHH A',
          taxCode: '0123456789',
          address: '',
          representative: '',
          representativeTitle: '',
          phone: '',
          bankAccount: '',
        };

        await settings.updateCompanyLegalEntity(ACTOR, input);
        await settings.updateCompanyLegalEntity(ACTOR, input);

        const rows = await prisma.systemSetting.findMany({
          where: { key: { in: LEGAL_KEYS } },
          orderBy: { key: 'asc' },
        });
        expect(rows.map((r) => [r.key, r.value])).toEqual([
          [SETTING.companyLegalName, 'CÔNG TY TNHH A'],
          [SETTING.companyTaxCode, '0123456789'],
        ]);
        const audits = await prisma.auditLog.findMany({
          where: { actorAccountId: ACTOR, eventType: 'SystemSettingChanged' },
          orderBy: { targetId: 'asc' },
        });
        expect(audits.map((a) => [a.targetType, a.targetId])).toEqual([
          ['SystemSetting', SETTING.companyLegalName],
          ['SystemSetting', SETTING.companyTaxCode],
        ]);
        await expect(settings.companyLegalEntity()).resolves.toEqual(input);
      });
    });
  },
);
