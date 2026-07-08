import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Body của `POST /auth/refresh`. */
export class RefreshRequestDto {
  @ApiProperty({
    description: 'Refresh token đã cấp lúc đăng nhập/refresh trước.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
