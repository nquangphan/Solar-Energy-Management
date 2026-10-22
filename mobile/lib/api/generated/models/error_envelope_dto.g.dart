// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_envelope_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ErrorEnvelopeDto _$ErrorEnvelopeDtoFromJson(Map<String, dynamic> json) =>
    ErrorEnvelopeDto(
      code: json['code'] as String,
      message: json['message'] as String,
      traceId: json['traceId'] as String,
      fieldErrors: (json['fieldErrors'] as List<dynamic>?)
          ?.map((e) => FieldErrorDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$ErrorEnvelopeDtoToJson(ErrorEnvelopeDto instance) =>
    <String, dynamic>{
      'code': instance.code,
      'message': instance.message,
      'fieldErrors': instance.fieldErrors,
      'traceId': instance.traceId,
    };
