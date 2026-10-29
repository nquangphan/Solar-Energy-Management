// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'permission_transition_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PermissionTransitionDto _$PermissionTransitionDtoFromJson(
  Map<String, dynamic> json,
) => PermissionTransitionDto(
  event: json['event'] as String,
  from: json['from'] as String,
  to: json['to'] as String,
);

Map<String, dynamic> _$PermissionTransitionDtoToJson(
  PermissionTransitionDto instance,
) => <String, dynamic>{
  'event': instance.event,
  'from': instance.from,
  'to': instance.to,
};
