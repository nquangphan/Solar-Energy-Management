import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Query của `GET /orders/tra-cuu-bao-hanh`.
 *
 * `sdt` là chuỗi THÔ đúng như nhân viên gõ khi khách đang gọi tới (`0903 176 968`,
 * `+84903176968`) — client KHÔNG bao giờ chuẩn hoá (AD-9). `@IsString()` chặn mảng/object lồng
 * đi tới `normalizeVnPhone`; `@MaxLength` để một chuỗi khổng lồ không tới nổi tầng chuẩn hoá.
 */
export class WarrantyLookupQueryDto {
  @ApiProperty({
    description: 'SĐT dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra.',
    example: '0903176968',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  sdt!: string;
}
