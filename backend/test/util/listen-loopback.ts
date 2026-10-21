import type { INestApplication } from '@nestjs/common';

/**
 * Khởi app e2e và bind SẴN một cổng trên `127.0.0.1` (thay cho `app.init()`).
 *
 * Nếu không, `supertest(app.getHttpServer())` tự gọi `server.listen(0)` cho MỖI request ⇒ Node
 * bind wildcard `::` cổng ephemeral, còn client gọi `127.0.0.1:<cổng>`. Trên macOS, một tiến
 * trình khác trên máy (VS Code helper, dev server…) đang nghe riêng `127.0.0.1:<cổng đó>` không
 * làm bind wildcard thất bại, và kết nối loopback ưu tiên listener cụ thể ⇒ request của test rơi
 * vào tiến trình lạ (404/401/403 sai, `socket hang up`). Jest chạy song song nhiều worker nên
 * số lần bind lớn và lỗi chỉ xuất hiện thỉnh thoảng. Bind một lần đúng `127.0.0.1` thì kernel
 * chỉ chọn cổng còn trống trên đúng địa chỉ client gọi; supertest thấy server đã nghe và dùng lại.
 * `app.close()` ở `afterAll` đóng server như cũ.
 */
export async function initAppOnLoopback(app: INestApplication): Promise<void> {
  await app.listen(0, '127.0.0.1');
}
