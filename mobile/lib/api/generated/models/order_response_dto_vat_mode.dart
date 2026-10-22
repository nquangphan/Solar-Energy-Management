// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Tick áp VAT: 'co_vat' | 'khong_vat' — đơn mới luôn 'co_vat'; null chỉ ở đơn tạo trước 4.4 (tính như có VAT).
@JsonEnum()
enum OrderResponseDtoVatMode {
  @JsonValue('co_vat')
  coVat('co_vat'),
  @JsonValue('khong_vat')
  khongVat('khong_vat'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const OrderResponseDtoVatMode(this.json);

  factory OrderResponseDtoVatMode.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<OrderResponseDtoVatMode> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
