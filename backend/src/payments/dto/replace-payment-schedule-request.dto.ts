import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { MAX_INSTALLMENTS } from '../domain/payment-schedule';
import { InstallmentInputDto } from './installment-input.dto';

/** Replaces the whole installment list of the order's schedule. */
export class ReplacePaymentScheduleRequestDto {
  @ApiProperty({
    type: [InstallmentInputDto],
    description: `Các đợt theo thứ tự thu, từ 1 đến ${MAX_INSTALLMENTS} đợt. Đợt 1 là cọc; mốc tự động do server gán theo vị trí.`,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Lịch thanh toán cần ít nhất một đợt.' })
  @ArrayMaxSize(MAX_INSTALLMENTS, {
    message: `Lịch thanh toán tối đa ${MAX_INSTALLMENTS} đợt.`,
  })
  @ValidateNested({ each: true })
  @Type(() => InstallmentInputDto)
  installments!: InstallmentInputDto[];
}
