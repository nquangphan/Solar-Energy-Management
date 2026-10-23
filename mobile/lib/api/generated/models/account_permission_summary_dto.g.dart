// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_permission_summary_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AccountPermissionSummaryDto _$AccountPermissionSummaryDtoFromJson(
  Map<String, dynamic> json,
) => AccountPermissionSummaryDto(
  id: json['id'] as String,
  displayName: json['displayName'] as String,
  phone: json['phone'] as String?,
  email: json['email'] as String,
  isActive: json['isActive'] as bool,
  permissions: (json['permissions'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  matchingPreset: json['matchingPreset'] == null
      ? null
      : RolePreset.fromJson(json['matchingPreset'] as String),
  matchingPresetLabel: json['matchingPresetLabel'] as String?,
  editable: json['editable'] as bool,
  readOnlyReason: json['readOnlyReason'] as String?,
);

Map<String, dynamic> _$AccountPermissionSummaryDtoToJson(
  AccountPermissionSummaryDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'displayName': instance.displayName,
  'phone': instance.phone,
  'email': instance.email,
  'isActive': instance.isActive,
  'permissions': instance.permissions,
  'matchingPreset': _$RolePresetEnumMap[instance.matchingPreset],
  'matchingPresetLabel': instance.matchingPresetLabel,
  'editable': instance.editable,
  'readOnlyReason': instance.readOnlyReason,
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
