// hand-authored — design-system component barrel (Story 1.7). One import for the
// whole Flutter widget parity layer, mirroring web
// design-system/components/index.ts. Sits beside the shipped tokens/icons
// barrels; it does NOT re-export those (import them directly, unchanged).

// Foundation (mirror Story 1.3): Button, Card, Frame, Field.
export 'button.dart' show AppButton, AppButtonVariant, AppButtonSize;
export 'card.dart' show AppCard, AppCardVariant, AppFrame;
export 'field.dart' show AppField, AppFieldSize;

// Chip layer (mirror Story 1.4): base chip + status/customer-type/scope.
export 'chip.dart' show AppChip, AppCustomerTypeChip, AppScopeFlag;
export 'status_chip.dart'
    show
        AppStatusChip,
        StatusKey,
        StatusChipColors,
        kStatusLabels,
        kStatusColors;

// Data / feedback (mirror Story 1.5): Banner, Table, Stepper, KPI.
export 'banner.dart' show AppBanner, AppBannerTone;
export 'table.dart'
    show AppTable, AppTableColumn, AppTableRow, AppTableCellText;
export 'stepper.dart' show AppStepper, AppStepItem, AppStepState;
export 'kpi.dart' show AppKpi;

// Behaviour layer (mirror Story 1.6): cart line, overlays, list states, share,
// image upload. Behaviour primitives only — no business logic (money math,
// status transitions, R2 upload all live on the backend; AD-3/10/11/16).
export 'cart_line_row.dart' show AppCartLineRow;
export 'skeleton.dart' show AppSkeleton;
export 'empty_state.dart' show AppEmptyState;
export 'error_state.dart' show AppErrorState;
export 'dialog.dart' show AppDialog, AppConfirmDialog, showAppDialog;
export 'sheet.dart' show AppSheet, showAppSheet;
export 'share_button.dart'
    show AppShareButton, AppShareResult, AppShareFn, platformShareXFiles;
export 'image_upload.dart'
    show AppImageUpload, AppUploadItem, ImagePickFn, platformPickImages;

// The picker/share value types callers need (from cross_file, re-exported by
// image_picker). ImageSource selects camera vs gallery.
export 'package:image_picker/image_picker.dart' show XFile, ImageSource;
