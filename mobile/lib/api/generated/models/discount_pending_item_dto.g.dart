// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'discount_pending_item_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DiscountPendingItemDto _$DiscountPendingItemDtoFromJson(
  Map<String, dynamic> json,
) => DiscountPendingItemDto(
  orderId: json['orderId'] as String,
  customerPhone: json['customerPhone'] as String,
  amount: json['amount'] as num,
  requestedByAccountId: json['requestedByAccountId'] as String,
  requestedByDisplayName: json['requestedByDisplayName'] as String,
  requestedAt: DateTime.parse(json['requestedAt'] as String),
  subtotal: json['subtotal'] as num,
  afterDiscount: json['afterDiscount'] as num,
  lines: (json['lines'] as List<dynamic>)
      .map((e) => DiscountPendingLineDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  requestNote: json['requestNote'] as String?,
);

Map<String, dynamic> _$DiscountPendingItemDtoToJson(
  DiscountPendingItemDto instance,
) => <String, dynamic>{
  'orderId': instance.orderId,
  'customerPhone': instance.customerPhone,
  'amount': instance.amount,
  'requestNote': instance.requestNote,
  'requestedByAccountId': instance.requestedByAccountId,
  'requestedByDisplayName': instance.requestedByDisplayName,
  'requestedAt': instance.requestedAt.toIso8601String(),
  'subtotal': instance.subtotal,
  'afterDiscount': instance.afterDiscount,
  'lines': instance.lines,
};
