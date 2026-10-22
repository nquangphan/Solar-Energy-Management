// Web composition root (AD-12, Story 10.4): the ONE place that builds the transport,
// the generated client and every HTTP adapter, and hands those ports to the app.
// Screens and the app layer (app/) only see port interfaces; no fake port is ever
// imported here (guard: test/composition-root.test.ts).
//
// Session flow: restore the session from the stored refresh token, then either the
// signed-out routes (Đăng nhập / Quên mật khẩu) or the PermissionsProvider (`/me`)
// around the app routes. A failed renewal anywhere sends the user back to Đăng nhập.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router';

// Thứ tự nạp là hợp đồng (gating/index.ts, a11y.css): a11y.css PHẢI sau components + shell.
import './design-system/tokens/tokens.css';
import './design-system/icons/icons.css';
import './design-system/components/components.css';
import './design-system/shell/shell.css';
import './design-system/a11y/a11y.css';

import { createApiClient } from './api/client';
import { HttpAuthPort } from './api/http-auth-port';
import { HttpCatalogPort } from './api/http-catalog-port';
import { HttpContractsPort } from './api/http-contracts-port';
import { HttpCustomerSourcesPort } from './api/http-customer-sources-port';
import { HttpCustomersPort } from './api/http-customers-port';
import { HttpInventoryPort } from './api/http-inventory-port';
import { HttpInvoicesPort } from './api/http-invoices-port';
import { HttpMePort } from './api/http-me-port';
import { HttpOrdersPort } from './api/http-orders-port';
import { HttpPasswordPort } from './api/http-password-port';
import { HttpPaymentsPort } from './api/http-payments-port';
import { HttpSettingsPort } from './api/http-settings-port';
import { HttpStockVouchersPort } from './api/http-stock-vouchers-port';
import { HttpWarrantyPort } from './api/http-warranty-port';
import { createSessionStore } from './api/session-store';
import { createTransport } from './api/transport';
import { AppRoutes, SignedOutRoutes } from './app/AppRoutes';
import type { AppPorts } from './app/AppRoutes';
import { ICON_SPRITE } from './design-system/icons/sprite';
import { PermissionsProvider } from './design-system/session';

// Same-origin path through the vite dev proxy by default; a full backend URL when
// the web is hosted on another origin (the backend then needs CORS_ORIGINS).
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

// The transport outlives React; the mounted App registers where "session expired" goes.
let onSessionExpired: () => void = () => {};
const session = createSessionStore();
const transport = createTransport({ baseUrl, session, onSessionExpired: () => onSessionExpired() });
const client = createApiClient(transport, baseUrl);
const ports: AppPorts = {
  auth: new HttpAuthPort(client, session, transport),
  me: new HttpMePort(client),
  password: new HttpPasswordPort(client),
  customers: new HttpCustomersPort(client),
  customerSources: new HttpCustomerSourcesPort(client),
  catalog: new HttpCatalogPort(client),
  settings: new HttpSettingsPort(client),
  warranty: new HttpWarrantyPort(client),
  orders: new HttpOrdersPort(client),
  inventory: new HttpInventoryPort(client),
  stockVouchers: new HttpStockVouchersPort(client),
  payments: new HttpPaymentsPort(client),
  contracts: new HttpContractsPort(client),
  invoices: new HttpInvoicesPort(client),
};

type Status = 'restoring' | 'signedOut' | 'signedIn';

function App() {
  const [status, setStatus] = useState<Status>('restoring');
  // Bumped on every sign-in and on "Thử lại": remounts the provider so `/me` is fetched
  // again — signing out A and in as B must never keep A's permissions.
  const [sessionKey, setSessionKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    onSessionExpired = () => setStatus('signedOut');
    // StrictMode runs this twice; the transport shares the one refresh in flight.
    void ports.auth.restoreSession().then((restored) => {
      if (mounted) setStatus(restored ? 'signedIn' : 'signedOut');
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (status === 'restoring') return null;
  if (status === 'signedOut') {
    return (
      <SignedOutRoutes
        ports={ports}
        onLoggedIn={() => {
          setSessionKey((key) => key + 1);
          setStatus('signedIn');
          navigate('/', { replace: true });
        }}
      />
    );
  }
  return (
    <PermissionsProvider key={sessionKey} port={ports.me}>
      <AppRoutes
        ports={ports}
        onRetry={() => setSessionKey((key) => key + 1)}
        onLogout={async () => {
          await ports.auth.logout();
          setStatus('signedOut');
        }}
      />
    </PermissionsProvider>
  );
}

// Sprite icon gắn MỘT lần, con đầu của <body> (hợp đồng trong sprite.ts).
document.body.insertAdjacentHTML('afterbegin', ICON_SPRITE);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
