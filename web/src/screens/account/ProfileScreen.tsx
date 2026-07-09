// hand-authored — web app-screen (Story 2.8). The Hồ sơ screen: read-only identity
// + self-service đổi mật khẩu, composed ENTIRELY from shipped design-system
// components (Card/Frame/Field/Button/Banner/Icon) + tokens (AD-13).
//
// Office screen ⇒ it lives INSIDE the app shell: WebShell with a <Sidebar/> filtered
// by the session permission set (Story 1.10/2.6 gating primitives, unchanged).
//
// Identity comes from the session provider, which ALREADY fetched `/me` — this screen
// does not call `/me` a second time.
//
// The mockup's `Tài khoản` / `Vai trò` / `SĐT` / `Đăng nhập gần nhất` rows are NOT
// rendered: none of those columns exist, and Role is a preset applied at creation, not
// stored truth (AD-8) — so "Vai trò" cannot be displayed honestly. Only real `/me`
// fields render. The rest is Epic 8.
import { useState } from 'react';
import type { FormEvent } from 'react';

import { Banner, Button, Card, Field, Frame } from '../../design-system/components';
import { Icon } from '../../design-system/icons/Icon';
import { filterNav } from '../../design-system/gating/permissions';
import type { PasswordPort } from '../../design-system/session/password-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './profile.css';

export interface ProfileScreenProps {
  port: PasswordPort;
}

// Mirror of the backend policy (`IsPasswordPolicy`): ≥8 chars, at least one letter and
// one digit. Presentational only — the backend rejects a weak password regardless (AD-4).
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$/;

export function ProfileScreen({ port }: ProfileScreenProps) {
  const { perms, me } = usePermissions();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setCurrent('');
    setPassword('');
    setConfirm('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (current.trim() === '') {
      setError('Nhập mật khẩu hiện tại.');
      return;
    }
    if (!PASSWORD_RE.test(password)) {
      setError('Mật khẩu tối thiểu 8 ký tự, có chữ và số.');
      return;
    }
    if (password !== confirm) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }
    setError(null);
    try {
      await port.changePassword({ currentPassword: current, newPassword: password });
      reset();
      setDone(true);
    } catch {
      setError('Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại.');
    }
  }

  return (
    <WebShell
      url="app.phuongnamsolar.vn/ho-so"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="profile" />}
      topbar={<Topbar eyebrow="TÀI KHOẢN" title="Hồ sơ" />}
    >
      <div className="profile-wrap">
        <Card variant="teal" className="profile-identity">
          <div className="profile-avatar">
            <Icon name="ic-user" size={22} />
          </div>
          <div className="profile-name">{me?.displayName ?? ''}</div>
          <dl className="profile-kv">
            <dt>Tên hiển thị</dt>
            <dd>{me?.displayName ?? ''}</dd>
            <dt>Email</dt>
            <dd>{me?.email ?? ''}</dd>
            <dt>Trạng thái</dt>
            {/* A live session proves the account is active: the guard re-checks
                `isActive` on EVERY request (Story 2.5). */}
            <dd>Đang hoạt động</dd>
          </dl>
        </Card>

        <Frame label="Đổi mật khẩu" className="profile-change">
          <form onSubmit={handleSubmit} noValidate>
            {done && (
              <Banner tone="info" role="status">
                Đã đổi mật khẩu. Bạn cần đăng nhập lại.
              </Banner>
            )}
            {error && (
              <Banner tone="danger" icon="ic-alert" role="alert">
                {error}
              </Banner>
            )}
            <Field
              label="Mật khẩu hiện tại"
              size="lg"
              type="password"
              placeholder="Nhập mật khẩu hiện tại"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <Field
              label="Mật khẩu mới"
              size="lg"
              type="password"
              placeholder="Nhập mật khẩu mới"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              label="Xác nhận mật khẩu mới"
              size="lg"
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Banner tone="info">
              Tối thiểu 8 ký tự, có chữ và số. Đổi mật khẩu sẽ ghi vào Audit log.
            </Banner>
            <div className="profile-actions">
              <Button variant="ghost" type="button" onClick={reset}>
                Huỷ
              </Button>
              <Button variant="primary" type="submit">
                Cập nhật mật khẩu
              </Button>
            </div>
          </form>
        </Frame>
      </div>
    </WebShell>
  );
}
