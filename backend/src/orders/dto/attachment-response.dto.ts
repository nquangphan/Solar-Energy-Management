import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * MỘT ảnh của đơn — cả ảnh gắn vào một bước (5.5) lẫn ảnh bổ sung (5.6), trong CÙNG một shape.
 *
 * ⚠️ KHÔNG có `objectKey`: key R2 là chi tiết hạ tầng và không rời backend (AD-3). Client tải
 * bytes qua `GET /orders/:id/anh/:attachmentId` — proxy đã scope, sau JWT.
 *
 * `statusFrom`/`statusTo` là cặp toạ độ bước: cả hai `null` nghĩa là ảnh BỔ SUNG, không thuộc
 * lần chuyển trạng thái nào. Client đọc cặp này để chọn badge, không suy từ chỗ khác.
 */
export class AttachmentItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description: 'Tên file đã dọn ký tự nguy hiểm lúc ghi, giữ tiếng Việt có dấu.',
  })
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  contentType!: string;

  @ApiProperty({ description: 'Kích thước byte.' })
  size!: number;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  createdAt!: Date;

  @ApiProperty({ description: 'Tên hiển thị người tải ảnh lên.' })
  nguoiTaiLen!: string;

  @ApiPropertyOptional({
    description: 'Trạng thái TRƯỚC bước ảnh này thuộc về; null với ảnh bổ sung.',
    nullable: true,
  })
  statusFrom!: string | null;

  @ApiPropertyOptional({
    description: 'Trạng thái SAU bước ảnh này thuộc về; null với ảnh bổ sung.',
    nullable: true,
  })
  statusTo!: string | null;

  @ApiProperty({
    description:
      'Người gọi có xoá được ảnh này không — tính Ở BACKEND (người tải lên HOẶC có quyền chỉnh sửa đơn). Client CHỈ hiển thị, không dựng lại luật.',
  })
  coTheXoa!: boolean;
}

/**
 * Response của `GET /orders/:id/anh` — danh sách PHẲNG theo `createdAt` giảm dần.
 *
 * Không phân trang: trần thực tế là vài chục ảnh một đơn. Bọc trong `items` thay vì trả mảng
 * trần để còn chỗ thêm metadata sau mà không phá contract (khuôn `OrderVersionsResponseDto`).
 */
export class AttachmentListResponseDto {
  @ApiProperty({ type: [AttachmentItemDto] })
  items!: AttachmentItemDto[];
}

/** Response của `POST /orders/:id/anh` — id các ảnh vừa lưu, để client refresh đúng chỗ. */
export class AttachmentUploadResponseDto {
  @ApiProperty({ description: 'Số ảnh đã lưu trong lượt này.' })
  soAnhDaLuu!: number;

  @ApiProperty({ type: [String] })
  attachmentIds!: string[];
}
