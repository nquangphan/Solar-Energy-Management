import { ApiProperty } from '@nestjs/swagger';

/**
 * Response của `POST /auth/forgot-password`. Cố tình **trung tính**: chỉ một hằng số đọc
 * từ config, giống hệt nhau dù email tồn tại hay không — body khác nhau sẽ biến endpoint
 * này thành máy dò email hợp lệ.
 *
 * KHÔNG có field nào mang mã xác thực. Mã rời server qua kênh gửi (domain event), không
 * bao giờ qua response.
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    description:
      'Số giây mã xác thực còn hiệu lực. Hằng số từ config — không tiết lộ tài khoản có tồn tại hay không.',
    example: 300,
  })
  expiresInSeconds!: number;
}
