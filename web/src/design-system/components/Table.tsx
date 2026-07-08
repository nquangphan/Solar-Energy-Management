// hand-authored — web-only design-system component (Story 1.5).
import type { TableHTMLAttributes } from 'react';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {}

/**
 * Dense "Viền nét" table (AC-1). A thin wrapper: renders a native <table
 * className="table"> so the CSS targets `.table th/td/tr` directly — there are
 * NO Th/Td/Tr sub-components (YAGNI; the CSS never needs them).
 *
 * Screens write their own thead/tbody/tr/th/td and apply these class contracts
 * on the elements:
 *   - `.num`     — right-align a numeric cell.
 *   - `.strong`  — emphasize a value (ink + weight 800).
 *   - `.mono`    — tabular figures for money/quantities/codes (tokens.css).
 *   - `tr.zebra` — striped row (#F7FBFA).
 */
export function Table({ className, children, ...rest }: TableProps) {
  const cls = ['table', className].filter(Boolean).join(' ');
  return (
    <table className={cls} {...rest}>
      {children}
    </table>
  );
}
