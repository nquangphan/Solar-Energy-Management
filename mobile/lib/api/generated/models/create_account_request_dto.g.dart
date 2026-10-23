// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_account_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateAccountRequestDto _$CreateAccountRequestDtoFromJson(
  Map<String, dynamic> json,
) => CreateAccountRequestDto(
  displayName: json['displayName'] as String,
  phone: json['phone'] as String,
  email: json['email'] as String,
  password: json['password'] as String,
  preset: RolePreset.fromJson(json['preset'] as String),
  isActive: json['isActive'] as bool,
);

Map<String, dynamic> _$CreateAccountRequestDtoToJson(
  CreateAccountRequestDto instance,
) => <String, dynamic>{
  'displayName': instance.displayName,
  'phone': instance.phone,
  'email': instance.email,
  'password': instance.password,
  'preset': _$RolePresetEnumMap[instance.preset]!,
  'isActive': instance.isActive,
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
