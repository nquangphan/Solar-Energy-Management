// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_discount_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderDiscountDto _$OrderDiscountDtoFromJson(Map<String, dynamic> json) =>
    OrderDiscountDto(
      amount: json['amount'] as num,
      status: json['status'] as String,
      requestedAt: DateTime.parse(json['requestedAt'] as String),
      requestNote: json['requestNote'] as String?,
      resolveNote: json['resolveNote'] as String?,
      resolvedAt: json['resolvedAt'] == null
          ? null
          : DateTime.parse(json['resolvedAt'] as String),
    );

Map<String, dynamic> _$OrderDiscountDtoToJson(OrderDiscountDto instance) =>
    <String, dynamic>{
      'amount': instance.amount,
      'status': instance.status,
      'requestNote': instance.requestNote,
      'resolveNote': instance.resolveNote,
      'requestedAt': instance.requestedAt.toIso8601String(),
      'resolvedAt': instance.resolvedAt?.toIso8601String(),
    };
