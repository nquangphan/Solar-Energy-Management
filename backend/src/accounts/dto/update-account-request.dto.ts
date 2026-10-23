import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsAbsent } from '../../customers/dto/is-absent.decorator';

/**
 * Body of `PUT /accounts/:id` — REPLACES the profile, so every field is required. The
 * permission set is not part of it (`PUT /accounts/:id/permissions`). `isActive: false`
 * deactivates the account and revokes all its sessions.
 */
export class UpdateAccountRequestDto {
  @ApiProperty({ description: 'Họ tên hiển thị.', example: 'Trần Văn A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  displayName!: string;

  @ApiProperty({
    description:
      'SĐT đăng nhập dạng THÔ — backend chuẩn hoá về E.164. Không hợp lệ ⇒ 400, trùng ⇒ 409.',
    example: '0912 345 678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({
    description: 'Email liên hệ (backend trim + lowercase). Trùng ⇒ 409.',
    example: 'a.tran@phuongnamsolar.vn',
  })
  // Trimmed before `@IsEmail`: a keyboard's trailing space must not read as an invalid address.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ description: 'false = vô hiệu hoá (thu hồi mọi phiên).' })
  @IsBoolean()
  isActive!: boolean;

  /**
   * Declared only to REJECT it: `whitelist: true` would silently strip it and answer 200, so
   * an admin would believe the password changed. Hidden from OpenAPI so generated clients
   * never carry the key (a Dart `toJson` would send `"password": null`).
   */
  @ApiHideProperty()
  @IsAbsent('Không đổi mật khẩu ở đây — người dùng tự đổi ở Hồ sơ.')
  password?: unknown;
}
