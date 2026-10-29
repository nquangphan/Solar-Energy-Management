// hand-authored — the application layer (Story 10.4): routes, route gating and the
// sidebar's navigation. It receives its ports from the composition root (main.tsx)
// and never builds an adapter itself (AD-12).
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';

import { Button, Card, ErrorState, Skeleton } from '../design-system/components';
import { can, PERMISSION_KEYS } from '../design-system/gating';
import type { PermissionKey } from '../design-system/gating';
import type {
  AccountsPort,
  AuditLogsPort,
  AuthPort,
  CatalogPort,
  ContractsPort,
  CustomerSourcesPort,
  CustomersPort,
  DashboardPort,
  InventoryPort,
  InvoicesPort,
  MePort,
  OrdersPort,
  PasswordPort,
  PaymentsPort,
  ProfitReportPort,
  SettingsPort,
  StockVouchersPort,
  WarrantyPort,
} from '../design-system/session';
import { usePermissions } from '../design-system/session';
import { SidebarNavContext, WebShell } from '../design-system/shell';
import type { SidebarNavValue } from '../design-system/shell';
import { ProfileScreen } from '../screens/account/ProfileScreen';
import { AuditLogScreen } from '../screens/audit/AuditLogScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ContractsScreen } from '../screens/contracts/ContractsScreen';
import { CustomerDetailScreen } from '../screens/customers/CustomerDetailScreen';
import { CustomerListScreen } from '../screens/customers/CustomerListScreen';
import { CustomerPickScreen } from '../screens/customers/CustomerPickScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';
import { StockVouchersScreen } from '../screens/inventory/StockVouchersScreen';
import { InvoiceDetailScreen } from '../screens/invoices/InvoiceDetailScreen';
import { InvoicesScreen } from '../screens/invoices/InvoicesScreen';
import { CreateQuoteScreen } from '../screens/orders/CreateQuoteScreen';
import { DiscountApprovalScreen } from '../screens/orders/DiscountApprovalScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { OrdersListScreen } from '../screens/orders/OrdersListScreen';
import { OrderStatusChangeScreen } from '../screens/orders/OrderStatusChangeScreen';
import { PaymentScheduleScreen } from '../screens/payments/PaymentScheduleScreen';
import { AccountFormScreen } from '../screens/permissions/AccountFormScreen';
import { PermissionsScreen } from '../screens/permissions/PermissionsScreen';
import { ProfitReportScreen } from '../screens/reports/ProfitReportScreen';
import { CustomerSourceConfigScreen } from '../screens/settings/CustomerSourceConfigScreen';
import { WarrantyLookupScreen } from '../screens/warranty/WarrantyLookupScreen';
import {
  ACCOUNT_NEW_PATH,
  AVAILABLE_NAV_KEYS,
  CUSTOMER_LOOKUP_PATH,
  DISCOUNT_APPROVALS_PATH,
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  NAV_ROUTES,
  ORDER_NEW_PATH,
  STOCK_VOUCHERS_PATH,
  accountEditPath,
  customerPath,
  landingPath,
  openableKeys,
  orderContractsPath,
  orderInvoicePath,
  orderInvoicesPath,
  orderPath,
  orderPaymentsPath,
  orderTransitionPath,
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
  catalog: CatalogPort;
  settings: SettingsPort;
  warranty: WarrantyPort;
  orders: OrdersPort;
  inventory: InventoryPort;
  stockVouchers: StockVouchersPort;
  payments: PaymentsPort;
  contracts: ContractsPort;
  invoices: InvoicesPort;
  dashboard: DashboardPort;
  accounts: AccountsPort;
  auditLogs: AuditLogsPort;
  profitReport: ProfitReportPort;
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
  // A child route that needs one more permission than its parent: the key of the
  // endpoint its screen is built on (registry constant, AD-17).
  const gateWith = (key: NavRouteKey, permission: PermissionKey, element: ReactElement) =>
    gate(key, can(perms, permission) ? element : <Navigate to={landing} replace />);
  const mayCreateQuote = can(perms, PERMISSION_KEYS.quotesCreateEdit);
  const mayApproveDiscounts = can(perms, PERMISSION_KEYS.discountsApprove);
  const mayGenerateContracts = can(perms, PERMISSION_KEYS.contractsGenerate);
  const mayManageInvoices = can(perms, PERMISSION_KEYS.invoicesManage);

  return (
    <SidebarNavContext.Provider value={nav}>
      <Routes>
        <Route path={NAV_ROUTES.home} element={gate('home', <DashboardScreen port={ports.dashboard} />)} />
        <Route
          path={NAV_ROUTES.orders}
          element={gate(
            'orders',
            <OrdersListScreen
              port={ports.orders}
              onOpen={(id) => navigate(orderPath(id))}
              onAdd={mayCreateQuote ? () => navigate(ORDER_NEW_PATH) : undefined}
              onOpenDiscountApprovals={mayApproveDiscounts ? () => navigate(DISCOUNT_APPROVALS_PATH) : undefined}
            />,
          )}
        />
        <Route
          path={ORDER_NEW_PATH}
          element={gateWith(
            'orders',
            PERMISSION_KEYS.quotesCreateEdit,
            <CreateQuoteScreen
              ordersPort={ports.orders}
              catalogPort={ports.catalog}
              customersPort={ports.customers}
              onDone={(order) => navigate(orderPath(order.id))}
            />,
          )}
        />
        <Route
          path={DISCOUNT_APPROVALS_PATH}
          element={gateWith('orders', PERMISSION_KEYS.discountsApprove, <DiscountApprovalScreen ordersPort={ports.orders} />)}
        />
        <Route
          path={`${NAV_ROUTES.orders}/:id`}
          element={gate(
            'orders',
            <ParamsRoute
              render={({ id = '' }) => (
                <OrderDetailScreen
                  port={ports.orders}
                  orderId={id}
                  onBack={() => navigate(NAV_ROUTES.orders)}
                  // The screen hides it when the backend returns no next step.
                  onChangeStatus={() => navigate(orderTransitionPath(id))}
                  // Every account that sees the order reads its schedule; writing is gated in the screen.
                  onOpenPaymentSchedule={() => navigate(orderPaymentsPath(id))}
                  onOpenContracts={mayGenerateContracts ? () => navigate(orderContractsPath(id)) : undefined}
                  onOpenInvoices={mayManageInvoices ? () => navigate(orderInvoicesPath(id)) : undefined}
                />
              )}
            />,
          )}
        />
        <Route
          path={`${NAV_ROUTES.orders}/:id/transition`}
          element={gate(
            'orders',
            <ParamsRoute
              render={({ id = '' }) => (
                <OrderStatusChangeScreen
                  port={ports.orders}
                  orderId={id}
                  onBack={() => navigate(orderPath(id))}
                  onDone={() => navigate(orderPath(id))}
                />
              )}
            />,
          )}
        />
        <Route
          path={`${NAV_ROUTES.orders}/:id/payments`}
          element={gate(
            'orders',
            <ParamsRoute
              render={({ id = '' }) => (
                <PaymentScheduleScreen port={ports.payments} orderId={id} onBack={() => navigate(orderPath(id))} />
              )}
            />,
          )}
        />
        <Route
          path={`${NAV_ROUTES.orders}/:id/contracts`}
          element={gateWith(
            'orders',
            PERMISSION_KEYS.contractsGenerate,
            <ParamsRoute
              render={({ id = '' }) => (
                <ContractsScreen port={ports.contracts} orderId={id} onBack={() => navigate(orderPath(id))} />
              )}
            />,
          )}
        />
        <Route
          path={`${NAV_ROUTES.orders}/:id/invoices`}
          element={gateWith(
            'orders',
            PERMISSION_KEYS.invoicesManage,
            <ParamsRoute
              render={({ id = '' }) => (
                <InvoicesScreen
                  port={ports.invoices}
                  orderId={id}
                  onBack={() => navigate(orderPath(id))}
                  onOpenInvoice={(invoiceId) => navigate(orderInvoicePath(id, invoiceId))}
                />
              )}
            />,
          )}
        />
        <Route
          path={`${NAV_ROUTES.orders}/:id/invoices/:invoiceId`}
          element={gateWith(
            'orders',
            PERMISSION_KEYS.invoicesManage,
            <ParamsRoute
              render={({ id = '', invoiceId = '' }) => (
                <InvoiceDetailScreen
                  port={ports.invoices}
                  orderId={id}
                  invoiceId={invoiceId}
                  onBack={() => navigate(orderInvoicesPath(id))}
                />
              )}
            />,
          )}
        />
        <Route
          path={NAV_ROUTES.inventory}
          element={gate(
            'inventory',
            <InventoryScreen port={ports.inventory} onOpenVouchers={() => navigate(STOCK_VOUCHERS_PATH)} />,
          )}
        />
        <Route
          path={STOCK_VOUCHERS_PATH}
          element={gateWith(
            'inventory',
            PERMISSION_KEYS.inventoryManage,
            <StockVouchersScreen
              port={ports.stockVouchers}
              inventoryPort={ports.inventory}
              onBack={() => navigate(NAV_ROUTES.inventory)}
            />,
          )}
        />
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
          path={NAV_ROUTES.permissions}
          element={gate(
            'permissions',
            <PermissionsRoute
              port={ports.accounts}
              onCreate={() => navigate(ACCOUNT_NEW_PATH)}
              onEdit={(id) => navigate(accountEditPath(id))}
            />,
          )}
        />
        {/* Children of Phân quyền (same gate); the static `new` is declared before `:id/edit`. */}
        <Route
          path={ACCOUNT_NEW_PATH}
          element={gate(
            'permissions',
            <AccountFormScreen
              port={ports.accounts}
              onDone={(id) => navigate(NAV_ROUTES.permissions, { state: { selectAccountId: id } })}
              onCancel={() => navigate(NAV_ROUTES.permissions)}
            />,
          )}
        />
        <Route
          path={`${NAV_ROUTES.permissions}/:id/edit`}
          element={gate(
            'permissions',
            <ParamsRoute
              render={({ id = '' }) => (
                <AccountFormScreen
                  port={ports.accounts}
                  accountId={id}
                  onDone={(saved) => navigate(NAV_ROUTES.permissions, { state: { selectAccountId: saved } })}
                  onCancel={() => navigate(NAV_ROUTES.permissions, { state: { selectAccountId: id } })}
                />
              )}
            />,
          )}
        />
        <Route path={NAV_ROUTES.audit} element={gate('audit', <AuditLogScreen port={ports.auditLogs} />)} />
        <Route path={NAV_ROUTES.profit} element={gate('profit', <ProfitReportScreen port={ports.profitReport} />)} />
        <Route
          path={NAV_ROUTES.profile}
          element={gate('profile', <ProfileScreen port={ports.password} onLogout={onLogout} />)}
        />
        <Route path="*" element={<Navigate to={landing} replace />} />
      </Routes>
    </SidebarNavContext.Provider>
  );
}

/** Hands the route's (decoded) params to `render` — the order screens take their ids as props. */
function ParamsRoute({ render }: { render: (params: Readonly<Partial<Record<string, string>>>) => ReactElement }) {
  return render(useParams());
}

/**
 * Phân quyền reads the account to select from the navigation state the account form leaves
 * behind (create/edit ⇒ back to the matrix of that account). The screen itself stays router-free.
 */
function PermissionsRoute(props: { port: AccountsPort; onCreate: () => void; onEdit: (id: string) => void }) {
  const state = useLocation().state as { selectAccountId?: unknown } | null;
  const selectAccountId = typeof state?.selectAccountId === 'string' ? state.selectAccountId : undefined;
  return <PermissionsScreen {...props} selectAccountId={selectAccountId} />;
}

/** The router hands back the decoded segment, so `%2B84…` arrives as `+84…`. */
function CustomerDetailRoute({ port }: { port: CustomersPort }) {
  const { phone = '' } = useParams();
  return <CustomerDetailScreen port={port} sdt={phone} />;
}
