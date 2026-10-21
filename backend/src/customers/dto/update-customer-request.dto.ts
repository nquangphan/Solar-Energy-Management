import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../catalog/dto/is-optional-not-null.decorator';
import { CUST_TYPES } from '../domain/customer-type';
import { IsAbsent } from './is-absent.decorator';

/**
 * Body của `PATCH /customers/:phone` — chỉ field CÓ MẶT mới được ghi.
 *
 * KHÔNG dùng `PartialType(CreateCustomerRequestDto)`: nó gắn `@IsOptional()` lên MỌI field, mà
 * `@IsOptional()` tha cả `null` ⇒ `{"name": null}` lọt xuống cột NOT NULL và vỡ thành 500 (bài
 * học HIGH của review 3.1). Khai tay từng field: cột NOT NULL dùng `@IsOptionalNotNull()`
 * (vắng mặt thì thôi, `null` là sai), cột nullable dùng `@IsOptional()` — ở đó `null` là đường
 * XOÁ hợp lệ ("khách này không còn CCCD"), và chính nó là đường để đổi loại khách: chuyển
 * Cá nhân → Thương mại thì gửi `{"custType": "THUONG_MAI", "cccd": null, "taxCode": "…"}`.
 *
 * `sdt` BẤT BIẾN: có mặt trong body ⇒ 400. Đổi SĐT là đổi khoá chính = đổi danh tính, mà Epic 4
 * sẽ FK vào đây — nếu nghiệp vụ thật sự cần "khách đổi số", đó là một thao tác di trú riêng, có
 * story riêng, KHÔNG phải một `PATCH` lặng lẽ.
 *
 * Đổi `sourceId` sang một nguồn `isOther` ⇒ `sourceNote` bị đòi LẠI trên nguồn MỚI (luật ở
 * service): kiểm lúc tạo rồi thì thôi là cách bỏ sót nửa số đường vào dữ liệu.
 */
export class UpdateCustomerRequestDto {
  // Khai kiểu `string` (không phải `never`) CHỈ để `@nestjs/swagger` sinh được schema — hợp
  // đồng thật là: gửi field này lên thì LUÔN 400. `@IsAbsent` mới là thứ enforce, không phải
  // kiểu TS.
  @ApiPropertyOptional({
    type: String,
    description:
      'KHÔNG gửi field này. SĐT là khoá chính, bất biến sau khi tạo — gửi kèm ⇒ 400 (không phải im lặng bỏ qua).',
  })
  @IsAbsent(
    'SĐT là khoá chính, không sửa được sau khi tạo (đổi SĐT cần thao tác di trú riêng).',
  )
  sdt?: string;

  @ApiPropertyOptional({ description: 'Loại khách.', enum: CUST_TYPES })
  @IsOptionalNotNull()
  @IsIn(CUST_TYPES)
  custType?: string;

  @ApiPropertyOptional({
    description: 'Họ tên (Cá nhân) hoặc tên công ty (Thương mại).',
  })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'CCCD — CHỈ khách Cá nhân.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  cccd?: string | null;

  @ApiPropertyOptional({ description: 'Mã số thuế — CHỈ khách Thương mại.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  taxCode?: string | null;

  @ApiPropertyOptional({ description: 'Địa chỉ — dùng cho cả hai loại khách.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({
    description: 'Tài khoản ngân hàng — CHỈ khách Thương mại.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bankAccount?: string | null;

  @ApiPropertyOptional({
    description:
      'Nguồn khách (id của CustomerSource). Trỏ tới nguồn không tồn tại ⇒ 400.',
  })
  @IsOptionalNotNull()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional({
    description:
      'Ghi chú nguồn — BẮT BUỘC khi nguồn (mới hoặc đang có) mang cờ `isOther`.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  sourceNote?: string | null;
}
