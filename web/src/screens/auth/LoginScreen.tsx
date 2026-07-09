// hand-authored — web app-screen (Story 1.11). FIRST consumer screen of the
// design-system: the Đăng nhập screen composed ENTIRELY from shipped components
// (Field/Button/Card/Banner/Icon) + tokens — "ship kèm 1 màn, không phải thư
// viện treo kệ" (AD-13). No ad-hoc styling, and no nav: auth screens render
// through WebShell with `sidebar={null}` (UX-DR-15).
//
// Demo UI — logic xác thực thật (JWT access+refresh) nối ở Story 2.3; đây chỉ
// validate trình bày (rỗng/định dạng). KHÔNG gọi mạng, KHÔNG token, KHÔNG router
// (AD-1/2). Màn "Quên mật khẩu" (s-forgot) landed ở Story 2.8 — link ở đây chỉ
// EMIT ý định qua `onForgotPassword`; caller quyết định hiển thị màn nào.
import { useState } from 'react';
import type { FormEvent } from 'react';

import { Banner, Button, Card, Field } from '../../design-system/components';
import { Icon } from '../../design-system/icons/Icon';
import { WebShell } from '../../design-system/shell';

import './login.css';

export interface LoginScreenProps {
  /** Emits "show the Quên mật khẩu screen". No router here (AD-1/2). */
  onForgotPassword?: () => void;
}

export function LoginScreen({ onForgotPassword }: LoginScreenProps = {}) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Presentational validation only (AC-2): rỗng → Banner; định dạng tối thiểu
  // (SĐT chữ số hoặc email). Real auth wires in Epic 2 (Story 2.3).
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (account.trim() === '' || password.trim() === '') {
      setError('Nhập đủ tài khoản và mật khẩu.');
      return;
    }
    const value = account.trim();
    const isPhone = /^[0-9]{8,}$/.test(value);
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    if (!isPhone && !isEmail) {
      setError('Tài khoản phải là số điện thoại hoặc email hợp lệ.');
      return;
    }
    setError(null);
    // Epic 2 (Story 2.3): gọi API đăng nhập + lưu JWT ở đây.
  }

  return (
    <WebShell url="app.phuongnamsolar.vn/dang-nhap" sidebar={null}>
      <div className="login-wrap">
        <Card className="login-card">
          <div className="login-brand">
            <div className="login-mark">
              <Icon name="ic-sun" size={22} />
            </div>
            <div className="login-title">Phương Nam Solar</div>
            <div className="login-sub">App quản lý nội bộ · Phase 1</div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <Banner tone="danger" icon="ic-alert" role="alert">
                {error}
              </Banner>
            )}
            <Field
              label="Tài khoản"
              size="lg"
              placeholder="Số điện thoại hoặc email"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
            <Field
              label="Mật khẩu"
              size="lg"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button variant="primary" size="wide" type="submit">
              Đăng nhập
            </Button>
          </form>

          <div className="login-forgot">
            {/* Nút, không phải anchor: nó không điều hướng đi đâu cả — nó phát ý định
                cho caller (chưa có router, AD-1/2). `<a href="#">` sẽ nói dối cả trình
                đọc màn hình lẫn bàn phím. */}
            <button
              type="button"
              className="login-forgot-link"
              onClick={onForgotPassword}
            >
              Quên mật khẩu?
            </button>
          </div>
        </Card>
      </div>
    </WebShell>
  );
}
