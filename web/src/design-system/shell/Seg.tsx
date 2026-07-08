// hand-authored — web-only app-shell component (Story 1.9, mockup `.seg` CSS
// 304-306). Segmented control: a bordered pill row, active item filled teal.
// Pure presentation — clicking only EMITS `onSelect(key)`; never changes nav
// state itself (AD-1/2). Items are anchors for CSS/semantics, so preventDefault.
import type { MouseEvent } from 'react';

export interface SegOption {
  key: string;
  label: string;
}

export interface SegProps {
  options: SegOption[];
  activeKey?: string;
  onSelect?: (key: string) => void;
}

export function Seg({ options, activeKey, onSelect }: SegProps) {
  const select = (key: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onSelect?.(key);
  };
  return (
    <div className="seg">
      {options.map((opt) => (
        <a
          key={opt.key}
          href="#"
          className={opt.key === activeKey ? 'active' : undefined}
          onClick={select(opt.key)}
        >
          {opt.label}
        </a>
      ))}
    </div>
  );
}
