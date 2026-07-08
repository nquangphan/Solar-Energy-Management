// hand-authored — web-only design-system component (Story 1.6).
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';

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
  // Read onClose through a latest-ref so the focus/listener effect can key on
  // [open] only. Callers pass an inline onClose arrow (new identity each render);
  // depending on it would re-run this effect on every commit while open and
  // yank focus back to the modal — stealing it from inputs inside children.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const modalCls = ['modal', tone === 'danger' && 'card--ink'].filter(Boolean).join(' ');
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className={modalCls}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="mt">{title}</span>
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
