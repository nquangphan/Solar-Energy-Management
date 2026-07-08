// hand-authored — web-only app-shell component (Story 1.9, mockup `.toolbar`
// CSS 302). Layout-only wrapper: a flex-wrap row that hosts SearchField / Seg /
// Tabs and any other toolbar controls. No business logic.
import type { ReactNode } from 'react';

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

export function Toolbar({ children, className }: ToolbarProps) {
  const cls = ['toolbar', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}
