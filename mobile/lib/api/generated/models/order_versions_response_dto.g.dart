// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_versions_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderVersionsResponseDto _$OrderVersionsResponseDtoFromJson(
  Map<String, dynamic> json,
) => OrderVersionsResponseDto(
  items: (json['items'] as List<dynamic>)
      .map((e) => OrderVersionItemDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$OrderVersionsResponseDtoToJson(
  OrderVersionsResponseDto instance,
) => <String, dynamic>{'items': instance.items};
