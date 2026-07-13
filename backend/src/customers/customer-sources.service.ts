import { Injectable } from '@nestjs/common';
import type { CustomerSource } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { isUniqueViolation } from '../common/errors/prisma-unique-violation';
import { EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerSourceCreated,
  CustomerSourceDeactivated,
  CustomerSourceReactivated,
  CustomerSourceUpdated,
  type CustomerSourceSnapshot,
} from './domain/customer-source-events';
import { CreateCustomerSourceRequestDto } from './dto/create-customer-source-request.dto';
import { UpdateCustomerSourceRequestDto } from './dto/update-customer-source-request.dto';

/**
 * Danh mục Nguồn khách — ĐỌC (Story 3.3) + GHI (Story 3.5). Truy vấn CHỈ qua `PrismaService`
 * (AD-1); side-effect CHỈ qua `EventBus` port (AD-18) — KHÔNG inject `AuditService`.
 *
 * HAI BẤT BIẾN mà mọi thứ ở đây tồn tại để giữ:
 *
 *  1. **KHÔNG BAO GIỜ xoá cứng một dòng.** `Customer.sourceId` là FK `ON DELETE RESTRICT`, nên
 *     Postgres sẽ chặn — nhưng đó không phải lý do. Lý do là xoá cứng làm bốc hơi câu trả lời cho
 *     "khách này từ đâu tới", và báo cáo lợi nhuận theo nguồn (Epic 8) thủng một mảng. Tắt
 *     (`active: false`) giữ lại lịch sử và chỉ rút nguồn khỏi dropdown của khách MỚI.
 *
 *  2. **Đúng một dòng mang cờ `isOther`.** Cờ này không có trong DTO ghi nào ⇒ không có đường
 *     nào qua API tạo ra dòng thứ hai. Bất biến thuộc về SEED, và lane DB kiểm nó trên Postgres
 *     thật. Dòng đó cũng KHÔNG tắt được: tắt nó = giết luật "chọn Khác ⇒ bắt buộc `sourceNote`"
 *     của Story 3.3, vì form khách sẽ không còn nguồn nào để rơi vào.
 *
 * Đổi TÊN dòng `isOther` thì được — cả thiết kế xoay quanh chuyện đó: backend nhận ra "Khác"
 * bằng CỜ, không bằng so chuỗi.
 */

/** Ảnh chụp cho event/audit — audit ghi SỰ THẬT ĐẦY ĐỦ, không lọc theo quyền người xem. */
function snapshot(source: CustomerSource): CustomerSourceSnapshot {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    active: source.active,
    sortOrder: source.sortOrder,
    isOther: source.isOther,
  };
}

/** Giá trị hiệu lực sau PATCH: field VẮNG MẶT giữ giá trị cũ; có mặt (kể cả `null`) thì đè. */
function effective<T>(patched: T | undefined, current: T): T {
  return patched === undefined ? current : patched;
}

@Injectable()
export class CustomerSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async findAll(includeInactive: boolean): Promise<CustomerSource[]> {
    return await this.prisma.customerSource.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async findOrThrow(id: string): Promise<CustomerSource> {
    const source = await this.prisma.customerSource.findUnique({
      where: { id },
    });
    if (source === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy nguồn khách: ${id}`,
      );
    }
    return source;
  }

  /**
   * Thứ tự cho một nguồn MỚI khi người dùng không chỉ định: xuống cuối danh sách.
   *
   * Cột `sortOrder` là NOT NULL và KHÔNG có default ở DB — truyền `undefined` xuống Prisma là
   * một 500 chờ sẵn. Bảng luôn có ít nhất 5 dòng seed, nhưng `?? -1` vẫn ở đây cho ca bảng rỗng
   * (DB test mới tinh): nguồn đầu tiên nhận `sortOrder: 0`, không phải `NaN`.
   */
  private async nextSortOrder(): Promise<number> {
    const last = await this.prisma.customerSource.findFirst({
      orderBy: { sortOrder: 'desc' },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  async create(
    actorAccountId: string,
    dto: CreateCustomerSourceRequestDto,
  ): Promise<CustomerSource> {
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());

    let created: CustomerSource;
    try {
      created = await this.prisma.customerSource.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          sortOrder,
          // CỨNG, không đọc từ dto. Cờ "Khác" chỉ do seed đặt — xem TSDoc của class.
          isOther: false,
        },
      });
    } catch (err: unknown) {
      throw this.translateWriteError(err, dto.name);
    }

    // SAU khi write commit — audit là consumer best-effort; publish trước/trong write sẽ ghi
    // nhật ký cho một sự việc có thể chưa xảy ra (AD-18).
    await this.eventBus.publish(
      new CustomerSourceCreated(actorAccountId, snapshot(created), new Date()),
    );
    return created;
  }

  async update(
    actorAccountId: string,
    id: string,
    dto: UpdateCustomerSourceRequestDto,
  ): Promise<CustomerSource> {
    const before = await this.findOrThrow(id);

    // Không cột nào đổi giá trị ⇒ không ghi DB, không publish (đối xứng với `deactivate` /
    // `reactivate`). Một `Updated` với `before === after` là một dòng audit nói dối: nó khai có
    // người sửa dòng này, trong khi không có gì sửa cả. Ca này có thật — `PATCH {}` rỗng, và cả
    // form web gửi lại nguyên giá trị cũ.
    if (
      effective(dto.name, before.name) === before.name &&
      effective(dto.description, before.description) === before.description &&
      effective(dto.sortOrder, before.sortOrder) === before.sortOrder
    ) {
      return before;
    }

    let updated: CustomerSource;
    try {
      updated = await this.prisma.customerSource.update({
        where: { id },
        data: {
          // Field vắng mặt là `undefined` ⇒ Prisma bỏ qua cột đó. `description: null` đi xuống
          // như `null` thật ⇒ xoá mô tả. `active`/`isOther` KHÔNG có trong danh sách cột ghi.
          name: dto.name,
          description: dto.description,
          sortOrder: dto.sortOrder,
        },
      });
    } catch (err: unknown) {
      throw this.translateWriteError(err, effective(dto.name, before.name));
    }

    await this.eventBus.publish(
      new CustomerSourceUpdated(
        actorAccountId,
        snapshot(before),
        snapshot(updated),
        new Date(),
      ),
    );
    return updated;
  }

  /**
   * Tắt một nguồn (soft-delete). KHÔNG có `prisma.customerSource.delete()` ở đây, và không được
   * phép có ở bất kỳ đâu trong `src/` — xem bất biến #1 ở TSDoc của class.
   */
  async deactivate(actorAccountId: string, id: string): Promise<void> {
    const before = await this.findOrThrow(id);

    if (before.isOther) {
      throw new AppException(
        ErrorCode.CONFLICT,
        409,
        'Không tắt được nguồn "Khác": mọi nguồn ngoài danh sách rơi vào đây, và luật bắt buộc ghi rõ nguồn phụ thuộc vào nó. Đổi tên thì được.',
      );
    }

    // Đã tắt rồi ⇒ không có gì đổi, nên không có gì để ghi vào nhật ký. Một event
    // `Deactivated` cho một dòng vốn đã tắt là một dòng audit nói dối.
    if (!before.active) return;

    const deactivated = await this.prisma.customerSource.update({
      where: { id },
      data: { active: false },
    });

    await this.eventBus.publish(
      new CustomerSourceDeactivated(
        actorAccountId,
        snapshot(before),
        snapshot(deactivated),
        new Date(),
      ),
    );
  }

  async reactivate(
    actorAccountId: string,
    id: string,
  ): Promise<CustomerSource> {
    const before = await this.findOrThrow(id);

    // Đang bật ⇒ trạng thái không đổi ⇒ không publish (đối xứng với `deactivate`).
    if (before.active) return before;

    const reactivated = await this.prisma.customerSource.update({
      where: { id },
      data: { active: true },
    });

    await this.eventBus.publish(
      new CustomerSourceReactivated(
        actorAccountId,
        snapshot(before),
        snapshot(reactivated),
        new Date(),
      ),
    );
    return reactivated;
  }

  /**
   * Tên trùng ⇒ 409 kèm `fieldErrors` trỏ đúng ô nhập; lỗi khác giữ nguyên (không nuốt).
   *
   * Tín hiệu đến từ `@unique` của Postgres (P2002), không phải từ một câu `if` — nên nó đúng cả
   * khi hai request thêm cùng một tên chạy song song và cùng vượt qua bước kiểm tồn tại.
   */
  private translateWriteError(err: unknown, name: string): unknown {
    if (!isUniqueViolation(err)) return err;
    return new AppException(
      ErrorCode.CONFLICT,
      409,
      `Đã có nguồn khách tên: ${name}`,
      [
        {
          field: 'name',
          code: 'isUnique',
          message: 'Tên nguồn này đã có trong danh mục.',
        },
      ],
    );
  }
}
