import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule — `@Global` để mọi module domain sau inject CÙNG MỘT `PrismaService`
 * instance mà không phải import lại (một nguồn kết nối DB duy nhất, AD-1).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
