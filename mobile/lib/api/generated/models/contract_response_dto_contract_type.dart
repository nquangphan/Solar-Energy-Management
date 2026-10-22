// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// construction = HĐ Thi công (đơn có cờ Thi công); sale = HĐ Mua bán (chỉ Thiết bị).
@JsonEnum()
enum ContractResponseDtoContractType {
  @JsonValue('construction')
  construction('construction'),
  @JsonValue('sale')
  sale('sale'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const ContractResponseDtoContractType(this.json);

  factory ContractResponseDtoContractType.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<ContractResponseDtoContractType> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
