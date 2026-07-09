import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Body của `POST /auth/forgot-password`. Định danh là **email** — `Account` chưa có cột
 * số điện thoại (cột đó thuộc Epic 8/FR-16).
 */
export class ForgotPasswordRequestDto {
  @ApiProperty({
    description: 'Email đã đăng ký của tài khoản cần đặt lại mật khẩu.',
    example: 'admin@example.com',
  })
  @IsEmail()
  email!: string;
}
