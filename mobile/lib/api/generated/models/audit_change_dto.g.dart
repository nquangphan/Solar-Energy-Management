// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audit_change_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuditChangeDto _$AuditChangeDtoFromJson(Map<String, dynamic> json) =>
    AuditChangeDto(
      field: json['field'] as String,
      before: json['before'] as String?,
      after: json['after'] as String?,
      isMoney: json['isMoney'] as bool,
    );

Map<String, dynamic> _$AuditChangeDtoToJson(AuditChangeDto instance) =>
    <String, dynamic>{
      'field': instance.field,
      'before': instance.before,
      'after': instance.after,
      'isMoney': instance.isMoney,
    };
