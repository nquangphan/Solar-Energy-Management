// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'replace_product_group_items_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReplaceProductGroupItemsRequestDto _$ReplaceProductGroupItemsRequestDtoFromJson(
  Map<String, dynamic> json,
) => ReplaceProductGroupItemsRequestDto(
  productIds: (json['productIds'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$ReplaceProductGroupItemsRequestDtoToJson(
  ReplaceProductGroupItemsRequestDto instance,
) => <String, dynamic>{'productIds': instance.productIds};
