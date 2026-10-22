// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_voucher_return_of_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockVoucherReturnOfDto _$StockVoucherReturnOfDtoFromJson(
  Map<String, dynamic> json,
) => StockVoucherReturnOfDto(
  id: json['id'] as String,
  code: json['code'] as String,
  orderId: json['orderId'] as String,
);

Map<String, dynamic> _$StockVoucherReturnOfDtoToJson(
  StockVoucherReturnOfDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'orderId': instance.orderId,
};
