/**
 * Che giá vốn theo quyền — DOMAIN THUẦN (không Nest/Prisma).
 *
 * `Product.costPrice` là dữ liệu nhạy cảm: nó lộ biên lợi nhuận. Chỉ người mang
 * `costs.view` được thấy. BẤT BIẾN AD-4: **server** phải loại field, KHÔNG "để FE tự ẩn"
 * — client nào cũng gọi thẳng API được.
 *
 * Loại HẲN key, KHÔNG set `undefined`/`0`/`null`: `undefined` vẫn là một key trong object
 * và `JSON.stringify` bỏ nó đi *tình cờ*, còn `0` là một lời nói dối — người đọc không
 * phân biệt được "không có quyền" với "giá vốn bằng 0".
 *
 * Trả bản SAO đã xoá key (không sửa `product` tại chỗ): object nguồn là bản ghi Prisma mà
 * caller còn dùng để dựng payload event — event phải giữ ĐỦ `costPrice` cho audit.
 */
export function stripCostPrice<T extends { costPrice: number }>(
  product: T,
  canViewCosts: boolean,
): T | Omit<T, 'costPrice'> {
  if (canViewCosts) return product;
  const visible = { ...product };
  delete (visible as Partial<T>).costPrice;
  return visible;
}
