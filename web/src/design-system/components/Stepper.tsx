// hand-authored — web-only design-system component (Story 1.5).
import { Icon } from '../icons/Icon';

// State union blocks ad-hoc states at the type level. No `disabled`/`grayed`:
// steps that don't apply to the current order flow are dropped from `steps` by
// the caller, never rendered dimmed (UX-DR-11, AC-2). `gate` (dashed border) is
// an APPLICABLE-but-locked step, distinct from an inapplicable one.
export type StepState = 'done' | 'current' | 'gate';

export interface StepItem {
  label: string;
  state?: StepState; // omitted = upcoming (plain node, 1-based number)
}

export interface StepperProps {
  steps: StepItem[];
}

/**
 * Read-only progress stepper (AC-2). Display-only: it shows the sequence of
 * steps the caller passes — it does NOT change Order.status (that is backend
 * applyTransition, AD-11). `.bul` content: `done` → white check (ic-check);
 * every other state → the 1-based step number. The connecting `.bar` renders
 * between steps and is dropped after the last one.
 */
export function Stepper({ steps }: StepperProps) {
  return (
    <div className="stepper">
      {steps.map((step, i) => {
        const cls = ['step', step.state].filter(Boolean).join(' ');
        const isLast = i === steps.length - 1;
        return (
          <div className={cls} key={i}>
            <div className="node">
              <div className="bul">
                {step.state === 'done' ? <Icon name="ic-check" /> : i + 1}
              </div>
              <div className="st-label">{step.label}</div>
            </div>
            {!isLast && <div className="bar" />}
          </div>
        );
      })}
    </div>
  );
}
