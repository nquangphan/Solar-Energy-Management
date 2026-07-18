// hand-authored — web-only app-shell component (Story 1.9, mirror mockup
// all-screens.html `.sidebar` CSS 282-293 + markup 599-610). Flat "Viền nét":
// surface-2 fill + a 1.5px line right border, no elevation.
//
// Pure presentation: clicking a link only EMITS `onNavigate(key)` — the sidebar
// never routes or navigates (AD-1/2). Unlike the mobile bottom-nav (5 tabs
// locked via an internal constant), the web nav is passed in via the `sections`
// prop, because Story 1.10 gates it per-permission — the sidebar renders exactly
// what the caller hands it, nothing more (no gating here). SIDEBAR_NAV is the
// canonical default set for callers/Story 1.10 to filter.
import type { MouseEvent } from 'react';

import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/sprite';
import { PERM } from '../gating/permissions';
import type { PermissionKey } from '../gating/permissions';

export interface NavLink {
  key: string;
  icon: IconName;
  label: string;
  /**
   * Permission this link requires (Story 1.10). Callers run
   * `filterNav(SIDEBAR_NAV, perms)` BEFORE passing `sections` in; links whose
   * `requires` is unmet are dropped (a gated-out item disappears, UX-DR-22).
   * Undefined = always visible. The sidebar itself never gates — it renders
   * exactly the sections it is handed.
   */
  requires?: PermissionKey;
  /**
   * Any-of gate: the link survives when the Account holds AT LEAST ONE of these
   * keys. For an action whose permission is split across several keys, where no
   * single key is a correct gate — Đơn hàng is readable by `orders.view_all`
   * holders OR `orders.view_own` holders, and the role presets grant the first
   * without the second, so either key alone would hide the item from people who
   * may use it.
   */
  requiresAny?: readonly PermissionKey[];
}

export interface NavSection {
  /** Micro-uppercase section header (`.navsec`). Omit for the leading group. */
  title?: string;
  links: NavLink[];
}

export interface SidebarProps {
  sections: NavSection[];
  /** Key of the active link — tints it teal (`.navlink.active`). */
  activeKey?: string;
  onNavigate?: (key: string) => void;
  /** Brand mark. Defaults to the canonical `ic-sun` + "Phương Nam". */
  brand?: { icon?: IconName; label: string };
}

/**
 * Canonical default nav (mockup 601-610). Callers (and the Story 1.10 gating
 * primitive) filter this by permission — the sidebar itself holds no hard list.
 */
export const SIDEBAR_NAV: NavSection[] = [
  {
    links: [
      { key: 'home', icon: 'ic-home', label: 'Trang chủ' },
      {
        key: 'orders',
        icon: 'ic-orders',
        label: 'Đơn hàng',
        requiresAny: [PERM.ordersViewAll, PERM.ordersViewOwn],
      },
      { key: 'customers', icon: 'ic-customer', label: 'Khách hàng', requires: PERM.customersManage },
      { key: 'catalog', icon: 'ic-catalog', label: 'Danh mục' },
      { key: 'inventory', icon: 'ic-warehouse', label: 'Kho' },
      // Warranty lookup (Story 5.9) reuses `ic-phone` — the mockup uses that icon
      // for this very entry, and the icon SSOT already ships it. It carries the
      // ORDER read permissions because what it returns IS order content.
      {
        key: 'warranty',
        icon: 'ic-phone',
        label: 'Tra cứu bảo hành',
        requiresAny: [PERM.ordersViewAll, PERM.ordersViewOwn],
      },
    ],
  },
  {
    title: 'Quản trị',
    links: [
      // `ic-catalog` is reused deliberately: the icon SSOT has no gear, and adding one
      // would mean touching icons.json + the generator + its drift-guard — a different
      // story's work. The mockup itself reuses this icon here.
      { key: 'settings', icon: 'ic-catalog', label: 'Cấu hình', requires: PERM.settingsManage },
      { key: 'permissions', icon: 'ic-permissions', label: 'Phân quyền', requires: PERM.permissionsManage },
      { key: 'audit', icon: 'ic-audit', label: 'Audit', requires: PERM.auditRead },
      { key: 'profile', icon: 'ic-user', label: 'Hồ sơ' },
    ],
  },
];

export function Sidebar({ sections, activeKey, onNavigate, brand }: SidebarProps) {
  const brandIcon = brand?.icon ?? 'ic-sun';
  const brandLabel = brand?.label ?? 'Phương Nam';

  const navigate = (key: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // links are anchors for CSS/semantics — never a real jump
    onNavigate?.(key);
  };

  return (
    <nav className="sidebar">
      <div className="brand2">
        <div className="logo">
          <Icon name={brandIcon} size={18} />
        </div>
        <div className="t">{brandLabel}</div>
      </div>
      {sections.map((section, i) => (
        <div key={section.title ?? `sec-${i}`}>
          {section.title && <div className="navsec">{section.title}</div>}
          {section.links.map((link) => (
            <a
              key={link.key}
              href="#"
              className={link.key === activeKey ? 'navlink active' : 'navlink'}
              onClick={navigate(link.key)}
            >
              <Icon name={link.icon} size={16} />
              {link.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
