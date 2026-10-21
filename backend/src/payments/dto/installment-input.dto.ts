import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CONDITION_NOTE_MAX_LENGTH,
  MAX_INSTALLMENT_AMOUNT,
} from '../domain/payment-schedule';

const POSITIVE_MESSAGE = 'Mỗi đợt phải lớn hơn 0.';
/** Shared with the domain check on percent-resolved amounts (same cap, same wording). */
export const AMOUNT_TOO_LARGE_MESSAGE =
  'Một đợt tối đa 2.000.000.000 đồng — chia thành nhiều đợt.';

/**
 * One installment as typed by the user: EXACTLY one of `percent` / `amount` (checked by the
 * domain — field `installments.{i}.percent`, code `exactlyOneOf`) plus a condition note.
 */
export class InstallmentInputDto {
  @ApiPropertyOptional({
    description:
      'Phần trăm của tổng đơn sau VAT, số nguyên 1..100. Gửi ĐÚNG MỘT trong `percent`/`amount`.',
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: POSITIVE_MESSAGE })
  @Max(100, { message: 'Tỉ lệ một đợt tối đa 100%.' })
  percent?: number;

  @ApiPropertyOptional({
    description: `Số tiền của đợt — số nguyên đồng, 1..${MAX_INSTALLMENT_AMOUNT}. Gửi ĐÚNG MỘT trong \`percent\`/\`amount\`.`,
    example: 16_602_192,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: POSITIVE_MESSAGE })
  @Max(MAX_INSTALLMENT_AMOUNT, { message: AMOUNT_TOO_LARGE_MESSAGE })
  amount?: number;

  @ApiProperty({
    description: `Mô tả điều kiện thu (vd "Cọc khi ký hợp đồng"), 1..${CONDITION_NOTE_MAX_LENGTH} ký tự sau khi bỏ khoảng trắng hai đầu.`,
    example: 'Cọc khi ký hợp đồng',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MinLength(1, { message: 'Nhập điều kiện thu của đợt.' })
  @MaxLength(CONDITION_NOTE_MAX_LENGTH, {
    message: `Điều kiện tối đa ${CONDITION_NOTE_MAX_LENGTH} ký tự.`,
  })
  conditionNote!: string;
}
