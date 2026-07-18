import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Đổi số lượng của MỘT dòng giữa hai bản. */
export class ThayDoiSoLuongDto {
  @ApiProperty({ description: 'Tên dòng ở bản mới.' })
  ten!: string;

  @ApiProperty({ description: 'Số lượng ở bản trước.' })
  tu!: number;

  @ApiProperty({ description: 'Số lượng ở bản này.' })
  den!: number;
}

/**
 * "Đổi gì" so với bản liền trước — CHỈ về dòng và số lượng.
 *
 * KHÔNG so tiền/đơn giá: trước Chốt giá là live-resolve từ danh mục, nên so giá sẽ báo "đổi"
 * cho một bản không ai đụng vào.
 */
export class ThayDoiBanUpdateDto {
  @ApiProperty({ type: [String], description: 'Tên các dòng mới thêm.' })
  them!: string[];

  @ApiProperty({ type: [String], description: 'Tên các dòng bị xoá.' })
  xoa!: string[];

  @ApiProperty({ type: [ThayDoiSoLuongDto] })
  doiSoLuong!: ThayDoiSoLuongDto[];
}

/**
 * Một bản update trong lịch sử đơn (FR-6).
 *
 * `laBanHienLuc` phân giải qua `Order.currentVersionId` — KHÔNG suy bằng `versionNo` lớn nhất
 * hay timestamp (AD-6 cấm tường minh: con trỏ có thể trỏ bản không phải bản mới nhất).
 *
 * `createdByAccountId`/`createdByDisplayName` null với bản tạo trước khi cột actor tồn tại —
 * UI hiện `—`, KHÔNG bịa tên.
 */
export class OrderVersionItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Số thứ tự bản, bắt đầu từ 1.', example: 1 })
  versionNo!: number;

  @ApiProperty({ description: 'Bản đang hiệu lực (theo currentVersionId).' })
  laBanHienLuc!: boolean;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Thời điểm bản này được Chốt; null nếu chưa chốt.',
    nullable: true,
  })
  chotAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  createdByAccountId!: string | null;

  @ApiPropertyOptional({
    description: 'Tên hiển thị người tạo bản; null với bản cũ không có actor.',
    nullable: true,
  })
  createdByDisplayName!: string | null;

  @ApiProperty({ description: 'Số dòng của chính bản này.' })
  soDong!: number;

  @ApiProperty({ type: ThayDoiBanUpdateDto })
  thayDoi!: ThayDoiBanUpdateDto;
}
