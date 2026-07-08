// hand-authored — design-system component barrel (Story 1.3).
//
// CSS load order (Task 3): components.css MUST be imported AFTER tokens.css,
// because the component rules consume token vars (--teal, --line, --radius*,
// --font, ...). The app entry (built in a later web-app story) is responsible
// for the order, e.g.:
//   import '../tokens/tokens.css';
//   import '../icons/icons.css';
//   import './components.css';
// No bundler/entry exists in the repo yet (YAGNI) — this note is the contract.

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card } from './Card';
export type { CardProps, CardVariant } from './Card';

export { Frame } from './Frame';
export type { FrameProps } from './Frame';

export { Field } from './Field';
export type { FieldProps, FieldSize } from './Field';

// Chip layer (Story 1.4): 9-state read-only status chip + customer-type/scope flags.
export { StatusChip, STATUS_LABELS } from './StatusChip';
export type { StatusChipProps, StatusKey } from './StatusChip';

export { CustomerTypeChip } from './CustomerTypeChip';
export type { CustomerTypeChipProps } from './CustomerTypeChip';

export { ScopeFlag } from './ScopeFlag';
export type { ScopeFlagProps } from './ScopeFlag';
