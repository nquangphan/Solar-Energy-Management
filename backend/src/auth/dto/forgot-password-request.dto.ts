import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsAbsent } from '../../customers/dto/is-absent.decorator';
import { EMAIL_NOT_ACCEPTED_MESSAGE } from './login-request.dto';

/** Body của `POST /auth/forgot-password`. Định danh là **SĐT** (cùng định danh với login). */
export class ForgotPasswordRequestDto {
  @ApiProperty({
    description:
      'SĐT đã đăng ký, dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra.',
    example: '0912345678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  /** Rejected, never stripped — see `LoginRequestDto.email`. */
  @ApiHideProperty()
  @IsAbsent(EMAIL_NOT_ACCEPTED_MESSAGE)
  email?: unknown;
}
