// hand-authored — web permission provider (Story 2.6, mirror Flutter
// mobile/lib/design_system/session/app_session.dart `PermissionsProvider` +
// `PermissionsScope`). React context that fetches `/me` through an injected
// `MePort`, maps it to a `PermissionSet`, and exposes it to the widget tree so
// the gating primitives (`filterNav`/`Gate`/`orderScope`) read the REAL set —
// replacing the Epic 1 `DEMO_PERMISSIONS` stub as the session source.
//
// GATING IS UX ONLY (AD-4): this set decides what the UI shows; the backend
// enforces every request (Story 2.5). The provider holds NO business logic and
// touches NO DB (AD-1/2) — it only calls the port and maps the payload.
//
// NOTE: web has no bundler/tsc yet (project-context defers web-runtime), so this
// file is guarded by the Node text-guard + parity tests, not a React runtime.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { PermissionSet } from '../gating/permissions';
import type { MePort } from './me-port';
import { toPermissionSet } from './session';
import type { SessionStatus } from './session';

/** The minimal session state exposed to consumers. */
export interface PermissionsState {
  status: SessionStatus;
  perms: PermissionSet;
}

const EMPTY_PERMS: PermissionSet = new Set<string>();

const PermissionsContext = createContext<PermissionsState>({
  status: 'loading',
  perms: EMPTY_PERMS,
});

export interface PermissionsProviderProps {
  /** Injected transport (real HTTP port in app-runtime; `FakeMePort` in tests). */
  port: MePort;
  children: ReactNode;
}

/**
 * Fetches `/me` once via `port`, then provides `{ status, perms }`. While
 * `status === 'loading'` the shell shows a `Skeleton`; on failure `status`
 * becomes `'error'` and the shell shows a `Banner`/`ErrorState` (design-system
 * components — no ad-hoc UI, AD-13). No caching/persistence (YAGNI): the session
 * is in-memory; a re-login refreshes it once app-runtime lands.
 */
export function PermissionsProvider({ port, children }: PermissionsProviderProps) {
  const [state, setState] = useState<PermissionsState>({
    status: 'loading',
    perms: EMPTY_PERMS,
  });

  useEffect(() => {
    let alive = true;
    port
      .fetchMe()
      .then((me) => {
        if (alive) setState({ status: 'ready', perms: toPermissionSet(me) });
      })
      .catch(() => {
        if (alive) setState({ status: 'error', perms: EMPTY_PERMS });
      });
    return () => {
      alive = false;
    };
  }, [port]);

  return <PermissionsContext.Provider value={state}>{children}</PermissionsContext.Provider>;
}

/** Raw context access — prefer `usePermissions()` for the derived selectors. */
export function usePermissionsContext(): PermissionsState {
  return useContext(PermissionsContext);
}
