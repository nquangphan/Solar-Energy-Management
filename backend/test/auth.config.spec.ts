import { durationToSeconds, loadAuthConfig } from '../src/auth/auth.config';

/**
 * Unit `auth.config` — HERMETIC (không cần DB/env cố định). Phủ parser TTL
 * (`durationToSeconds`: các đơn vị hợp lệ + nhánh THROW khi định dạng sai) và
 * `loadAuthConfig` (mặc định an toàn + đọc/parse env). Đây là logic thuần dễ sai
 * lặng lẽ (secret/TTL) — Task 6 story 2.3.
 */
describe('auth.config', () => {
  describe('durationToSeconds', () => {
    it.each([
      ['15m', 900],
      ['3600s', 3600],
      ['1h', 3600],
      ['1d', 86400],
      ['0s', 0],
    ])('quy đổi "%s" → %i giây', (ttl, expected) => {
      expect(durationToSeconds(ttl)).toBe(expected);
    });

    it('trim khoảng trắng trước khi parse', () => {
      expect(durationToSeconds('  15m  ')).toBe(900);
    });

    it.each(['abc', '15x', '15', 'm', '', '1.5h', '-5m'])(
      'định dạng sai "%s" → throw',
      (bad) => {
        expect(() => durationToSeconds(bad)).toThrow(/không hợp lệ/);
      },
    );
  });

  describe('loadAuthConfig', () => {
    const original = {
      ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL,
      REFRESH_TOKEN_TTL_DAYS: process.env.REFRESH_TOKEN_TTL_DAYS,
    };

    afterEach(() => {
      // Khôi phục env để không rò trạng thái sang test khác (test độc lập).
      restore('ACCESS_TOKEN_TTL', original.ACCESS_TOKEN_TTL);
      restore('REFRESH_TOKEN_TTL_DAYS', original.REFRESH_TOKEN_TTL_DAYS);
    });

    function restore(key: string, value: string | undefined): void {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    it('không có env → mặc định an toàn (access 15m, refresh 30 ngày)', () => {
      delete process.env.ACCESS_TOKEN_TTL;
      delete process.env.REFRESH_TOKEN_TTL_DAYS;
      const config = loadAuthConfig();
      expect(config.accessTokenTtlSeconds).toBe(900);
      expect(config.refreshTokenTtlMs).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('đọc ACCESS_TOKEN_TTL + REFRESH_TOKEN_TTL_DAYS từ env', () => {
      process.env.ACCESS_TOKEN_TTL = '1h';
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      const config = loadAuthConfig();
      expect(config.accessTokenTtlSeconds).toBe(3600);
      expect(config.refreshTokenTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('ACCESS_TOKEN_TTL rỗng/khoảng trắng → mặc định 15m', () => {
      process.env.ACCESS_TOKEN_TTL = '   ';
      delete process.env.REFRESH_TOKEN_TTL_DAYS;
      expect(loadAuthConfig().accessTokenTtlSeconds).toBe(900);
    });

    it('REFRESH_TOKEN_TTL_DAYS không phải số → mặc định 30 ngày', () => {
      delete process.env.ACCESS_TOKEN_TTL;
      process.env.REFRESH_TOKEN_TTL_DAYS = 'abc';
      expect(loadAuthConfig().refreshTokenTtlMs).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });
});
