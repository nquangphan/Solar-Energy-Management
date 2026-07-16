/**
 * Thành tiền một dòng báo giá — DOMAIN THUẦN (không Nest/Prisma/EventBus).
 *
 * Tiền là INTEGER ĐỒNG (AD-10/AD-16): phép nhân số nguyên, KHÔNG làm tròn — không có sai số
 * nào để giấu. `amount` do SERVER tính và trả trong response DTO; client CHỈ hiển thị số
 * backend trả, CẤM tự nhân `unitPrice × qty` (AD-16).
 *
 * Đây là HẠT GIỐNG của hàm pricing đầy đủ (subtotal/VAT/tổng — Story 4.2, AD-16: pricing sống
 * ở `orders/domain`). 4.1 chỉ cần thành tiền từng dòng.
 */
export function lineAmount(unitPrice: number, qty: number): number {
  return unitPrice * qty;
}
