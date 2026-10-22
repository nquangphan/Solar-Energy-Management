// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_item_view_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockItemViewDto _$StockItemViewDtoFromJson(Map<String, dynamic> json) =>
    StockItemViewDto(
      productId: json['productId'] as String,
      name: json['name'] as String,
      sku: json['sku'] as String,
      unit: json['unit'] as String,
      onHand: json['onHand'] as num,
      reserved: json['reserved'] as num,
      available: json['available'] as num,
      toPurchase: json['toPurchase'] as num,
      stockStatus: StockItemViewDtoStockStatus.fromJson(
        json['stockStatus'] as String,
      ),
    );

Map<String, dynamic> _$StockItemViewDtoToJson(
  StockItemViewDto instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'name': instance.name,
  'sku': instance.sku,
  'unit': instance.unit,
  'onHand': instance.onHand,
  'reserved': instance.reserved,
  'available': instance.available,
  'toPurchase': instance.toPurchase,
  'stockStatus': _$StockItemViewDtoStockStatusEnumMap[instance.stockStatus]!,
};

const _$StockItemViewDtoStockStatusEnumMap = {
  StockItemViewDtoStockStatus.du: 'du',
  StockItemViewDtoStockStatus.het: 'het',
  StockItemViewDtoStockStatus.am: 'am',
  StockItemViewDtoStockStatus.$unknown: r'$unknown',
};
