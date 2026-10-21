import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/**
 * Body của `POST /orders/:id/cancel` (Story 5.7, FR-9).
 *
 * ⚠️ CỐ Ý KHÔNG có `@IsNotEmpty()` / `@MinLength(3)`. Luật "lý do rỗng sau trim là không hợp
 * lệ" là luật NGHIỆP VỤ và nó sống ở `OrdersService.huyDon()`: để decorator bắt trước thì
 * `ValidationPipe` trả 400 bằng một envelope khác, trước khi service kịp chạy — hai thông
 * điệp lỗi cho cùng một sai lầm của người dùng.
 *
 * `@MaxLength` ở lại vì đó là ràng buộc KÍCH THƯỚC thuần (chặn payload rác ở cửa), không phải
 * luật nghiệp vụ.
 */
export class CancelOrderRequestDto {
  @ApiProperty({
    maxLength: 500,
    description:
      'Lý do huỷ đơn — BẮT BUỘC, tối thiểu 3 ký tự sau khi trim (service enforce).',
    example: 'Khách đổi ý, không lắp nữa',
  })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
