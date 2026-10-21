import type { Server } from 'node:http';
import {
  Body,
  Controller,
  ConflictException,
  ForbiddenException,
  Get,
  HttpException,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsEmail, IsNotEmpty } from 'class-validator';
import request from 'supertest';
import { CommonModule } from '../src/common/common.module';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { initAppOnLoopback } from './util/listen-loopback';

/**
 * DTO chỉ dùng trong test để kích hoạt ValidationPipe → `fieldErrors`.
 */
class SampleBodyDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  name!: string;
}

/**
 * Controller CHỈ-TEST ném từng loại lỗi để chứng minh `AllExceptionsFilter` dựng envelope
 * thống nhất cho MỌI nhánh. KHÔNG nằm trong `src/` nên không đụng source-guard/production.
 */
@Controller('test-errors')
class TestErrorsController {
  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('Không tìm thấy tài nguyên demo');
  }

  @Get('conflict')
  conflict(): never {
    throw new AppException(ErrorCode.CONFLICT, 409, 'Xung đột demo');
  }

  @Get('unauthorized')
  unauthorized(): never {
    // HttpException chuẩn Nest (KHÔNG phải AppException): map theo status → UNAUTHENTICATED.
    throw new UnauthorizedException('Chưa xác thực demo');
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException('Không đủ quyền demo');
  }

  @Get('nest-conflict')
  nestConflict(): never {
    // ConflictException chuẩn Nest (khác nhánh AppException) cũng phải ra CONFLICT.
    throw new ConflictException('Xung đột chuẩn Nest demo');
  }

  @Get('teapot')
  teapot(): never {
    // HttpException với status KHÔNG nằm trong bảng map → giữ status, fallback INTERNAL.
    throw new HttpException('Ấm trà demo', 418);
  }

  @Get('boom')
  boom(): never {
    // Lỗi KHÔNG lường trước: message chứa "chi tiết nội bộ" nhạy cảm — filter phải nuốt.
    throw new Error('SECRET_STACK_DETAIL_khong_duoc_leak');
  }

  @Get('server-error')
  serverError(): never {
    // HttpException 5xx (lỗi PHÍA SERVER): message nhạy cảm KHÔNG được leak ra client
    // (khác 4xx — message dev soạn hướng client). Filter phải nuốt như lỗi thường.
    throw new ServiceUnavailableException('SECRET_5XX_DETAIL_khong_duoc_leak');
  }

  @Post('validate')
  validate(@Body() body: SampleBodyDto): { ok: true } {
    void body;
    return { ok: true };
  }
}

/**
 * e2e cho AC-1: mọi nhánh lỗi trả CÙNG shape envelope `{ code, message, traceId, fieldErrors? }`
 * + HTTP status chuẩn (AD-5). Hermetic — không cần DB (import `CommonModule`, không Prisma).
 */
describe('Error envelope thống nhất (e2e, AD-5)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CommonModule],
      controllers: [TestErrorsController],
    }).compile();

    app = moduleRef.createNestApplication();
    await initAppOnLoopback(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  interface Envelope {
    code: string;
    message: string;
    traceId: string;
    fieldErrors?: Array<{ field: string; code: string; message: string }>;
  }

  /** Mọi envelope phải có đủ khoá bắt buộc với kiểu đúng. */
  function expectEnvelopeShape(body: Envelope): void {
    expect(typeof body.code).toBe('string');
    expect(typeof body.message).toBe('string');
    expect(typeof body.traceId).toBe('string');
    expect(body.traceId.length).toBeGreaterThan(0);
  }

  it('NotFoundException → 404 + code NOT_FOUND + traceId', async () => {
    const res = await request(server()).get('/test-errors/not-found');
    const body = res.body as Envelope;
    expect(res.status).toBe(404);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.NOT_FOUND);
    expect(body.fieldErrors).toBeUndefined();
  });

  it('AppException(CONFLICT) → 409 + code CONFLICT', async () => {
    const res = await request(server()).get('/test-errors/conflict');
    const body = res.body as Envelope;
    expect(res.status).toBe(409);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.CONFLICT);
    expect(body.message).toBe('Xung đột demo');
  });

  it('UnauthorizedException → 401 + code UNAUTHENTICATED (map theo HTTP status)', async () => {
    const res = await request(server()).get('/test-errors/unauthorized');
    const body = res.body as Envelope;
    expect(res.status).toBe(401);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.UNAUTHENTICATED);
    expect(body.fieldErrors).toBeUndefined();
  });

  it('ForbiddenException → 403 + code FORBIDDEN (map theo HTTP status)', async () => {
    const res = await request(server()).get('/test-errors/forbidden');
    const body = res.body as Envelope;
    expect(res.status).toBe(403);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('ConflictException chuẩn Nest → 409 + code CONFLICT (nhánh HttpException, không AppException)', async () => {
    const res = await request(server()).get('/test-errors/nest-conflict');
    const body = res.body as Envelope;
    expect(res.status).toBe(409);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.CONFLICT);
  });

  it('HttpException status không map → giữ status + fallback code INTERNAL', async () => {
    const res = await request(server()).get('/test-errors/teapot');
    const body = res.body as Envelope;
    expect(res.status).toBe(418);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.INTERNAL);
  });

  it('Lỗi thường → 500 + code INTERNAL + message generic, KHÔNG leak nội bộ', async () => {
    const res = await request(server()).get('/test-errors/boom');
    const body = res.body as Envelope;
    expect(res.status).toBe(500);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.INTERNAL);
    expect(body.message).toBe('Lỗi hệ thống');
    // AN TOÀN: không leak stack/chi tiết nội bộ ra response.
    expect(JSON.stringify(body)).not.toContain('SECRET_STACK_DETAIL');
  });

  it('HttpException 5xx → giữ status + code INTERNAL + message generic, KHÔNG leak message nội bộ', async () => {
    const res = await request(server()).get('/test-errors/server-error');
    const body = res.body as Envelope;
    expect(res.status).toBe(503);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.INTERNAL);
    expect(body.message).toBe('Lỗi hệ thống');
    // AN TOÀN: message của 5xx HttpException KHÔNG được phản chiếu ra response.
    expect(JSON.stringify(body)).not.toContain('SECRET_5XX_DETAIL');
  });

  it('Body sai DTO → 400 + code VALIDATION_ERROR + fieldErrors[{field,code,message}]', async () => {
    const res = await request(server())
      .post('/test-errors/validate')
      .send({ email: 'không-phải-email', name: '' });
    const body = res.body as Envelope;

    expect(res.status).toBe(400);
    expectEnvelopeShape(body);
    expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(Array.isArray(body.fieldErrors)).toBe(true);

    const fieldErrors = body.fieldErrors ?? [];
    expect(fieldErrors.map((fe) => fe.field)).toEqual(
      expect.arrayContaining(['email', 'name']),
    );
    for (const fe of fieldErrors) {
      expect(typeof fe.field).toBe('string');
      expect(typeof fe.code).toBe('string');
      expect(typeof fe.message).toBe('string');
    }
    // The screen shows these under the inputs: Vietnamese, not class-validator's English defaults.
    expect(fieldErrors.find((fe) => fe.field === 'email')?.message).toBe(
      'Email không hợp lệ.',
    );
    expect(fieldErrors.find((fe) => fe.field === 'name')?.message).toBe(
      'Không được để trống.',
    );
  });

  it('traceId tái dùng header x-request-id nếu client/proxy gửi (trace xuyên tầng)', async () => {
    const requestId = 'req-id-tu-proxy-1234';
    const res = await request(server())
      .get('/test-errors/not-found')
      .set('x-request-id', requestId);
    const body = res.body as Envelope;
    expect(res.status).toBe(404);
    // Open Question #2: filter phản chiếu x-request-id vào traceId để tra log xuyên tầng.
    expect(body.traceId).toBe(requestId);
  });

  it('traceId KHÔNG tái dùng x-request-id không hợp lệ (ký tự lạ) → sinh UUID mới', async () => {
    // Client gửi giá trị có ký tự ngoài charset an toàn → filter bỏ, sinh traceId sạch.
    const res = await request(server())
      .get('/test-errors/not-found')
      .set('x-request-id', 'bad id\twith spaces & symbols');
    const body = res.body as Envelope;
    expect(res.status).toBe(404);
    expect(body.traceId).not.toBe('bad id\twith spaces & symbols');
    expect(body.traceId.length).toBeGreaterThan(0);
  });

  it('traceId tự sinh (UUID v4) khi không có x-request-id — không rỗng, khác nhau mỗi request', async () => {
    const [a, b] = await Promise.all([
      request(server()).get('/test-errors/not-found'),
      request(server()).get('/test-errors/not-found'),
    ]);
    const ta = (a.body as Envelope).traceId;
    const tb = (b.body as Envelope).traceId;
    expect(ta.length).toBeGreaterThan(0);
    expect(tb.length).toBeGreaterThan(0);
    // Hai request không header → hai traceId sinh mới khác nhau (không hằng số cứng).
    expect(ta).not.toBe(tb);
  });
});
