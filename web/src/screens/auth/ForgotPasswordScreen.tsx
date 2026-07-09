// hand-authored — web app-screen (Story 2.8). The Quên mật khẩu screen, composed
// ENTIRELY from shipped design-system components (Stepper/Field/Button/Card/Banner)
// + tokens (AD-13). Auth screen ⇒ no nav: WebShell with `sidebar={null}` (UX-DR-15).
//
// Transport goes through the injected `PasswordPort` — no fetch/axios here, and no
// router (there is no app-runtime yet; the port IS the seam). The two-step flow lives
// in component state, not in routes.
//
// GATING/VALIDATION HERE IS UX ONLY (AD-4). The backend owns every real rule: attempt
// ceiling, single-use, expiry, and the neutral response that hides whether an email
// exists. Never branch this UI on "does this account exist" — the API refuses to say.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Banner, Button, Card, Field, Stepper } from '../../design-system/components';
import type { PasswordPort } from '../../design-system/session/password-port';
import { WebShell } from '../../design-system/shell';

import './forgot-password.css';

export interface ForgotPasswordScreenProps {
  port: PasswordPort;
  /** Emits "go back to the login screen". No router here (AD-1/2). */
  onBackToLogin?: () => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE_RE = /^[0-9]{6}$/;
// Mirror of the backend policy (`IsPasswordPolicy`): ≥8 chars, at least one letter and
// one digit. Presentational only — the backend rejects a weak password regardless.
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$/;

/** `nguyen.van.a@domain.vn` → `ng•••@domain.vn`. Masking is CLIENT-side cosmetics. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}•••@${domain}`;
}

/** Seconds → `MM:SS` for the resend countdown. */
function formatCountdown(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function ForgotPasswordScreen({ port, onBackToLogin }: ForgotPasswordScreenProps) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  // Tick the resend countdown while step 2 is on screen. The cleanup is not optional:
  // a surviving interval fires setState on an unmounted component forever.
  useEffect(() => {
    if (step !== 'verify') return;
    const id = setInterval(() => {
      setRemaining((left) => (left <= 0 ? 0 : left - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (value === '') {
      setError('Nhập email đã đăng ký.');
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setError('Email không hợp lệ.');
      return;
    }
    setError(null);
    try {
      const { expiresInSeconds } = await port.requestResetCode(value);
      setRemaining(expiresInSeconds);
      setStep('verify');
    } catch {
      setError('Không gửi được mã. Thử lại sau.');
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    if (!CODE_RE.test(code.trim())) {
      setError('Mã xác thực gồm đúng 6 chữ số.');
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
      await port.resetPassword({ email: email.trim(), code: code.trim(), newPassword: password });
      onBackToLogin?.();
    } catch {
      // ONE message for every backend failure — the API deliberately does not say which
      // branch failed, and neither do we.
      setError('Không thể đặt lại mật khẩu. Kiểm tra lại mã và thử lại.');
    }
  }

  return (
    <WebShell url="app.phuongnamsolar.vn/quen-mat-khau" sidebar={null}>
      <div className="forgot-wrap">
        <Card className="forgot-card">
          <div className="forgot-title">Quên mật khẩu</div>

          <div className="forgot-stepper">
            <Stepper
              steps={[
                { label: 'Gửi mã', state: step === 'request' ? 'current' : 'done' },
                { label: 'Mã & mật khẩu mới', state: step === 'verify' ? 'current' : undefined },
              ]}
            />
          </div>

          {error && (
            <Banner tone="danger" icon="ic-alert" role="alert">
              {error}
            </Banner>
          )}

          {step === 'request' ? (
            <form onSubmit={submitRequest} noValidate>
              <Field
                label="Email đã đăng ký"
                size="lg"
                type="email"
                placeholder="Nhập email đã đăng ký"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button variant="primary" size="wide" type="submit">
                Gửi mã
              </Button>
            </form>
          ) : (
            <form onSubmit={submitReset} noValidate>
              <Banner tone="info">
                Đã gửi mã 6 số đến {maskEmail(email.trim())}. Mã có hiệu lực 5 phút.
              </Banner>
              <Field
                label="Mã xác thực"
                size="lg"
                className="forgot-code"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
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
              <Button variant="primary" size="wide" type="submit">
                Đặt lại mật khẩu
              </Button>
              <div className="forgot-resend">Gửi lại mã sau {formatCountdown(remaining)}</div>
            </form>
          )}

          <div className="forgot-back">
            <Button variant="ghost" type="button" onClick={onBackToLogin}>
              Quay lại đăng nhập
            </Button>
          </div>
        </Card>
      </div>
    </WebShell>
  );
}
