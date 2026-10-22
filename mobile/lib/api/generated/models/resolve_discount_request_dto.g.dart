// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'resolve_discount_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ResolveDiscountRequestDto _$ResolveDiscountRequestDtoFromJson(
  Map<String, dynamic> json,
) => ResolveDiscountRequestDto(
  approve: json['approve'] as bool,
  reason: json['reason'] as String?,
);

Map<String, dynamic> _$ResolveDiscountRequestDtoToJson(
  ResolveDiscountRequestDto instance,
) => <String, dynamic>{'approve': instance.approve, 'reason': instance.reason};
