import { SetMetadata } from '@nestjs/common';

/** Khoá metadata đánh dấu route CHỈ cần phiên hợp lệ, không quyền cụ thể. */
export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';

/**
 * `@AuthenticatedOnly()` — **tuyên bố tường minh**: route CHỈ cần phiên hợp lệ, KHÔNG
 * quyền cụ thể (self-service: đọc/sửa dữ liệu CỦA CHÍNH MÌNH).
 *
 * Runtime KHÔNG đổi hành vi — `PermissionsGuard` vốn cho qua khi thiếu
 * `@RequirePermissions`. Decorator tồn tại để source-guard
 * (`no-handler-without-require-permissions.spec.ts`) phân biệt "cố ý mở cho mọi phiên"
 * với "quên khai quyền".
 *
 * KHÔNG dùng cho route nghiệp vụ chạm dữ liệu người khác — route đó phải khai
 * `@RequirePermissions(PERM.x)`.
 */
export const AuthenticatedOnly = () =>
  SetMetadata(AUTHENTICATED_ONLY_KEY, true);
