// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'apply_discount_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ApplyDiscountRequestDto _$ApplyDiscountRequestDtoFromJson(
  Map<String, dynamic> json,
) => ApplyDiscountRequestDto(
  amount: json['amount'] as num,
  note: json['note'] as String?,
);

Map<String, dynamic> _$ApplyDiscountRequestDtoToJson(
  ApplyDiscountRequestDto instance,
) => <String, dynamic>{'amount': instance.amount, 'note': instance.note};
