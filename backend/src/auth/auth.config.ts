/**
 * Cấu hình TTL token cho `AuthService`, đọc từ env (fail-fast secret nằm ở `main.ts`).
 * Inject qua token `AUTH_CONFIG` để `AuthService` không đọc `process.env` trực tiếp
 * (dễ test: unit test truyền thẳng config).
 */

/** DI token cho `AuthConfig`. */
export const AUTH_CONFIG = 'AUTH_CONFIG';

export interface AuthConfig {
  /**
   * TTL access token tính bằng giây — dùng cho `JwtService.signAsync({ expiresIn })`
   * VÀ trả trong `AuthTokensDto.expiresIn` (một nguồn, hai chỗ dùng khớp nhau).
   */
  accessTokenTtlSeconds: number;
  /** TTL refresh token tính bằng mili-giây (cộng vào thời điểm hiện tại → `expiresAt`). */
  refreshTokenTtlMs: number;
}

const DEFAULT_ACCESS_TTL = '15m';
const DEFAULT_REFRESH_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Đọc cấu hình TTL từ env, có mặc định an toàn (access 15m, refresh 30 ngày). */
export function loadAuthConfig(): AuthConfig {
  const accessTokenTtl =
    process.env.ACCESS_TOKEN_TTL?.trim() || DEFAULT_ACCESS_TTL;
  const refreshDays =
    Number(process.env.REFRESH_TOKEN_TTL_DAYS) || DEFAULT_REFRESH_TTL_DAYS;
  return {
    accessTokenTtlSeconds: durationToSeconds(accessTokenTtl),
    refreshTokenTtlMs: refreshDays * MS_PER_DAY,
  };
}

const DURATION = /^(\d+)(s|m|h|d)$/;
const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/** Quy đổi TTL dạng `15m`/`3600s`/`1h`/`1d` sang số giây. Ném nếu định dạng sai. */
export function durationToSeconds(ttl: string): number {
  const match = DURATION.exec(ttl.trim());
  if (!match) {
    throw new Error(
      `ACCESS_TOKEN_TTL không hợp lệ: "${ttl}" (định dạng cho phép: 15m/3600s/1h/1d)`,
    );
  }
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}
