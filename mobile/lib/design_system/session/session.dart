// hand-authored — session module barrel (Story 2.6, mirror web session/index.ts).
// Parallel to gating.dart and shell.dart. Exports the seam that binds `/me`
// (Story 2.5) to the gating permission set: port + mapping + provider/scope + the
// test/demo fake port.
//
// Gating is UX only (AD-4); this layer holds no business logic and touches no DB
// (AD-1/2). The registry is backend-owned (AD-17) — the provider only maps the
// `/me` payload the backend returns.

export 'me_port.dart';
export 'password_port.dart';
export 'customers_port.dart';
// Orders + catalog-read seam (Story 4.1): the quote screen's transport.
export 'orders_port.dart';
export 'catalog_port.dart';
// Warranty-lookup seam (Story 5.9): READ-ONLY — the backend computes every date
// and the status; the screen only renders them.
export 'warranty_port.dart';
// Inventory seam (Story 6.2): READ-ONLY — the backend computes availability,
// the purchase list and the status; the screen only renders them.
export 'inventory_port.dart';
// Stock-voucher seam (Story 6.3): the only write path for `onHand`. The backend
// owns the voucher code, the weighted-average cost and the stock-out refusal.
export 'stock_vouchers_port.dart';
// Payment-schedule seam (Story 7.1): the backend owns every amount and the
// totals verdict; the client sends only what the user typed.
export 'payments_port.dart';
export 'app_session.dart';
export 'app_session_gating_example.dart';

// TEST/DEMO-ONLY — not a real session source (see fake_me_port.dart,
// fake_password_port.dart). They enforce no security rule; the backend owns all of them.
export 'fake_me_port.dart';
export 'fake_password_port.dart';
export 'fake_customers_port.dart';
export 'fake_orders_port.dart';
export 'fake_catalog_port.dart';
export 'fake_warranty_port.dart';
export 'fake_inventory_port.dart';
export 'fake_stock_vouchers_port.dart';
export 'fake_payments_port.dart';
