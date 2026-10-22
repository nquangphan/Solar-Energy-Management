// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_voucher_line_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockVoucherLineResponseDto _$StockVoucherLineResponseDtoFromJson(
  Map<String, dynamic> json,
) => StockVoucherLineResponseDto(
  productId: json['productId'] as String,
  name: json['name'] as String,
  sku: json['sku'] as String,
  unit: json['unit'] as String,
  qty: json['qty'] as num,
  unitCost: json['unitCost'] as num?,
);

Map<String, dynamic> _$StockVoucherLineResponseDtoToJson(
  StockVoucherLineResponseDto instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'name': instance.name,
  'sku': instance.sku,
  'unit': instance.unit,
  'qty': instance.qty,
  'unitCost': instance.unitCost,
};
