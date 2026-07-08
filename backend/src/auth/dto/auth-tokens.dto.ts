import { ApiProperty } from '@nestjs/swagger';

/**
 * Phản hồi của `POST /auth/login` và `POST /auth/refresh`. CHỈ chứa token + TTL —
 * KHÔNG chứa `passwordHash` hay bất kỳ field account nhạy cảm nào (chống leak).
 */
export class AuthTokensDto {
  @ApiProperty({
    description:
      'JWT access token ngắn hạn (stateless; guard Story 2.5 verify).',
  })
  accessToken!: string;

  @ApiProperty({
    description:
      'Refresh token opaque — gửi tới POST /auth/refresh để lấy access token mới (rotate).',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Số giây access token còn hiệu lực.',
    example: 900,
  })
  expiresIn!: number;
}
