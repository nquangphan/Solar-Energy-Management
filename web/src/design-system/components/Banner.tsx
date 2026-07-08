// hand-authored — web-only design-system component (Story 1.5).
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/sprite';

// `warn` = the base `.banner` (no modifier class); info/danger add `banner--*`.
export type BannerTone = 'warn' | 'info' | 'danger';

export interface BannerProps {
  tone?: BannerTone;
  icon?: IconName; // optional left icon (warn/danger usually carry one; info often not)
  /**
   * ARIA live role for dynamically-shown banners (e.g. form validation errors):
   * 'alert' announces assertively, 'status' politely. Omit for static banners.
   */
  role?: 'alert' | 'status';
  children: ReactNode;
}

/**
 * Semantic banner (AC-4, UX-DR-13). Flat 1.5px-bordered strip on a soft
 * semantic bg. Always carries a text label (a11y floor, UX-DR-26) — the icon is
 * auxiliary and optional. Wrap emphasis in <b> in children (CSS `.banner b`
 * makes it weight 800).
 */
export function Banner({ tone = 'warn', icon, role, children }: BannerProps) {
  const cls = ['banner', tone !== 'warn' && `banner--${tone}`].filter(Boolean).join(' ');
  return (
    <div className={cls} role={role}>
      {icon && <Icon name={icon} />}
      {children}
    </div>
  );
}
