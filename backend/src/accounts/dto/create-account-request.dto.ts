import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsPasswordPolicy } from '../../auth/dto/password-policy';
import { ROLE_PRESET_KEYS } from '../domain/role-presets';

/**
 * Body of `POST /accounts`. `preset` is loaded server-side from `ROLE_PRESETS` — the client
 * never sends a permission set it built itself (AD-2, AD-8); fine-tuning happens in the
 * permission matrix right after. `phone` is RAW, normalized by the backend (AD-9).
 */
export class CreateAccountRequestDto {
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

  @ApiProperty({
    description: 'Mật khẩu ban đầu — tối thiểu 8 ký tự, có chữ và số.',
    example: 'MatKhau123',
  })
  @IsPasswordPolicy()
  password!: string;

  @ApiProperty({
    enum: ROLE_PRESET_KEYS,
    enumName: 'RolePreset',
    description:
      'Preset nạp bộ quyền mặc định lúc tạo. Preset người gọi không cấp trọn được ⇒ 403.',
  })
  @IsIn(ROLE_PRESET_KEYS)
  preset!: string;

  @ApiProperty({ description: 'false = tạo ở trạng thái tạm khoá.' })
  @IsBoolean()
  isActive!: boolean;
}
