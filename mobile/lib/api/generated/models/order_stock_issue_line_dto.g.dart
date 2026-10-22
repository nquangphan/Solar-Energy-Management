// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_stock_issue_line_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderStockIssueLineDto _$OrderStockIssueLineDtoFromJson(
  Map<String, dynamic> json,
) => OrderStockIssueLineDto(
  productId: json['productId'] as String,
  name: json['name'] as String,
  sku: json['sku'] as String,
  unit: json['unit'] as String,
  qty: json['qty'] as num,
  onHand: json['onHand'] as num,
  shortfall: json['shortfall'] as num,
);

Map<String, dynamic> _$OrderStockIssueLineDtoToJson(
  OrderStockIssueLineDto instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'name': instance.name,
  'sku': instance.sku,
  'unit': instance.unit,
  'qty': instance.qty,
  'onHand': instance.onHand,
  'shortfall': instance.shortfall,
};
