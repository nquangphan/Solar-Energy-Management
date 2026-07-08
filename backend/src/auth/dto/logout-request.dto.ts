import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Body của `POST /auth/logout`. */
export class LogoutRequestDto {
  @ApiProperty({ description: 'Refresh token của phiên cần thu hồi.' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
