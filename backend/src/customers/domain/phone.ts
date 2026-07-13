import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Chuẩn hoá SĐT Việt Nam về E.164 (`+84…`) — DOMAIN THUẦN: không Nest, không Prisma.
 *
 * Đây là hàm DUY NHẤT của hệ thống biết cách biến SĐT thô thành khoá chính của `Customer`
 * (AD-9). Story 3.4 (tra SĐT chọn/tạo khách inline) `import` CHÍNH hàm này — không viết bản
 * thứ hai: hai chỗ chuẩn hoá là hai cơ hội lệch nhau, và lệch ở đây nghĩa là hai bản ghi cho
 * cùng một người. Client (web/mobile) gửi chuỗi THÔ và không bao giờ tự chuẩn hoá.
 *
 * Dùng `libphonenumber-js` thay vì regex tự viết: kế hoạch đánh số VN có bẫy thật (chuyển đổi
 * đầu số 2018, số cố định 10 chữ số có mã vùng dài ngắn khác nhau). Một regex "10 chữ số bắt
 * đầu bằng 0" sẽ từ chối oan số cố định hợp lệ — loại số mà khách Thương mại hay dùng.
 *
 * Trả `null` khi không phân giải được (rác, số ngoài VN, rỗng); tầng gọi dịch `null` thành
 * 400 `VALIDATION_ERROR` — KHÔNG để chuỗi rác đi tiếp xuống DB làm khoá chính.
 */
export function normalizeVnPhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  // Bỏ mọi ký tự trình bày người dùng hay gõ (`0912 345 678`, `0912.345.678`, `(028) 3822…`).
  const compact = raw.replace(/[\s.\-()]/g, '');
  if (compact === '') return null;

  // Không có `+` mà đã mang mã quốc gia (`84912345678`) ⇒ thêm `+`, vì số nội địa VN luôn bắt
  // đầu bằng `0`; thiếu bước này thư viện đọc `84…` như số nội địa và từ chối.
  const candidate =
    !compact.startsWith('+') && compact.startsWith('84')
      ? `+${compact}`
      : compact;

  const parsed = parsePhoneNumberFromString(candidate, 'VN');
  if (parsed === undefined || !parsed.isValid() || parsed.country !== 'VN') {
    return null;
  }
  return parsed.number;
}
