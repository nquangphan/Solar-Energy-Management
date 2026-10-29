// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';

import 'health/health_client.dart';
import 'auth/auth_client.dart';
import 'accounts/accounts_client.dart';
import 'audit/audit_client.dart';
import 'feature_flags/feature_flags_client.dart';
import 'catalog/catalog_client.dart';
import 'customers/customers_client.dart';
import 'orders/orders_client.dart';
import 'settings/settings_client.dart';
import 'inventory/inventory_client.dart';
import 'payments/payments_client.dart';
import 'contracts/contracts_client.dart';
import 'invoices/invoices_client.dart';
import 'dashboard/dashboard_client.dart';
import 'reports/reports_client.dart';

/// Phương Nam Solar API `v0.1.0`.
///
/// Hợp đồng API cross-repo cho web + mobile. Spec SINH TỪ code NestJS — CẤM SỬA TAY.
class PnsApiClient {
  PnsApiClient(
    Dio dio, {
    String? baseUrl,
  })  : _dio = dio,
        _baseUrl = baseUrl;

  final Dio _dio;
  final String? _baseUrl;

  static String get version => '0.1.0';

  HealthClient? _health;
  AuthClient? _auth;
  AccountsClient? _accounts;
  AuditClient? _audit;
  FeatureFlagsClient? _featureFlags;
  CatalogClient? _catalog;
  CustomersClient? _customers;
  OrdersClient? _orders;
  SettingsClient? _settings;
  InventoryClient? _inventory;
  PaymentsClient? _payments;
  ContractsClient? _contracts;
  InvoicesClient? _invoices;
  DashboardClient? _dashboard;
  ReportsClient? _reports;

  HealthClient get health => _health ??= HealthClient(_dio, baseUrl: _baseUrl);

  AuthClient get auth => _auth ??= AuthClient(_dio, baseUrl: _baseUrl);

  AccountsClient get accounts => _accounts ??= AccountsClient(_dio, baseUrl: _baseUrl);

  AuditClient get audit => _audit ??= AuditClient(_dio, baseUrl: _baseUrl);

  FeatureFlagsClient get featureFlags => _featureFlags ??= FeatureFlagsClient(_dio, baseUrl: _baseUrl);

  CatalogClient get catalog => _catalog ??= CatalogClient(_dio, baseUrl: _baseUrl);

  CustomersClient get customers => _customers ??= CustomersClient(_dio, baseUrl: _baseUrl);

  OrdersClient get orders => _orders ??= OrdersClient(_dio, baseUrl: _baseUrl);

  SettingsClient get settings => _settings ??= SettingsClient(_dio, baseUrl: _baseUrl);

  InventoryClient get inventory => _inventory ??= InventoryClient(_dio, baseUrl: _baseUrl);

  PaymentsClient get payments => _payments ??= PaymentsClient(_dio, baseUrl: _baseUrl);

  ContractsClient get contracts => _contracts ??= ContractsClient(_dio, baseUrl: _baseUrl);

  InvoicesClient get invoices => _invoices ??= InvoicesClient(_dio, baseUrl: _baseUrl);

  DashboardClient get dashboard => _dashboard ??= DashboardClient(_dio, baseUrl: _baseUrl);

  ReportsClient get reports => _reports ??= ReportsClient(_dio, baseUrl: _baseUrl);
}
