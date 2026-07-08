import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode } from './error-code';
import { AppException } from './app.exception';
import { ErrorEnvelopeDto } from './dto/error-envelope.dto';

/**
 * NƠI DUY NHẤT dựng error envelope (AD-5). `@Catch()` (không tham số) bắt MỌI exception
 * lọt tới tầng HTTP và trả về đúng một shape `ErrorEnvelopeDto`. Không controller/service
 * nào được tự nặn envelope (source-guard `no-controller-error-envelope.spec.ts` enforce).
 *
 * Ánh xạ:
 *  - `AppException` → dùng `errorCode`/`fieldErrors`/status của nó (code nghiệp vụ ném).
 *  - `HttpException` chuẩn Nest **4xx** (NotFound/Unauthorized/Forbidden/Conflict/BadRequest…)
 *    → map theo HTTP status sang `ErrorCode`, giữ status + phản chiếu message (dev soạn).
 *  - `HttpException` **5xx** (ServiceUnavailable/InternalServerError…) → xử như lỗi server:
 *    giữ status nhưng message **generic** + **log đầy đủ server-side**, KHÔNG leak message.
 *  - Lỗi KHÔNG lường trước (Error thường) → `INTERNAL` + 500 + message **generic**;
 *    KHÔNG leak stack/chi tiết nội bộ ra response, **log đầy đủ server-side** kèm traceId.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const traceId = resolveTraceId(request);

    const { status, envelope } = this.toEnvelope(exception, traceId);
    response.status(status).json(envelope);
  }

  private toEnvelope(
    exception: unknown,
    traceId: string,
  ): { status: number; envelope: ErrorEnvelopeDto } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        envelope: {
          code: exception.errorCode,
          message: exception.message,
          ...(exception.fieldErrors
            ? { fieldErrors: exception.fieldErrors }
            : {}),
          traceId,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // 5xx HttpException (InternalServerError/ServiceUnavailable…) là lỗi PHÍA SERVER:
      // đối xử như lỗi không lường trước — KHÔNG leak `message` ra response, log đầy đủ
      // server-side. Chỉ 4xx (message do dev soạn, hướng client) mới phản chiếu message.
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
          `[${traceId}] HttpException ${status}`,
          exception.stack,
        );
        return {
          status,
          envelope: {
            code: statusToErrorCode(status),
            message: GENERIC_ERROR_MESSAGE,
            traceId,
          },
        };
      }
      return {
        status,
        envelope: {
          code: statusToErrorCode(status),
          message: exception.message,
          traceId,
        },
      };
    }

    // Lỗi không lường trước: log ĐẦY ĐỦ server-side (kèm traceId để tra), trả generic.
    this.logger.error(
      `[${traceId}] Lỗi không lường trước`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      envelope: {
        code: ErrorCode.INTERNAL,
        message: GENERIC_ERROR_MESSAGE,
        traceId,
      },
    };
  }
}

/** Message generic trả cho client ở mọi lỗi server-side (5xx) — KHÔNG leak chi tiết nội bộ. */
const GENERIC_ERROR_MESSAGE = 'Lỗi hệ thống';

/** Độ dài tối đa `x-request-id` được tái dùng — chặn client bơm giá trị khổng lồ vào log/response. */
const MAX_TRACE_ID_LENGTH = 128;
/** Charset an toàn cho traceId tái dùng (id/uuid/slug). Loại ký tự lạ khỏi log + response body. */
const SAFE_TRACE_ID = /^[A-Za-z0-9._-]+$/;

/**
 * Tái dùng `x-request-id` client/proxy gửi (trace xuyên tầng) CHỈ khi hợp lệ — non-empty,
 * ≤128 ký tự, charset an toàn; ngược lại sinh UUID v4 mới. Không tin giá trị client thô:
 * chặn reflect nội dung không giới hạn/không kiểm soát vào response body và log.
 */
function resolveTraceId(request: Request | undefined): string {
  const header = request?.headers?.['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  if (
    typeof candidate === 'string' &&
    candidate.length > 0 &&
    candidate.length <= MAX_TRACE_ID_LENGTH &&
    SAFE_TRACE_ID.test(candidate)
  ) {
    return candidate;
  }
  return randomUUID();
}

/** Map HTTP status của `HttpException` chuẩn Nest sang `ErrorCode` tương ứng. */
function statusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.UNAUTHENTICATED;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCode.CONFLICT;
    default:
      return ErrorCode.INTERNAL;
  }
}
