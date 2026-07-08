// hand-authored — web-only design-system component (Story 1.4).
import type { ReactNode } from 'react';

export interface CustomerTypeChipProps {
  // Customer type label, e.g. "Thợ khảo sát".
  children: ReactNode;
  className?: string;
}

/**
 * Customer-type flag (.ktype — lime-bordered pill, AC-1). Static, non-interactive
 * span; lime is the restrained "customer type" accent (DESIGN.md).
 */
export function CustomerTypeChip({ children, className }: CustomerTypeChipProps) {
  const cls = ['ktype', className].filter(Boolean).join(' ');
  return <span className={cls}>{children}</span>;
}
