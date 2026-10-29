import { ApiProperty } from '@nestjs/swagger';
import { AUDIT_TARGET_TYPES } from '../domain/audit-target-types';
import { AuditChangeDto } from './audit-change.dto';

/** One immutable audit record with its five dimensions: who, what, target, when, before → after. */
export class AuditLogEntryDto {
  @ApiProperty({ example: '0b7f1f6e-1d7a-4c1e-9a4a-6a5e2f0c1b33' })
  id!: string;

  @ApiProperty({ description: 'Loại sự kiện (mã).', example: 'OrderConfirmed' })
  eventType!: string;

  @ApiProperty({
    description: 'Tên hành động tiếng Việt.',
    example: 'Chốt đơn',
  })
  eventLabel!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Account thực hiện; null = hệ thống tự chạy.',
  })
  actorAccountId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Tên hiển thị của account thực hiện; null khi hệ thống tự chạy hoặc account không còn.',
    example: 'Nguyễn Văn A',
  })
  actorDisplayName!: string | null;

  @ApiProperty({
    type: 'string',
    nullable: true,
    enum: AUDIT_TARGET_TYPES,
    enumName: 'AuditTargetType',
    description:
      'Loại đối tượng bị tác động; null khi sự kiện không gắn đối tượng.',
  })
  targetType!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Mã đối tượng (UUID, hoặc SĐT E.164 với khách hàng).',
  })
  targetId!: string | null;

  @ApiProperty({ description: 'Thời điểm nghiệp vụ, ISO-8601 UTC.' })
  occurredAt!: Date;

  @ApiProperty({ type: [AuditChangeDto] })
  changes!: AuditChangeDto[];
}
