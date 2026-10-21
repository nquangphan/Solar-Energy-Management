import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PAYMENT_METHODS, PAYMENT_NOTE_MAX_LENGTH } from '../domain/payment';
import { MAX_INSTALLMENT_AMOUNT } from '../domain/payment-schedule';

const PAID_ON_FORMAT_MESSAGE = 'Ngày thu phải có dạng YYYY-MM-DD.';

/** Records one payment received against one installment of the order's schedule. */
export class RecordPaymentRequestDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Khoá chống ghi trùng do client sinh MỘT lần cho mỗi lần mở form; retry phải gửi lại đúng khoá.',
  })
  @IsUUID('4', { message: 'Khoá ghi nhận phải là UUID v4.' })
  idempotencyKey!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'id của đợt (không phải seq) — lịch bị thay giữa lúc xem và lúc ghi ⇒ 409 thay vì ghi nhầm đợt.',
  })
  @IsUUID('all', { message: 'Đợt thanh toán không hợp lệ.' })
  installmentId!: string;

  @ApiProperty({
    description: `Số tiền thu — số nguyên đồng, 1..${MAX_INSTALLMENT_AMOUNT}, không vượt phần còn lại của đợt.`,
    example: 16_602_192,
  })
  @IsInt({ message: 'Số tiền thu phải là số nguyên đồng.' })
  @Min(1, { message: 'Số tiền thu phải lớn hơn 0.' })
  @Max(MAX_INSTALLMENT_AMOUNT, {
    message: 'Số tiền thu vượt mức tối đa của một đợt.',
  })
  amount!: number;

  @ApiProperty({
    format: 'date',
    description: 'Ngày thu YYYY-MM-DD, không sau hôm nay (giờ Việt Nam).',
    example: '2026-10-21',
  })
  @IsISO8601({ strict: true }, { message: PAID_ON_FORMAT_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: PAID_ON_FORMAT_MESSAGE })
  paidOn!: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS, { message: 'Phương thức thu không hợp lệ.' })
  method!: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({
    description: `Ghi chú, tối đa ${PAYMENT_NOTE_MAX_LENGTH} ký tự sau khi bỏ khoảng trắng hai đầu.`,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString({ message: 'Ghi chú phải là chuỗi.' })
  @MaxLength(PAYMENT_NOTE_MAX_LENGTH, {
    message: `Ghi chú tối đa ${PAYMENT_NOTE_MAX_LENGTH} ký tự.`,
  })
  note?: string;
}
