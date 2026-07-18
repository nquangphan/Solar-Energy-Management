import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response của `GET /orders/tra-cuu-bao-hanh?sdt=<thô>` — chỉ để OpenAPI có schema thật
 * (AD-12); service trả object thường, KHÔNG instantiate class nào ở đây.
 *
 * Field nullable khai `type` TƯỜNG MINH: union `string | null` sinh `"type":"object"` làm hỏng
 * codegen (bug đã sửa ở 3.6).
 */

/** Tóm tắt khách trên thẻ đầu màn — CHỈ thứ cần để xác nhận "đúng người đang gọi". */
export class WarrantyCustomerDto {
  @ApiProperty({ example: '+84903176968' })
  sdt!: string;

  @ApiProperty({ description: 'Họ tên hoặc tên công ty.' })
  name!: string;

  @ApiProperty({ description: 'Loại khách: CA_NHAN | THUONG_MAI.' })
  custType!: string;
}

/**
 * Một dòng vật tư CÒN THEO DÕI bảo hành. Mọi con số ngày tháng ở đây do BACKEND tính: hai
 * client đều không có thư viện ngày, nên tự cộng tháng ở đó là hai bản cài đặt của cùng một
 * quy tắc có bẫy (31/01 + 1 tháng = ?).
 */
export class WarrantyLineItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Tên vật tư.' })
  name!: string;

  @ApiProperty()
  qty!: number;

  @ApiProperty({ example: 'tấm' })
  unit!: string;

  @ApiProperty({ description: 'Số tháng bảo hành của DÒNG này.', example: 60 })
  warrantyMonths!: number;

  @ApiProperty({
    description:
      'Ngày DÒNG NÀY chốt lần đầu (ISO-8601 UTC) — mốc theo DÒNG, không theo Đơn (FR-36): hai dòng cùng đơn được phép khác nhau.',
  })
  warrantyStartAt!: Date;

  @ApiProperty({
    description:
      'Hạn bảo hành (ISO-8601 UTC, luôn `00:00:00Z`) = `warrantyStartAt` + `warrantyMonths` tháng, kẹp về ngày cuối tháng đích.',
  })
  warrantyEndAt!: Date;

  @ApiProperty({
    description:
      'Số ngày còn lại — ÂM khi đã hết hạn. Đây là số điều khiển `warrantyStatus`; client KHÔNG tự suy trạng thái từ nó.',
    example: 412,
  })
  remainingDays!: number;

  @ApiProperty({
    description:
      'Số tháng còn lại, làm tròn XUỐNG, sàn 0 — CHỈ để dựng câu hiển thị "Còn 5 năm".',
    example: 13,
  })
  remainingMonths!: number;

  @ApiProperty({
    description:
      'Trạng thái bảo hành — backend quyết, client chỉ ánh xạ ra màu + nhãn.',
    enum: ['con_han', 'sap_het', 'het_han'],
  })
  warrantyStatus!: string;
}

/** Một đơn của khách, đã lọc còn các dòng có bảo hành thuộc BẢN HIỆU LỰC (AD-6). */
export class WarrantyOrderDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Trạng thái đơn — bộ khoá chip design-system.' })
  status!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Ngày chốt của bản hiệu lực (ISO-8601 UTC); `null` nếu bản đó chưa chốt.',
  })
  chotAt!: Date | null;

  @ApiProperty({ type: [WarrantyLineItemDto] })
  lineItems!: WarrantyLineItemDto[];
}

/**
 * "Không tìm thấy khách" ⇒ `200 { found: false, orders: [] }`, KHÔNG phải 404 (khuôn
 * `CustomerLookupResponseDto`): một phép TRA có hai kết quả bình thường, và nhân viên đang
 * nghe máy cần câu trả lời chứ không cần một exception.
 */
export class WarrantyLookupResponseDto {
  @ApiProperty({ description: 'Có khách hàng nào mang SĐT này chưa.' })
  found!: boolean;

  @ApiProperty({
    description: 'SĐT đã chuẩn hoá E.164 — trả về kể cả khi `found: false`.',
    example: '+84903176968',
  })
  sdt!: string;

  @ApiProperty({
    type: WarrantyCustomerDto,
    nullable: true,
    description: 'Khách tìm được; `null` khi `found: false`.',
  })
  customer!: WarrantyCustomerDto | null;

  @ApiProperty({
    type: [WarrantyOrderDto],
    description:
      'Đơn của khách ĐÃ thu hẹp theo quyền người gọi, chỉ giữ đơn còn ít nhất một dòng có bảo hành.',
  })
  orders!: WarrantyOrderDto[];
}
