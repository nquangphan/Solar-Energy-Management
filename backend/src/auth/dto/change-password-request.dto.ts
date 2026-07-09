import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsPasswordPolicy } from './password-policy';

/**
 * Body của `POST /auth/change-password` (tự đổi mật khẩu, cần phiên hợp lệ). `accountId`
 * KHÔNG nằm trong body — nó đến từ access token qua `@CurrentAccount()`, nếu không ai
 * cũng đổi được mật khẩu của người khác.
 */
export class ChangePasswordRequestDto {
  @ApiProperty({
    description:
      'Mật khẩu hiện tại — bắt buộc để một phiên bị chiếm không tự đổi được.',
    example: 'MatKhauCu123',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    description:
      'Mật khẩu mới. Tối thiểu 8 ký tự, có chữ và số. Phải khác mật khẩu hiện tại.',
    example: 'MatKhauMoi456',
  })
  @IsPasswordPolicy()
  newPassword!: string;
}
