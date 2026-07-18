import { PERM } from '../src/accounts/domain/permission-registry';
import {
  ALLOWED_TRANSITIONS,
  SU_KIEN,
  buocVongDoi,
  daTaiDich,
  evaluateTransition,
  type OrderScopeFlags,
} from '../src/orders/domain/allowed-transition';
import { type OrderStatusKey } from '../src/orders/domain/order-status';

/**
 * Unit DOMAIN THUẦN — không mock gì (hàm không async, không side effect). Bảng chuyển trạng
 * thái + `evaluateTransition()` là "nơi duy nhất đánh giá guard" (AD-11); test này canh CẢ
 * kết quả LẪN THỨ TỰ đánh giá.
 *
 * Thứ tự (1) bảng → (2) cờ phạm vi → (3) permission là một quyết định BẢO MẬT, không phải
 * gu thẩm mỹ: trả `permission` trước `not_in_table` sẽ nói cho actor thiếu quyền biết đơn
 * đang ở trạng thái nào.
 */
describe('allowed-transition (domain thuần)', () => {
  /** Cả 3 cờ bật — dùng cho mọi case không xoay quanh cờ phạm vi. */
  const DU_CO: OrderScopeFlags = {
    thietBi: true,
    thiCong: true,
    vanChuyen: true,
  };

  /** Actor có mọi quyền — dùng cho mọi case không xoay quanh permission. */
  const TOAN_QUYEN: ReadonlySet<string> = new Set(
    ALLOWED_TRANSITIONS.map((rule) => rule.requires),
  );

  function danhGia(input: {
    status: string;
    event: (typeof SU_KIEN)[keyof typeof SU_KIEN];
    permissions?: ReadonlySet<string>;
    scopeFlags?: OrderScopeFlags;
  }) {
    return evaluateTransition({
      order: { status: input.status },
      event: input.event,
      actorPermissions: input.permissions ?? TOAN_QUYEN,
      scopeFlags: input.scopeFlags ?? DU_CO,
    });
  }

  describe('mỗi cặp hợp lệ trong bảng đều đi qua', () => {
    it.each(
      ALLOWED_TRANSITIONS.map((rule) => [rule.from, rule.event, rule.to]),
    )('%s --%s--> %s', (from, event, to) => {
      expect(
        danhGia({
          status: from as string,
          event: event as (typeof SU_KIEN)[keyof typeof SU_KIEN],
        }),
      ).toEqual({ ok: true, to });
    });
  });

  it('cặp from→event KHÔNG có trong bảng ⇒ not_in_table', () => {
    // `huy` là trạng thái kết thúc — không chốt lại được từ đó.
    expect(danhGia({ status: 'huy', event: SU_KIEN.chot })).toEqual({
      ok: false,
      reason: 'not_in_table',
    });
  });

  it('cờ phạm vi TẮT ⇒ scope (dù có đủ quyền)', () => {
    expect(
      danhGia({
        status: 'dacoc',
        event: SU_KIEN.batDauThiCong,
        scopeFlags: { thietBi: true, thiCong: false, vanChuyen: true },
      }),
    ).toEqual({ ok: false, reason: 'scope' });
  });

  it('thiếu permission ⇒ permission (dù cặp có trong bảng và cờ bật)', () => {
    expect(
      danhGia({
        status: 'baogia',
        event: SU_KIEN.chot,
        permissions: new Set([PERM.quotesCreateEdit]),
      }),
    ).toEqual({ ok: false, reason: 'permission' });
  });

  it('THỨ TỰ: thiếu cả quyền LẪN không có trong bảng ⇒ not_in_table (không lộ trạng thái)', () => {
    expect(
      danhGia({
        status: 'huy',
        event: SU_KIEN.chot,
        permissions: new Set(),
      }),
    ).toEqual({ ok: false, reason: 'not_in_table' });
  });

  it('THỨ TỰ: cờ tắt VÀ thiếu quyền ⇒ scope (cờ phạm vi đánh giá trước permission)', () => {
    expect(
      danhGia({
        status: 'dacoc',
        event: SU_KIEN.batDauThiCong,
        permissions: new Set(),
        scopeFlags: { thietBi: true, thiCong: false, vanChuyen: true },
      }),
    ).toEqual({ ok: false, reason: 'scope' });
  });

  it('chốt hợp lệ từ CẢ baogia LẪN choduyet — cùng một sự kiện, hai dòng bảng', () => {
    expect(danhGia({ status: 'baogia', event: SU_KIEN.chot })).toEqual({
      ok: true,
      to: 'dachot',
    });
    expect(danhGia({ status: 'choduyet', event: SU_KIEN.chot })).toEqual({
      ok: true,
      to: 'dachot',
    });
  });

  describe('bảng là hợp đồng — cấu trúc phải bất biến', () => {
    it('không có hai dòng trùng cặp (from, event) — nếu trùng thì `to` mơ hồ', () => {
      const cap = ALLOWED_TRANSITIONS.map(
        (rule) => `${rule.from}|${rule.event}`,
      );
      expect(new Set(cap).size).toBe(cap.length);
    });

    it('bốn transition ĐANG CHẠY trong production-code đều có mặt', () => {
      const co = (from: string, event: string, to: string) =>
        ALLOWED_TRANSITIONS.some(
          (rule) =>
            rule.from === from && rule.event === event && rule.to === to,
        );
      expect(co('baogia', SU_KIEN.chot, 'dachot')).toBe(true);
      expect(co('choduyet', SU_KIEN.chot, 'dachot')).toBe(true);
      expect(co('dachot', SU_KIEN.moLai, 'baogia')).toBe(true);
      expect(co('baogia', SU_KIEN.apChietKhau, 'choduyet')).toBe(true);
      expect(co('choduyet', SU_KIEN.tuChoiChietKhau, 'baogia')).toBe(true);
    });

    it('mỗi dòng yêu cầu một permission key CÓ THẬT trong registry', () => {
      const hopLe = new Set<string>(Object.values(PERM));
      for (const rule of ALLOWED_TRANSITIONS) {
        expect(hopLe.has(rule.requires)).toBe(true);
      }
    });

    /**
     * KHÔNG ĐƯỢC CÓ NGÕ CỤT. Một đơn đi vào trạng thái nào cũng phải còn đường ra tới một
     * trạng thái kết thúc, VỚI ĐÚNG bộ cờ phạm vi đã đưa nó vào đó — cờ của đơn không đổi
     * giữa chừng. Ngõ cụt = đơn kẹt vĩnh viễn, không đóng được cũng không huỷ được, và không
     * một test call-site đơn lẻ nào nhìn thấy vì nó là thuộc tính của CẢ bảng.
     *
     * Bẫy đã cắn một lần: gate bước RA bằng một cờ khác cờ của bước VÀO (`danggiao → dagiao`
     * từng đòi cờ Thiết bị trong khi vào `danggiao` chỉ đòi Vận chuyển).
     */
    it('không trạng thái nào là ngõ cụt — mọi đơn tới được trạng thái kết thúc', () => {
      const KET_THUC = new Set<string>(['hoanthanh', 'huy']);
      const boCoKhaDi: OrderScopeFlags[] = [];
      for (const thietBi of [false, true]) {
        for (const thiCong of [false, true]) {
          for (const vanChuyen of [false, true]) {
            if (thietBi || thiCong || vanChuyen) {
              boCoKhaDi.push({ thietBi, thiCong, vanChuyen });
            }
          }
        }
      }

      const ketCuc: string[] = [];
      for (const scopeFlags of boCoKhaDi) {
        // Đi được với bộ cờ này? (bỏ qua permission — quyền là chuyện của actor, không phải
        // của hình dạng vòng đời.)
        const diDuoc = (rule: (typeof ALLOWED_TRANSITIONS)[number]) =>
          rule.scopeGuard === undefined || scopeFlags[rule.scopeGuard];

        // Loang từ `baogia` để biết đơn với bộ cờ này thực sự tới được những đâu.
        const toiDuoc = new Set<string>(['baogia']);
        for (let doi = true; doi;) {
          doi = false;
          for (const rule of ALLOWED_TRANSITIONS) {
            if (
              toiDuoc.has(rule.from) &&
              diDuoc(rule) &&
              !toiDuoc.has(rule.to)
            ) {
              toiDuoc.add(rule.to);
              doi = true;
            }
          }
        }

        // Mỗi trạng thái tới được phải loang ngược ra được một trạng thái kết thúc.
        for (const batDau of toiDuoc) {
          const thoatDuoc = new Set<string>([batDau]);
          for (let doi = true; doi;) {
            doi = false;
            for (const rule of ALLOWED_TRANSITIONS) {
              if (
                thoatDuoc.has(rule.from) &&
                diDuoc(rule) &&
                !thoatDuoc.has(rule.to)
              ) {
                thoatDuoc.add(rule.to);
                doi = true;
              }
            }
          }
          if (![...thoatDuoc].some((s) => KET_THUC.has(s))) {
            ketCuc.push(`${batDau} (cờ ${JSON.stringify(scopeFlags)})`);
          }
        }
      }
      expect(ketCuc).toEqual([]);
    });
  });

  /**
   * Cổng no-op của đường AUTO (Story 5.2, AC-5): "đơn đã ở CHÍNH cái đích mà sự kiện này
   * nhắm tới" ⇒ retry, không phải xung đột.
   *
   * Suy từ BẢNG, không hardcode cặp status/event ở call-site — bảng là nguồn chân lý duy
   * nhất, một bảng liệt kê thứ hai trong service là điểm drift đúng loại 5.1 vừa đóng.
   */
  describe('daTaiDich — cổng no-op idempotent cho đường auto', () => {
    it('đúng cho đích của mỗi dòng bảng (mọi dòng, không liệt kê tay)', () => {
      for (const rule of ALLOWED_TRANSITIONS) {
        expect(daTaiDich(rule.to, rule.event)).toBe(true);
      }
    });

    it('đúng cho `dacoc` + duCoc — đích chính tắc của mốc cọc', () => {
      expect(daTaiDich('dacoc', SU_KIEN.duCoc)).toBe(true);
    });

    it('đúng cho hoanThanh bất kể đơn đi qua nhánh `from` nào trong ba nhánh', () => {
      const nhanh = ALLOWED_TRANSITIONS.filter(
        (rule) => rule.event === SU_KIEN.hoanThanh,
      );
      // Ba dòng `from` khác nhau (nghiemthu, dagiao, dachot) nhưng CÙNG một đích.
      expect(nhanh).toHaveLength(3);
      for (const rule of nhanh) {
        expect(daTaiDich(rule.to, SU_KIEN.hoanThanh)).toBe(true);
      }
    });

    it('SAI cho `dachot` + duCoc — đó là điểm XUẤT PHÁT, chưa phải đích', () => {
      expect(daTaiDich('dachot', SU_KIEN.duCoc)).toBe(false);
    });

    it('cổng no-op KHÔNG được nuốt một transition hợp lệ: không sự kiện nào có `to` trùng một `from` của chính nó', () => {
      // Nếu bảng có cả `X: a → b` lẫn `X: b → c` thì đơn đang ở `b` gặp sự kiện `X` sẽ bị
      // fast-path `daTaiDich` trả no-op — một bước hợp lệ biến mất IM LẶNG, không lỗi nào nổi
      // lên. Hôm nay bảng không có cặp nào như vậy; test này khoá lại để nó không mọc ra.
      const xungDot = ALLOWED_TRANSITIONS.filter((rule) =>
        daTaiDich(rule.from, rule.event),
      ).map((rule) => `${rule.event}: ${rule.from} → ${rule.to}`);

      expect(xungDot).toEqual([]);
    });

    it('SAI khi không dòng nào của sự kiện có `to` khớp status', () => {
      // `duCoc` chỉ dẫn tới `dacoc`; đơn đang `hoanthanh` không phải đích của nó.
      expect(daTaiDich('hoanthanh', SU_KIEN.duCoc)).toBe(false);
      // Và một status không tồn tại trong bảng thì đương nhiên không phải đích của gì cả.
      expect(daTaiDich('khong_ton_tai', SU_KIEN.hoanThanh)).toBe(false);
    });
  });

  describe('buocVongDoi — chuỗi bước stepper suy TỪ bảng', () => {
    /** Preset Thương mại: chỉ bán thiết bị, không thi công không vận chuyển. */
    const CHI_THIET_BI: OrderScopeFlags = {
      thietBi: true,
      thiCong: false,
      vanChuyen: false,
    };

    /** Map tiện tra: `status → trangThai`; bước vắng mặt ⇒ `undefined`. */
    function bang(
      status: OrderStatusKey,
      scopeFlags: OrderScopeFlags,
    ): Record<string, string | undefined> {
      return Object.fromEntries(
        buocVongDoi(status, scopeFlags).map((b) => [b.status, b.trangThai]),
      );
    }

    it('đơn ca_nhan ở `dachot`: bước trước là done, chính nó current, phần sau upcoming', () => {
      const b = bang('dachot', DU_CO);
      expect(b.baogia).toBe('done');
      expect(b.dachot).toBe('current');
      expect(b.dacoc).toBe('upcoming');
      expect(b.thicong).toBe('upcoming');
      expect(b.nghiemthu).toBe('upcoming');
      expect(b.danggiao).toBe('upcoming');
      expect(b.dagiao).toBe('upcoming');
      expect(b.hoanthanh).toBe('upcoming');
    });

    it('bước được sắp theo thứ tự canonical của ORDER_STATUS_KEYS', () => {
      const chuoi = buocVongDoi('dachot', DU_CO).map((b) => b.status);
      expect(chuoi).toEqual([
        'baogia',
        'dachot',
        'dacoc',
        'thicong',
        'nghiemthu',
        'danggiao',
        'dagiao',
        'hoanthanh',
      ]);
    });

    it('đơn thuong_mai (chỉ Thiết bị): nhánh thi công VÀ nhánh giao VẮNG MẶT HOÀN TOÀN', () => {
      const b = bang('dachot', CHI_THIET_BI);
      // Không phải "có mà mờ" — không có mặt trong chuỗi (UX-DR-11).
      expect(b.thicong).toBeUndefined();
      expect(b.nghiemthu).toBeUndefined();
      expect(b.danggiao).toBeUndefined();
      expect(b.dagiao).toBeUndefined();
      // Đơn chỉ thiết bị vẫn đóng được: `dachot → hoanthanh` gate cờ Thiết bị.
      expect(b.hoanthanh).toBe('upcoming');
    });

    it('AC-11: bật Thiết bị + TẮT Vận chuyển ⇒ KHÔNG có `danggiao`/`dagiao` — hệ quả của bảng transition HIỆN TẠI (không có cạnh dacoc→dagiao); Story 6.1 sẽ thêm cạnh đó', () => {
      const b = bang('dacoc', {
        thietBi: true,
        thiCong: true,
        vanChuyen: false,
      });
      expect(b.danggiao).toBeUndefined();
      expect(b.dagiao).toBeUndefined();
      expect(b.thicong).toBe('upcoming');
    });

    it('RẼ NHÁNH: đơn ở `danggiao` KHÔNG đánh done cho `thicong`/`nghiemthu` — đơn chưa từng thi công', () => {
      const b = bang('danggiao', DU_CO);
      expect(b.thicong).toBeUndefined();
      expect(b.nghiemthu).toBeUndefined();
      expect(b.dacoc).toBe('done');
      expect(b.danggiao).toBe('current');
      expect(b.dagiao).toBe('upcoming');
    });

    it('RẼ NHÁNH: đơn ở `nghiemthu` KHÔNG vẽ `danggiao`/`dagiao` — từ nghiemthu chỉ còn cạnh hoanThanh', () => {
      const b = bang('nghiemthu', DU_CO);
      expect(b.danggiao).toBeUndefined();
      expect(b.dagiao).toBeUndefined();
      expect(b.thicong).toBe('done');
      expect(b.hoanthanh).toBe('upcoming');
    });

    it('`huy` không phải một nấc khi đơn đang chạy bình thường', () => {
      expect(bang('dacoc', DU_CO).huy).toBeUndefined();
    });

    it('`choduyet` không phải một nấc khi đơn đang ở `baogia` — nhánh phụ của chiết khấu', () => {
      expect(bang('baogia', DU_CO).choduyet).toBeUndefined();
    });

    it('NGOẠI LỆ: đơn ĐANG ở `huy` ⇒ bước `huy` có mặt với current', () => {
      expect(bang('huy', DU_CO).huy).toBe('current');
    });

    it('NGOẠI LỆ: đơn ĐANG ở `choduyet` ⇒ bước đó có mặt với current, `baogia` là done', () => {
      const b = bang('choduyet', DU_CO);
      expect(b.choduyet).toBe('current');
      expect(b.baogia).toBe('done');
      expect(b.dachot).toBe('upcoming');
    });

    it('CẠNH QUAY LUI không được tính là tiến: đơn mới ở `baogia` KHÔNG khoe `dachot` là done', () => {
      // `moLai` (dachot → baogia) và `tuChoiChietKhau` (choduyet → baogia) tạo chu trình;
      // nếu đồ thị giữ chúng thì mọi bước sau đều "có đường tới baogia" ⇒ done giả.
      const b = bang('baogia', DU_CO);
      expect(b.dachot).toBe('upcoming');
      expect(b.dacoc).toBe('upcoming');
      expect(b.hoanthanh).toBe('upcoming');
      expect(Object.values(b)).not.toContain('done');
    });

    it('MUTATION GUARD: chuỗi bước phải suy TỪ ALLOWED_TRANSITIONS, không từ bảng chép tay — mọi bước trả về (trừ chính status) phải nối được với status qua một cạnh của bảng', () => {
      // Xoá dòng `batDauThiCong` khỏi bảng ⇒ `thicong` phải biến mất khỏi chuỗi. Test này
      // khẳng định quan hệ đó bằng chính bảng, nên nó ĐỎ nếu hàm đọc nguồn khác.
      const buoc = buocVongDoi('dacoc', DU_CO).map((b) => b.status);
      const coTrongBang = new Set(
        ALLOWED_TRANSITIONS.flatMap((rule) => [rule.from, rule.to]),
      );
      for (const b of buoc) expect(coTrongBang.has(b)).toBe(true);
      // `thicong` chỉ tới được qua cạnh `batDauThiCong`; nếu cạnh đó còn thì bước còn.
      const coCanhThiCong = ALLOWED_TRANSITIONS.some(
        (rule) => rule.event === SU_KIEN.batDauThiCong,
      );
      expect(buoc.includes('thicong')).toBe(coCanhThiCong);
    });
  });
});
