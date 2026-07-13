import { Injectable } from '@nestjs/common';
import type { Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import {
  ProductCreated,
  ProductDeactivated,
  ProductUpdated,
  type ProductSnapshot,
} from './domain/product-events';
import { stripCostPrice } from './domain/product-visibility';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { UpdateProductRequestDto } from './dto/update-product-request.dto';

/**
 * CRUD danh mục vật tư (FR-14). Truy vấn CHỈ qua `PrismaService` (AD-1); side-effect CHỈ
 * qua `EventBus` port (AD-18) — KHÔNG inject `AuditService`/`NotificationDispatcher`.
 *
 * KHÔNG HỒI TỐ ĐƠN ĐÃ CHỐT — và đó là một **hệ quả kiến trúc, không phải một nhánh `if`**:
 * service này chỉ đọc/ghi bảng `products`, không import gì từ `orders/`, nên không tồn tại
 * đường nào để giá mới lan ngược vào đơn cũ. Đơn giữ giá của riêng nó
 * (`OrderLineItem.unitPriceSnapshot`, đóng băng lúc chốt — AD-6/AD-20).
 *
 * `costPrice` (giá vốn) gate hai chiều bởi `costs.view`:
 *  - ĐỌC — caller thiếu quyền ⇒ field bị LOẠI khỏi payload (`stripCostPrice`).
 *  - GHI — body có `costPrice` mà caller thiếu quyền ⇒ 403 TRƯỚC khi chạm DB.
 * Quyền được resolve TƯƠI ở controller mỗi request (AD-8) rồi truyền xuống dạng
 * `canViewCosts` — service KHÔNG tự đọc JWT/role.
 */

/** Sản phẩm nhìn từ người KHÔNG có `costs.view` — đúng shape mà `stripCostPrice` trả về. */
export type VisibleProduct = Product | Omit<Product, 'costPrice'>;

/**
 * Đính bậc thang giá vào truy vấn CHỈ khi cờ `catalog.tiered_pricing` BẬT.
 *
 * Cờ TẮT ⇒ KHÔNG `include` ⇒ payload KHÔNG CÓ KEY `prices` (cùng khuôn `stripCostPrice`: loại
 * hẳn key, không trả `[]`). Đây là chỗ bất biến "cờ TẮT ⇒ mỗi sản phẩm MỘT giá duy nhất" được
 * enforce ở SERVER (AD-4) — không phải "để FE tự ẩn". Dòng `ProductPrice` cũ vẫn nằm trong DB
 * (tắt cờ không xoá dữ liệu), chúng chỉ vô hình.
 *
 * Cờ là THAM SỐ truyền vào, KHÔNG phải service inject: `ProductsService` giữ đúng hai dependency
 * (`PrismaService` + `EventBus`), y hệt cách `canViewCosts` được resolve ở controller rồi truyền
 * xuống. Service thuần prisma+eventbus thì test dựng nó bằng `new ProductsService(prisma, eventBus)`
 * vẫn chạy, và bất biến "service chỉ chạm model `product`" vẫn kiểm được.
 */
function tieredPriceInclude(tieredPricingEnabled: boolean) {
  // `undefined` (KHÔNG `{}`) khi cờ TẮT: Prisma coi `include: undefined` là "không include",
  // nên bản ghi trả về không có key `prices`.
  return tieredPricingEnabled
    ? { prices: { orderBy: { minQty: 'asc' as const } } }
    : undefined;
}

/** Ảnh chụp cho event/audit — luôn ĐỦ `costPrice` (audit ghi sự thật, không lọc theo quyền). */
function snapshot(product: Product): ProductSnapshot {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    unit: product.unit,
    price: product.price,
    costPrice: product.costPrice,
    tracksStock: product.tracksStock,
    priceEditable: product.priceEditable,
    warrantyMonths: product.warrantyMonths,
    isActive: product.isActive,
  };
}

/**
 * Vi phạm UNIQUE của Prisma. Nhận diện bằng `code === 'P2002'` (duck-typing) thay vì
 * `instanceof PrismaClientKnownRequestError`: lỗi đi qua nhiều lớp adapter, và `instanceof`
 * sẽ âm thầm sai khi lỗi được tái tạo qua ranh giới module.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Chặn ghi giá vốn khi thiếu `costs.view`. Kiểm `!== undefined` (KHÔNG truthy): `costPrice:
   * 0` là giá trị hợp lệ và vẫn phải bị chặn — người không có quyền xem giá vốn thì cũng
   * không được ĐẶT nó về 0.
   */
  private assertMayWriteCostPrice(
    costPrice: number | undefined,
    canViewCosts: boolean,
  ): void {
    if (costPrice !== undefined && !canViewCosts) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        403,
        'Không có quyền xem/sửa giá vốn.',
      );
    }
  }

  private async findOrThrow(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (product === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy sản phẩm: ${id}`,
      );
    }
    return product;
  }

  async create(
    actorAccountId: string,
    dto: CreateProductRequestDto,
    canViewCosts: boolean,
  ): Promise<VisibleProduct> {
    this.assertMayWriteCostPrice(dto.costPrice, canViewCosts);

    let created: Product;
    try {
      created = await this.prisma.product.create({
        data: {
          name: dto.name,
          sku: dto.sku,
          unit: dto.unit,
          price: dto.price,
          // Bỏ trống ⇒ 0. Từ Story 6.3 hệ thống tự cập nhật bằng bình quân gia quyền
          // khi nhập kho, nên bắt gõ tay lúc tạo là ép người dùng bịa số.
          costPrice: dto.costPrice ?? 0,
          tracksStock: dto.tracksStock,
          priceEditable: dto.priceEditable,
          warrantyMonths: dto.warrantyMonths ?? null,
        },
      });
    } catch (err: unknown) {
      throw this.translateWriteError(err, dto.sku);
    }

    // SAU khi write commit — audit là consumer best-effort; publish trước/trong write sẽ
    // ghi nhật ký cho một sự việc có thể chưa xảy ra (AD-18).
    await this.eventBus.publish(
      new ProductCreated(actorAccountId, snapshot(created), new Date()),
    );
    return stripCostPrice(created, canViewCosts);
  }

  async update(
    actorAccountId: string,
    id: string,
    dto: UpdateProductRequestDto,
    canViewCosts: boolean,
  ): Promise<VisibleProduct> {
    this.assertMayWriteCostPrice(dto.costPrice, canViewCosts);

    const before = await this.findOrThrow(id);

    let updated: Product;
    try {
      updated = await this.prisma.product.update({
        where: { id },
        // Partial: CHỈ field có mặt trong body mới được ghi. Prisma bỏ qua key `undefined`,
        // nên spread thẳng DTO là đúng ngữ nghĩa PATCH.
        data: {
          name: dto.name,
          sku: dto.sku,
          unit: dto.unit,
          price: dto.price,
          costPrice: dto.costPrice,
          tracksStock: dto.tracksStock,
          priceEditable: dto.priceEditable,
          warrantyMonths: dto.warrantyMonths,
        },
      });
    } catch (err: unknown) {
      throw this.translateWriteError(err, dto.sku);
    }

    await this.eventBus.publish(
      new ProductUpdated(
        actorAccountId,
        snapshot(before),
        snapshot(updated),
        new Date(),
      ),
    );
    return stripCostPrice(updated, canViewCosts);
  }

  /**
   * SOFT-delete: `isActive = false`. KHÔNG `prisma.product.delete()` — Epic 4
   * (`OrderLineItem.productId`) và Epic 6 (`StockItem.productId`) FK vào bảng này; xoá cứng
   * sẽ mồ côi dòng đơn/tồn kho lịch sử.
   */
  async deactivate(actorAccountId: string, id: string): Promise<void> {
    const before = await this.findOrThrow(id);

    const deactivated = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await this.eventBus.publish(
      new ProductDeactivated(
        actorAccountId,
        snapshot(before),
        snapshot(deactivated),
        new Date(),
      ),
    );
  }

  /** Mặc định CHỈ sản phẩm còn hiệu lực; `includeInactive` để xem cả sản phẩm đã ẩn. */
  async findAll(
    includeInactive: boolean,
    canViewCosts: boolean,
    tieredPricingEnabled: boolean,
  ): Promise<VisibleProduct[]> {
    const products = await this.prisma.product.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: tieredPriceInclude(tieredPricingEnabled),
    });
    return products.map((product) => stripCostPrice(product, canViewCosts));
  }

  async findOne(
    id: string,
    canViewCosts: boolean,
    tieredPricingEnabled: boolean,
  ): Promise<VisibleProduct> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: tieredPriceInclude(tieredPricingEnabled),
    });
    if (product === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy sản phẩm: ${id}`,
      );
    }
    return stripCostPrice(product, canViewCosts);
  }

  /** `sku` trùng ⇒ 409 kèm `fieldErrors` để FE chỉ đúng ô nhập; lỗi khác giữ nguyên. */
  private translateWriteError(err: unknown, sku: string | undefined): unknown {
    if (!isUniqueViolation(err)) return err;
    return new AppException(
      ErrorCode.CONFLICT,
      409,
      `Mã vật tư đã tồn tại: ${sku ?? ''}`,
      [
        {
          field: 'sku',
          code: 'isUnique',
          message: 'Mã vật tư đã tồn tại.',
        },
      ],
    );
  }
}
