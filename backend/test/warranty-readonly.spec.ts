import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Bảo hành là tính năng CHỈ ĐỌC: hệ thống trả lời "còn hạn tới bao giờ", nó không nhận phiếu
 * yêu cầu bảo hành và không giữ vòng đời bảo hành nào.
 *
 * Bất biến phát biểu theo ĐỘNG TỪ, không theo sự vắng mặt: đường tra cứu tồn tại và mang chữ
 * `bao-hanh` trong path, nên "không route nào nhắc bao-hanh" sẽ đỏ ngay trên chính tính năng
 * nó bảo vệ. Thứ phải giữ là: mọi route bảo hành đều là `@Get`, và không có bảng nào ghi
 * trạng thái bảo hành.
 */
describe('bảo hành là tính năng chỉ đọc', () => {
  const CONTROLLER = resolve(__dirname, '../src/orders/orders.controller.ts');
  const SCHEMA = resolve(__dirname, '../prisma/schema.prisma');

  it('mọi route có `bao-hanh` trong path đều là @Get', () => {
    // KHÔNG dùng `stripToCode` ở đây: nó xoá nguyên string literal, mà route path CHÍNH LÀ
    // string literal — quét bản đã strip là quét một tập rỗng và luôn xanh.
    const code = readFileSync(CONTROLLER, 'utf8');
    const routes = [
      ...code.matchAll(/@(Get|Post|Patch|Put|Delete)\(\s*'([^']*)'/g),
    ];
    const baoHanh = routes.filter(([, , path]) => path.includes('bao-hanh'));

    // Chính tính năng của story phải có mặt — nếu không, guard đang canh một tập rỗng.
    expect(baoHanh.length).toBeGreaterThan(0);
    expect(baoHanh.map(([, verb]) => verb)).toEqual(baoHanh.map(() => 'Get'));
  });

  it('không model nào lưu trạng thái bảo hành (bảo hành suy ra từ dòng vật tư)', () => {
    const schema = readFileSync(SCHEMA, 'utf8');
    expect(schema).not.toMatch(/^model Warranty/m);
  });
});
