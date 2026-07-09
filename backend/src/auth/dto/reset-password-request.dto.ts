import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';
import { IsPasswordPolicy } from './password-policy';

/** Body của `POST /auth/reset-password`: mã xác thực + mật khẩu mới. */
export class ResetPasswordRequestDto {
  @ApiProperty({
    description: 'Email đã đăng ký (cùng email đã yêu cầu mã).',
    example: 'admin@example.com',
  })
  @IsEmail()
  email!: string;

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
}
