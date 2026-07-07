// GENERATED from design-system/tokens/design-tokens.json — do not edit by hand.
/* eslint-disable */

export const color = {
  'teal': '#0E9F8E',
  'teal-700': '#0B8578',
  'teal-050': '#E6F6F4',
  'lime': '#A3E635',
  'lime-600': '#7DB800',
  'lime-050': '#F1FBDD',
  'ink': '#0C1F1C',
  'ink-2': '#334E49',
  'muted': '#4E6B66',
  'line': '#DBEBE7',
  'bg': '#F4FAF8',
  'surface': '#FFFFFF',
  'surface-2': '#ECF6F3',
  'ok': '#159A6B',
  'warn': '#D98A0B',
  'danger': '#E14B4B',
  'info': '#0E8FA8',
} as const;

export const spacing = {
  '4': 4,
  '6': 6,
  '8': 8,
  '12': 12,
  '16': 16,
  '22': 22,
  '26': 26,
  'gutter': 12,
  'page-x': 22,
  'pscroll': 12,
} as const;

export const radius = {
  'sm': 8,
  'DEFAULT': 10,
  'lg': 12,
  'full': 9999,
} as const;

export const fontFamily = "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif" as const;

export const typography = {
  display: {"fontSize":23,"fontWeight":900,"letterSpacing":"-.02em"},
  title: {"fontSize":15,"fontWeight":800,"letterSpacing":"-.01em"},
  body: {"fontSize":13.5,"fontWeight":400,"lineHeight":1.42},
  meta: {"fontSize":12.5,"fontWeight":600},
  micro: {"fontSize":10,"fontWeight":800,"letterSpacing":".1em","textTransform":"uppercase","color":"teal"},
  mono: {"$note":"For money, quantities, order codes: tabular figures, right-aligned.","fontVariantNumeric":"tabular-nums","textAlign":"right"},
} as const;

export const border = {
  width: 1.5,
  levels: {
    low: 'line',
    high: 'teal',
    emphasis: 'ink',
  },
  surfaceSteps: ["bg","surface","surface-2"],
} as const;

export type ColorToken = keyof typeof color;
