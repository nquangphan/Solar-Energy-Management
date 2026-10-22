// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_voucher_line_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockVoucherLineRequestDto _$StockVoucherLineRequestDtoFromJson(
  Map<String, dynamic> json,
) => StockVoucherLineRequestDto(
  productId: json['productId'] as String,
  qty: json['qty'] as num,
  unitCost: json['unitCost'] as num?,
);

Map<String, dynamic> _$StockVoucherLineRequestDtoToJson(
  StockVoucherLineRequestDto instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'qty': instance.qty,
  'unitCost': instance.unitCost,
};
