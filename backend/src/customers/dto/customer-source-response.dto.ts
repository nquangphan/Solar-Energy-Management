import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response của `GET /customer-sources` — danh mục để form khách có cái mà chọn.
 *
 * `isOther` lộ ra FE có chủ đích: form biết khi nào phải hiện (và bắt buộc) ô "ghi rõ nguồn".
 * Nhưng đó chỉ là gợi ý UX — luật thật enforce ở SERVER (thiếu `sourceNote` khi nguồn `isOther`
 * ⇒ 400), không phụ thuộc FE có nhớ hiện ô đó hay không (AD-4).
 */
export class CustomerSourceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Facebook' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'false = nguồn đã ngừng dùng.' })
  active!: boolean;

  @ApiProperty({ description: 'Thứ tự hiển thị trong form.' })
  sortOrder!: number;

  @ApiProperty({
    description:
      'true = nguồn "Khác" ⇒ chọn nó thì `sourceNote` BẮT BUỘC. Đúng một dòng mang cờ này.',
  })
  isOther!: boolean;
}
