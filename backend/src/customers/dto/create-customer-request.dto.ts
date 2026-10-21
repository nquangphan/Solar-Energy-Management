import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CUST_TYPE, CUST_TYPES } from '../domain/customer-type';

/**
 * Body của `POST /customers`.
 *
 * `phone` nhận chuỗi **THÔ** (`0912 345 678`, `+84912345678`, `84912345678`…) — client KHÔNG bao
 * giờ tự chuẩn hoá (AD-9). Backend chuẩn hoá về E.164 rồi mới chạm DB; số không phân giải được
 * ⇒ 400 kèm `fieldErrors`, KHÔNG bao giờ 500.
 *
 * BẮT BUỘC đúng bốn thứ: `phone` + `custType` + `name` + `sourceId` (+ `sourceNote` khi nguồn có
 * cờ `isOther` — luật đó ở service, vì DTO không biết cờ của nguồn nào). `nationalId`/`taxCode`/
 * `address`/`bankAccount` là OPTIONAL có chủ đích: Story 3.4 tạo khách INLINE giữa lúc dựng báo
 * giá — bắt sale gõ CCCD/MST lúc đang nói chuyện điện thoại sẽ giết chính luồng đó. Các field
 * này bị chặn ở nơi thật sự cần chúng: Hợp đồng (FR-13) và Hoá đơn (FR-27).
 *
 * `null` được phép ĐÚNG ở những cột nullable (`nationalId`/`taxCode`/`address`/`bankAccount`/
 * `sourceNote`) — ở đó `null` là giá trị NGHIỆP VỤ ("không có"), y như `warrantyMonths` của
 * 3.1. Cột NOT NULL (`phone`/`custType`/`name`/`sourceId`) là bắt buộc, nên `{"name": null}` bị
 * chặn ngay ở 400 chứ không lọt xuống DB thành 500 (bài học HIGH của review 3.1: `@IsOptional()`
 * tha cả `null` — dùng nó cho cột NOT NULL là mở cửa hậu).
 *
 * `@MaxLength` để chuỗi 10MB không xuống nổi DB; `@IsString()` (không chỉ `@IsNotEmpty()`) để
 * mảng/object lồng bị chặn.
 */
export class CreateCustomerRequestDto {
  @ApiProperty({
    description:
      'SĐT dạng THÔ — backend tự chuẩn hoá về E.164 (`+84…`) và dùng làm khoá chính. Không hợp lệ ⇒ 400.',
    example: '0912 345 678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({
    description: 'Loại khách — quyết định bộ trường hợp lệ.',
    enum: CUST_TYPES,
    example: CUST_TYPE.caNhan,
  })
  @IsIn(CUST_TYPES)
  custType!: string;

  @ApiProperty({
    description: 'Họ tên (Cá nhân) hoặc tên công ty (Thương mại).',
    example: 'Nguyễn Văn A',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'CCCD — CHỈ khách Cá nhân. Gửi kèm khách Thương mại ⇒ 400.',
    example: '079201001234',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  nationalId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Mã số thuế — CHỈ khách Thương mại. Gửi kèm khách Cá nhân ⇒ 400.',
    example: '0312345678',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  taxCode?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Địa chỉ — dùng cho cả hai loại khách.',
    example: '12 Nguyễn Huệ, Quận 1, TP.HCM',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Tài khoản ngân hàng — CHỈ khách Thương mại. Gửi kèm khách Cá nhân ⇒ 400.',
    example: '0071000123456 - Vietcombank',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bankAccount?: string | null;

  @ApiProperty({
    description:
      'Nguồn khách (id của CustomerSource) — BẮT BUỘC, không có mặc định. Trỏ tới nguồn không tồn tại ⇒ 400.',
    example: '5f4d3c2b-1a09-4e8d-9c7b-6a5f4e3d2c1b',
  })
  @IsUUID()
  sourceId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Ghi chú nguồn — BẮT BUỘC khi nguồn được chọn mang cờ `isOther` (thiếu ⇒ 400); optional với nguồn khác.',
    example: 'Khách cũ giới thiệu',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  sourceNote?: string | null;
}
