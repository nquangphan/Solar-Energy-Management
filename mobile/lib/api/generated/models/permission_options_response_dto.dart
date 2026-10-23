// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'permission_option_dto.dart';
import 'role_preset_option_dto.dart';

part 'permission_options_response_dto.g.dart';

@JsonSerializable()
class PermissionOptionsResponseDto {
  const PermissionOptionsResponseDto({
    required this.permissions,
    required this.presets,
  });
  
  factory PermissionOptionsResponseDto.fromJson(Map<String, Object?> json) => _$PermissionOptionsResponseDtoFromJson(json);
  
  /// Mọi quyền trong registry, xếp theo nhóm.
  final List<PermissionOptionDto> permissions;

  /// Chỉ các preset người gọi cấp được trọn bộ.
  final List<RolePresetOptionDto> presets;

  Map<String, Object?> toJson() => _$PermissionOptionsResponseDtoToJson(this);
}
