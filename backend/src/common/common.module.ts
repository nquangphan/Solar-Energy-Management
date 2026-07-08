import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';
import { createValidationPipe } from './validation/validation-pipe.factory';

/**
 * Tầng API dùng chung (AD-4). Đăng ký global filter/pipe qua DI token (`APP_FILTER`,
 * `APP_PIPE`) thay vì `main.ts.useGlobalFilters/Pipes` để:
 *  - Filter được DI (inject `Logger`) — Open Question #3 chốt `APP_FILTER`.
 *  - Tự áp cho MỌI app-context (runtime, OpenAPI gen, e2e test) khi `AppModule` import
 *    module này → runtime và test luôn cùng filter/pipe, không lệch (mối lo Task 4).
 *
 * Story sau thêm guard quyền/interceptor vào `common/` sẽ đăng ký cùng chỗ này.
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useValue: createValidationPipe() },
  ],
})
export class CommonModule {}
