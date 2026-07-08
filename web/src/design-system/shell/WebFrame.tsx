// hand-authored — web-only app-shell component (Story 1.9, mirror mockup
// all-screens.html `.web`/`.web-chrome` CSS 272-280 + markup 594-598). Flat
// "Viền nét": 1.5px ink border + radius-lg, no elevation.
//
// The faux browser chrome (3 dots + url pill) is pure decoration: `url` is a
// display-only string, NOT a link — the frame never navigates (AD-1/2). Exactly
// 3 dots, rendered literally (never mapped from an array — the count is fixed).
import type { ReactNode } from 'react';

export interface WebFrameProps {
  /** Display-only URL shown in the address pill. Not a real link. */
  url: string;
  children: ReactNode;
}

export function WebFrame({ url, children }: WebFrameProps) {
  return (
    <div className="web">
      <div className="web-chrome">
        <div className="web-dots">
          <i />
          <i />
          <i />
        </div>
        <div className="web-url">{url}</div>
      </div>
      <div className="web-app">{children}</div>
    </div>
  );
}
