import 'dotenv/config';
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/auth/password.service';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';

/**
 * Seed MỘT account admin để đăng nhập được lúc dev (AC-1 "có gì để đăng nhập"). Đọc
 * email/mật khẩu từ env (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) — KHÔNG hardcode
 * mật khẩu trong repo. Băm argon2id qua `PasswordService` (cùng thuật toán như login).
 *
 * Story 2.4: nếu `SEED_ADMIN_IS_SUPER_ADMIN=true`, cấp cho account này bộ quyền preset
 * `SUPER_ADMIN` (gồm `audit.read` — AC-3). Idempotent: xoá-cũ-tạo-mới trong transaction,
 * chạy lại KHÔNG nhân đôi quyền. Bộ quyền lấy từ registry (`ROLE_PRESETS`) — KHÔNG literal.
 *
 * Chạy: `npm run prisma:migrate:deploy` (tạo bảng) rồi `npx prisma db seed`.
 * Đây là CLI script (không phải runtime backend) nên được phép `new PrismaClient`
 * với driver adapter — source-guard AD-1 chỉ quét `src/`.
 */
/**
 * Danh mục Nguồn khách khởi tạo (Story 3.3). `Customer.sourceId` là FK BẮT BUỘC ⇒ không có
 * mấy dòng này thì không tạo nổi một khách nào; vì vậy seed là một phần của story, không
 * phải việc vặt để sau.
 *
 * ĐÚNG MỘT dòng `isOther` — đó là dòng làm luật "chọn Khác thì phải ghi rõ `sourceNote`" kích
 * hoạt. Backend nhận biết nó bằng CỜ, không bằng tên: đổi "Khác" thành "Nguồn khác" ở màn cấu
 * hình (Story 3.5) không được phép làm sập luật đó.
 */
const CUSTOMER_SOURCES: readonly {
  name: string;
  description: string;
  sortOrder: number;
  isOther: boolean;
}[] = [
  {
    name: 'Facebook',
    description:
      'Khách nhắn tin hoặc bình luận từ quảng cáo/bài đăng Facebook.',
    sortOrder: 1,
    isOther: false,
  },
  {
    name: 'Zalo',
    description: 'Khách liên hệ qua Zalo (tin nhắn trực tiếp hoặc Zalo OA).',
    sortOrder: 2,
    isOther: false,
  },
  {
    name: 'Fanpage',
    description:
      'Khách đến từ fanpage của công ty, ngoài luồng quảng cáo trả phí.',
    sortOrder: 3,
    isOther: false,
  },
  {
    name: 'Đại lý',
    description: 'Khách do đại lý/cộng tác viên giới thiệu về.',
    sortOrder: 4,
    isOther: false,
  },
  {
    name: 'Khác',
    description:
      'Nguồn không nằm trong danh sách — bắt buộc ghi rõ ở ô ghi chú nguồn.',
    sortOrder: 99,
    isOther: true,
  },
];

/**
 * Idempotent: chạy lại KHÔNG nhân đôi danh mục.
 *
 * Dòng `isOther` tìm theo CỜ, KHÔNG theo `name` — và đó là toàn bộ vấn đề. Story 3.5 cho phép
 * ĐỔI TÊN dòng "Khác" ở màn cấu hình (có chủ đích: luật `sourceNote` đọc cờ, không so chuỗi).
 * Nếu seed vẫn tìm nó bằng `where: { name: 'Khác' }`, thì sau một lần admin đổi tên thành
 * "Nguồn khác", lần seed kế tiếp KHÔNG thấy dòng nào tên "Khác" ⇒ nhánh `create` chạy ⇒ sinh ra
 * dòng `isOther` THỨ HAI. Bất biến "đúng một dòng mang cờ" gãy, và dropdown nguồn có hai mục
 * "Khác". Tìm theo cờ thì đổi tên bao nhiêu lần cũng không đẻ thêm dòng.
 *
 * Đã tồn tại ⇒ GIỮ NGUYÊN `name`: cái tên đó có thể là admin vừa đặt, seed không có quyền đạp lại.
 *
 * ⚠️ Bốn dòng còn lại vẫn khoá theo `name` vì bảng KHÔNG có cột khoá bền nào khác (`id` là uuid
 * sinh lúc chạy). Đổi tên "Facebook" rồi seed lại ⇒ dòng "Facebook" cũ mọc lại như một mục trùng
 * — phiền, nhưng KHÔNG gãy bất biến nào, và bịt nó cần thêm cột `code` (đổi schema).
 */
export async function seedCustomerSources(prisma: PrismaClient): Promise<void> {
  for (const source of CUSTOMER_SOURCES) {
    const existing = source.isOther
      ? await prisma.customerSource.findFirst({ where: { isOther: true } })
      : await prisma.customerSource.findUnique({
          where: { name: source.name },
        });

    if (existing === null) {
      await prisma.customerSource.create({ data: source });
      continue;
    }

    await prisma.customerSource.update({
      where: { id: existing.id },
      data: {
        description: source.description,
        sortOrder: source.sortOrder,
        isOther: source.isOther,
      },
    });
  }
  console.log(`Đã seed ${CUSTOMER_SOURCES.length} Nguồn khách (idempotent).`);
}

/**
 * Seed account admin — CHỈ chạy khi có `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`.
 *
 * Vắng CẢ HAI ⇒ bỏ qua (danh mục nguồn khách vẫn được seed): dữ liệu tham chiếu mà
 * `Customer.sourceId` FK tới không được phép phụ thuộc vào việc máy đó có đặt credential admin
 * hay không. Có MỘT mà thiếu cái kia ⇒ ném lỗi: đó là cấu hình gõ nhầm, không phải chủ ý bỏ qua.
 */
async function seedAdminAccount(prisma: PrismaClient): Promise<void> {
  // Lowercase to match AccountsService.normalizeEmail — email is case-insensitive.
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email && !password) {
    console.log(
      'Bỏ qua seed admin: thiếu SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD trong .env.',
    );
    return;
  }
  if (!email || !password) {
    throw new Error(
      'Cần CẢ HAI SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD trong .env để seed admin.',
    );
  }
  const isSuperAdmin = process.env.SEED_ADMIN_IS_SUPER_ADMIN === 'true';

  const passwordHash = await new PasswordService().hash(password);
  const account = await prisma.account.upsert({
    where: { email },
    update: { passwordHash, isActive: true },
    create: { email, passwordHash, displayName: 'Admin', isActive: true },
  });
  console.log(`Đã seed account admin: ${email}`);

  if (isSuperAdmin) {
    const keys = [...new Set(ROLE_PRESETS.SUPER_ADMIN)];
    // Thay-thế bộ quyền (atomic) → idempotent; đảm bảo CHỈ account này có `audit.read`.
    await prisma.$transaction([
      prisma.accountPermission.deleteMany({
        where: { accountId: account.id },
      }),
      prisma.accountPermission.createMany({
        data: keys.map((permission) => ({
          accountId: account.id,
          permission,
        })),
      }),
    ]);
    console.log(
      `Đã cấp preset SUPER_ADMIN (${keys.length} quyền, gồm audit.read) cho: ${email}`,
    );
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seedCustomerSources(prisma);
    await seedAdminAccount(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// CHỈ tự chạy khi được gọi như một script CLI (`prisma db seed`). Không có rào này thì bất kỳ ai
// `import` file để dùng lại `seedCustomerSources()` — lane tích hợp DB làm đúng thế — sẽ vô tình
// kích hoạt seed admin và `process.exit(1)` ngay giữa một lần chạy jest.
if (require.main === module) {
  main().catch((error) => {
    console.error('Seed thất bại:', error);
    process.exit(1);
  });
}
