// hand-authored — web app-screen (Story 1.11). FIRST consumer screen of the
// design-system: the Đăng nhập screen composed ENTIRELY from shipped components
// (Field/Button/Card/Banner/Icon) + tokens — "ship kèm 1 màn, không phải thư
// viện treo kệ" (AD-13). No ad-hoc styling, and no nav: auth screens render
// through WebShell with `sidebar={null}` (UX-DR-15).
//
// Real sign-in since Story 10.3: the screen validates presentation only, then
// calls `AuthPort.login`; tokens never reach it (the adapter stores them). Sign-in
// is by phone since 10.9: the RAW string is sent (only trimmed) — the backend alone
// normalizes it (AD-9) and answers 400 `fieldErrors.phone` for a number it cannot
// parse, shown right under the field. No router here (AD-1/2): success
// and the "Quên mật khẩu" link only EMIT intents; the caller decides what shows.
import { useState } from 'react';
import type { FormEvent } from 'react';

import { ApiError, GENERIC_ERROR_MESSAGE } from '../../api/api-error';
import { Banner, Button, Card, Field } from '../../design-system/components';
import { Icon } from '../../design-system/icons/Icon';
import type { AuthPort } from '../../design-system/session';
import { WebShell } from '../../design-system/shell';

import './login.css';

export interface LoginScreenProps {
  port: AuthPort;
  /** Emits "signed in" — the caller swaps the screen. No router here (AD-1/2). */
  onLoggedIn: () => void;
  /** Emits "show the Quên mật khẩu screen". No router here (AD-1/2). */
  onForgotPassword?: () => void;
}

export function LoginScreen({ port, onLoggedIn, onForgotPassword }: LoginScreenProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Presentational validation is emptiness only — the number's format is the
  // backend's call (AD-9); its message is shown verbatim (AD-5).
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (phone.trim() === '' || password.trim() === '') {
      setError('Nhập đủ số điện thoại và mật khẩu.');
      setPhoneError(null);
      return;
    }
    setError(null);
    setPhoneError(null);
    setBusy(true);
    try {
      await port.login({ phone: phone.trim(), password });
    } catch (err) {
      // A phone the backend could not parse belongs under its field, not in the banner.
      const fieldMessage =
        err instanceof ApiError
          ? err.fieldErrors?.find((item) => item.field === 'phone')?.message
          : undefined;
      if (fieldMessage) {
        setPhoneError(fieldMessage);
      } else {
        // Anything but an ApiError is a client bug: never show its (English) text.
        setError(err instanceof ApiError ? err.message : GENERIC_ERROR_MESSAGE);
      }
      setBusy(false);
      return;
    }
    onLoggedIn();
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
              label="Số điện thoại"
              size="lg"
              placeholder="Nhập số điện thoại"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {phoneError && <Banner tone="danger">{phoneError}</Banner>}
            <Field
              label="Mật khẩu"
              size="lg"
              type="password"
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button variant="primary" size="wide" type="submit" disabled={busy}>
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
