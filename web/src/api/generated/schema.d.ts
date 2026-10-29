// GENERATED from backend/openapi/openapi.json — do not edit by hand; regen: `cd web && npm run api:gen`.
/* eslint-disable */

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_check"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AuthController_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AuthController_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AuthController_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/forgot-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AuthController_forgotPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reset-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AuthController_resetPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ChangePasswordController_changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MeController_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AccountsController_list"];
        put?: never;
        post: operations["AccountsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/permission-options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AccountsController_permissionOptions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{id}/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["AccountsController_updatePermissions"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["AccountsController_update"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/audit-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AuditController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/feature-flags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["FeatureFlagsController_findAll"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/feature-flags/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["FeatureFlagsController_toggle"];
        trace?: never;
    };
    "/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProductsController_findAll"];
        put?: never;
        post: operations["ProductsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProductsController_findOne"];
        put?: never;
        post?: never;
        delete: operations["ProductsController_remove"];
        options?: never;
        head?: never;
        patch: operations["ProductsController_update"];
        trace?: never;
    };
    "/products/{productId}/prices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProductPricesController_findByProduct"];
        put: operations["ProductPricesController_replace"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/product-groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProductGroupsController_findAll"];
        put?: never;
        post: operations["ProductGroupsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/product-groups/{id}/reactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ProductGroupsController_reactivate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/product-groups/{id}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["ProductGroupsController_replaceItems"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/product-groups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProductGroupsController_findOne"];
        put?: never;
        post?: never;
        delete: operations["ProductGroupsController_remove"];
        options?: never;
        head?: never;
        patch: operations["ProductGroupsController_update"];
        trace?: never;
    };
    "/customers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomersController_list"];
        put?: never;
        post: operations["CustomersController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers/lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomersController_lookup"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers/{phone}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomersController_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["CustomersController_update"];
        trace?: never;
    };
    "/customer-sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["CustomerSourcesController_findAll"];
        put?: never;
        post: operations["CustomerSourcesController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customer-sources/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["CustomerSourcesController_deactivate"];
        options?: never;
        head?: never;
        patch: operations["CustomerSourcesController_update"];
        trace?: never;
    };
    "/customer-sources/{id}/reactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["CustomerSourcesController_reactivate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_list"];
        put?: never;
        post: operations["OrdersController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/preview-total": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_previewTotal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/pending-discount-approvals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_listPendingDiscounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/warranty-lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_warrantyLookup"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["OrdersController_update"];
        trace?: never;
    };
    "/orders/{id}/lifecycle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_lifecycle"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_listVersions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_confirm"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/reopen": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_revise"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/apply-discount": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_applyDiscount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/resolve-discount": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_resolveDiscount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/line-items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_addLine"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/line-items/{lineId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["OrdersController_removeLine"];
        options?: never;
        head?: never;
        patch: operations["OrdersController_updateLine"];
        trace?: never;
    };
    "/orders/{id}/export-quote": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_exportQuote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/quote/image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_downloadQuoteImage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/quote/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_downloadQuotePdf"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/transition": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_transition"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OrdersController_cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/stock-issue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_getStockIssue"];
        put?: never;
        post: operations["OrdersController_issueStock"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/stock-check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_getStockCheck"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_listAttachments"];
        put?: never;
        post: operations["OrdersController_addAttachments"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/attachments/{attachmentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OrdersController_downloadAttachment"];
        put?: never;
        post?: never;
        delete: operations["OrdersController_removeAttachment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/settings/vat-rate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["SettingsController_getVatRate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["SettingsController_updateVatRate"];
        trace?: never;
    };
    "/settings/company-legal-entity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["SettingsController_getCompanyLegalEntity"];
        put: operations["SettingsController_updateCompanyLegalEntity"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stock-items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["StockItemsController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stock-vouchers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["StockVouchersController_list"];
        put?: never;
        post: operations["StockVouchersController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stock-vouchers/{id}/return": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["StockVouchersController_createReturn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stock-vouchers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["StockVouchersController_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/payment-schedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["PaymentSchedulesController_get"];
        put: operations["PaymentSchedulesController_replace"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/payments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["PaymentsController_record"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/contracts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ContractsController_overview"];
        put?: never;
        post: operations["ContractsController_generate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/contracts/{contractId}/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ContractsController_downloadPdf"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/invoices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["InvoicesController_overview"];
        put?: never;
        post: operations["InvoicesController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/invoices/{invoiceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["InvoicesController_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/invoices/{invoiceId}/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["InvoicesController_downloadPdf"];
        put?: never;
        post: operations["InvoicesController_exportPdf"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dashboard/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["DashboardController_summary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/profit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProfitReportController_profit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        HealthResponseDto: {
            /**
             * @description Trạng thái tổng thể của backend.
             * @example ok
             * @enum {string}
             */
            status: "ok";
            /**
             * @description Kết quả ping DB qua PrismaService (chứng minh wiring AD-1).
             * @example up
             * @enum {string}
             */
            database: "up";
            /**
             * Format: date-time
             * @description Thời điểm phản hồi, ISO-8601 UTC (client hiển thị UTC+7).
             * @example 2026-07-08T09:00:00.000Z
             */
            timestamp: string;
        };
        LoginRequestDto: {
            /**
             * @description SĐT dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra.
             * @example 0912345678
             */
            phone: string;
            /**
             * @description Mật khẩu.
             * @example MatKhauManh!23
             */
            password: string;
        };
        AuthTokensDto: {
            /** @description JWT access token ngắn hạn (stateless; guard Story 2.5 verify). */
            accessToken: string;
            /** @description Refresh token opaque — gửi tới POST /auth/refresh để lấy access token mới (rotate). */
            refreshToken: string;
            /**
             * @description Số giây access token còn hiệu lực.
             * @example 900
             */
            expiresIn: number;
        };
        FieldErrorDto: {
            /**
             * @description Tên field bị lỗi (khớp property của DTO).
             * @example email
             */
            field: string;
            /**
             * @description Mã lỗi field (constraint key của class-validator, vd "isEmail"), string ổn định để FE map.
             * @example isEmail
             */
            code: string;
            /**
             * @description Mô tả người đọc được, có thể đổi/đa ngôn ngữ.
             * @example email phải là địa chỉ email hợp lệ
             */
            message: string;
        };
        ErrorEnvelopeDto: {
            /**
             * @description Mã lỗi string từ enum có tài liệu (ErrorCode). FE map lỗi theo mã này, KHÔNG theo message.
             * @example VALIDATION_ERROR
             */
            code: string;
            /**
             * @description Mô tả lỗi người đọc được (có thể đổi/đa ngôn ngữ).
             * @example Dữ liệu không hợp lệ
             */
            message: string;
            /** @description Danh sách lỗi cấp field (chỉ có ở lỗi validation). Vắng mặt với lỗi không phải validation. */
            fieldErrors?: components["schemas"]["FieldErrorDto"][];
            /**
             * @description ID lần lỗi (UUID v4 hoặc x-request-id) — dùng để tra log server-side cùng sự cố.
             * @example 3f2b0c9e-8a1d-4e2f-9c7a-1b2c3d4e5f60
             */
            traceId: string;
        };
        RefreshRequestDto: {
            /** @description Refresh token đã cấp lúc đăng nhập/refresh trước. */
            refreshToken: string;
        };
        LogoutRequestDto: {
            /** @description Refresh token của phiên cần thu hồi. */
            refreshToken: string;
        };
        ForgotPasswordRequestDto: {
            /**
             * @description SĐT đã đăng ký, dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra.
             * @example 0912345678
             */
            phone: string;
        };
        ForgotPasswordResponseDto: {
            /**
             * @description Số giây mã xác thực còn hiệu lực. Hằng số từ config — không tiết lộ tài khoản có tồn tại hay không.
             * @example 300
             */
            expiresInSeconds: number;
        };
        ResetPasswordRequestDto: {
            /**
             * @description SĐT đã đăng ký (cùng số đã yêu cầu mã), dạng THÔ.
             * @example 0912345678
             */
            phone: string;
            /**
             * @description Mã xác thực 6 chữ số đã nhận.
             * @example 000000
             */
            code: string;
            /**
             * @description Mật khẩu mới. Tối thiểu 8 ký tự, có chữ và số.
             * @example MatKhauMoi123
             */
            newPassword: string;
        };
        ChangePasswordRequestDto: {
            /**
             * @description Mật khẩu hiện tại — bắt buộc để một phiên bị chiếm không tự đổi được.
             * @example MatKhauCu123
             */
            currentPassword: string;
            /**
             * @description Mật khẩu mới. Tối thiểu 8 ký tự, có chữ và số. Phải khác mật khẩu hiện tại.
             * @example MatKhauMoi456
             */
            newPassword: string;
        };
        MeResponseDto: {
            /** @description ID account (UUID). */
            id: string;
            /** @description Email liên hệ (không còn là định danh đăng nhập). */
            email: string;
            /** @description SĐT đăng nhập (E.164) — null khi account chưa có số. */
            phone: string | null;
            /** @description Tên hiển thị. */
            displayName: string;
            /**
             * @description Bộ quyền hiệu lực (sorted, tất định), mỗi phần tử là một key trong `openapi/permissions.json`; FE dựng `PermissionSet` từ mảng này.
             * @example [
             *       "audit.read",
             *       "orders.view_all"
             *     ]
             */
            permissions: string[];
        };
        /**
         * @description Preset có bộ quyền trùng khít bộ quyền của account; null = tuỳ chỉnh. Account không lưu role.
         * @enum {string}
         */
        RolePreset: "THO_KS" | "THI_CONG" | "KE_TOAN" | "KHO_GIAO" | "QUAN_LY" | "ADMIN" | "SUPER_ADMIN";
        AccountPermissionSummaryDto: {
            /** @example 6f1c2a4e-0b7d-4c1a-9d3e-2f5a8b7c9d10 */
            id: string;
            /** @example Trần Văn A */
            displayName: string;
            /**
             * @description SĐT đăng nhập (E.164). null với account cũ chưa có số.
             * @example +84901234567
             */
            phone: string | null;
            /** @example a.tran@phuongnamsolar.vn */
            email: string;
            /** @description false = account đã vô hiệu. */
            isActive: boolean;
            /**
             * @description Bộ quyền đang lưu trên account (sorted).
             * @example [
             *       "catalog.view",
             *       "customers.manage"
             *     ]
             */
            permissions: string[];
            /** @description Preset có bộ quyền trùng khít bộ quyền của account; null = tuỳ chỉnh. Account không lưu role. */
            matchingPreset: components["schemas"]["RolePreset"] | null;
            /**
             * @description Nhãn tiếng Việt của matchingPreset (kể cả preset người gọi không cấp được); null = tuỳ chỉnh.
             * @example Thợ khảo sát
             */
            matchingPresetLabel: string | null;
            /** @description Người gọi có sửa được quyền của account này không (không phải chính mình, và account không mang quyền người gọi không có). */
            editable: boolean;
            /**
             * @description Lý do chỉ đọc khi editable = false; null khi sửa được.
             * @example Đây là tài khoản của bạn.
             */
            readOnlyReason: string | null;
        };
        PermissionTransitionDto: {
            /** @example bat_dau_thi_cong */
            event: string;
            /** @example dacoc */
            from: string;
            /** @example thicong */
            to: string;
        };
        PermissionOptionDto: {
            /** @example quotes.create_edit */
            key: string;
            /** @example Tạo/sửa báo giá */
            label: string;
            /** @example quotes */
            group: string;
            /**
             * @description Quyền phải có kèm thì quyền này mới dùng được (thiếu ⇒ lưu bị từ chối).
             * @example [
             *       "customers.manage",
             *       "catalog.view"
             *     ]
             */
            requires: string[];
            /**
             * @description Phải có ít nhất một trong các quyền này (rỗng = không ràng buộc).
             * @example [
             *       "orders.view_all",
             *       "orders.view_own"
             *     ]
             */
            requiresAnyOf: string[];
            /** @description Người gọi cấp được quyền này không (luật không-leo-thang). */
            grantable: boolean;
            /** @description Các bước chuyển trạng thái đơn mà quyền này điều khiển, theo thứ tự bảng (rỗng = không bước nào). */
            transitions: components["schemas"]["PermissionTransitionDto"][];
        };
        RolePresetOptionDto: {
            key: components["schemas"]["RolePreset"];
            /** @example Thợ khảo sát */
            label: string;
            /**
             * @example [
             *       "catalog.view"
             *     ]
             */
            permissions: string[];
        };
        PermissionOptionsResponseDto: {
            /** @description Mọi quyền trong registry, xếp theo nhóm. */
            permissions: components["schemas"]["PermissionOptionDto"][];
            /** @description Chỉ các preset người gọi cấp được trọn bộ. */
            presets: components["schemas"]["RolePresetOptionDto"][];
        };
        UpdateAccountPermissionsRequestDto: {
            /**
             * @description Bộ quyền MỚI, thay thế toàn bộ bộ cũ.
             * @example [
             *       "catalog.view",
             *       "customers.manage"
             *     ]
             */
            permissions: string[];
        };
        CreateAccountRequestDto: {
            /**
             * @description Họ tên hiển thị.
             * @example Trần Văn A
             */
            displayName: string;
            /**
             * @description SĐT đăng nhập dạng THÔ — backend chuẩn hoá về E.164. Không hợp lệ ⇒ 400, trùng ⇒ 409.
             * @example 0912 345 678
             */
            phone: string;
            /**
             * @description Email liên hệ (backend trim + lowercase). Trùng ⇒ 409.
             * @example a.tran@phuongnamsolar.vn
             */
            email: string;
            /**
             * @description Mật khẩu ban đầu — tối thiểu 8 ký tự, có chữ và số.
             * @example MatKhau123
             */
            password: string;
            /** @description Preset nạp bộ quyền mặc định lúc tạo. Preset người gọi không cấp trọn được ⇒ 403. */
            preset: components["schemas"]["RolePreset"];
            /** @description false = tạo ở trạng thái tạm khoá. */
            isActive: boolean;
        };
        UpdateAccountRequestDto: {
            /**
             * @description Họ tên hiển thị.
             * @example Trần Văn A
             */
            displayName: string;
            /**
             * @description SĐT đăng nhập dạng THÔ — backend chuẩn hoá về E.164. Không hợp lệ ⇒ 400, trùng ⇒ 409.
             * @example 0912 345 678
             */
            phone: string;
            /**
             * @description Email liên hệ (backend trim + lowercase). Trùng ⇒ 409.
             * @example a.tran@phuongnamsolar.vn
             */
            email: string;
            /** @description false = vô hiệu hoá (thu hồi mọi phiên). */
            isActive: boolean;
        };
        /** @enum {string} */
        AuditTargetType: "Order" | "Account" | "Product" | "ProductGroup" | "Customer" | "CustomerSource" | "StockVoucher" | "FeatureFlag" | "SystemSetting";
        AuditChangeDto: {
            /**
             * @description Đường dẫn tới giá trị bị đổi (status, lines[0].unitCost, [1].price); chuỗi rỗng khi dữ liệu là một giá trị đơn.
             * @example status
             */
            field: string;
            /**
             * @description Giá trị trước dạng chuỗi (tối đa 500 ký tự); null khi không có.
             * @example baogia
             */
            before: string | null;
            /**
             * @description Giá trị sau dạng chuỗi (tối đa 500 ký tự); null khi không có.
             * @example dachot
             */
            after: string | null;
            /**
             * @description Field là số tiền nguyên: client hiển thị qua bộ định dạng tiền khi giá trị là số nguyên.
             * @example false
             */
            isMoney: boolean;
        };
        AuditLogEntryDto: {
            /** @example 0b7f1f6e-1d7a-4c1e-9a4a-6a5e2f0c1b33 */
            id: string;
            /**
             * @description Loại sự kiện (mã).
             * @example OrderConfirmed
             */
            eventType: string;
            /**
             * @description Tên hành động tiếng Việt.
             * @example Chốt đơn
             */
            eventLabel: string;
            /** @description Account thực hiện; null = hệ thống tự chạy. */
            actorAccountId: string | null;
            /**
             * @description Tên hiển thị của account thực hiện; null khi hệ thống tự chạy hoặc account không còn.
             * @example Nguyễn Văn A
             */
            actorDisplayName: string | null;
            /** @description Loại đối tượng bị tác động; null khi sự kiện không gắn đối tượng. */
            targetType: components["schemas"]["AuditTargetType"] | null;
            /** @description Mã đối tượng (UUID, hoặc SĐT E.164 với khách hàng). */
            targetId: string | null;
            /**
             * Format: date-time
             * @description Thời điểm nghiệp vụ, ISO-8601 UTC.
             */
            occurredAt: string;
            changes: components["schemas"]["AuditChangeDto"][];
        };
        AuditLogListResponseDto: {
            items: components["schemas"]["AuditLogEntryDto"][];
            /**
             * @description Tổng số bản ghi khớp bộ lọc (KHÔNG phải số dòng của trang này).
             * @example 57
             */
            total: number;
            /**
             * @description Trang hiện tại (bắt đầu từ 1).
             * @example 1
             */
            page: number;
            /**
             * @description Số bản ghi mỗi trang.
             * @example 20
             */
            pageSize: number;
        };
        FeatureFlagResponseDto: {
            /** @description Tên cờ chính tắc (khoá chính). Chỉ những cờ trong registry mới tồn tại. */
            key: string;
            /** @description Nhãn tiếng Việt để hiển thị. */
            label: string;
            /** @description Cờ chưa từng được bấm ⇒ false (mặc định TẮT, fail-closed). */
            enabled: boolean;
        };
        ToggleFeatureFlagRequestDto: {
            /** @description true = bật cờ, false = tắt cờ. */
            enabled: boolean;
        };
        CreateProductRequestDto: {
            /**
             * @description Tên vật tư.
             * @example Tấm pin JA Solar 580W
             */
            name: string;
            /**
             * @description Mã vật tư — duy nhất.
             * @example JAS-580-M10
             */
            sku: string;
            /**
             * @description Đơn vị tính.
             * @example tấm
             */
            unit: string;
            /**
             * @description Giá bán — số nguyên ĐỒNG (không thập phân).
             * @example 2450000
             */
            price: number;
            /**
             * @description Giá vốn — số nguyên ĐỒNG. Ghi được CHỈ khi có quyền costs.view; thiếu quyền mà gửi field này ⇒ 403. Bỏ trống ⇒ 0 (từ Story 6.3 hệ thống tự cập nhật bằng bình quân gia quyền khi nhập kho).
             * @example 1950000
             */
            costPrice?: number;
            /**
             * @description Có theo dõi tồn kho không (pin/inverter = true; công lắp, phí vận chuyển = false).
             * @default true
             */
            tracksStock?: boolean;
            /**
             * @description Cho phép sửa giá tại chỗ lúc lập báo giá (phí lắp đặt = true; tấm pin = false).
             * @default false
             */
            priceEditable?: boolean;
            /**
             * @description Bảo hành mặc định, tính bằng THÁNG. Bỏ trống/null = không bảo hành (công lắp, phí lắp đặt) — đây là giá trị hợp lệ, KHÔNG phải thiếu dữ liệu.
             * @example 144
             */
            warrantyMonths?: number | null;
        };
        ProductPriceResponseDto: {
            id: string;
            /** @description Mua TỪ số lượng này trở lên thì ăn mức giá này. */
            minQty: number;
            /** @description Đơn giá ở mức này — số nguyên ĐỒNG. */
            price: number;
        };
        ProductResponseDto: {
            id: string;
            name: string;
            sku: string;
            unit: string;
            /** @description Giá bán — số nguyên ĐỒNG. */
            price: number;
            /** @description Giá vốn — số nguyên ĐỒNG. CHỈ có mặt khi caller mang quyền costs.view; thiếu quyền ⇒ field bị loại khỏi payload (không phải 0, không phải null). */
            costPrice?: number;
            tracksStock: boolean;
            priceEditable: boolean;
            /** @description Bảo hành mặc định (tháng). `null` = không bảo hành (hợp lệ). */
            warrantyMonths?: number | null;
            /** @description false = đã ẩn khỏi danh mục (soft-delete). */
            isActive: boolean;
            /** @description Bậc thang giá theo số lượng, sắp xếp minQty tăng dần. CHỈ có mặt khi cờ catalog.tiered_pricing BẬT; cờ TẮT ⇒ field bị loại khỏi payload (không phải mảng rỗng). Rỗng = cờ bật nhưng sản phẩm chưa cấu hình mức nào. */
            prices?: components["schemas"]["ProductPriceResponseDto"][];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        UpdateProductRequestDto: {
            /**
             * @description Tên vật tư.
             * @example Tấm pin JA Solar 580W
             */
            name?: string;
            /**
             * @description Mã vật tư — duy nhất.
             * @example JAS-580-M10
             */
            sku?: string;
            /**
             * @description Đơn vị tính.
             * @example tấm
             */
            unit?: string;
            /**
             * @description Giá bán — số nguyên ĐỒNG (không thập phân).
             * @example 2450000
             */
            price?: number;
            /**
             * @description Giá vốn — số nguyên ĐỒNG. Ghi được CHỈ khi có quyền costs.view; thiếu quyền mà gửi field này ⇒ 403.
             * @example 1950000
             */
            costPrice?: number;
            /** @description Có theo dõi tồn kho không (pin/inverter = true; công lắp, phí vận chuyển = false). */
            tracksStock?: boolean;
            /** @description Cho phép sửa giá tại chỗ lúc lập báo giá (phí lắp đặt = true; tấm pin = false). */
            priceEditable?: boolean;
            /**
             * @description Bảo hành mặc định, tính bằng THÁNG. `null` = không bảo hành (công lắp, phí lắp đặt) — giá trị hợp lệ, KHÔNG phải thiếu dữ liệu.
             * @example 144
             */
            warrantyMonths?: number | null;
        };
        ProductPriceDto: {
            /** @description Mua TỪ số lượng này trở lên thì ăn mức giá này. Tối thiểu 2 — mức 1 chính là giá gốc của sản phẩm. */
            minQty: number;
            /** @description Đơn giá ở mức này — số nguyên ĐỒNG. */
            price: number;
        };
        ReplaceProductPricesRequestDto: {
            /** @description Bậc thang MỚI, thay thế toàn bộ bậc thang cũ. Mảng rỗng = xoá hết, quay về một giá. */
            prices: components["schemas"]["ProductPriceDto"][];
        };
        ProductGroupResponseDto: {
            id: string;
            /** @example Gói Hybrid 8kW */
            name: string;
            description?: string | null;
            /** @description false = gói đã rút khỏi picker (soft-delete). */
            isActive: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        CreateProductGroupRequestDto: {
            /**
             * @description Tên gói — duy nhất trong danh mục (trùng ⇒ 409).
             * @example Gói Hybrid 8kW
             */
            name: string;
            /**
             * @description Mô tả cho người dựng báo giá.
             * @example Trọn bộ hybrid 8kW cho nhà phố, gồm pin + inverter + phụ kiện.
             */
            description?: string;
        };
        ReplaceProductGroupItemsRequestDto: {
            /**
             * @description Danh sách sản phẩm con MỚI, thay thế toàn bộ danh sách cũ. THỨ TỰ MẢNG là thứ tự hiện trên checklist. Mảng rỗng = gói không có món nào (hợp lệ).
             * @example [
             *       "3b1f0c9a-5d2e-4a7b-8c6d-9e0f1a2b3c4d",
             *       "7e6d5c4b-3a2f-4b1e-9d8c-0a1b2c3d4e5f"
             *     ]
             */
            productIds: string[];
        };
        ProductGroupItemResponseDto: {
            productId: string;
            /** @example Tấm pin JA Solar 580W */
            name: string;
            /** @example JAS-580-M10 */
            sku: string;
            /** @example tấm */
            unit: string;
            /**
             * @description Giá bán — số nguyên ĐỒNG.
             * @example 2450000
             */
            price: number;
            /** @description false = sản phẩm đã ẩn khỏi danh mục. Món vẫn nằm trong gói (nó bị tắt SAU khi được thêm) — picker phải làm mờ / bỏ tick. */
            isActive: boolean;
            /** @description Thứ tự hiện trên checklist (server gán). */
            displayOrder: number;
        };
        ProductGroupDetailResponseDto: {
            id: string;
            /** @example Gói Hybrid 8kW */
            name: string;
            description?: string | null;
            /** @description false = gói đã rút khỏi picker (soft-delete). */
            isActive: boolean;
            /** @description Các món trong gói, sắp theo displayOrder tăng dần. Rỗng = gói chưa có món nào (hợp lệ). */
            items: components["schemas"]["ProductGroupItemResponseDto"][];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        UpdateProductGroupRequestDto: {
            /**
             * @description Tên gói mới — vẫn phải DUY NHẤT (trùng gói khác ⇒ 409).
             * @example Gói Hybrid 10kW
             */
            name?: string;
            /**
             * @description Mô tả gói. Gửi `null` để XOÁ mô tả (cột nullable).
             * @example Trọn bộ hybrid 10kW cho nhà phố.
             */
            description?: string | null;
        };
        CreateCustomerRequestDto: {
            /**
             * @description SĐT dạng THÔ — backend tự chuẩn hoá về E.164 (`+84…`) và dùng làm khoá chính. Không hợp lệ ⇒ 400.
             * @example 0912 345 678
             */
            phone: string;
            /**
             * @description Loại khách — quyết định bộ trường hợp lệ.
             * @example CA_NHAN
             * @enum {string}
             */
            custType: "CA_NHAN" | "THUONG_MAI";
            /**
             * @description Họ tên (Cá nhân) hoặc tên công ty (Thương mại).
             * @example Nguyễn Văn A
             */
            name: string;
            /**
             * @description CCCD — CHỈ khách Cá nhân. Gửi kèm khách Thương mại ⇒ 400.
             * @example 079201001234
             */
            nationalId?: string | null;
            /**
             * @description Mã số thuế — CHỈ khách Thương mại. Gửi kèm khách Cá nhân ⇒ 400.
             * @example 0312345678
             */
            taxCode?: string | null;
            /**
             * @description Địa chỉ — dùng cho cả hai loại khách.
             * @example 12 Nguyễn Huệ, Quận 1, TP.HCM
             */
            address?: string | null;
            /**
             * @description Tài khoản ngân hàng — CHỈ khách Thương mại. Gửi kèm khách Cá nhân ⇒ 400.
             * @example 0071000123456 - Vietcombank
             */
            bankAccount?: string | null;
            /**
             * @description Nguồn khách (id của CustomerSource) — BẮT BUỘC, không có mặc định. Trỏ tới nguồn không tồn tại ⇒ 400.
             * @example 5f4d3c2b-1a09-4e8d-9c7b-6a5f4e3d2c1b
             */
            sourceId: string;
            /**
             * @description Ghi chú nguồn — BẮT BUỘC khi nguồn được chọn mang cờ `isOther` (thiếu ⇒ 400); optional với nguồn khác.
             * @example Khách cũ giới thiệu
             */
            sourceNote?: string | null;
        };
        CustomerResponseDto: {
            /**
             * @description SĐT đã chuẩn hoá E.164 — khoá chính của khách hàng.
             * @example +84912345678
             */
            phone: string;
            /** @description Loại khách: CA_NHAN | THUONG_MAI. */
            custType: string;
            /** @description Họ tên hoặc tên công ty. */
            name: string;
            /** @description CCCD — chỉ khách Cá nhân; `null` với khách Thương mại. */
            nationalId?: string | null;
            /** @description Mã số thuế — chỉ khách Thương mại; `null` với khách Cá nhân. */
            taxCode?: string | null;
            address?: string | null;
            /** @description Tài khoản ngân hàng — chỉ khách Thương mại. */
            bankAccount?: string | null;
            /** @description Nguồn khách (id của CustomerSource). */
            sourceId: string;
            /** @description Ghi chú nguồn — bắt buộc khi nguồn mang cờ `isOther`. */
            sourceNote?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        CustomerListResponseDto: {
            items: components["schemas"]["CustomerResponseDto"][];
            /**
             * @description Tổng số khách khớp bộ lọc (TOÀN BẢNG, không phải số dòng của trang này).
             * @example 57
             */
            total: number;
            /**
             * @description Trang hiện tại (bắt đầu từ 1).
             * @example 1
             */
            page: number;
            /**
             * @description Số bản ghi mỗi trang.
             * @example 20
             */
            pageSize: number;
        };
        CustomerLookupResponseDto: {
            /**
             * @description Có khách hàng nào mang SĐT này chưa.
             * @example true
             */
            found: boolean;
            /**
             * @description SĐT đã chuẩn hoá E.164 — trả về kể cả khi `found: false` (form tạo khách dùng lại chuỗi này).
             * @example +84912345678
             */
            phone: string;
            /** @description Khách hàng tìm được; `null` khi `found: false`. */
            customer: components["schemas"]["CustomerResponseDto"] | null;
        };
        UpdateCustomerRequestDto: {
            /** @description KHÔNG gửi field này. SĐT là khoá chính, bất biến sau khi tạo — gửi kèm ⇒ 400 (không phải im lặng bỏ qua). */
            phone?: string;
            /**
             * @description Loại khách.
             * @enum {string}
             */
            custType?: "CA_NHAN" | "THUONG_MAI";
            /** @description Họ tên (Cá nhân) hoặc tên công ty (Thương mại). */
            name?: string;
            /** @description CCCD — CHỈ khách Cá nhân. */
            nationalId?: string | null;
            /** @description Mã số thuế — CHỈ khách Thương mại. */
            taxCode?: string | null;
            /** @description Địa chỉ — dùng cho cả hai loại khách. */
            address?: string | null;
            /** @description Tài khoản ngân hàng — CHỈ khách Thương mại. */
            bankAccount?: string | null;
            /** @description Nguồn khách (id của CustomerSource). Trỏ tới nguồn không tồn tại ⇒ 400. */
            sourceId?: string;
            /** @description Ghi chú nguồn — BẮT BUỘC khi nguồn (mới hoặc đang có) mang cờ `isOther`. */
            sourceNote?: string | null;
        };
        CustomerSourceResponseDto: {
            id: string;
            /** @example Facebook */
            name: string;
            description?: string | null;
            /** @description false = nguồn đã ngừng dùng. */
            active: boolean;
            /** @description Thứ tự hiển thị trong form. */
            sortOrder: number;
            /** @description true = nguồn "Khác" ⇒ chọn nó thì `sourceNote` BẮT BUỘC. Đúng một dòng mang cờ này. */
            isOther: boolean;
        };
        CreateCustomerSourceRequestDto: {
            /**
             * @description Tên nguồn — DUY NHẤT trong danh mục (trùng ⇒ 409).
             * @example TikTok
             */
            name: string;
            /**
             * @description Một câu để sale phân biệt lúc nhập ("Fanpage" và "Facebook" nghe giống nhau).
             * @example Khách nhắn tin từ video TikTok của công ty.
             */
            description?: string | null;
            /**
             * @description Thứ tự hiện trên form tạo khách. Vắng ⇒ backend xếp xuống cuối (max + 1).
             * @example 5
             */
            sortOrder?: number;
        };
        UpdateCustomerSourceRequestDto: {
            /**
             * @description Tên nguồn mới — vẫn phải DUY NHẤT (trùng dòng khác ⇒ 409).
             * @example Cộng tác viên
             */
            name?: string;
            /**
             * @description Mô tả cho người nhập. Gửi `null` để XOÁ mô tả (cột nullable).
             * @example Khách do cộng tác viên giới thiệu về.
             */
            description?: string | null;
            /**
             * @description Thứ tự hiện trên form tạo khách.
             * @example 4
             */
            sortOrder?: number;
        };
        CreateOrderRequestDto: {
            /**
             * @description SĐT khách — thô hay E.164 đều được, backend chuẩn hoá trước khi tra (AD-9). Khách chưa tồn tại ⇒ 404 (luồng tạo khách inline đã có ở màn tra SĐT).
             * @example 0912345678
             */
            customerPhone: string;
        };
        OrderLineItemResponseDto: {
            id: string;
            /** @description `null` = dòng tự do; có giá trị = dòng trỏ Product danh mục. */
            productId?: string | null;
            /** @description Tên dòng — nhiều dòng được. */
            name: string;
            /** @example tấm */
            unit: string;
            qty: number;
            /** @description Đơn giá HIỆU LỰC — số nguyên ĐỒNG (giá sống với dòng catalog không sửa giá). */
            unitPrice: number;
            /** @description true = giá sửa được tại chỗ (dòng tự do, hoặc Product.priceEditable). */
            priceEditable: boolean;
            /** @description Cờ "linh động/dự kiến" — chỉ hiển thị. */
            isFlexible: boolean;
            note?: string | null;
            /** @description Bảo hành (tháng), copy default từ Product — hành vi thuộc Story 4.9. */
            warrantyMonths?: number | null;
            /** @description Thứ tự hiển thị trong giỏ (server gán). */
            displayOrder: number;
            /**
             * @description Thành tiền = unitPrice hiệu lực × qty — SERVER tính (AD-16).
             * @example 19600000
             */
            amount: number;
        };
        OrderDiscountDto: {
            /** @description Mức chiết khấu đề xuất — integer đồng. */
            amount: number;
            /**
             * @description Trạng thái hồ sơ duyệt: 'cho_duyet' | 'dong_y' | 'tu_choi' (phân biệt với Order.status 'choduyet').
             * @example cho_duyet
             */
            status: string;
            requestNote?: string | null;
            /** @description Lý do duyệt / từ chối — null khi chưa resolve. */
            resolveNote?: string | null;
            /**
             * Format: date-time
             * @description Thời điểm gửi duyệt.
             */
            requestedAt: string;
            /** Format: date-time */
            resolvedAt?: string | null;
        };
        OrderResponseDto: {
            id: string;
            /**
             * @description Trạng thái đơn — đơn mới luôn 'baogia'; mọi thay đổi đi qua applyTransition().
             * @example baogia
             */
            status: string;
            /** @description SĐT khách (E.164) — FK về Customer. */
            customerPhone: string;
            /** @description Con trỏ bản hiệu lực (AD-6) — luôn có sau khi tạo xong. */
            currentVersionId?: string | null;
            /** @description Người tạo/phụ trách (AD-15) — actor lúc tạo. */
            ownerAccountId: string;
            assigneeAccountId?: string | null;
            /** @description SNAPSHOT nguồn khách LÚC TẠO đơn (FR-35) — copy từ Customer.sourceId, không đổi theo khách. */
            sourceId: string;
            /** @description Loại khách — nhãn báo cáo, copy từ Customer lúc tạo. */
            custType: string;
            /** @description Phạm vi: thiết bị. Hành vi preset thuộc Story 4.3. */
            scopeEquipment: boolean;
            /** @description Phạm vi: thi công. Hành vi preset thuộc Story 4.3. */
            scopeConstruction: boolean;
            /** @description Phạm vi: vận chuyển. Hành vi preset thuộc Story 4.3. */
            scopeDelivery: boolean;
            /** @description Công suất hệ (kWp) — Float tối đa 2 chữ số lẻ (vd 8.82), nhập qua PATCH (Story 4.4). null = chưa nhập. */
            kWp?: number | null;
            /**
             * @description Tick áp VAT: 'co_vat' | 'khong_vat' — đơn mới luôn 'co_vat'; null chỉ ở đơn tạo trước 4.4 (tính như có VAT).
             * @enum {string|null}
             */
            vatMode?: "co_vat" | "khong_vat" | null;
            /** @description Hạn hiệu lực báo giá — chuỗi tự do ≤ 200 ký tự, Phase 1 chỉ hiển thị (Story 4.4). null = chưa nhập. */
            validityNote?: string | null;
            /** @description Lý do huỷ đơn (Story 5.7) — null khi đơn chưa huỷ. KHÔNG rào theo quyền: ai xem được đơn thì xem được lý do huỷ của nó. */
            cancelReason?: string | null;
            /**
             * Format: date-time
             * @description Thời điểm huỷ (ISO-8601 UTC) — CÙNG một giá trị với `occurredAt` của hàng audit huỷ. null khi đơn chưa huỷ.
             */
            cancelledAt?: string | null;
            /** @description Dòng của BẢN HIỆU LỰC (qua currentVersionId), sắp theo displayOrder tăng dần. Rỗng = đơn mới tạo. */
            lineItems: components["schemas"]["OrderLineItemResponseDto"][];
            /** @description Trạng thái chiết khấu — approval MỚI NHẤT (Story 4.7); null = đơn chưa từng áp chiết khấu. */
            discount?: components["schemas"]["OrderDiscountDto"] | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        PreviewTotalLineDto: {
            /**
             * @description Đơn giá — số nguyên ĐỒNG, echo từ số backend đã trả.
             * @example 2450000
             */
            unitPrice: number;
            /**
             * @description Số lượng — nguyên, tối thiểu 1.
             * @example 8
             */
            qty: number;
        };
        PreviewTotalRequestDto: {
            /** @description Các dòng giỏ hàng đang hiển thị. Mảng RỖNG hợp lệ (giỏ vừa xoá sạch ⇒ tổng 0). Tối đa 500 dòng. */
            lines: components["schemas"]["PreviewTotalLineDto"][];
            /**
             * @description Tick áp VAT — client ECHO từ `Order.vatMode` (như đã echo unitPrice), KHÔNG BAO GIỜ gửi rate. Vắng field = đơn cũ vatMode null ⇒ tính như có VAT.
             * @enum {string}
             */
            vatMode?: "co_vat" | "khong_vat";
            /**
             * @description Chiết khấu — client ECHO từ `Order.discount.amount` (Story 4.7), KHÔNG tự tính. Int ≥ 0; vượt subtotal ⇒ 400. Vắng field = không chiết khấu.
             * @example 2000000
             */
            discountAmount?: number;
        };
        PreviewTotalResponseDto: {
            /** @description Tổng trước VAT — integer đồng. */
            subtotal: number;
            /** @description Chiết khấu ĐÃ ÁP cho lần tính này — echo từ request (0 khi vắng); VAT tính trên subtotal − discountAmount (Story 4.7). */
            discountAmount: number;
            /** @description Tiền VAT — integer đồng, round-half-up một điểm. */
            vatAmount: number;
            /** @description Tổng sau VAT — integer đồng. */
            total: number;
            /** @description Thuế suất (%) ĐÃ ÁP cho lần tính này — backend resolve từ config hệ thống, client chỉ hiển thị nhãn (vd "VAT 8%"). */
            vatRate: number;
            /** @description Lần tính này có áp VAT không — theo vatMode client echo (vắng/co_vat ⇒ true). */
            applyVat: boolean;
        };
        DiscountPendingLineDto: {
            /** @description Tên dòng báo giá. */
            name: string;
            /** @description Số lượng. */
            qty: number;
            /** @description Đơn giá HIỆU LỰC hiện tại — integer đồng. */
            unitPrice: number;
            /** @description Biên ƯỚC TÍNH (%) theo Product.costPrice HIỆN HÀNH — integer half-up; null khi dòng tự do, unitPrice = 0, hoặc actor thiếu costs.view (FR-37). */
            estimatedMarginPct?: number | null;
        };
        DiscountPendingItemDto: {
            /** @description Id đơn hàng chờ duyệt chiết khấu. */
            orderId: string;
            /** @description SĐT khách (E.164). */
            customerPhone: string;
            /** @description Mức chiết khấu đề xuất — integer đồng. */
            amount: number;
            /** @description Lý do đề xuất — nullable. */
            requestNote?: string | null;
            /** @description Id người đề xuất. */
            requestedByAccountId: string;
            /** @description Tên hiển thị người đề xuất. */
            requestedByDisplayName: string;
            /**
             * Format: date-time
             * @description Thời điểm gửi duyệt.
             */
            requestedAt: string;
            /** @description Giá gốc (tổng tiền hàng trước chiết khấu) — backend tính. */
            subtotal: number;
            /** @description Sau chiết khấu (subtotal − amount) — backend tính. */
            afterDiscount: number;
            /** @description Dòng của bản hiệu lực kèm biên ước tính per-line. */
            lines: components["schemas"]["DiscountPendingLineDto"][];
        };
        WarrantyCustomerDto: {
            /** @example +84903176968 */
            phone: string;
            /** @description Họ tên hoặc tên công ty. */
            name: string;
            /** @description Loại khách: CA_NHAN | THUONG_MAI. */
            custType: string;
        };
        WarrantyLineItemDto: {
            id: string;
            /** @description Tên vật tư. */
            name: string;
            qty: number;
            /** @example tấm */
            unit: string;
            /**
             * @description Số tháng bảo hành của DÒNG này.
             * @example 60
             */
            warrantyMonths: number;
            /**
             * Format: date-time
             * @description Ngày DÒNG NÀY chốt lần đầu (ISO-8601 UTC) — mốc theo DÒNG, không theo Đơn (FR-36): hai dòng cùng đơn được phép khác nhau.
             */
            warrantyStartAt: string;
            /**
             * Format: date-time
             * @description Hạn bảo hành (ISO-8601 UTC, luôn `00:00:00Z`) = `warrantyStartAt` + `warrantyMonths` tháng, kẹp về ngày cuối tháng đích.
             */
            warrantyEndAt: string;
            /**
             * @description Số ngày còn lại — ÂM khi đã hết hạn. Đây là số điều khiển `warrantyStatus`; client KHÔNG tự suy trạng thái từ nó.
             * @example 412
             */
            remainingDays: number;
            /**
             * @description Số tháng còn lại, làm tròn XUỐNG, sàn 0 — CHỈ để dựng câu hiển thị "Còn 5 năm".
             * @example 13
             */
            remainingMonths: number;
            /**
             * @description Trạng thái bảo hành — backend quyết, client chỉ ánh xạ ra màu + nhãn.
             * @enum {string}
             */
            warrantyStatus: "con_han" | "sap_het" | "het_han";
        };
        WarrantyOrderDto: {
            id: string;
            /** @description Trạng thái đơn — bộ khoá chip design-system. */
            status: string;
            /**
             * Format: date-time
             * @description Ngày chốt của bản hiệu lực (ISO-8601 UTC); `null` nếu bản đó chưa chốt.
             */
            confirmedAt?: string | null;
            lineItems: components["schemas"]["WarrantyLineItemDto"][];
        };
        WarrantyLookupResponseDto: {
            /** @description Có khách hàng nào mang SĐT này chưa. */
            found: boolean;
            /**
             * @description SĐT đã chuẩn hoá E.164 — trả về kể cả khi `found: false`.
             * @example +84903176968
             */
            phone: string;
            /** @description Khách tìm được; `null` khi `found: false`. */
            customer: components["schemas"]["WarrantyCustomerDto"] | null;
            /** @description Đơn của khách ĐÃ thu hẹp theo quyền người gọi, chỉ giữ đơn còn ít nhất một dòng có bảo hành. */
            orders: components["schemas"]["WarrantyOrderDto"][];
        };
        OrderListItemDto: {
            /** @example 0b7f1f6e-1d7a-4c1e-9a4a-6a5e2f0c1b33 */
            id: string;
            /**
             * @example baogia
             * @enum {string}
             */
            status: "baogia" | "choduyet" | "dachot" | "dacoc" | "thicong" | "nghiemthu" | "danggiao" | "dagiao" | "hoanthanh" | "huy";
            /**
             * @description SĐT khách dạng E.164 (PK khách).
             * @example +84903176968
             */
            customerPhone: string;
            /**
             * @description Tên khách, đọc qua relation.
             * @example Nguyễn Văn A
             */
            customerName: string;
            /** @description Người tạo/sở hữu đơn. */
            ownerAccountId: string;
            /** @description Người được giao chăm đơn; null nếu chưa giao. */
            assigneeAccountId?: string | null;
            /**
             * Format: date-time
             * @description ISO-8601 UTC.
             */
            createdAt: string;
            /**
             * Format: date-time
             * @description ISO-8601 UTC.
             */
            updatedAt: string;
        };
        OrderListResponseDto: {
            items: components["schemas"]["OrderListItemDto"][];
            /**
             * @description Tổng số đơn khớp bộ lọc và trong phạm vi quyền (KHÔNG phải số dòng của trang này).
             * @example 57
             */
            total: number;
            /**
             * @description Trang hiện tại (bắt đầu từ 1).
             * @example 1
             */
            page: number;
            /**
             * @description Số bản ghi mỗi trang.
             * @example 20
             */
            pageSize: number;
        };
        OrderLifecycleStepDto: {
            /**
             * @example baogia
             * @enum {string}
             */
            status: "baogia" | "choduyet" | "dachot" | "dacoc" | "thicong" | "nghiemthu" | "danggiao" | "dagiao" | "hoanthanh" | "huy";
            /**
             * @description Đơn đã qua bước này / đang đứng ở đây / sắp tới.
             * @enum {string}
             */
            progress: "done" | "current" | "upcoming";
        };
        OrderNextStepDto: {
            /** @description Sự kiện phải gửi lên `POST /orders/{id}/transition` để đi bước này. */
            event: string;
            /**
             * @description Đơn sẽ tới trạng thái nào — do bảng transition quyết, không do client.
             * @enum {string}
             */
            to: "baogia" | "choduyet" | "dachot" | "dacoc" | "thicong" | "nghiemthu" | "danggiao" | "dagiao" | "hoanthanh" | "huy";
            /** @description Quyền mà bước này đòi (thông tin hiển thị/chẩn đoán). */
            requires: string;
        };
        OrderLifecycleResponseDto: {
            steps: components["schemas"]["OrderLifecycleStepDto"][];
            /** @description Bước kế tiếp NGƯỜI GỌI bấm được. MẢNG RỖNG ⇒ nút "Chuyển trạng thái" ẩn hẳn, không vẽ xám (UX-DR-22). */
            nextSteps: components["schemas"]["OrderNextStepDto"][];
            /** @description Người gọi này huỷ được đơn này không (Story 5.7) — tính từ bảng transition × trạng thái hiện tại × quyền THẬT. `false` ⇒ ẩn HẲN nút "Huỷ đơn", không vẽ xám (UX-DR-22). Client KHÔNG suy được cờ này từ `nextSteps`: `huy` không thuộc lane thủ công nên không bao giờ có mặt ở đó. */
            canCancel: boolean;
        };
        QtyChangeDto: {
            /** @description Tên dòng ở bản mới. */
            name: string;
            /** @description Số lượng ở bản trước. */
            from: number;
            /** @description Số lượng ở bản này. */
            to: number;
        };
        VersionChangesDto: {
            /** @description Tên các dòng mới thêm. */
            added: string[];
            /** @description Tên các dòng bị xoá. */
            removed: string[];
            qtyChanged: components["schemas"]["QtyChangeDto"][];
        };
        OrderVersionItemDto: {
            id: string;
            /**
             * @description Số thứ tự bản, bắt đầu từ 1.
             * @example 1
             */
            versionNo: number;
            /** @description Bản đang hiệu lực (theo currentVersionId). */
            isCurrent: boolean;
            /**
             * Format: date-time
             * @description ISO-8601 UTC.
             */
            createdAt: string;
            /**
             * Format: date-time
             * @description Thời điểm bản này được Chốt; null nếu chưa chốt.
             */
            confirmedAt?: string | null;
            createdByAccountId?: string | null;
            /** @description Tên hiển thị người tạo bản; null với bản cũ không có actor. */
            createdByDisplayName?: string | null;
            /** @description Số dòng của chính bản này. */
            lineCount: number;
            changes: components["schemas"]["VersionChangesDto"];
        };
        OrderVersionsResponseDto: {
            items: components["schemas"]["OrderVersionItemDto"][];
        };
        UpdateOrderRequestDto: {
            /** @description Cờ phạm vi Thi công — chỉ đổi được khi đơn còn ở baogia. */
            scopeConstruction?: boolean;
            /** @description Cờ phạm vi Vận chuyển — chỉ đổi được khi đơn còn ở baogia. */
            scopeDelivery?: boolean;
            /**
             * @description Tick áp VAT (FR-3): 'co_vat' | 'khong_vat' — chỉ đổi được khi đơn còn ở baogia (4.5 snapshot lúc Chốt).
             * @enum {string}
             */
            vatMode?: "co_vat" | "khong_vat";
            /** @description Công suất hệ (kWp) — số > 0, tối đa 2 chữ số lẻ (vd 8.82). Gửi null để xoá. */
            kWp?: number | null;
            /** @description Hạn hiệu lực báo giá — chuỗi tự do ≤ 200 ký tự (vd "48h kể từ ngày lên PO"), Phase 1 chỉ hiển thị. Gửi null để xoá. */
            validityNote?: string | null;
        };
        ApplyDiscountRequestDto: {
            /**
             * @description Mức chiết khấu — số nguyên ĐỒNG trên Đơn, tối thiểu 1; vượt subtotal hiện hành ⇒ 400.
             * @example 2000000
             */
            amount: number;
            /** @description Lý do đề xuất chiết khấu — optional, hiện trên màn duyệt. */
            note?: string | null;
        };
        ResolveDiscountRequestDto: {
            /** @description true = đồng ý (đơn Ở NGUYÊN choduyet — được Chốt qua /confirm); false = từ chối (đơn về baogia). */
            approve: boolean;
            /** @description Lý do duyệt / từ chối — BẮT BUỘC khi từ chối (thiếu ⇒ 400), optional khi đồng ý; ghi Audit log. */
            reason?: string | null;
        };
        AddLineItemRequestDto: {
            /** @description Id sản phẩm danh mục. Vắng mặt = dòng tự do. Id không tồn tại ⇒ 400 kèm fieldErrors. */
            productId?: string;
            /**
             * @description Số lượng — nguyên, tối thiểu 1.
             * @example 8
             */
            qty: number;
            /**
             * @description Đơn giá — số nguyên ĐỒNG. BẮT BUỘC với dòng tự do. Với dòng catalog: CHỈ được gửi khi Product.priceEditable = true (ngược lại 400) — mặc định backend auto-điền theo danh mục hiện tại.
             * @example 2450000
             */
            unitPrice?: number;
            /**
             * @description Tên dòng (nhiều dòng được) — BẮT BUỘC với dòng tự do; dòng catalog bỏ qua (copy từ Product).
             * @example Combo phụ kiện lắp đặt
             *     (dây DC + jack MC4)
             */
            name?: string;
            /**
             * @description Đơn vị tính — BẮT BUỘC với dòng tự do; dòng catalog bỏ qua (copy từ Product).
             * @example bộ
             */
            unit?: string;
            /** @description Diễn giải cho dòng — nullable. */
            note?: string | null;
            /**
             * @description Cờ "linh động/dự kiến" — CHỈ hiển thị, không đổi hành vi giá.
             * @default false
             */
            isFlexible?: boolean;
        };
        UpdateLineItemRequestDto: {
            /** @description Số lượng — nguyên, tối thiểu 1. */
            qty?: number;
            /** @description Đơn giá — số nguyên ĐỒNG. CHỈ dòng priceEditable = true (ngược lại 400). */
            unitPrice?: number;
            /** @description Diễn giải — gửi `null` để xoá. */
            note?: string | null;
            /** @description Cờ "linh động/dự kiến" — chỉ hiển thị. */
            isFlexible?: boolean;
            /** @description Bảo hành (tháng) — nguyên ≥ 1; gửi `null` để bỏ bảo hành (giá trị nghiệp vụ hợp lệ). Dòng catalog priceEditable = true (công lắp/phí lắp đặt): field bị bỏ qua im lặng, luôn giữ null. */
            warrantyMonths?: number | null;
        };
        QuoteExportFileDto: {
            /** @description Tên file gợi ý khi tải/share (vd `bao-gia-1a2b3c4d.png`). */
            fileName: string;
            /** @description Kích thước file — byte. */
            size: number;
        };
        QuoteExportResponseDto: {
            /** @description Id Đơn. */
            orderId: string;
            /** @description Bản hiệu lực lúc xuất — hồ sơ "xuất từ bản nào". */
            orderVersionId: string;
            /**
             * Format: date-time
             * @description Thời điểm xuất (ISO-8601 UTC).
             */
            exportedAt: string;
            /** @description File ảnh PNG. */
            image: components["schemas"]["QuoteExportFileDto"];
            /** @description File PDF. */
            pdf: components["schemas"]["QuoteExportFileDto"];
        };
        StatusChangeRequestDto: {
            /**
             * @description Sự kiện chuyển trạng thái. CHỈ năm sự kiện của lane thủ công — `chot`/`mo_lai`/`huy`/`du_coc`/`ap_chiet_khau` có cửa riêng mang theo logic riêng và bị từ chối 409 ở đây.
             * @example bat_dau_thi_cong
             * @enum {string}
             */
            event: "bat_dau_thi_cong" | "xong_thi_cong" | "bat_dau_giao" | "xong_giao" | "hoan_thanh";
            /** @description Ảnh bằng chứng của bước (JPEG/PNG/WebP) — optional; ngưỡng số ảnh/kích thước do backend kiểm. */
            files?: string[];
        };
        StatusChangeResponseDto: {
            /**
             * @description Trạng thái đơn SAU khi chuyển — đích đến do bảng transition quyết.
             * @enum {string}
             */
            status: "baogia" | "choduyet" | "dachot" | "dacoc" | "thicong" | "nghiemthu" | "danggiao" | "dagiao" | "hoanthanh" | "huy";
            /** @description Thời điểm của bước (ISO-8601 UTC). CÙNG một giá trị với `occurredAt` của hàng audit và của mọi ảnh trong lượt — đây là khoá nối ảnh vào bước (FR-23). */
            occurredAt: string;
            /**
             * @description Số ảnh bằng chứng đã ghi cho bước này (0 là hợp lệ — upload luôn optional).
             * @example 0
             */
            savedAttachmentCount: number;
        };
        CancelOrderRequestDto: {
            /**
             * @description Lý do huỷ đơn — BẮT BUỘC, tối thiểu 3 ký tự sau khi trim (service enforce).
             * @example Khách đổi ý, không lắp nữa
             */
            reason: string;
        };
        CancelOrderResponseDto: {
            /**
             * @description Trạng thái đơn SAU khi huỷ — luôn 'huy'.
             * @example huy
             * @enum {string}
             */
            status: "baogia" | "choduyet" | "dachot" | "dacoc" | "thicong" | "nghiemthu" | "danggiao" | "dagiao" | "hoanthanh" | "huy";
            /** @description Thời điểm huỷ (ISO-8601 UTC). CÙNG một giá trị với cột `cancelledAt` và với `occurredAt` của hàng audit. */
            occurredAt: string;
        };
        StockVoucherCreatorDto: {
            id: string;
            displayName: string;
        };
        StockVoucherLineResponseDto: {
            productId: string;
            /** @description Tên sản phẩm. */
            name: string;
            sku: string;
            /**
             * @description Đơn vị tính.
             * @example tấm
             */
            unit: string;
            /**
             * @description Số lượng (luôn dương; chiều theo `type`).
             * @example 40
             */
            qty: number;
            /** @description Giá vốn / đv — số nguyên ĐỒNG. CHỈ có mặt khi caller mang quyền costs.view; thiếu quyền ⇒ field vắng mặt hẳn (không phải 0, không phải null). */
            unitCost?: number;
        };
        StockVoucherReturnOfDto: {
            id: string;
            /**
             * @description Mã phiếu xuất gốc.
             * @example PK-X-0096
             */
            code: string;
            /** @description Đơn (đã huỷ) của phiếu xuất gốc. */
            orderId: string;
        };
        StockVoucherReturnRefDto: {
            id: string;
            /**
             * @description Mã phiếu nhập trả.
             * @example PK-NT-0004
             */
            code: string;
        };
        StockVoucherDetailDto: {
            id: string;
            /**
             * @description Mã phiếu hiển thị.
             * @example PK-N-0119
             */
            code: string;
            /** @enum {string} */
            type: "nhap" | "xuat";
            /** @description Đơn mà phiếu xuất này gắn vào (một Đơn — một phiếu xuất). CHỈ có mặt ở phiếu xuất gắn đơn; phiếu tự do ⇒ field vắng mặt hẳn (không phải null). */
            orderId?: string;
            /** @description Phiếu xuất gốc mà phiếu nhập trả này nhận hàng về. CHỈ có mặt ở phiếu nhập trả; phiếu khác ⇒ field vắng mặt hẳn. */
            returnOfVoucherId?: string;
            /**
             * Format: date-time
             * @description Thời điểm lưu phiếu (ISO-8601 UTC).
             */
            createdAt: string;
            createdBy: components["schemas"]["StockVoucherCreatorDto"];
            /**
             * @description Số dòng sản phẩm.
             * @example 2
             */
            lineCount: number;
            /**
             * @description Tổng số lượng các dòng (luôn dương).
             * @example 45
             */
            totalQty: number;
            note: string | null;
            lines: components["schemas"]["StockVoucherLineResponseDto"][];
            /** @description CHỈ có mặt ở phiếu nhập trả: phiếu xuất gốc + đơn đã huỷ. */
            returnOf?: components["schemas"]["StockVoucherReturnOfDto"];
            /** @description CHỈ có mặt ở phiếu xuất gắn đơn đã có phiếu nhập trả. */
            returnVoucher?: components["schemas"]["StockVoucherReturnRefDto"];
            /** @description true ⇔ phiếu xuất gắn đơn, đơn đã huỷ, chưa có phiếu nhập trả — backend tính, client không tự suy. */
            canReturn: boolean;
        };
        OrderStockIssueLineDto: {
            productId: string;
            /** @description Product name. */
            name: string;
            sku: string;
            /**
             * @description Unit of measure.
             * @example tấm
             */
            unit: string;
            /**
             * @description Quantity the order needs — sum of the current-version lines of this product.
             * @example 16
             */
            qty: number;
            /**
             * @description Real on-hand right now (unlocked read — for counting against only). No stock record ⇒ 0.
             * @example 40
             */
            onHand: number;
            /**
             * @description Units of `qty` beyond `onHand` right now (≥ 0, backend-computed). A warning, not the decision — the server re-checks under the lock when issuing.
             * @example 0
             */
            shortfall: number;
        };
        OrderStockIssueViewDto: {
            /** @description The order already has its stock-out (one order, one voucher). */
            issued: boolean;
            /** @description The order stock-out — present ONLY when `issued`; not issued ⇒ the field is absent. */
            voucher?: components["schemas"]["StockVoucherDetailDto"];
            /** @description Backend-computed: not issued ∧ status allows a standalone issue (confirmed / deposit paid / in delivery / installing / acceptance) ∧ has stock-tracked lines ∧ caller holds inventory.manage. */
            canIssue: boolean;
            /** @description Backend-computed: some line has `shortfall > 0` right now (always false once issued). A warning, not the decision — the server re-checks under the lock when issuing. */
            blocked: boolean;
            /** @description Lines that will be on the voucher, in canonical order (`fieldErrors` index `lines.{i}.qty` follows it). Empty once issued. */
            lines: components["schemas"]["OrderStockIssueLineDto"][];
            /** @description Names of lines that are not stock-tracked (installation, fees, free-text…) — not on the voucher. Empty once issued. */
            untrackedItems: string[];
        };
        OrderStockCheckLineDto: {
            productId: string;
            /** @description Product name. */
            name: string;
            /**
             * @description Unit of measure.
             * @example tấm
             */
            unit: string;
            /**
             * @description Quantity the order needs — sum of the current-version lines of this product.
             * @example 16
             */
            qty: number;
            /**
             * @description Real on-hand now. No stock record ⇒ 0.
             * @example 40
             */
            onHand: number;
            /**
             * @description Promised to OTHER orders (ledger sum) — what this order itself holds is excluded.
             * @example 0
             */
            reserved: number;
            /**
             * @description `onHand − reserved` — may be negative.
             * @example 40
             */
            available: number;
            /**
             * @description Units of `qty` beyond `available` (≥ 0) — what to bring in.
             * @example 0
             */
            shortfall: number;
            /**
             * @description `short` ⇔ `shortfall > 0`.
             * @enum {string}
             */
            status: "enough" | "short";
        };
        OrderStockCheckDto: {
            /** @description One entry per stock-tracked product of the current version (same-product lines merged), ordered by name then productId. Free-text lines and products that do not track stock are absent. Empty once the stock of the current version has been issued. */
            lines: components["schemas"]["OrderStockCheckLineDto"][];
        };
        OrderStockIssueResultDto: {
            /** @description The order stock-out — just created (201) or already existing (200). `lines[].unitCost` only with costs.view. */
            voucher: components["schemas"]["StockVoucherDetailDto"];
        };
        AttachmentItemDto: {
            id: string;
            /** @description Tên file đã dọn ký tự nguy hiểm lúc ghi, giữ tiếng Việt có dấu. */
            fileName: string;
            /** @example image/jpeg */
            contentType: string;
            /** @description Kích thước byte. */
            size: number;
            /**
             * Format: date-time
             * @description ISO-8601 UTC.
             */
            createdAt: string;
            /** @description Tên hiển thị người tải ảnh lên. */
            uploadedBy: string;
            /** @description Trạng thái TRƯỚC bước ảnh này thuộc về; null với ảnh bổ sung. */
            statusFrom?: string | null;
            /** @description Trạng thái SAU bước ảnh này thuộc về; null với ảnh bổ sung. */
            statusTo?: string | null;
            /** @description Người gọi có xoá được ảnh này không — tính Ở BACKEND (người tải lên HOẶC có quyền chỉnh sửa đơn). Client CHỈ hiển thị, không dựng lại luật. */
            canDelete: boolean;
        };
        AttachmentListResponseDto: {
            items: components["schemas"]["AttachmentItemDto"][];
        };
        AttachmentUploadRequestDto: {
            /** @description Ảnh bổ sung (JPEG/PNG/WebP). Thiếu hoặc rỗng ⇒ 400; ngưỡng số ảnh/kích thước do backend kiểm. */
            files: string[];
        };
        AttachmentUploadResponseDto: {
            /** @description Số ảnh đã lưu trong lượt này. */
            savedAttachmentCount: number;
            attachmentIds: string[];
        };
        VatRateResponseDto: {
            /** @description Thuế suất VAT (%) hiệu lực — Int 0..100. Hệ thống chưa cấu hình ⇒ 8 (default từ registry, không cần seed). */
            ratePercent: number;
        };
        UpdateVatRateRequestDto: {
            /** @description Thuế suất VAT mới (%) — Int 0..100. */
            ratePercent: number;
        };
        CompanyLegalEntityDto: {
            /** @description Tên công ty (pháp nhân) — chuỗi rỗng = chưa cấu hình. */
            legalName: string;
            /** @description Mã số thuế công ty. */
            taxCode: string;
            /** @description Địa chỉ công ty. */
            address: string;
            /** @description Người đại diện ký hợp đồng. */
            representative: string;
            /** @description Chức danh người đại diện. */
            representativeTitle: string;
            /** @description Điện thoại công ty. */
            phone: string;
            /** @description Tài khoản ngân hàng nhận thanh toán (in trên hợp đồng). */
            bankAccount: string;
        };
        StockItemViewDto: {
            productId: string;
            /** @description Tên sản phẩm. */
            name: string;
            sku: string;
            /**
             * @description Đơn vị tính.
             * @example tấm
             */
            unit: string;
            /**
             * @description Tồn thật trong kho.
             * @example 5
             */
            onHand: number;
            /**
             * @description Đã hứa cho đơn đã chốt — tổng ledger giữ chỗ.
             * @example 20
             */
            reserved: number;
            /**
             * @description `onHand − reserved` — CÓ THỂ ÂM.
             * @example -15
             */
            available: number;
            /**
             * @description Phần thiếu phải nhập (0 khi khả dụng không âm).
             * @example 15
             */
            toPurchase: number;
            /**
             * @description du = còn khả dụng · het = khả dụng 0 · am = hứa vượt hàng thật.
             * @enum {string}
             */
            stockStatus: "du" | "het" | "am";
        };
        PurchaseNeedViewDto: {
            productId: string;
            name: string;
            /** @example tấm */
            unit: string;
            /** @example 15 */
            toPurchase: number;
        };
        StockListResponseDto: {
            /** @description Sắp theo tên sản phẩm. */
            items: components["schemas"]["StockItemViewDto"][];
            /** @description Các sản phẩm khả dụng âm của CÙNG tập `items`, sắp `toPurchase` giảm dần rồi theo tên. */
            purchaseList: components["schemas"]["PurchaseNeedViewDto"][];
        };
        StockVoucherLineRequestDto: {
            /** @description Sản phẩm (UUID). */
            productId: string;
            /**
             * @description Số lượng — nguyên dương, tối đa 1000000. Chiều cộng/trừ do `type` của phiếu quyết.
             * @example 40
             */
            qty: number;
            /**
             * @description Giá vốn / đv — số nguyên ĐỒNG. BẮT BUỘC khi phiếu nhập; phiếu xuất KHÔNG được gửi (server tự lấy giá vốn hiện hành).
             * @example 2110000
             */
            unitCost?: number;
        };
        CreateStockVoucherRequestDto: {
            /**
             * @description nhap = nhập kho · xuat = xuất kho không gắn đơn.
             * @enum {string}
             */
            type: "nhap" | "xuat";
            /**
             * @description Ghi chú (vd "Tồn đầu kỳ", lý do xuất). Tối đa 500 ký tự.
             * @example Tồn đầu kỳ
             */
            note?: string;
            /** @description Từ 1 đến 100 dòng; không lặp sản phẩm. */
            lines: components["schemas"]["StockVoucherLineRequestDto"][];
        };
        ReturnVoucherLineRequestDto: {
            /** @description Sản phẩm trên phiếu xuất gốc (UUID). */
            productId: string;
            /**
             * @description Số lượng đếm được khi nhận lại — nguyên dương, tối đa 1000000, không vượt số đã xuất. Sản phẩm không gửi = nhận lại 0.
             * @example 10
             */
            qty: number;
        };
        CreateReturnVoucherRequestDto: {
            /**
             * @description Ghi chú (vd tình trạng hàng nhận lại). Tối đa 500 ký tự.
             * @example 2 tấm nứt kính
             */
            note?: string;
            /** @description Từ 1 đến 100 dòng; không lặp sản phẩm (DUPLICATE_PRODUCT), chỉ sản phẩm có trên phiếu gốc. */
            lines: components["schemas"]["ReturnVoucherLineRequestDto"][];
        };
        StockVoucherSummaryDto: {
            id: string;
            /**
             * @description Mã phiếu hiển thị.
             * @example PK-N-0119
             */
            code: string;
            /** @enum {string} */
            type: "nhap" | "xuat";
            /** @description Đơn mà phiếu xuất này gắn vào (một Đơn — một phiếu xuất). CHỈ có mặt ở phiếu xuất gắn đơn; phiếu tự do ⇒ field vắng mặt hẳn (không phải null). */
            orderId?: string;
            /** @description Phiếu xuất gốc mà phiếu nhập trả này nhận hàng về. CHỈ có mặt ở phiếu nhập trả; phiếu khác ⇒ field vắng mặt hẳn. */
            returnOfVoucherId?: string;
            /**
             * Format: date-time
             * @description Thời điểm lưu phiếu (ISO-8601 UTC).
             */
            createdAt: string;
            createdBy: components["schemas"]["StockVoucherCreatorDto"];
            /**
             * @description Số dòng sản phẩm.
             * @example 2
             */
            lineCount: number;
            /**
             * @description Tổng số lượng các dòng (luôn dương).
             * @example 45
             */
            totalQty: number;
        };
        StockVoucherListResponseDto: {
            /** @description Mới nhất trước; tối đa 100 phiếu. */
            items: components["schemas"]["StockVoucherSummaryDto"][];
        };
        PaymentResponseDto: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            installmentId: string;
            /**
             * @description Số tiền đã thu — số nguyên đồng.
             * @example 16602192
             */
            amount: number;
            /**
             * Format: date
             * @example 2026-10-21
             */
            paidOn: string;
            /** @enum {string} */
            method: "bank_transfer" | "cash";
            note: string | null;
            /**
             * Format: date-time
             * @description Lúc ghi nhận (ISO-8601 UTC).
             */
            recordedAt: string;
        };
        InstallmentResponseDto: {
            /**
             * Format: uuid
             * @description id của đợt — gửi kèm khi ghi nhận thanh toán.
             */
            id: string;
            /**
             * @description Thứ tự đợt, bắt đầu từ 1.
             * @example 1
             */
            seq: number;
            /**
             * @description Phần trăm người dùng nhập; null nếu đợt nhập theo số tiền.
             * @example 20
             */
            percent: number | null;
            /**
             * @description Số tiền của đợt — số nguyên đồng, server phân giải lúc lưu.
             * @example 16602192
             */
            amount: number;
            /** @example Cọc khi ký hợp đồng */
            conditionNote: string;
            /**
             * @description Mốc tự động do server gán theo vị trí: đợt 1 = coc, đợt cuối (khi ≥ 2 đợt) = tat_toan, còn lại null.
             * @enum {string|null}
             */
            milestone: "coc" | "tat_toan" | null;
            /**
             * @description Đã thu cho đợt này — số nguyên đồng.
             * @example 0
             */
            paidAmount: number;
            /**
             * @description Còn phải thu của đợt (amount − paidAmount, không âm) — số nguyên đồng.
             * @example 16602192
             */
            remainingAmount: number;
            /** @enum {string} */
            status: "unpaid" | "partial" | "paid";
            /** @description Các khoản đã thu của đợt, theo ngày thu rồi lúc ghi tăng dần. */
            payments: components["schemas"]["PaymentResponseDto"][];
        };
        PaymentScheduleResponseDto: {
            orderId: string;
            /** @description false ⇒ đơn chưa có lịch (installments rỗng). */
            configured: boolean;
            /** @description Server quyết: đơn đã chốt, chưa đóng VÀ chưa có khoản thu nào thì được cấu hình lịch. Nút Sửa còn cần quyền payments.record. */
            editable: boolean;
            /**
             * @description Tổng đơn sau VAT hiện tại — số nguyên đồng.
             * @example 83010960
             */
            orderTotal: number;
            /**
             * @description Tổng các đợt — số nguyên đồng.
             * @example 83010960
             */
            scheduledTotal: number;
            /**
             * @description orderTotal − scheduledTotal — số nguyên đồng, có thể âm khi các đợt vượt tổng đơn.
             * @example 0
             */
            difference: number;
            /** @description true khi tổng các đợt khớp tổng đơn sau VAT; false ⇒ hiện cảnh báo. */
            totalMatches: boolean;
            /**
             * @description Tổng đã thu của đơn — số nguyên đồng.
             * @example 16602192
             */
            paidTotal: number;
            /**
             * @description orderTotal − paidTotal — số nguyên đồng, có thể âm khi thu vượt tổng đơn.
             * @example 66408768
             */
            remainingTotal: number;
            /**
             * @description Phần trăm đã thu trên tổng đơn, số nguyên làm tròn xuống; 0 khi tổng đơn bằng 0.
             * @example 20
             */
            paidPercent: number;
            /**
             * @description paid khi đã thu đủ tổng đơn sau VAT.
             * @enum {string}
             */
            paymentStatus: "unpaid" | "partial" | "paid";
            /** @description Server quyết: trạng thái đơn cho phép ghi nhận thanh toán. Nút Ghi nhận còn cần quyền payments.record. */
            recordable: boolean;
            installments: components["schemas"]["InstallmentResponseDto"][];
            /**
             * Format: date-time
             * @description Lần lưu lịch gần nhất (ISO-8601 UTC); null khi chưa cấu hình.
             */
            updatedAt: string | null;
        };
        InstallmentInputDto: {
            /**
             * @description Phần trăm của tổng đơn sau VAT, số nguyên 1..100. Gửi ĐÚNG MỘT trong `percent`/`amount`.
             * @example 20
             */
            percent?: number;
            /**
             * @description Số tiền của đợt — số nguyên đồng, 1..2000000000. Gửi ĐÚNG MỘT trong `percent`/`amount`.
             * @example 16602192
             */
            amount?: number;
            /**
             * @description Mô tả điều kiện thu (vd "Cọc khi ký hợp đồng"), 1..200 ký tự sau khi bỏ khoảng trắng hai đầu.
             * @example Cọc khi ký hợp đồng
             */
            conditionNote: string;
        };
        ReplacePaymentScheduleRequestDto: {
            /** @description Các đợt theo thứ tự thu, từ 1 đến 12 đợt. Đợt 1 là cọc; mốc tự động do server gán theo vị trí. */
            installments: components["schemas"]["InstallmentInputDto"][];
        };
        RecordPaymentRequestDto: {
            /**
             * Format: uuid
             * @description Khoá chống ghi trùng do client sinh MỘT lần cho mỗi lần mở form; retry phải gửi lại đúng khoá.
             */
            idempotencyKey: string;
            /**
             * Format: uuid
             * @description id của đợt (không phải seq) — lịch bị thay giữa lúc xem và lúc ghi ⇒ 409 thay vì ghi nhầm đợt.
             */
            installmentId: string;
            /**
             * @description Số tiền thu — số nguyên đồng, 1..2000000000, không vượt phần còn lại của đợt.
             * @example 16602192
             */
            amount: number;
            /**
             * Format: date
             * @description Ngày thu YYYY-MM-DD, không sau hôm nay (giờ Việt Nam).
             * @example 2026-10-21
             */
            paidOn: string;
            /** @enum {string} */
            method: "bank_transfer" | "cash";
            /** @description Ghi chú, tối đa 200 ký tự sau khi bỏ khoảng trắng hai đầu. */
            note?: string;
        };
        AutoTransitionResultDto: {
            /** @enum {string} */
            event: "du_coc" | "hoan_thanh";
            /**
             * @description applied = đơn đã chuyển; already = đơn đã ở đích; skipped = chuyển bị từ chối (tiền VẪN được ghi).
             * @enum {string}
             */
            outcome: "applied" | "already" | "skipped";
            /** @description Lý do bị bỏ qua (khi skipped); null trong trường hợp khác. */
            message: string | null;
        };
        RecordPaymentResponseDto: {
            payment: components["schemas"]["PaymentResponseDto"];
            /** @description Lịch thanh toán HIỆN TẠI sau lần ghi. */
            schedule: components["schemas"]["PaymentScheduleResponseDto"];
            /**
             * @description Trạng thái đơn hiện tại.
             * @example dacoc
             */
            orderStatus: string;
            /** @description null khi lần ghi này không làm đủ mốc nào, và luôn null khi gửi lại cùng khoá. Khi một lần ghi làm đủ cả cọc lẫn tất toán (đợt cọc trả sau cùng), đây là lần chuyển đã đổi trạng thái đơn, nếu không có thì là lần thử sau cùng. */
            autoTransition: components["schemas"]["AutoTransitionResultDto"] | null;
        };
        ContractResponseDto: {
            id: string;
            /**
             * @description Số hợp đồng in trong PDF — `HĐTC-{n}/{năm}` hoặc `HĐMB-{n}/{năm}`.
             * @example HĐTC-2048/2026
             */
            contractNo: string;
            /**
             * @description construction = HĐ Thi công (đơn có cờ Thi công); sale = HĐ Mua bán (chỉ Thiết bị).
             * @enum {string}
             */
            contractType: "construction" | "sale";
            /**
             * @description Số thứ tự bản đơn (version) đã in.
             * @example 1
             */
            versionNo: number;
            /**
             * @description Tên file không đuôi (ASCII); route tải thêm `.pdf`.
             * @example hop-dong-thi-cong-2048
             */
            fileName: string;
            /**
             * @description Kích thước file PDF (byte).
             * @example 48213
             */
            pdfSize: number;
            /**
             * Format: date-time
             * @description Thời điểm sinh (ISO-8601 UTC).
             */
            createdAt: string;
        };
        ContractsOverviewResponseDto: {
            /**
             * @description Loại hợp đồng server suy từ cờ phạm vi của đơn — không chọn tay.
             * @enum {string}
             */
            contractType: "construction" | "sale";
            /** @description true ⇒ POST sẽ sinh được; false ⇒ blockedReason nói vì sao (cùng message POST trả). */
            generatable: boolean;
            /** @description Lý do không sinh được (tiếng Việt), null khi generatable. */
            blockedReason: string | null;
            /**
             * @description Số báo giá tham chiếu — trùng số in trên báo giá của đơn.
             * @example BG-3F2A9B1C
             */
            quoteNo: string;
            /**
             * @description Số thứ tự bản đơn hiệu lực.
             * @example 1
             */
            versionNo: number;
            customerName: string;
            /**
             * @description Số dòng vật tư của bản hiệu lực.
             * @example 4
             */
            lineCount: number;
            /**
             * @description Tổng đơn sau VAT in vào hợp đồng — số nguyên đồng.
             * @example 83010960
             */
            orderTotal: number;
            /**
             * @description Tóm tắt lịch thanh toán: "20/70/10" khi mọi đợt theo %, "N đợt" khi có đợt theo số tiền, null khi chưa có lịch.
             * @example 20/70/10
             */
            scheduleLabel: string | null;
            /** @description Nhãn các ô pháp nhân công ty chưa cấu hình (in "Chưa cấu hình" — không chặn sinh). */
            missingPartyFields: string[];
            /** @description Hợp đồng đã sinh của đơn, mới nhất trước. */
            contracts: components["schemas"]["ContractResponseDto"][];
        };
        InvoiceResponseDto: {
            id: string;
            /**
             * @description Số hoá đơn nội bộ — `HD-{năm}-{số thứ tự ≥ 4 chữ số}`.
             * @example HD-2026-0731
             */
            invoiceNo: string;
            /**
             * @description Số thứ tự bản đơn (version) được chụp lại.
             * @example 1
             */
            versionNo: number;
            /**
             * Format: date-time
             * @description Ngày lập (ISO-8601 UTC).
             */
            issuedAt: string;
            /** @description Tên khách chụp lúc lập. */
            customerName: string;
            /**
             * @description MST khách chụp lúc lập; null khi khách không có MST.
             * @example 0316552018
             */
            customerTaxCode: string | null;
            /**
             * @description Thuế suất VAT (%) chụp lúc lập.
             * @example 8
             */
            vatRate: number;
            /** @description Có áp VAT hay không, chụp lúc lập. */
            applyVat: boolean;
            /**
             * @description Tổng trước chiết khấu và VAT — số nguyên đồng.
             * @example 76862000
             */
            subtotal: number;
            /**
             * @description Chiết khấu đã duyệt — số nguyên đồng (0 khi không có).
             * @example 0
             */
            discountAmount: number;
            /**
             * @description Tiền VAT — số nguyên đồng (0 khi không áp VAT).
             * @example 6148960
             */
            vatAmount: number;
            /**
             * @description Tổng thanh toán sau VAT — số nguyên đồng.
             * @example 83010960
             */
            total: number;
            /**
             * @description Số dòng vật tư trên hoá đơn.
             * @example 4
             */
            lineCount: number;
        };
        InvoicesOverviewResponseDto: {
            /** @description true ⇒ POST sẽ tạo hoá đơn mới; false ⇒ blockedReason nói vì sao, hoặc bản hiện hành đã có hoá đơn (currentInvoiceId). */
            creatable: boolean;
            /** @description Lý do không tạo được (tiếng Việt, cùng message POST trả); null khi tạo được hoặc khi lý do duy nhất là bản hiện hành đã có hoá đơn. */
            blockedReason: string | null;
            /** @description Hoá đơn của bản đơn hiện hành, nếu đã lập. */
            currentInvoiceId: string | null;
            /**
             * @description Số thứ tự bản đơn hiện hành (0 khi chưa có bản).
             * @example 1
             */
            versionNo: number;
            customerName: string;
            /**
             * @description MST khách hiện tại; null khi khách không có MST.
             * @example 0316552018
             */
            customerTaxCode: string | null;
            /**
             * @description Số dòng vật tư của bản hiện hành.
             * @example 4
             */
            lineCount: number;
            /**
             * @description Tổng đơn sau VAT sẽ ghi vào hoá đơn — số nguyên đồng.
             * @example 83010960
             */
            orderTotal: number;
            /** @description Hoá đơn đã tạo của đơn, mới nhất trước. */
            invoices: components["schemas"]["InvoiceResponseDto"][];
        };
        InvoiceSellerDto: {
            /** @description Tên pháp nhân bên bán lúc lập; rỗng = chưa cấu hình. */
            legalName: string;
            /** @description MST bên bán lúc lập; rỗng = chưa cấu hình. */
            taxCode: string;
            /** @description Địa chỉ bên bán lúc lập; rỗng = chưa cấu hình. */
            address: string;
            /** @description Người đại diện lúc lập; rỗng = chưa cấu hình. */
            representative: string;
            /** @description Chức danh người đại diện lúc lập; rỗng = chưa cấu hình. */
            representativeTitle: string;
            /** @description Điện thoại bên bán lúc lập; rỗng = chưa cấu hình. */
            phone: string;
            /** @description Tài khoản ngân hàng bên bán lúc lập; rỗng = chưa cấu hình. */
            bankAccount: string;
        };
        InvoiceLineDto: {
            /**
             * @description Thứ tự dòng trên hoá đơn (tăng dần).
             * @example 1
             */
            displayOrder: number;
            /** @example Tấm pin AE 630W */
            name: string;
            /** @example Tấm */
            unit: string;
            /**
             * @description Số lượng.
             * @example 14
             */
            qty: number;
            /**
             * @description Đơn giá — số nguyên đồng.
             * @example 2583000
             */
            unitPrice: number;
            /**
             * @description Thành tiền — số nguyên đồng.
             * @example 36162000
             */
            amount: number;
        };
        InvoicePdfResponseDto: {
            /**
             * @description Tên file tải về (ASCII, có đuôi .pdf).
             * @example hoa-don-HD-2026-0731.pdf
             */
            fileName: string;
            /**
             * @description Kích thước file — byte.
             * @example 48213
             */
            pdfSize: number;
            /**
             * Format: date-time
             * @description Lúc xuất PDF lần đầu (ISO-8601 UTC).
             */
            exportedAt: string;
        };
        InvoiceDetailResponseDto: {
            id: string;
            /**
             * @description Số hoá đơn nội bộ — `HD-{năm}-{số thứ tự ≥ 4 chữ số}`.
             * @example HD-2026-0731
             */
            invoiceNo: string;
            /**
             * @description Số thứ tự bản đơn (version) được chụp lại.
             * @example 1
             */
            versionNo: number;
            /**
             * Format: date-time
             * @description Ngày lập (ISO-8601 UTC).
             */
            issuedAt: string;
            /** @description Tên khách chụp lúc lập. */
            customerName: string;
            /**
             * @description MST khách chụp lúc lập; null khi khách không có MST.
             * @example 0316552018
             */
            customerTaxCode: string | null;
            /**
             * @description Thuế suất VAT (%) chụp lúc lập.
             * @example 8
             */
            vatRate: number;
            /** @description Có áp VAT hay không, chụp lúc lập. */
            applyVat: boolean;
            /**
             * @description Tổng trước chiết khấu và VAT — số nguyên đồng.
             * @example 76862000
             */
            subtotal: number;
            /**
             * @description Chiết khấu đã duyệt — số nguyên đồng (0 khi không có).
             * @example 0
             */
            discountAmount: number;
            /**
             * @description Tiền VAT — số nguyên đồng (0 khi không áp VAT).
             * @example 6148960
             */
            vatAmount: number;
            /**
             * @description Tổng thanh toán sau VAT — số nguyên đồng.
             * @example 83010960
             */
            total: number;
            /**
             * @description Số dòng vật tư trên hoá đơn.
             * @example 4
             */
            lineCount: number;
            /** @description Đơn mà hoá đơn gắn vào. */
            orderId: string;
            /**
             * @description Số báo giá của đơn ("Gắn đơn") — cùng số in trên báo giá và hợp đồng.
             * @example BG-3F2A9B1C
             */
            quoteNo: string;
            /**
             * @description SĐT khách (E.164) chụp lúc lập.
             * @example +84901234567
             */
            customerPhone: string;
            /** @description Địa chỉ khách chụp lúc lập; null khi không có. */
            customerAddress: string | null;
            seller: components["schemas"]["InvoiceSellerDto"];
            /** @description Các dòng của hoá đơn theo thứ tự hiển thị. */
            lines: components["schemas"]["InvoiceLineDto"][];
            /** @description File PDF đã xuất; null khi chưa xuất. */
            pdf: components["schemas"]["InvoicePdfResponseDto"] | null;
        };
        DashboardStatusCountDto: {
            /**
             * @example baogia
             * @enum {string}
             */
            status: "baogia" | "choduyet" | "dachot" | "dacoc" | "thicong" | "nghiemthu" | "danggiao" | "dagiao" | "hoanthanh" | "huy";
            /**
             * @description Số đơn đang ở trạng thái này.
             * @example 12
             */
            count: number;
        };
        DashboardSummaryResponseDto: {
            /**
             * @example month
             * @enum {string}
             */
            period: "day" | "week" | "month";
            /**
             * @description Ngày đầu kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.
             * @example 2026-10-01
             */
            from: string;
            /**
             * @description Ngày cuối kỳ = hôm nay (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.
             * @example 2026-10-23
             */
            to: string;
            /**
             * @description Tổng tiền đã thu trong kỳ (theo ngày thu) của toàn công ty — số nguyên đồng. null khi thiếu quyền dashboard.finance_view.
             * @example 1240000000
             */
            revenue: number | null;
            /**
             * @description Số đơn tạo trong kỳ, trong phạm vi xem đơn của người gọi. null khi thiếu cả orders.view_all lẫn orders.view_own.
             * @example 37
             */
            newOrderCount: number | null;
            /** @description Số đơn hiện tại theo từng trạng thái (không lọc theo kỳ), đủ mọi trạng thái theo thứ tự quy trình, trong phạm vi xem đơn của người gọi. null khi thiếu cả orders.view_all lẫn orders.view_own. */
            ordersByStatus: components["schemas"]["DashboardStatusCountDto"][] | null;
        };
        /** @enum {string} */
        ProfitGroupBy: "order" | "month" | "assignee" | "source";
        /** @enum {string} */
        ProfitPeriod: "month" | "year" | "custom";
        ProfitFiguresDto: {
            /**
             * @description Doanh thu = Σ(giá bán chốt × số lượng) − chiết khấu đã duyệt, trước VAT — số nguyên đồng.
             * @example 345000000
             */
            revenue: number;
            /**
             * @description Giá vốn = Σ(giá vốn đóng băng lúc xuất kho × số lượng) — số nguyên đồng.
             * @example 262000000
             */
            cost: number;
            /**
             * @description Lợi nhuận gộp = doanh thu − giá vốn — số nguyên đồng.
             * @example 83000000
             */
            grossProfit: number;
            /**
             * @description Biên lợi nhuận gộp, phần trăm nguyên làm tròn nửa lên (có thể âm); null khi doanh thu ≤ 0.
             * @example 24
             */
            marginPct: number | null;
            /**
             * @description Số đơn đã xuất kho được tính.
             * @example 12
             */
            orderCount: number;
        };
        ProfitReportRowDto: {
            /**
             * @description Doanh thu = Σ(giá bán chốt × số lượng) − chiết khấu đã duyệt, trước VAT — số nguyên đồng.
             * @example 345000000
             */
            revenue: number;
            /**
             * @description Giá vốn = Σ(giá vốn đóng băng lúc xuất kho × số lượng) — số nguyên đồng.
             * @example 262000000
             */
            cost: number;
            /**
             * @description Lợi nhuận gộp = doanh thu − giá vốn — số nguyên đồng.
             * @example 83000000
             */
            grossProfit: number;
            /**
             * @description Biên lợi nhuận gộp, phần trăm nguyên làm tròn nửa lên (có thể âm); null khi doanh thu ≤ 0.
             * @example 24
             */
            marginPct: number | null;
            /**
             * @description Số đơn đã xuất kho được tính.
             * @example 12
             */
            orderCount: number;
            /**
             * @description Khoá nhóm: mã đơn | YYYY-MM | mã account người phụ trách (null = đơn chưa giao) | mã nguồn khách.
             * @example 0b7f1f6e-1d7a-4c1e-9a4a-6a5e2f0c1b33
             */
            key: string | null;
            /**
             * @description Nhãn hàng do server dựng: số báo giá BG-XXXXXXXX | MM/YYYY | tên người phụ trách hoặc "Chưa giao người phụ trách" | tên nguồn khách.
             * @example BG-0B7F1F6E
             */
            label: string;
            /**
             * @description Tên khách — chỉ khi nhóm theo đơn, cách nhóm khác null.
             * @example Nguyễn Văn A
             */
            customerName: string | null;
            /**
             * @description Tên người phụ trách — chỉ khi nhóm theo đơn; null khi đơn chưa giao hoặc cách nhóm khác.
             * @example Trần Thị B
             */
            assigneeDisplayName: string | null;
            /**
             * @description Tên nguồn khách — chỉ khi nhóm theo đơn, cách nhóm khác null.
             * @example Facebook
             */
            sourceName: string | null;
            /**
             * Format: date-time
             * @description Thời điểm xuất kho (ISO-8601 UTC) — chỉ khi nhóm theo đơn, cách nhóm khác null.
             */
            issuedAt: string | null;
        };
        ProfitReportResponseDto: {
            /** @example order */
            groupBy: components["schemas"]["ProfitGroupBy"];
            /**
             * @description Ngày đầu kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.
             * @example 2026-10-01
             */
            from: string;
            /**
             * @description Ngày cuối kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.
             * @example 2026-10-30
             */
            to: string;
            totals: components["schemas"]["ProfitFiguresDto"];
            rows: components["schemas"]["ProfitReportRowDto"][];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_check: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Backend còn sống và kết nối được DB. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponseDto"];
                };
            };
        };
    };
    AuthController_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequestDto"];
            };
        };
        responses: {
            /** @description Đăng nhập thành công. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthTokensDto"];
                };
            };
            /** @description Sai thông tin đăng nhập (UNAUTHENTICATED, message generic). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    AuthController_refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshRequestDto"];
            };
        };
        responses: {
            /** @description Cấp access token mới (rotate). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthTokensDto"];
                };
            };
            /** @description Refresh token sai/hết hạn/đã thu hồi (UNAUTHENTICATED). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    AuthController_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LogoutRequestDto"];
            };
        };
        responses: {
            /** @description Thu hồi phiên (idempotent, trung tính). */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AuthController_forgotPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ForgotPasswordRequestDto"];
            };
        };
        responses: {
            /** @description Luôn 200 với cùng một body, dù SĐT tồn tại hay không (chống dò SĐT hợp lệ). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForgotPasswordResponseDto"];
                };
            };
        };
    };
    AuthController_resetPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResetPasswordRequestDto"];
            };
        };
        responses: {
            /** @description Mật khẩu đã đổi, mã đã tiêu thụ, mọi phiên đã bị thu hồi. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Mã sai/hết hạn/đã dùng/vượt số lần thử, hoặc SĐT lạ (UNAUTHENTICATED, một message duy nhất). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ChangePasswordController_changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordRequestDto"];
            };
        };
        responses: {
            /** @description Mật khẩu đã đổi; mọi phiên (kể cả phiên hiện tại) đã bị thu hồi. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Mật khẩu mới không đạt chính sách hoặc trùng mật khẩu hiện tại (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu access token, hoặc mật khẩu hiện tại không đúng (UNAUTHENTICATED). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    MeController_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Danh tính + bộ quyền hiệu lực (sorted) của phiên đang đăng nhập. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MeResponseDto"];
                };
            };
        };
    };
    AccountsController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Mọi account kèm bộ quyền, preset khớp và cờ sửa được. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountPermissionSummaryDto"][];
                };
            };
            /** @description Thiếu permissions.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    AccountsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAccountRequestDto"];
            };
        };
        responses: {
            /** @description Account mới kèm bộ quyền preset đã nạp. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountPermissionSummaryDto"];
                };
            };
            /** @description Thiếu/sai field: họ tên, SĐT, email, mật khẩu, preset (VALIDATION_ERROR, fieldErrors). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu permissions.manage, hoặc preset có quyền người gọi không có (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description SĐT hoặc email đã thuộc account khác (CONFLICT, fieldErrors.phone / .email). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    AccountsController_permissionOptions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Registry quyền (nhãn, nhóm, phụ thuộc, cấp được không) và các preset người gọi cấp được. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PermissionOptionsResponseDto"];
                };
            };
            /** @description Thiếu permissions.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    AccountsController_updatePermissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAccountPermissionsRequestDto"];
            };
        };
        responses: {
            /** @description Account sau khi lưu bộ quyền mới. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountPermissionSummaryDto"];
                };
            };
            /** @description id không phải UUID, key ngoài registry, hoặc có quyền thiếu quyền nó cần (VALIDATION_ERROR, fieldErrors.permissions). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu permissions.manage, tự sửa quyền của mình, sửa account mang quyền người gọi không có, hoặc cấp quyền người gọi không có (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có account này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    AccountsController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAccountRequestDto"];
            };
        };
        responses: {
            /** @description Account sau khi lưu hồ sơ / trạng thái (bộ quyền không đổi). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountPermissionSummaryDto"];
                };
            };
            /** @description id không phải UUID, thiếu/sai field, hoặc gửi kèm mật khẩu (VALIDATION_ERROR, fieldErrors). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu permissions.manage, tự sửa tài khoản của mình, hoặc account mang quyền người gọi không có (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có account này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description SĐT hoặc email đã thuộc account khác (CONFLICT, fieldErrors.phone / .email). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    AuditController_list: {
        parameters: {
            query?: {
                /** @description Lọc theo loại đối tượng. Bỏ trống ⇒ mọi loại. */
                targetType?: components["schemas"]["AuditTargetType"];
                /** @description Từ ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này). */
                from?: string;
                /** @description Đến ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này). */
                to?: string;
                /** @description Trang, bắt đầu từ 1. */
                page?: number;
                /** @description Số bản ghi mỗi trang — tối đa 100. */
                pageSize?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Nhật ký bất biến, mới nhất trước (occurredAt giảm dần, rồi id giảm dần), phân trang. Thiếu costs.view ⇒ các dòng giá vốn bị loại khỏi changes. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogListResponseDto"];
                };
            };
            /** @description VALIDATION_ERROR: targetType lạ, from/to sai định dạng YYYY-MM-DD, from sau to (fieldErrors.to), page/pageSize ngoài khoảng. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quyền audit.read (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    FeatureFlagsController_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description MỌI cờ trong registry kèm trạng thái — cờ chưa từng bấm vẫn hiện ra với enabled=false. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeatureFlagResponseDto"][];
                };
            };
        };
    };
    FeatureFlagsController_toggle: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ToggleFeatureFlagRequestDto"];
            };
        };
        responses: {
            /** @description Trạng thái cờ sau khi bấm. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeatureFlagResponseDto"];
                };
            };
            /** @description Body không hợp lệ (VALIDATION_ERROR) — kèm `fieldErrors`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu system.feature_flags (FORBIDDEN). catalog.manage KHÔNG thay thế được. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Tên cờ không có trong registry (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductsController_findAll: {
        parameters: {
            query?: {
                /** @description true = trả cả sản phẩm đã ẩn (soft-delete). Mặc định chỉ sản phẩm còn hiệu lực. */
                includeInactive?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponseDto"][];
                };
            };
            /** @description Thiếu catalog.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProductRequestDto"];
            };
        };
        responses: {
            /** @description Sản phẩm đã tạo. `costPrice` chỉ có mặt nếu caller có costs.view. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponseDto"];
                };
            };
            /** @description Body không hợp lệ (VALIDATION_ERROR) — kèm `fieldErrors`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu catalog.manage; hoặc body có `costPrice` mà thiếu costs.view (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponseDto"];
                };
            };
            /** @description Thiếu catalog.view (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có sản phẩm với id này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductsController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sản phẩm đã bị ẩn khỏi danh mục (soft-delete, không xoá bản ghi). */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Thiếu catalog.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có sản phẩm với id này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductsController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProductRequestDto"];
            };
        };
        responses: {
            /** @description Sản phẩm sau khi sửa. Sửa giá KHÔNG hồi tố đơn đã chốt (đơn giữ giá snapshot riêng). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponseDto"];
                };
            };
            /** @description Body không hợp lệ (VALIDATION_ERROR) — kèm `fieldErrors`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu catalog.manage; hoặc body có `costPrice` mà thiếu costs.view (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có sản phẩm với id này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductPricesController_findByProduct: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                productId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bậc thang hiện tại, sắp xếp minQty tăng dần. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductPriceResponseDto"][];
                };
            };
            /** @description Thiếu catalog.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có sản phẩm với id này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductPricesController_replace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                productId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReplaceProductPricesRequestDto"];
            };
        };
        responses: {
            /** @description Bậc thang SAU khi thay thế. Mảng rỗng = đã xoá hết, sản phẩm quay về một giá. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductPriceResponseDto"][];
                };
            };
            /** @description minQty < 2, tiền không phải số nguyên, hoặc trùng minQty trong payload (VALIDATION_ERROR) — kèm `fieldErrors`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu catalog.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có sản phẩm với id này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Cờ catalog.tiered_pricing đang TẮT (CONFLICT) — bật cờ trước khi cấu hình bậc thang. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductGroupsController_findAll: {
        parameters: {
            query?: {
                /** @description true = trả cả gói đã rút khỏi picker. Mặc định chỉ gói còn hiệu lực. */
                includeInactive?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Danh sách GỌN — không kèm món. Món ở GET /product-groups/:id. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductGroupResponseDto"][];
                };
            };
            /** @description Thiếu quyền sửa danh mục (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductGroupsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProductGroupRequestDto"];
            };
        };
        responses: {
            /** @description Gói mới — luôn `isActive: true`, và RỖNG (chưa có món nào). */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductGroupResponseDto"];
                };
            };
            /** @description Thiếu/sai `name` (VALIDATION_ERROR) — kèm `fieldErrors`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quyền sửa danh mục (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Tên gói đã có trong danh mục (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductGroupsController_reactivate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Id gói vật tư. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Gói đã bật lại (`isActive: true`). Món con còn nguyên. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductGroupResponseDto"];
                };
            };
            /** @description Thiếu quyền sửa danh mục (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có gói nào mang id đó (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductGroupsController_replaceItems: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Id gói vật tư. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReplaceProductGroupItemsRequestDto"];
            };
        };
        responses: {
            /** @description Gói kèm checklist MỚI. Danh sách cũ đã bị thay sạch (nguyên tử). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductGroupDetailResponseDto"];
                };
            };
            /** @description Sản phẩm lặp trong payload, hoặc `productId` không tồn tại (VALIDATION_ERROR) — kèm `fieldErrors`. KHÔNG có gì được ghi. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quyền sửa danh mục (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có gói nào mang id đó (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductGroupsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Id gói vật tư. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Gói kèm các món, sắp theo displayOrder tăng dần. Món là PROJECTION HẸP của sản phẩm — không có giá vốn. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductGroupDetailResponseDto"];
                };
            };
            /** @description Thiếu quyền sửa danh mục (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có gói nào mang id đó (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductGroupsController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Id gói vật tư. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Gói đã rút khỏi picker (`isActive: false`, soft-delete). Món con còn nguyên, bật lại là dùng được. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Thiếu quyền sửa danh mục (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có gói nào mang id đó (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProductGroupsController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Id gói vật tư. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProductGroupRequestDto"];
            };
        };
        responses: {
            /** @description Gói sau khi sửa. Không cột nào đổi giá trị ⇒ KHÔNG ghi DB và KHÔNG ghi nhật ký. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductGroupResponseDto"];
                };
            };
            /** @description `name` là `null` hoặc rỗng (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quyền sửa danh mục (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có gói nào mang id đó (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Tên mới trùng một gói khác (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomersController_list: {
        parameters: {
            query?: {
                /** @description Tìm theo TÊN hoặc SĐT. SĐT gõ ở dạng người dùng quen (`0903`) — backend tự dựng chuỗi tra tương ứng với PK E.164. */
                q?: string;
                /** @description Lọc theo loại khách. Bỏ trống ⇒ lấy cả hai loại. */
                custType?: "CA_NHAN" | "THUONG_MAI";
                /** @description Trang, bắt đầu từ 1. */
                page?: number;
                /** @description Số bản ghi mỗi trang — tối đa 100. */
                pageSize?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerListResponseDto"];
                };
            };
            /** @description `custType` không hợp lệ, `page` < 1, hoặc `pageSize` ngoài 1..100 (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu customers.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomersController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCustomerRequestDto"];
            };
        };
        responses: {
            /** @description Khách hàng đã tạo. `phone` trả về là chuỗi ĐÃ chuẩn hoá E.164. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerResponseDto"];
                };
            };
            /** @description SĐT không hợp lệ, thiếu/sai `sourceId`, thiếu `sourceNote` khi nguồn là "Khác", hoặc field lạc loại khách (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu customers.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description SĐT đã thuộc về một khách hàng khác (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomersController_lookup: {
        parameters: {
            query: {
                /** @description SĐT dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra. */
                phone: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Luôn 200 — kể cả khi không có khách nào mang SĐT này (`found: false`). Xem DTO. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerLookupResponseDto"];
                };
            };
            /** @description SĐT không hợp lệ (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu customers.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomersController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description SĐT — thô hay E.164 đều được; backend chuẩn hoá trước khi tra (AD-9). */
                phone: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerResponseDto"];
                };
            };
            /** @description SĐT không hợp lệ (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu customers.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có khách hàng với SĐT này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomersController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                phone: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCustomerRequestDto"];
            };
        };
        responses: {
            /** @description Khách hàng sau khi sửa. `phone` KHÔNG sửa được qua đây. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerResponseDto"];
                };
            };
            /** @description Body chứa `phone` (bất biến), field lạc loại khách, `sourceId` không tồn tại, hoặc thiếu `sourceNote` khi nguồn mới là "Khác" (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu customers.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có khách hàng với SĐT này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomerSourcesController_findAll: {
        parameters: {
            query?: {
                /** @description true = trả cả nguồn đã ngừng dùng. Mặc định chỉ nguồn còn hiệu lực (dropdown khách mới). */
                includeInactive?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerSourceResponseDto"][];
                };
            };
            /** @description Thiếu customers.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomerSourcesController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCustomerSourceRequestDto"];
            };
        };
        responses: {
            /** @description Nguồn mới — luôn `active: true` và `isOther: false` (cờ "Khác" chỉ do seed đặt). */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerSourceResponseDto"];
                };
            };
            /** @description Thiếu/sai `name`, `sortOrder` âm… (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu settings.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Tên nguồn đã có trong danh mục (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomerSourcesController_deactivate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Id nguồn khách. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Nguồn đã TẮT (`active: false`) — KHÔNG xoá cứng: khách cũ vẫn giữ nguồn này. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Thiếu settings.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có nguồn nào mang id đó (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Dòng mang cờ "Khác" KHÔNG tắt được — luật bắt buộc ghi rõ nguồn phụ thuộc vào nó (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomerSourcesController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Id nguồn khách. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCustomerSourceRequestDto"];
            };
        };
        responses: {
            /** @description Nguồn sau khi sửa. Dòng mang cờ "Khác" ĐỔI TÊN ĐƯỢC — luật nghiệp vụ đọc cờ, không đọc tên. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerSourceResponseDto"];
                };
            };
            /** @description `name`/`sortOrder` là `null` hoặc sai kiểu (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu settings.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có nguồn nào mang id đó (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Tên mới trùng một nguồn khác (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    CustomerSourcesController_reactivate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Id nguồn khách. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Nguồn đã bật lại (`active: true`). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerSourceResponseDto"];
                };
            };
            /** @description Thiếu settings.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có nguồn nào mang id đó (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_list: {
        parameters: {
            query?: {
                /** @description Lọc theo trạng thái đơn. Bỏ trống ⇒ lấy mọi trạng thái. */
                status?: "baogia" | "choduyet" | "dachot" | "dacoc" | "thicong" | "nghiemthu" | "danggiao" | "dagiao" | "hoanthanh" | "huy";
                /** @description Chỉ lấy đơn CHƯA CHỐT để follow-up (trạng thái 'baogia', FR-10). Không dùng chung với `status`. */
                followUp?: boolean;
                /** @description Trang, bắt đầu từ 1. */
                page?: number;
                /** @description Số bản ghi mỗi trang — tối đa 100. */
                pageSize?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Danh sách đơn ĐÃ thu hẹp theo quyền người gọi: orders.view_all thấy toàn bộ, chỉ orders.view_own thấy đơn mình owner HOẶC assignee. `total` đếm toàn bộ tập đã lọc + đã scope, đọc cùng ảnh chụp với `items`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderListResponseDto"];
                };
            };
            /** @description `status` ngoài 10 khoá, `page` < 1, `pageSize` ngoài 1..100, hoặc gửi đồng thời `followUp` và `status` (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateOrderRequestDto"];
            };
        };
        responses: {
            /** @description Đơn mới ở trạng thái 'baogia' + version 1 rỗng; `sourceId`/`custType` snapshot từ Customer lúc tạo (FR-35); `ownerAccountId` = người gọi. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponseDto"];
                };
            };
            /** @description SĐT không hợp lệ (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description SĐT chưa có khách hàng (NOT_FOUND) — tạo khách trước. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_previewTotal: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreviewTotalRequestDto"];
            };
        };
        responses: {
            /** @description Tổng trước VAT / Tiền VAT / Tổng sau VAT — integer đồng, tính bằng hàm pricing duy nhất (AD-16); kèm `vatRate`/`applyVat` đã áp để client hiển thị nhãn thuế suất; client CHỈ hiển thị. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PreviewTotalResponseDto"];
                };
            };
            /** @description Dòng không hợp lệ (unitPrice < 0, qty < 1, thiếu lines, quá 500 dòng) hoặc vatMode ngoài registry — VALIDATION_ERROR kèm fieldErrors. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_listPendingDiscounts: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Danh sách đơn chờ duyệt chiết khấu — subtotal/afterDiscount backend tính (AD-16); `estimatedMarginPct` per-line CHỈ có giá trị khi caller có THÊM costs.view (FR-37), thiếu ⇒ null toàn bộ. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DiscountPendingItemDto"][];
                };
            };
            /** @description Thiếu discounts.approve — discounts.apply KHÔNG thay thế được (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_warrantyLookup: {
        parameters: {
            query: {
                /** @description SĐT dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra. */
                phone: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description LUÔN 200 — kể cả khi không có khách nào mang SĐT này (`found: false`). Kết quả ĐÃ thu hẹp theo quyền người gọi và chỉ gồm dòng CÓ bảo hành của bản hiệu lực; hạn/trạng thái do backend tính. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WarrantyLookupResponseDto"];
                };
            };
            /** @description SĐT không hợp lệ (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đơn + dòng của bản hiệu lực (qua currentVersionId, AD-6); mỗi dòng kèm `amount` server tính. Tổng đơn KHÔNG có ở đây (Story 4.2). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponseDto"];
                };
            };
            /** @description Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này, HOẶC đơn ngoài phạm vi người gọi (NOT_FOUND — hai ca không phân biệt được từ ngoài). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateOrderRequestDto"];
            };
        };
        responses: {
            /** @description Đơn sau khi PATCH: cờ phạm vi Thi công/Vận chuyển (4.3) và/hoặc metadata vatMode/kWp/validityNote (4.4) — partial. `scopeEquipment` luôn true — không nhận qua body (FR-2). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponseDto"];
                };
            };
            /** @description Cờ không phải boolean/null; vatMode ngoài registry; kWp ≤ 0 hoặc quá 2 chữ số lẻ; validityNote quá 200 ký tự (VALIDATION_ERROR — kèm fieldErrors). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn không còn ở trạng thái 'baogia' — cờ gate máy trạng thái, không đổi giữa vòng đời (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_lifecycle: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Chuỗi bước vòng đời ĐÃ GATE theo cờ phạm vi của đơn (FR-7). Bước bị cờ chặn không có trong mảng — client vẽ nguyên mảng, không lọc, không tự suy từ cờ (AD-2). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderLifecycleResponseDto"];
                };
            };
            /** @description Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_listVersions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description MỌI bản update của đơn theo versionNo tăng dần (FR-6); `isCurrent` phân giải qua currentVersionId (AD-6). KHÔNG có tiền/giá (AD-10). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderVersionsResponseDto"];
                };
            };
            /** @description Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_confirm: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đơn sau khi Chốt: status 'dachot', giá dòng đã đóng băng bằng snapshot (FR-5, AD-6) — unitPrice trong line view tự động = snapshot. Retry trên đơn đã chốt: 200 view hiện tại, không ghi lại, không audit thêm (idempotent, NFR-1). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponseDto"];
                };
            };
            /** @description Báo giá chưa có dòng nào — không có gì để đóng băng (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu orders.confirm — quotes.create_edit KHÔNG thay thế được (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn ở trạng thái khác 'baogia'/'dachot' — không chốt được từ đó (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_revise: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đơn sau khi Mở lại: status 'baogia', version MỚI (versionNo + 1) với dòng copy từ bản đã chốt — snapshot null nên giá dòng catalog live-resolve lại theo danh mục hiện tại (FR-5); bản cũ + snapshot cũ giữ nguyên trong lịch sử (AD-6). Retry trên đơn đang 'baogia': 200 view hiện tại, không version mới, không audit thêm (idempotent, NFR-1). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponseDto"];
                };
            };
            /** @description Thiếu quotes.create_edit — orders.confirm KHÔNG thay thế được (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn ở trạng thái khác 'dachot'/'baogia' — không mở lại được từ đó (CONFLICT). Also: the order already has a stock-out voucher. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_applyDiscount: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplyDiscountRequestDto"];
            };
        };
        responses: {
            /** @description Đơn sau khi áp: status 'choduyet' + `discount.status: 'cho_duyet'` — nội dung đơn đóng băng suốt kỳ duyệt; người có discounts.approve quyết qua /resolve-discount. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponseDto"];
                };
            };
            /** @description amount < 1, vượt subtotal hiện hành, hoặc báo giá chưa có dòng nào (VALIDATION_ERROR — kèm fieldErrors). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu discounts.apply — quotes.create_edit KHÔNG thay thế được (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn ở trạng thái khác 'baogia' — kể cả retry khi đã 'choduyet' (áp KHÔNG idempotent: body mang amount) (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_resolveDiscount: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResolveDiscountRequestDto"];
            };
        };
        responses: {
            /** @description Đơn sau khi quyết: đồng ý ⇒ vẫn 'choduyet' + `discount.status: 'dong_y'` (Chốt là hành động riêng qua /confirm); từ chối ⇒ về 'baogia' + `discount.status: 'tu_choi'` kèm resolveNote. Retry CÙNG decision: 200 view hiện tại, không audit thêm (idempotent, NFR-1). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponseDto"];
                };
            };
            /** @description Thiếu `reason` khi từ chối (VALIDATION_ERROR — kèm fieldErrors). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu discounts.approve — discounts.apply KHÔNG thay thế được (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có approval chờ duyệt, hoặc decision NGƯỢC với approval đã resolve (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_addLine: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AddLineItemRequestDto"];
            };
        };
        responses: {
            /** @description Dòng mới ở cuối giỏ. Dòng catalog: backend auto-điền đơn giá theo danh mục hiện tại; dòng tự do: nhập tay, priceEditable = true. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderLineItemResponseDto"];
                };
            };
            /** @description Body không hợp lệ; sản phẩm không tồn tại; hoặc gửi `unitPrice` cho sản phẩm không cho sửa giá (VALIDATION_ERROR — kèm fieldErrors). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn không còn ở trạng thái 'baogia' — sửa sau chốt là Story 4.6 (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_removeLine: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                lineId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dòng đã bị xoá khỏi bản hiệu lực. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn, đơn ngoài phạm vi, hoặc dòng không thuộc bản hiệu lực của đơn này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn không còn ở trạng thái 'baogia' (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_updateLine: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                lineId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateLineItemRequestDto"];
            };
        };
        responses: {
            /** @description Dòng sau khi sửa — `unitPrice`/`amount` là giá hiệu lực. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderLineItemResponseDto"];
                };
            };
            /** @description Body không hợp lệ, hoặc sửa `unitPrice` trên dòng priceEditable = false (VALIDATION_ERROR — kèm fieldErrors). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn, đơn ngoài phạm vi, hoặc dòng không thuộc bản hiệu lực của đơn này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn không còn ở trạng thái 'baogia' (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_exportQuote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Metadata bộ file MỚI NHẤT của Đơn (AD-3 — bytes ở R2, tải qua GET /orders/{id}/quote/image|pdf). Xuất lần n đè bộ file cũ — MỘT bộ file mỗi Đơn, phản ánh nội dung hiện tại. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteExportResponseDto"];
                };
            };
            /** @description Báo giá chưa có dòng nào — không có gì để xuất (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_downloadQuoteImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bytes ảnh PNG báo giá mới nhất của Đơn. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này, đơn ngoài phạm vi, hoặc đơn chưa xuất báo giá lần nào (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_downloadQuotePdf: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bytes PDF báo giá mới nhất của Đơn. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": string;
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này, đơn ngoài phạm vi, hoặc đơn chưa xuất báo giá lần nào (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_transition: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["StatusChangeRequestDto"];
            };
        };
        responses: {
            /** @description Đơn đã chuyển; ảnh (nếu có) đã ghi vào đúng bước qua bốn toạ độ (đơn, từ→đến, thời điểm). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatusChangeResponseDto"];
                };
            };
            /** @description Ảnh sai định dạng/quá lớn/quá nhiều (VALIDATION_ERROR) — transition KHÔNG chạy. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quyền cho bước đã chọn (FORBIDDEN) — Order.status không đổi. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Bước ngoài lane thủ công, ngoài phạm vi đơn, hoặc không đi được từ trạng thái hiện tại — kể cả ca bấm hai lần (CONFLICT). Also: a close into `hoanthanh` from `dachot` (direct equipment close) or `nghiemthu` (construction close) while the order still has stock-tracked lines without a stock-out voucher (issue stock first). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_cancel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelOrderRequestDto"];
            };
        };
        responses: {
            /** @description Đơn đã huỷ; lý do + thời điểm ghi trong CÙNG transaction với lệnh đổi status. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CancelOrderResponseDto"];
                };
            };
            /** @description Lý do rỗng/chỉ khoảng trắng/dưới 3 ký tự sau trim, hoặc quá 500 ký tự (VALIDATION_ERROR kèm fieldErrors) — đơn KHÔNG đổi trạng thái. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quotes.create_edit (FORBIDDEN) — Order.status không đổi. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Trạng thái hiện tại không có cạnh huỷ, kể cả đơn ĐÃ huỷ (CONFLICT) — huỷ lần hai không phải no-op. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_getStockIssue: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Issued ⇒ `voucher` (line cost only with costs.view); not issued ⇒ the lines to issue + real on-hand now. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderStockIssueViewDto"];
                };
            };
            /** @description `id` is not a UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Neither inventory.manage nor delivery.confirm (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description No order with this id, or out of scope (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_issueStock: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Order already issued — returns the existing voucher, writes nothing. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderStockIssueResultDto"];
                };
            };
            /** @description Voucher just created: stock deducted, every order line cost frozen. `voucher.lines[].unitCost` only with costs.view. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderStockIssueResultDto"];
                };
            };
            /** @description `id` is not a UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Missing inventory.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description No order with this id, or out of scope (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description CONFLICT: status cannot issue standalone (accepted: dachot, dacoc, danggiao, thicong, nghiemthu); no stock-tracked lines; or short stock (`fieldErrors[].code = INSUFFICIENT_STOCK`, `field = lines.{i}.qty` in the order of the preview `lines`). Nothing written. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_getStockCheck: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Per stock-tracked product of the current version: on-hand, promised to other orders, available, shortfall, enough/short. No money, no cost. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderStockCheckDto"];
                };
            };
            /** @description `id` is not a UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Neither quotes.create_edit nor inventory.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description No order with this id, or out of scope (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_listAttachments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Mọi ảnh của đơn theo createdAt giảm dần; `canDelete` tính ở backend cho từng ảnh. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttachmentListResponseDto"];
                };
            };
            /** @description Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn ngoài phạm vi hoặc không tồn tại (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_addAttachments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["AttachmentUploadRequestDto"];
            };
        };
        responses: {
            /** @description Ảnh đã lưu với ba cột toạ độ null — không thuộc bước chuyển trạng thái nào. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttachmentUploadResponseDto"];
                };
            };
            /** @description Ảnh sai định dạng/quá lớn/quá nhiều (VALIDATION_ERROR) — không hàng nào tạo, không byte nào lên R2. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu cả bốn quyền làm việc trên đơn (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn ngoài phạm vi hoặc không tồn tại (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_downloadAttachment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                attachmentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bytes của ảnh đính kèm. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "image/webp": string;
                    "image/heic": string;
                };
            };
            /** @description Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": components["schemas"]["ErrorEnvelopeDto"];
                    "image/png": components["schemas"]["ErrorEnvelopeDto"];
                    "image/webp": components["schemas"]["ErrorEnvelopeDto"];
                    "image/heic": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn ngoài phạm vi/không tồn tại, hoặc ảnh không thuộc đơn này (NOT_FOUND) — cùng một thông điệp, không xác nhận ảnh có thật. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": components["schemas"]["ErrorEnvelopeDto"];
                    "image/png": components["schemas"]["ErrorEnvelopeDto"];
                    "image/webp": components["schemas"]["ErrorEnvelopeDto"];
                    "image/heic": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    OrdersController_removeAttachment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                attachmentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ảnh đã bị xoá khỏi đơn. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Không phải người tải lên và không có quyền chỉnh sửa đơn (FORBIDDEN) — ảnh còn nguyên. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn ngoài phạm vi/không tồn tại, hoặc ảnh không thuộc đơn này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    SettingsController_getVatRate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thuế suất VAT (%) hiệu lực — chưa cấu hình ⇒ 8 (default). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VatRateResponseDto"];
                };
            };
            /** @description Thiếu settings.manage (FORBIDDEN) — sale nhận rate qua preview-total, không qua đây. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    SettingsController_updateVatRate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateVatRateRequestDto"];
            };
        };
        responses: {
            /** @description Thuế suất VAT (%) sau khi đổi. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VatRateResponseDto"];
                };
            };
            /** @description ratePercent không phải Int 0..100 (VALIDATION_ERROR) — kèm `fieldErrors`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu settings.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    SettingsController_getCompanyLegalEntity: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thông tin pháp nhân công ty in trên hợp đồng. Chưa cấu hình ⇒ cả 7 ô là chuỗi rỗng (không seed). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyLegalEntityDto"];
                };
            };
            /** @description Thiếu settings.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    SettingsController_updateCompanyLegalEntity: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompanyLegalEntityDto"];
            };
        };
        responses: {
            /** @description Thông tin pháp nhân sau khi lưu (đã trim). Thay toàn bộ 7 ô; chuỗi rỗng = xoá cấu hình ô đó. Gửi lại y hệt ⇒ không ghi gì. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompanyLegalEntityDto"];
                };
            };
            /** @description Thiếu ô, ô không phải chuỗi (kể cả null), hoặc quá 200 ký tự (VALIDATION_ERROR) — kèm `fieldErrors`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu settings.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    StockItemsController_list: {
        parameters: {
            query?: {
                /** @description Tìm theo TÊN hoặc SKU (chứa chuỗi, không phân biệt hoa thường). */
                q?: string;
                /** @description Chỉ lấy các sản phẩm này — danh sách UUID ngăn cách bằng dấu phẩy. */
                productIds?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tồn thật / Đã hứa / Khả dụng theo sản phẩm + danh sách cần mua — mọi con số do backend tính. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StockListResponseDto"];
                };
            };
            /** @description `productIds` có phần tử không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu CẢ inventory.manage lẫn quotes.create_edit (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    StockVouchersController_list: {
        parameters: {
            query?: {
                type?: "nhap" | "xuat";
                /** @description true ⇒ chỉ phiếu nhập trả; false ⇒ không có phiếu nhập trả; vắng ⇒ mọi phiếu. */
                isReturn?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StockVoucherListResponseDto"];
                };
            };
            /** @description `type` không phải nhap|xuat hoặc `isReturn` không phải true|false (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu inventory.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    StockVouchersController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateStockVoucherRequestDto"];
            };
        };
        responses: {
            /** @description Phiếu đã lưu và có hiệu lực. `lines[].unitCost` chỉ có mặt nếu caller có costs.view. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StockVoucherDetailDto"];
                };
            };
            /** @description Body không hợp lệ (VALIDATION_ERROR): thiếu `unitCost` khi nhập, có `unitCost` khi xuất, lặp sản phẩm (DUPLICATE_PRODUCT)… */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu inventory.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Có sản phẩm không tồn tại (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description CONFLICT: xuất quá tồn (`fieldErrors[].code = INSUFFICIENT_STOCK`) hoặc nhập sản phẩm không theo dõi tồn/đã ngừng bán (`PRODUCT_NOT_STOCKABLE`). Không dòng nào được ghi. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    StockVouchersController_createReturn: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateReturnVoucherRequestDto"];
            };
        };
        responses: {
            /** @description Phiếu nhập trả đã lưu: cộng `onHand` đúng số đếm được, giá vốn dòng = giá vốn dòng phiếu xuất gốc. `lines[].unitCost` chỉ có mặt nếu caller có costs.view. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StockVoucherDetailDto"];
                };
            };
            /** @description VALIDATION_ERROR: body sai (lines rỗng, qty không nguyên dương…), lặp sản phẩm (`fieldErrors[].code = DUPLICATE_PRODUCT`), sản phẩm không có trên phiếu gốc (`NOT_ON_ORIGIN_VOUCHER`), nhận lại quá số đã xuất (`RETURN_EXCEEDS_ISSUED`). Không dòng nào được ghi. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu inventory.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có phiếu gốc này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description CONFLICT: phiếu gốc không phải phiếu xuất gắn đơn, đơn chưa huỷ, hoặc phiếu xuất đã có phiếu nhập trả. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    StockVouchersController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description `lines[].unitCost` chỉ có mặt nếu caller có costs.view. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StockVoucherDetailDto"];
                };
            };
            /** @description `id` không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu inventory.manage (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có phiếu này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    PaymentSchedulesController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lịch thanh toán của đơn (mọi trạng thái). Chưa cấu hình ⇒ configured=false, installments rỗng. Độ lệch tính lại với tổng đơn sau VAT HIỆN TẠI. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentScheduleResponseDto"];
                };
            };
            /** @description id không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    PaymentSchedulesController_replace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReplacePaymentScheduleRequestDto"];
            };
        };
        responses: {
            /** @description Lịch đã lưu (thay toàn bộ các đợt). Tổng các đợt lệch tổng đơn sau VAT vẫn lưu được — totalMatches=false là cảnh báo, không chặn. Gửi lại y hệt ⇒ không ghi gì. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentScheduleResponseDto"];
                };
            };
            /** @description VALIDATION_ERROR + fieldErrors `installments.{i}.(percent|amount|conditionNote)`: đợt đầu bằng 0 (firstInstallmentZero), đợt tính ra 0 đồng (resolvedZero), đợt vượt 2.000.000.000 đồng (amountTooLarge), không đúng một trong percent/amount (exactlyOneOf), 0 hoặc quá 12 đợt. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu payments.record, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn chưa chốt hoặc đã đóng, đơn vừa đổi trong lúc lưu, hoặc đơn đã có khoản thu — lịch không sửa được nữa (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    PaymentsController_record: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordPaymentRequestDto"];
            };
        };
        responses: {
            /** @description Đã ghi nhận (lần đầu) hoặc gửi lại cùng khoá + cùng nội dung (không ghi thêm) — cùng mã 200, cùng thân. Chuyển trạng thái tự động bị từ chối ⇒ tiền VẪN được ghi, autoTransition.outcome = skipped. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordPaymentResponseDto"];
                };
            };
            /** @description VALIDATION_ERROR + fieldErrors: `amount` vượt phần còn lại của đợt (exceedsRemaining), `paidOn` sau hôm nay giờ Việt Nam (futureDate), hoặc sai kiểu/khoảng (amount, paidOn, method, note, idempotencyKey, installmentId); id không phải UUID. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu payments.record, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description CONFLICT: đơn chưa chốt hoặc đã huỷ; đơn vừa thay đổi; đơn chưa có lịch thanh toán; đợt không thuộc lịch hiện tại (lịch vừa thay đổi); khoá ghi nhận đã dùng cho một khoản khác. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ContractsController_overview: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Trường động sẽ đưa vào hợp đồng, server có sinh được không (generatable/blockedReason — cùng luật với POST), và các hợp đồng đã sinh (mới nhất trước). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContractsOverviewResponseDto"];
                };
            };
            /** @description id không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu contracts.generate, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ContractsController_generate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Hợp đồng mới (số mới, file mới ở R2 — AD-3). Body rỗng. Loại theo cờ phạm vi của đơn; pháp nhân công ty chưa cấu hình in "Chưa cấu hình", không chặn. Sinh lại = bản mới, bản cũ giữ nguyên. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContractResponseDto"];
                };
            };
            /** @description id không phải UUID, hoặc đơn chưa có dòng vật tư (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu contracts.generate, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn chưa chốt hoặc đã huỷ, đơn chưa có lịch thanh toán, hoặc tổng các đợt lệch tổng đơn (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ContractsController_downloadPdf: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                contractId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bytes PDF của một hợp đồng đã sinh. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": string;
                };
            };
            /** @description id hoặc contractId không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu contracts.generate, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này, đơn ngoài phạm vi, hoặc hợp đồng không thuộc đơn này (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    InvoicesController_overview: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Nguồn hoá đơn sẽ chụp lại (bản đơn, khách, MST, tổng), server có tạo được không (creatable/blockedReason — cùng luật với POST), và các hoá đơn đã tạo (mới nhất trước). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvoicesOverviewResponseDto"];
                };
            };
            /** @description id không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    InvoicesController_create: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đã tạo hoá đơn cho bản đơn hiện hành (lần đầu) hoặc bản đó đã có hoá đơn (gửi lại — trả đúng hoá đơn đã lập, không ghi thêm) — cùng mã 200, cùng thân. Body rỗng. Hoá đơn chụp lại khách, dòng, VAT, tổng và pháp nhân công ty lúc lập; không đổi theo đơn về sau. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvoiceResponseDto"];
                };
            };
            /** @description id không phải UUID, hoặc đơn chưa có dòng vật tư (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Đơn chưa chốt hoặc đã huỷ, hoặc đơn vừa thay đổi bản trong lúc tạo (CONFLICT). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    InvoicesController_detail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                invoiceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Toàn bộ nội dung một hoá đơn (số, ngày, người bán, khách, dòng, VAT, tổng, gắn đơn) đọc từ bản chụp lúc lập — không đọc lại đơn, khách hay cài đặt. Xem được bất kể trạng thái đơn hiện tại. pdf = null khi chưa xuất. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvoiceDetailResponseDto"];
                };
            };
            /** @description id hoặc invoiceId không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND, cùng message đơn không tồn tại); hoặc hoá đơn không tồn tại / không thuộc đơn này — "Không tìm thấy hoá đơn." (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    InvoicesController_downloadPdf: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                invoiceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bytes PDF đã xuất của một hoá đơn. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": string;
                };
            };
            /** @description id hoặc invoiceId không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND, cùng message đơn không tồn tại); hoá đơn không tồn tại / không thuộc đơn này — "Không tìm thấy hoá đơn."; hoặc hoá đơn chưa xuất PDF — "Hoá đơn này chưa xuất PDF." (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    InvoicesController_exportPdf: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                invoiceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lần đầu: dựng PDF từ bản chụp hoá đơn và lưu ở R2 (AD-3). Các lần sau: trả lại đúng file đã lưu, không dựng lại, không ghi thêm — cùng mã 200, cùng thân. Body rỗng. Xuất được bất kể trạng thái đơn hiện tại. Tải bytes qua GET cùng đường dẫn. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvoicePdfResponseDto"];
                };
            };
            /** @description id hoặc invoiceId không phải UUID (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND, cùng message đơn không tồn tại); hoặc hoá đơn không tồn tại / không thuộc đơn này — "Không tìm thấy hoá đơn." (NOT_FOUND). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    DashboardController_summary: {
        parameters: {
            query?: {
                /** @description Kỳ tính tới hôm nay (giờ Việt Nam): day = hôm nay, week = thứ Hai → hôm nay, month = ngày 1 → hôm nay. Bỏ trống ⇒ month. */
                period?: "day" | "week" | "month";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Doanh thu của kỳ (null khi thiếu dashboard.finance_view), số đơn tạo trong kỳ và số đơn theo trạng thái (null khi thiếu quyền xem đơn). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardSummaryResponseDto"];
                };
            };
            /** @description period không thuộc day/week/month (VALIDATION_ERROR). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu cả orders.view_all, orders.view_own lẫn dashboard.finance_view (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
    ProfitReportController_profit: {
        parameters: {
            query?: {
                /** @description Cách nhóm: order = mỗi đơn một hàng, month = theo tháng xuất kho, assignee = theo người phụ trách, source = theo nguồn khách. Bỏ trống ⇒ order. */
                groupBy?: components["schemas"]["ProfitGroupBy"];
                /** @description Kỳ theo ngày xuất kho (giờ Việt Nam): month = ngày 1 → hôm nay, year = 01/01 → hôm nay, custom = from → to. Bỏ trống ⇒ month. */
                period?: components["schemas"]["ProfitPeriod"];
                /** @description Từ ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này). Bắt buộc khi period=custom, cấm gửi với kỳ khác. */
                from?: string;
                /** @description Đến ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này). Bắt buộc khi period=custom, cấm gửi với kỳ khác. */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lợi nhuận gộp trên vật tư của các đơn đã xuất kho trong kỳ (không tính đơn huỷ), toàn công ty, nhóm theo groupBy. Σ rows = totals. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfitReportResponseDto"];
                };
            };
            /** @description VALIDATION_ERROR: groupBy/period lạ; from/to sai định dạng YYYY-MM-DD; period=custom thiếu from/to; from sau to (fieldErrors.to); from/to gửi kèm period month/year. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
            /** @description Thiếu quyền costs.view (FORBIDDEN). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelopeDto"];
                };
            };
        };
    };
}
