// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_list_item_dto_status.dart';

part 'order_list_item_dto.g.dart';

@JsonSerializable()
class OrderListItemDto {
  const OrderListItemDto({
    required this.id,
    required this.status,
    required this.customerPhone,
    required this.customerName,
    required this.ownerAccountId,
    required this.createdAt,
    required this.updatedAt,
    this.assigneeAccountId,
  });
  
  factory OrderListItemDto.fromJson(Map<String, Object?> json) => _$OrderListItemDtoFromJson(json);
  
  final String id;
  final OrderListItemDtoStatus status;

  /// SĐT khách dạng E.164 (PK khách).
  final String customerPhone;

  /// Tên khách, đọc qua relation.
  final String customerName;

  /// Người tạo/sở hữu đơn.
  final String ownerAccountId;

  /// Người được giao chăm đơn; null nếu chưa giao.
  final String? assigneeAccountId;

  /// ISO-8601 UTC.
  final DateTime createdAt;

  /// ISO-8601 UTC.
  final DateTime updatedAt;

  Map<String, Object?> toJson() => _$OrderListItemDtoToJson(this);
}
