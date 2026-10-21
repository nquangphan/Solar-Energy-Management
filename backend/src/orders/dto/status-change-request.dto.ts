import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SU_KIEN, SU_KIEN_THU_CONG } from '../domain/allowed-transition';

/** Mọi sự kiện CÓ THẬT trong bảng transition — kể cả sáu sự kiện có cửa riêng. */
const SU_KIEN_CO_THAT = Object.values(SU_KIEN);

/**
 * Body của `POST /orders/:id/transition` (Story 5.5, FR-9) — gửi kèm ảnh dưới dạng
 * `multipart/form-data`, nên đây là các field TEXT của form.
 *
 * Caller chọn một SỰ KIỆN CÓ TÊN, KHÔNG tự khai đích đến: đích đến là của
 * `ALLOWED_TRANSITIONS`, không của client (AD-11/AD-2).
 *
 * ⚠️ `@IsIn` nhận MỌI sự kiện có thật, KHÔNG chỉ năm sự kiện của lane thủ công — và đó là
 * quyết định có chủ đích, không phải nới lỏng. Hai loại "sai" khác nhau phải trả hai mã khác
 * nhau:
 *  - Tên sự kiện KHÔNG TỒN TẠI (`'xyz'`) là body sai cú pháp ⇒ 400 `VALIDATION_ERROR` ở
 *    `ValidationPipe`, đúng chỗ.
 *  - `chot`/`mo_lai`/`huy`/`du_coc`/`ap_chiet_khau` TỒN TẠI và hợp lệ với bảng, chỉ là chúng
 *    có cửa riêng ⇒ đây là xung đột NGHIỆP VỤ, và AC-13 đòi 409 `CONFLICT`.
 * Siết `@IsIn` về `SU_KIEN_THU_CONG` khiến pipe nuốt luôn nhóm thứ hai thành 400, tức
 * whitelist 409 trong service KHÔNG BAO GIỜ tới lượt và `@ApiConflictResponse` của route nói
 * dối. Giữ ranh giới ở service — nơi duy nhất biết vì sao sự kiện đó bị từ chối.
 */
export class StatusChangeRequestDto {
  @ApiProperty({
    enum: SU_KIEN_THU_CONG,
    description:
      'Sự kiện chuyển trạng thái. CHỈ năm sự kiện của lane thủ công — `chot`/`mo_lai`/`huy`/`du_coc`/`ap_chiet_khau` có cửa riêng mang theo logic riêng và bị từ chối 409 ở đây.',
    example: SU_KIEN_THU_CONG[0],
  })
  @IsIn(SU_KIEN_CO_THAT)
  event!: string;

  // Documents the form's file field name only: Multer puts files in `req.files`, not in the
  // body, so the handler reads `@UploadedFiles()` and never this property.
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description:
      'Ảnh bằng chứng của bước (JPEG/PNG/WebP) — optional; ngưỡng số ảnh/kích thước do backend kiểm.',
  })
  @IsOptional()
  files?: unknown[];
}
