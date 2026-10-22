// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_list_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockListResponseDto _$StockListResponseDtoFromJson(
  Map<String, dynamic> json,
) => StockListResponseDto(
  items: (json['items'] as List<dynamic>)
      .map((e) => StockItemViewDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  purchaseList: (json['purchaseList'] as List<dynamic>)
      .map((e) => PurchaseNeedViewDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$StockListResponseDtoToJson(
  StockListResponseDto instance,
) => <String, dynamic>{
  'items': instance.items,
  'purchaseList': instance.purchaseList,
};
