// hand-authored — web-only design-system component (Story 1.6).
import { Banner } from './Banner';
import { Button } from './Button';
import { Icon } from '../icons/Icon';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * List/load error state (AC-2, UX-DR-19): a specific danger Banner + an optional
 * "Thử lại" retry button. Reuses the shipped <Banner>/<Button> — it does not
 * rebuild a banner.
 */
export function ErrorState({ message, onRetry, retryLabel = 'Thử lại' }: ErrorStateProps) {
  return (
    <div>
      <Banner tone="danger" icon="ic-alert">
        {message}
      </Banner>
      {onRetry && (
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          <Icon name="ic-refresh" /> {retryLabel}
        </Button>
      )}
    </div>
  );
}
