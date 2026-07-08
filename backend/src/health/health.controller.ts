import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';
import { HealthResponseDto } from './dto/health-response.dto';

/**
 * Health endpoint hạ tầng (không phải resource nghiệp vụ) — vì vậy `GET /health`
 * hợp lệ, không vi phạm quy ước "route là danh từ số nhiều".
 *
 * Ping DB qua `PrismaService.$queryRaw` để chứng minh chuỗi wiring AD-1
 * (client → backend → Prisma → PostgreSQL) hoạt động end-to-end ngay từ story đầu.
 *
 * `@Public()` opt-out guard toàn cục fail-closed (2.5): probe hạ tầng phải mở, không
 * đòi access token. Quên ⇒ e2e `health.spec.ts` fail 401.
 */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({
    description: 'Backend còn sống và kết nối được DB.',
    type: HealthResponseDto,
  })
  async check(): Promise<HealthResponseDto> {
    // `SELECT 1` là ping rẻ nhất chứng minh kết nối DB — không cần bảng nào.
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
