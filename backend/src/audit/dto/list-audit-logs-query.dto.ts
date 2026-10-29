import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { AUDIT_TARGET_TYPES } from '../domain/audit-target-types';

const DATE_FORMAT_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD và là ngày có thật.';

/**
 * Query of `GET /audit-logs`: target type, Vietnam-day range (both ends inclusive) and paging.
 * `@Type(() => Number)` on `page`/`pageSize` is required — query strings arrive as strings.
 */
export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo loại đối tượng. Bỏ trống ⇒ mọi loại.',
    enum: AUDIT_TARGET_TYPES,
    enumName: 'AuditTargetType',
    example: AUDIT_TARGET_TYPES[0],
  })
  @IsOptional()
  @IsIn(AUDIT_TARGET_TYPES)
  targetType?: (typeof AUDIT_TARGET_TYPES)[number];

  @ApiPropertyOptional({
    format: 'date',
    description: 'Từ ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này).',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: DATE_FORMAT_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_FORMAT_MESSAGE })
  from?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Đến ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này).',
    example: '2026-10-30',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: DATE_FORMAT_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_FORMAT_MESSAGE })
  to?: string;

  @ApiPropertyOptional({
    description: 'Trang, bắt đầu từ 1.',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Số bản ghi mỗi trang — tối đa 100.',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
