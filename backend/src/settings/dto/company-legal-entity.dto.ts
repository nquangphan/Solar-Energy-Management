import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** Max length of one legal-entity field. */
export const LEGAL_ENTITY_FIELD_MAX_LENGTH = 200;

const IS_STRING = { message: 'Phải là chuỗi ký tự.' };
const MAX_LENGTH = {
  message: `Tối đa ${LEGAL_ENTITY_FIELD_MAX_LENGTH} ký tự.`,
};

/**
 * Company legal entity printed on contracts — request of `PUT` and response of `GET`/`PUT
 * /settings/company-legal-entity`. PUT replaces the whole entity, so every field is REQUIRED
 * (no `@IsOptional`: a `null` would slip through to a 500); an empty string is valid and means
 * "not configured" — the contract prints "Chưa cấu hình".
 */
export class CompanyLegalEntityDto {
  @ApiProperty({
    description: 'Tên công ty (pháp nhân) — chuỗi rỗng = chưa cấu hình.',
  })
  @IsString(IS_STRING)
  @MaxLength(LEGAL_ENTITY_FIELD_MAX_LENGTH, MAX_LENGTH)
  legalName!: string;

  @ApiProperty({ description: 'Mã số thuế công ty.' })
  @IsString(IS_STRING)
  @MaxLength(LEGAL_ENTITY_FIELD_MAX_LENGTH, MAX_LENGTH)
  taxCode!: string;

  @ApiProperty({ description: 'Địa chỉ công ty.' })
  @IsString(IS_STRING)
  @MaxLength(LEGAL_ENTITY_FIELD_MAX_LENGTH, MAX_LENGTH)
  address!: string;

  @ApiProperty({ description: 'Người đại diện ký hợp đồng.' })
  @IsString(IS_STRING)
  @MaxLength(LEGAL_ENTITY_FIELD_MAX_LENGTH, MAX_LENGTH)
  representative!: string;

  @ApiProperty({ description: 'Chức danh người đại diện.' })
  @IsString(IS_STRING)
  @MaxLength(LEGAL_ENTITY_FIELD_MAX_LENGTH, MAX_LENGTH)
  representativeTitle!: string;

  @ApiProperty({ description: 'Điện thoại công ty.' })
  @IsString(IS_STRING)
  @MaxLength(LEGAL_ENTITY_FIELD_MAX_LENGTH, MAX_LENGTH)
  phone!: string;

  @ApiProperty({
    description: 'Tài khoản ngân hàng nhận thanh toán (in trên hợp đồng).',
  })
  @IsString(IS_STRING)
  @MaxLength(LEGAL_ENTITY_FIELD_MAX_LENGTH, MAX_LENGTH)
  bankAccount!: string;
}
