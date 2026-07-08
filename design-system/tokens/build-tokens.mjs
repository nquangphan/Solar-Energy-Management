// Generator for the shared design-token layer (Story 1.1).
//
// design-tokens.json is the single source of truth. This script derives every
// platform output from it so a hex/number can never drift between web and mobile:
//   web    -> web/src/design-system/tokens/tokens.ts  +  tokens.css
//   mobile -> mobile/lib/design_system/tokens/app_tokens.dart
//
// Zero external dependencies (Node built-ins only). Run: `node build-tokens.mjs`.
// Outputs are committed; parity.test.mjs fails if a committed file no longer
// matches what this generator produces from the source of truth.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/tokens -> repo root
const SSOT_PATH = resolve(here, 'design-tokens.json');

export const OUT_PATHS = {
  webTs: resolve(repoRoot, 'web/src/design-system/tokens/tokens.ts'),
  webCss: resolve(repoRoot, 'web/src/design-system/tokens/tokens.css'),
  mobileDart: resolve(repoRoot, 'mobile/lib/design_system/tokens/app_tokens.dart'),
};

export function loadTokens() {
  return JSON.parse(readFileSync(SSOT_PATH, 'utf8'));
}

const GEN_NOTE = 'GENERATED from design-system/tokens/design-tokens.json — do not edit by hand.';

// kebab/alias name -> camelCase identifier for TS/Dart (teal-700 -> teal700, page-x -> pageX).
function camel(name) {
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function num(n) {
  return Number.isInteger(n) ? String(n) : String(n);
}
// Dart wants explicit doubles.
function dartNum(n) {
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

// --- Web: tokens.ts (typed constants) -------------------------------------
function buildTs(t) {
  const colorLines = Object.entries(t.color)
    .map(([k, v]) => `  '${k}': '${v}',`)
    .join('\n');
  const spaceScale = Object.entries(t.spacing.scale)
    .map(([k, v]) => `  '${k}': ${num(v)},`)
    .join('\n');
  const spaceAlias = Object.entries(t.spacing.alias)
    .map(([k, v]) => `  '${k}': ${num(v)},`)
    .join('\n');
  const radius = Object.entries(t.radius)
    .map(([k, v]) => `  '${k}': ${num(v)},`)
    .join('\n');
  const roles = Object.entries(t.typography.roles)
    .map(([role, spec]) => `  ${camel(role)}: ${JSON.stringify(spec)},`)
    .join('\n');
  const borderLevels = Object.entries(t.border.levels)
    .map(([k, v]) => `    ${k}: '${v}',`)
    .join('\n');

  return `// ${GEN_NOTE}
/* eslint-disable */

export const color = {
${colorLines}
} as const;

export const spacing = {
${spaceScale}
${spaceAlias}
} as const;

export const radius = {
${radius}
} as const;

export const fontFamily = ${JSON.stringify(t.typography.fontFamily)} as const;

export const typography = {
${roles}
  mono: ${JSON.stringify(t.typography.mono)},
} as const;

export const border = {
  width: ${num(t.border.width)},
  levels: {
${borderLevels}
  },
  surfaceSteps: ${JSON.stringify(t.border.surfaceSteps)},
} as const;

export type ColorToken = keyof typeof color;
`;
}

// --- Web: tokens.css (CSS custom properties + .mono) ----------------------
function buildCss(t) {
  const colorVars = Object.entries(t.color)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  const spaceVars = Object.entries(t.spacing.scale)
    .map(([, v]) => `  --space-${v}: ${v}px;`)
    .join('\n');
  const aliasVars = Object.entries(t.spacing.alias)
    .map(([k, v]) => `  --${k}: ${v}px;`)
    .join('\n');
  // sm -> --radius-sm, DEFAULT -> --radius, else --radius-<key>
  const radiusVars = Object.entries(t.radius)
    .map(([k, v]) => `  --radius${k === 'DEFAULT' ? '' : '-' + k.toLowerCase()}: ${v}px;`)
    .join('\n');
  const roleVars = Object.entries(t.typography.roles)
    .flatMap(([role, spec]) =>
      Object.entries(spec).map(([prop, val]) => {
        // fontSize is a length -> emit px; a color prop is a token reference ->
        // emit var(--<token>) so it resolves to the brand color, not a CSS
        // named color (e.g. `teal` would be #008080, not brand #0E9F8E);
        // weights/line-height/keywords stay as-is.
        const rendered =
          prop === 'fontSize' ? `${val}px` : prop === 'color' ? `var(--${val})` : val;
        return `  --text-${role}-${prop.toLowerCase()}: ${rendered};`;
      }),
    )
    .join('\n');

  return `/* ${GEN_NOTE} */

:root {
  /* colors */
${colorVars}

  /* spacing scale + aliases */
${spaceVars}
${aliasVars}

  /* radius (full = pill; use ONLY for chip/pill/url-bar/avatar-dot) */
${radiusVars}

  /* typography */
  --font: ${t.typography.fontFamily};
${roleVars}

  /* Viền nét: flat blueprint — hierarchy via border width + surface steps */
  --border-width: ${t.border.width}px;
}

/* Money / quantities / order codes: tabular figures, right-aligned. */
.mono {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
`;
}

// --- Mobile: app_tokens.dart ----------------------------------------------
function dartColor(hex) {
  return `Color(0xFF${hex.slice(1).toUpperCase()})`;
}
function buildDart(t) {
  const colors = Object.entries(t.color)
    .map(([k, v]) => `  static const Color ${camel(k)} = ${dartColor(v)};`)
    .join('\n');
  const space = [
    ...Object.entries(t.spacing.scale).map(([, v]) => `  static const double space${v} = ${dartNum(v)};`),
    ...Object.entries(t.spacing.alias).map(([k, v]) => `  static const double ${camel(k)} = ${dartNum(v)};`),
  ].join('\n');
  const radius = Object.entries(t.radius)
    .map(([k, v]) => `  static const double radius${k === 'DEFAULT' ? 'Default' : k[0].toUpperCase() + k.slice(1)} = ${dartNum(v)};`)
    .join('\n');
  const roles = Object.entries(t.typography.roles)
    .map(([role, spec]) => `  static const double ${camel(role)}FontSize = ${dartNum(spec.fontSize)};\n  static const int ${camel(role)}FontWeight = ${spec.fontWeight};`)
    .join('\n');

  return `// ${GEN_NOTE}
// ignore_for_file: constant_identifier_names

import 'package:flutter/painting.dart';

/// Canonical design tokens shared with web. Values are generated from
/// design-system/tokens/design-tokens.json — keep changes in the source.
class AppTokens {
  AppTokens._();

  // Colors
${colors}

  // Spacing (logical px)
${space}

  // Radius (full = pill; use ONLY for chip/pill/url-bar/avatar-dot)
${radius}

  // Typography
  static const String fontFamily = ${JSON.stringify(t.typography.fontFamily)};
${roles}

  // Viền nét: flat blueprint — hierarchy via border width + surface steps.
  static const double borderWidth = ${dartNum(t.border.width)};

  // A11y floor (Story 1.10, UX-DR-26): min touch target in dp (Material 48).
  // The web sibling floor is 44px, authored in a11y/a11y.css — dp≠px, so the
  // two values differ ON PURPOSE, not a parity drift.
  static const double tapTargetMin = ${dartNum(t.a11y.tapTargetMinDp)};
}
`;
}

export function buildOutputs(t) {
  return { ts: buildTs(t), css: buildCss(t), dart: buildDart(t) };
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

// Run guard: only write files when executed directly (not when imported by tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = loadTokens();
  const { ts, css, dart } = buildOutputs(t);
  write(OUT_PATHS.webTs, ts);
  write(OUT_PATHS.webCss, css);
  write(OUT_PATHS.mobileDart, dart);
  console.log('Generated:');
  for (const p of Object.values(OUT_PATHS)) console.log('  ' + p);
}
