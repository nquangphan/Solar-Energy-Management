// hand-authored — web-only app-shell component (Story 1.9, mockup `.search` CSS
// 303 + 320). Reuses the shipped `.field` input (Story 1.3) wrapped in `.search`
// with an absolutely-positioned `.si` search icon; `.field` reserves 32px on the
// left. All native input props (placeholder/value/onChange/...) flow via ...rest
// — no business logic here.
import type { InputHTMLAttributes } from 'react';

import { Icon } from '../icons/Icon';

export type SearchFieldProps = InputHTMLAttributes<HTMLInputElement>;

export function SearchField({ className, ...rest }: SearchFieldProps) {
  const cls = ['field', className].filter(Boolean).join(' ');
  return (
    <div className="search">
      <span className="si">
        <Icon name="ic-search" size={16} />
      </span>
      <input className={cls} {...rest} />
    </div>
  );
}
