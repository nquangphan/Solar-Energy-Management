// The count chart: one column per item, label + count, heights scaled against
// the largest count, and a minimum height (no division) when every count is 0.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BarChart } from '../design-system/components';

afterEach(cleanup);

const heights = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('.chart .bar')].map(
    (bar) => bar.style.height,
  );

describe('BarChart', () => {
  it('renders one column per item with its label and count, in order', () => {
    const { container } = render(
      <BarChart
        items={[
          { label: 'Báo giá', value: 12 },
          { label: 'Chờ duyệt', value: 4 },
        ]}
      />,
    );
    const bars = [...container.querySelectorAll('.chart .bar')];
    expect(bars.map((bar) => bar.querySelector('span')?.textContent)).toEqual([
      'Báo giá',
      'Chờ duyệt',
    ]);
    expect(bars.map((bar) => bar.querySelector('b')?.textContent)).toEqual([
      '12',
      '4',
    ]);
  });

  it('scales each column against the largest count', () => {
    const { container } = render(
      <BarChart
        items={[
          { label: 'a', value: 8 },
          { label: 'b', value: 2 },
          { label: 'c', value: 0 },
        ]}
      />,
    );
    expect(heights(container)).toEqual(['100%', '25%', '2%']);
  });

  it('all zeros ⇒ every column at the minimum height, no NaN', () => {
    const { container } = render(
      <BarChart
        items={[
          { label: 'a', value: 0 },
          { label: 'b', value: 0 },
        ]}
      />,
    );
    expect(heights(container)).toEqual(['2%', '2%']);
  });
});
