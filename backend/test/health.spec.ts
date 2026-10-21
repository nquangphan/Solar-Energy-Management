import type { Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HealthResponseDto } from '../src/health/dto/health-response.dto';
import { ErrorCode } from '../src/common/errors/error-code';
import { initAppOnLoopback } from './util/listen-loopback';

/**
 * e2e cho `GET /health`: 200 + shape mong đợi; chứng minh controller gọi
 * `PrismaService.$queryRaw` (wiring AD-1 client→backend→Prisma).
 *
 * `PrismaService` được stub để test hermetic — KHÔNG cần PostgreSQL thật trong CI.
 * Kết nối DB thật được kiểm ở boot production qua `onModuleInit.$connect`.
 */
describe('GET /health (e2e)', () => {
  let app: INestApplication;
  const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
        $queryRaw: queryRaw,
      })
      .compile();

    app = moduleRef.createNestApplication();
    await initAppOnLoopback(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('trả 200 với shape { status, database, timestamp } và ping DB', async () => {
    const server = app.getHttpServer() as Server;
    const res = await request(server).get('/health').expect(200);
    const body = res.body as HealthResponseDto;

    expect(body).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String),
    });
    // timestamp là ISO-8601 UTC hợp lệ
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    // chứng minh wiring: controller thực sự ping DB qua Prisma
    expect(queryRaw).toHaveBeenCalled();
  });

  it('KHÔNG expose route nghiệp vụ nào ngoài /health (skeleton chỉ có hạ tầng)', async () => {
    // Chứng minh scope skeleton: chưa có domain endpoint (accounts/orders…) leak vào.
    const server = app.getHttpServer() as Server;
    await request(server).get('/accounts').expect(404);
  });
});

/**
 * Error case của AC-1: `/health` phải PHỤ THUỘC THẬT vào DB — nếu ping DB fail thì
 * endpoint KHÔNG được trả `database: 'up'`. Chứng minh health không fake trạng thái
 * (nếu Prisma reject, controller không nuốt lỗi → không báo "up" giả).
 */
describe('GET /health khi DB không kết nối được (e2e)', () => {
  let app: INestApplication;
  const queryRaw = jest.fn().mockRejectedValue(new Error('DB unreachable'));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
        $queryRaw: queryRaw,
      })
      .compile();

    app = moduleRef.createNestApplication();
    await initAppOnLoopback(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('trả envelope lỗi thống nhất (500 INTERNAL, generic, KHÔNG database:up) khi ping DB fail', async () => {
    const server = app.getHttpServer() as Server;
    const res = await request(server).get('/health');

    // Lỗi Prisma không lường trước → AllExceptionsFilter dựng envelope INTERNAL (AD-5, 2.2).
    expect(res.status).toBe(500);
    expect(res.body).not.toMatchObject({ database: 'up' });
    expect(res.body.code).toBe(ErrorCode.INTERNAL);
    expect(res.body.message).toBe('Lỗi hệ thống');
    expect(typeof res.body.traceId).toBe('string');
    // KHÔNG leak chi tiết nội bộ ("DB unreachable") ra response.
    expect(JSON.stringify(res.body)).not.toContain('DB unreachable');
    expect(queryRaw).toHaveBeenCalled();
  });
});
