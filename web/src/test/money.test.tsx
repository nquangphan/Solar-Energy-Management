// The web money display: <Money> renders formatVnd's string inside the `mono`
// token, and formatVnd refuses anything that is not a safe integer of đồng.
// Byte-for-byte parity with Flutter is pinned by design-system/money (shared
// fixture vnd-format-cases.json).
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { formatVnd, Money } from '../design-system/components';

afterEach(cleanup);

describe('Money', () => {
  it('displays "83.010.960 đ" with the mono token, not the raw integer', () => {
    render(<Money value={83010960} />);
    const el = screen.getByText('83.010.960 đ');
    expect(el.className).toBe('mono');
    expect(screen.queryByText('83010960')).toBeNull();
  });

  it('displays 0 and negatives in the decided format', () => {
    render(
      <>
        <Money value={0} />
        <Money value={-1500000} />
      </>,
    );
    expect(screen.getByText('0 đ')).toBeTruthy();
    expect(screen.getByText('-1.500.000 đ')).toBeTruthy();
  });
});

describe('formatVnd', () => {
  it('throws a RangeError on a fractional or non-finite amount', () => {
    for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => formatVnd(bad)).toThrow(RangeError);
    }
  });
});
