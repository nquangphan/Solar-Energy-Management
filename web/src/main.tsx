// Web entry (Story 10.3): real sign-in against the backend. NOT the full
// composition root yet — no router, no PermissionsProvider, and the business
// screens are not wired (Story 10.4). It builds the session, transport, generated
// client and HttpAuthPort once, restores the session from the stored refresh
// token on start, and swaps Đăng nhập / Quên mật khẩu / a minimal signed-in view.
// Quên mật khẩu still runs on FakePasswordPort until its adapter lands (Story 10.4).
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Thứ tự nạp là hợp đồng (gating/index.ts, a11y.css): a11y.css PHẢI sau components + shell.
import './design-system/tokens/tokens.css';
import './design-system/icons/icons.css';
import './design-system/components/components.css';
import './design-system/shell/shell.css';
import './design-system/a11y/a11y.css';

import { createApiClient } from './api/client';
import { HttpAuthPort } from './api/http-auth-port';
import { createSessionStore } from './api/session-store';
import { createTransport } from './api/transport';
import { Banner, Button, Card } from './design-system/components';
import { ICON_SPRITE } from './design-system/icons/sprite';
import { FakePasswordPort } from './design-system/session';
import { WebShell } from './design-system/shell';
import { ForgotPasswordScreen } from './screens/auth/ForgotPasswordScreen';
import { LoginScreen } from './screens/auth/LoginScreen';

// Same-origin path through the vite dev proxy by default; a full backend URL when
// the web is hosted on another origin (the backend then needs CORS_ORIGINS).
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

// The transport outlives React; the mounted App registers where "session expired" goes.
let onSessionExpired: () => void = () => {};
const session = createSessionStore();
const transport = createTransport({ baseUrl, session, onSessionExpired: () => onSessionExpired() });
const authPort = new HttpAuthPort(createApiClient(transport, baseUrl), session, transport);
const passwordPort = new FakePasswordPort();

type View = 'restoring' | 'login' | 'forgot' | 'signedIn';

function App() {
  const [view, setView] = useState<View>('restoring');

  useEffect(() => {
    let mounted = true;
    onSessionExpired = () => setView('login');
    // StrictMode runs this twice; the transport shares the one refresh in flight.
    void authPort.restoreSession().then((restored) => {
      if (mounted) setView(restored ? 'signedIn' : 'login');
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (view === 'restoring') return null;
  if (view === 'forgot') {
    return <ForgotPasswordScreen port={passwordPort} onBackToLogin={() => setView('login')} />;
  }
  if (view === 'login') {
    return (
      <LoginScreen
        port={authPort}
        onLoggedIn={() => setView('signedIn')}
        onForgotPassword={() => setView('forgot')}
      />
    );
  }
  return (
    <WebShell url="app.phuongnamsolar.vn" sidebar={null}>
      <div className="login-wrap">
        {/* Reuses the Đăng nhập card layout (login.css, loaded by LoginScreen): no new class. */}
        <Card className="login-card">
          <Banner tone="info" icon="ic-info">
            Đã đăng nhập.
          </Banner>
          <Button
            variant="primary"
            size="wide"
            onClick={async () => {
              await authPort.logout();
              setView('login');
            }}
          >
            Đăng xuất
          </Button>
        </Card>
      </div>
    </WebShell>
  );
}

// Sprite icon gắn MỘT lần, con đầu của <body> (hợp đồng trong sprite.ts).
document.body.insertAdjacentHTML('afterbegin', ICON_SPRITE);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
