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

// Chip layer (Story 1.4): 10-state read-only status chip + customer-type/scope flags.
export { StatusChip, STATUS_LABELS } from './StatusChip';
export type { StatusChipProps, StatusKey } from './StatusChip';

export { CustomerTypeChip } from './CustomerTypeChip';
export type { CustomerTypeChipProps } from './CustomerTypeChip';

export { ScopeFlag } from './ScopeFlag';
export type { ScopeFlagProps } from './ScopeFlag';

// Data / feedback layer (Story 1.5): Table, Stepper, KPI, Banner.
export { Table } from './Table';
export type { TableProps } from './Table';

export { Stepper } from './Stepper';
export type { StepperProps, StepItem, StepState } from './Stepper';

export { Kpi } from './Kpi';
export type { KpiProps } from './Kpi';

export { Banner } from './Banner';
export type { BannerProps, BannerTone } from './Banner';

// Money display: the ONE formatter (`83.010.960 đ`) and the component that
// applies it with the `mono` token. Screens never print a raw money number.
export { Money } from './Money';
export type { MoneyProps } from './Money';
export { formatVnd } from './format-vnd';

// Behavior / interaction layer (Story 1.6): cart line, overlays, list states,
// share, image upload. Behavior primitives only — no business logic (money math,
// status transitions, R2 upload all live on the backend; AD-3/10/11/16).
export { CartLineRow } from './CartLineRow';
export type { CartLineRowProps } from './CartLineRow';

export { Dialog } from './Dialog';
export type { DialogProps } from './Dialog';

export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { ErrorState } from './ErrorState';
export type { ErrorStateProps } from './ErrorState';

export { ShareButton } from './ShareButton';
export type { ShareButtonProps } from './ShareButton';

export { ImageUpload } from './ImageUpload';
export type { ImageUploadProps, ImageUploadItem } from './ImageUpload';

// Read-only gallery for photos already on the server (Story 5.6) — the picker
// above is for LOCAL files; this one renders what the backend already has.
export { AttachmentGallery } from './AttachmentGallery';
export type {
  AttachmentGalleryProps,
  AttachmentGalleryItem,
} from './AttachmentGallery';

// Form control layer (Story 4.1): real checkbox for the group-picker checklist.
export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { shareFiles } from './share';
export type { ShareFilesOptions, ShareResult } from './share';
