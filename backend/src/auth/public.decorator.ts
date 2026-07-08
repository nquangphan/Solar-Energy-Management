import { SetMetadata } from '@nestjs/common';

/** Khoá metadata đánh dấu route KHÔNG cần xác thực (opt-out của guard toàn cục). */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * `@Public()` — miễn cả hai guard toàn cục (`JwtAuthGuard`/`PermissionsGuard`) cho route.
 *
 * Guard đăng ký fail-closed qua `APP_GUARD`: MỌI endpoint mặc định cần access JWT. Chỉ
 * route hạ-tầng-công-khai (`/health`, `/auth/login|refresh|logout`) mới `@Public` — KHÔNG
 * thể đòi token trước khi đăng nhập. Đừng dùng `@Public` cho route nghiệp vụ (AD-4).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
