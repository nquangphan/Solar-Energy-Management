import {
  PasswordChanged,
  PasswordResetCompleted,
  PasswordResetRequested,
} from '../src/auth/domain/password-events';
import type { DomainEvent } from '../src/events/domain-event';

/**
 * Bất biến bảo mật của 3 concrete domain event đầu tiên (AD-18 producer đầu tiên):
 * `AuditLog` là bản ghi BẤT BIẾN VĨNH VIỄN (AD-8, chỉ `create`), nên payload event —
 * thứ `AuditSubscriber` ghi thẳng vào `before`/`after` — KHÔNG được mang mật khẩu thô,
 * `passwordHash`, hay mã xác thực. Một lần rò rỉ là rò rỉ không xoá được.
 *
 * Test serialize toàn bộ event rồi soi chuỗi: bắt được cả field lồng sâu lẫn field thêm
 * vào sau này bởi người sửa code không đọc chú thích.
 */
describe('password domain events (payload security, AD-8/AD-18)', () => {
  const ACCOUNT_ID = 'acc-1';
  const OCCURRED_AT = new Date('2026-07-09T03:00:00.000Z');

  /** Bí mật giả — nếu bất kỳ chuỗi nào lọt vào event, test phải đỏ. */
  const RAW_PASSWORD = 'MatKhauThoRatBiMat!23';
  const RAW_CODE = '123456';
  const PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA';

  const events: ReadonlyArray<[string, DomainEvent]> = [
    [
      'PasswordResetRequested',
      new PasswordResetRequested(ACCOUNT_ID, OCCURRED_AT),
    ],
    [
      'PasswordResetCompleted',
      new PasswordResetCompleted(ACCOUNT_ID, OCCURRED_AT),
    ],
    ['PasswordChanged', new PasswordChanged(ACCOUNT_ID, OCCURRED_AT)],
  ];

  it.each(events)('%s conform DomainEvent 5 chiều audit', (name, event) => {
    expect(event.type).toBe(name);
    expect(event.actorAccountId).toBe(ACCOUNT_ID);
    expect(event.target).toEqual({ type: 'Account', id: ACCOUNT_ID });
    expect(event.occurredAt).toBe(OCCURRED_AT);
  });

  it.each(events)(
    '%s KHÔNG mang mật khẩu thô / hash / mã xác thực ở bất kỳ field nào',
    (_name, event) => {
      const serialized = JSON.stringify(event);
      for (const secret of [RAW_PASSWORD, RAW_CODE, PASSWORD_HASH]) {
        expect(serialized).not.toContain(secret);
      }
      // Không field nào tên gợi ý vật liệu mật khẩu (chặn người sau thêm vào).
      expect(serialized).not.toMatch(/password(?!Reset|Changed)/i);
      expect(serialized).not.toMatch(/\bcode\b/i);
      expect(serialized).not.toMatch(/hash/i);
    },
  );

  it.each(events)(
    '%s chỉ ghi "đã xảy ra" — `before` vắng mặt, `after` chỉ có changedAt',
    (_name, event) => {
      expect(event.before).toBeUndefined();
      expect(event.after).toEqual({ changedAt: OCCURRED_AT.toISOString() });
    },
  );
});
