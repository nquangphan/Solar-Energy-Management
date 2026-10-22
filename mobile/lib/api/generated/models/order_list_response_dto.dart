// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_list_item_dto.dart';

part 'order_list_response_dto.g.dart';

@JsonSerializable()
class OrderListResponseDto {
  const OrderListResponseDto({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });
  
  factory OrderListResponseDto.fromJson(Map<String, Object?> json) => _$OrderListResponseDtoFromJson(json);
  
  final List<OrderListItemDto> items;

  /// Tổng số đơn khớp bộ lọc và trong phạm vi quyền (KHÔNG phải số dòng của trang này).
  final num total;

  /// Trang hiện tại (bắt đầu từ 1).
  final num page;

  /// Số bản ghi mỗi trang.
  final num pageSize;

  Map<String, Object?> toJson() => _$OrderListResponseDtoToJson(this);
}
