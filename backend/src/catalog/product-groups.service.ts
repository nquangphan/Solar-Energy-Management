import { Injectable } from '@nestjs/common';
import type { PrismaPromise, ProductGroup } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { isUniqueViolation } from '../common/errors/prisma-unique-violation';
import { EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProductGroupCreated,
  ProductGroupDeactivated,
  ProductGroupItemsReplaced,
  ProductGroupReactivated,
  ProductGroupUpdated,
  type ProductGroupItemSnapshot,
  type ProductGroupSnapshot,
} from './domain/product-group-events';
import { CreateProductGroupRequestDto } from './dto/create-product-group-request.dto';
import { UpdateProductGroupRequestDto } from './dto/update-product-group-request.dto';

/**
 * Gói vật tư = CHECKLIST sản phẩm con (FR-14). Truy vấn CHỈ qua `PrismaService` (AD-1);
 * side-effect CHỈ qua `EventBus` port (AD-18) — KHÔNG inject `AuditService`.
 *
 * 🔴 BẤT BIẾN AN NINH TRUNG TÂM: payload đọc của service này KHÔNG BAO GIỜ mang `costPrice`.
 *
 * `ProductsService` gác giá vốn rất cẩn thận — `stripCostPrice()` lọc nó khỏi mọi payload sản
 * phẩm theo quyền `costs.view`. Service này là một CỬA MỚI vào cùng dữ liệu đó, và một dòng hồn
 * nhiên `include: { product: true }` sẽ trả nguyên bản ghi `Product` kèm giá vốn cho bất kỳ ai có
 * `catalog.manage` — đi VÒNG QUA hàng rào ấy thay vì phá nó. Người có `catalog.manage` mà không
 * có `costs.view` là một cấu hình hoàn toàn có thật.
 *
 * ⇒ `select` TƯỜNG MINH từng cột (`ITEM_SELECT` dưới đây). KHÔNG `include` trần. Không lấy về thì
 * không phải lọc — gói không cần giá vốn cho việc gì cả.
 *
 * Gói KHÔNG BAO GIỜ dính vào Đơn: service này không import gì từ `orders/`, và không có cột nào
 * để gói bám vào một dòng báo giá. Đó là một hệ quả kiến trúc, không phải một câu `if`.
 */

/**
 * Projection HẸP của sản phẩm con — danh sách cột được phép rời server qua cửa gói.
 *
 * `costPrice` VẮNG MẶT ở đây là điểm mà bất biến an ninh của service này được thi hành. Thêm cột
 * vào đây = mở rộng hợp đồng công khai; thêm `costPrice` = thủng hàng rào giá vốn của Story 3.1.
 */
const ITEM_SELECT = {
  displayOrder: true,
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      price: true,
      isActive: true,
    },
  },
} as const;

/** Gói kèm checklist, đúng shape mà `GET /product-groups/:id` trả về. */
export interface ProductGroupDetail extends ProductGroup {
  readonly items: readonly ProductGroupItemRow[];
}

/** Một món trên checklist — đã phẳng hoá, KHÔNG mang `costPrice`. */
export interface ProductGroupItemRow {
  readonly productId: string;
  readonly name: string;
  readonly sku: string;
  readonly unit: string;
  readonly price: number;
  readonly isActive: boolean;
  readonly displayOrder: number;
}

/** Bản ghi Prisma (đã select hẹp) → dòng checklist phẳng. */
function toItemRow(row: {
  displayOrder: number;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    price: number;
    isActive: boolean;
  };
}): ProductGroupItemRow {
  return {
    productId: row.product.id,
    name: row.product.name,
    sku: row.product.sku,
    unit: row.product.unit,
    price: row.product.price,
    isActive: row.product.isActive,
    displayOrder: row.displayOrder,
  };
}

/** Ảnh chụp cho event/audit. */
function snapshot(group: ProductGroup): ProductGroupSnapshot {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    isActive: group.isActive,
  };
}

/** Ảnh chụp checklist cho event — chỉ "sản phẩm nào, thứ mấy" (bảng cũng chỉ có thế). */
function itemSnapshot(row: {
  productId: string;
  displayOrder: number;
}): ProductGroupItemSnapshot {
  return { productId: row.productId, displayOrder: row.displayOrder };
}

/** Giá trị hiệu lực sau PATCH: field VẮNG MẶT giữ giá trị cũ; có mặt (kể cả `null`) thì đè. */
function effective<T>(patched: T | undefined, current: T): T {
  return patched === undefined ? current : patched;
}

@Injectable()
export class ProductGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /** Danh sách GỌN — không kèm món. Mặc định chỉ gói còn hiệu lực. */
  async findAll(includeInactive: boolean): Promise<ProductGroup[]> {
    return await this.prisma.productGroup.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gói KÈM checklist — endpoint mà picker báo giá gọi.
   *
   * `select` tường minh (xem `ITEM_SELECT`): đây là chỗ `costPrice` KHÔNG được phép lọt ra.
   */
  async findOne(id: string): Promise<ProductGroupDetail> {
    const group = await this.prisma.productGroup.findUnique({
      where: { id },
      include: {
        items: {
          select: ITEM_SELECT,
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (group === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy gói vật tư: ${id}`,
      );
    }
    return { ...group, items: group.items.map(toItemRow) };
  }

  private async findOrThrow(id: string): Promise<ProductGroup> {
    const group = await this.prisma.productGroup.findUnique({ where: { id } });
    if (group === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy gói vật tư: ${id}`,
      );
    }
    return group;
  }

  async create(
    actorAccountId: string,
    dto: CreateProductGroupRequestDto,
  ): Promise<ProductGroup> {
    let created: ProductGroup;
    try {
      created = await this.prisma.productGroup.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          // CỨNG, không đọc từ dto: gói mới luôn dùng được ngay. Tắt đi đường riêng.
          isActive: true,
        },
      });
    } catch (err: unknown) {
      throw this.translateWriteError(err, dto.name);
    }

    // SAU khi write commit — audit là consumer best-effort; publish trước/trong write sẽ ghi
    // nhật ký cho một sự việc có thể chưa xảy ra (AD-18).
    await this.eventBus.publish(
      new ProductGroupCreated(actorAccountId, snapshot(created), new Date()),
    );
    return created;
  }

  async update(
    actorAccountId: string,
    id: string,
    dto: UpdateProductGroupRequestDto,
  ): Promise<ProductGroup> {
    const before = await this.findOrThrow(id);

    // Không cột nào đổi giá trị ⇒ không ghi DB, không publish (đối xứng với `deactivate` /
    // `reactivate`). Một `Updated` với `before === after` là một dòng audit nói dối: nó khai có
    // người sửa gói này, trong khi không có gì sửa cả. Ca này có thật — `PATCH {}` rỗng, và cả
    // form gửi lại nguyên giá trị cũ.
    if (
      effective(dto.name, before.name) === before.name &&
      effective(dto.description, before.description) === before.description
    ) {
      return before;
    }

    let updated: ProductGroup;
    try {
      updated = await this.prisma.productGroup.update({
        where: { id },
        data: {
          // Field vắng mặt là `undefined` ⇒ Prisma bỏ qua cột đó. `description: null` đi xuống
          // như `null` thật ⇒ xoá mô tả. `isActive` KHÔNG có trong danh sách cột ghi.
          name: dto.name,
          description: dto.description,
        },
      });
    } catch (err: unknown) {
      throw this.translateWriteError(err, effective(dto.name, before.name));
    }

    await this.eventBus.publish(
      new ProductGroupUpdated(
        actorAccountId,
        snapshot(before),
        snapshot(updated),
        new Date(),
      ),
    );
    return updated;
  }

  /** Rút gói khỏi picker (soft-delete). Món con ở nguyên — bật lại là dùng được ngay. */
  async deactivate(actorAccountId: string, id: string): Promise<void> {
    const before = await this.findOrThrow(id);

    // Đã tắt rồi ⇒ không có gì đổi, nên không có gì để ghi vào nhật ký.
    if (!before.isActive) return;

    const deactivated = await this.prisma.productGroup.update({
      where: { id },
      data: { isActive: false },
    });

    await this.eventBus.publish(
      new ProductGroupDeactivated(
        actorAccountId,
        snapshot(before),
        snapshot(deactivated),
        new Date(),
      ),
    );
  }

  async reactivate(actorAccountId: string, id: string): Promise<ProductGroup> {
    const before = await this.findOrThrow(id);

    // Đang bật ⇒ trạng thái không đổi ⇒ không publish (đối xứng với `deactivate`).
    if (before.isActive) return before;

    const reactivated = await this.prisma.productGroup.update({
      where: { id },
      data: { isActive: true },
    });

    await this.eventBus.publish(
      new ProductGroupReactivated(
        actorAccountId,
        snapshot(before),
        snapshot(reactivated),
        new Date(),
      ),
    );
    return reactivated;
  }

  /**
   * THAY THẾ toàn bộ checklist của một gói (xoá cũ → tạo mới, atomic qua `$transaction`) —
   * khuôn `ProductPricesService.replace()`.
   *
   * Checklist là MỘT TẬP HỢP CÓ THỨ TỰ, không phải các dòng rời rạc ⇒ chỉ có một thao tác ghi:
   * thay-nguyên-khối. "Thêm một món"/"xoá một món" sẽ đẻ ra câu hỏi "thứ tự các món còn lại giờ
   * là gì?" mà không ai trả lời được.
   *
   * Thứ tự kiểm — fail-closed, KHÔNG chạm DB khi từ chối:
   *  1. Gói không tồn tại ⇒ 404.
   *  2. `productId` trùng trong CÙNG payload ⇒ 400 kèm `fieldErrors` — bắt ở TẦNG APP, không để
   *     `@@unique` của DB quyết: constraint sẽ nổ SAU khi `deleteMany` đã chạy trong tx, và
   *     thông điệp của nó không chỉ được vào phần tử nào.
   *  3. `productId` không tồn tại ⇒ 400. MỘT `findMany` cho cả mảng rồi so tập — không N+1.
   *
   * ⚠️ Sản phẩm đã TẮT vẫn đưa vào gói được — CỐ Ý. Một sản phẩm có thể bị tắt SAU khi đã nằm
   * trong gói, nên picker buộc phải xử lý item trỏ sản phẩm đã tắt dù ta có chặn lúc ghi hay
   * không. Chặn ở đây chỉ tạo cảm giác an toàn rồi vẫn phải viết đúng logic đó ở FE.
   */
  async replaceItems(
    actorAccountId: string,
    id: string,
    productIds: string[],
  ): Promise<ProductGroupDetail> {
    await this.findOrThrow(id);
    this.assertNoDuplicateProductId(productIds);
    await this.assertProductsExist(productIds);

    const before = await this.prisma.productGroupItem.findMany({
      where: { productGroupId: id },
      orderBy: { displayOrder: 'asc' },
    });

    // KHOÁ dòng gói trước khi đụng checklist ⇒ hai lệnh thay cùng một gói phải NỐI ĐUÔI nhau.
    //
    // Thiếu khoá này, `$transaction` KHÔNG đủ để atomic-replace đúng: Postgres chạy READ
    // COMMITTED, nên `deleteMany` của request B lấy ảnh chụp TẠI LÚC CÂU LỆNH BẮT ĐẦU và không
    // thấy những dòng A vừa commit sau đó ⇒ B xoá 0 dòng rồi chèn tiếp danh sách của mình. Hai lần
    // "thay sạch" biến thành GỘP: gói giữ cả hai danh sách, `displayOrder` lặp (0,0,1,1). Nếu hai
    // payload có món chung thì thay vào đó là vỡ `@@unique` NGAY TRONG tx ⇒ 500 cho một cú
    // double-click. Đã tái hiện được cả hai trên Postgres thật.
    //
    // `FOR UPDATE` bắt B chờ A commit, rồi `deleteMany` của B chạy trên ảnh chụp MỚI (thấy dòng
    // của A) ⇒ thay sạch thật, người ghi sau thắng gọn.
    //
    // Rồi CHỈ tạo mới khi có món: `createMany({ data: [] })` với mảng RỖNG làm hỏng atomic-replace
    // ở Prisma 7 + adapter-pg (no-op cả transaction — đã cắn ở `account-permissions.service.ts`).
    // Mảng rỗng là đầu vào HỢP LỆ ("gói chưa có món nào") nên nhánh này là đường đi thật, không
    // phải phòng xa. `deleteMany` chạy VÔ ĐIỀU KIỆN.
    const ops: PrismaPromise<unknown>[] = [
      this.prisma
        .$queryRaw`SELECT id FROM product_groups WHERE id = ${id} FOR UPDATE`,
      this.prisma.productGroupItem.deleteMany({
        where: { productGroupId: id },
      }),
    ];
    if (productIds.length > 0) {
      ops.push(
        this.prisma.productGroupItem.createMany({
          // THỨ TỰ MẢNG LÀ THỨ TỰ HIỆN — server gán, client không đánh số (AD-1/AD-2).
          data: productIds.map((productId, index) => ({
            productGroupId: id,
            productId,
            displayOrder: index,
          })),
        }),
      );
    }
    await this.prisma.$transaction(ops);

    const after = await this.findOne(id);

    // SAU commit (AD-18). `before`/`after` là CẢ CHECKLIST — thao tác nghiệp vụ là "đổi danh sách
    // món của gói này", không phải "sửa một món".
    await this.eventBus.publish(
      new ProductGroupItemsReplaced(
        actorAccountId,
        id,
        before.map(itemSnapshot),
        after.items.map(itemSnapshot),
        new Date(),
      ),
    );

    return after;
  }

  /** Cùng một món hai lần trong một gói là vô nghĩa. Chặn ở app, kèm `fieldErrors`. */
  private assertNoDuplicateProductId(productIds: string[]): void {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const productId of productIds) {
      if (seen.has(productId)) duplicates.add(productId);
      seen.add(productId);
    }
    if (duplicates.size === 0) return;

    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Sản phẩm bị lặp trong gói: ${[...duplicates].join(', ')}`,
      [
        {
          field: 'productIds',
          code: 'isUnique',
          message: 'Mỗi sản phẩm chỉ được có một lần trong gói.',
        },
      ],
    );
  }

  /** Món trỏ vào sản phẩm không tồn tại ⇒ checklist trỏ vào hư không. MỘT truy vấn, không N+1. */
  private async assertProductsExist(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;

    const found = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((product) => product.id));
    const missing = productIds.filter((id) => !foundIds.has(id));
    if (missing.length === 0) return;

    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Không tìm thấy sản phẩm: ${missing.join(', ')}`,
      missing.map((id) => ({
        field: 'productIds',
        code: 'isNotFound',
        message: `Không có sản phẩm nào mang id ${id}.`,
      })),
    );
  }

  /**
   * Tên gói trùng ⇒ 409 kèm `fieldErrors` trỏ đúng ô nhập; lỗi khác giữ nguyên (không nuốt).
   *
   * Tín hiệu đến từ `@unique` của Postgres (P2002), không phải từ một câu `if` — nên nó đúng cả
   * khi hai request thêm cùng một tên chạy song song và cùng vượt qua bước kiểm tồn tại.
   */
  private translateWriteError(err: unknown, name: string): unknown {
    if (!isUniqueViolation(err)) return err;
    return new AppException(ErrorCode.CONFLICT, 409, `Đã có gói tên: ${name}`, [
      {
        field: 'name',
        code: 'isUnique',
        message: 'Tên gói này đã có trong danh mục.',
      },
    ]);
  }
}
