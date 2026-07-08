// hand-authored — web-only design-system component (Story 1.4).

// Union of the 9 canonical order states (= .chip--* class suffix). The union
// blocks ad-hoc/invented statuses at the type level (AC-2). Key ↔ backend
// Order.status enum is deferred to Epic 4/5 — here the key is just the class
// suffix, not a guessed backend enum.
export type StatusKey =
  | 'baogia'
  | 'choduyet'
  | 'dachot'
  | 'dacoc'
  | 'thicong'
  | 'nghiemthu'
  | 'danggiao'
  | 'hoanthanh'
  | 'huy';

// Canonical labels (verbatim from AC-2 / DESIGN.md#Status-chip). "Chờ duyệt" is
// the canonical label even where the mockup writes "Chờ duyệt CK" — pass `label`
// to override the display text if a screen needs the "CK" variant.
export const STATUS_LABELS: Record<StatusKey, string> = {
  baogia: 'Báo giá',
  choduyet: 'Chờ duyệt',
  dachot: 'Đã chốt',
  dacoc: 'Đã cọc',
  thicong: 'Đang thi công',
  nghiemthu: 'Nghiệm thu',
  danggiao: 'Đang giao',
  hoanthanh: 'Hoàn thành',
  huy: 'Huỷ',
};

export interface StatusChipProps {
  status: StatusKey;
  // Override the displayed label; defaults to the canonical STATUS_LABELS entry.
  label?: string;
  className?: string;
}

/**
 * Read-only status chip (UX-DR-23, AC-3). Renders a static <span> — NEVER a
 * button. No onClick, no role/tabindex, no ...rest spread that could turn it
 * into a control. Changing a status goes through a dedicated transition screen
 * (Epic 5), never the chip. Always carries a text label (a11y, UX-DR-26); the
 * .dot is a same-color accent (currentColor).
 */
export function StatusChip({ status, label, className }: StatusChipProps) {
  const cls = ['chip', `chip--${status}`, className].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      <span className="dot" />
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
