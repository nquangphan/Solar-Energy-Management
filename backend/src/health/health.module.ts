import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * HealthModule — chỉ khai controller `GET /health`. PrismaService được inject từ
 * `PrismaModule` (`@Global`), không cần import lại ở đây.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
