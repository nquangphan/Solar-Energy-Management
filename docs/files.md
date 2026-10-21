# Tra cứu file

File nào thuộc flow nào. Dùng `crew-docs where <file>` để tra từ dòng lệnh.

<!-- crew-docs:files:start -->
> Sinh tự động bởi `crew-docs generate` từ `docs/flows.yaml`. Không sửa tay.

| File | Flows |
|------|-------|
| `.github/workflows/ci.yml` | [build-ci](flows/build-ci.md) (điểm vào) |
| `backend/.env.example` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/.prettierrc` | [build-ci](flows/build-ci.md) (file) |
| `backend/assets/fonts/BeVietnamPro-Regular.ttf` | [orders](flows/orders.md) (file) |
| `backend/assets/fonts/BeVietnamPro-SemiBold.ttf` | [orders](flows/orders.md) (file) |
| `backend/eslint.config.mjs` | [build-ci](flows/build-ci.md) (file) |
| `backend/nest-cli.json` | [build-ci](flows/build-ci.md) (file) |
| `backend/openapi/openapi.json` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/openapi/permissions.json` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/package.json` | [build-ci](flows/build-ci.md) (file) |
| `backend/prisma.config.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/prisma/migrations/20260708000000_init_auth_accounts_sessions/migration.sql` | [auth-session](flows/auth-session.md) (file) |
| `backend/prisma/migrations/20260708010000_add_account_permissions/migration.sql` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/prisma/migrations/20260709000000_add_audit_logs/migration.sql` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/prisma/migrations/20260709010000_add_password_reset_codes/migration.sql` | [auth-session](flows/auth-session.md) (file) |
| `backend/prisma/migrations/20260713000000_add_products/migration.sql` | [catalog](flows/catalog.md) (file) |
| `backend/prisma/migrations/20260713010000_add_feature_flags_and_product_prices/migration.sql` | [catalog](flows/catalog.md) (dùng chung), [system-settings](flows/system-settings.md) (dùng chung) |
| `backend/prisma/migrations/20260713020000_add_customers_and_customer_sources/migration.sql` | [customers](flows/customers.md) (file) |
| `backend/prisma/migrations/20260713030000_add_product_groups/migration.sql` | [catalog](flows/catalog.md) (file) |
| `backend/prisma/migrations/20260714000000_customer_source_single_isother/migration.sql` | [customers](flows/customers.md) (file) |
| `backend/prisma/migrations/20260716000000_add_orders/migration.sql` | [orders](flows/orders.md) (file) |
| `backend/prisma/migrations/20260717000000_add_system_settings_and_order_metadata/migration.sql` | [system-settings](flows/system-settings.md) (dùng chung), [orders](flows/orders.md) (dùng chung) |
| `backend/prisma/migrations/20260717020000_add_discount_approvals/migration.sql` | [orders](flows/orders.md) (file) |
| `backend/prisma/migrations/20260717040000_add_quote_exports/migration.sql` | [orders](flows/orders.md) (file) |
| `backend/prisma/migrations/20260718000000_add_order_list_indexes/migration.sql` | [orders](flows/orders.md) (file) |
| `backend/prisma/migrations/20260718020000_add_order_version_created_by/migration.sql` | [orders](flows/orders.md) (file) |
| `backend/prisma/migrations/20260718060000_add_attachments/migration.sql` | [orders](flows/orders.md) (file) |
| `backend/prisma/migrations/20260718070000_add_order_cancel_reason/migration.sql` | [orders](flows/orders.md) (file) |
| `backend/prisma/migrations/20261021080000_add_stock_items_and_movements/migration.sql` | [inventory](flows/inventory.md) (file) |
| `backend/prisma/migrations/20261021090000_add_stock_vouchers/migration.sql` | [inventory](flows/inventory.md) (file) |
| `backend/prisma/migrations/20261021100000_add_stock_voucher_order_link/migration.sql` | [inventory](flows/inventory.md) (file) |
| `backend/prisma/migrations/20261021110000_add_stock_movement_reservation_keys/migration.sql` | [inventory](flows/inventory.md) (file) |
| `backend/prisma/migrations/20261021120000_add_stock_voucher_return_link/migration.sql` | [inventory](flows/inventory.md) (file) |
| `backend/prisma/migrations/migration_lock.toml` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/prisma/schema.prisma` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/prisma/seed.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/scripts/generate-openapi.ts` | [backend-platform](flows/backend-platform.md) (điểm vào) |
| `backend/scripts/generate-permissions.ts` | [accounts-permissions](flows/accounts-permissions.md) (điểm vào) |
| `backend/scripts/openapi-app-context.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/accounts/account-permissions.service.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/accounts/accounts.module.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/accounts/accounts.service.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/accounts/domain/account-events.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/accounts/domain/permission-escalation.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/accounts/domain/permission-registry.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/accounts/domain/role-presets.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/accounts/permissions-artifact.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/app.module.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/audit/audit.module.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/audit/audit.service.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/audit/audit.subscriber.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/auth/auth.config.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/auth.controller.ts` | [auth-session](flows/auth-session.md) (điểm vào) |
| `backend/src/auth/auth.module.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/auth.service.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/authenticated-only.decorator.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/auth/change-password.controller.ts` | [auth-session](flows/auth-session.md) (điểm vào) |
| `backend/src/auth/current-account.decorator.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/domain/password-events.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/auth-tokens.dto.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/change-password-request.dto.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/forgot-password-request.dto.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/forgot-password-response.dto.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/login-request.dto.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/logout-request.dto.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/me-response.dto.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/auth/dto/password-policy.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/refresh-request.dto.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/dto/reset-password-request.dto.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/jwt-auth.guard.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/me.controller.ts` | [accounts-permissions](flows/accounts-permissions.md) (điểm vào) |
| `backend/src/auth/password-reset.service.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/password.service.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/permissions.guard.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/auth/public.decorator.ts` | [auth-session](flows/auth-session.md) (file) |
| `backend/src/auth/require-any-permission.decorator.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/auth/require-permissions.decorator.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `backend/src/catalog/catalog.module.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/domain/price-resolution.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/domain/product-events.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/domain/product-group-events.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/domain/product-price-events.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/domain/product-visibility.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/create-product-group-request.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/create-product-request.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/is-optional-not-null.decorator.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/product-group-detail-response.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/product-group-response.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/product-price-response.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/product-price.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/product-response.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/replace-product-group-items-request.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/replace-product-prices-request.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/update-product-group-request.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/dto/update-product-request.dto.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/product-groups.controller.ts` | [catalog](flows/catalog.md) (điểm vào) |
| `backend/src/catalog/product-groups.service.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/product-prices.controller.ts` | [catalog](flows/catalog.md) (điểm vào) |
| `backend/src/catalog/product-prices.service.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/catalog/products.controller.ts` | [catalog](flows/catalog.md) (điểm vào) |
| `backend/src/catalog/products.service.ts` | [catalog](flows/catalog.md) (file) |
| `backend/src/common/common.module.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/common/errors/all-exceptions.filter.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/common/errors/app.exception.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/common/errors/dto/error-envelope.dto.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/common/errors/dto/field-error.dto.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/common/errors/error-code.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/common/errors/prisma-unique-violation.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/common/validation/validation-pipe.factory.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/customers/customer-sources.controller.ts` | [customers](flows/customers.md) (điểm vào) |
| `backend/src/customers/customer-sources.service.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/customers.controller.ts` | [customers](flows/customers.md) (điểm vào) |
| `backend/src/customers/customers.module.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/customers.service.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/domain/customer-events.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/domain/customer-source-events.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/domain/customer-type.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/domain/phone.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/create-customer-request.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/create-customer-source-request.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/customer-list-response.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/customer-lookup-response.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/customer-response.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/customer-source-limits.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/customer-source-response.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/is-absent.decorator.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/list-customers-query.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/lookup-customer-query.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/update-customer-request.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/customers/dto/update-customer-source-request.dto.ts` | [customers](flows/customers.md) (file) |
| `backend/src/events/domain-event.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/events/event-bus.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/events/events.module.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/events/in-process-event-bus.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/feature-flags/domain/feature-flag-events.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/feature-flags/domain/feature-flag-registry.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/feature-flags/dto/feature-flag-response.dto.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/feature-flags/dto/toggle-feature-flag-request.dto.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/feature-flags/feature-flags.controller.ts` | [system-settings](flows/system-settings.md) (điểm vào) |
| `backend/src/feature-flags/feature-flags.module.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/feature-flags/feature-flags.service.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/health/dto/health-response.dto.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/health/health.controller.ts` | [backend-platform](flows/backend-platform.md) (điểm vào) |
| `backend/src/health/health.module.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/inventory/domain/gia-von.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/domain/stock-issue-lines.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/domain/stock-issued-event.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/domain/stock-movement-type.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/domain/stock-out-blocked-event.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/domain/stock-shortfall.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/domain/stock-voucher-events.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/domain/stock-voucher-visibility.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/domain/ton-kho.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/dto/create-return-voucher-request.dto.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/dto/create-stock-voucher-request.dto.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/dto/stock-list-query.dto.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/dto/stock-list-response.dto.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/dto/stock-voucher-list-query.dto.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/dto/stock-voucher-response.dto.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/insufficient-stock.exception.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/inventory.module.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/order-cancelled-stock.subscriber.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/stock-items.controller.ts` | [inventory](flows/inventory.md) (điểm vào) |
| `backend/src/inventory/stock-items.service.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/inventory/stock-vouchers.controller.ts` | [inventory](flows/inventory.md) (điểm vào) |
| `backend/src/inventory/stock-vouchers.service.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/main.ts` | [backend-platform](flows/backend-platform.md) (điểm vào) |
| `backend/src/notifications/notification-dispatcher.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/notifications/notifications.module.ts` | [domain-events-audit](flows/domain-events-audit.md) (file) |
| `backend/src/openapi/openapi-document.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/orders/domain/allowed-transition.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/attachment-limits.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/auto-transition-map.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/cost-snapshot.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/discount-approval-status.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/line-amount.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/order-events.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/order-status.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/order-totals.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/scope-preset.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/vat-mode.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/version-diff.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/domain/warranty.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/add-line-item-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/apply-discount-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/attachment-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/cancel-order-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/cancel-order-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/create-order-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/discount-pending-item.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/list-orders-query.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/order-lifecycle-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/order-line-item-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/order-list-item.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/order-list-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/order-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/order-stock-check-response.dto.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/orders/dto/order-stock-issue-response.dto.ts` | [inventory](flows/inventory.md) (file) |
| `backend/src/orders/dto/order-version-item.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/order-versions-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/preview-total-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/preview-total-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/quote-export-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/resolve-discount-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/status-change-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/status-change-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/update-line-item-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/update-order-request.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/warranty-lookup-query.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/dto/warranty-lookup-response.dto.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/orders.controller.ts` | [orders](flows/orders.md) (điểm vào), [inventory](flows/inventory.md) (điểm vào) |
| `backend/src/orders/orders.module.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/orders.service.ts` | [orders](flows/orders.md) (file), [inventory](flows/inventory.md) (file) |
| `backend/src/orders/quote-export.service.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/quote/company-info.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/quote/puppeteer-quote-renderer.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/quote/quote-renderer.port.ts` | [orders](flows/orders.md) (file) |
| `backend/src/orders/quote/quote-template.ts` | [orders](flows/orders.md) (file) |
| `backend/src/prisma/prisma.module.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/prisma/prisma.service.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/settings/domain/setting-events.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/settings/domain/setting-registry.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/settings/dto/update-vat-rate-request.dto.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/settings/dto/vat-rate-response.dto.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/settings/settings.controller.ts` | [system-settings](flows/system-settings.md) (điểm vào) |
| `backend/src/settings/settings.module.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/settings/settings.service.ts` | [system-settings](flows/system-settings.md) (file) |
| `backend/src/storage/r2-storage.adapter.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/storage/storage.module.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/src/storage/storage.port.ts` | [backend-platform](flows/backend-platform.md) (file) |
| `backend/test/account-permissions.service.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/allowed-transition.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/attachment-limits.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/audit-log-append-only.spec.ts` | [domain-events-audit](flows/domain-events-audit.md) (test) |
| `backend/test/audit.service.spec.ts` | [domain-events-audit](flows/domain-events-audit.md) (test) |
| `backend/test/audit.subscriber.spec.ts` | [domain-events-audit](flows/domain-events-audit.md) (test) |
| `backend/test/auth-decorators.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/auth.config.spec.ts` | [auth-session](flows/auth-session.md) (test) |
| `backend/test/auth.e2e.spec.ts` | [auth-session](flows/auth-session.md) (test) |
| `backend/test/auth.service.spec.ts` | [auth-session](flows/auth-session.md) (test) |
| `backend/test/auto-transition-map.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/change-password.spec.ts` | [auth-session](flows/auth-session.md) (test) |
| `backend/test/cost-snapshot.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/customer-sources.db.integration.spec.ts` | [customers](flows/customers.md) (test) |
| `backend/test/customer-sources.e2e.spec.ts` | [customers](flows/customers.md) (test) |
| `backend/test/customer-sources.service.spec.ts` | [customers](flows/customers.md) (test) |
| `backend/test/customers.db.integration.spec.ts` | [customers](flows/customers.md) (test) |
| `backend/test/customers.e2e.spec.ts` | [customers](flows/customers.md) (test) |
| `backend/test/customers.service.spec.ts` | [customers](flows/customers.md) (test) |
| `backend/test/discount-approvals.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/error-envelope.spec.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/event-bus.integration.spec.ts` | [domain-events-audit](flows/domain-events-audit.md) (test) |
| `backend/test/feature-flags.service.spec.ts` | [system-settings](flows/system-settings.md) (test) |
| `backend/test/gia-von.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/health.spec.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/in-process-event-bus.spec.ts` | [domain-events-audit](flows/domain-events-audit.md) (test) |
| `backend/test/inventory-read-only.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/jwt-auth.guard.spec.ts` | [auth-session](flows/auth-session.md) (test) |
| `backend/test/me.e2e.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/naming-convention.spec.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/no-controller-error-envelope.spec.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/no-direct-side-effect-outside-eventbus.spec.ts` | [domain-events-audit](flows/domain-events-audit.md) (test) |
| `backend/test/no-fabricated-actor-permissions.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/no-handler-without-require-permissions.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/no-hard-delete-customer-source.spec.ts` | [customers](flows/customers.md) (test) |
| `backend/test/no-manual-prisma-client.spec.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/no-order-status-write-outside-transition.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/no-permission-literal-outside-registry.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/no-stock-write-in-cancel.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/no-unscoped-order-write.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/notification-dispatcher.spec.ts` | [domain-events-audit](flows/domain-events-audit.md) (test) |
| `backend/test/openapi-drift.spec.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/order-attachments.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/order-attachments.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/order-cancel.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/order-cancel.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/order-status-change.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/order-status-change.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/order-status.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/order-stock-check.e2e.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/order-stock-check.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/order-stock-issue.db.integration.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/order-stock-issue.e2e.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/order-stock-issue.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/order-totals.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/order-version-actor.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders-detail-scope.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders-detail-scope.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders-list-scope.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders-list.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders-module-wiring.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders-read-gate.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders-write-scope.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders-write-scope.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders.e2e.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/orders.service.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/password-events.spec.ts` | [auth-session](flows/auth-session.md) (test) |
| `backend/test/password-reset.e2e.spec.ts` | [auth-session](flows/auth-session.md) (test) |
| `backend/test/password-reset.service.spec.ts` | [auth-session](flows/auth-session.md) (test) |
| `backend/test/permission-escalation.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/permission-registry-fe-stub-parity.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/permission-registry.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/permissions-drift.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/permissions-guard.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/permissions.guard.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/phone.spec.ts` | [customers](flows/customers.md) (test) |
| `backend/test/price-resolution.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/prisma-wiring.spec.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/product-groups.db.integration.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/product-groups.e2e.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/product-groups.service.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/product-prices.db.integration.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/product-prices.e2e.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/product-prices.service.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/products.e2e.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/products.service.spec.ts` | [catalog](flows/catalog.md) (test) |
| `backend/test/quote-export.service.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/quote-exports.db.integration.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/quote-template.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/r2-storage.adapter.spec.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/role-presets.spec.ts` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `backend/test/scope-preset.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/settings.db.integration.spec.ts` | [system-settings](flows/system-settings.md) (test) |
| `backend/test/settings.e2e.spec.ts` | [system-settings](flows/system-settings.md) (test) |
| `backend/test/settings.service.spec.ts` | [system-settings](flows/system-settings.md) (test) |
| `backend/test/stock-cancel-release.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-cancel-return.db.integration.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-issue-lines.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-items.db.integration.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-items.e2e.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-items.service.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-out-blocked.db.integration.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-reservation.db.integration.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-reservation.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-return-voucher.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-shortfall.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-vouchers.db.integration.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-vouchers.e2e.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/stock-vouchers.service.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/ton-kho.spec.ts` | [inventory](flows/inventory.md) (test) |
| `backend/test/util/fake-storage.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/util/listen-loopback.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/util/strip-comments.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/util/strip-to-code.ts` | [backend-platform](flows/backend-platform.md) (test) |
| `backend/test/vat-mode.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/version-diff.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/warranty-lookup.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/warranty-readonly.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/warranty.spec.ts` | [orders](flows/orders.md) (test) |
| `backend/test/web-source-parses.spec.ts` | [build-ci](flows/build-ci.md) (test) |
| `backend/tsconfig.build.json` | [build-ci](flows/build-ci.md) (file) |
| `backend/tsconfig.json` | [build-ci](flows/build-ci.md) (file) |
| `design-system/components/a11y-floor.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/behavior-components.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/chip-components.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/components.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/data-feedback-components.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/gating.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/parity.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/shell-behavior.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/shell-parity.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/shell-tsx.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/components/shell-web.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/icons/build-icons.mjs` | [design-system](flows/design-system.md) (điểm vào) |
| `design-system/icons/icons.json` | [design-system](flows/design-system.md) (file) |
| `design-system/icons/parity.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/icons/sprite.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/lib/assert-scanned.mjs` | [design-system](flows/design-system.md) (file) |
| `design-system/lib/stock-figures.mjs` | [inventory](flows/inventory.md) (file) |
| `design-system/lib/strip-comments.mjs` | [design-system](flows/design-system.md) (file) |
| `design-system/money/format-vnd.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/money/money-fields.mjs` | [design-system](flows/design-system.md) (file) |
| `design-system/money/money-render-guard.test.mjs` | [design-system](flows/design-system.md) (test) |
| `design-system/money/vnd-format-cases.json` | [design-system](flows/design-system.md) (file) |
| `design-system/package.json` | [build-ci](flows/build-ci.md) (file) |
| `design-system/permissions/build-permission-keys.mjs` | [accounts-permissions](flows/accounts-permissions.md) (điểm vào) |
| `design-system/permissions/permission-keys.test.mjs` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `design-system/screens/customers.test.mjs` | [customers](flows/customers.md) (test) |
| `design-system/screens/discount-approval.test.mjs` | [orders](flows/orders.md) (test) |
| `design-system/screens/forgot-password.test.mjs` | [auth-session](flows/auth-session.md) (test) |
| `design-system/screens/inventory.test.mjs` | [inventory](flows/inventory.md) (test) |
| `design-system/screens/login.test.mjs` | [auth-session](flows/auth-session.md) (test) |
| `design-system/screens/order-attachments.test.mjs` | [orders](flows/orders.md) (test) |
| `design-system/screens/order-cancel.test.mjs` | [orders](flows/orders.md) (test) |
| `design-system/screens/order-detail.test.mjs` | [orders](flows/orders.md) (test) |
| `design-system/screens/order-transition.test.mjs` | [orders](flows/orders.md) (test) |
| `design-system/screens/orders-list.test.mjs` | [orders](flows/orders.md) (test) |
| `design-system/screens/orders.test.mjs` | [orders](flows/orders.md) (test) |
| `design-system/screens/profile.test.mjs` | [auth-session](flows/auth-session.md) (test) |
| `design-system/screens/quote-stock-check.test.mjs` | [inventory](flows/inventory.md) (test) |
| `design-system/screens/settings-customer-sources.test.mjs` | [customers](flows/customers.md) (test) |
| `design-system/screens/stock-issue.test.mjs` | [inventory](flows/inventory.md) (test) |
| `design-system/screens/stock-vouchers.test.mjs` | [inventory](flows/inventory.md) (test) |
| `design-system/screens/warranty-lookup.test.mjs` | [orders](flows/orders.md) (test) |
| `design-system/session/fake-customer-sources-port.test.mjs` | [customers](flows/customers.md) (test) |
| `design-system/session/parity.test.mjs` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `design-system/session/session.test.mjs` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `design-system/tokens/build-tokens.mjs` | [design-system](flows/design-system.md) (điểm vào) |
| `design-system/tokens/design-tokens.json` | [design-system](flows/design-system.md) (file) |
| `design-system/tokens/parity.test.mjs` | [design-system](flows/design-system.md) (test) |
| `mobile/analysis_options.yaml` | [build-ci](flows/build-ci.md) (file) |
| `mobile/lib/design_system/components/attachment_gallery.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/banner.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/button.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/card.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/cart_line_row.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/checkbox.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/chip.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/components.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/dashed_rect.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/dialog.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/empty_state.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/error_state.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/field.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/image_upload.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/kpi.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/money_text.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/share_button.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/sheet.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/skeleton.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/status_chip.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/stepper.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/components/table.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/gating/app_gate.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/gating/app_permission_keys.g.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/gating/app_permissions.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/gating/gating.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/icons/app_icons.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/session/app_session.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/session/app_session_gating_example.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/session/catalog_port.dart` | [catalog](flows/catalog.md) (file) |
| `mobile/lib/design_system/session/customers_port.dart` | [customers](flows/customers.md) (file) |
| `mobile/lib/design_system/session/fake_catalog_port.dart` | [catalog](flows/catalog.md) (file) |
| `mobile/lib/design_system/session/fake_customers_port.dart` | [customers](flows/customers.md) (file) |
| `mobile/lib/design_system/session/fake_inventory_port.dart` | [inventory](flows/inventory.md) (file) |
| `mobile/lib/design_system/session/fake_me_port.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/session/fake_orders_port.dart` | [orders](flows/orders.md) (file) |
| `mobile/lib/design_system/session/fake_password_port.dart` | [auth-session](flows/auth-session.md) (file) |
| `mobile/lib/design_system/session/fake_stock_vouchers_port.dart` | [inventory](flows/inventory.md) (file) |
| `mobile/lib/design_system/session/fake_warranty_port.dart` | [orders](flows/orders.md) (file) |
| `mobile/lib/design_system/session/inventory_port.dart` | [inventory](flows/inventory.md) (file) |
| `mobile/lib/design_system/session/me_port.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/session/orders_port.dart` | [orders](flows/orders.md) (file), [inventory](flows/inventory.md) (file) |
| `mobile/lib/design_system/session/password_port.dart` | [auth-session](flows/auth-session.md) (file) |
| `mobile/lib/design_system/session/session.dart` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `mobile/lib/design_system/session/stock_vouchers_port.dart` | [inventory](flows/inventory.md) (file) |
| `mobile/lib/design_system/session/warranty_port.dart` | [orders](flows/orders.md) (file) |
| `mobile/lib/design_system/shell/app_bottom_nav.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/shell/app_mobile_shell.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/shell/app_phone_frame.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/shell/app_tabs.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/shell/app_topbar.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/shell/shell.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/design_system/tokens/app_tokens.dart` | [design-system](flows/design-system.md) (file) |
| `mobile/lib/screens/account/profile_screen.dart` | [auth-session](flows/auth-session.md) (điểm vào) |
| `mobile/lib/screens/auth/forgot_password_screen.dart` | [auth-session](flows/auth-session.md) (điểm vào) |
| `mobile/lib/screens/auth/login_screen.dart` | [auth-session](flows/auth-session.md) (điểm vào) |
| `mobile/lib/screens/customers/customer_detail_screen.dart` | [customers](flows/customers.md) (điểm vào) |
| `mobile/lib/screens/customers/customer_list_screen.dart` | [customers](flows/customers.md) (điểm vào) |
| `mobile/lib/screens/customers/customer_pick_screen.dart` | [customers](flows/customers.md) (điểm vào) |
| `mobile/lib/screens/inventory/inventory_screen.dart` | [inventory](flows/inventory.md) (điểm vào) |
| `mobile/lib/screens/inventory/stock_vouchers_screen.dart` | [inventory](flows/inventory.md) (điểm vào) |
| `mobile/lib/screens/orders/create_quote_screen.dart` | [orders](flows/orders.md) (điểm vào) |
| `mobile/lib/screens/orders/discount_approval_screen.dart` | [orders](flows/orders.md) (điểm vào) |
| `mobile/lib/screens/orders/order_detail_screen.dart` | [orders](flows/orders.md) (điểm vào) |
| `mobile/lib/screens/orders/order_list_screen.dart` | [orders](flows/orders.md) (điểm vào) |
| `mobile/lib/screens/orders/order_status_change_screen.dart` | [orders](flows/orders.md) (điểm vào) |
| `mobile/lib/screens/orders/stock_issue_preview.dart` | [inventory](flows/inventory.md) (file) |
| `mobile/lib/screens/warranty/warranty_lookup_screen.dart` | [orders](flows/orders.md) (điểm vào) |
| `mobile/pubspec.yaml` | [build-ci](flows/build-ci.md) (file) |
| `mobile/test/design_system/app_tabs_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/components/behavior_interaction_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/components/components_render_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/components/invariant_guard_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/components/money_text_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/icons/app_icons_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/session_test.dart` | [accounts-permissions](flows/accounts-permissions.md) (test) |
| `mobile/test/design_system/shell_behavior_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/shell_invariants_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/shell_render_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/design_system/tokens/app_tokens_test.dart` | [design-system](flows/design-system.md) (test) |
| `mobile/test/screens/account/profile_screen_test.dart` | [auth-session](flows/auth-session.md) (test) |
| `mobile/test/screens/auth/forgot_password_screen_test.dart` | [auth-session](flows/auth-session.md) (test) |
| `mobile/test/screens/auth/login_screen_test.dart` | [auth-session](flows/auth-session.md) (test) |
| `mobile/test/screens/customers/customer_screens_test.dart` | [customers](flows/customers.md) (test) |
| `mobile/test/screens/inventory/inventory_screen_test.dart` | [inventory](flows/inventory.md) (test) |
| `mobile/test/screens/inventory/stock_vouchers_screen_test.dart` | [inventory](flows/inventory.md) (test) |
| `mobile/test/screens/orders/create_quote_screen_test.dart` | [orders](flows/orders.md) (test) |
| `mobile/test/screens/orders/discount_approval_screen_test.dart` | [orders](flows/orders.md) (test) |
| `mobile/test/screens/orders/order_detail_attachments_test.dart` | [orders](flows/orders.md) (test) |
| `mobile/test/screens/orders/order_detail_cancel_test.dart` | [orders](flows/orders.md) (test) |
| `mobile/test/screens/orders/order_detail_long_status_test.dart` | [orders](flows/orders.md) (test) |
| `mobile/test/screens/orders/order_detail_screen_test.dart` | [orders](flows/orders.md) (test) |
| `mobile/test/screens/orders/order_list_screen_test.dart` | [orders](flows/orders.md) (test) |
| `mobile/test/screens/orders/order_status_change_screen_test.dart` | [orders](flows/orders.md) (test) |
| `mobile/test/screens/orders/order_stock_issue_test.dart` | [inventory](flows/inventory.md) (test) |
| `mobile/test/screens/orders/quote_stock_check_test.dart` | [inventory](flows/inventory.md) (test) |
| `mobile/test/screens/warranty/warranty_lookup_screen_test.dart` | [orders](flows/orders.md) (test) |
| `web/index.html` | [build-ci](flows/build-ci.md) (file) |
| `web/package.json` | [build-ci](flows/build-ci.md) (file) |
| `web/src/design-system/a11y/a11y.css` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/AttachmentGallery.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Banner.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Button.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Card.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/CartLineRow.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Checkbox.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/ConfirmDialog.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/CustomerTypeChip.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Dialog.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/EmptyState.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/ErrorState.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Field.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Frame.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/ImageUpload.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Kpi.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Money.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/ScopeFlag.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/ShareButton.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Sheet.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Skeleton.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/StatusChip.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Stepper.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/Table.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/components.css` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/format-vnd.ts` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/index.ts` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/components/share.ts` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/gating/Gate.tsx` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/gating/index.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/gating/permission-keys.generated.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/gating/permissions.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/icons/Icon.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/icons/icons.css` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/icons/sprite.ts` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/session/PermissionsProvider.tsx` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/session/SessionGatingExample.tsx` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/session/catalog-port.ts` | [catalog](flows/catalog.md) (file) |
| `web/src/design-system/session/customer-sources-port.ts` | [customers](flows/customers.md) (file) |
| `web/src/design-system/session/customers-port.ts` | [customers](flows/customers.md) (file) |
| `web/src/design-system/session/fake-catalog-port.ts` | [catalog](flows/catalog.md) (file) |
| `web/src/design-system/session/fake-customer-sources-port.ts` | [customers](flows/customers.md) (file) |
| `web/src/design-system/session/fake-customers-port.ts` | [customers](flows/customers.md) (file) |
| `web/src/design-system/session/fake-inventory-port.ts` | [inventory](flows/inventory.md) (file) |
| `web/src/design-system/session/fake-me-port.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/session/fake-orders-port.ts` | [orders](flows/orders.md) (file) |
| `web/src/design-system/session/fake-password-port.ts` | [auth-session](flows/auth-session.md) (file) |
| `web/src/design-system/session/fake-settings-port.ts` | [system-settings](flows/system-settings.md) (file) |
| `web/src/design-system/session/fake-stock-vouchers-port.ts` | [inventory](flows/inventory.md) (file) |
| `web/src/design-system/session/fake-warranty-port.ts` | [orders](flows/orders.md) (file) |
| `web/src/design-system/session/index.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/session/inventory-port.ts` | [inventory](flows/inventory.md) (file) |
| `web/src/design-system/session/me-port.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/session/orders-port.ts` | [orders](flows/orders.md) (file), [inventory](flows/inventory.md) (file) |
| `web/src/design-system/session/password-port.ts` | [auth-session](flows/auth-session.md) (file) |
| `web/src/design-system/session/session.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/session/settings-port.ts` | [system-settings](flows/system-settings.md) (file) |
| `web/src/design-system/session/stock-vouchers-port.ts` | [inventory](flows/inventory.md) (file) |
| `web/src/design-system/session/use-permissions.ts` | [accounts-permissions](flows/accounts-permissions.md) (file) |
| `web/src/design-system/session/warranty-port.ts` | [orders](flows/orders.md) (file) |
| `web/src/design-system/shell/SearchField.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/Seg.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/Sidebar.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/Tabs.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/Toolbar.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/Topbar.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/WebFrame.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/WebShell.tsx` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/index.ts` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/shell/shell.css` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/tokens/tokens.css` | [design-system](flows/design-system.md) (file) |
| `web/src/design-system/tokens/tokens.ts` | [design-system](flows/design-system.md) (file) |
| `web/src/main.tsx` | [auth-session](flows/auth-session.md) (điểm vào) |
| `web/src/screens/account/ProfileScreen.tsx` | [auth-session](flows/auth-session.md) (điểm vào) |
| `web/src/screens/account/profile.css` | [auth-session](flows/auth-session.md) (file) |
| `web/src/screens/auth/ForgotPasswordScreen.tsx` | [auth-session](flows/auth-session.md) (điểm vào) |
| `web/src/screens/auth/LoginScreen.tsx` | [auth-session](flows/auth-session.md) (điểm vào) |
| `web/src/screens/auth/forgot-password.css` | [auth-session](flows/auth-session.md) (file) |
| `web/src/screens/auth/login.css` | [auth-session](flows/auth-session.md) (file) |
| `web/src/screens/customers/CustomerDetailScreen.tsx` | [customers](flows/customers.md) (điểm vào) |
| `web/src/screens/customers/CustomerListScreen.tsx` | [customers](flows/customers.md) (điểm vào) |
| `web/src/screens/customers/CustomerPickScreen.tsx` | [customers](flows/customers.md) (điểm vào) |
| `web/src/screens/customers/customers.css` | [customers](flows/customers.md) (file) |
| `web/src/screens/inventory/InventoryScreen.tsx` | [inventory](flows/inventory.md) (điểm vào) |
| `web/src/screens/inventory/StockVouchersScreen.tsx` | [inventory](flows/inventory.md) (điểm vào) |
| `web/src/screens/inventory/format-gio.ts` | [inventory](flows/inventory.md) (file) |
| `web/src/screens/inventory/inventory.css` | [inventory](flows/inventory.md) (file) |
| `web/src/screens/inventory/stock-vouchers.css` | [inventory](flows/inventory.md) (file) |
| `web/src/screens/orders/CreateQuoteScreen.tsx` | [orders](flows/orders.md) (điểm vào) |
| `web/src/screens/orders/DiscountApprovalScreen.tsx` | [orders](flows/orders.md) (điểm vào) |
| `web/src/screens/orders/OrderDetailScreen.tsx` | [orders](flows/orders.md) (điểm vào) |
| `web/src/screens/orders/OrderStatusChangeScreen.tsx` | [orders](flows/orders.md) (điểm vào) |
| `web/src/screens/orders/OrdersListScreen.tsx` | [orders](flows/orders.md) (điểm vào) |
| `web/src/screens/orders/discount-approval.css` | [orders](flows/orders.md) (file) |
| `web/src/screens/orders/order-detail.css` | [orders](flows/orders.md) (file) |
| `web/src/screens/orders/order-status-change.css` | [orders](flows/orders.md) (file) |
| `web/src/screens/orders/orders-list.css` | [orders](flows/orders.md) (file) |
| `web/src/screens/orders/orders.css` | [orders](flows/orders.md) (file) |
| `web/src/screens/orders/stock-issue-preview.tsx` | [inventory](flows/inventory.md) (file) |
| `web/src/screens/orders/stock-issue.css` | [inventory](flows/inventory.md) (file) |
| `web/src/screens/settings/CustomerSourceConfigScreen.tsx` | [customers](flows/customers.md) (dùng chung), [system-settings](flows/system-settings.md) (dùng chung) |
| `web/src/screens/settings/settings.css` | [customers](flows/customers.md) (dùng chung), [system-settings](flows/system-settings.md) (dùng chung) |
| `web/src/screens/warranty/WarrantyLookupScreen.tsx` | [orders](flows/orders.md) (điểm vào) |
| `web/src/screens/warranty/format-ngay.ts` | [orders](flows/orders.md) (file) |
| `web/src/screens/warranty/warranty-lookup.css` | [orders](flows/orders.md) (file) |
| `web/src/test/css-class-coverage.test.ts` | [design-system](flows/design-system.md) (test) |
| `web/src/test/inventory-screen.test.tsx` | [inventory](flows/inventory.md) (test) |
| `web/src/test/money.test.tsx` | [design-system](flows/design-system.md) (test) |
| `web/src/test/order-stock-issue.test.tsx` | [inventory](flows/inventory.md) (test) |
| `web/src/test/quote-stock-check.test.tsx` | [inventory](flows/inventory.md) (test) |
| `web/src/test/screens-render.test.tsx` | [design-system](flows/design-system.md) (test) |
| `web/src/test/stock-vouchers-screen.test.tsx` | [inventory](flows/inventory.md) (test) |
| `web/tsconfig.json` | [build-ci](flows/build-ci.md) (file) |
| `web/vite.config.ts` | [build-ci](flows/build-ci.md) (file) |
<!-- crew-docs:files:end -->
