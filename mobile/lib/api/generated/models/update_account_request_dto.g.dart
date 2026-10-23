// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_account_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateAccountRequestDto _$UpdateAccountRequestDtoFromJson(
  Map<String, dynamic> json,
) => UpdateAccountRequestDto(
  displayName: json['displayName'] as String,
  phone: json['phone'] as String,
  email: json['email'] as String,
  isActive: json['isActive'] as bool,
);

Map<String, dynamic> _$UpdateAccountRequestDtoToJson(
  UpdateAccountRequestDto instance,
) => <String, dynamic>{
  'displayName': instance.displayName,
  'phone': instance.phone,
  'email': instance.email,
  'isActive': instance.isActive,
};
