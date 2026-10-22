// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'customer_list_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CustomerListResponseDto _$CustomerListResponseDtoFromJson(
  Map<String, dynamic> json,
) => CustomerListResponseDto(
  items: (json['items'] as List<dynamic>)
      .map((e) => CustomerResponseDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  total: json['total'] as num,
  page: json['page'] as num,
  pageSize: json['pageSize'] as num,
);

Map<String, dynamic> _$CustomerListResponseDtoToJson(
  CustomerListResponseDto instance,
) => <String, dynamic>{
  'items': instance.items,
  'total': instance.total,
  'page': instance.page,
  'pageSize': instance.pageSize,
};
