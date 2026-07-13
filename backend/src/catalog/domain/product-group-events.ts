import type { DomainEvent } from '../../events/domain-event';

/**
 * Domain event của gói vật tư (mirror `product-events.ts` + `product-price-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `ProductGroupsService` publish qua `EventBus` port SAU
 * khi write commit; `AuditSubscriber` ghi `AuditLog` — producer KHÔNG gọi thẳng consumer nào
 * (AD-18).
 *
 * MỌI event ở đây trỏ `target` về GÓI, kể cả event đổi danh sách món. Nhờ vậy vết audit của một
 * gói gom được cả "sửa tên gói" lẫn "đổi danh sách món" vào một dòng thời gian — người đọc nhật
 * ký không phải tự ghép các mảnh lại để hiểu chuyện gì đã xảy ra với cái gói đó.
 */

/** Ảnh chụp một gói tại một thời điểm — kiểu domain thuần, KHÔNG dùng type của Prisma. */
export interface ProductGroupSnapshot {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isActive: boolean;
}

/**
 * Một món trong gói, như nó xuất hiện trong nhật ký: sản phẩm nào, đứng thứ mấy.
 *
 * KHÔNG có số lượng và KHÔNG có giá — vì bảng cũng không có. Gói là checklist, không phải định mức.
 */
export interface ProductGroupItemSnapshot {
  readonly productId: string;
  readonly displayOrder: number;
}

/** Gói mới được tạo — không có trạng thái "trước". Luôn `isActive: true`, chưa có món nào. */
export class ProductGroupCreated implements DomainEvent {
  readonly type = 'ProductGroupCreated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly after: ProductGroupSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'ProductGroup', id: after.id };
  }
}

/** Gói được sửa NỘI DUNG (tên/mô tả) — mang cả trước và sau. Đổi danh sách món đi event riêng. */
export class ProductGroupUpdated implements DomainEvent {
  readonly type = 'ProductGroupUpdated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: ProductGroupSnapshot,
    readonly after: ProductGroupSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'ProductGroup', id: after.id };
  }
}

/**
 * Gói bị rút khỏi picker (`isActive = false`). Tên event nói SOFT-delete, không phải
 * `ProductGroupDeleted` — bản ghi còn nguyên và bật lại được.
 */
export class ProductGroupDeactivated implements DomainEvent {
  readonly type = 'ProductGroupDeactivated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: ProductGroupSnapshot,
    readonly after: ProductGroupSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'ProductGroup', id: after.id };
  }
}

/** Gói quay lại picker (`isActive = true`). */
export class ProductGroupReactivated implements DomainEvent {
  readonly type = 'ProductGroupReactivated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: ProductGroupSnapshot,
    readonly after: ProductGroupSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'ProductGroup', id: after.id };
  }
}

/**
 * Danh sách món của gói bị THAY NGUYÊN KHỐI (khuôn `ProductPricesReplaced`).
 *
 * `before`/`after` là CẢ DANH SÁCH, không phải một món: thao tác nghiệp vụ là "đổi checklist của
 * gói này", không phải "thêm một món". Ghi audit theo từng món sẽ buộc người đọc nhật ký tự dựng
 * lại checklist từ các mảnh rời.
 */
export class ProductGroupItemsReplaced implements DomainEvent {
  readonly type = 'ProductGroupItemsReplaced';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    productGroupId: string,
    readonly before: readonly ProductGroupItemSnapshot[],
    readonly after: readonly ProductGroupItemSnapshot[],
    readonly occurredAt: Date,
  ) {
    // Đối tượng bị tác động là GÓI (món không có danh tính nghiệp vụ riêng) — mirror
    // `ProductPricesReplaced`, nơi target là SẢN PHẨM chứ không phải một dòng bậc thang.
    this.target = { type: 'ProductGroup', id: productGroupId };
  }
}
