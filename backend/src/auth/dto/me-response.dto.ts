import { ApiProperty } from '@nestjs/swagger';
import { PERM } from '../../accounts/domain/permission-registry';

/**
 * Phản hồi của `GET /me`: danh tính tối thiểu + **bộ quyền hiệu lực** của account đang
 * đăng nhập. CHỈ field an toàn — KHÔNG `passwordHash`/token/field account nhạy cảm.
 *
 * `permissions` là contract chính tắc FE (Story 2.6) dựng `PermissionSet` — server là
 * nguồn quyền DUY NHẤT (AD-4/AD-8); client gating chỉ UX.
 */
export class MeResponseDto {
  @ApiProperty({ description: 'ID account (UUID).' })
  id!: string;

  @ApiProperty({
    description: 'Email liên hệ (không còn là định danh đăng nhập).',
  })
  email!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'SĐT đăng nhập (E.164) — null khi account chưa có số.',
  })
  phone!: string | null;

  @ApiProperty({ description: 'Tên hiển thị.' })
  displayName!: string;

  @ApiProperty({
    description:
      'Bộ quyền hiệu lực (sorted, tất định), mỗi phần tử là một key trong `openapi/permissions.json`; FE dựng `PermissionSet` từ mảng này.',
    type: [String],
    // Dùng `PERM.*` (KHÔNG literal) để không vi phạm source-guard AD-17.
    example: [PERM.auditRead, PERM.ordersViewAll],
  })
  permissions!: string[];
}
