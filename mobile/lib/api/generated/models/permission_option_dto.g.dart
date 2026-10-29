// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'permission_option_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PermissionOptionDto _$PermissionOptionDtoFromJson(Map<String, dynamic> json) =>
    PermissionOptionDto(
      key: json['key'] as String,
      label: json['label'] as String,
      group: json['group'] as String,
      requires: (json['requires'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      requiresAnyOf: (json['requiresAnyOf'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      grantable: json['grantable'] as bool,
      transitions: (json['transitions'] as List<dynamic>)
          .map(
            (e) => PermissionTransitionDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );

Map<String, dynamic> _$PermissionOptionDtoToJson(
  PermissionOptionDto instance,
) => <String, dynamic>{
  'key': instance.key,
  'label': instance.label,
  'group': instance.group,
  'requires': instance.requires,
  'requiresAnyOf': instance.requiresAnyOf,
  'grantable': instance.grantable,
  'transitions': instance.transitions,
};
