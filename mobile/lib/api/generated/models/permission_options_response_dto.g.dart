// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'permission_options_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PermissionOptionsResponseDto _$PermissionOptionsResponseDtoFromJson(
  Map<String, dynamic> json,
) => PermissionOptionsResponseDto(
  permissions: (json['permissions'] as List<dynamic>)
      .map((e) => PermissionOptionDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  presets: (json['presets'] as List<dynamic>)
      .map((e) => RolePresetOptionDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$PermissionOptionsResponseDtoToJson(
  PermissionOptionsResponseDto instance,
) => <String, dynamic>{
  'permissions': instance.permissions,
  'presets': instance.presets,
};
