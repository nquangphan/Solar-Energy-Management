// hand-authored — web-only design-system component (Story 1.3).
import type { ButtonHTMLAttributes } from 'react';

// Union types block ad-hoc variants (pattern from Icon/IconName, Story 1.2).
// `default` = the outline base (.btn, teal 1.5px border) — no modifier class.
export type ButtonVariant = 'default' | 'primary' | 'accent' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'wide';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Flat "Viền nét" button. Renders a native <button> so type/onClick/disabled/
 * aria-* flow through via ...rest. Put an <Icon> in children — CSS `.btn .icn`
 * forces it to 15px.
 */
export function Button({ variant = 'default', size, className, children, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size && `btn--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
