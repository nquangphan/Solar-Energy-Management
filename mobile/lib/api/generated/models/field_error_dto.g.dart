// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'field_error_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FieldErrorDto _$FieldErrorDtoFromJson(Map<String, dynamic> json) =>
    FieldErrorDto(
      field: json['field'] as String,
      code: json['code'] as String,
      message: json['message'] as String,
    );

Map<String, dynamic> _$FieldErrorDtoToJson(FieldErrorDto instance) =>
    <String, dynamic>{
      'field': instance.field,
      'code': instance.code,
      'message': instance.message,
    };
