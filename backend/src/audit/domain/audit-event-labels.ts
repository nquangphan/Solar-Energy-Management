/**
 * Vietnamese action label for every domain event type the system publishes (FR-20). PURE DOMAIN.
 *
 * The label lives in the backend because event types are backend knowledge: one source, and
 * `audit-event-labels.spec.ts` scans every `readonly type = '…'` in `src/**\/domain` so a new
 * event without a label goes red.
 */
export const AUDIT_EVENT_LABELS: Readonly<Record<string, string>> =
  Object.freeze({
    AccountCreated: 'Tạo account',
    AccountUpdated: 'Sửa account',
    AccountPermissionsChanged: 'Sửa quyền account',
    PasswordResetRequested: 'Yêu cầu đặt lại mật khẩu',
    PasswordResetCompleted: 'Đặt lại mật khẩu',
    PasswordChanged: 'Đổi mật khẩu',
    CustomerCreated: 'Tạo khách hàng',
    CustomerUpdated: 'Sửa khách hàng',
    CustomerSourceCreated: 'Tạo nguồn khách',
    CustomerSourceUpdated: 'Sửa nguồn khách',
    CustomerSourceDeactivated: 'Ngừng nguồn khách',
    CustomerSourceReactivated: 'Mở lại nguồn khách',
    ProductCreated: 'Tạo sản phẩm',
    ProductUpdated: 'Sửa sản phẩm',
    ProductDeactivated: 'Ngừng sản phẩm',
    ProductPricesReplaced: 'Sửa giá',
    ProductGroupCreated: 'Tạo nhóm sản phẩm',
    ProductGroupUpdated: 'Sửa nhóm sản phẩm',
    ProductGroupDeactivated: 'Ngừng nhóm sản phẩm',
    ProductGroupReactivated: 'Mở lại nhóm sản phẩm',
    ProductGroupItemsReplaced: 'Sửa sản phẩm trong nhóm',
    SystemSettingChanged: 'Sửa cấu hình hệ thống',
    FeatureFlagToggled: 'Bật/tắt tính năng',
    OrderCreated: 'Tạo đơn',
    OrderLineAdded: 'Thêm dòng báo giá',
    OrderLineUpdated: 'Sửa dòng báo giá',
    OrderLineRemoved: 'Xoá dòng báo giá',
    OrderScopeChanged: 'Đổi phạm vi đơn',
    OrderMetaChanged: 'Sửa thông tin đơn',
    OrderConfirmed: 'Chốt đơn',
    OrderRevised: 'Sửa đơn sau chốt',
    OrderCancelled: 'Huỷ đơn',
    StatusChanged: 'Chuyển trạng thái',
    DiscountRequested: 'Xin duyệt chiết khấu',
    DiscountResolved: 'Duyệt chiết khấu',
    QuoteExported: 'Xuất báo giá',
    AttachmentAdded: 'Thêm ảnh',
    AttachmentRemoved: 'Xoá ảnh',
    DepositRecorded: 'Ghi nhận tiền cọc',
    PaymentRecorded: 'Ghi nhận thanh toán',
    PaymentScheduleConfigured: 'Cấu hình lịch thanh toán',
    ContractGenerated: 'Tạo hợp đồng',
    InvoiceCreated: 'Lập hoá đơn',
    InvoicePdfExported: 'Xuất PDF hoá đơn',
    StockVoucherCreated: 'Lập phiếu kho',
    StockIssued: 'Xuất kho',
    StockOutBlocked: 'Chặn xuất kho thiếu tồn',
  });

/** Label for `type`, or `type` itself when unknown — an old or future record never breaks. */
export function auditEventLabel(type: string): string {
  return Object.hasOwn(AUDIT_EVENT_LABELS, type)
    ? AUDIT_EVENT_LABELS[type]
    : type;
}
