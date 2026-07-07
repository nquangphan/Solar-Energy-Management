// GENERATED from design-system/icons/icons.json — do not edit by hand.
/* eslint-disable */
import type { SVGProps } from 'react';
import { type IconName, type IconSize } from './sprite';

// Non-default canonical sizes map to their utility class (18 uses the base .icn).
const SIZE_CLASS: Record<Exclude<IconSize, 18>, string> = {
  22: 'icn-22',
  16: 'icn-16',
  15: 'icn-15',
  14: 'icn-14',
  13: 'icn-xs',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: IconSize;
}

/**
 * Renders a canonical sprite icon via <use href="#ic-*">. Colour is inherited
 * from CSS `color` (currentColor) — set the colour on an ancestor (teal when
 * active, muted otherwise); never hard-code an icon colour here.
 */
export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  const sizeClass = size === 18 ? '' : SIZE_CLASS[size];
  const cls = ['icn', sizeClass, className].filter(Boolean).join(' ');
  return (
    <svg className={cls} {...rest}>
      <use href={`#${name}`} />
    </svg>
  );
}
