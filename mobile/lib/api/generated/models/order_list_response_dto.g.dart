// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_list_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderListResponseDto _$OrderListResponseDtoFromJson(
  Map<String, dynamic> json,
) => OrderListResponseDto(
  items: (json['items'] as List<dynamic>)
      .map((e) => OrderListItemDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  total: json['total'] as num,
  page: json['page'] as num,
  pageSize: json['pageSize'] as num,
);

Map<String, dynamic> _$OrderListResponseDtoToJson(
  OrderListResponseDto instance,
) => <String, dynamic>{
  'items': instance.items,
  'total': instance.total,
  'page': instance.page,
  'pageSize': instance.pageSize,
};
