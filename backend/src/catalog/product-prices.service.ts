import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import { FLAG } from '../feature-flags/domain/feature-flag-registry';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { ProductPricesReplaced } from './domain/product-price-events';
import type { PriceTier } from './domain/price-resolution';
import { ProductPriceDto } from './dto/product-price.dto';

/**
 * Bậc thang giá theo số lượng (FR-15). Truy vấn CHỈ qua `PrismaService` (AD-1); side-effect CHỈ
 * qua `EventBus` port (AD-18).
 *
 * Bậc thang là MỘT TẬP HỢP, không phải các dòng rời rạc ⇒ chỉ có một thao tác ghi:
 * THAY-THẾ-NGUYÊN-KHỐI, nguyên tử. Không có "thêm một mức"/"sửa một mức"/"xoá một mức" — chúng
 * sẽ đẻ ra trạng thái nửa vời (bậc thang chồng chéo, khoảng trống) mà không ai kiểm được.
 */

/** Bậc thang trả về client — kèm `id` để FE có key ổn định. */
export interface ProductPriceRow extends PriceTier {
  readonly id: string;
}

@Injectable()
export class ProductPricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  /** Bậc thang hiện tại, sắp xếp `minQty` tăng dần (thứ tự người dùng đọc được). */
  async findByProduct(productId: string): Promise<ProductPriceRow[]> {
    await this.assertProductExists(productId);
    const rows = await this.prisma.productPrice.findMany({
      where: { productId },
      orderBy: { minQty: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      minQty: row.minQty,
      price: row.price,
    }));
  }

  /**
   * THAY THẾ toàn bộ bậc thang của một sản phẩm (xoá cũ → tạo mới, atomic qua `$transaction`)
   * — khuôn `AccountPermissionsService.setForAccount`.
   *
   * Thứ tự kiểm — fail-closed, KHÔNG chạm DB khi từ chối:
   *  1. Cờ TẮT ⇒ 409 TRƯỚC KHI CHẠM DB. Không phải "cho ghi nhưng lờ đi lúc đọc": ghi âm thầm
   *     vào một bảng không ai đọc là cách tạo dữ liệu ma. Muốn cấu hình bậc thang ⇒ bật cờ trước.
   *  2. Sản phẩm không tồn tại ⇒ 404.
   *  3. Trùng `minQty` trong CÙNG payload ⇒ 400 kèm `fieldErrors` — bắt ở TẦNG APP, không để
   *     DB `P2002` quyết: constraint DB sẽ trả lỗi sau khi `deleteMany` đã chạy trong tx, và
   *     thông điệp của nó không chỉ được vào ô nhập nào.
   */
  async replace(
    actorAccountId: string,
    productId: string,
    prices: ProductPriceDto[],
  ): Promise<ProductPriceRow[]> {
    const enabled = await this.featureFlags.isEnabled(
      FLAG.catalogTieredPricing,
    );
    if (!enabled) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Cờ giá phân tầng đang TẮT.',
      );
    }

    await this.assertProductExists(productId);
    this.assertNoDuplicateMinQty(prices);

    const before = await this.prisma.productPrice.findMany({
      where: { productId },
      orderBy: { minQty: 'asc' },
    });

    // Xoá bậc thang cũ, rồi CHỈ tạo mới khi có dòng.
    //
    // `createMany({ data: [] })` với mảng RỖNG làm hỏng atomic-replace ở Prisma 7 + adapter-pg
    // (đã cắn một lần ở `account-permissions.service.ts`: revocation im lặng không chạy). Mảng
    // rỗng là đầu vào HỢP LỆ ở đây ("xoá hết bậc thang, quay về một giá") nên nhánh này không
    // phải phòng xa — nó là đường đi thật. `deleteMany` chạy VÔ ĐIỀU KIỆN.
    const ops = [this.prisma.productPrice.deleteMany({ where: { productId } })];
    if (prices.length > 0) {
      ops.push(
        this.prisma.productPrice.createMany({
          data: prices.map((tier) => ({
            productId,
            minQty: tier.minQty,
            price: tier.price,
          })),
        }),
      );
    }
    await this.prisma.$transaction(ops);

    const after = await this.prisma.productPrice.findMany({
      where: { productId },
      orderBy: { minQty: 'asc' },
    });

    // SAU commit (AD-18). `before`/`after` là CẢ BẬC THANG — thao tác nghiệp vụ là "đổi bậc
    // thang", không phải "sửa một dòng".
    await this.eventBus.publish(
      new ProductPricesReplaced(
        actorAccountId,
        productId,
        before.map(toTier),
        after.map(toTier),
        new Date(),
      ),
    );

    return after.map((row) => ({
      id: row.id,
      minQty: row.minQty,
      price: row.price,
    }));
  }

  private async assertProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (product === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy sản phẩm: ${productId}`,
      );
    }
  }

  /** Hai mức cho cùng một ngưỡng ⇒ không quyết được mức nào thắng. Chặn ở app, kèm `fieldErrors`. */
  private assertNoDuplicateMinQty(prices: ProductPriceDto[]): void {
    const seen = new Set<number>();
    const duplicates = new Set<number>();
    for (const tier of prices) {
      if (seen.has(tier.minQty)) duplicates.add(tier.minQty);
      seen.add(tier.minQty);
    }
    if (duplicates.size === 0) return;

    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Trùng mức số lượng: ${[...duplicates].join(', ')}`,
      [
        {
          field: 'prices',
          code: 'isUnique',
          message: 'Mỗi mức số lượng chỉ được khai một lần.',
        },
      ],
    );
  }
}

/** Bản ghi Prisma → tier domain thuần (event payload không mang id/timestamp của DB). */
function toTier(row: { minQty: number; price: number }): PriceTier {
  return { minQty: row.minQty, price: row.price };
}
