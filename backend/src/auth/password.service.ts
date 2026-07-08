import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Băm/kiểm mật khẩu người dùng bằng **argon2id** (OWASP ưu tiên cho mật khẩu entropy
 * thấp). Dùng ở seed (tạo account) + login (verify). KHÔNG tự cài thuật toán băm,
 * KHÔNG log mật khẩu thô/hash.
 *
 * (Refresh token entropy cao được băm SHA-256 tất định ở `AuthService` — KHÔNG dùng
 * service này; xem chú thích ở đó để hiểu vì sao khác nhau.)
 */
@Injectable()
export class PasswordService {
  /** Băm mật khẩu thô → chuỗi argon2id (đã kèm salt + tham số). */
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /**
   * Kiểm mật khẩu thô với hash đã lưu. Trả `false` (không ném) nếu hash lỗi định dạng
   * — cho phép "verify giả" (dummy hash) khi account không tồn tại mà vẫn an toàn.
   */
  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false);
  }
}
