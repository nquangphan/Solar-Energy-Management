// hand-authored — the application layer (Story 10.4): routes, route gating and the
// sidebar's navigation. It receives its ports from the composition root (main.tsx)
// and never builds an adapter itself (AD-12).
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';

import { Button, Card, ErrorState, Skeleton } from '../design-system/components';
import type {
  AuthPort,
  CatalogPort,
  CustomerSourcesPort,
  CustomersPort,
  MePort,
  PasswordPort,
  SettingsPort,
  WarrantyPort,
} from '../design-system/session';
import { usePermissions } from '../design-system/session';
import { SidebarNavContext, WebShell } from '../design-system/shell';
import type { SidebarNavValue } from '../design-system/shell';
import { ProfileScreen } from '../screens/account/ProfileScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { CustomerDetailScreen } from '../screens/customers/CustomerDetailScreen';
import { CustomerListScreen } from '../screens/customers/CustomerListScreen';
import { CustomerPickScreen } from '../screens/customers/CustomerPickScreen';
import { CustomerSourceConfigScreen } from '../screens/settings/CustomerSourceConfigScreen';
import { WarrantyLookupScreen } from '../screens/warranty/WarrantyLookupScreen';
import {
  AVAILABLE_NAV_KEYS,
  CUSTOMER_LOOKUP_PATH,
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  NAV_ROUTES,
  customerPath,
  landingPath,
  openableKeys,
  pathOfKey,
} from './routes';
import type { NavRouteKey } from './routes';

/** Every port the web app uses, built once by the composition root. */
export interface AppPorts {
  auth: AuthPort;
  me: MePort;
  password: PasswordPort;
  customers: CustomersPort;
  customerSources: CustomerSourcesPort;
  /** Built for the quote pickers, which are wired with the order screens (Story 10.5). */
  catalog: CatalogPort;
  settings: SettingsPort;
  warranty: WarrantyPort;
}

export interface SignedOutRoutesProps {
  ports: Pick<AppPorts, 'auth' | 'password'>;
  onLoggedIn: () => void;
}

/** Signed out: only Đăng nhập and Quên mật khẩu; any other path goes to Đăng nhập. */
export function SignedOutRoutes({ ports, onLoggedIn }: SignedOutRoutesProps) {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route
        path={LOGIN_PATH}
        element={
          <LoginScreen
            port={ports.auth}
            onLoggedIn={onLoggedIn}
            onForgotPassword={() => navigate(FORGOT_PASSWORD_PATH)}
          />
        }
      />
      <Route
        path={FORGOT_PASSWORD_PATH}
        element={<ForgotPasswordScreen port={ports.password} onBackToLogin={() => navigate(LOGIN_PATH)} />}
      />
      <Route path="*" element={<Navigate to={LOGIN_PATH} replace />} />
    </Routes>
  );
}

export interface AppRoutesProps {
  ports: AppPorts;
  onLogout: () => void;
  /** Fetch `/me` again after it failed. */
  onRetry: () => void;
}

/** Signed in, below the PermissionsProvider: waits for `/me`, then routes by permission. */
export function AppRoutes({ ports, onLogout, onRetry }: AppRoutesProps) {
  const { status, perms } = usePermissions();
  const navigate = useNavigate();
  const nav = useMemo<SidebarNavValue>(
    () => ({
      onNavigate: (key) => {
        const path = pathOfKey(key);
        if (path !== undefined) navigate(path);
      },
      availableKeys: AVAILABLE_NAV_KEYS,
    }),
    [navigate],
  );

  // No route renders before `/me` answers: with an empty permission set every gated
  // path would redirect, and a reload of /settings would land somewhere else.
  if (status === 'loading') {
    return (
      <WebShell url="app.phuongnamsolar.vn" sidebar={null}>
        <div className="login-wrap">
          <Skeleton width={320} height={160} />
        </div>
      </WebShell>
    );
  }
  if (status === 'error') {
    return (
      <WebShell url="app.phuongnamsolar.vn" sidebar={null}>
        {/* Reuses the Đăng nhập card layout (login.css): no new class. */}
        <div className="login-wrap">
          <Card className="login-card">
            <ErrorState message="Không tải được thông tin tài khoản." onRetry={onRetry} />
            <Button variant="ghost" type="button" onClick={onLogout}>
              Đăng xuất
            </Button>
          </Card>
        </div>
      </WebShell>
    );
  }

  const openable = new Set<NavRouteKey>(openableKeys(perms));
  const landing = landingPath(perms);
  // A path the account may not open does not render; it lands where `/` lands (UX-DR-22, AD-4).
  const gate = (key: NavRouteKey, element: ReactElement) =>
    openable.has(key) ? element : <Navigate to={landing} replace />;

  return (
    <SidebarNavContext.Provider value={nav}>
      <Routes>
        <Route
          path={NAV_ROUTES.customers}
          element={gate(
            'customers',
            <CustomerListScreen
              port={ports.customers}
              onOpen={(phone) => navigate(customerPath(phone))}
              onAdd={() => navigate(CUSTOMER_LOOKUP_PATH)}
            />,
          )}
        />
        <Route
          path={CUSTOMER_LOOKUP_PATH}
          element={gate(
            'customers',
            <CustomerPickScreen port={ports.customers} onSelect={(customer) => navigate(customerPath(customer.phone))} />,
          )}
        />
        <Route
          path={`${NAV_ROUTES.customers}/:phone`}
          element={gate('customers', <CustomerDetailRoute port={ports.customers} />)}
        />
        <Route path={NAV_ROUTES.warranty} element={gate('warranty', <WarrantyLookupScreen port={ports.warranty} />)} />
        <Route
          path={NAV_ROUTES.settings}
          element={gate(
            'settings',
            <CustomerSourceConfigScreen port={ports.customerSources} settingsPort={ports.settings} />,
          )}
        />
        <Route
          path={NAV_ROUTES.profile}
          element={gate('profile', <ProfileScreen port={ports.password} onLogout={onLogout} />)}
        />
        <Route path="*" element={<Navigate to={landing} replace />} />
      </Routes>
    </SidebarNavContext.Provider>
  );
}

/** The router hands back the decoded segment, so `%2B84…` arrives as `+84…`. */
function CustomerDetailRoute({ port }: { port: CustomersPort }) {
  const { phone = '' } = useParams();
  return <CustomerDetailScreen port={port} sdt={phone} />;
}
