// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_preset_option_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RolePresetOptionDto _$RolePresetOptionDtoFromJson(Map<String, dynamic> json) =>
    RolePresetOptionDto(
      key: RolePreset.fromJson(json['key'] as String),
      label: json['label'] as String,
      permissions: (json['permissions'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$RolePresetOptionDtoToJson(
  RolePresetOptionDto instance,
) => <String, dynamic>{
  'key': _$RolePresetEnumMap[instance.key]!,
  'label': instance.label,
  'permissions': instance.permissions,
};

const _$RolePresetEnumMap = {
  RolePreset.thoKs: 'THO_KS',
  RolePreset.thiCong: 'THI_CONG',
  RolePreset.keToan: 'KE_TOAN',
  RolePreset.khoGiao: 'KHO_GIAO',
  RolePreset.quanLy: 'QUAN_LY',
  RolePreset.admin: 'ADMIN',
  RolePreset.superAdmin: 'SUPER_ADMIN',
  RolePreset.$unknown: r'$unknown',
};
