// hand-authored — web-only design-system component (Story 1.6).
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';

// Focusable descendants inside a modal, in DOM order (for the Tab trap).
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  tone?: 'default' | 'danger';
  footer?: ReactNode;
  closeLabel?: string;
  children: ReactNode;
}

/**
 * Controlled, stateless dialog (AC-3, UX-DR-20). Used web + mobile for
 * consequential money/data actions (Chốt/Huỷ/Duyệt/ghi thanh toán). Floats via a
 * 1.5px ink border on a dimmed .scrim — no drop-shadow (Viền nét, UX-DR-4).
 *
 * Overlap ≤ 1 level (UX-DR-20): when `!open` this returns null (each dialog hides
 * itself); do NOT nest a Dialog inside a Dialog. Esc closes the top overlay
 * (UX-DR-26); clicking the backdrop closes; clicking inside the modal does not.
 *
 * Intent-only: it collects the user's intent and calls back — it never mutates
 * Order.status. Status transitions are backend applyTransition (AD-11).
 */
export function Dialog({
  open,
  title,
  onClose,
  tone = 'default',
  footer,
  closeLabel = 'Đóng',
  children,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Read onClose through a latest-ref so the focus/listener effect can key on
  // [open] only. Callers pass an inline onClose arrow (new identity each render);
  // depending on it would re-run this effect on every commit while open and
  // yank focus back to the modal — stealing it from inputs inside children.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const modal = ref.current;
    // Remember what had focus so we can restore it on close (keyboard/SR users
    // keep their place instead of being dropped to <body>).
    const restoreTo = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // Focus trap: aria-modal="true" promises focus stays inside the dialog.
      if (e.key !== 'Tab' || !modal) return;
      const items = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        modal.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === modal)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    modal?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreTo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const modalCls = ['modal', tone === 'danger' && 'card--ink'].filter(Boolean).join(' ');
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className={modalCls}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="mt" id={titleId}>{title}</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <Icon name="ic-close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
