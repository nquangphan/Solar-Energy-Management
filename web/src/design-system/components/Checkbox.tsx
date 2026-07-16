// hand-authored — web-only design-system component (Story 4.1).
import { Icon } from '../icons/Icon';

export interface CheckboxProps {
  // The visible, readable label — REQUIRED: the mockup's static `<span
  // class="tick">` had no accessible name; this control always names itself.
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A real checkbox control (Story 4.1 — the group-picker checklist), replacing
 * the mockup's static tick span. A native <input type="checkbox"> wrapped in a
 * <label> so the accessible name/toggle semantics come for free; the visual is
 * a flat 1.5px-bordered box (Viền nét — no shadow/glow) that fills teal when
 * checked. The whole label row is the hit area, floored at ≥44px by .checkbox.
 *
 * Controlled component: state lives in the SCREEN, this control only emits.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  className,
}: CheckboxProps) {
  const cls = ['checkbox', disabled && 'checkbox--disabled', className]
    .filter(Boolean)
    .join(' ');
  return (
    <label className={cls}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="checkbox-box" aria-hidden="true">
        {checked && <Icon name="ic-check" />}
      </span>
      <span className="checkbox-label">{label}</span>
    </label>
  );
}
