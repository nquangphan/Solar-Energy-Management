import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsAbsent } from '../../customers/dto/is-absent.decorator';

/** Message for an `email` sent to any auth endpoint — sign-in is by phone since 10.9. */
export const EMAIL_NOT_ACCEPTED_MESSAGE =
  'Đăng nhập bằng số điện thoại — không gửi email.';

/**
 * Body của `POST /auth/login`. `@ApiProperty` để OpenAPI có schema thật; class-validator
 * để ValidationPipe (2.2) tự trả `400 VALIDATION_ERROR` + `fieldErrors` khi body sai.
 */
export class LoginRequestDto {
  @ApiProperty({
    description: 'SĐT dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra.',
    example: '0912345678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({ description: 'Mật khẩu.', example: 'MatKhauManh!23' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  /**
   * Declared only to REJECT it: `whitelist: true` would silently strip an unknown
   * `email`, answering 200 to an old client. Hidden from OpenAPI so the generated
   * clients never carry the key — a Dart `toJson` would send `"email": null`, which
   * `@IsAbsent` counts as present and every mobile login would 400.
   */
  @ApiHideProperty()
  @IsAbsent(EMAIL_NOT_ACCEPTED_MESSAGE)
  email?: unknown;
}
