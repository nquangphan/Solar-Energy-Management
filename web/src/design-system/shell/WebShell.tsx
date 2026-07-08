// hand-authored — web-only app-shell scaffold (Story 1.9, mockup markup
// 594-615). Assembles WebFrame > .web-app = [sidebar?] + .main[topbar? +
// children]. Pure layout: no routing, no gating, no business logic (AD-1/2).
//
// `sidebar` is a slot: pass a <Sidebar/> for office screens, or `null` for auth
// screens (Đăng nhập / Quên mật khẩu) so no nav renders — parity with mobile
// passing bottomNav:null (UX-DR-15). The shell never decides when to hide nav;
// the caller does.
import type { ReactNode } from 'react';

import { WebFrame } from './WebFrame';

export interface WebShellProps {
  /** Display-only URL for the browser-chrome pill. */
  url: string;
  /** Left nav slot — a <Sidebar/>, or null (e.g. auth screens). */
  sidebar?: ReactNode;
  /** Optional <Topbar/> above the content. */
  topbar?: ReactNode;
  children: ReactNode;
}

export function WebShell({ url, sidebar, topbar, children }: WebShellProps) {
  return (
    <WebFrame url={url}>
      {sidebar}
      <div className="main">
        {topbar}
        {children}
      </div>
    </WebFrame>
  );
}
