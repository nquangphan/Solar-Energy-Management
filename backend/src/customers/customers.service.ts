import { Injectable } from '@nestjs/common';
import type { Customer, CustomerSource } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { isUniqueViolation } from '../common/errors/prisma-unique-violation';
import { EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerCreated,
  CustomerUpdated,
  type CustomerSnapshot,
} from './domain/customer-events';
import { FORBIDDEN_FIELDS, type CustType } from './domain/customer-type';
import { normalizeVnPhone } from './domain/phone';
import { CreateCustomerRequestDto } from './dto/create-customer-request.dto';
import { UpdateCustomerRequestDto } from './dto/update-customer-request.dto';

/**
 * CRUD Khách hàng (FR-29). Truy vấn CHỈ qua `PrismaService` (AD-1); side-effect CHỈ qua
 * `EventBus` port (AD-18) — KHÔNG inject `AuditService`/`NotificationDispatcher`.
 *
 * BẤT BIẾN TRUNG TÂM: **một SĐT = một khách hàng**, trên toàn hệ thống (FR-29). Nó được giữ ở
 * HAI tầng, và cả hai đều cần thiết:
 *  - TẦNG APP — `normalizeVnPhone` biến mọi dạng thô về đúng một chuỗi E.164 TRƯỚC khi chạm DB
 *    (AD-9), nên `0912345678` và `+84912345678` không thể thành hai bản ghi.
 *  - TẦNG DB — PK `customers.sdt` chặn insert trùng kể cả khi hai request chạy song song lọt
 *    qua cùng lúc. `P2002` từ Postgres được dịch thành 409, KHÔNG để rò ra thành 500.
 * Một câu `if` ở tầng app KHÔNG đủ (nó thua cuộc đua), và PK không kèm chuẩn hoá cũng KHÔNG đủ
 * (hai dạng thô là hai khoá khác nhau). Bỏ tầng nào cũng vỡ bất biến.
 */

/** Ảnh chụp cho event/audit — audit ghi SỰ THẬT ĐẦY ĐỦ, không lọc theo quyền người xem. */
function snapshot(customer: Customer): CustomerSnapshot {
  return {
    sdt: customer.sdt,
    custType: customer.custType,
    name: customer.name,
    cccd: customer.cccd,
    taxCode: customer.taxCode,
    address: customer.address,
    bankAccount: customer.bankAccount,
    sourceId: customer.sourceId,
    sourceNote: customer.sourceNote,
  };
}

/** Giá trị hiệu lực sau PATCH: field VẮNG MẶT giữ giá trị cũ; có mặt (kể cả `null`) thì đè. */
function effective<T>(patched: T | undefined, current: T): T {
  return patched === undefined ? current : patched;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * SĐT thô ⇒ E.164, hoặc 400. Đây là CỬA DUY NHẤT mà SĐT đi vào hệ thống — đọc lẫn ghi đều
   * qua đây, nên `GET /customers/:sdt` với `0912345678` tìm đúng bản ghi đã lưu là `+84912345678`.
   */
  private normalizeOrThrow(raw: string): string {
    const sdt = normalizeVnPhone(raw);
    if (sdt === null) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Số điện thoại không hợp lệ.',
        [
          {
            field: 'sdt',
            code: 'isPhoneNumber',
            message:
              'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).',
          },
        ],
      );
    }
    return sdt;
  }

  /**
   * Nguồn khách phải TỒN TẠI ⇒ 400 (KHÔNG để FK violation nổ thành 500 ở tầng DB): `sourceId`
   * là dữ liệu người dùng chọn, nên một id sai là lỗi NHẬP LIỆU, phải trỏ được vào đúng ô.
   */
  private async loadSourceOrThrow(sourceId: string): Promise<CustomerSource> {
    const source = await this.prisma.customerSource.findUnique({
      where: { id: sourceId },
    });
    if (source === null) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Nguồn khách không tồn tại.',
        [
          {
            field: 'sourceId',
            code: 'exists',
            message: 'Nguồn khách không tồn tại.',
          },
        ],
      );
    }
    return source;
  }

  /**
   * Nguồn "Khác" ⇒ `sourceNote` BẮT BUỘC. Nhận biết bằng CỜ `isOther`, KHÔNG bằng so chuỗi tên
   * (`name === 'Khác'`): Story 3.5 cho phép đổi tên hiển thị của nguồn, và một luật nghiệp vụ
   * không được phép sập chỉ vì ai đó sửa nhãn.
   */
  private assertSourceNote(
    source: CustomerSource,
    sourceNote: string | null | undefined,
  ): void {
    if (!source.isOther) return;
    if (
      sourceNote !== null &&
      sourceNote !== undefined &&
      sourceNote.trim() !== ''
    ) {
      return;
    }
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      400,
      'Nguồn "Khác" phải ghi rõ ở ô ghi chú nguồn.',
      [
        {
          field: 'sourceNote',
          code: 'isNotEmpty',
          message: 'Chọn nguồn "Khác" thì phải ghi rõ nguồn thực tế.',
        },
      ],
    );
  }

  /**
   * Field lạc LOẠI KHÁCH ⇒ 400 (fail-closed). Nuốt im lặng một `taxCode` gửi kèm khách Cá nhân
   * là để dành quả mìn cho Hoá đơn (FR-27) — nơi MST thật sự được dùng và không ai còn nhớ nó
   * đến từ đâu.
   *
   * Kiểm trên bản ghi HIỆU LỰC (sau khi trộn PATCH vào bản ghi cũ), không chỉ trên body: đổi
   * `custType` từ Cá nhân sang Thương mại mà `cccd` cũ còn nằm đó thì bản ghi kết quả vẫn sai.
   * Đường ra là gửi kèm `"cccd": null` để xoá — đó là lý do các cột nullable nhận `null`.
   */
  private assertFieldsMatchType(
    custType: string,
    record: Record<string, unknown>,
  ): void {
    const forbidden = FORBIDDEN_FIELDS[custType as CustType] ?? [];
    const offenders = forbidden.filter(
      (field) => record[field] !== null && record[field] !== undefined,
    );
    if (offenders.length === 0) return;
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Field không thuộc loại khách ${custType}: ${offenders.join(', ')}.`,
      offenders.map((field) => ({
        field,
        code: 'notAllowedForCustType',
        message: `Khách ${custType} không có field "${field}".`,
      })),
    );
  }

  private async findOrThrow(sdt: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { sdt } });
    if (customer === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy khách hàng: ${sdt}`,
      );
    }
    return customer;
  }

  async create(
    actorAccountId: string,
    dto: CreateCustomerRequestDto,
  ): Promise<Customer> {
    // Thứ tự có chủ đích: mọi thứ kiểm được TRƯỚC khi chạm DB thì kiểm trước — request hỏng
    // không được để lại dấu vết nào trong DB.
    const sdt = this.normalizeOrThrow(dto.sdt);
    const source = await this.loadSourceOrThrow(dto.sourceId);
    this.assertSourceNote(source, dto.sourceNote);
    this.assertFieldsMatchType(dto.custType, { ...dto });

    let created: Customer;
    try {
      created = await this.prisma.customer.create({
        data: {
          // `sdt` đã CHUẨN HOÁ — KHÔNG phải `dto.sdt` thô. Ghi chuỗi thô vào PK là cách tạo ra
          // hai bản ghi cho cùng một người, đúng cái AD-9 tồn tại để chặn.
          sdt,
          custType: dto.custType,
          name: dto.name,
          cccd: dto.cccd ?? null,
          taxCode: dto.taxCode ?? null,
          address: dto.address ?? null,
          bankAccount: dto.bankAccount ?? null,
          sourceId: dto.sourceId,
          sourceNote: dto.sourceNote ?? null,
        },
      });
    } catch (err: unknown) {
      throw this.translateWriteError(err, sdt);
    }

    // SAU khi write commit — audit là consumer best-effort; publish trước/trong write sẽ ghi
    // nhật ký cho một sự việc có thể chưa xảy ra (AD-18).
    await this.eventBus.publish(
      new CustomerCreated(actorAccountId, snapshot(created), new Date()),
    );
    return created;
  }

  async update(
    actorAccountId: string,
    rawSdt: string,
    dto: UpdateCustomerRequestDto,
  ): Promise<Customer> {
    const sdt = this.normalizeOrThrow(rawSdt);
    const before = await this.findOrThrow(sdt);

    const custType = effective(dto.custType, before.custType);
    // Nguồn HIỆU LỰC: đổi `sourceId` ⇒ luật `isOther`/`sourceNote` phải chạy lại trên nguồn MỚI.
    // Kiểm lúc tạo rồi thôi là bỏ sót nửa số đường dữ liệu đi vào bảng này.
    const sourceId = effective(dto.sourceId, before.sourceId);
    const source = await this.loadSourceOrThrow(sourceId);
    this.assertSourceNote(source, effective(dto.sourceNote, before.sourceNote));
    this.assertFieldsMatchType(custType, {
      cccd: effective(dto.cccd, before.cccd),
      taxCode: effective(dto.taxCode, before.taxCode),
      bankAccount: effective(dto.bankAccount, before.bankAccount),
    });

    // `sdt` KHÔNG bao giờ có mặt ở đây — DTO chặn nó ở 400 (AC-7), và khoá chính không nằm
    // trong danh sách cột được ghi.
    const updated = await this.prisma.customer.update({
      where: { sdt },
      data: {
        custType: dto.custType,
        name: dto.name,
        cccd: dto.cccd,
        taxCode: dto.taxCode,
        address: dto.address,
        bankAccount: dto.bankAccount,
        sourceId: dto.sourceId,
        sourceNote: dto.sourceNote,
      },
    });

    await this.eventBus.publish(
      new CustomerUpdated(
        actorAccountId,
        snapshot(before),
        snapshot(updated),
        new Date(),
      ),
    );
    return updated;
  }

  async findAll(): Promise<Customer[]> {
    return await this.prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(rawSdt: string): Promise<Customer> {
    // Tra cứu chạy CÙNG bộ chuẩn hoá với lúc ghi (AD-9) — nếu không, khách lưu bằng
    // `+84912345678` sẽ "không tồn tại" khi tra bằng `0912345678`.
    return await this.findOrThrow(this.normalizeOrThrow(rawSdt));
  }

  /**
   * SĐT trùng ⇒ 409 kèm `fieldErrors` trỏ đúng ô nhập; lỗi khác giữ nguyên (không nuốt).
   *
   * Đây là tín hiệu từ PK của Postgres, không phải từ một câu `if` — nên nó đúng cả khi hai
   * request tạo cùng một SĐT chạy song song và cùng vượt qua bước kiểm tồn tại.
   */
  private translateWriteError(err: unknown, sdt: string): unknown {
    if (!isUniqueViolation(err)) return err;
    return new AppException(
      ErrorCode.CONFLICT,
      409,
      `Số điện thoại đã có khách hàng: ${sdt}`,
      [
        {
          field: 'sdt',
          code: 'isUnique',
          message: 'Số điện thoại này đã thuộc về một khách hàng khác.',
        },
      ],
    );
  }
}
