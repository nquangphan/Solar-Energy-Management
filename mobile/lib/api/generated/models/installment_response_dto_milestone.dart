// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Mốc tự động do server gán theo vị trí: đợt 1 = coc, đợt cuối (khi ≥ 2 đợt) = tat_toan, còn lại null.
@JsonEnum()
enum InstallmentResponseDtoMilestone {
  @JsonValue('coc')
  coc('coc'),
  @JsonValue('tat_toan')
  tatToan('tat_toan'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const InstallmentResponseDtoMilestone(this.json);

  factory InstallmentResponseDtoMilestone.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<InstallmentResponseDtoMilestone> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
