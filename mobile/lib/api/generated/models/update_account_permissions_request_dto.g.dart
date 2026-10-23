// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_account_permissions_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateAccountPermissionsRequestDto _$UpdateAccountPermissionsRequestDtoFromJson(
  Map<String, dynamic> json,
) => UpdateAccountPermissionsRequestDto(
  permissions: (json['permissions'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$UpdateAccountPermissionsRequestDtoToJson(
  UpdateAccountPermissionsRequestDto instance,
) => <String, dynamic>{'permissions': instance.permissions};
