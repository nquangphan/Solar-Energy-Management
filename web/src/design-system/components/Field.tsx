// hand-authored — web-only design-system component (Story 1.3).
import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export type FieldSize = 'lg';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  // When set, renders a .flabel above the input, wrapped in .fgroup, and links
  // it to the input via htmlFor/id for a11y (UX-DR-26).
  label?: string;
  size?: FieldSize;
}

/**
 * Flat text field: line 1.5px border; focus swaps the border to teal with
 * outline:none (no glow/ring — Viền nét). Validation/glow UI is out of scope.
 */
export function Field({ label, size, id, className, ...rest }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? (label ? generatedId : undefined);
  const cls = ['field', size === 'lg' && 'field-lg', className].filter(Boolean).join(' ');
  const input = <input id={fieldId} className={cls} {...rest} />;

  if (!label) return input;
  return (
    <div className="fgroup">
      <label className="flabel" htmlFor={fieldId}>
        {label}
      </label>
      {input}
    </div>
  );
}
