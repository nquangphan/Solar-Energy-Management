// hand-authored — web-only design-system component (Story 1.6).
import { Button } from './Button';
import type { ButtonVariant } from './Button';
import { Icon } from '../icons/Icon';
import { shareFiles } from './share';
import type { ShareResult } from './share';

export interface ShareButtonProps {
  files?: File[];
  title?: string;
  text?: string;
  label?: string;
  variant?: ButtonVariant;
  onResult?: (result: ShareResult) => void;
}

/**
 * Thin share trigger (AC-4). Calls shareFiles() → native share or download
 * fallback. Web uses the OS share sheet (navigator.share); it does NOT draw a
 * grid of share apps (Zalo/Messenger…) — that is a native/Flutter visual
 * (Story 1.7).
 */
export function ShareButton({
  files,
  title,
  text,
  label = 'Share',
  variant = 'default',
  onResult,
}: ShareButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => shareFiles({ files, title, text }).then(onResult)}
    >
      <Icon name="ic-share" /> {label}
    </Button>
  );
}
