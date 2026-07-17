import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Body của `POST /orders/:id/ap-chiet-khau` (Story 4.7, FR-18). Chiết khấu là MỘT khoản
 * integer ĐỒNG trên Đơn (AD-10) — KHÔNG per-line, KHÔNG %: nhập bằng % sẽ buộc quy đổi
 * %→đồng phía client (số học tiền client bị CẤM) hoặc thêm round-point mới ở backend.
 *
 * Luật `amount ≤ subtotal hiện hành` cần đọc đơn nên sống ở service (400 fieldErrors),
 * không ở đây.
 */
export class ApplyDiscountRequestDto {
  @ApiProperty({
    description:
      'Mức chiết khấu — số nguyên ĐỒNG trên Đơn, tối thiểu 1; vượt subtotal hiện hành ⇒ 400.',
    example: 2_000_000,
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Lý do đề xuất chiết khấu — optional, hiện trên màn duyệt.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
