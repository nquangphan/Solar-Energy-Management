import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body của `POST /orders` — đúng MỘT field: khách của đơn. Mọi thứ còn lại (status, owner,
 * sourceId, custType, version 1) do SERVER quyết từ actor + bản ghi Customer, client không
 * gửi được — snapshot nguồn (FR-35) mà nhận từ client là mở cửa cho kênh bịa.
 */
export class CreateOrderRequestDto {
  @ApiProperty({
    description:
      'SĐT khách — thô hay E.164 đều được, backend chuẩn hoá trước khi tra (AD-9). Khách chưa tồn tại ⇒ 404 (luồng tạo khách inline đã có ở màn tra SĐT).',
    example: '0912345678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  customerSdt!: string;
}
