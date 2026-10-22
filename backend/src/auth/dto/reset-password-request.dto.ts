import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { IsAbsent } from '../../customers/dto/is-absent.decorator';
import { EMAIL_NOT_ACCEPTED_MESSAGE } from './login-request.dto';
import { IsPasswordPolicy } from './password-policy';

/** Body của `POST /auth/reset-password`: mã xác thực + mật khẩu mới. */
export class ResetPasswordRequestDto {
  @ApiProperty({
    description: 'SĐT đã đăng ký (cùng số đã yêu cầu mã), dạng THÔ.',
    example: '0912345678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({
    description: 'Mã xác thực 6 chữ số đã nhận.',
    example: '000000',
  })
  @Matches(/^\d{6}$/, { message: 'Mã xác thực gồm đúng 6 chữ số.' })
  code!: string;

  @ApiProperty({
    description: 'Mật khẩu mới. Tối thiểu 8 ký tự, có chữ và số.',
    example: 'MatKhauMoi123',
  })
  @IsPasswordPolicy()
  newPassword!: string;

  /** Rejected, never stripped — see `LoginRequestDto.email`. */
  @ApiHideProperty()
  @IsAbsent(EMAIL_NOT_ACCEPTED_MESSAGE)
  email?: unknown;
}
