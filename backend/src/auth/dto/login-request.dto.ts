import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Body của `POST /auth/login`. `@ApiProperty` để OpenAPI có schema thật; class-validator
 * để ValidationPipe (2.2) tự trả `400 VALIDATION_ERROR` + `fieldErrors` khi body sai.
 */
export class LoginRequestDto {
  @ApiProperty({
    description: 'Email đăng nhập.',
    example: 'admin@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Mật khẩu.', example: 'MatKhauManh!23' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
