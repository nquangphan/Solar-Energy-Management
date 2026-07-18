import { PERM } from '../src/accounts/domain/permission-registry';
import {
  ALLOWED_TRANSITIONS,
  SU_KIEN,
  SU_KIEN_THU_CONG,
  buocKeTiep,
  buocVongDoi,
  coTheHuy,
  daTaiDich,
  evaluateTransition,
  type OrderScopeFlags,
} from '../src/orders/domain/allowed-transition';
import {
  ORDER_STATUS_KEYS,
  type OrderStatusKey,
} from '../src/orders/domain/order-status';

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

  /**
   * HÌNH DẠNG của vòng đời, khoá bằng test chứ không bằng lời hứa.
   *
   * Bảng là bản thiết kế duy nhất của vòng đời (AD-11). Thêm một dòng vào đây là thêm một
   * đường đi thật cho mọi đơn — kể cả đường không ai định mở. Số dòng là con số duy nhất
   * nhìn thấy được điều đó từ bên ngoài.
   */
  describe('hình dạng bảng', () => {
    it('bảng có đúng 16 dòng — thêm/bớt một cạnh phải là quyết định có chủ ý', () => {
      expect(ALLOWED_TRANSITIONS).toHaveLength(16);
    });

    it('vòng đời KHÔNG có bước lên lịch: không trạng thái nào trong bảng mang tên đó', () => {
      const TEN_BUOC_DA_BO = /l[eê]n.?l[iị]ch/i;
      for (const rule of ALLOWED_TRANSITIONS) {
        expect(rule.from).not.toMatch(TEN_BUOC_DA_BO);
        expect(rule.to).not.toMatch(TEN_BUOC_DA_BO);
      }
      // Và không lẻn vào bộ khoá chính tắc bằng một trạng thái chưa có cạnh nào.
      for (const key of ORDER_STATUS_KEYS) {
        expect(key).not.toMatch(TEN_BUOC_DA_BO);
      }
    });

    /**
     * Hai cạnh DỰNG NÊN nhánh thi công phải cùng gate theo cờ Thi công.
     *
     * Cờ tắt mà chỉ một trong hai cạnh còn gate thì nhánh vẫn nửa mở: đơn không thi công
     * không vào được `thicong`, nhưng cạnh không gate vẫn là một đường đi hợp lệ trong bảng
     * — và bảng là thứ mọi thứ khác (stepper, bước kế, executor) suy ra. Gate phải nằm trên
     * CẢ HAI cạnh, và điều đó chỉ nhìn thấy được từ chính bảng.
     *
     * Cạnh RA (`nghiemthu → hoanthanh`) cố ý KHÔNG gate: tới được `nghiemthu` nghĩa là cờ đã
     * bật từ đầu nhánh, và một đơn đang dở không được phép mất lối ra vì cờ bị đổi về sau.
     */
    it('cả hai cạnh dựng nhánh thi công đều gate theo cờ Thi công', () => {
      const canhDungNhanh = [SU_KIEN.batDauThiCong, SU_KIEN.xongThiCong];

      for (const event of canhDungNhanh) {
        // MỌI dòng mang sự kiện này, không chỉ dòng đầu: bảng cho phép nhiều dòng cùng một
        // sự kiện (`hoanThanh` có ba, `huy` có ba). Một dòng anh em không gate là một đường
        // đi hợp lệ mà cờ tắt không chặn được.
        const cacDong = ALLOWED_TRANSITIONS.filter((r) => r.event === event);
        expect(cacDong.length).toBeGreaterThan(0);
        for (const rule of cacDong) {
          expect(rule.scopeGuard).toBe('thiCong');
        }
      }
    });
  });

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

  describe('buocKeTiep — bước kế của lane THỦ CÔNG, suy TỪ bảng', () => {
    /** Bộ quyền của ba key mà lane thủ công thực sự cần. */
    const QUYEN_THU_CONG: ReadonlySet<string> = new Set([
      PERM.constructionTransition,
      PERM.deliveryConfirm,
      PERM.paymentsRecord,
    ]);

    function ke(
      status: string,
      scopeFlags: OrderScopeFlags = DU_CO,
      quyen: ReadonlySet<string> = TOAN_QUYEN,
    ) {
      return buocKeTiep(status as OrderStatusKey, scopeFlags, quyen);
    }

    it('đơn `dacoc` đủ cả hai cờ ⇒ thấy CẢ hai nhánh thi công và giao hàng', () => {
      expect(ke('dacoc').map((b) => b.event).sort()).toEqual(
        [SU_KIEN.batDauGiao, SU_KIEN.batDauThiCong].sort(),
      );
    });

    it('CỜ: đơn KHÔNG bật cờ Thi công ⇒ không thấy `bat_dau_thi_cong`', () => {
      const buoc = ke('dacoc', {
        thietBi: true,
        thiCong: false,
        vanChuyen: true,
      });
      expect(buoc.map((b) => b.event)).not.toContain(SU_KIEN.batDauThiCong);
      expect(buoc.map((b) => b.event)).toContain(SU_KIEN.batDauGiao);
    });

    it('QUYỀN: actor thiếu `construction.transition` ⇒ không thấy bước của nhánh thi công', () => {
      const buoc = ke('thicong', DU_CO, new Set([PERM.deliveryConfirm]));
      expect(buoc).toEqual([]);
    });

    it('QUYỀN: actor CÓ `construction.transition` ⇒ thấy `xong_thi_cong` với đích `nghiemthu`', () => {
      expect(ke('thicong', DU_CO, QUYEN_THU_CONG)).toEqual([
        {
          event: SU_KIEN.xongThiCong,
          to: 'nghiemthu',
          requires: PERM.constructionTransition,
        },
      ]);
    });

    /**
     * LỐI RA của nhánh thi công. Cạnh vào (`dacoc → thicong`) và cạnh giữa
     * (`thicong → nghiemthu`) vô nghĩa nếu đơn tới `nghiemthu` rồi đứng đó mãi. Một phần tử,
     * không nhiều hơn: `nghiemthu` chỉ có duy nhất một đường đi tiếp.
     */
    it('LỐI RA: `nghiemthu` chỉ còn ĐÚNG MỘT bước — `hoan_thanh` về `hoanthanh`', () => {
      expect(ke('nghiemthu', DU_CO, QUYEN_THU_CONG)).toEqual([
        {
          event: SU_KIEN.hoanThanh,
          to: 'hoanthanh',
          requires: PERM.constructionTransition,
        },
      ]);
    });

    it('WHITELIST: năm sự kiện có cửa riêng KHÔNG BAO GIỜ xuất hiện, ở BẤT KỲ trạng thái nào', () => {
      const cuaRieng: readonly string[] = [
        SU_KIEN.chot,
        SU_KIEN.moLai,
        SU_KIEN.huy,
        SU_KIEN.duCoc,
        SU_KIEN.apChietKhau,
      ];
      const moiTrangThai = new Set(
        ALLOWED_TRANSITIONS.flatMap((rule) => [rule.from, rule.to]),
      );
      for (const status of moiTrangThai) {
        for (const buoc of ke(status)) {
          expect(cuaRieng).not.toContain(buoc.event);
        }
      }
    });

    it('WHITELIST: `baogia` có `chot`/`huy`/`ap_chiet_khau` trong bảng nhưng lane thủ công trả RỖNG', () => {
      expect(ke('baogia')).toEqual([]);
    });

    it('WHITELIST: `dachot` có `du_coc`/`mo_lai`/`huy` trong bảng — lane thủ công chỉ còn `hoan_thanh` (cờ Thiết bị)', () => {
      expect(ke('dachot').map((b) => b.event)).toEqual([SU_KIEN.hoanThanh]);
    });

    it('CỜ trên `hoan_thanh` từ `dachot`: tắt cờ Thiết bị ⇒ không còn bước nào', () => {
      expect(
        ke('dachot', { thietBi: false, thiCong: true, vanChuyen: true }),
      ).toEqual([]);
    });

    it('KHÔNG no-op như lane auto: trạng thái cuối `hoanthanh` trả rỗng, không trả bước tự trỏ', () => {
      expect(ke('hoanthanh')).toEqual([]);
      expect(ke('huy')).toEqual([]);
    });

    it('MUTATION GUARD: mọi bước trả về phải là một DÒNG CÓ THẬT của bảng — không bảng thứ hai', () => {
      const moiTrangThai = new Set(
        ALLOWED_TRANSITIONS.flatMap((rule) => [rule.from, rule.to]),
      );
      for (const status of moiTrangThai) {
        for (const buoc of ke(status)) {
          const dong = ALLOWED_TRANSITIONS.find(
            (rule) =>
              rule.from === status &&
              rule.event === buoc.event &&
              rule.to === buoc.to &&
              rule.requires === buoc.requires,
          );
          expect(dong).toBeDefined();
        }
      }
    });
  });

  describe('coTheHuy — người này huỷ được đơn ở trạng thái này không (Story 5.7)', () => {
    const QUYEN_HUY: ReadonlySet<string> = new Set([PERM.quotesCreateEdit]);

    /** Ba trạng thái CÓ cạnh huỷ trong bảng — suy từ bảng, không chép tay. */
    const CO_CANH_HUY = ALLOWED_TRANSITIONS.filter(
      (rule) => rule.event === SU_KIEN.huy,
    ).map((rule) => rule.from);

    it.each(ORDER_STATUS_KEYS)(
      'trạng thái `%s`: có quyền `quotes.create_edit` ⇒ đúng bằng "bảng có cạnh huỷ từ đây"',
      (status) => {
        expect(coTheHuy(status, QUYEN_HUY)).toBe(CO_CANH_HUY.includes(status));
      },
    );

    it.each(ORDER_STATUS_KEYS)(
      'trạng thái `%s`: THIẾU quyền ⇒ luôn false, kể cả nơi bảng có cạnh',
      (status) => {
        expect(coTheHuy(status, new Set())).toBe(false);
      },
    );

    it('quyền KHÁC không mở được cửa huỷ (không any-of, không suy diễn)', () => {
      expect(coTheHuy('baogia', new Set([PERM.ordersConfirm]))).toBe(false);
      expect(coTheHuy('baogia', new Set([PERM.paymentsRecord]))).toBe(false);
    });

    it('đơn ĐÃ huỷ ⇒ false — `huy` là terminal, không huỷ lần hai', () => {
      expect(coTheHuy('huy', QUYEN_HUY)).toBe(false);
    });

    it('ĐỌC bảng, KHÔNG chép: đúng ba trạng thái baogia/dachot/dacoc mở cửa huỷ', () => {
      const mo = ORDER_STATUS_KEYS.filter((s) => coTheHuy(s, QUYEN_HUY));
      expect([...mo].sort()).toEqual(['baogia', 'dachot', 'dacoc'].sort());
    });
  });

  describe('HỒI QUY 5.7 — huỷ KHÔNG lọt vào lane thủ công, KHÔNG mọc nấc stepper', () => {
    it('`SU_KIEN_THU_CONG` KHÔNG chứa `huy` — nếu chứa, huỷ đi được qua cửa không đòi lý do', () => {
      expect(SU_KIEN_THU_CONG).not.toContain(SU_KIEN.huy);
      expect(SU_KIEN_THU_CONG).toHaveLength(5);
    });

    it('HÀNH VI: `buocVongDoi()` không sinh nấc `huy` cho bất kỳ trạng thái × bộ cờ nào (trừ khi đơn ĐANG ở `huy`)', () => {
      const boCo: readonly OrderScopeFlags[] = [
        { thietBi: false, thiCong: false, vanChuyen: false },
        { thietBi: true, thiCong: false, vanChuyen: false },
        { thietBi: false, thiCong: true, vanChuyen: false },
        { thietBi: false, thiCong: false, vanChuyen: true },
        { thietBi: true, thiCong: true, vanChuyen: false },
        { thietBi: true, thiCong: false, vanChuyen: true },
        { thietBi: true, thiCong: true, vanChuyen: true },
      ];
      for (const status of ORDER_STATUS_KEYS) {
        for (const co of boCo) {
          const nac = buocVongDoi(status, co).filter((b) => b.status === 'huy');
          // Ngoại lệ DUY NHẤT: đơn đang đứng ở `huy` — stepper thiếu bước đang đứng là nói dối.
          expect(nac).toEqual(
            status === 'huy' ? [{ status: 'huy', trangThai: 'current' }] : [],
          );
        }
      }
    });

    it('HÀNH VI: `buocKeTiep()` không bao giờ trả sự kiện `huy`, ở mọi trạng thái × mọi bộ cờ', () => {
      for (const status of ORDER_STATUS_KEYS) {
        for (const thiCong of [false, true]) {
          for (const vanChuyen of [false, true]) {
            const buoc = buocKeTiep(
              status,
              { thietBi: true, thiCong, vanChuyen },
              TOAN_QUYEN,
            );
            expect(buoc.map((b) => b.event)).not.toContain(SU_KIEN.huy);
          }
        }
      }
    });
  });
});
