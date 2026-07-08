// hand-authored — web-only design-system component (Story 1.6).

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
}

/**
 * A single loading bar (AC-2). The building block for the Loading state: screens
 * stack several <Skeleton> to match the real layout (the mockup stacks 2 bars per
 * row). Static — no shimmer/gradient (Viền nét). Colour + radius come from `.skel`;
 * size comes from props.
 */
export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  const cls = ['skel', className].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
