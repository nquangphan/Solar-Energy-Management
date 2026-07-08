// hand-authored — web-only design-system component (Story 1.6).
import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Banner } from './Banner';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title?: ReactNode;
  consequence: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Thin wrapper over <Dialog> that standardizes the "Confirm = dialog stating the
 * consequence" pattern (UX-DR-19, consequential UX-DR-20). The consequence is
 * shown in a <Banner> (danger tone → danger banner, else warn).
 *
 * `onConfirm` emits INTENT only — it does not change status or call any API. The
 * feature screen wires it to the backend (AD-11).
 */
export function ConfirmDialog({
  open,
  title,
  consequence,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const footer = (
    <>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="button" variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </>
  );
  return (
    <Dialog open={open} title={title} onClose={onCancel} tone={tone} footer={footer}>
      <Banner tone={tone === 'danger' ? 'danger' : 'warn'}>{consequence}</Banner>
    </Dialog>
  );
}
