import { AppException } from '../common/errors/app.exception';
import type { FieldErrorDto } from '../common/errors/dto/field-error.dto';
import { ErrorCode } from '../common/errors/error-code';
import type { StockOutBlockedLine } from './domain/stock-out-blocked-event';

export const INSUFFICIENT_STOCK_MESSAGE =
  'Không đủ tồn — không thể xuất quá số tồn hiện có.';

/**
 * A stock-out refused for insufficient stock — the ONLY error that means "a stock-out was
 * blocked". It carries the refused lines (figures read under the products lock) so the
 * transaction owner can publish `StockOutBlocked` after the rollback.
 *
 * The client envelope is exactly the plain `AppException` one (409 `CONFLICT`, same message,
 * one `INSUFFICIENT_STOCK` field error per short line); `shortages` never reaches the client.
 * Not in `domain/`: it extends a Nest `HttpException`.
 */
export class InsufficientStockException extends AppException {
  constructor(
    readonly shortages: readonly StockOutBlockedLine[],
    fieldErrors: FieldErrorDto[],
  ) {
    super(ErrorCode.CONFLICT, 409, INSUFFICIENT_STOCK_MESSAGE, fieldErrors);
  }
}
