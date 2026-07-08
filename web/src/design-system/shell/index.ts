// hand-authored — app-shell barrel (Story 1.9).
//
// CSS load order (contract): shell.css MUST be imported AFTER tokens.css (token
// vars), icons.css (svg.icn base) AND components.css (reuses `.field` + the
// `.kpis` 4-col base), because the shell rules consume all three. The app entry
// (built in a later web-app story) owns the order, e.g.:
//   import '../tokens/tokens.css';
//   import '../icons/icons.css';
//   import '../components/components.css';
//   import './shell.css';
// No bundler/entry exists in the repo yet (YAGNI) — this note is the contract.
//
// This barrel exports ONLY the shell layer. Import tokens/icons/components
// directly from their own modules (same policy as components/index.ts).

export { Topbar } from './Topbar';
export type { TopbarProps } from './Topbar';

export { Sidebar, SIDEBAR_NAV } from './Sidebar';
export type { SidebarProps, NavSection, NavLink } from './Sidebar';

export { WebFrame } from './WebFrame';
export type { WebFrameProps } from './WebFrame';

export { Toolbar } from './Toolbar';
export type { ToolbarProps } from './Toolbar';

export { Seg } from './Seg';
export type { SegProps, SegOption } from './Seg';

export { Tabs } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';

export { SearchField } from './SearchField';
export type { SearchFieldProps } from './SearchField';

export { WebShell } from './WebShell';
export type { WebShellProps } from './WebShell';
