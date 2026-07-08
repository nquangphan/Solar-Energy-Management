// hand-authored — web-only design-system component (Story 1.5).
import type { ReactNode } from 'react';

export interface KpiProps {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  accent?: boolean; // teal border + teal-050 bg
  mono?: boolean; // tabular figures on the value (money/quantities)
}

/**
 * KPI card (AC-3, UX-DR-12). Flat line-bordered lg card: micro-uppercase label,
 * a display 23px/900 value, and an optional delta. The delta is ALWAYS ok-green
 * (CSS `.k-d` sets the color) — no delta color variant in this story. Pass
 * `mono` for numeric/currency values so columns line up (.mono, tokens.css).
 */
export function Kpi({ label, value, delta, accent, mono }: KpiProps) {
  const cls = ['kpi', accent && 'accent'].filter(Boolean).join(' ');
  const valueCls = ['k-v', mono && 'mono'].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="k-l">{label}</div>
      <div className={valueCls}>{value}</div>
      {delta && <div className="k-d">{delta}</div>}
    </div>
  );
}
