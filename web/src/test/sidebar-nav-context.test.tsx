// SidebarNavContext: the app layer reaches every screen's Sidebar without a prop on
// each screen. A caller's own onNavigate prop still wins, and `availableKeys` drops
// links the app has no screen for (and any section they leave empty).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Sidebar, SidebarNavContext } from '../design-system/shell';
import type { NavSection } from '../design-system/shell';

afterEach(cleanup);

const SECTIONS: NavSection[] = [
  {
    links: [
      { key: 'home', icon: 'ic-home', label: 'Trang chủ' },
      { key: 'customers', icon: 'ic-customer', label: 'Khách hàng' },
    ],
  },
  {
    title: 'Quản trị',
    links: [{ key: 'audit', icon: 'ic-audit', label: 'Audit' }],
  },
];

describe('SidebarNavContext', () => {
  it('a click emits the key through the context when no prop is given', () => {
    const onNavigate = vi.fn();
    render(
      <SidebarNavContext.Provider value={{ onNavigate }}>
        <Sidebar sections={SECTIONS} />
      </SidebarNavContext.Provider>,
    );
    fireEvent.click(screen.getByText('Khách hàng'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('customers');
  });

  it('the onNavigate prop wins over the context', () => {
    const fromContext = vi.fn();
    const fromProp = vi.fn();
    render(
      <SidebarNavContext.Provider value={{ onNavigate: fromContext }}>
        <Sidebar sections={SECTIONS} onNavigate={fromProp} />
      </SidebarNavContext.Provider>,
    );
    fireEvent.click(screen.getByText('Trang chủ'));
    expect(fromProp).toHaveBeenCalledTimes(1);
    expect(fromProp).toHaveBeenCalledWith('home');
    expect(fromContext).toHaveBeenCalledTimes(0);
  });

  it('availableKeys drops unknown links and the sections they leave empty', () => {
    render(
      <SidebarNavContext.Provider value={{ availableKeys: new Set(['customers']) }}>
        <Sidebar sections={SECTIONS} />
      </SidebarNavContext.Provider>,
    );
    expect(screen.getByText('Khách hàng')).toBeTruthy();
    expect(screen.queryByText('Trang chủ')).toBeNull();
    expect(screen.queryByText('Audit')).toBeNull();
    expect(screen.queryByText('Quản trị')).toBeNull();
  });

  it('without a provider every link stays (Story 1.9 behaviour)', () => {
    render(<Sidebar sections={SECTIONS} />);
    for (const label of ['Trang chủ', 'Khách hàng', 'Quản trị', 'Audit']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
