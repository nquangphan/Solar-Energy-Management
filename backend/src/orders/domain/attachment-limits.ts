/**
 * GIỚI HẠN UPLOAD ẢNH ĐÍNH KÈM — DOMAIN THUẦN: không import Nest/Prisma, không async, không
 * side effect (unit-test được không cần mock).
 *
 * Spine để ngỏ con số (`ARCHITECTURE-SPINE.md#Deferred`: "giới hạn định dạng/dung lượng ảnh…
 * để lại cho implementation") ⇒ Story 5.5 chốt tại đây, MỘT chỗ, để cả interceptor lẫn
 * service đọc cùng con số.
 *
 * ⚠️ CHỈ validate mime KHAI BÁO + kích thước. KHÔNG sniff magic-byte, KHÔNG quét virus — nợ
 * kỹ thuật ghi nhận có chủ đích: bucket không public và mọi byte ra vào đều sau JWT +
 * permission + phạm vi đơn, nên bán kính nổ nhỏ.
 */

/** Tối đa 10 ảnh cho MỘT lượt tải lên (chuyển trạng thái hoặc thêm ảnh bổ sung). */
export const SO_ANH_TOI_DA = 10;

/** Tối đa 10 MB cho MỘT ảnh. */
export const KICH_THUOC_TOI_DA_BYTE = 10 * 1024 * 1024;

/**
 * Allow-list mime → đuôi file. `heic` có mặt vì iPhone chụp mặc định ra định dạng đó; thiếu
 * nó là chặn đúng nhóm người dùng chụp bằng chứng ngoài công trường.
 *
 * Bảng này KIÊM nguồn suy đuôi cho object key — đuôi client gửi KHÔNG được tin.
 */
export const MIME_CHO_PHEP: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** Một file nhận từ transport — chỉ ba trường domain cần biết (khuôn `Express.Multer.File`). */
export interface AnhTaiLen {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
}

/** Một lỗi cấp field — shape của `FieldErrorDto`, khai lại ở domain để không import Nest. */
export interface LoiField {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/**
 * Mime này có THẬT SỰ nằm trong allow-list không?
 *
 * ⚠️ Phải hỏi bằng `hasOwnProperty`, KHÔNG bằng `MIME_CHO_PHEP[mime] !== undefined`: object
 * literal kế thừa `Object.prototype`, nên tra trần với `constructor`/`toString`/`valueOf`/
 * `__proto__` trả về một HÀM (khác `undefined`) và allow-list gật đầu cho thứ không phải
 * ảnh. Client đặt được `Content-Type` cho từng phần multipart ⇒ đây là đường đi thật, không
 * phải giả thuyết.
 */
function coTrongAllowList(mimetype: string): boolean {
  return Object.prototype.hasOwnProperty.call(MIME_CHO_PHEP, mimetype);
}

/**
 * Đuôi file suy TỪ MIME đã qua allow-list. Gọi sau `kiemTraAnh()` — mime ngoài bảng đã bị
 * chặn ở đó, nên nhánh `bin` chỉ là lưới an toàn cho lập trình viên gọi sai thứ tự.
 */
export function duoiTuMime(mimetype: string): string {
  return coTrongAllowList(mimetype) ? MIME_CHO_PHEP[mimetype] : 'bin';
}

/**
 * Tên file AN TOÀN để đặt vào `Content-Disposition` khi trả bytes về sau.
 *
 * `originalname` do client đặt: nháy kép cắt được chuỗi filename của header, còn ký tự điều
 * khiển (CR/LF/NUL) làm Node ném khi set header ⇒ 500 ở đường ĐỌC, tức một file hỏng lúc
 * upload giết luôn lần tải sau. Tiền lệ `QuoteExport` không gặp chuyện này vì tên của nó do
 * server sinh; đường này nhận tên từ người dùng nên phải tự dọn.
 *
 * Chỉ dọn ký tự nguy hiểm cho header và dấu tách đường dẫn — giữ nguyên tiếng Việt có dấu.
 */
export function tenFileAnToan(originalname: string): string {
  const sach = originalname
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f"\\\/]/g, '_')
    .trim();
  return sach.length === 0 ? 'anh' : sach.slice(0, 200);
}

/**
 * Bộ ảnh này có hợp lệ không? Trả về DANH SÁCH lỗi (rỗng = hợp lệ) chứ không ném — service
 * mới là chỗ ném `AppException`, vì domain không được biết HTTP status nào (AD-5).
 *
 * MẢNG RỖNG LÀ HỢP LỆ: upload luôn optional (FR-23, UX-DR-25) — chuyển trạng thái không kèm
 * ảnh là đường đi bình thường nhất, không phải ngoại lệ.
 *
 * Lỗi số lượng báo trên `anh`; lỗi của từng ảnh báo trên `anh[i]` để FE tô đúng thumbnail.
 */
export function kiemTraAnh(files: readonly AnhTaiLen[]): readonly LoiField[] {
  if (files.length > SO_ANH_TOI_DA) {
    return [
      {
        field: 'anh',
        code: 'maxCount',
        message: `Tối đa ${SO_ANH_TOI_DA} ảnh cho một lần tải lên.`,
      },
    ];
  }

  const loi: LoiField[] = [];
  files.forEach((file, i) => {
    if (!coTrongAllowList(file.mimetype)) {
      loi.push({
        field: `anh[${i}]`,
        code: 'mimeType',
        message: `Chỉ nhận ảnh ${Object.keys(MIME_CHO_PHEP).join(', ')}.`,
      });
      return;
    }
    if (file.size > KICH_THUOC_TOI_DA_BYTE) {
      loi.push({
        field: `anh[${i}]`,
        code: 'maxSize',
        message: `Mỗi ảnh tối đa ${KICH_THUOC_TOI_DA_BYTE / (1024 * 1024)} MB.`,
      });
    }
  });
  return loi;
}
