// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Trạng thái bảo hành — backend quyết, client chỉ ánh xạ ra màu + nhãn.
@JsonEnum()
enum WarrantyLineItemDtoWarrantyStatus {
  @JsonValue('con_han')
  conHan('con_han'),
  @JsonValue('sap_het')
  sapHet('sap_het'),
  @JsonValue('het_han')
  hetHan('het_han'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const WarrantyLineItemDtoWarrantyStatus(this.json);

  factory WarrantyLineItemDtoWarrantyStatus.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<WarrantyLineItemDtoWarrantyStatus> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
