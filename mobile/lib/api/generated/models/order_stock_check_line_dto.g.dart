// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_stock_check_line_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderStockCheckLineDto _$OrderStockCheckLineDtoFromJson(
  Map<String, dynamic> json,
) => OrderStockCheckLineDto(
  productId: json['productId'] as String,
  name: json['name'] as String,
  unit: json['unit'] as String,
  qty: json['qty'] as num,
  onHand: json['onHand'] as num,
  reserved: json['reserved'] as num,
  available: json['available'] as num,
  shortfall: json['shortfall'] as num,
  status: OrderStockCheckLineDtoStatus.fromJson(json['status'] as String),
);

Map<String, dynamic> _$OrderStockCheckLineDtoToJson(
  OrderStockCheckLineDto instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'name': instance.name,
  'unit': instance.unit,
  'qty': instance.qty,
  'onHand': instance.onHand,
  'reserved': instance.reserved,
  'available': instance.available,
  'shortfall': instance.shortfall,
  'status': _$OrderStockCheckLineDtoStatusEnumMap[instance.status]!,
};

const _$OrderStockCheckLineDtoStatusEnumMap = {
  OrderStockCheckLineDtoStatus.enough: 'enough',
  OrderStockCheckLineDtoStatus.short: 'short',
  OrderStockCheckLineDtoStatus.$unknown: r'$unknown',
};
