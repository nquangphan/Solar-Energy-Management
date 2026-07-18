import { PERM } from '../src/accounts/domain/permission-registry';
import {
  ALLOWED_TRANSITIONS,
  SU_KIEN,
  evaluateTransition,
  type OrderScopeFlags,
} from '../src/orders/domain/allowed-transition';

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
});
