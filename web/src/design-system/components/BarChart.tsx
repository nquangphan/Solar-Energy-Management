// hand-authored — design-system component (Story 8.1, mockup `.chart` CSS
// all-screens.html 154-157). Mirror: mobile bar_chart.dart (AppBarChart).

export interface BarChartItem {
  label: string;
  value: number;
}

export interface BarChartProps {
  items: BarChartItem[];
}

/** Lowest bar height (%), so a zero still shows where its column is. */
const MIN_BAR_PCT = 2;

/**
 * Column chart of COUNTS (never money — money is not scaled or compared on the
 * client, AD-2). Each column is scaled against the largest value; the count sits
 * above the column and the label below it. All zeros ⇒ every column at the
 * minimum height, no division.
 */
export function BarChart({ items }: BarChartProps) {
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <div className="chart">
      {items.map((item) => {
        const pct =
          max === 0
            ? MIN_BAR_PCT
            : Math.max(MIN_BAR_PCT, Math.round((item.value * 100) / max));
        return (
          <div key={item.label} className="bar" style={{ height: `${pct}%` }}>
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
