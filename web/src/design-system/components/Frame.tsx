// hand-authored — web-only design-system component (Story 1.3).
import type { HTMLAttributes } from 'react';

export interface FrameProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  // Set when the frame sits on the --bg surface, so .frame-label masks the
  // border with the page background instead of white (.frame.on-bg).
  onBg?: boolean;
}

/**
 * Blueprint frame: ink 1.5px border with a micro-uppercase label floating on
 * the border (technical-drawing motif).
 */
export function Frame({ label, onBg = false, className, children, ...rest }: FrameProps) {
  const cls = ['frame', onBg && 'on-bg', className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      <span className="frame-label">{label}</span>
      {children}
    </div>
  );
}
