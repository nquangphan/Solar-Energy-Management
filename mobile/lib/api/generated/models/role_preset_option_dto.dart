// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'role_preset.dart';

part 'role_preset_option_dto.g.dart';

@JsonSerializable()
class RolePresetOptionDto {
  const RolePresetOptionDto({
    required this.key,
    required this.label,
    required this.permissions,
  });
  
  factory RolePresetOptionDto.fromJson(Map<String, Object?> json) => _$RolePresetOptionDtoFromJson(json);
  
  final RolePreset key;
  final String label;
  final List<String> permissions;

  Map<String, Object?> toJson() => _$RolePresetOptionDtoToJson(this);
}
