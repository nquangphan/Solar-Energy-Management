// Generator for the shared icon sprite layer (Story 1.2).
//
// icons.json is the single source of truth (46 symbols extracted verbatim from
// mockups/all-screens.html). This script derives every platform output from it
// so an icon can never drift between web and mobile:
//   web    -> web/src/design-system/icons/sprite.ts + icons.css + Icon.tsx
//   mobile -> mobile/lib/design_system/icons/app_icons.dart
//
// Zero external dependencies (Node built-ins only), same style as
// tokens/build-tokens.mjs. Run: `node icons/build-icons.mjs`.
// Outputs are committed; parity.test.mjs fails if a committed file no longer
// matches what this generator produces from the source of truth.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/icons -> repo root
const SSOT_PATH = resolve(here, 'icons.json');

export const OUT_PATHS = {
  webSprite: resolve(repoRoot, 'web/src/design-system/icons/sprite.ts'),
  webCss: resolve(repoRoot, 'web/src/design-system/icons/icons.css'),
  webComponent: resolve(repoRoot, 'web/src/design-system/icons/Icon.tsx'),
  mobileDart: resolve(repoRoot, 'mobile/lib/design_system/icons/app_icons.dart'),
};

export function loadIcons() {
  return JSON.parse(readFileSync(SSOT_PATH, 'utf8'));
}

const GEN_NOTE = 'GENERATED from design-system/icons/icons.json — do not edit by hand.';

// Constant symbol attributes shared by all 46 icons (verified against the
// mockup). Ordering is fixed so output is byte-deterministic.
function openTag(attrs, name) {
  return (
    `<symbol id="${name}" viewBox="${attrs.viewBox}" fill="${attrs.fill}"` +
    ` stroke="${attrs.stroke}" stroke-width="${attrs['stroke-width']}"` +
    ` stroke-linecap="${attrs['stroke-linecap']}" stroke-linejoin="${attrs['stroke-linejoin']}">`
  );
}
// Full self-contained SVG element (used for the mobile registry strings).
function svgString(attrs, body) {
  return (
    `<svg viewBox="${attrs.viewBox}" fill="${attrs.fill}"` +
    ` stroke="${attrs.stroke}" stroke-width="${attrs['stroke-width']}"` +
    ` stroke-linecap="${attrs['stroke-linecap']}" stroke-linejoin="${attrs['stroke-linejoin']}">` +
    `${body}</svg>`
  );
}

// Escape a value for safe emission into a single-quoted JS/TS string literal.
// Icon bodies come from icons.json and are embedded verbatim into generated
// source; without escaping a `'` or `\` in a path would produce broken output
// that the drift guard cannot see (both committed and fresh output share the
// same defect). ASCII SVG data has none today; this keeps it safe if it changes.
function jsLit(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
// Same, for a single-quoted Dart string literal — `$` also triggers Dart
// string interpolation and must be escaped.
function dartLit(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\$/g, '\\$').replace(/'/g, "\\'");
}

// 13 keeps the mockup's `.icn-xs` name; the other variants get `.icn-<n>`.
function sizeClass(n) {
  return n === 13 ? 'icn-xs' : `icn-${n}`;
}

// --- Web: sprite.ts (sprite markup + canonical name/size unions) ----------
function buildSprite(t) {
  const names = Object.keys(t.icons);
  const nameLines = names.map((n) => `  '${jsLit(n)}',`).join('\n');
  const symbolLines = names
    .map((n) => `  '${jsLit(`${openTag(t.attrs, n)}${t.icons[n]}</symbol>`)}',`)
    .join('\n');
  const sizeList = t.sizes.variants.join(', ');

  return `// ${GEN_NOTE}
/* eslint-disable */

export const ICON_NAMES = [
${nameLines}
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const ICON_SIZES = [${sizeList}] as const;
export type IconSize = (typeof ICON_SIZES)[number];

/**
 * Inline SVG sprite — mount ONCE at the top of the DOM (first child of <body>),
 * then reference symbols with <svg class="icn"><use href="#ic-*"/></svg>.
 * Self-contained: 0 external references.
 */
export const ICON_SPRITE = [
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>',
${symbolLines}
  '</defs></svg>',
].join('');
`;
}

// --- Web: icons.css (.icn base + canonical size variants) -----------------
function buildCss(t) {
  // The base rule is verbatim from the mockup (all-screens.html:318). Size
  // utilities must out-specify it: `svg.icn` is (0,1,1), so a bare `.icn-xs`
  // (0,1,0) would lose and the size prop would be inert. Qualify each variant
  // as `svg.icn.icn-*` (0,2,1) so the selected size actually wins.
  const sizeRules = t.sizes.variants
    .filter((n) => n !== t.sizes.default)
    .map((n) => `svg.icn.${sizeClass(n)}{width:${n}px;height:${n}px}`)
    .join('\n');

  return `/* ${GEN_NOTE} */

/* Base icon: 18px, inherits the context text colour via currentColor
   (teal when active, muted otherwise). Do NOT hard-code an icon colour. */
svg.icn{width:18px;height:18px;stroke-width:2;flex:none;vertical-align:middle;fill:none;stroke:currentColor}
${sizeRules}
`;
}

// --- Web: Icon.tsx (thin component over the sprite) ------------------------
function buildComponent(t) {
  const variants = t.sizes.variants.filter((n) => n !== t.sizes.default);
  const mapLines = variants.map((n) => `  ${n}: '${sizeClass(n)}',`).join('\n');

  return `// ${GEN_NOTE}
/* eslint-disable */
import type { SVGProps } from 'react';
import { type IconName, type IconSize } from './sprite';

// Non-default canonical sizes map to their utility class (18 uses the base .icn).
const SIZE_CLASS: Record<Exclude<IconSize, ${t.sizes.default}>, string> = {
${mapLines}
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: IconSize;
}

/**
 * Renders a canonical sprite icon via <use href="#ic-*">. Colour is inherited
 * from CSS \`color\` (currentColor) — set the colour on an ancestor (teal when
 * active, muted otherwise); never hard-code an icon colour here.
 *
 * Decorative by default (aria-hidden): the accessible name comes from the
 * surrounding button/label. For a meaningful standalone icon, override via
 * \`aria-hidden={false}\` + an \`aria-label\`/\`role="img"\` in \`...rest\`.
 */
export function Icon({ name, size = ${t.sizes.default}, className, ...rest }: IconProps) {
  const sizeClass = size === ${t.sizes.default} ? '' : SIZE_CLASS[size];
  const cls = ['icn', sizeClass, className].filter(Boolean).join(' ');
  return (
    <svg className={cls} aria-hidden {...rest}>
      <use href={\`#\${name}\`} />
    </svg>
  );
}
`;
}

// --- Mobile: app_icons.dart (registry + AppIcon widget) -------------------
function buildDart(t) {
  const names = Object.keys(t.icons);
  const registryLines = names
    .map((n) => `    '${dartLit(n)}': '${dartLit(svgString(t.attrs, t.icons[n]))}',`)
    .join('\n');
  const nameLines = names.map((n) => `    '${dartLit(n)}',`).join('\n');
  const sizeList = t.sizes.variants.map((n) => `${n}.0`).join(', ');

  return `// ${GEN_NOTE}
// ignore_for_file: lines_longer_than_80_chars

import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Canonical icon registry shared with web. Every entry is a self-contained SVG
/// string (stroke="currentColor", 0 external ref) generated from
/// design-system/icons/icons.json — keep changes in the source.
class AppIcons {
  AppIcons._();

  static const double defaultSize = ${t.sizes.default}.0;
  static const List<double> sizes = [${sizeList}];

  /// name -> full self-contained SVG markup.
  static const Map<String, String> registry = {
${registryLines}
  };

  static const List<String> names = [
${nameLines}
  ];
}

/// Renders a canonical icon. Colour inherits the context text colour
/// (currentColor semantics): pass [color], otherwise the surrounding
/// DefaultTextStyle / IconTheme colour is used — teal when active, muted
/// otherwise. Self-contained: 0 network assets.
class AppIcon extends StatelessWidget {
  const AppIcon(this.name, {super.key, this.size = AppIcons.defaultSize, this.color});

  final String name;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final svg = AppIcons.registry[name];
    assert(svg != null, 'Unknown icon: \$name');
    // In release the assert is stripped; an unknown name must degrade to empty
    // space, not crash the SVG parser with an empty string.
    if (svg == null) return SizedBox(width: size, height: size);
    final resolved = color ??
        DefaultTextStyle.of(context).style.color ??
        IconTheme.of(context).color ??
        const Color(0xFF000000);
    return SvgPicture.string(
      svg,
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(resolved, BlendMode.srcIn),
    );
  }
}
`;
}

export function buildOutputs(t) {
  return {
    sprite: buildSprite(t),
    css: buildCss(t),
    component: buildComponent(t),
    dart: buildDart(t),
  };
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

// Run guard: only write files when executed directly (not when imported by tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = loadIcons();
  const { sprite, css, component, dart } = buildOutputs(t);
  write(OUT_PATHS.webSprite, sprite);
  write(OUT_PATHS.webCss, css);
  write(OUT_PATHS.webComponent, component);
  write(OUT_PATHS.mobileDart, dart);
  console.log('Generated:');
  for (const p of Object.values(OUT_PATHS)) console.log('  ' + p);
}
