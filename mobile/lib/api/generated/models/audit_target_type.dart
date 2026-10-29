// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum AuditTargetType {
  @JsonValue('Order')
  order('Order'),
  @JsonValue('Account')
  account('Account'),
  @JsonValue('Product')
  product('Product'),
  @JsonValue('ProductGroup')
  productGroup('ProductGroup'),
  @JsonValue('Customer')
  customer('Customer'),
  @JsonValue('CustomerSource')
  customerSource('CustomerSource'),
  @JsonValue('StockVoucher')
  stockVoucher('StockVoucher'),
  @JsonValue('FeatureFlag')
  featureFlag('FeatureFlag'),
  @JsonValue('SystemSetting')
  systemSetting('SystemSetting'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const AuditTargetType(this.json);

  factory AuditTargetType.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<AuditTargetType> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
