// hand-authored — web-only design-system component (Story 1.3).
import type { HTMLAttributes } from 'react';

// `default` = line-border card; ink/teal are the accent-border variants.
export type CardVariant = 'default' | 'ink' | 'teal';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

/** Flat card: white surface + 1.5px border + radius-lg (no elevation). */
export function Card({ variant = 'default', className, children, ...rest }: CardProps) {
  const cls = ['card', variant !== 'default' && `card--${variant}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
