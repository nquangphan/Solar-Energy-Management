// hand-authored — web-only design-system component (Story 1.6).
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

/**
 * Controlled bottom sheet (AC-3). For QUICK CHOICES only (UX-DR-20). Money/data
 * actions with a consequence (Chốt/Huỷ/Duyệt/ghi thanh toán) MUST use <Dialog>,
 * not a Sheet. Floats via a 1.5px ink border on a bottom-anchored .scrim — no
 * drop-shadow (Viền nét, UX-DR-4).
 *
 * Same overlap/close rules as Dialog: `!open` → null; Esc closes the top overlay
 * (UX-DR-26); backdrop click closes; clicking inside does not.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest-ref for onClose so the effect keys on [open] only — see Dialog.tsx.
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

  return (
    <div className="scrim scrim--sheet" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grab" />
        {title && (
          <div className="modal-head">
            <span className="mt">{title}</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              aria-label="Đóng"
              onClick={onClose}
            >
              <Icon name="ic-close" />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
