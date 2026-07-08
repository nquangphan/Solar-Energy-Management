// hand-authored — web-only app-shell component (Story 1.9, mockup `.tabs` CSS
// 307-308). Underline tab row, active item underlined teal. Pure presentation —
// clicking only EMITS `onSelect(key)`; never changes nav state itself (AD-1/2).
// Items are anchors for CSS/semantics, so preventDefault.
import type { MouseEvent } from 'react';

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey?: string;
  onSelect?: (key: string) => void;
}

export function Tabs({ tabs, activeKey, onSelect }: TabsProps) {
  const select = (key: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onSelect?.(key);
  };
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href="#"
          className={tab.key === activeKey ? 'active' : undefined}
          onClick={select(tab.key)}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}
