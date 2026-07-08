// hand-authored — web-only app-shell component (Story 1.9). Web parity of the
// mobile AppTopbar (mobile/lib/design_system/shell/app_topbar.dart), mirroring
// the canonical `.topbar` CSS 232-241. Flat "Viền nét": surface fill + a 1.5px
// ink border-bottom, no elevation.
//
// Pure presentation: `onBack`/`onAction` only EMIT intent — never routes/pops
// (AD-1/2). The eyebrow is shown VERBATIM (the caller passes it already
// uppercased) so parity with mobile is byte-for-byte — NO implicit
// `.toUpperCase()` here. Back is a <button> (an action, not navigation) with an
// aria-label since it is icon-only.
import type { ReactNode } from 'react';

import { Icon } from '../icons/Icon';

export interface TopbarProps {
  title: string;
  /** Micro-uppercase label above the title. Shown verbatim. */
  eyebrow?: string;
  /** Fired on back tap. When undefined, no back button renders. */
  onBack?: () => void;
  /** Right-hand action content (a text node or an `<Icon size={15}/>`). */
  action?: ReactNode;
  /** Fired when `action` is tapped. */
  onAction?: () => void;
  /** Accessible name for the action — required when `action` is icon-only. */
  actionLabel?: string;
}

export function Topbar({ title, eyebrow, onBack, action, onAction, actionLabel }: TopbarProps) {
  return (
    <div className="topbar">
      {onBack && (
        <button
          type="button"
          className="topbar-back"
          aria-label="Quay lại"
          onClick={onBack}
        >
          <Icon name="ic-chevron-left" size={18} />
        </button>
      )}
      <div className="topbar-title">
        {eyebrow && <span className="topbar-eyebrow">{eyebrow}</span>}
        {title}
      </div>
      {action && (
        <button
          type="button"
          className="topbar-action"
          aria-label={actionLabel}
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </div>
  );
}
