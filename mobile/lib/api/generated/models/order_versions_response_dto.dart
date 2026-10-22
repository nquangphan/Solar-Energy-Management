// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_version_item_dto.dart';

part 'order_versions_response_dto.g.dart';

@JsonSerializable()
class OrderVersionsResponseDto {
  const OrderVersionsResponseDto({
    required this.items,
  });
  
  factory OrderVersionsResponseDto.fromJson(Map<String, Object?> json) => _$OrderVersionsResponseDtoFromJson(json);
  
  final List<OrderVersionItemDto> items;

  Map<String, Object?> toJson() => _$OrderVersionsResponseDtoToJson(this);
}
