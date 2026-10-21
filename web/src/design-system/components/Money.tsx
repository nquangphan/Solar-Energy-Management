// hand-authored — web design-system component. Flutter twin: `MoneyText` in
// mobile/lib/design_system/components/money_text.dart.
import { formatVnd } from './format-vnd';

export interface MoneyProps {
  /** Integer amount of đồng, exactly as the backend returned it (AD-10/16). */
  value: number;
}

/**
 * Displays a money value as `83.010.960 đ` through `formatVnd`, with the `mono`
 * token (tabular figures, right-aligned) so columns of amounts line up. Every
 * screen renders money through this component (or `formatVnd` where a plain
 * string is required) — the money-render guard in design-system/money fails on
 * a raw `{x.amount}` / `String(x.total)`.
 *
 * Never clips (UX-DR-26): no overflow/ellipsis, the full figure always renders.
 * The text itself is what a screen reader announces.
 */
export function Money({ value }: MoneyProps) {
  return <span className="mono">{formatVnd(value)}</span>;
}
