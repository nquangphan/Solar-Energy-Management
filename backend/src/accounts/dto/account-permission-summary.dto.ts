import { ApiProperty } from '@nestjs/swagger';
import { PERM } from '../domain/permission-registry';
import { ROLE_PRESET_KEYS } from '../domain/role-presets';

/**
 * One account as the Permissions screen lists it. `editable`/`readOnlyReason` are computed by
 * the server from the same escalation rules the save enforces — the client only displays them.
 */
export class AccountPermissionSummaryDto {
  @ApiProperty({ example: '6f1c2a4e-0b7d-4c1a-9d3e-2f5a8b7c9d10' })
  id!: string;

  @ApiProperty({ example: 'Trần Văn A' })
  displayName!: string;

  @ApiProperty({
    type: 'string',
    nullable: true,
    description: 'SĐT đăng nhập (E.164). null với account cũ chưa có số.',
    example: '+84901234567',
  })
  phone!: string | null;

  @ApiProperty({ example: 'a.tran@phuongnamsolar.vn' })
  email!: string;

  @ApiProperty({ description: 'false = account đã vô hiệu.' })
  isActive!: boolean;

  @ApiProperty({
    type: [String],
    description: 'Bộ quyền đang lưu trên account (sorted).',
    example: [PERM.catalogView, PERM.customersManage],
  })
  permissions!: string[];

  @ApiProperty({
    type: 'string',
    enum: ROLE_PRESET_KEYS,
    enumName: 'RolePreset',
    nullable: true,
    description:
      'Preset có bộ quyền trùng khít bộ quyền của account; null = tuỳ chỉnh. Account không lưu role.',
  })
  matchingPreset!: string | null;

  @ApiProperty({
    type: 'string',
    nullable: true,
    description:
      'Nhãn tiếng Việt của matchingPreset (kể cả preset người gọi không cấp được); null = tuỳ chỉnh.',
    example: 'Thợ khảo sát',
  })
  matchingPresetLabel!: string | null;

  @ApiProperty({
    description:
      'Người gọi có sửa được quyền của account này không (không phải chính mình, và account không mang quyền người gọi không có).',
  })
  editable!: boolean;

  @ApiProperty({
    type: 'string',
    nullable: true,
    description: 'Lý do chỉ đọc khi editable = false; null khi sửa được.',
    example: 'Đây là tài khoản của bạn.',
  })
  readOnlyReason!: string | null;
}
