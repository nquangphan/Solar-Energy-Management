// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_stock_check_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderStockCheckDto _$OrderStockCheckDtoFromJson(Map<String, dynamic> json) =>
    OrderStockCheckDto(
      lines: (json['lines'] as List<dynamic>)
          .map(
            (e) => OrderStockCheckLineDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );

Map<String, dynamic> _$OrderStockCheckDtoToJson(OrderStockCheckDto instance) =>
    <String, dynamic>{'lines': instance.lines};
