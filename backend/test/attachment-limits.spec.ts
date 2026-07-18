import {
  KICH_THUOC_TOI_DA_BYTE,
  MIME_CHO_PHEP,
  SO_ANH_TOI_DA,
  duoiTuMime,
  kiemTraAnh,
  tenFileAnToan,
  type AnhTaiLen,
} from '../src/orders/domain/attachment-limits';

/**
 * Unit DOMAIN THUẦN — giới hạn upload ảnh đính kèm (Story 5.5, AC-9). Spine để ngỏ con số
 * (`#Deferred`), story chốt: 10 ảnh × 10 MB, mime `jpeg|png|webp|heic`.
 *
 * Đây là lớp chặn TRƯỚC khi chạm R2: sai một điều kiện ⇒ 400 và transition KHÔNG chạy.
 */
describe('attachment-limits (domain thuần)', () => {
  function anh(ghiDe: Partial<AnhTaiLen> = {}): AnhTaiLen {
    return {
      originalname: 'bang-chung.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      ...ghiDe,
    };
  }

  it('không ảnh nào ⇒ hợp lệ (upload LUÔN optional — FR-23)', () => {
    expect(kiemTraAnh([])).toEqual([]);
  });

  it('đúng ngưỡng số lượng vẫn hợp lệ', () => {
    expect(kiemTraAnh(Array.from({ length: SO_ANH_TOI_DA }, () => anh()))).toEqual(
      [],
    );
  });

  it('quá số ảnh tối đa ⇒ fieldError trên `anh`', () => {
    const loi = kiemTraAnh(
      Array.from({ length: SO_ANH_TOI_DA + 1 }, () => anh()),
    );
    expect(loi).toHaveLength(1);
    expect(loi[0].field).toBe('anh');
    expect(loi[0].code).toBe('maxCount');
  });

  it('đúng ngưỡng dung lượng vẫn hợp lệ; hơn một byte là hỏng', () => {
    expect(kiemTraAnh([anh({ size: KICH_THUOC_TOI_DA_BYTE })])).toEqual([]);
    const loi = kiemTraAnh([anh({ size: KICH_THUOC_TOI_DA_BYTE + 1 })]);
    expect(loi).toHaveLength(1);
    expect(loi[0].code).toBe('maxSize');
  });

  it('mime ngoài allow-list ⇒ fieldError `mimeType`, kể cả khi đuôi file trông như ảnh', () => {
    const loi = kiemTraAnh([
      anh({ originalname: 'ke-hoach.jpg', mimetype: 'application/pdf' }),
    ]);
    expect(loi).toHaveLength(1);
    expect(loi[0].code).toBe('mimeType');
  });

  it.each(Object.keys(MIME_CHO_PHEP))('mime %s được nhận', (mime) => {
    expect(kiemTraAnh([anh({ mimetype: mime })])).toEqual([]);
  });

  it('nhiều ảnh sai ⇒ mỗi ảnh một fieldError, chỉ đúng index của nó', () => {
    const loi = kiemTraAnh([
      anh(),
      anh({ mimetype: 'text/plain' }),
      anh({ size: KICH_THUOC_TOI_DA_BYTE + 1 }),
    ]);
    expect(loi.map((l) => l.field)).toEqual(['anh[1]', 'anh[2]']);
  });

  it('ĐUÔI SUY TỪ MIME, KHÔNG tin đuôi client gửi — file .exe khai image/png ra key .png', () => {
    expect(duoiTuMime('image/png')).toBe('png');
    expect(duoiTuMime('image/jpeg')).toBe('jpg');
    expect(duoiTuMime('image/webp')).toBe('webp');
    expect(duoiTuMime('image/heic')).toBe('heic');
  });

  /**
   * Tên thuộc `Object.prototype` KHÔNG phải mime hợp lệ. Tra allow-list bằng `obj[key]`
   * trần sẽ nhận về thuộc tính KẾ THỪA (một hàm) thay vì `undefined`, và mọi kiểm tra
   * "có trong bảng không" viết theo kiểu đó đều gật đầu cho `Content-Type: constructor`.
   * Client đặt được header này cho từng phần multipart, nên đây là đường đi thật.
   */
  it('mime trùng tên thuộc tính kế thừa của Object KHÔNG được coi là hợp lệ', () => {
    for (const mime of [
      'constructor',
      'toString',
      'valueOf',
      '__proto__',
      'hasOwnProperty',
    ]) {
      expect(kiemTraAnh([anh({ mimetype: mime })])).toHaveLength(1);
      // Đuôi phải là chuỗi lưới-an-toàn, không phải mã nguồn của một hàm.
      expect(duoiTuMime(mime)).toBe('bin');
    }
  });

  /**
   * `originalname` do client đặt và nó chảy vào `Content-Disposition` ở đường ĐỌC. Nháy kép
   * cắt được chuỗi filename của header; CR/LF/NUL làm Node ném lúc set header ⇒ một file đặt
   * tên hiểm lúc upload giết luôn lần tải về sau.
   */
  it('tên file client gửi được dọn trước khi vào header Content-Disposition', () => {
    expect(tenFileAnToan('bang-chung.jpg')).toBe('bang-chung.jpg');
    // Giữ nguyên tiếng Việt có dấu và khoảng trắng — chỉ ký tự hiểm bị thay.
    expect(tenFileAnToan('ảnh bằng chứng.jpg')).toBe('ảnh bằng chứng.jpg');
    expect(tenFileAnToan('a"; filename="b.exe')).toBe('a_; filename=_b.exe');
    expect(tenFileAnToan('a\r\nX-Injected: 1')).toBe('a__X-Injected: 1');
    expect(tenFileAnToan('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(tenFileAnToan('   ')).toBe('anh');
    expect(tenFileAnToan('x'.repeat(500))).toHaveLength(200);
  });

  it('MUTATION GUARD: allow-list là nguồn chân lý — mọi mime ngoài `MIME_CHO_PHEP` bị từ chối', () => {
    const ngoaiDanhSach = [
      'application/pdf',
      'image/gif',
      'image/svg+xml',
      'text/html',
      'application/octet-stream',
    ];
    for (const mime of ngoaiDanhSach) {
      expect(Object.keys(MIME_CHO_PHEP)).not.toContain(mime);
      expect(kiemTraAnh([anh({ mimetype: mime })])).toHaveLength(1);
    }
  });
});
