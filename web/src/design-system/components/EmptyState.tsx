// hand-authored — web-only design-system component (Story 1.6).
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/sprite';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode; // slot — usually a <Button>
}

/**
 * Centered empty state (AC-2, UX-DR-19). Used for BOTH empty lists ("Chưa có đơn
 * nào…") and phone-search-empty ("SĐT chưa có trong hệ thống." + a "Tạo khách
 * hàng mới" action button).
 *
 * Vietnamese copy is NOT hard-coded here — the SCREEN passes title/message/action
 * so this stays reusable across screens (i18n-friendly).
 */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '22px 16px' }}>
      {icon && <Icon name={icon} size={22} />}
      <div className="micro" style={{ fontWeight: 800 }}>
        {title}
      </div>
      {message && <p style={{ fontSize: 12 }}>{message}</p>}
      {action}
    </div>
  );
}
