// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'discount_pending_line_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DiscountPendingLineDto _$DiscountPendingLineDtoFromJson(
  Map<String, dynamic> json,
) => DiscountPendingLineDto(
  name: json['name'] as String,
  qty: json['qty'] as num,
  unitPrice: json['unitPrice'] as num,
  estimatedMarginPct: json['estimatedMarginPct'] as num?,
);

Map<String, dynamic> _$DiscountPendingLineDtoToJson(
  DiscountPendingLineDto instance,
) => <String, dynamic>{
  'name': instance.name,
  'qty': instance.qty,
  'unitPrice': instance.unitPrice,
  'estimatedMarginPct': instance.estimatedMarginPct,
};
