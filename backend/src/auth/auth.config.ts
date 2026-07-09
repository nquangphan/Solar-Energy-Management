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
  /**
   * Vòng đời mã đặt lại mật khẩu, tính bằng mili-giây. Cửa sổ tấn công của một mã 6 số
   * (~20 bit) — giữ ngắn. Cũng là cooldown gửi lại: còn mã sống thì không phát mã mới.
   */
  passwordResetTtlMs: number;
  /**
   * Trần số lần nhập sai một mã trước khi mã bị khoá vĩnh viễn. Chặn brute-force online:
   * 5 lần trong vòng đời mã ⇒ xác suất đoán trúng ≈ 5·10⁻⁶.
   */
  passwordResetMaxAttempts: number;
}

const DEFAULT_ACCESS_TTL = '15m';
const DEFAULT_REFRESH_TTL_DAYS = 30;
const DEFAULT_PASSWORD_RESET_TTL_MINUTES = 5;
const DEFAULT_PASSWORD_RESET_MAX_ATTEMPTS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Đọc cấu hình từ env, có mặc định an toàn (access 15m, refresh 30 ngày, mã reset 5 phút /
 * 5 lần thử). Giá trị env không hợp lệ (0, âm, không phải số) rơi về mặc định — không bao
 * giờ tạo mã sống vĩnh viễn hay trần thử bằng 0.
 */
export function loadAuthConfig(): AuthConfig {
  const accessTokenTtl =
    process.env.ACCESS_TOKEN_TTL?.trim() || DEFAULT_ACCESS_TTL;
  const refreshDays = positiveOrDefault(
    Number(process.env.REFRESH_TOKEN_TTL_DAYS),
    DEFAULT_REFRESH_TTL_DAYS,
  );
  const resetMinutes = positiveOrDefault(
    Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES),
    DEFAULT_PASSWORD_RESET_TTL_MINUTES,
  );
  const resetMaxAttempts = positiveOrDefault(
    Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS),
    DEFAULT_PASSWORD_RESET_MAX_ATTEMPTS,
  );
  return {
    accessTokenTtlSeconds: durationToSeconds(accessTokenTtl),
    refreshTokenTtlMs: refreshDays * MS_PER_DAY,
    passwordResetTtlMs: resetMinutes * MS_PER_MINUTE,
    passwordResetMaxAttempts: resetMaxAttempts,
  };
}

/** Giữ giá trị env chỉ khi là số hữu hạn > 0; ngược lại dùng mặc định. */
function positiveOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
