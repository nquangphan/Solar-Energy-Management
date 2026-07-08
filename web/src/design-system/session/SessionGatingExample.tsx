// hand-authored — DEMO compose point (Story 2.6, Task 4). The real office
// screens are Epic 3+; this minimal component demonstrates the ONE wiring the
// story delivers: nav + revenue surface gated by the `/me` session provider,
// NOT by the Epic 1 `DEMO_PERMISSIONS` stub. It builds no router/app-runtime
// (YAGNI, deferred) — a caller wraps it in a `PermissionsProvider`.
//
// GATING IS UX ONLY (AD-4): the hidden Audit item / null revenue is convenience;
// the backend enforces every request (Story 2.5).

import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { Gate } from '../gating/Gate';
import { PERM, filterNav } from '../gating/permissions';
import { Sidebar, SIDEBAR_NAV } from '../shell/Sidebar';
import { usePermissions } from './use-permissions';

/**
 * Renders the sidebar filtered by the effective permission set and a revenue
 * figure gated behind `dashboard.finance_view`. Loading → `Skeleton`; error →
 * `ErrorState` (design-system components, AD-13 — no ad-hoc UI).
 *
 * The gating primitives are UNCHANGED (Story 1.10 promise): `filterNav`/`Gate`
 * keep their signatures; only the SOURCE of `perms` is now the provider.
 */
export function SessionGatingExample() {
  const { status, perms } = usePermissions();

  if (status === 'loading') return <Skeleton />;
  if (status === 'error') return <ErrorState message="Không tải được quyền" />;

  // Nav is filtered by the provider's perms — the sidebar renders exactly what
  // it is handed (no gating inside Sidebar, Story 1.9/1.10).
  const sections = filterNav(SIDEBAR_NAV, perms);

  return (
    <div>
      <Sidebar sections={sections} />
      <Gate perms={perms} requires={PERM.dashboardFinanceView}>
        <div className="mono">1.250.000.000 ₫</div>
      </Gate>
    </div>
  );
}
