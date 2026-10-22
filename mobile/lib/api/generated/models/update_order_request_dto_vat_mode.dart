// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Tick áp VAT (FR-3): 'co_vat' | 'khong_vat' — chỉ đổi được khi đơn còn ở baogia (4.5 snapshot lúc Chốt).
@JsonEnum()
enum UpdateOrderRequestDtoVatMode {
  @JsonValue('co_vat')
  coVat('co_vat'),
  @JsonValue('khong_vat')
  khongVat('khong_vat'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const UpdateOrderRequestDtoVatMode(this.json);

  factory UpdateOrderRequestDtoVatMode.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<UpdateOrderRequestDtoVatMode> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
