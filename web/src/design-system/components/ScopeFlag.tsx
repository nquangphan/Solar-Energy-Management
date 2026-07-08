// hand-authored — web-only design-system component (Story 1.4).
import type { ReactNode } from 'react';

export interface ScopeFlagProps {
  // on = teal border + teal-700 text; off = line border + muted, line-through.
  on: boolean;
  // Scope/permission label.
  children: ReactNode;
  className?: string;
}

/**
 * Scope/permission display flag (.scope-flag, UX-DR-7). This is a display flag,
 * NOT a toggle — it does not change state on click. A screen owns the
 * on/off decision; this primitive only renders it. Static <span>.
 */
export function ScopeFlag({ on, children, className }: ScopeFlagProps) {
  const cls = ['scope-flag', on ? 'on' : 'off', className].filter(Boolean).join(' ');
  return <span className={cls}>{children}</span>;
}
