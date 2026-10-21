// hand-authored — session module barrel (Story 2.6). Parallel to gating/index.ts
// and shell/index.ts. Exports the seam that binds `/me` (Story 2.5) to the gating
// `PermissionSet`: port + mapping + provider/hook + the test/demo fake port.
//
// Gating is UX only (AD-4); this layer holds no business logic and touches no DB
// (AD-1/2). The registry is backend-owned (AD-17) — the provider only maps the
// `/me` payload the backend returns.

export type { MePort, MeResponse } from './me-port';
export type { PasswordPort } from './password-port';
export type {
  CustomersPort,
  Customer,
  CustomerSource,
  CustomerLookup,
  CustomerPage,
  CustomerListQuery,
  CreateCustomerInput,
} from './customers-port';
// WEB-ONLY on purpose (Story 3.5): Cấu hình nguồn khách is the one screen DESIGN.md
// ships without a mobile twin, so this port has no Dart mirror. See the file header.
export type {
  CustomerSourcesPort,
  CustomerSourceRow,
  CreateCustomerSourceInput,
  UpdateCustomerSourceInput,
  CustomerSourcePortError,
} from './customer-sources-port';
// Orders + catalog-read seam (Story 4.1): the quote screen's transport.
export type {
  OrdersPort,
  Order,
  OrderLine,
  CreateOrderInput,
  AddOrderLineInput,
  UpdateOrderLineInput,
  UpdateScopeFlagsInput,
  UpdateOrderMetaInput,
  PreviewTotalInput,
  OrderTotals,
  OrderPortError,
} from './orders-port';
// WEB-ONLY on purpose (Story 4.4): system config is desk work — same decision as
// customer-sources-port.ts, no Dart mirror. See the file header.
export type { SettingsPort, SettingsPortError } from './settings-port';
// Warranty-lookup seam (Story 5.9): READ-ONLY — the backend computes every date
// and the status; the screen only renders them.
export type {
  WarrantyPort,
  WarrantyLookup,
  WarrantyOrder,
  WarrantyLine,
  WarrantyCustomer,
  WarrantyPortError,
} from './warranty-port';
// Inventory seam (Story 6.2): READ-ONLY — the backend computes availability,
// the purchase list and the status; the screen only renders them.
export type {
  InventoryPort,
  StockList,
  StockListQuery,
  StockItemView,
  CanMuaView,
  TinhTrangTon,
} from './inventory-port';
// Stock-voucher seam (Story 6.3): the only write path for `onHand`. The backend
// owns the voucher code, the weighted-average cost and the stock-out refusal.
export type {
  StockVouchersPort,
  StockVoucherSummary,
  StockVoucherDetail,
  StockVoucherLine,
  StockVoucherList,
  StockVoucherListQuery,
  StockVoucherCreator,
  StockVoucherPortError,
  CreateStockVoucherInput,
  CreateStockVoucherLineInput,
  CreateReturnVoucherInput,
  LoaiPhieu,
} from './stock-vouchers-port';
// Payments seam (Story 7.1): the payment schedule of an order. The backend
// resolves every amount, the totals and the mismatch; the screen only renders them.
export type {
  PaymentsPort,
  PaymentSchedule,
  Installment,
  InstallmentInput,
  ReplacePaymentScheduleInput,
  PaymentsPortError,
} from './payments-port';
export type {
  CatalogPort,
  CatalogProduct,
  CatalogGroup,
  CatalogGroupItem,
  CatalogGroupDetail,
} from './catalog-port';
export { toPermissionSet } from './session';
export type { SessionStatus } from './session';
export { PermissionsProvider, usePermissionsContext } from './PermissionsProvider';
export type { PermissionsState, PermissionsProviderProps } from './PermissionsProvider';
export { usePermissions } from './use-permissions';
export type { UsePermissions } from './use-permissions';
export { SessionGatingExample } from './SessionGatingExample';

// TEST/DEMO-ONLY — not a real session source (see fake-me-port.ts,
// fake-password-port.ts). They enforce no security rule; the backend owns all of them.
export { FakeMePort, DEMO_ME } from './fake-me-port';
export { FakePasswordPort, DEMO_EXPIRES_IN_SECONDS } from './fake-password-port';
export {
  FakeCustomersPort,
  DEMO_CUSTOMERS,
  DEMO_CUSTOMER_SOURCES,
} from './fake-customers-port';
export {
  FakeCustomerSourcesPort,
  DEMO_CUSTOMER_SOURCE_ROWS,
} from './fake-customer-sources-port';
export { FakeOrdersPort } from './fake-orders-port';
export { FakeSettingsPort } from './fake-settings-port';
export { FakeWarrantyPort, DEMO_WARRANTY_ORDERS } from './fake-warranty-port';
export { FakeInventoryPort, DEMO_STOCK_LIST } from './fake-inventory-port';
export {
  FakeStockVouchersPort,
  DEMO_STOCK_VOUCHERS,
  FAKE_OUT_OF_STOCK_PRODUCT_ID,
  FAKE_INSUFFICIENT_STOCK_ERROR,
} from './fake-stock-vouchers-port';
export {
  FakePaymentsPort,
  DEMO_PAYMENT_SCHEDULE,
  DEMO_PAYMENT_SCHEDULE_EMPTY,
  DEMO_PAYMENT_SCHEDULE_MISMATCH,
} from './fake-payments-port';
export {
  FakeCatalogPort,
  DEMO_CATALOG_PRODUCTS,
  DEMO_CATALOG_GROUPS,
} from './fake-catalog-port';
