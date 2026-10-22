// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeResponseDto _$MeResponseDtoFromJson(Map<String, dynamic> json) =>
    MeResponseDto(
      id: json['id'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      displayName: json['displayName'] as String,
      permissions: (json['permissions'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$MeResponseDtoToJson(MeResponseDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'phone': instance.phone,
      'displayName': instance.displayName,
      'permissions': instance.permissions,
    };
