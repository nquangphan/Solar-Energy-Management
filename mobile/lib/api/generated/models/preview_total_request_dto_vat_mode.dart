// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Tick áp VAT — client ECHO từ `Order.vatMode` (như đã echo unitPrice), KHÔNG BAO GIỜ gửi rate. Vắng field = đơn cũ vatMode null ⇒ tính như có VAT.
@JsonEnum()
enum PreviewTotalRequestDtoVatMode {
  @JsonValue('co_vat')
  coVat('co_vat'),
  @JsonValue('khong_vat')
  khongVat('khong_vat'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const PreviewTotalRequestDtoVatMode(this.json);

  factory PreviewTotalRequestDtoVatMode.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<PreviewTotalRequestDtoVatMode> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
