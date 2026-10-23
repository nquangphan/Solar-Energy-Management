// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Preset có bộ quyền trùng khít bộ quyền của account; null = tuỳ chỉnh. Account không lưu role.
@JsonEnum()
enum RolePreset {
  @JsonValue('THO_KS')
  thoKs('THO_KS'),
  @JsonValue('THI_CONG')
  thiCong('THI_CONG'),
  @JsonValue('KE_TOAN')
  keToan('KE_TOAN'),
  @JsonValue('KHO_GIAO')
  khoGiao('KHO_GIAO'),
  @JsonValue('QUAN_LY')
  quanLy('QUAN_LY'),
  @JsonValue('ADMIN')
  admin('ADMIN'),
  @JsonValue('SUPER_ADMIN')
  superAdmin('SUPER_ADMIN'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const RolePreset(this.json);

  factory RolePreset.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<RolePreset> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
