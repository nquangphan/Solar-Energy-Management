import { ApiProperty } from '@nestjs/swagger';
import { PERM } from '../domain/permission-registry';
import { ROLE_PRESET_KEYS } from '../domain/role-presets';

/** One edge of the order transition table, as gated by a permission. */
export class PermissionTransitionDto {
  @ApiProperty({ type: String, example: 'bat_dau_thi_cong' })
  event!: string;

  @ApiProperty({ type: String, example: 'dacoc' })
  from!: string;

  @ApiProperty({ type: String, example: 'thicong' })
  to!: string;
}

/** One registry permission, with what it needs and whether the caller may grant it. */
export class PermissionOptionDto {
  @ApiProperty({ example: PERM.quotesCreateEdit })
  key!: string;

  @ApiProperty({ example: 'Tạo/sửa báo giá' })
  label!: string;

  @ApiProperty({ example: 'quotes' })
  group!: string;

  @ApiProperty({
    type: [String],
    description:
      'Quyền phải có kèm thì quyền này mới dùng được (thiếu ⇒ lưu bị từ chối).',
    example: [PERM.customersManage, PERM.catalogView],
  })
  requires!: string[];

  @ApiProperty({
    type: [String],
    description:
      'Phải có ít nhất một trong các quyền này (rỗng = không ràng buộc).',
    example: [PERM.ordersViewAll, PERM.ordersViewOwn],
  })
  requiresAnyOf!: string[];

  @ApiProperty({
    description: 'Người gọi cấp được quyền này không (luật không-leo-thang).',
  })
  grantable!: boolean;

  @ApiProperty({
    type: [PermissionTransitionDto],
    description:
      'Các bước chuyển trạng thái đơn mà quyền này điều khiển, theo thứ tự bảng (rỗng = không bước nào).',
  })
  transitions!: PermissionTransitionDto[];
}

/** A role preset: default values loaded into the matrix, never stored on the account. */
export class RolePresetOptionDto {
  @ApiProperty({ enum: ROLE_PRESET_KEYS, enumName: 'RolePreset' })
  key!: string;

  @ApiProperty({ example: 'Thợ khảo sát' })
  label!: string;

  @ApiProperty({ type: [String], example: [PERM.catalogView] })
  permissions!: string[];
}

export class PermissionOptionsResponseDto {
  @ApiProperty({
    type: [PermissionOptionDto],
    description: 'Mọi quyền trong registry, xếp theo nhóm.',
  })
  permissions!: PermissionOptionDto[];

  @ApiProperty({
    type: [RolePresetOptionDto],
    description: 'Chỉ các preset người gọi cấp được trọn bộ.',
  })
  presets!: RolePresetOptionDto[];
}
